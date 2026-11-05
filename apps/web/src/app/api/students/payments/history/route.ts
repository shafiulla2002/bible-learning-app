import { NextRequest } from 'next/server';
import { GET as handlePaymentHistoryGet } from '../../../../students/payments/history/route';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return handlePaymentHistoryGet(request);
}

