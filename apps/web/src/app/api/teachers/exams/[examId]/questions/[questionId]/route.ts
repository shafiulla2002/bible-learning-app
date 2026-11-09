import { NextRequest, NextResponse } from 'next/server';
import { resolveAuthenticatedTeacher, TeacherAuthError } from '@/lib/server-teacher';
import { queryDb } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ examId: string; questionId: string }> }
) {
  try {
    const { examId, questionId } = await context.params;
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
      `SELECT id, "courseId", "batchId" FROM "Exam"
       WHERE id = $1 AND "instituteId" = $2 LIMIT 1`,
      [examId, instituteId]
    );
    if (examRows.length === 0) {
      return NextResponse.json({ success: false, error: 'Examination not found' }, { status: 404 });
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
        { success: false, error: 'You are not authorized to edit this question.' },
        { status: 403 }
      );
    }

    const questionRows = await queryDb<any>(
      `SELECT id, prompt, marks, type, position FROM "Question"
       WHERE id = $1 AND "examId" = $2 LIMIT 1`,
      [questionId, examId]
    );

    if (questionRows.length === 0) {
      return NextResponse.json({ success: false, error: 'Question not found' }, { status: 404 });
    }

    const currentQ = questionRows[0];
    const newPrompt = body.prompt !== undefined ? body.prompt.trim() : currentQ.prompt;
    if (!newPrompt) {
      return NextResponse.json({ success: false, error: 'Prompt cannot be empty' }, { status: 400 });
    }

    let newMarks = currentQ.marks;
    if (body.marks !== undefined) {
      newMarks = Number(body.marks);
      if (isNaN(newMarks) || newMarks <= 0) {
        return NextResponse.json({ success: false, error: 'Marks must be a positive integer' }, { status: 400 });
      }
    }

    const validTypes = ['MCQ_SINGLE', 'MCQ_MULTI', 'TRUE_FALSE', 'SHORT', 'DESCRIPTIVE'];
    const newType = body.type && validTypes.includes(body.type) ? body.type : currentQ.type;

    const updateRes = await queryDb<any>(
      `UPDATE "Question"
       SET prompt = $1, marks = $2, type = $3::"QuestionType"
       WHERE id = $4 AND "examId" = $5
       RETURNING *`,
      [newPrompt, newMarks, newType, questionId, examId]
    );

    // Update options if provided
    let updatedOptions: any[] = [];
    if (Array.isArray(body.options)) {
      await queryDb(`DELETE FROM "QuestionOption" WHERE "questionId" = $1`, [questionId]);
      for (const opt of body.options) {
        const optRes = await queryDb<any>(
          `INSERT INTO "QuestionOption" (id, "questionId", label, "isCorrect")
           VALUES (gen_random_uuid()::text, $1, $2, $3)
           RETURNING *`,
          [questionId, String(opt.label || '').trim(), Boolean(opt.isCorrect)]
        );
        updatedOptions.push(optRes[0]);
      }
    } else {
      updatedOptions = await queryDb<any>(
        `SELECT id, label, "isCorrect" FROM "QuestionOption" WHERE "questionId" = $1`,
        [questionId]
      );
    }

    await queryDb(
      `INSERT INTO "AuditLog" (id, "instituteId", "actorUserId", action, "entityType", "entityId", metadata, "createdAt")
       VALUES (gen_random_uuid()::text, $1, $2, 'EXAM_QUESTION_UPDATED', 'Question', $3, $4, NOW())`,
      [
        instituteId,
        userId,
        questionId,
        JSON.stringify({
          examId,
          prompt: updateRes[0].prompt,
          marks: updateRes[0].marks,
        }),
      ]
    );

    return NextResponse.json({
      success: true,
      message: 'Question updated successfully',
      data: {
        ...updateRes[0],
        options: updatedOptions,
      },
    });
  } catch (err: any) {
    if (err instanceof TeacherAuthError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.statusCode }
      );
    }
    console.error('Teacher question update route error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error while updating question' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ examId: string; questionId: string }> }
) {
  try {
    const { examId, questionId } = await context.params;
    const teacher = await resolveAuthenticatedTeacher(request);
    const { teacherProfileId, instituteId, userId } = teacher;

    const examRows = await queryDb<any>(
      `SELECT id, "courseId", "batchId" FROM "Exam"
       WHERE id = $1 AND "instituteId" = $2 LIMIT 1`,
      [examId, instituteId]
    );
    if (examRows.length === 0) {
      return NextResponse.json({ success: false, error: 'Examination not found' }, { status: 404 });
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
        { success: false, error: 'You are not authorized to delete this question.' },
        { status: 403 }
      );
    }

    await queryDb(`DELETE FROM "QuestionOption" WHERE "questionId" = $1`, [questionId]);
    await queryDb(`DELETE FROM "AttemptAnswer" WHERE "questionId" = $1`, [questionId]);
    await queryDb(`DELETE FROM "Question" WHERE id = $1 AND "examId" = $2`, [questionId, examId]);

    await queryDb(
      `INSERT INTO "AuditLog" (id, "instituteId", "actorUserId", action, "entityType", "entityId", metadata, "createdAt")
       VALUES (gen_random_uuid()::text, $1, $2, 'EXAM_QUESTION_DELETED', 'Question', $3, $4, NOW())`,
      [instituteId, userId, questionId, JSON.stringify({ examId })]
    );

    return NextResponse.json({
      success: true,
      message: 'Question deleted successfully',
    });
  } catch (err: any) {
    if (err instanceof TeacherAuthError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.statusCode }
      );
    }
    console.error('Teacher question delete route error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error while deleting question' },
      { status: 500 }
    );
  }
}
