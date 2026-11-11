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
    const kindParam = searchParams.get('kind') || 'ALL';
    const search = searchParams.get('search')?.trim() || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const offset = (page - 1) * limit;

    // 1. Fetch assigned course IDs for this teacher
    const assignedCourses = await queryDb<{ courseId: string }>(
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
    );

    const assignedCourseIds = assignedCourses.map((c) => c.courseId);

    if (assignedCourseIds.length === 0) {
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
        { success: false, error: 'You do not have access to materials for this course.' },
        { status: 403 }
      );
    }

    const targetCourseIds = courseIdParam !== 'ALL' ? [courseIdParam] : assignedCourseIds;

    const materialsQuery = `
      SELECT 
        lr.id,
        lr."lessonId",
        lr."mediaAssetId",
        lr.downloadable,
        lr."createdAt",
        ma."storageKey",
        ma."videoStreamId",
        ma.kind,
        ma."mimeType",
        ma."sizeBytes"::text as "sizeBytes",
        l.title as "lessonTitle",
        l.type as "lessonType",
        ch.title as "chapterTitle",
        m.title as "moduleTitle",
        c.id as "courseId",
        c.title as "courseTitle"
      FROM "LessonResource" lr
      JOIN "MediaAsset" ma ON ma.id = lr."mediaAssetId"
      JOIN "Lesson" l ON l.id = lr."lessonId"
      JOIN "Chapter" ch ON ch.id = l."chapterId"
      JOIN "Module" m ON m.id = ch."moduleId"
      JOIN "Course" c ON c.id = m."courseId"
      WHERE lr."instituteId" = $1
        AND c.id::text = ANY($2::text[])
        AND ($3 = 'ALL' OR ma.kind = $3)
        AND (
          $4 = '' OR 
          ma."storageKey" ILIKE '%' || $4 || '%' OR 
          l.title ILIKE '%' || $4 || '%' OR
          c.title ILIKE '%' || $4 || '%'
        )
      ORDER BY lr."createdAt" DESC
      LIMIT $5 OFFSET $6
    `;

    const countQuery = `
      SELECT COUNT(lr.id)::int as total
      FROM "LessonResource" lr
      JOIN "MediaAsset" ma ON ma.id = lr."mediaAssetId"
      JOIN "Lesson" l ON l.id = lr."lessonId"
      JOIN "Chapter" ch ON ch.id = l."chapterId"
      JOIN "Module" m ON m.id = ch."moduleId"
      JOIN "Course" c ON c.id = m."courseId"
      WHERE lr."instituteId" = $1
        AND c.id::text = ANY($2::text[])
        AND ($3 = 'ALL' OR ma.kind = $3)
        AND (
          $4 = '' OR 
          ma."storageKey" ILIKE '%' || $4 || '%' OR 
          l.title ILIKE '%' || $4 || '%' OR
          c.title ILIKE '%' || $4 || '%'
        )
    `;

    const [rows, countRows] = await Promise.all([
      queryDb<any>(materialsQuery, [
        instituteId,
        targetCourseIds,
        kindParam,
        search,
        limit,
        offset,
      ]),
      queryDb<{ total: number }>(countQuery, [
        instituteId,
        targetCourseIds,
        kindParam,
        search,
      ]),
    ]);

    const total = countRows[0]?.total || 0;

    const data = rows.map((r) => {
      const fileName = r.storageKey
        ? r.storageKey.split('/').pop() || r.storageKey
        : r.lessonTitle;

      return {
        id: r.id,
        lessonId: r.lessonId,
        lessonTitle: r.lessonTitle,
        lessonType: r.lessonType,
        chapterTitle: r.chapterTitle || 'Unknown Chapter',
        moduleTitle: r.moduleTitle || 'Unknown Module',
        courseId: r.courseId,
        courseTitle: r.courseTitle,
        mediaAssetId: r.mediaAssetId,
        title: fileName,
        storageKey: r.storageKey,
        videoStreamId: r.videoStreamId || null,
        kind: r.kind || 'FILE',
        mimeType: r.mimeType || '',
        sizeBytes: r.sizeBytes || '0',
        downloadable: r.downloadable,
        createdAt: new Date(r.createdAt).toISOString(),
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
    console.error('Teacher materials GET route error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error while fetching learning materials' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const teacher = await resolveAuthenticatedTeacher(request);
    const { teacherProfileId, instituteId, userId } = teacher;

    const body = await request.json().catch(() => null);
    if (!body || !body.courseId || !body.lessonId || !body.storageKey || !body.kind) {
      return NextResponse.json(
        { success: false, error: 'courseId, lessonId, storageKey, and kind are required' },
        { status: 400 }
      );
    }

    const { courseId, lessonId, storageKey, kind, mimeType, sizeBytes, downloadable } = body;

    // 1. Verify teacher is assigned to this course
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
        { success: false, error: 'You are not assigned to instruct or teach this course.' },
        { status: 403 }
      );
    }

    // 2. Verify lesson belongs to this course and institute
    const lessonCheck = await queryDb<{ id: string; title: string }>(
      `SELECT l.id, l.title
       FROM "Lesson" l
       JOIN "Chapter" ch ON ch.id = l."chapterId"
       JOIN "Module" m ON m.id = ch."moduleId"
       WHERE l.id = $1 AND m."courseId" = $2 AND l."instituteId" = $3
       LIMIT 1`,
      [lessonId, courseId, instituteId]
    );

    if (lessonCheck.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Lesson not found in this course' },
        { status: 404 }
      );
    }

    // 3. Upsert MediaAsset
    const existingAsset = await queryDb<{ id: string }>(
      `SELECT id FROM "MediaAsset" WHERE "storageKey" = $1 LIMIT 1`,
      [storageKey]
    );

    let mediaAssetId = existingAsset[0]?.id;
    if (!mediaAssetId) {
      const assetInsert = await queryDb<{ id: string }>(
        `INSERT INTO "MediaAsset" (id, "instituteId", "ownerUserId", kind, "storageKey", "mimeType", "sizeBytes", "createdAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW())
         RETURNING id`,
        [
          instituteId,
          userId,
          kind,
          storageKey,
          mimeType || 'application/octet-stream',
          BigInt(sizeBytes || 1024000).toString(),
        ]
      );
      mediaAssetId = assetInsert[0]?.id;
    }

    // 4. Insert LessonResource
    const isDownloadable = downloadable !== undefined ? Boolean(downloadable) : true;
    const resourceInsert = await queryDb<any>(
      `INSERT INTO "LessonResource" (id, "instituteId", "lessonId", "mediaAssetId", downloadable, "createdAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())
       RETURNING id, "lessonId", "mediaAssetId", downloadable, "createdAt"`,
      [instituteId, lessonId, mediaAssetId, isDownloadable]
    );

    const created = resourceInsert[0];

    return NextResponse.json(
      {
        success: true,
        data: {
          id: created.id,
          lessonId: created.lessonId,
          mediaAssetId: created.mediaAssetId,
          kind,
          storageKey,
          mimeType: mimeType || 'application/octet-stream',
          sizeBytes: (sizeBytes || 1024000).toString(),
          downloadable: created.downloadable,
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
    console.error('Teacher materials POST route error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error while creating study material' },
      { status: 500 }
    );
  }
}
