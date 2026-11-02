import { NextRequest, NextResponse } from 'next/server';
import { queryDb, resolveServerAdminContext } from '@/lib/server-db';

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
    const { studentProfileId, feeStructureId, dueDate, notes } = body;

    if (!studentProfileId || !feeStructureId) {
      return NextResponse.json(
        { message: 'studentProfileId and feeStructureId are required' },
        { status: 400 }
      );
    }

    const structRows = await queryDb(
      `SELECT id, name, amount, "academicYearId" FROM "FeeStructure" WHERE id = $1 AND "instituteId" = $2`,
      [feeStructureId, effectiveInstituteId]
    );

    if (structRows.length === 0) {
      return NextResponse.json({ message: 'Fee structure not found' }, { status: 404 });
    }

    const fs = structRows[0];

    // Generate next Invoice Number
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;
    const lastInv = await queryDb(
      `SELECT "invoiceNumber" FROM "Invoice"
       WHERE "instituteId" = $1 AND "invoiceNumber" LIKE $2
       ORDER BY "invoiceNumber" DESC LIMIT 1`,
      [effectiveInstituteId, `${prefix}%`]
    );
    let nextSeq = 1;
    if (lastInv[0]?.invoiceNumber) {
      const parts = lastInv[0].invoiceNumber.split('-');
      const parsed = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(parsed)) nextSeq = parsed + 1;
    }
    const invoiceNumber = `${prefix}${String(nextSeq).padStart(4, '0')}`;

    const due = dueDate || new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0];

    // Create Invoice
    const invRows = await queryDb(
      `INSERT INTO "Invoice" (
        id, "instituteId", "studentProfileId", "invoiceNumber", status, "issueDate", "dueDate",
        "totalAmount", "paidAmount", "balanceAmount", currency, notes, "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, 'ISSUED', NOW(), $4::date, $5, 0, $5, 'INR', $6, NOW(), NOW()
      ) RETURNING *`,
      [effectiveInstituteId, studentProfileId, invoiceNumber, due, fs.amount, notes || null]
    );
    const invoice = invRows[0];

    // Create InvoiceItem
    await queryDb(
      `INSERT INTO "InvoiceItem" (
        id, "instituteId", "invoiceId", "feeStructureId", description, amount, "createdAt"
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, NOW()
      )`,
      [effectiveInstituteId, invoice.id, fs.id, fs.name, fs.amount]
    );

    return NextResponse.json(invoice, { status: 201 });
  } catch (error: any) {
    console.error('Error issuing invoice:', error);
    return NextResponse.json(
      { message: error?.message || 'Failed to issue invoice' },
      { status: 500 }
    );
  }
}

