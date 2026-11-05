import { NextRequest } from 'next/server';
import { GET as handleCourseDetailGet } from '../../../../students/courses/[courseId]/route';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ courseId: string }> }
) {
  return handleCourseDetailGet(request, context);
}

