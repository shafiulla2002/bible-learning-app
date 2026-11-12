import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import {
  Role,
  MembershipStatus,
  InvoiceStatus,
  FeePaymentStatus,
  FeePaymentMode,
} from '@prisma/client';
import {
  DateRangePreset,
  DashboardFilterQueryDto,
  DashboardTransactionsQueryDto,
  ExportReportType,
} from './dashboard.dto';

const ADMIN_DASHBOARD_ROLES: Role[] = [
  Role.SUPER_ADMIN,
  Role.INSTITUTE_ADMIN,
  Role.ACADEMIC_COORDINATOR,
  Role.FINANCE_OFFICER,
];

export interface KpiComparisonDto {
  periodValue: number;
  previousPeriodValue: number | null;
  changePct: number | null; // null when previousPeriodValue is 0 or unbounded
  direction: 'UP' | 'DOWN' | 'FLAT' | 'NONE';
  periodLabel: string;
}

export interface DashboardKpiDto {
  totalStudents: number;
  activeStudents: number;
  pendingAdmissionsCount: number;
  totalTeachers: number;
  activeTeachers: number;
  onLeaveTeachers: number;
  totalCourses: number;
  publishedCourses: number;
  draftCourses: number;
  activeBatches: number;
  totalBatches: number;
  totalFeeCollected: number; // standing net collected in paise
  totalFeePending: number; // standing pending balance in paise
  overdueFeeAmount: number; // standing overdue balance in paise
  pendingInvoicesCount: number;
  upcomingSessionsCount: number;
  sessionsTodayCount: number;
  attendancePercentage: number | null;
  comparisons: {
    studentsRegistered: KpiComparisonDto;
    feeCollection: KpiComparisonDto;
    enrolments: KpiComparisonDto;
  };
}

export interface EnrolmentTrendItem {
  month: string;
  label: string;
  count: number;
  registrations: number;
}

export interface FinancialTrendItem {
  month: string;
  label: string;
  collected: number; // in paise
  invoiced: number; // in paise
  pending: number; // in paise
}

export interface CourseDistributionItem {
  courseId: string;
  courseTitle: string;
  fullTitle: string;
  status: string;
  studentCount: number;
  activeEnrolments: number;
  completedEnrolments: number;
}

export interface BatchDistributionItem {
  batchId: string;
  batchName: string;
  courseTitle: string;
  status: string;
  capacity: number;
  enrolledCount: number;
  utilizationPct: number;
}

export interface PaymentStatusBreakdownItem {
  status: string;
  label: string;
  count: number;
  amountPaise: number;
}

export interface BatchAttendancePerformanceItem {
  batchId: string;
  batchName: string;
  courseTitle: string;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  excusedCount: number;
  totalRecords: number;
  attendancePercentage: number | null;
}

export interface CourseAttendanceSummaryItem {
  courseId: string;
  courseTitle: string;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  excusedCount: number;
  totalRecords: number;
  attendancePercentage: number | null;
}

export interface AttendanceTrendItem {
  period: string;
  label: string;
  percentage: number | null;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  totalRecords: number;
}

