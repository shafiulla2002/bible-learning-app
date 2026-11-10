import { NextRequest, NextResponse } from 'next/server';
import { resolveAuthenticatedStudent } from '@/lib/server-student';
import {
  getUserNotifications,
  markAllNotificationsAsRead,
} from '@/lib/server-notifications';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const student = await resolveAuthenticatedStudent(request);
    const { searchParams } = new URL(request.url);

    const page = searchParams.get('page') || '1';
    const limit = searchParams.get('limit') || '15';
    const category = searchParams.get('category') || 'ALL';
    const status = searchParams.get('status') || 'ALL';
    const search = searchParams.get('search') || '';

    const result = await getUserNotifications(
      student.instituteId,
      student.userId,
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
    console.error('Error fetching student notifications:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to fetch notifications' },
      { status: err?.message?.includes('token') || err?.message?.includes('expired') ? 401 : 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const student = await resolveAuthenticatedStudent(request);
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const result = await markAllNotificationsAsRead(
      student.instituteId,
      student.userId,
      body?.category,
    );

    return NextResponse.json({
      success: true,
      message: 'Notifications marked as read',
      ...result,
    });
  } catch (err: any) {
    console.error('Error marking all student notifications as read:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to mark notifications as read' },
      { status: err?.message?.includes('token') || err?.message?.includes('expired') ? 401 : 500 },
    );
  }
}

