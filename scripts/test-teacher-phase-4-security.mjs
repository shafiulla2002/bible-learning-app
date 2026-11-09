/**
 * Bible Institute LMS – Teacher Portal Phase 4 Security & Verification Suite
 * Tests Course Materials, Curriculum & Syllabus Integration:
 * - Token authentication & role isolation (401 / 403)
 * - Multi-tenant institute boundary
 * - Dual course assignment (CourseInstructor & BatchTeacher)
 * - Unassigned course access denial (403)
 * - Full curriculum hierarchy (Course -> Modules -> Chapters -> Lessons -> Resources)
 * - Learning materials scoping & unassigned filter denial (403)
 * - Authorized study material upload endpoint & validation
 * - DRM and download protection flags
 */

import fs from 'fs';
import dotenv from 'dotenv';
import crypto from 'crypto';
import pg from 'pg';

const { Pool } = pg;

// Load environment configuration
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

async function resolveTeacher(headers) {
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
    throw new TeacherAuthError(`Forbidden: Role '${decoded.role}' cannot access Teacher Portal`, 403);
  }

  const userId = decoded.sub || decoded.userId;
  const instituteId = decoded.instituteId;

  const res = await pool.query(
    `SELECT tp.id as "teacherProfileId", tp."instituteId", tp.status, u.id as "userId", u."fullName", u.email
     FROM "TeacherProfile" tp
     JOIN "Membership" m ON m.id = tp."membershipId"
     JOIN "User" u ON u.id = m."userId"
     WHERE u.id = $1 AND tp."instituteId" = $2 AND m.role = 'TEACHER' AND m.status = 'ACTIVE'`,
    [userId, instituteId]
  );

  if (res.rows.length === 0) {
    throw new TeacherAuthError('No active teacher profile found for this account', 403);
  }

  const row = res.rows[0];
  if (row.status !== 'ACTIVE') {
    throw new TeacherAuthError('Teacher profile is inactive or pending review', 403);
  }

  return {
    teacherProfileId: row.teacherProfileId,
    instituteId: row.instituteId,
    userId: row.userId,
    fullName: row.fullName,
    email: row.email,
  };
}

