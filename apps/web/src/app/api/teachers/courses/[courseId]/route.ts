import { NextRequest, NextResponse } from 'next/server';
import { resolveAuthenticatedTeacher, TeacherAuthError } from '@/lib/server-teacher';
import { queryDb } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params;
    const teacher = await resolveAuthenticatedTeacher(request);
    const { teacherProfileId, instituteId } = teacher;

    if (!courseId) {
      return NextResponse.json(
        { success: false, error: 'Course ID is required' },
        { status: 400 }
      );
    }

    // 1. Verify teacher is assigned to this course (CourseInstructor OR BatchTeacher)
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

    const assignedRole = assignmentCheck[0].role || 'INSTRUCTOR';

    // 2. Fetch Course basic details
    const courseRows = await queryDb<any>(
      `SELECT 
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
        c."createdAt",
        c."updatedAt",
        cat.id as "categoryId",
        cat.name as "categoryName"
      FROM "Course" c
      LEFT JOIN "CourseCategory" cat ON cat.id = c."categoryId"
      WHERE c.id = $1 AND c."instituteId" = $2 AND c."deletedAt" IS NULL
      LIMIT 1`,
      [courseId, instituteId]
    );

    if (courseRows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Course not found in this institute' },
        { status: 404 }
      );
    }

    const course = courseRows[0];

    // 3. Fetch all instructors for this course
    const instructors = await queryDb<any>(
      `SELECT 
        ci.id,
        ci.role,
        ci."teacherProfileId",
        u.id as "userId",
        u."fullName",
        u.email,
        u."avatarUrl"
      FROM "CourseInstructor" ci
      JOIN "TeacherProfile" tp ON tp.id = ci."teacherProfileId"
      JOIN "Membership" m ON m.id = tp."membershipId"
      JOIN "User" u ON u.id = m."userId"
      WHERE ci."courseId" = $1 AND ci."instituteId" = $2
      ORDER BY ci.role ASC, u."fullName" ASC`,
      [courseId, instituteId]
    );

    // 4. Fetch assigned batches for this teacher in this course
    const assignedBatches = await queryDb<any>(
      `SELECT 
        b.id,
        b.name,
        b.code,
        b.status,
        COALESCE((
          SELECT COUNT(*)::int
          FROM "Enrolment" e
          WHERE e."batchId" = b.id AND e.status = 'ACTIVE'
        ), 0) as "studentCount"
      FROM "BatchTeacher" bt
      JOIN "Batch" b ON b.id = bt."batchId"
      WHERE bt."teacherProfileId" = $1 AND b."courseId" = $2 AND bt."instituteId" = $3
      ORDER BY b.name ASC`,
      [teacherProfileId, courseId, instituteId]
    );

    // 5. Fetch Modules
    const modules = await queryDb<any>(
      `SELECT id, title, position, "createdAt", "updatedAt"
       FROM "Module"
       WHERE "courseId" = $1 AND "instituteId" = $2
       ORDER BY position ASC, "createdAt" ASC`,
      [courseId, instituteId]
    );

    const moduleIds = modules.map((m) => m.id);

    // 6. Fetch Chapters
    let chapters: any[] = [];
    if (moduleIds.length > 0) {
      chapters = await queryDb<any>(
        `SELECT id, "moduleId", title, position, "createdAt", "updatedAt"
         FROM "Chapter"
         WHERE "moduleId"::text = ANY($1::text[]) AND "instituteId" = $2
         ORDER BY position ASC, "createdAt" ASC`,
        [moduleIds, instituteId]
      );
    }

    const chapterIds = chapters.map((ch) => ch.id);

    // 7. Fetch Lessons
    let lessons: any[] = [];
    if (chapterIds.length > 0) {
      lessons = await queryDb<any>(
        `SELECT id, "chapterId", title, type, body, "durationSec", "isPreview", "isMandatory", position, "createdAt", "updatedAt"
         FROM "Lesson"
         WHERE "chapterId"::text = ANY($1::text[]) AND "instituteId" = $2
         ORDER BY position ASC, "createdAt" ASC`,
        [chapterIds, instituteId]
      );
    }

    const lessonIds = lessons.map((l) => l.id);

    // 8. Fetch LessonResources and MediaAssets
    let resources: any[] = [];
    if (lessonIds.length > 0) {
      resources = await queryDb<any>(
        `SELECT 
          lr.id,
          lr."lessonId",
          lr."mediaAssetId",
          lr.downloadable,
          lr."createdAt",
          ma."storageKey",
          ma.kind,
          ma."mimeType",
          ma."sizeBytes"::text as "sizeBytes"
        FROM "LessonResource" lr
        JOIN "MediaAsset" ma ON ma.id = lr."mediaAssetId"
        WHERE lr."lessonId"::text = ANY($1::text[]) AND lr."instituteId" = $2
        ORDER BY lr."createdAt" ASC`,
        [lessonIds, instituteId]
      );
    }

    // Assemble the complete tree
    const resourcesByLesson = new Map<string, any[]>();
    for (const r of resources) {
      const list = resourcesByLesson.get(r.lessonId) || [];
      list.push({
        id: r.id,
        lessonId: r.lessonId,
        mediaAssetId: r.mediaAssetId,
        storageKey: r.storageKey,
        kind: r.kind,
        mimeType: r.mimeType,
        sizeBytes: r.sizeBytes || '0',
        downloadable: r.downloadable,
        createdAt: new Date(r.createdAt).toISOString(),
      });
      resourcesByLesson.set(r.lessonId, list);
    }

    let totalDurationSec = 0;
    const lessonsByChapter = new Map<string, any[]>();
    for (const l of lessons) {
      totalDurationSec += l.durationSec || 0;
      const list = lessonsByChapter.get(l.chapterId) || [];
      list.push({
        id: l.id,
        title: l.title,
        type: l.type,
        body: l.body,
        durationSec: l.durationSec,
        isPreview: l.isPreview,
        isMandatory: l.isMandatory,
        position: l.position,
        resources: resourcesByLesson.get(l.id) || [],
        createdAt: new Date(l.createdAt).toISOString(),
        updatedAt: new Date(l.updatedAt).toISOString(),
      });
      lessonsByChapter.set(l.chapterId, list);
    }

    const chaptersByModule = new Map<string, any[]>();
    for (const ch of chapters) {
      const list = chaptersByModule.get(ch.moduleId) || [];
      list.push({
        id: ch.id,
        title: ch.title,
        position: ch.position,
        lessons: lessonsByChapter.get(ch.id) || [],
        createdAt: new Date(ch.createdAt).toISOString(),
        updatedAt: new Date(ch.updatedAt).toISOString(),
      });
      chaptersByModule.set(ch.moduleId, list);
    }

    const fullModules = modules.map((m) => ({
      id: m.id,
      title: m.title,
      position: m.position,
      chapters: chaptersByModule.get(m.id) || [],
      createdAt: new Date(m.createdAt).toISOString(),
      updatedAt: new Date(m.updatedAt).toISOString(),
    }));

    return NextResponse.json({
      success: true,
      course: {
        id: course.id,
        title: course.title,
        slug: course.slug,
        description: course.description,
        coverImage: course.coverImage,
        level: course.level,
        language: course.language,
        pricing: course.pricing,
        price: course.price,
        salePrice: course.salePrice,
        status: course.status,
        category: course.categoryName || 'Uncategorized',
        categoryId: course.categoryId,
        role: assignedRole,
        instructors: instructors.map((ci) => ({
          id: ci.id,
          role: ci.role,
          teacherProfileId: ci.teacherProfileId,
          fullName: ci.fullName,
          email: ci.email,
          avatarUrl: ci.avatarUrl,
        })),
        assignedBatches,
        summary: {
          moduleCount: modules.length,
          chapterCount: chapters.length,
          lessonCount: lessons.length,
          resourceCount: resources.length,
          totalDurationMinutes: Math.round(totalDurationSec / 60),
        },
        modules: fullModules,
        createdAt: new Date(course.createdAt).toISOString(),
        updatedAt: new Date(course.updatedAt).toISOString(),
      },
    });
  } catch (err: any) {
    if (err instanceof TeacherAuthError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.statusCode }
      );
    }
    console.error('Teacher course detail route error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error while fetching course curriculum' },
      { status: 500 }
    );
  }
}
