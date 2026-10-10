-- CreateEnum
CREATE TYPE "CalendarEventType" AS ENUM ('HOLIDAY', 'EXAM', 'EVENT', 'WORKING');

-- AlterTable
ALTER TABLE "attendance_session" ADD COLUMN     "allocation_id" TEXT;

-- CreateTable
CREATE TABLE "calendar_event" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "title" TEXT NOT NULL,
    "type" "CalendarEventType" NOT NULL DEFAULT 'EVENT',
    "description" TEXT NOT NULL DEFAULT '',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "block_test" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "subject_code" TEXT NOT NULL,
    "subject_name" TEXT NOT NULL,
    "room" TEXT NOT NULL,
    "batch_id" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "block_test_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "calendar_event_date_idx" ON "calendar_event"("date");

-- CreateIndex
CREATE INDEX "block_test_date_idx" ON "block_test"("date");

-- CreateIndex
CREATE INDEX "block_test_batch_id_date_idx" ON "block_test"("batch_id", "date");

-- AddForeignKey
ALTER TABLE "block_test" ADD CONSTRAINT "block_test_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
