import { NextRequest } from 'next/server';
import { POST as handleProgressPost } from '../../../../../../../students/courses/[courseId]/lessons/[lessonId]/progress/route';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ courseId: string; lessonId: string }> }
) {
  return handleProgressPost(request, context);
}

