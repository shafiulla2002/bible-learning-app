import { NextRequest, NextResponse } from 'next/server';
import { resolveAuthenticatedTeacher, TeacherAuthError } from '@/lib/server-teacher';
import { queryDb } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const teacher = await resolveAuthenticatedTeacher(request);
    const { teacherProfileId, instituteId } = teacher;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim() || '';
    const batchIdParam = searchParams.get('batchId') || 'ALL';
    const statusParam = searchParams.get('status') || 'ALL';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
    const offset = (page - 1) * limit;

    // 1. Fetch assigned batches for this teacher (enforces teacher scope)
    const assignedBatches = await queryDb<{
      id: string;
      name: string;
      code: string | null;
      courseTitle: string;
    }>(
      `SELECT b.id, b.name, b.code, c.title as "courseTitle"
       FROM "BatchTeacher" bt
       JOIN "Batch" b ON b.id = bt."batchId"
       JOIN "Course" c ON c.id = b."courseId"
       WHERE bt."teacherProfileId" = $1 AND bt."instituteId" = $2
       ORDER BY b.name ASC`,
      [teacherProfileId, instituteId]
    );

    const assignedBatchIds = assignedBatches.map((b) => b.id);
    if (assignedBatchIds.length === 0) {
      return NextResponse.json({
        success: true,
        items: [],
        totalCount: 0,
        page,
        limit,
        totalPages: 0,
        assignedBatches: [],
      });
    }

    // 2. Validate batchId filter
    let effectiveBatchIds = assignedBatchIds;
    if (batchIdParam !== 'ALL') {
      if (!assignedBatchIds.includes(batchIdParam)) {
        // Requested batch is not assigned to this teacher -> return empty list safely
        return NextResponse.json({
          success: true,
          items: [],
          totalCount: 0,
          page,
          limit,
          totalPages: 0,
          assignedBatches,
        });
      }
      effectiveBatchIds = [batchIdParam];
    }

    // 3. Build dynamic query for student enrolments
    const queryParams: any[] = [teacherProfileId, instituteId, effectiveBatchIds];
    let filterSql = '';

    if (statusParam !== 'ALL') {
      queryParams.push(statusParam);
      filterSql += ` AND e.status = $${queryParams.length}`;
    }

    if (search) {
      queryParams.push(`%${search}%`);
      const searchIdx = queryParams.length;
      filterSql += ` AND (sp."admissionNo" ILIKE $${searchIdx} OR u."fullName" ILIKE $${searchIdx} OR u.email ILIKE $${searchIdx})`;
    }

    queryParams.push(limit);
    const limitIdx = queryParams.length;
    queryParams.push(offset);
    const offsetIdx = queryParams.length;

    const sql = `
      SELECT 
        e.id as "enrolmentId",
        e.id as "id",
        sp.id as "studentProfileId",
        sp."admissionNo",
        u."fullName",
        u.email,
        u."phoneE164" as phone,
        u."avatarUrl",
        b.id as "batchId",
        b.name as "batchName",
        b.code as "batchCode",
        c.id as "courseId",
        c.title as "courseTitle",
        e.status as "enrolmentStatus",
        e."createdAt" as "enrolledAt",
        COUNT(*) OVER()::int as "fullCount"
      FROM "Enrolment" e
      JOIN "StudentProfile" sp ON sp.id = e."studentProfileId"
      JOIN "Membership" m ON m.id = sp."membershipId"
      JOIN "User" u ON u.id = m."userId"
      JOIN "Batch" b ON b.id = e."batchId"
      JOIN "Course" c ON c.id = e."courseId"
      JOIN "BatchTeacher" bt ON bt."batchId" = b.id
      WHERE bt."teacherProfileId" = $1
        AND bt."instituteId" = $2
        AND b.id = ANY($3::text[])
        AND sp.status = 'ACTIVE'
        AND m.status = 'ACTIVE'
        ${filterSql}
      ORDER BY u."fullName" ASC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const rows = await queryDb<any>(sql, queryParams);
    const totalCount = rows.length > 0 ? rows[0].fullCount : 0;

    const items = rows.map((r) => ({
      id: r.id,
      enrolmentId: r.enrolmentId,
      studentProfileId: r.studentProfileId,
      admissionNo: r.admissionNo,
      fullName: r.fullName,
      email: r.email || null,
      phone: r.phone ? r.phone.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2') : null,
      avatarUrl: r.avatarUrl || null,
      batchId: r.batchId,
      batchName: r.batchName,
      batchCode: r.batchCode,
      courseId: r.courseId,
      courseTitle: r.courseTitle,
      enrolmentStatus: r.enrolmentStatus,
      enrolledAt: r.enrolledAt,
    }));

    return NextResponse.json({
      success: true,
      items,
      totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
      assignedBatches,
    });
  } catch (err: any) {
    if (err instanceof TeacherAuthError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.statusCode }
      );
    }
    console.error('Teacher students route error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error while fetching student directory' },
      { status: 500 }
    );
  }
}

