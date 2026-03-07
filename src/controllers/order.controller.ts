import { Request, Response } from "express";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import {
    orders,
    orderItems,
    createOrderSchema,
    orderStatusEnum,
    createAdminOrderSchema
} from "../models/order.model";
import { carts } from "../models/carts.model";
import { products } from "../models/product.model";
import { productVariants } from "../models/productVariant.model";
import { cartItems } from "../models";
import { AuthRequest } from "../middleware/customerAuth";
import { AuthRequest as AdminAuthRequest } from "../middleware/auth";
import { getOrderConfirmationEmail } from "../utils/orderConfirmationTemplate";
import { sendEmail } from "../utils/emails";
import { websiteSettings } from "../models/websiteSettings.model";
import { generateUniqueOrderNumber } from "../utils/order-helper";
import z from "zod";


// --- Create Order (Online/User) ---
export const createOrder = async (req: AuthRequest, res: Response) => {
    try {
        const body = createOrderSchema.parse(req.body);
        const userId = req.customer?.id;

        // 1. Fetch Shipping Rates from Settings
        const [settings] = await db.select().from(websiteSettings).limit(1);
        const rateInside = Number(settings?.shippingInsideDhaka ?? 0);
        const rateOutside = Number(settings?.shippingOutsideDhaka ?? 0);

        // 2. Logic: Calculate shipping based on city
        const isDhaka = body.shippingAddress.city.trim().toLowerCase().includes("dhaka city");
        const shippingCost = isDhaka ? rateInside : rateOutside;

        const result = await db.transaction(async (tx) => {
            const userCartItems = await tx
                .select({
                    productId: cartItems.productId,
                    variantId: cartItems.variantId,
                    quantity: cartItems.quantity,
                    price: productVariants.price,
                    stock: productVariants.stock,
                    image: productVariants.images,
                    productName: products.title,
                    variantName: productVariants.title,
                    warranty: productVariants.warranty,
                })
                .from(cartItems)
                .innerJoin(productVariants, eq(cartItems.variantId, productVariants.id))
                .innerJoin(products, eq(cartItems.productId, products.id))
                .where(eq(cartItems.cartId, body.cartId));

            if (userCartItems.length === 0) throw new Error("Cart is empty");

            let subtotal = 0;
            for (const item of userCartItems) {
                if ((item.stock || 0) < item.quantity) throw new Error(`Out of stock: ${item.productName}`);
                subtotal += Number(item.price) * item.quantity;
            }

            // Apply Snapshots
            const discount = 0;
            const totalAmount = subtotal + shippingCost - discount;

            const [newOrder] = await tx.insert(orders).values({
                customerId: userId,
                orderNumber: await generateUniqueOrderNumber(tx),
                source: 'online',
                subtotal: subtotal.toString(),
                shippingCost: shippingCost.toString(), // Saved snapshot
                discount: discount.toString(),
                totalAmount: totalAmount.toString(),
                status: 'pending',
                paymentMethod: body.paymentMethod,
                paymentStatus: 'unpaid',
                contactInfo: body.contactInfo,
                shippingAddress: body.shippingAddress,
                orderNote: body.orderNote
            }).returning();

            await tx.insert(orderItems).values(
                userCartItems.map((item) => ({
                    orderId: newOrder.id,
                    productId: item.productId,
                    variantId: item.variantId,
                    name: `${item.productName} - ${item.variantName}`,
                    thumbnailAtPurchase: Array.isArray(item.image) ? item.image[0] : null,
                    quantity: item.quantity,
                    priceAtPurchase: item.price.toString(),
                    warranty: item.warranty,
                }))
            );

            // Deduct Stock & Close Cart
            for (const item of userCartItems) {
                await tx.update(productVariants)
                    .set({ stock: sql`${productVariants.stock} - ${item.quantity}` })
                    .where(eq(productVariants.id, item.variantId));
            }
            await tx.update(carts).set({ status: 'ordered' }).where(eq(carts.id, body.cartId));

            return { order: newOrder };
        });

        return res.status(201).json({ success: true, orderId: result.order.id });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// --- Create Admin Order (POS/Offline) ---
export const createAdminOrder = async (req: AdminAuthRequest, res: Response) => {
    try {
        const body = createAdminOrderSchema.parse(req.body);

        // 1. Fetch Shipping Rates from Settings
        const [settings] = await db.select().from(websiteSettings).limit(1);
        const rateInside = Number(settings?.shippingInsideDhaka ?? 60);
        const rateOutside = Number(settings?.shippingOutsideDhaka ?? 120);

        // 2. Logic: Determine shipping (Admin can override, but we default to settings)
        // If the admin didn't manually set a shipping cost, we calculate it automatically
        let finalShipping = body.shippingCost;
        if (body.shippingAddress?.city && (!body.shippingCost)) {
            const isDhaka = body.shippingAddress.city.trim().toLowerCase().includes("dhaka city");
            finalShipping = isDhaka ? rateInside : rateOutside;
        }

        const result = await db.transaction(async (tx) => {
            let subtotal = 0;
            const finalizedItems = [];

            for (const item of body.items) {
                if (item.variantId) {
                    const [variant] = await tx
                        .select({ price: productVariants.price, stock: productVariants.stock })
                        .from(productVariants)
                        .where(eq(productVariants.id, item.variantId));

                    if (!variant) throw new Error(`Variant not found`);
                    if (variant.stock < item.quantity) throw new Error(`Out of stock for ${item.name}`);

                    subtotal += Number(variant.price) * item.quantity;
                    finalizedItems.push({ ...item, priceAtPurchase: variant.price });

                    await tx.update(productVariants)
                        .set({ stock: sql`${productVariants.stock} - ${item.quantity}` })
                        .where(eq(productVariants.id, item.variantId));
                } else {
                    subtotal += (item.priceAtPurchase || 0) * item.quantity;
                    finalizedItems.push(item);
                }
            }

            const totalAmount = subtotal + finalShipping - (body.discount || 0);

            const [newOrder] = await tx.insert(orders).values({
                orderNumber: await generateUniqueOrderNumber(tx),
                source: body.source || 'offline',
                servedBy: body.servedBy || "Admin",
                customerId: body.customerId,
                subtotal: subtotal.toString(),
                shippingCost: finalShipping.toString(),
                discount: (body.discount || 0).toString(),
                totalAmount: totalAmount.toString(),
                status: body.status || 'delivered',
                paymentStatus: body.paymentStatus || 'paid',
                paymentMethod: body.paymentMethod,
                contactInfo: body.contactInfo,
                shippingAddress: body.shippingAddress,
            }).returning();

            await tx.insert(orderItems).values(
                finalizedItems.map(item => ({
                    orderId: newOrder.id,
                    productId: item.productId,
                    variantId: item.variantId,
                    name: item.name,
                    sku: item.sku,
                    imei: item.imei,
                    warranty: item.warranty,
                    quantity: item.quantity,
                    priceAtPurchase: item.priceAtPurchase.toString(),
                    thumbnailAtPurchase: item.thumbnailAtPurchase
                }))
            );

            return newOrder;
        });

        return res.status(201).json({ success: true, order: result });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// --- GET: Single Order ---
export const getOrder = async (req: Request, res: Response) => {
    try {
        const order = await db.query.orders.findFirst({
            where: eq(orders.id, req.params.id),
            with: { items: true },
        });
        if (!order) return res.status(404).json({ message: "Order not found" });
        return res.json(order);
    } catch (error) {
        res.status(500).json({ message: "Error fetching order", error });
    }
};

// --- GET: All Orders (Admin) ---
export const getAllOrders = async (req: AdminAuthRequest, res: Response) => {
    try {
        const allOrders = await db.select().from(orders).orderBy(sql`${orders.createdAt} DESC`);
        res.json(allOrders);
    } catch (error) {
        res.status(500).json({ message: "Error fetching orders", error });
    }
};

// --- UPDATE: Order Status ---
export const updateOrderStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        await db.transaction(async (tx) => {
            const order = await tx.query.orders.findFirst({
                where: eq(orders.id, id),
                with: { items: true }
            });

            if (!order) throw new Error("Order not found");
            if (order.status === 'cancelled') throw new Error("Order is already cancelled");

            await tx.update(orders).set({ status }).where(eq(orders.id, id));

            if (status === 'cancelled') {
                for (const item of order.items) {
                    if (!item.variantId) continue;
                    await tx.update(productVariants)
                        .set({ stock: sql`${productVariants.stock} + ${item.quantity}` })
                        .where(eq(productVariants.id, item.variantId));
                }
            }
        });

        res.json({ success: true, message: `Order updated to ${status}` });
    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
};


// GET: User Specific Order List (Restored & Updated)
export const getUserOrders = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.customer?.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized. Please log in."
            });
        }

        const userOrders = await db.query.orders.findMany({
            where: eq(orders.customerId, userId),
            with: {
                items: true, // Includes the snapshot items and thumbnails
            },
            orderBy: (orders, { desc }) => [desc(orders.createdAt)],
        });

        return res.json({
            success: true,
            data: userOrders
        });

    } catch (error) {
        console.error("Error fetching user orders:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch orders"
        });
    }
};