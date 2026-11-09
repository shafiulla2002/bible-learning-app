import { NextRequest, NextResponse } from 'next/server';
import { resolveAuthenticatedTeacher, TeacherAuthError } from '@/lib/server-teacher';
import { queryDb } from '@/lib/server-db';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ examId: string; attemptId: string }> }
) {
  try {
    const { examId, attemptId } = await context.params;
    const teacher = await resolveAuthenticatedTeacher(request);
    const { teacherProfileId, instituteId, userId } = teacher;

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
        { success: false, error: 'You are not authorized to evaluate attempts for this examination.' },
        { status: 403 }
      );
    }

    const attemptRows = await queryDb<any>(
      `SELECT id, "examId", "studentProfileId", score, status
       FROM "ExamAttempt"
       WHERE id = $1 AND "examId" = $2 AND "instituteId" = $3
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

    const body = await request.json();
    const scoreVal = Number(body.score);

    if (isNaN(scoreVal) || scoreVal < 0 || scoreVal > exam.totalMarks) {
      return NextResponse.json(
        { success: false, error: `Awarded score must be between 0 and maximum exam marks (${exam.totalMarks})` },
        { status: 400 }
      );
    }

    const feedback = body.feedback ? String(body.feedback).trim() : null;

    // Update individual question scores if provided
    if (Array.isArray(body.answers)) {
      for (const ans of body.answers) {
        if (ans.questionId && ans.score !== undefined) {
          const ansScore = Math.round(Number(ans.score));
          const ansFeedback = ans.feedback ? String(ans.feedback).trim() : null;

          // Check if AttemptAnswer already exists
          const existingAns = await queryDb<any>(
            `SELECT id FROM "AttemptAnswer" WHERE "attemptId" = $1 AND "questionId" = $2 LIMIT 1`,
            [attemptId, ans.questionId]
          );

          if (existingAns.length > 0) {
            await queryDb(
              `UPDATE "AttemptAnswer"
               SET score = $1, feedback = $2
               WHERE "attemptId" = $3 AND "questionId" = $4`,
              [ansScore, ansFeedback, attemptId, ans.questionId]
            );
          } else {
            const answerId = crypto.randomUUID();
            await queryDb(
              `INSERT INTO "AttemptAnswer" (id, "attemptId", "questionId", score, feedback)
               VALUES ($1, $2, $3, $4, $5)`,
              [answerId, attemptId, ans.questionId, ansScore, ansFeedback]
            );
          }
        }
      }
    }

    // Update ExamAttempt
    const roundedScore = Math.round(scoreVal);
    const updatedAttempt = await queryDb<any>(
      `UPDATE "ExamAttempt"
       SET score = $1, status = 'EVALUATED', feedback = $2
       WHERE id = $3
       RETURNING id, "examId", "studentProfileId", score, status, feedback`,
      [roundedScore, feedback, attemptId]
    );

    // Write AuditLog
    try {
      const auditLogId = crypto.randomUUID();
      await queryDb(
        `INSERT INTO "AuditLog" (id, "instituteId", "actorUserId", action, "entityType", "entityId", metadata, "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          auditLogId,
          instituteId,
          userId,
          'EXAM_ATTEMPT_EVALUATED',
          'ExamAttempt',
          attemptId,
          JSON.stringify({
            examId,
            studentProfileId: attempt.studentProfileId,
            previousScore: attempt.score,
            awardedScore: roundedScore,
            totalMarks: exam.totalMarks,
            feedback,
          }),
        ]
      );
    } catch (auditErr: any) {
      console.warn('AuditLog insertion warning:', auditErr?.message);
    }

    return NextResponse.json({
      success: true,
      message: 'Examination attempt evaluated successfully',
      data: updatedAttempt[0],
    });
  } catch (error: any) {
    if (error instanceof TeacherAuthError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error('Error evaluating exam attempt:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
