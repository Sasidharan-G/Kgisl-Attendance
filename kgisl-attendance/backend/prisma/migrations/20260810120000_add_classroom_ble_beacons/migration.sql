CREATE TABLE "classroom_beacon" (
    "id" TEXT NOT NULL,
    "beacon_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "classroom_beacon_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "classroom_beacon_beacon_id_key" ON "classroom_beacon"("beacon_id");
CREATE INDEX "classroom_beacon_room_id_enabled_idx" ON "classroom_beacon"("room_id", "enabled");

ALTER TABLE "classroom_beacon"
ADD CONSTRAINT "classroom_beacon_room_id_fkey"
FOREIGN KEY ("room_id") REFERENCES "room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TYPE "AttendanceMethod" ADD VALUE 'BEACON';
