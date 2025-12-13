ALTER TABLE "admins" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "admins" ALTER COLUMN "name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "admins" ALTER COLUMN "role" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "customers" ALTER COLUMN "name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ALTER COLUMN "is_banned" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "customers" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "customers" ALTER COLUMN "created_at" SET NOT NULL;