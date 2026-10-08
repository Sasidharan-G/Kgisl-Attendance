-- Acoustic attendance is removed. BLE beacon (alpha) replaces it and QR (beta)
-- remains. Historic ACOUSTIC rows are folded into BEACON so no data is lost.
UPDATE "attendance_record" SET "method" = 'BEACON' WHERE "method" = 'ACOUSTIC';

ALTER TYPE "AttendanceMethod" RENAME TO "AttendanceMethod_old";
CREATE TYPE "AttendanceMethod" AS ENUM ('QR', 'BEACON', 'FACULTY_MANUAL');

ALTER TABLE "attendance_record" ALTER COLUMN "method" DROP DEFAULT;
ALTER TABLE "attendance_record"
  ALTER COLUMN "method" TYPE "AttendanceMethod" USING ("method"::text::"AttendanceMethod");
ALTER TABLE "attendance_record" ALTER COLUMN "method" SET DEFAULT 'QR';

DROP TYPE "AttendanceMethod_old";
