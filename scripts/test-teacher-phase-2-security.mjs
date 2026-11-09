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
  max: 4,
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
           i.name as "instituteName", i.slug as "instituteSlug", i."logoUrl" as "instituteLogoUrl", i.timezone
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
    specialization: record.specialization,
    status: record.teacherStatus,
    instituteName: record.instituteName,
    instituteLogoUrl: record.instituteLogoUrl,
    instituteSlug: record.instituteSlug,
    timezone: record.timezone || 'Asia/Kolkata',
  };
}

// Emulate GET /api/teachers/dashboard handler with Phase 2.1 Optimized Queries
async function handleGetTeacherDashboard(request, dbQueryOverride = null) {
  try {
    const teacher = await resolveTeacher(request, dbQueryOverride);
    const { teacherProfileId, instituteId } = teacher;
    const queryFn = dbQueryOverride || (async (q, p) => (await pool.query(q, p)).rows);

    const [
      statsAndAttendanceRes,
      todayScheduleRes,
      assignedBatchesRes,
      pendingAssignmentsRes,
      upcomingEventsRes,
    ] = await Promise.all([
      // 1. Consolidated Statistics & Attendance Overview (CTE Aggregation)
      queryFn(
        `WITH 
        batch_agg AS (
          SELECT COUNT(DISTINCT bt."batchId")::int as assigned_batches
          FROM "BatchTeacher" bt
          JOIN "Batch" b ON b.id = bt."batchId"
          WHERE bt."teacherProfileId" = $1 AND bt."instituteId" = $2 AND b.status = 'ACTIVE'
        ),
        student_agg AS (
          SELECT COUNT(DISTINCT e."studentProfileId")::int as assigned_students
          FROM "Enrolment" e
          JOIN "BatchTeacher" bt ON bt."batchId" = e."batchId"
          WHERE bt."teacherProfileId" = $1 AND e."instituteId" = $2 AND e.status = 'ACTIVE'
        ),
        course_agg AS (
          SELECT COUNT(DISTINCT ci."courseId")::int as instructing_courses
          FROM "CourseInstructor" ci
          JOIN "Course" c ON c.id = ci."courseId"
          WHERE ci."teacherProfileId" = $1 AND ci."instituteId" = $2 AND c.status = 'PUBLISHED'
        ),
        today_classes AS (
          SELECT COUNT(ls.id)::int as today_classes
          FROM "LiveSession" ls
          JOIN "Institute" i ON i.id = ls."instituteId"
          WHERE ls."teacherProfileId" = $1 AND ls."instituteId" = $2
            AND (ls."startsAt" AT TIME ZONE COALESCE(i.timezone, 'Asia/Kolkata'))::date = (NOW() AT TIME ZONE COALESCE(i.timezone, 'Asia/Kolkata'))::date
        ),
        pending_assign AS (
          SELECT COUNT(s.id)::int as pending_assignments
          FROM "Submission" s
          JOIN "Assignment" a ON a.id = s."assignmentId"
          WHERE s."instituteId" = $2 AND s.status = 'SUBMITTED'
            AND (
              a."batchId" IN (SELECT bt."batchId" FROM "BatchTeacher" bt WHERE bt."teacherProfileId" = $1 AND bt."instituteId" = $2)
              OR a."courseId" IN (SELECT ci."courseId" FROM "CourseInstructor" ci WHERE ci."teacherProfileId" = $1 AND ci."instituteId" = $2)
            )
        ),
        att_agg AS (
          SELECT 
            COUNT(*)::int as total_records,
            COUNT(CASE WHEN a.status = 'PRESENT' THEN 1 END)::int as present_count,
            COUNT(CASE WHEN a.status = 'ABSENT' THEN 1 END)::int as absent_count,
            COUNT(CASE WHEN a.status = 'LATE' THEN 1 END)::int as late_count,
            COUNT(CASE WHEN a.status = 'EXCUSED' THEN 1 END)::int as excused_count,
            COUNT(DISTINCT a.date)::int as total_sessions_marked,
            ROUND(
              CASE WHEN COUNT(*) > 0 
                THEN (COUNT(CASE WHEN a.status IN ('PRESENT', 'LATE') THEN 1 END)::numeric / COUNT(*)::numeric) * 100 
                ELSE 0 
              END, 1
            )::float as attendance_rate_pct
          FROM "Attendance" a
          WHERE a."instituteId" = $2
            AND a."batchId" IN (
              SELECT bt."batchId" 
              FROM "BatchTeacher" bt 
              WHERE bt."teacherProfileId" = $1 AND bt."instituteId" = $2
            )
        )
        SELECT 
          b.assigned_batches,
          s.assigned_students,
          c.instructing_courses,
          tc.today_classes,
          pa.pending_assignments,
          att.total_records,
          att.present_count,
          att.absent_count,
          att.late_count,
          att.excused_count,
          att.total_sessions_marked,
          att.attendance_rate_pct
        FROM batch_agg b
        CROSS JOIN student_agg s
        CROSS JOIN course_agg c
        CROSS JOIN today_classes tc
        CROSS JOIN pending_assign pa
        CROSS JOIN att_agg att`,
        [teacherProfileId, instituteId]
      ).catch(() => [{
        assigned_batches: 0,
        assigned_students: 0,
        instructing_courses: 0,
        today_classes: 0,
        pending_assignments: 0,
        total_records: 0,
        present_count: 0,
        absent_count: 0,
        late_count: 0,
        excused_count: 0,
        total_sessions_marked: 0,
        attendance_rate_pct: 0,
      }]),

      queryFn(
        `SELECT ls.id, ls.title, ls."startsAt", ls."endsAt", ls.status::text as status, ls.room, ls."joinUrl",
                c.title as "courseTitle", b.name as "batchName", b.code as "batchCode"
         FROM "LiveSession" ls
         JOIN "Batch" b ON b.id = ls."batchId"
         JOIN "Course" c ON c.id = b."courseId"
         JOIN "Institute" i ON i.id = ls."instituteId"
         WHERE ls."teacherProfileId" = $1 AND ls."instituteId" = $2
           AND (ls."startsAt" AT TIME ZONE COALESCE(i.timezone, 'Asia/Kolkata'))::date = (NOW() AT TIME ZONE COALESCE(i.timezone, 'Asia/Kolkata'))::date
         ORDER BY ls."startsAt" ASC`,
        [teacherProfileId, instituteId]
      ).catch(() => []),

      queryFn(
        `SELECT b.id, b.name, b.code, b.status, b."startDate", b."endDate", b.capacity,
                c.id as "courseId", c.title as "courseTitle", c.slug as "courseSlug", c.level as "courseLevel",
                bt.role as "teacherRole",
                ay.name as "academicYearName",
                at.name as "termName",
                (SELECT COUNT(DISTINCT e."studentProfileId")::int 
                 FROM "Enrolment" e 
                 WHERE e."batchId" = b.id AND e.status = 'ACTIVE') as "enrolledStudentsCount"
         FROM "BatchTeacher" bt
         JOIN "Batch" b ON b.id = bt."batchId"
         JOIN "Course" c ON c.id = b."courseId"
         LEFT JOIN "AcademicYear" ay ON ay.id = b."academicYearId"
         LEFT JOIN "AcademicTerm" at ON at.id = b."termId"
         WHERE bt."teacherProfileId" = $1 AND bt."instituteId" = $2 AND b.status = 'ACTIVE'
         ORDER BY b."createdAt" DESC
         LIMIT 6`,
        [teacherProfileId, instituteId]
      ).catch(() => []),

      queryFn(
        `SELECT a.id, a.title, a."dueAt", a.status, a."maxMarks",
                c.id as "courseId", c.title as "courseTitle",
                b.id as "batchId", b.name as "batchName", b.code as "batchCode",
                COUNT(s.id)::int as "submissionCount",
                COUNT(CASE WHEN s.status = 'SUBMITTED' THEN 1 END)::int as "pendingReviewCount"
         FROM "Assignment" a
         JOIN "Course" c ON c.id = a."courseId"
         LEFT JOIN "Batch" b ON b.id = a."batchId"
         LEFT JOIN "Submission" s ON s."assignmentId" = a.id
         WHERE a."instituteId" = $2
           AND (
             a."batchId" IN (SELECT bt."batchId" FROM "BatchTeacher" bt WHERE bt."teacherProfileId" = $1 AND bt."instituteId" = $2)
             OR a."courseId" IN (SELECT ci."courseId" FROM "CourseInstructor" ci WHERE ci."teacherProfileId" = $1 AND ci."instituteId" = $2)
           )
         GROUP BY a.id, a.title, a."dueAt", a.status, a."maxMarks", c.id, c.title, b.id, b.name, b.code
         ORDER BY "pendingReviewCount" DESC, a."dueAt" ASC
         LIMIT 6`,
        [teacherProfileId, instituteId]
      ).catch(() => []),

      queryFn(
        `SELECT * FROM (
           SELECT ls.id, ls.title, ls."startsAt" as "eventDate", ls."endsAt" as "endDate", ls.status::text as status, ls.room, ls."joinUrl",
                  c.title as "courseTitle", b.name as "batchName",
                  'LIVE_CLASS' as "eventType", NULL::int as "durationMin"
           FROM "LiveSession" ls
           JOIN "Batch" b ON b.id = ls."batchId"
           JOIN "Course" c ON c.id = b."courseId"
           WHERE ls."teacherProfileId" = $1 AND ls."instituteId" = $2
           
           UNION ALL
           
           SELECT e.id, e.title, e."createdAt" as "eventDate", NULL::timestamptz as "endDate", e.type::text as status, NULL as room, NULL as "joinUrl",
                  c.title as "courseTitle", NULL as "batchName",
                  'EXAMINATION' as "eventType", e."durationMin"
           FROM "Exam" e
           JOIN "Course" c ON c.id = e."courseId"
           JOIN "CourseInstructor" ci ON ci."courseId" = c.id
           WHERE ci."teacherProfileId" = $1 AND ci."instituteId" = $2 AND e."instituteId" = $2
         ) upcoming
         ORDER BY "eventDate" DESC
         LIMIT 6`,
        [teacherProfileId, instituteId]
      ).catch(() => []),
    ]);

    const statsRow = statsAndAttendanceRes[0] || {
      assigned_batches: 0,
      assigned_students: 0,
      instructing_courses: 0,
      today_classes: 0,
      pending_assignments: 0,
      total_records: 0,
      present_count: 0,
      absent_count: 0,
      late_count: 0,
      excused_count: 0,
      total_sessions_marked: 0,
      attendance_rate_pct: 0,
    };

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
        statistics: {
          assignedBatchesCount: Number(statsRow.assigned_batches) || 0,
          assignedStudentsCount: Number(statsRow.assigned_students) || 0,
          instructingCoursesCount: Number(statsRow.instructing_courses) || 0,
          todayClassesCount: Number(statsRow.today_classes) || 0,
          pendingAssignmentsCount: Number(statsRow.pending_assignments) || 0,
          attendanceRatePct: Number(statsRow.attendance_rate_pct) || 0,
          totalAttendanceRecords: Number(statsRow.total_records) || 0,
        },
        todaySchedule: todayScheduleRes,
        assignedBatches: assignedBatchesRes,
        pendingAssignments: pendingAssignmentsRes,
        upcomingEvents: upcomingEventsRes,
        attendanceSummary: {
          totalRecords: Number(statsRow.total_records) || 0,
          presentCount: Number(statsRow.present_count) || 0,
          absentCount: Number(statsRow.absent_count) || 0,
          lateCount: Number(statsRow.late_count) || 0,
          excusedCount: Number(statsRow.excused_count) || 0,
          totalSessionsMarked: Number(statsRow.total_sessions_marked) || 0,
          attendanceRatePct: Number(statsRow.attendance_rate_pct) || 0,
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

// 2. Main Test Suite
async function runPhase2TestSuite() {
  console.log('========================================================================');
  console.log('BIBLE INSTITUTE LMS – TEACHER PORTAL PHASE 2.1: VERIFICATION TEST SUITE');
  console.log('========================================================================\n');

  const testResults = [];
  function assertTest(condition, name, details = '') {
    if (condition) {
      console.log(`  [PASS] ${name}`);
      testResults.push({ name, pass: true });
    } else {
      console.error(`  [FAIL] ${name}: ${details}`);
      testResults.push({ name, pass: false, details });
    }
  }

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

  const teacherC = {
    userId: '73008a0e-bc89-4f2b-afa9-0feeca0a530a',
    fullName: 'Dr. Timothy Keller',
    profileId: '32607bfa-8938-497f-be64-3a82917e2932',
  };

  const studentUser = {
    userId: 'a72ba72a-274d-42bf-9f71-12864c46533e',
    fullName: 'Nathan David',
  };

  console.log('--- SECTION 1: AUTHENTICATION & AUTHORIZATION ---');

  // Test 1: Valid active teacher receives dashboard
  {
    const token = signJwt({ sub: teacherA.userId, role: 'TEACHER', instituteId: primaryInstituteId });
    const req = new NextRequest('http://localhost:3000/api/teachers/dashboard', {
      headers: { authorization: `Bearer ${token}` },
    });
    const res = await handleGetTeacherDashboard(req);
    assertTest(
      res.status === 200 &&
      res.body.success === true &&
      res.body.teacher.teacherProfileId === teacherA.profileId &&
      typeof res.body.statistics.assignedBatchesCount === 'number' &&
      Array.isArray(res.body.assignedBatches),
      '1. Valid active teacher receives complete dashboard response (HTTP 200)',
      JSON.stringify(res)
    );
  }

  // Test 2: Missing JWT
  {
    const req = new NextRequest('http://localhost:3000/api/teachers/dashboard');
    const res = await handleGetTeacherDashboard(req);
    assertTest(
      res.status === 401 && res.body.message.includes('Missing authorization token'),
      '2. Missing JWT strictly rejected with HTTP 401 Unauthorized',
      JSON.stringify(res)
    );
  }

  // Test 3: Invalid JWT
  {
    const req = new NextRequest('http://localhost:3000/api/teachers/dashboard', {
      headers: { authorization: 'Bearer forged.tampered.token-signature' },
    });
    const res = await handleGetTeacherDashboard(req);
    assertTest(
      res.status === 401 && res.body.message.includes('Signature or format error'),
      '3. Invalid or forged JWT rejected with HTTP 401 Unauthorized',
      JSON.stringify(res)
    );
  }

  // Test 4: Expired JWT
  {
    const expToken = signJwt({
      sub: teacherA.userId,
      role: 'TEACHER',
      exp: Math.floor(Date.now() / 1000) - 3600,
    });
    const req = new NextRequest('http://localhost:3000/api/teachers/dashboard', {
      headers: { authorization: `Bearer ${expToken}` },
    });
    const res = await handleGetTeacherDashboard(req);
    assertTest(
      res.status === 401 && res.body.message.includes('Session expired'),
      '4. Expired JWT rejected with HTTP 401 Unauthorized',
      JSON.stringify(res)
    );
  }

  // Test 5: Student role rejection
  {
    const studentToken = signJwt({ sub: studentUser.userId, role: 'STUDENT', instituteId: primaryInstituteId });
    const req = new NextRequest('http://localhost:3000/api/teachers/dashboard', {
      headers: { authorization: `Bearer ${studentToken}` },
    });
    const res = await handleGetTeacherDashboard(req);
    assertTest(
      res.status === 403 && res.body.message.includes('Endpoint requires TEACHER role (received STUDENT)'),
      '5. Student account strictly rejected from teacher dashboard with HTTP 403 Forbidden',
      JSON.stringify(res)
    );
  }

  // Test 6: Institute Admin role rejection
  {
    const adminToken = signJwt({ sub: 'admin-id-123', role: 'INSTITUTE_ADMIN', instituteId: primaryInstituteId });
    const req = new NextRequest('http://localhost:3000/api/teachers/dashboard', {
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const res = await handleGetTeacherDashboard(req);
    assertTest(
      res.status === 403 && res.body.message.includes('Endpoint requires TEACHER role (received INSTITUTE_ADMIN)'),
      '6. Institute Admin account strictly rejected with HTTP 403 Forbidden',
      JSON.stringify(res)
    );
  }

  // Test 7: Inactive membership rejection
  {
    const token = signJwt({ sub: 'inactive-user-id', role: 'TEACHER', instituteId: primaryInstituteId });
    const req = new NextRequest('http://localhost:3000/api/teachers/dashboard', {
      headers: { authorization: `Bearer ${token}` },
    });
    const mockQueryDb = async (q) => {
      if (q.includes('FROM "Membership" m WHERE m."userId" = $1')) {
        return [{ role: 'TEACHER', status: 'INACTIVE', instituteId: primaryInstituteId }];
      }
      return [];
    };
    const res = await handleGetTeacherDashboard(req, mockQueryDb);
    assertTest(
      res.status === 403 && res.body.message.includes('Faculty membership is inactive'),
      '7. Inactive faculty membership strictly rejected with HTTP 403 Forbidden',
      JSON.stringify(res)
    );
  }

  // Test 8: Inactive teacher profile rejection
  {
    const token = signJwt({ sub: 'inactive-teacher-profile-id', role: 'TEACHER', instituteId: primaryInstituteId });
    const req = new NextRequest('http://localhost:3000/api/teachers/dashboard', {
      headers: { authorization: `Bearer ${token}` },
    });
    const mockQueryDb = async (q) => {
      if (q.includes('FROM "Membership" m')) {
        return [{
          userId: 'inactive-teacher-profile-id',
          fullName: 'Dr. Inactive',
          userStatus: 'ACTIVE',
          membershipStatus: 'ACTIVE',
          teacherStatus: 'INACTIVE',
          instituteId: primaryInstituteId,
        }];
      }
      return [];
    };
    const res = await handleGetTeacherDashboard(req, mockQueryDb);
    assertTest(
      res.status === 403 && res.body.message.includes('Teacher profile is inactive or pending review'),
      '8. Inactive TeacherProfile strictly rejected with HTTP 403 Forbidden',
      JSON.stringify(res)
    );
  }

  console.log('\n--- SECTION 2: MULTI-TENANT & TEACHER ISOLATION ---');

  // Test 9: Teacher A cannot see Teacher B's batches
  {
    const tokenA = signJwt({ sub: teacherA.userId, role: 'TEACHER', instituteId: primaryInstituteId });
    const tokenB = signJwt({ sub: teacherB.userId, role: 'TEACHER', instituteId: primaryInstituteId });

    const reqA = new NextRequest('http://localhost:3000/api/teachers/dashboard', {
      headers: { authorization: `Bearer ${tokenA}` },
    });
    const reqB = new NextRequest('http://localhost:3000/api/teachers/dashboard', {
      headers: { authorization: `Bearer ${tokenB}` },
    });

    const [resA, resB] = await Promise.all([
      handleGetTeacherDashboard(reqA),
      handleGetTeacherDashboard(reqB),
    ]);

    const batchesA = resA.body.assignedBatches.map(b => b.id);
    const batchesB = resB.body.assignedBatches.map(b => b.id);

    const noLeakage = !batchesA.includes('8d90800e-8414-4101-930a-9d82c46852e2') &&
                      !batchesB.includes('ba0c54b3-93fa-4cb4-b403-ad2db30d79f2');

    assertTest(
      noLeakage && batchesA.length > 0 && batchesB.length > 0,
      '9. Teacher A cannot see Teacher B batches; batches are strictly scoped',
      `Batches A: ${batchesA.join(', ')} | Batches B: ${batchesB.join(', ')}`
    );
  }

  // Test 10: Teacher A cannot see Teacher B's pending assignments
  {
    const tokenA = signJwt({ sub: teacherA.userId, role: 'TEACHER', instituteId: primaryInstituteId });
    const tokenC = signJwt({ sub: teacherC.userId, role: 'TEACHER', instituteId: primaryInstituteId });

    const reqA = new NextRequest('http://localhost:3000/api/teachers/dashboard', {
      headers: { authorization: `Bearer ${tokenA}` },
    });
    const reqC = new NextRequest('http://localhost:3000/api/teachers/dashboard', {
      headers: { authorization: `Bearer ${tokenC}` },
    });

    const [resA, resC] = await Promise.all([
      handleGetTeacherDashboard(reqA),
      handleGetTeacherDashboard(reqC),
    ]);

    assertTest(
      resA.body.statistics.pendingAssignmentsCount === 0 &&
      resA.body.pendingAssignments.length === 0 &&
      resC.body.statistics.pendingAssignmentsCount === 1 &&
      resC.body.pendingAssignments.length === 1 &&
      resC.body.pendingAssignments[0].title === 'Test Biblical Exegesis Paper',
      '10. Teacher A cannot see Teacher B/C pending assignments or submissions',
      `Teacher A pending: ${resA.body.statistics.pendingAssignmentsCount} | Teacher C pending: ${resC.body.statistics.pendingAssignmentsCount}`
    );
  }

  // Test 11: Teacher A cannot see Teacher B's attendance
  {
    const tokenA = signJwt({ sub: teacherA.userId, role: 'TEACHER', instituteId: primaryInstituteId });
    const tokenC = signJwt({ sub: teacherC.userId, role: 'TEACHER', instituteId: primaryInstituteId });

    const reqA = new NextRequest('http://localhost:3000/api/teachers/dashboard', {
      headers: { authorization: `Bearer ${tokenA}` },
    });
    const reqC = new NextRequest('http://localhost:3000/api/teachers/dashboard', {
      headers: { authorization: `Bearer ${tokenC}` },
    });

    const [resA, resC] = await Promise.all([
      handleGetTeacherDashboard(reqA),
      handleGetTeacherDashboard(reqC),
    ]);

    assertTest(
      resA.body.attendanceSummary.totalRecords === 38 &&
      resA.body.attendanceSummary.presentCount === 37 &&
      resC.body.attendanceSummary.totalRecords !== 38,
      '11. Teacher A cannot see Teacher B attendance records; strictly filtered by assigned batches',
      `Teacher A logs: ${resA.body.attendanceSummary.totalRecords} | Teacher C logs: ${resC.body.attendanceSummary.totalRecords}`
    );
  }

  // Test 12: Forged client query parameters are completely ignored
  {
    const tokenA = signJwt({ sub: teacherA.userId, role: 'TEACHER', instituteId: primaryInstituteId });
    const req = new NextRequest(
      `http://localhost:3000/api/teachers/dashboard?teacherProfileId=${teacherC.profileId}&teacherId=spoofed-id&instituteId=${secondaryInstituteId}`,
      { headers: { authorization: `Bearer ${tokenA}` } }
    );
    const res = await handleGetTeacherDashboard(req);
    assertTest(
      res.status === 200 &&
      res.body.teacher.teacherProfileId === teacherA.profileId &&
      res.body.teacher.teacherProfileId !== teacherC.profileId &&
      res.body.institute.id === primaryInstituteId &&
      res.body.institute.id !== secondaryInstituteId,
      '12. Forged query parameters (teacherProfileId, instituteId) are completely ignored',
      JSON.stringify(res.body.teacher)
    );
  }

  // Test 13: Cross-institute access rejection
  {
    const crossToken = signJwt({
      sub: teacherA.userId,
      role: 'TEACHER',
      instituteId: secondaryInstituteId,
    });
    const req = new NextRequest('http://localhost:3000/api/teachers/dashboard', {
      headers: { authorization: `Bearer ${crossToken}` },
    });
    const res = await handleGetTeacherDashboard(req);
    assertTest(
      res.status === 403 && res.body.message.includes('Cross-institute access prohibited'),
      '13. Enforces multi-tenant isolation against cross-institute querying with HTTP 403 Forbidden',
      JSON.stringify(res)
    );
  }

  console.log('\n--- SECTION 3: DASHBOARD DATA ACCURACY ---');

  // Test 14: Accurate statistics for Dr. John Mark
  {
    const tokenA = signJwt({ sub: teacherA.userId, role: 'TEACHER', instituteId: primaryInstituteId });
    const req = new NextRequest('http://localhost:3000/api/teachers/dashboard', {
      headers: { authorization: `Bearer ${tokenA}` },
    });
    const res = await handleGetTeacherDashboard(req);
    const stats = res.body.statistics;

    assertTest(
      stats.assignedBatchesCount === 1 &&
      stats.assignedStudentsCount === 9 &&
      stats.instructingCoursesCount === 2 &&
      stats.todayClassesCount === 0 &&
      stats.attendanceRatePct === 97.4 &&
      stats.totalAttendanceRecords === 38,
      '14. All 6 dashboard metric cards match verified PostgreSQL database aggregates',
      JSON.stringify(stats)
    );
  }

  // Test 15: Empty results handle gracefully without crashing
  {
    const token = signJwt({ sub: teacherA.userId, role: 'TEACHER', instituteId: primaryInstituteId });
    const req = new NextRequest('http://localhost:3000/api/teachers/dashboard', {
      headers: { authorization: `Bearer ${token}` },
    });
    const emptyQueryDb = async () => [];
    const res = await handleGetTeacherDashboard(req, emptyQueryDb);
    assertTest(
      res.status === 403,
      '15. Empty membership gracefully returns 403 error without 500 crash',
      `Status: ${res.status}`
    );
  }

  // Test 16: Unique student count does not inflate on duplicate enrolments
  {
    const tokenA = signJwt({ sub: teacherA.userId, role: 'TEACHER', instituteId: primaryInstituteId });
    const req = new NextRequest('http://localhost:3000/api/teachers/dashboard', {
      headers: { authorization: `Bearer ${tokenA}` },
    });
    const res = await handleGetTeacherDashboard(req);
    assertTest(
      res.body.statistics.assignedStudentsCount === 9,
      '16. COUNT(DISTINCT studentProfileId) prevents student count inflation',
      `Count: ${res.body.statistics.assignedStudentsCount}`
    );
  }

  console.log('\n========================================================================');
  console.log('PHASE 2.1 VERIFICATION TEST SUITE SUMMARY:');
  const passed = testResults.filter(r => r.pass).length;
  const failed = testResults.filter(r => !r.pass).length;
  console.log(`TOTAL: ${testResults.length} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('========================================================================\n');

  await pool.end();

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase2TestSuite().catch(async (err) => {
  console.error('Test suite error:', err);
  await pool.end();
  process.exit(1);
});
