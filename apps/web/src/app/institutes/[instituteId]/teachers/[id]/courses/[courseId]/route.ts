import { NextRequest, NextResponse } from 'next/server';
import { queryDb, resolveServerAdminContext } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ instituteId: string; id: string; courseId: string }> }
) {
  try {
    const { instituteId, id: teacherProfileId, courseId } = await params;
    const ctx = await resolveServerAdminContext();
    const effectiveInstituteId =
      instituteId && instituteId !== 'null' && instituteId !== 'undefined' && instituteId !== 'inst-1'
        ? instituteId
        : ctx.instituteId;

    await queryDb(
      `DELETE FROM "CourseInstructor"
       WHERE "courseId" = $1 AND "teacherProfileId" = $2 AND "instituteId" = $3`,
      [courseId, teacherProfileId, effectiveInstituteId]
    );

    return NextResponse.json({ message: 'Course assignment removed' });
  } catch (error: any) {
    console.error('Error removing course assignment:', error);
    return NextResponse.json({ message: error?.message || 'Failed to remove course' }, { status: 500 });
  }
}

