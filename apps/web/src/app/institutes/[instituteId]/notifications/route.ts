import { NextRequest, NextResponse } from 'next/server';
import { queryDb } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

function inferCategory(title: string, link: string | null): 'STUDENT' | 'TEACHER' | 'ATTENDANCE' | 'FEE' | 'ACADEMIC' | 'ADMIN' {
  const text = `${title} ${link || ''}`.toLowerCase();
  if (text.includes('fee') || text.includes('invoice') || text.includes('payment') || text.includes('finance')) return 'FEE';
  if (text.includes('attendance') || text.includes('absent')) return 'ATTENDANCE';
  if (text.includes('teacher') || text.includes('faculty')) return 'TEACHER';
  if (text.includes('student') || text.includes('admission') || text.includes('enrol')) return 'STUDENT';
  if (text.includes('course') || text.includes('batch') || text.includes('session') || text.includes('term')) return 'ACADEMIC';
  return 'ADMIN';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ instituteId: string }> },
) {
  try {
    const { instituteId } = await params;
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.max(1, parseInt(searchParams.get('limit') || '12', 10));
    const status = searchParams.get('status') || 'ALL';
    const category = searchParams.get('category') || 'ALL';
    const search = (searchParams.get('search') || '').trim().toLowerCase();

    const rows = await queryDb(
      `SELECT id, "instituteId", "userId", title, body, link, "readAt", "createdAt"
       FROM "Notification"
       WHERE "instituteId" = $1
       ORDER BY "createdAt" DESC`,
      [instituteId],
    );

    const mapped = rows.map((r) => {
      const cat = inferCategory(r.title, r.link);
      return {
        id: r.id,
        instituteId: r.instituteId,
        userId: r.userId,
        category: cat,
        eventType: `${cat}_EVENT`,
        referenceId: null,
        title: r.title,
        body: r.body,
        link: r.link || '/admin',
        isRead: Boolean(r.readAt),
        readAt: r.readAt ? new Date(r.readAt).toISOString() : null,
        createdAt: new Date(r.createdAt).toISOString(),
      };
    });

    const byCategory = {
      STUDENT: 0,
      TEACHER: 0,
      ATTENDANCE: 0,
      FEE: 0,
      ACADEMIC: 0,
      ADMIN: 0,
    };

    let unreadCount = 0;
    for (const item of mapped) {
      if (!item.isRead) {
        unreadCount++;
        byCategory[item.category] = (byCategory[item.category] || 0) + 1;
      }
    }

    const filtered = mapped.filter((item) => {
      if (status === 'UNREAD' && item.isRead) return false;
      if (status === 'READ' && !item.isRead) return false;
      if (category !== 'ALL' && item.category !== category) return false;
      if (search && !`${item.title} ${item.body}`.toLowerCase().includes(search)) return false;
      return true;
    });

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const offset = (page - 1) * limit;
    const data = filtered.slice(offset, offset + limit);

    return NextResponse.json({
      data,
      unreadCount,
      byCategory,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error: any) {
    console.error('[GET /notifications] Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Failed to load notifications' },
      { status: 500 },
    );
  }
}