// Emulated Next.js Route Handlers for Courses & Materials
async function handleGetCourses(headers, queryParams = {}) {
  const teacher = await resolveTeacher(headers);
  const { teacherProfileId, instituteId } = teacher;

  const search = queryParams.search?.trim() || '';
  const statusParam = queryParams.status || 'ALL';
  const page = Math.max(1, parseInt(queryParams.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(queryParams.limit || '10', 10)));
  const offset = (page - 1) * limit;

  const assignedCoursesQuery = `
    WITH assigned_refs AS (
      SELECT ci."courseId", ci.role as "instructorRole", 1 as priority
      FROM "CourseInstructor" ci
      WHERE ci."teacherProfileId" = $1 AND ci."instituteId" = $2
      UNION ALL
      SELECT b."courseId", bt.role as "instructorRole", 2 as priority
      FROM "BatchTeacher" bt
      JOIN "Batch" b ON b.id = bt."batchId"
      WHERE bt."teacherProfileId" = $1 AND bt."instituteId" = $2
    ),
    distinct_assigned AS (
      SELECT DISTINCT ON ("courseId") "courseId", "instructorRole"
      FROM assigned_refs
      ORDER BY "courseId", priority ASC
    )
    SELECT 
      c.id,
      c.title,
      c.slug,
      c.description,
      c."coverImage",
      c.level,
      c.language,
      c.status,
      c."updatedAt",
      da."instructorRole" as role,
      cat.id as "categoryId",
      cat.name as "categoryName",
      COALESCE((
        SELECT COUNT(DISTINCT bt."batchId")::int
        FROM "BatchTeacher" bt
        JOIN "Batch" b ON b.id = bt."batchId"
        WHERE bt."teacherProfileId" = $1 AND b."courseId" = c.id
      ), 0) as "batchCount",
      COALESCE((
        SELECT COUNT(DISTINCT e."studentProfileId")::int
        FROM "Enrolment" e
        JOIN "BatchTeacher" bt ON bt."batchId" = e."batchId"
        JOIN "Batch" b ON b.id = e."batchId"
        WHERE bt."teacherProfileId" = $1 AND b."courseId" = c.id AND e.status = 'ACTIVE'
      ), 0) as "studentCount",
      COALESCE((
        SELECT COUNT(m.id)::int
        FROM "Module" m
        WHERE m."courseId" = c.id
      ), 0) as "moduleCount",
      COALESCE((
        SELECT COUNT(ch.id)::int
        FROM "Chapter" ch
        JOIN "Module" m ON m.id = ch."moduleId"
        WHERE m."courseId" = c.id
      ), 0) as "chapterCount",
      COALESCE((
        SELECT COUNT(l.id)::int
        FROM "Lesson" l
        JOIN "Chapter" ch ON ch.id = l."chapterId"
        JOIN "Module" m ON m.id = ch."moduleId"
        WHERE m."courseId" = c.id
      ), 0) as "lessonCount",
      COALESCE((
        SELECT COUNT(lr.id)::int
        FROM "LessonResource" lr
        JOIN "Lesson" l ON l.id = lr."lessonId"
        JOIN "Chapter" ch ON ch.id = l."chapterId"
        JOIN "Module" m ON m.id = ch."moduleId"
        WHERE m."courseId" = c.id
      ), 0) as "resourceCount"
    FROM distinct_assigned da
    JOIN "Course" c ON c.id = da."courseId" AND c."instituteId" = $2 AND c."deletedAt" IS NULL
    LEFT JOIN "CourseCategory" cat ON cat.id = c."categoryId"
    WHERE (
      $3 = '' OR 
      c.title ILIKE '%' || $3 || '%' OR 
      c.description ILIKE '%' || $3 || '%' OR
      c.slug ILIKE '%' || $3 || '%'
    )
    AND ($4 = 'ALL' OR c.status::text = $4)
    ORDER BY c."updatedAt" DESC
    LIMIT $5 OFFSET $6
  `;

  const rows = await pool.query(assignedCoursesQuery, [
    teacherProfileId,
    instituteId,
    search,
    statusParam,
    limit,
    offset,
  ]);

  return { status: 200, data: rows.rows };
}

async function handleGetCourseDetail(headers, courseId) {
  const teacher = await resolveTeacher(headers);
  const { teacherProfileId, instituteId } = teacher;

  // 1. Verify assignment
  const check = await pool.query(
    `SELECT role FROM (
      SELECT ci.role, 1 as priority
      FROM "CourseInstructor" ci
      WHERE ci."courseId" = $1 AND ci."teacherProfileId" = $2 AND ci."instituteId" = $3
      UNION ALL
      SELECT bt.role, 2 as priority
      FROM "BatchTeacher" bt
      JOIN "Batch" b ON b.id = bt."batchId"
      WHERE b."courseId" = $1 AND bt."teacherProfileId" = $2 AND bt."instituteId" = $3
    ) a ORDER BY priority ASC LIMIT 1`,
    [courseId, teacherProfileId, instituteId]
  );

  if (check.rows.length === 0) {
    return { status: 403, error: 'You are not assigned to instruct or teach this course.' };
  }

  const assignedRole = check.rows[0].role;

  // 2. Fetch course
  const courseRes = await pool.query(
    `SELECT c.*, cat.name as "categoryName"
     FROM "Course" c
     LEFT JOIN "CourseCategory" cat ON cat.id = c."categoryId"
     WHERE c.id = $1 AND c."instituteId" = $2 AND c."deletedAt" IS NULL`,
    [courseId, instituteId]
  );

  if (courseRes.rows.length === 0) {
    return { status: 404, error: 'Course not found in this institute' };
  }

  const course = courseRes.rows[0];

  // 3. Modules
  const modulesRes = await pool.query(
    `SELECT id, title, position FROM "Module" WHERE "courseId" = $1 AND "instituteId" = $2 ORDER BY position ASC`,
    [courseId, instituteId]
  );
  const moduleIds = modulesRes.rows.map((m) => m.id);

  let chaptersRes = { rows: [] };
  if (moduleIds.length > 0) {
    chaptersRes = await pool.query(
      `SELECT id, "moduleId", title, position FROM "Chapter" WHERE "moduleId"::text = ANY($1::text[]) AND "instituteId" = $2 ORDER BY position ASC`,
      [moduleIds, instituteId]
    );
  }
  const chapterIds = chaptersRes.rows.map((ch) => ch.id);

  let lessonsRes = { rows: [] };
  if (chapterIds.length > 0) {
    lessonsRes = await pool.query(
      `SELECT id, "chapterId", title, type, "durationSec", "isPreview", "isMandatory", position
       FROM "Lesson" WHERE "chapterId"::text = ANY($1::text[]) AND "instituteId" = $2 ORDER BY position ASC`,
      [chapterIds, instituteId]
    );
  }
  const lessonIds = lessonsRes.rows.map((l) => l.id);

  let resourcesRes = { rows: [] };
  if (lessonIds.length > 0) {
    resourcesRes = await pool.query(
      `SELECT lr.id, lr."lessonId", lr.downloadable, ma."storageKey", ma.kind, ma."mimeType", ma."sizeBytes"::text as "sizeBytes"
       FROM "LessonResource" lr
       JOIN "MediaAsset" ma ON ma.id = lr."mediaAssetId"
       WHERE lr."lessonId"::text = ANY($1::text[]) AND lr."instituteId" = $2`,
      [lessonIds, instituteId]
    );
  }

  return {
    status: 200,
    course: {
      id: course.id,
      title: course.title,
      role: assignedRole,
      moduleCount: modulesRes.rows.length,
      chapterCount: chaptersRes.rows.length,
      lessonCount: lessonsRes.rows.length,
      resourceCount: resourcesRes.rows.length,
      modules: modulesRes.rows,
      chapters: chaptersRes.rows,
      lessons: lessonsRes.rows,
      resources: resourcesRes.rows,
    },
  };
}

