import { NextRequest, NextResponse } from 'next/server';
import { queryDb, resolveServerAdminContext } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ instituteId: string; id: string }> }
) {
  try {
    const { instituteId, id: sourceBatchId } = await params;
    const ctx = await resolveServerAdminContext();
    const effectiveInstituteId =
      instituteId && instituteId !== 'null' && instituteId !== 'undefined'
        ? instituteId
        : ctx.instituteId;

    const body = await request.json();
    const { studentProfileId, targetBatchId, reason } = body;

    if (!studentProfileId || !targetBatchId) {
      return NextResponse.json(
        { message: 'studentProfileId and targetBatchId are required' },
        { status: 400 }
      );
    }

    // Update Enrolment to point to targetBatchId
    await queryDb(
      `UPDATE "Enrolment"
       SET "batchId" = $1, "updatedAt" = NOW()
       WHERE "studentProfileId" = $2 AND "batchId" = $3 AND "instituteId" = $4`,
      [targetBatchId, studentProfileId, sourceBatchId, effectiveInstituteId]
    );

    // Log transfer in BatchTransferLog
    const logRows = await queryDb(
      `INSERT INTO "BatchTransferLog" (
        id, "instituteId", "studentProfileId", "sourceBatchId", "targetBatchId", reason, "transferredBy", "transferredAt"
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW()
      ) RETURNING *`,
      [
        effectiveInstituteId,
        studentProfileId,
        sourceBatchId,
        targetBatchId,
        reason || 'Administrative cohort transfer',
        ctx.user.fullName,
      ]
    );

    return NextResponse.json(logRows[0], { status: 201 });
  } catch (error: any) {
    console.error('Error in /institutes/[instituteId]/batches/[id]/transfer POST:', error);
    return NextResponse.json({ message: error?.message || 'Failed to transfer student' }, { status: 500 });
  }
}

