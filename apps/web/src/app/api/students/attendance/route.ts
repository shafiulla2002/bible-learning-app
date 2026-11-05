import { NextRequest } from 'next/server';
import { GET as handleStudentAttendanceGet } from '../../../students/attendance/route';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return handleStudentAttendanceGet(request);
}

