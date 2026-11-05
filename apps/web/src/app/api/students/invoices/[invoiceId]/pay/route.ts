import { NextRequest } from 'next/server';
import { POST as handlePayPost } from '../../../../../students/invoices/[invoiceId]/pay/route';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ invoiceId: string }> }
) {
  return handlePayPost(request, context);
}

