// src/controllers/cart.controller.ts
import { Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { db } from "../db";
import { carts } from "../models/carts.model";
import { cartItems, addToCartSchema, updateCartItemSchema } from "../models/cartItems.model";
import { products } from "../models/product.model";
import { eq, and, lte, inArray, getTableColumns } from "drizzle-orm";
import { ZodError } from "zod";
import { AuthRequest } from "../middleware/customerAuth";

// Note: productVariants import has been completely removed

const getActiveCartId = async (req: AuthRequest, res: Response) => {
	const customerId = (req as any).customer?.id;
	let guestId = req.cookies.cart_guest_id;

	if (!customerId && !guestId) {
		guestId = uuidv4();

		const isProduction = process.env.NODE_ENV === "production";

		res.cookie("cart_guest_id", guestId, {
			maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
			httpOnly: true,
			sameSite: "lax",
			secure: isProduction,
		});
	}

	let condition = customerId ? eq(carts.customerId, customerId) : eq(carts.guestId, guestId);

	const existingCart = await db
		.select()
		.from(carts)
		.where(and(condition, eq(carts.status, "active"), eq(carts.isDeleted, false))) // Added isDeleted check
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

export const getCart = async (req: AuthRequest, res: Response) => {
	try {
		const cartId = await getActiveCartId(req, res);

		// 1. AUTO-CLEANUP: Remove items where PRODUCT stock is 0
		const outOfStockProducts = db.select({ id: products.id }).from(products).where(lte(products.stock, 0));

		// Soft delete out-of-stock items
		await db
			.update(cartItems)
			.set({ isDeleted: true })
			.where(and(eq(cartItems.cartId, cartId), inArray(cartItems.productId, outOfStockProducts)));

		// 2. FETCH ITEMS (Join only Product)
		const items = await db
			.select({
				id: cartItems.id,
				productId: cartItems.productId,
				name: products.title,
				image: products.images,
				price: products.price,
				stock: products.stock,
				quantity: cartItems.quantity,
				slug: products.slug,
				discountStatus: products.discountStatus,
				discountType: products.discountType,
				discountValue: products.discountValue,
			})
			.from(cartItems)
			.innerJoin(products, eq(cartItems.productId, products.id))
			.where(and(eq(cartItems.cartId, cartId), eq(cartItems.isDeleted, false))); // Only non-deleted items

		// Calculate Subtotal with possible discounts
		const subtotal = items.reduce((sum, item) => {
			const basePrice = Number(item.price);
			const discValue = Number(item.discountValue || 0);
			let salePrice = basePrice;

			if (item.discountStatus && discValue > 0) {
				salePrice =
					item.discountType === "PERCENTAGE" ? basePrice * (1 - discValue / 100) : basePrice - discValue;
			}

			return sum + Math.round(salePrice) * item.quantity;
		}, 0);

		const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

		res.json({ cartId, items, subtotal, totalQuantity });
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: "Failed to load cart" });
	}
};

export const addToCart = async (req: AuthRequest, res: Response) => {
	try {
		// 1. ZOD PARSE (variantId is no longer needed)
		const { productId, quantity } = addToCartSchema.parse(req.body);

		const cartId = await getActiveCartId(req, res);

		// 2. FETCH PRODUCT (Check Stock Here)
		const [product] = await db
			.select()
			.from(products)
			.where(and(eq(products.id, productId), eq(products.isDeleted, false)));

		if (!product) return res.status(404).json({ error: "Product not found" });

		// 3. CHECK EXISTING ITEM
		const [existingItem] = await db
			.select()
			.from(cartItems)
			.where(
				and(
					eq(cartItems.cartId, cartId),
					eq(cartItems.productId, productId),
					eq(cartItems.isDeleted, false), // Ensure it's an active item
				),
			);

		const currentQty = existingItem ? existingItem.quantity : 0;
		const availableStock = product.stock ?? 0;

		if (currentQty + quantity > availableStock) {
			return res.status(400).json({ error: `Only ${availableStock} items available.` });
		}

		// Check minimum order quantity requirement
		if (currentQty + quantity < product.minOrderQuantity) {
			return res.status(400).json({ error: `Minimum order quantity is ${product.minOrderQuantity}.` });
		}

		// 4. UPSERT (Update or Insert)
		if (existingItem) {
			await db
				.update(cartItems)
				.set({ quantity: currentQty + quantity })
				.where(eq(cartItems.id, existingItem.id));
		} else {
			await db.insert(cartItems).values({
				cartId,
				productId,
				quantity,
			});
		}

		// =========================================================
		// 5. FETCH LATEST CART STATE
		// =========================================================
		const items = await db
			.select({
				id: cartItems.id,
				productId: cartItems.productId,
				name: products.title,
				image: products.images,
				price: products.price,
				stock: products.stock,
				quantity: cartItems.quantity,
				discountStatus: products.discountStatus,
				discountType: products.discountType,
				discountValue: products.discountValue,
			})
			.from(cartItems)
			.innerJoin(products, eq(cartItems.productId, products.id))
			.where(and(eq(cartItems.cartId, cartId), eq(cartItems.isDeleted, false)));

		const subtotal = items.reduce((sum, item) => {
			const basePrice = Number(item.price);
			const discValue = Number(item.discountValue || 0);
			let salePrice = basePrice;

			if (item.discountStatus && discValue > 0) {
				salePrice =
					item.discountType === "PERCENTAGE" ? basePrice * (1 - discValue / 100) : basePrice - discValue;
			}

			return sum + Math.round(salePrice) * item.quantity;
		}, 0);

		res.json({
			success: true,
			message: "Added to cart",
			cartId,
			items,
			subtotal,
		});
	} catch (error) {
		console.error("ADD TO CART ERROR:", error);
		if (error instanceof ZodError) return res.status(400).json({ error: error.issues[0].message });
		res.status(500).json({ error: "Failed to add item" });
	}
};

export const updateCartItem = async (req: AuthRequest, res: Response) => {
	try {
		const { itemId } = req.params;
		const { quantity } = updateCartItemSchema.parse(req.body);

		const [item] = await db.select().from(cartItems).where(eq(cartItems.id, itemId));
		if (!item) return res.status(404).json({ error: "Item not found" });

		// 1. FETCH PRODUCT for Stock Check
		const [product] = await db.select().from(products).where(eq(products.id, item.productId));

		if (!product) return res.status(404).json({ error: "Product not found" });
		const availableStock = product.stock ?? 0;

		if (quantity > availableStock) {
			return res.status(400).json({ error: `Max stock is ${product.stock}` });
		}

		if (quantity < product.minOrderQuantity) {
			return res.status(400).json({ error: `Minimum order quantity is ${product.minOrderQuantity}.` });
		}

		await db.update(cartItems).set({ quantity }).where(eq(cartItems.id, itemId));

		res.json({ success: true, message: "Updated" });
	} catch (error) {
		if (error instanceof ZodError) {
			return res.status(400).json({ error: error.issues[0].message });
		}
		res.status(500).json({ error: "Update failed" });
	}
};

export const removeCartItem = async (req: AuthRequest, res: Response) => {
	try {
		const { itemId } = req.params;
		// Implementing Soft Delete
		await db.update(cartItems).set({ isDeleted: true }).where(eq(cartItems.id, itemId));
		res.json({ success: true, message: "Removed" });
	} catch (error) {
		res.status(500).json({ error: "Remove failed" });
	}
};
