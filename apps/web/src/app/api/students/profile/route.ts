import { NextRequest } from 'next/server';
import {
  GET as handleProfileGet,
  PATCH as handleProfilePatch,
} from '../../../students/profile/route';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return handleProfileGet(request);
}

export async function PATCH(request: NextRequest) {
  return handleProfilePatch(request);
}

