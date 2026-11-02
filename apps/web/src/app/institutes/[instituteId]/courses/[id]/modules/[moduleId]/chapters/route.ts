import { NextRequest, NextResponse } from 'next/server';
import { queryDb } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ instituteId: string; id: string; moduleId: string }> }
) {
  try {
    const { instituteId, moduleId } = await params;
    const body = await request.json();
    const { title, position = 0 } = body;

    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    const inserted = await queryDb(
      `INSERT INTO "Chapter" (
        id, "instituteId", "moduleId", title, position, "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, NOW(), NOW()
      ) RETURNING *`,
      [instituteId, moduleId, title, position]
    );

    return NextResponse.json(inserted[0], { status: 201 });
  } catch (error: any) {
    console.error('Error creating chapter:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
