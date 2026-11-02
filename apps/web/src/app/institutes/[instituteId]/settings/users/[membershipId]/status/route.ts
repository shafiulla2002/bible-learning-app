import { NextRequest, NextResponse } from 'next/server';
import { queryDb, resolveServerAdminContext } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ instituteId: string; membershipId: string }> }
) {
  try {
    const { instituteId, membershipId } = await params;
    const ctx = await resolveServerAdminContext();
    const effectiveInstituteId =
      instituteId && instituteId !== 'null' && instituteId !== 'undefined' && instituteId !== 'inst-1'
        ? instituteId
        : ctx.instituteId;

    const body = await request.json();
    const { status } = body;

    const rows = await queryDb(
      `UPDATE "Membership"
       SET status = $1, "updatedAt" = NOW()
       WHERE id = $2 AND "instituteId" = $3
       RETURNING id, "userId", status`,
      [status, membershipId, effectiveInstituteId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ message: 'Membership not found' }, { status: 404 });
    }

    return NextResponse.json({
      membershipId: rows[0].id,
      userId: rows[0].userId,
      status: rows[0].status,
      message: `Status updated to ${status}`,
    });
  } catch (error: any) {
    console.error('Error updating membership status:', error);
    return NextResponse.json({ message: error?.message || 'Failed to update status' }, { status: 500 });
  }
}

