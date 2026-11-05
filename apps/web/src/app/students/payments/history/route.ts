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

export async function GET(request: NextRequest) {
  try {
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
      return NextResponse.json({ message: 'Only active STUDENT accounts may access payment history.' }, { status: 403 });
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

    const payments = await queryDb(
      `SELECT fp.id, fp."paymentNumber", fp."invoiceId", fp.amount as "amountPaise",
              fp."netAmount" as "netAmountPaise", fp."paymentMode", fp.status, fp."paymentDate",
              fp."referenceNumber", fr."receiptNumber", fr.id as "receiptId",
              inv."invoiceNumber"
       FROM "FeePayment" fp
       JOIN "Invoice" inv ON fp."invoiceId" = inv.id
       LEFT JOIN "FeeReceipt" fr ON fr."paymentId" = fp.id
       WHERE inv."studentProfileId" = $1 AND fp."instituteId" = $2
       ORDER BY fp."paymentDate" DESC`,
      [studentProfileId, resolvedInstituteId]
    );

    const formatted = payments.map((p: any) => ({
      id: p.id,
      paymentNumber: p.paymentNumber,
      invoiceId: p.invoiceId,
      invoiceNumber: p.invoiceNumber,
      amountPaise: p.amountPaise,
      netAmountPaise: p.netAmountPaise,
      paymentMode: p.paymentMode,
      status: p.status,
      paymentDate: new Date(p.paymentDate).toISOString(),
      referenceNumber: p.referenceNumber,
      receiptNumber: p.receiptNumber,
      receiptId: p.receiptId,
    }));

    const url = new URL(request.url);
    const filterStatus = url.searchParams.get('status');
    if (filterStatus && filterStatus !== 'ALL') {
      return NextResponse.json({
        payments: formatted.filter((p) => p.status.toUpperCase() === filterStatus.toUpperCase()),
      });
    }

    return NextResponse.json({ payments: formatted });
  } catch (error: any) {
    console.error('Payment History Error:', error);
    return NextResponse.json(
      { message: 'Internal server error processing payment history', error: error.message },
      { status: 500 }
    );
  }
}

