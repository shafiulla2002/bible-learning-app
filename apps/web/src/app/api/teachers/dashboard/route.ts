import { NextRequest, NextResponse } from 'next/server';
import { resolveAuthenticatedTeacher, TeacherAuthError } from '@/lib/server-teacher';
import { queryDb } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const teacher = await resolveAuthenticatedTeacher(request);
    const { teacherProfileId, instituteId } = teacher;

    // Phase 2.1 Optimized Execution:
    // Consolidates 11 individual query round-trips into 5 targeted, parallel, tenant-isolated queries.
    // Query 1 aggregates all metrics and attendance overview in a single CTE scan.
    const [
      statsAndAttendanceRes,
      todayScheduleRes,
      assignedBatchesRes,
      pendingAssignmentsRes,
      upcomingEventsRes,
    ] = await Promise.all([
      // 1. Consolidated Statistics & Attendance Overview (CTE Aggregation)
      queryDb(
        `WITH 
        batch_agg AS (
          SELECT COUNT(DISTINCT bt."batchId")::int as assigned_batches
          FROM "BatchTeacher" bt
          JOIN "Batch" b ON b.id = bt."batchId"
          WHERE bt."teacherProfileId" = $1 AND bt."instituteId" = $2 AND b.status = 'ACTIVE'
        ),
        student_agg AS (
          SELECT COUNT(DISTINCT e."studentProfileId")::int as assigned_students
          FROM "Enrolment" e
          JOIN "BatchTeacher" bt ON bt."batchId" = e."batchId"
          WHERE bt."teacherProfileId" = $1 AND e."instituteId" = $2 AND e.status = 'ACTIVE'
        ),
        course_agg AS (
          SELECT COUNT(DISTINCT ci."courseId")::int as instructing_courses
          FROM "CourseInstructor" ci
          JOIN "Course" c ON c.id = ci."courseId"
          WHERE ci."teacherProfileId" = $1 AND ci."instituteId" = $2 AND c.status = 'PUBLISHED'
        ),
        today_classes AS (
          SELECT COUNT(ls.id)::int as today_classes
          FROM "LiveSession" ls
          JOIN "Institute" i ON i.id = ls."instituteId"
          WHERE ls."teacherProfileId" = $1 AND ls."instituteId" = $2
            AND (ls."startsAt" AT TIME ZONE COALESCE(i.timezone, 'Asia/Kolkata'))::date = (NOW() AT TIME ZONE COALESCE(i.timezone, 'Asia/Kolkata'))::date
        ),
        pending_assign AS (
          SELECT COUNT(s.id)::int as pending_assignments
          FROM "Submission" s
          JOIN "Assignment" a ON a.id = s."assignmentId"
          WHERE s."instituteId" = $2 AND s.status = 'SUBMITTED'
            AND (
              a."batchId" IN (SELECT bt."batchId" FROM "BatchTeacher" bt WHERE bt."teacherProfileId" = $1 AND bt."instituteId" = $2)
              OR a."courseId" IN (SELECT ci."courseId" FROM "CourseInstructor" ci WHERE ci."teacherProfileId" = $1 AND ci."instituteId" = $2)
            )
        ),
        att_agg AS (
          SELECT 
            COUNT(*)::int as total_records,
            COUNT(CASE WHEN a.status = 'PRESENT' THEN 1 END)::int as present_count,
            COUNT(CASE WHEN a.status = 'ABSENT' THEN 1 END)::int as absent_count,
            COUNT(CASE WHEN a.status = 'LATE' THEN 1 END)::int as late_count,
            COUNT(CASE WHEN a.status = 'EXCUSED' THEN 1 END)::int as excused_count,
            COUNT(DISTINCT a.date)::int as total_sessions_marked,
            ROUND(
              CASE WHEN COUNT(*) > 0 
                THEN (COUNT(CASE WHEN a.status IN ('PRESENT', 'LATE') THEN 1 END)::numeric / COUNT(*)::numeric) * 100 
                ELSE 0 
              END, 1
            )::float as attendance_rate_pct
          FROM "Attendance" a
          WHERE a."instituteId" = $2
            AND a."batchId" IN (
              SELECT bt."batchId" 
              FROM "BatchTeacher" bt 
              WHERE bt."teacherProfileId" = $1 AND bt."instituteId" = $2
            )
        )
        SELECT 
          b.assigned_batches,
          s.assigned_students,
          c.instructing_courses,
          tc.today_classes,
          pa.pending_assignments,
          att.total_records,
          att.present_count,
          att.absent_count,
          att.late_count,
          att.excused_count,
          att.total_sessions_marked,
          att.attendance_rate_pct
        FROM batch_agg b
        CROSS JOIN student_agg s
        CROSS JOIN course_agg c
        CROSS JOIN today_classes tc
        CROSS JOIN pending_assign pa
        CROSS JOIN att_agg att`,
        [teacherProfileId, instituteId]
      ).catch(() => [{
        assigned_batches: 0,
        assigned_students: 0,
        instructing_courses: 0,
        today_classes: 0,
        pending_assignments: 0,
        total_records: 0,
        present_count: 0,
        absent_count: 0,
        late_count: 0,
        excused_count: 0,
        total_sessions_marked: 0,
        attendance_rate_pct: 0,
      }]),

      // 2. Today's Teaching Schedule (Institute-local date aware)
      queryDb(
        `SELECT ls.id, ls.title, ls."startsAt", ls."endsAt", ls.status::text as status, ls.room, ls."joinUrl",
                c.title as "courseTitle", b.name as "batchName", b.code as "batchCode"
         FROM "LiveSession" ls
         JOIN "Batch" b ON b.id = ls."batchId"
         JOIN "Course" c ON c.id = b."courseId"
         JOIN "Institute" i ON i.id = ls."instituteId"
         WHERE ls."teacherProfileId" = $1 AND ls."instituteId" = $2
           AND (ls."startsAt" AT TIME ZONE COALESCE(i.timezone, 'Asia/Kolkata'))::date = (NOW() AT TIME ZONE COALESCE(i.timezone, 'Asia/Kolkata'))::date
         ORDER BY ls."startsAt" ASC`,
        [teacherProfileId, instituteId]
      ).catch(() => []),

      // 3. Assigned Batches Preview (active cohorts)
      queryDb(
        `SELECT b.id, b.name, b.code, b.status, b."startDate", b."endDate", b.capacity,
                c.id as "courseId", c.title as "courseTitle", c.slug as "courseSlug", c.level as "courseLevel",
                bt.role as "teacherRole",
                ay.name as "academicYearName",
                at.name as "termName",
                (SELECT COUNT(DISTINCT e."studentProfileId")::int 
                 FROM "Enrolment" e 
                 WHERE e."batchId" = b.id AND e.status = 'ACTIVE') as "enrolledStudentsCount"
         FROM "BatchTeacher" bt
         JOIN "Batch" b ON b.id = bt."batchId"
         JOIN "Course" c ON c.id = b."courseId"
         LEFT JOIN "AcademicYear" ay ON ay.id = b."academicYearId"
         LEFT JOIN "AcademicTerm" at ON at.id = b."termId"
         WHERE bt."teacherProfileId" = $1 AND bt."instituteId" = $2 AND b.status = 'ACTIVE'
         ORDER BY b."createdAt" DESC
         LIMIT 6`,
        [teacherProfileId, instituteId]
      ).catch(() => []),

      // 4. Assignments Awaiting Grading Preview
      queryDb(
        `SELECT a.id, a.title, a."dueAt", a.status, a."maxMarks",
                c.id as "courseId", c.title as "courseTitle",
                b.id as "batchId", b.name as "batchName", b.code as "batchCode",
                COUNT(s.id)::int as "submissionCount",
                COUNT(CASE WHEN s.status = 'SUBMITTED' THEN 1 END)::int as "pendingReviewCount"
         FROM "Assignment" a
         JOIN "Course" c ON c.id = a."courseId"
         LEFT JOIN "Batch" b ON b.id = a."batchId"
         LEFT JOIN "Submission" s ON s."assignmentId" = a.id
         WHERE a."instituteId" = $2
           AND (
             a."batchId" IN (SELECT bt."batchId" FROM "BatchTeacher" bt WHERE bt."teacherProfileId" = $1 AND bt."instituteId" = $2)
             OR a."courseId" IN (SELECT ci."courseId" FROM "CourseInstructor" ci WHERE ci."teacherProfileId" = $1 AND ci."instituteId" = $2)
           )
         GROUP BY a.id, a.title, a."dueAt", a.status, a."maxMarks", c.id, c.title, b.id, b.name, b.code
         ORDER BY "pendingReviewCount" DESC, a."dueAt" ASC
         LIMIT 6`,
        [teacherProfileId, instituteId]
      ).catch(() => []),

      // 5. Consolidated Upcoming Events (Live Classes + Exams combined via UNION ALL)
      queryDb(
        `SELECT * FROM (
           SELECT ls.id, ls.title, ls."startsAt" as "eventDate", ls."endsAt" as "endDate", ls.status::text as status, ls.room, ls."joinUrl",
                  c.title as "courseTitle", b.name as "batchName",
                  'LIVE_CLASS' as "eventType", NULL::int as "durationMin"
           FROM "LiveSession" ls
           JOIN "Batch" b ON b.id = ls."batchId"
           JOIN "Course" c ON c.id = b."courseId"
           WHERE ls."teacherProfileId" = $1 AND ls."instituteId" = $2
           
           UNION ALL
           
           SELECT e.id, e.title, e."createdAt" as "eventDate", NULL::timestamptz as "endDate", e.type::text as status, NULL as room, NULL as "joinUrl",
                  c.title as "courseTitle", NULL as "batchName",
                  'EXAMINATION' as "eventType", e."durationMin"
           FROM "Exam" e
           JOIN "Course" c ON c.id = e."courseId"
           JOIN "CourseInstructor" ci ON ci."courseId" = c.id
           WHERE ci."teacherProfileId" = $1 AND ci."instituteId" = $2 AND e."instituteId" = $2
         ) upcoming
         ORDER BY "eventDate" DESC
         LIMIT 6`,
        [teacherProfileId, instituteId]
      ).catch(() => []),
    ]);

    const statsRow = statsAndAttendanceRes[0] || {
      assigned_batches: 0,
      assigned_students: 0,
      instructing_courses: 0,
      today_classes: 0,
      pending_assignments: 0,
      total_records: 0,
      present_count: 0,
      absent_count: 0,
      late_count: 0,
      excused_count: 0,
      total_sessions_marked: 0,
      attendance_rate_pct: 0,
    };

    // Format assigned batches
    const assignedBatches = assignedBatchesRes.map((b: any) => ({
      id: b.id,
      name: b.name,
      code: b.code,
      courseId: b.courseId,
      courseTitle: b.courseTitle,
      courseSlug: b.courseSlug,
      courseLevel: b.courseLevel,
      academicYear: b.academicYearName || null,
      term: b.termName || null,
      enrolledStudentsCount: Number(b.enrolledStudentsCount) || 0,
      teacherRole: b.teacherRole || 'LEAD',
      status: b.status,
    }));

    // Format pending assignments
    const pendingAssignments = pendingAssignmentsRes.map((a: any) => ({
      id: a.id,
      title: a.title,
      courseId: a.courseId,
      courseTitle: a.courseTitle,
      batchId: a.batchId,
      batchName: a.batchName,
      batchCode: a.batchCode,
      dueAt: a.dueAt,
      status: a.status,
      maxMarks: a.maxMarks,
      submissionCount: Number(a.submissionCount) || 0,
      pendingReviewCount: Number(a.pendingReviewCount) || 0,
    }));

    // Format upcoming events
    const upcomingEvents = upcomingEventsRes.map((evt: any) => ({
      id: evt.id,
      title: evt.title,
      eventType: evt.eventType as 'LIVE_CLASS' | 'EXAMINATION',
      courseTitle: evt.courseTitle,
      batchName: evt.batchName || null,
      eventDate: evt.eventDate,
      endDate: evt.endDate || null,
      status: evt.status,
      room: evt.room || null,
      joinUrl: evt.joinUrl || null,
      durationMin: evt.durationMin || null,
    }));

    // Format today's schedule
    const todaySchedule = todayScheduleRes.map((s: any) => ({
      id: s.id,
      title: s.title,
      courseTitle: s.courseTitle,
      batchName: s.batchName,
      batchCode: s.batchCode,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      status: s.status,
      room: s.room,
      joinUrl: s.joinUrl,
    }));

    return NextResponse.json({
      success: true,
      teacher: {
        teacherProfileId: teacher.teacherProfileId,
        userId: teacher.userId,
        fullName: teacher.fullName,
        email: teacher.email,
        phone: teacher.phone,
        employeeCode: teacher.employeeCode,
        qualifications: teacher.qualifications,
        specialization: teacher.specialization,
        experienceYears: teacher.experienceYears,
        photoUrl: teacher.photoUrl,
        status: teacher.status,
      },
      institute: {
        id: teacher.instituteId,
        name: teacher.instituteName,
        code: (teacher.instituteSlug || 'GBI').toUpperCase(),
        logoUrl: teacher.instituteLogoUrl,
        timezone: teacher.timezone || 'Asia/Kolkata',
      },
      statistics: {
        assignedBatchesCount: Number(statsRow.assigned_batches) || 0,
        assignedStudentsCount: Number(statsRow.assigned_students) || 0,
        instructingCoursesCount: Number(statsRow.instructing_courses) || 0,
        todayClassesCount: Number(statsRow.today_classes) || 0,
        pendingAssignmentsCount: Number(statsRow.pending_assignments) || 0,
        attendanceRatePct: Number(statsRow.attendance_rate_pct) || 0,
        totalAttendanceRecords: Number(statsRow.total_records) || 0,
      },
      todaySchedule,
      assignedBatches,
      pendingAssignments,
      upcomingEvents,
      attendanceSummary: {
        totalRecords: Number(statsRow.total_records) || 0,
        presentCount: Number(statsRow.present_count) || 0,
        absentCount: Number(statsRow.absent_count) || 0,
        lateCount: Number(statsRow.late_count) || 0,
        excusedCount: Number(statsRow.excused_count) || 0,
        totalSessionsMarked: Number(statsRow.total_sessions_marked) || 0,
        attendanceRatePct: Number(statsRow.attendance_rate_pct) || 0,
      },
    });
  } catch (err: any) {
    if (err instanceof TeacherAuthError) {
      return NextResponse.json(
        { success: false, message: err.message },
        { status: err.statusCode }
      );
    }
    console.error('Unhandled error in /api/teachers/dashboard:', err);
    return NextResponse.json(
      { success: false, message: 'Internal server error resolving teacher dashboard' },
      { status: 500 }
    );
  }
}
