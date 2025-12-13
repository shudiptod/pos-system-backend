import { pgTable, uuid, text, boolean } from 'drizzle-orm/pg-core';
import { z } from 'zod';

export const categories = pgTable('categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  parentId: uuid('parent_id'),
  imagePath: text('image_path'),
  isActive: boolean('is_active').default(true),
});

export const createCategorySchema = z.object({
  name: z.string().min(2),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  parentId: z.string().uuid().optional(),
  imagePath: z.string().url().optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;