import { NextResponse } from 'next/server';
import { resolveServerAdminContext } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const ctx = await resolveServerAdminContext();
    return NextResponse.json({
      instituteId: ctx.instituteId,
      instituteName: ctx.name,
      displayName: ctx.displayName,
      code: ctx.code,
      currency: ctx.currency,
      timezone: ctx.timezone,
      user: {
        id: ctx.user.userId,
        fullName: ctx.user.fullName,
        email: ctx.user.email,
        role: ctx.user.role,
      },
    });
  } catch (error: any) {
    console.error('Error in /dashboard/context route:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to resolve database context' },
      { status: 500 }
    );
  }
}
