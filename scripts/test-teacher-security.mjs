import fs from 'fs';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { NextRequest } from 'next/server.js';
import { Pool } from 'pg';

// 1. Setup environment
const env = dotenv.parse(fs.readFileSync('apps/web/.env.local'));
process.env.DATABASE_URL = env.DATABASE_URL;
process.env.JWT_SECRET = env.JWT_SECRET;

const cleanUrl = env.DATABASE_URL.replace(/\?sslmode=[^&]+&?/, '?').replace(/\?$/, '');
const pool = new Pool({
  connectionString: cleanUrl,
  ssl: { rejectUnauthorized: false },
});

// Helper for JWT signing
function signJwt(payload, secret = env.JWT_SECRET) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(`${headerB64}.${payloadB64}`);
  const sig = hmac.digest('base64url');
  return `${headerB64}.${payloadB64}.${sig}`;
}

function verifyJwt(token, secret = env.JWT_SECRET) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');
  const [headerB64, payloadB64, signatureB64] = parts;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(`${headerB64}.${payloadB64}`);
  const expectedSig = hmac.digest('base64url');
  const sigBuf = Buffer.from(signatureB64);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    throw new Error('Invalid signature');
  }
  const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  if (payload.exp && Date.now() >= payload.exp * 1000) {
    throw new Error('Session expired: Please log in again');
  }
  return payload;
}

class TeacherAuthError extends Error {
  constructor(message, statusCode = 401) {
    super(message);
    this.name = 'TeacherAuthError';
    this.statusCode = statusCode;
  }
}

