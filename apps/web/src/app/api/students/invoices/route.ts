import { NextRequest } from 'next/server';
import { GET as handleInvoicesGet } from '../../../students/invoices/route';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return handleInvoicesGet(request);
}

