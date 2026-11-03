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
      instituteId && instituteId !== 'null' && instituteId !== 'undefined' && instituteId !== 'inst-1'
        ? instituteId
        : ctx.instituteId;

    const tpRows = await queryDb(
      `SELECT
         tp.id, tp."employeeCode", tp.qualifications as "highestDegree", tp.specialization,
         tp."experienceYears", tp."joiningDate", tp.address, tp.bio, tp.status, tp."createdAt",
         u."fullName", u."phoneE164", u.email, u."avatarUrl"
       FROM "TeacherProfile" tp
       JOIN "Membership" m ON m.id = tp."membershipId"
       JOIN "User" u ON u.id = m."userId"
       WHERE tp.id = $1 AND tp."instituteId" = $2`,
      [id, effectiveInstituteId]
    );

    if (tpRows.length === 0) {
      return NextResponse.json({ message: 'Teacher profile not found' }, { status: 404 });
    }

    const t = tpRows[0];

    // Assigned courses
    const courseRows = await queryDb(
      `SELECT
         ci."courseId", ci.role, ci."createdAt" as "assignedAt",
         c.title, c.slug, cat.name as "categoryName"
       FROM "CourseInstructor" ci
       JOIN "Course" c ON c.id = ci."courseId"
       LEFT JOIN "CourseCategory" cat ON cat.id = c."categoryId"
       WHERE ci."teacherProfileId" = $1
       ORDER BY ci."createdAt" DESC`,
      [id]
    );

    // Assigned batches
    const batchRows = await queryDb(
      `SELECT
         bt."batchId", bt.role,
         b.name, b.code, b.status as "batchStatus", b."startDate", b."endDate",
         c.title as "courseTitle"
       FROM "BatchTeacher" bt
       JOIN "Batch" b ON b.id = bt."batchId"
       JOIN "Course" c ON c.id = b."courseId"
       WHERE bt."teacherProfileId" = $1
       ORDER BY b."startDate" DESC`,
      [id]
    );

    // Upcoming / weekly live sessions
    const sessionRows = await queryDb(
      `SELECT
         ls.id, ls."batchId", ls.title, ls."startsAt", ls."endsAt", ls.status,
         b.name as "batchName"
       FROM "LiveSession" ls
       JOIN "Batch" b ON b.id = ls."batchId"
       WHERE ls."teacherProfileId" = $1
       ORDER BY ls."startsAt" ASC
       LIMIT 20`,
      [id]
    );

    const sessionsThisWeek = sessionRows.map((s) => {
      const start = new Date(s.startsAt);
      const end = new Date(s.endsAt);
      const durationMinutes = Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000));
      return {
        id: s.id,
        batchId: s.batchId,
        batchName: s.batchName,
        title: s.title,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        status: s.status,
        durationMinutes,
      };
    });

    const totalMinutes = sessionsThisWeek.reduce((acc, s) => acc + s.durationMinutes, 0);
    const weeklyScheduledHours = Math.round((totalMinutes / 60) * 10) / 10;

    return NextResponse.json({
      id: t.id,
      employeeCode: t.employeeCode,
      fullName: t.fullName,
      phoneE164: t.phoneE164,
      email: t.email,
      photoUrl: t.avatarUrl || null,
      specialization: t.specialization,
      highestDegree: t.highestDegree,
      experienceYears: t.experienceYears,
      status: t.status || 'ACTIVE',
      bio: t.bio,
      address: t.address,
      assignedCoursesCount: courseRows.length,
      assignedBatchesCount: batchRows.length,
      joiningDate: t.joiningDate ? new Date(t.joiningDate).toISOString() : null,
      createdAt: new Date(t.createdAt).toISOString(),
      courses: courseRows.map((c) => ({
        courseId: c.courseId,
        title: c.title,
        slug: c.slug,
        categoryName: c.categoryName || 'Theology',
        role: c.role || 'LEAD',
        assignedAt: new Date(c.assignedAt).toISOString(),
      })),
      batches: batchRows.map((b) => ({
        batchId: b.batchId,
        name: b.name,
        code: b.code || 'BATCH',
        courseTitle: b.courseTitle,
        role: b.role || 'LEAD',
        batchStatus: b.batchStatus,
        startDate: new Date(b.startDate).toISOString(),
        endDate: new Date(b.endDate).toISOString(),
      })),
      workload: {
        totalCourses: courseRows.length,
        totalBatches: batchRows.length,
        upcomingSessionsCount: sessionsThisWeek.length,
        weeklyScheduledHours,
        sessionsThisWeek,
      },
    });
  } catch (error: any) {
    console.error('Error in /institutes/[instituteId]/teachers/[id] GET:', error);
    return NextResponse.json(
      { message: error?.message || 'Failed to fetch teacher details' },
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
      instituteId && instituteId !== 'null' && instituteId !== 'undefined' && instituteId !== 'inst-1'
        ? instituteId
        : ctx.instituteId;

    const body = await request.json();
    const {
      fullName,
      phoneE164,
      email,
      specialization,
      highestDegree,
      experienceYears,
      bio,
      address,
      photoUrl,
      avatarUrl,
      status,
    } = body;
    const finalAvatar = photoUrl || avatarUrl || null;

    const tpRows = await queryDb(
      `SELECT tp.id, m."userId"
       FROM "TeacherProfile" tp
       JOIN "Membership" m ON m.id = tp."membershipId"
       WHERE tp.id = $1 AND tp."instituteId" = $2`,
      [id, effectiveInstituteId]
    );

    if (tpRows.length === 0) {
      return NextResponse.json({ message: 'Teacher profile not found' }, { status: 404 });
    }

    const { userId } = tpRows[0];

    if (fullName || phoneE164 || email !== undefined || finalAvatar) {
      await queryDb(
        `UPDATE "User"
         SET "fullName" = COALESCE($1, "fullName"),
             "phoneE164" = COALESCE($2, "phoneE164"),
             email = COALESCE($3, email),
             "avatarUrl" = COALESCE($4, "avatarUrl"),
             "updatedAt" = NOW()
         WHERE id = $5`,
        [fullName || null, phoneE164 || null, email || null, finalAvatar, userId]
      );
    }

    await queryDb(
      `UPDATE "TeacherProfile"
       SET specialization = COALESCE($1, specialization),
           qualifications = COALESCE($2, qualifications),
           "experienceYears" = COALESCE($3, "experienceYears"),
           bio = COALESCE($4, bio),
           status = COALESCE($5, status),
           address = CASE WHEN $6::text IS NOT NULL THEN $6::jsonb ELSE address END,
           "updatedAt" = NOW()
       WHERE id = $7 AND "instituteId" = $8`,
      [
        specialization || null,
        highestDegree || null,
        experienceYears !== undefined ? Number(experienceYears) : null,
        bio || null,
        status || null,
        address ? JSON.stringify(address) : null,
        id,
        effectiveInstituteId,
      ]
    );

    return NextResponse.json({ message: 'Teacher updated successfully' });
  } catch (error: any) {
    console.error('Error in /institutes/[instituteId]/teachers/[id] PATCH:', error);
    return NextResponse.json(
      { message: error?.message || 'Failed to update teacher' },
      { status: 500 }
    );
  }
}

