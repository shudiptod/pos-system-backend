// src/models/product.model.ts
import { pgTable, uuid, text, boolean, timestamp, integer, decimal, jsonb} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { admins } from "./admin.model";
import { categories } from "./category.model";

export const products = pgTable("products", {
	id: uuid("id").defaultRandom().primaryKey(),

	title: text("title").notNull(), // e.g. "Organic Henna Cone"
	slug: text("slug").notNull().unique(), // e.g. "organic-henna-cone"

	// Markdown Descriptions
	shortDescription: text("short_description"),
	longDescription: text("long_description"),

	categoryId: uuid("category_id").references(() => categories.id),
	lists: text("lists").array().default(sql`ARRAY[]::text[]`),

	price: decimal("price", { precision: 10, scale: 2 }).notNull(),
	sku: text("sku").unique(),
	stock: integer("stock").default(0).notNull(),
	minOrderQuantity: integer("min_order_quantity").default(1).notNull(),

	images: jsonb("images").$type<string[]>(), // Array of image URLs
	options: jsonb("options").$type<Record<string, string>>(), // Dynamic variant data (e.g., {"weight": "25g"})

	// Discount Fields
	discountStatus: boolean("discount_status").default(false),
	discountType: text("discount_type").$type<"PERCENTAGE" | "FIXED">().default("FIXED"),
	discountValue: decimal("discount_value", { precision: 10, scale: 2 }).default("0"),

	// Rating System
	rating: decimal("rating", { precision: 3, scale: 2 }).default("0"),
	reviewsCount: integer("reviews_count").default(0),

	isPublished: boolean("is_published").default(true),
	isDeleted: boolean("is_deleted").default(false), // Soft Delete

	// Admin Audit Fields
	createdByAdminId: uuid("created_by_admin_id").references(() => admins.id),
	updatedByAdminId: uuid("updated_by_admin_id").references(() => admins.id),

	createdAt: timestamp("created_at").defaultNow(),
	updatedAt: timestamp("updated_at").defaultNow(),
});

// ZOD SCHEMAS (Validation) - Merged Product & Variant Schemas
export const createProductSchema = z
	.object({
		title: z.string().min(3, "Title must be at least 3 chars"),
		slug: z.string().regex(/^[a-z0-9-]+$/, "Slug must be lowercase-kebab-case"),
		shortDescription: z.string().optional(),
		longDescription: z.string().optional(),
		categoryId: z.string().uuid("Invalid Category ID"),
		lists: z.array(z.enum(["random", "featured", "best_seller", "popular"])).optional().default([]),

		price: z.number().min(0, "Price cannot be negative"),
		sku: z.string().optional(),
		stock: z.number().int().min(0).default(0),
		minOrderQuantity: z.number().int().min(1).default(1),
		badge: z.string().optional(),

		images: z.array(z.string().url()).optional(),
		options: z.record(z.string(), z.string()).optional(),

		discountStatus: z.boolean().optional().default(false),
		discountType: z.enum(["PERCENTAGE", "FIXED"]).optional().default("FIXED"),
		discountValue: z.number().min(0, "Discount cannot be negative").optional().default(0),

		isPublished: z.boolean().optional().default(true),
	})
	.superRefine((data, ctx) => {
		if (data.discountType === "PERCENTAGE" && (data.discountValue || 0) > 100) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Percentage discount cannot exceed 100%",
				path: ["discountValue"],
			});
		}

		if (data.discountType === "FIXED" && (data.discountValue || 0) > data.price) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Discount value cannot exceed product price",
				path: ["discountValue"],
			});
		}
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
