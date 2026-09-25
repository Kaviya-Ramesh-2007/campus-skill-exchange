-- CreateTable
CREATE TABLE "ratings" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "rater_user_id" UUID NOT NULL,
    "rated_user_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "feedback" VARCHAR(2000),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ratings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ratings_rating_range_check" CHECK ("rating" BETWEEN 1 AND 5),
    CONSTRAINT "ratings_distinct_users_check" CHECK ("rater_user_id" <> "rated_user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ratings_session_id_rater_user_id_key" ON "ratings"("session_id", "rater_user_id");

-- CreateIndex
CREATE INDEX "ratings_session_id_idx" ON "ratings"("session_id");

-- CreateIndex
CREATE INDEX "ratings_rated_user_id_idx" ON "ratings"("rated_user_id");

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "learning_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_rater_user_id_fkey" FOREIGN KEY ("rater_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_rated_user_id_fkey" FOREIGN KEY ("rated_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
