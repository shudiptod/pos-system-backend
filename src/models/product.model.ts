// src/models/product.model.ts
import { pgTable, uuid, text, boolean, timestamp, integer, decimal, jsonb } from "drizzle-orm/pg-core";
import { z } from "zod";
import { admins } from "./admin.model";
import { categories } from "./category.model";

export const products = pgTable("products", {
	id: uuid("id").defaultRandom().primaryKey(),

	title: text("title").notNull(),
	categoryId: uuid("category_id").references(() => categories.id),

	price: decimal("price", { precision: 10, scale: 2 }).notNull(),
	sku: text("sku").unique(),
	stock: integer("stock").default(0).notNull(),

	// Image is nullable at the DB level
	images: jsonb("images").$type<string[]>(),

	isDeleted: boolean("is_deleted").default(false),

	createdByAdminId: uuid("created_by_admin_id").references(() => admins.id),
	updatedByAdminId: uuid("updated_by_admin_id").references(() => admins.id),

	createdAt: timestamp("created_at").defaultNow(),
	updatedAt: timestamp("updated_at").defaultNow(),
});

export const createProductSchema = z.object({
	title: z.string().min(3, "Title must be at least 3 chars"),
	categoryId: z.string().uuid("Invalid Category ID"),

	price: z.coerce.number().min(0, "Price cannot be negative"),
	sku: z.string().optional(),
	stock: z.coerce.number().int().min(0).default(0),

	// Explicitly optional and defaults to an empty array
	images: z.array(z.string().url()).optional().nullable().default([]),
});

export const updateProductSchema = createProductSchema.partial();

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const deleteProductsSchema = z.array(
	z.object({
		productId: z.string().uuid(),
	}),
);

export type DeleteProductsInput = z.infer<typeof deleteProductsSchema>;