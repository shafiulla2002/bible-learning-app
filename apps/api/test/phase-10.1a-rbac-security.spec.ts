import * as fs from 'fs';
import * as path from 'path';

// Enforce strict isolation against bible_lms_test BEFORE initializing AppModule/Prisma
function loadTestEnv() {
  const envPath = path.resolve(__dirname, '../.env');
  const rawEnv = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  const parsed: Record<string, string> = {};
  for (const line of rawEnv.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    parsed[key] = val;
  }

  const testDbUrl = process.env.TEST_DATABASE_URL || parsed.TEST_DATABASE_URL;
  if (!testDbUrl) {
    throw new Error('TEST_DATABASE_URL must be configured to run write tests safely');
  }
  const dbUri = new URL(testDbUrl);
  if (dbUri.pathname !== '/bible_lms_test') {
    throw new Error(
      `Refusing to run write tests against non-isolated database: ${dbUri.pathname}`,
    );
  }
  process.env.DATABASE_URL = testDbUrl;

  if (!process.env.JWT_SECRET && parsed.JWT_SECRET) {
    process.env.JWT_SECRET = parsed.JWT_SECRET;
  }
}

loadTestEnv();

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/core/prisma/prisma.service';
import { AuthModule } from '../src/core/auth/auth.module';
import { getRequiredJwtSecret } from '../src/core/auth/jwt-secret.util';

