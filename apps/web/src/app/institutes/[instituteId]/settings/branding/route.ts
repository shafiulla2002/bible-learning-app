import { NextRequest, NextResponse } from 'next/server';
import { queryDb, resolveServerAdminContext } from '@/lib/server-db';
import { buildFullSettingsResponse } from '@/lib/settings-helper';

export const dynamic = 'force-dynamic';

export async function PATCH(
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

    const body = await request.json();

    if (body.logoUrl !== undefined) {
      await queryDb(
        `UPDATE "Institute" SET "logoUrl" = $1, "updatedAt" = NOW() WHERE id = $2`,
        [body.logoUrl || null, effectiveInstituteId]
      );
    }

    const currentSettings = await queryDb(
      `SELECT branding FROM "InstituteSettings" WHERE "instituteId" = $1`,
      [effectiveInstituteId]
    );
    const existingBranding = (currentSettings[0]?.branding as any) || {};
    const updatedBranding = { ...existingBranding, ...body };

    await queryDb(
      `INSERT INTO "InstituteSettings" ("instituteId", branding, "updatedAt")
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT ("instituteId")
       DO UPDATE SET branding = $2::jsonb, "updatedAt" = NOW()`,
      [effectiveInstituteId, JSON.stringify(updatedBranding)]
    );

    await queryDb(
      `INSERT INTO "AuditLog" (id, "instituteId", "actorUserId", action, "entityType", "entityId", metadata, "createdAt")
       VALUES (gen_random_uuid(), $1, $2, 'UPDATE_INSTITUTE_BRANDING', 'InstituteSettings', $1, $3::jsonb, NOW())`,
      [effectiveInstituteId, ctx.user.userId, JSON.stringify({ branding: updatedBranding })]
    );

    const full = await buildFullSettingsResponse(effectiveInstituteId);
    return NextResponse.json(full.branding);
  } catch (error: any) {
    console.error('Error updating branding:', error);
    return NextResponse.json({ message: error?.message || 'Failed to update branding' }, { status: 500 });
  }
}
