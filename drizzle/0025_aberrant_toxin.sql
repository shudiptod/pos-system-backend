ALTER TABLE "orders" ADD COLUMN "subtotal" numeric(12, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_cost" numeric(12, 2) NOT NULL;