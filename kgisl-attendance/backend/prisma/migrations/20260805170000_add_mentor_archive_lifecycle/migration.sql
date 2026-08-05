DO $$
BEGIN
  CREATE TYPE "BatchLifecycle" AS ENUM ('ACTIVE', 'ARCHIVE_PENDING', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "batch"
  ADD COLUMN IF NOT EXISTS "mentor_id" TEXT,
  ADD COLUMN IF NOT EXISTS "completion_date" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lifecycle" "BatchLifecycle" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS "archive_requested_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP(3);

ALTER TABLE "student" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'batch_mentor_id_fkey'
  ) THEN
    ALTER TABLE "batch" ADD CONSTRAINT "batch_mentor_id_fkey"
      FOREIGN KEY ("mentor_id") REFERENCES "faculty"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "batch_mentor_id_idx" ON "batch"("mentor_id");
CREATE INDEX IF NOT EXISTS "batch_lifecycle_completion_date_idx" ON "batch"("lifecycle", "completion_date");
CREATE INDEX IF NOT EXISTS "student_archived_at_idx" ON "student"("archived_at");
