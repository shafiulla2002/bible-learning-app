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
      instituteId && instituteId !== 'null' && instituteId !== 'undefined' && instituteId !== 'inst-1'
        ? instituteId
        : ctx.instituteId;

    // 1. Summary KPIs from Invoice & FeePayment
    const invSummaryRows = await queryDb(
      `SELECT
         COALESCE(SUM(CASE WHEN status != 'CANCELLED' AND status != 'DRAFT' THEN "totalAmount" ELSE 0 END), 0)::bigint as "totalInvoicedPaise",
         COALESCE(SUM(CASE WHEN status != 'CANCELLED' THEN "paidAmount" ELSE 0 END), 0)::bigint as "totalPaidPaise",
         COALESCE(SUM(CASE WHEN status IN ('ISSUED', 'PARTIALLY_PAID', 'OVERDUE') THEN "balanceAmount" ELSE 0 END), 0)::bigint as "totalPendingPaise",
         COALESCE(SUM(CASE WHEN status = 'OVERDUE' OR (status IN ('ISSUED', 'PARTIALLY_PAID') AND "dueDate" < CURRENT_DATE) THEN "balanceAmount" ELSE 0 END), 0)::bigint as "overdueAmountPaise",
         COUNT(*)::int as "totalInvoicesCount",
         COUNT(CASE WHEN status = 'PAID' THEN 1 END)::int as "paidInvoicesCount",
         COUNT(CASE WHEN status IN ('ISSUED', 'PARTIALLY_PAID', 'OVERDUE') THEN 1 END)::int as "pendingInvoicesCount"
       FROM "Invoice"
       WHERE "instituteId" = $1`,
      [effectiveInstituteId]
    );
    const invSum = invSummaryRows[0] || {};

    // 2. Fee Categories
    const categories = await queryDb(
      `SELECT id, name, code, description, "isActive"
       FROM "FeeCategory"
       WHERE "instituteId" = $1
       ORDER BY name ASC`,
      [effectiveInstituteId]
    );

    // 3. Fee Structures
    const structures = await queryDb(
      `SELECT
         fs.id, fs.name, fs.code, fs."periodType", fs.amount, fs.currency,
         fs.description, fs."isActive",
         fc.id as "feeCategoryId", fc.name as "categoryName",
         ay.name as "academicYearName",
         (SELECT COUNT(*)::int FROM "StudentFeeAllocation" sfa WHERE sfa."feeStructureId" = fs.id) as "allocationsCount"
       FROM "FeeStructure" fs
       JOIN "FeeCategory" fc ON fc.id = fs."feeCategoryId"
       LEFT JOIN "AcademicYear" ay ON ay.id = fs."academicYearId"
       WHERE fs."instituteId" = $1
       ORDER BY fs."createdAt" DESC`,
      [effectiveInstituteId]
    );

    // 4. Invoices
    const invoices = await queryDb(
      `SELECT
         inv.id, inv."invoiceNumber", inv.status, inv."issueDate", inv."dueDate",
         inv."totalAmount", inv."paidAmount", inv."balanceAmount", inv.currency, inv.notes,
         sp.id as "studentProfileId", sp."admissionNo",
         u."fullName" as "studentName", u."phoneE164" as "studentPhone"
       FROM "Invoice" inv
       JOIN "StudentProfile" sp ON sp.id = inv."studentProfileId"
       JOIN "Membership" m ON m.id = sp."membershipId"
       JOIN "User" u ON u.id = m."userId"
       WHERE inv."instituteId" = $1
       ORDER BY inv."createdAt" DESC
       LIMIT 100`,
      [effectiveInstituteId]
    );

    // 5. Payments & Receipts
    const payments = await queryDb(
      `SELECT
         fp.id, fp."paymentNumber", fp.amount, fp."reversedAmount", fp."netAmount",
         fp."paymentMode", fp."paymentDate", fp.status, fp."referenceNumber", fp.remarks,
         inv.id as "invoiceId", inv."invoiceNumber",
         sp.id as "studentProfileId", sp."admissionNo",
         u."fullName" as "studentName",
         fr."receiptNumber"
       FROM "FeePayment" fp
       JOIN "Invoice" inv ON inv.id = fp."invoiceId"
       JOIN "StudentProfile" sp ON sp.id = inv."studentProfileId"
       JOIN "Membership" m ON m.id = sp."membershipId"
       JOIN "User" u ON u.id = m."userId"
       LEFT JOIN "FeeReceipt" fr ON fr."paymentId" = fp.id
       WHERE fp."instituteId" = $1
       ORDER BY fp."paymentDate" DESC
       LIMIT 100`,
      [effectiveInstituteId]
    );

    return NextResponse.json({
      summary: {
        totalInvoicedPaise: Number(invSum.totalInvoicedPaise || 0),
        totalPaidPaise: Number(invSum.totalPaidPaise || 0),
        totalPendingPaise: Number(invSum.totalPendingPaise || 0),
        overdueAmountPaise: Number(invSum.overdueAmountPaise || 0),
        totalInvoicesCount: Number(invSum.totalInvoicesCount || 0),
        paidInvoicesCount: Number(invSum.paidInvoicesCount || 0),
        pendingInvoicesCount: Number(invSum.pendingInvoicesCount || 0),
      },
      categories,
      structures,
      invoices: invoices.map((i) => ({
        ...i,
        issueDate: i.issueDate ? new Date(i.issueDate).toISOString().split('T')[0] : null,
        dueDate: i.dueDate ? new Date(i.dueDate).toISOString().split('T')[0] : null,
      })),
      payments: payments.map((p) => ({
        ...p,
        paymentDate: p.paymentDate ? new Date(p.paymentDate).toISOString() : null,
      })),
    });
  } catch (error: any) {
    console.error('Error in /institutes/[instituteId]/finance/overview GET:', error);
    return NextResponse.json(
      { message: error?.message || 'Failed to fetch finance overview' },
      { status: 500 }
    );
  }
}

