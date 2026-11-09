import { NextRequest, NextResponse } from 'next/server';
import { resolveAuthenticatedTeacher, TeacherAuthError } from '@/lib/server-teacher';
import { queryDb } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function POST(
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

    const { prompt, type, marks, options } = body;

    if (!prompt || !prompt.trim()) {
      return NextResponse.json(
        { success: false, error: 'Question prompt is required' },
        { status: 400 }
      );
    }

    const numericMarks = Number(marks || 5);
    if (isNaN(numericMarks) || numericMarks <= 0) {
      return NextResponse.json(
        { success: false, error: 'Question marks must be a positive integer' },
        { status: 400 }
      );
    }

    const examRows = await queryDb<any>(
      `SELECT id, "courseId", "batchId" FROM "Exam"
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
        { success: false, error: 'You are not authorized to manage questions for this examination.' },
        { status: 403 }
      );
    }

    const posRes = await queryDb<{ maxPos: number }>(
      `SELECT COALESCE(MAX(position), -1)::int as "maxPos" FROM "Question" WHERE "examId" = $1`,
      [examId]
    );
    const position = (posRes[0]?.maxPos ?? -1) + 1;

    const validTypes = ['MCQ_SINGLE', 'MCQ_MULTI', 'TRUE_FALSE', 'SHORT', 'DESCRIPTIVE'];
    const qType = validTypes.includes(type) ? type : 'MCQ_SINGLE';

    const insertQRes = await queryDb<any>(
      `INSERT INTO "Question" (id, "instituteId", "examId", type, prompt, marks, position)
       VALUES (gen_random_uuid()::text, $1, $2, $3::"QuestionType", $4, $5, $6)
       RETURNING *`,
      [instituteId, examId, qType, prompt.trim(), numericMarks, position]
    );

    const question = insertQRes[0];

    // Insert options if provided
    const createdOptions: any[] = [];
    if (Array.isArray(options) && options.length > 0) {
      for (const opt of options) {
        const optRes = await queryDb<any>(
          `INSERT INTO "QuestionOption" (id, "questionId", label, "isCorrect")
           VALUES (gen_random_uuid()::text, $1, $2, $3)
           RETURNING *`,
          [question.id, String(opt.label || '').trim(), Boolean(opt.isCorrect)]
        );
        createdOptions.push(optRes[0]);
      }
    }

    await queryDb(
      `INSERT INTO "AuditLog" (id, "instituteId", "actorUserId", action, "entityType", "entityId", metadata, "createdAt")
       VALUES (gen_random_uuid()::text, $1, $2, 'EXAM_QUESTION_CREATED', 'Question', $3, $4, NOW())`,
      [
        instituteId,
        userId,
        question.id,
        JSON.stringify({
          examId,
          prompt: question.prompt,
          marks: question.marks,
          type: question.type,
        }),
      ]
    );

    return NextResponse.json({
      success: true,
      message: 'Question added successfully',
      data: {
        ...question,
        options: createdOptions,
      },
    }, { status: 201 });
  } catch (err: any) {
    if (err instanceof TeacherAuthError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.statusCode }
      );
    }
    console.error('Teacher question create route error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error while adding question' },
      { status: 500 }
    );
  }
}
