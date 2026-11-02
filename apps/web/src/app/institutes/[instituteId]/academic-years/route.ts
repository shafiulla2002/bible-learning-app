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
      `SELECT id, "instituteId", name, "startDate", "endDate", "isCurrent"
       FROM "AcademicYear"
       WHERE "instituteId" = $1
       ORDER BY "startDate" DESC`,
      [effectiveInstituteId]
    );

    return NextResponse.json(rows);
  } catch (error: any) {
    console.error('Error in academic-years GET:', error);
    return NextResponse.json(
      { message: error?.message || 'Failed to fetch academic years' },
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
    const { name, startDate, endDate, isCurrent = false } = body;

    if (!name || !startDate || !endDate) {
      return NextResponse.json({ message: 'Name, start date, and end date are required' }, { status: 400 });
    }

    if (isCurrent) {
      await queryDb(`UPDATE "AcademicYear" SET "isCurrent" = false WHERE "instituteId" = $1`, [effectiveInstituteId]);
    }

    const rows = await queryDb(
      `INSERT INTO "AcademicYear" (id, "instituteId", name, "startDate", "endDate", "isCurrent", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())
       RETURNING id, "instituteId", name, "startDate", "endDate", "isCurrent"`,
      [effectiveInstituteId, name, new Date(startDate), new Date(endDate), isCurrent]
    );

    return NextResponse.json(rows[0], { status: 201 });
  } catch (error: any) {
    console.error('Error in academic-years POST:', error);
    return NextResponse.json(
      { message: error?.message || 'Failed to create academic year' },
      { status: 500 }
    );
  }
}

