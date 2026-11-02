import { NextRequest, NextResponse } from 'next/server';
import { queryDb } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ instituteId: string; attendanceId: string }> }
) {
  try {
    const { instituteId, attendanceId } = await params;
    const body = await request.json();

    const { status, remarks } = body;

    const existing = await queryDb(
      `SELECT * FROM "Attendance" WHERE id = $1 AND "instituteId" = $2`,
      [attendanceId, instituteId]
    );

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 });
    }

    const prev = existing[0];

    const updated = await queryDb(
      `UPDATE "Attendance"
       SET status = COALESCE($1, status),
           remarks = COALESCE($2, remarks),
           "updatedAt" = NOW()
       WHERE id = $3 AND "instituteId" = $4
       RETURNING *`,
      [status, remarks, attendanceId, instituteId]
    );

    if (status && status !== prev.status) {
      await queryDb(
        `INSERT INTO "AttendanceAuditLog" (
          id, "attendanceId", "previousStatus", "newStatus", "previousRemarks", "newRemarks", "changedByRole", "changedAt"
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, 'ADMIN', NOW()
        )`,
        [attendanceId, prev.status, status, prev.remarks, remarks]
      );
    }

    return NextResponse.json(updated[0]);
  } catch (error: any) {
    console.error('Error updating attendance record:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
