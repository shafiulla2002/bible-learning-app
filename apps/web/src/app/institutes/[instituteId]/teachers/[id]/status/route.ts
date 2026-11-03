import { NextRequest, NextResponse } from 'next/server';
import { queryDb, resolveServerAdminContext, invalidateServerRouteCache } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ instituteId: string; id: string }> }
) {
  try {
    const { instituteId, id } = await params;
    const ctx = await resolveServerAdminContext();
    const effectiveInstituteId =
      instituteId && instituteId !== 'null' && instituteId !== 'undefined' && instituteId !== 'inst-1'
        ? instituteId
        : ctx.instituteId;

    const body = await request.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json({ message: 'status is required' }, { status: 400 });
    }

    await queryDb(
      `UPDATE "TeacherProfile"
       SET status = $1, "updatedAt" = NOW()
       WHERE id = $2 AND "instituteId" = $3`,
      [status, id, effectiveInstituteId]
    );

    invalidateServerRouteCache('teachers');
    invalidateServerRouteCache('dashboard');
    return NextResponse.json({ id, status, message: `Status updated to ${status}` });
  } catch (error: any) {
    console.error('Error updating teacher status:', error);
    return NextResponse.json({ message: error?.message || 'Failed to update status' }, { status: 500 });
  }
}

