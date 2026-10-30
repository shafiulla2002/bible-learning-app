-- CreateEnum
CREATE TYPE "AttendanceMode" AS ENUM ('DAILY_BATCH', 'LIVE_SESSION');

-- AlterTable: Safely make liveSessionId nullable and add batch, mode, date, audit columns to Attendance
ALTER TABLE "Attendance" ALTER COLUMN "liveSessionId" DROP NOT NULL;
ALTER TABLE "Attendance" ADD COLUMN "batchId" TEXT NOT NULL;
ALTER TABLE "Attendance" ADD COLUMN "enrolmentId" TEXT;
ALTER TABLE "Attendance" ADD COLUMN "mode" "AttendanceMode" NOT NULL DEFAULT 'DAILY_BATCH';
ALTER TABLE "Attendance" ADD COLUMN "date" DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE "Attendance" ADD COLUMN "remarks" TEXT;
ALTER TABLE "Attendance" ADD COLUMN "markedById" TEXT;
ALTER TABLE "Attendance" ADD COLUMN "markedByRole" TEXT;
ALTER TABLE "Attendance" ADD COLUMN "updatedById" TEXT;
ALTER TABLE "Attendance" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Attendance" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Drop old unique constraint on (liveSessionId, studentProfileId) if exists
ALTER TABLE "Attendance" DROP CONSTRAINT IF EXISTS "Attendance_liveSessionId_studentProfileId_key";

-- Create Table: AttendanceAuditLog for immutable audit history
CREATE TABLE "AttendanceAuditLog" (
    "id" TEXT NOT NULL,
    "attendanceId" TEXT NOT NULL,
    "previousStatus" "AttendanceStatus" NOT NULL,
    "newStatus" "AttendanceStatus" NOT NULL,
    "previousRemarks" TEXT,
    "newRemarks" TEXT,
    "changedById" TEXT,
    "changedByRole" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceAuditLog_pkey" PRIMARY KEY ("id")
);

-- Partial Unique Indexes for the two distinct attendance modes:
-- Mode A: DAILY_BATCH -> strictly 1 attendance record per student, batch, and calendar date
CREATE UNIQUE INDEX "Attendance_daily_batch_unique" 
ON "Attendance" ("batchId", "studentProfileId", "date") 
WHERE "mode" = 'DAILY_BATCH';

-- Mode B: LIVE_SESSION -> strictly 1 attendance record per student and live session (students can attend multiple sessions on same date)
CREATE UNIQUE INDEX "Attendance_live_session_unique" 
ON "Attendance" ("liveSessionId", "studentProfileId") 
WHERE "mode" = 'LIVE_SESSION' AND "liveSessionId" IS NOT NULL;

-- Query performance indexes
CREATE INDEX "Attendance_instituteId_batchId_date_idx" ON "Attendance"("instituteId", "batchId", "date");
CREATE INDEX "Attendance_studentProfileId_date_idx" ON "Attendance"("studentProfileId", "date");
CREATE INDEX "Attendance_instituteId_date_idx" ON "Attendance"("instituteId", "date");
CREATE INDEX "Attendance_liveSessionId_idx" ON "Attendance"("liveSessionId");
CREATE INDEX "AttendanceAuditLog_attendanceId_changedAt_idx" ON "AttendanceAuditLog"("attendanceId", "changedAt");

-- Foreign Keys
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "Institute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_enrolmentId_fkey" FOREIGN KEY ("enrolmentId") REFERENCES "Enrolment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AttendanceAuditLog" ADD CONSTRAINT "AttendanceAuditLog_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "Attendance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
