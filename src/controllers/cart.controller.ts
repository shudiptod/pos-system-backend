import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db";
import { carts } from "../models/carts.model";
import { cartItems, addToCartSchema, updateCartItemSchema } from "../models/cartItems.model";
import { products } from "../models/product.model";
import { productVariants } from "../models/productVariant.model";
import { eq, and, lte, inArray, sql } from "drizzle-orm";
import { ZodError } from "zod";

const getActiveCartId = async (req: Request, res: Response) => {
  const customerId = (req as any).user?.id;
  let guestId = req.cookies.cart_guest_id;

  if (!customerId && !guestId) {
    guestId = uuidv4();
    res.cookie("cart_guest_id", guestId, {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });
  }

  let condition = customerId ? eq(carts.customerId, customerId) : eq(carts.guestId, guestId);

  const existingCart = await db
    .select()
    .from(carts)
    .where(and(condition, eq(carts.status, "active")))
    .limit(1);

  if (existingCart.length > 0) return existingCart[0].id;

  const [newCart] = await db
    .insert(carts)
    .values({
      customerId: customerId || null,
      guestId: customerId ? null : guestId,
      status: "active",
    })
    .returning({ id: carts.id });

  return newCart.id;
};

export const getCart = async (req: Request, res: Response) => {
  try {
    const cartId = await getActiveCartId(req, res);

    // 1. AUTO-CLEANUP: Remove items where VARIANT stock is 0
    // We filter by variants having stock <= 0
    const outOfStockVariants = db.select({ id: productVariants.id }).from(productVariants).where(lte(productVariants.stock, 0)); // Check VARIANT stock

    await db.delete(cartItems).where(and(eq(cartItems.cartId, cartId), inArray(cartItems.variantId, outOfStockVariants)));

    // 2. FETCH ITEMS (Join Product AND Variant)
    const items = await db
      .select({
        id: cartItems.id,
        productId: cartItems.productId,
        variantId: cartItems.variantId,

        // Product Details
        name: products.title,
        image: products.images,

        // Variant Details (The real source of truth for price/stock)
        variantName: productVariants.title, // e.g., "Size: M"
        price: sql`COALESCE(${productVariants.price}, ${products.basePrice})`, // Use variant price, fallback to base
        stock: productVariants.stock,

        quantity: cartItems.quantity,
      })
      .from(cartItems)
      .innerJoin(products, eq(cartItems.productId, products.id))
      .innerJoin(productVariants, eq(cartItems.variantId, productVariants.id)) // Vital Join
      .where(eq(cartItems.cartId, cartId));

    // Calculate Subtotal
    const subtotal = items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);

    res.json({ cartId, items, subtotal });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to load cart" });
  }
};

export const addToCart = async (req: Request, res: Response) => {
  try {
    // 1. ZOD PARSE (Now includes variantId)
    const { productId, variantId, quantity } = addToCartSchema.parse(req.body);

    const cartId = await getActiveCartId(req, res);

    // 2. FETCH VARIANT (Check Stock Here)
    const [variant] = await db.select().from(productVariants).where(eq(productVariants.id, variantId));

    if (!variant) return res.status(404).json({ error: "Variant not found" });

    // Optional: Validate product ID matches variant
    // if (variant.productId !== productId) ...

    // 3. CHECK EXISTING ITEM
    const [existingItem] = await db
      .select()
      .from(cartItems)
      .where(
        and(
          eq(cartItems.cartId, cartId),
          eq(cartItems.variantId, variantId) // Check by Variant ID now
        )
      );

    const currentQty = existingItem ? existingItem.quantity : 0;

    const availableStock = variant.stock ?? 0;

    if (currentQty + quantity > availableStock) {
      return res.status(400).json({ error: `Only ${availableStock} items available.` });
    }

    // 5. UPSERT
    if (existingItem) {
      await db
        .update(cartItems)
        .set({ quantity: currentQty + quantity })
        .where(eq(cartItems.id, existingItem.id));
    } else {
      await db.insert(cartItems).values({
        cartId,
        productId,
        variantId,
        quantity,
      });
    }

    res.json({ success: true, message: "Added to cart" });
  } catch (error) {
    console.error("ADD TO CART ERROR:", error);
    if (error instanceof ZodError) return res.status(400).json({ error: error.issues[0].message });
    res.status(500).json({ error: "Failed to add item" });
  }
};

export const updateCartItem = async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;
    const { quantity } = updateCartItemSchema.parse(req.body);

    const [item] = await db.select().from(cartItems).where(eq(cartItems.id, itemId));
    if (!item) return res.status(404).json({ error: "Item not found" });

    // 1. FETCH VARIANT for Stock Check
    const [variant] = await db.select().from(productVariants).where(eq(productVariants.id, item.variantId));

    if (!variant) return res.status(404).json({ error: "Product variant not found" });
    const availableStock = variant.stock ?? 0;

    if (quantity > availableStock) {
      return res.status(400).json({ error: `Max stock is ${variant.stock}` });
    }

    await db.update(cartItems).set({ quantity }).where(eq(cartItems.id, itemId));

    res.json({ success: true, message: "Updated" });
  } catch (error) {
    if (error instanceof ZodError) {
      // FIX: Use .issues instead of .errors
      return res.status(400).json({ error: error.issues[0].message });
    }
    res.status(500).json({ error: "Update failed" });
  }
};

// removeCartItem remains exactly the same
export const removeCartItem = async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;
    await db.delete(cartItems).where(eq(cartItems.id, itemId));
    res.json({ success: true, message: "Removed" });
  } catch (error) {
    res.status(500).json({ error: "Remove failed" });
  }
};
