import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { queryDb, resolveServerAdminContext, getServerRouteCache, setServerRouteCache, invalidateServerRouteCache } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function GET(
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

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
    const search = (searchParams.get('search') || '').trim();
    const status = (searchParams.get('status') || 'ALL').toUpperCase();
    const specialization = (searchParams.get('specialization') || 'ALL').trim();
    const offset = (page - 1) * limit;

    const cacheKey = `teachers:${effectiveInstituteId}:${page}:${limit}:${status}:${specialization}:${search}`;
    const cached = getServerRouteCache<any>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    let whereClause = `WHERE tp."instituteId" = $1`;
    const queryParams: any[] = [effectiveInstituteId];

    if (status !== 'ALL') {
      queryParams.push(status);
      whereClause += ` AND tp.status = $${queryParams.length}`;
    }

    if (specialization && specialization !== 'ALL') {
      queryParams.push(specialization);
      whereClause += ` AND tp.specialization = $${queryParams.length}`;
    }

    if (search) {
      queryParams.push(`%${search}%`);
      const pIdx = queryParams.length;
      whereClause += ` AND (u."fullName" ILIKE $${pIdx} OR tp."employeeCode" ILIKE $${pIdx} OR u."phoneE164" ILIKE $${pIdx} OR u.email ILIKE $${pIdx} OR tp.specialization ILIKE $${pIdx})`;
    }

    const [countRows, dataRows] = await Promise.all([
      queryDb(
        `SELECT COUNT(tp.id)::int as total
         FROM "TeacherProfile" tp
         JOIN "Membership" m ON m.id = tp."membershipId"
         JOIN "User" u ON u.id = m."userId"
         ${whereClause}`,
        queryParams
      ),
      queryDb(
        `SELECT
           tp.id,
           tp."employeeCode",
           u."fullName",
           u."phoneE164",
           u.email,
           tp.specialization,
           tp.qualifications as "highestDegree",
           tp."experienceYears",
           tp.status,
           tp."joiningDate",
           tp."createdAt",
           (SELECT COUNT(*)::int FROM "CourseInstructor" ci WHERE ci."teacherProfileId" = tp.id) as "assignedCoursesCount",
           (SELECT COUNT(*)::int FROM "BatchTeacher" bt WHERE bt."teacherProfileId" = tp.id) as "assignedBatchesCount"
         FROM "TeacherProfile" tp
         JOIN "Membership" m ON m.id = tp."membershipId"
         JOIN "User" u ON u.id = m."userId"
         ${whereClause}
         ORDER BY tp."createdAt" DESC
         LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`,
        [...queryParams, limit, offset]
      ),
    ]);
    const total = countRows[0]?.total || 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const data = dataRows.map((r) => ({
      id: r.id,
      employeeCode: r.employeeCode,
      fullName: r.fullName,
      phoneE164: r.phoneE164,
      email: r.email,
      specialization: r.specialization,
      highestDegree: r.highestDegree,
      experienceYears: r.experienceYears,
      status: r.status || 'ACTIVE',
      assignedCoursesCount: r.assignedCoursesCount || 0,
      assignedBatchesCount: r.assignedBatchesCount || 0,
      joiningDate: r.joiningDate ? new Date(r.joiningDate).toISOString() : null,
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
    }));

    const responsePayload = {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
    setServerRouteCache(cacheKey, responsePayload, 25000);
    return NextResponse.json(responsePayload);
  } catch (error: any) {
    console.error('Error in /institutes/[instituteId]/teachers GET:', error);
    return NextResponse.json(
      { message: error?.message || 'Failed to fetch teachers' },
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
      instituteId && instituteId !== 'null' && instituteId !== 'undefined' && instituteId !== 'inst-1'
        ? instituteId
        : ctx.instituteId;

    const body = await request.json();
    const {
      fullName,
      phoneE164,
      email,
      employeeCode,
      specialization,
      highestDegree,
      experienceYears,
      joiningDate,
      status = 'ACTIVE',
      bio,
      address,
    } = body;

    if (!fullName || !phoneE164) {
      return NextResponse.json(
        { message: 'Full name and E.164 phone number are required' },
        { status: 400 }
      );
    }

    // Generate employee code if not provided
    let finalCode = employeeCode;
    if (!finalCode) {
      const year = new Date().getFullYear();
      const prefix = `FAC-${year}-`;
      const lastRows = await queryDb(
        `SELECT "employeeCode" FROM "TeacherProfile"
         WHERE "instituteId" = $1 AND "employeeCode" LIKE $2
         ORDER BY "employeeCode" DESC LIMIT 1`,
        [effectiveInstituteId, `${prefix}%`]
      );
      let nextSeq = 1;
      if (lastRows[0]?.employeeCode) {
        const parts = lastRows[0].employeeCode.split('-');
        const parsed = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(parsed)) nextSeq = parsed + 1;
      }
      finalCode = `${prefix}${String(nextSeq).padStart(4, '0')}`;
    }

    // 1. User
    const existingUser = await queryDb(
      `SELECT id FROM "User" WHERE "phoneE164" = $1`,
      [phoneE164]
    );
    let userId: string;
    if (existingUser.length > 0) {
      userId = existingUser[0].id;
      await queryDb(
        `UPDATE "User" SET "fullName" = $1, email = COALESCE($2, email), "updatedAt" = NOW() WHERE id = $3`,
        [fullName, email || null, userId]
      );
    } else {
      const insertedUser = await queryDb(
        `INSERT INTO "User" (id, "phoneE164", "fullName", email, status, "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, 'ACTIVE', NOW())
         RETURNING id`,
        [phoneE164, fullName, email || null]
      );
      userId = insertedUser[0].id;
    }

    // 2. Membership
    const existingMem = await queryDb(
      `SELECT id FROM "Membership" WHERE "userId" = $1 AND "instituteId" = $2 AND role = 'TEACHER'`,
      [userId, effectiveInstituteId]
    );
    let membershipId: string;
    if (existingMem.length > 0) {
      membershipId = existingMem[0].id;
    } else {
      const insertedMem = await queryDb(
        `INSERT INTO "Membership" (id, "userId", "instituteId", role, status, "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, 'TEACHER', 'ACTIVE', NOW())
         RETURNING id`,
        [userId, effectiveInstituteId]
      );
      membershipId = insertedMem[0].id;
    }

    // 3. TeacherProfile - Check if profile already exists for this membership
    const existingProfile = await queryDb(
      `SELECT id FROM "TeacherProfile" WHERE "membershipId" = $1`,
      [membershipId]
    );

    let tp: any;
    if (existingProfile.length > 0) {
      // Safe update existing instructor profile without unique constraint violation
      const updatedRows = await queryDb(
        `UPDATE "TeacherProfile"
         SET "employeeCode" = COALESCE($1, "employeeCode"),
             qualifications = COALESCE($2, qualifications),
             specialization = COALESCE($3, specialization),
             "experienceYears" = COALESCE($4, "experienceYears"),
             "joiningDate" = COALESCE($5, "joiningDate"),
             address = COALESCE($6, address),
             bio = COALESCE($7, bio),
             status = $8,
             "updatedAt" = NOW()
         WHERE id = $9
         RETURNING *`,
        [
          finalCode,
          highestDegree || null,
          specialization || null,
          experienceYears !== undefined ? Number(experienceYears) : null,
          joiningDate ? new Date(joiningDate) : null,
          address ? JSON.stringify(address) : null,
          bio || null,
          status,
          existingProfile[0].id,
        ]
      );
      tp = updatedRows[0];
    } else {
      const tpRows = await queryDb(
        `INSERT INTO "TeacherProfile" (
          id, "instituteId", "membershipId", "employeeCode", qualifications, specialization,
          "experienceYears", "joiningDate", address, bio, status, "createdAt", "updatedAt"
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()
        ) RETURNING *`,
        [
          effectiveInstituteId,
          membershipId,
          finalCode,
          highestDegree || null,
          specialization || null,
          experienceYears !== undefined ? Number(experienceYears) : null,
          joiningDate ? new Date(joiningDate) : new Date(),
          address ? JSON.stringify(address) : null,
          bio || null,
          status,
        ]
      );
      tp = tpRows[0];
    }

    // Trigger Admin Notification for teacher registration
    try {
      await queryDb(
        `INSERT INTO "Notification" (id, "instituteId", "userId", title, body, link, "createdAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())`,
        [
          effectiveInstituteId,
          ctx?.user?.userId || userId,
          `New Faculty Registered: ${fullName}`,
          `Teacher ${fullName} (${tp.employeeCode}) was registered for ${tp.specialization || 'Theology'}.`,
          `/admin/teachers/${tp.id}`,
        ]
      );
    } catch (notifErr) {
      console.warn('Failed to insert notification for teacher registration:', notifErr);
    }

    invalidateServerRouteCache('teachers');
    invalidateServerRouteCache('dashboard');

    return NextResponse.json(
      {
        id: tp.id,
        employeeCode: tp.employeeCode,
        fullName,
        phoneE164,
        email: email || null,
        specialization: tp.specialization,
        highestDegree: tp.qualifications,
        experienceYears: tp.experienceYears,
        status: tp.status,
        bio: tp.bio,
        address: tp.address,
        assignedCoursesCount: 0,
        assignedBatchesCount: 0,
        joiningDate: tp.joiningDate ? new Date(tp.joiningDate).toISOString() : null,
        createdAt: new Date(tp.createdAt).toISOString(),
        courses: [],
        batches: [],
        workload: {
          totalCourses: 0,
          totalBatches: 0,
          upcomingSessionsCount: 0,
          weeklyScheduledHours: 0,
          sessionsThisWeek: [],
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error in /institutes/[instituteId]/teachers POST:', error);
    return NextResponse.json(
      { message: error?.message || 'Failed to register teacher' },
      { status: 500 }
    );
  }
}

