-- CreateTable
CREATE TABLE "assessments" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "assessor_user_id" UUID NOT NULL,
    "assessed_user_id" UUID NOT NULL,
    "skill_id" UUID,
    "understanding_score" INTEGER NOT NULL,
    "practical_application_score" INTEGER NOT NULL,
    "problem_solving_score" INTEGER NOT NULL,
    "communication_score" INTEGER NOT NULL,
    "reliability_score" INTEGER NOT NULL,
    "feedback" VARCHAR(2000),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "assessments_distinct_users_check" CHECK ("assessor_user_id" <> "assessed_user_id"),
    CONSTRAINT "assessments_understanding_score_check" CHECK ("understanding_score" BETWEEN 1 AND 5),
    CONSTRAINT "assessments_practical_application_score_check" CHECK ("practical_application_score" BETWEEN 1 AND 5),
    CONSTRAINT "assessments_problem_solving_score_check" CHECK ("problem_solving_score" BETWEEN 1 AND 5),
    CONSTRAINT "assessments_communication_score_check" CHECK ("communication_score" BETWEEN 1 AND 5),
    CONSTRAINT "assessments_reliability_score_check" CHECK ("reliability_score" BETWEEN 1 AND 5)
);

-- CreateIndex
CREATE UNIQUE INDEX "assessments_session_id_assessor_user_id_assessed_user_id_key" ON "assessments"("session_id", "assessor_user_id", "assessed_user_id");

-- CreateIndex
CREATE INDEX "assessments_session_id_idx" ON "assessments"("session_id");

-- CreateIndex
CREATE INDEX "assessments_assessed_user_id_created_at_idx" ON "assessments"("assessed_user_id", "created_at");

-- CreateIndex
CREATE INDEX "assessments_skill_id_idx" ON "assessments"("skill_id");

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "learning_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_assessor_user_id_fkey" FOREIGN KEY ("assessor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_assessed_user_id_fkey" FOREIGN KEY ("assessed_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE SET NULL ON UPDATE CASCADE;
