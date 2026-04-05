// src/models/carts.model.ts
import { pgTable, uuid, varchar, timestamp, pgEnum, boolean } from "drizzle-orm/pg-core";
import { customers } from "../models/customer.model";
export const cartStatusEnum = pgEnum("cart_status", ["active", "ordered", "abandoned"]);
export const carts = pgTable("carts", {
	id: uuid("id").primaryKey().defaultRandom(),
	customerId: uuid("customer_id").references(() => customers.id),
	guestId: varchar("guest_id", { length: 255 }),
	status: cartStatusEnum("status").default("active").notNull(),
	createdAt: timestamp("created_at").defaultNow(),
	updatedAt: timestamp("updated_at").defaultNow(),
	isDeleted: boolean("is_deleted").default(false),
});
