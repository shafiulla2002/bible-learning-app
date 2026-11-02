import { NextRequest, NextResponse } from 'next/server';
import { queryDb, resolveServerAdminContext } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ instituteId: string }> }
) {
  try {
    const { instituteId } = await params;
    const ctx = await resolveServerAdminContext();
    const effectiveInstituteId =
      instituteId && instituteId !== 'null' && instituteId !== 'undefined' && instituteId !== 'inst-1'
        ? instituteId
        : ctx.instituteId;

    const rows = await queryDb(
      `SELECT
         u.id,
         m.id as "membershipId",
         u."fullName",
         u.email,
         u."phoneE164" as phone,
         m.role,
         m.status,
         m."createdAt" as "joinedAt"
       FROM "Membership" m
       JOIN "User" u ON u.id = m."userId"
       WHERE m."instituteId" = $1
       ORDER BY m."createdAt" DESC`,
      [effectiveInstituteId]
    );

    return NextResponse.json(
      rows.map((r) => ({
        id: r.id,
        membershipId: r.membershipId,
        fullName: r.fullName,
        email: r.email,
        phone: r.phone,
        role: r.role,
        status: r.status,
        joinedAt: new Date(r.joinedAt).toISOString(),
      }))
    );
  } catch (error: any) {
    console.error('Error fetching institute users:', error);
    return NextResponse.json({ message: error?.message || 'Failed to fetch users' }, { status: 500 });
  }
}

