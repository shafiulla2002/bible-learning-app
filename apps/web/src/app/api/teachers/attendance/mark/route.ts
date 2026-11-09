import { NextRequest, NextResponse } from 'next/server';
import { resolveAuthenticatedTeacher, TeacherAuthError } from '@/lib/server-teacher';
import { queryDb, getDbPool } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const teacher = await resolveAuthenticatedTeacher(request);
    const { teacherProfileId, instituteId, userId } = teacher;

    const body = await request.json().catch(() => ({}));
    const { batchId, date, records } = body;

    if (!batchId || !date || !Array.isArray(records)) {
      return NextResponse.json(
        { success: false, error: 'batchId, date, and records array are required' },
        { status: 400 }
      );
    }

    // 1. Verify teacher is assigned to batchId
    const assignmentCheck = await queryDb(
      `SELECT bt.id
       FROM "BatchTeacher" bt
       WHERE bt."batchId" = $1 AND bt."teacherProfileId" = $2 AND bt."instituteId" = $3`,
      [batchId, teacherProfileId, instituteId]
    );

    if (assignmentCheck.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden: You are not assigned to instruct this batch and cannot record its attendance.',
        },
        { status: 403 }
      );
    }

    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json(
        { success: false, error: 'Database service unavailable' },
        { status: 503 }
      );
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let updatedCount = 0;

      for (const rec of records) {
        if (!rec.studentProfileId || !rec.status) continue;

        // Check for existing attendance record
        const existing = await client.query(
          `SELECT id, status, remarks FROM "Attendance"
           WHERE "instituteId" = $1 AND "batchId" = $2 AND "studentProfileId" = $3 AND date = $4::date
           LIMIT 1`,
          [instituteId, batchId, rec.studentProfileId, date]
        );

        let attId: string;
        if (existing.rows.length > 0) {
          attId = existing.rows[0].id;
          const prevStatus = existing.rows[0].status;
          const prevRemarks = existing.rows[0].remarks;

          await client.query(
            `UPDATE "Attendance"
             SET status = $1, remarks = $2, "updatedById" = $3, "updatedAt" = NOW()
             WHERE id = $4`,
            [rec.status, rec.remarks || null, userId, attId]
          );

          await client.query(
            `INSERT INTO "AttendanceAuditLog" (
              id, "attendanceId", "previousStatus", "newStatus", "previousRemarks",
              "newRemarks", "changedById", "changedByRole", "changedAt"
            ) VALUES (
              gen_random_uuid(), $1, $2, $3, $4, $5, $6, 'TEACHER', NOW()
            )`,
            [attId, prevStatus, rec.status, prevRemarks, rec.remarks || null, userId]
          );
        } else {
          const insertRes = await client.query(
            `INSERT INTO "Attendance" (
              id, "instituteId", "batchId", "studentProfileId", "enrolmentId",
              date, status, remarks, "markedById", "markedByRole", "updatedById",
              "markedAt", "createdAt", "updatedAt", mode
            ) VALUES (
              gen_random_uuid(), $1, $2, $3, $4,
              $5::date, $6, $7, $8, 'TEACHER', $8,
              NOW(), NOW(), NOW(), 'DAILY_BATCH'
            ) RETURNING id`,
            [
              instituteId,
              batchId,
              rec.studentProfileId,
              rec.enrolmentId || null,
              date,
              rec.status,
              rec.remarks || null,
              userId,
            ]
          );
          attId = insertRes.rows[0].id;

          await client.query(
            `INSERT INTO "AttendanceAuditLog" (
              id, "attendanceId", "previousStatus", "newStatus", "previousRemarks",
              "newRemarks", "changedById", "changedByRole", "changedAt"
            ) VALUES (
              gen_random_uuid(), $1, $2, $2, NULL, $3, $4, 'TEACHER', NOW()
            )`,
            [attId, rec.status, rec.remarks || null, userId]
          );
        }
        updatedCount++;
      }

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        message: `Successfully saved attendance for ${updatedCount} students`,
        batchId,
        date,
        recordsUpdated: updatedCount,
      });
    } catch (dbErr: any) {
      await client.query('ROLLBACK');
      throw dbErr;
    } finally {
      client.release();
    }
  } catch (err: any) {
    if (err instanceof TeacherAuthError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.statusCode }
      );
    }
    console.error('Teacher mark attendance route error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error while saving attendance records' },
      { status: 500 }
    );
  }
}
