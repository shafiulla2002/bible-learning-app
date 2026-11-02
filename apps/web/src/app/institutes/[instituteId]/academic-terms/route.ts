import { NextRequest, NextResponse } from 'next/server';
import { queryDb } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ instituteId: string }> }
) {
  try {
    const { instituteId } = await params;
    const { searchParams } = new URL(request.url);
    const academicYearId = searchParams.get('academicYearId');

    let query = `
      SELECT t.*, y.name as "academicYearName"
      FROM "AcademicTerm" t
      JOIN "AcademicYear" y ON y.id = t."academicYearId"
      WHERE t."instituteId" = $1
    `;
    const qParams: any[] = [instituteId];

    if (academicYearId) {
      qParams.push(academicYearId);
      query += ` AND t."academicYearId" = $${qParams.length}`;
    }

    query += ` ORDER BY t."startDate" ASC`;

    const terms = await queryDb(query, qParams);
    return NextResponse.json(terms);
  } catch (error: any) {
    console.error('Error fetching academic terms:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ instituteId: string }> }
) {
  try {
    const { instituteId } = await params;
    const body = await request.json();

    const { academicYearId, name, startDate, endDate, isCurrent } = body;

    if (!academicYearId || !name || !startDate || !endDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (isCurrent) {
      await queryDb(
        `UPDATE "AcademicTerm" SET "isCurrent" = false, "updatedAt" = NOW() WHERE "instituteId" = $1`,
        [instituteId]
      );
    }

    const inserted = await queryDb(
      `INSERT INTO "AcademicTerm" (
        id, "instituteId", "academicYearId", name, "startDate", "endDate", "isCurrent", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4::timestamp, $5::timestamp, $6, NOW(), NOW()
      ) RETURNING *`,
      [instituteId, academicYearId, name, startDate, endDate, isCurrent || false]
    );

    return NextResponse.json(inserted[0], { status: 201 });
  } catch (error: any) {
    console.error('Error creating academic term:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
