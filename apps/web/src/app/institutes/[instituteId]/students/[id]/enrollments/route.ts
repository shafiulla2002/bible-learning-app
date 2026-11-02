import { NextRequest, NextResponse } from 'next/server';
import { queryDb, resolveServerAdminContext } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function POST(
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
    const { courseId, batchId } = body;

    if (!courseId) {
      return NextResponse.json({ message: 'Course ID is required' }, { status: 400 });
    }

    // Verify course belongs to institute
    const courseRows = await queryDb(
      `SELECT id, title FROM "Course" WHERE id = $1 AND "instituteId" = $2`,
      [courseId, effectiveInstituteId]
    );

    if (courseRows.length === 0) {
      return NextResponse.json({ message: 'Course not found in this institute' }, { status: 404 });
    }

    // Insert Enrolment
    const enrRows = await queryDb(
      `INSERT INTO "Enrolment" (id, "instituteId", "studentProfileId", "courseId", "batchId", source, status, "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'ADMIN', 'ACTIVE', NOW())
       RETURNING id, "studentProfileId", "courseId", "batchId", status`,
      [effectiveInstituteId, id, courseId, batchId || null]
    );

    return NextResponse.json(enrRows[0], { status: 201 });
  } catch (error: any) {
    console.error('Error in student enrollment route:', error);
    return NextResponse.json(
      { message: error?.message || 'Failed to enroll student' },
      { status: 500 }
    );
  }
}

