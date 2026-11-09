import { NextRequest, NextResponse } from 'next/server';
import { resolveAuthenticatedTeacher, TeacherAuthError } from '@/lib/server-teacher';
import { queryDb } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ assignmentId: string; submissionId: string }> }
) {
  try {
    const { assignmentId, submissionId } = await context.params;
    const teacher = await resolveAuthenticatedTeacher(request);
    const { teacherProfileId, instituteId, userId } = teacher;

    const body = await request.json().catch(() => null);
    if (!body || body.marksAwarded === undefined) {
      return NextResponse.json(
        { success: false, error: 'marksAwarded is required' },
        { status: 400 }
      );
    }

    // 1. Fetch assignment and verify teacher authorization
    const assignmentRows = await queryDb<any>(
      `SELECT id, "courseId", "batchId", "maxMarks", title
       FROM "Assignment"
       WHERE id = $1 AND "instituteId" = $2 LIMIT 1`,
      [assignmentId, instituteId]
    );

    if (assignmentRows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Assignment not found' },
        { status: 404 }
      );
    }

    const assignment = assignmentRows[0];

    // Verify teacher authorization
    const assignmentCheck = await queryDb<{ role: string }>(
      `SELECT role FROM (
        SELECT ci.role, 1 as priority
        FROM "CourseInstructor" ci
        WHERE ci."courseId" = $1 AND ci."teacherProfileId" = $2 AND ci."instituteId" = $3
        UNION ALL
        SELECT bt.role, 2 as priority
        FROM "BatchTeacher" bt
        JOIN "Batch" b ON b.id = bt."batchId"
        WHERE (b.id = $4 OR b."courseId" = $1)
          AND bt."teacherProfileId" = $2
          AND bt."instituteId" = $3
      ) a ORDER BY priority ASC LIMIT 1`,
      [assignment.courseId, teacherProfileId, instituteId, assignment.batchId || assignment.courseId]
    );

    if (assignmentCheck.length === 0) {
      return NextResponse.json(
        { success: false, error: 'You are not authorized to grade submissions for this assignment.' },
        { status: 403 }
      );
    }

    // 2. Validate marks
    const marks = Number(body.marksAwarded);
    if (isNaN(marks) || marks < 0 || marks > assignment.maxMarks) {
      return NextResponse.json(
        { success: false, error: `Marks awarded must be an integer between 0 and ${assignment.maxMarks}` },
        { status: 400 }
      );
    }

    // 3. Fetch existing submission
    const submissionRows = await queryDb<any>(
      `SELECT s.id, s."marksAwarded", s.feedback, s."studentProfileId", u."fullName" as "studentName"
       FROM "Submission" s
       JOIN "StudentProfile" sp ON sp.id = s."studentProfileId"
       JOIN "Membership" m ON m.id = sp."membershipId"
       JOIN "User" u ON u.id = m."userId"
       WHERE s.id = $1 AND s."assignmentId" = $2 AND s."instituteId" = $3 LIMIT 1`,
      [submissionId, assignmentId, instituteId]
    );

    if (submissionRows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Submission not found for this assignment' },
        { status: 404 }
      );
    }

    const sub = submissionRows[0];
    const roundedMarks = Math.round(marks);
    const feedback = body.feedback !== undefined ? body.feedback.trim() : sub.feedback;

    const updateResult = await queryDb<any>(
      `UPDATE "Submission"
       SET "marksAwarded" = $1, feedback = $2, status = 'GRADED'
       WHERE id = $3 AND "assignmentId" = $4 AND "instituteId" = $5
       RETURNING id, "assignmentId", "studentProfileId", "marksAwarded", feedback, status`,
      [roundedMarks, feedback, submissionId, assignmentId, instituteId]
    );

    // Audit log entry
    await queryDb(
      `INSERT INTO "AuditLog" (id, "instituteId", "actorUserId", action, "entityType", "entityId", metadata, "createdAt")
       VALUES (gen_random_uuid(), $1, $2, 'GRADE_SUBMISSION', 'Submission', $3, $4, NOW())`,
      [
        instituteId,
        userId,
        submissionId,
        JSON.stringify({
          assignmentId,
          studentProfileId: sub.studentProfileId,
          studentName: sub.studentName,
          previousMarks: sub.marksAwarded,
          marksAwarded: roundedMarks,
          previousFeedback: sub.feedback,
          feedback,
          maxMarks: assignment.maxMarks,
        }),
      ]
    );

    const updated = updateResult[0];

    return NextResponse.json({
      success: true,
      message: 'Submission graded successfully',
      data: {
        id: updated.id,
        assignmentId: updated.assignmentId,
        studentProfileId: updated.studentProfileId,
        marksAwarded: updated.marksAwarded,
        maxMarks: assignment.maxMarks,
        feedback: updated.feedback,
        status: updated.status,
      },
    });
  } catch (err: any) {
    if (err instanceof TeacherAuthError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.statusCode }
      );
    }
    console.error('Teacher grade submission route error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error while grading submission' },
      { status: 500 }
    );
  }
}

