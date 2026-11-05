import { NextRequest } from 'next/server';
import { POST as handleVerifyPaymentPost } from '../../../../../students/invoices/[invoiceId]/verify-payment/route';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ invoiceId: string }> }
) {
  return handleVerifyPaymentPost(request, context);
}

