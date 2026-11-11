-- Forward-Only Reconciling Additive Migration
-- Migration: 20261111000001_reconcile_exam_and_fee_schema
-- Target: cross-environment reconciliation (bible_lms_test & bible_lms_dev; safe & idempotent; preserves InvoiceInstallment.notes, custom constraints, and triggers)

BEGIN;

-- 1. Guard existing PostgreSQL enum types in public schema
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'AllocationStatus'
  ) THEN
    CREATE TYPE "public"."AllocationStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CANCELLED');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'FinancialSequenceType'
  ) THEN
    CREATE TYPE "public"."FinancialSequenceType" AS ENUM ('INVOICE', 'PAYMENT', 'RECEIPT');
  END IF;
END $$;

-- 2. Add missing Exam, ExamAttempt, and AttemptAnswer columns and align Exam constraints/types
ALTER TABLE "public"."Exam"
  ADD COLUMN IF NOT EXISTS "batchId" TEXT,
  ADD COLUMN IF NOT EXISTS "instructions" TEXT,
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS "startAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "endAt" TIMESTAMP(3);

UPDATE "public"."Exam"
SET "status" = 'DRAFT'
WHERE "status" IS NULL;

ALTER TABLE "public"."Exam"
  ALTER COLUMN "status" SET DEFAULT 'DRAFT',
  ALTER COLUMN "status" SET NOT NULL,
  ALTER COLUMN "startAt" SET DATA TYPE TIMESTAMP(3),
  ALTER COLUMN "endAt" SET DATA TYPE TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Exam_batchId_idx" ON "public"."Exam"("batchId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Exam_batchId_fkey'
      AND connamespace = 'public'::regnamespace
      AND conrelid = 'public."Exam"'::regclass
  ) THEN
    ALTER TABLE "public"."Exam"
      ADD CONSTRAINT "Exam_batchId_fkey"
      FOREIGN KEY ("batchId") REFERENCES "public"."Batch"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "public"."ExamAttempt"
  ADD COLUMN IF NOT EXISTS "feedback" TEXT;

ALTER TABLE "public"."AttemptAnswer"
  ADD COLUMN IF NOT EXISTS "feedback" TEXT;

-- 3. Create missing FinancialSequence table
CREATE TABLE IF NOT EXISTS "public"."FinancialSequence" (
  "id" TEXT NOT NULL,
  "instituteId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "type" "public"."FinancialSequenceType" NOT NULL,
  "currentSeq" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FinancialSequence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FinancialSequence_instituteId_year_type_key"
  ON "public"."FinancialSequence"("instituteId", "year", "type");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'FinancialSequence_instituteId_fkey'
      AND connamespace = 'public'::regnamespace
      AND conrelid = 'public."FinancialSequence"'::regclass
  ) THEN
    ALTER TABLE "public"."FinancialSequence"
      ADD CONSTRAINT "FinancialSequence_instituteId_fkey"
      FOREIGN KEY ("instituteId") REFERENCES "public"."Institute"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- 4. Create missing StudentFeeAllocation table
