import { NextRequest } from 'next/server';
import { GET as handleStudentExamsGet } from '../../../students/exams/route';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return handleStudentExamsGet(request);
}

