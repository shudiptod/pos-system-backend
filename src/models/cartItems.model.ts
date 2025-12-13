import { pgTable, uuid, integer, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod";
import { carts } from "./carts.model";
import { products } from "./product.model"; 
import { productVariants } from "./productVariant.model"; // IMPORT THIS

// --- TABLE ---
export const cartItems = pgTable("cart_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  cartId: uuid("cart_id").references(() => carts.id, { onDelete: 'cascade' }).notNull(),
  
  productId: uuid("product_id").references(() => products.id).notNull(), // Kept for grouping
  variantId: uuid("variant_id").references(() => productVariants.id).notNull(), // NEW: Specific link for stock
  
  quantity: integer("quantity").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow(),
});

// --- ZOD SCHEMAS ---
export const addToCartSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid({ message: "Variant selection is required" }), // NEW
  quantity: z.number().int().min(1).default(1),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().min(1),
});

export type AddToCartInput = z.infer<typeof addToCartSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;