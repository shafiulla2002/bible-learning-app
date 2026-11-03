import { NextRequest, NextResponse } from 'next/server';
import { queryDb, resolveServerAdminContext } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ instituteId: string; id: string }> }
) {
  try {
    const { instituteId, id } = await params;
    const ctx = await resolveServerAdminContext();
    const effectiveInstituteId =
      instituteId && instituteId !== 'null' && instituteId !== 'undefined'
        ? instituteId
        : ctx.instituteId;

    const body = await request.json();
    const { status, notes } = body;

    if (!status) {
      return NextResponse.json({ message: 'Status is required' }, { status: 400 });
    }

    // Update status
    await queryDb(
      `UPDATE "StudentProfile"
       SET status = $1, "updatedAt" = NOW()
       WHERE id = $2 AND "instituteId" = $3`,
      [status, id, effectiveInstituteId]
    );

    // Record in Admission audit
    await queryDb(
      `INSERT INTO "Admission" (id, "instituteId", "studentProfileId", status, statement, "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), NOW())`,
      [effectiveInstituteId, id, status, notes || `Status changed to ${status}`]
    );

    return NextResponse.json({ id, status, notes });
  } catch (error: any) {
    console.error('Error in student status route:', error);
    return NextResponse.json(
      { message: error?.message || 'Failed to update student status' },
      { status: 500 }
    );
  }
}

