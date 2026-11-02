import { NextRequest, NextResponse } from 'next/server';
import { queryDb } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ instituteId: string }> }
) {
  try {
    const { instituteId } = await params;

    // 1. Overall stats
    const statsQuery = `
      SELECT
        COUNT(*)::int as "totalRecords",
        COUNT(CASE WHEN status = 'PRESENT' THEN 1 END)::int as "presentCount",
        COUNT(CASE WHEN status = 'LATE' THEN 1 END)::int as "lateCount",
        COUNT(CASE WHEN status = 'ABSENT' THEN 1 END)::int as "absentCount",
        COUNT(CASE WHEN status = 'EXCUSED' THEN 1 END)::int as "excusedCount"
      FROM "Attendance"
      WHERE "instituteId" = $1
    `;
    const statsRes = await queryDb(statsQuery, [instituteId]);
    const s = statsRes[0] || {
      totalRecords: 0,
      presentCount: 0,
      lateCount: 0,
      absentCount: 0,
      excusedCount: 0,
    };

    const presentOrLate = (s.presentCount || 0) + (s.lateCount || 0);
    const attendancePercentage = s.totalRecords > 0 ? Math.round((presentOrLate / s.totalRecords) * 100) : null;

    // 2. Batches breakdown
    const batchesQuery = `
      SELECT
        b.id as "batchId",
        b.name as "batchName",
        c.title as "courseTitle",
        y.name as "academicYear",
        t.name as "term",
        COUNT(DISTINCT e.id)::int as "totalEnrolled",
        COUNT(a.id)::int as "totalRecords",
        COUNT(CASE WHEN a.status = 'PRESENT' THEN 1 END)::int as "presentCount",
        COUNT(CASE WHEN a.status = 'LATE' THEN 1 END)::int as "lateCount",
        COUNT(CASE WHEN a.status = 'ABSENT' THEN 1 END)::int as "absentCount",
        COUNT(CASE WHEN a.status = 'EXCUSED' THEN 1 END)::int as "excusedCount"
      FROM "Batch" b
      JOIN "Course" c ON c.id = b."courseId"
      LEFT JOIN "AcademicYear" y ON y.id = b."academicYearId"
      LEFT JOIN "AcademicTerm" t ON t.id = b."termId"
      LEFT JOIN "Enrolment" e ON e."batchId" = b.id AND e.status = 'ACTIVE'
      LEFT JOIN "Attendance" a ON a."batchId" = b.id
      WHERE b."instituteId" = $1
      GROUP BY b.id, b.name, c.title, y.name, t.name
      ORDER BY b.name ASC
    `;
    const batchesRes = await queryDb(batchesQuery, [instituteId]);

    const formattedBatches = batchesRes.map((b: any) => {
      const pL = (b.presentCount || 0) + (b.lateCount || 0);
      const pct = b.totalRecords > 0 ? Math.round((pL / b.totalRecords) * 100) : null;
      return {
        ...b,
        attendancePercentage: pct,
      };
    });

    return NextResponse.json({
      summary: {
        totalRecords: s.totalRecords,
        presentCount: s.presentCount,
        lateCount: s.lateCount,
        absentCount: s.absentCount,
        excusedCount: s.excusedCount,
        attendancePercentage,
      },
      batches: formattedBatches,
    });
  } catch (error: any) {
    console.error('Error fetching attendance overview:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
