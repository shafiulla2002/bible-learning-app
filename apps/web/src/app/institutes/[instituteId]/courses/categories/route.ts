import { NextRequest, NextResponse } from 'next/server';
import { queryDb, resolveServerAdminContext } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function GET(
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

    const rows = await queryDb(
      `SELECT id, name, slug, description
       FROM "CourseCategory"
       WHERE "instituteId" = $1
       ORDER BY name ASC`,
      [effectiveInstituteId]
    );

    return NextResponse.json(rows);
  } catch (error: any) {
    console.error('Error in course categories GET:', error);
    return NextResponse.json(
      { message: error?.message || 'Failed to fetch categories' },
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
    const { name, slug, description } = body;

    if (!name || !slug) {
      return NextResponse.json({ message: 'Name and slug are required' }, { status: 400 });
    }

    const rows = await queryDb(
      `INSERT INTO "CourseCategory" (id, "instituteId", name, slug, description)
       VALUES (gen_random_uuid(), $1, $2, $3, $4)
       RETURNING id, name, slug, description`,
      [effectiveInstituteId, name, slug, description || null]
    );

    return NextResponse.json(rows[0], { status: 201 });
  } catch (error: any) {
    console.error('Error in course categories POST:', error);
    return NextResponse.json(
      { message: error?.message || 'Failed to create category' },
      { status: 500 }
    );
  }
}

