import { NextRequest, NextResponse } from 'next/server';
import { resolveAuthenticatedTeacher, TeacherAuthError } from '@/lib/server-teacher';
import { queryDb } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await context.params;
    const teacher = await resolveAuthenticatedTeacher(request);
    const { teacherProfileId, instituteId } = teacher;

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

    // Authorization: teacher owns session or is assigned to batch
    if (session.teacherProfileId !== teacherProfileId) {
      const authCheck = await queryDb(
        `SELECT 1 FROM "BatchTeacher" bt
         WHERE bt."batchId" = $1 AND bt."teacherProfileId" = $2 AND bt."instituteId" = $3`,
        [session.batchId, teacherProfileId, instituteId]
      );
      if (authCheck.length === 0) {
        return NextResponse.json(
          { success: false, message: 'You are not authorized to cancel this session' },
          { status: 403 }
        );
      }
    }

    if (session.status === 'COMPLETED') {
      return NextResponse.json(
        { success: false, message: 'Cannot cancel an already completed live session' },
        { status: 400 }
      );
    }

    let reason = 'Cancelled by teacher';
    try {
      const body = await request.json();
      if (body?.reason) reason = body.reason.trim();
    } catch {
      // Body is optional
    }

    const updatedRows = await queryDb<any>(
      `UPDATE "LiveSession"
       SET status = 'CANCELLED',
           description = CASE
             WHEN description IS NULL THEN $1
             ELSE description || E'\n\n[Cancellation Note: ' || $1 || ']'
           END,
           "updatedAt" = NOW()
       WHERE id = $2 AND "instituteId" = $3
       RETURNING *`,
      [reason, sessionId, instituteId]
    );

    const cancelledSession = updatedRows[0];

    // Audit Log
    try {
      await queryDb(
        `INSERT INTO "AuditLog" (
           id, "instituteId", "actorUserId", action, "entityType", "entityId", metadata, "createdAt"
         ) VALUES (
           gen_random_uuid(), $1, $2, 'CANCEL', 'LiveSession', $3, $4::jsonb, NOW()
         )`,
        [
          instituteId,
          teacher.userId,
          sessionId,
          JSON.stringify({
            title: cancelledSession.title,
            reason,
            cancelledAt: new Date().toISOString(),
          }),
        ]
      );
    } catch (auditErr: any) {
      console.warn('LiveSession cancel audit warning:', auditErr?.message);
    }

    return NextResponse.json({
      success: true,
      message: 'Live class session cancelled successfully',
      data: cancelledSession,
    });
  } catch (error: any) {
    if (error instanceof TeacherAuthError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.statusCode });
    }
    console.error('Teacher Live Class Cancel POST Error:', error);
    return NextResponse.json(
      { success: false, message: 'Internal server error cancelling live class' },
      { status: 500 }
    );
  }
}