describe('Phase 10.1A: Security Remediation & RBAC Hardening', () => {
  let app: INestApplication;
  let serverUrl: string;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let activeSecret: string;

  const runTag = `sec101a_${Date.now()}`;

  // Fixtures tracked for cleanup
  let instituteAId: string;
  let instituteBId: string;
  const userIds: string[] = [];

  let superAdminUserId: string;
  let adminAUserId: string;
  let teacherAUserId: string;
  let teacherAProfileId: string;
  let studentA1UserId: string;
  let studentA1ProfileId: string;
  let studentA1Phone: string;
  let studentA2UserId: string;
  let studentA2ProfileId: string;
  let studentBUserId: string;
  let studentBProfileId: string;

  let courseAId: string;
  let batchA1Id: string;
  let batchA2Id: string;
  let assignmentB1Id: string;
  let assignmentB2Id: string;
  let liveSessionB1Id: string;
  let liveSessionB2Id: string;

  let superAdminToken: string;
  let adminAToken: string;
  let teacherAToken: string;
  let studentA1Token: string;
  let studentBToken: string;

  beforeAll(async () => {
    activeSecret = getRequiredJwtSecret();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

    await app.listen(0);
    const address = app.getHttpServer().address();
    const port = typeof address === 'string' ? address : address.port;
    serverUrl = `http://127.0.0.1:${port}/api/v1`;

    prisma = app.get<PrismaService>(PrismaService);
    jwtService = app.get<JwtService>(JwtService);

    // Double-check actual DB connection at runtime
    const [{ db }] = await prisma.$queryRawUnsafe<Array<{ db: string }>>(
      'SELECT current_database() AS db',
    );
    if (db !== 'bible_lms_test') {
      throw new Error(`Connected to unexpected database "${db}"; expected "bible_lms_test"`);
    }

    // Create two isolated institutes
    const instA = await prisma.institute.create({
      data: {
        name: `Test Institute A (${runTag})`,
        slug: `${runTag}-inst-a`,
        status: 'ACTIVE',
      },
    });
    const instB = await prisma.institute.create({
      data: {
        name: `Test Institute B (${runTag})`,
        slug: `${runTag}-inst-b`,
        status: 'ACTIVE',
      },
    });
    instituteAId = instA.id;
    instituteBId = instB.id;

    // 1. SUPER_ADMIN
    const saPhone = `+1999100${Math.floor(1000 + Math.random() * 8999)}`;
    const saUser = await prisma.user.create({
      data: { phoneE164: saPhone, fullName: 'Sec Test Super Admin', status: 'ACTIVE' },
    });
    userIds.push(saUser.id);
    superAdminUserId = saUser.id;
    const saMembership = await prisma.membership.create({
      data: { userId: saUser.id, instituteId: null, role: 'SUPER_ADMIN', status: 'ACTIVE' },
    });

    // 2. INSTITUTE_ADMIN (Institute A)
    const adminPhone = `+1999200${Math.floor(1000 + Math.random() * 8999)}`;
    const adminUser = await prisma.user.create({
      data: { phoneE164: adminPhone, fullName: 'Sec Test Admin A', status: 'ACTIVE' },
    });
    userIds.push(adminUser.id);
    adminAUserId = adminUser.id;
    const adminMembership = await prisma.membership.create({
      data: { userId: adminUser.id, instituteId: instituteAId, role: 'INSTITUTE_ADMIN', status: 'ACTIVE' },
    });

    // 3. TEACHER (Institute A)
    const teacherPhone = `+1999300${Math.floor(1000 + Math.random() * 8999)}`;
    const teacherUser = await prisma.user.create({
      data: { phoneE164: teacherPhone, fullName: 'Sec Test Teacher A', status: 'ACTIVE' },
    });
    userIds.push(teacherUser.id);
    teacherAUserId = teacherUser.id;
    const teacherMembership = await prisma.membership.create({
      data: { userId: teacherUser.id, instituteId: instituteAId, role: 'TEACHER', status: 'ACTIVE' },
    });
    const teacherProfile = await prisma.teacherProfile.create({
      data: {
        instituteId: instituteAId,
        membershipId: teacherMembership.id,
        employeeCode: `TCH-${runTag}`,
        status: 'ACTIVE',
      },
    });
    teacherAProfileId = teacherProfile.id;

    // 4. STUDENT A1 (Institute A, Batch 1)
    studentA1Phone = `+1999400${Math.floor(1000 + Math.random() * 8999)}`;
    const sA1User = await prisma.user.create({
      data: { phoneE164: studentA1Phone, fullName: 'Sec Test Student A1', status: 'ACTIVE' },
    });
    userIds.push(sA1User.id);
    studentA1UserId = sA1User.id;
    const sA1Membership = await prisma.membership.create({
      data: { userId: sA1User.id, instituteId: instituteAId, role: 'STUDENT', status: 'ACTIVE' },
    });
    const sA1Profile = await prisma.studentProfile.create({
      data: {
        instituteId: instituteAId,
        membershipId: sA1Membership.id,
        admissionNo: `ADM-A1-${runTag}`,
        status: 'ACTIVE',
      },
    });
    studentA1ProfileId = sA1Profile.id;

    // 5. STUDENT A2 (Institute A, Batch 2)
    const sA2Phone = `+1999500${Math.floor(1000 + Math.random() * 8999)}`;
    const sA2User = await prisma.user.create({
      data: { phoneE164: sA2Phone, fullName: 'Sec Test Student A2', status: 'ACTIVE' },
    });
    userIds.push(sA2User.id);
    studentA2UserId = sA2User.id;
    const sA2Membership = await prisma.membership.create({
      data: { userId: sA2User.id, instituteId: instituteAId, role: 'STUDENT', status: 'ACTIVE' },
    });
    const sA2Profile = await prisma.studentProfile.create({
      data: {
        instituteId: instituteAId,
        membershipId: sA2Membership.id,
        admissionNo: `ADM-A2-${runTag}`,
        status: 'ACTIVE',
      },
    });
    studentA2ProfileId = sA2Profile.id;

    // 6. STUDENT B (Institute B)
    const sBPhone = `+1999600${Math.floor(1000 + Math.random() * 8999)}`;
    const sBUser = await prisma.user.create({
      data: { phoneE164: sBPhone, fullName: 'Sec Test Student B', status: 'ACTIVE' },
    });
    userIds.push(sBUser.id);
    studentBUserId = sBUser.id;
    const sBMembership = await prisma.membership.create({
      data: { userId: sBUser.id, instituteId: instituteBId, role: 'STUDENT', status: 'ACTIVE' },
    });
    const sBProfile = await prisma.studentProfile.create({
      data: {
        instituteId: instituteBId,
        membershipId: sBMembership.id,
        admissionNo: `ADM-B-${runTag}`,
        status: 'ACTIVE',
      },
    });
    studentBProfileId = sBProfile.id;

    // Academic entities in Institute A
    const categoryA = await prisma.courseCategory.create({
      data: {
        instituteId: instituteAId,
        name: `Theology (${runTag})`,
        slug: `theology-${runTag}`,
      },
    });
    const courseA = await prisma.course.create({
      data: {
        instituteId: instituteAId,
        categoryId: categoryA.id,
        title: `Systematic Theology (${runTag})`,
        slug: `sys-theo-${runTag}`,
        description: 'Isolated security verification course',
        status: 'PUBLISHED',
      },
    });
    courseAId = courseA.id;

    await prisma.courseInstructor.create({
      data: {
        instituteId: instituteAId,
        courseId: courseAId,
        teacherProfileId: teacherAProfileId,
        role: 'LEAD',
      },
    });

    const now = new Date();
    const later = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const batch1 = await prisma.batch.create({
      data: {
        instituteId: instituteAId,
        courseId: courseAId,
        name: `Batch 1 (${runTag})`,
        code: `B1-${runTag}`,
        status: 'ACTIVE',
        startDate: now,
        endDate: later,
      },
    });
    const batch2 = await prisma.batch.create({
      data: {
        instituteId: instituteAId,
        courseId: courseAId,
        name: `Batch 2 (${runTag})`,
        code: `B2-${runTag}`,
        status: 'ACTIVE',
        startDate: now,
        endDate: later,
      },
    });
    batchA1Id = batch1.id;
    batchA2Id = batch2.id;

    await prisma.batchTeacher.create({
      data: {
        instituteId: instituteAId,
        batchId: batchA1Id,
        teacherProfileId: teacherAProfileId,
        role: 'LEAD',
      },
    });

    // Enrol A1 in Batch 1, A2 in Batch 2
    await prisma.enrolment.create({
      data: {
        instituteId: instituteAId,
        studentProfileId: studentA1ProfileId,
        courseId: courseAId,
        batchId: batchA1Id,
        status: 'ACTIVE',
      },
    });
    await prisma.enrolment.create({
      data: {
        instituteId: instituteAId,
        studentProfileId: studentA2ProfileId,
        courseId: courseAId,
        batchId: batchA2Id,
        status: 'ACTIVE',
      },
    });

    // Assignments scoped to Batch 1 and Batch 2
    const due = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const a1 = await prisma.assignment.create({
      data: {
        instituteId: instituteAId,
        courseId: courseAId,
        batchId: batchA1Id,
        title: `Batch 1 Assignment (${runTag})`,
        instructions: 'Batch 1 only',
        dueAt: due,
        status: 'PUBLISHED',
      },
    });
    const a2 = await prisma.assignment.create({
      data: {
        instituteId: instituteAId,
        courseId: courseAId,
        batchId: batchA2Id,
        title: `Batch 2 Assignment (${runTag})`,
        instructions: 'Batch 2 only',
        dueAt: due,
        status: 'PUBLISHED',
      },
    });
    assignmentB1Id = a1.id;
    assignmentB2Id = a2.id;

    // Live sessions scoped to Batch 1 and Batch 2
    const sessStart = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const sessEnd = new Date(sessStart.getTime() + 60 * 60 * 1000);
    const ls1 = await prisma.liveSession.create({
      data: {
        instituteId: instituteAId,
        batchId: batchA1Id,
        teacherProfileId: teacherAProfileId,
        title: `Batch 1 Live Session (${runTag})`,
        startsAt: sessStart,
        endsAt: sessEnd,
        status: 'SCHEDULED',
      },
    });
    const ls2Start = new Date(sessEnd.getTime() + 60 * 60 * 1000);
    const ls2End = new Date(ls2Start.getTime() + 60 * 60 * 1000);
    const ls2 = await prisma.liveSession.create({
      data: {
        instituteId: instituteAId,
        batchId: batchA2Id,
        teacherProfileId: teacherAProfileId,
        title: `Batch 2 Live Session (${runTag})`,
        startsAt: ls2Start,
        endsAt: ls2End,
        status: 'SCHEDULED',
      },
    });
    liveSessionB1Id = ls1.id;
    liveSessionB2Id = ls2.id;

    // Sign valid tokens matching AuthService payload shape
    superAdminToken = jwtService.sign(
      {
        sub: superAdminUserId,
        userId: superAdminUserId,
        membershipId: saMembership.id,
        role: 'SUPER_ADMIN',
        instituteId: null,
      },
      { secret: activeSecret, expiresIn: '1h' },
    );
    adminAToken = jwtService.sign(
      {
        sub: adminAUserId,
        userId: adminAUserId,
        membershipId: adminMembership.id,
        role: 'INSTITUTE_ADMIN',
        instituteId: instituteAId,
      },
      { secret: activeSecret, expiresIn: '1h' },
    );
    teacherAToken = jwtService.sign(
      {
        sub: teacherAUserId,
        userId: teacherAUserId,
        membershipId: teacherMembership.id,
        role: 'TEACHER',
        instituteId: instituteAId,
      },
      { secret: activeSecret, expiresIn: '1h' },
    );
    studentA1Token = jwtService.sign(
      {
        sub: studentA1UserId,
        userId: studentA1UserId,
        membershipId: sA1Membership.id,
        role: 'STUDENT',
        instituteId: instituteAId,
      },
      { secret: activeSecret, expiresIn: '1h' },
    );
    studentBToken = jwtService.sign(
      {
        sub: studentBUserId,
        userId: studentBUserId,
        membershipId: sBMembership.id,
        role: 'STUDENT',
        instituteId: instituteBId,
      },
      { secret: activeSecret, expiresIn: '1h' },
    );
  });

  afterAll(async () => {
    try {
      if (prisma) {
        if (instituteAId || instituteBId) {
          await prisma.institute.deleteMany({
            where: { id: { in: [instituteAId, instituteBId].filter(Boolean) } },
          });
        }
        if (userIds.length > 0) {
          await prisma.user.deleteMany({
            where: { id: { in: userIds } },
          });
        }
      }
    } finally {
      if (app) {
        await app.close();
      }
    }
  });

  describe('1. Mandatory JWT_SECRET & Startup Validation', () => {
    it('throws immediately if JWT_SECRET is missing or whitespace', () => {
      const prev = process.env.JWT_SECRET;
      try {
        delete process.env.JWT_SECRET;
        expect(() => getRequiredJwtSecret()).toThrow(/JWT_SECRET/i);
        expect(() => new AuthModule(new ConfigService()).onModuleInit()).toThrow(/JWT_SECRET/i);

        process.env.JWT_SECRET = '   ';
        expect(() => getRequiredJwtSecret()).toThrow(/JWT_SECRET/i);
      } finally {
        process.env.JWT_SECRET = prev;
      }
    });
  });

  describe('2. Authentication & Removal of x-dev-* Bypasses', () => {
    it('rejects unauthenticated requests carrying x-dev-* spoof headers across Admin, Teacher, and Student routes with 401', async () => {
      const spoofHeaders = {
        'x-dev-user-id': adminAUserId,
        'x-dev-role': 'INSTITUTE_ADMIN',
        'x-dev-institute-id': instituteAId,
      };

      const adminRes = await fetch(`${serverUrl}/institutes/${instituteAId}/courses`, {
        headers: spoofHeaders,
      });
      expect(adminRes.status).toBe(401);

      const teacherRes = await fetch(`${serverUrl}/teachers/me`, {
        headers: {
          'x-dev-user-id': teacherAUserId,
          'x-dev-role': 'TEACHER',
          'x-dev-institute-id': instituteAId,
        },
      });
      expect(teacherRes.status).toBe(401);

      const studentRes = await fetch(`${serverUrl}/students/me`, {
        headers: {
          'x-dev-user-id': studentA1UserId,
          'x-dev-role': 'STUDENT',
          'x-dev-institute-id': instituteAId,
        },
      });
      expect(studentRes.status).toBe(401);
    });

    it('rejects forged JWT and expired JWT with 401', async () => {
      const forgedToken = jwtService.sign(
        { sub: adminAUserId, role: 'INSTITUTE_ADMIN', instituteId: instituteAId },
        { secret: 'forged-wrong-secret', expiresIn: '1h' },
      );
      const forgedRes = await fetch(`${serverUrl}/institutes/${instituteAId}/courses`, {
        headers: { Authorization: `Bearer ${forgedToken}` },
      });
      expect(forgedRes.status).toBe(401);

      const expiredToken = jwtService.sign(
        { sub: adminAUserId, role: 'INSTITUTE_ADMIN', instituteId: instituteAId },
        { secret: activeSecret, expiresIn: -10 },
      );
      const expiredRes = await fetch(`${serverUrl}/institutes/${instituteAId}/courses`, {
        headers: { Authorization: `Bearer ${expiredToken}` },
      });
      expect(expiredRes.status).toBe(401);
    });
  });

  describe('3. OTP Verification & Privilege Escalation Prevention', () => {
    it('rejects invalid OTP code even with valid challenge token', async () => {
      const prevDevOtp = process.env.AUTH_DEV_OTP;
      try {
        process.env.AUTH_DEV_OTP = 'false';
        const reqRes = await fetch(`${serverUrl}/auth/otp/request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumber: studentA1Phone }),
        });
        expect(reqRes.status).toBe(200);
        const { challengeToken } = await reqRes.json();
        expect(typeof challengeToken).toBe('string');

        const verifyRes = await fetch(`${serverUrl}/auth/phone-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phoneNumber: studentA1Phone,
            otp: '000000',
            challengeToken,
          }),
        });
        expect(verifyRes.status).toBe(401);
      } finally {
        process.env.AUTH_DEV_OTP = prevDevOtp;
      }
    });

    it('blocks static dev OTP fallback when NODE_ENV=production', async () => {
      const prevNodeEnv = process.env.NODE_ENV;
      const prevDevOtp = process.env.AUTH_DEV_OTP;
      try {
        process.env.NODE_ENV = 'production';
        process.env.AUTH_DEV_OTP = 'true';

        const verifyRes = await fetch(`${serverUrl}/auth/phone-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phoneNumber: studentA1Phone,
            otp: '123456',
          }),
        });
        expect(verifyRes.status).toBe(401);
      } finally {
        process.env.NODE_ENV = prevNodeEnv;
        process.env.AUTH_DEV_OTP = prevDevOtp;
      }
    });

    it('prevents role escalation via client-supplied role and returns DB-verified membership on valid OTP', async () => {
      const prevNodeEnv = process.env.NODE_ENV;
      const prevDevOtp = process.env.AUTH_DEV_OTP;
      try {
        process.env.NODE_ENV = 'test';
        process.env.AUTH_DEV_OTP = 'true';

        const reqRes = await fetch(`${serverUrl}/auth/otp/request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumber: studentA1Phone }),
        });
        expect(reqRes.status).toBe(200);
        const { challengeToken } = await reqRes.json();

        // Student requesting INSTITUTE_ADMIN role must be rejected with 403
        const escalateRes = await fetch(`${serverUrl}/auth/phone-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phoneNumber: studentA1Phone,
            otp: '123456',
            role: 'INSTITUTE_ADMIN',
            challengeToken,
          }),
        });
        expect(escalateRes.status).toBe(403);

        // Valid login derives STUDENT role and instituteAId from DB Membership
        const okRes = await fetch(`${serverUrl}/auth/phone-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phoneNumber: studentA1Phone,
            otp: '123456',
            challengeToken,
          }),
        });
        expect(okRes.status).toBe(200);
        const body = await okRes.json();
        expect(body.accessToken).toBeTruthy();
        expect(body.user?.role).toBe('STUDENT');
        expect(body.user?.instituteId).toBe(instituteAId);
        const verifiedClaims = jwtService.verify(body.accessToken, { secret: activeSecret });
        expect(verifiedClaims.role).toBe('STUDENT');
        expect(verifiedClaims.instituteId).toBe(instituteAId);
      } finally {
        process.env.NODE_ENV = prevNodeEnv;
        process.env.AUTH_DEV_OTP = prevDevOtp;
      }
    });
  });

  describe('4. Role-Based Access Control (All 4 Roles)', () => {
    it('enforces STUDENT permissions accurately', async () => {
      expect((await fetch(`${serverUrl}/students/me`, { headers: { Authorization: `Bearer ${studentA1Token}` } })).status).toBe(200);
      expect((await fetch(`${serverUrl}/teachers/me`, { headers: { Authorization: `Bearer ${studentA1Token}` } })).status).toBe(403);
      expect((await fetch(`${serverUrl}/institutes/${instituteAId}/courses`, { headers: { Authorization: `Bearer ${studentA1Token}` } })).status).toBe(403);
      expect((await fetch(`${serverUrl}/dashboard/context`, { headers: { Authorization: `Bearer ${studentA1Token}` } })).status).toBe(403);
    });

    it('enforces TEACHER permissions accurately', async () => {
      expect((await fetch(`${serverUrl}/teachers/me`, { headers: { Authorization: `Bearer ${teacherAToken}` } })).status).toBe(200);
      expect((await fetch(`${serverUrl}/students/me`, { headers: { Authorization: `Bearer ${teacherAToken}` } })).status).toBe(403);
      expect((await fetch(`${serverUrl}/institutes/${instituteAId}/courses`, { headers: { Authorization: `Bearer ${teacherAToken}` } })).status).toBe(403);
      expect((await fetch(`${serverUrl}/dashboard/context`, { headers: { Authorization: `Bearer ${teacherAToken}` } })).status).toBe(403);
    });

    it('enforces INSTITUTE_ADMIN permissions accurately', async () => {
      expect((await fetch(`${serverUrl}/institutes/${instituteAId}/courses`, { headers: { Authorization: `Bearer ${adminAToken}` } })).status).toBe(200);
      expect((await fetch(`${serverUrl}/dashboard/context`, { headers: { Authorization: `Bearer ${adminAToken}` } })).status).toBe(200);
      expect((await fetch(`${serverUrl}/students/me`, { headers: { Authorization: `Bearer ${adminAToken}` } })).status).toBe(403);
      expect((await fetch(`${serverUrl}/teachers/me`, { headers: { Authorization: `Bearer ${adminAToken}` } })).status).toBe(403);
    });

    it('enforces SUPER_ADMIN cross-institute admin access while blocking student/teacher portal routes', async () => {
      expect((await fetch(`${serverUrl}/dashboard/context`, { headers: { Authorization: `Bearer ${superAdminToken}` } })).status).toBe(200);
      expect((await fetch(`${serverUrl}/institutes/${instituteAId}/courses`, { headers: { Authorization: `Bearer ${superAdminToken}` } })).status).toBe(200);
      expect((await fetch(`${serverUrl}/institutes/${instituteBId}/courses`, { headers: { Authorization: `Bearer ${superAdminToken}` } })).status).toBe(200);
      expect((await fetch(`${serverUrl}/students/me`, { headers: { Authorization: `Bearer ${superAdminToken}` } })).status).toBe(403);
      expect((await fetch(`${serverUrl}/teachers/me`, { headers: { Authorization: `Bearer ${superAdminToken}` } })).status).toBe(403);
    });
  });

  describe('5. Cross-Institute & Batch-Level Tenant Isolation', () => {
    it('blocks INSTITUTE_ADMIN of Institute A from Institute B resources with 403', async () => {
      const coursesRes = await fetch(`${serverUrl}/institutes/${instituteBId}/courses`, {
        headers: { Authorization: `Bearer ${adminAToken}` },
      });
      expect(coursesRes.status).toBe(403);

      const studentsRes = await fetch(`${serverUrl}/institutes/${instituteBId}/students`, {
        headers: { Authorization: `Bearer ${adminAToken}` },
      });
      expect(studentsRes.status).toBe(403);

      const dashRes = await fetch(`${serverUrl}/institutes/${instituteBId}/dashboard/overview`, {
        headers: { Authorization: `Bearer ${adminAToken}` },
      });
      expect(dashRes.status).toBe(403);
    });

    it('isolates Student B from Institute A courses, assignments, live sessions, and exams', async () => {
      const courseRes = await fetch(`${serverUrl}/students/courses/${courseAId}`, {
        headers: { Authorization: `Bearer ${studentBToken}` },
      });
      expect([403, 404]).toContain(courseRes.status);

      const assignRes = await fetch(`${serverUrl}/students/assignments`, {
        headers: { Authorization: `Bearer ${studentBToken}` },
      });
      expect(assignRes.status).toBe(200);
      const assignBody = await assignRes.json();
      expect(assignBody.assignments).toEqual([]);

      const sessRes = await fetch(`${serverUrl}/students/live-sessions`, {
        headers: { Authorization: `Bearer ${studentBToken}` },
      });
      expect(sessRes.status).toBe(200);
      const sessBody = await sessRes.json();
      expect(sessBody.sessions).toEqual([]);

      const assignDetailRes = await fetch(`${serverUrl}/students/assignments/${assignmentB1Id}`, {
        headers: { Authorization: `Bearer ${studentBToken}` },
      });
      expect([403, 404]).toContain(assignDetailRes.status);

      const sessDetailRes = await fetch(`${serverUrl}/students/live-sessions/${liveSessionB1Id}`, {
        headers: { Authorization: `Bearer ${studentBToken}` },
      });
      expect([403, 404]).toContain(sessDetailRes.status);
    });

    it('restricts Student A1 (Batch 1) from viewing Batch 2 assignments and live sessions', async () => {
      const assignListRes = await fetch(`${serverUrl}/students/assignments`, {
        headers: { Authorization: `Bearer ${studentA1Token}` },
      });
      expect(assignListRes.status).toBe(200);
      const assignListBody = await assignListRes.json();
      const assignIds = (assignListBody.assignments || []).map((a: any) => a.id);
      expect(assignIds).toContain(assignmentB1Id);
      expect(assignIds).not.toContain(assignmentB2Id);

      const otherBatchAssignRes = await fetch(
        `${serverUrl}/students/assignments/${assignmentB2Id}`,
        { headers: { Authorization: `Bearer ${studentA1Token}` } },
      );
      expect([403, 404]).toContain(otherBatchAssignRes.status);

      const sessListRes = await fetch(`${serverUrl}/students/live-sessions`, {
        headers: { Authorization: `Bearer ${studentA1Token}` },
      });
      expect(sessListRes.status).toBe(200);
      const sessListBody = await sessListRes.json();
      const sessIds = (sessListBody.sessions || []).map((s: any) => s.id);
      expect(sessIds).toContain(liveSessionB1Id);
      expect(sessIds).not.toContain(liveSessionB2Id);

      const otherBatchSessRes = await fetch(
        `${serverUrl}/students/live-sessions/${liveSessionB2Id}`,
        { headers: { Authorization: `Bearer ${studentA1Token}` } },
      );
      expect([403, 404]).toContain(otherBatchSessRes.status);
    });
  });
});
