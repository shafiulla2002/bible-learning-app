import { NextRequest, NextResponse } from 'next/server';
import { queryDb } from '@/lib/server-db';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const devUserId = request.headers.get('x-dev-user-id');
    const devRole = request.headers.get('x-dev-role');
    const devInstituteId = request.headers.get('x-dev-institute-id');

    let userId: string | null = null;
    let role: string | null = null;
    let instituteId: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded: any = jwt.verify(
          token,
          process.env.JWT_SECRET || 'dev-secret-key-bible-institute-lms-12345'
        );
        userId = decoded.sub || decoded.userId;
        role = decoded.role;
        instituteId = decoded.instituteId;
      } catch (err) {
        return NextResponse.json(
          { message: 'Invalid or expired authentication token' },
          { status: 401 }
        );
      }
    } else if (devRole) {
      userId = devUserId;
      role = devRole;
      instituteId = devInstituteId;
    } else {
      // In development mode fallback: resolve primary test student for local preview
      if (process.env.NODE_ENV !== 'production') {
        const testStudent = await queryDb(
          `SELECT u.id as "userId", m.role, m."instituteId"
           FROM "Membership" m
           JOIN "User" u ON u.id = m."userId"
           JOIN "StudentProfile" sp ON sp."membershipId" = m.id
           WHERE m.role = 'STUDENT' AND m.status = 'ACTIVE'
           ORDER BY sp."createdAt" ASC
           LIMIT 1`
        );
        if (testStudent.length > 0) {
          userId = testStudent[0].userId;
          role = testStudent[0].role;
          instituteId = testStudent[0].instituteId;
        }
      }
    }

    if (!userId) {
      return NextResponse.json(
        { message: 'Authentication required. Missing Bearer token.' },
        { status: 401 }
      );
    }

    // Role check: Only STUDENT accounts are permitted
    if (role && role !== 'STUDENT') {
      return NextResponse.json(
        {
          message: `Access denied: Role '${role}' is not authorized to access Student Portal. Only active STUDENT accounts may proceed.`,
        },
        { status: 403 }
      );
    }

    // Resolve membership and student profile from PostgreSQL
    let query = `
      SELECT
        u.id as "userId",
        u."fullName",
        u.email,
        u."phoneE164",
        u."avatarUrl",
        sp.id as "studentProfileId",
        sp."admissionNo",
        sp.church,
        sp."preferredLanguage",
        sp.status as "studentStatus",
        i.id as "instituteId",
        i.name as "instituteName",
        i.slug as "instituteSlug",
        i."logoUrl" as "instituteLogo"
      FROM "Membership" m
      JOIN "User" u ON u.id = m."userId"
      JOIN "StudentProfile" sp ON sp."membershipId" = m.id
      JOIN "Institute" i ON i.id = m."instituteId"
      WHERE m."userId" = $1 AND m.role = 'STUDENT' AND m.status = 'ACTIVE'
    `;
    const params: any[] = [userId];

    if (instituteId) {
      params.push(instituteId);
      query += ` AND m."instituteId" = $${params.length}`;
    }

    query += ` LIMIT 1`;

    const rows = await queryDb(query, params);

    if (rows.length === 0) {
      return NextResponse.json(
        { message: 'No active student profile found for this account in the requested institute.' },
        { status: 403 }
      );
    }

    const row = rows[0];

    // Count active enrolments
    const enrolments = await queryDb(
      `SELECT count(*)::int as count FROM "Enrolment" WHERE "studentProfileId" = $1 AND status = 'ACTIVE'`,
      [row.studentProfileId]
    );
    const activeEnrolmentCount = enrolments.length > 0 ? enrolments[0].count : 0;

    return NextResponse.json({
      student: {
        id: row.userId,
        fullName: row.fullName,
        email: row.email,
        phone: row.phoneE164,
        avatarUrl: row.avatarUrl,
      },
      profile: {
        studentProfileId: row.studentProfileId,
        admissionNo: row.admissionNo,
        church: row.church,
        preferredLanguage: row.preferredLanguage,
        status: row.studentStatus,
      },
      institute: {
        id: row.instituteId,
        name: row.instituteName,
        code: row.instituteSlug ? row.instituteSlug.toUpperCase() : 'BI',
        logoUrl: row.instituteLogo,
      },
      activeEnrolmentCount,
    });
  } catch (error: any) {
    console.error('Error in GET /students/me:', error);
    return NextResponse.json(
      { message: 'Internal server error resolving student identity' },
      { status: 500 }
    );
  }
}

