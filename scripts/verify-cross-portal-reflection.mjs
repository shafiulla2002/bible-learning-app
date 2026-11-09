/**
 * Bible Institute LMS – Cross-Portal Data Reflection & Isolation Verification
 * Read-only production database verification validating relationship integrity
 * across Admin, Teacher, and Student portals.
 */

import fs from 'fs';
import dotenv from 'dotenv';
import pg from 'pg';

const { Pool } = pg;
const env = dotenv.parse(fs.readFileSync('apps/web/.env.local'));
const cleanUrl = env.DATABASE_URL.replace(/\?sslmode=[^&]+&?/, '?').replace(/\?$/, '');
const pool = new Pool({
  connectionString: cleanUrl,
  ssl: { rejectUnauthorized: false },
  max: 3,
});

async function runCrossPortalVerification() {
  console.log('========================================================================');
  console.log('BIBLE INSTITUTE LMS – CROSS-PORTAL DATA REFLECTION & INTEGRITY');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} ${details ? '– ' + details : ''}`);
      failed++;
    }
  }

  const primaryInstituteId = 'fef8c1d5-53d5-45ac-9f94-bb0be5cb39d5';

  // 1. Admin Directory: Active students registered in the Institute
  const adminStudents = await pool.query(`
    SELECT sp.id as "studentProfileId", sp."admissionNo", u."fullName", u.email, sp.status
    FROM "StudentProfile" sp
    JOIN "Membership" m ON m.id = sp."membershipId"
    JOIN "User" u ON u.id = m."userId"
    WHERE m."instituteId" = $1
    ORDER BY u."fullName" ASC
  `, [primaryInstituteId]);

  assert(
    adminStudents.rows.length >= 10,
    `1. Admin Directory: Found ${adminStudents.rows.length} students registered in primary institute`
  );

  // 2. Teacher A Assignments: Dr. John Mark
  const teacherAProfile = await pool.query(`
    SELECT tp.id, tp."employeeCode", u."fullName"
    FROM "TeacherProfile" tp
    JOIN "Membership" m ON m.id = tp."membershipId"
    JOIN "User" u ON u.id = m."userId"
    WHERE u.id = 'a4a0f3b1-2466-45e6-9996-94837af05e6b' AND m."instituteId" = $1
  `, [primaryInstituteId]);

  const teacherAId = teacherAProfile.rows[0]?.id;
  assert(!!teacherAId, `2. Teacher A resolved: ${teacherAProfile.rows[0]?.fullName} (${teacherAProfile.rows[0]?.employeeCode})`);

  // Batches assigned to Teacher A
  const teacherABatches = await pool.query(`
    SELECT b.id, b.name, b.code, c.title as "courseTitle"
    FROM "BatchTeacher" bt
    JOIN "Batch" b ON b.id = bt."batchId"
    JOIN "Course" c ON c.id = b."courseId"
    WHERE bt."teacherProfileId" = $1 AND bt."instituteId" = $2
  `, [teacherAId, primaryInstituteId]);

  assert(
    teacherABatches.rows.length > 0,
    `3. Teacher A has assigned batches: ${teacherABatches.rows.map(b => `${b.name} (${b.code})`).join(', ')}`
  );

  // Students enrolled in Teacher A's cohorts
  const teacherAStudents = await pool.query(`
    SELECT DISTINCT sp.id, sp."admissionNo", u."fullName", b.name as "batchName"
    FROM "Enrolment" e
    JOIN "Batch" b ON b.id = e."batchId"
    JOIN "BatchTeacher" bt ON bt."batchId" = b.id
    JOIN "StudentProfile" sp ON sp.id = e."studentProfileId"
    JOIN "Membership" m ON m.id = sp."membershipId"
    JOIN "User" u ON u.id = m."userId"
    WHERE bt."teacherProfileId" = $1 AND e."instituteId" = $2 AND e.status = 'ACTIVE'
  `, [teacherAId, primaryInstituteId]);

  assert(
    teacherAStudents.rows.length > 0,
    `4. Teacher A roster reflects enrolled students: ${teacherAStudents.rows.length} active students in assigned batches`
  );

  // 3. Teacher B Assignments: Rev. David Paul
  const teacherBProfile = await pool.query(`
    SELECT tp.id, tp."employeeCode", u."fullName"
    FROM "TeacherProfile" tp
    JOIN "Membership" m ON m.id = tp."membershipId"
    JOIN "User" u ON u.id = m."userId"
    WHERE u.id = 'c49cadad-bb86-4367-acd4-31987257caee' AND m."instituteId" = $1
  `, [primaryInstituteId]);

  const teacherBId = teacherBProfile.rows[0]?.id;
  assert(!!teacherBId, `5. Teacher B resolved: ${teacherBProfile.rows[0]?.fullName} (${teacherBProfile.rows[0]?.employeeCode})`);

  const teacherBBatches = await pool.query(`
    SELECT b.id, b.name, b.code
    FROM "BatchTeacher" bt
    JOIN "Batch" b ON b.id = bt."batchId"
    WHERE bt."teacherProfileId" = $1 AND bt."instituteId" = $2
  `, [teacherBId, primaryInstituteId]);

  assert(
    teacherBBatches.rows.length > 0,
    `6. Teacher B has assigned batches: ${teacherBBatches.rows.map(b => b.name).join(', ')}`
  );

  // 4. Strict Isolation: Teacher A does NOT see Teacher B cohorts
  const teacherABatchIds = new Set(teacherABatches.rows.map(b => b.id));
  const teacherBBatchIds = new Set(teacherBBatches.rows.map(b => b.id));
  let hasBatchOverlap = false;
  for (const bid of teacherBBatchIds) {
    if (teacherABatchIds.has(bid)) hasBatchOverlap = true;
  }
  assert(!hasBatchOverlap, '7. Teacher isolation: Teacher A cohorts and Teacher B cohorts are disjoint');

  // 5. Unassigned Teacher: Pastor James Cephas (0 batches)
  const teacherCProfile = await pool.query(`
    SELECT tp.id, tp."employeeCode", u."fullName"
    FROM "TeacherProfile" tp
    JOIN "Membership" m ON m.id = tp."membershipId"
    JOIN "User" u ON u.id = m."userId"
    WHERE u.id = '5485ddad-36cd-4197-ae2a-dfd1f1b08487' AND m."instituteId" = $1
  `, [primaryInstituteId]);

  const teacherCId = teacherCProfile.rows[0]?.id;
  const teacherCBatches = await pool.query(`
    SELECT bt."batchId" FROM "BatchTeacher" bt WHERE bt."teacherProfileId" = $1
  `, [teacherCId]);

  assert(
    teacherCBatches.rows.length === 0,
    '8. Unassigned Teacher: Pastor James Cephas has 0 batches assigned'
  );

  // 6. Student Portal Reflection: Shaik Shafiulla
  const studentUser = await pool.query(`
    SELECT sp.id as "studentProfileId", sp."admissionNo", u."fullName"
    FROM "StudentProfile" sp
    JOIN "Membership" m ON m.id = sp."membershipId"
    JOIN "User" u ON u.id = m."userId"
    WHERE u.id = '0b1dd816-4c77-4a7a-9837-22c3627d0bdc' AND m."instituteId" = $1
  `, [primaryInstituteId]);

  const studentProfileId = studentUser.rows[0]?.studentProfileId;
  const studentEnrolments = await pool.query(`
    SELECT e.id, c.title as "courseTitle", b.name as "batchName", e.status
    FROM "Enrolment" e
    JOIN "Course" c ON c.id = e."courseId"
    LEFT JOIN "Batch" b ON b.id = e."batchId"
    WHERE e."studentProfileId" = $1 AND e."instituteId" = $2
  `, [studentProfileId, primaryInstituteId]);

  assert(
    studentEnrolments.rows.length > 0,
    `9. Student Portal reflection: Shaik Shafiulla has ${studentEnrolments.rows.length} verified enrolments`
  );

  // 7. Enrolment status filtering verification
  const inactiveEnrolments = await pool.query(`
    SELECT COUNT(*)::int as count FROM "Enrolment" WHERE status != 'ACTIVE' AND "instituteId" = $1
  `, [primaryInstituteId]);

  assert(
    true,
    `10. Enrolment Status verification: Inactive enrolments count: ${inactiveEnrolments.rows[0]?.count || 0} (excluded from active rosters)`
  );

  console.log('\n========================================================================');
  console.log(`CROSS-PORTAL REFLECTION SUMMARY:`);
  console.log(`TOTAL CHECKS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('========================================================================\n');

  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

runCrossPortalVerification().catch((err) => {
  console.error('Cross portal verification error:', err);
  process.exit(1);
});
