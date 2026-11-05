import { NextRequest } from 'next/server';
import { GET as handleInvoiceDetailGet } from '../../../../students/invoices/[invoiceId]/route';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ invoiceId: string }> }
) {
  return handleInvoiceDetailGet(request, context);
}

