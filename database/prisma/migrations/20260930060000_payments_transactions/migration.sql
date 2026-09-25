-- CreateEnum
CREATE TYPE "SessionPaymentMode" AS ENUM ('FREE', 'PAID');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('RAZORPAY');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('PAYMENT', 'REFUND');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "learning_sessions"
ADD COLUMN "payment_mode" "SessionPaymentMode" NOT NULL DEFAULT 'FREE',
ADD COLUMN "price_paise" INTEGER,
ADD COLUMN "terms_version" VARCHAR(64);

ALTER TABLE "learning_sessions"
ADD CONSTRAINT "learning_sessions_payment_terms_check" CHECK (
  ("payment_mode" = 'FREE' AND "price_paise" IS NULL AND "terms_version" IS NULL)
  OR
  ("payment_mode" = 'PAID' AND "price_paise" > 0 AND length(trim("terms_version")) > 0)
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "payer_user_id" UUID NOT NULL,
    "recipient_user_id" UUID NOT NULL,
    "amount_paise" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'INR',
    "provider" "PaymentProvider" NOT NULL DEFAULT 'RAZORPAY',
    "provider_order_id" VARCHAR(255),
    "provider_payment_id" VARCHAR(255),
    "status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
    "terms_version" VARCHAR(64) NOT NULL,
    "terms_accepted_at" TIMESTAMPTZ(6) NOT NULL,
    "terms_accepted_by" UUID NOT NULL,
    "paid_at" TIMESTAMPTZ(6),
    "failure_reason" VARCHAR(1000),
    "refund_amount_paise" INTEGER NOT NULL DEFAULT 0,
    "refund_provider_id" VARCHAR(255),
    "refund_reason" VARCHAR(1000),
    "refunded_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payments_amount_check" CHECK ("amount_paise" > 0),
    CONSTRAINT "payments_currency_check" CHECK ("currency" = 'INR'),
    CONSTRAINT "payments_refund_amount_check" CHECK ("refund_amount_paise" >= 0 AND "refund_amount_paise" <= "amount_paise")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount_paise" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'INR',
    "status" "TransactionStatus" NOT NULL,
    "provider_reference" VARCHAR(255),
    "provider_event_id" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "transactions_amount_check" CHECK ("amount_paise" > 0),
    CONSTRAINT "transactions_currency_check" CHECK ("currency" = 'INR')
);

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_order_id_key" ON "payments"("provider_order_id");
CREATE UNIQUE INDEX "payments_provider_payment_id_key" ON "payments"("provider_payment_id");
CREATE UNIQUE INDEX "payments_refund_provider_id_key" ON "payments"("refund_provider_id");
CREATE UNIQUE INDEX "payments_session_id_payer_user_id_key" ON "payments"("session_id", "payer_user_id");
CREATE INDEX "payments_payer_user_id_created_at_idx" ON "payments"("payer_user_id", "created_at");
CREATE INDEX "payments_recipient_user_id_created_at_idx" ON "payments"("recipient_user_id", "created_at");
CREATE INDEX "payments_status_created_at_idx" ON "payments"("status", "created_at");
CREATE UNIQUE INDEX "transactions_provider_event_id_key" ON "transactions"("provider_event_id");
CREATE INDEX "transactions_payment_id_created_at_idx" ON "transactions"("payment_id", "created_at");
CREATE INDEX "transactions_user_id_created_at_idx" ON "transactions"("user_id", "created_at");
CREATE INDEX "transactions_session_id_created_at_idx" ON "transactions"("session_id", "created_at");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "learning_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_payer_user_id_fkey" FOREIGN KEY ("payer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_terms_accepted_by_fkey" FOREIGN KEY ("terms_accepted_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "learning_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