export interface TeacherWorkloadItemDto {
  teacherId: string;
  employeeCode: string | null;
  fullName: string;
  specialization: string | null;
  status: string;
  assignedCoursesCount: number;
  assignedBatchesCount: number;
  upcomingSessionsCount: number;
  scheduledHoursInPeriod: number;
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

export interface RecentActivityItemDto {
  id: string;
  category:
    | 'STUDENT'
    | 'TEACHER'
    | 'COURSE'
    | 'BATCH'
    | 'ATTENDANCE'
    | 'FEE'
    | 'ADMIN';
  action: string;
  title: string;
  description: string;
  status: string;
  timestamp: string;
  link: string;
}

export interface UpcomingSessionDto {
  id: string;
  title: string;
  batchId: string;
  batchName: string;
  courseTitle: string;
  teacherName: string;
  startsAt: string;
  endsAt: string;
  status: string;
  room?: string | null;
}

export interface TransactionItemDto {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  invoiceStatus: string;
  paymentNumber: string;
  receiptNumber?: string | null;
  studentId: string;
  admissionNo: string;
  studentName: string;
  courseName?: string;
  batchName?: string;
  amount: number; // gross in paise
  reversedAmount: number; // in paise
  netAmount: number; // net in paise
  paymentMode: string;
  paymentDate: string;
  status: string;
  referenceNumber?: string | null;
}

export interface PaginatedTransactionsDto {
  data: TransactionItemDto[];
  summary: {
    totalTransactions: number;
    totalGrossPaise: number;
    totalNetPaise: number;
  };
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface DashboardOverviewDto {
  institute: {
    id: string;
    name: string;
    displayName: string;
    code: string;
    currency: string;
    timezone: string;
    logoUrl: string | null;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
  };
  viewer: {
    userId: string;
    fullName: string;
    role: string;
  };
  dateFilter: {
    preset: DateRangePreset;
    label: string;
    from: string | null;
    to: string | null;
    previousFrom: string | null;
    previousTo: string | null;
  };
  kpi: DashboardKpiDto;
  enrolmentTrend: EnrolmentTrendItem[];
  financialTrend: FinancialTrendItem[];
  courseDistribution: CourseDistributionItem[];
  batchDistribution: BatchDistributionItem[];
  financialAnalytics: {
    totalCollectedPaise: number;
    collectedInPeriodPaise: number;
    pendingAmountPaise: number;
    overdueAmountPaise: number;
    invoiceTotals: {
      totalInvoicedPaise: number;
      totalPaidPaise: number;
      outstandingBalancePaise: number;
      issuedInvoicesCount: number;
      paidCount: number;
      partiallyPaidCount: number;
      unpaidIssuedCount: number;
      overdueCount: number;
      draftCount: number;
      cancelledCount: number;
    };
    paymentSummary: {
      successfulPaymentsCount: number;
      successfulAmountPaise: number;
      periodSuccessfulCount: number;
      periodSuccessfulAmountPaise: number;
      partiallyReversedCount: number;
      reversedCount: number;
      totalReversedAmountPaise: number;
    };
    paymentStatusBreakdown: PaymentStatusBreakdownItem[];
  };
  attendanceAnalytics: {
    overallPercentage: number | null;
    periodPercentage: number | null;
    minThresholdPct: number;
    presentCount: number;
    lateCount: number;
    absentCount: number;
    excusedCount: number;
    totalRecords: number;
    trend: AttendanceTrendItem[];
    byBatch: BatchAttendancePerformanceItem[];
    byCourse: CourseAttendanceSummaryItem[];
  };
  teacherAcademicAnalytics: {
    summary: {
      totalTeachers: number;
      activeTeachers: number;
      onLeaveTeachers: number;
      inactiveTeachers: number;
      totalCourseAssignments: number;
      totalBatchAssignments: number;
      upcomingScheduledSessions: number;
    };
    teacherWorkload: TeacherWorkloadItemDto[];
  };
  recentAdmissions: RecentAdmissionDto[];
  recentActivities: RecentActivityItemDto[];
  upcomingSessions: UpcomingSessionDto[];
  recentPayments: TransactionItemDto[];
}

export interface ResolvedDateWindow {
  preset: DateRangePreset;
  label: string;
  from: Date | null;
  to: Date | null;
  previousFrom: Date | null;
  previousTo: Date | null;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve the caller's verified active institute and administrative context
   * directly from PostgreSQL Membership records (used when frontend discovers
   * active tenant context without guessing institute IDs).
   */
  async resolveAdminContext(user: any) {
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const rawUserId: string = user.userId || user.sub || '';
    const rawRole = user.role as Role;

    if (!rawUserId || !rawRole || !ADMIN_DASHBOARD_ROLES.includes(rawRole)) {
      throw new ForbiddenException(
        'Access denied: Administrative role required for dashboard context',
      );
    }

    const membership = await this.prisma.membership.findFirst({
      where: {
        userId: rawUserId,
        status: MembershipStatus.ACTIVE,
        ...(user.instituteId ? { instituteId: user.instituteId } : {}),
        role: { in: ADMIN_DASHBOARD_ROLES },
      },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        institute: { include: { settings: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!membership) {
      throw new ForbiddenException(
        'Access denied: No active administrative membership found',
      );
    }

    let resolvedInstitute = membership.institute;
    if (!resolvedInstitute && membership.role === Role.SUPER_ADMIN) {
      resolvedInstitute = await this.prisma.institute.findFirst({
        where: { status: 'ACTIVE', deletedAt: null },
        include: { settings: true },
        orderBy: { createdAt: 'asc' },
      });
    }

    const branding = ((resolvedInstitute?.settings?.branding as any) || {});
    return {
      instituteId: membership.instituteId ?? resolvedInstitute?.id ?? null,
      instituteName: resolvedInstitute?.name ?? 'Platform Administration',
      displayName: branding.displayName || resolvedInstitute?.name || 'Platform Administration',
      code: resolvedInstitute?.slug ?? 'platform',
      currency: resolvedInstitute?.currency ?? 'INR',
      timezone: resolvedInstitute?.timezone ?? 'Asia/Kolkata',
      user: {
        id: membership.user.id,
        fullName: membership.user.fullName,
        email: membership.user.email,
        role: membership.role,
      },
    };
  }

  /**
   * Strictly verifies that the authenticated user holds an ACTIVE verified
   * Membership in PostgreSQL for the requested instituteId and meets role permissions.
   * Never trusts arbitrary instituteId parameters.
   */
  async verifyDashboardAccess(
    user: any,
    requestedInstituteId: string,
    allowedRoles: Role[] = ADMIN_DASHBOARD_ROLES,
  ): Promise<{
    instituteId: string;
    userId: string;
    fullName: string;
    role: Role;
  }> {
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const rawUserId: string = user.userId || user.sub || '';
    const rawRole = user.role as Role;

    if (!rawRole || !allowedRoles.includes(rawRole)) {
      throw new ForbiddenException(
        'Access denied: Insufficient role permissions for dashboard analytics',
      );
    }

    const institute = await this.prisma.institute.findUnique({
      where: { id: requestedInstituteId },
      select: { id: true },
    });
    if (!institute) {
      throw new NotFoundException('Institute not found');
    }

    // SUPER_ADMIN cross-tenant verification
    if (rawRole === Role.SUPER_ADMIN) {
      const superMembership = await this.prisma.membership.findFirst({
        where: {
          userId: rawUserId,
          role: Role.SUPER_ADMIN,
          status: MembershipStatus.ACTIVE,
        },
        include: { user: { select: { fullName: true } } },
      });
      if (!superMembership) {
        throw new ForbiddenException(
          'Access denied: Active Super Admin membership could not be verified',
        );
      }
      return {
        instituteId: requestedInstituteId,
        userId: rawUserId,
        fullName: superMembership.user.fullName,
        role: Role.SUPER_ADMIN,
      };
    }

    // Reject cross-tenant token mismatch
    if (user.instituteId && user.instituteId !== requestedInstituteId) {
      throw new ForbiddenException(
        'Access denied: Cross-institute dashboard access is prohibited',
      );
    }

    const membership = await this.prisma.membership.findFirst({
      where: {
        userId: rawUserId,
        instituteId: requestedInstituteId,
        status: MembershipStatus.ACTIVE,
      },
      include: { user: { select: { fullName: true } } },
    });

    if (!membership) {
      throw new ForbiddenException(
        'Access denied: No active verified membership found for this institute',
      );
    }

    if (!allowedRoles.includes(membership.role)) {
      throw new ForbiddenException(
        `Access denied: Role ${membership.role} is not authorized to perform this action`,
      );
    }

    return {
      instituteId: membership.instituteId,
      userId: membership.userId,
      fullName: membership.user.fullName,
      role: membership.role,
    };
  }

  /**
   * Resolve global date range preset or custom [from, to] window, including
   * institute AcademicTerm / AcademicYear lookups and equal-duration previous window.
   */
  async resolveDateWindow(
    instituteId: string,
    filter?: DashboardFilterQueryDto,
  ): Promise<ResolvedDateWindow> {
    const now = new Date();
    let preset: DateRangePreset = filter?.preset || '30D';
    if (!filter?.preset && (filter?.from || filter?.to)) {
      preset = 'CUSTOM';
    }

    let from: Date | null = null;
    let to: Date | null = null;
    let label = 'Last 30 Days';

    switch (preset) {
      case 'TODAY': {
        from = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          0,
          0,
          0,
          0,
        );
        to = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          23,
          59,
          59,
          999,
        );
        label = 'Today';
        break;
      }
      case '7D': {
        to = new Date(now);
        from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        label = 'Last 7 Days';
        break;
      }
      case '30D': {
        to = new Date(now);
        from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        label = 'Last 30 Days';
        break;
      }
      case 'THIS_MONTH': {
        from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        to = new Date(now);
        label = 'This Month';
        break;
      }
      case 'PREV_MONTH': {
        from = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
        to = new Date(
          now.getFullYear(),
          now.getMonth(),
          0,
          23,
          59,
          59,
          999,
        );
        label = 'Previous Month';
        break;
      }
      case 'THIS_TERM': {
        const currentTerm = await this.prisma.academicTerm.findFirst({
          where: { instituteId, isCurrent: true },
          orderBy: { startDate: 'desc' },
        });
        if (currentTerm) {
          from = new Date(currentTerm.startDate);
          to = new Date(currentTerm.endDate);
          label = `This Term (${currentTerm.name})`;
        } else {
          // Graceful 4-month academic term window fallback
          from = new Date(now.getFullYear(), now.getMonth() - 3, 1, 0, 0, 0, 0);
          to = new Date(now);
          label = 'This Academic Term';
        }
        break;
      }
      case 'THIS_YEAR': {
        const currentYear = await this.prisma.academicYear.findFirst({
          where: { instituteId, isCurrent: true },
          orderBy: { startDate: 'desc' },
        });
        if (currentYear) {
          from = new Date(currentYear.startDate);
          to = new Date(currentYear.endDate);
          label = `This Academic Year (${currentYear.name})`;
        } else {
          from = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
          to = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
          label = `Academic Year ${now.getFullYear()}`;
        }
        break;
      }
      case 'CUSTOM': {
        if (filter?.from) {
          const parsedFrom = new Date(filter.from);
          if (isNaN(parsedFrom.getTime())) {
            throw new BadRequestException('Invalid "from" date parameter');
          }
          from = parsedFrom;
        }
        if (filter?.to) {
          const parsedTo = new Date(filter.to);
          if (isNaN(parsedTo.getTime())) {
            throw new BadRequestException('Invalid "to" date parameter');
          }
          // If date-only YYYY-MM-DD string was passed, extend to end-of-day
          if (/^\d{4}-\d{2}-\d{2}$/.test(filter.to.trim())) {
            parsedTo.setUTCHours(23, 59, 59, 999);
          }
          to = parsedTo;
        } else {
          to = new Date(now);
        }
        if (from && to && from > to) {
          throw new BadRequestException(
            'Custom date filter "from" must not be after "to"',
          );
        }
        label = `Custom (${from ? from.toISOString().slice(0, 10) : 'Start'} to ${
          to ? to.toISOString().slice(0, 10) : 'Now'
        })`;
        break;
      }
      case 'ALL':
      default: {
        from = null;
        to = null;
        label = 'All Time';
        break;
      }
    }

    let previousFrom: Date | null = null;
    let previousTo: Date | null = null;

    if (from && to) {
      const durationMs = Math.max(1, to.getTime() - from.getTime());
      previousTo = new Date(from.getTime() - 1);
      previousFrom = new Date(previousTo.getTime() - durationMs);
    }

    return {
      preset,
      label,
      from,
      to,
      previousFrom,
      previousTo,
    };
  }

  /**
   * Build honest KPI comparison without fabricating percentages when historical denominator is 0.
   */
  private buildComparison(
    periodValue: number,
    previousPeriodValue: number | null,
    periodLabel: string,
  ): KpiComparisonDto {
    if (previousPeriodValue === null) {
      return {
        periodValue,
        previousPeriodValue: null,
        changePct: null,
        direction: 'NONE',
        periodLabel,
      };
    }

    if (previousPeriodValue === 0) {
      return {
        periodValue,
        previousPeriodValue: 0,
        changePct: null,
        direction: periodValue > 0 ? 'UP' : 'FLAT',
        periodLabel,
      };
    }

    const changePct = Math.round(
      ((periodValue - previousPeriodValue) / previousPeriodValue) * 100,
    );
    const direction =
      changePct > 0 ? 'UP' : changePct < 0 ? 'DOWN' : 'FLAT';

    return {
      periodValue,
      previousPeriodValue,
      changePct,
      direction,
      periodLabel,
    };
  }

  /**
   * Established Milestone 2.4 attendance percentage formula:
   * Math.round(((Present + Late) / (Total - Excused)) * 100), returning null when denominator === 0.
   */
  private computeAttendancePct(
    present: number,
    late: number,
    absent: number,
    excused: number,
  ): number | null {
    const total = present + late + absent + excused;
    const applicable = total - excused;
    if (applicable <= 0) {
      return null;
    }
    return Math.round(((present + late) / applicable) * 100);
  }

  /**
   * Returns complete enterprise Admin Dashboard overview aggregations in parallel,
   * strictly isolated to instituteId and responsive to global date filters.
   */
  async getOverview(
    instituteId: string,
    filter?: DashboardFilterQueryDto,
    viewer?: { userId: string; fullName: string; role: string },
  ): Promise<DashboardOverviewDto> {
    await this.prisma.reapIdleConnections();

    const institute = await this.prisma.institute.findUnique({
      where: { id: instituteId },
      include: { settings: true },
    });
    if (!institute) {
      throw new NotFoundException('Institute not found');
    }

    const window = await this.resolveDateWindow(instituteId, filter);
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0,
    );
    const todayEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999,
    );

    const periodDateClause =
      window.from && window.to
        ? { gte: window.from, lte: window.to }
        : window.from
          ? { gte: window.from }
          : window.to
            ? { lte: window.to }
            : undefined;

    const prevDateClause =
      window.previousFrom && window.previousTo
        ? { gte: window.previousFrom, lte: window.previousTo }
        : undefined;

