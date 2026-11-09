import { NextRequest, NextResponse } from 'next/server';
import { resolveAuthenticatedTeacher, TeacherAuthError } from '@/lib/server-teacher';
import { queryDb } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ examId: string; attemptId: string }> }
) {
  try {
    const { examId, attemptId } = await context.params;
    const teacher = await resolveAuthenticatedTeacher(request);
    const { teacherProfileId, instituteId } = teacher;

    const examRows = await queryDb<any>(
      `SELECT 
        e.id,
        e.title,
        e."totalMarks",
        e."passMarks",
        e."courseId",
        e."batchId"
      FROM "Exam" e
      WHERE e.id = $1 AND e."instituteId" = $2
      LIMIT 1`,
      [examId, instituteId]
    );

    if (examRows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Examination not found in your institute' },
        { status: 404 }
      );
    }

    const exam = examRows[0];

    // Verify teacher authorization
    const authCheck = await queryDb<{ role: string }>(
      `SELECT role FROM (
        SELECT ci.role, 1 as priority
        FROM "CourseInstructor" ci
        WHERE ci."courseId" = $1 AND ci."teacherProfileId" = $2 AND ci."instituteId" = $3
        UNION ALL
        SELECT bt.role, 2 as priority
        FROM "BatchTeacher" bt
        JOIN "Batch" b ON b.id = bt."batchId"
        WHERE (b.id = $4 OR b."courseId" = $1)
          AND bt."teacherProfileId" = $2
          AND bt."instituteId" = $3
      ) a ORDER BY priority ASC LIMIT 1`,
      [exam.courseId, teacherProfileId, instituteId, exam.batchId || exam.courseId]
    );

    if (authCheck.length === 0) {
      return NextResponse.json(
        { success: false, error: 'You are not authorized to view attempts for this examination.' },
        { status: 403 }
      );
    }

    // Fetch the attempt with student profile & user
    const attemptRows = await queryDb<any>(
      `SELECT 
        att.id,
        att."examId",
        att."studentProfileId",
        att."startedAt",
        att."submittedAt",
        att.score,
        att.status,
        att.feedback,
        sp."admissionNo",
        u."fullName" as "studentName",
        u.email,
        u."avatarUrl"
      FROM "ExamAttempt" att
      JOIN "StudentProfile" sp ON sp.id = att."studentProfileId"
      JOIN "Membership" m ON m.id = sp."membershipId"
      JOIN "User" u ON u.id = m."userId"
      WHERE att.id = $1 AND att."examId" = $2 AND att."instituteId" = $3
      LIMIT 1`,
      [attemptId, examId, instituteId]
    );

    if (attemptRows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Attempt not found for this examination.' },
        { status: 404 }
      );
    }

    const attempt = attemptRows[0];

    // Fetch all questions for this exam
    const questions = await queryDb<any>(
      `SELECT 
        q.id,
        q.prompt,
        q.type,
        q.marks as "maxMarks",
        q.position,
        ans.id as "answerId",
        ans."chosenText",
        ans.score as "scoreAwarded",
        ans.feedback as "answerFeedback"
      FROM "Question" q
      LEFT JOIN "AttemptAnswer" ans ON ans."questionId" = q.id AND ans."attemptId" = $2
      WHERE q."examId" = $1
      ORDER BY q.position ASC`,
      [examId, attemptId]
    );

    // Fetch options for questions
    const questionIds = questions.map((q) => q.id);
    let options: any[] = [];
    if (questionIds.length > 0) {
      options = await queryDb<any>(
        `SELECT id, "questionId", label, "isCorrect"
         FROM "QuestionOption"
         WHERE "questionId" = ANY($1::text[])`,
        [questionIds]
      );
    }

    const optionsByQuestion = new Map<string, any[]>();
    options.forEach((opt) => {
      const list = optionsByQuestion.get(opt.questionId) || [];
      list.push({
        id: opt.id,
        label: opt.label,
        isCorrect: opt.isCorrect,
      });
      optionsByQuestion.set(opt.questionId, list);
    });

    const answers = questions.map((q) => ({
      questionId: q.id,
      prompt: q.prompt,
      type: q.type,
      maxMarks: q.maxMarks,
      position: q.position,
      chosenText: q.chosenText,
      scoreAwarded: q.scoreAwarded,
      feedback: q.answerFeedback,
      options: optionsByQuestion.get(q.id) || [],
    }));

    return NextResponse.json({
      success: true,
      data: {
        id: attempt.id,
        examId: attempt.examId,
        studentName: attempt.studentName,
        admissionNo: attempt.admissionNo,
        email: attempt.email,
        avatarUrl: attempt.avatarUrl,
        startedAt: attempt.startedAt ? new Date(attempt.startedAt).toISOString() : null,
        submittedAt: attempt.submittedAt ? new Date(attempt.submittedAt).toISOString() : null,
        status: attempt.status,
        score: attempt.score,
        totalMarks: exam.totalMarks,
        passMarks: exam.passMarks,
        feedback: attempt.feedback,
        answers,
      },
    });
  } catch (error: any) {
    if (error instanceof TeacherAuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error('Error fetching exam attempt detail:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
