-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('REQUEST_SENT', 'REQUEST_ACCEPTED', 'REQUEST_DECLINED', 'SESSION_SCHEDULED', 'SESSION_UPDATED', 'SESSION_CANCELLED', 'PAYMENT_CAPTURED', 'PAYMENT_FAILED', 'REFUND_REQUESTED', 'REFUND_COMPLETED', 'BADGE_EARNED');

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "message" VARCHAR(500) NOT NULL,
    "source_event_id" UUID NOT NULL,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notifications_user_id_source_event_id_key" ON "notifications"("user_id", "source_event_id");
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
