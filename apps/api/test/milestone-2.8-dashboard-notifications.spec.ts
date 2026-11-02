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
import {
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../src/core/prisma/prisma.service';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { DashboardService } from '../src/modules/dashboard/dashboard.service';
import { SettingsService } from '../src/modules/settings/settings.service';
import { StudentsService } from '../src/modules/students/students.service';
import { TeachersService } from '../src/modules/teachers/teachers.service';
import { CoursesService } from '../src/modules/courses/courses.service';
import { BatchesService } from '../src/modules/batches/batches.service';
import { AttendanceService } from '../src/modules/attendance/attendance.service';
import { ExportReportType } from '../src/modules/dashboard/dashboard.dto';

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

describe('Milestone 2.8 — Admin Dashboard & Notifications Integration Suite (Cloud SQL)', () => {
  let prisma: PrismaService;
  let notificationsService: NotificationsService;
  let dashboardService: DashboardService;
  let settingsService: SettingsService;
  let studentsService: StudentsService;
  let teachersService: TeachersService;
  let coursesService: CoursesService;
  let batchesService: BatchesService;
  let attendanceService: AttendanceService;

  const suffix = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;

  let instituteIdA: string;
  let instituteIdB: string;
  let instituteIdEmpty: string;

  let adminA1Id: string;
  let adminA2Id: string;
  let coordinatorAId: string;
  let financeAId: string;
  let teacherUserAId: string;
  let studentUserAId: string;
  let adminBId: string;
  let adminEmptyId: string;

  let academicYearAId: string;
  let academicTermAId: string;
  let course1Id: string;
  let course2Id: string;
  let teacher1ProfileId: string;
  let teacher2ProfileId: string;
  let batch1Id: string;
  let batch2Id: string;
  let student1ProfileId: string;
  let student2ProfileId: string;
  let student3ProfileId: string;
  let invoice1Number: string;

  jest.setTimeout(90000);

  beforeAll(async () => {
    const url = getTestDbUrl();
    prisma = new PrismaClient({
      datasources: { db: { url } },
    }) as unknown as PrismaService;
    await (prisma as any).$connect();

    notificationsService = new NotificationsService(prisma);
    dashboardService = new DashboardService(prisma);
    settingsService = new SettingsService(prisma, notificationsService);
    studentsService = new StudentsService(prisma, notificationsService);
    teachersService = new TeachersService(prisma, notificationsService);
    coursesService = new CoursesService(prisma, notificationsService);
    batchesService = new BatchesService(prisma, notificationsService);
    attendanceService = new AttendanceService(prisma, notificationsService);

    // 1. Seed Institutes A, B, and Empty C
    const [instA, instB, instEmpty] = await Promise.all([
      prisma.institute.create({
        data: {
          name: `Grace Dashboard Institute A ${suffix}`,
          slug: `dash-inst-a-${suffix}`,
          timezone: 'Asia/Kolkata',
          currency: 'INR',
        },
      }),
      prisma.institute.create({
        data: {
          name: `CrossTenant Institute B ${suffix}`,
          slug: `dash-inst-b-${suffix}`,
          timezone: 'America/New_York',
          currency: 'USD',
        },
      }),
      prisma.institute.create({
        data: {
          name: `ZeroData Institute C ${suffix}`,
          slug: `dash-inst-c-${suffix}`,
          timezone: 'Asia/Kolkata',
          currency: 'INR',
        },
      }),
    ]);

    instituteIdA = instA.id;
    instituteIdB = instB.id;
    instituteIdEmpty = instEmpty.id;

    // 2. Seed Users & Role Memberships
    const createMember = async (
      instId: string,
      role: Role,
      tag: string,
      phoneIdx: string,
    ) => {
      const u = await prisma.user.create({
        data: {
          phoneE164: `+9177${phoneIdx}${suffix.slice(0, 6)}`,
          fullName: `${tag} ${suffix}`,
          email: `${tag.toLowerCase().replace(/\s+/g, '.')}.${suffix}@bible-lms.test`,
        },
      });
      await prisma.membership.create({
        data: {
          userId: u.id,
          instituteId: instId,
          role,
          status: MembershipStatus.ACTIVE,
        },
      });
      return u.id;
    };

    adminA1Id = await createMember(instituteIdA, Role.INSTITUTE_ADMIN, 'Admin A1', '11');
    adminA2Id = await createMember(instituteIdA, Role.INSTITUTE_ADMIN, 'Admin A2', '12');
    coordinatorAId = await createMember(
      instituteIdA,
      Role.ACADEMIC_COORDINATOR,
      'Coordinator A',
      '13',
    );
    financeAId = await createMember(instituteIdA, Role.FINANCE_OFFICER, 'Finance A', '14');
    teacherUserAId = await createMember(instituteIdA, Role.TEACHER, 'RoleTeacher A', '15');
    studentUserAId = await createMember(instituteIdA, Role.STUDENT, 'RoleStudent A', '16');
    adminBId = await createMember(instituteIdB, Role.INSTITUTE_ADMIN, 'Admin B', '21');
    adminEmptyId = await createMember(
      instituteIdEmpty,
      Role.INSTITUTE_ADMIN,
      'Admin Empty',
      '31',
    );

    // 3. Seed Current Academic Year & Term in Institute A
    const now = new Date();
    const yearStart = new Date(now.getTime() - 60 * 86400000);
    const yearEnd = new Date(now.getTime() + 300 * 86400000);
    const termStart = new Date(now.getTime() - 15 * 86400000);
    const termEnd = new Date(now.getTime() + 105 * 86400000);

    const ay = await prisma.academicYear.create({
      data: {
        instituteId: instituteIdA,
        name: `AY 2026-27 ${suffix}`,
        startDate: yearStart,
        endDate: yearEnd,
        isCurrent: true,
      },
    });
    academicYearAId = ay.id;

    const term = await prisma.academicTerm.create({
      data: {
        instituteId: instituteIdA,
        academicYearId: academicYearAId,
        name: `Fall Term ${suffix}`,
        startDate: termStart,
        endDate: termEnd,
        isCurrent: true,
      },
    });
    academicTermAId = term.id;

    // 4. Create Courses via CoursesService (triggers ACADEMIC notifications)
    const c1 = await coursesService.create(instituteIdA, {
      title: `Biblical Hermeneutics ${suffix}`,
      description: 'Core exegesis and hermeneutics track',
      status: 'PUBLISHED',
      level: 'INTERMEDIATE',
    });
    course1Id = c1.id;

    const c2 = await coursesService.create(instituteIdA, {
      title: `Systematic Theology ${suffix}`,
      description: 'Draft curriculum in preparation',
      status: 'DRAFT',
      level: 'ADVANCED',
    });
    course2Id = c2.id;

    // 5. Create Teachers via TeachersService (triggers TEACHER notifications)
    const t1 = await teachersService.createTeacher(
      instituteIdA,
      {
        fullName: `Dr. Paul Titus ${suffix}`,
        phoneE164: `+917811${suffix.slice(0, 6)}`,
        email: `paul.titus.${suffix}@bible-lms.test`,
        specialization: 'New Testament Exegesis',
      },
      adminA1Id,
    );
    teacher1ProfileId = t1.id;

    const t2 = await teachersService.createTeacher(
      instituteIdA,
      {
        fullName: `Prof. Lydia Ruth ${suffix}`,
        phoneE164: `+917812${suffix.slice(0, 6)}`,
        email: `lydia.ruth.${suffix}@bible-lms.test`,
        specialization: 'Church History',
      },
      adminA1Id,
    );
    teacher2ProfileId = t2.id;

    // Put Teacher 2 ON_LEAVE to verify ON_LEAVE vs ACTIVE faculty breakdown
    await prisma.teacherProfile.update({
      where: { id: teacher2ProfileId },
      data: { status: 'ON_LEAVE' },
    });

    // Assign Teacher 1 to Course 1 via TeachersService (triggers TEACHER_ASSIGNMENT_CHANGED)
    await teachersService.assignCourse(
      instituteIdA,
      teacher1ProfileId,
      { courseId: course1Id, role: 'LEAD' },
      adminA1Id,
    );

    // 6. Create Batches via BatchesService (triggers ACADEMIC BATCH_CREATED notifications)
    const b1 = await batchesService.createBatch(instituteIdA, {
      courseId: course1Id,
      academicYearId: academicYearAId,
      termId: academicTermAId,
      name: `Morning Cohort A ${suffix}`,
      status: 'ACTIVE',
      startDate: termStart.toISOString(),
      endDate: termEnd.toISOString(),
      capacity: 20,
      leadTeacherProfileId: teacher1ProfileId,
    });
    batch1Id = b1.id;

    const b2 = await batchesService.createBatch(instituteIdA, {
      courseId: course1Id,
      academicYearId: academicYearAId,
      termId: academicTermAId,
      name: `Evening Cohort B ${suffix}`,
      status: 'UPCOMING',
      startDate: new Date(now.getTime() + 15 * 86400000).toISOString(),
      endDate: termEnd.toISOString(),
      capacity: 25,
    });
    batch2Id = b2.id;

    // 7. Create Students via StudentsService (triggers STUDENT notifications)
    const s1 = await studentsService.createStudent(instituteIdA, {
      fullName: `Esther Naomi ${suffix}`,
      phoneNumber: `+917911${suffix.slice(0, 6)}`,
      email: `esther.${suffix}@bible-lms.test`,
      status: 'ACTIVE',
      courseId: course1Id,
      batchId: batch1Id,
    });
    student1ProfileId = s1.id;

    const s2 = await studentsService.createStudent(instituteIdA, {
      fullName: `Daniel Caleb ${suffix}`,
      phoneNumber: `+917912${suffix.slice(0, 6)}`,
      email: `daniel.${suffix}@bible-lms.test`,
      status: 'ACTIVE',
      courseId: course1Id,
      batchId: batch1Id,
    });
    student2ProfileId = s2.id;

    const s3 = await studentsService.createStudent(instituteIdA, {
      fullName: `Applicant Micah ${suffix}`,
      phoneNumber: `+917913${suffix.slice(0, 6)}`,
      email: `micah.${suffix}@bible-lms.test`,
      status: 'APPLIED',
      statement: `Formula=InjectionTest`,
    });
    student3ProfileId = s3.id;

    // 8. Schedule 2 Upcoming Live Sessions via BatchesService (2.0h + 1.5h = 3.5h)
    const s1Start = new Date(now.getTime() + 2 * 3600 * 1000);
    const s1End = new Date(now.getTime() + 4 * 3600 * 1000);
    await batchesService.createSchedule(instituteIdA, {
      batchId: batch1Id,
      teacherProfileId: teacher1ProfileId,
      title: `Hermeneutics Lecture 1 ${suffix}`,
      room: `Hall-A-${suffix}`,
      startsAt: s1Start.toISOString(),
      endsAt: s1End.toISOString(),
    });

    const s2Start = new Date(now.getTime() + 26 * 3600 * 1000);
    const s2End = new Date(now.getTime() + 27.5 * 3600 * 1000);
    await batchesService.createSchedule(instituteIdA, {
      batchId: batch1Id,
      teacherProfileId: teacher1ProfileId,
      title: `Hermeneutics Seminar 2 ${suffix}`,
      room: `Hall-B-${suffix}`,
      startsAt: s2Start.toISOString(),
      endsAt: s2End.toISOString(),
    });

    // 9. Mark Attendance via AttendanceService
    // Day 1 (yesterday): 1 PRESENT + 1 ABSENT = 50% (< 75% threshold -> triggers LOW_ATTENDANCE_ALERT!)
    const day1 = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
    await attendanceService.markBulkAttendance(
      instituteIdA,
      {
        batchId: batch1Id,
        date: day1,
        mode: 'DAILY_BATCH',
        records: [
          { studentProfileId: student1ProfileId, status: 'PRESENT' },
          { studentProfileId: student2ProfileId, status: 'ABSENT', remarks: 'Unexcused' },
        ],
      },
      { sub: adminA1Id, role: 'INSTITUTE_ADMIN' },
    );

    // Day 2 (2 days ago): 1 LATE + 1 EXCUSED = 100% on Day 2; combined Day 1 + Day 2:
    // Present=1, Late=1, Absent=1, Excused=1, Total=4 -> round((1+1)/(4-1)*100) = 67%
    const day2 = new Date(now.getTime() - 2 * 86400000).toISOString().slice(0, 10);
    await attendanceService.markBulkAttendance(
      instituteIdA,
      {
        batchId: batch1Id,
        date: day2,
        mode: 'DAILY_BATCH',
        records: [
          { studentProfileId: student1ProfileId, status: 'LATE' },
          { studentProfileId: student2ProfileId, status: 'EXCUSED', remarks: 'Medical leave' },
        ],
      },
      { sub: adminA1Id, role: 'INSTITUTE_ADMIN' },
    );

    // 10. Seed Financial Invoices & Payments in Institute A (respecting Milestone 2.5 triggers)
    invoice1Number = `INV-2026-A1-${suffix}`;
    const tomorrow = new Date(now.getTime() + 86400000);
    const fiveDaysAgo = new Date(now.getTime() - 5 * 86400000);
    const twentyDaysAgo = new Date(now.getTime() - 20 * 86400000);

    await prisma.$transaction(async (tx) => {
      // Invoice 1: PAID (500,000 paise = ₹5,000)
      const inv1 = await tx.invoice.create({
        data: {
          instituteId: instituteIdA,
          studentProfileId: student1ProfileId,
          invoiceNumber: invoice1Number,
          status: InvoiceStatus.DRAFT,
          issueDate: now,
          dueDate: tomorrow,
          totalAmount: 500000,
          paidAmount: 0,
          balanceAmount: 500000,
        },
      });
      await tx.invoiceItem.create({
        data: {
          instituteId: instituteIdA,
          invoiceId: inv1.id,
          description: 'Semester Tuition Fee',
          amount: 500000,
        },
      });
      await tx.invoice.update({
        where: { id: inv1.id },
        data: {
          status: InvoiceStatus.PAID,
          paidAmount: 500000,
          balanceAmount: 0,
        },
      });
      const pay1 = await tx.feePayment.create({
        data: {
          instituteId: instituteIdA,
          invoiceId: inv1.id,
          paymentNumber: `PAY-2026-A1-${suffix}`,
          amount: 500000,
          reversedAmount: 0,
          netAmount: 500000,
          paymentMode: FeePaymentMode.ONLINE,
          paymentDate: new Date(),
          status: FeePaymentStatus.COMPLETED,
          referenceNumber: `UTR-${suffix}-1`,
          recordedByUserId: financeAId,
        },
      });
      await tx.feeReceipt.create({
        data: {
          instituteId: instituteIdA,
          paymentId: pay1.id,
          receiptNumber: `RCP-2026-A1-${suffix}`,
          issuedByUserId: financeAId,
        },
      });

      // Invoice 2: PARTIALLY_PAID (400,000 total; 200,000 gross payment - 50,000 reversed = 150,000 net paid; 250,000 balance)
      const inv2 = await tx.invoice.create({
        data: {
          instituteId: instituteIdA,
          studentProfileId: student2ProfileId,
          invoiceNumber: `INV-2026-A2-${suffix}`,
          status: InvoiceStatus.DRAFT,
          issueDate: now,
          dueDate: tomorrow,
          totalAmount: 400000,
          paidAmount: 0,
          balanceAmount: 400000,
        },
      });
      await tx.invoiceItem.create({
        data: {
          instituteId: instituteIdA,
          invoiceId: inv2.id,
          description: 'Hermeneutics Tuition & Library Fee',
          amount: 400000,
        },
      });
      await tx.invoice.update({
        where: { id: inv2.id },
        data: {
          status: InvoiceStatus.PARTIALLY_PAID,
          paidAmount: 150000,
          balanceAmount: 250000,
        },
      });
      const pay2 = await tx.feePayment.create({
        data: {
          instituteId: instituteIdA,
          invoiceId: inv2.id,
          paymentNumber: `PAY-2026-A2-${suffix}`,
          amount: 200000,
          reversedAmount: 50000,
          netAmount: 150000,
          paymentMode: FeePaymentMode.BANK_TRANSFER,
          paymentDate: new Date(),
          status: FeePaymentStatus.PARTIALLY_REVERSED,
          referenceNumber: `NEFT-${suffix}-2`,
          recordedByUserId: financeAId,
        },
      });
      await tx.paymentReversalAudit.create({
        data: {
          instituteId: instituteIdA,
          paymentId: pay2.id,
          reversedByUserId: financeAId,
          reason: 'Fee concession adjustment',
          reversedAmount: 50000,
        },
      });

      // Invoice 3: OVERDUE (300,000 total; 0 paid; 300,000 balance)
      const inv3 = await tx.invoice.create({
        data: {
          instituteId: instituteIdA,
          studentProfileId: student2ProfileId,
          invoiceNumber: `INV-2026-A3-${suffix}`,
          status: InvoiceStatus.DRAFT,
          issueDate: twentyDaysAgo,
          dueDate: fiveDaysAgo,
          totalAmount: 300000,
          paidAmount: 0,
          balanceAmount: 300000,
        },
      });
      await tx.invoiceItem.create({
        data: {
          instituteId: instituteIdA,
          invoiceId: inv3.id,
          description: 'Hostel & Materials Fee',
          amount: 300000,
        },
      });
      await tx.invoice.update({
        where: { id: inv3.id },
        data: {
          status: InvoiceStatus.OVERDUE,
        },
      });

      // Invoice 4: DRAFT (must be excluded from active invoiced & pending totals)
      await tx.invoice.create({
        data: {
          instituteId: instituteIdA,
          studentProfileId: student1ProfileId,
          invoiceNumber: `INV-2026-DRAFT-${suffix}`,
          status: InvoiceStatus.DRAFT,
          dueDate: tomorrow,
          totalAmount: 999900,
          paidAmount: 0,
          balanceAmount: 999900,
        },
      });

      // Invoice 5: CANCELLED (must be excluded from active invoiced & pending totals)
      const inv5 = await tx.invoice.create({
        data: {
          instituteId: instituteIdA,
          studentProfileId: student1ProfileId,
          invoiceNumber: `INV-2026-CANCEL-${suffix}`,
          status: InvoiceStatus.DRAFT,
          dueDate: tomorrow,
          totalAmount: 888800,
          paidAmount: 0,
          balanceAmount: 888800,
        },
      });
      await tx.invoice.update({
        where: { id: inv5.id },
        data: {
          status: InvoiceStatus.CANCELLED,
          cancelledAt: now,
          cancelledReason: 'Duplicate draft voided',
        },
      });
    });

    // Emit real fee notification for Payment 1
    await notificationsService.emitFeeEvent(instituteIdA, {
      eventType: 'FEE_PAYMENT_RECEIVED',
      referenceId: `PAY-2026-A1-${suffix}`,
      studentName: `Esther Naomi ${suffix}`,
      invoiceNumber: invoice1Number,
      amountPaise: 500000,
      paymentNumber: `PAY-2026-A1-${suffix}`,
    });

    // 11. Seed Cross-Tenant Invoice & Payment in Institute B (to prove zero cross-tenant leakage)
    const studentB = await studentsService.createStudent(instituteIdB, {
      fullName: `TenantB Student ${suffix}`,
      phoneNumber: `+917999${suffix.slice(0, 6)}`,
      status: 'ACTIVE',
    });

    await prisma.$transaction(async (tx) => {
      const invB = await tx.invoice.create({
        data: {
          instituteId: instituteIdB,
          studentProfileId: studentB.id,
          invoiceNumber: `INV-B-${suffix}`,
          status: InvoiceStatus.DRAFT,
          issueDate: now,
          dueDate: tomorrow,
          totalAmount: 777700,
          paidAmount: 0,
          balanceAmount: 777700,
        },
      });
      await tx.invoiceItem.create({
        data: {
          instituteId: instituteIdB,
          invoiceId: invB.id,
          description: 'Tenant B Fee',
          amount: 777700,
        },
      });
      await tx.invoice.update({
        where: { id: invB.id },
        data: {
          status: InvoiceStatus.PAID,
          paidAmount: 777700,
          balanceAmount: 0,
        },
      });
      await tx.feePayment.create({
        data: {
          instituteId: instituteIdB,
          invoiceId: invB.id,
          paymentNumber: `PAY-B-${suffix}`,
          amount: 777700,
          reversedAmount: 0,
          netAmount: 777700,
          paymentMode: FeePaymentMode.ONLINE,
          paymentDate: new Date(),
          status: FeePaymentStatus.COMPLETED,
          recordedByUserId: adminBId,
        },
      });
    });
  });

  afterAll(async () => {
    if (prisma) {
      await (prisma as any).$disconnect();
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. DASHBOARD KPI ACCURACY & VERIFIED CONTEXT RESOLUTION
  // ───────────────────────────────────────────────────────────────────────────

  it('1. resolves verified admin context from PostgreSQL Membership and computes all 8 KPI cards accurately', async () => {
    const adminUser = {
      userId: adminA1Id,
      role: Role.INSTITUTE_ADMIN,
      instituteId: instituteIdA,
    };

    const ctx = await dashboardService.resolveAdminContext(adminUser);
    expect(ctx.instituteId).toBe(instituteIdA);
    expect(ctx.user.role).toBe(Role.INSTITUTE_ADMIN);
    expect(ctx.instituteName).toContain('Grace Dashboard Institute A');

    const viewer = await dashboardService.verifyDashboardAccess(
      adminUser,
      instituteIdA,
    );
    const overview = await dashboardService.getOverview(
      instituteIdA,
      { preset: '30D' },
      viewer,
    );

    // Verify all 8 KPIs match exact seeded rows in Institute A (zero leakage from Institute B)
    expect(overview.kpi.totalStudents).toBe(3);
    expect(overview.kpi.activeStudents).toBe(2);
    expect(overview.kpi.pendingAdmissionsCount).toBe(1);
    expect(overview.kpi.totalTeachers).toBe(2);
    expect(overview.kpi.activeTeachers).toBe(1);
    expect(overview.kpi.onLeaveTeachers).toBe(1);
    expect(overview.kpi.totalCourses).toBe(2);
    expect(overview.kpi.publishedCourses).toBe(1);
    expect(overview.kpi.draftCourses).toBe(1);
    expect(overview.kpi.activeBatches).toBe(1);
    expect(overview.kpi.totalBatches).toBe(2);
    expect(overview.kpi.totalFeeCollected).toBe(650000); // 500,000 + 150,000 net paise
    expect(overview.kpi.totalFeePending).toBe(550000); // 250,000 + 300,000 paise
    expect(overview.kpi.upcomingSessionsCount).toBe(2);

    // Honest period comparison check: previous 30D window had 0 students -> changePct MUST be null (never fabricated)
    expect(overview.kpi.comparisons.studentsRegistered.periodValue).toBe(3);
    expect(overview.kpi.comparisons.studentsRegistered.previousPeriodValue).toBe(0);
    expect(overview.kpi.comparisons.studentsRegistered.changePct).toBeNull();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. STUDENT ENROLLMENT ANALYTICS
  // ───────────────────────────────────────────────────────────────────────────

  it('2. aggregates student enrollment trends, course distribution, and batch capacity utilization accurately', async () => {
    const overview = await dashboardService.getOverview(instituteIdA, {
      preset: '30D',
    });

    // Monthly enrolment trend sums to 3 student registrations and 2 course enrolments
    const totalTrendRegistrations = overview.enrolmentTrend.reduce(
      (sum, item) => sum + item.registrations,
      0,
    );
    const totalTrendEnrolments = overview.enrolmentTrend.reduce(
      (sum, item) => sum + item.count,
      0,
    );
    expect(totalTrendRegistrations).toBe(3);
    expect(totalTrendEnrolments).toBe(2);

    // Course distribution
    const c1Dist = overview.courseDistribution.find(
      (c) => c.courseId === course1Id,
    );
    expect(c1Dist).toBeDefined();
    expect(c1Dist?.activeEnrolments).toBe(2);
    expect(c1Dist?.studentCount).toBe(2);

    // Batch distribution & utilization (2 active students in capacity 20 = 10%)
    const b1Dist = overview.batchDistribution.find((b) => b.batchId === batch1Id);
    expect(b1Dist).toBeDefined();
    expect(b1Dist?.enrolledCount).toBe(2);
    expect(b1Dist?.capacity).toBe(20);
    expect(b1Dist?.utilizationPct).toBe(10);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3 & 4. FINANCIAL AGGREGATION & PENDING FEE CALCULATIONS
  // ───────────────────────────────────────────────────────────────────────────

  it('3. computes integer-paise financial analytics, net reversals, pending/overdue balances, and excludes DRAFT/CANCELLED invoices', async () => {
    const overview = await dashboardService.getOverview(instituteIdA, {
      preset: '30D',
    });
    const fin = overview.financialAnalytics;

    // Net collected = 500,000 (ONLINE COMPLETED) + 150,000 (BANK_TRANSFER PARTIALLY_REVERSED net) = 650,000 paise
    expect(fin.totalCollectedPaise).toBe(650000);
    expect(fin.collectedInPeriodPaise).toBe(650000);
    expect(fin.paymentSummary.successfulPaymentsCount).toBe(2);

    // Total invoiced excludes DRAFT (999,900) and CANCELLED (888,800): 500,000 + 400,000 + 300,000 = 1,200,000
    expect(fin.invoiceTotals.totalInvoicedPaise).toBe(1200000);
    expect(fin.invoiceTotals.draftCount).toBe(1);
    expect(fin.invoiceTotals.cancelledCount).toBe(1);

    // Pending balance = 250,000 (PARTIALLY_PAID) + 300,000 (OVERDUE) = 550,000 paise
    expect(fin.pendingAmountPaise).toBe(550000);
    expect(fin.invoiceTotals.partiallyPaidCount + fin.invoiceTotals.overdueCount).toBe(2);

    // Overdue subset = 300,000 paise across 1 invoice
    expect(fin.overdueAmountPaise).toBe(300000);
    expect(fin.invoiceTotals.overdueCount).toBe(1);

    // Accounting identity holds across dashboard summary
    expect(fin.totalCollectedPaise + fin.pendingAmountPaise).toBe(
      fin.invoiceTotals.totalInvoicedPaise,
    );

    // Payment status breakdown verifies exact invoice status buckets
    const paidBucket = fin.paymentStatusBreakdown.find(
      (b) => b.status === 'PAID',
    );
    const partialBucket = fin.paymentStatusBreakdown.find(
      (b) => b.status === 'PARTIALLY_PAID',
    );
    const overdueBucket = fin.paymentStatusBreakdown.find(
      (b) => b.status === 'OVERDUE',
    );
    expect(paidBucket?.count).toBe(1);
    expect(paidBucket?.amountPaise).toBe(500000);
    expect(partialBucket?.count).toBe(1);
    expect(partialBucket?.amountPaise).toBe(250000);
    expect(overdueBucket?.count).toBe(1);
    expect(overdueBucket?.amountPaise).toBe(300000);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. ATTENDANCE ANALYTICS & ZERO-SESSION HANDLING
  // ───────────────────────────────────────────────────────────────────────────

  it('4. preserves Milestone 2.4 attendance formula ((Present + Late) / (Total - Excused)) and handles zero applicable sessions safely', async () => {
    const overview = await dashboardService.getOverview(instituteIdA, {
      preset: '30D',
    });
    const att = overview.attendanceAnalytics;

    // Seeded: 1 PRESENT, 1 LATE, 1 ABSENT, 1 EXCUSED (Total 4, Applicable 3 -> round(2/3 * 100) = 67%)
    expect(att.presentCount).toBe(1);
    expect(att.lateCount).toBe(1);
    expect(att.absentCount).toBe(1);
    expect(att.excusedCount).toBe(1);
    expect(att.totalRecords).toBe(4);
    expect(att.overallPercentage).toBe(67);
    expect(overview.kpi.attendancePercentage).toBe(67);

    // Batch-wise & Course-wise breakdown match the exact 67% formula
    const batchPerf = att.byBatch.find((b) => b.batchId === batch1Id);
    expect(batchPerf?.attendancePercentage).toBe(67);
    const coursePerf = att.byCourse.find(
      (c) => c.courseId === course1Id,
    );
    expect(coursePerf?.attendancePercentage).toBe(67);

    // Zero applicable sessions check on Empty Institute C -> returns null (never NaN or fake 85%)
    const emptyOverview = await dashboardService.getOverview(instituteIdEmpty, {
      preset: '30D',
    });
    expect(emptyOverview.attendanceAnalytics.totalRecords).toBe(0);
    expect(emptyOverview.attendanceAnalytics.overallPercentage).toBeNull();
    expect(emptyOverview.kpi.attendancePercentage).toBeNull();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. TEACHER WORKLOAD, RECENT ACTIVITIES & UPCOMING SCHEDULE
  // ───────────────────────────────────────────────────────────────────────────

  it('5. reports teacher workload, scheduled hours, upcoming live sessions, and recent activities accurately', async () => {
    const overview = await dashboardService.getOverview(instituteIdA, {
      preset: '30D',
    });
    const ta = overview.teacherAcademicAnalytics;

    expect(ta.summary.totalTeachers).toBe(2);
    expect(ta.summary.activeTeachers).toBe(1);
    expect(ta.summary.onLeaveTeachers).toBe(1);
    expect(ta.summary.totalCourseAssignments).toBe(1);
    expect(ta.summary.totalBatchAssignments).toBe(1);
    expect(ta.summary.upcomingScheduledSessions).toBe(2);

    const t1Workload = ta.teacherWorkload.find(
      (w) => w.teacherId === teacher1ProfileId,
    );
    expect(t1Workload).toBeDefined();
    expect(t1Workload?.assignedCoursesCount).toBe(1);
    expect(t1Workload?.assignedBatchesCount).toBe(1);
    expect(t1Workload?.upcomingSessionsCount).toBe(2);
    expect(t1Workload?.scheduledHoursInPeriod).toBe(3.5); // 2.0h + 1.5h

    // Upcoming schedule includes both future sessions in chronological order
    expect(overview.upcomingSessions.length).toBe(2);
    expect(overview.upcomingSessions[0].title).toContain(
      'Hermeneutics Lecture 1',
    );
    expect(overview.upcomingSessions[0].teacherName).toContain('Dr. Paul Titus');

    // Unified recent activities stream includes real student, teacher, course, batch, and fee events
    const activityCategories = new Set(
      overview.recentActivities.map((a) => a.category),
    );
    expect(activityCategories.has('STUDENT')).toBe(true);
    expect(activityCategories.has('TEACHER')).toBe(true);
    expect(activityCategories.has('COURSE')).toBe(true);
    expect(activityCategories.has('BATCH')).toBe(true);
    expect(activityCategories.has('FEE')).toBe(true);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 7. GLOBAL DATE FILTERS
  // ───────────────────────────────────────────────────────────────────────────

  it('6. supports TODAY, 7D, 30D, THIS_MONTH, PREV_MONTH, THIS_TERM, THIS_YEAR, and CUSTOM date filters with validation', async () => {
    // THIS_TERM resolves against seeded AcademicTerm.isCurrent
    const termOverview = await dashboardService.getOverview(instituteIdA, {
      preset: 'THIS_TERM',
    });
    expect(termOverview.dateFilter.preset).toBe('THIS_TERM');
    expect(termOverview.dateFilter.label).toContain('Fall Term');
    expect(termOverview.financialAnalytics.collectedInPeriodPaise).toBe(650000);

    // THIS_YEAR resolves against seeded AcademicYear.isCurrent
    const yearOverview = await dashboardService.getOverview(instituteIdA, {
      preset: 'THIS_YEAR',
    });
    expect(yearOverview.dateFilter.preset).toBe('THIS_YEAR');
    expect(yearOverview.dateFilter.label).toContain('AY 2026-27');

    // PREV_MONTH has 0 period payments while preserving standing institute totals
    const prevMonthOverview = await dashboardService.getOverview(instituteIdA, {
      preset: 'PREV_MONTH',
    });
    expect(prevMonthOverview.financialAnalytics.collectedInPeriodPaise).toBe(0);
    expect(prevMonthOverview.kpi.totalFeeCollected).toBe(650000); // Standing total clearly preserved

    // CUSTOM historical range before seeding returns 0 period registrations
    const customPast = await dashboardService.getOverview(instituteIdA, {
      preset: 'CUSTOM',
      from: '2025-01-01',
      to: '2025-01-31',
    });
    expect(customPast.kpi.comparisons.studentsRegistered.periodValue).toBe(0);

    // Invalid CUSTOM date range (from > to) throws BadRequestException
    await expect(
      dashboardService.getOverview(instituteIdA, {
        preset: 'CUSTOM',
        from: '2026-06-15',
        to: '2026-06-01',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 8. PAGINATED TRANSACTION LISTING & FILTERING
  // ───────────────────────────────────────────────────────────────────────────

  it('7. lists financial transactions with pagination, search, payment mode, and status filters', async () => {
    // Page 1 with limit 1
    const page1 = await dashboardService.getTransactions(instituteIdA, {
      page: 1,
      limit: 1,
      preset: '30D',
    });
    expect(page1.data.length).toBe(1);
    expect(page1.meta.total).toBe(2);
    expect(page1.meta.totalPages).toBe(2);
    expect(page1.meta.hasNextPage).toBe(true);

    // Search by invoice number
    const searchRes = await dashboardService.getTransactions(instituteIdA, {
      search: invoice1Number,
      preset: 'ALL',
    });
    expect(searchRes.data.length).toBe(1);
    expect(searchRes.data[0].invoiceNumber).toBe(invoice1Number);
    expect(searchRes.data[0].amount).toBe(500000);
    expect(searchRes.data[0].receiptNumber).toBe(`RCP-2026-A1-${suffix}`);

    // Filter by status PARTIALLY_REVERSED and mode BANK_TRANSFER
    const partialRes = await dashboardService.getTransactions(instituteIdA, {
      status: 'PARTIALLY_REVERSED',
      paymentMode: 'BANK_TRANSFER',
      preset: 'ALL',
    });
    expect(partialRes.data.length).toBe(1);
    expect(partialRes.data[0].amount).toBe(200000); // Gross amount in paise
    expect(partialRes.data[0].reversedAmount).toBe(50000);
    expect(partialRes.data[0].netAmount).toBe(150000); // Net amount in paise
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 9. REPORT EXPORTS (ALL 6 CSV REPORTS)
  // ───────────────────────────────────────────────────────────────────────────

  it('8. exports all 6 dashboard CSV reports with institute scope, date range metadata, and zero cross-tenant data', async () => {
    const reportTypes: ExportReportType[] = [
      'enrollments',
      'fee-collection',
      'pending-fees',
      'attendance',
      'teacher-workload',
      'transactions',
    ];

    for (const type of reportTypes) {
      const exported = await dashboardService.exportReport(instituteIdA, type, {
        preset: '30D',
      });
      expect(exported.mimeType).toBe('text/csv;charset=utf-8');
      expect(exported.filename).toContain(type);
      expect(exported.csvContent).toContain('Grace Dashboard Institute A');
      expect(exported.csvContent).toContain('Generated At');
      expect(exported.rowCount).toBeGreaterThan(0);

      // Must NEVER contain CrossTenant Institute B records
      expect(exported.csvContent).not.toContain(`INV-B-${suffix}`);
      expect(exported.csvContent).not.toContain(`TenantB Student`);
    }

    // Specific verification on pending-fees report: includes PARTIALLY_PAID & OVERDUE, excludes DRAFT & CANCELLED
    const pendingCsv = await dashboardService.exportReport(
      instituteIdA,
      'pending-fees',
      { preset: 'ALL' },
    );
    expect(pendingCsv.rowCount).toBe(2);
    expect(pendingCsv.csvContent).toContain(`INV-2026-A2-${suffix}`);
    expect(pendingCsv.csvContent).toContain(`INV-2026-A3-${suffix}`);
    expect(pendingCsv.csvContent).not.toContain(`INV-2026-DRAFT-${suffix}`);
    expect(pendingCsv.csvContent).not.toContain(`INV-2026-CANCEL-${suffix}`);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 10. NOTIFICATION CREATION FROM REAL EVENTS & DUPLICATE PREVENTION
  // ───────────────────────────────────────────────────────────────────────────

  it('9. creates notifications across all 6 categories from real domain service events and prevents duplicates', async () => {
    // Trigger ADMIN category notification via SettingsService.updateProfile
    await settingsService.updateProfile(
      instituteIdA,
      {
        name: `Grace Dashboard Institute A ${suffix}`,
        displayName: `Grace Seminary ${suffix}`,
      },
      adminA1Id,
    );

    const adminNotifs = await notificationsService.getNotifications(
      instituteIdA,
      adminA1Id,
      { page: 1, limit: 50 },
    );

    const categoriesPresent = new Set(adminNotifs.data.map((n) => n.category));
    expect(categoriesPresent.has('STUDENT')).toBe(true);
    expect(categoriesPresent.has('TEACHER')).toBe(true);
    expect(categoriesPresent.has('ATTENDANCE')).toBe(true);
    expect(categoriesPresent.has('FEE')).toBe(true);
    expect(categoriesPresent.has('ACADEMIC')).toBe(true);
    expect(categoriesPresent.has('ADMIN')).toBe(true);

    // Verify clean link stripping (no internal #cat= fragment leaked to UI link)
    for (const item of adminNotifs.data) {
      expect(item.link.includes('#cat=')).toBe(false);
    }

    // Verify LOW_ATTENDANCE_ALERT was automatically generated by AttendanceService.markBulkAttendance
    const lowAttAlert = adminNotifs.data.find(
      (n) => n.eventType === 'LOW_ATTENDANCE_ALERT',
    );
    expect(lowAttAlert).toBeDefined();
    expect(lowAttAlert?.body).toContain('50%');

    // Duplicate prevention: re-emitting the exact same FEE_PAYMENT_RECEIVED referenceId creates 0 duplicates
    const dupResult = await notificationsService.emitFeeEvent(instituteIdA, {
      eventType: 'FEE_PAYMENT_RECEIVED',
      referenceId: `PAY-2026-A1-${suffix}`,
      studentName: `Esther Naomi ${suffix}`,
      invoiceNumber: invoice1Number,
      amountPaise: 500000,
    });
    expect(dupResult.createdCount).toBe(0);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 11, 12 & 13. RECIPIENT ISOLATION, READ/UNREAD MUTATIONS & UNREAD COUNTS
  // ───────────────────────────────────────────────────────────────────────────

  it('10. enforces recipient isolation and accurate unread counts across markAsRead and markAllAsRead', async () => {
    // Finance Officer only receives FEE notifications (not TEACHER/ATTENDANCE/ADMIN)
    const financeNotifs = await notificationsService.getNotifications(
      instituteIdA,
      financeAId,
      { page: 1, limit: 50 },
    );
    expect(financeNotifs.data.length).toBeGreaterThan(0);
    expect(financeNotifs.data.every((n) => n.category === 'FEE')).toBe(true);

    // Admin A1 vs Admin A2 independent read state
    const beforeA1 = await notificationsService.getUnreadCount(
      instituteIdA,
      adminA1Id,
    );
    const beforeA2 = await notificationsService.getUnreadCount(
      instituteIdA,
      adminA2Id,
    );
    expect(beforeA1.unreadCount).toBeGreaterThanOrEqual(6);
    expect(beforeA2.unreadCount).toBe(beforeA1.unreadCount);

    // Sum of byCategory equals total unreadCount
    const sumByCategory = Object.values(beforeA1.byCategory).reduce(
      (a, b) => a + b,
      0,
    );
    expect(sumByCategory).toBe(beforeA1.unreadCount);

    // Mark 1 notification as read for Admin A1
    const listA1 = await notificationsService.getNotifications(
      instituteIdA,
      adminA1Id,
      { status: 'UNREAD', limit: 5 },
    );
    const targetNotifId = listA1.data[0].id;

    // Admin A2 cannot mark Admin A1's notification ID as read
    await expect(
      notificationsService.markAsRead(instituteIdA, adminA2Id, targetNotifId),
    ).rejects.toThrow(NotFoundException);

    const marked = await notificationsService.markAsRead(
      instituteIdA,
      adminA1Id,
      targetNotifId,
    );
    expect(marked.isRead).toBe(true);
    expect(marked.readAt).not.toBeNull();

    const afterSingleA1 = await notificationsService.getUnreadCount(
      instituteIdA,
      adminA1Id,
    );
    const afterSingleA2 = await notificationsService.getUnreadCount(
      instituteIdA,
      adminA2Id,
    );
    expect(afterSingleA1.unreadCount).toBe(beforeA1.unreadCount - 1);
    expect(afterSingleA2.unreadCount).toBe(beforeA2.unreadCount); // Admin A2 untouched!

    // Mark all ACADEMIC notifications read for Admin A1
    const academicUnread = afterSingleA1.byCategory.ACADEMIC;
    if (academicUnread > 0) {
      const catMark = await notificationsService.markAllAsRead(
        instituteIdA,
        adminA1Id,
        'ACADEMIC',
      );
      expect(catMark.updatedCount).toBe(academicUnread);
    }

    // Mark all remaining notifications read for Admin A1
    const allMark = await notificationsService.markAllAsRead(
      instituteIdA,
      adminA1Id,
      'ALL',
    );
    expect(allMark.unreadCount).toBe(0);

    const finalUnreadA1 = await notificationsService.getUnreadCount(
      instituteIdA,
      adminA1Id,
    );
    expect(finalUnreadA1.unreadCount).toBe(0);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 14. NOTIFICATION PREFERENCES (SYNCED WITH MILESTONE 2.7 SETTINGS)
  // ───────────────────────────────────────────────────────────────────────────

  it('11. syncs notification preferences with Milestone 2.7 InstituteSettings and suppresses disabled categories', async () => {
    // Disable FEE notifications via NotificationsService.updatePreferences
    const updatedPrefs = await notificationsService.updatePreferences(
      instituteIdA,
      { notifyOnFeePayment: false },
      adminA1Id,
    );
    expect(updatedPrefs.notifyOnFeePayment).toBe(false);
    expect(updatedPrefs.notifyOnStudentRegistration).toBe(true);

    // Verify Milestone 2.7 SettingsService sees the exact updated toggle without losing sessionTimeoutMinutes
    const allSettings = await settingsService.getSettings(instituteIdA);
    expect(allSettings.security.notifyOnFeePayment).toBe(false);
    expect(allSettings.security.sessionTimeoutMinutes).toBe(60);

    // Emitting a FEE event while disabled is suppressed
    const suppressed = await notificationsService.emitFeeEvent(instituteIdA, {
      eventType: 'PENDING_FEE_ALERT',
      referenceId: `SUPPRESSED-FEE-${suffix}`,
      studentName: `Daniel Caleb ${suffix}`,
      invoiceNumber: `INV-2026-A3-${suffix}`,
      amountPaise: 300000,
    });
    expect(suppressed.suppressedByPreferences).toBe(true);
    expect(suppressed.createdCount).toBe(0);

    // Re-enable via Milestone 2.7 SettingsService.updateSecurityPreferences
    await settingsService.updateSecurityPreferences(
      instituteIdA,
      {
        sessionTimeoutMinutes: 90,
        studentSelfRegistration: false,
        notifyOnStudentRegistration: true,
        notifyOnFeePayment: true,
        notifyOnAttendanceAlert: true,
        notifyOnTeacherManagement: true,
        notifyOnAcademicActivity: true,
        notifyOnAdminSecurity: true,
      },
      adminA1Id,
    );

    const reEnabledPrefs = await notificationsService.getPreferences(
      instituteIdA,
    );
    expect(reEnabledPrefs.notifyOnFeePayment).toBe(true);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 15. ROLE-BASED PERMISSIONS
  // ───────────────────────────────────────────────────────────────────────────

  it('12. enforces strict role-based permissions across dashboard, exports, and notifications', async () => {
    const studentCaller = {
      userId: studentUserAId,
      role: Role.STUDENT,
      instituteId: instituteIdA,
    };
    const teacherCaller = {
      userId: teacherUserAId,
      role: Role.TEACHER,
      instituteId: instituteIdA,
    };
    const financeCaller = {
      userId: financeAId,
      role: Role.FINANCE_OFFICER,
      instituteId: instituteIdA,
    };
    const coordinatorCaller = {
      userId: coordinatorAId,
      role: Role.ACADEMIC_COORDINATOR,
      instituteId: instituteIdA,
    };

    // STUDENT & TEACHER blocked from Admin Dashboard & Admin Notification Center
    await expect(
      dashboardService.verifyDashboardAccess(studentCaller, instituteIdA),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      dashboardService.verifyDashboardAccess(teacherCaller, instituteIdA),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      notificationsService.verifyAdminAccess(studentCaller, instituteIdA),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      notificationsService.verifyAdminAccess(teacherCaller, instituteIdA),
    ).rejects.toThrow(ForbiddenException);

    // FINANCE_OFFICER allowed financial export ('fee-collection') but blocked from 'teacher-workload'
    const feeExportRoles =
      dashboardService.getAllowedRolesForExport('fee-collection');
    await expect(
      dashboardService.verifyDashboardAccess(
        financeCaller,
        instituteIdA,
        feeExportRoles,
      ),
    ).resolves.toBeDefined();

    const workloadExportRoles =
      dashboardService.getAllowedRolesForExport('teacher-workload');
    await expect(
      dashboardService.verifyDashboardAccess(
        financeCaller,
        instituteIdA,
        workloadExportRoles,
      ),
    ).rejects.toThrow(ForbiddenException);

    // ACADEMIC_COORDINATOR allowed 'teacher-workload' & 'attendance' but blocked from 'fee-collection'
    await expect(
      dashboardService.verifyDashboardAccess(
        coordinatorCaller,
        instituteIdA,
        workloadExportRoles,
      ),
    ).resolves.toBeDefined();
    await expect(
      dashboardService.verifyDashboardAccess(
        coordinatorCaller,
        instituteIdA,
        feeExportRoles,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 16. CROSS-TENANT ACCESS PREVENTION
  // ───────────────────────────────────────────────────────────────────────────

  it('13. blocks cross-institute dashboard, export, and notification access attempts even if instituteId parameter is tampered', async () => {
    // Admin A1 attempting to access Institute B (both with A1 token and spoofed instituteId in payload)
    const adminA1Normal = {
      userId: adminA1Id,
      role: Role.INSTITUTE_ADMIN,
      instituteId: instituteIdA,
    };
    const adminA1SpoofedPayload = {
      userId: adminA1Id,
      role: Role.INSTITUTE_ADMIN,
      instituteId: instituteIdB, // Spoofed claim without real DB Membership in Institute B!
    };

    await expect(
      dashboardService.verifyDashboardAccess(adminA1Normal, instituteIdB),
    ).rejects.toThrow(ForbiddenException);

    await expect(
      dashboardService.verifyDashboardAccess(
        adminA1SpoofedPayload,
        instituteIdB,
      ),
    ).rejects.toThrow(ForbiddenException);

    await expect(
      notificationsService.verifyAdminAccess(adminA1Normal, instituteIdB),
    ).rejects.toThrow(ForbiddenException);

    await expect(
      notificationsService.verifyAdminAccess(
        adminA1SpoofedPayload,
        instituteIdB,
      ),
    ).rejects.toThrow(ForbiddenException);

    // Admin B attempting to read Institute A notifications
    const adminBCaller = {
      userId: adminBId,
      role: Role.INSTITUTE_ADMIN,
      instituteId: instituteIdB,
    };
    await expect(
      notificationsService.verifyAdminAccess(adminBCaller, instituteIdA),
    ).rejects.toThrow(ForbiddenException);
  });
});
