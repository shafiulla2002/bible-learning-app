import { NextRequest } from 'next/server';
import { POST as handleExamStartPost } from '../../../../../students/exams/[examId]/start/route';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ examId: string }> }
) {
  return handleExamStartPost(request, context);
}

