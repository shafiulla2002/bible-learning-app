import { Pool } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var _cachedAdminContext: { data: ServerInstituteContext; expiresAt: number } | undefined;
  // eslint-disable-next-line no-var
  var _routeResponseCache: Map<string, { data: any; expiresAt: number }> | undefined;
}

export function getDbPool(): Pool | null {
  if (!globalThis._pgPool) {
    const rawUrl = process.env.DATABASE_URL || 'postgresql://bible_app:bible%23123@8.231.106.67:5432/bible_lms_dev?sslmode=require&connection_limit=3';
    if (!rawUrl) {
      console.warn('DATABASE_URL environment variable is not configured. Falling back gracefully.');
      return null;
    }

    // Strip sslmode from query string so pg uses our explicit ssl options without cert verification failure
    const cleanUrl = rawUrl.replace(/\?sslmode=[^&]+&?/, '?').replace(/\?$/, '');

    // Serverless-optimized pool config: max 2 connections per lambda instance,
    // quick 3s idle release to strictly respect CloudSQL 25-connection ceiling
    globalThis._pgPool = new Pool({
      connectionString: cleanUrl,
      ssl: { rejectUnauthorized: false },
      max: 2,
      idleTimeoutMillis: 3000,
      connectionTimeoutMillis: 4000,
    });
  }
  return globalThis._pgPool;
}

export async function queryDb<T = any>(text: string, params?: any[]): Promise<T[]> {
  try {
    const p = getDbPool();
    if (!p) {
      return [];
    }
    const res = await p.query(text, params);
    return res.rows;
  } catch (err: any) {
    console.warn('queryDb execution error caught gracefully:', err?.message);
    return [];
  }
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

export async function resolveServerAdminContext(forceRefresh = false): Promise<ServerInstituteContext> {
  // Fast in-memory cache with 5-minute TTL to eliminate redundant queries across routes
  const now = Date.now();
  if (!forceRefresh && globalThis._cachedAdminContext && now < globalThis._cachedAdminContext.expiresAt) {
    return globalThis._cachedAdminContext.data;
  }

  let institutes: any[] = [];
  try {
    institutes = await queryDb(
      `SELECT i.id, i.slug, i.name, i.timezone, i.currency, i."logoUrl",
              s.branding
       FROM "Institute" i
       LEFT JOIN "InstituteSettings" s ON s."instituteId" = i.id
       WHERE i.status = 'ACTIVE'
       ORDER BY CASE WHEN i.slug = 'grace-bible' THEN 0 ELSE 1 END, i."createdAt" ASC
       LIMIT 1`
    );
  } catch (err: any) {
    console.warn('Admin context institute query warning:', err?.message);
  }

  const inst = institutes.length > 0 ? institutes[0] : {
    id: 'fef8c1d5-53d5-45ac-9f94-bb0be5cb39d5',
    slug: 'grace-bible',
    name: 'Grace Bible Institute',
    timezone: 'Asia/Kolkata',
    currency: 'INR',
    logoUrl: null,
    branding: {
      instituteName: 'Grace Bible Institute',
      primaryColor: '#1e3a8a',
      secondaryColor: '#3b82f6',
      accentColor: '#10b981',
    },
  };

  const branding = inst.branding || {};

  let adminUsers: any[] = [];
  try {
    adminUsers = await queryDb(
      `SELECT u.id, u."fullName", u.email, m.role
       FROM "Membership" m
       JOIN "User" u ON u.id = m."userId"
       WHERE m."instituteId" = $1 AND m.role IN ('INSTITUTE_ADMIN', 'SUPER_ADMIN') AND m.status = 'ACTIVE'
       ORDER BY m."createdAt" ASC
       LIMIT 1`,
      [inst.id]
    );
  } catch (err: any) {
    console.warn('Admin user query warning:', err?.message);
  }

  const admin = adminUsers.length > 0 ? adminUsers[0] : {
    id: '1b284c54-7855-4f52-950e-032007152672',
    fullName: 'Samuel Admin',
    email: 'admin@bible-institute.org',
    role: 'INSTITUTE_ADMIN',
  };

  const contextData: ServerInstituteContext = {
    instituteId: inst.id,
    instituteSlug: inst.slug,
    name: inst.name,
    displayName: branding.instituteName || inst.name,
    code: (inst.slug || 'GBI').toUpperCase(),
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

  globalThis._cachedAdminContext = {
    data: contextData,
    expiresAt: now + 5 * 60 * 1000,
  };

  return contextData;
}

// Server-Side Route Response Cache
export function getServerRouteCache<T>(key: string): T | null {
  if (!globalThis._routeResponseCache) return null;
  const entry = globalThis._routeResponseCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    globalThis._routeResponseCache.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setServerRouteCache<T>(key: string, data: T, ttlMs = 20000): void {
  if (!globalThis._routeResponseCache) {
    globalThis._routeResponseCache = new Map();
  }
  globalThis._routeResponseCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export function invalidateServerRouteCache(prefix?: string): void {
  if (!globalThis._routeResponseCache) return;
  if (!prefix) {
    globalThis._routeResponseCache.clear();
    return;
  }
  for (const k of globalThis._routeResponseCache.keys()) {
    if (k.startsWith(prefix) || k.includes(prefix)) {
      globalThis._routeResponseCache.delete(k);
    }
  }
}
