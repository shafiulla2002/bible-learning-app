import * as fs from 'fs';
import * as path from 'path';
import {
  PrismaClient,
  Role,
  MembershipStatus,
  InvoiceStatus,
  FeePaymentMode,
  FeePaymentStatus,
} from '@prisma/client';
import { PrismaService } from '../src/core/prisma/prisma.service';
import { DashboardService } from '../src/modules/dashboard/dashboard.service';
import { NotificationsService } from '../src/modules/notifications/notifications.service';

function getTestDbUrl(): string {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const l of lines) {
      if (l.startsWith('TEST_DATABASE_URL=')) {
        return l
          .slice('TEST_DATABASE_URL='.length)
          .trim()
          .replace(/^"|"$/g, '');
      }
    }
  }
  throw new Error('TEST_DATABASE_URL not found in process.env or apps/api/.env');
}

describe('Admin Dashboard Real Database Persistence & CRUD Audit (Cloud SQL)', () => {
  let prisma: PrismaService;
  let dashboardService: DashboardService;
  let notificationsService: NotificationsService;

  const suffix = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;

  let instituteIdA: string;
  let instituteIdB: string;
  let instituteIdEmpty: string;

  let adminAId: string;
  let adminBId: string;
  let academicYearAId: string;
  let academicTermAId: string;
  let categoryAId: string;

  jest.setTimeout(90000);

  beforeAll(async () => {
    const url = getTestDbUrl();
    prisma = new PrismaClient({
      datasources: { db: { url } },
    }) as unknown as PrismaService;
    await (prisma as any).$connect();

    notificationsService = new NotificationsService(prisma);
    dashboardService = new DashboardService(prisma);

    // 1. Seed Institutes A, B (tenant check), and Empty (zero data check)
    const [instA, instB, instEmpty] = await Promise.all([
      prisma.institute.create({
        data: {
          name: `Grace DB Audit Institute A ${suffix}`,
          slug: `audit-inst-a-${suffix}`,
          timezone: 'Asia/Kolkata',
          currency: 'INR',
        },
      }),
      prisma.institute.create({
        data: {
          name: `Tenant Isolation Institute B ${suffix}`,
          slug: `audit-inst-b-${suffix}`,
          timezone: 'Asia/Kolkata',
          currency: 'INR',
        },
      }),
      prisma.institute.create({
        data: {
          name: `Zero Data Institute C ${suffix}`,
          slug: `audit-inst-c-${suffix}`,
          timezone: 'Asia/Kolkata',
          currency: 'INR',
        },
      }),
    ]);

    instituteIdA = instA.id;
    instituteIdB = instB.id;
    instituteIdEmpty = instEmpty.id;

    // 2. Seed Admin Users
    const userA = await prisma.user.create({
      data: {
        phoneE164: `+91910${suffix.slice(0, 7)}`,
        fullName: `Admin A ${suffix}`,
        email: `admin.a.${suffix}@bible-lms.test`,
      },
    });
    await prisma.membership.create({
      data: {
        userId: userA.id,
        instituteId: instituteIdA,
        role: Role.INSTITUTE_ADMIN,
        status: MembershipStatus.ACTIVE,
      },
    });
    adminAId = userA.id;

    const userB = await prisma.user.create({
      data: {
        phoneE164: `+91920${suffix.slice(0, 7)}`,
        fullName: `Admin B ${suffix}`,
        email: `admin.b.${suffix}@bible-lms.test`,
      },
    });
    await prisma.membership.create({
      data: {
        userId: userB.id,
        instituteId: instituteIdB,
        role: Role.INSTITUTE_ADMIN,
        status: MembershipStatus.ACTIVE,
      },
    });
    adminBId = userB.id;

    // 3. Academic Year & Term
    const now = new Date();
    const ay = await prisma.academicYear.create({
      data: {
        instituteId: instituteIdA,
        name: `AY 2026-27 ${suffix}`,
        startDate: new Date(now.getTime() - 30 * 86400000),
        endDate: new Date(now.getTime() + 300 * 86400000),
        isCurrent: true,
      },
    });
    academicYearAId = ay.id;

    const term = await prisma.academicTerm.create({
      data: {
        instituteId: instituteIdA,
        academicYearId: academicYearAId,
        name: `Fall Term ${suffix}`,
        startDate: new Date(now.getTime() - 15 * 86400000),
        endDate: new Date(now.getTime() + 90 * 86400000),
        isCurrent: true,
      },
    });
    academicTermAId = term.id;

    // 4. Course Category
    const cat = await prisma.courseCategory.create({
      data: {
        instituteId: instituteIdA,
        name: `Theology ${suffix}`,
        slug: `theology-${suffix}`,
      },
    });
    categoryAId = cat.id;
  });

  afterAll(async () => {
    if (prisma) {
      await (prisma as any).$disconnect();
    }
  });

  it('Requirement 1 & Zero Data: An unpopulated institute reports exactly 0 across all metrics and never falls back to mock sample data', async () => {
    const overviewEmpty = await dashboardService.getOverview(instituteIdEmpty, { preset: '30D' });
    expect(overviewEmpty.kpi.totalStudents).toBe(0);
    expect(overviewEmpty.kpi.activeStudents).toBe(0);
    expect(overviewEmpty.kpi.totalCourses).toBe(0);
    expect(overviewEmpty.kpi.activeBatches).toBe(0);
    expect(overviewEmpty.kpi.totalFeeCollected).toBe(0);
    expect(overviewEmpty.kpi.totalFeePending).toBe(0);
    expect(overviewEmpty.kpi.upcomingSessionsCount).toBe(0);

    const txEmpty = await dashboardService.getTransactions(instituteIdEmpty);
    expect(txEmpty.data).toEqual([]);
    expect(txEmpty.meta.total).toBe(0);
  });

  it('Requirement 2 & 6.1: Registering a student increments the dashboard totalStudents and activeStudents counts in PostgreSQL', async () => {
    const initialOverview = await dashboardService.getOverview(instituteIdA, { preset: '30D' });
    const initialStudents = initialOverview.kpi.totalStudents;
    const initialActive = initialOverview.kpi.activeStudents;

    // Register student
    const studentUser = await prisma.user.create({
      data: {
        phoneE164: `+91930${suffix.slice(0, 7)}`,
        fullName: `Grace Student ${suffix}`,
        email: `grace.${suffix}@bible-lms.test`,
      },
    });
    const membership = await prisma.membership.create({
      data: {
        userId: studentUser.id,
        instituteId: instituteIdA,
        role: Role.STUDENT,
        status: MembershipStatus.ACTIVE,
      },
    });

    await prisma.studentProfile.create({
      data: {
        instituteId: instituteIdA,
        membershipId: membership.id,
        admissionNo: `ADM-TEST-${suffix}-1`,
        dateOfBirth: new Date('2002-05-15'),
        gender: 'FEMALE',
        status: 'ACTIVE',
      },
    });

    // Query dashboard again
    const updatedOverview = await dashboardService.getOverview(instituteIdA, { preset: '30D' });
    expect(updatedOverview.kpi.totalStudents).toBe(initialStudents + 1);
    expect(updatedOverview.kpi.activeStudents).toBe(initialActive + 1);
  });

  it('Requirement 2 & 6.2: Adding a course increments the dashboard totalCourses and publishedCourses counts in PostgreSQL', async () => {
    const initialOverview = await dashboardService.getOverview(instituteIdA, { preset: '30D' });
    const initialCourses = initialOverview.kpi.totalCourses;
    const initialPublished = initialOverview.kpi.publishedCourses;

    // Create a published course
    await prisma.course.create({
      data: {
        instituteId: instituteIdA,
        categoryId: categoryAId,
        title: `Biblical Hermeneutics ${suffix}`,
        slug: `herm-${suffix}`,
        description: 'Exegesis and theological principles',
        status: 'PUBLISHED',
      },
    });

    const updatedOverview = await dashboardService.getOverview(instituteIdA, { preset: '30D' });
    expect(updatedOverview.kpi.totalCourses).toBe(initialCourses + 1);
    expect(updatedOverview.kpi.publishedCourses).toBe(initialPublished + 1);
  });

  it('Requirement 2 & 6.3: Creating an active batch and live session increments activeBatches and upcomingSessionsCount', async () => {
    const initialOverview = await dashboardService.getOverview(instituteIdA, { preset: '30D' });
    const initialBatches = initialOverview.kpi.activeBatches;
    const initialSessions = initialOverview.kpi.upcomingSessionsCount;

    // Fetch existing course
    const course = await prisma.course.findFirst({ where: { instituteId: instituteIdA } });
    expect(course).toBeDefined();

    // Create batch
    const now = new Date();
    const batch = await prisma.batch.create({
      data: {
        instituteId: instituteIdA,
        courseId: course!.id,
        academicYearId: academicYearAId,
        termId: academicTermAId,
        name: `Cohort Alpha ${suffix}`,
        code: `COHORT-${suffix}`,
        startDate: now,
        endDate: new Date(now.getTime() + 90 * 86400000),
        capacity: 35,
        status: 'ACTIVE',
      },
    });

    // Create teacher profile to host live session
    const teacherUser = await prisma.user.create({
      data: {
        phoneE164: `+91940${suffix.slice(0, 7)}`,
        fullName: `Prof. David ${suffix}`,
        email: `david.${suffix}@bible-lms.test`,
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
    const teacherProf = await prisma.teacherProfile.create({
      data: {
        instituteId: instituteIdA,
        membershipId: teacherMem.id,
        employeeCode: `EMP-${suffix}`,
        status: 'ACTIVE',
      },
    });

    // Create upcoming live session (tomorrow)
    const tomorrow = new Date(Date.now() + 86400000);
    const tomorrowEnd = new Date(tomorrow.getTime() + 3600000);

    await prisma.liveSession.create({
      data: {
        instituteId: instituteIdA,
        batchId: batch.id,
        teacherProfileId: teacherProf.id,
        title: `Introduction to Scripture Exegesis ${suffix}`,
        startsAt: tomorrow,
        endsAt: tomorrowEnd,
        status: 'SCHEDULED',
      },
    });

    const updatedOverview = await dashboardService.getOverview(instituteIdA, { preset: '30D' });
    expect(updatedOverview.kpi.activeBatches).toBe(initialBatches + 1);
    expect(updatedOverview.kpi.upcomingSessionsCount).toBe(initialSessions + 1);
  });

  it('Requirement 2 & 6.4: Recording a fee payment increments totalFeeCollected in exact integer paise and appears in the transactions ledger', async () => {
    const initialOverview = await dashboardService.getOverview(instituteIdA, { preset: '30D' });
    const initialCollected = initialOverview.kpi.totalFeeCollected;

    const studentProf = await prisma.studentProfile.findFirst({ where: { instituteId: instituteIdA } });
    expect(studentProf).toBeDefined();

    // Create Invoice for ₹25,000 (2,500,000 paise)
    const invoice = await prisma.invoice.create({
      data: {
        instituteId: instituteIdA,
        studentProfileId: studentProf!.id,
        invoiceNumber: `INV-${suffix}-001`,
        totalAmount: 2500000,
        paidAmount: 2500000,
        balanceAmount: 0,
        status: InvoiceStatus.PAID,
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 14 * 86400000),
      },
    });

    // Record FeePayment for ₹25,000 (2,500,000 paise)
    const payment = await prisma.feePayment.create({
      data: {
        instituteId: instituteIdA,
        invoiceId: invoice.id,
        paymentNumber: `PAY-${suffix}-001`,
        amount: 2500000,
        reversedAmount: 0,
        netAmount: 2500000,
        paymentMode: FeePaymentMode.ONLINE,
        referenceNumber: `REF-${suffix}-9845`,
        status: FeePaymentStatus.COMPLETED,
        paymentDate: new Date(),
        recordedByUserId: adminAId,
      },
    });

    await prisma.feeReceipt.create({
      data: {
        instituteId: instituteIdA,
        paymentId: payment.id,
        receiptNumber: `RCPT-${suffix}-001`,
        issuedByUserId: adminAId,
      },
    });

    const updatedOverview = await dashboardService.getOverview(instituteIdA, { preset: '30D' });
    expect(updatedOverview.kpi.totalFeeCollected).toBe(initialCollected + 2500000);

    // Verify transaction appears in getTransactions
    const txRes = await dashboardService.getTransactions(instituteIdA, { search: `PAY-${suffix}-001` });
    expect(txRes.data.length).toBe(1);
    expect(txRes.data[0].paymentNumber).toBe(`PAY-${suffix}-001`);
    expect(txRes.data[0].amount).toBe(2500000);
    expect(txRes.data[0].status).toBe('COMPLETED');
    expect(txRes.data[0].paymentMode).toBe('ONLINE');
    expect(txRes.data[0].referenceNumber).toBe(`REF-${suffix}-9845`);
  });

  it('Requirement 2 & 6.5: Financial payment reversal reduces dashboard net revenue by the reversed amount and updates status to PARTIALLY_REVERSED / REVERSED', async () => {
    const preOverview = await dashboardService.getOverview(instituteIdA, { preset: '30D' });
    const preCollected = preOverview.kpi.totalFeeCollected;

    // Find the payment created in previous test
    const payment = await prisma.feePayment.findFirst({
      where: { instituteId: instituteIdA, paymentNumber: `PAY-${suffix}-001` },
    });
    expect(payment).toBeDefined();

    // Partial reversal of ₹5,000 (500,000 paise) with required PaymentReversalAudit invariant record
    await prisma.$transaction([
      prisma.paymentReversalAudit.create({
        data: {
          instituteId: instituteIdA,
          paymentId: payment!.id,
          reversedByUserId: adminAId,
          reason: 'Audit verification test partial reversal',
          reversedAmount: 500000,
        },
      }),
      prisma.feePayment.update({
        where: { id: payment!.id },
        data: {
          reversedAmount: 500000,
          netAmount: 2000000, // ₹20,000 remaining net
          status: FeePaymentStatus.PARTIALLY_REVERSED,
        },
      }),
    ]);

    const postOverview = await dashboardService.getOverview(instituteIdA, { preset: '30D' });
    expect(postOverview.kpi.totalFeeCollected).toBe(preCollected - 500000);

    // Verify transaction status updated in getTransactions
    const txRes = await dashboardService.getTransactions(instituteIdA, { search: `PAY-${suffix}-001` });
    expect(txRes.data[0].status).toBe('PARTIALLY_REVERSED');
  });

  it('Requirement 3: Growth percentage calculation computes accurate percentage changes and handles zero previous periods safely', async () => {
    const overview = await dashboardService.getOverview(instituteIdA, { preset: '30D' });
    const studentsComp = overview.kpi.comparisons.studentsRegistered;
    expect(studentsComp).toBeDefined();
    expect(typeof studentsComp.periodValue).toBe('number');
    // If previous period is null or 0, changePct must be null, never Infinity or NaN
    if (studentsComp.previousPeriodValue === 0 || studentsComp.previousPeriodValue === null) {
      expect(studentsComp.changePct).toBeNull();
    } else {
      expect(typeof studentsComp.changePct).toBe('number');
      expect(Number.isFinite(studentsComp.changePct)).toBe(true);
    }
  });

  it('Requirement 7: Strict tenant isolation ensures Institute A records are never leaked to Institute B', async () => {
    const overviewB = await dashboardService.getOverview(instituteIdB, { preset: '30D' });
    expect(overviewB.kpi.totalStudents).toBe(0);
    expect(overviewB.kpi.totalCourses).toBe(0);
    expect(overviewB.kpi.activeBatches).toBe(0);
    expect(overviewB.kpi.totalFeeCollected).toBe(0);

    const txB = await dashboardService.getTransactions(instituteIdB);
    expect(txB.data).toEqual([]);
    expect(txB.meta.total).toBe(0);
  });
});
