import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    data: [],
    meta: {
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 1,
      unreadCount: 0,
    },
  });
}
