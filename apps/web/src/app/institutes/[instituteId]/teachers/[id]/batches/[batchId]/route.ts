import { NextRequest, NextResponse } from 'next/server';
import { queryDb, resolveServerAdminContext } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ instituteId: string; id: string; batchId: string }> }
) {
  try {
    const { instituteId, id: teacherProfileId, batchId } = await params;
    const ctx = await resolveServerAdminContext();
    const effectiveInstituteId =
      instituteId && instituteId !== 'null' && instituteId !== 'undefined' && instituteId !== 'inst-1'
        ? instituteId
        : ctx.instituteId;

    await queryDb(
      `DELETE FROM "BatchTeacher"
       WHERE "batchId" = $1 AND "teacherProfileId" = $2 AND "instituteId" = $3`,
      [batchId, teacherProfileId, effectiveInstituteId]
    );

    return NextResponse.json({ message: 'Batch assignment removed' });
  } catch (error: any) {
    console.error('Error removing batch assignment:', error);
    return NextResponse.json({ message: error?.message || 'Failed to remove batch' }, { status: 500 });
  }
}

