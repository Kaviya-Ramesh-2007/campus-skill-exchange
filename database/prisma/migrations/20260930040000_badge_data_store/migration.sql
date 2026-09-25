-- CreateTable
CREATE TABLE "badge_definitions" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(1000) NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "icon_url" VARCHAR(2048),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "badge_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_badges" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "badge_definition_id" UUID NOT NULL,
    "awarded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_badges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "badge_definitions_code_key" ON "badge_definitions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "user_badges_user_id_badge_definition_id_key" ON "user_badges"("user_id", "badge_definition_id");

-- CreateIndex
CREATE INDEX "user_badges_user_id_awarded_at_idx" ON "user_badges"("user_id", "awarded_at");

-- CreateIndex
CREATE INDEX "user_badges_badge_definition_id_idx" ON "user_badges"("badge_definition_id");

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_badge_definition_id_fkey" FOREIGN KEY ("badge_definition_id") REFERENCES "badge_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
