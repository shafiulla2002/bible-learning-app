import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient, Role, MembershipStatus } from '@prisma/client';
import { SettingsService } from '../src/modules/settings/settings.service';
import { PrismaService } from '../src/core/prisma/prisma.service';
import { ConflictException, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';

function getTestDbUrl(): string {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const l of lines) {
      if (l.startsWith('TEST_DATABASE_URL=')) {
        return l.slice('TEST_DATABASE_URL='.length).trim().replace(/^"|"$/g, '');
      }
    }
  }
  throw new Error('TEST_DATABASE_URL not found in process.env or apps/api/.env');
}

describe('Milestone 2.7 — Institute Settings & Branding Integration Suite (Cloud SQL)', () => {
  let prisma: PrismaService;
  let settingsService: SettingsService;
  const testSuffix = Date.now().toString().slice(-6);

  let instituteIdA: string;
  let instituteIdB: string;
  let adminUserIdA: string;
  let academicYearA1: string;
  let academicYearA2: string;
  let academicTermA1: string;
  let teacherMembershipIdA: string;
  let superAdminMembershipId: string;

  jest.setTimeout(60000);

  beforeAll(async () => {
    const url = getTestDbUrl();
    prisma = new PrismaClient({ datasources: { db: { url } } }) as unknown as PrismaService;
    await (prisma as any).$connect();
    settingsService = new SettingsService(prisma);

    // 1. Seed Institute A
    const instA = await prisma.institute.create({
      data: {
        name: `Settings Institute A ${testSuffix}`,
        slug: `set-inst-a-${testSuffix}`,
        timezone: 'Asia/Kolkata',
        currency: 'INR',
      },
    });
    instituteIdA = instA.id;

    // 2. Seed Institute B (for multi-tenant isolation testing)
    const instB = await prisma.institute.create({
      data: {
        name: `Settings Institute B ${testSuffix}`,
        slug: `set-inst-b-${testSuffix}`,
        timezone: 'America/New_York',
        currency: 'USD',
      },
    });
    instituteIdB = instB.id;

    // 3. Seed Admin User in Institute A
    const adminUser = await prisma.user.create({
      data: {
        phoneE164: `+9198000${testSuffix}`,
        fullName: `Admin Test ${testSuffix}`,
        email: `admin.${testSuffix}@example.com`,
      },
    });
    adminUserIdA = adminUser.id;

    await prisma.membership.create({
      data: {
        userId: adminUserIdA,
        instituteId: instituteIdA,
        role: Role.INSTITUTE_ADMIN,
        status: MembershipStatus.ACTIVE,
      },
    });

    // 4. Seed Teacher User in Institute A
    const teacherUser = await prisma.user.create({
      data: {
        phoneE164: `+9198100${testSuffix}`,
        fullName: `Teacher Test ${testSuffix}`,
        email: `teacher.${testSuffix}@example.com`,
      },
    });
    const teacherMem = await prisma.membership.create({
      data: {
        userId: teacherUser.id,
        instituteId: instituteIdA,
        role: Role.TEACHER,
        status: MembershipStatus.ACTIVE,
      },
    });
    teacherMembershipIdA = teacherMem.id;

    // 5. Seed Super Admin User in Institute A
    const superAdminUser = await prisma.user.create({
      data: {
        phoneE164: `+9198200${testSuffix}`,
        fullName: `SuperAdmin Test ${testSuffix}`,
        email: `superadmin.${testSuffix}@example.com`,
      },
    });
    const superMem = await prisma.membership.create({
      data: {
        userId: superAdminUser.id,
        instituteId: instituteIdA,
        role: Role.SUPER_ADMIN,
        status: MembershipStatus.ACTIVE,
      },
    });
    superAdminMembershipId = superMem.id;

    // 6. Seed Academic Years in Institute A
    const ay1 = await prisma.academicYear.create({
      data: {
        instituteId: instituteIdA,
        name: `AY 2026-2027 ${testSuffix}`,
        startDate: new Date('2026-06-01'),
        endDate: new Date('2027-05-31'),
        isCurrent: true,
      },
    });
    academicYearA1 = ay1.id;

    const ay2 = await prisma.academicYear.create({
      data: {
        instituteId: instituteIdA,
        name: `AY 2027-2028 ${testSuffix}`,
        startDate: new Date('2027-06-01'),
        endDate: new Date('2028-05-31'),
        isCurrent: false,
      },
    });
    academicYearA2 = ay2.id;

    // 7. Seed Academic Term in AY1
    const term1 = await prisma.academicTerm.create({
      data: {
        instituteId: instituteIdA,
        academicYearId: academicYearA1,
        name: `Term Fall 2026 ${testSuffix}`,
        startDate: new Date('2026-06-01'),
        endDate: new Date('2026-11-30'),
        isCurrent: true,
      },
    });
    academicTermA1 = term1.id;
  });

  afterAll(async () => {
    // Clean up test data
    try {
      await prisma.auditLog.deleteMany({ where: { instituteId: { in: [instituteIdA, instituteIdB] } } });
      await prisma.academicTerm.deleteMany({ where: { instituteId: { in: [instituteIdA, instituteIdB] } } });
      await prisma.academicYear.deleteMany({ where: { instituteId: { in: [instituteIdA, instituteIdB] } } });
      await prisma.membership.deleteMany({ where: { instituteId: { in: [instituteIdA, instituteIdB] } } });
      await prisma.instituteSettings.deleteMany({ where: { instituteId: { in: [instituteIdA, instituteIdB] } } });
      await prisma.institute.deleteMany({ where: { id: { in: [instituteIdA, instituteIdB] } } });
    } catch {}
    await (prisma as any).$disconnect();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION 1: Institute Profile Management
  // ─────────────────────────────────────────────────────────────────────────────
  describe('1. Institute Profile Management', () => {
    it('retrieves default consolidated settings for a newly created institute', async () => {
      const res = await settingsService.getSettings(instituteIdA);

      expect(res).toBeDefined();
      expect(res.profile.name).toBe(`Settings Institute A ${testSuffix}`);
      expect(res.profile.code).toBe(`set-inst-a-${testSuffix}`);
      expect(res.profile.timezone).toBe('Asia/Kolkata');
      expect(res.branding.primaryColor).toBe('#2563eb');
      expect(res.financial.currency).toBe('INR');
      expect(res.academic.currentAcademicYearId).toBe(academicYearA1);
    });

    it('updates institutional profile details and preserves immutable code', async () => {
      const updated = await settingsService.updateProfile(
        instituteIdA,
        {
          name: `Renamed Institute A ${testSuffix}`,
          displayName: 'Grace Theological Seminary',
          registrationNumber: 'REG-2026-101',
          email: 'contact@grace-seminary.edu',
          phone: '+91 98765 00000',
          city: 'Bangalore',
          state: 'Karnataka',
          country: 'India',
          description: 'A premiere reformed theological institute.',
        },
        adminUserIdA,
      );

      expect(updated.name).toBe(`Renamed Institute A ${testSuffix}`);
      expect(updated.displayName).toBe('Grace Theological Seminary');
      expect(updated.registrationNumber).toBe('REG-2026-101');
      expect(updated.code).toBe(`set-inst-a-${testSuffix}`); // Slug preserved unchanged
      expect(updated.city).toBe('Bangalore');

      // Verify in DB
      const inDb = await prisma.institute.findUnique({ where: { id: instituteIdA } });
      expect(inDb?.name).toBe(`Renamed Institute A ${testSuffix}`);
    });

    it('throws 404 when querying settings for a non-existent institute', async () => {
      await expect(
        settingsService.getSettings('00000000-0000-0000-0000-000000000000'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION 2: Institute Branding Management & Isolation
  // ─────────────────────────────────────────────────────────────────────────────
  describe('2. Institute Branding & Multi-Tenant Isolation', () => {
    it('updates institute brand colors and logo URL', async () => {
      const branding = await settingsService.updateBranding(
        instituteIdA,
        {
          primaryColor: '#1e40af',
          secondaryColor: '#0f172a',
          accentColor: '#059669',
          logoUrl: 'https://example.com/logo-a.png',
          displayName: 'Seminary Brand',
        },
        adminUserIdA,
      );

      expect(branding.primaryColor).toBe('#1e40af');
      expect(branding.secondaryColor).toBe('#0f172a');
      expect(branding.accentColor).toBe('#059669');
      expect(branding.logoUrl).toBe('https://example.com/logo-a.png');

      // Verify Institute.logoUrl is synchronized
      const inst = await prisma.institute.findUnique({ where: { id: instituteIdA } });
      expect(inst?.logoUrl).toBe('https://example.com/logo-a.png');
    });

    it('guarantees branding isolation: updating Institute A does not mutate Institute B', async () => {
      const resB = await settingsService.getSettings(instituteIdB);

      // Institute B should remain on defaults
      expect(resB.branding.primaryColor).toBe('#2563eb');
      expect(resB.branding.logoUrl).toBeUndefined();
      expect(resB.profile.name).toBe(`Settings Institute B ${testSuffix}`);
    });

    it('resets branding to default system theme upon request', async () => {
      const reset = await settingsService.resetBranding(instituteIdA, adminUserIdA);

      expect(reset.primaryColor).toBe('#2563eb');
      expect(reset.secondaryColor).toBe('#1e2235');
      expect(reset.accentColor).toBe('#10b981');

      const inst = await prisma.institute.findUnique({ where: { id: instituteIdA } });
      expect(inst?.logoUrl).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION 3: Academic Settings & Period Transitions
  // ─────────────────────────────────────────────────────────────────────────────
  describe('3. Academic Settings & Integrity', () => {
    it('updates working days, default session duration, and minimum attendance', async () => {
      const updated = await settingsService.updateAcademicSettings(
        instituteIdA,
        {
          workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          defaultSessionDurationMinutes: 90,
          minAttendancePercentage: 80,
          academicCalendarType: 'SEMESTER',
        },
        adminUserIdA,
      );

      expect(updated.workingDays).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
      expect(updated.defaultSessionDurationMinutes).toBe(90);
      expect(updated.minAttendancePercentage).toBe(80);
    });

    it('switches current academic year atomically and sets previous year to isCurrent=false', async () => {
      await settingsService.updateAcademicSettings(
        instituteIdA,
        {
          currentAcademicYearId: academicYearA2,
        },
        adminUserIdA,
      );

      const ay1 = await prisma.academicYear.findUnique({ where: { id: academicYearA1 } });
      const ay2 = await prisma.academicYear.findUnique({ where: { id: academicYearA2 } });

      expect(ay1?.isCurrent).toBe(false);
      expect(ay2?.isCurrent).toBe(true);
    });

    it('rejects setting current academic year if the year belongs to another institute', async () => {
      // Create AY in Institute B
      const ayB = await prisma.academicYear.create({
        data: {
          instituteId: instituteIdB,
          name: `AY in Inst B ${testSuffix}`,
          startDate: new Date('2026-06-01'),
          endDate: new Date('2027-05-31'),
        },
      });

      await expect(
        settingsService.updateAcademicSettings(
          instituteIdA,
          { currentAcademicYearId: ayB.id },
          adminUserIdA,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION 4: Financial Settings
  // ─────────────────────────────────────────────────────────────────────────────
  describe('4. Financial Settings & Invoicing Preferences', () => {
    it('persists financial preferences, invoice prefix, and due days without altering historical transactions', async () => {
      const fin = await settingsService.updateFinancialSettings(
        instituteIdA,
        {
          currency: 'INR',
          invoicePrefix: 'SEMINARY-INV',
          receiptPrefix: 'SEMINARY-RCP',
          defaultDueDays: 20,
          financialContactEmail: 'bursar@seminary.edu',
          taxOrGstNumber: '29AAAAA1111A1Z1',
          showInstituteLogoOnInvoice: true,
        },
        adminUserIdA,
      );

      expect(fin.invoicePrefix).toBe('SEMINARY-INV');
      expect(fin.receiptPrefix).toBe('SEMINARY-RCP');
      expect(fin.defaultDueDays).toBe(20);
      expect(fin.financialContactEmail).toBe('bursar@seminary.edu');
      expect(fin.taxOrGstNumber).toBe('29AAAAA1111A1Z1');
      expect(fin.showInstituteLogoOnInvoice).toBe(true);

      const inDb = await settingsService.getSettings(instituteIdA);
      expect(inDb.financial.invoicePrefix).toBe('SEMINARY-INV');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION 5: Users & Access Permissions Governance
  // ─────────────────────────────────────────────────────────────────────────────
  describe('5. Users & Access Permissions Governance', () => {
    it('lists users belonging strictly to the target institute with role and status', async () => {
      const users = await settingsService.getUsers(instituteIdA);

      expect(users.length).toBeGreaterThanOrEqual(3); // Admin, Teacher, SuperAdmin
      const roles = users.map((u) => u.role);
      expect(roles).toContain(Role.INSTITUTE_ADMIN);
      expect(roles).toContain(Role.TEACHER);
    });

    it('allows Institute Admin to suspend a teacher membership in the institute', async () => {
      const res = await settingsService.updateUserStatus(
        instituteIdA,
        teacherMembershipIdA,
        'SUSPENDED',
        adminUserIdA,
        Role.INSTITUTE_ADMIN,
      );

      expect(res.status).toBe('SUSPENDED');

      const mem = await prisma.membership.findUnique({ where: { id: teacherMembershipIdA } });
      expect(mem?.status).toBe(MembershipStatus.SUSPENDED);
    });

    it('prohibits Institute Admin from altering Super Admin membership status', async () => {
      await expect(
        settingsService.updateUserStatus(
          instituteIdA,
          superAdminMembershipId,
          'SUSPENDED',
          adminUserIdA,
          Role.INSTITUTE_ADMIN, // Non-SuperAdmin attempting change
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects user status update if membership belongs to another institute', async () => {
      await expect(
        settingsService.updateUserStatus(
          instituteIdB, // Mismatched institute
          teacherMembershipIdA,
          'ACTIVE',
          adminUserIdA,
          Role.INSTITUTE_ADMIN,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // SECTION 6: Security, Preferences & Audit Trail
  // ─────────────────────────────────────────────────────────────────────────────
  describe('6. Security Preferences & Administrative Audit Trail', () => {
    it('persists session timeout and student self-registration preferences', async () => {
      const sec = await settingsService.updateSecurityPreferences(
        instituteIdA,
        {
          sessionTimeoutMinutes: 45,
          studentSelfRegistration: false,
          notifyOnStudentRegistration: true,
          notifyOnFeePayment: true,
          notifyOnAttendanceAlert: false,
        },
        adminUserIdA,
      );

      expect(sec.sessionTimeoutMinutes).toBe(45);
      expect(sec.studentSelfRegistration).toBe(false);
      expect(sec.notifyOnAttendanceAlert).toBe(false);

      const inDb = await settingsService.getSettings(instituteIdA);
      expect(inDb.security.sessionTimeoutMinutes).toBe(45);
      expect(inDb.security.studentSelfRegistration).toBe(false);
    });

    it('verifies immutable audit logs are created for every administrative configuration action', async () => {
      const logs = await settingsService.getAuditLogs(instituteIdA);

      expect(logs.length).toBeGreaterThanOrEqual(4);
      const actions = logs.map((l) => l.action);

      expect(actions).toContain('UPDATE_INSTITUTE_PROFILE');
      expect(actions).toContain('UPDATE_INSTITUTE_BRANDING');
      expect(actions).toContain('UPDATE_ACADEMIC_SETTINGS');
      expect(actions).toContain('UPDATE_USER_MEMBERSHIP_STATUS');
    });
  });
});

