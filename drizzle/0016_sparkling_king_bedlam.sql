ALTER TABLE "product_variants" ADD COLUMN "discount_type" text DEFAULT 'FIXED';--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "discount_value" numeric(10, 2) DEFAULT '0';