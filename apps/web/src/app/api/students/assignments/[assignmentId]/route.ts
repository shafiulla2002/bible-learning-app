import { NextRequest } from 'next/server';
import { GET as handleAssignmentDetailGet } from '../../../../students/assignments/[assignmentId]/route';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ assignmentId: string }> }
) {
  return handleAssignmentDetailGet(request, context);
}

