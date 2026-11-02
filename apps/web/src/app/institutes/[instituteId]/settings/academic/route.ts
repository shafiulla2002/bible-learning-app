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

    if (body.currentAcademicYearId) {
      await queryDb(
        `UPDATE "AcademicYear" SET "isCurrent" = (id = $1), "updatedAt" = NOW() WHERE "instituteId" = $2`,
        [body.currentAcademicYearId, effectiveInstituteId]
      );
    }

    if (body.currentAcademicTermId) {
      await queryDb(
        `UPDATE "AcademicTerm" SET "isCurrent" = (id = $1), "updatedAt" = NOW() WHERE "instituteId" = $2`,
        [body.currentAcademicTermId, effectiveInstituteId]
      );
    }

    const currentSettings = await queryDb(
      `SELECT "enrolmentRules" FROM "InstituteSettings" WHERE "instituteId" = $1`,
      [effectiveInstituteId]
    );
    const existingRules = (currentSettings[0]?.enrolmentRules as any) || {};
    const updatedRules = { ...existingRules, ...body };

    await queryDb(
      `INSERT INTO "InstituteSettings" ("instituteId", "enrolmentRules", "updatedAt")
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT ("instituteId")
       DO UPDATE SET "enrolmentRules" = $2::jsonb, "updatedAt" = NOW()`,
      [effectiveInstituteId, JSON.stringify(updatedRules)]
    );

    const full = await buildFullSettingsResponse(effectiveInstituteId);
    return NextResponse.json(full.academic);
  } catch (error: any) {
    console.error('Error updating academic settings:', error);
    return NextResponse.json({ message: error?.message || 'Failed to update academic settings' }, { status: 500 });
  }
}
