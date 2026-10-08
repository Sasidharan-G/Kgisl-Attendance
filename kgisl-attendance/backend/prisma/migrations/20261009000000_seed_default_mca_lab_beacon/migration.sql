-- Register ESP32 beacon #1 for the MCA Lab so the faculty "Start BLE Beacon" button works out of the box.
-- No-op when the room does not exist or beacon #1 is already registered.
INSERT INTO "classroom_beacon" ("id", "beacon_id", "name", "room_id", "enabled", "created_at", "updated_at")
SELECT gen_random_uuid()::text, 1, 'MCA Lab ESP32', "id", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "room"
WHERE "name" = 'MCA Lab'
  AND NOT EXISTS (SELECT 1 FROM "classroom_beacon" WHERE "beacon_id" = 1)
LIMIT 1;