    // Determine monthly bucket range for trend charts (6 to 12 months anchored at window.to or now)
    const anchorEnd = window.to && window.to < now ? window.to : now;
    const monthsSpan =
      window.from && window.to
        ? Math.min(
            12,
            Math.max(
              6,
              (window.to.getFullYear() - window.from.getFullYear()) * 12 +
                (window.to.getMonth() - window.from.getMonth()) +
                1,
            ),
          )
        : 6;
    const monthBuckets = this.buildMonthBuckets(anchorEnd, monthsSpan);
    const trendStartDate = monthBuckets[0].start;

    const [
      studentStatusGroups,
      periodNewStudents,
      prevNewStudents,
      periodNewEnrolments,
      prevNewEnrolments,
      teacherStatusGroups,
      courseStatusGroups,
      batchStatusGroups,
      invoiceStatusGroups,
      overdueBalanceAgg,
      paymentStatusGroups,
      periodPaymentsAgg,
      prevPaymentsAgg,
      standingAttendanceGroups,
      periodAttendanceGroups,
      upcomingSessionsCount,
      sessionsTodayCount,
      totalCourseAssignments,
      totalBatchAssignments,
      monthlyEnrolmentsRaw,
      monthlyRegistrationsRaw,
      monthlyPaymentsRaw,
      monthlyInvoicesRaw,
      coursesWithEnrolments,
      batchesWithEnrolments,
      batchAttendanceGroupsRaw,
      attendanceTrendRaw,
      teachersWorkloadRaw,
      recentAdmissions,
      recentTeachers,
      recentCourses,
      recentBatches,
      recentAuditLogs,
      upcomingSessions,
      recentPayments,
    ] = await Promise.all([
      // 1. Student counts by status
      this.prisma.studentProfile.groupBy({
        by: ['status'],
        where: { instituteId },
        _count: { id: true },
      }),

      // 2. Period new student registrations
      periodDateClause
        ? this.prisma.studentProfile.count({
            where: { instituteId, createdAt: periodDateClause },
          })
        : this.prisma.studentProfile.count({ where: { instituteId } }),

      // 3. Previous period new student registrations
      prevDateClause
        ? this.prisma.studentProfile.count({
            where: { instituteId, createdAt: prevDateClause },
          })
        : Promise.resolve(null),

      // 4. Period new enrolments
      periodDateClause
        ? this.prisma.enrolment.count({
            where: { instituteId, createdAt: periodDateClause },
          })
        : this.prisma.enrolment.count({ where: { instituteId } }),

      // 5. Previous period new enrolments
      prevDateClause
        ? this.prisma.enrolment.count({
            where: { instituteId, createdAt: prevDateClause },
          })
        : Promise.resolve(null),

      // 6. Teacher counts by status
      this.prisma.teacherProfile.groupBy({
        by: ['status'],
        where: { instituteId },
        _count: { id: true },
      }),

      // 7. Course counts by status (excluding soft-deleted)
      this.prisma.course.groupBy({
        by: ['status'],
        where: { instituteId, deletedAt: null },
        _count: { id: true },
      }),

      // 8. Batch counts by status
      this.prisma.batch.groupBy({
        by: ['status'],
        where: { instituteId },
        _count: { id: true },
      }),

      // 9. Invoice totals grouped by status (integer paise)
      this.prisma.invoice.groupBy({
        by: ['status'],
        where: { instituteId },
        _count: { id: true },
        _sum: {
          totalAmount: true,
          paidAmount: true,
          balanceAmount: true,
        },
      }),

      // 10. Overdue balance (status OVERDUE or past dueDate on active invoices)
      this.prisma.invoice.aggregate({
        where: {
          instituteId,
          status: {
            in: [
              InvoiceStatus.ISSUED,
              InvoiceStatus.PARTIALLY_PAID,
              InvoiceStatus.OVERDUE,
            ],
          },
          OR: [
            { status: InvoiceStatus.OVERDUE },
            { dueDate: { lt: todayStart }, balanceAmount: { gt: 0 } },
          ],
        },
        _sum: { balanceAmount: true },
      }),

      // 11. FeePayment totals grouped by status (integer paise)
      this.prisma.feePayment.groupBy({
        by: ['status'],
        where: { instituteId },
        _count: { id: true },
        _sum: {
          amount: true,
          reversedAmount: true,
          netAmount: true,
        },
      }),

      // 12. Period collected fees (netAmount on COMPLETED / PARTIALLY_REVERSED)
      this.prisma.feePayment.aggregate({
        where: {
          instituteId,
          status: {
            in: [
              FeePaymentStatus.COMPLETED,
              FeePaymentStatus.PARTIALLY_REVERSED,
            ],
          },
          ...(periodDateClause ? { paymentDate: periodDateClause } : {}),
        },
        _count: { id: true },
        _sum: { netAmount: true },
      }),

      // 13. Previous period collected fees
      prevDateClause
        ? this.prisma.feePayment.aggregate({
            where: {
              instituteId,
              status: {
                in: [
                  FeePaymentStatus.COMPLETED,
                  FeePaymentStatus.PARTIALLY_REVERSED,
                ],
              },
              paymentDate: prevDateClause,
            },
            _sum: { netAmount: true },
          })
        : Promise.resolve(null),

      // 14. Standing attendance breakdown
      this.prisma.attendance.groupBy({
        by: ['status'],
        where: { instituteId },
        _count: { id: true },
      }),

      // 15. Date-filtered attendance breakdown
      periodDateClause
        ? this.prisma.attendance.groupBy({
            by: ['status'],
            where: { instituteId, date: periodDateClause },
            _count: { id: true },
          })
        : Promise.resolve(null),

      // 16. Upcoming live sessions count
      this.prisma.liveSession.count({
        where: {
          instituteId,
          startsAt: { gte: now },
          status: { in: ['SCHEDULED', 'LIVE'] },
        },
      }),

      // 17. Live sessions scheduled today
      this.prisma.liveSession.count({
        where: {
          instituteId,
          startsAt: { gte: todayStart, lte: todayEnd },
          status: { in: ['SCHEDULED', 'LIVE'] },
        },
      }),

      // 18. Course instructor assignments count
      this.prisma.courseInstructor.count({ where: { instituteId } }),

      // 19. Batch teacher assignments count
      this.prisma.batchTeacher.count({ where: { instituteId } }),

      // 20. Monthly enrolments aggregation
      this.prisma.$queryRaw<{ month: string; count: bigint }[]>`
        SELECT
          TO_CHAR(e."createdAt", 'YYYY-MM') AS month,
          COUNT(e.id)::bigint               AS count
        FROM "Enrolment" e
        WHERE e."instituteId" = ${instituteId}
          AND e."createdAt" >= ${trendStartDate}
          AND e."createdAt" <= ${anchorEnd}
        GROUP BY month
        ORDER BY month ASC
      `,

      // 21. Monthly student registrations aggregation
      this.prisma.$queryRaw<{ month: string; count: bigint }[]>`
        SELECT
          TO_CHAR(sp."createdAt", 'YYYY-MM') AS month,
          COUNT(sp.id)::bigint               AS count
        FROM "StudentProfile" sp
        WHERE sp."instituteId" = ${instituteId}
          AND sp."createdAt" >= ${trendStartDate}
          AND sp."createdAt" <= ${anchorEnd}
        GROUP BY month
        ORDER BY month ASC
      `,

      // 22. Monthly net fee collections from FeePayment
      this.prisma.$queryRaw<{ month: string; collected: bigint }[]>`
        SELECT
          TO_CHAR(fp."paymentDate", 'YYYY-MM') AS month,
          COALESCE(SUM(fp."netAmount"), 0)::bigint AS collected
        FROM "FeePayment" fp
        WHERE fp."instituteId" = ${instituteId}
          AND fp."paymentDate" >= ${trendStartDate}
          AND fp."paymentDate" <= ${anchorEnd}
          AND fp.status IN ('COMPLETED', 'PARTIALLY_REVERSED')
        GROUP BY month
        ORDER BY month ASC
      `,

      // 23. Monthly invoiced & pending balances from non-DRAFT/non-CANCELLED Invoice
      this.prisma.$queryRaw<
        { month: string; invoiced: bigint; pending: bigint }[]
      >`
        SELECT
          TO_CHAR(i."createdAt", 'YYYY-MM') AS month,
          COALESCE(SUM(i."totalAmount"), 0)::bigint   AS invoiced,
          COALESCE(SUM(i."balanceAmount"), 0)::bigint AS pending
        FROM "Invoice" i
        WHERE i."instituteId" = ${instituteId}
          AND i."createdAt" >= ${trendStartDate}
          AND i."createdAt" <= ${anchorEnd}
          AND i.status NOT IN ('DRAFT', 'CANCELLED')
        GROUP BY month
        ORDER BY month ASC
      `,

      // 24. Course enrollment distribution (top 10 courses)
      this.prisma.course.findMany({
        where: { instituteId, deletedAt: null },
        take: 10,
        orderBy: { enrolments: { _count: 'desc' } },
        select: {
          id: true,
          title: true,
          status: true,
          enrolments: {
            where: periodDateClause ? { createdAt: periodDateClause } : {},
            select: { status: true },
          },
          _count: { select: { enrolments: true } },
        },
      }),

      // 25. Batch enrollment distribution (top 10 batches)
      this.prisma.batch.findMany({
        where: { instituteId },
        take: 10,
        orderBy: { enrolments: { _count: 'desc' } },
        select: {
          id: true,
          name: true,
          status: true,
          capacity: true,
          course: { select: { id: true, title: true } },
          _count: { select: { enrolments: true } },
        },
      }),

      // 26. Batch-wise attendance counts (single groupBy query instead of N+1)
      this.prisma.attendance.groupBy({
        by: ['batchId', 'status'],
        where: {
          instituteId,
          ...(periodDateClause ? { date: periodDateClause } : {}),
        },
        _count: { id: true },
      }),

      // 27. Monthly attendance trend
      this.prisma.$queryRaw<
        {
          month: string;
          present: bigint;
          late: bigint;
          absent: bigint;
          excused: bigint;
        }[]
      >`
        SELECT
          TO_CHAR(a."date", 'YYYY-MM') AS month,
          COUNT(*) FILTER (WHERE a.status = 'PRESENT')::bigint AS present,
          COUNT(*) FILTER (WHERE a.status = 'LATE')::bigint    AS late,
          COUNT(*) FILTER (WHERE a.status = 'ABSENT')::bigint  AS absent,
          COUNT(*) FILTER (WHERE a.status = 'EXCUSED')::bigint AS excused
        FROM "Attendance" a
        WHERE a."instituteId" = ${instituteId}
          AND a."date" >= ${trendStartDate}
          AND a."date" <= ${anchorEnd}
        GROUP BY month
        ORDER BY month ASC
      `,

      // 28. Teacher workload summary
      this.prisma.teacherProfile.findMany({
        where: { instituteId },
        take: 15,
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          employeeCode: true,
          specialization: true,
          status: true,
          membership: {
            select: { user: { select: { fullName: true } } },
          },
          _count: {
            select: {
              instructingCourses: true,
              batchTeachers: true,
            },
          },
          liveSessions: {
            where: {
              status: { in: ['SCHEDULED', 'LIVE', 'COMPLETED'] },
              ...(periodDateClause
                ? {
                    OR: [
                      { startsAt: periodDateClause },
                      {
                        startsAt: { gte: now },
                        status: { in: ['SCHEDULED', 'LIVE'] },
                      },
                    ],
                  }
                : { startsAt: { gte: trendStartDate } }),
            },
            select: {
              startsAt: true,
              endsAt: true,
              status: true,
            },
          },
        },
      }),

      // 29. Recent student admissions (top 8)
      this.prisma.studentProfile.findMany({
        where: { instituteId },
        take: 8,
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

      // 30. Recent teacher registrations (top 4 for activity feed)
      this.prisma.teacherProfile.findMany({
        where: { instituteId },
        take: 4,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          employeeCode: true,
          status: true,
          createdAt: true,
          membership: {
            select: { user: { select: { fullName: true } } },
          },
        },
      }),

      // 31. Recent courses (top 4 for activity feed)
      this.prisma.course.findMany({
        where: { instituteId, deletedAt: null },
        take: 4,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
        },
      }),

      // 32. Recent batches (top 4 for activity feed)
      this.prisma.batch.findMany({
        where: { instituteId },
        take: 4,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          code: true,
          status: true,
          createdAt: true,
          course: { select: { title: true } },
        },
      }),

