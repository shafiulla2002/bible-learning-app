import { NextRequest, NextResponse } from 'next/server';
import { queryDb, resolveServerAdminContext } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ instituteId: string }> }
) {
  try {
    const { instituteId } = await params;
    const ctx = await resolveServerAdminContext();
    const effectiveInstituteId =
      instituteId && instituteId !== 'null' && instituteId !== 'undefined' && instituteId !== 'inst-1'
        ? instituteId
        : ctx.instituteId;

    const body = await request.json();
    const {
      name,
      code,
      categoryName = 'Tuition & Academic Fees',
      periodType = 'SEMESTER',
      amountInRupees,
      amountPaise,
      description,
    } = body;

    const finalAmountPaise =
      amountPaise !== undefined ? Number(amountPaise) : Math.round(Number(amountInRupees || 0) * 100);

    if (!name || finalAmountPaise <= 0) {
      return NextResponse.json(
        { message: 'Structure name and positive amount are required' },
        { status: 400 }
      );
    }

    // 1. Find or create FeeCategory
    const catCode = categoryName.toUpperCase().replace(/[^A-Z0-9]+/g, '_').slice(0, 20);
    const existingCat = await queryDb(
      `SELECT id FROM "FeeCategory" WHERE "instituteId" = $1 AND (code = $2 OR name = $3) LIMIT 1`,
      [effectiveInstituteId, catCode, categoryName]
    );

    let feeCategoryId: string;
    if (existingCat.length > 0) {
      feeCategoryId = existingCat[0].id;
    } else {
      const newCat = await queryDb(
        `INSERT INTO "FeeCategory" (id, "instituteId", name, code, description, "isActive", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
         RETURNING id`,
        [effectiveInstituteId, categoryName, catCode, `${categoryName} Category`]
      );
      feeCategoryId = newCat[0].id;
    }

    // 2. Current academic year
    const yearRows = await queryDb(
      `SELECT id FROM "AcademicYear" WHERE "instituteId" = $1 ORDER BY "isCurrent" DESC LIMIT 1`,
      [effectiveInstituteId]
    );
    const academicYearId = yearRows[0]?.id || null;

    const structCode =
      code || `FEE-${name.toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, 10)}-${Date.now().toString().slice(-3)}`;

    const inserted = await queryDb(
      `INSERT INTO "FeeStructure" (
        id, "instituteId", "feeCategoryId", "academicYearId", name, code, "periodType", amount, currency, description, "isActive", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, 'INR', $8, true, NOW(), NOW()
      ) RETURNING *`,
      [
        effectiveInstituteId,
        feeCategoryId,
        academicYearId,
        name,
        structCode,
        periodType,
        finalAmountPaise,
        description || null,
      ]
    );

    return NextResponse.json(inserted[0], { status: 201 });
  } catch (error: any) {
    console.error('Error creating fee structure:', error);
    return NextResponse.json(
      { message: error?.message || 'Failed to create fee structure' },
      { status: 500 }
    );
  }
}

