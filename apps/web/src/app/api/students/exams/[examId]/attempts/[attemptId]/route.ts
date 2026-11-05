import { NextRequest } from 'next/server';
import { GET as handleAttemptGet } from '../../../../../../students/exams/[examId]/attempts/[attemptId]/route';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ examId: string; attemptId: string }> }
) {
  return handleAttemptGet(request, context);
}

