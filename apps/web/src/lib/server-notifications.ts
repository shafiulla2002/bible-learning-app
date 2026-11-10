import { queryDb } from '@/lib/server-db';

export type NotificationCategory =
  | 'STUDENT'
  | 'TEACHER'
  | 'ATTENDANCE'
  | 'FEE'
  | 'ACADEMIC'
  | 'ADMIN';

export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  'STUDENT',
  'TEACHER',
  'ATTENDANCE',
  'FEE',
  'ACADEMIC',
  'ADMIN',
];

export interface ParsedNotification {
  id: string;
  instituteId: string;
  userId: string;
  title: string;
  body: string;
  link: string;
  cleanLink: string;
  category: NotificationCategory;
  eventType: string | null;
  referenceId: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface UserNotificationsResult {
  data: ParsedNotification[];
  unreadCount: number;
  byCategory: Record<NotificationCategory, number>;
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export function parseNotificationRow(r: any): ParsedNotification {
  const link = r.link || '';
  let category: NotificationCategory = 'ADMIN';
  let eventType: string | null = null;
  let referenceId: string | null = null;

  const catMatch = link.match(/#cat=([A-Z_]+)/);
  if (
    catMatch &&
    (NOTIFICATION_CATEGORIES as string[]).includes(catMatch[1])
  ) {
    category = catMatch[1] as NotificationCategory;
  }
  const evtMatch = link.match(/&evt=([A-Z_]+)/);
  if (evtMatch) eventType = evtMatch[1];
  const refMatch = link.match(/&ref=([a-zA-Z0-9_-]+)/);
  if (refMatch) referenceId = refMatch[1];

  const cleanLink = link.split('#')[0] || '/';

  return {
    id: r.id,
    instituteId: r.instituteId,
    userId: r.userId,
    title: r.title,
    body: r.body,
    link,
    cleanLink,
    category,
    eventType,
    referenceId,
    isRead: Boolean(r.readAt),
    readAt: r.readAt ? new Date(r.readAt).toISOString() : null,
    createdAt: r.createdAt
      ? new Date(r.createdAt).toISOString()
      : new Date().toISOString(),
  };
}

export async function getUserUnreadCount(
  instituteId: string,
  userId: string,
): Promise<{
  unreadCount: number;
  byCategory: Record<NotificationCategory, number>;
}> {
  const rows = await queryDb<{ link: string | null }>(
    `SELECT "link" FROM "Notification"
     WHERE "instituteId" = $1 AND "userId" = $2 AND "readAt" IS NULL`,
    [instituteId, userId],
  );

  const byCategory: Record<NotificationCategory, number> = {
    STUDENT: 0,
    TEACHER: 0,
    ATTENDANCE: 0,
    FEE: 0,
    ACADEMIC: 0,
    ADMIN: 0,
  };

  for (const r of rows) {
    const link = r.link || '';
    let matched = false;
    for (const cat of NOTIFICATION_CATEGORIES) {
      if (link.includes(`#cat=${cat}&`)) {
        byCategory[cat]++;
        matched = true;
        break;
      }
    }
    if (!matched) {
      byCategory.ADMIN++;
    }
  }

  return {
    unreadCount: rows.length,
    byCategory,
  };
}

export async function getUserNotifications(
  instituteId: string,
  userId: string,
  query: {
    page?: number | string;
    limit?: number | string;
    category?: string;
    status?: string;
    search?: string;
  } = {},
): Promise<UserNotificationsResult> {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 15));
  const offset = (page - 1) * limit;

  const conditions: string[] = ['"instituteId" = $1', '"userId" = $2'];
  const params: any[] = [instituteId, userId];
  let paramIdx = 3;

  if (query.category && query.category !== 'ALL') {
    conditions.push(`"link" LIKE $${paramIdx}`);
    params.push(`%#cat=${query.category}&%`);
    paramIdx++;
  }

  if (query.status === 'UNREAD') {
    conditions.push('"readAt" IS NULL');
  } else if (query.status === 'READ') {
    conditions.push('"readAt" IS NOT NULL');
  }

  if (query.search && query.search.trim()) {
    conditions.push(
      `("title" ILIKE $${paramIdx} OR "body" ILIKE $${paramIdx})`,
    );
    params.push(`%${query.search.trim()}%`);
    paramIdx++;
  }

  const whereClause = conditions.join(' AND ');

  const countQuery = `SELECT COUNT(*)::int as count FROM "Notification" WHERE ${whereClause}`;
  const dataQuery = `SELECT * FROM "Notification" WHERE ${whereClause} ORDER BY "createdAt" DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
  const dataParams = [...params, limit, offset];

  const [countRes, dataRes, unreadStats] = await Promise.all([
    queryDb<{ count: number }>(countQuery, params),
    queryDb<any>(dataQuery, dataParams),
    getUserUnreadCount(instituteId, userId),
  ]);

  const total = countRes[0]?.count || 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const data = dataRes.map((r) => parseNotificationRow(r));

  return {
    data,
    unreadCount: unreadStats.unreadCount,
    byCategory: unreadStats.byCategory,
    meta: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}

export async function markNotificationAsRead(
  instituteId: string,
  userId: string,
  notificationId: string,
): Promise<ParsedNotification | null> {
  const existing = await queryDb<any>(
    `SELECT * FROM "Notification"
     WHERE "id" = $1 AND "instituteId" = $2 AND "userId" = $3`,
    [notificationId, instituteId, userId],
  );

  if (!existing || existing.length === 0) {
    return null;
  }

  const row = existing[0];
  if (row.readAt) {
    return parseNotificationRow(row);
  }

  const updated = await queryDb<any>(
    `UPDATE "Notification"
     SET "readAt" = NOW()
     WHERE "id" = $1 AND "instituteId" = $2 AND "userId" = $3
     RETURNING *`,
    [notificationId, instituteId, userId],
  );

  return updated[0] ? parseNotificationRow(updated[0]) : null;
}

export async function markAllNotificationsAsRead(
  instituteId: string,
  userId: string,
  category?: string,
): Promise<{ updatedCount: number; unreadCount: number }> {
  let updateSql = `UPDATE "Notification" SET "readAt" = NOW() WHERE "instituteId" = $1 AND "userId" = $2 AND "readAt" IS NULL`;
  const params: any[] = [instituteId, userId];

  if (category && category !== 'ALL') {
    updateSql += ` AND "link" LIKE $3`;
    params.push(`%#cat=${category}&%`);
  }

  await queryDb(updateSql, params);

  const remaining = await getUserUnreadCount(instituteId, userId);
  return {
    updatedCount: 0, // executed
    unreadCount: remaining.unreadCount,
  };
}

