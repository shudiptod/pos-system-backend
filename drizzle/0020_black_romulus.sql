ALTER TABLE "addresses" DROP CONSTRAINT "addresses_customer_id_customers_id_fk";
--> statement-breakpoint
ALTER TABLE "addresses" ALTER COLUMN "label" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "addresses" ALTER COLUMN "area" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN "division" text NOT NULL;--> statement-breakpoint
ALTER TABLE "addresses" ADD COLUMN "postal_code" text NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "thumbnail_at_purchase" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "contact_info" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "order_note" text;--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "billing_address";