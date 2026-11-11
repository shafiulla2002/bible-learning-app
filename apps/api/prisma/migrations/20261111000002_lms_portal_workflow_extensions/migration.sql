-- Additive Migration: LMS Portal Workflow Extensions (Phases 2-11)
-- Preserves all existing data, constraints, triggers, functions, and sequences.
-- Forward-only, idempotent across bible_lms_test and bible_lms_dev.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CourseType') THEN
    CREATE TYPE "CourseType" AS ENUM ('SELF_PACED', 'COHORT', 'LIVE', 'DIPLOMA', 'CERTIFICATE');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LearningMode') THEN
    CREATE TYPE "LearningMode" AS ENUM ('ONLINE', 'OFFLINE', 'HYBRID');
  END IF;
END $$;

-- Course workflow metadata extensions
ALTER TABLE "Course"
  ADD COLUMN IF NOT EXISTS "courseType" "CourseType" NOT NULL DEFAULT 'COHORT',
  ADD COLUMN IF NOT EXISTS "learningMode" "LearningMode" NOT NULL DEFAULT 'ONLINE',
  ADD COLUMN IF NOT EXISTS "durationLabel" TEXT,
  ADD COLUMN IF NOT EXISTS "eligibility" TEXT,
  ADD COLUMN IF NOT EXISTS "registrationFee" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "enrollmentStartsAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "enrollmentEndsAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "requiresApproval" BOOLEAN NOT NULL DEFAULT true;

-- Admission workflow tracking extensions
ALTER TABLE "Admission"
  ADD COLUMN IF NOT EXISTS "applicationNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "courseId" TEXT,
  ADD COLUMN IF NOT EXISTS "batchId" TEXT,
  ADD COLUMN IF NOT EXISTS "documents" JSONB,
  ADD COLUMN IF NOT EXISTS "applicantDetails" JSONB,
  ADD COLUMN IF NOT EXISTS "reviewedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedEnrolmentId" TEXT;

-- Order & Payment verification extensions
ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "invoiceId" TEXT,
  ADD COLUMN IF NOT EXISTS "admissionId" TEXT,
  ADD COLUMN IF NOT EXISTS "signatureVerified" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "providerOrderId" TEXT,
  ADD COLUMN IF NOT EXISTS "providerSignature" TEXT,
  ADD COLUMN IF NOT EXISTS "signatureVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "rawPayload" JSONB;

-- Payment webhook idempotency log
CREATE TABLE IF NOT EXISTS "PaymentWebhookEvent" (
  "id" TEXT NOT NULL,
  "instituteId" TEXT,
  "provider" TEXT NOT NULL DEFAULT 'RAZORPAY',
  "eventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "signatureVerified" BOOLEAN NOT NULL DEFAULT false,
  "payload" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RECEIVED',
  "errorMessage" TEXT,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- Super Admin onboarding applications & isolated platform audit log
CREATE TABLE IF NOT EXISTS "InstituteApplication" (
  "id" TEXT NOT NULL,
  "instituteName" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "applicantName" TEXT NOT NULL,
  "applicantEmail" TEXT NOT NULL,
  "applicantPhone" TEXT NOT NULL,
  "city" TEXT,
  "state" TEXT,
  "country" TEXT DEFAULT 'India',
  "planCode" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "notes" TEXT,
  "reviewedByUserId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdInstituteId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InstituteApplication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PlatformAuditLog" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "actorRole" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "targetInstituteId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformAuditLog_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "Admission_instituteId_applicationNumber_key"
  ON "Admission"("instituteId", "applicationNumber");
CREATE INDEX IF NOT EXISTS "Admission_courseId_idx" ON "Admission"("courseId");

CREATE INDEX IF NOT EXISTS "Order_providerOrderId_idx" ON "Order"("providerOrderId");
CREATE INDEX IF NOT EXISTS "Payment_providerOrderId_idx" ON "Payment"("providerOrderId");

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentWebhookEvent_eventId_key" ON "PaymentWebhookEvent"("eventId");
CREATE INDEX IF NOT EXISTS "PaymentWebhookEvent_instituteId_status_idx" ON "PaymentWebhookEvent"("instituteId", "status");
CREATE INDEX IF NOT EXISTS "PaymentWebhookEvent_eventType_createdAt_idx" ON "PaymentWebhookEvent"("eventType", "createdAt");

CREATE INDEX IF NOT EXISTS "InstituteApplication_status_createdAt_idx" ON "InstituteApplication"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "InstituteApplication_slug_idx" ON "InstituteApplication"("slug");

CREATE INDEX IF NOT EXISTS "PlatformAuditLog_actorUserId_createdAt_idx" ON "PlatformAuditLog"("actorUserId", "createdAt");
CREATE INDEX IF NOT EXISTS "PlatformAuditLog_targetInstituteId_createdAt_idx" ON "PlatformAuditLog"("targetInstituteId", "createdAt");

-- Foreign Keys (schema-qualified pg_constraint guards)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = current_schema() AND c.conname = 'Admission_courseId_fkey'
  ) THEN
    ALTER TABLE "Admission"
      ADD CONSTRAINT "Admission_courseId_fkey"
      FOREIGN KEY ("courseId") REFERENCES "Course"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = current_schema() AND c.conname = 'Admission_batchId_fkey'
  ) THEN
    ALTER TABLE "Admission"
      ADD CONSTRAINT "Admission_batchId_fkey"
      FOREIGN KEY ("batchId") REFERENCES "Batch"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = current_schema() AND c.conname = 'PaymentWebhookEvent_instituteId_fkey'
  ) THEN
    ALTER TABLE "PaymentWebhookEvent"
      ADD CONSTRAINT "PaymentWebhookEvent_instituteId_fkey"
      FOREIGN KEY ("instituteId") REFERENCES "Institute"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

