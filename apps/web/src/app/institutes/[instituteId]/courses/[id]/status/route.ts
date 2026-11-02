import { NextRequest, NextResponse } from 'next/server';
import { queryDb, resolveServerAdminContext } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ instituteId: string; id: string }> }
) {
  try {
    const { instituteId, id } = await params;
    const ctx = await resolveServerAdminContext();
    const effectiveInstituteId =
      instituteId && instituteId !== 'null' && instituteId !== 'undefined'
        ? instituteId
        : ctx.instituteId;

    const body = await request.json();
    const { status } = body;

    if (!status || !['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(status)) {
      return NextResponse.json({ message: 'Valid status is required' }, { status: 400 });
    }

    await queryDb(
      `UPDATE "Course"
       SET status = $1, "updatedAt" = NOW()
       WHERE id = $2 AND "instituteId" = $3`,
      [status, id, effectiveInstituteId]
    );

    return NextResponse.json({ id, status });
  } catch (error: any) {
    console.error('Error in course status route:', error);
    return NextResponse.json(
      { message: error?.message || 'Failed to update course status' },
      { status: 500 }
    );
  }
}

