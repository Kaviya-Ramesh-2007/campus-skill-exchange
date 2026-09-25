-- CreateEnum
CREATE TYPE "LearningSessionMode" AS ENUM ('ONLINE', 'OFFLINE');

-- CreateEnum
CREATE TYPE "LearningSessionStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateTable
CREATE TABLE "learning_sessions" (
    "id" UUID NOT NULL,
    "session_request_id" UUID NOT NULL,
    "host_user_id" UUID NOT NULL,
    "participant_user_id" UUID NOT NULL,
    "skill_id" UUID,
    "mode" "LearningSessionMode" NOT NULL,
    "status" "LearningSessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduled_start" TIMESTAMPTZ(6) NOT NULL,
    "scheduled_end" TIMESTAMPTZ(6) NOT NULL,
    "timezone" VARCHAR(64) NOT NULL,
    "meeting_url" VARCHAR(2048),
    "location_details" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "learning_sessions_distinct_users_check" CHECK ("host_user_id" <> "participant_user_id"),
    CONSTRAINT "learning_sessions_time_check" CHECK ("scheduled_start" < "scheduled_end"),
    CONSTRAINT "learning_sessions_timezone_check" CHECK (length(trim("timezone")) > 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "learning_sessions_session_request_id_key" ON "learning_sessions"("session_request_id");

-- CreateIndex
CREATE INDEX "learning_sessions_host_user_id_status_scheduled_start_idx" ON "learning_sessions"("host_user_id", "status", "scheduled_start");

-- CreateIndex
CREATE INDEX "learning_sessions_participant_user_id_status_scheduled_start_idx" ON "learning_sessions"("participant_user_id", "status", "scheduled_start");

-- CreateIndex
CREATE INDEX "learning_sessions_scheduled_start_idx" ON "learning_sessions"("scheduled_start");

-- AddForeignKey
ALTER TABLE "learning_sessions" ADD CONSTRAINT "learning_sessions_session_request_id_fkey" FOREIGN KEY ("session_request_id") REFERENCES "session_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_sessions" ADD CONSTRAINT "learning_sessions_host_user_id_fkey" FOREIGN KEY ("host_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_sessions" ADD CONSTRAINT "learning_sessions_participant_user_id_fkey" FOREIGN KEY ("participant_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_sessions" ADD CONSTRAINT "learning_sessions_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE SET NULL ON UPDATE CASCADE;
