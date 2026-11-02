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
    const { studentProfileId } = body;

    if (!studentProfileId) {
      return NextResponse.json({ message: 'studentProfileId is required' }, { status: 400 });
    }

    const batchRows = await queryDb(
      `SELECT id, "courseId", capacity,
        (SELECT COUNT(*)::int FROM "Enrolment" e WHERE e."batchId" = $1 AND e.status = 'ACTIVE') as "enrolledCount"
       FROM "Batch" WHERE id = $1 AND "instituteId" = $2`,
      [batchId, effectiveInstituteId]
    );

    if (batchRows.length === 0) {
      return NextResponse.json({ message: 'Batch not found' }, { status: 404 });
    }

    const batch = batchRows[0];
    if (batch.enrolledCount >= batch.capacity) {
      return NextResponse.json(
        { message: `Batch capacity limit reached (${batch.capacity} students max)` },
        { status: 400 }
      );
    }

    // Upsert enrolment for this student & course
    const existing = await queryDb(
      `SELECT id FROM "Enrolment" WHERE "studentProfileId" = $1 AND "courseId" = $2`,
      [studentProfileId, batch.courseId]
    );

    let enrolment;
    if (existing.length > 0) {
      const updated = await queryDb(
        `UPDATE "Enrolment"
         SET "batchId" = $1, status = 'ACTIVE', "updatedAt" = NOW()
         WHERE id = $2
         RETURNING *`,
        [batchId, existing[0].id]
      );
      enrolment = updated[0];
    } else {
      const inserted = await queryDb(
        `INSERT INTO "Enrolment" (
          id, "instituteId", "studentProfileId", "courseId", "batchId", source, status, "createdAt", "updatedAt"
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, 'ADMIN', 'ACTIVE', NOW(), NOW()
        ) RETURNING *`,
        [effectiveInstituteId, studentProfileId, batch.courseId, batchId]
      );
      enrolment = inserted[0];
    }

    return NextResponse.json(enrolment, { status: 201 });
  } catch (error: any) {
    console.error('Error in /institutes/[instituteId]/batches/[id]/enroll POST:', error);
    return NextResponse.json({ message: error?.message || 'Failed to enrol student' }, { status: 500 });
  }
}

