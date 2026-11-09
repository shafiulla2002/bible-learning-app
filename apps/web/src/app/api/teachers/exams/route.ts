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
        metrics: {
          total: 0,
          published: 0,
          draft: 0,
          scheduled: 0,
          completed: 0,
          totalAttempts: 0,
          pendingEvaluations: 0,
          avgScore: 0,
        },
        meta: {
          total: 0,
          page,
          limit,
          totalPages: 0,
        },
      });
    }

    if (courseIdParam !== 'ALL' && !assignedCourseIds.includes(courseIdParam)) {
      return NextResponse.json(
        { success: false, error: 'You are not authorized to view examinations for this course.' },
        { status: 403 }
      );
    }

    if (batchIdParam !== 'ALL' && !assignedBatchIds.includes(batchIdParam)) {
      return NextResponse.json(
        { success: false, error: 'You are not authorized to view examinations for this batch.' },
        { status: 403 }
      );
    }

    // Metrics query across all teacher assigned exams
    const metricsQuery = `
      SELECT 
        COUNT(e.id)::int as total,
        COUNT(CASE WHEN e.status = 'PUBLISHED' THEN 1 END)::int as published,
        COUNT(CASE WHEN e.status = 'DRAFT' THEN 1 END)::int as draft,
        COUNT(CASE WHEN e."startAt" IS NOT NULL AND e."startAt" > NOW() THEN 1 END)::int as scheduled,
        COUNT(CASE WHEN e."endAt" IS NOT NULL AND e."endAt" < NOW() THEN 1 END)::int as completed,
        COALESCE(SUM(
          (SELECT COUNT(att.id) FROM "ExamAttempt" att WHERE att."examId" = e.id)
        ), 0)::int as "totalAttempts",
        COALESCE(SUM(
          (SELECT COUNT(att.id) FROM "ExamAttempt" att WHERE att."examId" = e.id AND att.status = 'SUBMITTED')
        ), 0)::int as "pendingEvaluations",
        COALESCE(AVG(
          (SELECT AVG(att.score) FROM "ExamAttempt" att WHERE att."examId" = e.id AND att.status = 'EVALUATED' AND att.score IS NOT NULL)
        ), 0)::int as "avgScore"
      FROM "Exam" e
      WHERE e."instituteId" = $1
        AND (
          e."courseId"::text = ANY($2::text[])
          OR e."batchId"::text = ANY($3::text[])
        )
    `;

    // Exams catalog query
    const examsQuery = `
      SELECT 
        e.id,
        e.title,
        e.instructions,
        e.type,
        e."durationMin",
        e."totalMarks",
        e."passMarks",
        e.status,
        e."startAt",
        e."endAt",
        e."courseId",
        e."batchId",
        e."createdAt",
        e."updatedAt",
        c.title as "courseTitle",
        b.name as "batchName",
        b.code as "batchCode",
        (SELECT COUNT(q.id)::int FROM "Question" q WHERE q."examId" = e.id) as "totalQuestions",
        COALESCE(
          CASE 
            WHEN e."batchId" IS NOT NULL THEN (
              SELECT COUNT(DISTINCT en."studentProfileId")::int
              FROM "Enrolment" en
              WHERE en."batchId" = e."batchId" AND en."instituteId" = $1 AND en.status = 'ACTIVE'
            )
            ELSE (
              SELECT COUNT(DISTINCT en."studentProfileId")::int
              FROM "Enrolment" en
              WHERE en."courseId" = e."courseId" AND en."instituteId" = $1 AND en.status = 'ACTIVE'
            )
          END,
          0
        ) as "totalStudents",
        (SELECT COUNT(att.id)::int FROM "ExamAttempt" att WHERE att."examId" = e.id) as "attemptCount",
        (SELECT COUNT(att.id)::int FROM "ExamAttempt" att WHERE att."examId" = e.id AND att.status = 'EVALUATED') as "evaluatedCount",
        (SELECT COUNT(att.id)::int FROM "ExamAttempt" att WHERE att."examId" = e.id AND att.status = 'SUBMITTED') as "pendingEvaluationCount"
      FROM "Exam" e
      JOIN "Course" c ON c.id = e."courseId"
      LEFT JOIN "Batch" b ON b.id = e."batchId"
      WHERE e."instituteId" = $1
        AND (
          e."courseId"::text = ANY($2::text[])
          OR e."batchId"::text = ANY($3::text[])
        )
        AND ($4 = 'ALL' OR e."courseId" = $4)
        AND ($5 = 'ALL' OR e."batchId" = $5)
        AND ($6 = 'ALL' OR e.status = $6)
        AND (
          $7 = '' OR 
          e.title ILIKE '%' || $7 || '%' OR 
          c.title ILIKE '%' || $7 || '%' OR 
          b.name ILIKE '%' || $7 || '%'
        )
      ORDER BY e."createdAt" DESC
      LIMIT $8 OFFSET $9
    `;

    const countQuery = `
      SELECT COUNT(e.id)::int as total
      FROM "Exam" e
      JOIN "Course" c ON c.id = e."courseId"
      LEFT JOIN "Batch" b ON b.id = e."batchId"
      WHERE e."instituteId" = $1
        AND (
          e."courseId"::text = ANY($2::text[])
          OR e."batchId"::text = ANY($3::text[])
        )
        AND ($4 = 'ALL' OR e."courseId" = $4)
        AND ($5 = 'ALL' OR e."batchId" = $5)
        AND ($6 = 'ALL' OR e.status = $6)
        AND (
          $7 = '' OR 
          e.title ILIKE '%' || $7 || '%' OR 
          c.title ILIKE '%' || $7 || '%' OR 
          b.name ILIKE '%' || $7 || '%'
        )
    `;

    const [metricsRows, examRows, countRows] = await Promise.all([
      queryDb<any>(metricsQuery, [
        instituteId,
        assignedCourseIds,
        assignedBatchIds.length > 0 ? assignedBatchIds : ['NONE'],
      ]),
      queryDb<any>(examsQuery, [
        instituteId,
        assignedCourseIds,
        assignedBatchIds.length > 0 ? assignedBatchIds : ['NONE'],
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
        assignedBatchIds.length > 0 ? assignedBatchIds : ['NONE'],
        courseIdParam,
        batchIdParam,
        statusParam,
        search,
      ]),
    ]);

    const metrics = metricsRows[0] || {
      total: 0,
      published: 0,
      draft: 0,
      scheduled: 0,
      completed: 0,
      totalAttempts: 0,
      pendingEvaluations: 0,
      avgScore: 0,
    };

    const totalCount = countRows[0]?.total || 0;

    return NextResponse.json({
      success: true,
      data: examRows.map((e) => ({
        id: e.id,
        title: e.title,
        instructions: e.instructions,
        type: e.type,
        durationMin: e.durationMin,
        totalMarks: e.totalMarks,
        passMarks: e.passMarks,
        status: e.status,
        startAt: e.startAt ? new Date(e.startAt).toISOString() : null,
        endAt: e.endAt ? new Date(e.endAt).toISOString() : null,
        courseId: e.courseId,
        courseTitle: e.courseTitle,
        batchId: e.batchId,
        batchName: e.batchName || 'All Batches',
        batchCode: e.batchCode || null,
        totalQuestions: e.totalQuestions,
        totalStudents: e.totalStudents,
        attemptCount: e.attemptCount,
        evaluatedCount: e.evaluatedCount,
        pendingEvaluationCount: e.pendingEvaluationCount,
        createdAt: new Date(e.createdAt).toISOString(),
        updatedAt: new Date(e.updatedAt).toISOString(),
      })),
      metrics: {
        total: metrics.total,
        published: metrics.published,
        draft: metrics.draft,
        scheduled: metrics.scheduled,
        completed: metrics.completed,
        totalAttempts: metrics.totalAttempts,
        pendingEvaluations: metrics.pendingEvaluations,
        avgScore: metrics.avgScore,
      },
      meta: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (err: any) {
    if (err instanceof TeacherAuthError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.statusCode }
      );
    }
    console.error('Teacher exams route error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error while fetching examinations' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const teacher = await resolveAuthenticatedTeacher(request);
    const { teacherProfileId, instituteId, userId } = teacher;

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { success: false, error: 'Request body required' },
        { status: 400 }
      );
    }

    const { title, instructions, courseId, batchId, durationMin, totalMarks, passMarks, status, startAt, endAt, type } = body;

    if (!title || !title.trim()) {
      return NextResponse.json(
        { success: false, error: 'Examination title is required' },
        { status: 400 }
      );
    }
    if (!courseId) {
      return NextResponse.json(
        { success: false, error: 'Course selection is required' },
        { status: 400 }
      );
    }

    const dur = Number(durationMin || 30);
    if (isNaN(dur) || dur <= 0) {
      return NextResponse.json(
        { success: false, error: 'Duration must be a positive integer in minutes' },
        { status: 400 }
      );
    }

    const tm = Number(totalMarks || 100);
    if (isNaN(tm) || tm <= 0) {
      return NextResponse.json(
        { success: false, error: 'Total marks must be greater than zero' },
        { status: 400 }
      );
    }

    const pm = Number(passMarks !== undefined ? passMarks : Math.round(tm * 0.4));
    if (isNaN(pm) || pm < 0 || pm > tm) {
      return NextResponse.json(
        { success: false, error: 'Passing marks cannot exceed total marks' },
        { status: 400 }
      );
    }

    // Verify teacher assignment to course/batch
    const authCheck = await queryDb<{ role: string }>(
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
      [courseId, teacherProfileId, instituteId, batchId || courseId]
    );

    if (authCheck.length === 0) {
      return NextResponse.json(
        { success: false, error: 'You are not assigned to instruct this course or cohort.' },
        { status: 403 }
      );
    }

    let parsedStartAt: Date | null = null;
    let parsedEndAt: Date | null = null;
    if (startAt) {
      parsedStartAt = new Date(startAt);
      if (isNaN(parsedStartAt.getTime())) {
        return NextResponse.json({ success: false, error: 'Invalid start time format' }, { status: 400 });
      }
    }
    if (endAt) {
      parsedEndAt = new Date(endAt);
      if (isNaN(parsedEndAt.getTime())) {
        return NextResponse.json({ success: false, error: 'Invalid end time format' }, { status: 400 });
      }
    }
    if (parsedStartAt && parsedEndAt && parsedStartAt >= parsedEndAt) {
      return NextResponse.json({ success: false, error: 'Start time must be strictly before end time' }, { status: 400 });
    }

    const examType = type === 'EXAM' ? 'EXAM' : 'QUIZ';
    const examStatus = status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT';

    const insertResult = await queryDb<any>(
      `INSERT INTO "Exam" (
        id, "instituteId", "courseId", "batchId", title, instructions,
        type, "durationMin", "totalMarks", "passMarks", status, "startAt", "endAt",
        "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid()::text, $1, $2, $3, $4, $5,
        $6::"ExamType", $7, $8, $9, $10, $11, $12,
        NOW(), NOW()
      ) RETURNING *`,
      [
        instituteId,
        courseId,
        batchId || null,
        title.trim(),
        instructions?.trim() || null,
        examType,
        dur,
        tm,
        pm,
        examStatus,
        parsedStartAt,
        parsedEndAt,
      ]
    );

    const created = insertResult[0];

    // Audit Log
    await queryDb(
      `INSERT INTO "AuditLog" (id, "instituteId", "actorUserId", action, "entityType", "entityId", metadata, "createdAt")
       VALUES (gen_random_uuid()::text, $1, $2, 'EXAM_CREATED', 'Exam', $3, $4, NOW())`,
      [
        instituteId,
        userId,
        created.id,
        JSON.stringify({
          title: created.title,
          courseId: created.courseId,
          batchId: created.batchId,
          totalMarks: created.totalMarks,
          status: created.status,
        }),
      ]
    );

    return NextResponse.json({
      success: true,
      message: 'Examination created successfully',
      data: created,
    }, { status: 201 });
  } catch (err: any) {
    if (err instanceof TeacherAuthError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.statusCode }
      );
    }
    console.error('Teacher exam create route error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error while creating examination' },
      { status: 500 }
    );
  }
}
