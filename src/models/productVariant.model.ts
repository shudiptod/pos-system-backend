
import { pgTable, uuid, text, integer, jsonb } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { products } from './product.model';

export const productVariants = pgTable('product_variants', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: uuid('product_id')
    .references(() => products.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title'),
  sku: text('sku').unique(),
  price: integer('price'),
  stock: integer('stock').default(0),
  // jsonb column → stores { color: "Blue", ram: "8GB" }
  options: jsonb('options').$type<Record<string, string>>(),
});

export const createVariantSchema = z.object({
  title: z.string().min(1),
  sku: z.string().min(3),
  price: z.number().int().positive(),
  stock: z.number().int().min(0),
  options: z.record(z.string(), z.string()).optional(),
});

export const updateVariantSchema = createVariantSchema.partial();

export type CreateVariantInput = z.infer<typeof createVariantSchema>;
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;