import {
  Injectable,
  Optional,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import {
  AllocationStatus,
  FeePaymentMode,
  FeePaymentStatus,
  FeePeriodType,
  FinancialSequenceType,
  InstallmentStatus,
  InvoiceStatus,
  OrderStatus,
  PaymentStatus,
} from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  resolveRazorpayConfig,
  verifyRazorpayWebhookSignature,
} from '../../common/razorpay-crypto.util';

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly notificationsService?: NotificationsService,
  ) {}

  private normalizeCode(input: string, prefix: string): string {
    const clean = input
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return (clean || `${prefix}_${Date.now()}`).slice(0, 40);
  }

  private normalizePaymentMode(mode?: string): FeePaymentMode {
    const normalized = String(mode || 'ONLINE').trim().toUpperCase();
    switch (normalized) {
      case 'CASH':
        return FeePaymentMode.CASH;
      case 'BANK_TRANSFER':
        return FeePaymentMode.BANK_TRANSFER;
      case 'CHEQUE':
        return FeePaymentMode.CHEQUE;
      case 'DD':
      case 'DEMAND_DRAFT':
        return FeePaymentMode.DEMAND_DRAFT;
      case 'OTHER':
        return FeePaymentMode.OTHER;
      case 'ONLINE':
      case 'UPI':
      case 'CARD':
      case 'NETBANKING':
      default:
        return FeePaymentMode.ONLINE;
    }
  }

  private normalizePeriodType(periodType?: string): FeePeriodType {
    const normalized = String(periodType || 'ONE_TIME').trim().toUpperCase();
    if (normalized in FeePeriodType) {
      return FeePeriodType[normalized as keyof typeof FeePeriodType];
    }
    return FeePeriodType.ONE_TIME;
  }

  async nextFinancialNumber(
    tx: any,
    instituteId: string,
    type: FinancialSequenceType,
  ): Promise<string> {
    const year = new Date().getFullYear();
    const seqRecord = await tx.financialSequence.upsert({
      where: {
        instituteId_year_type: { instituteId, year, type },
      },
      create: {
        instituteId,
        year,
        type,
        currentSeq: 1,
      },
      update: {
        currentSeq: { increment: 1 },
      },
    });
    const prefix =
      type === FinancialSequenceType.INVOICE
        ? 'INV'
        : type === FinancialSequenceType.PAYMENT
          ? 'PAY'
          : 'REC';
    return `${prefix}-${year}-${String(seqRecord.currentSeq).padStart(4, '0')}`;
  }

  private async logAudit(
    tx: any,
    instituteId: string,
    actorUserId: string,
    action: string,
    entityType: string,
    entityId: string,
    metadata?: Record<string, any>,
  ) {
    await tx.auditLog.create({
      data: {
        instituteId,
        actorUserId: actorUserId || 'system',
        action,
        entityType,
        entityId,
        metadata: metadata || {},
      },
    });
  }

  async getOverview(instituteId: string) {
    const [categories, structures, allocations, invoices, payments] =
      await Promise.all([
        this.prisma.feeCategory.findMany({
          where: { instituteId },
          orderBy: { name: 'asc' },
        }),
        this.prisma.feeStructure.findMany({
          where: { instituteId },
          include: {
            feeCategory: true,
            academicYear: true,
            _count: { select: { allocations: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.studentFeeAllocation.findMany({
          where: { instituteId },
          include: {
            studentProfile: {
              include: {
                membership: { include: { user: { select: { fullName: true, phoneE164: true } } } },
              },
            },
            feeStructure: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 100,
        }),
        this.prisma.invoice.findMany({
          where: { instituteId },
          include: {
            studentProfile: {
              include: {
                membership: { include: { user: { select: { fullName: true, phoneE164: true } } } },
              },
            },
            installments: { orderBy: { installmentNumber: 'asc' } },
          },
          orderBy: { createdAt: 'desc' },
          take: 150,
        }),
        this.prisma.feePayment.findMany({
          where: { instituteId },
          include: {
            receipt: true,
            invoice: {
              include: {
                studentProfile: {
                  include: {
                    membership: { include: { user: { select: { fullName: true } } } },
                  },
                },
              },
            },
          },
          orderBy: { paymentDate: 'desc' },
          take: 150,
        }),
      ]);

    const now = new Date();
    const activeInvoices = invoices.filter((inv) => inv.status !== 'CANCELLED');
    const totalInvoicedPaise = activeInvoices.reduce(
      (sum, inv) => sum + inv.totalAmount,
      0,
    );
    const totalPaidPaise = activeInvoices.reduce(
      (sum, inv) => sum + inv.paidAmount,
      0,
    );
    const totalPendingPaise = activeInvoices.reduce(
      (sum, inv) => sum + inv.balanceAmount,
      0,
    );
    const overdueAmountPaise = activeInvoices
      .filter((inv) => inv.balanceAmount > 0 && inv.dueDate < now)
      .reduce((sum, inv) => sum + inv.balanceAmount, 0);

    return {
      summary: {
        totalInvoicedPaise,
        totalPaidPaise,
        totalPendingPaise,
        overdueAmountPaise,
        totalInvoicesCount: activeInvoices.length,
        paidInvoicesCount: activeInvoices.filter((i) => i.status === 'PAID')
          .length,
        pendingInvoicesCount: activeInvoices.filter((i) => i.balanceAmount > 0)
          .length,
      },
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        code: c.code,
        description: c.description || undefined,
        isActive: c.isActive,
      })),
      structures: structures.map((s) => ({
        id: s.id,
        name: s.name,
        code: s.code,
        periodType: s.periodType,
        amount: s.amount,
        currency: s.currency,
        description: s.description || undefined,
        isActive: s.isActive,
        feeCategoryId: s.feeCategoryId,
        categoryName: s.feeCategory.name,
        academicYearName: s.academicYear?.name || undefined,
        allocationsCount: s._count.allocations,
      })),
      allocations: allocations.map((a) => ({
        id: a.id,
        studentProfileId: a.studentProfileId,
        studentName: a.studentProfile.membership.user.fullName,
        admissionNo: a.studentProfile.admissionNo,
        feeStructureId: a.feeStructureId,
        feeStructureName: a.feeStructure.name,
        billingPeriod: a.billingPeriod,
        amountPaise: a.customAmount ?? a.feeStructure.amount,
        status: a.status,
      })),
      invoices: invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        status: inv.status,
        issueDate: inv.issueDate ? inv.issueDate.toISOString() : null,
        dueDate: inv.dueDate ? inv.dueDate.toISOString() : null,
        totalAmount: inv.totalAmount,
        paidAmount: inv.paidAmount,
        balanceAmount: inv.balanceAmount,
        currency: inv.currency,
        notes: inv.notes || undefined,
        studentProfileId: inv.studentProfileId,
        admissionNo: inv.studentProfile.admissionNo,
        studentName: inv.studentProfile.membership.user.fullName,
        studentPhone: inv.studentProfile.membership.user.phoneE164 || '',
        installments: inv.installments,
      })),
      payments: payments.map((p) => ({
        id: p.id,
        paymentNumber: p.paymentNumber,
        amount: p.amount,
        reversedAmount: p.reversedAmount,
        netAmount: p.netAmount,
        paymentMode: p.paymentMode,
        paymentDate: p.paymentDate.toISOString(),
        status: p.status,
        referenceNumber: p.referenceNumber || undefined,
        remarks: p.remarks || undefined,
        invoiceId: p.invoiceId,
        invoiceNumber: p.invoice.invoiceNumber,
        studentProfileId: p.invoice.studentProfileId,
        admissionNo: p.invoice.studentProfile.admissionNo,
        studentName: p.invoice.studentProfile.membership.user.fullName,
        receiptNumber: p.receipt?.receiptNumber || undefined,
      })),
    };
  }

  async listCategories(instituteId: string) {
    return this.prisma.feeCategory.findMany({
      where: { instituteId },
      orderBy: { name: 'asc' },
    });
  }

  async createCategory(
    instituteId: string,
    body: { name: string; code?: string; description?: string; isActive?: boolean },
    actorUserId: string,
  ) {
    if (!body?.name?.trim()) {
      throw new BadRequestException('Category name is required');
    }
    const code = this.normalizeCode(body.code || body.name, 'CAT');
    const existing = await this.prisma.feeCategory.findUnique({
      where: { instituteId_code: { instituteId, code } },
    });
    if (existing) {
      throw new ConflictException(`Fee category with code ${code} already exists`);
    }

    return this.prisma.$transaction(async (tx) => {
      const cat = await tx.feeCategory.create({
        data: {
          instituteId,
          name: body.name.trim(),
          code,
          description: body.description?.trim() || null,
          isActive: body.isActive ?? true,
        },
      });
      await this.logAudit(tx, instituteId, actorUserId, 'CREATE_FEE_CATEGORY', 'FeeCategory', cat.id, { code });
      return cat;
    });
  }

  async listStructures(instituteId: string) {
    return this.prisma.feeStructure.findMany({
      where: { instituteId },
      include: { feeCategory: true, academicYear: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createStructure(
    instituteId: string,
    body: {
      name: string;
      code?: string;
      feeCategoryId?: string;
      categoryName?: string;
      academicYearId?: string;
      periodType?: string;
      amountPaise?: number;
      amount?: number;
      amountInRupees?: number;
      currency?: string;
      description?: string;
    },
    actorUserId: string,
  ) {
    if (!body?.name?.trim()) {
      throw new BadRequestException('Fee structure name is required');
    }

    const amountPaise =
      typeof body.amountPaise === 'number' && body.amountPaise > 0
        ? Math.round(body.amountPaise)
        : typeof body.amount === 'number' && body.amount > 0
          ? Math.round(body.amount)
          : typeof body.amountInRupees === 'number' && body.amountInRupees > 0
            ? Math.round(body.amountInRupees * 100)
            : 0;

    if (amountPaise <= 0) {
      throw new BadRequestException('Fee structure amount must be greater than zero');
    }

    return this.prisma.$transaction(async (tx) => {
      let feeCategoryId = body.feeCategoryId;
      if (feeCategoryId) {
        const cat = await tx.feeCategory.findFirst({
          where: { id: feeCategoryId, instituteId },
        });
        if (!cat) {
          throw new NotFoundException('Fee category not found in this institute');
        }
      } else {
        const catName = body.categoryName?.trim() || 'Tuition & Academic Fees';
        const catCode = this.normalizeCode(catName, 'CAT');
        const category = await tx.feeCategory.upsert({
          where: { instituteId_code: { instituteId, code: catCode } },
          create: {
            instituteId,
            name: catName,
            code: catCode,
            isActive: true,
          },
          update: {},
        });
        feeCategoryId = category.id;
      }

      if (body.academicYearId) {
        const yr = await tx.academicYear.findFirst({
          where: { id: body.academicYearId, instituteId },
        });
        if (!yr) {
          throw new NotFoundException('Academic year not found in this institute');
        }
      }

      const code = this.normalizeCode(
        body.code || `${body.name}_${Date.now().toString().slice(-4)}`,
        'FEE',
      );

      const structure = await tx.feeStructure.create({
        data: {
          instituteId,
          feeCategoryId,
          academicYearId: body.academicYearId || null,
          name: body.name.trim(),
          code,
          periodType: this.normalizePeriodType(body.periodType),
          amount: amountPaise,
          currency: body.currency?.trim() || 'INR',
          description: body.description?.trim() || null,
          isActive: true,
        },
        include: { feeCategory: true },
      });

      await this.logAudit(tx, instituteId, actorUserId, 'CREATE_FEE_STRUCTURE', 'FeeStructure', structure.id, {
        code,
        amountPaise,
      });

      return structure;
    });
  }

  async updateStructure(
    instituteId: string,
    structureId: string,
    body: {
      name?: string;
      amountPaise?: number;
      amountInRupees?: number;
      description?: string;
      isActive?: boolean;
    },
    actorUserId: string,
  ) {
    const existing = await this.prisma.feeStructure.findFirst({
      where: { id: structureId, instituteId },
    });
    if (!existing) {
      throw new NotFoundException('Fee structure not found in this institute');
    }

    const amountPaise =
      typeof body.amountPaise === 'number' && body.amountPaise > 0
        ? Math.round(body.amountPaise)
        : typeof body.amountInRupees === 'number' && body.amountInRupees > 0
          ? Math.round(body.amountInRupees * 100)
          : undefined;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.feeStructure.update({
        where: { id: existing.id },
        data: {
          ...(body.name !== undefined ? { name: body.name.trim() } : {}),
          ...(amountPaise !== undefined ? { amount: amountPaise } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        },
      });
      await this.logAudit(tx, instituteId, actorUserId, 'UPDATE_FEE_STRUCTURE', 'FeeStructure', existing.id, body);
      return updated;
    });
  }

  async listAllocations(instituteId: string, studentProfileId?: string) {
    return this.prisma.studentFeeAllocation.findMany({
      where: {
        instituteId,
        ...(studentProfileId ? { studentProfileId } : {}),
      },
      include: {
        studentProfile: {
          include: {
            membership: { include: { user: { select: { fullName: true, phoneE164: true } } } },
          },
        },
        feeStructure: { include: { feeCategory: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async allocateStudentFee(
    instituteId: string,
    body: {
      studentProfileId: string;
      feeStructureId: string;
      academicYearId?: string;
      academicTermId?: string;
      billingPeriod: string;
      customAmountPaise?: number;
      remarks?: string;
    },
    actorUserId: string,
  ) {
    if (!body?.studentProfileId || !body?.feeStructureId || !body?.billingPeriod?.trim()) {
      throw new BadRequestException('studentProfileId, feeStructureId, and billingPeriod are required');
    }

    const [student, structure] = await Promise.all([
      this.prisma.studentProfile.findFirst({
        where: { id: body.studentProfileId, instituteId },
      }),
      this.prisma.feeStructure.findFirst({
        where: { id: body.feeStructureId, instituteId },
      }),
    ]);

    if (!student) {
      throw new NotFoundException('Student profile not found in this institute');
    }
    if (!structure) {
      throw new NotFoundException('Fee structure not found in this institute');
    }

    const existing = await this.prisma.studentFeeAllocation.findUnique({
      where: {
        studentProfileId_feeStructureId_billingPeriod: {
          studentProfileId: student.id,
          feeStructureId: structure.id,
          billingPeriod: body.billingPeriod.trim(),
        },
      },
    });
    if (existing) {
      throw new ConflictException('Student fee allocation already exists for this billing period');
    }

    return this.prisma.$transaction(async (tx) => {
      const allocation = await tx.studentFeeAllocation.create({
        data: {
          instituteId,
          studentProfileId: student.id,
          feeStructureId: structure.id,
          academicYearId: body.academicYearId || null,
          academicTermId: body.academicTermId || null,
          billingPeriod: body.billingPeriod.trim(),
          customAmount:
            typeof body.customAmountPaise === 'number' && body.customAmountPaise >= 0
              ? Math.round(body.customAmountPaise)
              : null,
          status: AllocationStatus.ACTIVE,
          remarks: body.remarks?.trim() || null,
        },
        include: { feeStructure: true },
      });

      await this.logAudit(
        tx,
        instituteId,
        actorUserId,
        'ALLOCATE_STUDENT_FEE',
        'StudentFeeAllocation',
        allocation.id,
        { studentProfileId: student.id, feeStructureId: structure.id, billingPeriod: allocation.billingPeriod },
      );

      return allocation;
    });
  }

  async listInvoices(instituteId: string, studentProfileId?: string) {
    return this.prisma.invoice.findMany({
      where: {
        instituteId,
        ...(studentProfileId ? { studentProfileId } : {}),
      },
      include: {
        studentProfile: {
          include: {
            membership: { include: { user: { select: { fullName: true, phoneE164: true } } } },
          },
        },
        items: true,
        installments: { orderBy: { installmentNumber: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getInvoice(instituteId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, instituteId },
      include: {
        studentProfile: {
          include: {
            membership: { include: { user: { select: { fullName: true, phoneE164: true, email: true } } } },
          },
        },
        items: { include: { feeStructure: true, studentFeeAllocation: true } },
        installments: { orderBy: { installmentNumber: 'asc' } },
        payments: { include: { receipt: true, reversals: true }, orderBy: { paymentDate: 'desc' } },
      },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found in this institute');
    }
    return invoice;
  }

  async issueInvoice(
    instituteId: string,
    body: {
      studentProfileId: string;
      feeStructureId?: string;
      studentFeeAllocationId?: string;
      dueDate?: string;
      notes?: string;
      installments?: Array<{ dueDate: string; amountPaise: number }>;
    },
    actorUserId: string,
  ) {
    if (!body?.studentProfileId) {
      throw new BadRequestException('studentProfileId is required');
    }

    return this.prisma.$transaction(async (tx) => {
      const student = await tx.studentProfile.findFirst({
        where: { id: body.studentProfileId, instituteId },
      });
      if (!student) {
        throw new NotFoundException('Student profile not found in this institute');
      }

      let allocation = body.studentFeeAllocationId
        ? await tx.studentFeeAllocation.findFirst({
            where: {
              id: body.studentFeeAllocationId,
              instituteId,
              studentProfileId: student.id,
            },
            include: { feeStructure: true },
          })
        : null;

      if (body.studentFeeAllocationId && !allocation) {
        throw new NotFoundException('Student fee allocation not found for this student');
      }

      const feeStructure = allocation?.feeStructure
        ? allocation.feeStructure
        : body.feeStructureId
          ? await tx.feeStructure.findFirst({
              where: { id: body.feeStructureId, instituteId },
            })
          : null;

      if (!feeStructure) {
        throw new BadRequestException('Either feeStructureId or studentFeeAllocationId is required');
      }

      const amountPaise = allocation?.customAmount ?? feeStructure.amount;
      if (amountPaise <= 0) {
        throw new BadRequestException('Invoice total amount must be greater than zero');
      }

      if (body.installments && body.installments.length > 0) {
        const installmentSum = body.installments.reduce(
          (sum, item) => sum + Math.round(item.amountPaise),
          0,
        );
        if (installmentSum !== amountPaise) {
          throw new BadRequestException(
            `Installment sum (${installmentSum}) must equal invoice total (${amountPaise})`,
          );
        }
      }

      const invoiceNumber = await this.nextFinancialNumber(
        tx,
        instituteId,
        FinancialSequenceType.INVOICE,
      );

      const parsedDueDate = body.dueDate
        ? new Date(body.dueDate)
        : new Date(Date.now() + 14 * 86400000);

      const invoice = await tx.invoice.create({
        data: {
          instituteId,
          studentProfileId: student.id,
          invoiceNumber,
          status: InvoiceStatus.ISSUED,
          issueDate: new Date(),
          dueDate: parsedDueDate,
          totalAmount: amountPaise,
          paidAmount: 0,
          balanceAmount: amountPaise,
          currency: feeStructure.currency || 'INR',
          notes: body.notes?.trim() || `${feeStructure.name} fee invoice`,
          items: {
            create: {
              feeStructureId: feeStructure.id,
              ...(allocation ? { studentFeeAllocationId: allocation.id } : {}),
              description: feeStructure.name,
              amount: amountPaise,
            },
          },
          ...(body.installments && body.installments.length > 0
            ? {
                installments: {
                  create: body.installments.map((inst, idx) => ({
                    installmentNumber: idx + 1,
                    dueDate: new Date(inst.dueDate),
                    amount: Math.round(inst.amountPaise),
                    paidAmount: 0,
                    status: InstallmentStatus.PENDING,
                  })),
                },
              }
            : {}),
        },
        include: { items: true, installments: true },
      });

      await this.logAudit(
        tx,
        instituteId,
        actorUserId,
        'ISSUE_INVOICE',
        'Invoice',
        invoice.id,
        { invoiceNumber, amountPaise, studentProfileId: student.id },
      );

      return invoice;
    });
  }

  async listPayments(instituteId: string) {
    return this.prisma.feePayment.findMany({
      where: { instituteId },
      include: {
        receipt: true,
        reversals: true,
        invoice: {
          include: {
            studentProfile: {
              include: {
                membership: { include: { user: { select: { fullName: true } } } },
              },
            },
          },
        },
      },
      orderBy: { paymentDate: 'desc' },
    });
  }

  async recordPayment(
    instituteId: string,
    actorUserId: string,
    body: {
      invoiceId: string;
      installmentId?: string;
      amountPaise?: number;
      amountInRupees?: number;
      paymentMode?: string;
      referenceNumber?: string;
      remarks?: string;
    },
  ) {
    const amountPaise =
      typeof body.amountPaise === 'number' && body.amountPaise > 0
        ? Math.round(body.amountPaise)
        : typeof body.amountInRupees === 'number' && body.amountInRupees > 0
          ? Math.round(body.amountInRupees * 100)
          : 0;

    if (!body?.invoiceId || amountPaise <= 0) {
      throw new BadRequestException('invoiceId and a positive payment amount are required');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id: body.invoiceId, instituteId },
        include: {
          studentProfile: {
            include: {
              membership: { include: { user: { select: { id: true, fullName: true } } } },
            },
          },
        },
      });

      if (!invoice) {
        throw new NotFoundException('Invoice not found in this institute');
      }
      if (invoice.status === InvoiceStatus.CANCELLED) {
        throw new BadRequestException('Cannot record payment against a cancelled invoice');
      }
      if (invoice.balanceAmount <= 0 || invoice.status === InvoiceStatus.PAID) {
        throw new BadRequestException('Invoice is already fully paid');
      }
      if (amountPaise > invoice.balanceAmount) {
        throw new BadRequestException(
          `Payment amount (${amountPaise} paise) exceeds remaining balance (${invoice.balanceAmount} paise)`,
        );
      }

      if (body.referenceNumber?.trim()) {
        const duplicate = await tx.feePayment.findFirst({
          where: {
            instituteId,
            referenceNumber: body.referenceNumber.trim(),
          },
        });
        if (duplicate) {
          throw new ConflictException('A payment with this reference number has already been recorded');
        }
      }

      let installment: any = null;
      if (body.installmentId) {
        installment = await tx.invoiceInstallment.findFirst({
          where: {
            id: body.installmentId,
            invoiceId: invoice.id,
            instituteId,
          },
        });
        if (!installment) {
          throw new NotFoundException('Invoice installment not found');
        }
        const remainingInst = installment.amount - installment.paidAmount;
        if (amountPaise > remainingInst) {
          throw new BadRequestException('Payment exceeds remaining installment balance');
        }
      }

      const [paymentNumber, receiptNumber] = await Promise.all([
        this.nextFinancialNumber(tx, instituteId, FinancialSequenceType.PAYMENT),
        this.nextFinancialNumber(tx, instituteId, FinancialSequenceType.RECEIPT),
      ]);

      const payment = await tx.feePayment.create({
        data: {
          instituteId,
          invoiceId: invoice.id,
          installmentId: installment?.id || null,
          paymentNumber,
          amount: amountPaise,
          reversedAmount: 0,
          netAmount: amountPaise,
          paymentMode: this.normalizePaymentMode(body.paymentMode),
          status: FeePaymentStatus.COMPLETED,
          referenceNumber: body.referenceNumber?.trim() || null,
          recordedByUserId: actorUserId,
          remarks: body.remarks?.trim() || null,
        },
      });

      const receipt = await tx.feeReceipt.create({
        data: {
          instituteId,
          paymentId: payment.id,
          receiptNumber,
          issuedByUserId: actorUserId,
        },
      });

      if (installment) {
        const newInstPaid = installment.paidAmount + amountPaise;
        await tx.invoiceInstallment.update({
          where: { id: installment.id },
          data: {
            paidAmount: newInstPaid,
            status:
              newInstPaid >= installment.amount
                ? InstallmentStatus.PAID
                : InstallmentStatus.PARTIALLY_PAID,
          },
        });
      }

      const newPaidAmount = invoice.paidAmount + amountPaise;
      const newBalanceAmount = Math.max(0, invoice.totalAmount - newPaidAmount);
      const newInvoiceStatus =
        newBalanceAmount === 0
          ? InvoiceStatus.PAID
          : InvoiceStatus.PARTIALLY_PAID;

      const updatedInvoice = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount: newPaidAmount,
          balanceAmount: newBalanceAmount,
          status: newInvoiceStatus,
        },
      });

      await this.logAudit(
        tx,
        instituteId,
        actorUserId,
        'RECORD_FEE_PAYMENT',
        'FeePayment',
        payment.id,
        { paymentNumber, receiptNumber, amountPaise, invoiceId: invoice.id },
      );

      return {
        payment,
        receipt,
        invoice: updatedInvoice,
        studentUserId: invoice.studentProfile.membership.user.id,
        studentName: invoice.studentProfile.membership.user.fullName,
      };
    });

    if (this.notificationsService) {
      await this.notificationsService
        .emitFeeEvent(instituteId, {
          eventType: 'FEE_PAYMENT_RECEIVED',
          referenceId: result.payment.id,
          studentName: result.studentName,
          invoiceNumber: result.invoice.invoiceNumber,
          amountPaise: result.payment.amount,
          paymentNumber: result.payment.paymentNumber,
        })
        .catch(() => {});
    }

    return result;
  }

  async reversePayment(
    instituteId: string,
    actorUserId: string,
    paymentId: string,
    body: { reversedAmountPaise?: number; reason: string },
  ) {
    if (!body?.reason || body.reason.trim().length < 3) {
      throw new BadRequestException('Reversal reason is required (min 3 characters)');
    }

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.feePayment.findFirst({
        where: { id: paymentId, instituteId },
        include: { invoice: true, installment: true },
      });

      if (!payment) {
        throw new NotFoundException('Fee payment not found in this institute');
      }

      if (payment.netAmount <= 0 || payment.status === FeePaymentStatus.REVERSED) {
        throw new BadRequestException('Payment has already been completely reversed');
      }

      const reverseAmount =
        typeof body.reversedAmountPaise === 'number' && body.reversedAmountPaise > 0
          ? Math.round(body.reversedAmountPaise)
          : payment.netAmount;

      if (reverseAmount > payment.netAmount) {
        throw new BadRequestException(
          `Reversal amount (${reverseAmount}) exceeds net refundable payment (${payment.netAmount})`,
        );
      }

      const reversal = await tx.paymentReversalAudit.create({
        data: {
          instituteId,
          paymentId: payment.id,
          reversedByUserId: actorUserId,
          reason: body.reason.trim(),
          reversedAmount: reverseAmount,
        },
      });

      const newReversedAmount = payment.reversedAmount + reverseAmount;
      const newNetAmount = payment.amount - newReversedAmount;
      const newPaymentStatus =
        newNetAmount === 0
          ? FeePaymentStatus.REVERSED
          : FeePaymentStatus.PARTIALLY_REVERSED;

      const updatedPayment = await tx.feePayment.update({
        where: { id: payment.id },
        data: {
          reversedAmount: newReversedAmount,
          netAmount: newNetAmount,
          status: newPaymentStatus,
        },
      });

      if (payment.installment) {
        const newInstPaid = Math.max(0, payment.installment.paidAmount - reverseAmount);
        await tx.invoiceInstallment.update({
          where: { id: payment.installment.id },
          data: {
            paidAmount: newInstPaid,
            status:
              newInstPaid === 0
                ? InstallmentStatus.PENDING
                : newInstPaid >= payment.installment.amount
                  ? InstallmentStatus.PAID
                  : InstallmentStatus.PARTIALLY_PAID,
          },
        });
      }

      const newInvoicePaid = Math.max(0, payment.invoice.paidAmount - reverseAmount);
      const newInvoiceBalance = payment.invoice.totalAmount - newInvoicePaid;
      const newInvoiceStatus =
        newInvoicePaid === 0
          ? InvoiceStatus.ISSUED
          : newInvoiceBalance === 0
            ? InvoiceStatus.PAID
            : InvoiceStatus.PARTIALLY_PAID;

      const updatedInvoice = await tx.invoice.update({
        where: { id: payment.invoice.id },
        data: {
          paidAmount: newInvoicePaid,
          balanceAmount: newInvoiceBalance,
          status: newInvoiceStatus,
        },
      });

      await this.logAudit(
        tx,
        instituteId,
        actorUserId,
        'REVERSE_FEE_PAYMENT',
        'FeePayment',
        payment.id,
        { reversalId: reversal.id, reverseAmount, reason: body.reason.trim() },
      );

      return {
        reversal,
        payment: updatedPayment,
        invoice: updatedInvoice,
      };
    });
  }

  async getStudentFinance(instituteId: string, studentId: string) {
    const student = await this.prisma.studentProfile.findFirst({
      where: { id: studentId, instituteId },
      include: {
        membership: { include: { user: { select: { fullName: true, phoneE164: true, email: true } } } },
      },
    });
    if (!student) {
      throw new NotFoundException('Student profile not found in this institute');
    }

    const [allocations, invoices, payments] = await Promise.all([
      this.listAllocations(instituteId, student.id),
      this.listInvoices(instituteId, student.id),
      this.prisma.feePayment.findMany({
        where: { instituteId, invoice: { studentProfileId: student.id } },
        include: { receipt: true, reversals: true, invoice: { select: { invoiceNumber: true } } },
        orderBy: { paymentDate: 'desc' },
      }),
    ]);

    const activeInvoices = invoices.filter((i) => i.status !== InvoiceStatus.CANCELLED);
    return {
      student: {
        id: student.id,
        admissionNo: student.admissionNo,
        fullName: student.membership.user.fullName,
        phone: student.membership.user.phoneE164,
        email: student.membership.user.email,
      },
      summary: {
        totalInvoicedPaise: activeInvoices.reduce((s, i) => s + i.totalAmount, 0),
        totalPaidPaise: activeInvoices.reduce((s, i) => s + i.paidAmount, 0),
        outstandingBalancePaise: activeInvoices.reduce((s, i) => s + i.balanceAmount, 0),
      },
      allocations,
      invoices,
      payments,
    };
  }

  /**
   * Idempotent Razorpay Webhook processor (`payment.captured`, `order.paid`, `payment.failed`).
   */
  async handleRazorpayWebhook(params: {
    instituteId: string;
    rawBody: Buffer | string;
    signature: string;
    eventIdHeader?: string;
    payload: any;
  }) {
    const { instituteId, rawBody, signature, eventIdHeader, payload } = params;

    const settings = await this.prisma.instituteSettings.findUnique({
      where: { instituteId },
    });
    const config = resolveRazorpayConfig(settings?.razorpayKeyEncrypted);

    if (!config.webhookSecret) {
      throw new BadRequestException('Razorpay webhook secret is not configured for this institute.');
    }

    const validSignature = verifyRazorpayWebhookSignature({
      rawBody,
      signature,
      webhookSecret: config.webhookSecret,
    });
    if (!validSignature) {
      throw new ForbiddenException('Invalid Razorpay webhook signature');
    }

    const eventType = String(payload?.event || 'unknown');
    const entityPayment = payload?.payload?.payment?.entity;
    const entityOrder = payload?.payload?.order?.entity;
    const providerOrderId = entityOrder?.id || entityPayment?.order_id || null;
    const providerPaymentId = entityPayment?.id || null;
    const amountPaise = Number(entityPayment?.amount || entityOrder?.amount || 0);

    const eventId =
      eventIdHeader?.trim() ||
      payload?.event_id ||
      crypto
        .createHash('sha256')
        .update(
          typeof rawBody === 'string'
            ? rawBody
            : rawBody.toString('utf8'),
        )
        .digest('hex');

    const existingEvent = await this.prisma.paymentWebhookEvent.findUnique({
      where: { eventId },
    });

    if (existingEvent && existingEvent.status === 'PROCESSED') {
      return { received: true, deduplicated: true, eventId, eventType };
    }

    const webhookEvent = await this.prisma.paymentWebhookEvent.upsert({
      where: { eventId },
      create: {
        instituteId,
        provider: 'RAZORPAY',
        eventId,
        eventType,
        signatureVerified: true,
        payload: payload || {},
        status: 'RECEIVED',
      },
      update: {
        signatureVerified: true,
        payload: payload || {},
      },
    });

    try {
      await this.prisma.$transaction(async (tx) => {
        if (eventType === 'payment.captured' || eventType === 'order.paid') {
          if (providerOrderId) {
            const order = await tx.order.findFirst({
              where: { instituteId, providerOrderId },
              include: { items: true },
            });

            if (order) {
              await tx.order.update({
                where: { id: order.id },
                data: { status: OrderStatus.PAID, signatureVerified: true },
              });

              if (providerPaymentId) {
                const existingPay = await tx.payment.findUnique({
                  where: { providerPaymentId },
                });
                if (existingPay) {
                  await tx.payment.update({
                    where: { id: existingPay.id },
                    data: {
                      status: PaymentStatus.CAPTURED,
                      signatureVerified: true,
                      method: entityPayment?.method || existingPay.method,
                      rawPayload: payload || {},
                    },
                  });
                } else {
                  await tx.payment.create({
                    data: {
                      instituteId,
                      orderId: order.id,
                      amount: amountPaise || order.total,
                      providerOrderId,
                      providerPaymentId,
                      signatureVerified: true,
                      status: PaymentStatus.CAPTURED,
                      method: entityPayment?.method || 'online',
                      rawPayload: payload || {},
                    },
                  });
                }
              }

              // Settle invoice if order is linked to an invoice and not yet settled
              if (order.invoiceId) {
                const invoice = await tx.invoice.findFirst({
                  where: { id: order.invoiceId, instituteId },
                });
                if (invoice && invoice.balanceAmount > 0) {
                  const dupRef = providerPaymentId
                    ? await tx.feePayment.findFirst({
                        where: { instituteId, referenceNumber: providerPaymentId },
                      })
                    : null;

                  if (!dupRef) {
                    const settleAmount = Math.min(
                      amountPaise || invoice.balanceAmount,
                      invoice.balanceAmount,
                    );
                    const [paymentNumber, receiptNumber] = await Promise.all([
                      this.nextFinancialNumber(tx, instituteId, FinancialSequenceType.PAYMENT),
                      this.nextFinancialNumber(tx, instituteId, FinancialSequenceType.RECEIPT),
                    ]);

                    const feePayment = await tx.feePayment.create({
                      data: {
                        instituteId,
                        invoiceId: invoice.id,
                        paymentNumber,
                        amount: settleAmount,
                        reversedAmount: 0,
                        netAmount: settleAmount,
                        paymentMode: FeePaymentMode.ONLINE,
                        status: FeePaymentStatus.COMPLETED,
                        referenceNumber: providerPaymentId || providerOrderId,
                        recordedByUserId: 'razorpay-webhook',
                        remarks: `Verified via Razorpay webhook (${eventType})`,
                      },
                    });

                    await tx.feeReceipt.create({
                      data: {
                        instituteId,
                        paymentId: feePayment.id,
                        receiptNumber,
                        issuedByUserId: 'razorpay-webhook',
                      },
                    });

                    const newPaid = invoice.paidAmount + settleAmount;
                    const newBalance = Math.max(0, invoice.totalAmount - newPaid);
                    await tx.invoice.update({
                      where: { id: invoice.id },
                      data: {
                        paidAmount: newPaid,
                        balanceAmount: newBalance,
                        status:
                          newBalance === 0
                            ? InvoiceStatus.PAID
                            : InvoiceStatus.PARTIALLY_PAID,
                      },
                    });
                  }
                }
              }

              // Activate any course enrolments from public checkout order items
              for (const item of order.items) {
                await tx.enrolment.upsert({
                  where: {
                    studentProfileId_courseId: {
                      studentProfileId: order.studentProfileId,
                      courseId: item.courseId,
                    },
                  },
                  create: {
                    instituteId,
                    studentProfileId: order.studentProfileId,
                    courseId: item.courseId,
                    source: 'PURCHASE',
                    status: 'ACTIVE',
                  },
                  update: { status: 'ACTIVE' },
                });
              }
            }
          }
        } else if (eventType === 'payment.failed' && providerOrderId) {
          const order = await tx.order.findFirst({
            where: { instituteId, providerOrderId },
          });
          if (order && order.status === OrderStatus.PENDING) {
            await tx.order.update({
              where: { id: order.id },
              data: { status: OrderStatus.FAILED },
            });
          }
        }

        await tx.paymentWebhookEvent.update({
          where: { id: webhookEvent.id },
          data: {
            status: 'PROCESSED',
            processedAt: new Date(),
          },
        });
      });

      return { received: true, deduplicated: false, eventId, eventType };
    } catch (err: any) {
      await this.prisma.paymentWebhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          status: 'FAILED',
          errorMessage: err?.message || 'Webhook processing error',
        },
      });
      throw err;
    }
  }
}
