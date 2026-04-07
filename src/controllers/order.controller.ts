// src/controllers/order.controller.ts
import { Request, Response } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db } from "../db";
import { orders, orderItems, createPosOrderSchema } from "../models/order.model";
import { products } from "../models/product.model";
import { generateUniqueOrderNumber } from "../utils/order-helper"; // Ensure this exists
import { AuthRequest } from "../middleware/auth";


import { customers } from "../models/customer.model"; // Import your customer model



/**
 * Handles the creation of a POS order, stock deduction, 
 * and customer snapshotting within a database transaction.
 */
export const createPosOrder = async (req: AuthRequest, res: Response) => {
    try {
        // 1. Validate Input
        const parsed = createPosOrderSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ success: false, errors: parsed.error.format() });
        }

        const body = parsed.data;

        // 2. Start Transaction to ensure data integrity
        const result = await db.transaction(async (tx) => {
            let finalCustomerId = body.customerId;

            // Handle Walk-in / New Customer Logic
            if (!finalCustomerId && body.customerPhone) {
                const [existing] = await tx
                    .select()
                    .from(customers)
                    .where(eq(customers.phone, body.customerPhone));

                if (existing) {
                    finalCustomerId = existing.id;
                } else {
                    const [newCust] = await tx.insert(customers).values({
                        name: body.customerName || "Walk-in Customer",
                        phone: body.customerPhone,
                    }).returning();
                    finalCustomerId = newCust.id;
                }
            }

            // Create a point-in-time snapshot of customer details
            const customerSnapshot = {
                fullName: body.customerName || "Walk-in Customer",
                phone: body.customerPhone || "N/A",
            };

            let calculatedSubtotal = 0;
            // Array to hold items for bulk insertion
            const finalizedItems: any[] = [];

            // 3. Process Items & Update Stock
            for (const item of body.items) {
                const qty = Number(item.quantity);
                const price = Math.round(Number(item.priceAtPurchase));

                if (!item.productId) {
                    // Branch A: Custom/Non-Inventory Item (Service charges, etc.)
                    calculatedSubtotal += price * qty;
                    finalizedItems.push({
                        name: item.name,
                        sku: item.sku || "CUSTOM",
                        quantity: qty,
                        priceAtPurchase: String(price),
                        buyingPriceAtPurchase: String(0.00), // Default cost for custom items
                        productId: null, // Keep keys consistent for Drizzle
                    });
                    continue;
                }

                // Branch B: Inventory Product
                const [product] = await tx.select().from(products).where(eq(products.id, item.productId));

                if (!product) throw new Error(`Product "${item.name}" not found in inventory.`);
                if (product.stock < qty) throw new Error(`Insufficient stock for "${item.name}". Available: ${product.stock}`);

                calculatedSubtotal += price * qty;

                finalizedItems.push({
                    name: product.title,
                    sku: product.sku || null,
                    quantity: qty,
                    priceAtPurchase: String(price),
                    buyingPriceAtPurchase: String(product.buyingPrice || "0.00"),
                    productId: product.id,
                });

                // Atomic stock deduction
                await tx.update(products)
                    .set({ stock: sql`${products.stock} - ${qty}` })
                    .where(eq(products.id, product.id));
            }

            const totalAmount = calculatedSubtotal - (body.discount || 0);

            // Simple logic for order number (can be replaced with a more robust generator)
            const orderNumber = `INV-${Date.now().toString().slice(-8)}`;

            // 4. Create the Order Record
            const [newOrder] = await tx.insert(orders).values({
                customerId: finalCustomerId,
                customerSnapshot: customerSnapshot,
                servedBy: body.servedBy,
                orderNumber: orderNumber,
                subtotal: String(calculatedSubtotal),
                discount: String(body.discount || 0),
                totalAmount: String(totalAmount),
                paymentMethod: body.paymentMethod,
                paymentStatus: body.paymentStatus,
                status: body.status,
                orderNote: body.orderNote,
            }).returning();

            // 5. Bulk Insert Order Items linked to the new Order
            await tx.insert(orderItems).values(
                finalizedItems.map(item => ({
                    ...item,
                    orderId: newOrder.id,
                }))
            );

            return newOrder;
        });

        res.status(201).json({ success: true, data: result });
    } catch (error: any) {
        // Error handling for transaction failures (e.g., out of stock)
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