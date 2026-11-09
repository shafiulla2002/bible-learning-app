import { NextRequest, NextResponse } from 'next/server';
import { resolveAuthenticatedTeacher, TeacherAuthError } from '@/lib/server-teacher';
import { queryDb } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const teacher = await resolveAuthenticatedTeacher(request);
    const { teacherProfileId, instituteId } = teacher;

    const { searchParams } = new URL(request.url);
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const courseIdParam = searchParams.get('courseId') || 'ALL';
    const batchIdParam = searchParams.get('batchId') || 'ALL';

    // Default to current week (Monday to Sunday) if not provided
    const now = new Date();
    let start: Date;
    let end: Date;

    if (startDateParam && endDateParam) {
      start = new Date(startDateParam);
      end = new Date(endDateParam);
    } else {
      const day = now.getDay();
      const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1);
      start = new Date(now.setDate(diffToMonday));
      start.setHours(0, 0, 0, 0);

      end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    }

    // 1. Fetch assigned courses and batches for filter dropdowns
    const [assignedCourses, assignedBatches] = await Promise.all([
      queryDb<{ id: string; title: string; code: string | null }>(
        `SELECT DISTINCT c.id, c.title, c.slug as code
         FROM "Course" c
         WHERE c.id IN (
           SELECT ci."courseId" FROM "CourseInstructor" ci
           WHERE ci."teacherProfileId" = $1 AND ci."instituteId" = $2
           UNION ALL
           SELECT b."courseId" FROM "BatchTeacher" bt
           JOIN "Batch" b ON b.id = bt."batchId"
           WHERE bt."teacherProfileId" = $1 AND bt."instituteId" = $2
         )
         ORDER BY c.title ASC`,
        [teacherProfileId, instituteId]
      ),
      queryDb<{ id: string; name: string; courseId: string; courseTitle: string }>(
        `SELECT b.id, b.name, b."courseId", c.title as "courseTitle"
         FROM "Batch" b
         JOIN "Course" c ON c.id = b."courseId"
         WHERE b."instituteId" = $2
           AND (
             b.id IN (
               SELECT bt."batchId" FROM "BatchTeacher" bt
               WHERE bt."teacherProfileId" = $1 AND bt."instituteId" = $2
             )
             OR b."courseId" IN (
               SELECT ci."courseId" FROM "CourseInstructor" ci
               WHERE ci."teacherProfileId" = $1 AND ci."instituteId" = $2
             )
           )
         ORDER BY b.name ASC`,
        [teacherProfileId, instituteId]
      ),
    ]);

    const assignedBatchIds = assignedBatches.map((b) => b.id);

    if (assignedBatchIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          events: [],
          range: {
            startDate: start.toISOString(),
            endDate: end.toISOString(),
          },
          summary: {
            totalEvents: 0,
            upcoming: 0,
            live: 0,
            completed: 0,
          },
          filters: {
            courses: assignedCourses,
            batches: assignedBatches,
          },
        },
      });
    }

    // Build conditions
    const conditions: string[] = [
      `ls."instituteId" = $1`,
      `(ls."teacherProfileId" = $2 OR ls."batchId" = ANY($3::text[]))`,
      `ls."startsAt" <= $5`,
      `ls."endsAt" >= $4`,
    ];
    const params: any[] = [instituteId, teacherProfileId, assignedBatchIds, start.toISOString(), end.toISOString()];
    let paramIndex = 6;

    if (courseIdParam !== 'ALL') {
      conditions.push(`b."courseId" = $${paramIndex}`);
      params.push(courseIdParam);
      paramIndex++;
    }

    if (batchIdParam !== 'ALL') {
      conditions.push(`ls."batchId" = $${paramIndex}`);
      params.push(batchIdParam);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    const sessions = await queryDb<any>(
      `SELECT
         ls.id,
         ls.title,
         ls.description,
         ls.room,
         ls."startsAt",
         ls."endsAt",
         ls."isRecurring",
         ls."recurrenceRule",
         ls."joinUrl",
         ls."recordingUrl",
         ls.status,
         b.id as "batchId",
         b.name as "batchName",
         c.id as "courseId",
         c.title as "courseTitle",
         c.slug as "courseCode",
         (SELECT COUNT(*)::int FROM "Attendance" a WHERE a."liveSessionId" = ls.id) as "attendanceCount",
         (SELECT COUNT(*)::int FROM "Enrolment" e WHERE e."batchId" = b.id AND e.status = 'ACTIVE') as "enrolledCount"
       FROM "LiveSession" ls
       JOIN "Batch" b ON b.id = ls."batchId"
       JOIN "Course" c ON c.id = b."courseId"
       WHERE ${whereClause}
       ORDER BY ls."startsAt" ASC`,
      params
    );

    const currentTime = new Date();
    let upcomingCount = 0;
    let liveCount = 0;
    let completedCount = 0;

    const formattedEvents = sessions.map((s) => {
      const sStart = new Date(s.startsAt);
      const sEnd = new Date(s.endsAt);

      let computedStatus = s.status;
      if (s.status !== 'CANCELLED') {
        if (s.status === 'LIVE' || (sStart <= currentTime && sEnd >= currentTime)) {
          computedStatus = 'LIVE';
          liveCount++;
        } else if (sStart > currentTime) {
          computedStatus = 'SCHEDULED';
          upcomingCount++;
        } else {
          computedStatus = 'COMPLETED';
          completedCount++;
        }
      }

      return {
        id: s.id,
        title: s.title,
        description: s.description,
        room: s.room || 'Google Meet',
        startsAt: s.startsAt,
        endsAt: s.endsAt,
        durationMinutes: Math.round((sEnd.getTime() - sStart.getTime()) / 60000),
        status: computedStatus,
        joinUrl: s.joinUrl,
        recordingUrl: s.recordingUrl,
        batchId: s.batchId,
        batchName: s.batchName,
        courseId: s.courseId,
        courseTitle: s.courseTitle,
        courseCode: s.courseCode,
        attendanceCount: s.attendanceCount,
        enrolledCount: s.enrolledCount,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        events: formattedEvents,
        range: {
          startDate: start.toISOString(),
          endDate: end.toISOString(),
        },
        summary: {
          totalEvents: formattedEvents.length,
          upcoming: upcomingCount,
          live: liveCount,
          completed: completedCount,
        },
        filters: {
          courses: assignedCourses,
          batches: assignedBatches,
        },
      },
    });
  } catch (error: any) {
    if (error instanceof TeacherAuthError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.statusCode });
    }
    console.error('Teacher Timetable GET Error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error fetching teacher timetable' },
      { status: 500 }
    );
  }
}
