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
  context: { params: Promise<{ examId: string; attemptId: string }> }
) {
  try {
    const { examId, attemptId } = await context.params;
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

    const studentProfileId = membershipRows[0].studentProfileId;

    const attemptRows = await queryDb(
      `SELECT a.id, a."examId", a."startedAt", a.status,
              ex.title as "examTitle", ex."durationMin", ex."totalMarks"
       FROM "ExamAttempt" a
       JOIN "Exam" ex ON a."examId" = ex.id
       WHERE a.id = $1 AND a."examId" = $2 AND a."studentProfileId" = $3 LIMIT 1`,
      [attemptId, examId, studentProfileId]
    );

    if (attemptRows.length === 0) {
      return NextResponse.json({ message: 'Examination attempt not found or unauthorized.' }, { status: 404 });
    }

    const att = attemptRows[0];
    const now = new Date();
    const startedAt = new Date(att.startedAt);
    const durationMs = att.durationMin * 60 * 1000;
    const elapsedMs = now.getTime() - startedAt.getTime();
    const remainingSec = Math.max(0, Math.floor((durationMs - elapsedMs) / 1000));

    // Fetch questions and options (without exposing isCorrect)
    const questions = await queryDb(
      `SELECT q.id, q.prompt, q.type, q.marks, q.position
       FROM "Question" q
       WHERE q."examId" = $1
       ORDER BY q.position ASC`,
      [examId]
    );

    const questionIds = questions.map((q: any) => q.id);

    let options: any[] = [];
    if (questionIds.length > 0) {
      options = await queryDb(
        `SELECT id, "questionId", label
         FROM "QuestionOption"
         WHERE "questionId" = ANY($1::text[])`,
        [questionIds]
      );
    }

    const answers = await queryDb(
      `SELECT "questionId", "chosenText"
       FROM "AttemptAnswer"
       WHERE "attemptId" = $1`,
      [attemptId]
    );

    const ansMap = new Map(answers.map((a: any) => [a.questionId, a.chosenText]));
    const optMap = new Map<string, any[]>();
    for (const opt of options) {
      if (!optMap.has(opt.questionId)) optMap.set(opt.questionId, []);
      optMap.get(opt.questionId)!.push(opt);
    }

    const mappedQuestions = questions.map((q: any, idx: number) => ({
      id: q.id,
      number: idx + 1,
      prompt: q.prompt,
      type: q.type,
      marks: q.marks,
      options: optMap.get(q.id) || [],
      savedAnswer: ansMap.get(q.id) || null,
    }));

    return NextResponse.json({
      attempt: {
        id: att.id,
        examId: att.examId,
        examTitle: att.examTitle,
        durationMin: att.durationMin,
        totalMarks: att.totalMarks,
        startedAt: startedAt.toISOString(),
        status: att.status,
        remainingSec,
        isExpired: remainingSec === 0,
      },
      questions: mappedQuestions,
    });
  } catch (error: any) {
    console.error('Error in GET /students/exams/[examId]/attempts/[attemptId]:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

