import { NextRequest, NextResponse } from 'next/server';
import { queryDb } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ instituteId: string; id: string }> }
) {
  try {
    const { instituteId, id } = await params;

    await queryDb(
      `UPDATE "AcademicTerm" SET "isCurrent" = false, "updatedAt" = NOW() WHERE "instituteId" = $1`,
      [instituteId]
    );

    const updated = await queryDb(
      `UPDATE "AcademicTerm" SET "isCurrent" = true, "updatedAt" = NOW()
       WHERE "instituteId" = $1 AND id = $2
       RETURNING *`,
      [instituteId, id]
    );

    if (updated.length === 0) {
      return NextResponse.json({ error: 'Academic term not found' }, { status: 404 });
    }

    return NextResponse.json(updated[0]);
  } catch (error: any) {
    console.error('Error setting current academic term:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
