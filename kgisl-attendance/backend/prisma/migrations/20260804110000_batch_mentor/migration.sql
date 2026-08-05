ALTER TABLE "batch" ADD COLUMN "mentor_id" TEXT;
ALTER TABLE "batch" ADD CONSTRAINT "batch_mentor_id_fkey"
  FOREIGN KEY ("mentor_id") REFERENCES "faculty"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "batch_mentor_id_idx" ON "batch"("mentor_id");
