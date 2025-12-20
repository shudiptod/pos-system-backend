ALTER TABLE "products" ALTER COLUMN "is_published" SET DEFAULT true;--> statement-breakpoint
ALTER TABLE "product_variants" ALTER COLUMN "price" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "product_variants" ALTER COLUMN "stock" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "barcode" text;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "images" text[];--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "video" text;--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "base_price";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "images";--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_barcode_unique" UNIQUE("barcode");