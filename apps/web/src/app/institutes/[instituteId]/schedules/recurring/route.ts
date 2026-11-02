import { NextRequest, NextResponse } from 'next/server';
import { queryDb, resolveServerAdminContext } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

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
      batchId,
      teacherProfileId,
      title,
      daysOfWeek = [1, 3],
      startTime = '10:00',
      endTime = '11:30',
      startDate,
      endDate,
      room,
      exceptions = [],
    } = body;

    if (!batchId || !title || !startDate || !endDate) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
    }

    let finalTeacherId = teacherProfileId;
    const checkT = await queryDb(
      `SELECT id FROM "TeacherProfile" WHERE id = $1 AND "instituteId" = $2`,
      [teacherProfileId || '', effectiveInstituteId]
    );
    if (checkT.length === 0) {
      const anyTeacher = await queryDb(
        `SELECT id FROM "TeacherProfile" WHERE "instituteId" = $1 LIMIT 1`,
        [effectiveInstituteId]
      );
      finalTeacherId = anyTeacher[0]?.id;
    }

    if (!finalTeacherId) {
      return NextResponse.json({ message: 'No registered teacher found' }, { status: 400 });
    }

    const exceptionSet = new Set(exceptions);
    const start = new Date(startDate);
    const end = new Date(endDate);
    let generatedCount = 0;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      if (exceptionSet.has(dateStr)) continue;
      if (daysOfWeek.includes(d.getDay())) {
        const startsAt = `${dateStr}T${startTime}:00.000Z`;
        const endsAt = `${dateStr}T${endTime}:00.000Z`;
        await queryDb(
          `INSERT INTO "LiveSession" (
            id, "instituteId", "batchId", "teacherProfileId", title, room, "startsAt", "endsAt", "isRecurring", status, "createdAt", "updatedAt"
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5, $6::timestamp, $7::timestamp, true, 'SCHEDULED', NOW(), NOW()
          )`,
          [effectiveInstituteId, batchId, finalTeacherId, title, room || null, startsAt, endsAt]
        );
        generatedCount++;
        if (generatedCount >= 30) break; // Cap bulk creation per call
      }
    }

    return NextResponse.json({ generatedCount }, { status: 201 });
  } catch (error: any) {
    console.error('Error generating recurring schedule:', error);
    return NextResponse.json({ message: error?.message || 'Failed to generate recurring schedule' }, { status: 500 });
  }
}

