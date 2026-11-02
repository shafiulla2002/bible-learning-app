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

    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)));

    const rows = await queryDb(
      `SELECT
         al.id, al.action, al."entityType", al."entityId", al."actorUserId",
         al.metadata, al."createdAt",
         u."fullName" as "actorName"
       FROM "AuditLog" al
       LEFT JOIN "User" u ON u.id = al."actorUserId"
       WHERE al."instituteId" = $1
       ORDER BY al."createdAt" DESC
       LIMIT $2`,
      [effectiveInstituteId, limit]
    );

    return NextResponse.json(
      rows.map((r) => ({
        id: r.id,
        action: r.action,
        entityType: r.entityType,
        entityId: r.entityId,
        actorUserId: r.actorUserId,
        actorName: r.actorName || 'Institute Administrator',
        metadata: r.metadata,
        createdAt: new Date(r.createdAt).toISOString(),
      }))
    );
  } catch (error: any) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json({ message: error?.message || 'Failed to fetch audit logs' }, { status: 500 });
  }
}

