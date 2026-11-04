import { NextRequest, NextResponse } from 'next/server';
import { queryDb, resolveServerAdminContext, invalidateServerRouteCache } from '@/lib/server-db';

export const dynamic = 'force-dynamic';

export async function POST(
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

    const body = await request.json();
    const {
      invoiceId,
      amountInRupees,
      amountPaise,
      paymentMode = 'ONLINE',
      referenceNumber,
      remarks,
    } = body;

    if (!invoiceId) {
      return NextResponse.json({ message: 'invoiceId is required' }, { status: 400 });
    }

    const invRows = await queryDb(
      `SELECT id, "totalAmount", "paidAmount", "balanceAmount", status
       FROM "Invoice" WHERE id = $1 AND "instituteId" = $2`,
      [invoiceId, effectiveInstituteId]
    );

    if (invRows.length === 0) {
      return NextResponse.json({ message: 'Invoice not found' }, { status: 404 });
    }

    const inv = invRows[0];
    const payPaise =
      amountPaise !== undefined
        ? Number(amountPaise)
        : amountInRupees !== undefined
        ? Math.round(Number(amountInRupees) * 100)
        : Number(inv.balanceAmount);

    if (payPaise <= 0 || payPaise > Number(inv.balanceAmount)) {
      return NextResponse.json(
        { message: 'Payment amount must be positive and not exceed invoice balance' },
        { status: 400 }
      );
    }

    const year = new Date().getFullYear();
    const payPrefix = `PAY-${year}-`;
    const lastPay = await queryDb(
      `SELECT "paymentNumber" FROM "FeePayment"
       WHERE "instituteId" = $1 AND "paymentNumber" LIKE $2
       ORDER BY "paymentNumber" DESC LIMIT 1`,
      [effectiveInstituteId, `${payPrefix}%`]
    );
    let nextPaySeq = 1;
    if (lastPay[0]?.paymentNumber) {
      const parts = lastPay[0].paymentNumber.split('-');
      const parsed = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(parsed)) nextPaySeq = parsed + 1;
    }
    const paymentNumber = `${payPrefix}${String(nextPaySeq).padStart(4, '0')}`;
    const receiptNumber = `REC-${year}-${String(nextPaySeq).padStart(4, '0')}`;

    // 1. Insert FeePayment
    const paymentRows = await queryDb(
      `INSERT INTO "FeePayment" (
        id, "instituteId", "invoiceId", "paymentNumber", amount, "reversedAmount", "netAmount",
        "paymentMode", "paymentDate", status, "referenceNumber", "recordedByUserId", remarks, "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, 0, $4, $5, NOW(), 'COMPLETED', $6, $7, $8, NOW(), NOW()
      ) RETURNING *`,
      [
        effectiveInstituteId,
        invoiceId,
        paymentNumber,
        payPaise,
        paymentMode,
        referenceNumber || null,
        ctx.user.userId,
        remarks || null,
      ]
    );
    const payment = paymentRows[0];

    // 2. Insert FeeReceipt
    await queryDb(
      `INSERT INTO "FeeReceipt" (
        id, "instituteId", "paymentId", "receiptNumber", "issuedAt", "issuedByUserId"
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, NOW(), $4
      )`,
      [effectiveInstituteId, payment.id, receiptNumber, ctx.user.userId]
    );

    // 3. Update Invoice paidAmount, balanceAmount, status
    const newPaid = Number(inv.paidAmount) + payPaise;
    const newBalance = Math.max(0, Number(inv.totalAmount) - newPaid);
    const newStatus = newBalance === 0 ? 'PAID' : 'PARTIALLY_PAID';

    await queryDb(
      `UPDATE "Invoice"
       SET "paidAmount" = $1, "balanceAmount" = $2, status = $3, "updatedAt" = NOW()
       WHERE id = $4 AND "instituteId" = $5`,
      [newPaid, newBalance, newStatus, invoiceId, effectiveInstituteId]
    );

    // 4. Trigger Admin Notification for Payment Recorded
    try {
      await queryDb(
        `INSERT INTO "Notification" (id, "instituteId", "userId", title, body, link, "createdAt")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())`,
        [
          effectiveInstituteId,
          ctx.user.userId,
          `Fee Payment Recorded: ₹${(payPaise / 100).toLocaleString('en-IN')}`,
          `Payment of ₹${(payPaise / 100).toLocaleString('en-IN')} recorded for invoice ${inv.invoiceNumber} (Receipt: ${receiptNumber}).`,
          `/admin/finance`,
        ]
      );
    } catch (notifErr) {
      console.warn('Failed to insert notification for payment:', notifErr);
    }

    invalidateServerRouteCache('finance');
    invalidateServerRouteCache('dashboard');

    return NextResponse.json(
      {
        ...payment,
        receiptNumber,
        invoiceStatus: newStatus,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error recording fee payment:', error);
    return NextResponse.json(
      { message: error?.message || 'Failed to record payment' },
      { status: 500 }
    );
  }
}
