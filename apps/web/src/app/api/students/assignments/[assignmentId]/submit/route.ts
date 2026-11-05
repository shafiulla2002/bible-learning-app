import { NextRequest } from 'next/server';
import { POST as handleSubmitPost } from '../../../../../students/assignments/[assignmentId]/submit/route';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ assignmentId: string }> }
) {
  return handleSubmitPost(request, context);
}

