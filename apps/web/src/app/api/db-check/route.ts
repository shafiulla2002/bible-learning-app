import { NextResponse } from 'next/server';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';

export async function GET() {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) {
    return NextResponse.json({
      configured: false,
      error: 'DATABASE_URL is not defined in process.env',
    });
  }

  // Mask password for safety
  const maskedUrl = rawUrl.replace(/:([^:@]+)@/, ':****@');

  const cleanUrl = rawUrl.replace(/\?sslmode=[^&]+&?/, '?').replace(/\?$/, '');

  const pool = new Pool({
    connectionString: cleanUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });

  try {
    const res = await pool.query('SELECT current_database(), current_user, count(*)::int as student_count FROM "StudentProfile"');
    await pool.end();
    return NextResponse.json({
      configured: true,
      maskedUrl,
      success: true,
      data: res.rows[0],
    });
  } catch (err: any) {
    await pool.end().catch(() => {});
    return NextResponse.json({
      configured: true,
      maskedUrl,
      success: false,
      error: err.message,
      code: err.code,
      stack: err.stack,
    });
  }
}
