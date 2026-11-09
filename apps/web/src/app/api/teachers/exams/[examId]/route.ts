import { NextRequest, NextResponse } from 'next/server';
import { resolveAuthenticatedTeacher, TeacherAuthError } from '@/lib/server-teacher';
import { queryDb } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ examId: string }> }
) {
  try {
    const { examId } = await context.params;
    const teacher = await resolveAuthenticatedTeacher(request);
    const { teacherProfileId, instituteId } = teacher;

    const examRows = await queryDb<any>(
      `SELECT 
        e.id,
        e.title,
        e.instructions,
        e.type,
        e."durationMin",
        e."totalMarks",
        e."passMarks",
        e.status,
        e."startAt",
        e."endAt",
        e."courseId",
        e."batchId",
        e."createdAt",
        e."updatedAt",
        c.title as "courseTitle",
        b.name as "batchName"
      FROM "Exam" e
      JOIN "Course" c ON c.id = e."courseId"
      LEFT JOIN "Batch" b ON b.id = e."batchId"
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
        { success: false, error: 'You are not authorized to view or manage this examination.' },
        { status: 403 }
      );
    }

    // Fetch questions and options
    const questions = await queryDb<any>(
      `SELECT 
        q.id,
        q.prompt,
        q.type,
        q.marks,
        q.position
      FROM "Question" q
      WHERE q."examId" = $1
      ORDER BY q.position ASC`,
      [examId]
    );

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
      const arr = optionsByQuestion.get(opt.questionId) || [];
      arr.push(opt);
      optionsByQuestion.set(opt.questionId, arr);
    });

    const fullQuestions = questions.map((q) => ({
      ...q,
      options: optionsByQuestion.get(q.id) || [],
    }));

    // Enrolments & attempt counters
    const [enrolmentRes, attemptsRes] = await Promise.all([
      queryDb<{ count: number }>(
        exam.batchId
          ? `SELECT COUNT(DISTINCT "studentProfileId")::int as count FROM "Enrolment" WHERE "batchId" = $1 AND "instituteId" = $2 AND status = 'ACTIVE'`
          : `SELECT COUNT(DISTINCT "studentProfileId")::int as count FROM "Enrolment" WHERE "courseId" = $1 AND "instituteId" = $2 AND status = 'ACTIVE'`,
        exam.batchId ? [exam.batchId, instituteId] : [exam.courseId, instituteId]
      ),
      queryDb<{ total: number; evaluated: number; pending: number }>(
        `SELECT 
          COUNT(id)::int as total,
          COUNT(CASE WHEN status = 'EVALUATED' THEN 1 END)::int as evaluated,
          COUNT(CASE WHEN status = 'SUBMITTED' THEN 1 END)::int as pending
         FROM "ExamAttempt"
         WHERE "examId" = $1 AND "instituteId" = $2`,
        [examId, instituteId]
      ),
    ]);

    const totalStudents = enrolmentRes[0]?.count || 0;
    const attemptStats = attemptsRes[0] || { total: 0, evaluated: 0, pending: 0 };

    return NextResponse.json({
      success: true,
      data: {
        id: exam.id,
        title: exam.title,
        instructions: exam.instructions,
        type: exam.type,
        durationMin: exam.durationMin,
        totalMarks: exam.totalMarks,
        passMarks: exam.passMarks,
        status: exam.status,
        startAt: exam.startAt ? new Date(exam.startAt).toISOString() : null,
        endAt: exam.endAt ? new Date(exam.endAt).toISOString() : null,
        courseId: exam.courseId,
        courseTitle: exam.courseTitle,
        batchId: exam.batchId,
        batchName: exam.batchName || 'All Batches',
        totalQuestions: fullQuestions.length,
        totalStudents,
        attemptCount: attemptStats.total,
        evaluatedCount: attemptStats.evaluated,
        pendingEvaluationCount: attemptStats.pending,
        questions: fullQuestions,
        createdAt: new Date(exam.createdAt).toISOString(),
        updatedAt: new Date(exam.updatedAt).toISOString(),
      },
    });
  } catch (err: any) {
    if (err instanceof TeacherAuthError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.statusCode }
      );
    }
    console.error('Teacher exam detail route error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error while fetching examination details' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ examId: string }> }
) {
  try {
    const { examId } = await context.params;
    const teacher = await resolveAuthenticatedTeacher(request);
    const { teacherProfileId, instituteId, userId } = teacher;

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { success: false, error: 'Request body required' },
        { status: 400 }
      );
    }

    const examRows = await queryDb<any>(
      `SELECT id, "courseId", "batchId", title, instructions, "durationMin", "totalMarks", "passMarks", status
       FROM "Exam"
       WHERE id = $1 AND "instituteId" = $2 LIMIT 1`,
      [examId, instituteId]
    );

    if (examRows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Examination not found in your institute' },
        { status: 404 }
      );
    }

    const exam = examRows[0];

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
        { success: false, error: 'You are not authorized to edit this examination.' },
        { status: 403 }
      );
    }

    const newTitle = body.title !== undefined ? body.title.trim() : exam.title;
    if (!newTitle) {
      return NextResponse.json({ success: false, error: 'Title cannot be empty' }, { status: 400 });
    }

    const newInstructions = body.instructions !== undefined ? body.instructions?.trim() || null : exam.instructions;
    const newStatus = body.status !== undefined ? body.status : exam.status;
    const newBatchId = body.batchId !== undefined ? body.batchId || null : exam.batchId;

    let newDuration = exam.durationMin;
    if (body.durationMin !== undefined) {
      newDuration = Number(body.durationMin);
      if (isNaN(newDuration) || newDuration <= 0) {
        return NextResponse.json({ success: false, error: 'Duration must be positive' }, { status: 400 });
      }
    }

    let newTotalMarks = exam.totalMarks;
    if (body.totalMarks !== undefined) {
      newTotalMarks = Number(body.totalMarks);
      if (isNaN(newTotalMarks) || newTotalMarks <= 0) {
        return NextResponse.json({ success: false, error: 'Total marks must be greater than zero' }, { status: 400 });
      }
    }

    let newPassMarks = exam.passMarks;
    if (body.passMarks !== undefined) {
      newPassMarks = Number(body.passMarks);
      if (isNaN(newPassMarks) || newPassMarks < 0 || newPassMarks > newTotalMarks) {
        return NextResponse.json({ success: false, error: 'Passing marks cannot exceed total marks' }, { status: 400 });
      }
    }

    let newStartAt = exam.startAt;
    if (body.startAt !== undefined) {
      newStartAt = body.startAt ? new Date(body.startAt) : null;
    }

    let newEndAt = exam.endAt;
    if (body.endAt !== undefined) {
      newEndAt = body.endAt ? new Date(body.endAt) : null;
    }

    if (newStartAt && newEndAt && newStartAt >= newEndAt) {
      return NextResponse.json({ success: false, error: 'Start time must be strictly before end time' }, { status: 400 });
    }

    const updateRes = await queryDb<any>(
      `UPDATE "Exam"
       SET title = $1, instructions = $2, "durationMin" = $3, "totalMarks" = $4,
           "passMarks" = $5, status = $6, "batchId" = $7, "startAt" = $8, "endAt" = $9, "updatedAt" = NOW()
       WHERE id = $10 AND "instituteId" = $11
       RETURNING *`,
      [
        newTitle,
        newInstructions,
        newDuration,
        newTotalMarks,
        newPassMarks,
        newStatus,
        newBatchId,
        newStartAt,
        newEndAt,
        examId,
        instituteId,
      ]
    );

    const updated = updateRes[0];

    await queryDb(
      `INSERT INTO "AuditLog" (id, "instituteId", "actorUserId", action, "entityType", "entityId", metadata, "createdAt")
       VALUES (gen_random_uuid()::text, $1, $2, 'EXAM_UPDATED', 'Exam', $3, $4, NOW())`,
      [
        instituteId,
        userId,
        examId,
        JSON.stringify({
          title: updated.title,
          totalMarks: updated.totalMarks,
          status: updated.status,
        }),
      ]
    );

    return NextResponse.json({
      success: true,
      message: 'Examination updated successfully',
      data: updated,
    });
  } catch (err: any) {
    if (err instanceof TeacherAuthError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.statusCode }
      );
    }
    console.error('Teacher exam update route error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error while updating examination' },
      { status: 500 }
    );
  }
}
