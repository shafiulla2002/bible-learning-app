import { NextRequest, NextResponse } from 'next/server';
import { queryDb, resolveServerAdminContext } from '@/lib/server-db';
import bcrypt from 'bcryptjs';

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
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
    const search = (searchParams.get('search') || '').trim();
    const status = (searchParams.get('status') || 'ALL').toUpperCase();
    const courseId = searchParams.get('courseId') || '';
    const offset = (page - 1) * limit;

    let whereClause = `WHERE sp."instituteId" = $1`;
    const queryParams: any[] = [effectiveInstituteId];

    if (status !== 'ALL') {
      queryParams.push(status);
      whereClause += ` AND sp.status = $${queryParams.length}`;
    }

    if (courseId && courseId !== 'ALL') {
      queryParams.push(courseId);
      whereClause += ` AND EXISTS (SELECT 1 FROM "Enrolment" en WHERE en."studentProfileId" = sp.id AND en."courseId" = $${queryParams.length} AND en.status = 'ACTIVE')`;
    }

    if (search) {
      queryParams.push(`%${search}%`);
      const pIdx = queryParams.length;
      whereClause += ` AND (u."fullName" ILIKE $${pIdx} OR sp."admissionNo" ILIKE $${pIdx} OR u."phoneE164" ILIKE $${pIdx} OR u.email ILIKE $${pIdx} OR sp.church ILIKE $${pIdx})`;
    }

    // Parallelize Total Count, Rows, and Live Aggregate Stats in Promise.all
    const [countRows, dataRows, statsRows] = await Promise.all([
      queryDb(
        `SELECT COUNT(sp.id)::int as "total"
         FROM "StudentProfile" sp
         JOIN "Membership" m ON m.id = sp."membershipId"
         JOIN "User" u ON u.id = m."userId"
         ${whereClause}`,
        queryParams
      ),
      queryDb(
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
           sp.church,
           sp.status,
           sp."createdAt" as "admissionDate",
           c.title as "enrolledCourseName",
           b.name as "enrolledBatchName",
           (SELECT COUNT(*)::int FROM "Enrolment" e2 WHERE e2."studentProfileId" = sp.id) as "totalEnrolments"
         FROM "StudentProfile" sp
         JOIN "Membership" m ON m.id = sp."membershipId"
         JOIN "User" u ON u.id = m."userId"
         LEFT JOIN LATERAL (
           SELECT e."courseId", e."batchId"
           FROM "Enrolment" e
           WHERE e."studentProfileId" = sp.id
           ORDER BY e."createdAt" DESC
           LIMIT 1
         ) latest_enr ON true
         LEFT JOIN "Course" c ON c.id = latest_enr."courseId"
         LEFT JOIN "Batch" b ON b.id = latest_enr."batchId"
         ${whereClause}
         ORDER BY sp."createdAt" DESC
         LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`,
        [...queryParams, limit, offset]
      ),
      queryDb(
        `SELECT
           COUNT(*)::int as total,
           COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END)::int as "activeCount",
           COUNT(CASE WHEN status = 'UNDER_REVIEW' THEN 1 END)::int as "reviewCount",
           COUNT(CASE WHEN status IN ('INACTIVE', 'REJECTED') THEN 1 END)::int as "inactiveCount"
         FROM "StudentProfile"
         WHERE "instituteId" = $1`,
        [effectiveInstituteId]
      ),
    ]);

    const total = countRows[0]?.total || 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const liveStats = statsRows[0] || {
      total,
      activeCount: 0,
      reviewCount: 0,
      inactiveCount: 0,
    };

    const data = dataRows.map((r) => ({
      id: r.id,
      userId: r.userId,
      avatarUrl: r.avatarUrl,
      admissionNo: r.admissionNo,
      fullName: r.fullName,
      phoneNumber: r.phoneNumber,
      email: r.email,
      preferredLanguage: r.preferredLanguage || 'English',
      gender: r.gender,
      church: r.church,
      status: r.status,
      admissionDate: r.admissionDate ? new Date(r.admissionDate).toISOString() : new Date().toISOString(),
      enrolledCourseName: r.enrolledCourseName,
      enrolledBatchName: r.enrolledBatchName,
      totalEnrolments: r.totalEnrolments || 0,
    }));

    return NextResponse.json({
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        stats: liveStats,
      },
    });
  } catch (error: any) {
    console.error('Error in /institutes/[instituteId]/students GET:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch students' },
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
      fullName,
      phoneNumber,
      email,
      gender,
      dateOfBirth,
      church,
      preferredLanguage = 'English',
      address,
      guardian,
      courseId,
      batchId,
      status = 'ACTIVE',
      avatarUrl,
      password,
    } = body;

    if (!fullName || !phoneNumber) {
      return NextResponse.json(
        { message: 'Full name and phone number are required' },
        { status: 400 }
      );
    }

    // Generate Admission Number
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
    const admissionNo = `${prefix}${String(nextNum).padStart(4, '0')}`;

    // Hash password if account creation requested
    const passwordHash = password ? await bcrypt.hash(password, 10) : null;

    // 1. Create or Find User
    const existingUser = await queryDb(
      `SELECT id FROM "User" WHERE "phoneE164" = $1`,
      [phoneNumber]
    );

    let userId: string;
    if (existingUser.length > 0) {
      userId = existingUser[0].id;
      await queryDb(
        `UPDATE "User"
         SET "fullName" = $1,
             email = COALESCE($2, email),
             "avatarUrl" = COALESCE($3, "avatarUrl"),
             "passwordHash" = COALESCE($4, "passwordHash")
         WHERE id = $5`,
        [fullName, email || null, avatarUrl || null, passwordHash, userId]
      );
    } else {
      const newUser = await queryDb(
        `INSERT INTO "User" (id, "phoneE164", "fullName", email, "avatarUrl", "passwordHash", status, "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'ACTIVE', NOW())
         RETURNING id`,
        [phoneNumber, fullName, email || null, avatarUrl || null, passwordHash]
      );
      userId = newUser[0].id;
    }

    // 2. Membership
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

    // 3. StudentProfile
    const profileRows = await queryDb(
      `INSERT INTO "StudentProfile" (id, "instituteId", "membershipId", "admissionNo", gender, "dateOfBirth", church, "preferredLanguage", address, guardian, status, "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       RETURNING id, "admissionNo", status, "createdAt"`,
      [
        effectiveInstituteId,
        membershipId,
        admissionNo,
        gender || null,
        dateOfBirth ? new Date(dateOfBirth) : null,
        church || null,
        preferredLanguage,
        address ? JSON.stringify(address) : null,
        guardian ? JSON.stringify(guardian) : null,
        status,
      ]
    );
    const studentProfile = profileRows[0];

    // 4. Admission Record
    await queryDb(
      `INSERT INTO "Admission" (id, "instituteId", "studentProfileId", status, statement, "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, 'Direct registration', NOW(), NOW())`,
      [effectiveInstituteId, studentProfile.id, status]
    );

    // 5. Course Enrolment if courseId provided
    let enrolledCourseTitle: string | undefined;
    if (courseId) {
      await queryDb(
        `INSERT INTO "Enrolment" (id, "instituteId", "studentProfileId", "courseId", "batchId", source, status, "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, 'ADMIN', 'ACTIVE', NOW())`,
        [effectiveInstituteId, studentProfile.id, courseId, batchId || null]
      );
      const courseRow = await queryDb(`SELECT title FROM "Course" WHERE id = $1`, [courseId]);
      enrolledCourseTitle = courseRow[0]?.title;
    }

    return NextResponse.json({
      id: studentProfile.id,
      userId,
      avatarUrl,
      admissionNo: studentProfile.admissionNo,
      fullName,
      phoneNumber,
      email,
      preferredLanguage,
      gender,
      church,
      status: studentProfile.status,
      admissionDate: new Date(studentProfile.createdAt).toISOString(),
      enrolledCourseName: enrolledCourseTitle,
      totalEnrolments: courseId ? 1 : 0,
    });
  } catch (error: any) {
    console.error('Error in /institutes/[instituteId]/students POST:', error);
    return NextResponse.json(
      { message: error?.message || 'Failed to create student' },
      { status: 500 }
    );
  }
}
