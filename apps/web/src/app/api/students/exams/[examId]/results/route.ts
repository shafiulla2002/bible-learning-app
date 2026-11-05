import { NextRequest } from 'next/server';
import { GET as handleResultsGet } from '../../../../../students/exams/[examId]/results/route';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ examId: string }> }
) {
  return handleResultsGet(request, context);
}

