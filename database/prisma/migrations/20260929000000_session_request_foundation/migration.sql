-- CreateEnum
CREATE TYPE "SessionRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');

-- CreateTable
CREATE TABLE "session_requests" (
    "id" UUID NOT NULL,
    "requester_user_id" UUID NOT NULL,
    "recipient_user_id" UUID NOT NULL,
    "skill_id" UUID,
    "message" VARCHAR(2000),
    "status" "SessionRequestStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_requests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "session_requests_distinct_users_check" CHECK ("requester_user_id" <> "recipient_user_id")
);

-- CreateIndex
CREATE INDEX "session_requests_requester_user_id_status_created_at_idx" ON "session_requests"("requester_user_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "session_requests_recipient_user_id_status_created_at_idx" ON "session_requests"("recipient_user_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "session_requests_skill_id_idx" ON "session_requests"("skill_id");

-- Prevent duplicate active requests for the same requester, recipient, and skill.
CREATE UNIQUE INDEX "session_requests_active_requester_recipient_skill_key"
ON "session_requests" ("requester_user_id", "recipient_user_id", COALESCE("skill_id", '00000000-0000-0000-0000-000000000000'::uuid))
WHERE "status" IN ('PENDING', 'ACCEPTED');

-- AddForeignKey
ALTER TABLE "session_requests" ADD CONSTRAINT "session_requests_requester_user_id_fkey" FOREIGN KEY ("requester_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_requests" ADD CONSTRAINT "session_requests_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_requests" ADD CONSTRAINT "session_requests_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE SET NULL ON UPDATE CASCADE;
