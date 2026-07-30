CREATE TYPE "CorrectionRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "attendance_correction_request" (
  "id" TEXT NOT NULL,
  "student_id" TEXT NOT NULL,
  "session_id" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "CorrectionRequestStatus" NOT NULL DEFAULT 'PENDING',
  "review_note" TEXT,
  "reviewed_by" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "attendance_correction_request_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "attendance_correction_request_student_id_session_id_key" ON "attendance_correction_request"("student_id", "session_id");
CREATE INDEX "attendance_correction_request_status_created_at_idx" ON "attendance_correction_request"("status", "created_at");
ALTER TABLE "attendance_correction_request" ADD CONSTRAINT "attendance_correction_request_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_correction_request" ADD CONSTRAINT "attendance_correction_request_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "attendance_session"("session_id") ON DELETE RESTRICT ON UPDATE CASCADE;
