import { NextRequest } from 'next/server';
import { GET as handleSessionDetailGet } from '../../../../students/live-sessions/[sessionId]/route';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  return handleSessionDetailGet(request, context);
}

