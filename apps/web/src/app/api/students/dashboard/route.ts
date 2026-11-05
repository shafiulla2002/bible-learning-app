import { NextRequest } from 'next/server';
import { GET as handleStudentDashboardGet } from '../../../students/dashboard/route';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return handleStudentDashboardGet(request);
}

