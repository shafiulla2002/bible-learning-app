import { NextRequest, NextResponse } from 'next/server';
import { queryDb } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ instituteId: string; id: string }> }
) {
  try {
    const { id } = await params;

    const rows = await queryDb(
      `UPDATE "Notification"
       SET "readAt" = COALESCE("readAt", NOW())
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    return NextResponse.json({
      id,
      isRead: true,
      readAt: rows[0]?.readAt ? new Date(rows[0].readAt).toISOString() : new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error marking notification read:', error);
    return NextResponse.json({ message: error?.message || 'Failed to mark as read' }, { status: 500 });
  }
}

