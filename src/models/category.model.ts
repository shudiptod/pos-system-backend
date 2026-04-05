// src/models/category.model.ts
import { pgTable, uuid, text, boolean, AnyPgColumn } from "drizzle-orm/pg-core";
import { z } from "zod";

export const categories = pgTable("categories", {
	id: uuid("id").defaultRandom().primaryKey(),
	name: text("name").notNull(),
	parentId: uuid("parent_id").references((): AnyPgColumn => categories.id),
	isActive: boolean("is_active").default(true),
	isDeleted: boolean("is_deleted").default(false),
});

export const createCategorySchema = z.object({
	name: z.string().min(2),
	parentId: z.string().uuid().optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;