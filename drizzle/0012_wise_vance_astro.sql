CREATE TABLE "store_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"address" text NOT NULL,
	"phone" varchar(50),
	"email" varchar(255),
	"open_time" varchar(20),
	"close_time" varchar(20),
	"map_embed_iframe" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "website_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_name" varchar(255) DEFAULT 'MMH Station 25',
	"description" text,
	"logo" text,
	"favicon" text,
	"contact_email" varchar(255),
	"contact_phone" varchar(50),
	"address" text,
	"social_links" jsonb DEFAULT '{}'::jsonb,
	"shipping_inside_dhaka" integer DEFAULT 60,
	"shipping_outside_dhaka" integer DEFAULT 120,
	"meta_keywords" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
