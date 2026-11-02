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
    const { batchId, teacherProfileId, title, startsAt, endsAt, room, description, joinUrl } = body;

    if (!batchId || !title || !startsAt || !endsAt) {
      return NextResponse.json(
        { message: 'batchId, title, startsAt, and endsAt are required' },
        { status: 400 }
      );
    }

    // Resolve valid teacherProfileId
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
      return NextResponse.json(
        { message: 'At least one registered faculty member is required to schedule a session.' },
        { status: 400 }
      );
    }

    const inserted = await queryDb(
      `INSERT INTO "LiveSession" (
        id, "instituteId", "batchId", "teacherProfileId", title, description, room, "startsAt", "endsAt", "joinUrl", status, "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7::timestamp, $8::timestamp, $9, 'SCHEDULED', NOW(), NOW()
      ) RETURNING *`,
      [
        effectiveInstituteId,
        batchId,
        finalTeacherId,
        title,
        description || null,
        room || null,
        startsAt,
        endsAt,
        joinUrl || null,
      ]
    );

    return NextResponse.json(inserted[0], { status: 201 });
  } catch (error: any) {
    console.error('Error creating schedule:', error);
    return NextResponse.json({ message: error?.message || 'Failed to create schedule' }, { status: 500 });
  }
}

