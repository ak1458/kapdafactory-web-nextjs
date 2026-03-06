-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('admin', 'operator');

-- CreateEnum
CREATE TYPE "public"."OrderStatus" AS ENUM ('pending', 'ready', 'delivered', 'transferred');

-- CreateEnum
CREATE TYPE "public"."PaymentMethod" AS ENUM ('cash', 'upi', 'online');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified_at" TIMESTAMP(3),
    "password" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL DEFAULT 'operator',
    "remember_token" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."orders" (
    "id" SERIAL NOT NULL,
    "token" VARCHAR(50) NOT NULL,
    "bill_number" VARCHAR(50),
    "customer_name" VARCHAR(150),
    "measurements" JSONB NOT NULL,
    "delivery_date" DATE,
    "entry_date" DATE,
    "actual_delivery_date" DATE,
    "status" "public"."OrderStatus" NOT NULL DEFAULT 'pending',
    "remarks" TEXT,
    "created_by" INTEGER NOT NULL,
    "total_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."order_images" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "mime" TEXT,
    "size" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."order_logs" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payments" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "payment_date" DATE NOT NULL,
    "payment_method" "public"."PaymentMethod" NOT NULL DEFAULT 'cash',
    "note" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."password_resets" (
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3),

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("email")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "orders_token_key" ON "public"."orders"("token");

-- CreateIndex
CREATE UNIQUE INDEX "orders_bill_number_key" ON "public"."orders"("bill_number");

-- CreateIndex
CREATE INDEX "orders_delivery_date_status_idx" ON "public"."orders"("delivery_date", "status");

-- CreateIndex
CREATE INDEX "orders_customer_name_idx" ON "public"."orders"("customer_name");

-- CreateIndex
CREATE INDEX "orders_token_idx" ON "public"."orders"("token");

-- CreateIndex
CREATE INDEX "orders_bill_number_idx" ON "public"."orders"("bill_number");

-- CreateIndex
CREATE INDEX "orders_created_at_idx" ON "public"."orders"("created_at");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "public"."orders"("status");

-- CreateIndex
CREATE INDEX "order_images_order_id_created_at_id_idx" ON "public"."order_images"("order_id", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "order_logs_order_id_created_at_id_idx" ON "public"."order_logs"("order_id", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "order_logs_order_id_action_idx" ON "public"."order_logs"("order_id", "action");

-- CreateIndex
CREATE INDEX "payments_order_id_payment_date_id_idx" ON "public"."payments"("order_id", "payment_date" DESC, "id" DESC);

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_images" ADD CONSTRAINT "order_images_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_logs" ADD CONSTRAINT "order_logs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_logs" ADD CONSTRAINT "order_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed admin user (password: admin)
INSERT INTO "public"."users" ("name", "email", "password", "role", "created_at", "updated_at")
VALUES ('Test Admin', 'admin@admin.com', '$2a$10$Ipx4O8Z.JCz11XjIUpZXxu7t0T.f3dx0vc7a9R7xNjJ0.G5r0NfC', 'admin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
