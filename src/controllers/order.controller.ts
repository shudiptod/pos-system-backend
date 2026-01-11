import { Request, Response } from "express";
import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { orders, orderItems, createOrderSchema } from "../models/order.model";
import { carts } from "../models/carts.model";
import { products } from "../models/product.model";
import { productVariants } from "../models/productVariant.model";
import { cartItems } from "../models";
import { AuthRequest } from "../middleware/customerAuth";

// GET: Single Order
export const getOrder = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const order = await db.query.orders.findFirst({
            where: eq(orders.id, id),
            with: {
                items: true, // This works because we fixed the relations
            },
        });

        if (!order) return res.status(404).json({ message: "Order not found" });

        return res.json(order);
    } catch (error) {
        return res.status(500).json({ message: "Error fetching order", error });
    }
};

// POST: Place Order (The Complex One)
export const createOrder = async (req: AuthRequest, res: Response) => {
    try {
        // 1. Validate Input using Zod
        // (Assuming user is authenticated and req.user.id exists)
        const body = createOrderSchema.parse(req.body);
        const userId = req.customer?.id; // TypeScript knows this might be undefined

        const result = await db.transaction(async (tx) => {
            // A. Fetch Cart & Product Details
            // We join to get the LIVE price and LIVE stock
            const userCartItems = await tx
                .select({
                    productId: cartItems.productId,
                    variantId: cartItems.variantId,
                    quantity: cartItems.quantity,
                    price: productVariants.price, // Live DB price
                    stock: productVariants.stock, // Live DB stock
                    productName: products.title,
                    variantName: productVariants.title
                })
                .from(cartItems)
                .innerJoin(productVariants, eq(cartItems.variantId, productVariants.id))
                .innerJoin(products, eq(cartItems.productId, products.id))
                .where(eq(cartItems.cartId, body.cartId));

            if (userCartItems.length === 0) {
                throw new Error("Cart is empty or invalid");
            }

            // B. Validation & Total Calculation
            let calculatedTotal = 0;

            for (const item of userCartItems) {
                if (item.stock < item.quantity) {
                    throw new Error(`Out of stock: ${item.productName} (${item.variantName})`);
                }
                // Always use numeric/string for currency math, never JS float
                calculatedTotal += Number(item.price) * item.quantity;
            }

            // C. Create Order
            const [newOrder] = await tx
                .insert(orders)
                .values({
                    customerId: userId, // Ensure this matches your Auth system
                    totalAmount: calculatedTotal.toString(),
                    status: 'pending',
                    paymentMethod: body.paymentMethod,
                    paymentStatus: 'unpaid', // COD default
                    shippingAddress: body.shippingAddress,
                    billingAddress: body.billingAddress || body.shippingAddress, // Fallback logic
                })
                .returning();

            // D. Snapshot Items
            await tx.insert(orderItems).values(
                userCartItems.map((item) => ({
                    orderId: newOrder.id,
                    productId: item.productId,
                    variantId: item.variantId,
                    name: `${item.productName} - ${item.variantName}`,
                    quantity: item.quantity,
                    priceAtPurchase: item.price.toString(),
                }))
            );

            // E. Deduct Stock Immediately
            for (const item of userCartItems) {
                await tx
                    .update(productVariants)
                    .set({
                        stock: sql`${productVariants.stock} - ${item.quantity}`
                    })
                    .where(eq(productVariants.id, item.variantId));
            }

            // F. Close Cart
            await tx
                .update(carts)
                .set({ status: 'ordered' })
                .where(eq(carts.id, body.cartId));

            return newOrder;
        });

        return res.status(201).json(result);

    } catch (error: any) {
        console.error(error);
        return res.status(400).json({ message: error.message || "Order failed" });
    }
};

// POST: Cancel Order (Restocking Logic)
export const cancelOrder = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        await db.transaction(async (tx) => {
            const order = await tx.query.orders.findFirst({
                where: eq(orders.id, id),
                with: { items: true }
            });

            if (!order) throw new Error("Order not found");
            if (order.status === 'cancelled') throw new Error("Order already cancelled");
            if (order.status === 'shipped' || order.status === 'delivered') {
                throw new Error("Cannot cancel shipped order");
            }

            // 1. Mark as Cancelled
            await tx.update(orders)
                .set({ status: 'cancelled' })
                .where(eq(orders.id, id));

            // 2. Restock Items
            for (const item of order.items) {
                // Safety check: If variant was deleted from DB (null), we can't restock it
                if (!item.variantId) continue;

                await tx.update(productVariants)
                    .set({
                        stock: sql`${productVariants.stock} + ${item.quantity}`
                    })
                    .where(eq(productVariants.id, item.variantId));
            }
        });

        return res.json({ message: "Order cancelled and inventory restocked" });

    } catch (error: any) {
        return res.status(400).json({ message: error.message });
    }
};