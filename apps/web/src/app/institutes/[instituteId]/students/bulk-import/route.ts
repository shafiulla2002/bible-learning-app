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
      instituteId && instituteId !== 'null' && instituteId !== 'undefined'
        ? instituteId
        : ctx.instituteId;

    const body = await request.json();
    const { rows = [], execute = false } = body;

    const results = {
      totalRows: rows.length,
      validRows: 0,
      invalidRows: 0,
      duplicates: 0,
      errors: [] as Array<{ row: number; error: string; data: any }>,
      importedCount: 0,
    };

    const currentYear = new Date().getFullYear();
    const prefix = `ADM-${currentYear}-`;

    const lastAdmission = await queryDb(
      `SELECT "admissionNo" FROM "StudentProfile"
       WHERE "instituteId" = $1 AND "admissionNo" LIKE $2
       ORDER BY "admissionNo" DESC LIMIT 1`,
      [effectiveInstituteId, `${prefix}%`]
    );

    let nextNum = 1;
    if (lastAdmission[0]?.admissionNo) {
      const parts = lastAdmission[0].admissionNo.split('-');
      const parsed = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(parsed)) nextNum = parsed + 1;
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;

      if (!row.fullName || !row.phoneNumber) {
        results.invalidRows++;
        results.errors.push({ row: rowNum, error: 'Full name and phone number are required', data: row });
        continue;
      }

      results.validRows++;

      if (execute) {
        try {
          const admissionNo = `${prefix}${String(nextNum++).padStart(4, '0')}`;

          // Find or create User
          const existingUser = await queryDb(
            `SELECT id FROM "User" WHERE "phoneE164" = $1`,
            [row.phoneNumber]
          );

          let userId: string;
          if (existingUser.length > 0) {
            userId = existingUser[0].id;
            await queryDb(
              `UPDATE "User"
               SET "fullName" = $1, email = COALESCE($2, email), "updatedAt" = NOW()
               WHERE id = $3`,
              [row.fullName, row.email || null, userId]
            );
          } else {
            const newUser = await queryDb(
              `INSERT INTO "User" (id, "phoneE164", "fullName", email, status, "updatedAt")
               VALUES (gen_random_uuid(), $1, $2, $3, 'ACTIVE', NOW())
               RETURNING id`,
              [row.phoneNumber, row.fullName, row.email || null]
            );
            userId = newUser[0].id;
          }

          // Membership
          const existingMembership = await queryDb(
            `SELECT id FROM "Membership" WHERE "userId" = $1 AND "instituteId" = $2 AND role = 'STUDENT'`,
            [userId, effectiveInstituteId]
          );

          let membershipId: string;
          if (existingMembership.length > 0) {
            membershipId = existingMembership[0].id;
          } else {
            const newMem = await queryDb(
              `INSERT INTO "Membership" (id, "userId", "instituteId", role, status, "updatedAt")
               VALUES (gen_random_uuid(), $1, $2, 'STUDENT', 'ACTIVE', NOW())
               RETURNING id`,
              [userId, effectiveInstituteId]
            );
            membershipId = newMem[0].id;
          }

          // StudentProfile
          const profileRows = await queryDb(
            `INSERT INTO "StudentProfile" (id, "instituteId", "membershipId", "admissionNo", gender, church, "preferredLanguage", status, "updatedAt")
             VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'English', 'ACTIVE', NOW())
             RETURNING id`,
            [effectiveInstituteId, membershipId, admissionNo, row.gender || 'Male', row.church || null]
          );
          const studentProfileId = profileRows[0]?.id;

          // Admission
          await queryDb(
            `INSERT INTO "Admission" (id, "instituteId", "studentProfileId", status, statement, "createdAt", "updatedAt")
             VALUES (gen_random_uuid(), $1, $2, 'ACTIVE', 'Bulk imported', NOW(), NOW())`,
            [effectiveInstituteId, studentProfileId]
          );

          results.importedCount++;
        } catch (err: any) {
          results.invalidRows++;
          results.errors.push({ row: rowNum, error: err?.message || 'Database error', data: row });
        }
      }
    }

    return NextResponse.json(results);
  } catch (error: any) {
    console.error('Error in bulk-import route:', error);
    return NextResponse.json(
      { message: error?.message || 'Failed to process bulk import' },
      { status: 500 }
    );
  }
}

