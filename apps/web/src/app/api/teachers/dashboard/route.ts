import { NextRequest, NextResponse } from 'next/server';
import { resolveAuthenticatedTeacher, TeacherAuthError } from '@/lib/server-teacher';
import { queryDb } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const teacher = await resolveAuthenticatedTeacher(request);
    const { teacherProfileId, instituteId } = teacher;

    // Execute parallel, tenant-isolated queries scoped strictly to teacherProfileId and instituteId
    const [
      batchesCountRes,
      studentsCountRes,
      coursesCountRes,
      todayClassesCountRes,
      pendingAssignCountRes,
      attendanceSummaryRes,
      todayScheduleRes,
      assignedBatchesRes,
      pendingAssignmentsRes,
      upcomingClassesRes,
      upcomingExamsRes,
    ] = await Promise.all([
      // 1. Active Assigned Batches Count
      queryDb(
        `SELECT COUNT(DISTINCT bt."batchId")::int as count
         FROM "BatchTeacher" bt
         JOIN "Batch" b ON b.id = bt."batchId"
         WHERE bt."teacherProfileId" = $1 AND bt."instituteId" = $2 AND b.status = 'ACTIVE'`,
        [teacherProfileId, instituteId]
      ).catch(() => [{ count: 0 }]),

      // 2. Unique Active Assigned Students Count
      queryDb(
        `SELECT COUNT(DISTINCT e."studentProfileId")::int as count
         FROM "Enrolment" e
         JOIN "BatchTeacher" bt ON bt."batchId" = e."batchId"
         WHERE bt."teacherProfileId" = $1 AND e."instituteId" = $2 AND e.status = 'ACTIVE'`,
        [teacherProfileId, instituteId]
      ).catch(() => [{ count: 0 }]),

      // 3. Instructing Published Courses Count
      queryDb(
        `SELECT COUNT(DISTINCT ci."courseId")::int as count
         FROM "CourseInstructor" ci
         JOIN "Course" c ON c.id = ci."courseId"
         WHERE ci."teacherProfileId" = $1 AND ci."instituteId" = $2 AND c.status = 'PUBLISHED'`,
        [teacherProfileId, instituteId]
      ).catch(() => [{ count: 0 }]),

      // 4. Today's Scheduled Classes Count (Institute-local date aware)
      queryDb(
        `SELECT COUNT(ls.id)::int as count
         FROM "LiveSession" ls
         JOIN "Institute" i ON i.id = ls."instituteId"
         WHERE ls."teacherProfileId" = $1 AND ls."instituteId" = $2
           AND (ls."startsAt" AT TIME ZONE COALESCE(i.timezone, 'Asia/Kolkata'))::date = (NOW() AT TIME ZONE COALESCE(i.timezone, 'Asia/Kolkata'))::date`,
        [teacherProfileId, instituteId]
      ).catch(() => [{ count: 0 }]),

      // 5. Pending Submissions Count awaiting grading
      queryDb(
        `SELECT COUNT(s.id)::int as count
         FROM "Submission" s
         JOIN "Assignment" a ON a.id = s."assignmentId"
         WHERE s."instituteId" = $2 AND s.status = 'SUBMITTED'
           AND (
             a."batchId" IN (SELECT bt."batchId" FROM "BatchTeacher" bt WHERE bt."teacherProfileId" = $1 AND bt."instituteId" = $2)
             OR a."courseId" IN (SELECT ci."courseId" FROM "CourseInstructor" ci WHERE ci."teacherProfileId" = $1 AND ci."instituteId" = $2)
           )`,
        [teacherProfileId, instituteId]
      ).catch(() => [{ count: 0 }]),

      // 6. Attendance Overview Summary for teacher's cohorts
      queryDb(
        `SELECT 
           COUNT(*)::int as "totalRecords",
           COUNT(CASE WHEN a.status = 'PRESENT' THEN 1 END)::int as "presentCount",
           COUNT(CASE WHEN a.status = 'ABSENT' THEN 1 END)::int as "absentCount",
           COUNT(CASE WHEN a.status = 'LATE' THEN 1 END)::int as "lateCount",
           COUNT(CASE WHEN a.status = 'EXCUSED' THEN 1 END)::int as "excusedCount",
           COUNT(DISTINCT a.date)::int as "totalSessionsMarked",
           ROUND(
             CASE WHEN COUNT(*) > 0 
               THEN (COUNT(CASE WHEN a.status IN ('PRESENT', 'LATE') THEN 1 END)::numeric / COUNT(*)::numeric) * 100 
               ELSE 0 
             END, 1
           )::float as "attendanceRatePct"
         FROM "Attendance" a
         WHERE a."instituteId" = $2
           AND a."batchId" IN (
             SELECT bt."batchId" 
             FROM "BatchTeacher" bt 
             WHERE bt."teacherProfileId" = $1 AND bt."instituteId" = $2
           )`,
        [teacherProfileId, instituteId]
      ).catch(() => [{
        totalRecords: 0,
        presentCount: 0,
        absentCount: 0,
        lateCount: 0,
        excusedCount: 0,
        totalSessionsMarked: 0,
        attendanceRatePct: 0,
      }]),

      // 7. Today's Teaching Schedule (Institute-local date aware)
      queryDb(
        `SELECT ls.id, ls.title, ls."startsAt", ls."endsAt", ls.status, ls.room, ls."joinUrl",
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

      // 8. Assigned Batches Preview (active cohorts)
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

      // 9. Assignments Awaiting Grading Preview
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

      // 10. Upcoming Live Classes
      queryDb(
        `SELECT ls.id, ls.title, ls."startsAt" as "eventDate", ls."endsAt", ls.status, ls.room, ls."joinUrl",
                c.title as "courseTitle", b.name as "batchName", b.code as "batchCode",
                'LIVE_CLASS' as "eventType"
         FROM "LiveSession" ls
         JOIN "Batch" b ON b.id = ls."batchId"
         JOIN "Course" c ON c.id = b."courseId"
         WHERE ls."teacherProfileId" = $1 AND ls."instituteId" = $2
         ORDER BY ls."startsAt" DESC
         LIMIT 5`,
        [teacherProfileId, instituteId]
      ).catch(() => []),

      // 11. Upcoming Examinations (Course-instructor relationship scoped)
      queryDb(
        `SELECT e.id, e.title, e."createdAt" as "eventDate", e.type as status, e."durationMin",
                c.title as "courseTitle", NULL as "batchName", NULL as "batchCode",
                'EXAMINATION' as "eventType"
         FROM "Exam" e
         JOIN "Course" c ON c.id = e."courseId"
         JOIN "CourseInstructor" ci ON ci."courseId" = c.id
         WHERE ci."teacherProfileId" = $1 AND ci."instituteId" = $2 AND e."instituteId" = $2
         LIMIT 5`,
        [teacherProfileId, instituteId]
      ).catch(() => []),
    ]);

    const attSummary = attendanceSummaryRes[0] || {
      totalRecords: 0,
      presentCount: 0,
      absentCount: 0,
      lateCount: 0,
      excusedCount: 0,
      totalSessionsMarked: 0,
      attendanceRatePct: 0,
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

    // Merge upcoming events (Live Classes & Exams)
    const upcomingEvents = [
      ...upcomingClassesRes.map((cls: any) => ({
        id: cls.id,
        title: cls.title,
        eventType: 'LIVE_CLASS' as const,
        courseTitle: cls.courseTitle,
        batchName: cls.batchName,
        eventDate: cls.eventDate,
        endDate: cls.endsAt || null,
        status: cls.status,
        room: cls.room || null,
        joinUrl: cls.joinUrl || null,
      })),
      ...upcomingExamsRes.map((ex: any) => ({
        id: ex.id,
        title: ex.title,
        eventType: 'EXAMINATION' as const,
        courseTitle: ex.courseTitle,
        batchName: null,
        eventDate: ex.eventDate,
        endDate: null,
        status: ex.status,
        room: null,
        joinUrl: null,
        durationMin: ex.durationMin || 30,
      })),
    ];

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
        timezone: 'Asia/Kolkata',
      },
      statistics: {
        assignedBatchesCount: Number(batchesCountRes[0]?.count) || 0,
        assignedStudentsCount: Number(studentsCountRes[0]?.count) || 0,
        instructingCoursesCount: Number(coursesCountRes[0]?.count) || 0,
        todayClassesCount: Number(todayClassesCountRes[0]?.count) || 0,
        pendingAssignmentsCount: Number(pendingAssignCountRes[0]?.count) || 0,
        attendanceRatePct: Number(attSummary.attendanceRatePct) || 0,
        totalAttendanceRecords: Number(attSummary.totalRecords) || 0,
      },
      todaySchedule,
      assignedBatches,
      pendingAssignments,
      upcomingEvents,
      attendanceSummary: {
        totalRecords: Number(attSummary.totalRecords) || 0,
        presentCount: Number(attSummary.presentCount) || 0,
        absentCount: Number(attSummary.absentCount) || 0,
        lateCount: Number(attSummary.lateCount) || 0,
        excusedCount: Number(attSummary.excusedCount) || 0,
        totalSessionsMarked: Number(attSummary.totalSessionsMarked) || 0,
        attendanceRatePct: Number(attSummary.attendanceRatePct) || 0,
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

