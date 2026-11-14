-- Migration: 20261113000001_book_courses_and_reading_progress
-- Non-destructive, additive, idempotent schema migration for Book-Based Courses & Student Reading Progress.

-- 1. Guard & create CourseType enum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CourseType') THEN
    CREATE TYPE "CourseType" AS ENUM ('REGULAR', 'BOOK', 'SELF_PACED', 'COHORT', 'LIVE', 'DIPLOMA', 'CERTIFICATE');
  ELSE
    BEGIN
      ALTER TYPE "CourseType" ADD VALUE IF NOT EXISTS 'REGULAR';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER TYPE "CourseType" ADD VALUE IF NOT EXISTS 'BOOK';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- 2. Guard & create LearningMode enum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LearningMode') THEN
    CREATE TYPE "LearningMode" AS ENUM ('ONLINE', 'OFFLINE', 'HYBRID');
  END IF;
END $$;

-- 3. Extend Course table with Course Type & Book Metadata
ALTER TABLE "Course"
  ADD COLUMN IF NOT EXISTS "courseType" "CourseType" NOT NULL DEFAULT 'REGULAR',
  ADD COLUMN IF NOT EXISTS "learningMode" "LearningMode" NOT NULL DEFAULT 'ONLINE',
  ADD COLUMN IF NOT EXISTS "durationLabel" TEXT,
  ADD COLUMN IF NOT EXISTS "eligibility" TEXT,
  ADD COLUMN IF NOT EXISTS "registrationFee" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "enrollmentStartsAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "enrollmentEndsAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "author" TEXT,
  ADD COLUMN IF NOT EXISTS "pdfStorageKey" TEXT,
  ADD COLUMN IF NOT EXISTS "pdfOriginalName" TEXT,
  ADD COLUMN IF NOT EXISTS "pdfFileSize" INTEGER,
  ADD COLUMN IF NOT EXISTS "pdfPageCount" INTEGER,
  ADD COLUMN IF NOT EXISTS "publicationInfo" TEXT,
  ADD COLUMN IF NOT EXISTS "bookMetadata" JSONB;

-- 4. Create Student Book Reading Progress Table
CREATE TABLE IF NOT EXISTS "BookProgress" (
  "id" TEXT NOT NULL,
  "instituteId" TEXT NOT NULL,
  "studentProfileId" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "lastReadPage" INTEGER NOT NULL DEFAULT 1,
  "totalPages" INTEGER NOT NULL DEFAULT 1,
  "progressPct" INTEGER NOT NULL DEFAULT 0,
  "lastAccessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BookProgress_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BookProgress_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BookProgress_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "BookProgress_studentProfileId_courseId_key"
  ON "BookProgress"("studentProfileId", "courseId");

CREATE INDEX IF NOT EXISTS "BookProgress_instituteId_studentProfileId_idx"
  ON "BookProgress"("instituteId", "studentProfileId");

CREATE INDEX IF NOT EXISTS "BookProgress_courseId_idx"
  ON "BookProgress"("courseId");

-- 5. Align Admission, Order, and Payment workflow extensions (safe & idempotent)
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

ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "invoiceId" TEXT,
  ADD COLUMN IF NOT EXISTS "admissionId" TEXT,
  ADD COLUMN IF NOT EXISTS "signatureVerified" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "providerOrderId" TEXT,
  ADD COLUMN IF NOT EXISTS "providerSignature" TEXT,
  ADD COLUMN IF NOT EXISTS "signatureVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "rawPayload" JSONB;

