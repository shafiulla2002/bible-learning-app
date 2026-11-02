import { NextRequest, NextResponse } from 'next/server';
import { queryDb, resolveServerAdminContext } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function GET(
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

    const batchRows = await queryDb(
      `SELECT
         b.id, b."instituteId", b."courseId", b.name, b.code, b.status,
         b."startDate", b."endDate", b.capacity, b."academicYearId", b."termId",
         c.title as "courseTitle", c.slug as "courseSlug",
         ay.name as "academicYearName",
         at.name as "termName"
       FROM "Batch" b
       JOIN "Course" c ON c.id = b."courseId"
       LEFT JOIN "AcademicYear" ay ON ay.id = b."academicYearId"
       LEFT JOIN "AcademicTerm" at ON at.id = b."termId"
       WHERE b.id = $1 AND b."instituteId" = $2`,
      [id, effectiveInstituteId]
    );

    if (batchRows.length === 0) {
      return NextResponse.json({ message: 'Batch not found' }, { status: 404 });
    }

    const b = batchRows[0];

    // Assigned Teachers
    const teachers = await queryDb(
      `SELECT
         bt.id, bt."teacherProfileId", bt.role,
         u."fullName", u."phoneE164", u.email,
         tp."employeeCode", tp.specialization
       FROM "BatchTeacher" bt
       JOIN "TeacherProfile" tp ON tp.id = bt."teacherProfileId"
       JOIN "Membership" m ON m.id = tp."membershipId"
       JOIN "User" u ON u.id = m."userId"
       WHERE bt."batchId" = $1
       ORDER BY bt."createdAt" ASC`,
      [id]
    );

    // Live Sessions
    const sessions = await queryDb(
      `SELECT
         ls.id, ls.title, ls."startsAt", ls."endsAt", ls.room, ls."joinUrl",
         ls."isRecurring", ls.status,
         u."fullName" as "teacherName"
       FROM "LiveSession" ls
       LEFT JOIN "TeacherProfile" tp ON tp.id = ls."teacherProfileId"
       LEFT JOIN "Membership" m ON m.id = tp."membershipId"
       LEFT JOIN "User" u ON u.id = m."userId"
       WHERE ls."batchId" = $1
       ORDER BY ls."startsAt" ASC`,
      [id]
    );

    // Enrolled Students
    const students = await queryDb(
      `SELECT
         e.id as "enrolmentId", e.status, e."createdAt" as "enrolledAt",
         sp.id as "studentProfileId", sp."admissionNo",
         u."fullName", u."phoneE164", u.email
       FROM "Enrolment" e
       JOIN "StudentProfile" sp ON sp.id = e."studentProfileId"
       JOIN "Membership" m ON m.id = sp."membershipId"
       JOIN "User" u ON u.id = m."userId"
       WHERE e."batchId" = $1 AND e.status = 'ACTIVE'
       ORDER BY u."fullName" ASC`,
      [id]
    );

    // Transfer Logs
    const transferLogs = await queryDb(
      `SELECT
         tl.id, tl.reason, tl."transferredBy", tl."transferredAt",
         sp."admissionNo", u."fullName" as "studentName",
         sb.name as "sourceBatch", tb.name as "targetBatch"
       FROM "BatchTransferLog" tl
       JOIN "StudentProfile" sp ON sp.id = tl."studentProfileId"
       JOIN "Membership" m ON m.id = sp."membershipId"
       JOIN "User" u ON u.id = m."userId"
       JOIN "Batch" sb ON sb.id = tl."sourceBatchId"
       JOIN "Batch" tb ON tb.id = tl."targetBatchId"
       WHERE (tl."sourceBatchId" = $1 OR tl."targetBatchId" = $1) AND tl."instituteId" = $2
       ORDER BY tl."transferredAt" DESC`,
      [id, effectiveInstituteId]
    );

    return NextResponse.json({
      ...b,
      course: {
        id: b.courseId,
        title: b.courseTitle,
        slug: b.courseSlug,
      },
      academicYear: b.academicYearId ? { id: b.academicYearId, name: b.academicYearName } : null,
      academicTerm: b.termId ? { id: b.termId, name: b.termName } : null,
      teachers,
      sessions,
      timetable: sessions,
      students,
      enrolments: students.map((st: any) => ({
        id: st.enrolmentId,
        studentProfileId: st.studentProfileId,
        status: st.status,
        enrolledAt: st.enrolledAt,
        studentProfile: {
          id: st.studentProfileId,
          admissionNo: st.admissionNo,
          membership: {
            user: {
              fullName: st.fullName,
              email: st.email,
              phoneE164: st.phoneE164,
            },
          },
        },
      })),
      transferLogs,
    });
  } catch (error: any) {
    console.error('Error in /institutes/[instituteId]/batches/[id] GET:', error);
    return NextResponse.json(
      { message: error?.message || 'Failed to fetch batch' },
      { status: 500 }
    );
  }
}

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
    const { name, code, status, capacity, startDate, endDate } = body;

    await queryDb(
      `UPDATE "Batch"
       SET name = COALESCE($1, name),
           code = COALESCE($2, code),
           status = COALESCE($3, status),
           capacity = COALESCE($4, capacity),
           "startDate" = CASE WHEN $5::text IS NOT NULL THEN $5::timestamp ELSE "startDate" END,
           "endDate" = CASE WHEN $6::text IS NOT NULL THEN $6::timestamp ELSE "endDate" END,
           "updatedAt" = NOW()
       WHERE id = $7 AND "instituteId" = $8`,
      [name, code, status, capacity, startDate, endDate, id, effectiveInstituteId]
    );

    return NextResponse.json({ message: 'Batch updated successfully' });
  } catch (error: any) {
    console.error('Error in /institutes/[instituteId]/batches/[id] PATCH:', error);
    return NextResponse.json(
      { message: error?.message || 'Failed to update batch' },
      { status: 500 }
    );
  }
}
