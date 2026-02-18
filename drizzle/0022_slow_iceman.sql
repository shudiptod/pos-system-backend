CREATE TABLE "app_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"level" text NOT NULL,
	"message" text NOT NULL,
	"context" jsonb,
	"source_file" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "level_idx" ON "app_logs" USING btree ("level");--> statement-breakpoint
CREATE INDEX "created_at_idx" ON "app_logs" USING btree ("created_at");