ALTER TABLE "banners" ALTER COLUMN "asset_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."asset_type";--> statement-breakpoint
CREATE TYPE "public"."asset_type" AS ENUM('banner', 'single');--> statement-breakpoint
ALTER TABLE "banners" ALTER COLUMN "asset_type" SET DATA TYPE "public"."asset_type" USING "asset_type"::"public"."asset_type";--> statement-breakpoint
ALTER TABLE "banners" ALTER COLUMN "asset_type" DROP DEFAULT;