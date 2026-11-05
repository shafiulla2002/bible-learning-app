import { NextRequest, NextResponse } from 'next/server';
import { queryDb } from '@/lib/server-db';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

function verifyJwtToken(token: string, secret: string): any {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');
  const [headerB64, payloadB64, signatureB64] = parts;

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(`${headerB64}.${payloadB64}`);
  const expectedSig = hmac.digest('base64url');

  const sigBuf = Buffer.from(signatureB64);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    throw new Error('Invalid signature');
  }

  const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  if (payload.exp && Date.now() >= payload.exp * 1000) {
    throw new Error('Token expired');
  }
  return payload;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await context.params;
    const authHeader = request.headers.get('authorization');
    const devUserId = request.headers.get('x-dev-user-id');
    const devRole = request.headers.get('x-dev-role');
    const devInstituteId = request.headers.get('x-dev-institute-id');

    let userId: string | null = null;
    let role: string | null = null;
    let instituteId: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = verifyJwtToken(
          token,
          process.env.JWT_SECRET || 'dev-secret-key-bible-institute-lms-12345'
        );
        userId = decoded.sub || decoded.userId;
        role = decoded.role;
        instituteId = decoded.instituteId;
      } catch {
        return NextResponse.json({ message: 'Invalid or expired authentication token' }, { status: 401 });
      }
    } else if (devRole) {
      userId = devUserId || 'dev-student-user';
      role = devRole;
      instituteId = devInstituteId;
    } else {
      return NextResponse.json({ message: 'Authentication token required' }, { status: 401 });
    }

    if (role && role !== 'STUDENT') {
      return NextResponse.json({ message: 'Only active STUDENT accounts may access live sessions.' }, { status: 403 });
    }

    // Resolve student profile
    const membershipRows = await queryDb(
      `SELECT m.id as "membershipId", m."instituteId",
              sp.id as "studentProfileId"
       FROM "Membership" m
       JOIN "StudentProfile" sp ON sp."membershipId" = m.id
       WHERE m."userId" = $1 AND m.role = 'STUDENT' AND m.status = 'ACTIVE'
       ${instituteId ? 'AND m."instituteId" = $2' : ''}
       LIMIT 1`,
      instituteId ? [userId, instituteId] : [userId]
    );

    if (membershipRows.length === 0) {
      return NextResponse.json({ message: 'No active student profile found for this account.' }, { status: 403 });
    }

    const studentMembership = membershipRows[0];
    const resolvedInstituteId = studentMembership.instituteId;
    const studentProfileId = studentMembership.studentProfileId;

    // Fetch session
    const sessionRows = await queryDb(
      `SELECT ls.id, ls.title, ls.description, ls.room, ls."startsAt", ls."endsAt", ls."joinUrl", ls."recordingUrl", ls.status as "rawStatus",
              ls."batchId", b.name as "batchName", b."courseId", c.title as "courseTitle",
              tp.id as "teacherProfileId", tp."photoUrl" as "teacherPhoto", u."fullName" as "teacherName",
              att.status as "attendanceStatus", att.remarks as "attendanceRemarks"
       FROM "LiveSession" ls
       JOIN "Batch" b ON ls."batchId" = b.id
       JOIN "Course" c ON b."courseId" = c.id
       LEFT JOIN "TeacherProfile" tp ON ls."teacherProfileId" = tp.id
       LEFT JOIN "Membership" tm ON tp."membershipId" = tm.id
       LEFT JOIN "User" u ON tm."userId" = u.id
       LEFT JOIN "Attendance" att ON att."liveSessionId" = ls.id AND att."studentProfileId" = $1
       WHERE ls.id = $2 AND ls."instituteId" = $3
       LIMIT 1`,
      [studentProfileId, sessionId, resolvedInstituteId]
    );

    if (sessionRows.length === 0) {
      return NextResponse.json({ message: 'Live session not found in your institute.' }, { status: 404 });
    }

    const s = sessionRows[0];

    // Verify enrollment in session's batch
    const enrolmentRows = await queryDb(
      `SELECT id FROM "Enrolment"
       WHERE "studentProfileId" = $1 AND "batchId" = $2 AND status IN ('ACTIVE', 'COMPLETED')
       LIMIT 1`,
      [studentProfileId, s.batchId]
    );

    if (enrolmentRows.length === 0) {
      return NextResponse.json({ message: 'Access denied: You are not enrolled in the batch for this session.' }, { status: 403 });
    }

    const now = new Date();
    const reminderWindowMs = 15 * 60 * 1000;
    const startsAt = new Date(s.startsAt);
    const endsAt = new Date(s.endsAt);

    let dynamicStatus: 'LIVE_NOW' | 'STARTING_SOON' | 'UPCOMING' | 'COMPLETED' | 'CANCELLED';
    if (s.rawStatus === 'CANCELLED') {
      dynamicStatus = 'CANCELLED';
    } else if (now >= startsAt && now <= endsAt) {
      dynamicStatus = 'LIVE_NOW';
    } else if (now < startsAt && startsAt.getTime() - now.getTime() <= reminderWindowMs) {
      dynamicStatus = 'STARTING_SOON';
    } else if (now < startsAt) {
      dynamicStatus = 'UPCOMING';
    } else {
      dynamicStatus = 'COMPLETED';
    }

    const hasRecording = !!s.recordingUrl && dynamicStatus === 'COMPLETED';
    const canJoin =
      (dynamicStatus === 'LIVE_NOW' || dynamicStatus === 'STARTING_SOON') &&
      !!s.joinUrl &&
      s.rawStatus !== 'CANCELLED';

    let platform = 'OTHER';
    if (s.joinUrl?.includes('meet.google.com')) platform = 'GOOGLE_MEET';
    else if (s.joinUrl?.includes('zoom.us')) platform = 'ZOOM';
    else if (s.joinUrl?.includes('teams.microsoft.com')) platform = 'MICROSOFT_TEAMS';

    return NextResponse.json({
      session: {
        id: s.id,
        title: s.title,
        description: s.description,
        courseId: s.courseId,
        courseTitle: s.courseTitle,
        batchId: s.batchId,
        batchName: s.batchName,
        teacherName: s.teacherName || 'Faculty Instructor',
        teacherPhoto: s.teacherPhoto || null,
        room: s.room,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        status: dynamicStatus,
        rawStatus: s.rawStatus,
        platform,
        canJoin,
        joinUrl: canJoin ? s.joinUrl : null,
        hasRecording,
        recordingUrl: hasRecording ? s.recordingUrl : null,
        attendanceStatus: s.attendanceStatus || null,
        attendanceRemarks: s.attendanceRemarks || null,
      },
    });
  } catch (error: any) {
    console.error('Error in GET /students/live-sessions/[sessionId]:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

