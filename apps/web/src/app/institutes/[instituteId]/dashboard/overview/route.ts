import { NextRequest, NextResponse } from 'next/server';
import { queryDb, resolveServerAdminContext } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ instituteId: string }> }
) {
  try {
    const { instituteId } = await params;
    const ctx = await resolveServerAdminContext();
    const effectiveInstituteId =
      instituteId && instituteId !== 'null' && instituteId !== 'undefined'
        ? instituteId
        : ctx.instituteId;

    // 1. Institute Info
    const instRows = await queryDb(
      `SELECT i.id, i.name, i.slug, i.timezone, i.currency, i."logoUrl",
              s.branding
       FROM "Institute" i
       LEFT JOIN "InstituteSettings" s ON s."instituteId" = i.id
       WHERE i.id = $1`,
      [effectiveInstituteId]
    );

    const inst = instRows[0] || {
      id: effectiveInstituteId,
      name: ctx.name,
      slug: ctx.instituteSlug,
      timezone: ctx.timezone,
      currency: ctx.currency,
      logoUrl: ctx.logoUrl,
      branding: {
        instituteName: ctx.displayName,
        primaryColor: ctx.primaryColor,
        secondaryColor: ctx.secondaryColor,
        accentColor: ctx.accentColor,
      },
    };
    const branding = inst.branding || {};

    // 2. Real KPI Counts from PostgreSQL
    // Students
    const studentStats = await queryDb(
      `SELECT
         COUNT(*)::int as "totalStudents",
         COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END)::int as "activeStudents"
       FROM "StudentProfile"
       WHERE "instituteId" = $1`,
      [effectiveInstituteId]
    );
    const totalStudents = studentStats[0]?.totalStudents || 0;
    const activeStudents = studentStats[0]?.activeStudents || 0;

    // Pending Admissions
    const admissionStats = await queryDb(
      `SELECT COUNT(*)::int as "pendingAdmissions"
       FROM "Admission"
       WHERE "instituteId" = $1 AND status IN ('APPLIED', 'UNDER_REVIEW')`,
      [effectiveInstituteId]
    );
    const pendingAdmissionsCount = admissionStats[0]?.pendingAdmissions || 0;

    // Teachers
    const teacherStats = await queryDb(
      `SELECT
         COUNT(*)::int as "totalTeachers",
         COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END)::int as "activeTeachers",
         COUNT(CASE WHEN status = 'ON_LEAVE' THEN 1 END)::int as "onLeaveTeachers"
       FROM "TeacherProfile"
       WHERE "instituteId" = $1`,
      [effectiveInstituteId]
    );
    const totalTeachers = teacherStats[0]?.totalTeachers || 0;
    const activeTeachers = teacherStats[0]?.activeTeachers || 0;
    const onLeaveTeachers = teacherStats[0]?.onLeaveTeachers || 0;

    // Courses
    const courseStats = await queryDb(
      `SELECT
         COUNT(*)::int as "totalCourses",
         COUNT(CASE WHEN status = 'PUBLISHED' THEN 1 END)::int as "publishedCourses",
         COUNT(CASE WHEN status = 'DRAFT' THEN 1 END)::int as "draftCourses"
       FROM "Course"
       WHERE "instituteId" = $1`,
      [effectiveInstituteId]
    );
    const totalCourses = courseStats[0]?.totalCourses || 0;
    const publishedCourses = courseStats[0]?.publishedCourses || 0;
    const draftCourses = courseStats[0]?.draftCourses || 0;

    // Batches
    const batchStats = await queryDb(
      `SELECT
         COUNT(*)::int as "totalBatches",
         COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END)::int as "activeBatches"
       FROM "Batch"
       WHERE "instituteId" = $1`,
      [effectiveInstituteId]
    );
    const totalBatches = batchStats[0]?.totalBatches || 0;
    const activeBatches = batchStats[0]?.activeBatches || 0;

    // Finance (Invoices & Payments in paise)
    const paymentStats = await queryDb(
      `SELECT COALESCE(SUM("netAmount"), 0)::bigint as "totalCollected"
       FROM "FeePayment"
       WHERE "instituteId" = $1 AND status = 'COMPLETED'`,
      [effectiveInstituteId]
    );
    const totalFeeCollected = Number(paymentStats[0]?.totalCollected || 0);

    const invoiceStats = await queryDb(
      `SELECT
         COALESCE(SUM("balanceAmount"), 0)::bigint as "totalPending",
         COALESCE(SUM(CASE WHEN "dueDate" < CURRENT_DATE AND status != 'PAID' THEN "balanceAmount" ELSE 0 END), 0)::bigint as "overdueAmount",
         COUNT(CASE WHEN status IN ('ISSUED', 'PARTIALLY_PAID') THEN 1 END)::int as "pendingInvoicesCount"
       FROM "Invoice"
       WHERE "instituteId" = $1`,
      [effectiveInstituteId]
    );
    const totalFeePending = Number(invoiceStats[0]?.totalPending || 0);
    const overdueFeeAmount = Number(invoiceStats[0]?.overdueAmount || 0);
    const pendingInvoicesCount = invoiceStats[0]?.pendingInvoicesCount || 0;

    // Attendance
    const attendanceStats = await queryDb(
      `SELECT
         COUNT(*)::int as "totalRecords",
         COUNT(CASE WHEN status = 'PRESENT' THEN 1 END)::int as "presentCount"
       FROM "Attendance"
       WHERE "instituteId" = $1`,
      [effectiveInstituteId]
    );
    const totalAttRecords = attendanceStats[0]?.totalRecords || 0;
    const presentAttCount = attendanceStats[0]?.presentCount || 0;
    const attendancePercentage =
      totalAttRecords > 0 ? Math.round((presentAttCount / totalAttRecords) * 100) : null;

    // Sessions
    const sessionStats = await queryDb(
      `SELECT
         COUNT(CASE WHEN "startsAt" >= NOW() THEN 1 END)::int as "upcomingCount",
         COUNT(CASE WHEN "startsAt"::date = CURRENT_DATE THEN 1 END)::int as "todayCount"
       FROM "LiveSession"
       WHERE "instituteId" = $1`,
      [effectiveInstituteId]
    );
    const upcomingSessionsCount = sessionStats[0]?.upcomingCount || 0;
    const sessionsTodayCount = sessionStats[0]?.todayCount || 0;

    // 3. Course Distribution
    const courseDistRows = await queryDb(
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
    );

    // 4. Monthly Enrolment Trend (Real monthly grouping)
    const enrolmentTrendRows = await queryDb(
      `SELECT
         TO_CHAR("createdAt", 'YYYY-MM') as month,
         TO_CHAR("createdAt", 'Mon') as label,
         COUNT(*)::int as count,
         COUNT(*)::int as registrations
       FROM "Enrolment"
       WHERE "instituteId" = $1
       GROUP BY TO_CHAR("createdAt", 'YYYY-MM'), TO_CHAR("createdAt", 'Mon')
       ORDER BY month ASC
       LIMIT 6`,
      [effectiveInstituteId]
    );

    const enrolmentTrend =
      enrolmentTrendRows.length > 0
        ? enrolmentTrendRows
        : [
            {
              month: new Date().toISOString().slice(0, 7),
              label: new Date().toLocaleString('default', { month: 'short' }),
              count: totalStudents,
              registrations: totalStudents,
            },
          ];

    // 5. Monthly Financial Trend
    const financialTrendRows = await queryDb(
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
    );

    const financialTrend =
      financialTrendRows.length > 0
        ? financialTrendRows.map((r) => ({
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

    // 6. Recent Payments
    const recentPaymentsRows = await queryDb(
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
       WHERE p."instituteId" = $1
       ORDER BY p."paymentDate" DESC
       LIMIT 5`,
      [effectiveInstituteId]
    );

    const recentPayments = recentPaymentsRows.map((r) => ({
      id: r.id,
      paymentNumber: r.paymentNumber,
      receiptNumber: r.receiptNumber || `REC-${r.paymentNumber}`,
      studentId: r.admissionNo,
      studentName: r.studentName || 'Student',
      admissionNo: r.admissionNo || '—',
      courseName: r.courseName || 'Theology Course',
      invoiceId: r.invoiceNumber,
      invoiceNumber: r.invoiceNumber || '—',
      amount: Number(r.amount),
      netAmount: Number(r.netAmount),
      paymentMode: r.paymentMode,
      referenceNumber: r.referenceNumber,
      status: r.status,
      paymentDate: r.paymentDate ? new Date(r.paymentDate).toISOString() : new Date().toISOString(),
    }));

    return NextResponse.json({
      institute: {
        id: inst.id,
        name: inst.name,
        displayName: branding.instituteName || inst.name,
        code: inst.slug.toUpperCase(),
        currency: inst.currency || 'INR',
        timezone: inst.timezone || 'Asia/Kolkata',
        logoUrl: inst.logoUrl,
        primaryColor: branding.primaryColor || '#1e3a8a',
        secondaryColor: branding.secondaryColor || '#3b82f6',
        accentColor: branding.accentColor || '#10b981',
      },
      viewer: {
        userId: ctx.user.userId,
        fullName: ctx.user.fullName,
        role: ctx.user.role,
      },
      dateFilter: {
        preset: '30D',
        label: 'Last 30 Days (Database Live)',
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
      courseDistribution: courseDistRows.map((c) => ({
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
