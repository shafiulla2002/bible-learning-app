import { NextRequest, NextResponse } from 'next/server';
import { resolveAuthenticatedTeacher, TeacherAuthError } from '@/lib/server-teacher';
import { queryDb } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const { batchId } = await params;
    const teacher = await resolveAuthenticatedTeacher(request);
    const { teacherProfileId, instituteId } = teacher;

    if (!batchId) {
      return NextResponse.json(
        { success: false, error: 'Batch ID is required' },
        { status: 400 }
      );
    }

    // 1. Verify teacher is assigned to this batch (BatchTeacher or CourseInstructor)
    const assignmentCheck = await queryDb<{ role: string }>(
      `SELECT role FROM (
        SELECT bt.role, 1 as priority
        FROM "BatchTeacher" bt
        WHERE bt."batchId" = $1 AND bt."teacherProfileId" = $2 AND bt."instituteId" = $3
        UNION ALL
        SELECT ci.role, 2 as priority
        FROM "CourseInstructor" ci
        JOIN "Batch" b ON b."courseId" = ci."courseId"
        WHERE b.id = $1 AND ci."teacherProfileId" = $2 AND ci."instituteId" = $3
      ) a ORDER BY priority ASC LIMIT 1`,
      [batchId, teacherProfileId, instituteId]
    );

    if (assignmentCheck.length === 0) {
      return NextResponse.json(
        { success: false, error: 'You are not assigned to instruct or teach this batch.' },
        { status: 403 }
      );
    }

    const assignedRole = assignmentCheck[0].role || 'LEAD';

    // 2. Fetch Batch & Course details
    const batchRows = await queryDb<any>(
      `SELECT 
        b.id,
        b.name,
        b.code,
        b.status,
        b."startDate",
        b."endDate",
        b.capacity,
        b."courseId",
        b."termId",
        b."academicYearId",
        c.title as "courseTitle",
        c.slug as "courseSlug",
        c.slug as "courseCode",
        c.level as "courseLevel",
        c.description as "courseDescription",
        t.name as "termName",
        ay.name as "academicYearName"
      FROM "Batch" b
      JOIN "Course" c ON c.id = b."courseId"
      LEFT JOIN "AcademicTerm" t ON t.id = b."termId"
      LEFT JOIN "AcademicYear" ay ON ay.id = b."academicYearId"
      WHERE b.id = $1 AND b."instituteId" = $2`,
      [batchId, instituteId]
    );

    if (batchRows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Batch not found' },
        { status: 404 }
      );
    }

    const batch = batchRows[0];

    // 3. Parallel queries for batch data: faculty, students, live sessions, assignments, exams, attendance
    const [facultyRows, studentRows, attendanceStatsRows, liveSessionRows, assignmentRows, examRows] = await Promise.all([
      // Other faculty assigned to batch
      queryDb<any>(
        `SELECT 
          tp.id as "teacherProfileId",
          u."fullName",
          u.email,
          tp."employeeCode",
          tp."photoUrl",
          bt.role
        FROM "BatchTeacher" bt
        JOIN "TeacherProfile" tp ON tp.id = bt."teacherProfileId"
        JOIN "Membership" m ON m.id = tp."membershipId"
        JOIN "User" u ON u.id = m."userId"
        WHERE bt."batchId" = $1 AND bt."instituteId" = $2
        ORDER BY bt.role ASC, u."fullName" ASC`,
        [batchId, instituteId]
      ),

      // Enrolled students with attendance aggregations
      queryDb<any>(
        `SELECT 
          sp.id as "studentProfileId",
          e.id as "enrolmentId",
          sp."admissionNo",
          sp."photoUrl",
          u."fullName",
          u.email,
          u."phoneE164" as phone,
          e.status as "enrolmentStatus",
          e."progressPct",
          e."createdAt" as "enrolledAt",
          COALESCE(att.present_count, 0) as "presentSessions",
          COALESCE(att.total_count, 0) as "totalMarkedSessions"
        FROM "Enrolment" e
        JOIN "StudentProfile" sp ON sp.id = e."studentProfileId"
        JOIN "Membership" m ON m.id = sp."membershipId"
        JOIN "User" u ON u.id = m."userId"
        LEFT JOIN (
          SELECT 
            a."studentProfileId",
            COUNT(CASE WHEN a.status = 'PRESENT' THEN 1 END)::int as present_count,
            COUNT(*)::int as total_count
          FROM "Attendance" a
          WHERE a."batchId" = $1 AND a."instituteId" = $2
          GROUP BY a."studentProfileId"
        ) att ON att."studentProfileId" = sp.id
        WHERE e."batchId" = $1 AND e."instituteId" = $2
        ORDER BY u."fullName" ASC`,
        [batchId, instituteId]
      ),

      // Attendance summary for batch
      queryDb<{ total_sessions: number; avg_attendance_pct: number }>(
        `SELECT 
          COUNT(DISTINCT a.date)::int as total_sessions,
          CASE 
            WHEN COUNT(*) > 0 THEN ROUND((COUNT(CASE WHEN a.status = 'PRESENT' THEN 1 END)::numeric / COUNT(*)::numeric) * 100)::int
            ELSE 0
          END as avg_attendance_pct
        FROM "Attendance" a
        WHERE a."batchId" = $1 AND a."instituteId" = $2`,
        [batchId, instituteId]
      ),

      // Upcoming & recent live sessions
      queryDb<any>(
        `SELECT 
          ls.id,
          ls.title,
          ls.description,
          ls.room,
          ls."startsAt",
          ls."endsAt",
          ls.status,
          ls."joinUrl",
          u."fullName" as "instructorName"
        FROM "LiveSession" ls
        LEFT JOIN "TeacherProfile" tp ON tp.id = ls."teacherProfileId"
        LEFT JOIN "Membership" m ON m.id = tp."membershipId"
        LEFT JOIN "User" u ON u.id = m."userId"
        WHERE ls."batchId" = $1 AND ls."instituteId" = $2
        ORDER BY ls."startsAt" DESC
        LIMIT 10`,
        [batchId, instituteId]
      ),

      // Assignments for batch / course
      queryDb<any>(
        `SELECT 
          a.id,
          a.title,
          a."dueAt" as "dueDate",
          a."maxMarks" as "totalMarks",
          a.status,
          a."batchId",
          COALESCE((SELECT COUNT(*)::int FROM "Submission" sub WHERE sub."assignmentId" = a.id), 0) as "submissionsCount"
        FROM "Assignment" a
        WHERE (a."batchId" = $1 OR (a."batchId" IS NULL AND a."courseId" = $2)) AND a."instituteId" = $3
        ORDER BY a."dueAt" ASC NULLS LAST`,
        [batchId, batch.courseId, instituteId]
      ),

      // Exams for batch / course
      queryDb<any>(
        `SELECT 
          ex.id,
          ex.title,
          ex."durationMin" as duration,
          ex."totalMarks",
          ex."passMarks",
          ex.type,
          'ACTIVE' as status,
          COALESCE((SELECT COUNT(*)::int FROM "ExamAttempt" ea WHERE ea."examId" = ex.id), 0) as "attemptsCount"
        FROM "Exam" ex
        WHERE ex."courseId" = $1 AND ex."instituteId" = $2
        ORDER BY ex."createdAt" DESC`,
        [batch.courseId, instituteId]
      ),
    ]);

    const attStat = attendanceStatsRows[0] || { total_sessions: 0, avg_attendance_pct: 0 };

    return NextResponse.json({
      success: true,
      data: {
        batch: {
          id: batch.id,
          name: batch.name,
          code: batch.code,
          status: batch.status,
          startDate: batch.startDate,
          endDate: batch.endDate,
          capacity: batch.capacity,
          termName: batch.termName,
          academicYearName: batch.academicYearName,
          assignedRole,
          course: {
            id: batch.courseId,
            title: batch.courseTitle,
            slug: batch.courseSlug,
            code: batch.courseCode,
            level: batch.courseLevel,
            description: batch.courseDescription,
          },
        },
        faculty: facultyRows.map((f) => ({
          teacherProfileId: f.teacherProfileId,
          fullName: f.fullName,
          email: f.email,
          employeeCode: f.employeeCode,
          photoUrl: f.photoUrl,
          role: f.role,
        })),
        students: studentRows.map((s) => {
          const total = Number(s.totalMarkedSessions) || 0;
          const present = Number(s.presentSessions) || 0;
          const rate = total > 0 ? Math.round((present / total) * 100) : null;
          return {
            id: s.studentProfileId,
            enrolmentId: s.enrolmentId,
            fullName: s.fullName,
            email: s.email,
            phone: s.phone,
            admissionNo: s.admissionNo,
            photoUrl: s.photoUrl,
            status: s.enrolmentStatus,
            progressPct: s.progressPct || 0,
            enrolledAt: s.enrolledAt,
            attendance: {
              present,
              total,
              ratePct: rate,
            },
          };
        }),
        stats: {
          totalEnrolled: studentRows.length,
          activeEnrolled: studentRows.filter((s) => s.enrolmentStatus === 'ACTIVE').length,
          totalFaculty: facultyRows.length,
          totalAttendanceSessions: Number(attStat.total_sessions) || 0,
          averageAttendancePct: Number(attStat.avg_attendance_pct) || 0,
          totalAssignments: assignmentRows.length,
          totalExams: examRows.length,
        },
        liveSessions: liveSessionRows,
        assignments: assignmentRows,
        exams: examRows,
      },
    });
  } catch (err: any) {
    if (err instanceof TeacherAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error('Error fetching teacher batch detail:', err);
    return NextResponse.json(
      { error: 'Failed to fetch batch details' },
      { status: 500 }
    );
  }
}
