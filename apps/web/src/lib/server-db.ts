import { Pool } from 'pg';

let pool: Pool | null = null;

export function getDbPool(): Pool {
  if (!pool) {
    const rawUrl =
      process.env.DATABASE_URL ||
      'postgresql://bible_app:bible%23123@8.231.106.67:5432/bible_lms_dev';

    // Strip sslmode from query string so pg uses our explicit ssl options without self-signed cert verification failure
    const cleanUrl = rawUrl.replace(/\?sslmode=[^&]+&?/, '?').replace(/\?$/, '');

    pool = new Pool({
      connectionString: cleanUrl,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}

export async function queryDb<T = any>(text: string, params?: any[]): Promise<T[]> {
  const p = getDbPool();
  const res = await p.query(text, params);
  return res.rows;
}

export interface ServerInstituteContext {
  instituteId: string;
  instituteSlug: string;
  name: string;
  displayName: string;
  code: string;
  currency: string;
  timezone: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  user: {
    userId: string;
    fullName: string;
    email: string | null;
    role: string;
  };
}

export async function resolveServerAdminContext(): Promise<ServerInstituteContext> {
  // Query primary active institute (prefer grace-bible if exists)
  const institutes = await queryDb(
    `SELECT i.id, i.slug, i.name, i.timezone, i.currency, i."logoUrl",
            s.branding
     FROM "Institute" i
     LEFT JOIN "InstituteSettings" s ON s."instituteId" = i.id
     WHERE i.status = 'ACTIVE'
     ORDER BY CASE WHEN i.slug = 'grace-bible' THEN 0 ELSE 1 END, i."createdAt" ASC
     LIMIT 1`
  );

  if (institutes.length === 0) {
    throw new Error('No active institute found in database');
  }

  const inst = institutes[0];
  const branding = inst.branding || {};

  // Query primary admin user
  const adminUsers = await queryDb(
    `SELECT u.id, u."fullName", u.email, m.role
     FROM "Membership" m
     JOIN "User" u ON u.id = m."userId"
     WHERE m."instituteId" = $1 AND m.role IN ('INSTITUTE_ADMIN', 'SUPER_ADMIN') AND m.status = 'ACTIVE'
     ORDER BY m."createdAt" ASC
     LIMIT 1`,
    [inst.id]
  );

  const admin = adminUsers.length > 0 ? adminUsers[0] : {
    id: 'admin-fallback',
    fullName: 'Samuel Admin',
    email: 'admin@bible-institute.org',
    role: 'INSTITUTE_ADMIN',
  };

  return {
    instituteId: inst.id,
    instituteSlug: inst.slug,
    name: inst.name,
    displayName: branding.instituteName || inst.name,
    code: inst.slug.toUpperCase(),
    currency: inst.currency || 'INR',
    timezone: inst.timezone || 'Asia/Kolkata',
    logoUrl: inst.logoUrl,
    primaryColor: branding.primaryColor || '#1e3a8a',
    secondaryColor: branding.secondaryColor || '#3b82f6',
    accentColor: branding.accentColor || '#10b981',
    user: {
      userId: admin.id,
      fullName: admin.fullName,
      email: admin.email,
      role: admin.role,
    },
  };
}
