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
  context: { params: Promise<{ assignmentId: string }> }
) {
  try {
    const { assignmentId } = await context.params;
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
      return NextResponse.json({ message: 'Only active STUDENT accounts may access assignment details.' }, { status: 403 });
    }

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

    const assignmentRows = await queryDb(
      `SELECT a.id, a.title, a.instructions, a."dueAt", a."maxMarks",
              a."courseId", c.title as "courseTitle",
              b.id as "batchId", b.name as "batchName",
              s.id as "submissionId", s."submittedAt", s."answerText", s."fileUrl", s."marksAwarded", s.feedback, s.status as "submissionStatus"
       FROM "Assignment" a
       JOIN "Course" c ON a."courseId" = c.id
       LEFT JOIN "Batch" b ON a."batchId" = b.id
       LEFT JOIN "Submission" s ON s."assignmentId" = a.id AND s."studentProfileId" = $1
       WHERE a.id = $2 AND a."instituteId" = $3
       LIMIT 1`,
      [studentProfileId, assignmentId, resolvedInstituteId]
    );

    if (assignmentRows.length === 0) {
      return NextResponse.json({ message: 'Assignment not found in your institute.' }, { status: 404 });
    }

    const a = assignmentRows[0];

    // Enrolment check
    const enrolmentRows = await queryDb(
      `SELECT id FROM "Enrolment"
       WHERE "studentProfileId" = $1 AND "courseId" = $2 AND status IN ('ACTIVE', 'COMPLETED')
       LIMIT 1`,
      [studentProfileId, a.courseId]
    );

    if (enrolmentRows.length === 0) {
      return NextResponse.json({ message: 'Access denied: You are not enrolled in the course for this assignment.' }, { status: 403 });
    }

    const now = new Date();
    const dueAt = new Date(a.dueAt);
    let dynamicStatus: 'PENDING' | 'SUBMITTED' | 'UNDER_REVIEW' | 'GRADED' | 'OVERDUE';

    if (a.submissionId) {
      dynamicStatus = a.submissionStatus === 'GRADED' ? 'GRADED' : 'SUBMITTED';
    } else {
      dynamicStatus = now > dueAt ? 'OVERDUE' : 'PENDING';
    }

    return NextResponse.json({
      assignment: {
        id: a.id,
        title: a.title,
        instructions: a.instructions,
        courseId: a.courseId,
        courseTitle: a.courseTitle,
        batchId: a.batchId,
        batchName: a.batchName,
        dueAt: dueAt.toISOString(),
        maxMarks: a.maxMarks,
        status: dynamicStatus,
        isOverdue: now > dueAt && !a.submissionId,
        canSubmit: !a.submissionId || a.submissionStatus !== 'GRADED',
        submission: a.submissionId
          ? {
              id: a.submissionId,
              submittedAt: new Date(a.submittedAt).toISOString(),
              answerText: a.answerText,
              fileUrl: a.fileUrl,
              marksAwarded: a.marksAwarded,
              feedback: a.feedback,
              status: a.submissionStatus,
            }
          : null,
      },
    });
  } catch (error: any) {
    console.error('Error in GET /students/assignments/[assignmentId]:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

