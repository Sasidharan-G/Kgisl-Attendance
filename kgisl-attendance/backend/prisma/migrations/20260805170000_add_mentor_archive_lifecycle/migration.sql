CREATE TYPE "BatchLifecycle" AS ENUM ('ACTIVE', 'ARCHIVE_PENDING', 'ARCHIVED');

ALTER TABLE "batch"
  ADD COLUMN "mentor_id" TEXT,
  ADD COLUMN "completion_date" TIMESTAMP(3),
  ADD COLUMN "lifecycle" "BatchLifecycle" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "archive_requested_at" TIMESTAMP(3),
  ADD COLUMN "archived_at" TIMESTAMP(3);

ALTER TABLE "student" ADD COLUMN "archived_at" TIMESTAMP(3);

ALTER TABLE "batch" ADD CONSTRAINT "batch_mentor_id_fkey"
  FOREIGN KEY ("mentor_id") REFERENCES "faculty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "batch_mentor_id_idx" ON "batch"("mentor_id");
CREATE INDEX "batch_lifecycle_completion_date_idx" ON "batch"("lifecycle", "completion_date");
CREATE INDEX "student_archived_at_idx" ON "student"("archived_at");
