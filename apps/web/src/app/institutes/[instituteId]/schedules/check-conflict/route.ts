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
      instituteId && instituteId !== 'null' && instituteId !== 'undefined'
        ? instituteId
        : ctx.instituteId;

    const body = await request.json();
    const { teacherProfileId, room, startsAt, endsAt } = body;

    if (!startsAt || !endsAt) {
      return NextResponse.json({ hasConflict: false, conflicts: [] });
    }

    const conflicts = await queryDb(
      `SELECT id, title, room, "startsAt", "endsAt"
       FROM "LiveSession"
       WHERE "instituteId" = $1
         AND status != 'CANCELLED'
         AND "startsAt" < $3::timestamp
         AND "endsAt" > $2::timestamp
         AND ($4::text IS NULL OR room = $4 OR "teacherProfileId"::text = $5::text)`,
      [effectiveInstituteId, startsAt, endsAt, room || null, teacherProfileId || null]
    );

    return NextResponse.json({
      hasConflict: conflicts.length > 0,
      conflicts,
    });
  } catch (error: any) {
    console.error('Error checking schedule conflict:', error);
    return NextResponse.json({ hasConflict: false, conflicts: [] });
  }
}

