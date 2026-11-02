import { NextRequest, NextResponse } from 'next/server';
import { queryDb, resolveServerAdminContext } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ instituteId: string; id: string }> }
) {
  try {
    const { instituteId, id: batchId } = await params;
    const ctx = await resolveServerAdminContext();
    const effectiveInstituteId =
      instituteId && instituteId !== 'null' && instituteId !== 'undefined'
        ? instituteId
        : ctx.instituteId;

    const body = await request.json();
    const { teacherProfileId, role = 'LEAD' } = body;

    if (!teacherProfileId) {
      return NextResponse.json({ message: 'teacherProfileId is required' }, { status: 400 });
    }

    const normalizedRole = role === 'PRIMARY' ? 'LEAD' : role;

    const existing = await queryDb(
      `SELECT id FROM "BatchTeacher" WHERE "batchId" = $1 AND "teacherProfileId" = $2`,
      [batchId, teacherProfileId]
    );

    if (existing.length > 0) {
      const updated = await queryDb(
        `UPDATE "BatchTeacher" SET role = $1 WHERE id = $2 RETURNING *`,
        [normalizedRole, existing[0].id]
      );
      return NextResponse.json(updated[0]);
    }

    const inserted = await queryDb(
      `INSERT INTO "BatchTeacher" (id, "instituteId", "batchId", "teacherProfileId", role, "createdAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())
       RETURNING *`,
      [effectiveInstituteId, batchId, teacherProfileId, normalizedRole]
    );

    return NextResponse.json(inserted[0], { status: 201 });
  } catch (error: any) {
    console.error('Error assigning teacher to batch:', error);
    return NextResponse.json({ message: error?.message || 'Failed to assign teacher' }, { status: 500 });
  }
}

