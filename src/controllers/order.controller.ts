// src/controllers/order.controller.ts
import { Request, Response } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db } from "../db";
import { orders, orderItems, createPosOrderSchema } from "../models/order.model";
import { products } from "../models/product.model";
import { generateUniqueOrderNumber } from "../utils/order-helper"; // Ensure this exists
import { AuthRequest } from "../middleware/auth";


export const createPosOrder = async (req: AuthRequest, res: Response) => {
    try {
        const parsed = createPosOrderSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ success: false, errors: parsed.error.format() });

        const body = parsed.data;

        const result = await db.transaction(async (tx) => {
            let subtotal = 0;
            const finalizedItems = [];

            for (const item of body.items) {
                if (!item.productId) {
                    // Custom line item (not in DB)
                    subtotal += item.priceAtPurchase * item.quantity;
                    finalizedItems.push({ ...item, priceAtPurchase: String(item.priceAtPurchase) });
                    continue;
                }

                // Look up actual product to verify stock and price
                const [product] = await tx
                    .select()
                    .from(products)
                    .where(eq(products.id, item.productId));

                if (!product) throw new Error(`Product not found: ${item.name}`);
                if (product.stock < item.quantity) throw new Error(`Out of stock: ${item.name}`);

                // Base price without product-level discounts
                const basePrice = Number(product.price);
                const finalPrice = Math.round(basePrice);

                subtotal += finalPrice * item.quantity;

                finalizedItems.push({
                    productId: product.id,
                    name: product.title,
                    sku: product.sku,
                    quantity: item.quantity,
                    priceAtPurchase: String(finalPrice),
                });

                // Deduct Stock
                await tx.update(products)
                    .set({ stock: sql`${products.stock} - ${item.quantity}` })
                    .where(eq(products.id, product.id));
            }

            // Apply the ORDER-LEVEL discount here
            const totalAmount = subtotal - (body.discount || 0);

            // Create Order
            const [newOrder] = await tx.insert(orders).values({
                customerId: body.customerId,
                servedBy: body.servedBy,
                orderNumber: await generateUniqueOrderNumber(tx),
                subtotal: String(subtotal),
                discount: String(body.discount || 0),
                totalAmount: String(totalAmount),
                paymentMethod: body.paymentMethod,
                paymentStatus: body.paymentStatus,
                status: body.status,
                orderNote: body.orderNote,
            }).returning();

            // Create Order Items
            await tx.insert(orderItems).values(
                finalizedItems.map((item) => ({
                    orderId: newOrder.id,
                    ...item,
                }))
            );

            return newOrder;
        });

        res.status(201).json({ success: true, data: result });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
};

export const getAllOrders = async (req: Request, res: Response) => {
    try {
        const data = await db.select().from(orders).where(eq(orders.isDeleted, false)).orderBy(sql`${orders.createdAt} DESC`);
        res.json({ success: true, data });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getOrderById = async (req: Request, res: Response) => {
    try {
        const order = await db.query.orders.findFirst({
            where: and(eq(orders.id, req.params.id), eq(orders.isDeleted, false)),
            with: { items: { where: eq(orderItems.isDeleted, false) } },
        });
        if (!order) return res.status(404).json({ message: "Order not found" });
        res.json({ success: true, data: order });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateOrderStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        await db.transaction(async (tx) => {
            const order = await tx.query.orders.findFirst({
                where: and(eq(orders.id, id), eq(orders.isDeleted, false)),
                with: { items: true },
            });

            if (!order) throw new Error("Order not found");
            if (order.status === "refunded" || order.status === "cancelled") throw new Error(`Order is already ${order.status}`);

            await tx.update(orders).set({ status }).where(eq(orders.id, id));

            // Restore stock if refunded or cancelled
            if (status === "cancelled" || status === "refunded") {
                for (const item of order.items) {
                    if (!item.productId) continue;
                    await tx.update(products).set({ stock: sql`${products.stock} + ${item.quantity}` }).where(eq(products.id, item.productId));
                }
            }
        });

        res.json({ success: true, message: `Order updated to ${status}` });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
};