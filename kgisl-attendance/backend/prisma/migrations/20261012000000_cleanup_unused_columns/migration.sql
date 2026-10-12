-- Remove columns that were written but never read, and the geofence options that never influenced a decision.
ALTER TABLE "room" DROP COLUMN IF EXISTS "polygon";
ALTER TABLE "room" DROP COLUMN IF EXISTS "wifi_bssid_whitelist";

ALTER TABLE "attendance_session" DROP COLUMN IF EXISTS "current_qr_token_hash";
ALTER TABLE "attendance_session" DROP COLUMN IF EXISTS "current_qr_expiry";

ALTER TABLE "attendance_qr_history" DROP COLUMN IF EXISTS "used_at";
ALTER TABLE "attendance_qr_history" DROP COLUMN IF EXISTS "used_by_student_id";
