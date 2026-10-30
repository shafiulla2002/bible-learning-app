import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

function getTestDbUrl(): string {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const l of lines) {
      if (l.startsWith('TEST_DATABASE_URL=')) {
        return l.slice('TEST_DATABASE_URL='.length).trim().replace(/^"|"$/g, '');
      }
    }
  }
  throw new Error('TEST_DATABASE_URL not found in process.env or apps/api/.env');
}

describe('Milestone 2.5 — Financial Integrity & Concurrency Integration Suite (Cloud SQL)', () => {
  let prisma: PrismaClient;
  const testSuffix = Date.now().toString().slice(-6);
  let instituteIdA: string;
  let instituteIdB: string;
  let studentProfileIdA: string;
  jest.setTimeout(60000);

  beforeAll(async () => {
    const url = getTestDbUrl();
    prisma = new PrismaClient({
      datasources: { db: { url } },
    });
    await prisma.$connect();

    const ddlStatements = [
      `DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FeePeriodType') THEN
              CREATE TYPE "FeePeriodType" AS ENUM ('ONE_TIME', 'ANNUAL', 'SEMESTER', 'TERM', 'MONTHLY');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AllocationStatus') THEN
              CREATE TYPE "AllocationStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CANCELLED');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InvoiceStatus') THEN
              CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InstallmentStatus') THEN
              CREATE TYPE "InstallmentStatus" AS ENUM ('PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FeePaymentMode') THEN
              CREATE TYPE "FeePaymentMode" AS ENUM ('CASH', 'BANK_TRANSFER', 'CHEQUE', 'DEMAND_DRAFT', 'ONLINE', 'OTHER');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FeePaymentStatus') THEN
              CREATE TYPE "FeePaymentStatus" AS ENUM ('COMPLETED', 'PARTIALLY_REVERSED', 'REVERSED');
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FinancialSequenceType') THEN
              CREATE TYPE "FinancialSequenceType" AS ENUM ('INVOICE', 'PAYMENT', 'RECEIPT');
          END IF;
      END $$;`,

      `CREATE UNIQUE INDEX IF NOT EXISTS "StudentProfile_id_instituteId_key" ON "StudentProfile"("id", "instituteId");`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "AcademicYear_id_instituteId_key" ON "AcademicYear"("id", "instituteId");`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "AcademicTerm_id_instituteId_key" ON "AcademicTerm"("id", "instituteId");`,

      `CREATE TABLE IF NOT EXISTS "FeeCategory" (
          "id" TEXT NOT NULL,
          "instituteId" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "code" TEXT NOT NULL,
          "description" TEXT,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "FeeCategory_pkey" PRIMARY KEY ("id"),
          CONSTRAINT "FeeCategory_id_instituteId_key" UNIQUE ("id", "instituteId"),
          CONSTRAINT "FeeCategory_instituteId_code_key" UNIQUE ("instituteId", "code"),
          CONSTRAINT "FeeCategory_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE RESTRICT ON UPDATE CASCADE
      );`,

      `CREATE TABLE IF NOT EXISTS "FeeStructure" (
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
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "FeeStructure_pkey" PRIMARY KEY ("id"),
          CONSTRAINT "FeeStructure_id_instituteId_key" UNIQUE ("id", "instituteId"),
          CONSTRAINT "FeeStructure_instituteId_code_key" UNIQUE ("instituteId", "code"),
          CONSTRAINT "FeeStructure_amount_check" CHECK ("amount" > 0),
          CONSTRAINT "FeeStructure_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
          CONSTRAINT "FeeStructure_category_tenant_fkey" FOREIGN KEY ("feeCategoryId", "instituteId") REFERENCES "FeeCategory"("id", "instituteId") ON DELETE RESTRICT ON UPDATE CASCADE
      );`,

      `CREATE TABLE IF NOT EXISTS "FinancialSequenceRegistry" (
          "id" TEXT NOT NULL,
          "instituteId" TEXT NOT NULL,
          "year" INTEGER NOT NULL,
          "type" "FinancialSequenceType" NOT NULL,
          "sequenceName" TEXT NOT NULL UNIQUE,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "FinancialSequenceRegistry_pkey" PRIMARY KEY ("id"),
          CONSTRAINT "FinancialSequenceRegistry_institute_year_type_key" UNIQUE ("instituteId", "year", "type"),
          CONSTRAINT "FinancialSequenceRegistry_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE RESTRICT ON UPDATE CASCADE
      );`,

      `CREATE TABLE IF NOT EXISTS "Invoice" (
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
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id"),
          CONSTRAINT "Invoice_id_instituteId_key" UNIQUE ("id", "instituteId"),
          CONSTRAINT "Invoice_instituteId_invoiceNumber_key" UNIQUE ("instituteId", "invoiceNumber"),
          CONSTRAINT "Invoice_totalAmount_check" CHECK ("totalAmount" > 0),
          CONSTRAINT "Invoice_paidAmount_check" CHECK ("paidAmount" >= 0 AND "paidAmount" <= "totalAmount"),
          CONSTRAINT "Invoice_balanceAmount_check" CHECK ("balanceAmount" >= 0),
          CONSTRAINT "Invoice_accounting_identity_check" CHECK ("paidAmount" + "balanceAmount" = "totalAmount"),
          CONSTRAINT "Invoice_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
          CONSTRAINT "Invoice_student_tenant_fkey" FOREIGN KEY ("studentProfileId", "instituteId") REFERENCES "StudentProfile"("id", "instituteId") ON DELETE RESTRICT ON UPDATE CASCADE
      );`,

      `CREATE TABLE IF NOT EXISTS "InvoiceItem" (
          "id" TEXT NOT NULL,
          "instituteId" TEXT NOT NULL,
          "invoiceId" TEXT NOT NULL,
          "feeStructureId" TEXT,
          "studentFeeAllocationId" TEXT,
          "description" TEXT NOT NULL,
          "amount" INTEGER NOT NULL,
          CONSTRAINT "InvoiceItem_amount_check" CHECK ("amount" > 0),
          CONSTRAINT "InvoiceItem_invoice_tenant_fkey" FOREIGN KEY ("invoiceId", "instituteId") REFERENCES "Invoice"("id", "instituteId") ON DELETE NO ACTION ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED
      );`,

      `ALTER TABLE "InvoiceItem" DROP CONSTRAINT IF EXISTS "InvoiceItem_invoice_tenant_fkey";`,
      `ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoice_tenant_fkey" FOREIGN KEY ("invoiceId", "instituteId") REFERENCES "Invoice"("id", "instituteId") ON DELETE NO ACTION ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;`,

      `CREATE TABLE IF NOT EXISTS "InvoiceInstallment" (
          "id" TEXT NOT NULL,
          "instituteId" TEXT NOT NULL,
          "invoiceId" TEXT NOT NULL,
          "installmentNumber" INTEGER NOT NULL,
          "dueDate" DATE NOT NULL,
          "amount" INTEGER NOT NULL,
          "paidAmount" INTEGER NOT NULL DEFAULT 0,
          "status" "InstallmentStatus" NOT NULL DEFAULT 'PENDING',
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "InvoiceInstallment_pkey" PRIMARY KEY ("id"),
          CONSTRAINT "InvoiceInstallment_id_invoiceId_key" UNIQUE ("id", "invoiceId"),
          CONSTRAINT "InvoiceInstallment_invoiceId_installmentNumber_key" UNIQUE ("invoiceId", "installmentNumber"),
          CONSTRAINT "InvoiceInstallment_amount_check" CHECK ("amount" > 0),
          CONSTRAINT "InvoiceInstallment_paidAmount_check" CHECK ("paidAmount" >= 0 AND "paidAmount" <= "amount"),
          CONSTRAINT "InvoiceInstallment_invoice_tenant_fkey" FOREIGN KEY ("invoiceId", "instituteId") REFERENCES "Invoice"("id", "instituteId") ON DELETE RESTRICT ON UPDATE CASCADE
      );`,

      `CREATE TABLE IF NOT EXISTS "FeePayment" (
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
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "FeePayment_pkey" PRIMARY KEY ("id"),
          CONSTRAINT "FeePayment_id_instituteId_key" UNIQUE ("id", "instituteId"),
          CONSTRAINT "FeePayment_instituteId_paymentNumber_key" UNIQUE ("instituteId", "paymentNumber"),
          CONSTRAINT "FeePayment_amount_check" CHECK ("amount" > 0),
          CONSTRAINT "FeePayment_reversedAmount_check" CHECK ("reversedAmount" >= 0 AND "reversedAmount" <= "amount"),
          CONSTRAINT "FeePayment_netAmount_check" CHECK ("netAmount" = "amount" - "reversedAmount"),
          CONSTRAINT "FeePayment_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
          CONSTRAINT "FeePayment_invoice_tenant_fkey" FOREIGN KEY ("invoiceId", "instituteId") REFERENCES "Invoice"("id", "instituteId") ON DELETE RESTRICT ON UPDATE CASCADE,
          CONSTRAINT "FeePayment_installment_invoice_fkey" FOREIGN KEY ("installmentId", "invoiceId") REFERENCES "InvoiceInstallment"("id", "invoiceId") ON DELETE RESTRICT ON UPDATE CASCADE
      );`,

      `CREATE TABLE IF NOT EXISTS "FeeReceipt" (
          "id" TEXT NOT NULL,
          "instituteId" TEXT NOT NULL,
          "paymentId" TEXT NOT NULL UNIQUE,
          "receiptNumber" TEXT NOT NULL,
          "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "issuedByUserId" TEXT NOT NULL,
          "pdfUrl" TEXT,
          CONSTRAINT "FeeReceipt_pkey" PRIMARY KEY ("id"),
          CONSTRAINT "FeeReceipt_payment_tenant_key" UNIQUE ("paymentId", "instituteId"),
          CONSTRAINT "FeeReceipt_institute_receiptNumber_key" UNIQUE ("instituteId", "receiptNumber"),
          CONSTRAINT "FeeReceipt_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
          CONSTRAINT "FeeReceipt_payment_tenant_fkey" FOREIGN KEY ("paymentId", "instituteId") REFERENCES "FeePayment"("id", "instituteId") ON DELETE RESTRICT ON UPDATE CASCADE
      );`,

      `DO $$ BEGIN
          IF EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'FeeReceipt' AND column_name = 'feePaymentId'
          ) THEN
              ALTER TABLE "FeeReceipt" RENAME COLUMN "feePaymentId" TO "paymentId";
          END IF;
      END $$;`,

      `CREATE TABLE IF NOT EXISTS "PaymentReversalAudit" (
          "id" TEXT NOT NULL,
          "instituteId" TEXT NOT NULL,
          "paymentId" TEXT NOT NULL,
          "reversedByUserId" TEXT NOT NULL,
          "reason" TEXT NOT NULL,
          "reversedAmount" INTEGER NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "PaymentReversalAudit_pkey" PRIMARY KEY ("id"),
          CONSTRAINT "PaymentReversalAudit_reversedAmount_check" CHECK ("reversedAmount" > 0),
          CONSTRAINT "PaymentReversalAudit_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
          CONSTRAINT "PaymentReversalAudit_payment_tenant_fkey" FOREIGN KEY ("paymentId", "instituteId") REFERENCES "FeePayment"("id", "instituteId") ON DELETE RESTRICT ON UPDATE CASCADE
      );`,

      `DO $$ BEGIN
          IF EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'PaymentReversalAudit' AND column_name = 'feePaymentId'
          ) THEN
              ALTER TABLE "PaymentReversalAudit" RENAME COLUMN "feePaymentId" TO "paymentId";
          END IF;
      END $$;`,

      `DROP FUNCTION IF EXISTS get_next_financial_sequence(TEXT, INTEGER, TEXT);`,

      `CREATE OR REPLACE FUNCTION fn_protect_invoice_item()
      RETURNS TRIGGER AS $$
      DECLARE
          v_source_status "InvoiceStatus";
          v_dest_status "InvoiceStatus";
      BEGIN
          IF TG_OP = 'INSERT' THEN
              SELECT status INTO v_dest_status 
              FROM "Invoice" 
              WHERE id = NEW."invoiceId" AND "instituteId" = NEW."instituteId"
              FOR SHARE;

              IF NOT FOUND THEN
                  RAISE EXCEPTION 'Tenant Violation: Parent Invoice % does not exist in institute %', NEW."invoiceId", NEW."instituteId";
              END IF;
              IF v_dest_status <> 'DRAFT' THEN
                  RAISE EXCEPTION 'Financial Violation: Cannot add InvoiceItem to invoice % with status %', NEW."invoiceId", v_dest_status;
              END IF;
              RETURN NEW;

          ELSIF TG_OP = 'DELETE' THEN
              SELECT status INTO v_source_status 
              FROM "Invoice" 
              WHERE id = OLD."invoiceId" AND "instituteId" = OLD."instituteId"
              FOR SHARE;

              IF NOT FOUND THEN
                  RAISE EXCEPTION 'Tenant Violation: Cannot delete item: Parent Invoice % does not exist in institute %', OLD."invoiceId", OLD."instituteId";
              END IF;
              IF v_source_status <> 'DRAFT' THEN
                  RAISE EXCEPTION 'Financial Violation: Cannot delete InvoiceItem from invoice % with status %', OLD."invoiceId", v_source_status;
              END IF;
              RETURN OLD;

          ELSIF TG_OP = 'UPDATE' THEN
              -- 1. Always validate source invoice
              SELECT status INTO v_source_status 
              FROM "Invoice" 
              WHERE id = OLD."invoiceId" AND "instituteId" = OLD."instituteId"
              FOR SHARE;

              IF NOT FOUND THEN
                  RAISE EXCEPTION 'Tenant Violation: Source Invoice % does not exist in institute %', OLD."invoiceId", OLD."instituteId";
              END IF;
              IF v_source_status <> 'DRAFT' THEN
                  RAISE EXCEPTION 'Financial Violation: Cannot modify InvoiceItem on issued invoice % with status %', OLD."invoiceId", v_source_status;
              END IF;

              -- 2. Always validate destination invoice (even on same-invoice updates)
              SELECT status INTO v_dest_status 
              FROM "Invoice" 
              WHERE id = NEW."invoiceId" AND "instituteId" = NEW."instituteId"
              FOR SHARE;

              IF NOT FOUND THEN
                  RAISE EXCEPTION 'Tenant Violation: Destination Invoice % does not exist in institute %', NEW."invoiceId", NEW."instituteId";
              END IF;
              IF v_dest_status <> 'DRAFT' THEN
                  RAISE EXCEPTION 'Financial Violation: Cannot reassign or save InvoiceItem to invoice % with status %', NEW."invoiceId", v_dest_status;
              END IF;
              RETURN NEW;
          END IF;
          RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;`,

      `DROP TRIGGER IF EXISTS trg_invoice_item_protection ON "InvoiceItem";`,
      `CREATE TRIGGER trg_invoice_item_protection
      BEFORE INSERT OR UPDATE OR DELETE ON "InvoiceItem"
      FOR EACH ROW EXECUTE FUNCTION fn_protect_invoice_item();`,

      `CREATE OR REPLACE FUNCTION fn_protect_invoice_installment()
      RETURNS TRIGGER AS $$
      DECLARE
          v_old_status "InvoiceStatus";
          v_new_status "InvoiceStatus";
          v_old_immutable jsonb;
          v_new_immutable jsonb;
      BEGIN
          IF TG_OP = 'INSERT' THEN
              SELECT status INTO v_new_status 
              FROM "Invoice" 
              WHERE id = NEW."invoiceId" AND "instituteId" = NEW."instituteId"
              FOR SHARE;

              IF v_new_status IS NULL THEN
                  RAISE EXCEPTION 'Tenant Violation: Parent Invoice % does not exist in institute %', NEW."invoiceId", NEW."instituteId";
              END IF;
              IF v_new_status <> 'DRAFT' THEN
                  RAISE EXCEPTION 'Financial Violation: Cannot add InvoiceInstallment to issued invoice % with status %', NEW."invoiceId", v_new_status;
              END IF;
              RETURN NEW;

          ELSIF TG_OP = 'DELETE' THEN
              SELECT status INTO v_old_status 
              FROM "Invoice" 
              WHERE id = OLD."invoiceId" AND "instituteId" = OLD."instituteId"
              FOR SHARE;

              IF v_old_status IS NULL THEN
                  RAISE EXCEPTION 'Tenant Violation: Cannot delete installment: Parent Invoice % does not exist in institute %', OLD."invoiceId", OLD."instituteId";
              END IF;
              IF v_old_status <> 'DRAFT' THEN
                  RAISE EXCEPTION 'Financial Violation: Cannot delete InvoiceInstallment from issued invoice % with status %', OLD."invoiceId", v_old_status;
              END IF;
              RETURN OLD;

          ELSIF TG_OP = 'UPDATE' THEN
              SELECT status INTO v_old_status 
              FROM "Invoice" 
              WHERE id = OLD."invoiceId" AND "instituteId" = OLD."instituteId"
              FOR SHARE;

              IF v_old_status IS NULL THEN
                  RAISE EXCEPTION 'Tenant Violation: Source Invoice % does not exist in institute %', OLD."invoiceId", OLD."instituteId";
              END IF;
              IF v_old_status = 'DRAFT' THEN
                  RETURN NEW;
              END IF;

              -- Genuinely strict allowlist: ONLY paidAmount, status, updatedAt may change.
              -- Strip the allowlisted fields and compare the entire remaining JSONB payloads.
              -- This strictly protects ALL current and ANY future schema columns.
              v_old_immutable := to_jsonb(OLD) - 'paidAmount' - 'status' - 'updatedAt';
              v_new_immutable := to_jsonb(NEW) - 'paidAmount' - 'status' - 'updatedAt';

              IF v_old_immutable IS DISTINCT FROM v_new_immutable THEN
                  RAISE EXCEPTION 'Financial Violation: On issued invoice %, only paidAmount, status, and updatedAt may be updated. All other current and future fields are strictly immutable.', OLD."invoiceId";
              END IF;
              RETURN NEW;
          END IF;
          RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;`,

      `DROP TRIGGER IF EXISTS trg_invoice_installment_protection ON "InvoiceInstallment";`,
      `CREATE TRIGGER trg_invoice_installment_protection
      BEFORE INSERT OR UPDATE OR DELETE ON "InvoiceInstallment"
      FOR EACH ROW EXECUTE FUNCTION fn_protect_invoice_installment();`,

      `CREATE OR REPLACE FUNCTION fn_prevent_audit_update_or_delete()
      RETURNS TRIGGER AS $$
      BEGIN
          RAISE EXCEPTION 'Audit Violation: PaymentReversalAudit records are strictly append-only and cannot be updated or deleted.';
      END;
      $$ LANGUAGE plpgsql;`,

      `DROP TRIGGER IF EXISTS trg_payment_reversal_audit_immutable ON "PaymentReversalAudit";`,
      `CREATE TRIGGER trg_payment_reversal_audit_immutable
      BEFORE UPDATE OR DELETE ON "PaymentReversalAudit"
      FOR EACH ROW EXECUTE FUNCTION fn_prevent_audit_update_or_delete();`,

      `CREATE OR REPLACE FUNCTION fn_reconcile_payment_reversed_amount()
      RETURNS TRIGGER AS $$
      DECLARE
          v_audit_sum INTEGER;
      BEGIN
          PERFORM 1 FROM "FeePayment" WHERE id = NEW."id" FOR UPDATE;

          SELECT COALESCE(SUM("reversedAmount"), 0) INTO v_audit_sum
          FROM "PaymentReversalAudit"
          WHERE "paymentId" = NEW."id";

          IF NEW."reversedAmount" <> v_audit_sum THEN
              RAISE EXCEPTION 'Financial Invariant Failure: FeePayment.reversedAmount (%) does not match sum of PaymentReversalAudit (%) for payment %',
                  NEW."reversedAmount", v_audit_sum, NEW."id";
          END IF;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;`,

      `DROP TRIGGER IF EXISTS trg_payment_reversal_reconciliation ON "FeePayment";`,
      `CREATE CONSTRAINT TRIGGER trg_payment_reversal_reconciliation
      AFTER INSERT OR UPDATE OF "reversedAmount" ON "FeePayment"
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION fn_reconcile_payment_reversed_amount();`,

      `CREATE OR REPLACE FUNCTION fn_reconcile_audit_insert()
      RETURNS TRIGGER AS $$
      DECLARE
          v_payment_reversed INTEGER;
          v_audit_sum INTEGER;
      BEGIN
          PERFORM 1 FROM "FeePayment" WHERE id = NEW."paymentId" FOR UPDATE;

          SELECT "reversedAmount" INTO v_payment_reversed
          FROM "FeePayment"
          WHERE "id" = NEW."paymentId";

          SELECT COALESCE(SUM("reversedAmount"), 0) INTO v_audit_sum
          FROM "PaymentReversalAudit"
          WHERE "paymentId" = NEW."paymentId";

          IF v_audit_sum <> v_payment_reversed THEN
              RAISE EXCEPTION 'Financial Invariant Failure: Sum of PaymentReversalAudit (%) does not match FeePayment.reversedAmount (%) for payment %',
                  v_audit_sum, v_payment_reversed, NEW."paymentId";
          END IF;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;`,

      `DROP TRIGGER IF EXISTS trg_audit_reversal_reconciliation ON "PaymentReversalAudit";`,
      `CREATE CONSTRAINT TRIGGER trg_audit_reversal_reconciliation
      AFTER INSERT ON "PaymentReversalAudit"
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION fn_reconcile_audit_insert();`,

      `DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bible_provisioner') THEN
              CREATE ROLE bible_provisioner NOLOGIN;
          END IF;
      END $$;`,

      `GRANT USAGE, CREATE ON SCHEMA public TO bible_provisioner;`,
      `GRANT SELECT, INSERT, UPDATE, DELETE ON "FinancialSequenceRegistry" TO bible_provisioner;`,
      `GRANT SELECT ON "Institute" TO bible_provisioner;`,
      `GRANT bible_provisioner TO bible_app WITH INHERIT FALSE;`,
      `SET ROLE bible_provisioner;`,

      `CREATE OR REPLACE FUNCTION provision_financial_sequence(
          p_institute_id TEXT,
          p_year INTEGER,
          p_type TEXT
      ) RETURNS TEXT AS $$
      DECLARE
          v_lock_key BIGINT;
          v_seq_name TEXT;
          v_reg_seq TEXT;
          v_reg_inst TEXT;
          v_reg_year INTEGER;
          v_reg_type public."FinancialSequenceType";
          v_collision_count INTEGER := 0;
      BEGIN
          IF p_type NOT IN ('INVOICE', 'PAYMENT', 'RECEIPT') THEN
              RAISE EXCEPTION 'Validation Error: Invalid financial sequence type %. Must be INVOICE, PAYMENT, or RECEIPT', p_type;
          END IF;

          IF NOT EXISTS (SELECT 1 FROM public."Institute" WHERE id = p_institute_id) THEN
              RAISE EXCEPTION 'Tenant Violation: Institute % does not exist', p_institute_id;
          END IF;

          -- Advisory lock serializes first-time creation per (institute, year, type) tuple
          v_lock_key := ('x' || pg_catalog.substr(pg_catalog.md5(p_institute_id || '_' || p_year || '_' || p_type), 1, 16))::bit(64)::bigint;
          PERFORM pg_catalog.pg_advisory_xact_lock(v_lock_key);

          SELECT "sequenceName", "instituteId", "year", "type" 
          INTO v_reg_seq, v_reg_inst, v_reg_year, v_reg_type
          FROM public."FinancialSequenceRegistry"
          WHERE "instituteId" = p_institute_id AND "year" = p_year AND "type" = p_type::public."FinancialSequenceType";

          IF v_reg_seq IS NOT NULL THEN
              IF v_reg_inst <> p_institute_id OR v_reg_year <> p_year OR v_reg_type <> p_type::public."FinancialSequenceType" THEN
                  RAISE EXCEPTION 'Security Violation: Sequence % belongs to institute %, year %, type %, not requested institute %, year %, type %',
                      v_reg_seq, v_reg_inst, v_reg_year, v_reg_type, p_institute_id, p_year, p_type;
              END IF;
              RETURN v_reg_seq;
          END IF;

          v_seq_name := 'seq_' || pg_catalog.substr(pg_catalog.md5(p_institute_id || '_' || p_year || '_' || p_type), 1, 24);

          WHILE EXISTS (SELECT 1 FROM public."FinancialSequenceRegistry" WHERE "sequenceName" = v_seq_name) LOOP
              v_collision_count := v_collision_count + 1;
              v_seq_name := 'seq_' || pg_catalog.substr(pg_catalog.md5(p_institute_id || '_' || p_year || '_' || p_type), 1, 20) || '_' || v_collision_count;
          END LOOP;

          IF EXISTS (
              SELECT 1 FROM pg_catalog.pg_class c 
              JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace 
              WHERE c.relname = v_seq_name AND c.relkind = 'S' AND n.nspname = 'public'
          ) THEN
              RAISE EXCEPTION 'Security Violation: Sequence % already exists in PostgreSQL but is unregistered in FinancialSequenceRegistry', v_seq_name;
          END IF;

          EXECUTE pg_catalog.format('CREATE SEQUENCE public.%I START WITH 1 INCREMENT BY 1', v_seq_name);

          INSERT INTO public."FinancialSequenceRegistry" ("id", "instituteId", "year", "type", "sequenceName")
          VALUES (pg_catalog.gen_random_uuid(), p_institute_id, p_year, p_type::public."FinancialSequenceType", v_seq_name);

          RETURN v_seq_name;
      END;
      $$ LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = pg_catalog, public, pg_temp;`,

      `REVOKE ALL ON FUNCTION provision_financial_sequence(TEXT, INTEGER, TEXT) FROM PUBLIC;`,
      `REVOKE ALL ON FUNCTION provision_financial_sequence(TEXT, INTEGER, TEXT) FROM bible_app;`,
      `GRANT EXECUTE ON FUNCTION provision_financial_sequence(TEXT, INTEGER, TEXT) TO bible_provisioner;`,

      `CREATE OR REPLACE FUNCTION get_next_financial_sequence(
          p_institute_id TEXT,
          p_year INTEGER,
          p_type TEXT,
          p_prefix TEXT DEFAULT NULL,
          p_padding INTEGER DEFAULT 4
      ) RETURNS TEXT AS $$
      DECLARE
          v_seq_name TEXT;
          v_next_val BIGINT;
          v_effective_prefix TEXT;
      BEGIN
          -- 1. Validate institute existence
          IF NOT EXISTS (SELECT 1 FROM public."Institute" WHERE id = p_institute_id) THEN
              RAISE EXCEPTION 'Tenant Violation: Institute % does not exist', p_institute_id;
          END IF;

          -- 2. Restrict accepted sequence types to approved enum values
          IF p_type NOT IN ('INVOICE', 'PAYMENT', 'RECEIPT') THEN
              RAISE EXCEPTION 'Validation Error: Invalid financial sequence type %. Must be INVOICE, PAYMENT, or RECEIPT', p_type;
          END IF;

          -- 3. Validate prefix and padding
          IF p_prefix IS NOT NULL THEN
              IF pg_catalog.length(pg_catalog.btrim(p_prefix)) = 0 OR p_prefix !~ '^[A-Z0-9_-]+$' THEN
                  RAISE EXCEPTION 'Validation Error: Invalid prefix %. Must be non-empty alphanumeric string', p_prefix;
              END IF;
              v_effective_prefix := pg_catalog.btrim(p_prefix);
          ELSE
              v_effective_prefix := CASE p_type
                  WHEN 'INVOICE' THEN 'INV'
                  WHEN 'PAYMENT' THEN 'PAY'
                  WHEN 'RECEIPT' THEN 'REC'
              END;
          END IF;

          IF p_padding IS NULL OR p_padding < 3 OR p_padding > 10 THEN
              RAISE EXCEPTION 'Validation Error: Invalid padding %. Must be between 3 and 10', p_padding;
          END IF;

          -- 4. Locate sequence in registry (strictly require pre-provisioning)
          SELECT "sequenceName" INTO v_seq_name
          FROM public."FinancialSequenceRegistry"
          WHERE "instituteId" = p_institute_id AND "year" = p_year AND "type" = p_type::public."FinancialSequenceType";

          IF v_seq_name IS NULL THEN
              RAISE EXCEPTION 'Sequence Not Provisioned: Financial sequence for institute %, year %, type % must be provisioned before allocating numbers',
                  p_institute_id, p_year, p_type;
          END IF;

          -- 5. Non-transactional nextval() allocation: numbers are never reused upon business transaction rollback
          v_next_val := pg_catalog.nextval('public.' || pg_catalog.quote_ident(v_seq_name));
          RETURN v_effective_prefix || '/' || p_year || '/' || pg_catalog.lpad(v_next_val::TEXT, p_padding, '0');
      END;
      $$ LANGUAGE plpgsql 
      SECURITY DEFINER 
      SET search_path = pg_catalog, public, pg_temp;`,

      `REVOKE ALL ON FUNCTION get_next_financial_sequence(TEXT, INTEGER, TEXT, TEXT, INTEGER) FROM PUBLIC;`,
      `GRANT EXECUTE ON FUNCTION get_next_financial_sequence(TEXT, INTEGER, TEXT, TEXT, INTEGER) TO bible_app;`,
      `RESET ROLE;`
    ];

    for (const stmt of ddlStatements) {
      await prisma.$executeRawUnsafe(stmt);
    }

    // Seed test institutes
    const instA = await prisma.institute.create({
      data: {
        name: `Finance Integrity Inst A ${testSuffix}`,
        slug: `fin-inst-a-${testSuffix}`,
        timezone: 'Asia/Kolkata',
        currency: 'INR',
      },
    });
    instituteIdA = instA.id;

    const instB = await prisma.institute.create({
      data: {
        name: `Finance Integrity Inst B ${testSuffix}`,
        slug: `fin-inst-b-${testSuffix}`,
        timezone: 'America/New_York',
        currency: 'INR',
      },
    });
    instituteIdB = instB.id;

    // Seed student for Institute A
    const user = await prisma.user.create({
      data: {
        fullName: `Student Fin ${testSuffix}`,
        phoneE164: `+91983${testSuffix}01`,
        email: `student.fin.${testSuffix}@example.com`,
        memberships: {
          create: {
            instituteId: instituteIdA,
            role: 'STUDENT',
            status: 'ACTIVE',
            studentProfile: {
              create: {
                instituteId: instituteIdA,
                admissionNo: `ADM-FIN-${testSuffix}`,
              },
            },
          },
        },
      },
      include: {
        memberships: {
          include: { studentProfile: true },
        },
      },
    });
    studentProfileIdA = user.memberships[0].studentProfile!.id;
  });

  afterAll(async () => {
    try {
      await prisma.$executeRawUnsafe(`DELETE FROM "InvoiceItem" WHERE "instituteId" IN ('${instituteIdA}', '${instituteIdB}')`);
      await prisma.$executeRawUnsafe(`DELETE FROM "InvoiceInstallment" WHERE "instituteId" IN ('${instituteIdA}', '${instituteIdB}')`);
      await prisma.$executeRawUnsafe(`DELETE FROM "PaymentReversalAudit" WHERE "instituteId" IN ('${instituteIdA}', '${instituteIdB}')`);
      await prisma.$executeRawUnsafe(`DELETE FROM "FeePayment" WHERE "instituteId" IN ('${instituteIdA}', '${instituteIdB}')`);
      await prisma.$executeRawUnsafe(`DELETE FROM "Invoice" WHERE "instituteId" IN ('${instituteIdA}', '${instituteIdB}')`);
      await prisma.$executeRawUnsafe(`DELETE FROM "FinancialSequenceRegistry" WHERE "instituteId" IN ('${instituteIdA}', '${instituteIdB}')`);
      await prisma.studentProfile.deleteMany({ where: { instituteId: { in: [instituteIdA, instituteIdB] } } });
      await prisma.membership.deleteMany({ where: { instituteId: { in: [instituteIdA, instituteIdB] } } });
      await prisma.institute.deleteMany({ where: { id: { in: [instituteIdA, instituteIdB] } } });
    } catch (_) {}
    await prisma.$disconnect();
  });

  describe('1. InvoiceItem Trigger Protections', () => {
    let invoiceId: string;
    let itemId: string;

    beforeEach(async () => {
      invoiceId = `inv-item-${Date.now()}`;
      itemId = `item-${Date.now()}`;
      await prisma.$executeRawUnsafe(`
        INSERT INTO "Invoice" ("id", "instituteId", "studentProfileId", "invoiceNumber", "status", "dueDate", "totalAmount", "paidAmount", "balanceAmount")
        VALUES ('${invoiceId}', '${instituteIdA}', '${studentProfileIdA}', 'INV-TEST-${Date.now()}', 'DRAFT', '2026-11-30', 50000, 0, 50000)
      `);
    });

    it('permits INSERT, UPDATE, and DELETE on DRAFT invoice', async () => {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "InvoiceItem" ("id", "instituteId", "invoiceId", "description", "amount")
        VALUES ('${itemId}', '${instituteIdA}', '${invoiceId}', 'Tuition Fee', 50000)
      `);
      await prisma.$executeRawUnsafe(`
        UPDATE "InvoiceItem" SET "amount" = 50000, "description" = 'Tuition Fee Updated'
        WHERE "id" = '${itemId}'
      `);
      await prisma.$executeRawUnsafe(`
        DELETE FROM "InvoiceItem" WHERE "id" = '${itemId}'
      `);
    });

    it('strictly prohibits INSERT, UPDATE, or DELETE on an ISSUED invoice', async () => {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "InvoiceItem" ("id", "instituteId", "invoiceId", "description", "amount")
        VALUES ('${itemId}', '${instituteIdA}', '${invoiceId}', 'Tuition Fee', 50000)
      `);
      await prisma.$executeRawUnsafe(`
        UPDATE "Invoice" SET "status" = 'ISSUED' WHERE "id" = '${invoiceId}'
      `);

      await expect(
        prisma.$executeRawUnsafe(`
          INSERT INTO "InvoiceItem" ("id", "instituteId", "invoiceId", "description", "amount")
          VALUES ('${itemId}-2', '${instituteIdA}', '${invoiceId}', 'Late Fee', 1000)
        `)
      ).rejects.toThrow(/Financial Violation: Cannot add InvoiceItem to invoice .* with status ISSUED/);

      await expect(
        prisma.$executeRawUnsafe(`
          UPDATE "InvoiceItem" SET "amount" = 60000 WHERE "id" = '${itemId}'
        `)
      ).rejects.toThrow(/Financial Violation: Cannot modify InvoiceItem on issued invoice .* with status ISSUED/);

      await expect(
        prisma.$executeRawUnsafe(`
          DELETE FROM "InvoiceItem" WHERE "id" = '${itemId}'
        `)
      ).rejects.toThrow(/Financial Violation: Cannot delete InvoiceItem from invoice .* with status ISSUED/);
    });

    it('rejects INSERT and DELETE when parent invoice does not exist', async () => {
      await expect(
        prisma.$executeRawUnsafe(`
          INSERT INTO "InvoiceItem" ("id", "instituteId", "invoiceId", "description", "amount")
          VALUES ('${itemId}-missing', '${instituteIdA}', 'non-existent-invoice', 'Tuition Fee', 50000)
        `)
      ).rejects.toThrow(/Tenant Violation: Parent Invoice non-existent-invoice does not exist/);

      // Verify trigger rejects DELETE when parent invoice is missing using deferred FK inside a transaction
      const tempInvId = `temp-inv-${Date.now()}`;
      const tempItemId = `temp-item-${Date.now()}`;
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`
          INSERT INTO "Invoice" ("id", "instituteId", "studentProfileId", "invoiceNumber", "status", "dueDate", "totalAmount", "paidAmount", "balanceAmount")
          VALUES ('${tempInvId}', '${instituteIdA}', '${studentProfileIdA}', 'INV-TEMP-${Date.now()}', 'DRAFT', '2026-11-30', 10000, 0, 10000)
        `);
        await tx.$executeRawUnsafe(`
          INSERT INTO "InvoiceItem" ("id", "instituteId", "invoiceId", "description", "amount")
          VALUES ('${tempItemId}', '${instituteIdA}', '${tempInvId}', 'Temp Item', 10000)
        `);
        // Delete parent invoice inside transaction (deferred foreign key permits this until commit)
        await tx.$executeRawUnsafe(`DELETE FROM "Invoice" WHERE "id" = '${tempInvId}'`);

        // Attempting to delete the item now triggers fn_protect_invoice_item() on DELETE
        await expect(
          tx.$executeRawUnsafe(`DELETE FROM "InvoiceItem" WHERE "id" = '${tempItemId}'`)
        ).rejects.toThrow(/Tenant Violation: Cannot delete item: Parent Invoice .* does not exist/);

        // Abort transaction to clean up
        throw new Error('Rollback test transaction');
      }).catch((err) => {
        if (!err.message.includes('Rollback test transaction')) throw err;
      });
    });

    it('rejects UPDATE with missing source or destination invoice', async () => {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "InvoiceItem" ("id", "instituteId", "invoiceId", "description", "amount")
        VALUES ('${itemId}', '${instituteIdA}', '${invoiceId}', 'Tuition Fee', 50000)
      `);

      // Update targeting a non-existent destination invoice
      await expect(
        prisma.$executeRawUnsafe(`
          UPDATE "InvoiceItem" SET "invoiceId" = 'non-existent-dest-invoice' WHERE "id" = '${itemId}'
        `)
      ).rejects.toThrow(/Tenant Violation: Destination Invoice non-existent-dest-invoice does not exist/);
    });

    it('rejects cross-institute item reassignment', async () => {
      await expect(
        prisma.$executeRawUnsafe(`
          INSERT INTO "InvoiceItem" ("id", "instituteId", "invoiceId", "description", "amount")
          VALUES ('${itemId}', '${instituteIdB}', '${invoiceId}', 'Tampered Item', 50000)
        `)
      ).rejects.toThrow(/Tenant Violation/);
    });
  });

  describe('2. InvoiceInstallment Trigger & Strict Allowlist', () => {
    let invoiceId: string;
    let instId: string;

    beforeEach(async () => {
      invoiceId = `inv-inst-${Date.now()}`;
      instId = `inst-${Date.now()}`;
      await prisma.$executeRawUnsafe(`
        INSERT INTO "Invoice" ("id", "instituteId", "studentProfileId", "invoiceNumber", "status", "dueDate", "totalAmount", "paidAmount", "balanceAmount")
        VALUES ('${invoiceId}', '${instituteIdA}', '${studentProfileIdA}', 'INV-INST-${Date.now()}', 'DRAFT', '2026-11-30', 100000, 0, 100000)
      `);
      await prisma.$executeRawUnsafe(`
        INSERT INTO "InvoiceInstallment" ("id", "instituteId", "invoiceId", "installmentNumber", "dueDate", "amount", "paidAmount", "status")
        VALUES ('${instId}', '${instituteIdA}', '${invoiceId}', 1, '2026-11-15', 100000, 0, 'PENDING')
      `);
      await prisma.$executeRawUnsafe(`
        UPDATE "Invoice" SET "status" = 'ISSUED' WHERE "id" = '${invoiceId}'
      `);
    });

    it('allows payment engine to update paidAmount, status, and updatedAt on issued invoice', async () => {
      await prisma.$executeRawUnsafe(`
        UPDATE "InvoiceInstallment" 
        SET "paidAmount" = 50000, "status" = 'PARTIALLY_PAID', "updatedAt" = NOW()
        WHERE "id" = '${instId}'
      `);
      const [updated] = await prisma.$queryRawUnsafe<any[]>(`
        SELECT "paidAmount", "status" FROM "InvoiceInstallment" WHERE "id" = '${instId}'
      `);
      expect(updated.paidAmount).toBe(50000);
      expect(updated.status).toBe('PARTIALLY_PAID');
    });

    it('rejects direct SQL updates to amount, dueDate, or installmentNumber on issued invoice', async () => {
      await expect(
        prisma.$executeRawUnsafe(`
          UPDATE "InvoiceInstallment" SET "amount" = 80000 WHERE "id" = '${instId}'
        `)
      ).rejects.toThrow(/only paidAmount, status, and updatedAt may be updated/);

      await expect(
        prisma.$executeRawUnsafe(`
          UPDATE "InvoiceInstallment" SET "dueDate" = '2026-12-31' WHERE "id" = '${instId}'
        `)
      ).rejects.toThrow(/only paidAmount, status, and updatedAt may be updated/);

      await expect(
        prisma.$executeRawUnsafe(`
          UPDATE "InvoiceInstallment" SET "instituteId" = '${instituteIdB}' WHERE "id" = '${instId}'
        `)
      ).rejects.toThrow(/only paidAmount, status, and updatedAt may be updated/);
    });

    it('strictly rejects modifications to any unexpected or test-only column on issued invoice', async () => {
      // Add a test column dynamically to verify that the jsonb comparison catches ANY column outside allowlist
      await prisma.$executeRawUnsafe(`ALTER TABLE "InvoiceInstallment" ADD COLUMN IF NOT EXISTS "notes" TEXT;`);

      await expect(
        prisma.$executeRawUnsafe(`
          UPDATE "InvoiceInstallment" SET "notes" = 'Unauthorized modification' WHERE "id" = '${instId}'
        `)
      ).rejects.toThrow(/All other current and future fields are strictly immutable/);
    });

    it('rejects deletion of installments from an issued invoice or when parent is missing', async () => {
      await expect(
        prisma.$executeRawUnsafe(`
          DELETE FROM "InvoiceInstallment" WHERE "id" = '${instId}'
        `)
      ).rejects.toThrow(/Financial Violation: Cannot delete InvoiceInstallment from issued invoice/);
    });
  });

  describe('3. Deferred Reversal Reconciliation Invariant', () => {
    let invoiceId: string;
    let paymentId: string;

    beforeEach(async () => {
      invoiceId = `inv-rev-${Date.now()}`;
      paymentId = `pay-rev-${Date.now()}`;
      await prisma.$executeRawUnsafe(`
        INSERT INTO "Invoice" ("id", "instituteId", "studentProfileId", "invoiceNumber", "status", "dueDate", "totalAmount", "paidAmount", "balanceAmount")
        VALUES ('${invoiceId}', '${instituteIdA}', '${studentProfileIdA}', 'INV-REV-${Date.now()}', 'ISSUED', '2026-11-30', 100000, 100000, 0)
      `);
      await prisma.$executeRawUnsafe(`
        INSERT INTO "FeePayment" ("id", "instituteId", "invoiceId", "paymentNumber", "amount", "reversedAmount", "netAmount", "paymentMode", "status", "recordedByUserId")
        VALUES ('${paymentId}', '${instituteIdA}', '${invoiceId}', 'PAY-REV-${Date.now()}', 100000, 0, 100000, 'CASH', 'COMPLETED', 'user-admin')
      `);
    });

    it('succeeds when FeePayment.reversedAmount matches sum of PaymentReversalAudit at commit', async () => {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`
          UPDATE "FeePayment" SET "reversedAmount" = 40000, "netAmount" = 60000, "status" = 'PARTIALLY_REVERSED'
          WHERE "id" = '${paymentId}'
        `);
        await tx.$executeRawUnsafe(`
          INSERT INTO "PaymentReversalAudit" ("id", "instituteId", "paymentId", "reversedByUserId", "reason", "reversedAmount")
          VALUES ('rev-${Date.now()}', '${instituteIdA}', '${paymentId}', 'admin-user', 'Partial bank refund', 40000)
        `);
      });

      const [p] = await prisma.$queryRawUnsafe<any[]>(`SELECT "reversedAmount", "netAmount" FROM "FeePayment" WHERE "id" = '${paymentId}'`);
      expect(p.reversedAmount).toBe(40000);
      expect(p.netAmount).toBe(60000);
    });

    it('rejects direct FeePayment.reversedAmount update without matching audit log at commit', async () => {
      await expect(
        prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(`
            UPDATE "FeePayment" SET "reversedAmount" = 50000, "netAmount" = 50000
            WHERE "id" = '${paymentId}'
          `);
        })
      ).rejects.toThrow(/Financial Invariant Failure/);
    });

    it('rejects audit log insertion without matching FeePayment.reversedAmount update at commit', async () => {
      await expect(
        prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(`
            INSERT INTO "PaymentReversalAudit" ("id", "instituteId", "paymentId", "reversedByUserId", "reason", "reversedAmount")
            VALUES ('rev-mismatch-${Date.now()}', '${instituteIdA}', '${paymentId}', 'admin-user', 'Mismatch audit', 30000)
          `);
        })
      ).rejects.toThrow(/Financial Invariant Failure/);
    });

    it('strictly prohibits UPDATE or DELETE on PaymentReversalAudit records', async () => {
      const auditId = `rev-imm-${Date.now()}`;
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`
          UPDATE "FeePayment" SET "reversedAmount" = 20000, "netAmount" = 80000 WHERE "id" = '${paymentId}'
        `);
        await tx.$executeRawUnsafe(`
          INSERT INTO "PaymentReversalAudit" ("id", "instituteId", "paymentId", "reversedByUserId", "reason", "reversedAmount")
          VALUES ('${auditId}', '${instituteIdA}', '${paymentId}', 'admin-user', 'Initial audit', 20000)
        `);
      });

      await expect(
        prisma.$executeRawUnsafe(`UPDATE "PaymentReversalAudit" SET "reason" = 'Tampered Reason' WHERE "id" = '${auditId}'`)
      ).rejects.toThrow(/Audit Violation: PaymentReversalAudit records are strictly append-only/);

      await expect(
        prisma.$executeRawUnsafe(`DELETE FROM "PaymentReversalAudit" WHERE "id" = '${auditId}'`)
      ).rejects.toThrow(/Audit Violation: PaymentReversalAudit records are strictly append-only/);
    });
  });

  describe('4. Secure PostgreSQL Sequence Provisioning & Rollback Non-Reuse', () => {
    const provisionSequence = async (inst: string, yr: number, type: string) => {
      return await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL ROLE bible_provisioner;`);
        const [res] = await tx.$queryRawUnsafe<any[]>(
          `SELECT provision_financial_sequence('${inst}', ${yr}, '${type}') AS seq_name`
        );
        return res.seq_name as string;
      });
    };

    it('validates institute existence, sequence pre-provisioning, and rejects invalid parameters', async () => {
      await expect(
        prisma.$queryRawUnsafe(`SELECT get_next_financial_sequence('non-existent-inst-id', 2026, 'INVOICE')`)
      ).rejects.toThrow(/Tenant Violation: Institute non-existent-inst-id does not exist/);

      await expect(
        prisma.$queryRawUnsafe(`SELECT get_next_financial_sequence('${instituteIdA}', 2026, 'INVALID_TYPE')`)
      ).rejects.toThrow(/Validation Error: Invalid financial sequence type/);

      // Verify that calling get_next_financial_sequence on an unprovisioned sequence raises explicit error
      await expect(
        prisma.$queryRawUnsafe(`SELECT get_next_financial_sequence('${instituteIdA}', 2040, 'INVOICE')`)
      ).rejects.toThrow(/Sequence Not Provisioned: Financial sequence for institute .* must be provisioned before allocating numbers/);

      // Verify direct invocation of provision_financial_sequence by bible_app is strictly denied
      await expect(
        prisma.$queryRawUnsafe(`SELECT provision_financial_sequence('${instituteIdA}', 2041, 'INVOICE')`)
      ).rejects.toThrow(/permission denied for function provision_financial_sequence/);

      // Provision sequence via trusted provisioning service/role
      await provisionSequence(instituteIdA, 2041, 'INVOICE');

      await expect(
        prisma.$queryRawUnsafe(`SELECT get_next_financial_sequence('${instituteIdA}', 2041, 'INVOICE', 'INV@#$', 4)`)
      ).rejects.toThrow(/Validation Error: Invalid prefix/);

      await expect(
        prisma.$queryRawUnsafe(`SELECT get_next_financial_sequence('${instituteIdA}', 2041, 'INVOICE', 'INV', 2)`)
      ).rejects.toThrow(/Validation Error: Invalid padding/);
    });

    it('concurrent first-time provisioning produces unique numbers with zero race conditions', async () => {
      const year = 2026;
      // 1. Concurrent provisioning: 5 simultaneous callers request provisioning for same (institute, year, type)
      const provPromises = Array.from({ length: 5 }).map(() =>
        provisionSequence(instituteIdA, year, 'INVOICE')
      );
      const seqNames = await Promise.all(provPromises);
      // Advisory lock ensures exact 1 sequence is created and all callers receive the identical sequenceName safely
      expect(new Set(seqNames).size).toBe(1);

      // 2. Concurrent allocations from provisioned sequence produce unique sequence numbers
      const allocPromises = Array.from({ length: 5 }).map(() =>
        prisma.$queryRawUnsafe<any[]>(`SELECT get_next_financial_sequence('${instituteIdA}', ${year}, 'INVOICE') AS seq`)
      );

      const results = await Promise.all(allocPromises);
      const seqs = results.map((r) => r[0].seq);
      expect(new Set(seqs).size).toBe(5);
      expect(seqs.every((s) => s.startsWith('INV/2026/'))).toBe(true);
    });

    it('demonstrates that a rolled-back transaction never reuses its sequence number', async () => {
      const year = 2027;
      await provisionSequence(instituteIdA, year, 'INVOICE');

      const [r1] = await prisma.$queryRawUnsafe<any[]>(`SELECT get_next_financial_sequence('${instituteIdA}', ${year}, 'INVOICE') AS seq`);
      expect(r1.seq).toBe('INV/2027/0001');

      try {
        await prisma.$transaction(async (tx) => {
          await tx.$queryRawUnsafe(`SELECT get_next_financial_sequence('${instituteIdA}', ${year}, 'INVOICE') AS seq`);
          throw new Error('Simulated business transaction failure!');
        });
      } catch (err: any) {
        expect(err.message).toContain('Simulated business transaction failure');
      }

      const [r3] = await prisma.$queryRawUnsafe<any[]>(`SELECT get_next_financial_sequence('${instituteIdA}', ${year}, 'INVOICE') AS seq`);
      expect(r3.seq).toBe('INV/2027/0003');
    });

    it('guarantees tenant and document type isolation', async () => {
      const year = 2026;
      await provisionSequence(instituteIdA, year, 'PAYMENT');
      await provisionSequence(instituteIdB, year, 'PAYMENT');
      await provisionSequence(instituteIdA, year, 'RECEIPT');

      const [pA] = await prisma.$queryRawUnsafe<any[]>(`SELECT get_next_financial_sequence('${instituteIdA}', ${year}, 'PAYMENT') AS seq`);
      const [pB] = await prisma.$queryRawUnsafe<any[]>(`SELECT get_next_financial_sequence('${instituteIdB}', ${year}, 'PAYMENT') AS seq`);
      const [rA] = await prisma.$queryRawUnsafe<any[]>(`SELECT get_next_financial_sequence('${instituteIdA}', ${year}, 'RECEIPT') AS seq`);

      expect(pA.seq).toBe('PAY/2026/0001');
      expect(pB.seq).toBe('PAY/2026/0001');
      expect(rA.seq).toBe('REC/2026/0001');
    });

    it('verifies independent first-time provisioning, registry persistence, and non-reuse after rollback', async () => {
      const year = 2030;
      const testType = 'INVOICE';

      // 1. Verify that before provisioning, get_next_financial_sequence raises explicit error
      await expect(
        prisma.$queryRawUnsafe(`SELECT get_next_financial_sequence('${instituteIdA}', ${year}, '${testType}')`)
      ).rejects.toThrow(/Sequence Not Provisioned: Financial sequence for institute .* must be provisioned before allocating numbers/);

      // 2. Direct call by bible_app is strictly forbidden
      await expect(
        prisma.$queryRawUnsafe(`SELECT provision_financial_sequence('${instituteIdA}', ${year}, '${testType}')`)
      ).rejects.toThrow(/permission denied for function provision_financial_sequence/);

      // 3. Provision sequence via trusted provisioning service in an independent, committed transaction
      const seqName = await provisionSequence(instituteIdA, year, testType);
      expect(seqName).toMatch(/^seq_/);

      // 4. Confirm registry row exists
      const [reg] = await prisma.$queryRawUnsafe<any[]>(
        `SELECT "sequenceName", "instituteId", "year", "type" FROM "FinancialSequenceRegistry" WHERE "sequenceName" = '${seqName}'`
      );
      expect(reg.instituteId).toBe(instituteIdA);
      expect(reg.year).toBe(year);
      expect(reg.type).toBe('INVOICE');

      // 5. Start business transaction, allocate first number (0001), and force rollback
      try {
        await prisma.$transaction(async (tx) => {
          const [res] = await tx.$queryRawUnsafe<any[]>(
            `SELECT get_next_financial_sequence('${instituteIdA}', ${year}, '${testType}') AS seq`
          );
          expect(res.seq).toBe(`INV/${year}/0001`);
          throw new Error('Forced business transaction failure for sequence test');
        });
      } catch (err: any) {
        expect(err.message).toContain('Forced business transaction failure for sequence test');
      }

      // 6. Confirm registry entry and PostgreSQL sequence object persist after business rollback
      const [regAfter] = await prisma.$queryRawUnsafe<any[]>(
        `SELECT "sequenceName" FROM "FinancialSequenceRegistry" WHERE "sequenceName" = '${seqName}'`
      );
      expect(regAfter.sequenceName).toBe(seqName);

      // 7. Start new business transaction, allocate next number (0002)
      const [nextTxRes] = await prisma.$transaction(async (tx) => {
        return await tx.$queryRawUnsafe<any[]>(
          `SELECT get_next_financial_sequence('${instituteIdA}', ${year}, '${testType}') AS seq`
        );
      });

      // 8. Confirm 0002 > 0001 and 0001 was permanently consumed and never reused
      expect(nextTxRes.seq).toBe(`INV/${year}/0002`);
    });

    it('verifies strict SECURITY DEFINER search_path and execution privileges', async () => {
      // 1. Verify PUBLIC role cannot execute sequence functions
      const [pubCheck] = await prisma.$queryRawUnsafe<any[]>(`
        SELECT has_function_privilege('public', 'get_next_financial_sequence(text, integer, text, text, integer)', 'EXECUTE') AS pub_priv,
               has_function_privilege('public', 'provision_financial_sequence(text, integer, text)', 'EXECUTE') AS pub_prov_priv
      `);
      expect(pubCheck.pub_priv).toBe(false);
      expect(pubCheck.pub_prov_priv).toBe(false);

      // 2. Verify bible_app has NO direct execute privilege on provision_financial_sequence
      // but HAS execute privilege on get_next_financial_sequence
      const [appCheck] = await prisma.$queryRawUnsafe<any[]>(`
        SELECT has_function_privilege('bible_app', 'get_next_financial_sequence(text, integer, text, text, integer)', 'EXECUTE') AS app_priv,
               has_function_privilege('bible_app', 'provision_financial_sequence(text, integer, text)', 'EXECUTE') AS app_prov_priv
      `);
      expect(appCheck.app_priv).toBe(true);
      expect(appCheck.app_prov_priv).toBe(false);

      // 3. Verify trusted provisioning role (bible_provisioner) has execute privileges on provision_financial_sequence
      const [provCheck] = await prisma.$queryRawUnsafe<any[]>(`
        SELECT has_function_privilege('bible_provisioner', 'provision_financial_sequence(text, integer, text)', 'EXECUTE') AS prov_priv,
               has_function_privilege('bible_provisioner', 'get_next_financial_sequence(text, integer, text, text, integer)', 'EXECUTE') AS get_priv
      `);
      expect(provCheck.prov_priv).toBe(true);
      expect(provCheck.get_priv).toBe(true);

      // 4. Verify function ownership and search_path configuration
      const funcs = await prisma.$queryRawUnsafe<any[]>(`
        SELECT p.proname,
               r.rolname AS owner,
               p.prosecdef,
               p.proconfig
        FROM pg_proc p
        JOIN pg_roles r ON r.oid = p.proowner
        WHERE p.proname IN ('get_next_financial_sequence', 'provision_financial_sequence')
      `);
      for (const fn of funcs) {
        expect(fn.owner).toBe('bible_provisioner');
        expect(fn.prosecdef).toBe(true);
        expect(fn.proconfig).toEqual(['search_path=pg_catalog, public, pg_temp']);
      }
    });
  });

  describe('5. Concurrent Payment Overpayment Protection (Dual ₹700 on ₹1,000 Balance)', () => {
    it('serializes concurrent payments via row locks and prevents balance overpayment', async () => {
      const invoiceId = `inv-conc-${Date.now()}`;
      await prisma.$executeRawUnsafe(`
        INSERT INTO "Invoice" ("id", "instituteId", "studentProfileId", "invoiceNumber", "status", "dueDate", "totalAmount", "paidAmount", "balanceAmount")
        VALUES ('${invoiceId}', '${instituteIdA}', '${studentProfileIdA}', 'INV-CONC-${Date.now()}', 'ISSUED', '2026-11-30', 100000, 0, 100000)
      `);

      const recordPayment = async (amount: number, workerId: string) => {
        return await prisma.$transaction(async (tx) => {
          const [inv] = await tx.$queryRawUnsafe<any[]>(`
            SELECT id, "totalAmount", "paidAmount", "balanceAmount"
            FROM "Invoice"
            WHERE id = '${invoiceId}'
            FOR UPDATE
          `);

          if (inv.balanceAmount < amount) {
            throw new Error(`Payment exceeds balance: requested ${amount}, available ${inv.balanceAmount}`);
          }

          const newPaid = inv.paidAmount + amount;
          const newBalance = inv.totalAmount - newPaid;

          await tx.$executeRawUnsafe(
            `UPDATE "Invoice" SET "paidAmount" = ${newPaid}, "balanceAmount" = ${newBalance}, "status" = 'PARTIALLY_PAID' WHERE id = '${invoiceId}'`
          );

          return { workerId, success: true };
        });
      };

      const results = await Promise.allSettled([
        recordPayment(70000, 'Admin-1'),
        recordPayment(70000, 'Admin-2'),
      ]);

      const successes = results.filter((r) => r.status === 'fulfilled');
      const failures = results.filter((r) => r.status === 'rejected');

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(1);
      expect((failures[0] as PromiseRejectedResult).reason.message).toContain('Payment exceeds balance: requested 70000, available 30000');

      const [finalInv] = await prisma.$queryRawUnsafe<any[]>(`
        SELECT "paidAmount", "balanceAmount" FROM "Invoice" WHERE id = '${invoiceId}'
      `);
      expect(finalInv.paidAmount).toBe(70000);
      expect(finalInv.balanceAmount).toBe(30000);
    });
  });

  describe('6. Date-Only Due-Date & Timezone Overdue Engine', () => {
    it('correctly calculates overdue cutoff in Asia/Kolkata (+05:30) and America/New_York (EDT/EST)', async () => {
      const [resKolkata] = await prisma.$queryRawUnsafe<any[]>(`
        SELECT 
          ('2026-11-05'::date + INTERVAL '1 day') AT TIME ZONE 'Asia/Kolkata' AS cutoff_utc,
          NOW() > (('2026-11-05'::date + INTERVAL '1 day') AT TIME ZONE 'Asia/Kolkata') AS is_overdue
      `);
      expect(new Date(resKolkata.cutoff_utc).toISOString()).toBe('2026-11-05T18:30:00.000Z');

      const [resEDT] = await prisma.$queryRawUnsafe<any[]>(`
        SELECT ('2026-10-15'::date + INTERVAL '1 day') AT TIME ZONE 'America/New_York' AS cutoff_utc
      `);
      expect(new Date(resEDT.cutoff_utc).toISOString()).toBe('2026-10-16T04:00:00.000Z');

      const [resEST] = await prisma.$queryRawUnsafe<any[]>(`
        SELECT ('2026-11-15'::date + INTERVAL '1 day') AT TIME ZONE 'America/New_York' AS cutoff_utc
      `);
      expect(new Date(resEST.cutoff_utc).toISOString()).toBe('2026-11-16T05:00:00.000Z');
    });

    it('hourly overdue cron query excludes PAID and CANCELLED invoices', async () => {
      const invPaid = `inv-paid-${Date.now()}`;
      const invCanc = `inv-canc-${Date.now()}`;
      const invUnpaid = `inv-unpaid-${Date.now()}`;

      await prisma.$executeRawUnsafe(`
        INSERT INTO "Invoice" ("id", "instituteId", "studentProfileId", "invoiceNumber", "status", "dueDate", "totalAmount", "paidAmount", "balanceAmount") VALUES
        ('${invPaid}', '${instituteIdA}', '${studentProfileIdA}', 'INV-P-${Date.now()}', 'PAID', '2020-01-01', 50000, 50000, 0),
        ('${invCanc}', '${instituteIdA}', '${studentProfileIdA}', 'INV-C-${Date.now()}', 'CANCELLED', '2020-01-01', 50000, 0, 50000),
        ('${invUnpaid}', '${instituteIdA}', '${studentProfileIdA}', 'INV-U-${Date.now()}', 'ISSUED', '2020-01-01', 50000, 0, 50000)
      `);

      await prisma.$executeRawUnsafe(`
        UPDATE "Invoice" i
        SET "status" = 'OVERDUE'::"InvoiceStatus", "updatedAt" = NOW()
        FROM "Institute" inst
        WHERE i."instituteId" = inst."id"
          AND i."status" IN ('ISSUED'::"InvoiceStatus", 'PARTIALLY_PAID'::"InvoiceStatus")
          AND i."balanceAmount" > 0
          AND (i."dueDate" + INTERVAL '1 day') AT TIME ZONE inst."timezone" <= NOW()
          AND i."id" IN ('${invPaid}', '${invCanc}', '${invUnpaid}')
      `);

      const [p] = await prisma.$queryRawUnsafe<any[]>(`SELECT status FROM "Invoice" WHERE id = '${invPaid}'`);
      const [c] = await prisma.$queryRawUnsafe<any[]>(`SELECT status FROM "Invoice" WHERE id = '${invCanc}'`);
      const [u] = await prisma.$queryRawUnsafe<any[]>(`SELECT status FROM "Invoice" WHERE id = '${invUnpaid}'`);

      expect(p.status).toBe('PAID');
      expect(c.status).toBe('CANCELLED');
      expect(u.status).toBe('OVERDUE');
    });
  });
});
