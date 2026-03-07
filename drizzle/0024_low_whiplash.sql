ALTER TABLE "product_variants" ADD COLUMN "warranty" text DEFAULT 'No Warranty';--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "requires_imei" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "sku" varchar(100);--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "imei" varchar(100);--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "warranty" varchar(100);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "served_by" varchar(255);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount" numeric(12, 2) DEFAULT '0.00';