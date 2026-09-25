-- CreateEnum
CREATE TYPE "GoogleConferenceStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- AlterTable
ALTER TABLE "learning_sessions"
ADD COLUMN "google_calendar_event_id" VARCHAR(255),
ADD COLUMN "google_conference_id" VARCHAR(255),
ADD COLUMN "google_conference_status" "GoogleConferenceStatus";

-- CreateTable
CREATE TABLE "google_connections" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token_expires_at" TIMESTAMPTZ(6),
    "scope" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "google_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "learning_sessions_google_calendar_event_id_idx" ON "learning_sessions"("google_calendar_event_id");

-- AddForeignKey
ALTER TABLE "google_connections" ADD CONSTRAINT "google_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
