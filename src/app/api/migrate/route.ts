import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    
    if (secret !== 'setup-kapdafactory-2026') {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Try to query users table to check if migration is needed
        await prisma.$queryRaw`SELECT 1 FROM "users" LIMIT 1`;
        
        return NextResponse.json({ 
            message: 'Database already migrated!',
            admin: {
                email: 'admin@admin.com',
                password: 'admin'
            }
        });
    } catch (error: any) {
        // Tables don't exist, need to run migration
        return NextResponse.json({ 
            message: 'Database needs migration. Please run SQL in Supabase SQL Editor.',
            sql: getMigrationSQL(),
            admin: {
                email: 'admin@admin.com',
                password: 'admin'
            }
        });
    }
}

function getMigrationSQL() {
    return `-- Run this in Supabase SQL Editor (https://supabase.com/dashboard/project/ornismpzpohhpgnfgymt/sql/new)

-- Create Enums
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Role') THEN
        CREATE TYPE "Role" AS ENUM ('admin', 'operator');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrderStatus') THEN
        CREATE TYPE "OrderStatus" AS ENUM ('pending', 'ready', 'delivered', 'transferred');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentMethod') THEN
        CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'upi', 'online');
    END IF;
END $$;

-- Create Users Table
CREATE TABLE IF NOT EXISTS "users" (
    "id" SERIAL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL UNIQUE,
    "email_verified_at" TIMESTAMP(3),
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'operator',
    "remember_token" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create Orders Table
CREATE TABLE IF NOT EXISTS "orders" (
    "id" SERIAL PRIMARY KEY,
    "token" VARCHAR(50) NOT NULL UNIQUE,
    "bill_number" VARCHAR(50) UNIQUE,
    "customer_name" VARCHAR(150),
    "measurements" JSONB NOT NULL DEFAULT '{}',
    "delivery_date" DATE,
    "entry_date" DATE,
    "actual_delivery_date" DATE,
    "status" "OrderStatus" NOT NULL DEFAULT 'pending',
    "remarks" TEXT,
    "created_by" INTEGER NOT NULL,
    "total_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Create Order Images Table
CREATE TABLE IF NOT EXISTS "order_images" (
    "id" SERIAL PRIMARY KEY,
    "order_id" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "mime" TEXT,
    "size" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "order_images_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create Order Logs Table
CREATE TABLE IF NOT EXISTS "order_logs" (
    "id" SERIAL PRIMARY KEY,
    "order_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "order_logs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "order_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Create Payments Table
CREATE TABLE IF NOT EXISTS "payments" (
    "id" SERIAL PRIMARY KEY,
    "order_id" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "payment_date" DATE NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL DEFAULT 'cash',
    "note" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create Password Resets Table
CREATE TABLE IF NOT EXISTS "password_resets" (
    "email" TEXT PRIMARY KEY,
    "token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3)
);

-- Create Indexes
CREATE INDEX IF NOT EXISTS "orders_delivery_date_status_idx" ON "orders"("delivery_date", "status");
CREATE INDEX IF NOT EXISTS "orders_customer_name_idx" ON "orders"("customer_name");
CREATE INDEX IF NOT EXISTS "orders_token_idx" ON "orders"("token");
CREATE INDEX IF NOT EXISTS "orders_status_idx" ON "orders"("status");
CREATE INDEX IF NOT EXISTS "order_images_order_id_idx" ON "order_images"("order_id");
CREATE INDEX IF NOT EXISTS "order_logs_order_id_idx" ON "order_logs"("order_id");
CREATE INDEX IF NOT EXISTS "payments_order_id_idx" ON "payments"("order_id");

-- Seed Admin User (password: admin)
INSERT INTO "users" ("name", "email", "password", "role", "created_at", "updated_at")
VALUES ('Test Admin', 'admin@admin.com', '\$2a\$10\$Ipx4O8Z.JCz11XjIUpZXxu7t0T.f3dx0vc7a9R7xNjJ0.G5r0NfC', 'admin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("email") DO NOTHING;`;
}
