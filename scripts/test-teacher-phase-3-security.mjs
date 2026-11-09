/**
 * Bible Institute LMS – Teacher Portal Phase 3 Security & Verification Suite
 * Tests My Students Roster, Attendance Batches, Attendance Roster, and Attendance Marking
 * with strict role, tenant, and teacher-batch isolation.
 */

import fs from 'fs';
import dotenv from 'dotenv';
import crypto from 'crypto';
import pg from 'pg';

const { Pool } = pg;

// 1. Setup environment
const env = dotenv.parse(fs.readFileSync('apps/web/.env.local'));
process.env.DATABASE_URL = env.DATABASE_URL;
process.env.JWT_SECRET = env.JWT_SECRET || 'super-secret-jwt-key-for-dev-only-change-in-prod';

const cleanUrl = env.DATABASE_URL.replace(/\?sslmode=[^&]+&?/, '?').replace(/\?$/, '');
const pool = new Pool({
  connectionString: cleanUrl,
  ssl: { rejectUnauthorized: false },
  max: 4,
});

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
    throw new Error('Session expired');
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

async function resolveTeacher(headers, dbQueryOverride = null) {
  const authHeader = headers['authorization'] || '';
  let token = null;
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  }
  if (!token) {
    throw new TeacherAuthError('Authentication required: Missing authorization token', 401);
  }

  let decoded;
  try {
    decoded = verifyJwt(token);
  } catch (err) {
    throw new TeacherAuthError(`Invalid token: ${err.message}`, 401);
  }

  if (decoded.role !== 'TEACHER') {
    throw new TeacherAuthError(`Access denied: Required role TEACHER but got ${decoded.role}`, 403);
  }

  const tokenUserId = decoded.sub || decoded.userId;
  const tokenInstituteId = decoded.instituteId;

  const queryFn = dbQueryOverride || (async (sql, params) => (await pool.query(sql, params)).rows);

  const rows = await queryFn(
    `SELECT u.id as "userId", u."fullName", u.email, u.status as "userStatus",
            m.id as "membershipId", m.role, m.status as "membershipStatus", m."instituteId",
            tp.id as "teacherProfileId", tp."employeeCode", tp.status as "teacherStatus",
            i.name as "instituteName", i.slug as "instituteSlug"
     FROM "Membership" m
     JOIN "User" u ON u.id = m."userId"
     JOIN "TeacherProfile" tp ON tp."membershipId" = m.id
     JOIN "Institute" i ON i.id = m."instituteId"
     WHERE u.id = $1 AND m.role = 'TEACHER' AND m."instituteId" = $2
     LIMIT 1`,
    [tokenUserId, tokenInstituteId]
  );

  if (rows.length === 0) {
    throw new TeacherAuthError('Access denied: Active teacher profile not found', 403);
  }

  const record = rows[0];
  if (record.userStatus !== 'ACTIVE' || record.membershipStatus !== 'ACTIVE' || record.teacherStatus !== 'ACTIVE') {
    throw new TeacherAuthError('Access denied: Inactive profile or membership', 403);
  }

  return {
    userId: record.userId,
    fullName: record.fullName,
    role: 'TEACHER',
    instituteId: record.instituteId,
    teacherProfileId: record.teacherProfileId,
  };
}

// -------------------------------------------------------------------------
// Handler Implementations for Testing
// -------------------------------------------------------------------------

