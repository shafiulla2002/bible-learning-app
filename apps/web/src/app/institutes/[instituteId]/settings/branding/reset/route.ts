import { NextRequest, NextResponse } from 'next/server';
import { queryDb, resolveServerAdminContext } from '@/lib/server-db';
import { buildFullSettingsResponse } from '@/lib/settings-helper';

export const dynamic = 'force-dynamic';

export async function POST(
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

    const defaultBranding = {
      primaryColor: '#2563eb',
      secondaryColor: '#1e2235',
      accentColor: '#10b981',
      logoUrl: '',
    };

    await queryDb(
      `UPDATE "Institute" SET "logoUrl" = NULL, "updatedAt" = NOW() WHERE id = $1`,
      [effectiveInstituteId]
    );

    await queryDb(
      `INSERT INTO "InstituteSettings" ("instituteId", branding, "updatedAt")
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT ("instituteId")
       DO UPDATE SET branding = $2::jsonb, "updatedAt" = NOW()`,
      [effectiveInstituteId, JSON.stringify(defaultBranding)]
    );

    const full = await buildFullSettingsResponse(effectiveInstituteId);
    return NextResponse.json(full.branding);
  } catch (error: any) {
    console.error('Error resetting branding:', error);
    return NextResponse.json({ message: error?.message || 'Failed to reset branding' }, { status: 500 });
  }
}
