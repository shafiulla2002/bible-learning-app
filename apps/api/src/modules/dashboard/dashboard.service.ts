import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';

export interface DashboardKpiDto {
  totalStudents: number;
  activeStudents: number;
  totalTeachers: number;
  activeTeachers: number;
  totalCourses: number;
  publishedCourses: number;
  activeBatches: number;
  totalFeeCollected: number;  // in paise
  totalFeePending: number;    // in paise
  upcomingSessionsCount: number;
  attendancePercentage: number | null;
}

export interface EnrolmentTrendItem {
  month: string;      // "2026-10"
  label: string;      // "Oct 2026"
  count: number;
}

export interface FinancialTrendItem {
  month: string;
  label: string;
  collected: number;  // in paise
  pending: number;    // in paise
}

export interface CourseDistributionItem {
  courseTitle: string;
  studentCount: number;
}

export interface RecentAdmissionDto {
  id: string;
  admissionNo: string;
  fullName: string;
  email?: string | null;
  courseName?: string;
  batchName?: string;
  status: string;
  createdAt: string;
}

export interface UpcomingSessionDto {
  id: string;
  title: string;
  batchName: string;
  courseTitle: string;
  teacherName: string;
  startsAt: string;
  endsAt: string;
  status: string;
  room?: string | null;
}

export interface RecentPaymentDto {
  id: string;
  invoiceNumber: string;
  studentName: string;
  courseName?: string;
  amount: number;        // in paise
  paymentMode: string;
  paymentDate: string;
  status: string;
  paymentNumber: string;
}

