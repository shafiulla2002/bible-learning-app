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
    const status = searchParams.get('status');
    const courseId = searchParams.get('courseId');
    const termId = searchParams.get('termId');

    let whereClause = `WHERE b."instituteId" = $1`;
    const queryParams: any[] = [effectiveInstituteId];

    if (status && status !== 'ALL') {
      queryParams.push(status);
      whereClause += ` AND b.status = $${queryParams.length}`;
    }

    if (courseId && courseId !== 'ALL') {
      queryParams.push(courseId);
      whereClause += ` AND b."courseId" = $${queryParams.length}`;
    }

    if (termId && termId !== 'ALL') {
      queryParams.push(termId);
      whereClause += ` AND b."termId" = $${queryParams.length}`;
    }

    const rows = await queryDb(
      `SELECT
         b.id,
         b."instituteId",
         b."courseId",
         b.name,
         b.code,
         b.status,
         b."startDate",
         b."endDate",
         b.capacity,
         b."academicYearId",
         b."termId",
         c.title as "courseTitle",
         c.slug as "courseSlug",
         ay.name as "academicYearName",
         ay."isCurrent" as "academicYearIsCurrent",
         at.name as "academicTermName",
         at."isCurrent" as "academicTermIsCurrent",
         (SELECT COUNT(*)::int FROM "Enrolment" e WHERE e."batchId" = b.id AND e.status = 'ACTIVE') as "enrolmentsCount",
         (SELECT COUNT(*)::int FROM "BatchTeacher" bt WHERE bt."batchId" = b.id) as "teachersCount",
         (SELECT COUNT(*)::int FROM "LiveSession" ls WHERE ls."batchId" = b.id) as "liveSessionsCount"
       FROM "Batch" b
       JOIN "Course" c ON c.id = b."courseId"
       LEFT JOIN "AcademicYear" ay ON ay.id = b."academicYearId"
       LEFT JOIN "AcademicTerm" at ON at.id = b."termId"
       ${whereClause}
       ORDER BY b."startDate" DESC`,
      queryParams
    );

    const data = rows.map((r) => ({
      id: r.id,
      instituteId: r.instituteId,
      courseId: r.courseId,
      name: r.name,
      code: r.code || 'BATCH',
      status: r.status,
      startDate: new Date(r.startDate).toISOString(),
      endDate: new Date(r.endDate).toISOString(),
      capacity: r.capacity || 50,
      academicYearId: r.academicYearId,
      termId: r.termId,
      course: {
        id: r.courseId,
        title: r.courseTitle,
        slug: r.courseSlug,
      },
      academicYear: r.academicYearId
        ? {
            id: r.academicYearId,
            name: r.academicYearName,
            isCurrent: r.academicYearIsCurrent,
          }
        : null,
      academicTerm: r.termId
        ? {
            id: r.termId,
            name: r.academicTermName,
            isCurrent: r.academicTermIsCurrent,
          }
        : null,
      _count: {
        enrolments: r.enrolmentsCount || 0,
        teachers: r.teachersCount || 0,
        liveSessions: r.liveSessionsCount || 0,
      },
    }));

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in /institutes/[instituteId]/batches GET:', error);
    return NextResponse.json(
      { message: error?.message || 'Failed to fetch batches' },
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
      name,
      code,
      courseId,
      academicYearId,
      termId,
      startDate,
      endDate,
      capacity = 50,
      status = 'ACTIVE',
    } = body;

    if (!name || !startDate || !endDate) {
      return NextResponse.json(
        { message: 'Batch name, start date, and end date are required' },
        { status: 400 }
      );
    }

    // Default course if courseId is 'c1' or not found
    let finalCourseId = courseId;
    const verifiedCourse = await queryDb(
      `SELECT id FROM "Course" WHERE id = $1 AND "instituteId" = $2`,
      [courseId, effectiveInstituteId]
    );
    if (verifiedCourse.length === 0) {
      const firstCourse = await queryDb(
        `SELECT id FROM "Course" WHERE "instituteId" = $1 ORDER BY "createdAt" ASC LIMIT 1`,
        [effectiveInstituteId]
      );
      finalCourseId = firstCourse[0]?.id;
    }

    // Default Academic Year & Term
    let finalYearId = academicYearId;
    let finalTermId = termId;
    if (!finalYearId) {
      const year = await queryDb(
        `SELECT id FROM "AcademicYear" WHERE "instituteId" = $1 ORDER BY "isCurrent" DESC LIMIT 1`,
        [effectiveInstituteId]
      );
      finalYearId = year[0]?.id;
    }
    if (!finalTermId) {
      const term = await queryDb(
        `SELECT id FROM "AcademicTerm" WHERE "instituteId" = $1 ORDER BY "isCurrent" DESC LIMIT 1`,
        [effectiveInstituteId]
      );
      finalTermId = term[0]?.id;
    }

    const batchCode = code || `B-${Date.now().toString().slice(-4)}`;

    const rows = await queryDb(
      `INSERT INTO "Batch" (id, "instituteId", "courseId", "academicYearId", "termId", name, code, status, "startDate", "endDate", capacity, "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       RETURNING id, "instituteId", "courseId", name, code, status, "startDate", "endDate", capacity`,
      [
        effectiveInstituteId,
        finalCourseId,
        finalYearId || null,
        finalTermId || null,
        name,
        batchCode,
        status,
        new Date(startDate),
        new Date(endDate),
        capacity,
      ]
    );

    return NextResponse.json(rows[0], { status: 201 });
  } catch (error: any) {
    console.error('Error in /institutes/[instituteId]/batches POST:', error);
    return NextResponse.json(
      { message: error?.message || 'Failed to create batch' },
      { status: 500 }
    );
  }
}

