ALTER TABLE "website_settings" ALTER COLUMN "app_name" SET DEFAULT 'Gajitto';--> statement-breakpoint
ALTER TABLE "website_settings" ADD COLUMN "bin_number" varchar(100);--> statement-breakpoint
ALTER TABLE "website_settings" ADD COLUMN "mushak_type" varchar(50) DEFAULT '6.3';--> statement-breakpoint
ALTER TABLE "website_settings" ADD COLUMN "authorized_status" text;--> statement-breakpoint
ALTER TABLE "website_settings" ADD COLUMN "invoice_brand_color" varchar(7) DEFAULT '#00B050';--> statement-breakpoint
ALTER TABLE "website_settings" ADD COLUMN "invoice_footer_note" text DEFAULT 'Once sold, items cannot be returned or exchanged.';--> statement-breakpoint
ALTER TABLE "website_settings" ADD COLUMN "show_imei_on_invoice" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "website_settings" ADD COLUMN "show_warranty_on_invoice" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "website_settings" ADD COLUMN "show_staff_on_invoice" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "website_settings" ADD COLUMN "show_amount_in_words" boolean DEFAULT true;