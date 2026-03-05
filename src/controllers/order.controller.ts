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

        const [settings] = await db.select().from(websiteSettings).limit(1);
        const rateInside = settings?.shippingInsideDhaka ?? 60;
        const rateOutside = settings?.shippingOutsideDhaka ?? 120;

        // Determine Shipping Cost using city/district
        const isDhaka = body.shippingAddress.city.trim().toLowerCase().includes("dhaka");
        const shippingCost = isDhaka ? rateInside : rateOutside;

        const result = await db.transaction(async (tx) => {
            const orderNumber = await generateUniqueOrderNumber(tx);

            const userCartItems = await tx
                .select({
                    productId: cartItems.productId,
                    variantId: cartItems.variantId,
                    quantity: cartItems.quantity,
                    price: productVariants.price,
                    stock: productVariants.stock,
                    image: productVariants.images, // Array of strings
                    productName: products.title,
                    variantName: productVariants.title
                })
                .from(cartItems)
                .innerJoin(productVariants, eq(cartItems.variantId, productVariants.id))
                .innerJoin(products, eq(cartItems.productId, products.id))
                .where(eq(cartItems.cartId, body.cartId));

            if (userCartItems.length === 0) throw new Error("Cart is empty");

            let subtotal = 0;
            for (const item of userCartItems) {
                if ((item.stock || 0) < item.quantity) {
                    throw new Error(`Out of stock: ${item.productName}`);
                }
                subtotal += Number(item.price) * item.quantity;
            }

            const totalAmount = subtotal + shippingCost;

            // Create Order with separated contactInfo and shippingAddress
            const [newOrder] = await tx
                .insert(orders)
                .values({
                    customerId: userId,
                    orderNumber: orderNumber,
                    source: 'online',
                    totalAmount: totalAmount.toString(),
                    status: 'pending',
                    paymentMethod: body.paymentMethod,
                    paymentStatus: 'unpaid',
                    contactInfo: body.contactInfo, // Name, Phone, Email
                    shippingAddress: body.shippingAddress, // Division, City, Area, Street, Postal
                    orderNote: body.orderNote
                })
                .returning();

            // Snapshot Items with Thumbnail
            await tx.insert(orderItems).values(
                userCartItems.map((item) => ({
                    orderId: newOrder.id,
                    productId: item.productId,
                    variantId: item.variantId,
                    name: `${item.productName} - ${item.variantName}`,
                    thumbnailAtPurchase: Array.isArray(item.image) ? item.image[0] : null,
                    quantity: item.quantity,
                    priceAtPurchase: item.price.toString(),
                }))
            );

            // Deduct Stock
            for (const item of userCartItems) {
                await tx.update(productVariants)
                    .set({ stock: sql`${productVariants.stock} - ${item.quantity}` })
                    .where(eq(productVariants.id, item.variantId));
            }

            // Close Cart
            await tx.update(carts).set({ status: 'ordered' }).where(eq(carts.id, body.cartId));

            return { order: newOrder, items: userCartItems, subtotal, shippingCost };
        });

        // Send Confirmation Email
        const emailHtml = getOrderConfirmationEmail({
            id: result.order.id,
            orderNumber: result.order.orderNumber,
            subtotal: result.subtotal,
            shippingCost: result.shippingCost,
            total: Number(result.order.totalAmount),
            customerName: body.contactInfo.fullName,
            address: `${body.shippingAddress.street}, ${body.shippingAddress.area}, ${body.shippingAddress.city} - ${body.shippingAddress.postalCode}`,
            phone: body.contactInfo.phone,
            items: result.items.map(item => ({
                name: item.productName,
                variantName: item.variantName,
                quantity: item.quantity,
                price: item.price,
                image: Array.isArray(item.image) ? item.image[0] : item.image
            }))
        });

        if (body.contactInfo.email) {
            sendEmail(body.contactInfo.email, `Order Confirmation #${result.order.orderNumber}`, emailHtml);
        }

        return res.status(201).json({
            success: true,
            orderId: result.order.id,
            orderNumber: result.order.orderNumber
        });

    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ success: false, message: error.issues.map(e => e.message).join(", ") });
        }
        res.status(400).json({ success: false, message: error.message || "Order failed" });
    }
};

// --- Create Admin Order (Outlet/POS) ---
export const createAdminOrder = async (req: AdminAuthRequest, res: Response) => {
    try {
        const body = createAdminOrderSchema.parse(req.body);

        const result = await db.transaction(async (tx) => {
            // 1. Separate DB items from Custom items
            const dbItems = body.items.filter(i => i.variantId);
            const customItems = body.items.filter(i => !i.variantId);

            let subtotal = 0;
            const orderItemsData = [];

            // 2. Process DB Items (Validate Stock & Fetch Details)
            if (dbItems.length > 0) {
                const variantIds = dbItems.map(i => i.variantId as string);
                const productsData = await tx
                    .select({
                        productId: products.id,
                        variantId: productVariants.id,
                        price: productVariants.price,
                        stock: productVariants.stock,
                        image: productVariants.images,
                        productName: products.title,
                        variantName: productVariants.title
                    })
                    .from(productVariants)
                    .innerJoin(products, eq(productVariants.productId, products.id))
                    .where(inArray(productVariants.id, variantIds));

                for (const reqItem of dbItems) {
                    const product = productsData.find(p => p.variantId === reqItem.variantId);
                    if (!product) throw new Error(`Product not found: ${reqItem.variantId}`);

                    // Logic check: Only deduct stock if it's a real DB product
                    if ((product.stock || 0) < reqItem.quantity) {
                        throw new Error(`Stock out: ${product.productName}`);
                    }

                    subtotal += Number(product.price) * reqItem.quantity;
                    orderItemsData.push({
                        variantId: product.variantId,
                        productId: product.productId,
                        name: `${product.productName} - ${product.variantName}`,
                        thumbnailAtPurchase: Array.isArray(product.image) ? product.image[0] : null,
                        quantity: reqItem.quantity,
                        priceAtPurchase: product.price.toString()
                    });
                }
            }

            // 3. Process Custom Items (No DB lookup, use user-provided info)
            for (const custom of customItems) {
                subtotal += (custom.priceAtPurchase || 0) * custom.quantity;
                orderItemsData.push({
                    variantId: null, // Critical: No reference
                    productId: null,
                    name: custom.name, // The manually typed name from POS
                    thumbnailAtPurchase: custom.thumbnailAtPurchase || null,
                    quantity: custom.quantity,
                    priceAtPurchase: (custom.priceAtPurchase || 0).toString()
                });
            }

            // 4. Create the Order
            const finalTotal = subtotal - (body.discount || 0);
            const orderNumber = await generateUniqueOrderNumber(tx);

            const [newOrder] = await tx.insert(orders).values({
                orderNumber: orderNumber,
                source: body.source || 'offline',
                customerId: body.customerId || null,
                contactInfo: body.contactInfo,
                shippingAddress: body.shippingAddress || null,
                totalAmount: finalTotal.toString(),
                status: body.status || 'delivered',
                paymentStatus: body.paymentStatus || 'paid',
                paymentMethod: body.paymentMethod,
            }).returning();

            // 5. Insert Snapshot Items
            await tx.insert(orderItems).values(
                orderItemsData.map(item => ({ ...item, orderId: newOrder.id }))
            );

            // 6. Deduct Stock ONLY for DB items
            for (const item of dbItems) {
                await tx.update(productVariants)
                    .set({ stock: sql`${productVariants.stock} - ${item.quantity}` })
                    .where(eq(productVariants.id, item.variantId!));
            }

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