async function handleGetMaterials(headers, queryParams = {}) {
  const teacher = await resolveTeacher(headers);
  const { teacherProfileId, instituteId } = teacher;

  const assigned = await pool.query(
    `SELECT DISTINCT "courseId" FROM (
      SELECT ci."courseId" FROM "CourseInstructor" ci WHERE ci."teacherProfileId" = $1 AND ci."instituteId" = $2
      UNION ALL
      SELECT b."courseId" FROM "BatchTeacher" bt JOIN "Batch" b ON b.id = bt."batchId" WHERE bt."teacherProfileId" = $1 AND bt."instituteId" = $2
    ) a`,
    [teacherProfileId, instituteId]
  );

  const assignedCourseIds = assigned.rows.map((r) => r.courseId);
  const courseIdParam = queryParams.courseId || 'ALL';

  if (courseIdParam !== 'ALL' && !assignedCourseIds.includes(courseIdParam)) {
    return { status: 403, error: 'You do not have access to materials for this course.' };
  }

  const targetIds = courseIdParam !== 'ALL' ? [courseIdParam] : assignedCourseIds;

  if (targetIds.length === 0) {
    return { status: 200, data: [] };
  }

  const materials = await pool.query(
    `SELECT lr.id, lr."lessonId", lr.downloadable, ma."storageKey", ma.kind, ma."mimeType", ma."sizeBytes"::text as "sizeBytes",
            l.title as "lessonTitle", c.id as "courseId", c.title as "courseTitle"
     FROM "LessonResource" lr
     JOIN "MediaAsset" ma ON ma.id = lr."mediaAssetId"
     JOIN "Lesson" l ON l.id = lr."lessonId"
     JOIN "Chapter" ch ON ch.id = l."chapterId"
     JOIN "Module" m ON m.id = ch."moduleId"
     JOIN "Course" c ON c.id = m."courseId"
     WHERE lr."instituteId" = $1 AND c.id::text = ANY($2::text[])
     ORDER BY lr."createdAt" DESC`,
    [instituteId, targetIds]
  );

  return { status: 200, data: materials.rows };
}

