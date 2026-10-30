-- Milestone 2.3 close-out: database-level integrity guarantees.
-- ADDITIVE ONLY: creates one extension, partial unique indexes and exclusion constraints.
-- No table/column is dropped or altered. If rows that violate a constraint already exist,
-- this migration fails (it never deletes or rewrites data) and must be resolved manually.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1. Only ONE current academic year per institute.
CREATE UNIQUE INDEX "AcademicYear_one_current_per_institute"
  ON "AcademicYear" ("instituteId")
  WHERE "isCurrent" = true;

-- 2. Only ONE current term per academic year (different years keep their own current term).
CREATE UNIQUE INDEX "AcademicTerm_one_current_per_year"
  ON "AcademicTerm" ("academicYearId")
  WHERE "isCurrent" = true;

-- 3. Academic years of the same institute may not overlap (end date exclusive, so
--    back-to-back years such as Jun-01..May-31 and Jun-01.. are allowed).
ALTER TABLE "AcademicYear"
  ADD CONSTRAINT "AcademicYear_no_overlap"
  EXCLUDE USING gist (
    "instituteId" WITH =,
    daterange("startDate"::date, "endDate"::date, '[)') WITH &&
  );

-- 4. Terms of the same academic year may not overlap.
ALTER TABLE "AcademicTerm"
  ADD CONSTRAINT "AcademicTerm_no_overlap"
  EXCLUDE USING gist (
    "academicYearId" WITH =,
    daterange("startDate"::date, "endDate"::date, '[)') WITH &&
  );

-- 5. Sanity checks on ordering of dates and time ranges.
ALTER TABLE "AcademicYear" ADD CONSTRAINT "AcademicYear_dates_ordered" CHECK ("startDate" < "endDate");
ALTER TABLE "AcademicTerm" ADD CONSTRAINT "AcademicTerm_dates_ordered" CHECK ("startDate" < "endDate");
ALTER TABLE "LiveSession"  ADD CONSTRAINT "LiveSession_times_ordered"  CHECK ("startsAt" < "endsAt");

-- 6. Defence in depth for scheduling: even if application locking were bypassed,
--    PostgreSQL itself rejects overlapping non-cancelled sessions for the same
--    teacher, the same batch, or the same room within an institute.
ALTER TABLE "LiveSession"
  ADD CONSTRAINT "LiveSession_no_teacher_overlap"
  EXCLUDE USING gist (
    "teacherProfileId" WITH =,
    tsrange("startsAt", "endsAt", '[)') WITH &&
  ) WHERE ("status" <> 'CANCELLED');

ALTER TABLE "LiveSession"
  ADD CONSTRAINT "LiveSession_no_batch_overlap"
  EXCLUDE USING gist (
    "batchId" WITH =,
    tsrange("startsAt", "endsAt", '[)') WITH &&
  ) WHERE ("status" <> 'CANCELLED');

ALTER TABLE "LiveSession"
  ADD CONSTRAINT "LiveSession_no_room_overlap"
  EXCLUDE USING gist (
    "instituteId" WITH =,
    "room" WITH =,
    tsrange("startsAt", "endsAt", '[)') WITH &&
  ) WHERE ("room" IS NOT NULL AND "status" <> 'CANCELLED');

-- 7. Batch capacity must be positive.
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_capacity_positive" CHECK ("capacity" > 0);
