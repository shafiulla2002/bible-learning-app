import { NextRequest, NextResponse } from 'next/server';
import { queryDb, resolveServerAdminContext } from '@/lib/server-db';

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

    const body = await request.json();
    const { teacherProfileId, startsAt, endsAt } = body;

    if (!teacherProfileId || !startsAt || !endsAt) {
      return NextResponse.json({ hasConflict: false });
    }

    const conflicts = await queryDb(
      `SELECT ls.id, ls.title, ls."startsAt", ls."endsAt", b.name as "batchName"
       FROM "LiveSession" ls
       JOIN "Batch" b ON b.id = ls."batchId"
       WHERE ls."instituteId" = $1
         AND ls."teacherProfileId" = $2
         AND ls.status != 'CANCELLED'
         AND ls."startsAt" < $4::timestamp
         AND ls."endsAt" > $3::timestamp`,
      [effectiveInstituteId, teacherProfileId, startsAt, endsAt]
    );

    return NextResponse.json({
      hasConflict: conflicts.length > 0,
      conflictType: conflicts.length > 0 ? 'TEACHER_DOUBLE_BOOKED' : undefined,
      conflictingSession: conflicts[0] || undefined,
      message:
        conflicts.length > 0
          ? `Instructor is already scheduled for "${conflicts[0].title}" (${conflicts[0].batchName})`
          : 'No schedule conflict detected.',
    });
  } catch (error: any) {
    console.error('Error checking teacher schedule conflict:', error);
    return NextResponse.json({ hasConflict: false, message: error?.message });
  }
}

