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

export async function GET(request: NextRequest) {
  try {
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

    // Resolve active student membership
    const membershipRows = await queryDb(
      `SELECT m.id as "membershipId", m."instituteId", m.role, m.status,
              sp.id as "studentProfileId", sp."admissionNo",
              u.id as "userId", u."fullName", u."avatarUrl"
       FROM "Membership" m
       JOIN "StudentProfile" sp ON sp."membershipId" = m.id
       JOIN "User" u ON m."userId" = u.id
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

    // Fetch enrolled batches
    const enrolledBatchRows = await queryDb(
      `SELECT e."batchId", b.name as "batchName", c.id as "courseId", c.title as "courseTitle"
       FROM "Enrolment" e
       JOIN "Batch" b ON e."batchId" = b.id
       JOIN "Course" c ON b."courseId" = c.id
       WHERE e."studentProfileId" = $1 AND e.status IN ('ACTIVE', 'COMPLETED') AND e."batchId" IS NOT NULL`,
      [studentProfileId]
    );

    const enrolledBatchIds = enrolledBatchRows.map((b: any) => b.batchId);

    if (enrolledBatchIds.length === 0) {
      return NextResponse.json({
        sessions: [],
        summary: { total: 0, upcoming: 0, liveNow: 0, completed: 0, recorded: 0, cancelled: 0 },
        batches: [],
      });
    }

    const url = new URL(request.url);
    const filterStatus = url.searchParams.get('status') || 'ALL';
    const filterBatchId = url.searchParams.get('batchId');
    const filterQuery = url.searchParams.get('q');
    const filterDate = url.searchParams.get('date');

    if (filterBatchId && !enrolledBatchIds.includes(filterBatchId)) {
      return NextResponse.json({ message: 'Access denied: You are not enrolled in the requested batch.' }, { status: 403 });
    }

    const targetBatchIds = filterBatchId ? [filterBatchId] : enrolledBatchIds;

    let dateCondition = '';
    const queryParams: any[] = [studentProfileId, resolvedInstituteId, targetBatchIds];

    if (filterDate) {
      dateCondition = ` AND DATE(ls."startsAt") = $${queryParams.length + 1}`;
      queryParams.push(filterDate);
    }

    const sessionRows = await queryDb(
      `SELECT ls.id, ls.title, ls.description, ls.room, ls."startsAt", ls."endsAt", ls."joinUrl", ls."recordingUrl", ls.status as "rawStatus",
              ls."batchId", b.name as "batchName", b."courseId", c.title as "courseTitle",
              tp.id as "teacherProfileId", tp."photoUrl" as "teacherPhoto", u."fullName" as "teacherName",
              att.status as "attendanceStatus"
       FROM "LiveSession" ls
       JOIN "Batch" b ON ls."batchId" = b.id
       JOIN "Course" c ON b."courseId" = c.id
       LEFT JOIN "TeacherProfile" tp ON ls."teacherProfileId" = tp.id
       LEFT JOIN "Membership" tm ON tp."membershipId" = tm.id
       LEFT JOIN "User" u ON tm."userId" = u.id
       LEFT JOIN "Attendance" att ON att."liveSessionId" = ls.id AND att."studentProfileId" = $1
       WHERE ls."instituteId" = $2 AND ls."batchId" = ANY($3::text[]) ${dateCondition}
       ORDER BY ls."startsAt" ASC`,
      queryParams
    );

    const now = new Date();
    const reminderWindowMs = 15 * 60 * 1000;

    let upcomingCount = 0;
    let liveNowCount = 0;
    let completedCount = 0;
    let recordedCount = 0;
    let cancelledCount = 0;

    let mapped = sessionRows.map((s: any) => {
      const startsAt = new Date(s.startsAt);
      const endsAt = new Date(s.endsAt);

      let dynamicStatus: 'LIVE_NOW' | 'STARTING_SOON' | 'UPCOMING' | 'COMPLETED' | 'CANCELLED';
      if (s.rawStatus === 'CANCELLED') {
        dynamicStatus = 'CANCELLED';
        cancelledCount++;
      } else if (now >= startsAt && now <= endsAt) {
        dynamicStatus = 'LIVE_NOW';
        liveNowCount++;
      } else if (now < startsAt && startsAt.getTime() - now.getTime() <= reminderWindowMs) {
        dynamicStatus = 'STARTING_SOON';
        upcomingCount++;
      } else if (now < startsAt) {
        dynamicStatus = 'UPCOMING';
        upcomingCount++;
      } else {
        dynamicStatus = 'COMPLETED';
        completedCount++;
      }

      const hasRecording = !!s.recordingUrl && dynamicStatus === 'COMPLETED';
      if (hasRecording) recordedCount++;

      const canJoin =
        (dynamicStatus === 'LIVE_NOW' || dynamicStatus === 'STARTING_SOON') &&
        !!s.joinUrl &&
        s.rawStatus !== 'CANCELLED';

      let platform = 'OTHER';
      if (s.joinUrl?.includes('meet.google.com')) platform = 'GOOGLE_MEET';
      else if (s.joinUrl?.includes('zoom.us')) platform = 'ZOOM';
      else if (s.joinUrl?.includes('teams.microsoft.com')) platform = 'MICROSOFT_TEAMS';

      return {
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
      };
    });

    if (filterStatus && filterStatus !== 'ALL') {
      if (filterStatus === 'UPCOMING') {
        mapped = mapped.filter((s: any) => s.status === 'UPCOMING' || s.status === 'STARTING_SOON');
      } else if (filterStatus === 'LIVE_NOW') {
        mapped = mapped.filter((s: any) => s.status === 'LIVE_NOW');
      } else if (filterStatus === 'COMPLETED') {
        mapped = mapped.filter((s: any) => s.status === 'COMPLETED');
      } else if (filterStatus === 'RECORDED') {
        mapped = mapped.filter((s: any) => s.hasRecording);
      } else if (filterStatus === 'CANCELLED') {
        mapped = mapped.filter((s: any) => s.status === 'CANCELLED');
      }
    }

    if (filterQuery) {
      const qLower = filterQuery.toLowerCase();
      mapped = mapped.filter(
        (s: any) =>
          s.title.toLowerCase().includes(qLower) ||
          s.courseTitle.toLowerCase().includes(qLower) ||
          s.teacherName.toLowerCase().includes(qLower) ||
          s.batchName.toLowerCase().includes(qLower)
      );
    }

    const batches = enrolledBatchRows.map((b: any) => ({
      id: b.batchId,
      name: b.batchName,
      courseTitle: b.courseTitle,
    }));

    return NextResponse.json({
      sessions: mapped,
      summary: {
        total: sessionRows.length,
        upcoming: upcomingCount,
        liveNow: liveNowCount,
        completed: completedCount,
        recorded: recordedCount,
        cancelled: cancelledCount,
      },
      batches,
    });
  } catch (error: any) {
    console.error('Error in GET /students/live-sessions:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

