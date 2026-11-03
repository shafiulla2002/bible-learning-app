import { NextRequest, NextResponse } from 'next/server';
import { queryDb, resolveServerAdminContext } from '@/lib/server-db';

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

    // Determine enrolment trend query based on preset
    let dateFilterLabel = 'Last 30 Days (Database Live)';
    let trendSql = '';
    if (presetParam === '7D') {
      dateFilterLabel = 'Last 7 Days (Database Live)';
      trendSql = `SELECT
           TO_CHAR(d.day, 'YYYY-MM-DD') as month,
           TO_CHAR(d.day, 'Dy DD') as label,
           COALESCE(COUNT(e.id), 0)::int as count,
           COALESCE(COUNT(DISTINCT sp.id), 0)::int as registrations,
           COALESCE(COUNT(CASE WHEN sp.status = 'INACTIVE' THEN 1 END), 0)::int as "leftCount"
         FROM GENERATE_SERIES(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, '1 day'::interval) d(day)
         LEFT JOIN "StudentProfile" sp ON sp."instituteId" = $1 AND sp."createdAt"::date = d.day::date
         LEFT JOIN "Enrolment" e ON e."instituteId" = $1 AND e."createdAt"::date = d.day::date
         GROUP BY d.day
         ORDER BY d.day ASC`;
    } else if (presetParam === 'THIS_MONTH') {
      dateFilterLabel = 'This Month (Database Live)';
      trendSql = `SELECT
           TO_CHAR(d.day, 'YYYY-MM-DD') as month,
           TO_CHAR(d.day, 'DD Mon') as label,
           COALESCE(COUNT(e.id), 0)::int as count,
           COALESCE(COUNT(DISTINCT sp.id), 0)::int as registrations,
           COALESCE(COUNT(CASE WHEN sp.status = 'INACTIVE' THEN 1 END), 0)::int as "leftCount"
         FROM GENERATE_SERIES(DATE_TRUNC('month', CURRENT_DATE), CURRENT_DATE, '1 day'::interval) d(day)
         LEFT JOIN "StudentProfile" sp ON sp."instituteId" = $1 AND sp."createdAt"::date = d.day::date
         LEFT JOIN "Enrolment" e ON e."instituteId" = $1 AND e."createdAt"::date = d.day::date
         GROUP BY d.day
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

    // Execute ALL independent DB queries in parallel
    const [
      instRows,
      studentStats,
      admissionStats,
      teacherStats,
      courseStats,
      batchStats,
      paymentStats,
      invoiceStats,
      attendanceStats,
      sessionStats,
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
      // 2. Students
      queryDb(
        `SELECT
           COUNT(*)::int as "totalStudents",
           COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END)::int as "activeStudents"
         FROM "StudentProfile"
         WHERE "instituteId" = $1`,
        [effectiveInstituteId]
      ),
      // 3. Pending Admissions
      queryDb(
        `SELECT COUNT(*)::int as "pendingAdmissions"
         FROM "Admission"
         WHERE "instituteId" = $1 AND status IN ('APPLIED', 'UNDER_REVIEW')`,
        [effectiveInstituteId]
      ),
      // 4. Teachers
      queryDb(
        `SELECT
           COUNT(*)::int as "totalTeachers",
           COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END)::int as "activeTeachers",
           COUNT(CASE WHEN status = 'ON_LEAVE' THEN 1 END)::int as "onLeaveTeachers"
         FROM "TeacherProfile"
         WHERE "instituteId" = $1`,
        [effectiveInstituteId]
      ),
      // 5. Courses
      queryDb(
        `SELECT
           COUNT(*)::int as "totalCourses",
           COUNT(CASE WHEN status = 'PUBLISHED' THEN 1 END)::int as "publishedCourses",
           COUNT(CASE WHEN status = 'DRAFT' THEN 1 END)::int as "draftCourses"
         FROM "Course"
         WHERE "instituteId" = $1`,
        [effectiveInstituteId]
      ),
      // 6. Batches
      queryDb(
        `SELECT
           COUNT(*)::int as "totalBatches",
           COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END)::int as "activeBatches"
         FROM "Batch"
         WHERE "instituteId" = $1`,
        [effectiveInstituteId]
      ),
      // 7. Finance (Payments)
      queryDb(
        `SELECT COALESCE(SUM("netAmount"), 0)::bigint as "totalCollected"
         FROM "FeePayment"
         WHERE "instituteId" = $1 AND status = 'COMPLETED'`,
        [effectiveInstituteId]
      ),
      // 8. Finance (Invoices)
      queryDb(
        `SELECT
           COALESCE(SUM("balanceAmount"), 0)::bigint as "totalPending",
           COALESCE(SUM(CASE WHEN "dueDate" < CURRENT_DATE AND status != 'PAID' THEN "balanceAmount" ELSE 0 END), 0)::bigint as "overdueAmount",
           COUNT(CASE WHEN status IN ('ISSUED', 'PARTIALLY_PAID') THEN 1 END)::int as "pendingInvoicesCount"
         FROM "Invoice"
         WHERE "instituteId" = $1`,
        [effectiveInstituteId]
      ),
      // 9. Attendance
      queryDb(
        `SELECT
           COUNT(*)::int as "totalRecords",
           COUNT(CASE WHEN status = 'PRESENT' THEN 1 END)::int as "presentCount"
         FROM "Attendance"
         WHERE "instituteId" = $1`,
        [effectiveInstituteId]
      ),
      // 10. Sessions
      queryDb(
        `SELECT
           COUNT(CASE WHEN "startsAt" >= NOW() THEN 1 END)::int as "upcomingCount",
           COUNT(CASE WHEN "startsAt"::date = CURRENT_DATE THEN 1 END)::int as "todayCount"
         FROM "LiveSession"
         WHERE "instituteId" = $1`,
        [effectiveInstituteId]
      ),
      // 11. Course Distribution
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
         ORDER BY "studentCount" DESC, c.title ASC`,
        [effectiveInstituteId]
      ),
      // 12. Enrolment Trend
      queryDb(trendSql, [effectiveInstituteId]),
      // 13. Financial Trend
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
      // 14. Recent Payments
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
           c.title as "courseName"
         FROM "FeePayment" p
         LEFT JOIN "FeeReceipt" r ON r."paymentId" = p.id
         LEFT JOIN "Invoice" inv ON inv.id = p."invoiceId"
         LEFT JOIN "StudentProfile" sp ON sp.id = inv."studentProfileId"
         LEFT JOIN "Membership" m ON m.id = sp."membershipId"
         LEFT JOIN "User" u ON u.id = m."userId"
         LEFT JOIN "Enrolment" e ON e."studentProfileId" = sp.id
         LEFT JOIN "Course" c ON c.id = e."courseId"
         WHERE p."instituteId" = $1 AND p.status = 'COMPLETED'
         ORDER BY p."paymentDate" DESC
         LIMIT 10`,
        [effectiveInstituteId]
      ),
      // 15. Context if not already fetched
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

    const totalStudents = studentStats[0]?.totalStudents || 0;
    const activeStudents = studentStats[0]?.activeStudents || 0;
    const pendingAdmissionsCount = admissionStats[0]?.pendingAdmissions || 0;
    const totalTeachers = teacherStats[0]?.totalTeachers || 0;
    const activeTeachers = teacherStats[0]?.activeTeachers || 0;
    const onLeaveTeachers = teacherStats[0]?.onLeaveTeachers || 0;
    const totalCourses = courseStats[0]?.totalCourses || 0;
    const publishedCourses = courseStats[0]?.publishedCourses || 0;
    const draftCourses = courseStats[0]?.draftCourses || 0;
    const totalBatches = batchStats[0]?.totalBatches || 0;
    const activeBatches = batchStats[0]?.activeBatches || 0;

    const totalFeeCollected = Number(paymentStats[0]?.totalCollected || 0);
    const totalFeePending = Number(invoiceStats[0]?.totalPending || 0);
    const overdueFeeAmount = Number(invoiceStats[0]?.overdueAmount || 0);
    const pendingInvoicesCount = invoiceStats[0]?.pendingInvoicesCount || 0;

    const totalAttRecords = attendanceStats[0]?.totalRecords || 0;
    const presentAttCount = attendanceStats[0]?.presentCount || 0;
    const attendancePercentage =
      totalAttRecords > 0 ? Math.round((presentAttCount / totalAttRecords) * 100) : null;

    const upcomingSessionsCount = sessionStats[0]?.upcomingCount || 0;
    const sessionsTodayCount = sessionStats[0]?.todayCount || 0;

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

    return NextResponse.json({
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
    });
  } catch (error: any) {
    console.error('Error in /institutes/[instituteId]/dashboard/overview route:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch dashboard overview' },
      { status: 500 }
    );
  }
}
