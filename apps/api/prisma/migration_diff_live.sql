-- CreateEnum
CREATE TYPE "FeePeriodType" AS ENUM ('ONE_TIME', 'ANNUAL', 'SEMESTER', 'TERM', 'MONTHLY');

-- CreateEnum
CREATE TYPE "AllocationStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InstallmentStatus" AS ENUM ('PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FeePaymentMode" AS ENUM ('CASH', 'BANK_TRANSFER', 'CHEQUE', 'DEMAND_DRAFT', 'ONLINE', 'OTHER');

-- CreateEnum
CREATE TYPE "FeePaymentStatus" AS ENUM ('COMPLETED', 'PARTIALLY_REVERSED', 'REVERSED');

-- CreateEnum
CREATE TYPE "FinancialSequenceType" AS ENUM ('INVOICE', 'PAYMENT', 'RECEIPT');

-- DropIndex
DROP INDEX "Attendance_liveSessionId_studentProfileId_key";

-- AlterTable
ALTER TABLE "Attendance" ALTER COLUMN "date" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "FeeCategory" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeStructure" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "feeCategoryId" TEXT NOT NULL,
    "academicYearId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "periodType" "FeePeriodType" NOT NULL DEFAULT 'ONE_TIME',
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeStructure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentFeeAllocation" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "feeStructureId" TEXT NOT NULL,
    "academicYearId" TEXT,
    "academicTermId" TEXT,
    "billingPeriod" TEXT NOT NULL,
    "customAmount" INTEGER,
    "status" "AllocationStatus" NOT NULL DEFAULT 'ACTIVE',
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentFeeAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialSequence" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "type" "FinancialSequenceType" NOT NULL,
    "currentSeq" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "issueDate" TIMESTAMP(3),
    "dueDate" DATE NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "paidAmount" INTEGER NOT NULL DEFAULT 0,
    "balanceAmount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "notes" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "feeStructureId" TEXT,
    "studentFeeAllocationId" TEXT,
    "description" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceInstallment" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "installmentNumber" INTEGER NOT NULL,
    "dueDate" DATE NOT NULL,
    "amount" INTEGER NOT NULL,
    "paidAmount" INTEGER NOT NULL DEFAULT 0,
    "status" "InstallmentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeePayment" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "installmentId" TEXT,
    "paymentNumber" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reversedAmount" INTEGER NOT NULL DEFAULT 0,
    "netAmount" INTEGER NOT NULL,
    "paymentMode" "FeePaymentMode" NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "FeePaymentStatus" NOT NULL DEFAULT 'COMPLETED',
    "referenceNumber" TEXT,
    "recordedByUserId" TEXT NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeReceipt" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedByUserId" TEXT NOT NULL,
    "pdfUrl" TEXT,

    CONSTRAINT "FeeReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentReversalAudit" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "reversedByUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "reversedAmount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentReversalAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeeCategory_instituteId_idx" ON "FeeCategory"("instituteId");

-- CreateIndex
CREATE UNIQUE INDEX "FeeCategory_id_instituteId_key" ON "FeeCategory"("id", "instituteId");

-- CreateIndex
CREATE UNIQUE INDEX "FeeCategory_instituteId_code_key" ON "FeeCategory"("instituteId", "code");

-- CreateIndex
CREATE INDEX "FeeStructure_instituteId_feeCategoryId_idx" ON "FeeStructure"("instituteId", "feeCategoryId");

-- CreateIndex
CREATE UNIQUE INDEX "FeeStructure_id_instituteId_key" ON "FeeStructure"("id", "instituteId");

-- CreateIndex
CREATE UNIQUE INDEX "FeeStructure_instituteId_code_key" ON "FeeStructure"("instituteId", "code");

-- CreateIndex
CREATE INDEX "StudentFeeAllocation_instituteId_status_idx" ON "StudentFeeAllocation"("instituteId", "status");

-- CreateIndex
CREATE INDEX "StudentFeeAllocation_studentProfileId_idx" ON "StudentFeeAllocation"("studentProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentFeeAllocation_id_instituteId_key" ON "StudentFeeAllocation"("id", "instituteId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentFeeAllocation_id_feeStructureId_instituteId_key" ON "StudentFeeAllocation"("id", "feeStructureId", "instituteId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentFeeAllocation_studentProfileId_feeStructureId_billin_key" ON "StudentFeeAllocation"("studentProfileId", "feeStructureId", "billingPeriod");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialSequence_instituteId_year_type_key" ON "FinancialSequence"("instituteId", "year", "type");

-- CreateIndex
CREATE INDEX "Invoice_instituteId_status_idx" ON "Invoice"("instituteId", "status");

-- CreateIndex
CREATE INDEX "Invoice_studentProfileId_idx" ON "Invoice"("studentProfileId");

-- CreateIndex
CREATE INDEX "Invoice_dueDate_idx" ON "Invoice"("dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_id_instituteId_key" ON "Invoice"("id", "instituteId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_instituteId_invoiceNumber_key" ON "Invoice"("instituteId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceItem_instituteId_idx" ON "InvoiceItem"("instituteId");

-- CreateIndex
CREATE INDEX "InvoiceInstallment_invoiceId_idx" ON "InvoiceInstallment"("invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceInstallment_instituteId_idx" ON "InvoiceInstallment"("instituteId");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceInstallment_id_invoiceId_key" ON "InvoiceInstallment"("id", "invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceInstallment_invoiceId_installmentNumber_key" ON "InvoiceInstallment"("invoiceId", "installmentNumber");

-- CreateIndex
CREATE INDEX "FeePayment_instituteId_paymentDate_idx" ON "FeePayment"("instituteId", "paymentDate");

-- CreateIndex
CREATE INDEX "FeePayment_invoiceId_idx" ON "FeePayment"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "FeePayment_id_instituteId_key" ON "FeePayment"("id", "instituteId");

-- CreateIndex
CREATE UNIQUE INDEX "FeePayment_instituteId_paymentNumber_key" ON "FeePayment"("instituteId", "paymentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "FeeReceipt_paymentId_key" ON "FeeReceipt"("paymentId");

-- CreateIndex
CREATE INDEX "FeeReceipt_instituteId_issuedAt_idx" ON "FeeReceipt"("instituteId", "issuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FeeReceipt_paymentId_instituteId_key" ON "FeeReceipt"("paymentId", "instituteId");

-- CreateIndex
CREATE UNIQUE INDEX "FeeReceipt_instituteId_receiptNumber_key" ON "FeeReceipt"("instituteId", "receiptNumber");

-- CreateIndex
CREATE INDEX "PaymentReversalAudit_instituteId_createdAt_idx" ON "PaymentReversalAudit"("instituteId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentReversalAudit_paymentId_idx" ON "PaymentReversalAudit"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicTerm_id_instituteId_key" ON "AcademicTerm"("id", "instituteId");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicYear_id_instituteId_key" ON "AcademicYear"("id", "instituteId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_id_instituteId_key" ON "StudentProfile"("id", "instituteId");

-- AddForeignKey
ALTER TABLE "FeeCategory" ADD CONSTRAINT "FeeCategory_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeStructure" ADD CONSTRAINT "FeeStructure_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeStructure" ADD CONSTRAINT "FeeStructure_feeCategoryId_instituteId_fkey" FOREIGN KEY ("feeCategoryId", "instituteId") REFERENCES "FeeCategory"("id", "instituteId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeStructure" ADD CONSTRAINT "FeeStructure_academicYearId_instituteId_fkey" FOREIGN KEY ("academicYearId", "instituteId") REFERENCES "AcademicYear"("id", "instituteId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFeeAllocation" ADD CONSTRAINT "StudentFeeAllocation_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFeeAllocation" ADD CONSTRAINT "StudentFeeAllocation_studentProfileId_instituteId_fkey" FOREIGN KEY ("studentProfileId", "instituteId") REFERENCES "StudentProfile"("id", "instituteId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFeeAllocation" ADD CONSTRAINT "StudentFeeAllocation_feeStructureId_instituteId_fkey" FOREIGN KEY ("feeStructureId", "instituteId") REFERENCES "FeeStructure"("id", "instituteId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFeeAllocation" ADD CONSTRAINT "StudentFeeAllocation_academicYearId_instituteId_fkey" FOREIGN KEY ("academicYearId", "instituteId") REFERENCES "AcademicYear"("id", "instituteId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentFeeAllocation" ADD CONSTRAINT "StudentFeeAllocation_academicTermId_instituteId_fkey" FOREIGN KEY ("academicTermId", "instituteId") REFERENCES "AcademicTerm"("id", "instituteId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialSequence" ADD CONSTRAINT "FinancialSequence_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_studentProfileId_instituteId_fkey" FOREIGN KEY ("studentProfileId", "instituteId") REFERENCES "StudentProfile"("id", "instituteId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_instituteId_fkey" FOREIGN KEY ("invoiceId", "instituteId") REFERENCES "Invoice"("id", "instituteId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_feeStructureId_instituteId_fkey" FOREIGN KEY ("feeStructureId", "instituteId") REFERENCES "FeeStructure"("id", "instituteId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_studentFeeAllocationId_instituteId_fkey" FOREIGN KEY ("studentFeeAllocationId", "instituteId") REFERENCES "StudentFeeAllocation"("id", "instituteId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceInstallment" ADD CONSTRAINT "InvoiceInstallment_invoiceId_instituteId_fkey" FOREIGN KEY ("invoiceId", "instituteId") REFERENCES "Invoice"("id", "instituteId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeePayment" ADD CONSTRAINT "FeePayment_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeePayment" ADD CONSTRAINT "FeePayment_invoiceId_instituteId_fkey" FOREIGN KEY ("invoiceId", "instituteId") REFERENCES "Invoice"("id", "instituteId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeePayment" ADD CONSTRAINT "FeePayment_installmentId_invoiceId_fkey" FOREIGN KEY ("installmentId", "invoiceId") REFERENCES "InvoiceInstallment"("id", "invoiceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeReceipt" ADD CONSTRAINT "FeeReceipt_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeReceipt" ADD CONSTRAINT "FeeReceipt_paymentId_instituteId_fkey" FOREIGN KEY ("paymentId", "instituteId") REFERENCES "FeePayment"("id", "instituteId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReversalAudit" ADD CONSTRAINT "PaymentReversalAudit_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReversalAudit" ADD CONSTRAINT "PaymentReversalAudit_paymentId_instituteId_fkey" FOREIGN KEY ("paymentId", "instituteId") REFERENCES "FeePayment"("id", "instituteId") ON DELETE RESTRICT ON UPDATE CASCADE;
