CREATE TYPE "public"."order_source" AS ENUM('online', 'offline');--> statement-breakpoint
ALTER TYPE "public"."payment_method" ADD VALUE 'cash';--> statement-breakpoint
ALTER TYPE "public"."payment_method" ADD VALUE 'card';--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "shipping_address" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "source" "order_source" DEFAULT 'online' NOT NULL;