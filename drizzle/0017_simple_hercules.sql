ALTER TABLE "product_variants" ADD COLUMN "is_published" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "is_published";