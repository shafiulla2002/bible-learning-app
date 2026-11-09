import { NextRequest, NextResponse } from 'next/server';
import { resolveAuthenticatedTeacher, TeacherAuthError } from '@/lib/server-teacher';
import { queryDb } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const teacher = await resolveAuthenticatedTeacher(request);
    const { teacherProfileId, instituteId } = teacher;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim() || '';
    const statusParam = searchParams.get('status') || 'ALL';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
    const offset = (page - 1) * limit;

    // 1. Fetch assigned course IDs and teacher roles
    const assignedCoursesQuery = `
      WITH assigned_refs AS (
        SELECT ci."courseId", ci.role as "instructorRole", 1 as priority
        FROM "CourseInstructor" ci
        WHERE ci."teacherProfileId" = $1 AND ci."instituteId" = $2
        UNION ALL
        SELECT b."courseId", bt.role as "instructorRole", 2 as priority
        FROM "BatchTeacher" bt
        JOIN "Batch" b ON b.id = bt."batchId"
        WHERE bt."teacherProfileId" = $1 AND bt."instituteId" = $2
      ),
      distinct_assigned AS (
        SELECT DISTINCT ON ("courseId") "courseId", "instructorRole"
        FROM assigned_refs
        ORDER BY "courseId", priority ASC
      )
      SELECT 
        c.id,
        c.title,
        c.slug,
        c.description,
        c."coverImage",
        c.level,
        c.language,
        c.pricing,
        c.price,
        c."salePrice",
        c.status,
        c."updatedAt",
        da."instructorRole" as role,
        cat.id as "categoryId",
        cat.name as "categoryName",
        COALESCE((
          SELECT COUNT(DISTINCT bt."batchId")::int
          FROM "BatchTeacher" bt
          JOIN "Batch" b ON b.id = bt."batchId"
          WHERE bt."teacherProfileId" = $1 AND b."courseId" = c.id
        ), 0) as "batchCount",
        COALESCE((
          SELECT COUNT(DISTINCT e."studentProfileId")::int
          FROM "Enrolment" e
          JOIN "BatchTeacher" bt ON bt."batchId" = e."batchId"
          JOIN "Batch" b ON b.id = e."batchId"
          WHERE bt."teacherProfileId" = $1 AND b."courseId" = c.id AND e.status = 'ACTIVE'
        ), 0) as "studentCount",
        COALESCE((
          SELECT COUNT(m.id)::int
          FROM "Module" m
          WHERE m."courseId" = c.id
        ), 0) as "moduleCount",
        COALESCE((
          SELECT COUNT(ch.id)::int
          FROM "Chapter" ch
          JOIN "Module" m ON m.id = ch."moduleId"
          WHERE m."courseId" = c.id
        ), 0) as "chapterCount",
        COALESCE((
          SELECT COUNT(l.id)::int
          FROM "Lesson" l
          JOIN "Chapter" ch ON ch.id = l."chapterId"
          JOIN "Module" m ON m.id = ch."moduleId"
          WHERE m."courseId" = c.id
        ), 0) as "lessonCount",
        COALESCE((
          SELECT COUNT(lr.id)::int
          FROM "LessonResource" lr
          JOIN "Lesson" l ON l.id = lr."lessonId"
          JOIN "Chapter" ch ON ch.id = l."chapterId"
          JOIN "Module" m ON m.id = ch."moduleId"
          WHERE m."courseId" = c.id
        ), 0) as "resourceCount",
        COALESCE((
          SELECT SUM(l."durationSec")::int
          FROM "Lesson" l
          JOIN "Chapter" ch ON ch.id = l."chapterId"
          JOIN "Module" m ON m.id = ch."moduleId"
          WHERE m."courseId" = c.id
        ), 0) as "totalDurationSec"
      FROM distinct_assigned da
      JOIN "Course" c ON c.id = da."courseId" AND c."instituteId" = $2 AND c."deletedAt" IS NULL
      LEFT JOIN "CourseCategory" cat ON cat.id = c."categoryId"
      WHERE (
        $3 = '' OR 
        c.title ILIKE '%' || $3 || '%' OR 
        c.description ILIKE '%' || $3 || '%' OR
        c.slug ILIKE '%' || $3 || '%'
      )
      AND ($4 = 'ALL' OR c.status::text = $4)
      ORDER BY c."updatedAt" DESC
      LIMIT $5 OFFSET $6
    `;

    const countQuery = `
      WITH assigned_refs AS (
        SELECT ci."courseId"
        FROM "CourseInstructor" ci
        WHERE ci."teacherProfileId" = $1 AND ci."instituteId" = $2
        UNION ALL
        SELECT b."courseId"
        FROM "BatchTeacher" bt
        JOIN "Batch" b ON b.id = bt."batchId"
        WHERE bt."teacherProfileId" = $1 AND bt."instituteId" = $2
      )
      SELECT COUNT(DISTINCT ar."courseId")::int as total
      FROM assigned_refs ar
      JOIN "Course" c ON c.id = ar."courseId" AND c."instituteId" = $2 AND c."deletedAt" IS NULL
      WHERE (
        $3 = '' OR 
        c.title ILIKE '%' || $3 || '%' OR 
        c.description ILIKE '%' || $3 || '%' OR
        c.slug ILIKE '%' || $3 || '%'
      )
      AND ($4 = 'ALL' OR c.status::text = $4)
    `;

    const [rows, countRows] = await Promise.all([
      queryDb<any>(assignedCoursesQuery, [
        teacherProfileId,
        instituteId,
        search,
        statusParam,
        limit,
        offset,
      ]),
      queryDb<{ total: number }>(countQuery, [
        teacherProfileId,
        instituteId,
        search,
        statusParam,
      ]),
    ]);

    const total = countRows[0]?.total || 0;

    const data = rows.map((r) => ({
      id: r.id,
      title: r.title,
      slug: r.slug,
      description: r.description,
      coverImage: r.coverImage,
      level: r.level,
      language: r.language,
      pricing: r.pricing,
      price: r.price,
      salePrice: r.salePrice,
      status: r.status,
      category: r.categoryName || 'Uncategorized',
      categoryId: r.categoryId,
      role: r.role || 'INSTRUCTOR',
      batchCount: r.batchCount,
      studentCount: r.studentCount,
      curriculumStats: {
        moduleCount: r.moduleCount,
        chapterCount: r.chapterCount,
        lessonCount: r.lessonCount,
        resourceCount: r.resourceCount,
        totalDurationMinutes: Math.round((r.totalDurationSec || 0) / 60),
      },
      updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : new Date().toISOString(),
    }));

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
    console.error('Teacher courses route error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error while fetching assigned courses' },
      { status: 500 }
    );
  }
}
