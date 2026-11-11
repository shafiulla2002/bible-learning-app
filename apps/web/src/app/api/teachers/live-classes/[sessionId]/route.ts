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
         ls."teacherProfileId",
         b.id as "batchId",
         b.name as "batchName",
         c.id as "courseId",
         c.title as "courseTitle",
         c.slug as "courseCode",
         u."fullName" as "teacherName",
         (SELECT COUNT(*)::int FROM "Attendance" a WHERE a."liveSessionId" = ls.id) as "attendanceCount",
         (SELECT COUNT(*)::int FROM "Enrolment" e WHERE e."batchId" = b.id AND e.status = 'ACTIVE') as "enrolledCount"
       FROM "LiveSession" ls
       JOIN "Batch" b ON b.id = ls."batchId"
       JOIN "Course" c ON c.id = b."courseId"
       LEFT JOIN "TeacherProfile" tp ON tp.id = ls."teacherProfileId"
       LEFT JOIN "Membership" m ON m.id = tp."membershipId"
       LEFT JOIN "User" u ON u.id = m."userId"
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

    // Check teacher permission for this session's batch or instructor assignment
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
        { success: false, message: 'You are not authorized to view this live class session' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: session,
    });
  } catch (error: any) {
    if (error instanceof TeacherAuthError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.statusCode });
    }
    console.error('Teacher Live Class Detail GET Error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error fetching session details' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await context.params;
    const teacher = await resolveAuthenticatedTeacher(request);
    const { teacherProfileId, instituteId } = teacher;

    const existingRows = await queryDb<any>(
      `SELECT ls.*, b."courseId"
       FROM "LiveSession" ls
       JOIN "Batch" b ON b.id = ls."batchId"
       WHERE ls.id = $1 AND ls."instituteId" = $2`,
      [sessionId, instituteId]
    );

    if (existingRows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Live class session not found' },
        { status: 404 }
      );
    }

    const existing = existingRows[0];

    // Check authorization
    if (existing.teacherProfileId !== teacherProfileId) {
      const authCheck = await queryDb(
        `SELECT 1 FROM "BatchTeacher" bt
         WHERE bt."batchId" = $1 AND bt."teacherProfileId" = $2 AND bt."instituteId" = $3`,
        [existing.batchId, teacherProfileId, instituteId]
      );
      if (authCheck.length === 0) {
        return NextResponse.json(
          { success: false, message: 'You are not authorized to modify this session' },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    const {
      title,
      description,
      room,
      startsAt,
      endsAt,
      joinUrl,
      recordingUrl,
      status,
    } = body;

    const isRecordingOnlyUpdate =
      recordingUrl !== undefined &&
      title === undefined &&
      description === undefined &&
      room === undefined &&
      startsAt === undefined &&
      endsAt === undefined &&
      joinUrl === undefined &&
      status === undefined;

    if (existing.status === 'COMPLETED' && !isRecordingOnlyUpdate) {
      return NextResponse.json(
        { success: false, message: 'Cannot modify a completed live class session' },
        { status: 400 }
      );
    }

    const updatedTitle = title !== undefined ? title.trim() : existing.title;
    if (!updatedTitle) {
      return NextResponse.json(
        { success: false, message: 'Class title cannot be empty' },
        { status: 400 }
      );
    }

    const updatedStartsAt = startsAt ? new Date(startsAt) : new Date(existing.startsAt);
    const updatedEndsAt = endsAt ? new Date(endsAt) : new Date(existing.endsAt);

    if (isNaN(updatedStartsAt.getTime()) || isNaN(updatedEndsAt.getTime())) {
      return NextResponse.json(
        { success: false, message: 'Invalid start or end date format' },
        { status: 400 }
      );
    }

    if (updatedStartsAt >= updatedEndsAt) {
      return NextResponse.json(
        { success: false, message: 'End time must be after start time' },
        { status: 400 }
      );
    }

    const updatedJoinUrl = joinUrl !== undefined ? joinUrl?.trim() || null : existing.joinUrl;
    if (updatedJoinUrl && !updatedJoinUrl.startsWith('http://') && !updatedJoinUrl.startsWith('https://')) {
      return NextResponse.json(
        { success: false, message: 'Meeting URL must begin with http:// or https://' },
        { status: 400 }
      );
    }

    // Check conflict excluding this session
    const conflicts = await queryDb<{ id: string; title: string; startsAt: string; endsAt: string }>(
      `SELECT ls.id, ls.title, ls."startsAt", ls."endsAt"
       FROM "LiveSession" ls
       WHERE ls."instituteId" = $1
         AND ls."teacherProfileId" = $2
         AND ls.id != $3
         AND ls.status != 'CANCELLED'
         AND ls."startsAt" < $5
         AND ls."endsAt" > $4
       LIMIT 1`,
      [instituteId, teacherProfileId, sessionId, updatedStartsAt.toISOString(), updatedEndsAt.toISOString()]
    );

    if (conflicts.length > 0) {
      const conflict = conflicts[0];
      return NextResponse.json(
        {
          success: false,
          message: `Schedule conflict: Overlaps with existing session "${conflict.title}"`,
          conflict,
        },
        { status: 409 }
      );
    }

    const updatedStatus = status || existing.status;

    const updatedRows = await queryDb<any>(
      `UPDATE "LiveSession"
       SET title = $1,
           description = $2,
           room = $3,
           "startsAt" = $4,
           "endsAt" = $5,
           "joinUrl" = $6,
           "recordingUrl" = $7,
           status = $8,
           "updatedAt" = NOW()
       WHERE id = $9 AND "instituteId" = $10
       RETURNING *`,
      [
        updatedTitle,
        description !== undefined ? description?.trim() || null : existing.description,
        room !== undefined ? room?.trim() || null : existing.room,
        updatedStartsAt.toISOString(),
        updatedEndsAt.toISOString(),
        updatedJoinUrl,
        recordingUrl !== undefined ? recordingUrl?.trim() || null : existing.recordingUrl,
        updatedStatus,
        sessionId,
        instituteId,
      ]
    );

    const updatedSession = updatedRows[0];

    // Audit Log
    try {
      await queryDb(
        `INSERT INTO "AuditLog" (
           id, "instituteId", "actorUserId", action, "entityType", "entityId", metadata, "createdAt"
         ) VALUES (
           gen_random_uuid(), $1, $2, 'UPDATE', 'LiveSession', $3, $4::jsonb, NOW()
         )`,
        [
          instituteId,
          teacher.userId,
          sessionId,
          JSON.stringify({
            title: updatedSession.title,
            startsAt: updatedSession.startsAt,
            endsAt: updatedSession.endsAt,
            status: updatedSession.status,
          }),
        ]
      );
    } catch (auditErr: any) {
      console.warn('LiveSession update audit warning:', auditErr?.message);
    }

    return NextResponse.json({
      success: true,
      message: 'Live class session updated successfully',
      data: updatedSession,
    });
  } catch (error: any) {
    if (error instanceof TeacherAuthError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.statusCode });
    }
    console.error('Teacher Live Class PUT Error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error updating live class' },
      { status: 500 }
    );
  }
}
