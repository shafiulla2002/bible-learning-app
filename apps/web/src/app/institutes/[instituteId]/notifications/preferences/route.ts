import { NextRequest, NextResponse } from 'next/server';
import { queryDb, resolveServerAdminContext } from '@/lib/server-db';

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

    const rows = await queryDb(
      `SELECT "notificationConfig" FROM "InstituteSettings" WHERE "instituteId" = $1`,
      [effectiveInstituteId]
    );
    const cfg = (rows[0]?.notificationConfig as any) || {};

    return NextResponse.json({
      notifyOnStudentRegistration: cfg.notifyOnStudentRegistration ?? true,
      notifyOnFeePayment: cfg.notifyOnFeePayment ?? true,
      notifyOnAttendanceAlert: cfg.notifyOnAttendanceAlert ?? true,
      notifyOnTeacherManagement: cfg.notifyOnTeacherManagement ?? true,
      notifyOnAcademicActivity: cfg.notifyOnAcademicActivity ?? true,
      notifyOnAdminSecurity: cfg.notifyOnAdminSecurity ?? true,
    });
  } catch (error: any) {
    console.error('Error fetching notification preferences:', error);
    return NextResponse.json({ message: error?.message || 'Failed to fetch preferences' }, { status: 500 });
  }
}

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

    const rows = await queryDb(
      `SELECT "notificationConfig" FROM "InstituteSettings" WHERE "instituteId" = $1`,
      [effectiveInstituteId]
    );
    const existing = (rows[0]?.notificationConfig as any) || {};
    const updated = { ...existing, ...body };

    await queryDb(
      `INSERT INTO "InstituteSettings" ("instituteId", "notificationConfig", "updatedAt")
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT ("instituteId")
       DO UPDATE SET "notificationConfig" = $2::jsonb, "updatedAt" = NOW()`,
      [effectiveInstituteId, JSON.stringify(updated)]
    );

    return NextResponse.json({
      notifyOnStudentRegistration: updated.notifyOnStudentRegistration ?? true,
      notifyOnFeePayment: updated.notifyOnFeePayment ?? true,
      notifyOnAttendanceAlert: updated.notifyOnAttendanceAlert ?? true,
      notifyOnTeacherManagement: updated.notifyOnTeacherManagement ?? true,
      notifyOnAcademicActivity: updated.notifyOnAcademicActivity ?? true,
      notifyOnAdminSecurity: updated.notifyOnAdminSecurity ?? true,
    });
  } catch (error: any) {
    console.error('Error updating notification preferences:', error);
    return NextResponse.json({ message: error?.message || 'Failed to update preferences' }, { status: 500 });
  }
}

