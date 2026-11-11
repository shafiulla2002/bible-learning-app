import { NextRequest, NextResponse } from 'next/server';
import { resolveAuthenticatedTeacher, TeacherAuthError } from '@/lib/server-teacher';
import { queryDb } from '@/lib/server-db';
import { buildCourseSyllabusPdfResponse } from '@/lib/server-materials';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;
    const teacher = await resolveAuthenticatedTeacher(request);
    const { teacherProfileId, instituteId } = teacher;

    const assignmentCheck = await queryDb<{ role: string }>(
      `SELECT role FROM (
        SELECT ci.role, 1 as priority
        FROM "CourseInstructor" ci
        WHERE ci."courseId" = $1 AND ci."teacherProfileId" = $2 AND ci."instituteId" = $3
        UNION ALL
        SELECT bt.role, 2 as priority
        FROM "BatchTeacher" bt
        JOIN "Batch" b ON b.id = bt."batchId"
        WHERE b."courseId" = $1 AND bt."teacherProfileId" = $2 AND bt."instituteId" = $3
      ) a LIMIT 1`,
      [courseId, teacherProfileId, instituteId]
    );

    if (assignmentCheck.length === 0) {
      return NextResponse.json(
        { success: false, error: 'You are not assigned to instruct this course.' },
        { status: 403 }
      );
    }

    const pdfResponse = await buildCourseSyllabusPdfResponse(courseId, instituteId);
    if (!pdfResponse) {
      return NextResponse.json(
        { success: false, error: 'Course not found in this institute' },
        { status: 404 }
      );
    }

    return pdfResponse;
  } catch (err: any) {
    if (err instanceof TeacherAuthError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.statusCode }
      );
    }
    console.error('Teacher course syllabus PDF error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to generate course syllabus PDF' },
      { status: 500 }
    );
  }
}
