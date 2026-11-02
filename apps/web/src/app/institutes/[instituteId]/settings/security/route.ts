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

    const currentSettings = await queryDb(
      `SELECT "notificationConfig", "studentSelfRegistration" FROM "InstituteSettings" WHERE "instituteId" = $1`,
      [effectiveInstituteId]
    );
    const existingNotif = (currentSettings[0]?.notificationConfig as any) || {};
    const updatedNotif = { ...existingNotif, ...body };
    const selfReg =
      body.studentSelfRegistration !== undefined
        ? Boolean(body.studentSelfRegistration)
        : Boolean(currentSettings[0]?.studentSelfRegistration ?? true);

    await queryDb(
      `INSERT INTO "InstituteSettings" ("instituteId", "notificationConfig", "studentSelfRegistration", "updatedAt")
       VALUES ($1, $2::jsonb, $3, NOW())
       ON CONFLICT ("instituteId")
       DO UPDATE SET "notificationConfig" = $2::jsonb, "studentSelfRegistration" = $3, "updatedAt" = NOW()`,
      [effectiveInstituteId, JSON.stringify(updatedNotif), selfReg]
    );

    const full = await buildFullSettingsResponse(effectiveInstituteId);
    return NextResponse.json(full.security);
  } catch (error: any) {
    console.error('Error updating security settings:', error);
    return NextResponse.json({ message: error?.message || 'Failed to update security settings' }, { status: 500 });
  }
}
