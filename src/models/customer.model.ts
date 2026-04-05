// src/models/customer.model.ts
import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod";

export const customers = pgTable("customers", {
	id: uuid("id").primaryKey().defaultRandom(),
	name: text("name").notNull(),
	phone: text("phone").notNull().unique(),
	email: text("email"),
	isDeleted: boolean("is_deleted").default(false),
	createdAt: timestamp("created_at").defaultNow(),
});

export const registerCustomerSchema = z.object({
	phone: z.string().min(11, "Valid phone number required"),
	name: z.string().min(2, "Name required"),
	email: z.string().email("Invalid email address").optional().or(z.literal("")),
});

export const updateCustomerSchema = registerCustomerSchema.partial();

export type RegisterCustomerInput = z.infer<typeof registerCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;