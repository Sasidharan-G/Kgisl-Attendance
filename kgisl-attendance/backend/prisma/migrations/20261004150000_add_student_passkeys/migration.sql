-- Passkeys (Face ID / Touch ID / Windows Hello) bind a student's web scans to their device.
CREATE TABLE "student_passkey" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "credential_id" TEXT NOT NULL,
    "public_key" BYTEA NOT NULL,
    "counter" INTEGER NOT NULL DEFAULT 0,
    "transports" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3),

    CONSTRAINT "student_passkey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "student_passkey_credential_id_key" ON "student_passkey"("credential_id");
CREATE INDEX "student_passkey_student_id_idx" ON "student_passkey"("student_id");

ALTER TABLE "student_passkey" ADD CONSTRAINT "student_passkey_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
