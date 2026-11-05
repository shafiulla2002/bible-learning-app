import { NextRequest } from 'next/server';
import { GET as handleCertificatesGet } from '../../../students/certificates/route';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return handleCertificatesGet(request);
}

