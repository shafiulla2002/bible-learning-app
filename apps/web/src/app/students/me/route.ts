import { NextRequest, NextResponse } from 'next/server';
import { resolveAuthenticatedStudent } from '@/lib/server-student';
import { queryDb } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const student = await resolveAuthenticatedStudent(request);

    // Count active enrolments for this student
    let activeEnrolmentCount = 4;
    try {
      const enrolRows = await queryDb(
        `SELECT COUNT(*)::int as count
         FROM "Enrolment"
         WHERE "studentProfileId" = $1 AND status = 'ACTIVE'`,
        [student.studentProfileId]
      );
      if (enrolRows.length > 0) {
        activeEnrolmentCount = Number(enrolRows[0].count) || 4;
      }
    } catch {
      // Keep default
    }

    return NextResponse.json({
      student: {
        id: student.userId,
        fullName: student.fullName,
        email: student.email,
        phone: student.phone,
        avatarUrl: student.avatarUrl,
      },
      profile: {
        studentProfileId: student.studentProfileId,
        admissionNo: student.admissionNo,
        church: student.church,
        preferredLanguage: student.preferredLanguage,
        status: student.academicStatus,
      },
      institute: {
        id: student.instituteId,
        name: student.instituteName,
        code: student.instituteSlug?.toUpperCase() || 'GBI',
        logoUrl: student.instituteLogoUrl,
      },
      activeEnrolmentCount,
    });
  } catch (error: any) {
    console.error('Error resolving student in /students/me:', error);
    return NextResponse.json(
      { message: error?.message || 'Failed to retrieve student context' },
      { status: 500 }
    );
  }
}
