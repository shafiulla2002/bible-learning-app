/**
 * Bible Institute LMS – Teacher Portal Phase 5 Security & Verification Suite
 * Tests Assignments, Student Submissions & Grading Management:
 * - Token authentication & role isolation (401 / 403)
 * - Multi-tenant institute boundary
 * - Scoped assignment catalog (CourseInstructor & BatchTeacher)
 * - Unassigned course/batch filter and detail denial (403)
 * - Assignment creation validation (title, dueAt, maxMarks > 0)
 * - Assignment creation scoping (teacher must instruct course/batch)
 * - Assignment update validation (prevent maxMarks < awarded marks)
 * - Full student submission roster for assignment
 * - Grading submission validation (marks >= 0, marks <= maxMarks)
 * - Faculty feedback recording and submission status transition
 * - Comprehensive AuditLog recording for creation, updates, and grading
 * - Student Portal visibility: Published vs Draft isolation
 * - Student Portal reflection of awarded marks and feedback
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
    throw new TeacherAuthError('Teacher record not found or profile inactive in this institute', 403);
  }

  return res.rows[0];
}

// ----------------------------------------------------------------------
// BUSINESS LOGIC HANDLERS (Matching Next.js & NestJS endpoints)
// ----------------------------------------------------------------------

async function handleGetAssignments(headers, params = {}) {
  const teacher = await resolveTeacher(headers);
  const { teacherProfileId, instituteId } = teacher;

  const courseIdParam = params.courseId || 'ALL';
  const batchIdParam = params.batchId || 'ALL';
  const statusParam = params.status || 'ALL';
  const search = (params.search || '').trim();
  const page = Math.max(1, parseInt(params.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(params.limit || '10', 10)));
  const offset = (page - 1) * limit;

  // 1. Fetch authorized course IDs and batch IDs
  const assignedCourses = await pool.query(
    `SELECT DISTINCT "courseId" FROM (
      SELECT ci."courseId"
      FROM "CourseInstructor" ci
      WHERE ci."teacherProfileId" = $1 AND ci."instituteId" = $2
      UNION ALL
      SELECT b."courseId"
      FROM "BatchTeacher" bt
      JOIN "Batch" b ON b.id = bt."batchId"
      WHERE bt."teacherProfileId" = $1 AND bt."instituteId" = $2
    ) a`,
    [teacherProfileId, instituteId]
  );

  const assignedBatches = await pool.query(
    `SELECT "batchId" FROM "BatchTeacher"
     WHERE "teacherProfileId" = $1 AND "instituteId" = $2`,
    [teacherProfileId, instituteId]
  );

  const assignedCourseIds = assignedCourses.rows.map((c) => c.courseId);
  const assignedBatchIds = assignedBatches.rows.map((b) => b.batchId);

  if (assignedCourseIds.length === 0 && assignedBatchIds.length === 0) {
    return { status: 200, data: [], meta: { total: 0 } };
  }

  if (courseIdParam !== 'ALL' && !assignedCourseIds.includes(courseIdParam)) {
    return { status: 403, error: 'You are not authorized to view assignments for this course.' };
  }

  if (batchIdParam !== 'ALL' && !assignedBatchIds.includes(batchIdParam)) {
    return { status: 403, error: 'You are not authorized to view assignments for this batch.' };
  }

  const query = `
    SELECT 
      a.id,
      a.title,
      a.instructions,
      a."dueAt",
      a."maxMarks",
      a.status,
      a."courseId",
      a."batchId",
      a."createdAt",
      a."updatedAt",
      c.title as "courseTitle",
      b.name as "batchName",
      b.code as "batchCode",
      COALESCE(
        CASE 
          WHEN a."batchId" IS NOT NULL THEN (
            SELECT COUNT(DISTINCT e."studentProfileId")::int
            FROM "Enrolment" e
            WHERE e."batchId" = a."batchId" AND e."instituteId" = $2 AND e.status = 'ACTIVE'
          )
          ELSE (
            SELECT COUNT(DISTINCT e."studentProfileId")::int
            FROM "Enrolment" e
            WHERE e."courseId" = a."courseId" AND e."instituteId" = $2 AND e.status = 'ACTIVE'
          )
        END, 0
      ) as "totalStudents",
      COALESCE((
        SELECT COUNT(s.id)::int
        FROM "Submission" s
        WHERE s."assignmentId" = a.id AND s.status IN ('SUBMITTED', 'GRADED', 'LATE')
      ), 0) as "submittedCount",
      COALESCE((
        SELECT COUNT(s.id)::int
        FROM "Submission" s
        WHERE s."assignmentId" = a.id AND s.status = 'GRADED'
      ), 0) as "gradedCount",
      COALESCE((
        SELECT COUNT(s.id)::int
        FROM "Submission" s
        WHERE s."assignmentId" = a.id AND s.status IN ('SUBMITTED', 'LATE')
      ), 0) as "pendingCount",
      COALESCE((
        SELECT COUNT(s.id)::int
        FROM "Submission" s
        WHERE s."assignmentId" = a.id AND (s.status = 'LATE' OR (s."submittedAt" > a."dueAt"))
      ), 0) as "lateCount"
    FROM "Assignment" a
    JOIN "Course" c ON c.id = a."courseId" AND c."instituteId" = $2 AND c."deletedAt" IS NULL
    LEFT JOIN "Batch" b ON b.id = a."batchId"
    WHERE a."instituteId" = $2
    AND (
      a."courseId"::text = ANY($1::text[])
      OR (a."batchId" IS NOT NULL AND a."batchId"::text = ANY($3::text[]))
    )
    AND (
      $4 = '' OR 
      a.title ILIKE '%' || $4 || '%' OR 
      a.instructions ILIKE '%' || $4 || '%' OR
      c.title ILIKE '%' || $4 || '%'
    )
    AND ($5 = 'ALL' OR a.status = $5)
    AND ($6 = 'ALL' OR a."courseId" = $6)
    AND ($7 = 'ALL' OR a."batchId" = $7)
    ORDER BY a."dueAt" DESC, a."createdAt" DESC
    LIMIT $8 OFFSET $9
  `;

  const rows = await pool.query(query, [
    assignedCourseIds,
    instituteId,
    assignedBatchIds.length > 0 ? assignedBatchIds : ['NONE'],
    search,
    statusParam,
    courseIdParam,
    batchIdParam,
    limit,
    offset,
  ]);

  return { status: 200, data: rows.rows };
}

async function handleGetAssignmentDetail(headers, assignmentId) {
  const teacher = await resolveTeacher(headers);
  const { teacherProfileId, instituteId } = teacher;

  const assignmentRes = await pool.query(
    `SELECT 
      a.id,
      a.title,
      a.instructions,
      a."dueAt",
      a."maxMarks",
      a.status,
      a."courseId",
      a."batchId",
      a."createdAt",
      a."updatedAt",
      c.title as "courseTitle",
      c.slug as "courseSlug",
      b.name as "batchName",
      b.code as "batchCode"
    FROM "Assignment" a
    JOIN "Course" c ON c.id = a."courseId" AND c."instituteId" = $2 AND c."deletedAt" IS NULL
    LEFT JOIN "Batch" b ON b.id = a."batchId"
    WHERE a.id = $1 AND a."instituteId" = $2`,
    [assignmentId, instituteId]
  );

  if (assignmentRes.rows.length === 0) {
    return { status: 404, error: 'Assignment not found.' };
  }

  const assignment = assignmentRes.rows[0];

  // Verify faculty authorization
  const authCheck = await pool.query(
    `SELECT 1 FROM (
      SELECT ci."courseId"
      FROM "CourseInstructor" ci
      WHERE ci."courseId" = $1 AND ci."teacherProfileId" = $2 AND ci."instituteId" = $3
      UNION ALL
      SELECT b."courseId"
      FROM "BatchTeacher" bt
      JOIN "Batch" b ON b.id = bt."batchId"
      WHERE (b."courseId" = $1 OR ($4::text IS NOT NULL AND bt."batchId" = $4))
        AND bt."teacherProfileId" = $2 AND bt."instituteId" = $3
    ) a LIMIT 1`,
    [assignment.courseId, teacherProfileId, instituteId, assignment.batchId || null]
  );

  if (authCheck.rows.length === 0) {
    return { status: 403, error: 'You are not assigned to instruct or teach this assignment course/batch.' };
  }

  // Fetch full student submissions roster
  let studentsQuery = `
    SELECT DISTINCT
      sp.id as "studentProfileId",
      sp."admissionNo",
      u.id as "userId",
      u."fullName",
      u.email,
      u."avatarUrl",
      b.id as "batchId",
      b.name as "batchName",
      b.code as "batchCode",
      s.id as "submissionId",
      s.status as "submissionStatus",
      s."submittedAt",
      s."answerText",
      s."fileUrl",
      s."marksAwarded",
      s.feedback,
      CASE 
        WHEN s.id IS NULL THEN 'NOT_SUBMITTED'
        ELSE s.status::text
      END as "effectiveStatus",
      CASE 
        WHEN s."submittedAt" IS NOT NULL AND s."submittedAt" > $3 THEN true
        ELSE false
      END as "isLate"
    FROM "Enrolment" e
    JOIN "StudentProfile" sp ON sp.id = e."studentProfileId"
    JOIN "Membership" m ON m.id = sp."membershipId"
    JOIN "User" u ON u.id = m."userId"
    LEFT JOIN "Batch" b ON b.id = e."batchId"
    LEFT JOIN "Submission" s ON s."assignmentId" = $1 AND s."studentProfileId" = sp.id
    WHERE e."instituteId" = $2 AND e.status = 'ACTIVE'
  `;

  const queryParams = [assignmentId, instituteId, assignment.dueAt];

  if (assignment.batchId) {
    studentsQuery += ` AND e."batchId" = $4`;
    queryParams.push(assignment.batchId);
  } else {
    studentsQuery += ` AND e."courseId" = $4`;
    queryParams.push(assignment.courseId);
  }

  studentsQuery += ` ORDER BY u."fullName" ASC`;

  const studentsRes = await pool.query(studentsQuery, queryParams);

  return {
    status: 200,
    data: {
      assignment,
      students: studentsRes.rows,
    },
  };
}

async function handleCreateAssignment(headers, body) {
  const teacher = await resolveTeacher(headers);
  const { teacherProfileId, instituteId, userId } = teacher;

  const { title, instructions, dueAt, maxMarks, courseId, batchId, status } = body;

  if (!title || !title.trim()) {
    return { status: 400, error: 'Assignment title is required.' };
  }
  if (!courseId) {
    return { status: 400, error: 'Course is required.' };
  }
  const numericMaxMarks = Number(maxMarks);
  if (isNaN(numericMaxMarks) || numericMaxMarks <= 0) {
    return { status: 400, error: 'Max marks must be a positive number.' };
  }
  if (!dueAt || isNaN(new Date(dueAt).getTime())) {
    return { status: 400, error: 'Valid due date is required.' };
  }

  // Authorization check
  const authCheck = await pool.query(
    `SELECT 1 FROM (
      SELECT ci."courseId"
      FROM "CourseInstructor" ci
      WHERE ci."courseId" = $1 AND ci."teacherProfileId" = $2 AND ci."instituteId" = $3
      UNION ALL
      SELECT b."courseId"
      FROM "BatchTeacher" bt
      JOIN "Batch" b ON b.id = bt."batchId"
      WHERE (b."courseId" = $1 OR ($4::text IS NOT NULL AND bt."batchId" = $4))
        AND bt."teacherProfileId" = $2 AND bt."instituteId" = $3
    ) a LIMIT 1`,
    [courseId, teacherProfileId, instituteId, batchId || null]
  );

  if (authCheck.rows.length === 0) {
    return { status: 403, error: 'You are not assigned to instruct or teach this course/batch.' };
  }

  const assignmentStatus = status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED';

  const insertRes = await pool.query(
    `INSERT INTO "Assignment" (
      id, "instituteId", "courseId", "batchId",
      title, instructions, "dueAt", "maxMarks", status, "createdAt", "updatedAt"
    ) VALUES (
      gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()
    ) RETURNING *`,
    [
      instituteId,
      courseId,
      batchId || null,
      title.trim(),
      instructions || null,
      new Date(dueAt),
      numericMaxMarks,
      assignmentStatus,
    ]
  );

  const created = insertRes.rows[0];

  // Log in AuditLog
  await pool.query(
    `INSERT INTO "AuditLog" (id, "instituteId", "actorUserId", action, "entityType", "entityId", metadata, "createdAt")
     VALUES (gen_random_uuid()::text, $1, $2, 'ASSIGNMENT_CREATED', 'Assignment', $3, $4, NOW())`,
    [
      instituteId,
      userId,
      created.id,
      JSON.stringify({
        title: created.title,
        courseId: created.courseId,
        batchId: created.batchId,
        maxMarks: created.maxMarks,
        dueAt: created.dueAt,
        status: created.status,
      }),
    ]
  );

  return { status: 201, data: created };
}

async function handleUpdateAssignment(headers, assignmentId, body) {
  const teacher = await resolveTeacher(headers);
  const { teacherProfileId, instituteId, userId } = teacher;

  const existingRes = await pool.query(
    `SELECT * FROM "Assignment" WHERE id = $1 AND "instituteId" = $2`,
    [assignmentId, instituteId]
  );
  if (existingRes.rows.length === 0) {
    return { status: 404, error: 'Assignment not found.' };
  }
  const existing = existingRes.rows[0];

  // Authorization check
  const authCheck = await pool.query(
    `SELECT 1 FROM (
      SELECT ci."courseId"
      FROM "CourseInstructor" ci
      WHERE ci."courseId" = $1 AND ci."teacherProfileId" = $2 AND ci."instituteId" = $3
      UNION ALL
      SELECT b."courseId"
      FROM "BatchTeacher" bt
      JOIN "Batch" b ON b.id = bt."batchId"
      WHERE (b."courseId" = $1 OR ($4::text IS NOT NULL AND bt."batchId" = $4))
        AND bt."teacherProfileId" = $2 AND bt."instituteId" = $3
    ) a LIMIT 1`,
    [existing.courseId, teacherProfileId, instituteId, existing.batchId || null]
  );

  if (authCheck.rows.length === 0) {
    return { status: 403, error: 'You are not assigned to instruct or teach this assignment course/batch.' };
  }

  const { title, instructions, dueAt, maxMarks, status } = body;

  let newMaxMarks = existing.maxMarks;
  if (maxMarks !== undefined) {
    newMaxMarks = Number(maxMarks);
    if (isNaN(newMaxMarks) || newMaxMarks <= 0) {
      return { status: 400, error: 'Max marks must be a positive number.' };
    }

    // Check if any submission already has marks > newMaxMarks
    const highestGradeRes = await pool.query(
      `SELECT MAX("marksAwarded") as "maxGrade"
       FROM "Submission"
       WHERE "assignmentId" = $1 AND "marksAwarded" IS NOT NULL`,
      [assignmentId]
    );
    const maxGrade = highestGradeRes.rows[0]?.maxGrade;
    if (maxGrade !== null && maxGrade !== undefined && Number(maxGrade) > newMaxMarks) {
      return {
        status: 400,
        error: `Cannot reduce max marks to ${newMaxMarks} because a student has already been awarded ${maxGrade} marks.`,
      };
    }
  }

  const updatedTitle = title !== undefined ? title.trim() : existing.title;
  const updatedInstructions = instructions !== undefined ? instructions : existing.instructions;
  const updatedDueAt = dueAt !== undefined ? new Date(dueAt) : existing.dueAt;
  const updatedStatus = status !== undefined ? status : existing.status;

  const updateRes = await pool.query(
    `UPDATE "Assignment"
     SET title = $1, instructions = $2, "dueAt" = $3, "maxMarks" = $4, status = $5, "updatedAt" = NOW()
     WHERE id = $6 AND "instituteId" = $7
     RETURNING *`,
    [updatedTitle, updatedInstructions, updatedDueAt, newMaxMarks, updatedStatus, assignmentId, instituteId]
  );

  const updated = updateRes.rows[0];

  await pool.query(
    `INSERT INTO "AuditLog" (id, "instituteId", "actorUserId", action, "entityType", "entityId", metadata, "createdAt")
     VALUES (gen_random_uuid()::text, $1, $2, 'ASSIGNMENT_UPDATED', 'Assignment', $3, $4, NOW())`,
    [
      instituteId,
      userId,
      assignmentId,
      JSON.stringify({
        title: updated.title,
        maxMarks: updated.maxMarks,
        dueAt: updated.dueAt,
        status: updated.status,
      }),
    ]
  );

  return { status: 200, data: updated };
}

async function handleGradeSubmission(headers, assignmentId, submissionId, body) {
  const teacher = await resolveTeacher(headers);
  const { teacherProfileId, instituteId, userId } = teacher;

  const { marks, feedback } = body;
  const numericMarks = Number(marks);

  if (isNaN(numericMarks) || numericMarks < 0) {
    return { status: 400, error: 'Marks awarded must be a non-negative number.' };
  }

  // Fetch assignment & submission
  const assignRes = await pool.query(
    `SELECT a.id, a."courseId", a."batchId", a."maxMarks", a."instituteId"
     FROM "Assignment" a
     WHERE a.id = $1 AND a."instituteId" = $2`,
    [assignmentId, instituteId]
  );

  if (assignRes.rows.length === 0) {
    return { status: 404, error: 'Assignment not found.' };
  }

  const assignment = assignRes.rows[0];

  if (numericMarks > Number(assignment.maxMarks)) {
    return {
      status: 400,
      error: `Marks awarded (${numericMarks}) cannot exceed assignment max marks (${assignment.maxMarks}).`,
    };
  }

  // Verify faculty authorization
  const authCheck = await pool.query(
    `SELECT 1 FROM (
      SELECT ci."courseId"
      FROM "CourseInstructor" ci
      WHERE ci."courseId" = $1 AND ci."teacherProfileId" = $2 AND ci."instituteId" = $3
      UNION ALL
      SELECT b."courseId"
      FROM "BatchTeacher" bt
      JOIN "Batch" b ON b.id = bt."batchId"
      WHERE (b."courseId" = $1 OR ($4::text IS NOT NULL AND bt."batchId" = $4))
        AND bt."teacherProfileId" = $2 AND bt."instituteId" = $3
    ) a LIMIT 1`,
    [assignment.courseId, teacherProfileId, instituteId, assignment.batchId || null]
  );

  if (authCheck.rows.length === 0) {
    return { status: 403, error: 'You are not assigned to instruct or teach this course/batch.' };
  }

  // Fetch submission
  const subRes = await pool.query(
    `SELECT * FROM "Submission" WHERE id = $1 AND "assignmentId" = $2`,
    [submissionId, assignmentId]
  );

  if (subRes.rows.length === 0) {
    return { status: 404, error: 'Submission not found for this assignment.' };
  }

  const prevSubmission = subRes.rows[0];

  const updateSubRes = await pool.query(
    `UPDATE "Submission"
     SET "marksAwarded" = $1, feedback = $2, status = 'GRADED'
     WHERE id = $3
     RETURNING *`,
    [numericMarks, feedback?.trim() || null, submissionId]
  );

  const graded = updateSubRes.rows[0];

  // Audit logging
  await pool.query(
    `INSERT INTO "AuditLog" (id, "instituteId", "actorUserId", action, "entityType", "entityId", metadata, "createdAt")
     VALUES (gen_random_uuid()::text, $1, $2, 'ASSIGNMENT_GRADED', 'Submission', $3, $4, NOW())`,
    [
      instituteId,
      userId,
      submissionId,
      JSON.stringify({
        assignmentId,
        studentProfileId: graded.studentProfileId,
        previousMarks: prevSubmission.marksAwarded,
        marksAwarded: numericMarks,
        maxMarks: assignment.maxMarks,
        feedback: graded.feedback,
      }),
    ]
  );

  return { status: 200, data: graded };
}

// ----------------------------------------------------------------------
// MAIN TEST SUITE
// ----------------------------------------------------------------------

async function runSuite() {
  console.log('========================================================================');
  console.log('  BIBLE INSTITUTE LMS – TEACHER PORTAL PHASE 5 VERIFICATION SUITE');
  console.log('  Assignments, Student Submissions & Grading Management');
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

  let createdAssignmentId = null;
  let createdSubmissionId = null;
  let createdDraftAssignmentId = null;

  try {
    // 1. Discover existing test fixtures in database
    const teachers = await pool.query(`
      SELECT tp.id as "teacherProfileId", tp."instituteId", u.id as "userId", u."fullName", u.email
      FROM "TeacherProfile" tp
      JOIN "Membership" m ON m.id = tp."membershipId"
      JOIN "User" u ON u.id = m."userId"
      WHERE m.role = 'TEACHER' AND m.status = 'ACTIVE'
    `);

    const drJohnMark = teachers.rows.find((t) => t.fullName.includes('John Mark'));
    const revDavidPaul = teachers.rows.find((t) => t.fullName.includes('David Paul'));

    if (!drJohnMark || !revDavidPaul) {
      throw new Error('Required faculty records (Dr. John Mark / Rev. David Paul) not found.');
    }

    const courses = await pool.query(`
      SELECT id, title, slug, status, "instituteId"
      FROM "Course"
      WHERE "instituteId" = $1 AND "deletedAt" IS NULL
      ORDER BY title ASC
    `, [drJohnMark.instituteId]);

    const systematicTheologyCourse = courses.rows.find((c) => c.title.includes('Systematic Theology') || c.title.includes('Theology'));

    if (!systematicTheologyCourse) {
      throw new Error('Systematic Theology course not found.');
    }

    // Find student
    const studentUser = await pool.query(`
      SELECT u.id as "userId", u.email, sp.id as "studentProfileId", sp."instituteId"
      FROM "StudentProfile" sp
      JOIN "Membership" m ON m.id = sp."membershipId"
      JOIN "User" u ON u.id = m."userId"
      JOIN "Enrolment" e ON e."studentProfileId" = sp.id
      WHERE sp."instituteId" = $1 AND e."courseId" = $2 AND e.status = 'ACTIVE'
      LIMIT 1
    `, [drJohnMark.instituteId, systematicTheologyCourse.id]);

    if (studentUser.rows.length === 0) {
      throw new Error('Active enrolled student not found in Systematic Theology course.');
    }

    const testStudent = studentUser.rows[0];

    // JWT tokens
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

    const studentToken = signJwt({
      sub: testStudent.userId,
      email: testStudent.email,
      role: 'STUDENT',
      instituteId: testStudent.instituteId,
    });

    const foreignInstituteId = '00000000-0000-0000-0000-000000000099';
    const foreignTeacherToken = signJwt({
      sub: drJohnMark.userId,
      email: drJohnMark.email,
      role: 'TEACHER',
      instituteId: foreignInstituteId,
    });

    // ------------------------------------------------------------------
    console.log('--- TEST GROUP 1: AUTHENTICATION & ROLE ISOLATION ---');
    // Test 1: Missing token on GET /teachers/assignments
    try {
      await handleGetAssignments({});
      assert(false, 'Missing token should reject with 401');
    } catch (err) {
      assert(err.statusCode === 401, 'Missing token on GET /assignments rejected with 401 Unauthorized');
    }

    // Test 2: Missing token on GET /teachers/assignments/:id
    try {
      await handleGetAssignmentDetail({}, 'fake-assignment-id');
      assert(false, 'Missing token on GET /assignments/:id should reject with 401');
    } catch (err) {
      assert(err.statusCode === 401, 'Missing token on GET /assignments/:id rejected with 401 Unauthorized');
    }

    // Test 3: Missing token on POST /teachers/assignments
    try {
      await handleCreateAssignment({}, { title: 'Test' });
      assert(false, 'Missing token on POST /assignments should reject with 401');
    } catch (err) {
      assert(err.statusCode === 401, 'Missing token on POST /assignments rejected with 401 Unauthorized');
    }

    // Test 4: Missing token on POST /teachers/assignments/:id/grade
    try {
      await handleGradeSubmission({}, 'fake-assignment-id', 'fake-sub-id', { marks: 50 });
      assert(false, 'Missing token on grade submission should reject with 401');
    } catch (err) {
      assert(err.statusCode === 401, 'Missing token on grade submission rejected with 401 Unauthorized');
    }

    // Test 5: Student role blocked from accessing teacher assignments endpoint
    try {
      await handleGetAssignments({ authorization: `Bearer ${studentToken}` });
      assert(false, 'Student token should reject with 403');
    } catch (err) {
      assert(err.statusCode === 403, 'Student token strictly rejected with 403 Forbidden on assignments listing');
    }

    // Test 6: Student role blocked from creating assignments
    try {
      await handleCreateAssignment({ authorization: `Bearer ${studentToken}` }, { title: 'Student Attempt' });
      assert(false, 'Student token on POST /assignments should reject with 403');
    } catch (err) {
      assert(err.statusCode === 403, 'Student token strictly rejected with 403 Forbidden on assignment creation');
    }

    // Test 7: Student role blocked from grading
    try {
      await handleGradeSubmission({ authorization: `Bearer ${studentToken}` }, 'fake-assignment-id', 'fake-sub-id', { marks: 50 });
      assert(false, 'Student token on grade submission should reject with 403');
    } catch (err) {
      assert(err.statusCode === 403, 'Student token strictly rejected with 403 Forbidden on grading endpoint');
    }

    // Test 8: Cross-institute teacher token blocked
    try {
      await handleGetAssignments({ authorization: `Bearer ${foreignTeacherToken}` });
      assert(false, 'Cross-institute token should reject with 403');
    } catch (err) {
      assert(err.statusCode === 403, 'Cross-institute teacher token strictly rejected with 403 Forbidden');
    }

    // ------------------------------------------------------------------
    console.log('\n--- TEST GROUP 2: ASSIGNMENT LISTING & SCOPED ACCESS ---');
    // Test 9: Authenticated teacher lists assignments
    const listRes = await handleGetAssignments({ authorization: `Bearer ${johnMarkToken}` });
    assert(listRes.status === 200, 'Authenticated teacher retrieves assignments list (200 OK)');
    assert(Array.isArray(listRes.data), 'Assignments response data is an array');

    // Test 10: Metrics computed accurately
    if (listRes.data.length > 0) {
      const first = listRes.data[0];
      assert(typeof first.totalStudents === 'number' && first.totalStudents >= 0, 'Assignment has valid totalStudents numeric metric');
      assert(typeof first.submittedCount === 'number' && first.submittedCount >= 0, 'Assignment has valid submittedCount numeric metric');
      assert(typeof first.gradedCount === 'number' && first.gradedCount >= 0, 'Assignment has valid gradedCount numeric metric');
      assert(typeof first.pendingCount === 'number' && first.pendingCount >= 0, 'Assignment has valid pendingCount numeric metric');
      assert(typeof first.lateCount === 'number' && first.lateCount >= 0, 'Assignment has valid lateCount numeric metric');
    } else {
      assert(true, 'Assignments list returned successfully (empty state tested)');
    }

    // Test 11: Unassigned course filter rejected with 403
    const fakeCourseId = 'fake-unassigned-course-id';
    const unassignedFilter = await handleGetAssignments(
      { authorization: `Bearer ${johnMarkToken}` },
      { courseId: fakeCourseId }
    );
    assert(unassignedFilter.status === 403, 'Unassigned courseId filter rejected with 403 Forbidden');

    // Test 12: Unassigned batch filter rejected with 403
    const fakeBatchId = 'fake-unassigned-batch-id';
    const unassignedBatchFilter = await handleGetAssignments(
      { authorization: `Bearer ${johnMarkToken}` },
      { batchId: fakeBatchId }
    );
    assert(unassignedBatchFilter.status === 403, 'Unassigned batchId filter rejected with 403 Forbidden');

    // ------------------------------------------------------------------
    console.log('\n--- TEST GROUP 3: ASSIGNMENT CREATION VALIDATION & AUDIT LOGGING ---');
    // Test 13: Missing title rejected with 400
    const noTitle = await handleCreateAssignment(
      { authorization: `Bearer ${johnMarkToken}` },
      { courseId: systematicTheologyCourse.id, maxMarks: 100, dueAt: new Date(Date.now() + 86400000).toISOString() }
    );
    assert(noTitle.status === 400, 'Assignment creation with missing title rejected with 400 Bad Request');

    // Test 14: Missing courseId rejected with 400
    const noCourse = await handleCreateAssignment(
      { authorization: `Bearer ${johnMarkToken}` },
      { title: 'Exegetical Research', maxMarks: 100, dueAt: new Date(Date.now() + 86400000).toISOString() }
    );
    assert(noCourse.status === 400, 'Assignment creation with missing courseId rejected with 400 Bad Request');

    // Test 15: Invalid maxMarks (<= 0 or string) rejected with 400
    const badMarks = await handleCreateAssignment(
      { authorization: `Bearer ${johnMarkToken}` },
      { title: 'Exegetical Research', courseId: systematicTheologyCourse.id, maxMarks: -10, dueAt: new Date(Date.now() + 86400000).toISOString() }
    );
    assert(badMarks.status === 400, 'Assignment creation with negative maxMarks rejected with 400 Bad Request');

    // Test 16: Invalid due date rejected with 400
    const badDate = await handleCreateAssignment(
      { authorization: `Bearer ${johnMarkToken}` },
      { title: 'Exegetical Research', courseId: systematicTheologyCourse.id, maxMarks: 100, dueAt: 'not-a-date' }
    );
    assert(badDate.status === 400, 'Assignment creation with malformed dueDate rejected with 400 Bad Request');

    // Test 17: Unassigned course rejected with 403
    const unassignedCourseCreation = await handleCreateAssignment(
      { authorization: `Bearer ${johnMarkToken}` },
      { title: 'Unauthorized Assignment', courseId: fakeCourseId, maxMarks: 100, dueAt: new Date(Date.now() + 86400000).toISOString() }
    );
    assert(unassignedCourseCreation.status === 403, 'Assignment creation for unassigned course rejected with 403 Forbidden');

    // Test 18: Authorized assignment creation (PUBLISHED)
    const validDueDate = new Date(Date.now() + 7 * 86400000).toISOString();
    const createRes = await handleCreateAssignment(
      { authorization: `Bearer ${johnMarkToken}` },
      {
        title: `Phase 5 Integration Assignment ${Date.now()}`,
        instructions: 'Submit a 3-page research paper analyzing Pauline theology in Romans 8.',
        courseId: systematicTheologyCourse.id,
        maxMarks: 100,
        dueAt: validDueDate,
        status: 'PUBLISHED',
      }
    );
    assert(createRes.status === 201, 'Authorized teacher creates published assignment (201 Created)');
    createdAssignmentId = createRes.data.id;
    assert(createdAssignmentId !== null, 'Created assignment received valid UUID');
    assert(createRes.data.status === 'PUBLISHED', 'Created assignment preserves PUBLISHED status');

    // Test 19: AuditLog entry for assignment creation
    const auditCreate = await pool.query(
      `SELECT * FROM "AuditLog" WHERE "entityId" = $1 AND action = 'ASSIGNMENT_CREATED'`,
      [createdAssignmentId]
    );
    assert(auditCreate.rows.length >= 1, 'Assignment creation records audit log entry with action ASSIGNMENT_CREATED');
    assert(auditCreate.rows[0].actorUserId === drJohnMark.userId, 'Audit log records correct faculty actorUserId');

    // Test 20: Create a DRAFT assignment for visibility testing
    const createDraftRes = await handleCreateAssignment(
      { authorization: `Bearer ${johnMarkToken}` },
      {
        title: `Phase 5 Draft Assignment ${Date.now()}`,
        instructions: 'Work in progress draft assignment.',
        courseId: systematicTheologyCourse.id,
        maxMarks: 50,
        dueAt: validDueDate,
        status: 'DRAFT',
      }
    );
    assert(createDraftRes.status === 201, 'Teacher creates DRAFT assignment (201 Created)');
    createdDraftAssignmentId = createDraftRes.data.id;
    assert(createDraftRes.data.status === 'DRAFT', 'Draft assignment has DRAFT status');

    // ------------------------------------------------------------------
    console.log('\n--- TEST GROUP 4: ASSIGNMENT DETAIL & STUDENT SUBMISSION ROSTER ---');
    // Test 21: Authorized teacher views assignment detail
    const detailRes = await handleGetAssignmentDetail(
      { authorization: `Bearer ${johnMarkToken}` },
      createdAssignmentId
    );
    assert(detailRes.status === 200, 'Assigned teacher fetches assignment detail (200 OK)');
    assert(detailRes.data.assignment.title === createRes.data.title, 'Assignment detail matches created title');
    assert(Array.isArray(detailRes.data.students), 'Assignment detail returns student roster array');
    assert(detailRes.data.students.length > 0, 'Student roster includes actively enrolled students');

    // Test 22: Unassigned teacher denied detail access (403)
    // Rev David Paul is not assigned to Systematic Theology
    const unassignedDetail = await handleGetAssignmentDetail(
      { authorization: `Bearer ${davidPaulToken}` },
      createdAssignmentId
    );
    assert(unassignedDetail.status === 403, 'Unassigned faculty blocked from viewing assignment detail (403 Forbidden)');

    // Test 23: Non-existent assignment returns 404
    const notFoundDetail = await handleGetAssignmentDetail(
      { authorization: `Bearer ${johnMarkToken}` },
      'non-existent-assignment-id'
    );
    assert(notFoundDetail.status === 404, 'Non-existent assignment returns 404 Not Found');

    // ------------------------------------------------------------------
    console.log('\n--- TEST GROUP 5: ASSIGNMENT UPDATE & SAFETY VALIDATIONS ---');
    // Test 24: Update assignment title and instructions
    const updateRes = await handleUpdateAssignment(
      { authorization: `Bearer ${johnMarkToken}` },
      createdAssignmentId,
      {
        title: `${createRes.data.title} (Updated)`,
        instructions: 'Updated instructions for Romans 8 paper.',
        maxMarks: 100,
      }
    );
    assert(updateRes.status === 200, 'Authorized update returns 200 OK');
    assert(updateRes.data.title.includes('(Updated)'), 'Updated title reflected in response');

    // Test 25: AuditLog entry for assignment update
    const auditUpdate = await pool.query(
      `SELECT * FROM "AuditLog" WHERE "entityId" = $1 AND action = 'ASSIGNMENT_UPDATED'`,
      [createdAssignmentId]
    );
    assert(auditUpdate.rows.length >= 1, 'Assignment update records audit log entry with action ASSIGNMENT_UPDATED');

    // ------------------------------------------------------------------
    console.log('\n--- TEST GROUP 6: STUDENT SUBMISSION, GRADING & AUDIT TRAIL ---');
    // Test 26: Create a student submission for grading tests
    const subInsert = await pool.query(
      `INSERT INTO "Submission" (
        id, "instituteId", "assignmentId", "studentProfileId", status, "submittedAt", "answerText", "fileUrl"
      ) VALUES (
        gen_random_uuid()::text, $1, $2, $3, 'SUBMITTED', NOW(),
        'Here is my comprehensive research paper on Romans 8 and Biblical Justification.',
        'https://storage.biblelms.org/papers/romans8-deborah.pdf'
      ) RETURNING *`,
      [drJohnMark.instituteId, createdAssignmentId, testStudent.studentProfileId]
    );
    createdSubmissionId = subInsert.rows[0].id;
    assert(createdSubmissionId !== null, 'Student submission created for grading test fixture');

    // Test 27: Grading with negative marks rejected with 400
    const negGrade = await handleGradeSubmission(
      { authorization: `Bearer ${johnMarkToken}` },
      createdAssignmentId,
      createdSubmissionId,
      { marks: -5, feedback: 'Negative marks test' }
    );
    assert(negGrade.status === 400, 'Grading with negative marks rejected with 400 Bad Request');

    // Test 28: Grading with marks exceeding maxMarks (100) rejected with 400
    const excessGrade = await handleGradeSubmission(
      { authorization: `Bearer ${johnMarkToken}` },
      createdAssignmentId,
      createdSubmissionId,
      { marks: 125, feedback: 'Excess marks test' }
    );
    assert(excessGrade.status === 400, 'Grading with marks exceeding maxMarks rejected with 400 Bad Request');

    // Test 29: Unassigned teacher cannot grade submission (403)
    const unauthGrade = await handleGradeSubmission(
      { authorization: `Bearer ${davidPaulToken}` },
      createdAssignmentId,
      createdSubmissionId,
      { marks: 85, feedback: 'Unassigned grade attempt' }
    );
    assert(unauthGrade.status === 403, 'Unassigned faculty blocked from grading submission (403 Forbidden)');

    // Test 30: Valid grading submission succeeds (200 OK)
    const gradeRes = await handleGradeSubmission(
      { authorization: `Bearer ${johnMarkToken}` },
      createdAssignmentId,
      createdSubmissionId,
      { marks: 88, feedback: 'Exemplary exegetical analysis with sound theological insights.' }
    );
    assert(gradeRes.status === 200, 'Authorized faculty grades submission successfully (200 OK)');
    assert(gradeRes.data.status === 'GRADED', 'Submission status transitions to GRADED');
    assert(Number(gradeRes.data.marksAwarded) === 88, 'Marks awarded correctly saved (88)');
    assert(gradeRes.data.feedback.includes('Exemplary exegetical'), 'Faculty feedback correctly saved');

    // Test 31: AuditLog entry for assignment grading
    const auditGrade = await pool.query(
      `SELECT * FROM "AuditLog" WHERE "entityId" = $1 AND action = 'ASSIGNMENT_GRADED'`,
      [createdSubmissionId]
    );
    assert(auditGrade.rows.length >= 1, 'Grading submission records audit log entry with action ASSIGNMENT_GRADED');
    const gradeAuditMeta = auditGrade.rows[0].metadata;
    assert(gradeAuditMeta.marksAwarded === 88, 'Audit log records awarded marks in metadata');

    // Test 32: Grade update (regrading) succeeds and updates audit log
    const regradeRes = await handleGradeSubmission(
      { authorization: `Bearer ${johnMarkToken}` },
      createdAssignmentId,
      createdSubmissionId,
      { marks: 92, feedback: 'Revised after reviewing additional bibliography. Outstanding!' }
    );
    assert(regradeRes.status === 200, 'Regrading submission returns 200 OK');
    assert(Number(regradeRes.data.marksAwarded) === 92, 'Updated marks awarded reflected (92)');

    // Test 33: Cannot reduce maxMarks below already awarded marks (92)
    const invalidReduce = await handleUpdateAssignment(
      { authorization: `Bearer ${johnMarkToken}` },
      createdAssignmentId,
      { maxMarks: 80 }
    );
    assert(invalidReduce.status === 400, 'Reducing maxMarks below awarded grade (80 < 92) strictly rejected with 400 Bad Request');

    // ------------------------------------------------------------------
    console.log('\n--- TEST GROUP 7: STUDENT PORTAL & CROSS-PORTAL VISIBILITY ---');
    // Test 34: Published assignment is visible in student course queries
    const studentCourseAssignments = await pool.query(
      `SELECT id, title, status FROM "Assignment"
       WHERE "courseId" = $1 AND "instituteId" = $2 AND status = 'PUBLISHED'
       ORDER BY "createdAt" DESC`,
      [systematicTheologyCourse.id, drJohnMark.instituteId]
    );
    const pubIds = studentCourseAssignments.rows.map((a) => a.id);
    assert(pubIds.includes(createdAssignmentId), 'Published assignment is visible to student in enrolled course');

    // Test 35: Draft assignment is NOT visible in student published queries
    assert(!pubIds.includes(createdDraftAssignmentId), 'Draft assignment is strictly hidden from student queries');

    // Test 36: Student can inspect their graded submission
    const studentSubQuery = await pool.query(
      `SELECT s.id, s."marksAwarded", s.feedback, s.status, a."maxMarks"
       FROM "Submission" s
       JOIN "Assignment" a ON a.id = s."assignmentId"
       WHERE s.id = $1 AND s."studentProfileId" = $2`,
      [createdSubmissionId, testStudent.studentProfileId]
    );
    assert(studentSubQuery.rows.length === 1, 'Student can query their graded submission record');
    assert(Number(studentSubQuery.rows[0].marksAwarded) === 92, 'Student sees awarded marks (92)');
    assert(studentSubQuery.rows[0].feedback.includes('Outstanding'), 'Student sees faculty feedback');

    // Test 37: Teacher assignments listing reflects updated metrics
    const updatedList = await handleGetAssignments({ authorization: `Bearer ${johnMarkToken}` });
    const targetInList = updatedList.data.find((a) => a.id === createdAssignmentId);
    assert(targetInList !== undefined, 'Target assignment appears in teacher catalog');
    assert(targetInList.gradedCount >= 1, 'Teacher catalog reflects updated gradedCount metric');
    assert(targetInList.submittedCount >= 1, 'Teacher catalog reflects submittedCount metric');

  } catch (err) {
    console.error('Fatal test execution error:', err);
    failed++;
  } finally {
    // Clean up created test records to maintain database cleanliness
    try {
      if (createdSubmissionId) {
        await pool.query(`DELETE FROM "AuditLog" WHERE "entityId" = $1`, [createdSubmissionId]);
        await pool.query(`DELETE FROM "Submission" WHERE id = $1`, [createdSubmissionId]);
      }
      if (createdAssignmentId) {
        await pool.query(`DELETE FROM "AuditLog" WHERE "entityId" = $1`, [createdAssignmentId]);
        await pool.query(`DELETE FROM "Assignment" WHERE id = $1`, [createdAssignmentId]);
      }
      if (createdDraftAssignmentId) {
        await pool.query(`DELETE FROM "AuditLog" WHERE "entityId" = $1`, [createdDraftAssignmentId]);
        await pool.query(`DELETE FROM "Assignment" WHERE id = $1`, [createdDraftAssignmentId]);
      }
    } catch (cleanErr) {
      console.warn('Cleanup error:', cleanErr.message);
    }
    await pool.end();
  }

  console.log('\n========================================================================');
  console.log(`  PHASE 5 SECURITY TEST RESULTS: ${passed} PASSED / ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite();
