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
      queryDb<{ courseId: string }>(
        `SELECT DISTINCT "courseId" FROM (
          SELECT ci."courseId"
          FROM "CourseInstructor" ci
          WHERE ci."teacherProfileId" = $1 AND ci."instituteId" = $2
          UNION ALL
          SELECT b."courseId"
          FROM "BatchTeacher" bt
          JOIN "Batch" b ON b.id = bt."batchId"
          WHERE bt."teacherProfileId" = $1 AND bt."instituteId" = $2
        ) a`,
        [teacherProfileId, instituteId]
      ),
      queryDb<{ batchId: string }>(
        `SELECT "batchId" FROM "BatchTeacher"
         WHERE "teacherProfileId" = $1 AND "instituteId" = $2`,
        [teacherProfileId, instituteId]
      ),
    ]);

    const assignedCourseIds = assignedCourses.map((c) => c.courseId);
    const assignedBatchIds = assignedBatches.map((b) => b.batchId);

    if (assignedCourseIds.length === 0 && assignedBatchIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        meta: {
          total: 0,
          page,
          limit,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });
    }

    if (courseIdParam !== 'ALL' && !assignedCourseIds.includes(courseIdParam)) {
      return NextResponse.json(
        { success: false, error: 'You are not authorized to view assignments for this course.' },
        { status: 403 }
      );
    }

    if (batchIdParam !== 'ALL' && !assignedBatchIds.includes(batchIdParam)) {
      return NextResponse.json(
        { success: false, error: 'You are not authorized to view assignments for this batch.' },
        { status: 403 }
      );
    }

    const assignmentsQuery = `
      SELECT 
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
        b.name as "batchName",
        b.code as "batchCode",
        COALESCE(
          CASE 
            WHEN a."batchId" IS NOT NULL THEN (
              SELECT COUNT(DISTINCT e."studentProfileId")::int
              FROM "Enrolment" e
              WHERE e."batchId" = a."batchId" AND e."instituteId" = $1 AND e.status = 'ACTIVE'
            )
            ELSE (
              SELECT COUNT(DISTINCT e."studentProfileId")::int
              FROM "Enrolment" e
              WHERE e."courseId" = a."courseId" AND e."instituteId" = $1 AND e.status = 'ACTIVE'
            )
          END,
          0
        ) as "totalStudents",
        COALESCE((
          SELECT COUNT(s.id)::int
          FROM "Submission" s
          WHERE s."assignmentId" = a.id
        ), 0) as "submittedCount",
        COALESCE((
          SELECT COUNT(s.id)::int
          FROM "Submission" s
          WHERE s."assignmentId" = a.id AND s.status = 'GRADED'
        ), 0) as "gradedCount",
        COALESCE((
          SELECT COUNT(s.id)::int
          FROM "Submission" s
          WHERE s."assignmentId" = a.id AND s."submittedAt" > a."dueAt"
        ), 0) as "lateCount"
      FROM "Assignment" a
      JOIN "Course" c ON c.id = a."courseId"
      LEFT JOIN "Batch" b ON b.id = a."batchId"
      WHERE a."instituteId" = $1
        AND (
          a."courseId"::text = ANY($2::text[])
          OR a."batchId"::text = ANY($3::text[])
        )
        AND ($4 = 'ALL' OR a."courseId" = $4)
        AND ($5 = 'ALL' OR a."batchId" = $5)
        AND ($6 = 'ALL' OR a.status = $6)
        AND (
          $7 = '' OR 
          a.title ILIKE '%' || $7 || '%' OR 
          a.instructions ILIKE '%' || $7 || '%' OR 
          c.title ILIKE '%' || $7 || '%' OR 
          b.name ILIKE '%' || $7 || '%'
        )
      ORDER BY a."dueAt" DESC
      LIMIT $8 OFFSET $9
    `;

    const countQuery = `
      SELECT COUNT(a.id)::int as total
      FROM "Assignment" a
      JOIN "Course" c ON c.id = a."courseId"
      LEFT JOIN "Batch" b ON b.id = a."batchId"
      WHERE a."instituteId" = $1
        AND (
          a."courseId"::text = ANY($2::text[])
          OR a."batchId"::text = ANY($3::text[])
        )
        AND ($4 = 'ALL' OR a."courseId" = $4)
        AND ($5 = 'ALL' OR a."batchId" = $5)
        AND ($6 = 'ALL' OR a.status = $6)
        AND (
          $7 = '' OR 
          a.title ILIKE '%' || $7 || '%' OR 
          a.instructions ILIKE '%' || $7 || '%' OR 
          c.title ILIKE '%' || $7 || '%' OR 
          b.name ILIKE '%' || $7 || '%'
        )
    `;

    const [rows, countRows] = await Promise.all([
      queryDb<any>(assignmentsQuery, [
        instituteId,
        assignedCourseIds,
        assignedBatchIds,
        courseIdParam,
        batchIdParam,
        statusParam,
        search,
        limit,
        offset,
      ]),
      queryDb<{ total: number }>(countQuery, [
        instituteId,
        assignedCourseIds,
        assignedBatchIds,
        courseIdParam,
        batchIdParam,
        statusParam,
        search,
      ]),
    ]);

    const total = countRows[0]?.total || 0;

    const data = rows.map((r) => {
      const totalStudents = r.totalStudents || 0;
      const submittedCount = r.submittedCount || 0;
      const gradedCount = r.gradedCount || 0;
      const pendingCount = Math.max(0, totalStudents - submittedCount);
      const lateCount = r.lateCount || 0;

      return {
        id: r.id,
        title: r.title,
        instructions: r.instructions,
        dueAt: new Date(r.dueAt).toISOString(),
        maxMarks: r.maxMarks,
        status: r.status,
        courseId: r.courseId,
        courseTitle: r.courseTitle,
        batchId: r.batchId,
        batchName: r.batchName || 'All Cohorts',
        totalStudents,
        submittedCount,
        gradedCount,
        pendingCount,
        lateCount,
        createdAt: new Date(r.createdAt).toISOString(),
        updatedAt: new Date(r.updatedAt).toISOString(),
      };
    });

    return NextResponse.json({
      success: true,
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    });
  } catch (err: any) {
    if (err instanceof TeacherAuthError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.statusCode }
      );
    }
    console.error('Teacher assignments route error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error while fetching assignments' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const teacher = await resolveAuthenticatedTeacher(request);
    const { teacherProfileId, instituteId, userId } = teacher;

    const body = await request.json().catch(() => null);
    if (!body || !body.courseId || !body.title?.trim() || !body.instructions?.trim() || !body.dueAt) {
      return NextResponse.json(
        { success: false, error: 'courseId, title, instructions, and dueAt are required' },
        { status: 400 }
      );
    }

    const { courseId, batchId, title, instructions, dueAt, maxMarks, status } = body;
    const parsedMaxMarks = Math.max(1, parseInt(String(maxMarks || 100), 10));
    const dueAtDate = new Date(dueAt);
    if (isNaN(dueAtDate.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid due date format' },
        { status: 400 }
      );
    }

    // 1. Verify teacher is assigned to course or batch
    const assignmentCheck = await queryDb<{ role: string }>(
      `SELECT role FROM (
        SELECT ci.role, 1 as priority
        FROM "CourseInstructor" ci
        WHERE ci."courseId" = $1 AND ci."teacherProfileId" = $2 AND ci."instituteId" = $3
        UNION ALL
        SELECT bt.role, 2 as priority
        FROM "BatchTeacher" bt
        JOIN "Batch" b ON b.id = bt."batchId"
        WHERE b."courseId" = $1 AND bt."teacherProfileId" = $2 AND bt."instituteId" = $3
      ) a ORDER BY priority ASC LIMIT 1`,
      [courseId, teacherProfileId, instituteId]
    );

    if (assignmentCheck.length === 0) {
      return NextResponse.json(
        { success: false, error: 'You are not authorized to create assignments for this course.' },
        { status: 403 }
      );
    }

    if (batchId) {
      const batchCheck = await queryDb<{ id: string }>(
        `SELECT id FROM "Batch" WHERE id = $1 AND "courseId" = $2 AND "instituteId" = $3 LIMIT 1`,
        [batchId, courseId, instituteId]
      );
      if (batchCheck.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Selected batch does not belong to this course or institute' },
          { status: 400 }
        );
      }
    }

    const assignmentStatus = status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED';
    const assignmentId = crypto.randomUUID();

    const insertResult = await queryDb<any>(
      `INSERT INTO "Assignment" (id, "instituteId", "courseId", "batchId", title, instructions, "dueAt", "maxMarks", status, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
       RETURNING id, title, instructions, "dueAt", "maxMarks", status, "createdAt"`,
      [
        assignmentId,
        instituteId,
        courseId,
        batchId || null,
        title.trim(),
        instructions.trim(),
        dueAtDate,
        parsedMaxMarks,
        assignmentStatus,
      ]
    );

    // Audit Log
    await queryDb(
      `INSERT INTO "AuditLog" (id, "instituteId", "actorUserId", action, "entityType", "entityId", metadata, "createdAt")
       VALUES (gen_random_uuid(), $1, $2, 'CREATE_ASSIGNMENT', 'Assignment', $3, $4, NOW())`,
      [
        instituteId,
        userId,
        assignmentId,
        JSON.stringify({
          title,
          courseId,
          batchId: batchId || null,
          dueAt: dueAtDate.toISOString(),
          maxMarks: parsedMaxMarks,
          status: assignmentStatus,
        }),
      ]
    );

    const created = insertResult[0];

    return NextResponse.json(
      {
        success: true,
        message: 'Assignment created successfully',
        data: {
          id: created.id,
          title: created.title,
          instructions: created.instructions,
          dueAt: new Date(created.dueAt).toISOString(),
          maxMarks: created.maxMarks,
          status: created.status,
          courseId,
          batchId: batchId || null,
          createdAt: new Date(created.createdAt).toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    if (err instanceof TeacherAuthError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.statusCode }
      );
    }
    console.error('Teacher assignment creation route error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error while creating assignment' },
      { status: 500 }
    );
  }
}

