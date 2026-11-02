import { NextRequest, NextResponse } from 'next/server';
import { queryDb, resolveServerAdminContext } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ instituteId: string; id: string }> }
) {
  try {
    const { instituteId, id: studentProfileId } = await params;
    const ctx = await resolveServerAdminContext();
    const effectiveInstituteId =
      instituteId && instituteId !== 'null' && instituteId !== 'undefined'
        ? instituteId
        : ctx.instituteId;

    // 1. Invoices summary
    const summaryRows = await queryDb(
      `SELECT
         COALESCE(SUM("totalAmount"), 0)::bigint as "totalFeeAmount",
         COALESCE(SUM("paidAmount"), 0)::bigint as "totalPaidAmount",
         COALESCE(SUM("balanceAmount"), 0)::bigint as "pendingBalance",
         COUNT(id)::int as "totalInvoices"
       FROM "Invoice"
       WHERE "studentProfileId" = $1 AND "instituteId" = $2 AND status != 'CANCELLED'`,
      [studentProfileId, effectiveInstituteId]
    );

    const s = summaryRows[0] || {
      totalFeeAmount: 0,
      totalPaidAmount: 0,
      pendingBalance: 0,
      totalInvoices: 0,
    };

    // 2. Next due date
    const nextDueRows = await queryDb(
      `SELECT MIN("dueDate") as "nextDueDate"
       FROM "Invoice"
       WHERE "studentProfileId" = $1 AND "instituteId" = $2 AND status IN ('ISSUED', 'PARTIALLY_PAID') AND "balanceAmount" > 0`,
      [studentProfileId, effectiveInstituteId]
    );
    const nextDueDate = nextDueRows[0]?.nextDueDate
      ? new Date(nextDueRows[0].nextDueDate).toISOString().slice(0, 10)
      : null;

    // 3. Installments count
    const instCountRows = await queryDb(
      `SELECT COUNT(inst.id)::int as count
       FROM "InvoiceInstallment" inst
       JOIN "Invoice" inv ON inv.id = inst."invoiceId"
       WHERE inv."studentProfileId" = $1 AND inv."instituteId" = $2`,
      [studentProfileId, effectiveInstituteId]
    );
    const totalInstallments = instCountRows[0]?.count > 0 ? instCountRows[0].count : Number(s.totalInvoices);

    // 4. Invoices List
    const invoices = await queryDb(
      `SELECT
         id,
         "invoiceNumber",
         status,
         "issueDate",
         "dueDate",
         "totalAmount",
         "paidAmount",
         "balanceAmount",
         currency,
         notes
       FROM "Invoice"
       WHERE "studentProfileId" = $1 AND "instituteId" = $2
       ORDER BY "createdAt" DESC`,
      [studentProfileId, effectiveInstituteId]
    );

    // 5. Payments & Receipts List
    const payments = await queryDb(
      `SELECT
         p.id,
         p."paymentNumber",
         p.amount,
         p."netAmount",
         p."reversedAmount",
         p."paymentMode",
         p."paymentDate",
         p.status,
         p."referenceNumber",
         p.remarks,
         inv.id as "invoiceId",
         inv."invoiceNumber",
         inv.notes as "feeDescription",
         inv."totalAmount" as "invoiceTotalAmount",
         r."receiptNumber",
         r."pdfUrl"
       FROM "FeePayment" p
       JOIN "Invoice" inv ON inv.id = p."invoiceId"
       LEFT JOIN "FeeReceipt" r ON r."paymentId" = p.id
       WHERE inv."studentProfileId" = $1 AND p."instituteId" = $2
       ORDER BY p."paymentDate" DESC`,
      [studentProfileId, effectiveInstituteId]
    );

    return NextResponse.json({
      summary: {
        totalFeeAmount: Number(s.totalFeeAmount),
        totalPaidAmount: Number(s.totalPaidAmount),
        pendingBalance: Number(s.pendingBalance),
        totalInstallments,
        nextDueDate,
      },
      invoices: invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        status: inv.status,
        issueDate: inv.issueDate ? new Date(inv.issueDate).toISOString().slice(0, 10) : null,
        dueDate: inv.dueDate ? new Date(inv.dueDate).toISOString().slice(0, 10) : null,
        totalAmount: Number(inv.totalAmount),
        paidAmount: Number(inv.paidAmount),
        balanceAmount: Number(inv.balanceAmount),
        currency: inv.currency,
        notes: inv.notes,
      })),
      transactions: payments.map((p) => ({
        id: p.id,
        paymentNumber: p.paymentNumber,
        receiptNumber: p.receiptNumber || '—',
        paymentDate: p.paymentDate ? new Date(p.paymentDate).toISOString() : new Date().toISOString(),
        feeDescription: p.feeDescription || 'Tuition & Academic Term Fee',
        invoiceNumber: p.invoiceNumber,
        invoiceTotalAmount: Number(p.invoiceTotalAmount || p.amount),
        amountPaid: Number(p.netAmount || p.amount),
        paymentMode: p.paymentMode,
        referenceNumber: p.referenceNumber || '—',
        status: p.status,
        receiptUrl: p.pdfUrl || `/receipts/${p.receiptNumber || p.paymentNumber}.pdf`,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching student finance history:', error);
    return NextResponse.json(
      { message: error?.message || 'Failed to fetch student finance history' },
      { status: 500 }
    );
  }
}

