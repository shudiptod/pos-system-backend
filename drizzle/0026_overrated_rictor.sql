CREATE TYPE "public"."asset_type" AS ENUM('string', 'banner', 'single');--> statement-breakpoint
CREATE TABLE "banners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"image_path" text NOT NULL,
	"asset_type" "asset_type" DEFAULT 'banner' NOT NULL,
	"banner_position" integer,
	"is_disabled" boolean DEFAULT false,
	"is_deleted" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "addresses" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_variants" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "addresses" CASCADE;--> statement-breakpoint
DROP TABLE "product_variants" CASCADE;--> statement-breakpoint
ALTER TABLE "cart_items" DROP CONSTRAINT "cart_items_variant_id_product_variants_id_fk";
--> statement-breakpoint
ALTER TABLE "order_items" DROP CONSTRAINT "order_items_variant_id_product_variants_id_fk";
--> statement-breakpoint
ALTER TABLE "website_settings" ALTER COLUMN "app_name" SET DEFAULT 'Mehezabin Mehedi House';--> statement-breakpoint
ALTER TABLE "admins" ADD COLUMN "is_deleted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "cart_items" ADD COLUMN "is_deleted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "carts" ADD COLUMN "is_deleted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "is_deleted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "is_deleted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "short_description" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "long_description" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "price" numeric(10, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "sku" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "stock" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "min_order_quantity" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "images" jsonb;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "options" jsonb;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "discount_status" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "discount_type" text DEFAULT 'FIXED';--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "discount_value" numeric(10, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "rating" numeric(3, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "reviews_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "is_published" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "is_deleted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "is_deleted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "district" varchar(100) NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "address" text NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "is_deleted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "website_settings" ADD COLUMN "available_delivery_locations" jsonb DEFAULT '["All Bangladesh"]'::jsonb;--> statement-breakpoint
ALTER TABLE "website_settings" ADD COLUMN "is_deleted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" DROP COLUMN "variant_id";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "description";--> statement-breakpoint
ALTER TABLE "order_items" DROP COLUMN "variant_id";--> statement-breakpoint
ALTER TABLE "order_items" DROP COLUMN "imei";--> statement-breakpoint
ALTER TABLE "order_items" DROP COLUMN "warranty";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "shipping_address";--> statement-breakpoint
ALTER TABLE "website_settings" DROP COLUMN "bin_number";--> statement-breakpoint
ALTER TABLE "website_settings" DROP COLUMN "mushak_type";--> statement-breakpoint
ALTER TABLE "website_settings" DROP COLUMN "authorized_status";--> statement-breakpoint
ALTER TABLE "website_settings" DROP COLUMN "show_imei_on_invoice";--> statement-breakpoint
ALTER TABLE "website_settings" DROP COLUMN "show_warranty_on_invoice";--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_sku_unique" UNIQUE("sku");