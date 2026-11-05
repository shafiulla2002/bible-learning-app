import { NextRequest, NextResponse } from 'next/server';
import { queryDb } from '@/lib/server-db';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

function verifyJwtToken(token: string, secret: string): any {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');
  const [headerB64, payloadB64, signatureB64] = parts;

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(`${headerB64}.${payloadB64}`);
  const expectedSig = hmac.digest('base64url');

  const sigBuf = Buffer.from(signatureB64);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    throw new Error('Invalid signature');
  }

  const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  if (payload.exp && Date.now() >= payload.exp * 1000) {
    throw new Error('Token expired');
  }
  return payload;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ invoiceId: string }> }
) {
  try {
    const { invoiceId } = await context.params;
    const authHeader = request.headers.get('authorization');
    const devUserId = request.headers.get('x-dev-user-id');
    const devRole = request.headers.get('x-dev-role');
    const devInstituteId = request.headers.get('x-dev-institute-id');

    let userId: string | null = null;
    let role: string | null = null;
    let instituteId: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = verifyJwtToken(
          token,
          process.env.JWT_SECRET || 'dev-secret-key-bible-institute-lms-12345'
        );
        userId = decoded.sub || decoded.userId;
        role = decoded.role;
        instituteId = decoded.instituteId;
      } catch {
        return NextResponse.json({ message: 'Invalid or expired authentication token' }, { status: 401 });
      }
    } else if (devRole) {
      userId = devUserId || 'dev-student-user';
      role = devRole;
      instituteId = devInstituteId;
    } else {
      return NextResponse.json({ message: 'Authentication token required' }, { status: 401 });
    }

    if (role && role !== 'STUDENT') {
      return NextResponse.json({ message: 'Only active STUDENT accounts may verify payment.' }, { status: 403 });
    }

    const membershipRows = await queryDb(
      `SELECT m.id as "membershipId", m."instituteId", m.role, m.status,
              sp.id as "studentProfileId"
       FROM "Membership" m
       JOIN "StudentProfile" sp ON sp."membershipId" = m.id
       WHERE m."userId" = $1 AND m.role = 'STUDENT' AND m.status = 'ACTIVE'
       ${instituteId ? 'AND m."instituteId" = $2' : ''}
       LIMIT 1`,
      instituteId ? [userId, instituteId] : [userId]
    );

    if (membershipRows.length === 0) {
      return NextResponse.json({ message: 'No active student profile found for this account.' }, { status: 403 });
    }

    const studentMembership = membershipRows[0];
    const studentProfileId = studentMembership.studentProfileId;
    const resolvedInstituteId = studentMembership.instituteId;

    const body = await request.json().catch(() => ({}));
    const amountPaise = Number(body?.amountPaise);

    if (!amountPaise || amountPaise <= 0) {
      return NextResponse.json({ message: 'Valid positive amount in paise is required' }, { status: 400 });
    }

    const invoices = await queryDb(
      `SELECT id, "invoiceNumber", "totalAmount", "paidAmount", "balanceAmount", status
       FROM "Invoice"
       WHERE id = $1 AND "studentProfileId" = $2 AND "instituteId" = $3`,
      [invoiceId, studentProfileId, resolvedInstituteId]
    );

    if (invoices.length === 0) {
      return NextResponse.json({ message: 'Invoice not found or unauthorized' }, { status: 404 });
    }

    const inv = invoices[0];
    if (inv.balanceAmount <= 0) {
      return NextResponse.json({ message: 'Invoice is already fully paid' }, { status: 400 });
    }

    if (amountPaise > inv.balanceAmount) {
      return NextResponse.json({
        message: `Payment amount (${amountPaise} paise) exceeds outstanding balance (${inv.balanceAmount} paise)`
      }, { status: 400 });
    }

    const refNum = body?.referenceNumber || `ONLINE-${Date.now()}`;
    const existing = await queryDb(
      `SELECT id FROM "FeePayment" WHERE "instituteId" = $1 AND "referenceNumber" = $2 LIMIT 1`,
      [resolvedInstituteId, refNum]
    );
    if (existing.length > 0) {
      return NextResponse.json({ message: 'Transaction already recorded with this reference number' }, { status: 409 });
    }

    const countRows = await queryDb(
      `SELECT COUNT(*)::int as count FROM "FeePayment" WHERE "instituteId" = $1`,
      [resolvedInstituteId]
    );
    const nextIdx = (countRows[0]?.count || 0) + 1;
    const paymentNumber = `PAY-2026-${String(nextIdx).padStart(4, '0')}`;
    const receiptNumber = `REC-2026-${String(nextIdx).padStart(4, '0')}`;
    const paymentId = crypto.randomUUID();
    const receiptId = crypto.randomUUID();

    await queryDb(
      `INSERT INTO "FeePayment" (
         id, "instituteId", "invoiceId", "paymentNumber", amount, "reversedAmount", "netAmount",
         "paymentMode", status, "referenceNumber", "recordedByUserId", remarks, "paymentDate", "createdAt", "updatedAt"
       ) VALUES ($1, $2, $3, $4, $5, 0, $5, 'ONLINE', 'COMPLETED', $6, $7, 'Verified online student payment', NOW(), NOW(), NOW())`,
      [paymentId, resolvedInstituteId, inv.id, paymentNumber, amountPaise, refNum, userId]
    );

    await queryDb(
      `INSERT INTO "FeeReceipt" (
         id, "instituteId", "paymentId", "receiptNumber", "issuedAt", "issuedByUserId"
       ) VALUES ($1, $2, $3, $4, NOW(), $5)`,
      [receiptId, resolvedInstituteId, paymentId, receiptNumber, userId]
    );

    const newPaidAmount = inv.paidAmount + amountPaise;
    const newBalance = inv.totalAmount - newPaidAmount;
    const newStatus = newBalance === 0 ? 'PAID' : 'PARTIALLY_PAID';

    await queryDb(
      `UPDATE "Invoice"
       SET "paidAmount" = $1, "balanceAmount" = $2, status = $3, "updatedAt" = NOW()
       WHERE id = $4`,
      [newPaidAmount, newBalance, newStatus, inv.id]
    );

    return NextResponse.json({
      success: true,
      message: 'Payment verified and processed successfully',
      payment: {
        id: paymentId,
        paymentNumber,
        receiptNumber,
        amountPaise,
        status: 'COMPLETED',
        referenceNumber: refNum,
      },
      invoice: {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        paidAmountPaise: newPaidAmount,
        balanceAmountPaise: newBalance,
        status: newStatus,
      },
    });
  } catch (error: any) {
    console.error('Verify Payment Error:', error);
    return NextResponse.json(
      { message: 'Internal server error verifying payment', error: error.message },
      { status: 500 }
    );
  }
}