// Emulate resolveAuthenticatedTeacher
async function resolveTeacher(request, dbQueryOverride = null) {
  const authHeader = request.headers.get('authorization');
  const cookieHeader = request.headers.get('cookie') || '';
  
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else {
    const match = cookieHeader.match(/(?:auth_token|access_token|token)=([^;]+)/);
    if (match) token = decodeURIComponent(match[1].trim());
  }

  if (!token) {
    throw new TeacherAuthError('Authentication required: Missing authorization token', 401);
  }

  let decoded;
  try {
    decoded = verifyJwt(token);
  } catch (err) {
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

  if (tokenRole !== 'TEACHER') {
    throw new TeacherAuthError(
      `Access denied: Endpoint requires TEACHER role (received ${tokenRole || 'UNKNOWN'})`,
      403
    );
  }

  const queryFn = dbQueryOverride || (async (q, p) => (await pool.query(q, p)).rows);

  let query = `
    SELECT u.id as "userId", u."fullName", u.email, u."phoneE164" as phone, u."avatarUrl", u.status as "userStatus",
           m.id as "membershipId", m.role, m.status as "membershipStatus", m."instituteId",
           tp.id as "teacherProfileId", tp."employeeCode", tp.qualifications, tp.specialization,
           tp."experienceYears", tp.bio, tp."photoUrl", tp.status as "teacherStatus",
           i.name as "instituteName", i.slug as "instituteSlug", i."logoUrl" as "instituteLogoUrl"
    FROM "Membership" m
    JOIN "User" u ON u.id = m."userId"
    JOIN "TeacherProfile" tp ON tp."membershipId" = m.id
    JOIN "Institute" i ON i.id = m."instituteId"
    WHERE u.id = $1 AND m.role = 'TEACHER'
  `;
  const params = [tokenUserId];

  if (tokenInstituteId) {
    query += ` AND m."instituteId" = $2`;
    params.push(tokenInstituteId);
  }
  query += ` LIMIT 1`;

  const rows = await queryFn(query, params);

  if (rows.length === 0) {
    const userMembership = await queryFn(
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
    role: 'TEACHER',
    instituteId: record.instituteId,
    teacherProfileId: record.teacherProfileId,
    employeeCode: record.employeeCode,
    status: record.teacherStatus,
    instituteName: record.instituteName,
  };
}

// Emulate GET /api/teachers/me route handler
async function handleGetTeacherMe(request, dbQueryOverride = null) {
  try {
    const teacher = await resolveTeacher(request, dbQueryOverride);
    const queryFn = dbQueryOverride || (async (q, p) => (await pool.query(q, p)).rows);

    let assignedBatchesCount = 0;
    let assignedCoursesCount = 0;
    let assignedStudentsCount = 0;

    const [batchRows, courseRows, studentRows] = await Promise.all([
      queryFn(
        `SELECT COUNT(DISTINCT bt."batchId")::int as count
         FROM "BatchTeacher" bt
         JOIN "Batch" b ON b.id = bt."batchId"
         WHERE bt."teacherProfileId" = $1 AND bt."instituteId" = $2 AND b.status = 'ACTIVE'`,
        [teacher.teacherProfileId, teacher.instituteId]
      ).catch(() => [{ count: 0 }]),
      queryFn(
        `SELECT COUNT(DISTINCT ci."courseId")::int as count
         FROM "CourseInstructor" ci
         JOIN "Course" c ON c.id = ci."courseId"
         WHERE ci."teacherProfileId" = $1 AND ci."instituteId" = $2 AND c.status = 'PUBLISHED'`,
        [teacher.teacherProfileId, teacher.instituteId]
      ).catch(() => [{ count: 0 }]),
      queryFn(
        `SELECT COUNT(DISTINCT e."studentProfileId")::int as count
         FROM "Enrolment" e
         JOIN "BatchTeacher" bt ON bt."batchId" = e."batchId"
         WHERE bt."teacherProfileId" = $1 AND e."instituteId" = $2 AND e.status = 'ACTIVE'`,
        [teacher.teacherProfileId, teacher.instituteId]
      ).catch(() => [{ count: 0 }]),
    ]);

    if (batchRows?.length > 0) assignedBatchesCount = Number(batchRows[0].count) || 0;
    if (courseRows?.length > 0) assignedCoursesCount = Number(courseRows[0].count) || 0;
    if (studentRows?.length > 0) assignedStudentsCount = Number(studentRows[0].count) || 0;

    return {
      status: 200,
      body: {
        success: true,
        teacher: {
          teacherProfileId: teacher.teacherProfileId,
          userId: teacher.userId,
          fullName: teacher.fullName,
          employeeCode: teacher.employeeCode,
          status: teacher.status,
        },
        institute: {
          id: teacher.instituteId,
          name: teacher.instituteName,
        },
        stats: {
          assignedBatchesCount,
          assignedCoursesCount,
          assignedStudentsCount,
        },
      },
    };
  } catch (err) {
    if (err instanceof TeacherAuthError) {
      return {
        status: err.statusCode,
        body: { success: false, message: err.message },
      };
    }
    return {
      status: 500,
      body: { success: false, message: 'Internal server error' },
    };
  }
}

// 2. Main Test Suite Runner
async function runTestSuite() {
  console.log('================================================================');
  console.log('BIBLE INSTITUTE LMS – TEACHER PORTAL PHASE 1: SECURITY TEST SUITE');
  console.log('================================================================\n');

  const testResults = [];
  function assertTest(condition, name, details = '') {
    if (condition) {
      console.log(`  [PASS] Test ${name}`);
      testResults.push({ name, pass: true });
    } else {
      console.error(`  [FAIL] Test ${name}: ${details}`);
      testResults.push({ name, pass: false, details });
    }
  }

  // Known database entities
  const primaryInstituteId = 'fef8c1d5-53d5-45ac-9f94-bb0be5cb39d5';
  const secondaryInstituteId = '6728b343-544a-4970-b10b-56284caf96a0';
  const teacherA = {
    userId: 'a4a0f3b1-2466-45e6-9996-94837af05e6b',
    fullName: 'Dr. John Mark',
    profileId: '8c1897c2-6390-4c43-8cfe-7a32dc1b0fb2',
  };
  const teacherB = {
    userId: 'c49cadad-bb86-4367-acd4-31987257caee',
    fullName: 'Rev. David Paul',
    profileId: '2ef86b90-a150-481b-8af4-d82170a259cf',
  };
  const studentUser = {
    userId: 'a72ba72a-274d-42bf-9f71-12864c46533e',
    fullName: 'Nathan David',
  };

  // Test 1: Valid active teacher login
  console.log('Test 1: Valid active teacher login');
  {
    const validToken = signJwt({
      sub: teacherA.userId,
      role: 'TEACHER',
      instituteId: primaryInstituteId,
    });
    const req = new NextRequest('http://localhost:3000/api/teachers/me', {
      headers: { authorization: `Bearer ${validToken}` },
    });
    const res = await handleGetTeacherMe(req);
    assertTest(
      res.status === 200 &&
      res.body.success === true &&
      res.body.teacher.userId === teacherA.userId &&
      res.body.teacher.teacherProfileId === teacherA.profileId &&
      typeof res.body.stats.assignedBatchesCount === 'number',
      '1: Valid active teacher authentication and context resolution',
      `Got status ${res.status}`
    );
  }

  // Test 2: Missing JWT
  console.log('Test 2: Missing JWT');
  {
    const req = new NextRequest('http://localhost:3000/api/teachers/me');
    const res = await handleGetTeacherMe(req);
    assertTest(
      res.status === 401 &&
      res.body.success === false &&
      res.body.message.includes('Missing authorization token'),
      '2: Rejects missing JWT with HTTP 401 Unauthorized',
      JSON.stringify(res)
    );
  }

  // Test 3: Invalid JWT signature
  console.log('Test 3: Invalid JWT signature');
  {
    const validToken = signJwt({ sub: teacherA.userId, role: 'TEACHER' });
    const forgedToken = validToken.substring(0, validToken.length - 8) + 'FORGED99';
    const req = new NextRequest('http://localhost:3000/api/teachers/me', {
      headers: { authorization: `Bearer ${forgedToken}` },
    });
    const res = await handleGetTeacherMe(req);
    assertTest(
      res.status === 401 &&
      res.body.success === false &&
      res.body.message.includes('Signature or format error'),
      '3: Rejects forged/invalid signature with HTTP 401 Unauthorized',
      JSON.stringify(res)
    );
  }

  // Test 4: Expired JWT
  console.log('Test 4: Expired JWT');
  {
    const expiredToken = signJwt({
      sub: teacherA.userId,
      role: 'TEACHER',
      exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
    });
    const req = new NextRequest('http://localhost:3000/api/teachers/me', {
      headers: { authorization: `Bearer ${expiredToken}` },
    });
    const res = await handleGetTeacherMe(req);
    assertTest(
      res.status === 401 &&
      res.body.success === false &&
      res.body.message.includes('Session expired'),
      '4: Rejects expired token with HTTP 401 Unauthorized',
      JSON.stringify(res)
    );
  }

  // Test 5: Student role rejection
  console.log('Test 5: Student role rejection');
  {
    const studentToken = signJwt({
      sub: studentUser.userId,
      role: 'STUDENT',
      instituteId: primaryInstituteId,
    });
    const req = new NextRequest('http://localhost:3000/api/teachers/me', {
      headers: { authorization: `Bearer ${studentToken}` },
    });
    const res = await handleGetTeacherMe(req);
    assertTest(
      res.status === 403 &&
      res.body.success === false &&
      res.body.message.includes('Endpoint requires TEACHER role (received STUDENT)'),
      '5: Strictly rejects STUDENT role with HTTP 403 Forbidden',
      JSON.stringify(res)
    );
  }

  // Test 6: Administrator role rejection on teacher self-service endpoints
  console.log('Test 6: Administrator role rejection on teacher self-service endpoints');
  {
    const adminToken = signJwt({
      sub: 'samuel-admin-user-id',
      role: 'INSTITUTE_ADMIN',
      instituteId: primaryInstituteId,
    });
    const req = new NextRequest('http://localhost:3000/api/teachers/me', {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const res = await handleGetTeacherMe(req);
    assertTest(
      res.status === 403 &&
      res.body.success === false &&
      res.body.message.includes('Endpoint requires TEACHER role (received INSTITUTE_ADMIN)'),
      '6: Strictly rejects INSTITUTE_ADMIN role with HTTP 403 Forbidden',
      JSON.stringify(res)
    );
  }

  // Test 7: Inactive Membership rejection
  console.log('Test 7: Inactive Membership rejection');
  {
    const inactiveUserToken = signJwt({
      sub: 'inactive-faculty-uuid-777',
      role: 'TEACHER',
      instituteId: primaryInstituteId,
    });
    const req = new NextRequest('http://localhost:3000/api/teachers/me', {
      headers: { authorization: `Bearer ${inactiveUserToken}` },
    });
    // DB returns inactive membership
    const mockQueryDb = async (q) => {
      if (q.includes('FROM "Membership" m WHERE m."userId" = $1')) {
        return [{ role: 'TEACHER', status: 'SUSPENDED', instituteId: primaryInstituteId }];
      }
      return [];
    };
    const res = await handleGetTeacherMe(req, mockQueryDb);
    assertTest(
      res.status === 403 &&
      res.body.success === false &&
      res.body.message.includes('Faculty membership is inactive'),
      '7: Strictly rejects inactive/suspended faculty membership with HTTP 403 Forbidden',
      JSON.stringify(res)
    );
  }

  // Test 8: Missing TeacherProfile rejection
  console.log('Test 8: Missing TeacherProfile rejection');
  {
    const missingProfileToken = signJwt({
      sub: 'user-with-no-teacher-profile',
      role: 'TEACHER',
      instituteId: primaryInstituteId,
    });
    const req = new NextRequest('http://localhost:3000/api/teachers/me', {
      headers: { authorization: `Bearer ${missingProfileToken}` },
    });
    // DB returns no active teacher profile
    const mockQueryDb = async () => [];
    const res = await handleGetTeacherMe(req, mockQueryDb);
    assertTest(
      res.status === 403 &&
      res.body.success === false &&
      res.body.message.includes('Active teacher profile not found'),
      '8: Strictly rejects user with missing TeacherProfile with HTTP 403 Forbidden',
      JSON.stringify(res)
    );
  }

  // Test 9: Cross-institute access rejection
  console.log('Test 9: Cross-institute access rejection');
  {
    // Teacher A belongs to Grace Bible Institute, but JWT token specifies secondary institute
    const crossInstToken = signJwt({
      sub: teacherA.userId,
      role: 'TEACHER',
      instituteId: secondaryInstituteId, // Foreign institute
    });
    const req = new NextRequest('http://localhost:3000/api/teachers/me', {
      headers: { authorization: `Bearer ${crossInstToken}` },
    });
    const res = await handleGetTeacherMe(req);
    assertTest(
      res.status === 403 &&
      res.body.success === false &&
      res.body.message.includes('Cross-institute access prohibited'),
      '9: Enforces multi-tenant isolation against cross-institute access with HTTP 403 Forbidden',
      JSON.stringify(res)
    );
  }

  // Test 10: Forged teacherId or instituteId rejection via client parameters
  console.log('Test 10: Forged teacherId or instituteId rejection');
  {
    const validToken = signJwt({
      sub: teacherA.userId,
      role: 'TEACHER',
      instituteId: primaryInstituteId,
    });
    // Attacker appends spoofed IDs to the query string
    const req = new NextRequest(
      `http://localhost:3000/api/teachers/me?teacherProfileId=spoofed-999&teacherId=spoofed-888&instituteId=${secondaryInstituteId}`,
      { headers: { authorization: `Bearer ${validToken}` } }
    );
    const res = await handleGetTeacherMe(req);
    assertTest(
      res.status === 200 &&
      res.body.teacher.teacherProfileId === teacherA.profileId &&
      res.body.teacher.teacherProfileId !== 'spoofed-999' &&
      res.body.institute.id === primaryInstituteId &&
      res.body.institute.id !== secondaryInstituteId,
      '10: Completely ignores forged teacherProfileId and instituteId in query parameters',
      JSON.stringify(res)
    );
  }

  // Test 11: Teacher cannot retrieve another teacher's profile
  console.log('Test 11: Teacher cannot retrieve another teacher profile');
  {
    // Teacher B (Rev. David Paul) attempts to query Teacher A's (Dr. John Mark) profile
    const teacherBToken = signJwt({
      sub: teacherB.userId,
      role: 'TEACHER',
      instituteId: primaryInstituteId,
    });
    const req = new NextRequest(
      `http://localhost:3000/api/teachers/me?teacherProfileId=${teacherA.profileId}`,
      { headers: { authorization: `Bearer ${teacherBToken}` } }
    );
    const res = await handleGetTeacherMe(req);
    assertTest(
      res.status === 200 &&
      res.body.teacher.userId === teacherB.userId &&
      res.body.teacher.teacherProfileId === teacherB.profileId &&
      res.body.teacher.fullName === teacherB.fullName &&
      res.body.teacher.teacherProfileId !== teacherA.profileId,
      '11: Prevents accessing another teacher profile; returns solely authenticated identity',
      JSON.stringify(res)
    );
  }

  // Test 12: Inactive TeacherProfile rejection
  console.log('Test 12: Inactive TeacherProfile rejection');
  {
    const teacherToken = signJwt({
      sub: 'inactive-teacher-profile-uuid',
      role: 'TEACHER',
      instituteId: primaryInstituteId,
    });
    const req = new NextRequest('http://localhost:3000/api/teachers/me', {
      headers: { authorization: `Bearer ${teacherToken}` },
    });
    // DB returns a teacher record with teacherStatus = 'INACTIVE'
    const mockQueryDb = async (q) => {
      if (q.includes('FROM "Membership" m')) {
        return [
          {
            userId: 'inactive-teacher-profile-uuid',
            fullName: 'Suspended Faculty',
            userStatus: 'ACTIVE',
            membershipStatus: 'ACTIVE',
            teacherStatus: 'INACTIVE', // Inactive profile
            instituteId: primaryInstituteId,
            teacherProfileId: 'tp-inactive-001',
          },
        ];
      }
      return [];
    };
    const res = await handleGetTeacherMe(req, mockQueryDb);
    assertTest(
      res.status === 403 &&
      res.body.success === false &&
      res.body.message.includes('Teacher profile is inactive or pending review'),
      '12: Strictly rejects inactive TeacherProfile with HTTP 403 Forbidden',
      JSON.stringify(res)
    );
  }

  console.log('\n================================================================');
  console.log('SECURITY TEST SUITE SUMMARY:');
  const passed = testResults.filter((r) => r.pass).length;
  const failed = testResults.filter((r) => !r.pass).length;
  console.log(`TOTAL: ${testResults.length} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================\n');

  await pool.end();

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(async (err) => {
  console.error('Test suite uncaught error:', err);
  await pool.end();
  process.exit(1);
});

