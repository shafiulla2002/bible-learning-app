import { NextRequest, NextResponse } from 'next/server';
import { resolveAuthenticatedTeacher, TeacherAuthError } from '@/lib/server-teacher';
import { queryDb } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const teacher = await resolveAuthenticatedTeacher(request);
    const { teacherProfileId, instituteId } = teacher;

    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batchId');
    const dateStr = searchParams.get('date') || new Date().toISOString().slice(0, 10);

    if (!batchId) {
      return NextResponse.json(
        { success: false, error: 'batchId query parameter is required' },
        { status: 400 }
      );
    }

    // 1. Verify that the authenticated teacher is assigned to this batch
    const assignmentCheck = await queryDb(
      `SELECT bt.id, b.name, b.code, c.title as "courseTitle"
       FROM "BatchTeacher" bt
       JOIN "Batch" b ON b.id = bt."batchId"
       JOIN "Course" c ON c.id = b."courseId"
       WHERE bt."batchId" = $1 AND bt."teacherProfileId" = $2 AND bt."instituteId" = $3`,
      [batchId, teacherProfileId, instituteId]
    );

    if (assignmentCheck.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden: You are not assigned to instruct this batch and cannot view or record its attendance.',
        },
        { status: 403 }
      );
    }

    const batchInfo = assignmentCheck[0];

    // 2. Fetch enrolled students and their existing attendance for dateStr
    const rosterRows = await queryDb<any>(
      `SELECT 
        sp.id as "studentProfileId",
        sp."admissionNo",
        u."fullName",
        u.email,
        e.id as "enrolmentId",
        e.status as "enrolmentStatus",
        e."createdAt" as "enrolledAt",
        a.status as "attendanceStatus",
        a.remarks,
        a."markedAt"
       FROM "Enrolment" e
       JOIN "StudentProfile" sp ON sp.id = e."studentProfileId"
       JOIN "Membership" m ON m.id = sp."membershipId"
       JOIN "User" u ON u.id = m."userId"
       LEFT JOIN "Attendance" a ON a."batchId" = e."batchId" 
                               AND a."studentProfileId" = sp.id 
                               AND a.date = $2::date
       WHERE e."batchId" = $1 
         AND e.status = 'ACTIVE'
         AND sp.status = 'ACTIVE'
         AND m.status = 'ACTIVE'
       ORDER BY sp."admissionNo" ASC`,
      [batchId, dateStr]
    );

    const roster = rosterRows.map((r) => ({
      studentProfileId: r.studentProfileId,
      admissionNo: r.admissionNo,
      fullName: r.fullName,
      email: r.email,
      enrolmentId: r.enrolmentId,
      enrolmentStatus: r.enrolmentStatus,
      enrolledAt: r.enrolledAt,
      status: r.attendanceStatus || 'PRESENT',
      isMarked: Boolean(r.attendanceStatus),
      remarks: r.remarks || '',
      markedAt: r.markedAt,
    }));

    const presentCount = roster.filter((r) => r.status === 'PRESENT').length;
    const absentCount = roster.filter((r) => r.status === 'ABSENT').length;
    const lateCount = roster.filter((r) => r.status === 'LATE').length;
    const excusedCount = roster.filter((r) => r.status === 'EXCUSED').length;
    const totalCount = roster.length;
    const attendanceRatePct =
      totalCount > 0
        ? Math.round(((presentCount + lateCount) / totalCount) * 100)
        : 0;

    return NextResponse.json({
      success: true,
      batch: {
        id: batchId,
        name: batchInfo.name,
        code: batchInfo.code,
        courseTitle: batchInfo.courseTitle,
      },
      date: dateStr,
      summary: {
        totalStudents: totalCount,
        presentCount,
        absentCount,
        lateCount,
        excusedCount,
        attendanceRatePct,
        isRecorded: rosterRows.some((r) => r.attendanceStatus !== null),
      },
      roster,
    });
  } catch (err: any) {
    if (err instanceof TeacherAuthError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.statusCode }
      );
    }
    console.error('Teacher attendance roster route error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error while fetching attendance roster' },
      { status: 500 }
    );
  }
}

