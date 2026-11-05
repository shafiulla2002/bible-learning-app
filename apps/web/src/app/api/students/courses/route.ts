import { NextRequest } from 'next/server';
import { GET as handleStudentCoursesGet } from '../../../students/courses/route';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return handleStudentCoursesGet(request);
}

