import { NextRequest, NextResponse } from 'next/server';
import { resolveServerAdminContext } from '@/lib/server-db';
import { buildFullSettingsResponse } from '@/lib/settings-helper';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ instituteId: string }> }
) {
  try {
    const { instituteId } = await params;
    const ctx = await resolveServerAdminContext();
    const effectiveInstituteId =
      instituteId && instituteId !== 'null' && instituteId !== 'undefined' && instituteId !== 'inst-1'
        ? instituteId
        : ctx.instituteId;

    const full = await buildFullSettingsResponse(effectiveInstituteId);
    return NextResponse.json(full);
  } catch (error: any) {
    console.error('Error in /institutes/[instituteId]/settings GET:', error);
    return NextResponse.json({ message: error?.message || 'Failed to fetch settings' }, { status: 500 });
  }
}
