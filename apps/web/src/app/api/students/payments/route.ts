import { NextRequest } from 'next/server';
import { GET as handlePaymentsGet } from '../../../students/payments/route';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return handlePaymentsGet(request);
}

