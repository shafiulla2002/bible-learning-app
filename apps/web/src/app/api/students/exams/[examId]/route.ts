import { NextRequest } from 'next/server';
import { GET as handleExamDetailGet } from '../../../../students/exams/[examId]/route';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ examId: string }> }
) {
  return handleExamDetailGet(request, context);
}

