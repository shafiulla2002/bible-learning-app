import { NextRequest, NextResponse } from 'next/server';
import { resolveAuthenticatedStudent } from '@/lib/server-student';
import { getUserUnreadCount } from '@/lib/server-notifications';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const student = await resolveAuthenticatedStudent(request);
    const result = await getUserUnreadCount(student.instituteId, student.userId);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Error fetching student unread count:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to fetch unread count' },
      { status: err?.message?.includes('token') || err?.message?.includes('expired') ? 401 : 500 },
    );
  }
}

