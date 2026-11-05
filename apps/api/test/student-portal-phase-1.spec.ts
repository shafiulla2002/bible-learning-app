import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/core/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('Student Portal Phase 1: Authentication & Multi-Tenant Isolation', () => {
  let app: INestApplication;
  let serverUrl: string;
  let prisma: PrismaService;
  let jwtService: JwtService;

  let testStudentUser: any;
  let testStudentMembership: any;
  let testInstitute: any;
  let testAdminUser: any;
  let testTeacherUser: any;
  let otherInstitute: any;

  beforeAll(async () => {
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

    // Resolve test institute and student from seeded database
    testInstitute = await prisma.institute.findFirst({
      where: { status: 'ACTIVE' },
    });

    testStudentMembership = await prisma.membership.findFirst({
      where: {
        role: 'STUDENT',
        status: 'ACTIVE',
        studentProfile: { isNot: null },
      },
      include: {
        user: true,
        studentProfile: {
          include: {
            enrolments: { where: { status: 'ACTIVE' } },
          },
        },
        institute: true,
      },
    });

    if (testStudentMembership) {
      testStudentUser = testStudentMembership.user;
    }

    // Resolve an admin user
    const adminMembership = await prisma.membership.findFirst({
      where: { role: 'INSTITUTE_ADMIN', status: 'ACTIVE' },
      include: { user: true },
    });
    testAdminUser = adminMembership?.user;

    // Resolve a teacher user
    const teacherMembership = await prisma.membership.findFirst({
      where: { role: 'TEACHER', status: 'ACTIVE' },
      include: { user: true },
    });
    testTeacherUser = teacherMembership?.user;

    // Resolve a secondary institute if available
    const otherInst = await prisma.institute.findFirst({
      where: {
        id: { not: testStudentMembership?.instituteId },
      },
    });
    otherInstitute = otherInst;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('1. rejects unauthenticated requests to GET /students/me with HTTP 401', async () => {
    const res = await fetch(`${serverUrl}/students/me`);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.message).toMatch(/Authentication token required/i);
  });

  it('2. rejects forged or invalid JWT tokens with HTTP 401', async () => {
    const res = await fetch(`${serverUrl}/students/me`, {
      headers: {
        Authorization: 'Bearer invalid.bogus.jwt-token-string',
      },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.message).toMatch(/Invalid or expired authentication token/i);
  });

  it('3. strictly rejects INSTITUTE_ADMIN role accounts with HTTP 403 Forbidden', async () => {
    const adminToken = jwtService.sign({
      sub: testAdminUser?.id || 'admin-test-id',
      role: 'INSTITUTE_ADMIN',
      instituteId: testInstitute?.id,
    });

    const res = await fetch(`${serverUrl}/students/me`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.message).toMatch(/not authorized to access Student Portal/i);
  });

  it('4. strictly rejects TEACHER role accounts with HTTP 403 Forbidden', async () => {
    const teacherToken = jwtService.sign({
      sub: testTeacherUser?.id || 'teacher-test-id',
      role: 'TEACHER',
      instituteId: testInstitute?.id,
    });

    const res = await fetch(`${serverUrl}/students/me`, {
      headers: {
        Authorization: `Bearer ${teacherToken}`,
      },
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.message).toMatch(/not authorized to access Student Portal/i);
  });

  it('5. successfully resolves verified STUDENT identity, profile, and institute context', async () => {
    if (!testStudentMembership) {
      console.warn('Skipping test 5: No seeded student found');
      return;
    }

    const studentToken = jwtService.sign({
      sub: testStudentUser.id,
      phone: testStudentUser.phoneE164,
      role: 'STUDENT',
      instituteId: testStudentMembership.instituteId,
    });

    const res = await fetch(`${serverUrl}/students/me`, {
      headers: {
        Authorization: `Bearer ${studentToken}`,
      },
    });

    expect(res.status).toBe(200);
    const data = await res.json();

    // Verify student identity
    expect(data.student).toBeDefined();
    expect(data.student.id).toBe(testStudentUser.id);
    expect(data.student.fullName).toBe(testStudentUser.fullName);

    // Verify student profile
    expect(data.profile).toBeDefined();
    expect(data.profile.studentProfileId).toBe(testStudentMembership.studentProfile.id);
    expect(data.profile.admissionNo).toBe(testStudentMembership.studentProfile.admissionNo);

    // Verify institute branding
    expect(data.institute).toBeDefined();
    expect(data.institute.id).toBe(testStudentMembership.instituteId);
    expect(data.institute.name).toBe(testStudentMembership.institute.name);

    // Verify active enrolment count
    expect(typeof data.activeEnrolmentCount).toBe('number');
    expect(data.activeEnrolmentCount).toBe(
      testStudentMembership.studentProfile.enrolments?.length || 0,
    );
  });

  it('6. enforces strict multi-tenant isolation against cross-institute querying', async () => {
    if (!testStudentMembership || !otherInstitute) {
      console.warn('Skipping test 6: Secondary institute not available in database');
      return;
    }

    // Attempting to query with a token bound to otherInstitute
    const mismatchedToken = jwtService.sign({
      sub: testStudentUser.id,
      phone: testStudentUser.phoneE164,
      role: 'STUDENT',
      instituteId: otherInstitute.id,
    });

    const res = await fetch(`${serverUrl}/students/me`, {
      headers: {
        Authorization: `Bearer ${mismatchedToken}`,
      },
    });

    // Mismatched institute membership must fail with HTTP 403 Forbidden
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.message).toMatch(/No active student profile found for this account/i);
  });

  it('7. verifies client cannot spoof studentProfileId via query parameters', async () => {
    if (!testStudentMembership) {
      return;
    }

    const studentToken = jwtService.sign({
      sub: testStudentUser.id,
      phone: testStudentUser.phoneE164,
      role: 'STUDENT',
      instituteId: testStudentMembership.instituteId,
    });

    // Attacker passes an arbitrary spoofed student profile ID in query parameter
    const res = await fetch(
      `${serverUrl}/students/me?studentProfileId=spoofed-arbitrary-profile-id-999`,
      {
        headers: {
          Authorization: `Bearer ${studentToken}`,
        },
      },
    );

    expect(res.status).toBe(200);
    const data = await res.json();

    // Must strictly return the student profile belonging to the verified JWT, completely ignoring spoofed param
    expect(data.profile.studentProfileId).toBe(testStudentMembership.studentProfile.id);
    expect(data.profile.studentProfileId).not.toBe('spoofed-arbitrary-profile-id-999');
  });
});
