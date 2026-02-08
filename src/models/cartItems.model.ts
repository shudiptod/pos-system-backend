import { pgTable, uuid, integer, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod";
import { carts } from "./carts.model";
import { products } from "./product.model";
import { productVariants } from "./productVariant.model";


export const cartItems = pgTable("cart_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  cartId: uuid("cart_id").references(() => carts.id, { onDelete: 'cascade' }).notNull(),

  productId: uuid("product_id").references(() => products.id, { onDelete: 'cascade' }).notNull(),
  variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: 'cascade' }).notNull(),

  quantity: integer("quantity").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow(),
});


export const addToCartSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid({ message: "Variant selection is required" }),
  quantity: z.number().int().min(1).default(1),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().min(1),
});

export type AddToCartInput = z.infer<typeof addToCartSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;