CREATE TYPE "LeaveRequestType" AS ENUM ('LEAVE', 'ON_DUTY');
CREATE TYPE "LeaveRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "leave_request" (
  "id" TEXT NOT NULL,
  "student_id" TEXT NOT NULL,
  "type" "LeaveRequestType" NOT NULL,
  "from_date" TIMESTAMP(3) NOT NULL,
  "to_date" TIMESTAMP(3) NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "LeaveRequestStatus" NOT NULL DEFAULT 'PENDING',
  "review_note" TEXT,
  "reviewed_by" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "leave_request_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "leave_request_student_id_created_at_idx" ON "leave_request"("student_id", "created_at");
CREATE INDEX "leave_request_status_created_at_idx" ON "leave_request"("status", "created_at");
ALTER TABLE "leave_request" ADD CONSTRAINT "leave_request_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
