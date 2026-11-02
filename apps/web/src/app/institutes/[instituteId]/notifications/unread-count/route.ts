import { NextRequest, NextResponse } from 'next/server';
import { queryDb } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ instituteId: string }> },
) {
  try {
    const { instituteId } = await params;
    const rows = await queryDb(
      `SELECT COUNT(*)::int AS "unreadCount"
       FROM "Notification"
       WHERE "instituteId" = $1 AND "readAt" IS NULL`,
      [instituteId],
    );

    const unreadCount = rows[0]?.unreadCount || 0;
    return NextResponse.json({
      unreadCount,
      byCategory: {
        STUDENT: 0,
        TEACHER: 0,
        ATTENDANCE: 0,
        FEE: 0,
        ACADEMIC: 0,
        ADMIN: 0,
      },
    });
  } catch (error: any) {
    console.error('[GET /notifications/unread-count] Error:', error);
    return NextResponse.json({ unreadCount: 0, byCategory: {} });
  }
}
