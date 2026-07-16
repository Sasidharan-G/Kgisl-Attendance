-- Record how attendance was first captured, and preserve authenticated
-- faculty overrides without inventing fake GPS/device values.
CREATE TYPE "AttendanceMethod" AS ENUM ('QR', 'ACOUSTIC', 'FACULTY_MANUAL');

ALTER TABLE "attendance_record"
  ALTER COLUMN "gps_lat" DROP NOT NULL,
  ALTER COLUMN "gps_lng" DROP NOT NULL,
  ALTER COLUMN "device_id" DROP NOT NULL,
  ADD COLUMN "method" "AttendanceMethod" NOT NULL DEFAULT 'QR',
  ADD COLUMN "marked_by_faculty_id" TEXT,
  ADD COLUMN "override_reason" TEXT,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "attendance_record_method_idx" ON "attendance_record"("method");
