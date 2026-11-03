import { NextRequest, NextResponse } from 'next/server';
import { queryDb, resolveServerAdminContext } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ instituteId: string }> }
) {
  try {
    const { instituteId } = await params;
    let effectiveInstituteId =
      instituteId && instituteId !== 'null' && instituteId !== 'undefined'
        ? instituteId
        : '';
    if (!effectiveInstituteId) {
      const ctx = await resolveServerAdminContext();
      effectiveInstituteId = ctx.instituteId;
    }

    const { searchParams } = new URL(request.url);
    const search = (searchParams.get('search') || '').trim();
    const status = (searchParams.get('status') || 'ALL').toUpperCase();
    const categoryId = searchParams.get('categoryId') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const offset = (page - 1) * limit;

    let whereClause = `WHERE c."instituteId" = $1`;
    const queryParams: any[] = [effectiveInstituteId];

    if (status !== 'ALL') {
      queryParams.push(status);
      whereClause += ` AND c.status = $${queryParams.length}`;
    }

    if (categoryId && categoryId !== 'ALL') {
      queryParams.push(categoryId);
      whereClause += ` AND c."categoryId" = $${queryParams.length}`;
    }

    if (search) {
      queryParams.push(`%${search}%`);
      const pIdx = queryParams.length;
      whereClause += ` AND (c.title ILIKE $${pIdx} OR c.description ILIKE $${pIdx} OR c.slug ILIKE $${pIdx})`;
    }

    const countRows = await queryDb(
      `SELECT COUNT(c.id)::int as total FROM "Course" c ${whereClause}`,
      queryParams
    );
    const total = countRows[0]?.total || 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const rows = await queryDb(
      `SELECT
         c.id,
         c."instituteId",
         c."categoryId",
         c.title,
         c.slug,
         c.description,
         c.level,
         c.price,
         c.pricing,
         c.status,
         c."coverImage",
         c."createdAt",
         cat.name as "categoryName",
         cat.slug as "categorySlug",
         (SELECT COUNT(*)::int FROM "Enrolment" e WHERE e."courseId" = c.id AND e.status = 'ACTIVE') as "enrolmentsCount",
         (SELECT COUNT(*)::int FROM "Batch" b WHERE b."courseId" = c.id AND b.status = 'ACTIVE') as "batchesCount",
         (SELECT COUNT(*)::int FROM "CourseInstructor" ci WHERE ci."courseId" = c.id) as "instructorsCount"
       FROM "Course" c
       LEFT JOIN "CourseCategory" cat ON cat.id = c."categoryId"
       ${whereClause}
       ORDER BY c."createdAt" DESC
       LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`,
      [...queryParams, limit, offset]
    );

    const data = rows.map((r) => ({
      id: r.id,
      instituteId: r.instituteId,
      categoryId: r.categoryId,
      category: {
        id: r.categoryId,
        name: r.categoryName || 'General Theology',
        slug: r.categorySlug || 'theology',
      },
      title: r.title,
      slug: r.slug,
      description: r.description,
      level: r.level,
      language: 'English',
      price: r.price,
      pricing: r.pricing,
      status: r.status,
      coverImage: r.coverImage,
      _count: {
        enrolments: r.enrolmentsCount || 0,
        batches: r.batchesCount || 0,
        instructors: r.instructorsCount || 0,
      },
    }));

    return NextResponse.json({
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    });
  } catch (error: any) {
    console.error('Error in /institutes/[instituteId]/courses GET:', error);
    return NextResponse.json(
      { message: error?.message || 'Failed to fetch courses' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ instituteId: string }> }
) {
  try {
    const { instituteId } = await params;
    const ctx = await resolveServerAdminContext();
    const effectiveInstituteId =
      instituteId && instituteId !== 'null' && instituteId !== 'undefined'
        ? instituteId
        : ctx.instituteId;

    const body = await request.json();
    const {
      title,
      categoryId,
      description = '',
      level = 'BEGINNER',
      price = 0,
      pricing = 'FREE',
      status = 'DRAFT',
    } = body;

    if (!title) {
      return NextResponse.json({ message: 'Course title is required' }, { status: 400 });
    }

    // Auto slug
    const slugBase = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const slug = `${slugBase}-${Date.now().toString().slice(-4)}`;

    // Verify or assign default category
    let finalCategoryId = categoryId;
    if (!finalCategoryId) {
      const defaultCat = await queryDb(
        `SELECT id FROM "CourseCategory" WHERE "instituteId" = $1 LIMIT 1`,
        [effectiveInstituteId]
      );
      if (defaultCat.length > 0) {
        finalCategoryId = defaultCat[0].id;
      } else {
        const newCat = await queryDb(
          `INSERT INTO "CourseCategory" (id, "instituteId", name, slug)
           VALUES (gen_random_uuid(), $1, 'Biblical Theology', 'biblical-theology')
           RETURNING id`,
          [effectiveInstituteId]
        );
        finalCategoryId = newCat[0].id;
      }
    }

    const newCourseRows = await queryDb(
      `INSERT INTO "Course" (id, "instituteId", "categoryId", title, slug, description, level, price, pricing, status, "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       RETURNING id, "instituteId", "categoryId", title, slug, description, level, price, pricing, status, "createdAt"`,
      [effectiveInstituteId, finalCategoryId, title, slug, description, level, price, pricing, status]
    );

    const c = newCourseRows[0];
    return NextResponse.json(
      {
        id: c.id,
        instituteId: c.instituteId,
        categoryId: c.categoryId,
        title: c.title,
        slug: c.slug,
        description: c.description,
        level: c.level,
        price: c.price,
        pricing: c.pricing,
        status: c.status,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error in /institutes/[instituteId]/courses POST:', error);
    return NextResponse.json(
      { message: error?.message || 'Failed to create course' },
      { status: 500 }
    );
  }
}

