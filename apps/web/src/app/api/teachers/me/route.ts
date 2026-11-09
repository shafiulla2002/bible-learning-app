import { NextRequest, NextResponse } from 'next/server';
import { resolveAuthenticatedTeacher, TeacherAuthError } from '@/lib/server-teacher';
import { queryDb } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const teacher = await resolveAuthenticatedTeacher(request);

    // Safely calculate basic assignment counts scoped strictly to verified teacherProfileId & instituteId
    let assignedBatchesCount = 0;
    let assignedCoursesCount = 0;
    let assignedStudentsCount = 0;

    try {
      const [batchRows, courseRows, studentRows] = await Promise.all([
        queryDb(
          `SELECT COUNT(DISTINCT bt."batchId")::int as count
           FROM "BatchTeacher" bt
           JOIN "Batch" b ON b.id = bt."batchId"
           WHERE bt."teacherProfileId" = $1 AND bt."instituteId" = $2 AND b.status = 'ACTIVE'`,
          [teacher.teacherProfileId, teacher.instituteId]
        ),
        queryDb(
          `SELECT COUNT(DISTINCT ci."courseId")::int as count
           FROM "CourseInstructor" ci
           JOIN "Course" c ON c.id = ci."courseId"
           WHERE ci."teacherProfileId" = $1 AND ci."instituteId" = $2 AND c.status = 'PUBLISHED'`,
          [teacher.teacherProfileId, teacher.instituteId]
        ),
        queryDb(
          `SELECT COUNT(DISTINCT e."studentProfileId")::int as count
           FROM "Enrolment" e
           JOIN "BatchTeacher" bt ON bt."batchId" = e."batchId"
           WHERE bt."teacherProfileId" = $1 AND e."instituteId" = $2 AND e.status = 'ACTIVE'`,
          [teacher.teacherProfileId, teacher.instituteId]
        ),
      ]);

      if (batchRows.length > 0) assignedBatchesCount = Number(batchRows[0].count) || 0;
      if (courseRows.length > 0) assignedCoursesCount = Number(courseRows[0].count) || 0;
      if (studentRows.length > 0) assignedStudentsCount = Number(studentRows[0].count) || 0;
    } catch (countErr: any) {
      console.warn('Assignment counts lookup warning:', countErr?.message);
    }

    return NextResponse.json({
      success: true,
      teacher: {
        teacherProfileId: teacher.teacherProfileId,
        userId: teacher.userId,
        fullName: teacher.fullName,
        email: teacher.email,
        phone: teacher.phone,
        employeeCode: teacher.employeeCode,
        qualifications: teacher.qualifications,
        specialization: teacher.specialization,
        experienceYears: teacher.experienceYears,
        photoUrl: teacher.photoUrl,
        status: teacher.status,
      },
      institute: {
        id: teacher.instituteId,
        name: teacher.instituteName,
        code: (teacher.instituteSlug || 'GBI').toUpperCase(),
        logoUrl: teacher.instituteLogoUrl,
      },
      stats: {
        assignedBatchesCount,
        assignedCoursesCount,
        assignedStudentsCount,
      },
    });
  } catch (err: any) {
    if (err instanceof TeacherAuthError) {
      return NextResponse.json(
        { success: false, message: err.message },
        { status: err.statusCode }
      );
    }
    console.error('Unhandled error in /api/teachers/me:', err);
    return NextResponse.json(
      { success: false, message: 'Internal server error resolving teacher profile' },
      { status: 500 }
    );
  }
}

