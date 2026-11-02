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
         u."avatarUrl",
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
         e."progressPct",
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
      avatarUrl: s.avatarUrl,
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
      status,
      avatarUrl,
    } = body;

    // Check student profile
    const existing = await queryDb(
      `SELECT sp.id, sp."membershipId", m."userId"
       FROM "StudentProfile" sp
       JOIN "Membership" m ON m.id = sp."membershipId"
       WHERE sp.id = $1 AND sp."instituteId" = $2`,
      [id, effectiveInstituteId]
    );

    if (existing.length === 0) {
      return NextResponse.json({ message: 'Student profile not found' }, { status: 404 });
    }

    const { membershipId, userId } = existing[0];

    // Update User
    if (fullName || phoneNumber || email !== undefined || avatarUrl !== undefined) {
      await queryDb(
        `UPDATE "User"
         SET "fullName" = COALESCE($1, "fullName"),
             "phoneE164" = COALESCE($2, "phoneE164"),
             email = COALESCE($3, email),
             "avatarUrl" = COALESCE($4, "avatarUrl"),
             "updatedAt" = NOW()
         WHERE id = $5`,
        [fullName || null, phoneNumber || null, email, avatarUrl, userId]
      );
    }

    // Update StudentProfile
    await queryDb(
      `UPDATE "StudentProfile"
       SET gender = COALESCE($1, gender),
           "dateOfBirth" = COALESCE($2, "dateOfBirth"),
           church = COALESCE($3, church),
           "preferredLanguage" = COALESCE($4, "preferredLanguage"),
           address = COALESCE($5, address),
           guardian = COALESCE($6, guardian),
           status = COALESCE($7, status),
           "updatedAt" = NOW()
       WHERE id = $8 AND "instituteId" = $9`,
      [
        gender || null,
        dateOfBirth ? new Date(dateOfBirth) : null,
        church || null,
        preferredLanguage || null,
        address ? JSON.stringify(address) : null,
        guardian ? JSON.stringify(guardian) : null,
        status || null,
        id,
        effectiveInstituteId,
      ]
    );

    // Update Membership status if status changed
    if (status) {
      const memStatus = status === 'ACTIVE' ? 'ACTIVE' : 'SUSPENDED';
      await queryDb(
        `UPDATE "Membership" SET status = $1, "updatedAt" = NOW() WHERE id = $2`,
        [memStatus, membershipId]
      );
    }

    // Return updated details
    return GET(request, { params });
  } catch (error: any) {
    console.error('Error in /institutes/[instituteId]/students/[id] PATCH:', error);
    return NextResponse.json(
      { message: error?.message || 'Failed to update student profile' },
      { status: 500 }
    );
  }
}
