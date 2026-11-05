import { NextRequest, NextResponse } from 'next/server';
import { GET as handleAttendanceGet } from '../route';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const fullRes = await handleAttendanceGet(request);
  if (!fullRes.ok) return fullRes;
  const data = await fullRes.json();
  return NextResponse.json({
    student: data.student,
    summary: data.summary,
  });
}

