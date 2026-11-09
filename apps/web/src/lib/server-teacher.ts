import { NextRequest } from 'next/server';
import { queryDb } from '@/lib/server-db';
import { verifyJwtToken, signJwtToken } from '@/lib/server-student';

export interface AuthenticatedTeacherContext {
  userId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  role: 'TEACHER';
  instituteId: string;
  teacherProfileId: string;
  employeeCode: string | null;
  qualifications: string | null;
  specialization: string | null;
  experienceYears: number | null;
  bio: string | null;
  photoUrl: string | null;
  status: string;
  instituteName: string;
  instituteSlug: string;
  instituteLogoUrl: string | null;
  timezone: string;
}

export class TeacherAuthError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 401) {
    super(message);
    this.name = 'TeacherAuthError';
    this.statusCode = statusCode;
  }
}

/**
 * Extracts and strictly verifies the teacher JWT session from request headers/cookies,
 * validates active Membership and TeacherProfile records against the database,
 * and enforces tenant/role boundaries.
 */
export async function resolveAuthenticatedTeacher(
  request: NextRequest
): Promise<AuthenticatedTeacherContext> {
  const authHeader = request.headers.get('authorization');
  const cookieHeader = request.headers.get('cookie') || '';
  
  let token: string | null = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else {
    const match = cookieHeader.match(/(?:auth_token|access_token|token)=([^;]+)/);
    if (match) {
      token = decodeURIComponent(match[1].trim());
    }
  }

  if (!token) {
    throw new TeacherAuthError('Authentication required: Missing authorization token', 401);
  }

  let decoded: any;
  try {
    decoded = verifyJwtToken(token);
  } catch (err: any) {
    if (err?.message?.includes('expired')) {
      throw new TeacherAuthError('Session expired: Please log in again', 401);
    }
    throw new TeacherAuthError('Invalid authentication token: Signature or format error', 401);
  }

  const tokenUserId = decoded.sub || decoded.userId;
  const tokenRole = decoded.role;
  const tokenInstituteId = decoded.instituteId;

  if (!tokenUserId) {
    throw new TeacherAuthError('Invalid token: Subject identity missing', 401);
  }

  // Reject Student role, Admin role, or any non-TEACHER role on teacher self-service endpoints
  if (tokenRole !== 'TEACHER') {
    throw new TeacherAuthError(
      `Access denied: Endpoint requires TEACHER role (received ${tokenRole || 'UNKNOWN'})`,
      403
    );
  }

  // Database verification: Verify user, active membership, active teacher profile, and institute
  let query = `
    SELECT u.id as "userId", u."fullName", u.email, u."phoneE164" as phone, u."avatarUrl", u.status as "userStatus",
           m.id as "membershipId", m.role, m.status as "membershipStatus", m."instituteId",
           tp.id as "teacherProfileId", tp."employeeCode", tp.qualifications, tp.specialization,
           tp."experienceYears", tp.bio, tp."photoUrl", tp.status as "teacherStatus",
           i.name as "instituteName", i.slug as "instituteSlug", i."logoUrl" as "instituteLogoUrl",
           COALESCE(i.timezone, 'Asia/Kolkata') as "instituteTimezone"
    FROM "Membership" m
    JOIN "User" u ON u.id = m."userId"
    JOIN "TeacherProfile" tp ON tp."membershipId" = m.id
    JOIN "Institute" i ON i.id = m."instituteId"
    WHERE u.id = $1 AND m.role = 'TEACHER'
  `;
  const params: any[] = [tokenUserId];

  if (tokenInstituteId) {
    query += ` AND m."instituteId" = $2`;
    params.push(tokenInstituteId);
  }

  query += ` LIMIT 1`;

  let rows: any[] = [];
  try {
    rows = await queryDb(query, params);
  } catch (dbErr: any) {
    console.error('Database error in resolveAuthenticatedTeacher:', dbErr?.message);
    throw new TeacherAuthError('Internal authentication service error', 500);
  }

  if (rows.length === 0) {
    // Check if the user exists with another role or another institute
    const userMembership = await queryDb(
      `SELECT m.role, m.status, m."instituteId" FROM "Membership" m WHERE m."userId" = $1 LIMIT 1`,
      [tokenUserId]
    ).catch(() => []);

    if (userMembership.length > 0) {
      if (userMembership[0].role !== 'TEACHER') {
        throw new TeacherAuthError(`Access denied: User is not registered as faculty`, 403);
      }
      if (tokenInstituteId && userMembership[0].instituteId !== tokenInstituteId) {
        throw new TeacherAuthError(`Access denied: Cross-institute access prohibited`, 403);
      }
      if (userMembership[0].status !== 'ACTIVE') {
        throw new TeacherAuthError(`Access denied: Faculty membership is inactive`, 403);
      }
    }

    throw new TeacherAuthError('Access denied: Active teacher profile not found', 403);
  }

  const record = rows[0];

  if (record.userStatus && record.userStatus !== 'ACTIVE') {
    throw new TeacherAuthError('Access denied: User account is inactive', 403);
  }

  if (record.membershipStatus !== 'ACTIVE') {
    throw new TeacherAuthError('Access denied: Faculty membership is inactive', 403);
  }

  if (record.teacherStatus !== 'ACTIVE') {
    throw new TeacherAuthError('Access denied: Teacher profile is inactive or pending review', 403);
  }

  return {
    userId: record.userId,
    fullName: record.fullName,
    email: record.email,
    phone: record.phone,
    avatarUrl: record.avatarUrl || record.photoUrl,
    role: 'TEACHER',
    instituteId: record.instituteId,
    teacherProfileId: record.teacherProfileId,
    employeeCode: record.employeeCode,
    qualifications: record.qualifications,
    specialization: record.specialization,
    experienceYears: record.experienceYears,
    bio: record.bio,
    photoUrl: record.photoUrl || record.avatarUrl,
    status: record.teacherStatus,
    instituteName: record.instituteName,
    instituteSlug: record.instituteSlug,
    instituteLogoUrl: record.instituteLogoUrl,
    timezone: record.instituteTimezone || 'Asia/Kolkata',
  };
}

export { signJwtToken, verifyJwtToken };

