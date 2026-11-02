import { NextRequest, NextResponse } from 'next/server';
import { queryDb, resolveServerAdminContext } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ instituteId: string }> }
) {
  try {
    const { instituteId } = await params;
    const ctx = await resolveServerAdminContext();
    const effectiveInstituteId =
      instituteId && instituteId !== 'null' && instituteId !== 'undefined' && instituteId !== 'inst-1'
        ? instituteId
        : ctx.instituteId;

    await queryDb(
      `UPDATE "Notification"
       SET "readAt" = NOW()
       WHERE "instituteId" = $1 AND "readAt" IS NULL`,
      [effectiveInstituteId]
    );

    return NextResponse.json({ updatedCount: 1, unreadCount: 0 });
  } catch (error: any) {
    console.error('Error marking all notifications read:', error);
    return NextResponse.json({ message: error?.message || 'Failed to mark all as read' }, { status: 500 });
  }
}

