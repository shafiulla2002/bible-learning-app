import { NextRequest, NextResponse } from 'next/server';
import { queryDb, resolveServerAdminContext } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ instituteId: string; id: string }> }
) {
  try {
    const { instituteId, id: studentId } = await params;
    const ctx = await resolveServerAdminContext();
    const effectiveInstituteId =
      instituteId && instituteId !== 'null' && instituteId !== 'undefined'
        ? instituteId
        : ctx.instituteId;

    // 1. Fetch Invoices for this student
    const invoices = await queryDb(
      `SELECT
         i.id,
         i."invoiceNumber",
         i.status,
         i."issueDate",
         i."dueDate",
         i."totalAmount",
         i."paidAmount",
         i."balanceAmount",
         i.currency,
         i.notes,
         (
           SELECT string_agg(item.description, ', ')
           FROM "InvoiceItem" item
           WHERE item."invoiceId" = i.id
         ) as description
       FROM "Invoice" i
       WHERE i."instituteId" = $1 AND i."studentProfileId" = $2
       ORDER BY i."createdAt" DESC`,
      [effectiveInstituteId, studentId]
    );

    // 2. Fetch Payments for this student's invoices
    const transactions = await queryDb(
      `SELECT
         p.id,
         p."paymentNumber",
         p.amount as "grossAmount",
         p."netAmount" as "amountPaid",
         p."reversedAmount",
         p."paymentMode",
         p."paymentDate",
         p.status,
         p."referenceNumber",
         p.remarks,
         inv.id as "invoiceId",
         inv."invoiceNumber",
         inv."totalAmount" as "invoiceTotalAmount",
         r."receiptNumber",
         COALESCE(
           (SELECT string_agg(item.description, ', ') FROM "InvoiceItem" item WHERE item."invoiceId" = inv.id),
           'Tuition & Academic Fee'
         ) as "feeDescription"
       FROM "FeePayment" p
       JOIN "Invoice" inv ON inv.id = p."invoiceId"
       LEFT JOIN "FeeReceipt" r ON r."paymentId" = p.id
       WHERE p."instituteId" = $1 AND inv."studentProfileId" = $2
       ORDER BY p."paymentDate" DESC`,
      [effectiveInstituteId, studentId]
    );

    // 3. Fetch Installments count and next due date
    const installmentRows = await queryDb(
      `SELECT
         COUNT(inst.id)::int as "totalInstallments",
         MIN(CASE WHEN inst.status = 'PENDING' AND inst."dueDate" >= CURRENT_DATE THEN inst."dueDate" END) as "nextDueDate"
       FROM "InvoiceInstallment" inst
       JOIN "Invoice" inv ON inv.id = inst."invoiceId"
       WHERE inst."instituteId" = $1 AND inv."studentProfileId" = $2`,
      [effectiveInstituteId, studentId]
    );

    // Calculate integer paise summary
    let totalFeeAmount = 0;
    let totalPaidAmount = 0;
    let pendingBalance = 0;

    for (const inv of invoices) {
      totalFeeAmount += Number(inv.totalAmount || 0);
      totalPaidAmount += Number(inv.paidAmount || 0);
      pendingBalance += Number(inv.balanceAmount || 0);
    }

    const totalInstallments = Number(installmentRows[0]?.totalInstallments || (invoices.length > 0 ? invoices.length : 1));
    const nextDueRaw = installmentRows[0]?.nextDueDate;
    const nextDueDate = nextDueRaw ? new Date(nextDueRaw).toISOString().slice(0, 10) : (pendingBalance > 0 ? 'Upcoming' : 'Fully Paid');

    return NextResponse.json({
      summary: {
        totalFeeAmount,
        totalPaidAmount,
        pendingBalance,
        totalInstallments,
        nextDueDate,
      },
      invoices,
      transactions: transactions.map((tx: any) => ({
        id: tx.id,
        invoiceNumber: tx.invoiceNumber || '—',
        receiptNumber: tx.receiptNumber || '—',
        paymentDate: tx.paymentDate ? new Date(tx.paymentDate).toISOString() : new Date().toISOString(),
        feeDescription: tx.feeDescription || 'Tuition & Academic Fee',
        invoiceTotalAmount: Number(tx.invoiceTotalAmount || 0),
        amountPaid: Number(tx.amountPaid || 0),
        paymentMode: tx.paymentMode || 'ONLINE',
        referenceNumber: tx.referenceNumber || '—',
        status: tx.status || 'COMPLETED',
      })),
    });
  } catch (error: any) {
    console.error('Error fetching student finance history:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch student finance history' },
      { status: 500 }
    );
  }
}
