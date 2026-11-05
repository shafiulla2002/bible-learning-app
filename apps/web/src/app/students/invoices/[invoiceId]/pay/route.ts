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
      return NextResponse.json({ message: 'Only active STUDENT accounts may initiate payment.' }, { status: 403 });
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

    const invoices = await queryDb(
      `SELECT id, "invoiceNumber", "totalAmount", "paidAmount", "balanceAmount", currency, status
       FROM "Invoice"
       WHERE id = $1 AND "studentProfileId" = $2 AND "instituteId" = $3`,
      [invoiceId, studentProfileId, resolvedInstituteId]
    );

    if (invoices.length === 0) {
      return NextResponse.json({ message: 'Invoice not found or unauthorized' }, { status: 404 });
    }

    const inv = invoices[0];
    if (inv.balanceAmount <= 0 || inv.status === 'PAID') {
      return NextResponse.json({ message: 'Invoice is already fully paid' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const payableAmount = body?.amountPaise && body.amountPaise > 0
      ? Math.min(body.amountPaise, inv.balanceAmount)
      : inv.balanceAmount;

    const orderId = `PAY-ORDER-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    return NextResponse.json({
      order: {
        orderId,
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        amountPaise: payableAmount,
        currency: inv.currency || 'INR',
        gateway: 'RAZORPAY_SANDBOX',
        keyId: 'rzp_test_bible_institute',
      },
    });
  } catch (error: any) {
    console.error('Create Payment Order Error:', error);
    return NextResponse.json(
      { message: 'Internal server error creating payment order', error: error.message },
      { status: 500 }
    );
  }
}

