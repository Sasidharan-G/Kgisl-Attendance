CREATE TABLE "notification" (
  "id" TEXT NOT NULL,
  "recipient_id" TEXT,
  "recipient_role" "ActorType" NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "href" TEXT,
  "read_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notification_recipient_role_recipient_id_read_at_created_at_idx"
  ON "notification"("recipient_role", "recipient_id", "read_at", "created_at");
