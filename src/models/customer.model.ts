// src/models/customer.model.ts
import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod";

export const customers = pgTable("customers", {
	id: uuid("id").primaryKey().defaultRandom(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	phone: text("phone").notNull().unique(),
	passwordHash: text("password_hash").notNull(),
	isBanned: boolean("is_banned").default(false),
	avatarUrl: text("avatar_url"),
	notes: text("notes"),
	isDeleted: boolean("is_deleted").default(false),
	createdAt: timestamp("created_at").defaultNow(),
});

// --- 1. Base Customer Registration Schema ---
export const registerCustomerSchema = z.object({
	phone: z.string().min(11, "Valid phone number required"),
	name: z.string().min(2, "Name required"),
	password: z.string().min(6, "Password must be at least 6 characters"),
	email: z.string().min(5).email("Invalid email address"),
	avatarUrl: z.string().url().optional(),
	notes: z.string().optional(),
});

// --- 2. Update Customer Profile Schema ---
export const updateCustomerSchema = registerCustomerSchema.partial().omit({ password: true });

export type RegisterCustomerInput = z.infer<typeof registerCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
