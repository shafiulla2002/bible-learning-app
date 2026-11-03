import { NextRequest, NextResponse } from 'next/server';
import { resolveServerAdminContext, getServerRouteCache, setServerRouteCache } from '@/lib/server-db';
import { buildFullSettingsResponse } from '@/lib/settings-helper';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ instituteId: string }> }
) {
  try {
    const { instituteId } = await params;
    let effectiveInstituteId =
      instituteId && instituteId !== 'null' && instituteId !== 'undefined' && instituteId !== 'inst-1'
        ? instituteId
        : '';

    if (!effectiveInstituteId) {
      const ctx = await resolveServerAdminContext();
      effectiveInstituteId = ctx.instituteId;
    }

    const cacheKey = `settings:${effectiveInstituteId}`;
    const cached = getServerRouteCache<any>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    const full = await buildFullSettingsResponse(effectiveInstituteId);
    setServerRouteCache(cacheKey, full, 30000);
    return NextResponse.json(full);
  } catch (error: any) {
    console.error('Error in /institutes/[instituteId]/settings GET:', error);
    return NextResponse.json({ message: error?.message || 'Failed to fetch settings' }, { status: 500 });
  }
}
