import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import {
  FeePaymentStatus,
  InstallmentStatus,
  InvoiceStatus,
  Role,
} from '@prisma/client';
import { FinanceService } from '../src/modules/finance/finance.service';
import { SettingsService } from '../src/modules/settings/settings.service';
import { StudentsService } from '../src/modules/students/students.service';
import { encryptRazorpayCredentials } from '../src/common/razorpay-crypto.util';

describe('Phase 9: Finance, Installments, Reversals & Razorpay Webhooks', () => {
  const INSTITUTE_ID = '11111111-1111-4111-8111-111111111111';
  const STUDENT_ID = '22222222-2222-4222-8222-222222222222';
  const USER_ID = '33333333-3333-4333-8333-333333333333';
  const FEE_STRUCT_ID = '44444444-4444-4444-8444-444444444444';
  const INVOICE_ID = '55555555-5555-4555-8555-555555555555';
  const INSTALLMENT_ID = '66666666-6666-4666-8666-666666666666';
  const PAYMENT_ID = '77777777-7777-4777-8777-777777777777';

  let mockPrisma: any;
  let financeService: FinanceService;
  let settingsService: SettingsService;
  let studentsService: StudentsService;
  let seqCounter: number;

  const KEY_ID = 'rzp_test_1234567890abcd';
  const KEY_SECRET = 'super_secret_razorpay_key_123';
  const WEBHOOK_SECRET = 'webhook_hmac_secret_123';

  beforeEach(() => {
    seqCounter = 0;
    const encryptedGateway = encryptRazorpayCredentials({
      keyId: KEY_ID,
      keySecret: KEY_SECRET,
      webhookSecret: WEBHOOK_SECRET,
    });

    mockPrisma = {
      institute: {
        findUnique: jest.fn().mockResolvedValue({ id: INSTITUTE_ID, name: 'Test Institute' }),
      },
      instituteSettings: {
        findUnique: jest.fn().mockResolvedValue({
          instituteId: INSTITUTE_ID,
          razorpayKeyEncrypted: encryptedGateway,
        }),
        upsert: jest.fn().mockImplementation(async ({ create }) => create),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
      financialSequence: {
        upsert: jest.fn().mockImplementation(async () => {
          seqCounter += 1;
          return { currentSeq: seqCounter };
        }),
      },
      studentProfile: {
        findFirst: jest.fn().mockResolvedValue({
          id: STUDENT_ID,
          instituteId: INSTITUTE_ID,
          userId: USER_ID,
          admissionNo: 'ADM-2026-0001',
          user: { fullName: 'John Student', phoneE164: '+919999999999', email: 'john@example.com' },
        }),
      },
      feeCategory: {
        findFirst: jest.fn().mockResolvedValue({ id: 'cat-1', instituteId: INSTITUTE_ID, name: 'Tuition', code: 'TUITION' }),
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({ id: 'cat-1', instituteId: INSTITUTE_ID, name: 'Tuition', code: 'TUITION' }),
        create: jest.fn().mockImplementation(async ({ data }) => ({ id: 'cat-new', ...data })),
      },
      feeStructure: {
        findFirst: jest.fn().mockResolvedValue({
          id: FEE_STRUCT_ID,
          instituteId: INSTITUTE_ID,
          name: 'M.Div Semester 1',
          amount: 1500000,
          currency: 'INR',
        }),
        create: jest.fn().mockImplementation(async ({ data }) => ({ id: FEE_STRUCT_ID, ...data })),
      },
      studentFeeAllocation: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }) => ({ id: 'alloc-1', ...data })),
      },
      invoice: {
        findFirst: jest.fn().mockResolvedValue({
          id: INVOICE_ID,
          instituteId: INSTITUTE_ID,
          studentProfileId: STUDENT_ID,
          invoiceNumber: 'INV-2026-0001',
          status: InvoiceStatus.ISSUED,
          totalAmount: 1500000,
          paidAmount: 0,
          balanceAmount: 1500000,
          currency: 'INR',
          studentProfile: {
            membership: {
              user: { id: USER_ID, fullName: 'John Student' },
            },
          },
        }),
        create: jest.fn().mockImplementation(async ({ data }) => ({
          id: INVOICE_ID,
          ...data,
          items: data.items ? [data.items.create] : [],
          installments: data.installments ? data.installments.create : [],
        })),
        update: jest.fn().mockImplementation(async ({ data }) => ({
          id: INVOICE_ID,
          invoiceNumber: 'INV-2026-0001',
          totalAmount: 1500000,
          ...data,
        })),
      },
      invoiceInstallment: {
        findFirst: jest.fn().mockResolvedValue({
          id: INSTALLMENT_ID,
          instituteId: INSTITUTE_ID,
          invoiceId: INVOICE_ID,
          installmentNumber: 1,
          amount: 750000,
          paidAmount: 0,
          status: InstallmentStatus.PENDING,
        }),
        update: jest.fn().mockImplementation(async ({ data }) => ({ id: INSTALLMENT_ID, ...data })),
      },
      feePayment: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }) => ({
          id: PAYMENT_ID,
          paymentDate: new Date(),
          ...data,
        })),
        update: jest.fn().mockImplementation(async ({ data }) => ({ id: PAYMENT_ID, ...data })),
      },
      feeReceipt: {
        create: jest.fn().mockImplementation(async ({ data }) => ({ id: 'rec-1', ...data })),
      },
      paymentReversalAudit: {
        create: jest.fn().mockImplementation(async ({ data }) => ({ id: 'rev-1', ...data })),
      },
      order: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'ord-1',
          instituteId: INSTITUTE_ID,
          studentProfileId: STUDENT_ID,
          providerOrderId: 'order_rzp_123',
          invoiceId: INVOICE_ID,
          total: 1500000,
          status: 'PENDING',
          items: [],
        }),
        create: jest.fn().mockImplementation(async ({ data }) => ({ id: 'ord-1', ...data })),
        update: jest.fn().mockImplementation(async ({ data }) => ({ id: 'ord-1', ...data })),
      },
      payment: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }) => ({ id: 'pay-1', ...data })),
        upsert: jest.fn().mockImplementation(async ({ create }) => ({ id: 'pay-1', ...create })),
        update: jest.fn().mockImplementation(async ({ data }) => ({ id: 'pay-1', ...data })),
      },
      paymentWebhookEvent: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockImplementation(async ({ create }) => ({ id: 'evt-1', ...create })),
        update: jest.fn().mockImplementation(async ({ data }) => ({ id: 'evt-1', ...data })),
      },
      enrolment: {
        upsert: jest.fn().mockResolvedValue({ id: 'enr-1' }),
      },
    };
    mockPrisma.$transaction = jest.fn(async (cb: any) => cb(mockPrisma));

    financeService = new FinanceService(mockPrisma);
    settingsService = new SettingsService(mockPrisma);
    studentsService = new StudentsService(mockPrisma);
  });

  it('rejects invoice creation when installment amounts do not sum to total amount', async () => {
    await expect(
      financeService.issueInvoice(
        INSTITUTE_ID,
        {
          studentProfileId: STUDENT_ID,
          feeStructureId: FEE_STRUCT_ID,
          installments: [
            { dueDate: '2026-12-01', amountPaise: 500000 },
            { dueDate: '2027-01-01', amountPaise: 500000 },
          ],
        },
        USER_ID,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('issues invoice with valid installments and uses FinancialSequence', async () => {
    const inv = await financeService.issueInvoice(
      INSTITUTE_ID,
      {
        studentProfileId: STUDENT_ID,
        feeStructureId: FEE_STRUCT_ID,
        installments: [
          { dueDate: '2026-12-01', amountPaise: 750000 },
          { dueDate: '2027-01-01', amountPaise: 750000 },
        ],
      },
      USER_ID,
    );

    expect(inv.invoiceNumber).toMatch(/^INV-\d{4}-0001$/);
    expect(inv.installments).toHaveLength(2);
    expect(mockPrisma.auditLog.create).toHaveBeenCalled();
  });

  it('records installment fee payment and atomically updates installment and invoice balances', async () => {
    const res = await financeService.recordPayment(INSTITUTE_ID, USER_ID, {
      invoiceId: INVOICE_ID,
      installmentId: INSTALLMENT_ID,
      amountPaise: 750000,
      paymentMode: 'UPI',
      referenceNumber: 'UTR-987654',
    });

    expect(res.payment.paymentMode).toBe('ONLINE');
    expect(res.payment.paymentNumber).toMatch(/^PAY-\d{4}-0001$/);
    expect(res.receipt.receiptNumber).toMatch(/^REC-\d{4}-0002$/);
    expect(mockPrisma.invoiceInstallment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paidAmount: 750000,
          status: InstallmentStatus.PAID,
        }),
      }),
    );
    expect(res.invoice.status).toBe(InvoiceStatus.PARTIALLY_PAID);
    expect(res.invoice.balanceAmount).toBe(750000);
  });

  it('reverses fee payment cleanly with PaymentReversalAudit and restores invoice balance', async () => {
    mockPrisma.feePayment.findFirst.mockResolvedValueOnce({
      id: PAYMENT_ID,
      instituteId: INSTITUTE_ID,
      invoiceId: INVOICE_ID,
      amount: 750000,
      reversedAmount: 0,
      netAmount: 750000,
      status: FeePaymentStatus.COMPLETED,
      installment: {
        id: INSTALLMENT_ID,
        amount: 750000,
        paidAmount: 750000,
      },
      invoice: {
        id: INVOICE_ID,
        totalAmount: 1500000,
        paidAmount: 750000,
        balanceAmount: 750000,
      },
    });

    const rev = await financeService.reversePayment(INSTITUTE_ID, USER_ID, PAYMENT_ID, {
      reversedAmountPaise: 750000,
      reason: 'Cheque dishonored by bank',
    });

    expect(mockPrisma.paymentReversalAudit.create).toHaveBeenCalled();
    expect(rev.payment.status).toBe(FeePaymentStatus.REVERSED);
    expect(rev.invoice.paidAmount).toBe(0);
    expect(rev.invoice.balanceAmount).toBe(1500000);
    expect(rev.invoice.status).toBe(InvoiceStatus.ISSUED);
  });

  it('stores encrypted Razorpay credentials and returns masked preview only', async () => {
    const saved = await settingsService.updatePaymentGatewaySettings(
      INSTITUTE_ID,
      {
        keyId: KEY_ID,
        keySecret: KEY_SECRET,
        webhookSecret: WEBHOOK_SECRET,
      },
      USER_ID,
    );

    expect(saved.configured).toBe(true);
    expect(saved.mode).toBe('TEST');
    expect(saved.hasWebhookSecret).toBe(true);
    expect(JSON.stringify(saved)).not.toContain(KEY_SECRET);
    expect(JSON.stringify(saved)).not.toContain(WEBHOOK_SECRET);
  });

  it('rejects forged Razorpay signature and accepts valid HMAC in student checkout', async () => {
    const user = { sub: USER_ID, role: Role.STUDENT, instituteId: INSTITUTE_ID };

    await expect(
      studentsService.verifyAndProcessPayment(user, INVOICE_ID, {
        amountPaise: 1500000,
        razorpayOrderId: 'order_rzp_123',
        razorpayPaymentId: 'pay_rzp_999',
        razorpaySignature: 'forged_sig',
      }),
    ).rejects.toThrow(ForbiddenException);

    const validSig = crypto
      .createHmac('sha256', KEY_SECRET)
      .update('order_rzp_123|pay_rzp_999')
      .digest('hex');

    const ok = await studentsService.verifyAndProcessPayment(user, INVOICE_ID, {
      amountPaise: 1500000,
      razorpayOrderId: 'order_rzp_123',
      razorpayPaymentId: 'pay_rzp_999',
      razorpaySignature: validSig,
    });

    expect(ok.success).toBe(true);
    expect(ok.invoice.status).toBe(InvoiceStatus.PAID);
  });

  it('verifies webhook HMAC signature and deduplicates processed Razorpay events', async () => {
    const payload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_webhook_1',
            order_id: 'order_rzp_123',
            amount: 1500000,
            method: 'upi',
          },
        },
      },
    };
    const rawBody = JSON.stringify(payload);
    const sig = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    await expect(
      financeService.handleRazorpayWebhook({
        instituteId: INSTITUTE_ID,
        rawBody,
        signature: 'bad_sig',
        eventIdHeader: 'evt_rzp_1',
        payload,
      }),
    ).rejects.toThrow(ForbiddenException);

    const first = await financeService.handleRazorpayWebhook({
      instituteId: INSTITUTE_ID,
      rawBody,
      signature: sig,
      eventIdHeader: 'evt_rzp_1',
      payload,
    });
    expect(first.received).toBe(true);
    expect(first.deduplicated).toBe(false);

    mockPrisma.paymentWebhookEvent.findUnique.mockResolvedValueOnce({
      id: 'evt-1',
      eventId: 'evt_rzp_1',
      status: 'PROCESSED',
    });

    const dup = await financeService.handleRazorpayWebhook({
      instituteId: INSTITUTE_ID,
      rawBody,
      signature: sig,
      eventIdHeader: 'evt_rzp_1',
      payload,
    });
    expect(dup.deduplicated).toBe(true);
  });
});
