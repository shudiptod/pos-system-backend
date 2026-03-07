import { pgTable, uuid, text, integer, decimal, jsonb } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { products } from './product.model';
import { boolean } from 'drizzle-orm/pg-core';


export const productVariants = pgTable('product_variants', {
  id: uuid('id').defaultRandom().primaryKey(),

  productId: uuid('product_id')
    .references(() => products.id, { onDelete: 'cascade' })
    .notNull(),

  title: text('title'),
  sku: text('sku').unique(),
  barcode: text('barcode').unique(),

  price: decimal('price', { precision: 10, scale: 2 }).notNull(),

  // --- RETAIL & WARRANTY FIELDS (New) ---
  // e.g., "12 Months", "Lifetime", "No Warranty"
  warranty: text('warranty').default('No Warranty'),

  // If true, the system will prompt for IMEI/Serial during checkout
  requiresImei: boolean('requires_imei').default(false),

  // Stores 'PERCENTAGE' or 'FIXED'
  discountStatus: boolean('discount_status').default(false),
  discountType: text('discount_type').$type<'PERCENTAGE' | 'FIXED'>().default('FIXED'),

  // Stores the amount (e.g., 10 for 10% or 10 for $10)
  discountValue: decimal('discount_value', { precision: 10, scale: 2 }).default('0'),

  stock: integer('stock').default(0).notNull(),

  images: text('images').array(),
  video: text('video'),
  isFeatured: boolean('is_featured').default(false),
  options: jsonb('options').$type<Record<string, string>>(),
  isPublished: boolean('is_published').default(true),
});

// --- Update Zod Schema ---
// --- Update Zod Schema ---
export const createVariantSchema = z.object({
  title: z.string().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),

  price: z.number().min(0, "Price cannot be negative"),
  stock: z.number().int().min(0),

  // New Retail Fields
  warranty: z.string().optional().default("No Warranty"),
  requiresImei: z.boolean().optional().default(false),

  discountStatus: z.boolean().optional().default(false),
  discountType: z.enum(['PERCENTAGE', 'FIXED']).optional().default('FIXED'),
  discountValue: z.number().min(0, "Discount cannot be negative").optional().default(0),

  images: z.array(z.string().url()).optional(),
  video: z.string().url().optional(),
  isFeatured: z.boolean().optional(),
  options: z.record(z.string(), z.string()).optional(),
  isPublished: z.boolean().optional(),
}).superRefine((data, ctx) => {
  if (data.discountType === 'PERCENTAGE' && (data.discountValue || 0) > 100) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Percentage discount cannot exceed 100%",
      path: ["discountValue"],
    });
  }

  if (data.discountType === 'FIXED' && (data.discountValue || 0) > data.price) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Discount value cannot exceed product price",
      path: ["discountValue"],
    });
  }
});

export const updateVariantSchema = createVariantSchema.partial();
export type CreateVariantInput = z.infer<typeof createVariantSchema>;
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;