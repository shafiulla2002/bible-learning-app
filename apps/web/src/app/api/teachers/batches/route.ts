import { NextRequest, NextResponse } from 'next/server';
import { resolveAuthenticatedTeacher, TeacherAuthError } from '@/lib/server-teacher';
import { queryDb } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const teacher = await resolveAuthenticatedTeacher(request);
    const { searchParams } = new URL(request.url);

    const search = searchParams.get('search')?.trim() || '';
    const status = searchParams.get('status')?.trim() || 'ALL';

    const conditions: string[] = [
      'bt."teacherProfileId" = $1',
      'bt."instituteId" = $2',
    ];
    const params: any[] = [teacher.teacherProfileId, teacher.instituteId];
    let paramIdx = 3;

    if (status && status !== 'ALL') {
      conditions.push(`b.status = $${paramIdx}`);
      params.push(status);
      paramIdx++;
    }

    if (search) {
      conditions.push(
        `(b.name ILIKE $${paramIdx} OR b.code ILIKE $${paramIdx} OR c.title ILIKE $${paramIdx})`,
      );
      params.push(`%${search}%`);
      paramIdx++;
    }

    const whereClause = conditions.join(' AND ');

    const sql = `
      SELECT 
        b.id,
        b.name,
        b.code,
        b.status,
        b."startDate",
        b."endDate",
        b.capacity,
        b."courseId",
        c.title as "courseTitle",
        c.slug as "courseSlug",
        t.name as "termName",
        ay.name as "academicYearName",
        bt.role as "assignedRole",
        COALESCE((
          SELECT COUNT(DISTINCT e."studentProfileId")::int
          FROM "Enrolment" e
          WHERE e."batchId" = b.id AND e."instituteId" = $2 AND e.status = 'ACTIVE'
        ), 0) as "activeStudentsCount",
        (
          SELECT json_build_object(
            'id', ls.id,
            'title', ls.title,
            'startsAt', ls."startsAt"
          )
          FROM "LiveSession" ls
          WHERE ls."batchId" = b.id AND ls."instituteId" = $2 AND ls."startsAt" >= NOW()
          ORDER BY ls."startsAt" ASC
          LIMIT 1
        ) as "nextLiveSession"
      FROM "BatchTeacher" bt
      JOIN "Batch" b ON b.id = bt."batchId"
      JOIN "Course" c ON c.id = b."courseId"
      LEFT JOIN "AcademicTerm" t ON t.id = b."termId"
      LEFT JOIN "AcademicYear" ay ON ay.id = b."academicYearId"
      WHERE ${whereClause}
      ORDER BY b."createdAt" DESC
    `;

    const rows = await queryDb<any>(sql, params);

    // Calculate metrics strictly across all teacher's assigned batches in this institute
    const [metricRows] = await Promise.all([
      queryDb<{
        total_batches: number;
        active_batches: number;
        total_students: number;
        total_courses: number;
      }>(
        `SELECT 
          COUNT(DISTINCT bt."batchId")::int as total_batches,
          COUNT(DISTINCT CASE WHEN b.status = 'ACTIVE' THEN bt."batchId" END)::int as active_batches,
          COUNT(DISTINCT e."studentProfileId")::int as total_students,
          COUNT(DISTINCT b."courseId")::int as total_courses
         FROM "BatchTeacher" bt
         JOIN "Batch" b ON b.id = bt."batchId"
         LEFT JOIN "Enrolment" e ON e."batchId" = b.id AND e.status = 'ACTIVE'
         WHERE bt."teacherProfileId" = $1 AND bt."instituteId" = $2`,
        [teacher.teacherProfileId, teacher.instituteId],
      ),
    ]);

    const m = metricRows[0] || {
      total_batches: rows.length,
      active_batches: rows.filter((r) => r.status === 'ACTIVE').length,
      total_students: 0,
      total_courses: 0,
    };

    return NextResponse.json({
      success: true,
      metrics: {
        totalAssignedBatches: Number(m.total_batches) || rows.length,
        activeBatches: Number(m.active_batches) || rows.filter((r) => r.status === 'ACTIVE').length,
        totalStudents: Number(m.total_students) || 0,
        associatedCoursesCount: Number(m.total_courses) || 0,
      },
      data: rows.map((r) => ({
        id: r.id,
        name: r.name,
        code: r.code,
        status: r.status,
        startDate: r.startDate,
        endDate: r.endDate,
        capacity: r.capacity,
        courseId: r.courseId,
        courseTitle: r.courseTitle,
        courseSlug: r.courseSlug,
        termName: r.termName,
        academicYearName: r.academicYearName,
        assignedRole: r.assignedRole || 'LEAD',
        activeStudentsCount: Number(r.activeStudentsCount) || 0,
        nextLiveSession: r.nextLiveSession || null,
      })),
    });
  } catch (err: any) {
    if (err instanceof TeacherAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error('Error fetching teacher batches:', err);
    return NextResponse.json(
      { error: 'Failed to fetch assigned batches' },
      { status: 500 },
    );
  }
}
