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

export async function GET(
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
      return NextResponse.json({ message: 'Only active STUDENT accounts may access invoices.' }, { status: 403 });
    }

    const membershipRows = await queryDb(
      `SELECT m.id as "membershipId", m."instituteId", m.role, m.status,
              sp.id as "studentProfileId", sp."admissionNo",
              u.id as "userId", u."fullName", inst.name as "instituteName"
       FROM "Membership" m
       JOIN "StudentProfile" sp ON sp."membershipId" = m.id
       JOIN "User" u ON m."userId" = u.id
       JOIN "Institute" inst ON m."instituteId" = inst.id
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
      `SELECT i.id, i."invoiceNumber", i.status, i."issueDate", i."dueDate",
              i."totalAmount", i."paidAmount", i."balanceAmount", i.currency, i.notes
       FROM "Invoice" i
       WHERE i.id = $1 AND i."studentProfileId" = $2 AND i."instituteId" = $3`,
      [invoiceId, studentProfileId, resolvedInstituteId]
    );

    if (invoices.length === 0) {
      return NextResponse.json({ message: 'Invoice not found or unauthorized' }, { status: 404 });
    }

    const inv = invoices[0];
    const now = new Date();
    const isPastDue = new Date(inv.dueDate) < now && inv.balanceAmount > 0;
    const status = isPastDue ? 'OVERDUE' : inv.status;

    const items = await queryDb(
      `SELECT id, description, amount as "amountPaise"
       FROM "InvoiceItem"
       WHERE "invoiceId" = $1`,
      [inv.id]
    );

    const payments = await queryDb(
      `SELECT fp.id, fp."paymentNumber", fp.amount as "amountPaise", fp."netAmount" as "netAmountPaise",
              fp."paymentMode", fp.status, fp."paymentDate", fp."referenceNumber",
              fr."receiptNumber", fr.id as "receiptId"
       FROM "FeePayment" fp
       LEFT JOIN "FeeReceipt" fr ON fr."paymentId" = fp.id
       WHERE fp."invoiceId" = $1
       ORDER BY fp."paymentDate" DESC`,
      [inv.id]
    );

    return NextResponse.json({
      invoice: {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        issueDate: inv.issueDate ? new Date(inv.issueDate).toISOString() : null,
        dueDate: new Date(inv.dueDate).toISOString(),
        totalAmountPaise: inv.totalAmount,
        paidAmountPaise: inv.paidAmount,
        balanceAmountPaise: inv.balanceAmount,
        currency: inv.currency || 'INR',
        status,
        notes: inv.notes,
        studentName: studentMembership.fullName,
        admissionNo: studentMembership.admissionNo,
        instituteName: studentMembership.instituteName,
        items,
        payments: payments.map((p: any) => ({
          ...p,
          paymentDate: new Date(p.paymentDate).toISOString(),
        })),
      },
    });
  } catch (error: any) {
    console.error('Invoice Detail Error:', error);
    return NextResponse.json(
      { message: 'Internal server error processing invoice detail', error: error.message },
      { status: 500 }
    );
  }
}

