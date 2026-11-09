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
  context: { params: Promise<{ examId: string }> }
) {
  try {
    const { examId } = await context.params;
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
      return NextResponse.json({ message: 'Only active STUDENT accounts may access examinations.' }, { status: 403 });
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

    const examRows = await queryDb(
      `SELECT ex.id, ex.title, ex.type, ex.status, ex."durationMin", ex."totalMarks", ex."passMarks",
              ex."courseId", c.title as "courseTitle",
              (SELECT COUNT(*) FROM "Question" q WHERE q."examId" = ex.id)::int as "totalQuestions"
       FROM "Exam" ex
       JOIN "Course" c ON ex."courseId" = c.id
       WHERE ex.id = $1 AND ex."instituteId" = $2 LIMIT 1`,
      [examId, resolvedInstituteId]
    );

    if (examRows.length === 0) {
      return NextResponse.json({ message: 'Examination not found in your institute.' }, { status: 404 });
    }

    const ex = examRows[0];

    if (ex.status && ex.status !== 'PUBLISHED') {
      return NextResponse.json(
        { message: 'Examination is currently in draft and not accessible.' },
        { status: 403 }
      );
    }

    // Enrolment check
    const enrolmentRows = await queryDb(
      `SELECT id FROM "Enrolment"
       WHERE "studentProfileId" = $1 AND "courseId" = $2 AND status IN ('ACTIVE', 'COMPLETED') LIMIT 1`,
      [studentProfileId, ex.courseId]
    );

    if (enrolmentRows.length === 0) {
      return NextResponse.json({ message: 'Access denied: You are not enrolled in the course for this examination.' }, { status: 403 });
    }

    const attempts = await queryDb(
      `SELECT id, "startedAt", "submittedAt", score, status
       FROM "ExamAttempt"
       WHERE "examId" = $1 AND "studentProfileId" = $2
       ORDER BY "startedAt" DESC`,
      [examId, studentProfileId]
    );

    const activeAttempt = attempts.find((a: any) => a.status === 'IN_PROGRESS');

    return NextResponse.json({
      exam: {
        id: ex.id,
        title: ex.title,
        type: ex.type,
        courseId: ex.courseId,
        courseTitle: ex.courseTitle,
        durationMin: ex.durationMin,
        totalMarks: ex.totalMarks,
        passMarks: ex.passMarks,
        totalQuestions: ex.totalQuestions,
        attempts: attempts.map((att: any) => ({
          id: att.id,
          startedAt: new Date(att.startedAt).toISOString(),
          submittedAt: att.submittedAt ? new Date(att.submittedAt).toISOString() : null,
          score: att.score,
          status: att.status,
          passed: att.score !== null ? att.score >= ex.passMarks : null,
        })),
        activeAttemptId: activeAttempt ? activeAttempt.id : null,
      },
    });
  } catch (error: any) {
    console.error('Error in GET /students/exams/[examId]:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

