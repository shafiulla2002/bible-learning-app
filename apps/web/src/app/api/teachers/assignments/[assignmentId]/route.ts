import { NextRequest, NextResponse } from 'next/server';
import { resolveAuthenticatedTeacher, TeacherAuthError } from '@/lib/server-teacher';
import { queryDb } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ assignmentId: string }> }
) {
  try {
    const { assignmentId } = await context.params;
    const teacher = await resolveAuthenticatedTeacher(request);
    const { teacherProfileId, instituteId } = teacher;

    // 1. Fetch assignment details
    const assignmentRows = await queryDb<any>(
      `SELECT 
        a.id,
        a.title,
        a.instructions,
        a."dueAt",
        a."maxMarks",
        a.status,
        a."courseId",
        a."batchId",
        a."createdAt",
        a."updatedAt",
        c.title as "courseTitle",
        b.name as "batchName"
      FROM "Assignment" a
      JOIN "Course" c ON c.id = a."courseId"
      LEFT JOIN "Batch" b ON b.id = a."batchId"
      WHERE a.id = $1 AND a."instituteId" = $2
      LIMIT 1`,
      [assignmentId, instituteId]
    );

    if (assignmentRows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Assignment not found in your institute' },
        { status: 404 }
      );
    }

    const assignment = assignmentRows[0];

    // 2. Verify teacher authorization to this course or batch
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
        { success: false, error: 'You are not authorized to view or manage submissions for this assignment.' },
        { status: 403 }
      );
    }

    // 3. Fetch all active enrolled students in this assignment's scope
    const studentsQuery = `
      SELECT 
        sp.id as "studentProfileId",
        sp."admissionNo",
        u."fullName" as "studentName",
        u.email,
        u."phoneE164" as phone,
        u."avatarUrl",
        b.name as "batchName",
        s.id as "submissionId",
        s.status as "submissionStatus",
        s."submittedAt",
        s."answerText",
        s."fileUrl",
        s."marksAwarded",
        s.feedback
      FROM "Enrolment" e
      JOIN "StudentProfile" sp ON sp.id = e."studentProfileId"
      JOIN "Membership" m ON m.id = sp."membershipId"
      JOIN "User" u ON u.id = m."userId"
      LEFT JOIN "Batch" b ON b.id = e."batchId"
      LEFT JOIN "Submission" s ON s."assignmentId" = $1 AND s."studentProfileId" = sp.id
      WHERE e."instituteId" = $2
        AND e.status = 'ACTIVE'
        AND sp.status = 'ACTIVE'
        AND m.status = 'ACTIVE'
        AND (
          CASE 
            WHEN $3::text IS NOT NULL THEN e."batchId" = $3
            ELSE e."courseId" = $4
          END
        )
      ORDER BY sp."admissionNo" ASC
    `;

    const studentRows = await queryDb<any>(studentsQuery, [
      assignmentId,
      instituteId,
      assignment.batchId,
      assignment.courseId,
    ]);

    const submissionsRoster = studentRows.map((r) => {
      const isSubmitted = Boolean(r.submissionId);
      const isLate = r.submittedAt ? new Date(r.submittedAt) > new Date(assignment.dueAt) : false;

      return {
        studentProfileId: r.studentProfileId,
        admissionNo: r.admissionNo || 'N/A',
        studentName: r.studentName || 'Enrolled Student',
        email: r.email,
        phone: r.phone,
        avatarUrl: r.avatarUrl,
        batchName: r.batchName || assignment.batchName || 'General Cohort',
        submissionId: r.submissionId || null,
        status: isSubmitted ? r.submissionStatus : 'PENDING',
        submittedAt: r.submittedAt ? new Date(r.submittedAt).toISOString() : null,
        isLate,
        answerText: r.answerText || null,
        fileUrl: r.fileUrl || null,
        marksAwarded: r.marksAwarded !== null ? r.marksAwarded : null,
        maxMarks: assignment.maxMarks,
        feedback: r.feedback || null,
      };
    });

    const totalStudents = submissionsRoster.length;
    const submittedCount = submissionsRoster.filter((s) => s.status !== 'PENDING').length;
    const gradedCount = submissionsRoster.filter((s) => s.status === 'GRADED').length;
    const pendingCount = submissionsRoster.filter((s) => s.status === 'PENDING').length;
    const lateCount = submissionsRoster.filter((s) => s.isLate).length;

    return NextResponse.json({
      success: true,
      assignment: {
        id: assignment.id,
        title: assignment.title,
        instructions: assignment.instructions,
        dueAt: new Date(assignment.dueAt).toISOString(),
        maxMarks: assignment.maxMarks,
        status: assignment.status,
        courseId: assignment.courseId,
        courseTitle: assignment.courseTitle,
        batchId: assignment.batchId,
        batchName: assignment.batchName || 'All Cohorts',
        createdAt: new Date(assignment.createdAt).toISOString(),
        updatedAt: new Date(assignment.updatedAt).toISOString(),
        summary: {
          totalStudents,
          submittedCount,
          gradedCount,
          pendingCount,
          lateCount,
        },
        submissions: submissionsRoster,
      },
    });
  } catch (err: any) {
    if (err instanceof TeacherAuthError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.statusCode }
      );
    }
    console.error('Teacher assignment detail route error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error while fetching assignment details' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ assignmentId: string }> }
) {
  try {
    const { assignmentId } = await context.params;
    const teacher = await resolveAuthenticatedTeacher(request);
    const { teacherProfileId, instituteId, userId } = teacher;

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { success: false, error: 'Request body required' },
        { status: 400 }
      );
    }

    const assignmentRows = await queryDb<any>(
      `SELECT id, "courseId", "batchId", title, instructions, "dueAt", "maxMarks", status
       FROM "Assignment"
       WHERE id = $1 AND "instituteId" = $2 LIMIT 1`,
      [assignmentId, instituteId]
    );

    if (assignmentRows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Assignment not found in your institute' },
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
        { success: false, error: 'You are not authorized to edit this assignment.' },
        { status: 403 }
      );
    }

    const newTitle = body.title !== undefined ? body.title.trim() : assignment.title;
    const newInstructions = body.instructions !== undefined ? body.instructions.trim() : assignment.instructions;
    const newStatus = body.status !== undefined ? body.status : assignment.status;

    let newDueAt = assignment.dueAt;
    if (body.dueAt) {
      const parsed = new Date(body.dueAt);
      if (isNaN(parsed.getTime())) {
        return NextResponse.json({ success: false, error: 'Invalid due date format' }, { status: 400 });
      }
      newDueAt = parsed;
    }

    let newMaxMarks = assignment.maxMarks;
    if (body.maxMarks !== undefined) {
      const parsed = parseInt(String(body.maxMarks), 10);
      if (isNaN(parsed) || parsed <= 0) {
        return NextResponse.json({ success: false, error: 'Maximum marks must be greater than 0' }, { status: 400 });
      }

      // Check highest already awarded mark
      const highestAwarded = await queryDb<{ marksAwarded: number }>(
        `SELECT "marksAwarded" FROM "Submission"
         WHERE "assignmentId" = $1 AND "marksAwarded" IS NOT NULL
         ORDER BY "marksAwarded" DESC LIMIT 1`,
        [assignmentId]
      );

      if (highestAwarded.length > 0 && highestAwarded[0].marksAwarded > parsed) {
        return NextResponse.json(
          {
            success: false,
            error: `Cannot reduce max marks to ${parsed} because a student has already been awarded ${highestAwarded[0].marksAwarded} marks.`,
          },
          { status: 400 }
        );
      }
      newMaxMarks = parsed;
    }

    const updateResult = await queryDb<any>(
      `UPDATE "Assignment"
       SET title = $1, instructions = $2, "dueAt" = $3, "maxMarks" = $4, status = $5, "updatedAt" = NOW()
       WHERE id = $6 AND "instituteId" = $7
       RETURNING id, title, instructions, "dueAt", "maxMarks", status, "updatedAt"`,
      [newTitle, newInstructions, newDueAt, newMaxMarks, newStatus, assignmentId, instituteId]
    );

    // Audit log
    await queryDb(
      `INSERT INTO "AuditLog" (id, "instituteId", "actorUserId", action, "entityType", "entityId", metadata, "createdAt")
       VALUES (gen_random_uuid(), $1, $2, 'UPDATE_ASSIGNMENT', 'Assignment', $3, $4, NOW())`,
      [
        instituteId,
        userId,
        assignmentId,
        JSON.stringify({
          previousTitle: assignment.title,
          newTitle,
          previousMaxMarks: assignment.maxMarks,
          newMaxMarks,
          previousStatus: assignment.status,
          newStatus,
          previousDueAt: new Date(assignment.dueAt).toISOString(),
          newDueAt: new Date(newDueAt).toISOString(),
        }),
      ]
    );

    const updated = updateResult[0];

    return NextResponse.json({
      success: true,
      message: 'Assignment updated successfully',
      data: {
        id: updated.id,
        title: updated.title,
        instructions: updated.instructions,
        dueAt: new Date(updated.dueAt).toISOString(),
        maxMarks: updated.maxMarks,
        status: updated.status,
        updatedAt: new Date(updated.updatedAt).toISOString(),
      },
    });
  } catch (err: any) {
    if (err instanceof TeacherAuthError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.statusCode }
      );
    }
    console.error('Teacher assignment update route error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error while updating assignment' },
      { status: 500 }
    );
  }
}
