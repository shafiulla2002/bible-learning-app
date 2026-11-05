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
      return NextResponse.json({ message: 'Only active STUDENT accounts may view results.' }, { status: 403 });
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

    const examRows = await queryDb(
      `SELECT ex.id, ex.title, ex."totalMarks", ex."passMarks", c.title as "courseTitle"
       FROM "Exam" ex
       JOIN "Course" c ON ex."courseId" = c.id
       WHERE ex.id = $1 LIMIT 1`,
      [examId]
    );

    if (examRows.length === 0) {
      return NextResponse.json({ message: 'Examination not found.' }, { status: 404 });
    }

    const ex = examRows[0];

    const attempts = await queryDb(
      `SELECT id, "startedAt", "submittedAt", score
       FROM "ExamAttempt"
       WHERE "examId" = $1 AND "studentProfileId" = $2 AND status IN ('SUBMITTED', 'EVALUATED')
       ORDER BY "submittedAt" DESC LIMIT 1`,
      [examId, studentProfileId]
    );

    if (attempts.length === 0) {
      return NextResponse.json({ message: 'No completed examination attempt found to display results.' }, { status: 404 });
    }

    const att = attempts[0];
    const score = att.score || 0;
    const passed = score >= ex.passMarks;

    const questions = await queryDb(
      `SELECT q.id, q.prompt, q.type, q.marks,
              ans.score as "scoreAwarded", ans."chosenText" as "studentAnswer",
              opt.label as "correctAnswer"
       FROM "Question" q
       LEFT JOIN "AttemptAnswer" ans ON ans."questionId" = q.id AND ans."attemptId" = $1
       LEFT JOIN "QuestionOption" opt ON opt."questionId" = q.id AND opt."isCorrect" = true
       WHERE q."examId" = $2
       ORDER BY q.position ASC`,
      [att.id, examId]
    );

    const questionResults = questions.map((q: any) => ({
      id: q.id,
      prompt: q.prompt,
      type: q.type,
      marks: q.marks,
      scoreAwarded: q.scoreAwarded || 0,
      studentAnswer: q.studentAnswer || null,
      correctAnswer: q.correctAnswer || null,
      isCorrect: (q.scoreAwarded || 0) > 0,
    }));

    return NextResponse.json({
      results: {
        examId: ex.id,
        examTitle: ex.title,
        courseTitle: ex.courseTitle,
        attemptId: att.id,
        startedAt: new Date(att.startedAt).toISOString(),
        submittedAt: att.submittedAt ? new Date(att.submittedAt).toISOString() : null,
        score,
        totalMarks: ex.totalMarks,
        passMarks: ex.passMarks,
        scorePct: Math.round((score / (ex.totalMarks || 100)) * 100),
        passed,
        questions: questionResults,
      },
    });
  } catch (error: any) {
    console.error('Error in GET /students/exams/[examId]/results:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

