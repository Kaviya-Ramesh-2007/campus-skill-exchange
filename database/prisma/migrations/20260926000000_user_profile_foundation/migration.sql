-- CreateEnum
CREATE TYPE "ProfileVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "public_display_name" VARCHAR(120),
    "department" VARCHAR(120),
    "academic_year" VARCHAR(32),
    "institution" VARCHAR(160),
    "bio" VARCHAR(2000),
    "profile_image_url" VARCHAR(2048),
    "interests" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "github_url" VARCHAR(2048),
    "portfolio_url" VARCHAR(2048),
    "visibility" "ProfileVisibility" NOT NULL DEFAULT 'PUBLIC',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_user_id_key" ON "profiles"("user_id");

-- CreateIndex
CREATE INDEX "profiles_visibility_idx" ON "profiles"("visibility");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
