import { NextRequest } from 'next/server';
import { GET as handleStudentLiveSessionsGet } from '../../../students/live-sessions/route';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return handleStudentLiveSessionsGet(request);
}

