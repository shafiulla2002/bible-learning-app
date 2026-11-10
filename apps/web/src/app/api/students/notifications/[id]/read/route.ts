import { NextRequest, NextResponse } from 'next/server';
import { resolveAuthenticatedStudent } from '@/lib/server-student';
import { markNotificationAsRead } from '@/lib/server-notifications';

export const dynamic = 'force-dynamic';

async function handleMarkRead(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const student = await resolveAuthenticatedStudent(request);
    const params = await context.params;
    const notificationId = params.id;

    if (!notificationId) {
      return NextResponse.json(
        { error: 'Notification ID is required' },
        { status: 400 },
      );
    }

    const updated = await markNotificationAsRead(
      student.instituteId,
      student.userId,
      notificationId,
    );

    if (!updated) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Notification marked as read',
      data: updated,
    });
  } catch (err: any) {
    console.error('Error marking student notification as read:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to mark notification as read' },
      { status: err?.message?.includes('token') || err?.message?.includes('expired') ? 401 : 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return handleMarkRead(request, context);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return handleMarkRead(request, context);
}

