import { NextRequest, NextResponse } from 'next/server';
import { resolveAuthenticatedTeacher, TeacherAuthError } from '@/lib/server-teacher';
import { queryDb } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const teacher = await resolveAuthenticatedTeacher(request);
    const { teacherProfileId, instituteId } = teacher;

    const { searchParams } = new URL(request.url);
    const courseIdParam = searchParams.get('courseId') || 'ALL';
    const batchIdParam = searchParams.get('batchId') || 'ALL';
    const statusParam = searchParams.get('status') || 'ALL';
    const search = searchParams.get('search')?.trim() || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
    const offset = (page - 1) * limit;

    // 1. Fetch authorized course IDs and batch IDs for teacher
    const [assignedCourses, assignedBatches] = await Promise.all([
      queryDb<{ id: string; title: string; code: string | null }>(
        `SELECT DISTINCT c.id, c.title, c.slug as code
         FROM "Course" c
         WHERE c.id IN (
           SELECT ci."courseId"
           FROM "CourseInstructor" ci
           WHERE ci."teacherProfileId" = $1 AND ci."instituteId" = $2
           UNION ALL
           SELECT b."courseId"
           FROM "BatchTeacher" bt
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
        data: [],
        metrics: {
          totalScheduled: 0,
          classesToday: 0,
          upcomingClasses: 0,
          ongoingClasses: 0,
          completedClasses: 0,
          cancelledClasses: 0,
          totalAssignedBatches: 0,
        },
        meta: {
          total: 0,
          page,
          limit,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
        filters: {
          courses: assignedCourses,
          batches: assignedBatches,
        },
      });
    }

    // 2. Metrics across all sessions assigned to teacher
    const allTeacherSessions = await queryDb<{
      id: string;
      startsAt: string;
      endsAt: string;
      status: string;
    }>(
      `SELECT ls.id, ls."startsAt", ls."endsAt", ls.status
       FROM "LiveSession" ls
       WHERE ls."instituteId" = $1
         AND (ls."teacherProfileId" = $2 OR ls."batchId" = ANY($3::text[]))`,
      [instituteId, teacherProfileId, assignedBatchIds]
    );

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    let totalScheduled = 0;
    let classesToday = 0;
    let upcomingClasses = 0;
    let ongoingClasses = 0;
    let completedClasses = 0;
    let cancelledClasses = 0;

    for (const s of allTeacherSessions) {
      const start = new Date(s.startsAt);
      const end = new Date(s.endsAt);

      if (s.status === 'CANCELLED') {
        cancelledClasses++;
      } else if (s.status === 'COMPLETED' || end < now) {
        completedClasses++;
      } else if (s.status === 'LIVE' || (start <= now && end >= now)) {
        ongoingClasses++;
        totalScheduled++;
      } else if (start > now) {
        upcomingClasses++;
        totalScheduled++;
      }

      if (s.status !== 'CANCELLED' && start >= todayStart && start <= todayEnd) {
        classesToday++;
      }
    }

    // 3. Build dynamic query for paginated list
    const conditions: string[] = [
      `ls."instituteId" = $1`,
      `(ls."teacherProfileId" = $2 OR ls."batchId" = ANY($3::text[]))`,
    ];
    const params: any[] = [instituteId, teacherProfileId, assignedBatchIds];
    let paramIndex = 4;

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

    if (statusParam !== 'ALL') {
      if (statusParam === 'UPCOMING') {
        conditions.push(`ls.status = 'SCHEDULED' AND ls."startsAt" > NOW()`);
      } else if (statusParam === 'LIVE' || statusParam === 'ONGOING') {
        conditions.push(`(ls.status = 'LIVE' OR (ls."startsAt" <= NOW() AND ls."endsAt" >= NOW() AND ls.status != 'CANCELLED'))`);
      } else if (statusParam === 'COMPLETED') {
        conditions.push(`(ls.status = 'COMPLETED' OR (ls."endsAt" < NOW() AND ls.status != 'CANCELLED'))`);
      } else if (statusParam === 'CANCELLED') {
        conditions.push(`ls.status = 'CANCELLED'`);
      } else {
        conditions.push(`ls.status = $${paramIndex}`);
        params.push(statusParam);
        paramIndex++;
      }
    }

    if (search) {
      conditions.push(`(
        ls.title ILIKE $${paramIndex}
        OR ls.description ILIKE $${paramIndex}
        OR b.name ILIKE $${paramIndex}
        OR c.title ILIKE $${paramIndex}
        OR ls.room ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Total count for current filter
    const countResult = await queryDb<{ count: string }>(
      `SELECT COUNT(*)::text as count
       FROM "LiveSession" ls
       JOIN "Batch" b ON b.id = ls."batchId"
       JOIN "Course" c ON c.id = b."courseId"
       WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult[0]?.count || '0', 10);
    const totalPages = Math.ceil(total / limit);

    // Fetch paginated sessions
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
         ls."createdAt",
         ls."updatedAt",
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
       ORDER BY ls."startsAt" DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return NextResponse.json({
      success: true,
      data: sessions,
      metrics: {
        totalScheduled,
        classesToday,
        upcomingClasses,
        ongoingClasses,
        completedClasses,
        cancelledClasses,
        totalAssignedBatches: assignedBatches.length,
      },
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      filters: {
        courses: assignedCourses,
        batches: assignedBatches,
      },
    });
  } catch (error: any) {
    if (error instanceof TeacherAuthError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.statusCode });
    }
    console.error('Teacher Live Classes GET Error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error fetching live classes' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const teacher = await resolveAuthenticatedTeacher(request);
    const { teacherProfileId, instituteId } = teacher;

    const body = await request.json();
    const {
      title,
      description,
      courseId,
      batchId,
      startsAt,
      endsAt,
      joinUrl,
      room,
      isRecurring,
      recurrenceRule,
    } = body;

    // 1. Validation
    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json(
        { success: false, message: 'Class title is required' },
        { status: 400 }
      );
    }

    if (!batchId) {
      return NextResponse.json(
        { success: false, message: 'Batch is required' },
        { status: 400 }
      );
    }

    if (!startsAt || !endsAt) {
      return NextResponse.json(
        { success: false, message: 'Start time and end time are required' },
        { status: 400 }
      );
    }

    const startDate = new Date(startsAt);
    const endDate = new Date(endsAt);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { success: false, message: 'Invalid start or end date format' },
        { status: 400 }
      );
    }

    if (startDate >= endDate) {
      return NextResponse.json(
        { success: false, message: 'Class end time must be after start time' },
        { status: 400 }
      );
    }

    if (joinUrl && typeof joinUrl === 'string' && joinUrl.trim()) {
      const trimmedUrl = joinUrl.trim();
      if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
        return NextResponse.json(
          { success: false, message: 'Meeting URL must begin with http:// or https://' },
          { status: 400 }
        );
      }
    }

    // 2. Authorisation check: batch belongs to teacher's institute and assigned to teacher
    const batchCheck = await queryDb<{ id: string; courseId: string; name: string }>(
      `SELECT b.id, b."courseId", b.name
       FROM "Batch" b
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
         )`,
      [batchId, instituteId, teacherProfileId]
    );

    if (batchCheck.length === 0) {
      return NextResponse.json(
        { success: false, message: 'You are not assigned to instruct this batch' },
        { status: 403 }
      );
    }

    // 3. Conflict Detection
    // Check if the teacher has any overlapping active/scheduled sessions
    const conflicts = await queryDb<{ id: string; title: string; startsAt: string; endsAt: string }>(
      `SELECT ls.id, ls.title, ls."startsAt", ls."endsAt"
       FROM "LiveSession" ls
       WHERE ls."instituteId" = $1
         AND ls."teacherProfileId" = $2
         AND ls.status != 'CANCELLED'
         AND ls."startsAt" < $4
         AND ls."endsAt" > $3
       LIMIT 1`,
      [instituteId, teacherProfileId, startDate.toISOString(), endDate.toISOString()]
    );

    if (conflicts.length > 0) {
      const conflict = conflicts[0];
      return NextResponse.json(
        {
          success: false,
          message: `Schedule conflict: You already have a session "${conflict.title}" scheduled from ${new Date(conflict.startsAt).toLocaleTimeString()} to ${new Date(conflict.endsAt).toLocaleTimeString()}`,
          conflict,
        },
        { status: 409 }
      );
    }

    // 4. Create LiveSession
    const newSessionResult = await queryDb<any>(
      `INSERT INTO "LiveSession" (
         id,
         "instituteId",
         "batchId",
         "teacherProfileId",
         title,
         description,
         room,
         "startsAt",
         "endsAt",
         "isRecurring",
         "recurrenceRule",
         "joinUrl",
         status,
         "createdAt",
         "updatedAt"
       ) VALUES (
         gen_random_uuid(),
         $1,
         $2,
         $3,
         $4,
         $5,
         $6,
         $7,
         $8,
         $9,
         $10,
         $11,
         'SCHEDULED',
         NOW(),
         NOW()
       ) RETURNING *`,
      [
        instituteId,
        batchId,
        teacherProfileId,
        title.trim(),
        description?.trim() || null,
        room?.trim() || 'Google Meet',
        startDate.toISOString(),
        endDate.toISOString(),
        !!isRecurring,
        recurrenceRule || null,
        joinUrl?.trim() || null,
      ]
    );

    const newSession = newSessionResult[0];

    // 5. Audit Log
    try {
      await queryDb(
        `INSERT INTO "AuditLog" (
           id, "instituteId", "actorUserId", action, "entityType", "entityId", metadata, "createdAt"
         ) VALUES (
           gen_random_uuid(), $1, $2, 'CREATE', 'LiveSession', $3, $4::jsonb, NOW()
         )`,
        [
          instituteId,
          teacher.userId,
          newSession.id,
          JSON.stringify({
            title: newSession.title,
            batchId,
            startsAt: newSession.startsAt,
            endsAt: newSession.endsAt,
          }),
        ]
      );
    } catch (auditErr: any) {
      console.warn('LiveSession create audit warning:', auditErr?.message);
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Live class scheduled successfully',
        data: newSession,
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error instanceof TeacherAuthError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.statusCode });
    }
    console.error('Teacher Live Class Create Error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error scheduling live class' },
      { status: 500 }
    );
  }
}
