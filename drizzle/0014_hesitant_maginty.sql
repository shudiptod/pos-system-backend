ALTER TABLE "orders" ADD COLUMN "order_number" varchar(20);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_order_number_unique" UNIQUE("order_number");