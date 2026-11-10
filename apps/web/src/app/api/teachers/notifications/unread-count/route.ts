import { NextRequest, NextResponse } from 'next/server';
import { resolveAuthenticatedTeacher, TeacherAuthError } from '@/lib/server-teacher';
import { getUserUnreadCount } from '@/lib/server-notifications';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const teacher = await resolveAuthenticatedTeacher(request);
    const result = await getUserUnreadCount(teacher.instituteId, teacher.userId);
    return NextResponse.json(result);
  } catch (err: any) {
    if (err instanceof TeacherAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error('Error fetching teacher unread count:', err);
    return NextResponse.json(
      { error: 'Failed to fetch unread count' },
      { status: 500 },
    );
  }
}

