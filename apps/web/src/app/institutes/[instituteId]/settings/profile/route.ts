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
    const { name, timezone } = body;

    if (name || timezone) {
      await queryDb(
        `UPDATE "Institute"
         SET name = COALESCE($1, name),
             timezone = COALESCE($2, timezone),
             "updatedAt" = NOW()
         WHERE id = $3`,
        [name || null, timezone || null, effectiveInstituteId]
      );
    }

    const currentSettings = await queryDb(
      `SELECT "enrolmentRules", branding FROM "InstituteSettings" WHERE "instituteId" = $1`,
      [effectiveInstituteId]
    );

    const existingRules = (currentSettings[0]?.enrolmentRules as any) || {};
    const existingBranding = (currentSettings[0]?.branding as any) || {};

    const updatedRules = {
      ...existingRules,
      profileMeta: {
        ...(existingRules.profileMeta || {}),
        ...body,
      },
    };

    const updatedBranding = body.displayName
      ? { ...existingBranding, displayName: body.displayName }
      : existingBranding;

    await queryDb(
      `INSERT INTO "InstituteSettings" ("instituteId", "enrolmentRules", branding, "updatedAt")
       VALUES ($1, $2::jsonb, $3::jsonb, NOW())
       ON CONFLICT ("instituteId")
       DO UPDATE SET "enrolmentRules" = $2::jsonb, branding = $3::jsonb, "updatedAt" = NOW()`,
      [effectiveInstituteId, JSON.stringify(updatedRules), JSON.stringify(updatedBranding)]
    );

    await queryDb(
      `INSERT INTO "AuditLog" (id, "instituteId", "actorUserId", action, "entityType", "entityId", metadata, "createdAt")
       VALUES (gen_random_uuid(), $1, $2, 'UPDATE_INSTITUTE_PROFILE', 'Institute', $1, $3::jsonb, NOW())`,
      [effectiveInstituteId, ctx.user.userId, JSON.stringify({ updatedFields: Object.keys(body) })]
    );

    const full = await buildFullSettingsResponse(effectiveInstituteId);
    return NextResponse.json(full.profile);
  } catch (error: any) {
    console.error('Error updating institute profile:', error);
    return NextResponse.json({ message: error?.message || 'Failed to update profile' }, { status: 500 });
  }
}
