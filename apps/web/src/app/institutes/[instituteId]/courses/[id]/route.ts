import { NextRequest, NextResponse } from 'next/server';
import { queryDb, resolveServerAdminContext } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ instituteId: string; id: string }> }
) {
  try {
    const { instituteId, id } = await params;
    const ctx = await resolveServerAdminContext();
    const effectiveInstituteId =
      instituteId && instituteId !== 'null' && instituteId !== 'undefined'
        ? instituteId
        : ctx.instituteId;

    const courseRows = await queryDb(
      `SELECT
         c.id, c."instituteId", c."categoryId", c.title, c.slug, c.description,
         c.level, c.price, c.pricing, c.status, c."coverImage",
         cat.name as "categoryName", cat.slug as "categorySlug"
       FROM "Course" c
       LEFT JOIN "CourseCategory" cat ON cat.id = c."categoryId"
       WHERE c.id = $1 AND c."instituteId" = $2`,
      [id, effectiveInstituteId]
    );

    if (courseRows.length === 0) {
      return NextResponse.json({ message: 'Course not found' }, { status: 404 });
    }

    const c = courseRows[0];

    // Modules
    const modules = await queryDb(
      `SELECT id, title, position
       FROM "Module"
       WHERE "courseId" = $1
       ORDER BY position ASC`,
      [id]
    );

    const fullModules = [];
    for (const m of modules) {
      const chapters = await queryDb(
        `SELECT id, title, position
         FROM "Chapter"
         WHERE "moduleId" = $1
         ORDER BY position ASC`,
        [m.id]
      );

      const fullChapters = [];
      for (const ch of chapters) {
        const lessons = await queryDb(
          `SELECT id, title, type, body, "durationSec", "isPreview", "isMandatory", position
           FROM "Lesson"
           WHERE "chapterId" = $1
           ORDER BY position ASC`,
          [ch.id]
        );
        fullChapters.push({
          ...ch,
          lessons,
        });
      }

      fullModules.push({
        ...m,
        chapters: fullChapters,
      });
    }

    return NextResponse.json({
      id: c.id,
      instituteId: c.instituteId,
      categoryId: c.categoryId,
      category: {
        id: c.categoryId,
        name: c.categoryName || 'Theology',
        slug: c.categorySlug || 'theology',
      },
      title: c.title,
      slug: c.slug,
      description: c.description,
      level: c.level,
      language: 'English',
      price: c.price,
      pricing: c.pricing,
      status: c.status,
      coverImage: c.coverImage,
      modules: fullModules,
    });
  } catch (error: any) {
    console.error('Error in /institutes/[instituteId]/courses/[id] GET:', error);
    return NextResponse.json(
      { message: error?.message || 'Failed to fetch course detail' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ instituteId: string; id: string }> }
) {
  try {
    const { instituteId, id } = await params;
    const ctx = await resolveServerAdminContext();
    const effectiveInstituteId =
      instituteId && instituteId !== 'null' && instituteId !== 'undefined'
        ? instituteId
        : ctx.instituteId;

    const body = await request.json();
    const { title, description, level, price, pricing, categoryId } = body;

    await queryDb(
      `UPDATE "Course"
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           level = COALESCE($3, level),
           price = COALESCE($4, price),
           pricing = COALESCE($5, pricing),
           "categoryId" = COALESCE($6, "categoryId"),
           "updatedAt" = NOW()
       WHERE id = $7 AND "instituteId" = $8`,
      [title, description, level, price, pricing, categoryId, id, effectiveInstituteId]
    );

    return NextResponse.json({ message: 'Course updated successfully' });
  } catch (error: any) {
    console.error('Error in /institutes/[instituteId]/courses/[id] PUT:', error);
    return NextResponse.json(
      { message: error?.message || 'Failed to update course' },
      { status: 500 }
    );
  }
}

