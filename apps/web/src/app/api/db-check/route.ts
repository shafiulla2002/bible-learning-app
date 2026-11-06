import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const authKey = searchParams.get('key');
  
  if (authKey !== 'check_db_conn_2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Use the development connection string to test whether Vercel network can reach the CloudSQL IP
  const testConn = 'postgresql://bible_app:bible%23123@8.231.106.67:5432/bible_lms_dev';

  const pool = new Pool({
    connectionString: testConn,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });

  try {
    const res = await pool.query('SELECT count(*)::int as count FROM "StudentProfile" WHERE "instituteId" = \'fef8c1d5-53d5-45ac-9f94-bb0be5cb39d5\'');
    await pool.end();
    return NextResponse.json({
      success: true,
      reachable: true,
      studentCount: res.rows[0].count,
    });
  } catch (err: any) {
    await pool.end().catch(() => {});
    return NextResponse.json({
      success: false,
      reachable: false,
      error: err.message,
      code: err.code,
    });
  }
}