      // 33. Recent administrative audit logs (top 6 for activity feed)
      this.prisma.auditLog.findMany({
        where: { instituteId },
        take: 6,
        orderBy: { createdAt: 'desc' },
      }),

      // 34. Upcoming scheduled live sessions (next 8)
      this.prisma.liveSession.findMany({
        where: {
          instituteId,
          startsAt: { gte: now },
          status: { in: ['SCHEDULED', 'LIVE'] },
        },
        take: 8,
        orderBy: { startsAt: 'asc' },
        select: {
          id: true,
          title: true,
          batchId: true,
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

      // 35. Recent financial transactions (latest 10 scoped to date filter if set)
      this.prisma.feePayment.findMany({
        where: {
          instituteId,
          ...(periodDateClause ? { paymentDate: periodDateClause } : {}),
        },
        take: 10,
        orderBy: { paymentDate: 'desc' },
        select: {
          id: true,
          invoiceId: true,
          paymentNumber: true,
          amount: true,
          reversedAmount: true,
          netAmount: true,
          paymentMode: true,
          paymentDate: true,
          status: true,
          referenceNumber: true,
          receipt: { select: { receiptNumber: true } },
          invoice: {
            select: {
              invoiceNumber: true,
              status: true,
              studentProfile: {
                select: {
                  id: true,
                  admissionNo: true,
                  membership: {
                    select: { user: { select: { fullName: true } } },
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
              },
            },
          },
        },
      }),
    ]);

    // ── 1. Student Metrics ────────────────────────────────────────────────────
    let totalStudents = 0;
    let activeStudents = 0;
    let pendingAdmissionsCount = 0;
    for (const g of studentStatusGroups) {
      totalStudents += g._count.id;
      if (g.status === 'ACTIVE' || g.status === 'APPROVED') {
        if (g.status === 'ACTIVE') activeStudents += g._count.id;
      }
      if (
        g.status === 'APPLIED' ||
        g.status === 'UNDER_REVIEW' ||
        g.status === 'PENDING'
      ) {
        pendingAdmissionsCount += g._count.id;
      }
    }

    // ── 2. Teacher Metrics ────────────────────────────────────────────────────
    let totalTeachers = 0;
    let activeTeachers = 0;
    let onLeaveTeachers = 0;
    let inactiveTeachers = 0;
    for (const g of teacherStatusGroups) {
      totalTeachers += g._count.id;
      if (g.status === 'ACTIVE') activeTeachers += g._count.id;
      else if (g.status === 'ON_LEAVE') onLeaveTeachers += g._count.id;
      else if (g.status === 'INACTIVE') inactiveTeachers += g._count.id;
    }

    // ── 3. Course & Batch Metrics ─────────────────────────────────────────────
    let totalCourses = 0;
    let publishedCourses = 0;
    let draftCourses = 0;
    for (const g of courseStatusGroups) {
      totalCourses += g._count.id;
      if (g.status === 'PUBLISHED') publishedCourses = g._count.id;
      if (g.status === 'DRAFT') draftCourses = g._count.id;
    }

    let totalBatches = 0;
    let activeBatches = 0;
    for (const g of batchStatusGroups) {
      totalBatches += g._count.id;
      if (g.status === 'ACTIVE') activeBatches = g._count.id;
    }

    // ── 4. Financial Aggregations (Strict Integer Paise, Excluding DRAFT/CANCELLED) ──
    let totalInvoicedPaise = 0;
    let totalInvoicePaidPaise = 0;
    let pendingAmountPaise = 0;
    let issuedInvoicesCount = 0;
    let paidInvoicesCount = 0;
    let partiallyPaidInvoicesCount = 0;
    let unpaidIssuedCount = 0;
    let overdueInvoicesCount = 0;
    let draftInvoicesCount = 0;
    let cancelledInvoicesCount = 0;

    for (const g of invoiceStatusGroups) {
      const count = g._count.id;
      const sumTotal = Number(g._sum.totalAmount ?? 0);
      const sumPaid = Number(g._sum.paidAmount ?? 0);
      const sumBal = Number(g._sum.balanceAmount ?? 0);

      if (g.status === InvoiceStatus.DRAFT) {
        draftInvoicesCount = count;
        continue;
      }
      if (g.status === InvoiceStatus.CANCELLED) {
        cancelledInvoicesCount = count;
        continue;
      }

      issuedInvoicesCount += count;
      totalInvoicedPaise += sumTotal;
      totalInvoicePaidPaise += sumPaid;

      if (g.status === InvoiceStatus.PAID) {
        paidInvoicesCount = count;
      } else if (g.status === InvoiceStatus.PARTIALLY_PAID) {
        partiallyPaidInvoicesCount = count;
        pendingAmountPaise += sumBal;
      } else if (g.status === InvoiceStatus.ISSUED) {
        unpaidIssuedCount = count;
        pendingAmountPaise += sumBal;
      } else if (g.status === InvoiceStatus.OVERDUE) {
        overdueInvoicesCount = count;
        pendingAmountPaise += sumBal;
      }
    }

    const pendingInvoicesCount =
      partiallyPaidInvoicesCount + unpaidIssuedCount + overdueInvoicesCount;
    const overdueAmountPaise = Number(
      overdueBalanceAgg._sum.balanceAmount ?? 0,
    );

    let totalPaymentNetPaise = 0;
    let successfulPaymentsCount = 0;
    let partiallyReversedCount = 0;
    let reversedCount = 0;
    let totalReversedAmountPaise = 0;

    for (const g of paymentStatusGroups) {
      const count = g._count.id;
      const net = Number(g._sum.netAmount ?? 0);
      const rev = Number(g._sum.reversedAmount ?? 0);
      totalReversedAmountPaise += rev;

      if (g.status === FeePaymentStatus.COMPLETED) {
        successfulPaymentsCount += count;
        totalPaymentNetPaise += net;
      } else if (g.status === FeePaymentStatus.PARTIALLY_REVERSED) {
        partiallyReversedCount += count;
        successfulPaymentsCount += count;
        totalPaymentNetPaise += net;
      } else if (g.status === FeePaymentStatus.REVERSED) {
        reversedCount += count;
      }
    }

    // Use verified FeePayment netAmount sum (falling back to non-cancelled Invoice.paidAmount only if no payment rows exist)
    const totalFeeCollected =
      paymentStatusGroups.length > 0
        ? totalPaymentNetPaise
        : totalInvoicePaidPaise;

    const collectedInPeriodPaise = Number(
      periodPaymentsAgg._sum.netAmount ?? 0,
    );
    const periodSuccessfulCount = periodPaymentsAgg._count.id;
    const prevCollectedPaise =
      prevPaymentsAgg !== null
        ? Number(prevPaymentsAgg._sum.netAmount ?? 0)
        : null;

    const paymentStatusBreakdown: PaymentStatusBreakdownItem[] = [
      {
        status: 'PAID',
        label: 'Paid in Full',
        count: paidInvoicesCount,
        amountPaise: Number(
          invoiceStatusGroups.find((g) => g.status === InvoiceStatus.PAID)
            ?._sum.paidAmount ?? 0,
        ),
      },
      {
        status: 'PARTIALLY_PAID',
        label: 'Partially Paid',
        count: partiallyPaidInvoicesCount,
        amountPaise: Number(
          invoiceStatusGroups.find(
            (g) => g.status === InvoiceStatus.PARTIALLY_PAID,
          )?._sum.balanceAmount ?? 0,
        ),
      },
      {
        status: 'ISSUED',
        label: 'Issued / Due',
        count: unpaidIssuedCount,
        amountPaise: Number(
          invoiceStatusGroups.find((g) => g.status === InvoiceStatus.ISSUED)
            ?._sum.balanceAmount ?? 0,
        ),
      },
      {
        status: 'OVERDUE',
        label: 'Overdue',
        count: overdueInvoicesCount,
        amountPaise: overdueAmountPaise,
      },
    ];

    // ── 5. Attendance Aggregations (Milestone 2.4 Formula) ────────────────────
    const extractAttCounts = (
      groups: Array<{ status: string; _count: { id: number } }>,
    ) => {
      let present = 0;
      let late = 0;
      let absent = 0;
      let excused = 0;
      for (const g of groups) {
        if (g.status === 'PRESENT') present = g._count.id;
        else if (g.status === 'LATE') late = g._count.id;
        else if (g.status === 'ABSENT') absent = g._count.id;
        else if (g.status === 'EXCUSED') excused = g._count.id;
      }
      return {
        present,
        late,
        absent,
        excused,
        total: present + late + absent + excused,
        pct: this.computeAttendancePct(present, late, absent, excused),
      };
    };

    const standingAtt = extractAttCounts(standingAttendanceGroups);
    const activeAtt = periodAttendanceGroups
      ? extractAttCounts(periodAttendanceGroups)
      : standingAtt;

    // Batch-wise & Course-wise attendance breakdown
    const batchMetaMap = new Map(
      batchesWithEnrolments.map((b) => [
        b.id,
        {
          batchName: b.name,
          courseId: b.course.id,
          courseTitle: b.course.title,
        },
      ]),
    );

    // Fetch metadata for any attended batches not in top 10 batchesWithEnrolments
    const attendedBatchIds = [
      ...new Set(batchAttendanceGroupsRaw.map((g) => g.batchId)),
    ];
    const missingBatchIds = attendedBatchIds.filter(
      (id) => !batchMetaMap.has(id),
    );
    if (missingBatchIds.length > 0) {
      const extraBatches = await this.prisma.batch.findMany({
        where: { instituteId, id: { in: missingBatchIds } },
        select: {
          id: true,
          name: true,
          course: { select: { id: true, title: true } },
        },
      });
      for (const eb of extraBatches) {
        batchMetaMap.set(eb.id, {
          batchName: eb.name,
          courseId: eb.course.id,
          courseTitle: eb.course.title,
        });
      }
    }

    const batchAttAccum = new Map<
      string,
      { present: number; late: number; absent: number; excused: number }
    >();
    const courseAttAccum = new Map<
      string,
      {
        courseTitle: string;
        present: number;
        late: number;
        absent: number;
        excused: number;
      }
    >();

    for (const row of batchAttendanceGroupsRaw) {
      const curr = batchAttAccum.get(row.batchId) || {
        present: 0,
        late: 0,
        absent: 0,
        excused: 0,
      };
      if (row.status === 'PRESENT') curr.present += row._count.id;
      else if (row.status === 'LATE') curr.late += row._count.id;
      else if (row.status === 'ABSENT') curr.absent += row._count.id;
      else if (row.status === 'EXCUSED') curr.excused += row._count.id;
      batchAttAccum.set(row.batchId, curr);

      const meta = batchMetaMap.get(row.batchId);
      if (meta) {
        const cCurr = courseAttAccum.get(meta.courseId) || {
          courseTitle: meta.courseTitle,
          present: 0,
          late: 0,
          absent: 0,
          excused: 0,
        };
        if (row.status === 'PRESENT') cCurr.present += row._count.id;
        else if (row.status === 'LATE') cCurr.late += row._count.id;
        else if (row.status === 'ABSENT') cCurr.absent += row._count.id;
        else if (row.status === 'EXCUSED') cCurr.excused += row._count.id;
        courseAttAccum.set(meta.courseId, cCurr);
      }
    }

    const byBatchAttendance: BatchAttendancePerformanceItem[] = Array.from(
      batchAttAccum.entries(),
    ).map(([batchId, counts]) => {
      const meta = batchMetaMap.get(batchId);
      const totalRecords =
        counts.present + counts.late + counts.absent + counts.excused;
      return {
        batchId,
        batchName: meta?.batchName || 'Academic Batch',
        courseTitle: meta?.courseTitle || 'Course',
        presentCount: counts.present,
        lateCount: counts.late,
        absentCount: counts.absent,
        excusedCount: counts.excused,
        totalRecords,
        attendancePercentage: this.computeAttendancePct(
          counts.present,
          counts.late,
          counts.absent,
          counts.excused,
        ),
      };
    });

    const byCourseAttendance: CourseAttendanceSummaryItem[] = Array.from(
      courseAttAccum.entries(),
    ).map(([courseId, counts]) => {
      const totalRecords =
        counts.present + counts.late + counts.absent + counts.excused;
      return {
        courseId,
        courseTitle: counts.courseTitle,
        presentCount: counts.present,
        lateCount: counts.late,
        absentCount: counts.absent,
        excusedCount: counts.excused,
        totalRecords,
        attendancePercentage: this.computeAttendancePct(
          counts.present,
          counts.late,
          counts.absent,
          counts.excused,
        ),
      };
    });

    const attendanceTrend: AttendanceTrendItem[] = monthBuckets.map((m) => {
      const raw = attendanceTrendRaw.find((r) => r.month === m.key);
      const present = raw ? Number(raw.present) : 0;
      const late = raw ? Number(raw.late) : 0;
      const absent = raw ? Number(raw.absent) : 0;
      const excused = raw ? Number(raw.excused) : 0;
      return {
        period: m.key,
        label: m.label,
        percentage: this.computeAttendancePct(present, late, absent, excused),
        presentCount: present,
        lateCount: late,
        absentCount: absent,
        totalRecords: present + late + absent + excused,
      };
    });

    // ── 6. Build Monthly Enrollment & Financial Trends ────────────────────────
    const enrolmentTrend: EnrolmentTrendItem[] = monthBuckets.map((m) => {
      const enr = monthlyEnrolmentsRaw.find((r) => r.month === m.key);
      const reg = monthlyRegistrationsRaw.find((r) => r.month === m.key);
      return {
        month: m.key,
        label: m.label,
        count: enr ? Number(enr.count) : 0,
        registrations: reg ? Number(reg.count) : 0,
      };
    });

    const financialTrend: FinancialTrendItem[] = monthBuckets.map((m) => {
      const pay = monthlyPaymentsRaw.find((r) => r.month === m.key);
      const inv = monthlyInvoicesRaw.find((r) => r.month === m.key);
      return {
        month: m.key,
        label: m.label,
        collected: pay ? Number(pay.collected) : 0,
        invoiced: inv ? Number(inv.invoiced) : 0,
        pending: inv ? Number(inv.pending) : 0,
      };
    });

    // ── 7. Course & Batch Distribution ────────────────────────────────────────
    const courseDistribution: CourseDistributionItem[] =
      coursesWithEnrolments.map((c) => {
        const activeCount = c.enrolments.filter(
          (e) => e.status === 'ACTIVE',
        ).length;
        const completedCount = c.enrolments.filter(
          (e) => e.status === 'COMPLETED',
        ).length;
        return {
          courseId: c.id,
          courseTitle:
            c.title.length > 26 ? c.title.substring(0, 26) + '…' : c.title,
          fullTitle: c.title,
          status: c.status,
          studentCount: periodDateClause
            ? c.enrolments.length
            : c._count.enrolments,
          activeEnrolments: activeCount,
          completedEnrolments: completedCount,
        };
      });

    const batchDistribution: BatchDistributionItem[] =
      batchesWithEnrolments.map((b) => {
        const cap = Math.max(1, b.capacity || 50);
        const enrolled = b._count.enrolments;
        return {
          batchId: b.id,
          batchName: b.name,
          courseTitle: b.course.title,
          status: b.status,
          capacity: b.capacity,
          enrolledCount: enrolled,
          utilizationPct: Math.min(100, Math.round((enrolled / cap) * 100)),
        };
      });

    // ── 8. Teacher Workload Summary ───────────────────────────────────────────
    const isHistoricalOnlyWindow = Boolean(window.to && window.to < todayStart);
    const teacherWorkload: TeacherWorkloadItemDto[] = teachersWorkloadRaw.map(
      (t) => {
        let totalMinutes = 0;
        let upcomingForTeacher = 0;
        for (const ls of t.liveSessions) {
          const isUpcoming =
            ls.startsAt >= now &&
            (ls.status === 'SCHEDULED' || ls.status === 'LIVE');
          if (isUpcoming) {
            upcomingForTeacher++;
          }
          const inWindow =
            (!window.from || ls.startsAt >= window.from) &&
            (!window.to || ls.startsAt <= window.to);
          if (inWindow || (!isHistoricalOnlyWindow && isUpcoming)) {
            const durMin = Math.max(
              0,
              (ls.endsAt.getTime() - ls.startsAt.getTime()) / 60000,
            );
            totalMinutes += durMin;
          }
        }
        return {
          teacherId: t.id,
          employeeCode: t.employeeCode,
          fullName: t.membership.user.fullName,
          specialization: t.specialization,
          status: t.status,
          assignedCoursesCount: t._count.instructingCourses,
          assignedBatchesCount: t._count.batchTeachers,
          upcomingSessionsCount: upcomingForTeacher,
          scheduledHoursInPeriod: Math.round((totalMinutes / 60) * 10) / 10,
        };
      },
    );

    // ── 9. Recent Admissions, Payments, Upcoming Sessions & Unified Activity Feed ──
    const recentAdmissionsMapped: RecentAdmissionDto[] = recentAdmissions.map(
      (s) => ({
        id: s.id,
        admissionNo: s.admissionNo,
        fullName: s.membership.user.fullName,
        email: s.membership.user.email,
        courseName: s.enrolments[0]?.course?.title,
        batchName: s.enrolments[0]?.batch?.name,
        status: s.status,
        createdAt: s.createdAt.toISOString(),
      }),
    );

    const upcomingSessionsMapped: UpcomingSessionDto[] = upcomingSessions.map(
      (sess) => ({
        id: sess.id,
        title: sess.title,
        batchId: sess.batchId,
        batchName: sess.batch?.name ?? '-',
        courseTitle: sess.batch?.course?.title ?? '-',
        teacherName:
          sess.teacherProfile?.membership?.user?.fullName ?? 'Unassigned',
        startsAt: sess.startsAt.toISOString(),
        endsAt: sess.endsAt.toISOString(),
        status: sess.status,
        room: sess.room,
      }),
    );

    const recentPaymentsMapped: TransactionItemDto[] = recentPayments.map((p) =>
      this.mapPaymentToTransactionDto(p),
    );

    // Unified chronological Recent Activities feed from real DB entities + AuditLog
    const activityItems: RecentActivityItemDto[] = [];

    for (const s of recentAdmissions.slice(0, 4)) {
      activityItems.push({
        id: `stu-${s.id}`,
        category: 'STUDENT',
        action: 'STUDENT_REGISTRATION',
        title: `New Student: ${s.membership.user.fullName}`,
        description: `Admission ${s.admissionNo}${
          s.enrolments[0]?.course?.title
            ? ` • ${s.enrolments[0].course.title}`
            : ''
        }`,
        status: s.status,
        timestamp: s.createdAt.toISOString(),
        link: `/admin/students/${s.id}`,
      });
    }

    for (const t of recentTeachers.slice(0, 3)) {
      activityItems.push({
        id: `tch-${t.id}`,
        category: 'TEACHER',
        action: 'TEACHER_REGISTERED',
        title: `Faculty Registered: ${t.membership.user.fullName}`,
        description: `Employee Code: ${t.employeeCode || 'Assigned'}`,
        status: t.status,
        timestamp: t.createdAt.toISOString(),
        link: `/admin/teachers/${t.id}`,
      });
    }

    for (const c of recentCourses.slice(0, 2)) {
      activityItems.push({
        id: `crs-${c.id}`,
        category: 'COURSE',
        action: 'COURSE_CREATED',
        title: `Course: ${c.title}`,
        description: `Curriculum status: ${c.status}`,
        status: c.status,
        timestamp: c.createdAt.toISOString(),
        link: `/admin/courses/${c.id}`,
      });
    }

    for (const b of recentBatches.slice(0, 2)) {
      activityItems.push({
        id: `bat-${b.id}`,
        category: 'BATCH',
        action: 'BATCH_CREATED',
        title: `Batch Created: ${b.name}`,
        description: `${b.course.title} (${b.code || 'Cohort'})`,
        status: b.status,
        timestamp: b.createdAt.toISOString(),
        link: `/admin/batches/${b.id}`,
      });
    }

    for (const p of recentPaymentsMapped.slice(0, 4)) {
      const amtStr = '₹' + Math.round(p.netAmount / 100).toLocaleString('en-IN');
      activityItems.push({
        id: `pay-${p.id}`,
        category: 'FEE',
        action: 'FEE_PAYMENT',
        title: `Fee Payment ${amtStr} — ${p.studentName}`,
        description: `Invoice ${p.invoiceNumber} • ${p.paymentMode}`,
        status: p.status,
        timestamp: p.paymentDate,
        link: `/admin/finance`,
      });
    }

    for (const log of recentAuditLogs.slice(0, 4)) {
      activityItems.push({
        id: `aud-${log.id}`,
        category: 'ADMIN',
        action: log.action,
        title: log.action.replace(/_/g, ' '),
        description: `${log.entityType} (${log.entityId.slice(0, 8)})`,
        status: 'LOGGED',
        timestamp: log.createdAt.toISOString(),
        link: `/admin/settings`,
      });
    }

    activityItems.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    // Branding & settings extraction
    const brandingJson = (institute.settings?.branding as any) || {};
    const enrolmentRulesJson =
      (institute.settings?.enrolmentRules as any) || {};
    const profileJson = enrolmentRulesJson.profile || {};
    const minThresholdPct =
      typeof enrolmentRulesJson.minAttendancePercentage === 'number'
        ? enrolmentRulesJson.minAttendancePercentage
        : 75;

    return {
      institute: {
        id: institute.id,
        name: institute.name,
        displayName:
          profileJson.displayName || brandingJson.displayName || institute.name,
        code: institute.slug,
        currency: institute.currency || 'INR',
        timezone: institute.timezone || 'Asia/Kolkata',
        logoUrl: institute.logoUrl || brandingJson.logoUrl || null,
        primaryColor: brandingJson.primaryColor || '#2563eb',
        secondaryColor: brandingJson.secondaryColor || '#1e2235',
        accentColor: brandingJson.accentColor || '#10b981',
      },
      viewer: {
        userId: viewer?.userId || '',
        fullName: viewer?.fullName || 'Institute Administrator',
        role: viewer?.role || Role.INSTITUTE_ADMIN,
      },
      dateFilter: {
        preset: window.preset,
        label: window.label,
        from: window.from ? window.from.toISOString() : null,
        to: window.to ? window.to.toISOString() : null,
        previousFrom: window.previousFrom
          ? window.previousFrom.toISOString()
          : null,
        previousTo: window.previousTo ? window.previousTo.toISOString() : null,
      },
      kpi: {
        totalStudents,
        activeStudents,
        pendingAdmissionsCount,
        totalTeachers,
        activeTeachers,
        onLeaveTeachers,
        totalCourses,
        publishedCourses,
        draftCourses,
        activeBatches,
        totalBatches,
        totalFeeCollected,
        totalFeePending: pendingAmountPaise,
        overdueFeeAmount: overdueAmountPaise,
        pendingInvoicesCount,
        upcomingSessionsCount,
        sessionsTodayCount,
        attendancePercentage: activeAtt.pct,
        comparisons: {
          studentsRegistered: this.buildComparison(
            periodNewStudents,
            prevNewStudents,
            window.label,
          ),
          feeCollection: this.buildComparison(
            collectedInPeriodPaise,
            prevCollectedPaise,
            window.label,
          ),
          enrolments: this.buildComparison(
            periodNewEnrolments,
            prevNewEnrolments,
            window.label,
          ),
        },
      },
      enrolmentTrend,
      financialTrend,
      courseDistribution,
      batchDistribution,
      financialAnalytics: {
        totalCollectedPaise: totalFeeCollected,
        collectedInPeriodPaise,
        pendingAmountPaise,
        overdueAmountPaise,
        invoiceTotals: {
          totalInvoicedPaise,
          totalPaidPaise: totalInvoicePaidPaise,
          outstandingBalancePaise: pendingAmountPaise,
          issuedInvoicesCount,
          paidCount: paidInvoicesCount,
          partiallyPaidCount: partiallyPaidInvoicesCount,
          unpaidIssuedCount,
          overdueCount: overdueInvoicesCount,
          draftCount: draftInvoicesCount,
          cancelledCount: cancelledInvoicesCount,
        },
        paymentSummary: {
          successfulPaymentsCount,
          successfulAmountPaise: totalPaymentNetPaise,
          periodSuccessfulCount,
          periodSuccessfulAmountPaise: collectedInPeriodPaise,
          partiallyReversedCount,
          reversedCount,
          totalReversedAmountPaise,
        },
        paymentStatusBreakdown,
      },
      attendanceAnalytics: {
        overallPercentage: standingAtt.pct,
        periodPercentage: activeAtt.pct,
        minThresholdPct,
        presentCount: activeAtt.present,
        lateCount: activeAtt.late,
        absentCount: activeAtt.absent,
        excusedCount: activeAtt.excused,
        totalRecords: activeAtt.total,
        trend: attendanceTrend,
        byBatch: byBatchAttendance,
        byCourse: byCourseAttendance,
      },
      teacherAcademicAnalytics: {
        summary: {
          totalTeachers,
          activeTeachers,
          onLeaveTeachers,
          inactiveTeachers,
          totalCourseAssignments,
          totalBatchAssignments,
          upcomingScheduledSessions: upcomingSessionsCount,
        },
        teacherWorkload,
      },
      recentAdmissions: recentAdmissionsMapped,
      recentActivities: activityItems.slice(0, 16),
      upcomingSessions: upcomingSessionsMapped,
      recentPayments: recentPaymentsMapped,
    };
  }

  /**
   * Paginated, searchable, filterable financial transaction listing from actual FeePayment & Invoice records.
   */
  async getTransactions(
    instituteId: string,
    query: DashboardTransactionsQueryDto = {},
  ): Promise<PaginatedTransactionsDto> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;

    // Only apply date window when caller explicitly passed preset, from, or to
    const hasExplicitDate = Boolean(query.preset || query.from || query.to);
    const window = hasExplicitDate
      ? await this.resolveDateWindow(instituteId, query)
      : null;

    const where: any = { instituteId };

    if (window?.from || window?.to) {
      where.paymentDate = {};
      if (window.from) where.paymentDate.gte = window.from;
      if (window.to) where.paymentDate.lte = window.to;
    }

    if (query.status && query.status !== 'ALL') {
      where.status = query.status as FeePaymentStatus;
    }

    if (query.paymentMode && query.paymentMode !== 'ALL') {
      where.paymentMode = query.paymentMode as FeePaymentMode;
    }

    if (query.search && query.search.trim()) {
      const s = query.search.trim();
      where.OR = [
        { paymentNumber: { contains: s, mode: 'insensitive' } },
        { referenceNumber: { contains: s, mode: 'insensitive' } },
        { invoice: { invoiceNumber: { contains: s, mode: 'insensitive' } } },
        {
          invoice: {
            studentProfile: {
              admissionNo: { contains: s, mode: 'insensitive' },
            },
          },
        },
        {
          invoice: {
            studentProfile: {
              membership: {
                user: { fullName: { contains: s, mode: 'insensitive' } },
              },
            },
          },
        },
      ];
    }

    const [total, rows, totalsAgg] = await Promise.all([
      this.prisma.feePayment.count({ where }),
      this.prisma.feePayment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { paymentDate: 'desc' },
        select: {
          id: true,
          invoiceId: true,
          paymentNumber: true,
          amount: true,
          reversedAmount: true,
          netAmount: true,
          paymentMode: true,
          paymentDate: true,
          status: true,
          referenceNumber: true,
          receipt: { select: { receiptNumber: true } },
          invoice: {
            select: {
              invoiceNumber: true,
              status: true,
              studentProfile: {
                select: {
                  id: true,
                  admissionNo: true,
                  membership: {
                    select: { user: { select: { fullName: true } } },
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
              },
            },
          },
        },
      }),
      this.prisma.feePayment.aggregate({
        where,
        _sum: { amount: true, netAmount: true },
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
      data: rows.map((r) => this.mapPaymentToTransactionDto(r)),
      summary: {
        totalTransactions: total,
        totalGrossPaise: Number(totalsAgg._sum.amount ?? 0),
        totalNetPaise: Number(totalsAgg._sum.netAmount ?? 0),
      },
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Export institute-scoped dashboard reports as safe, structured CSV documents.
   * Supports all 6 required report types and respects date filters & role permissions.
   */
  async exportReport(
    instituteId: string,
    reportType: ExportReportType,
    filter?: DashboardFilterQueryDto,
  ): Promise<{
    filename: string;
    mimeType: string;
    reportTitle: string;
    instituteName: string;
    dateRangeLabel: string;
    generatedAt: string;
    rowCount: number;
    csvContent: string;
  }> {
    const institute = await this.prisma.institute.findUnique({
      where: { id: instituteId },
      select: { id: true, name: true, slug: true, currency: true },
    });
    if (!institute) {
      throw new NotFoundException('Institute not found');
    }

    const window = await this.resolveDateWindow(instituteId, filter);
    const periodClause =
      window.from && window.to
        ? { gte: window.from, lte: window.to }
        : window.from
          ? { gte: window.from }
          : window.to
            ? { lte: window.to }
            : undefined;

    const generatedAt = new Date().toISOString();
    let reportTitle = '';
    let headers: string[] = [];
    const dataRows: Array<Array<string | number>> = [];

    switch (reportType) {
      case 'enrollments': {
        reportTitle = 'Student Enrollment Report';
        headers = [
          'Admission No',
          'Student Name',
          'Email',
          'Phone',
          'Admission Status',
          'Course',
          'Batch',
          'Enrollment Status',
          'Registered Date',
        ];
        const students = await this.prisma.studentProfile.findMany({
          where: {
            instituteId,
            ...(periodClause ? { createdAt: periodClause } : {}),
          },
          orderBy: { createdAt: 'desc' },
          include: {
            membership: { include: { user: true } },
            enrolments: {
              include: {
                course: { select: { title: true } },
                batch: { select: { name: true } },
              },
              orderBy: { createdAt: 'desc' },
            },
          },
        });

        for (const s of students) {
          if (s.enrolments.length === 0) {
            dataRows.push([
              s.admissionNo,
              s.membership.user.fullName,
              s.membership.user.email || '',
              s.membership.user.phoneE164,
              s.status,
              'Unenrolled',
              '-',
              '-',
              s.createdAt.toISOString().slice(0, 10),
            ]);
          } else {
            for (const e of s.enrolments) {
              dataRows.push([
                s.admissionNo,
                s.membership.user.fullName,
                s.membership.user.email || '',
                s.membership.user.phoneE164,
                s.status,
                e.course.title,
                e.batch?.name || '-',
                e.status,
                s.createdAt.toISOString().slice(0, 10),
              ]);
            }
          }
        }
        break;
      }

      case 'fee-collection': {
        reportTitle = 'Fee Collection Report';
        headers = [
          'Payment Number',
          'Receipt Number',
          'Invoice Number',
          'Admission No',
          'Student Name',
          'Payment Mode',
          'Gross Amount (INR)',
          'Reversed Amount (INR)',
          'Net Collected (INR)',
          'Status',
          'Payment Date',
        ];
        const payments = await this.prisma.feePayment.findMany({
          where: {
            instituteId,
            status: {
              in: [
                FeePaymentStatus.COMPLETED,
                FeePaymentStatus.PARTIALLY_REVERSED,
              ],
            },
            ...(periodClause ? { paymentDate: periodClause } : {}),
          },
          orderBy: { paymentDate: 'desc' },
          include: {
            receipt: true,
            invoice: {
              include: {
                studentProfile: {
                  include: { membership: { include: { user: true } } },
                },
              },
            },
          },
        });

        for (const p of payments) {
          dataRows.push([
            p.paymentNumber,
            p.receipt?.receiptNumber || '',
            p.invoice.invoiceNumber,
            p.invoice.studentProfile.admissionNo,
            p.invoice.studentProfile.membership.user.fullName,
            p.paymentMode,
            (p.amount / 100).toFixed(2),
            (p.reversedAmount / 100).toFixed(2),
            (p.netAmount / 100).toFixed(2),
            p.status,
            p.paymentDate.toISOString().slice(0, 10),
          ]);
        }
        break;
      }

      case 'pending-fees': {
        reportTitle = 'Pending Fee & Outstanding Balances Report';
        headers = [
          'Invoice Number',
          'Admission No',
          'Student Name',
          'Phone',
          'Invoice Status',
          'Total Billed (INR)',
          'Paid Amount (INR)',
          'Outstanding Balance (INR)',
          'Due Date',
        ];
        const invoices = await this.prisma.invoice.findMany({
          where: {
            instituteId,
            status: {
              in: [
                InvoiceStatus.ISSUED,
                InvoiceStatus.PARTIALLY_PAID,
                InvoiceStatus.OVERDUE,
              ],
            },
            balanceAmount: { gt: 0 },
            ...(periodClause ? { createdAt: periodClause } : {}),
          },
          orderBy: { dueDate: 'asc' },
          include: {
            studentProfile: {
              include: { membership: { include: { user: true } } },
            },
          },
        });

        for (const inv of invoices) {
          dataRows.push([
            inv.invoiceNumber,
            inv.studentProfile.admissionNo,
            inv.studentProfile.membership.user.fullName,
            inv.studentProfile.membership.user.phoneE164,
            inv.status,
            (inv.totalAmount / 100).toFixed(2),
            (inv.paidAmount / 100).toFixed(2),
            (inv.balanceAmount / 100).toFixed(2),
            inv.dueDate.toISOString().slice(0, 10),
          ]);
        }
        break;
      }

      case 'attendance': {
        reportTitle = 'Academic Attendance Performance Report';
        headers = [
          'Batch Name',
          'Course Title',
          'Enrolled Students',
          'Present',
          'Late',
          'Absent',
          'Excused',
          'Total Records',
          'Attendance Rate (%)',
        ];
        const batches = await this.prisma.batch.findMany({
          where: { instituteId },
          include: {
            course: { select: { title: true } },
            _count: { select: { enrolments: true } },
          },
          orderBy: { name: 'asc' },
        });
        const attGroups = await this.prisma.attendance.groupBy({
          by: ['batchId', 'status'],
          where: {
            instituteId,
            ...(periodClause ? { date: periodClause } : {}),
          },
          _count: { id: true },
        });

        for (const b of batches) {
          const bGroups = attGroups.filter((g) => g.batchId === b.id);
          const present =
            bGroups.find((g) => g.status === 'PRESENT')?._count.id ?? 0;
          const late =
            bGroups.find((g) => g.status === 'LATE')?._count.id ?? 0;
          const absent =
            bGroups.find((g) => g.status === 'ABSENT')?._count.id ?? 0;
          const excused =
            bGroups.find((g) => g.status === 'EXCUSED')?._count.id ?? 0;
          const total = present + late + absent + excused;
          const pct = this.computeAttendancePct(present, late, absent, excused);

          dataRows.push([
            b.name,
            b.course.title,
            b._count.enrolments,
            present,
            late,
            absent,
            excused,
            total,
            pct !== null ? `${pct}%` : 'N/A',
          ]);
        }
        break;
      }

      case 'teacher-workload': {
        reportTitle = 'Faculty & Teacher Workload Report';
        headers = [
          'Employee Code',
          'Teacher Name',
          'Email',
          'Phone',
          'Specialization',
          'Status',
          'Assigned Courses',
          'Assigned Batches',
          'Scheduled Sessions',
          'Scheduled Hours',
        ];
        const teachers = await this.prisma.teacherProfile.findMany({
          where: { instituteId },
          orderBy: { createdAt: 'asc' },
          include: {
            membership: { include: { user: true } },
            _count: {
              select: { instructingCourses: true, batchTeachers: true },
            },
            liveSessions: {
              where: {
                status: { in: ['SCHEDULED', 'LIVE', 'COMPLETED'] },
                ...(periodClause
                  ? window.to &&
                    window.to < new Date(new Date().setHours(0, 0, 0, 0))
                    ? { startsAt: periodClause }
                    : {
                        OR: [
                          { startsAt: periodClause },
                          {
                            startsAt: { gte: new Date() },
                            status: { in: ['SCHEDULED', 'LIVE'] },
                          },
                        ],
                      }
                  : {}),
              },
              select: { startsAt: true, endsAt: true },
            },
          },
        });

        for (const t of teachers) {
          let totalMin = 0;
          for (const ls of t.liveSessions) {
            totalMin += Math.max(
              0,
              (ls.endsAt.getTime() - ls.startsAt.getTime()) / 60000,
            );
          }
          dataRows.push([
            t.employeeCode || '-',
            t.membership.user.fullName,
            t.membership.user.email || '',
            t.membership.user.phoneE164,
            t.specialization || 'General Theology',
            t.status,
            t._count.instructingCourses,
            t._count.batchTeachers,
            t.liveSessions.length,
            (Math.round((totalMin / 60) * 10) / 10).toFixed(1),
          ]);
        }
        break;
      }

      case 'transactions': {
        reportTitle = 'Financial Transactions Ledger Report';
        headers = [
          'Payment Number',
          'Invoice Number',
          'Student Name',
          'Admission No',
          'Course',
          'Payment Mode',
          'Reference / UTR',
          'Gross Amount (INR)',
          'Reversed (INR)',
          'Net Amount (INR)',
          'Status',
          'Transaction Date',
        ];
        const txs = await this.prisma.feePayment.findMany({
          where: {
            instituteId,
            ...(periodClause ? { paymentDate: periodClause } : {}),
          },
          orderBy: { paymentDate: 'desc' },
          include: {
            invoice: {
              include: {
                studentProfile: {
                  include: {
                    membership: { include: { user: true } },
                    enrolments: {
                      take: 1,
                      orderBy: { createdAt: 'desc' },
                      include: { course: { select: { title: true } } },
                    },
                  },
                },
              },
            },
          },
        });

        for (const tx of txs) {
          dataRows.push([
            tx.paymentNumber,
            tx.invoice.invoiceNumber,
            tx.invoice.studentProfile.membership.user.fullName,
            tx.invoice.studentProfile.admissionNo,
            tx.invoice.studentProfile.enrolments[0]?.course?.title || '-',
            tx.paymentMode,
            tx.referenceNumber || '',
            (tx.amount / 100).toFixed(2),
            (tx.reversedAmount / 100).toFixed(2),
            (tx.netAmount / 100).toFixed(2),
            tx.status,
            tx.paymentDate.toISOString(),
          ]);
        }
        break;
      }

      default:
        throw new BadRequestException(`Unsupported export type: ${reportType}`);
    }

    const csvLines: string[] = [
      this.toCsvLine(['Report Title', reportTitle]),
      this.toCsvLine(['Institute', institute.name]),
      this.toCsvLine(['Date Range', window.label]),
      this.toCsvLine(['Generated At', generatedAt]),
      '',
      this.toCsvLine(headers),
      ...dataRows.map((row) => this.toCsvLine(row)),
    ];

    const dateStamp = generatedAt.slice(0, 10);
    const filename = `${institute.slug}-${reportType}-report-${dateStamp}.csv`;

    return {
      filename,
      mimeType: 'text/csv;charset=utf-8',
      reportTitle,
      instituteName: institute.name,
      dateRangeLabel: window.label,
      generatedAt,
      rowCount: dataRows.length,
      csvContent: csvLines.join('\n'),
    };
  }

  /**
   * Determine allowed roles for a specific export report type.
   */
  getAllowedRolesForExport(reportType: ExportReportType): Role[] {
    switch (reportType) {
      case 'fee-collection':
      case 'pending-fees':
      case 'transactions':
        return [
          Role.SUPER_ADMIN,
          Role.INSTITUTE_ADMIN,
          Role.FINANCE_OFFICER,
        ];
      case 'enrollments':
      case 'attendance':
      case 'teacher-workload':
        return [
          Role.SUPER_ADMIN,
          Role.INSTITUTE_ADMIN,
          Role.ACADEMIC_COORDINATOR,
        ];
      default:
        return [Role.SUPER_ADMIN, Role.INSTITUTE_ADMIN];
    }
  }

  private mapPaymentToTransactionDto(p: any): TransactionItemDto {
    const latestEnrolment = p.invoice.studentProfile.enrolments?.[0];
    return {
      id: p.id,
      invoiceId: p.invoiceId,
      invoiceNumber: p.invoice.invoiceNumber,
      invoiceStatus: p.invoice.status,
      paymentNumber: p.paymentNumber,
      receiptNumber: p.receipt?.receiptNumber || null,
      studentId: p.invoice.studentProfile.id,
      admissionNo: p.invoice.studentProfile.admissionNo,
      studentName: p.invoice.studentProfile.membership.user.fullName,
      courseName: latestEnrolment?.course?.title,
      batchName: latestEnrolment?.batch?.name,
      amount: p.amount,
      reversedAmount: p.reversedAmount,
      netAmount: p.netAmount,
      paymentMode: p.paymentMode,
      paymentDate: p.paymentDate.toISOString(),
      status: p.status,
      referenceNumber: p.referenceNumber || null,
    };
  }

  private toCsvLine(cells: Array<string | number | null | undefined>): string {
    return cells
      .map((cell) => {
        const raw = cell === null || cell === undefined ? '' : String(cell);
        // Protect against spreadsheet formula injection on string values
        const sanitized =
          typeof cell === 'string' && /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
        if (/[",\n\r]/.test(sanitized)) {
          return `"${sanitized.replace(/"/g, '""')}"`;
        }
        return sanitized;
      })
      .join(',');
  }

  private buildMonthBuckets(
    anchorEnd: Date,
    months: number,
  ): Array<{ key: string; label: string; start: Date }> {
    const result: Array<{ key: string; label: string; start: Date }> = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(
        anchorEnd.getFullYear(),
        anchorEnd.getMonth() - i,
        1,
        0,
        0,
        0,
        0,
      );
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        '0',
      )}`;
      const label = d.toLocaleString('en-US', {
        month: 'short',
        year: 'numeric',
      });
      result.push({ key, label, start: d });
    }
    return result;
  }
}
