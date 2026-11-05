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

export async function POST(
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
      return NextResponse.json({ message: 'Only active STUDENT accounts may take examinations.' }, { status: 403 });
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
      `SELECT id, "courseId", "durationMin" FROM "Exam"
       WHERE id = $1 AND "instituteId" = $2 LIMIT 1`,
      [examId, resolvedInstituteId]
    );

    if (examRows.length === 0) {
      return NextResponse.json({ message: 'Examination not found.' }, { status: 404 });
    }

    const ex = examRows[0];

    const enrolmentRows = await queryDb(
      `SELECT id FROM "Enrolment"
       WHERE "studentProfileId" = $1 AND "courseId" = $2 AND status IN ('ACTIVE', 'COMPLETED') LIMIT 1`,
      [studentProfileId, ex.courseId]
    );

    if (enrolmentRows.length === 0) {
      return NextResponse.json({ message: 'Access denied: You are not enrolled in the course for this examination.' }, { status: 403 });
    }

    const existingAttempts = await queryDb(
      `SELECT id, "startedAt", status FROM "ExamAttempt"
       WHERE "examId" = $1 AND "studentProfileId" = $2 AND status = 'IN_PROGRESS'
       ORDER BY "startedAt" DESC LIMIT 1`,
      [examId, studentProfileId]
    );

    const now = new Date();
    const durationMs = ex.durationMin * 60 * 1000;

    if (existingAttempts.length > 0) {
      const att = existingAttempts[0];
      const startedAt = new Date(att.startedAt);
      const elapsedMs = now.getTime() - startedAt.getTime();

      if (elapsedMs < durationMs) {
        const remainingSec = Math.max(0, Math.floor((durationMs - elapsedMs) / 1000));
        return NextResponse.json({
          attemptId: att.id,
          resumed: true,
          startedAt: startedAt.toISOString(),
          durationMin: ex.durationMin,
          remainingSec,
        });
      } else {
        await queryDb(
          `UPDATE "ExamAttempt" SET status = 'SUBMITTED', "submittedAt" = $1 WHERE id = $2`,
          [now, att.id]
        );
      }
    }

    const newAttemptId = crypto.randomUUID();
    await queryDb(
      `INSERT INTO "ExamAttempt" (id, "instituteId", "examId", "studentProfileId", "startedAt", status)
       VALUES ($1, $2, $3, $4, $5, 'IN_PROGRESS')`,
      [newAttemptId, resolvedInstituteId, examId, studentProfileId, now]
    );

    return NextResponse.json({
      attemptId: newAttemptId,
      resumed: false,
      startedAt: now.toISOString(),
      durationMin: ex.durationMin,
      remainingSec: ex.durationMin * 60,
    });
  } catch (error: any) {
    console.error('Error in POST /students/exams/[examId]/start:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

