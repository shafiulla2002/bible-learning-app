import { NextRequest } from 'next/server';
import { POST as handleSubmitAttemptPost } from '../../../../../../../students/exams/[examId]/attempts/[attemptId]/submit/route';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ examId: string; attemptId: string }> }
) {
  return handleSubmitAttemptPost(request, context);
}

