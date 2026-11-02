import { NextRequest, NextResponse } from 'next/server';
import { queryDb } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ instituteId: string; id: string }> }
) {
  try {
    const { instituteId, id } = await params;

    // Unset current on all academic years for this institute
    await queryDb(
      `UPDATE "AcademicYear" SET "isCurrent" = false, "updatedAt" = NOW() WHERE "instituteId" = $1`,
      [instituteId]
    );

    // Set current on the target academic year
    const updated = await queryDb(
      `UPDATE "AcademicYear" SET "isCurrent" = true, "updatedAt" = NOW()
       WHERE "instituteId" = $1 AND id = $2
       RETURNING *`,
      [instituteId, id]
    );

    if (updated.length === 0) {
      return NextResponse.json({ error: 'Academic year not found' }, { status: 404 });
    }

    return NextResponse.json(updated[0]);
  } catch (error: any) {
    console.error('Error setting current academic year:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
