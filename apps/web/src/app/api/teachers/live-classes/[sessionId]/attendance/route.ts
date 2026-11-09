import { NextRequest, NextResponse } from 'next/server';
import { resolveAuthenticatedTeacher, TeacherAuthError } from '@/lib/server-teacher';
import { queryDb } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await context.params;
    const teacher = await resolveAuthenticatedTeacher(request);
    const { teacherProfileId, instituteId } = teacher;

    const sessionRows = await queryDb<any>(
      `SELECT ls.*, b.name as "batchName"
       FROM "LiveSession" ls
       JOIN "Batch" b ON b.id = ls."batchId"
       WHERE ls.id = $1 AND ls."instituteId" = $2`,
      [sessionId, instituteId]
    );

    if (sessionRows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Live class session not found' },
        { status: 404 }
      );
    }

    const session = sessionRows[0];

    // Authorization
    const authCheck = await queryDb(
      `SELECT 1 FROM "Batch" b
       WHERE b.id = $1 AND b."instituteId" = $2
         AND (
           b.id IN (
             SELECT bt."batchId" FROM "BatchTeacher" bt
             WHERE bt."teacherProfileId" = $3 AND bt."instituteId" = $2
           )
           OR b."courseId" IN (
             SELECT ci."courseId" FROM "CourseInstructor" ci
             WHERE ci."teacherProfileId" = $3 AND ci."instituteId" = $2
           )
           OR $3 = $4
         )`,
      [session.batchId, instituteId, teacherProfileId, session.teacherProfileId]
    );

    if (authCheck.length === 0) {
      return NextResponse.json(
        { success: false, message: 'You are not authorized to access attendance for this session' },
        { status: 403 }
      );
    }

    // Get active enrolled students in this batch along with any existing attendance record
    const roster = await queryDb<any>(
      `SELECT
         sp.id as "studentProfileId",
         sp."admissionNumber",
         sp."photoUrl",
         u."fullName",
         u.email,
         e.id as "enrolmentId",
         att.id as "attendanceId",
         att.status as "attendanceStatus",
         att.remarks,
         att."markedAt"
       FROM "Enrolment" e
       JOIN "StudentProfile" sp ON sp.id = e."studentProfileId"
       JOIN "Membership" m ON m.id = sp."membershipId"
       JOIN "User" u ON u.id = m."userId"
       LEFT JOIN "Attendance" att ON att."liveSessionId" = $1 AND att."studentProfileId" = sp.id
       WHERE e."batchId" = $2
         AND e.status = 'ACTIVE'
         AND sp."instituteId" = $3
       ORDER BY u."fullName" ASC`,
      [sessionId, session.batchId, instituteId]
    );

    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;
    let excusedCount = 0;
    let unmarkedCount = 0;

    for (const r of roster) {
      if (r.attendanceStatus === 'PRESENT') presentCount++;
      else if (r.attendanceStatus === 'LATE') lateCount++;
      else if (r.attendanceStatus === 'ABSENT') absentCount++;
      else if (r.attendanceStatus === 'EXCUSED') excusedCount++;
      else unmarkedCount++;
    }

    return NextResponse.json({
      success: true,
      data: {
        session: {
          id: session.id,
          title: session.title,
          batchId: session.batchId,
          batchName: session.batchName,
          startsAt: session.startsAt,
          endsAt: session.endsAt,
          status: session.status,
        },
        roster,
        summary: {
          totalStudents: roster.length,
          presentCount,
          lateCount,
          absentCount,
          excusedCount,
          unmarkedCount,
        },
      },
    });
  } catch (error: any) {
    if (error instanceof TeacherAuthError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.statusCode });
    }
    console.error('Teacher Live Class Attendance GET Error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error fetching session attendance' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await context.params;
    const teacher = await resolveAuthenticatedTeacher(request);
    const { teacherProfileId, instituteId, userId } = teacher;

    const sessionRows = await queryDb<any>(
      `SELECT ls.*
       FROM "LiveSession" ls
       WHERE ls.id = $1 AND ls."instituteId" = $2`,
      [sessionId, instituteId]
    );

    if (sessionRows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Live class session not found' },
        { status: 404 }
      );
    }

    const session = sessionRows[0];

    // Authorization
    const authCheck = await queryDb(
      `SELECT 1 FROM "Batch" b
       WHERE b.id = $1 AND b."instituteId" = $2
         AND (
           b.id IN (
             SELECT bt."batchId" FROM "BatchTeacher" bt
             WHERE bt."teacherProfileId" = $3 AND bt."instituteId" = $2
           )
           OR b."courseId" IN (
             SELECT ci."courseId" FROM "CourseInstructor" ci
             WHERE ci."teacherProfileId" = $3 AND ci."instituteId" = $2
           )
           OR $3 = $4
         )`,
      [session.batchId, instituteId, teacherProfileId, session.teacherProfileId]
    );

    if (authCheck.length === 0) {
      return NextResponse.json(
        { success: false, message: 'You are not authorized to mark attendance for this session' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const records: Array<{
      studentProfileId: string;
      status: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED';
      remarks?: string;
    }> = body.records || [];

    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No attendance records provided' },
        { status: 400 }
      );
    }

    const sessionDate = new Date(session.startsAt).toISOString().split('T')[0];
    const validStatuses = ['PRESENT', 'LATE', 'ABSENT', 'EXCUSED'];
    const updatedAttendances: any[] = [];

    for (const rec of records) {
      if (!rec.studentProfileId || !validStatuses.includes(rec.status)) {
        continue;
      }

      // Verify active enrolment in this batch
      const enrolment = await queryDb<{ id: string }>(
        `SELECT id FROM "Enrolment"
         WHERE "batchId" = $1 AND "studentProfileId" = $2 AND "instituteId" = $3 AND status = 'ACTIVE'
         LIMIT 1`,
        [session.batchId, rec.studentProfileId, instituteId]
      );

      if (enrolment.length === 0) {
        continue;
      }

      const enrolmentId = enrolment[0].id;

      // Check existing attendance for this session and student
      const existing = await queryDb<any>(
        `SELECT id, status, remarks
         FROM "Attendance"
         WHERE "liveSessionId" = $1 AND "studentProfileId" = $2
         LIMIT 1`,
        [sessionId, rec.studentProfileId]
      );

      if (existing.length > 0) {
        const prev = existing[0];
        const res = await queryDb<any>(
          `UPDATE "Attendance"
           SET status = $1,
               remarks = $2,
               "updatedById" = $3,
               "updatedAt" = NOW()
           WHERE id = $4
           RETURNING *`,
          [rec.status, rec.remarks || null, userId, prev.id]
        );
        updatedAttendances.push(res[0]);

        if (prev.status !== rec.status || prev.remarks !== (rec.remarks || null)) {
          try {
            await queryDb(
              `INSERT INTO "AttendanceAuditLog" (
                 id, "attendanceId", "previousStatus", "newStatus", "previousRemarks", "newRemarks",
                 "changedById", "changedByRole", "changedAt"
               ) VALUES (
                 gen_random_uuid(), $1, $2, $3, $4, $5, $6, 'TEACHER', NOW()
               )`,
              [prev.id, prev.status, rec.status, prev.remarks, rec.remarks || null, userId]
            );
          } catch (auditErr: any) {
            console.warn('Attendance audit warning:', auditErr?.message);
          }
        }
      } else {
        const res = await queryDb<any>(
          `INSERT INTO "Attendance" (
             id, "instituteId", "batchId", "studentProfileId", "enrolmentId", "liveSessionId",
             mode, date, status, remarks, "markedById", "markedByRole", "createdAt", "updatedAt"
           ) VALUES (
             gen_random_uuid(), $1, $2, $3, $4, $5, 'LIVE_SESSION', $6::date, $7, $8, $9, 'TEACHER', NOW(), NOW()
           ) RETURNING *`,
          [
            instituteId,
            session.batchId,
            rec.studentProfileId,
            enrolmentId,
            sessionId,
            sessionDate,
            rec.status,
            rec.remarks || null,
            userId,
          ]
        );
        updatedAttendances.push(res[0]);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully updated attendance for ${updatedAttendances.length} student(s)`,
      data: updatedAttendances,
    });
  } catch (error: any) {
    if (error instanceof TeacherAuthError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.statusCode });
    }
    console.error('Teacher Live Class Attendance POST Error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error saving session attendance' },
      { status: 500 }
    );
  }
}
