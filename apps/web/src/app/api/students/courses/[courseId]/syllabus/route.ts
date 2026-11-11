import { NextRequest, NextResponse } from 'next/server';
import { resolveAuthenticatedStudent } from '@/lib/server-student';
import { queryDb } from '@/lib/server-db';
import { buildCourseSyllabusPdfResponse } from '@/lib/server-materials';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;
    const student = await resolveAuthenticatedStudent(request);
    const { studentProfileId, instituteId } = student;

    const enrolRows = await queryDb(
      `SELECT id FROM "Enrolment"
       WHERE "studentProfileId" = $1 AND "courseId" = $2 AND "instituteId" = $3
       LIMIT 1`,
      [studentProfileId, courseId, instituteId]
    );

    if (enrolRows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'You must be enrolled in this course to download the syllabus' },
        { status: 403 }
      );
    }

    const pdfResponse = await buildCourseSyllabusPdfResponse(courseId, instituteId);
    if (!pdfResponse) {
      return NextResponse.json(
        { success: false, error: 'Course syllabus not found' },
        { status: 404 }
      );
    }

    return pdfResponse;
  } catch (err: any) {
    console.error('Student course syllabus PDF error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to generate course syllabus PDF' },
      { status: 401 }
    );
  }
}
