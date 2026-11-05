import { NextRequest } from 'next/server';
import { GET as handleStudentAssignmentsGet } from '../../../students/assignments/route';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return handleStudentAssignmentsGet(request);
}