export interface DashboardOverviewDto {
  kpi: DashboardKpiDto;
  enrolmentTrend: EnrolmentTrendItem[];
  financialTrend: FinancialTrendItem[];
  courseDistribution: CourseDistributionItem[];
  recentAdmissions: RecentAdmissionDto[];
  upcomingSessions: UpcomingSessionDto[];
  recentPayments: RecentPaymentDto[];
}

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  /**
   * Returns all dashboard aggregations in a single efficient query pass.
   * All queries are scoped to the specific instituteId for tenant isolation.
   */
  async getOverview(
    instituteId: string,
    dateRange?: { from?: Date; to?: Date },
  ): Promise<DashboardOverviewDto> {
    const now = new Date();

    // Run all aggregation queries in parallel for efficiency
    const [
      totalStudents,
      activeStudents,
      totalTeachers,
      activeTeachers,
      courseStats,
      activeBatches,
      feeStats,
      attendanceSummary,
      upcomingSessionsCount,
      enrolmentTrend,
      financialTrend,
      courseDistribution,
      recentAdmissions,
      upcomingSessions,
      recentPayments,
    ] = await Promise.all([
      // 1. Total students (all time)
      this.prisma.studentProfile.count({
        where: { instituteId },
      }),

      // 2. Active students
      this.prisma.studentProfile.count({
        where: { instituteId, status: 'ACTIVE' },
      }),

      // 3. Total teachers
      this.prisma.teacherProfile.count({
        where: { instituteId },
      }),

      // 4. Active teachers
      this.prisma.teacherProfile.count({
        where: { instituteId, status: 'ACTIVE' },
      }),

      // 5. Course stats
      this.prisma.course.groupBy({
        by: ['status'],
        where: { instituteId, deletedAt: null },
        _count: { id: true },
      }),

      // 6. Active batches
      this.prisma.batch.count({
        where: { instituteId, status: 'ACTIVE' },
      }),

      // 7. Fee aggregation – collected vs pending
      this.prisma.invoice.aggregate({
        where: { instituteId },
        _sum: { paidAmount: true, balanceAmount: true },
      }),

      // 8. Attendance summary (institute-wide)
      this.prisma.attendance.groupBy({
        by: ['status'],
        where: { instituteId },
        _count: { id: true },
      }),

      // 9. Upcoming sessions count
      this.prisma.liveSession.count({
        where: {
          instituteId,
          startsAt: { gte: now },
          status: { in: ['SCHEDULED', 'LIVE'] },
        },
      }),

      // 10. Enrolment trend – last 6 months (raw query for grouping by month)
      this.prisma.$queryRaw<{ month: string; count: bigint }[]>`
        SELECT
          TO_CHAR(e."createdAt", 'YYYY-MM') AS month,
          COUNT(e.id)::bigint               AS count
        FROM "Enrolment" e
        WHERE e."instituteId" = ${instituteId}
          AND e."createdAt" >= NOW() - INTERVAL '6 months'
        GROUP BY month
        ORDER BY month ASC
      `,

      // 11. Financial trend – last 6 months
      this.prisma.$queryRaw<{ month: string; collected: bigint; pending: bigint }[]>`
        SELECT
          TO_CHAR(i."createdAt", 'YYYY-MM') AS month,
          COALESCE(SUM(i."paidAmount"), 0)::bigint     AS collected,
          COALESCE(SUM(i."balanceAmount"), 0)::bigint  AS pending
        FROM "Invoice" i
        WHERE i."instituteId" = ${instituteId}
          AND i."createdAt" >= NOW() - INTERVAL '6 months'
          AND i.status NOT IN ('DRAFT', 'CANCELLED')
        GROUP BY month
        ORDER BY month ASC
      `,

      // 12. Course distribution (top 8 courses by student enrolment)
      this.prisma.course.findMany({
        where: { instituteId, status: 'PUBLISHED', deletedAt: null },
        take: 8,
        orderBy: { enrolments: { _count: 'desc' } },
        select: {
          title: true,
          _count: { select: { enrolments: true } },
        },
      }),

      // 13. Recent student admissions (last 10)
      this.prisma.studentProfile.findMany({
        where: { instituteId },
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          admissionNo: true,
          status: true,
          createdAt: true,
          membership: {
            select: {
              user: { select: { fullName: true, email: true } },
            },
          },
          enrolments: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: {
              course: { select: { title: true } },
              batch: { select: { name: true } },
            },
          },
        },
      }),

      // 14. Upcoming sessions (next 5)
      this.prisma.liveSession.findMany({
        where: {
          instituteId,
          startsAt: { gte: now },
          status: { in: ['SCHEDULED', 'LIVE'] },
        },
        take: 5,
        orderBy: { startsAt: 'asc' },
        select: {
          id: true,
          title: true,
          startsAt: true,
          endsAt: true,
          status: true,
          room: true,
          batch: {
            select: {
              name: true,
              course: { select: { title: true } },
            },
          },
          teacherProfile: {
            select: {
              membership: {
                select: { user: { select: { fullName: true } } },
              },
            },
          },
        },
      }),

      // 15. Recent fee payments (last 8)
      this.prisma.feePayment.findMany({
        where: { instituteId, status: 'COMPLETED' },
        take: 8,
        orderBy: { paymentDate: 'desc' },
        select: {
          id: true,
          paymentNumber: true,
          amount: true,
          paymentMode: true,
          paymentDate: true,
          status: true,
          invoice: {
            select: {
              invoiceNumber: true,
              studentProfile: {
                select: {
                  membership: {
                    select: { user: { select: { fullName: true } } },
                  },
                  enrolments: {
                    take: 1,
                    orderBy: { createdAt: 'desc' },
                    select: { course: { select: { title: true } } },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    // ── Compute KPI values ─────────────────────────────────────────────────────
    const totalCourses = courseStats.reduce((s, g) => s + g._count.id, 0);
    const publishedCourses =
      courseStats.find((g) => g.status === 'PUBLISHED')?._count.id ?? 0;

    const totalFeeCollected = Number(feeStats._sum.paidAmount ?? 0);
    const totalFeePending = Number(feeStats._sum.balanceAmount ?? 0);

    // Attendance percentage
    let attPresent = 0;
    let attLate = 0;
    let attAbsent = 0;
    let attExcused = 0;
    for (const g of attendanceSummary) {
      if (g.status === 'PRESENT') attPresent = g._count.id;
      if (g.status === 'LATE') attLate = g._count.id;
      if (g.status === 'ABSENT') attAbsent = g._count.id;
      if (g.status === 'EXCUSED') attExcused = g._count.id;
    }
    const totalAtt = attPresent + attLate + attAbsent + attExcused;
    const effectiveTotal = totalAtt - attExcused;
    const attendancePercentage =
      effectiveTotal > 0
        ? Math.round(((attPresent + attLate) / effectiveTotal) * 100)
        : null;

    // ── Build enrolment trend ──────────────────────────────────────────────────
    const enrolmentTrendMapped = this.fillMissingMonths(6).map((m) => {
      const raw = enrolmentTrend.find((r) => r.month === m.key);
      return {
        month: m.key,
        label: m.label,
        count: raw ? Number(raw.count) : 0,
      };
    });

    // ── Build financial trend ─────────────────────────────────────────────────
    const financialTrendMapped = this.fillMissingMonths(6).map((m) => {
      const raw = financialTrend.find((r) => r.month === m.key);
      return {
        month: m.key,
        label: m.label,
        collected: raw ? Number(raw.collected) : 0,
        pending: raw ? Number(raw.pending) : 0,
      };
    });

    // ── Shape course distribution ─────────────────────────────────────────────
    const courseDistributionMapped = courseDistribution.map((c) => ({
      courseTitle:
        c.title.length > 22 ? c.title.substring(0, 22) + '…' : c.title,
      studentCount: c._count.enrolments,
    }));

    // ── Shape recent admissions ───────────────────────────────────────────────
    const recentAdmissionsMapped: RecentAdmissionDto[] = recentAdmissions.map((s) => ({
      id: s.id,
      admissionNo: s.admissionNo,
      fullName: s.membership.user.fullName,
      email: s.membership.user.email,
      courseName: s.enrolments[0]?.course?.title,
      batchName: s.enrolments[0]?.batch?.name,
      status: s.status,
      createdAt: s.createdAt.toISOString(),
    }));

    // ── Shape upcoming sessions ───────────────────────────────────────────────
    const upcomingSessionsMapped: UpcomingSessionDto[] = upcomingSessions.map((sess) => ({
      id: sess.id,
      title: sess.title,
      batchName: sess.batch?.name ?? '-',
      courseTitle: sess.batch?.course?.title ?? '-',
      teacherName: sess.teacherProfile?.membership?.user?.fullName ?? '-',
      startsAt: sess.startsAt.toISOString(),
      endsAt: sess.endsAt.toISOString(),
      status: sess.status,
      room: sess.room,
    }));

    // ── Shape recent payments ─────────────────────────────────────────────────
    const recentPaymentsMapped: RecentPaymentDto[] = recentPayments.map((p) => ({
      id: p.id,
      invoiceNumber: p.invoice.invoiceNumber,
      paymentNumber: p.paymentNumber,
      studentName: p.invoice.studentProfile.membership.user.fullName,
      courseName: p.invoice.studentProfile.enrolments[0]?.course?.title,
      amount: p.amount,
      paymentMode: p.paymentMode,
      paymentDate: p.paymentDate.toISOString(),
      status: p.status,
    }));

    return {
      kpi: {
        totalStudents,
        activeStudents,
        totalTeachers,
        activeTeachers,
        totalCourses,
        publishedCourses,
        activeBatches,
        totalFeeCollected,
        totalFeePending,
        upcomingSessionsCount,
        attendancePercentage,
      },
      enrolmentTrend: enrolmentTrendMapped,
      financialTrend: financialTrendMapped,
      courseDistribution: courseDistributionMapped,
      recentAdmissions: recentAdmissionsMapped,
      upcomingSessions: upcomingSessionsMapped,
      recentPayments: recentPaymentsMapped,
    };
  }

  /**
   * Generates an array of {key, label} for the last N months (inclusive of current).
   */
  private fillMissingMonths(months: number): { key: string; label: string }[] {
    const result: { key: string; label: string }[] = [];
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('default', { month: 'short', year: 'numeric' });
      result.push({ key, label });
    }
    return result;
  }
}

