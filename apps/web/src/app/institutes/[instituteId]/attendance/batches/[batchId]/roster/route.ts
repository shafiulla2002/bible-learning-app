import { NextRequest, NextResponse } from 'next/server';
import { queryDb } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ instituteId: string; batchId: string }> }
) {
  try {
    const { instituteId, batchId } = await params;
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const liveSessionId = searchParams.get('liveSessionId') || null;

    // 1. Get batch info
    const batchRes = await queryDb(
      `SELECT b.id, b.name, c.title as "courseTitle"
       FROM "Batch" b
       JOIN "Course" c ON c.id = b."courseId"
       WHERE b.id = $1 AND b."instituteId" = $2`,
      [batchId, instituteId]
    );

    if (batchRes.length === 0) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    const batch = batchRes[0];

    // 2. Get active students enrolled in this batch along with any recorded attendance for this date
    const rosterQuery = `
      SELECT
        sp.id as "studentProfileId",
        sp."admissionNo" as "admissionNo",
        u."fullName" as "studentName",
        e.id as "enrolmentId",
        att.id as "attendanceId",
        att.status,
        att.remarks,
        att."markedAt"
      FROM "Enrolment" e
      JOIN "StudentProfile" sp ON sp.id = e."studentProfileId"
      JOIN "Membership" m ON m.id = sp."membershipId"
      JOIN "User" u ON u.id = m."userId"
      LEFT JOIN "Attendance" att ON att."studentProfileId" = sp.id
        AND att."batchId" = $1
        AND att.date = $3::date
      WHERE e."batchId" = $1 AND e."instituteId" = $2 AND e.status = 'ACTIVE'
      ORDER BY u."fullName" ASC
    `;
    const rosterRows = await queryDb(rosterQuery, [batchId, instituteId, dateStr]);

    const roster = rosterRows.map((r: any) => ({
      studentProfileId: r.studentProfileId,
      admissionNo: r.admissionNo,
      studentName: r.studentName,
      enrolmentId: r.enrolmentId,
      status: r.status || null,
      remarks: r.remarks || null,
      attendanceId: r.attendanceId || null,
      markedAt: r.markedAt ? new Date(r.markedAt).toISOString() : null,
    }));

    const markedCount = roster.filter((r: any) => r.status !== null).length;

    return NextResponse.json({
      batchId: batch.id,
      batchName: batch.name,
      courseTitle: batch.courseTitle,
      date: dateStr,
      mode: liveSessionId ? 'LIVE_SESSION' : 'DAILY_BATCH',
      liveSessionId: liveSessionId || undefined,
      totalEnrolled: roster.length,
      markedCount,
      roster,
    });
  } catch (error: any) {
    console.error('Error fetching batch roster:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
