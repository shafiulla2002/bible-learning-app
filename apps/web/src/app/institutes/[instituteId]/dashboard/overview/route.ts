import { NextRequest, NextResponse } from 'next/server';
import { queryDb, resolveServerAdminContext, getServerRouteCache, setServerRouteCache } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ instituteId: string }> }
) {
  try {
    const { instituteId } = await params;
    const { searchParams } = new URL(request.url);
    const presetParam = (searchParams.get('preset') || '30D').toUpperCase();

    // Fast-path instituteId resolution
    let effectiveInstituteId = instituteId && instituteId !== 'null' && instituteId !== 'undefined'
      ? instituteId
      : '';

    let ctx: any = null;
    if (!effectiveInstituteId) {
      ctx = await resolveServerAdminContext();
      effectiveInstituteId = ctx.instituteId;
    }

    // Server-side cache lookup (institute and preset scoped)
    const cacheKey = `dashboard:overview:${effectiveInstituteId}:${presetParam}`;
    const cached = getServerRouteCache<any>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // Determine enrolment trend query based on preset
    let dateFilterLabel = 'Last 30 Days (Database Live)';
    let trendSql = '';
    if (presetParam === '7D') {
      dateFilterLabel = 'Last 7 Days (Database Live)';
      trendSql = `SELECT
           TO_CHAR(d.day, 'YYYY-MM-DD') as month,
           TO_CHAR(d.day, 'Dy DD') as label,
           COALESCE(e.count, 0)::int as count,
           COALESCE(sp.registrations, 0)::int as registrations,
           COALESCE(sp."leftCount", 0)::int as "leftCount"
         FROM GENERATE_SERIES(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, '1 day'::interval) d(day)
         LEFT JOIN (
           SELECT "createdAt"::date as day, COUNT(id) as count
           FROM "Enrolment" WHERE "instituteId" = $1 GROUP BY "createdAt"::date
         ) e ON e.day = d.day::date
         LEFT JOIN (
           SELECT "createdAt"::date as day, COUNT(id) as registrations,
                  COUNT(CASE WHEN status = 'INACTIVE' THEN 1 END) as "leftCount"
           FROM "StudentProfile" WHERE "instituteId" = $1 GROUP BY "createdAt"::date
         ) sp ON sp.day = d.day::date
         ORDER BY d.day ASC`;
    } else if (presetParam === 'THIS_MONTH') {
      dateFilterLabel = 'This Month (Database Live)';
      trendSql = `SELECT
           TO_CHAR(d.day, 'YYYY-MM-DD') as month,
           TO_CHAR(d.day, 'DD Mon') as label,
           COALESCE(e.count, 0)::int as count,
           COALESCE(sp.registrations, 0)::int as registrations,
           COALESCE(sp."leftCount", 0)::int as "leftCount"
         FROM GENERATE_SERIES(DATE_TRUNC('month', CURRENT_DATE), CURRENT_DATE, '1 day'::interval) d(day)
         LEFT JOIN (
           SELECT "createdAt"::date as day, COUNT(id) as count
           FROM "Enrolment" WHERE "instituteId" = $1 GROUP BY "createdAt"::date
         ) e ON e.day = d.day::date
         LEFT JOIN (
           SELECT "createdAt"::date as day, COUNT(id) as registrations,
                  COUNT(CASE WHEN status = 'INACTIVE' THEN 1 END) as "leftCount"
           FROM "StudentProfile" WHERE "instituteId" = $1 GROUP BY "createdAt"::date
         ) sp ON sp.day = d.day::date
         ORDER BY d.day ASC`;
    } else {
      dateFilterLabel = presetParam === 'ALL' ? 'All Time (Database Live)' : 'Last 30 Days (Database Live)';
      trendSql = `SELECT
           TO_CHAR(e."createdAt", 'YYYY-MM') as month,
           TO_CHAR(e."createdAt", 'Mon') as label,
           COUNT(e.id)::int as count,
           COUNT(DISTINCT sp.id)::int as registrations,
           COUNT(CASE WHEN e.status = 'REVOKED' OR sp.status = 'INACTIVE' THEN 1 END)::int as "leftCount"
         FROM "Enrolment" e
         JOIN "StudentProfile" sp ON sp.id = e."studentProfileId"
         WHERE e."instituteId" = $1
         GROUP BY TO_CHAR(e."createdAt", 'YYYY-MM'), TO_CHAR(e."createdAt", 'Mon')
         ORDER BY month ASC
         LIMIT 6`;
    }

    // Consolidated database query bundle in parallel
    const [
      instRows,
      kpiRows,
      courseDistRows,
      enrolmentTrendRows,
      financialTrendRows,
      recentPaymentsRows,
      resolvedCtx,
    ] = await Promise.all([
      // 1. Institute Info
      queryDb(
        `SELECT i.id, i.name, i.slug, i.timezone, i.currency, i."logoUrl", s.branding
         FROM "Institute" i
         LEFT JOIN "InstituteSettings" s ON s."instituteId" = i.id
         WHERE i.id = $1`,
        [effectiveInstituteId]
      ),
      // 2. High-Performance Consolidated KPI Summary (Single round-trip scalar subquery bundle)
      queryDb(
        `SELECT
           (SELECT COUNT(*)::int FROM "StudentProfile" WHERE "instituteId" = $1) as "totalStudents",
           (SELECT COUNT(*)::int FROM "StudentProfile" WHERE "instituteId" = $1 AND status = 'ACTIVE') as "activeStudents",
           (SELECT COUNT(*)::int FROM "Admission" WHERE "instituteId" = $1 AND status IN ('APPLIED', 'UNDER_REVIEW')) as "pendingAdmissions",
           (SELECT COUNT(*)::int FROM "TeacherProfile" WHERE "instituteId" = $1) as "totalTeachers",
           (SELECT COUNT(*)::int FROM "TeacherProfile" WHERE "instituteId" = $1 AND status = 'ACTIVE') as "activeTeachers",
           (SELECT COUNT(*)::int FROM "TeacherProfile" WHERE "instituteId" = $1 AND status = 'ON_LEAVE') as "onLeaveTeachers",
           (SELECT COUNT(*)::int FROM "Course" WHERE "instituteId" = $1) as "totalCourses",
           (SELECT COUNT(*)::int FROM "Course" WHERE "instituteId" = $1 AND status = 'PUBLISHED') as "publishedCourses",
           (SELECT COUNT(*)::int FROM "Course" WHERE "instituteId" = $1 AND status = 'DRAFT') as "draftCourses",
           (SELECT COUNT(*)::int FROM "Batch" WHERE "instituteId" = $1) as "totalBatches",
           (SELECT COUNT(*)::int FROM "Batch" WHERE "instituteId" = $1 AND status = 'ACTIVE') as "activeBatches",
           (SELECT COALESCE(SUM("netAmount"), 0)::bigint FROM "FeePayment" WHERE "instituteId" = $1 AND status = 'COMPLETED') as "totalCollected",
           (SELECT COALESCE(SUM("balanceAmount"), 0)::bigint FROM "Invoice" WHERE "instituteId" = $1) as "totalPending",
           (SELECT COALESCE(SUM(CASE WHEN "dueDate" < CURRENT_DATE AND status != 'PAID' THEN "balanceAmount" ELSE 0 END), 0)::bigint FROM "Invoice" WHERE "instituteId" = $1) as "overdueAmount",
           (SELECT COUNT(*)::int FROM "Invoice" WHERE "instituteId" = $1 AND status IN ('ISSUED', 'PARTIALLY_PAID')) as "pendingInvoicesCount",
           (SELECT COUNT(*)::int FROM "Attendance" WHERE "instituteId" = $1) as "totalAttendanceRecords",
           (SELECT COUNT(*)::int FROM "Attendance" WHERE "instituteId" = $1 AND status = 'PRESENT') as "presentAttendanceCount",
           (SELECT COUNT(*)::int FROM "LiveSession" WHERE "instituteId" = $1 AND "startsAt" >= NOW()) as "upcomingSessionsCount",
           (SELECT COUNT(*)::int FROM "LiveSession" WHERE "instituteId" = $1 AND "startsAt"::date = CURRENT_DATE) as "sessionsTodayCount"`,
        [effectiveInstituteId]
      ),
      // 3. Course Distribution (Top courses)
      queryDb(
        `SELECT
           c.id as "courseId",
           c.title as "courseTitle",
           c.status,
           COUNT(e.id)::int as "studentCount"
         FROM "Course" c
         LEFT JOIN "Enrolment" e ON e."courseId" = c.id AND e.status = 'ACTIVE'
         WHERE c."instituteId" = $1
         GROUP BY c.id, c.title, c.status
         ORDER BY "studentCount" DESC, c.title ASC
         LIMIT 10`,
        [effectiveInstituteId]
      ),
      // 4. Enrolment Trend
      queryDb(trendSql, [effectiveInstituteId]),
      // 5. Financial Trend (Last 6 months)
      queryDb(
        `SELECT
           TO_CHAR("paymentDate", 'YYYY-MM') as month,
           TO_CHAR("paymentDate", 'Mon') as label,
           SUM("netAmount")::bigint as collected,
           0::bigint as pending
         FROM "FeePayment"
         WHERE "instituteId" = $1 AND status = 'COMPLETED'
         GROUP BY TO_CHAR("paymentDate", 'YYYY-MM'), TO_CHAR("paymentDate", 'Mon')
         ORDER BY month ASC
         LIMIT 6`,
        [effectiveInstituteId]
      ),
      // 6. Recent Payments (Optimized without cartesian enrolment duplicate join)
      queryDb(
        `SELECT
           p.id,
           p."paymentNumber",
           p.amount,
           p."netAmount",
           p."paymentMode",
           p.status,
           p."referenceNumber",
           p."paymentDate",
           r."receiptNumber",
           inv."invoiceNumber",
           sp."admissionNo",
           u."fullName" as "studentName",
           COALESCE(inv.title, 'Tuition & Academic Fees') as "courseName"
         FROM "FeePayment" p
         LEFT JOIN "FeeReceipt" r ON r."paymentId" = p.id
         LEFT JOIN "Invoice" inv ON inv.id = p."invoiceId"
         LEFT JOIN "StudentProfile" sp ON sp.id = inv."studentProfileId"
         LEFT JOIN "Membership" m ON m.id = sp."membershipId"
         LEFT JOIN "User" u ON u.id = m."userId"
         WHERE p."instituteId" = $1 AND p.status = 'COMPLETED'
         ORDER BY p."paymentDate" DESC
         LIMIT 10`,
        [effectiveInstituteId]
      ),
      // 7. Context if not already fetched
      ctx ? Promise.resolve(ctx) : resolveServerAdminContext(),
    ]);

    const adminCtx = resolvedCtx || ctx;
    const inst = instRows[0] || {
      id: effectiveInstituteId,
      name: adminCtx.name,
      slug: adminCtx.instituteSlug,
      timezone: adminCtx.timezone,
      currency: adminCtx.currency,
      logoUrl: adminCtx.logoUrl,
      branding: {
        instituteName: adminCtx.displayName,
        primaryColor: adminCtx.primaryColor,
        secondaryColor: adminCtx.secondaryColor,
        accentColor: adminCtx.accentColor,
      },
    };
    const branding = inst.branding || {};

    const kpi = kpiRows[0] || {};
    const totalStudents = kpi.totalStudents || 0;
    const activeStudents = kpi.activeStudents || 0;
    const pendingAdmissionsCount = kpi.pendingAdmissions || 0;
    const totalTeachers = kpi.totalTeachers || 0;
    const activeTeachers = kpi.activeTeachers || 0;
    const onLeaveTeachers = kpi.onLeaveTeachers || 0;
    const totalCourses = kpi.totalCourses || 0;
    const publishedCourses = kpi.publishedCourses || 0;
    const draftCourses = kpi.draftCourses || 0;
    const totalBatches = kpi.totalBatches || 0;
    const activeBatches = kpi.activeBatches || 0;

    const totalFeeCollected = Number(kpi.totalCollected || 0);
    const totalFeePending = Number(kpi.totalPending || 0);
    const overdueFeeAmount = Number(kpi.overdueAmount || 0);
    const pendingInvoicesCount = kpi.pendingInvoicesCount || 0;

    const totalAttRecords = kpi.totalAttendanceRecords || 0;
    const presentAttCount = kpi.presentAttendanceCount || 0;
    const attendancePercentage =
      totalAttRecords > 0 ? Math.round((presentAttCount / totalAttRecords) * 100) : null;

    const upcomingSessionsCount = kpi.upcomingSessionsCount || 0;
    const sessionsTodayCount = kpi.sessionsTodayCount || 0;

    const enrolmentTrend =
      enrolmentTrendRows.length > 0
        ? enrolmentTrendRows
        : [
            {
              month: new Date().toISOString().slice(0, 7),
              label: new Date().toLocaleString('default', { month: 'short' }),
              count: totalStudents,
              registrations: totalStudents,
              leftCount: 0,
            },
          ];

    const financialTrend =
      financialTrendRows.length > 0
        ? financialTrendRows.map((r: any) => ({
            month: r.month,
            label: r.label,
            collected: Number(r.collected),
            pending: totalFeePending,
          }))
        : [
            {
              month: new Date().toISOString().slice(0, 7),
              label: new Date().toLocaleString('default', { month: 'short' }),
              collected: totalFeeCollected,
              pending: totalFeePending,
            },
          ];

    const recentPayments = recentPaymentsRows.map((p: any) => ({
      id: p.id,
      paymentNumber: p.paymentNumber,
      receiptNumber: p.receiptNumber || '—',
      studentId: p.admissionNo || '—',
      studentName: p.studentName || 'Student',
      admissionNo: p.admissionNo || '—',
      courseName: p.courseName || 'General Program',
      invoiceId: p.invoiceNumber || '—',
      invoiceNumber: p.invoiceNumber || '—',
      amount: Number(p.netAmount || p.amount || 0),
      paymentMode: p.paymentMode || 'ONLINE',
      referenceNumber: p.referenceNumber || '—',
      status: p.status || 'COMPLETED',
      paymentDate: p.paymentDate ? new Date(p.paymentDate).toISOString() : new Date().toISOString(),
    }));

    const payload = {
      institute: {
        id: inst.id,
        name: inst.name,
        displayName: branding.instituteName || inst.name,
        code: (inst.slug || 'INST').toUpperCase(),
        currency: inst.currency || 'INR',
        timezone: inst.timezone || 'Asia/Kolkata',
        logoUrl: inst.logoUrl,
        primaryColor: branding.primaryColor || '#1e3a8a',
        secondaryColor: branding.secondaryColor || '#3b82f6',
        accentColor: branding.accentColor || '#10b981',
      },
      viewer: {
        userId: adminCtx.user.userId,
        fullName: adminCtx.user.fullName,
        role: adminCtx.user.role,
      },
      dateFilter: {
        preset: presetParam,
        label: dateFilterLabel,
        from: null,
        to: null,
        previousFrom: null,
        previousTo: null,
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
        totalFeePending,
        overdueFeeAmount,
        pendingInvoicesCount,
        upcomingSessionsCount,
        sessionsTodayCount,
        attendancePercentage,
        comparisons: {
          studentsRegistered: {
            periodValue: totalStudents,
            previousPeriodValue: null,
            changePct: null,
            direction: 'NONE',
            periodLabel: 'Live Database',
          },
          feeCollection: {
            periodValue: totalFeeCollected,
            previousPeriodValue: null,
            changePct: null,
            direction: 'NONE',
            periodLabel: 'Live Database',
          },
          enrolments: {
            periodValue: totalStudents,
            previousPeriodValue: null,
            changePct: null,
            direction: 'NONE',
            periodLabel: 'Live Database',
          },
        },
      },
      enrolmentTrend,
      financialTrend,
      courseDistribution: courseDistRows.map((c: any) => ({
        courseId: c.courseId,
        courseTitle: c.courseTitle,
        studentCount: c.studentCount,
      })),
      recentAdmissions: [],
      upcomingSessions: [],
      recentPayments,
    };

    // Cache safe summary (20s TTL)
    setServerRouteCache(cacheKey, payload, 20000);

    return NextResponse.json(payload);
  } catch (error: any) {
    console.error('Error in /institutes/[instituteId]/dashboard/overview route:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch dashboard overview' },
      { status: 500 }
    );
  }
}
