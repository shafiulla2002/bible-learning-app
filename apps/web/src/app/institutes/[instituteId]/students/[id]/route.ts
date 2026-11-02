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

    const studentRows = await queryDb(
      `SELECT
         sp.id,
         u.id as "userId",
         sp."admissionNo",
         u."fullName",
         u."phoneE164" as "phoneNumber",
         u.email,
         sp."preferredLanguage",
         sp.gender,
         sp."dateOfBirth",
         sp.church,
         sp.address,
         sp.guardian,
         sp.status,
         sp."createdAt" as "admissionDate"
       FROM "StudentProfile" sp
       JOIN "Membership" m ON m.id = sp."membershipId"
       JOIN "User" u ON u.id = m."userId"
       WHERE sp.id = $1 AND sp."instituteId" = $2`,
      [id, effectiveInstituteId]
    );

    if (studentRows.length === 0) {
      return NextResponse.json({ message: 'Student profile not found' }, { status: 404 });
    }

    const s = studentRows[0];

    // Enrolments
    const enrolments = await queryDb(
      `SELECT
         e.id,
         e."courseId",
         c.title as "courseTitle",
         e."batchId",
         b.name as "batchName",
         e.status,
         0 as "progressPct",
         e."createdAt" as "enrolledAt"
       FROM "Enrolment" e
       JOIN "Course" c ON c.id = e."courseId"
       LEFT JOIN "Batch" b ON b.id = e."batchId"
       WHERE e."studentProfileId" = $1
       ORDER BY e."createdAt" DESC`,
      [id]
    );

    // Admission History
    const admissions = await queryDb(
      `SELECT id, status, statement, "createdAt"
       FROM "Admission"
       WHERE "studentProfileId" = $1
       ORDER BY "createdAt" DESC`,
      [id]
    );

    return NextResponse.json({
      id: s.id,
      userId: s.userId,
      admissionNo: s.admissionNo,
      fullName: s.fullName,
      phoneNumber: s.phoneNumber,
      email: s.email,
      preferredLanguage: s.preferredLanguage || 'English',
      gender: s.gender,
      dateOfBirth: s.dateOfBirth ? new Date(s.dateOfBirth).toISOString() : undefined,
      church: s.church,
      address: s.address,
      guardian: s.guardian,
      status: s.status,
      admissionDate: new Date(s.admissionDate).toISOString(),
      enrolledCourseName: enrolments[0]?.courseTitle,
      enrolledBatchName: enrolments[0]?.batchName,
      totalEnrolments: enrolments.length,
      enrolments,
      admissionHistory: admissions,
    });
  } catch (error: any) {
    console.error('Error in /institutes/[instituteId]/students/[id] GET:', error);
    return NextResponse.json(
      { message: error?.message || 'Failed to fetch student details' },
      { status: 500 }
    );
  }
}

export async function PATCH(
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
    const {
      fullName,
      phoneNumber,
      email,
      gender,
      dateOfBirth,
      church,
      preferredLanguage,
      address,
      guardian,
    } = body;

    // 1. Find student profile and user
    const studentRows = await queryDb(
      `SELECT sp.id, sp."membershipId", m."userId"
       FROM "StudentProfile" sp
       JOIN "Membership" m ON m.id = sp."membershipId"
       WHERE sp.id = $1 AND sp."instituteId" = $2`,
      [id, effectiveInstituteId]
    );

    if (studentRows.length === 0) {
      return NextResponse.json({ message: 'Student profile not found' }, { status: 404 });
    }

    const { userId } = studentRows[0];

    // 2. Update User if name/phone/email provided
    if (fullName || phoneNumber || email !== undefined) {
      await queryDb(
        `UPDATE "User"
         SET "fullName" = COALESCE($1, "fullName"),
             "phoneE164" = COALESCE($2, "phoneE164"),
             email = COALESCE($3, email),
             "updatedAt" = NOW()
         WHERE id = $4`,
        [fullName || null, phoneNumber || null, email || null, userId]
      );
    }

    // 3. Update StudentProfile
    await queryDb(
      `UPDATE "StudentProfile"
       SET gender = COALESCE($1, gender),
           "dateOfBirth" = CASE WHEN $2::text IS NOT NULL THEN $2::timestamp ELSE "dateOfBirth" END,
           church = COALESCE($3, church),
           "preferredLanguage" = COALESCE($4, "preferredLanguage"),
           address = CASE WHEN $5::text IS NOT NULL THEN $5::jsonb ELSE address END,
           guardian = CASE WHEN $6::text IS NOT NULL THEN $6::jsonb ELSE guardian END,
           "updatedAt" = NOW()
       WHERE id = $7 AND "instituteId" = $8`,
      [
        gender || null,
        dateOfBirth || null,
        church || null,
        preferredLanguage || null,
        address ? JSON.stringify(address) : null,
        guardian ? JSON.stringify(guardian) : null,
        id,
        effectiveInstituteId,
      ]
    );

    return NextResponse.json({ message: 'Student updated successfully' });
  } catch (error: any) {
    console.error('Error in /institutes/[instituteId]/students/[id] PATCH:', error);
    return NextResponse.json(
      { message: error?.message || 'Failed to update student' },
      { status: 500 }
    );
  }
}

