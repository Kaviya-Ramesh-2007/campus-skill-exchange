-- CreateEnum
CREATE TYPE "SessionReminderType" AS ENUM ('TWENTY_FOUR_HOURS', 'ONE_HOUR', 'TEN_MINUTES');

-- CreateEnum
CREATE TYPE "SessionReminderStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "session_reminders" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "reminder_type" "SessionReminderType" NOT NULL,
    "scheduled_for" TIMESTAMPTZ(6) NOT NULL,
    "status" "SessionReminderStatus" NOT NULL DEFAULT 'PENDING',
    "sent_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "session_reminders_session_id_reminder_type_key" ON "session_reminders"("session_id", "reminder_type");

-- CreateIndex
CREATE INDEX "session_reminders_status_scheduled_for_idx" ON "session_reminders"("status", "scheduled_for");

-- AddForeignKey
ALTER TABLE "session_reminders" ADD CONSTRAINT "session_reminders_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "learning_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
