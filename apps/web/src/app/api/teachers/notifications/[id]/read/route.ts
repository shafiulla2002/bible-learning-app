import { NextRequest, NextResponse } from 'next/server';
import { resolveAuthenticatedTeacher, TeacherAuthError } from '@/lib/server-teacher';
import { markNotificationAsRead } from '@/lib/server-notifications';

export const dynamic = 'force-dynamic';

async function handleMarkRead(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const teacher = await resolveAuthenticatedTeacher(request);
    const params = await context.params;
    const notificationId = params.id;

    if (!notificationId) {
      return NextResponse.json(
        { error: 'Notification ID is required' },
        { status: 400 },
      );
    }

    const updated = await markNotificationAsRead(
      teacher.instituteId,
      teacher.userId,
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
    if (err instanceof TeacherAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error('Error marking teacher notification as read:', err);
    return NextResponse.json(
      { error: 'Failed to mark notification as read' },
      { status: 500 },
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

