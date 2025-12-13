import { pgTable, uuid, text, integer, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { admins } from './admin.model';
import { categories } from './category.model';

export const products = pgTable('products', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  categoryId: uuid('category_id').references(() => categories.id),
  createdByAdminId: uuid('created_by_admin_id').references(() => admins.id),
  updatedByAdminId: uuid('updated_by_admin_id').references(() => admins.id),
  slug: text('slug').notNull().unique(),
  basePrice: integer('base_price').notNull(),
  images: text('images').array(),
  isPublished: boolean('is_published').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const createProductSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  categoryId: z.string().uuid(),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  basePrice: z.number().int().positive(),
  images: z.array(z.string().url()),
  isPublished: z.boolean().optional(),
});

export const updateProductSchema = createProductSchema.partial();

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;