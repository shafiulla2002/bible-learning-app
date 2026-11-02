import { NextRequest, NextResponse } from 'next/server';
import { queryDb } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ instituteId: string; batchId: string }> }
) {
  try {
    const { instituteId, batchId } = await params;
    const body = await request.json();

    const { date, mode = 'DAILY_BATCH', liveSessionId = null, records = [] } = body;

    if (!date || !Array.isArray(records)) {
      return NextResponse.json({ error: 'date and records array are required' }, { status: 400 });
    }

    let createdCount = 0;
    let updatedCount = 0;

    for (const item of records) {
      const { studentProfileId, status, remarks = null } = item;
      if (!studentProfileId || !status) continue;

      // Upsert attendance record
      const existing = await queryDb(
        `SELECT id, status FROM "Attendance"
         WHERE "instituteId" = $1 AND "batchId" = $2 AND "studentProfileId" = $3 AND date = $4::date`,
        [instituteId, batchId, studentProfileId, date]
      );

      if (existing.length > 0) {
        const attId = existing[0].id;
        const prevStatus = existing[0].status;

        await queryDb(
          `UPDATE "Attendance"
           SET status = $1, remarks = $2, "updatedAt" = NOW()
           WHERE id = $3`,
          [status, remarks, attId]
        );

        // Audit log
        await queryDb(
          `INSERT INTO "AttendanceAuditLog" (
            id, "attendanceId", "previousStatus", "newStatus", "newRemarks", "changedByRole", "changedAt"
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, 'ADMIN', NOW()
          )`,
          [attId, prevStatus, status, remarks]
        );

        updatedCount++;
      } else {
        const inserted = await queryDb(
          `INSERT INTO "Attendance" (
            id, "instituteId", "batchId", "studentProfileId", "liveSessionId", mode, date, status, remarks, "markedByRole", "markedAt", "createdAt", "updatedAt"
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5, $6::date, $7, $8, 'ADMIN', NOW(), NOW(), NOW()
          ) RETURNING id`,
          [instituteId, batchId, studentProfileId, liveSessionId, mode, date, status, remarks]
        );
        createdCount++;
      }
    }

    return NextResponse.json({
      success: true,
      batchId,
      date,
      mode,
      totalSubmitted: records.length,
      createdCount,
      updatedCount,
    });
  } catch (error: any) {
    console.error('Error saving bulk attendance:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
