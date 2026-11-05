import { NextRequest } from 'next/server';
import { GET as handleStudentMeGet } from '../../students/me/route';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return handleStudentMeGet(request);
}
