import { NextRequest } from 'next/server';
import { GET as handleCertificateDetailGet } from '../../../../students/certificates/[certificateId]/route';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ certificateId: string }> }
) {
  return handleCertificateDetailGet(request, context);
}

