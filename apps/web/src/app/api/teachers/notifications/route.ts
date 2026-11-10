import { NextRequest, NextResponse } from 'next/server';
import { resolveAuthenticatedTeacher, TeacherAuthError } from '@/lib/server-teacher';
import {
  getUserNotifications,
  markAllNotificationsAsRead,
} from '@/lib/server-notifications';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const teacher = await resolveAuthenticatedTeacher(request);
    const { searchParams } = new URL(request.url);

    const page = searchParams.get('page') || '1';
    const limit = searchParams.get('limit') || '15';
    const category = searchParams.get('category') || 'ALL';
    const status = searchParams.get('status') || 'ALL';
    const search = searchParams.get('search') || '';

    const result = await getUserNotifications(
      teacher.instituteId,
      teacher.userId,
      {
        page,
        limit,
        category,
        status,
        search,
      },
    );

    return NextResponse.json(result);
  } catch (err: any) {
    if (err instanceof TeacherAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error('Error fetching teacher notifications:', err);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const teacher = await resolveAuthenticatedTeacher(request);
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const result = await markAllNotificationsAsRead(
      teacher.instituteId,
      teacher.userId,
      body?.category,
    );

    return NextResponse.json({
      success: true,
      message: 'Notifications marked as read',
      ...result,
    });
  } catch (err: any) {
    if (err instanceof TeacherAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error('Error marking all teacher notifications as read:', err);
    return NextResponse.json(
      { error: 'Failed to mark notifications as read' },
      { status: 500 },
    );
  }
}

