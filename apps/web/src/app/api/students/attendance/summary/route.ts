import { NextRequest } from 'next/server';
import { GET as handleSummaryGet } from '../../../../students/attendance/summary/route';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return handleSummaryGet(request);
}

