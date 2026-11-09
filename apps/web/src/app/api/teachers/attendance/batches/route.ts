import { NextRequest, NextResponse } from 'next/server';
import { resolveAuthenticatedTeacher, TeacherAuthError } from '@/lib/server-teacher';
import { queryDb } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const teacher = await resolveAuthenticatedTeacher(request);
    const { teacherProfileId, instituteId } = teacher;

    const batches = await queryDb<{
      id: string;
      name: string;
      code: string | null;
      courseId: string;
      courseTitle: string;
      role: string;
      totalStudents: number;
      status: string;
    }>(
      `SELECT 
        b.id,
        b.name,
        b.code,
        b."courseId",
        c.title as "courseTitle",
        bt.role,
        b.status,
        (
          SELECT COUNT(*)::int 
          FROM "Enrolment" e 
          JOIN "StudentProfile" sp ON sp.id = e."studentProfileId"
          JOIN "Membership" m ON m.id = sp."membershipId"
          WHERE e."batchId" = b.id 
            AND e.status = 'ACTIVE' 
            AND sp.status = 'ACTIVE'
            AND m.status = 'ACTIVE'
        ) as "totalStudents"
       FROM "BatchTeacher" bt
       JOIN "Batch" b ON b.id = bt."batchId"
       JOIN "Course" c ON c.id = b."courseId"
       WHERE bt."teacherProfileId" = $1 AND bt."instituteId" = $2
       ORDER BY b.name ASC`,
      [teacherProfileId, instituteId]
    );

    return NextResponse.json({
      success: true,
      batches,
    });
  } catch (err: any) {
    if (err instanceof TeacherAuthError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.statusCode }
      );
    }
    console.error('Teacher attendance batches route error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error while fetching assigned batches' },
      { status: 500 }
    );
  }
}

