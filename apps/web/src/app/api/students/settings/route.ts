import { NextRequest } from 'next/server';
import {
  GET as handleSettingsGet,
  PATCH as handleSettingsPatch,
} from '../../../students/settings/route';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return handleSettingsGet(request);
}

export async function PATCH(request: NextRequest) {
  return handleSettingsPatch(request);
}

