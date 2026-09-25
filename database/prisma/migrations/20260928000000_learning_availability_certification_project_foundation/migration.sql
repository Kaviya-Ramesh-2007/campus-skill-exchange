-- CreateEnum
CREATE TYPE "LearningPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "CertificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateTable
CREATE TABLE "learning_goals" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,
    "current_level" "SkillProficiency" NOT NULL DEFAULT 'BEGINNER',
    "target_level" "SkillProficiency" NOT NULL,
    "description" VARCHAR(2000),
    "priority" "LearningPriority" NOT NULL DEFAULT 'MEDIUM',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "day_of_week" "DayOfWeek" NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'UTC',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "availability_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "availability_time_check" CHECK (
        "start_time" ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'
        AND "end_time" ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'
        AND "start_time" < "end_time"
    )
);

-- CreateTable
CREATE TABLE "certifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "issuing_organization" VARCHAR(160) NOT NULL,
    "credential_id" VARCHAR(160),
    "issue_date" DATE,
    "expiry_date" DATE,
    "proof_url" VARCHAR(2048),
    "status" "CertificationStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certifications_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "certifications_date_check" CHECK (
        "expiry_date" IS NULL OR "issue_date" IS NULL OR "expiry_date" >= "issue_date"
    )
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" VARCHAR(4000) NOT NULL,
    "technologies" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "project_url" VARCHAR(2048),
    "repository_url" VARCHAR(2048),
    "start_date" DATE,
    "end_date" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "projects_date_check" CHECK (
        "end_date" IS NULL OR "start_date" IS NULL OR "end_date" >= "start_date"
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "learning_goals_user_id_skill_id_key" ON "learning_goals"("user_id", "skill_id");

-- CreateIndex
CREATE INDEX "learning_goals_skill_id_idx" ON "learning_goals"("skill_id");

-- CreateIndex
CREATE INDEX "learning_goals_user_id_priority_idx" ON "learning_goals"("user_id", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "availability_user_id_day_of_week_start_time_end_time_timezone_key" ON "availability"("user_id", "day_of_week", "start_time", "end_time", "timezone");

-- CreateIndex
CREATE INDEX "availability_user_id_day_of_week_is_active_idx" ON "availability"("user_id", "day_of_week", "is_active");

-- CreateIndex
CREATE INDEX "certifications_user_id_status_idx" ON "certifications"("user_id", "status");

-- CreateIndex
CREATE INDEX "projects_user_id_updated_at_idx" ON "projects"("user_id", "updated_at");

-- AddForeignKey
ALTER TABLE "learning_goals" ADD CONSTRAINT "learning_goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_goals" ADD CONSTRAINT "learning_goals_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability" ADD CONSTRAINT "availability_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
