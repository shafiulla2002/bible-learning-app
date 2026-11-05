import { NextRequest } from 'next/server';
import { GET as handleLessonDetailGet } from '../../../../../../students/courses/[courseId]/lessons/[lessonId]/route';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ courseId: string; lessonId: string }> }
) {
  return handleLessonDetailGet(request, context);
}