async function handlePostMaterial(headers, body) {
  const teacher = await resolveTeacher(headers);
  const { teacherProfileId, instituteId, userId } = teacher;

  const { courseId, lessonId, storageKey, kind, mimeType, sizeBytes, downloadable } = body;

  // 1. Verify teacher is assigned to course
  const check = await pool.query(
    `SELECT 1 FROM (
      SELECT 1 FROM "CourseInstructor" WHERE "courseId" = $1 AND "teacherProfileId" = $2 AND "instituteId" = $3
      UNION ALL
      SELECT 1 FROM "BatchTeacher" bt JOIN "Batch" b ON b.id = bt."batchId" WHERE b."courseId" = $1 AND bt."teacherProfileId" = $2 AND bt."instituteId" = $3
    ) a LIMIT 1`,
    [courseId, teacherProfileId, instituteId]
  );

  if (check.rows.length === 0) {
    return { status: 403, error: 'You are not assigned to instruct or teach this course.' };
  }

  // 2. Verify lesson belongs to course
  const lessonCheck = await pool.query(
    `SELECT l.id FROM "Lesson" l
     JOIN "Chapter" ch ON ch.id = l."chapterId"
     JOIN "Module" m ON m.id = ch."moduleId"
     WHERE l.id = $1 AND m."courseId" = $2 AND l."instituteId" = $3`,
    [lessonId, courseId, instituteId]
  );

  if (lessonCheck.rows.length === 0) {
    return { status: 404, error: 'Lesson not found in this course' };
  }

  // 3. Upsert MediaAsset
  let assetRes = await pool.query(`SELECT id FROM "MediaAsset" WHERE "storageKey" = $1`, [storageKey]);
  let mediaAssetId = assetRes.rows[0]?.id;

  if (!mediaAssetId) {
    const insertAsset = await pool.query(
      `INSERT INTO "MediaAsset" (id, "instituteId", "ownerUserId", kind, "storageKey", "mimeType", "sizeBytes", "createdAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW()) RETURNING id`,
      [instituteId, userId, kind, storageKey, mimeType || 'application/pdf', (sizeBytes || 1048576).toString()]
    );
    mediaAssetId = insertAsset.rows[0].id;
  }

  // 4. Create LessonResource
  const isDown = downloadable !== undefined ? Boolean(downloadable) : true;
  const insertRes = await pool.query(
    `INSERT INTO "LessonResource" (id, "instituteId", "lessonId", "mediaAssetId", downloadable, "createdAt")
     VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW()) RETURNING id, "lessonId", "mediaAssetId", downloadable`,
    [instituteId, lessonId, mediaAssetId, isDown]
  );

  return { status: 201, data: insertRes.rows[0] };
}