CREATE TABLE IF NOT EXISTS "public"."StudentFeeAllocation" (
  "id" TEXT NOT NULL,
  "instituteId" TEXT NOT NULL,
  "studentProfileId" TEXT NOT NULL,
  "feeStructureId" TEXT NOT NULL,
  "academicYearId" TEXT,
  "academicTermId" TEXT,
  "billingPeriod" TEXT NOT NULL,
  "customAmount" INTEGER,
  "status" "public"."AllocationStatus" NOT NULL DEFAULT 'ACTIVE',
  "remarks" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentFeeAllocation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StudentFeeAllocation_instituteId_status_idx"
  ON "public"."StudentFeeAllocation"("instituteId", "status");
CREATE INDEX IF NOT EXISTS "StudentFeeAllocation_studentProfileId_idx"
  ON "public"."StudentFeeAllocation"("studentProfileId");
CREATE UNIQUE INDEX IF NOT EXISTS "StudentFeeAllocation_id_instituteId_key"
  ON "public"."StudentFeeAllocation"("id", "instituteId");
CREATE UNIQUE INDEX IF NOT EXISTS "StudentFeeAllocation_id_feeStructureId_instituteId_key"
  ON "public"."StudentFeeAllocation"("id", "feeStructureId", "instituteId");
CREATE UNIQUE INDEX IF NOT EXISTS "StudentFeeAllocation_studentProfileId_feeStructureId_billin_key"
  ON "public"."StudentFeeAllocation"("studentProfileId", "feeStructureId", "billingPeriod");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'StudentFeeAllocation_instituteId_fkey'
      AND connamespace = 'public'::regnamespace
      AND conrelid = 'public."StudentFeeAllocation"'::regclass
  ) THEN
    ALTER TABLE "public"."StudentFeeAllocation"
      ADD CONSTRAINT "StudentFeeAllocation_instituteId_fkey"
      FOREIGN KEY ("instituteId") REFERENCES "public"."Institute"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'StudentFeeAllocation_studentProfileId_instituteId_fkey'
      AND connamespace = 'public'::regnamespace
      AND conrelid = 'public."StudentFeeAllocation"'::regclass
  ) THEN
    ALTER TABLE "public"."StudentFeeAllocation"
      ADD CONSTRAINT "StudentFeeAllocation_studentProfileId_instituteId_fkey"
      FOREIGN KEY ("studentProfileId", "instituteId") REFERENCES "public"."StudentProfile"("id", "instituteId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'StudentFeeAllocation_feeStructureId_instituteId_fkey'
      AND connamespace = 'public'::regnamespace
      AND conrelid = 'public."StudentFeeAllocation"'::regclass
  ) THEN
    ALTER TABLE "public"."StudentFeeAllocation"
      ADD CONSTRAINT "StudentFeeAllocation_feeStructureId_instituteId_fkey"
      FOREIGN KEY ("feeStructureId", "instituteId") REFERENCES "public"."FeeStructure"("id", "instituteId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'StudentFeeAllocation_academicYearId_instituteId_fkey'
      AND connamespace = 'public'::regnamespace
      AND conrelid = 'public."StudentFeeAllocation"'::regclass
  ) THEN
    ALTER TABLE "public"."StudentFeeAllocation"
      ADD CONSTRAINT "StudentFeeAllocation_academicYearId_instituteId_fkey"
      FOREIGN KEY ("academicYearId", "instituteId") REFERENCES "public"."AcademicYear"("id", "instituteId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'StudentFeeAllocation_academicTermId_instituteId_fkey'
      AND connamespace = 'public'::regnamespace
      AND conrelid = 'public."StudentFeeAllocation"'::regclass
  ) THEN
    ALTER TABLE "public"."StudentFeeAllocation"
      ADD CONSTRAINT "StudentFeeAllocation_academicTermId_instituteId_fkey"
      FOREIGN KEY ("academicTermId", "instituteId") REFERENCES "public"."AcademicTerm"("id", "instituteId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- 5. Add missing foreign keys on FeeStructure and InvoiceItem
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'FeeStructure_academicYearId_instituteId_fkey'
      AND connamespace = 'public'::regnamespace
      AND conrelid = 'public."FeeStructure"'::regclass
  ) THEN
    ALTER TABLE "public"."FeeStructure"
      ADD CONSTRAINT "FeeStructure_academicYearId_instituteId_fkey"
      FOREIGN KEY ("academicYearId", "instituteId") REFERENCES "public"."AcademicYear"("id", "instituteId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'InvoiceItem_feeStructureId_instituteId_fkey'
      AND connamespace = 'public'::regnamespace
      AND conrelid = 'public."InvoiceItem"'::regclass
  ) THEN
    ALTER TABLE "public"."InvoiceItem"
      ADD CONSTRAINT "InvoiceItem_feeStructureId_instituteId_fkey"
      FOREIGN KEY ("feeStructureId", "instituteId") REFERENCES "public"."FeeStructure"("id", "instituteId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'InvoiceItem_studentFeeAllocationId_instituteId_fkey'
      AND connamespace = 'public'::regnamespace
      AND conrelid = 'public."InvoiceItem"'::regclass
  ) THEN
    ALTER TABLE "public"."InvoiceItem"
      ADD CONSTRAINT "InvoiceItem_studentFeeAllocationId_instituteId_fkey"
      FOREIGN KEY ("studentFeeAllocationId", "instituteId") REFERENCES "public"."StudentFeeAllocation"("id", "instituteId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- 6. Add missing non-unique indexes on existing fee tables
CREATE INDEX IF NOT EXISTS "FeeCategory_instituteId_idx"
  ON "public"."FeeCategory"("instituteId");
CREATE INDEX IF NOT EXISTS "FeeStructure_instituteId_feeCategoryId_idx"
  ON "public"."FeeStructure"("instituteId", "feeCategoryId");
CREATE INDEX IF NOT EXISTS "Invoice_instituteId_status_idx"
  ON "public"."Invoice"("instituteId", "status");
CREATE INDEX IF NOT EXISTS "Invoice_studentProfileId_idx"
  ON "public"."Invoice"("studentProfileId");
CREATE INDEX IF NOT EXISTS "Invoice_dueDate_idx"
  ON "public"."Invoice"("dueDate");
CREATE INDEX IF NOT EXISTS "InvoiceInstallment_invoiceId_idx"
  ON "public"."InvoiceInstallment"("invoiceId");
CREATE INDEX IF NOT EXISTS "InvoiceInstallment_instituteId_idx"
  ON "public"."InvoiceInstallment"("instituteId");
CREATE INDEX IF NOT EXISTS "InvoiceItem_invoiceId_idx"
  ON "public"."InvoiceItem"("invoiceId");
CREATE INDEX IF NOT EXISTS "InvoiceItem_instituteId_idx"
  ON "public"."InvoiceItem"("instituteId");
CREATE INDEX IF NOT EXISTS "FeePayment_instituteId_paymentDate_idx"
  ON "public"."FeePayment"("instituteId", "paymentDate");
CREATE INDEX IF NOT EXISTS "FeePayment_invoiceId_idx"
  ON "public"."FeePayment"("invoiceId");
CREATE INDEX IF NOT EXISTS "FeeReceipt_instituteId_issuedAt_idx"
  ON "public"."FeeReceipt"("instituteId", "issuedAt");
CREATE INDEX IF NOT EXISTS "PaymentReversalAudit_instituteId_createdAt_idx"
  ON "public"."PaymentReversalAudit"("instituteId", "createdAt");
CREATE INDEX IF NOT EXISTS "PaymentReversalAudit_paymentId_idx"
  ON "public"."PaymentReversalAudit"("paymentId");

COMMIT;

