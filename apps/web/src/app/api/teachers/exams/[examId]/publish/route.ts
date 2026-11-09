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

    const examRows = await queryDb<any>(
      `SELECT id, "courseId", "batchId", title, "totalMarks", status
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
        { success: false, error: 'You are not authorized to publish this examination.' },
        { status: 403 }
      );
    }

    // Check questions exist
    const questionCountRes = await queryDb<{ count: number }>(
      `SELECT COUNT(id)::int as count FROM "Question" WHERE "examId" = $1`,
      [examId]
    );
    const questionCount = questionCountRes[0]?.count || 0;
    if (questionCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot publish examination without any questions. Add questions before publishing.' },
        { status: 400 }
      );
    }

    const updateRes = await queryDb<any>(
      `UPDATE "Exam"
       SET status = 'PUBLISHED', "updatedAt" = NOW()
       WHERE id = $1 AND "instituteId" = $2
       RETURNING *`,
      [examId, instituteId]
    );

    const updated = updateRes[0];

    await queryDb(
      `INSERT INTO "AuditLog" (id, "instituteId", "actorUserId", action, "entityType", "entityId", metadata, "createdAt")
       VALUES (gen_random_uuid()::text, $1, $2, 'EXAM_PUBLISHED', 'Exam', $3, $4, NOW())`,
      [
        instituteId,
        userId,
        examId,
        JSON.stringify({
          title: updated.title,
          totalQuestions: questionCount,
          totalMarks: updated.totalMarks,
        }),
      ]
    );

    return NextResponse.json({
      success: true,
      message: 'Examination published successfully',
      data: updated,
    });
  } catch (err: any) {
    if (err instanceof TeacherAuthError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.statusCode }
      );
    }
    console.error('Teacher exam publish route error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error while publishing examination' },
      { status: 500 }
    );
  }
}
