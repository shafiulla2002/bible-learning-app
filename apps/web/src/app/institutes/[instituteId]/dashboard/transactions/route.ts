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

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
    const search = (searchParams.get('search') || '').trim();
    const status = (searchParams.get('status') || 'ALL').toUpperCase();
    const offset = (page - 1) * limit;

    let whereClause = `WHERE p."instituteId" = $1`;
    const queryParams: any[] = [effectiveInstituteId];

    if (status !== 'ALL') {
      queryParams.push(status);
      whereClause += ` AND p.status = $${queryParams.length}`;
    }

    if (search) {
      queryParams.push(`%${search}%`);
      const pIdx = queryParams.length;
      whereClause += ` AND (p."paymentNumber" ILIKE $${pIdx} OR r."receiptNumber" ILIKE $${pIdx} OR u."fullName" ILIKE $${pIdx} OR sp."admissionNo" ILIKE $${pIdx} OR p."referenceNumber" ILIKE $${pIdx})`;
    }

    // Total Count & Summary
    const summaryRows = await queryDb(
      `SELECT
         COUNT(p.id)::int as "totalCount",
         COALESCE(SUM(p.amount), 0)::bigint as "totalGross",
         COALESCE(SUM(p."netAmount"), 0)::bigint as "totalNet"
       FROM "FeePayment" p
       LEFT JOIN "FeeReceipt" r ON r."paymentId" = p.id
       LEFT JOIN "Invoice" inv ON inv.id = p."invoiceId"
       LEFT JOIN "StudentProfile" sp ON sp.id = inv."studentProfileId"
       LEFT JOIN "Membership" m ON m.id = sp."membershipId"
       LEFT JOIN "User" u ON u.id = m."userId"
       ${whereClause}`,
      queryParams
    );

    const totalCount = summaryRows[0]?.totalCount || 0;
    const totalGross = Number(summaryRows[0]?.totalGross || 0);
    const totalNet = Number(summaryRows[0]?.totalNet || 0);
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));

    // Paginated Rows
    const dataRows = await queryDb(
      `SELECT
         p.id,
         p."paymentNumber",
         p.amount,
         p."reversedAmount",
         p."netAmount",
         p."paymentMode",
         p.status,
         p."referenceNumber",
         p."paymentDate",
         r."receiptNumber",
         inv.id as "invoiceId",
         inv."invoiceNumber",
         sp.id as "studentProfileId",
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
       ${whereClause}
       ORDER BY p."paymentDate" DESC
       LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`,
      [...queryParams, limit, offset]
    );

    const data = dataRows.map((r) => ({
      id: r.id,
      paymentNumber: r.paymentNumber,
      receiptNumber: r.receiptNumber || `REC-${r.paymentNumber}`,
      studentId: r.studentProfileId || r.admissionNo,
      studentName: r.studentName || 'Student',
      admissionNo: r.admissionNo || '—',
      courseName: r.courseName || 'Theology Course',
      invoiceId: r.invoiceId,
      invoiceNumber: r.invoiceNumber || '—',
      amount: Number(r.amount),
      reversedAmount: Number(r.reversedAmount || 0),
      netAmount: Number(r.netAmount || r.amount),
      paymentMode: r.paymentMode,
      referenceNumber: r.referenceNumber,
      status: r.status,
      paymentDate: r.paymentDate ? new Date(r.paymentDate).toISOString() : new Date().toISOString(),
    }));

    return NextResponse.json({
      data,
      summary: {
        totalTransactions: totalCount,
        totalGrossPaise: totalGross,
        totalNetPaise: totalNet,
      },
      meta: {
        total: totalCount,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error: any) {
    console.error('Error in /institutes/[instituteId]/dashboard/transactions route:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}
