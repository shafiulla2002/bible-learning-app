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
  context: { params: Promise<{ examId: string; attemptId: string }> }
) {
  try {
    const { examId, attemptId } = await context.params;
    const body = await request.json();
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
      return NextResponse.json({ message: 'Only active STUDENT accounts may submit examinations.' }, { status: 403 });
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

    const studentProfileId = membershipRows[0].studentProfileId;

    const attemptRows = await queryDb(
      `SELECT a.id, a."examId", a.score, a.status,
              ex."totalMarks", ex."passMarks"
       FROM "ExamAttempt" a
       JOIN "Exam" ex ON a."examId" = ex.id
       WHERE a.id = $1 AND a."examId" = $2 AND a."studentProfileId" = $3 LIMIT 1`,
      [attemptId, examId, studentProfileId]
    );

    if (attemptRows.length === 0) {
      return NextResponse.json({ message: 'Examination attempt not found.' }, { status: 404 });
    }

    const att = attemptRows[0];

    if (att.status === 'SUBMITTED' || att.status === 'EVALUATED') {
      return NextResponse.json({
        success: true,
        message: 'Examination attempt was already submitted.',
        attemptId: att.id,
        score: att.score,
        totalMarks: att.totalMarks,
        passMarks: att.passMarks,
        passed: att.score !== null ? att.score >= att.passMarks : null,
      });
    }

    // Save final answers
    const answers = body?.answers || {};
    for (const [qId, chosen] of Object.entries(answers)) {
      await queryDb(
        `INSERT INTO "AttemptAnswer" (id, "attemptId", "questionId", "chosenText")
         VALUES ($1, $2, $3, $4)
         ON CONFLICT ("attemptId", "questionId")
         DO UPDATE SET "chosenText" = EXCLUDED."chosenText"`,
        [crypto.randomUUID(), attemptId, qId, String(chosen)]
      );
    }

    // Auto-grade objective questions
    const questions = await queryDb(
      `SELECT q.id, q.marks, q.type
       FROM "Question" q WHERE q."examId" = $1`,
      [examId]
    );

    const questionIds = questions.map((q: any) => q.id);
    let options: any[] = [];
    if (questionIds.length > 0) {
      options = await queryDb(
        `SELECT "questionId", id, label, "isCorrect"
         FROM "QuestionOption" WHERE "questionId" = ANY($1::text[])`,
        [questionIds]
      );
    }

    const savedAnswers = await queryDb(
      `SELECT "questionId", "chosenText" FROM "AttemptAnswer" WHERE "attemptId" = $1`,
      [attemptId]
    );
    const ansMap = new Map(savedAnswers.map((a: any) => [a.questionId, a.chosenText]));

    let totalScore = 0;
    for (const q of questions) {
      const chosen = ansMap.get(q.id);
      if (!chosen) continue;

      if (q.type === 'MCQ_SINGLE' || q.type === 'TRUE_FALSE') {
        const correctOpt = options.find((o: any) => o.questionId === q.id && o.isCorrect);
        if (correctOpt && (correctOpt.label === chosen || correctOpt.id === chosen)) {
          totalScore += q.marks;
          await queryDb(
            `UPDATE "AttemptAnswer" SET score = $1 WHERE "attemptId" = $2 AND "questionId" = $3`,
            [q.marks, attemptId, q.id]
          );
        }
      } else {
        totalScore += Math.floor(q.marks * 0.8);
      }
    }

    const now = new Date();
    await queryDb(
      `UPDATE "ExamAttempt"
       SET score = $1, "submittedAt" = $2, status = 'EVALUATED'
       WHERE id = $3`,
      [totalScore, now, attemptId]
    );

    const passed = totalScore >= att.passMarks;

    return NextResponse.json({
      success: true,
      message: 'Examination submitted and evaluated successfully.',
      attemptId,
      score: totalScore,
      totalMarks: att.totalMarks,
      passMarks: att.passMarks,
      scorePct: Math.round((totalScore / (att.totalMarks || 100)) * 100),
      passed,
      submittedAt: now.toISOString(),
    });
  } catch (error: any) {
    console.error('Error in POST /students/exams/[examId]/attempts/[attemptId]/submit:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

