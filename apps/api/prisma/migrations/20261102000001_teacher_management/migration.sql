-- Milestone 2.6: Teacher Management Migration
-- Target Database: bible_lms_dev
-- 100% Additive, non-destructive

-- AlterTable
ALTER TABLE "CourseInstructor" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "TeacherProfile" ADD COLUMN IF NOT EXISTS "address" JSONB,
ADD COLUMN IF NOT EXISTS "experienceYears" INTEGER,
ADD COLUMN IF NOT EXISTS "joiningDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIVE';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CourseInstructor_instituteId_teacherProfileId_idx" ON "CourseInstructor"("instituteId", "teacherProfileId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TeacherProfile_instituteId_status_idx" ON "TeacherProfile"("instituteId", "status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TeacherProfile_id_instituteId_key" ON "TeacherProfile"("id", "instituteId");

-- RenameIndex if needed
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' AND indexname = 'FinancialSequenceRegistry_institute_year_type_key'
    ) THEN
        ALTER INDEX "FinancialSequenceRegistry_institute_year_type_key" RENAME TO "FinancialSequenceRegistry_instituteId_year_type_key";
    END IF;
END $$;
