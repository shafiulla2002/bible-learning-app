import { NextRequest, NextResponse } from 'next/server';
import { queryDb } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ instituteId: string; id: string; chapterId: string }> }
) {
  try {
    const { instituteId, chapterId } = await params;
    const body = await request.json();
    const {
      title,
      type = 'VIDEO',
      durationMinutes = 15,
      durationSec,
      isPreview = false,
      isMandatory = true,
      body: lessonBody = null,
      position = 0,
    } = body;

    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    const finalDurationSec = durationSec !== undefined ? Number(durationSec) : Number(durationMinutes) * 60;

    const inserted = await queryDb(
      `INSERT INTO "Lesson" (
        id, "instituteId", "chapterId", title, type, "durationSec", "isPreview", "isMandatory", body, position, "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()
      ) RETURNING *`,
      [instituteId, chapterId, title, type, finalDurationSec, isPreview, isMandatory, lessonBody, position]
    );

    return NextResponse.json(inserted[0], { status: 201 });
  } catch (error: any) {
    console.error('Error creating lesson:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
