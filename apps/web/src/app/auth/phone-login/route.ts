import { NextRequest } from 'next/server';
import { POST as handlePhoneLoginPost } from '../../api/auth/phone-login/route';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return handlePhoneLoginPost(request);
}