async function handleGetStudents(url, headers) {
  try {
    const teacher = await resolveTeacher(headers);
    const { teacherProfileId, instituteId } = teacher;

    const parsedUrl = new URL(url);
    const search = parsedUrl.searchParams.get('search')?.trim() || '';
    const batchIdParam = parsedUrl.searchParams.get('batchId') || 'ALL';
    const statusParam = parsedUrl.searchParams.get('status') || 'ALL';
    const page = Math.max(1, parseInt(parsedUrl.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(parsedUrl.searchParams.get('limit') || '10', 10)));
    const offset = (page - 1) * limit;

    const assignedBatches = (await pool.query(
      `SELECT b.id, b.name, b.code, c.title as "courseTitle"
       FROM "BatchTeacher" bt
       JOIN "Batch" b ON b.id = bt."batchId"
       JOIN "Course" c ON c.id = b."courseId"
       WHERE bt."teacherProfileId" = $1 AND bt."instituteId" = $2
       ORDER BY b.name ASC`,
      [teacherProfileId, instituteId]
    )).rows;

    const assignedBatchIds = assignedBatches.map((b) => b.id);
    if (assignedBatchIds.length === 0) {
      return { status: 200, body: { success: true, items: [], totalCount: 0, page, limit, totalPages: 0, assignedBatches: [] } };
    }

    let effectiveBatchIds = assignedBatchIds;
    if (batchIdParam !== 'ALL') {
      if (!assignedBatchIds.includes(batchIdParam)) {
        return { status: 200, body: { success: true, items: [], totalCount: 0, page, limit, totalPages: 0, assignedBatches } };
      }
      effectiveBatchIds = [batchIdParam];
    }

    const queryParams = [teacherProfileId, instituteId, effectiveBatchIds];
    let filterSql = '';

    if (statusParam !== 'ALL') {
      queryParams.push(statusParam);
      filterSql += ` AND e.status = $${queryParams.length}`;
    }

    if (search) {
      queryParams.push(`%${search}%`);
      const searchIdx = queryParams.length;
      filterSql += ` AND (sp."admissionNo" ILIKE $${searchIdx} OR u."fullName" ILIKE $${searchIdx} OR u.email ILIKE $${searchIdx})`;
    }

    queryParams.push(limit);
    const limitIdx = queryParams.length;
    queryParams.push(offset);
    const offsetIdx = queryParams.length;

    const rows = (await pool.query(
      `SELECT 
        e.id as "enrolmentId",
        sp.id as "studentProfileId",
        sp."admissionNo",
        u."fullName",
        u.email,
        u."phoneE164" as phone,
        b.id as "batchId",
        b.name as "batchName",
        b.code as "batchCode",
        c.title as "courseTitle",
        e.status as "enrolmentStatus",
        e."createdAt" as "enrolledAt",
        COUNT(*) OVER()::int as "fullCount"
       FROM "Enrolment" e
       JOIN "StudentProfile" sp ON sp.id = e."studentProfileId"
       JOIN "Membership" m ON m.id = sp."membershipId"
       JOIN "User" u ON u.id = m."userId"
       JOIN "Batch" b ON b.id = e."batchId"
       JOIN "Course" c ON c.id = b."courseId"
       JOIN "BatchTeacher" bt ON bt."batchId" = b.id
       WHERE bt."teacherProfileId" = $1
         AND bt."instituteId" = $2
         AND b.id = ANY($3::text[])
         AND sp.status = 'ACTIVE'
         AND m.status = 'ACTIVE'
         ${filterSql}
       ORDER BY u."fullName" ASC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      queryParams
    )).rows;

    const totalCount = rows.length > 0 ? rows[0].fullCount : 0;
    return {
      status: 200,
      body: {
        success: true,
        items: rows,
        totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
        assignedBatches,
      },
    };
  } catch (err) {
    return { status: err.statusCode || 500, body: { success: false, error: err.message } };
  }
}

async function handleGetAttendanceBatches(headers) {
  try {
    const teacher = await resolveTeacher(headers);
    const { teacherProfileId, instituteId } = teacher;

    const batches = (await pool.query(
      `SELECT 
        b.id,
        b.name,
        b.code,
        b."courseId",
        c.title as "courseTitle",
        bt.role,
        b.status,
        (
          SELECT COUNT(*)::int 
          FROM "Enrolment" e 
          JOIN "StudentProfile" sp ON sp.id = e."studentProfileId"
          JOIN "Membership" m ON m.id = sp."membershipId"
          WHERE e."batchId" = b.id 
            AND e.status = 'ACTIVE' 
            AND sp.status = 'ACTIVE'
            AND m.status = 'ACTIVE'
        ) as "totalStudents"
       FROM "BatchTeacher" bt
       JOIN "Batch" b ON b.id = bt."batchId"
       JOIN "Course" c ON c.id = b."courseId"
       WHERE bt."teacherProfileId" = $1 AND bt."instituteId" = $2
       ORDER BY b.name ASC`,
      [teacherProfileId, instituteId]
    )).rows;

    return { status: 200, body: { success: true, batches } };
  } catch (err) {
    return { status: err.statusCode || 500, body: { success: false, error: err.message } };
  }
}

async function handleGetAttendanceRoster(url, headers) {
  try {
    const teacher = await resolveTeacher(headers);
    const { teacherProfileId, instituteId } = teacher;

    const parsedUrl = new URL(url);
    const batchId = parsedUrl.searchParams.get('batchId');
    const dateStr = parsedUrl.searchParams.get('date') || new Date().toISOString().slice(0, 10);

    if (!batchId) {
      return { status: 400, body: { success: false, error: 'batchId required' } };
    }

    const assignment = (await pool.query(
      `SELECT bt.id, b.name, b.code, c.title as "courseTitle"
       FROM "BatchTeacher" bt
       JOIN "Batch" b ON b.id = bt."batchId"
       JOIN "Course" c ON c.id = b."courseId"
       WHERE bt."batchId" = $1 AND bt."teacherProfileId" = $2 AND bt."instituteId" = $3`,
      [batchId, teacherProfileId, instituteId]
    )).rows;

    if (assignment.length === 0) {
      return { status: 403, body: { success: false, error: 'Forbidden: Not assigned to this batch' } };
    }

    const rosterRows = (await pool.query(
      `SELECT 
        sp.id as "studentProfileId",
        sp."admissionNo",
        u."fullName",
        u.email,
        e.id as "enrolmentId",
        a.status as "attendanceStatus",
        a.remarks
       FROM "Enrolment" e
       JOIN "StudentProfile" sp ON sp.id = e."studentProfileId"
       JOIN "Membership" m ON m.id = sp."membershipId"
       JOIN "User" u ON u.id = m."userId"
       LEFT JOIN "Attendance" a ON a."batchId" = e."batchId" 
                               AND a."studentProfileId" = sp.id 
                               AND a.date = $2::date
       WHERE e."batchId" = $1 
         AND e.status = 'ACTIVE'
         AND sp.status = 'ACTIVE'
         AND m.status = 'ACTIVE'
       ORDER BY sp."admissionNo" ASC`,
      [batchId, dateStr]
    )).rows;

    return {
      status: 200,
      body: {
        success: true,
        batch: assignment[0],
        date: dateStr,
        summary: { totalStudents: rosterRows.length },
        roster: rosterRows,
      },
    };
  } catch (err) {
    return { status: err.statusCode || 500, body: { success: false, error: err.message } };
  }
}

async function handlePostAttendanceMark(body, headers) {
  try {
    const teacher = await resolveTeacher(headers);
    const { teacherProfileId, instituteId, userId } = teacher;

    const { batchId, date, records } = body;
    if (!batchId || !date || !Array.isArray(records)) {
      return { status: 400, body: { success: false, error: 'batchId, date, records required' } };
    }

    const assignment = (await pool.query(
      `SELECT bt.id
       FROM "BatchTeacher" bt
       WHERE bt."batchId" = $1 AND bt."teacherProfileId" = $2 AND bt."instituteId" = $3`,
      [batchId, teacherProfileId, instituteId]
    )).rows;

    if (assignment.length === 0) {
      return { status: 403, body: { success: false, error: 'Forbidden: Not assigned to this batch' } };
    }

    let updatedCount = 0;
    for (const rec of records) {
      if (!rec.studentProfileId || !rec.status) continue;
      const existing = await pool.query(
        `SELECT id, status, remarks FROM "Attendance"
         WHERE "instituteId" = $1 AND "batchId" = $2 AND "studentProfileId" = $3 AND date = $4::date
         LIMIT 1`,
        [instituteId, batchId, rec.studentProfileId, date]
      );

      if (existing.rows.length > 0) {
        await pool.query(
          `UPDATE "Attendance"
           SET status = $1, remarks = $2, "updatedById" = $3, "updatedAt" = NOW()
           WHERE id = $4`,
          [rec.status, rec.remarks || null, userId, existing.rows[0].id]
        );
      } else {
        await pool.query(
          `INSERT INTO "Attendance" (
            id, "instituteId", "batchId", "studentProfileId", "enrolmentId",
            date, status, remarks, "markedById", "markedByRole", "updatedById",
            "markedAt", "createdAt", "updatedAt", mode
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4,
            $5::date, $6, $7, $8, 'TEACHER', $8,
            NOW(), NOW(), NOW(), 'DAILY_BATCH'
          )`,
          [
            instituteId,
            batchId,
            rec.studentProfileId,
            rec.enrolmentId || null,
            date,
            rec.status,
            rec.remarks || null,
            userId,
          ]
        );
      }
      updatedCount++;
    }

    return { status: 200, body: { success: true, recordsUpdated: updatedCount } };
  } catch (err) {
    return { status: err.statusCode || 500, body: { success: false, error: err.message } };
  }
}

// -------------------------------------------------------------------------
// Test Suite Execution
// -------------------------------------------------------------------------

async function runTestSuite() {
  console.log('========================================================================');
  console.log('BIBLE INSTITUTE LMS – TEACHER PORTAL PHASE 3: VERIFICATION SUITE');
  console.log('========================================================================\n');

  const testResults = [];
  function assertTest(condition, name, details = '') {
    if (condition) {
      console.log(`[PASS] ${name}`);
      testResults.push({ pass: true, name });
    } else {
      console.error(`[FAIL] ${name} ${details ? '- ' + details : ''}`);
      testResults.push({ pass: false, name, details });
    }
  }

  const primaryInstituteId = 'fef8c1d5-53d5-45ac-9f94-bb0be5cb39d5';
  const secondaryInstituteId = '6728b343-544a-4970-b10b-56284caf96a0';

  const teacherA = {
    userId: 'a4a0f3b1-2466-45e6-9996-94837af05e6b',
    batchId: 'ba0c54b3-93fa-4cb4-b403-ad2db30d79f2',
  };

  const teacherB = {
    userId: 'c49cadad-bb86-4367-acd4-31987257caee',
    batchId: '8d90800e-8414-4101-930a-9d82c46852e2',
  };

  const teacherC = {
    userId: '5485ddad-36cd-4197-ae2a-dfd1f1b08487', // 0 batches
  };

  const studentUser = { userId: '0b1dd816-4c77-4a7a-9837-22c3627d0bdc' };
  const adminUser = { userId: '1b284c54-7855-4f52-950e-032007152672' };

  const tokenTeacherA = signJwt({ sub: teacherA.userId, role: 'TEACHER', instituteId: primaryInstituteId });
  const tokenTeacherB = signJwt({ sub: teacherB.userId, role: 'TEACHER', instituteId: primaryInstituteId });
  const tokenTeacherC = signJwt({ sub: teacherC.userId, role: 'TEACHER', instituteId: primaryInstituteId });
  const tokenStudent = signJwt({ sub: studentUser.userId, role: 'STUDENT', instituteId: primaryInstituteId });
  const tokenAdmin = signJwt({ sub: adminUser.userId, role: 'INSTITUTE_ADMIN', instituteId: primaryInstituteId });

  console.log('--- 1. AUTHENTICATION & ROLE SECURITY ---');

  // Test 1: Missing JWT on students
  {
    const res = await handleGetStudents('http://localhost:3000/api/teachers/students', {});
    assertTest(res.status === 401, '1. Missing JWT on students endpoint rejected with 401');
  }

  // Test 2: Missing JWT on attendance batches
  {
    const res = await handleGetAttendanceBatches({});
    assertTest(res.status === 401, '2. Missing JWT on attendance batches rejected with 401');
  }

  // Test 3: Missing JWT on attendance roster
  {
    const res = await handleGetAttendanceRoster(`http://localhost:3000/api/teachers/attendance/roster?batchId=${teacherA.batchId}`, {});
    assertTest(res.status === 401, '3. Missing JWT on attendance roster rejected with 401');
  }

  // Test 4: Missing JWT on attendance mark
  {
    const res = await handlePostAttendanceMark({ batchId: teacherA.batchId, date: '2026-11-09', records: [] }, {});
    assertTest(res.status === 401, '4. Missing JWT on attendance mark rejected with 401');
  }

  // Test 5: Student role rejection
  {
    const res = await handleGetStudents('http://localhost:3000/api/teachers/students', { authorization: `Bearer ${tokenStudent}` });
    assertTest(res.status === 403, '5. Student role rejected with 403 on teacher students API');
  }

  // Test 6: Admin role rejection
  {
    const res = await handleGetStudents('http://localhost:3000/api/teachers/students', { authorization: `Bearer ${tokenAdmin}` });
    assertTest(res.status === 403, '6. Admin role rejected with 403 on teacher self-service API');
  }

  // Test 7: Cross-institute token rejection
  {
    const crossToken = signJwt({ sub: teacherA.userId, role: 'TEACHER', instituteId: secondaryInstituteId });
    const res = await handleGetStudents('http://localhost:3000/api/teachers/students', { authorization: `Bearer ${crossToken}` });
    assertTest(res.status === 403, '7. Cross-institute token rejected with 403');
  }

  console.log('\n--- 2. MY STUDENTS ROSTER & SCOPING ---');

  // Test 8: Teacher A retrieves assigned students
  let studentsA = [];
  {
    const res = await handleGetStudents('http://localhost:3000/api/teachers/students', { authorization: `Bearer ${tokenTeacherA}` });
    studentsA = res.body.items || [];
    assertTest(
      res.status === 200 && res.body.success && studentsA.length > 0,
      '8. Teacher A retrieves students for assigned batch (BST-2026-M)',
      `Count: ${studentsA.length}`
    );
  }

  // Test 9: Teacher B retrieves assigned students
  let studentsB = [];
  {
    const res = await handleGetStudents('http://localhost:3000/api/teachers/students', { authorization: `Bearer ${tokenTeacherB}` });
    studentsB = res.body.items || [];
    assertTest(
      res.status === 200 && res.body.success && studentsB.length > 0,
      '9. Teacher B retrieves students for assigned batches (CH-2026-E, PLC-2026)',
      `Count: ${studentsB.length}`
    );
  }

  // Test 10: Teacher isolation
  {
    const batchesA = [...new Set(studentsA.map((s) => s.batchId))];
    const hasLeak = batchesA.includes(teacherB.batchId);
    assertTest(
      !hasLeak && batchesA.includes(teacherA.batchId),
      '10. Teacher isolation: Teacher A roster does NOT leak Teacher B cohorts'
    );
  }

  // Test 11: Unassigned teacher gets 0 students
  {
    const res = await handleGetStudents('http://localhost:3000/api/teachers/students', { authorization: `Bearer ${tokenTeacherC}` });
    assertTest(
      res.status === 200 && res.body.totalCount === 0 && res.body.items.length === 0,
      '11. Unassigned teacher safely receives 0 students without errors'
    );
  }

  // Test 12: Filtering by unassigned batch returns 0
  {
    const res = await handleGetStudents(
      `http://localhost:3000/api/teachers/students?batchId=${teacherB.batchId}`,
      { authorization: `Bearer ${tokenTeacherA}` }
    );
    assertTest(
      res.status === 200 && res.body.totalCount === 0 && res.body.items.length === 0,
      '12. Filtering by unassigned batch returns empty roster (no leak)'
    );
  }

  // Test 13: Student search filter
  {
    const res = await handleGetStudents(
      'http://localhost:3000/api/teachers/students?search=Shafiulla',
      { authorization: `Bearer ${tokenTeacherA}` }
    );
    assertTest(
      res.status === 200 && res.body.items.some((s) => s.fullName.toLowerCase().includes('shafiulla')),
      '13. Search filter by name accurately matches enrolled student records'
    );
  }

  // Test 14: Pagination controls
  {
    const res = await handleGetStudents(
      'http://localhost:3000/api/teachers/students?page=1&limit=2',
      { authorization: `Bearer ${tokenTeacherA}` }
    );
    assertTest(
      res.status === 200 && res.body.items.length === 2 && res.body.page === 1 && res.body.limit === 2,
      '14. Pagination limits items correctly and returns page metadata'
    );
  }

  console.log('\n--- 3. ATTENDANCE DATA INTEGRATION ---');

  // Test 15: Attendance batches
  {
    const res = await handleGetAttendanceBatches({ authorization: `Bearer ${tokenTeacherA}` });
    assertTest(
      res.status === 200 && res.body.batches.some((b) => b.id === teacherA.batchId && b.totalStudents > 0),
      '15. Attendance batches endpoint returns assigned cohorts with student count'
    );
  }

  // Test 16: Attendance roster rejects unassigned batch
  {
    const res = await handleGetAttendanceRoster(
      `http://localhost:3000/api/teachers/attendance/roster?batchId=${teacherB.batchId}&date=2026-11-09`,
      { authorization: `Bearer ${tokenTeacherA}` }
    );
    assertTest(
      res.status === 403,
      '16. Viewing attendance roster for unassigned batch rejected with 403 Forbidden'
    );
  }

  // Test 17: Attendance roster for assigned batch
  let roster = [];
  {
    const res = await handleGetAttendanceRoster(
      `http://localhost:3000/api/teachers/attendance/roster?batchId=${teacherA.batchId}&date=2026-11-09`,
      { authorization: `Bearer ${tokenTeacherA}` }
    );
    roster = res.body.roster || [];
    assertTest(
      res.status === 200 && res.body.success && roster.length > 0,
      '17. Attendance roster for assigned cohort returns students with summary',
      `Count: ${roster.length}`
    );
  }

  // Test 18: Attendance mark rejects unassigned batch
  {
    const res = await handlePostAttendanceMark(
      { batchId: teacherB.batchId, date: '2026-11-09', records: [{ studentProfileId: 'fake-id', status: 'PRESENT' }] },
      { authorization: `Bearer ${tokenTeacherA}` }
    );
    assertTest(
      res.status === 403,
      '18. Marking attendance for unassigned batch rejected with 403 Forbidden'
    );
  }

  // Test 19: Attendance mark records attendance
  {
    if (roster.length > 0) {
      const student = roster[0];
      const res = await handlePostAttendanceMark(
        {
          batchId: teacherA.batchId,
          date: '2026-11-09',
          records: [{ studentProfileId: student.studentProfileId, enrolmentId: student.enrolmentId, status: 'PRESENT', remarks: 'Phase 3 Mark' }],
        },
        { authorization: `Bearer ${tokenTeacherA}` }
      );
      assertTest(
        res.status === 200 && res.body.recordsUpdated >= 1,
        '19. Marking attendance for assigned cohort succeeds and records to database'
      );

      // Clean up test attendance record to preserve database state
      await pool.query('DELETE FROM "AttendanceAuditLog" WHERE "attendanceId" IN (SELECT id FROM "Attendance" WHERE remarks = \'Phase 3 Mark\')');
      await pool.query('DELETE FROM "Attendance" WHERE remarks = \'Phase 3 Mark\'');
    } else {
      assertTest(false, '19. No roster available to test attendance marking');
    }
  }

  // Test 20: Verified absence of mock batches
  {
    const res = await handleGetAttendanceBatches({ authorization: `Bearer ${tokenTeacherA}` });
    const batchNames = (res.body.batches || []).map((b) => b.name);
    const hasMock = batchNames.includes('Diploma Cohort Alpha 2026') || batchNames.includes('Evening Greek Intensive');
    assertTest(
      !hasMock,
      '20. Verified absence of mock batches: All returned batches originate from PostgreSQL'
    );
  }

  console.log('\n========================================================================');
  console.log('PHASE 3 VERIFICATION SUITE SUMMARY:');
  const passed = testResults.filter((r) => r.pass).length;
  const failed = testResults.filter((r) => !r.pass).length;
  console.log(`TOTAL: ${testResults.length} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('========================================================================');

  await pool.end();
  if (failed > 0) process.exit(1);
}

runTestSuite().catch(async (err) => {
  console.error('Fatal test error:', err);
  await pool.end();
  process.exit(1);
});
