



import { pgTable, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { admins } from './admin.model';
import { categories } from './category.model';

// PARENT PRODUCT TABLE
export const products = pgTable('products', {
  id: uuid('id').defaultRandom().primaryKey(),

  title: text('title').notNull(),         // e.g. "UZ-RB18"
  slug: text('slug').notNull().unique(),  // e.g. "uz-rb18"
  description: text('description'),

  categoryId: uuid('category_id').references(() => categories.id),

  // Admin Audit Fields
  createdByAdminId: uuid('created_by_admin_id').references(() => admins.id),
  updatedByAdminId: uuid('updated_by_admin_id').references(() => admins.id),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ZOD SCHEMAS (Validation)
export const createProductSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 chars"),
  description: z.string().optional(),
  categoryId: z.string().uuid("Invalid Category ID"),
  slug: z.string().regex(/^[a-z0-9-]+$/, "Slug must be lowercase-kebab-case"),
});

export const updateProductSchema = createProductSchema.partial();

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;


export const deleteProductsSchema = z.array(
  z.object({
    productId: z.string().uuid(),
    variantId: z.string().uuid(),
  })
);

export type DeleteProductsInput = z.infer<typeof deleteProductsSchema>;