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

    const batchId = searchParams.get('batchId');
    const date = searchParams.get('date');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = (page - 1) * limit;

    let whereClause = `WHERE a."instituteId" = $1`;
    const qParams: any[] = [instituteId];

    if (batchId && batchId !== 'ALL') {
      qParams.push(batchId);
      whereClause += ` AND a."batchId" = $${qParams.length}`;
    }

    if (date) {
      qParams.push(date);
      whereClause += ` AND a.date = $${qParams.length}::date`;
    }

    if (status && status !== 'ALL') {
      qParams.push(status);
      whereClause += ` AND a.status = $${qParams.length}`;
    }

    if (search) {
      qParams.push(`%${search}%`);
      whereClause += ` AND (u."fullName" ILIKE $${qParams.length} OR sp."admissionNo" ILIKE $${qParams.length})`;
    }

    const countQuery = `
      SELECT COUNT(*)::int as total
      FROM "Attendance" a
      JOIN "StudentProfile" sp ON sp.id = a."studentProfileId"
      JOIN "Membership" m ON m.id = sp."membershipId"
      JOIN "User" u ON u.id = m."userId"
      ${whereClause}
    `;
    const countRes = await queryDb(countQuery, qParams);
    const total = countRes[0]?.total || 0;

    const dataQuery = `
      SELECT
        a.id,
        a.date,
        a.status,
        a.mode,
        a.remarks,
        a."markedAt",
        sp.id as "studentProfileId",
        sp."admissionNo" as "admissionNo",
        u."fullName" as "studentName",
        b.id as "batchId",
        b.name as "batchName",
        c.title as "courseTitle"
      FROM "Attendance" a
      JOIN "StudentProfile" sp ON sp.id = a."studentProfileId"
      JOIN "Membership" m ON m.id = sp."membershipId"
      JOIN "User" u ON u.id = m."userId"
      JOIN "Batch" b ON b.id = a."batchId"
      JOIN "Course" c ON c.id = b."courseId"
      ${whereClause}
      ORDER BY a.date DESC, u."fullName" ASC
      LIMIT $${qParams.length + 1} OFFSET $${qParams.length + 2}
    `;

    const records = await queryDb(dataQuery, [...qParams, limit, offset]);

    return NextResponse.json({
      data: records.map((r: any) => ({
        id: r.id,
        date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date).split('T')[0],
        status: r.status,
        mode: r.mode,
        remarks: r.remarks,
        markedAt: r.markedAt ? new Date(r.markedAt).toISOString() : null,
        student: {
          id: r.studentProfileId,
          admissionNo: r.admissionNo,
          fullName: r.studentName,
        },
        batch: {
          id: r.batchId,
          name: r.batchName,
        },
        course: {
          title: r.courseTitle,
        },
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error: any) {
    console.error('Error fetching attendance records:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
