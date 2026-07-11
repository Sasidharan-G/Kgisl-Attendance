-- AlterEnum
ALTER TYPE "ActorType" ADD VALUE 'ADMIN';

-- AlterTable
ALTER TABLE "attendance_record" ADD COLUMN     "distance_from_campus" DOUBLE PRECISION,
ADD COLUMN     "gps_accuracy" DOUBLE PRECISION,
ADD COLUMN     "location_verification_status" TEXT,
ADD COLUMN     "location_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "location_verified_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "admin" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timetable_allocation" (
    "id" TEXT NOT NULL,
    "faculty_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "timetable_allocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_email_key" ON "admin"("email");

-- CreateIndex
CREATE INDEX "timetable_allocation_faculty_id_day_of_week_idx" ON "timetable_allocation"("faculty_id", "day_of_week");

-- CreateIndex
CREATE UNIQUE INDEX "timetable_allocation_faculty_id_day_of_week_start_time_key" ON "timetable_allocation"("faculty_id", "day_of_week", "start_time");

-- AddForeignKey
ALTER TABLE "timetable_allocation" ADD CONSTRAINT "timetable_allocation_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "faculty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_allocation" ADD CONSTRAINT "timetable_allocation_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_allocation" ADD CONSTRAINT "timetable_allocation_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_allocation" ADD CONSTRAINT "timetable_allocation_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