// RUN TESTS
async function runSuite() {
  console.log('========================================================================');
  console.log('  TEACHER PORTAL PHASE 4: COURSES, CURRICULUM & MATERIALS VERIFICATION');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // 1. Fetch live DB state for test teachers and courses
    const teachers = await pool.query(`
      SELECT tp.id, tp."instituteId", u.id as "userId", u."fullName", u.email
      FROM "TeacherProfile" tp
      JOIN "Membership" m ON m.id = tp."membershipId"
      JOIN "User" u ON u.id = m."userId"
      ORDER BY u."fullName" ASC
    `);

    const drJohnMark = teachers.rows.find((t) => t.fullName.includes('John Mark'));
    const revDavidPaul = teachers.rows.find((t) => t.fullName.includes('David Paul'));

    if (!drJohnMark || !revDavidPaul) {
      throw new Error('Required faculty records not found in database');
    }

    const courses = await pool.query(`
      SELECT id, title, slug, status, "instituteId"
      FROM "Course"
      WHERE "instituteId" = $1 AND "deletedAt" IS NULL
      ORDER BY title ASC
    `, [drJohnMark.instituteId]);

    const biblicalTheologyCourse = courses.rows.find((c) => c.title.includes('Biblical Theology'));
    const pastoralCounselingCourse = courses.rows.find((c) => c.title.includes('Pastoral Leadership'));

    if (!biblicalTheologyCourse || !pastoralCounselingCourse) {
      throw new Error('Required course records not found in database');
    }

    // Generate JWT tokens
    const johnMarkToken = signJwt({
      sub: drJohnMark.userId,
      email: drJohnMark.email,
      role: 'TEACHER',
      instituteId: drJohnMark.instituteId,
    });

    const davidPaulToken = signJwt({
      sub: revDavidPaul.userId,
      email: revDavidPaul.email,
      role: 'TEACHER',
      instituteId: revDavidPaul.instituteId,
    });

    const studentUser = await pool.query(`
      SELECT u.id, u.email, sp."instituteId"
      FROM "StudentProfile" sp
      JOIN "Membership" m ON m.id = sp."membershipId"
      JOIN "User" u ON u.id = m."userId"
      LIMIT 1
    `);

    const studentToken = signJwt({
      sub: studentUser.rows[0].id,
      email: studentUser.rows[0].email,
      role: 'STUDENT',
      instituteId: studentUser.rows[0].instituteId,
    });

    const foreignInstituteId = '00000000-0000-0000-0000-000000000099';
    const foreignTeacherToken = signJwt({
      sub: drJohnMark.userId,
      email: drJohnMark.email,
      role: 'TEACHER',
      instituteId: foreignInstituteId,
    });

    console.log('--- TEST GROUP 1: UNAUTHORIZED ACCESS & ROLE BOUNDARIES ---');
    // Test 1: Missing token on GET /teachers/courses
    try {
      await handleGetCourses({});
      assert(false, 'Missing token on GET /courses should reject with 401');
    } catch (err) {
      assert(err.statusCode === 401, 'Missing token on GET /courses rejected with 401 Unauthorized');
    }

    // Test 2: Missing token on GET /teachers/courses/:courseId
    try {
      await handleGetCourseDetail({}, biblicalTheologyCourse.id);
      assert(false, 'Missing token on GET /courses/:id should reject with 401');
    } catch (err) {
      assert(err.statusCode === 401, 'Missing token on GET /courses/:id rejected with 401 Unauthorized');
    }

    // Test 3: Missing token on GET /teachers/materials
    try {
      await handleGetMaterials({});
      assert(false, 'Missing token on GET /materials should reject with 401');
    } catch (err) {
      assert(err.statusCode === 401, 'Missing token on GET /materials rejected with 401 Unauthorized');
    }

    // Test 4: Missing token on POST /teachers/materials
    try {
      await handlePostMaterial({}, { courseId: biblicalTheologyCourse.id });
      assert(false, 'Missing token on POST /materials should reject with 401');
    } catch (err) {
      assert(err.statusCode === 401, 'Missing token on POST /materials rejected with 401 Unauthorized');
    }

    // Test 5: Student role denied access to teacher courses
    try {
      await handleGetCourses({ authorization: `Bearer ${studentToken}` });
      assert(false, 'Student token on GET /courses should reject with 403');
    } catch (err) {
      assert(err.statusCode === 403, 'Student token on GET /courses strictly rejected with 403 Forbidden');
    }

    // Test 6: Student role denied access to teacher materials
    try {
      await handleGetMaterials({ authorization: `Bearer ${studentToken}` });
      assert(false, 'Student token on GET /materials should reject with 403');
    } catch (err) {
      assert(err.statusCode === 403, 'Student token on GET /materials strictly rejected with 403 Forbidden');
    }

    // Test 7: Foreign institute token rejected or empty
    try {
      await handleGetCourses({ authorization: `Bearer ${foreignTeacherToken}` });
      assert(false, 'Foreign institute token should reject with 403');
    } catch (err) {
      assert(err.statusCode === 403, 'Cross-institute foreign teacher token rejected with 403 Forbidden');
    }

    console.log('\n--- TEST GROUP 2: TEACHER ASSIGNED COURSES & DUAL ASSIGNMENT ---');
    // Test 8: Dr. John Mark assigned courses retrieval
    const johnMarkCourses = await handleGetCourses({ authorization: `Bearer ${johnMarkToken}` });
    assert(johnMarkCourses.status === 200, 'Dr. John Mark assigned courses returns status 200');
    assert(Array.isArray(johnMarkCourses.data), 'Returns courses array');

    const jmCourseIds = johnMarkCourses.data.map((c) => c.id);
    assert(jmCourseIds.includes(biblicalTheologyCourse.id), 'Dr. John Mark assigned courses includes "Building Biblical Theology"');
    assert(!jmCourseIds.includes(pastoralCounselingCourse.id), 'Dr. John Mark assigned courses EXCLUDES unassigned "Pastoral Leadership & Counseling"');

    // Test 9: Course properties & metrics integrity
    const btCourse = johnMarkCourses.data.find((c) => c.id === biblicalTheologyCourse.id);
    assert(btCourse.role === 'LEAD', 'Dr. John Mark role is correctly identified as LEAD on Biblical Theology');
    assert(typeof btCourse.batchCount === 'number', 'Course returns numerical batchCount');
    assert(typeof btCourse.studentCount === 'number', 'Course returns numerical studentCount');
    assert(typeof btCourse.moduleCount === 'number', 'Course returns numerical moduleCount');
    assert(typeof btCourse.lessonCount === 'number', 'Course returns numerical lessonCount');

    console.log('\n--- TEST GROUP 3: FULL CURRICULUM HIERARCHY & UNASSIGNED ACCESS DENIAL ---');
    // Test 10: Authorized course detail retrieval with full hierarchy
    const btDetail = await handleGetCourseDetail(
      { authorization: `Bearer ${johnMarkToken}` },
      biblicalTheologyCourse.id
    );
    assert(btDetail.status === 200, 'Assigned course detail returns status 200');
    assert(btDetail.course.title === biblicalTheologyCourse.title, 'Course title matches database record');
    assert(Array.isArray(btDetail.course.modules), 'Modules array returned in hierarchy');
    assert(Array.isArray(btDetail.course.chapters), 'Chapters array returned in hierarchy');
    assert(Array.isArray(btDetail.course.lessons), 'Lessons array returned in hierarchy');

    // Test 11: Unassigned course access denial (Strict Teacher Boundary)
    const unassignedDetail = await handleGetCourseDetail(
      { authorization: `Bearer ${johnMarkToken}` },
      pastoralCounselingCourse.id
    );
    assert(unassignedDetail.status === 403, 'Dr. John Mark accessing unassigned Pastoral Counseling returns 403 Forbidden');
    assert(unassignedDetail.error.includes('not assigned to instruct or teach this course'), 'Clear security denial message returned');

    // Test 12: Rev. David Paul CAN access Pastoral Counseling (his assigned course)
    const davidPaulDetail = await handleGetCourseDetail(
      { authorization: `Bearer ${davidPaulToken}` },
      pastoralCounselingCourse.id
    );
    assert(davidPaulDetail.status === 200, 'Rev. David Paul authorized access to Pastoral Counseling returns 200');
    assert(davidPaulDetail.course.role === 'LEAD', 'Rev. David Paul recognized as LEAD on Pastoral Counseling');

    console.log('\n--- TEST GROUP 4: LEARNING MATERIALS SCOPING & FILTERS ---');
    // Test 13: Dr. John Mark materials list
    const jmMaterials = await handleGetMaterials({ authorization: `Bearer ${johnMarkToken}` });
    assert(jmMaterials.status === 200, 'Materials list returns status 200');
    assert(Array.isArray(jmMaterials.data), 'Returns materials array');

    // Test 14: Teacher materials filter by unassigned course returns 403 Forbidden
    const unassignedMatFilter = await handleGetMaterials(
      { authorization: `Bearer ${johnMarkToken}` },
      { courseId: pastoralCounselingCourse.id }
    );
    assert(unassignedMatFilter.status === 403, 'Filtering materials by unassigned course returns 403 Forbidden');

    // Test 15: Teacher materials filter by assigned course returns 200
    const assignedMatFilter = await handleGetMaterials(
      { authorization: `Bearer ${johnMarkToken}` },
      { courseId: biblicalTheologyCourse.id }
    );
    assert(assignedMatFilter.status === 200, 'Filtering materials by assigned course returns 200 OK');

    console.log('\n--- TEST GROUP 5: STUDY MATERIAL UPLOAD AUTHORIZATION & DRM FLAGS ---');
    // Find or create a test lesson on biblical theology course to test upload
    let testLesson = btDetail.course.lessons[0];
    if (!testLesson) {
      // Create a test module, chapter and lesson if none exist
      const mod = await pool.query(
        `INSERT INTO "Module" (id, "instituteId", "courseId", title, position, "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, 'Unit 1: Biblical Foundations', 1, NOW(), NOW()) RETURNING id`,
        [drJohnMark.instituteId, biblicalTheologyCourse.id]
      );
      const chap = await pool.query(
        `INSERT INTO "Chapter" (id, "instituteId", "moduleId", title, position, "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, 'Chapter 1: Hermeneutical Principles', 1, NOW(), NOW()) RETURNING id`,
        [drJohnMark.instituteId, mod.rows[0].id]
      );
      const l = await pool.query(
        `INSERT INTO "Lesson" (id, "instituteId", "chapterId", title, type, "durationSec", position, "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, 'Lesson 1.1: Historical Context', 'PDF', 1800, 1, NOW(), NOW()) RETURNING id`,
        [drJohnMark.instituteId, chap.rows[0].id]
      );
      testLesson = l.rows[0];
    }

    // Test 16: Upload material to unassigned course rejected with 403
    const uploadUnassigned = await handlePostMaterial(
      { authorization: `Bearer ${johnMarkToken}` },
      {
        courseId: pastoralCounselingCourse.id,
        lessonId: testLesson.id,
        storageKey: `materials/test-unassigned-${Date.now()}.pdf`,
        kind: 'PDF',
      }
    );
    assert(uploadUnassigned.status === 403, 'Uploading material to unassigned course rejected with 403 Forbidden');

    // Test 17: Upload material to non-existent lesson rejected with 404
    const uploadWrongLesson = await handlePostMaterial(
      { authorization: `Bearer ${johnMarkToken}` },
      {
        courseId: biblicalTheologyCourse.id,
        lessonId: '00000000-0000-0000-0000-000000000000',
        storageKey: `materials/test-wrong-${Date.now()}.pdf`,
        kind: 'PDF',
      }
    );
    assert(uploadWrongLesson.status === 404, 'Uploading material with invalid lesson ID rejected with 404 Not Found');

    // Test 18: Authorized upload with downloadable: true
    const uniqueKey1 = `materials/phase4-test-downloadable-${Date.now()}.pdf`;
    const uploadDownloadable = await handlePostMaterial(
      { authorization: `Bearer ${johnMarkToken}` },
      {
        courseId: biblicalTheologyCourse.id,
        lessonId: testLesson.id,
        storageKey: uniqueKey1,
        kind: 'PDF',
        mimeType: 'application/pdf',
        sizeBytes: 2097152,
        downloadable: true,
      }
    );
    assert(uploadDownloadable.status === 201, 'Authorized upload with downloadable=true returns 201 Created');
    assert(uploadDownloadable.data.downloadable === true, 'Resource preserves downloadable=true flag');

    // Test 19: Authorized upload with downloadable: false (DRM streaming only)
    const uniqueKey2 = `materials/phase4-test-drm-${Date.now()}.mp4`;
    const uploadDrm = await handlePostMaterial(
      { authorization: `Bearer ${johnMarkToken}` },
      {
        courseId: biblicalTheologyCourse.id,
        lessonId: testLesson.id,
        storageKey: uniqueKey2,
        kind: 'VIDEO',
        mimeType: 'video/mp4',
        sizeBytes: 15728640,
        downloadable: false,
      }
    );
    assert(uploadDrm.status === 201, 'Authorized upload with downloadable=false (DRM) returns 201 Created');
    assert(uploadDrm.data.downloadable === false, 'Resource preserves downloadable=false DRM flag');

    // Test 20: Newly uploaded materials now appear in GET /teachers/materials
    const updatedMaterials = await handleGetMaterials(
      { authorization: `Bearer ${johnMarkToken}` },
      { courseId: biblicalTheologyCourse.id }
    );
    const uploadedKeys = updatedMaterials.data.map((m) => m.storageKey);
    assert(uploadedKeys.includes(uniqueKey1), 'Uploaded downloadable material is immediately searchable in materials repository');
    assert(uploadedKeys.includes(uniqueKey2), 'Uploaded DRM video material is immediately searchable in materials repository');

  } catch (err) {
    console.error('Fatal test execution error:', err);
    failed++;
  } finally {
    await pool.end();
  }

  console.log('\n========================================================================');
  console.log(`  PHASE 4 SECURITY TEST RESULTS: ${passed} PASSED / ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite();
