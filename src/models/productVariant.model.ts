import { pgTable, uuid, text, integer, decimal, jsonb } from 'drizzle-orm/pg-core'; // Import decimal
import { z } from 'zod';
import { products } from './product.model';

export const productVariants = pgTable('product_variants', {
  id: uuid('id').defaultRandom().primaryKey(),
  
  productId: uuid('product_id')
    .references(() => products.id, { onDelete: 'cascade' })
    .notNull(),

  title: text('title'),
  sku: text('sku').unique(),
  barcode: text('barcode').unique(), 
  
  // FIX: Change 'integer' to 'decimal' to handle values like 72.5
  price: decimal('price', { precision: 10, scale: 2 }).notNull(), 
  
  stock: integer('stock').default(0).notNull(),

  images: text('images').array(),
  video: text('video'),

  options: jsonb('options').$type<Record<string, string>>(),
});

// --- Update Zod Schema ---
export const createVariantSchema = z.object({
  title: z.string().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  
  // Ensure Zod allows numbers (decimals are fine in JS number type)
  price: z.number().min(0, "Price cannot be negative"),
  stock: z.number().int().min(0),
  
  images: z.array(z.string().url()).optional(),
  video: z.string().url().optional(),
  
  options: z.record(z.string(), z.string()).optional(),
});

export const updateVariantSchema = createVariantSchema.partial();
export type CreateVariantInput = z.infer<typeof createVariantSchema>;
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;