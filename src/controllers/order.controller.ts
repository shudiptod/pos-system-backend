import { Request, Response } from "express";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { orders, orderItems, createOrderSchema, orderStatusEnum } from "../models/order.model";
import { carts } from "../models/carts.model";
import { products } from "../models/product.model";
import { productVariants } from "../models/productVariant.model";
import { cartItems } from "../models";
import { AuthRequest } from "../middleware/customerAuth";
import { AuthRequest as AdminAuthRequest } from "../middleware/auth";
import { getOrderConfirmationEmail } from "../utils/orderConfirmationTemplate";
import { sendEmail } from "../utils/emails";
import { websiteSettings } from "../models/websiteSettings.model";
import z from "zod";
import { createAdminOrderSchema } from "../models/order.model";
import { generateUniqueOrderNumber } from "../utils/order-helper";

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

// get all orders from db

export const getAllOrders = async (req: AdminAuthRequest, res: Response) => {
    try {

        const user = req.user;
        if (!user) return res.status(401).json({ message: "Unauthorized" });

        const allOrders = await db.select().from(orders);
        res.json(allOrders);
    } catch (error) {
        res.status(500).json({ message: "Error fetching orders", error });
    }
}

export const createOrder = async (req: AuthRequest, res: Response) => {
    try {
        // 1. Validate Input
        const body = createOrderSchema.parse(req.body);
        const userId = req.customer?.id;

        // 2. Fetch Global Settings
        const [settings] = await db.select().from(websiteSettings).limit(1);
        const rateInside = settings?.shippingInsideDhaka ?? 60;
        const rateOutside = settings?.shippingOutsideDhaka ?? 120;

        // 3. Determine Shipping Cost
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
                    image: productVariants.images,
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

            // C. Validation & Subtotal
            let subtotal = 0;

            for (const item of userCartItems) {
                if ((item.stock || 0) < item.quantity) {
                    throw new Error(`Out of stock: ${item.productName} (${item.variantName})`);
                }
                subtotal += Number(item.price) * item.quantity;
            }

            // D. Total Calculation
            const totalAmount = subtotal + shippingCost;

            // ==========================================
            // E. Create Order (NOW WITH ORDER NUMBER)
            // ==========================================
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
                    shippingAddress: body.shippingAddress,
                    billingAddress: body.billingAddress || body.shippingAddress,
                })
                .returning();

            // F. Snapshot Items
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

            // G. Deduct Stock
            for (const item of userCartItems) {
                await tx
                    .update(productVariants)
                    .set({
                        stock: sql`${productVariants.stock} - ${item.quantity}`
                    })
                    .where(eq(productVariants.id, item.variantId));
            }

            // H. Close Cart
            await tx
                .update(carts)
                .set({ status: 'ordered' })
                .where(eq(carts.id, body.cartId));

            return { order: newOrder, items: userCartItems, subtotal, shippingCost };
        });

        // 4. Send Email
        // Pass the readable Order Number to the email template
        const emailHtml = getOrderConfirmationEmail({
            id: result.order.orderNumber, // <--- Use readable ID for the email
            orderNumber: result.order.orderNumber,
            subtotal: result.subtotal,
            shippingCost: result.shippingCost,
            total: Number(result.order.totalAmount),
            customerName: body.shippingAddress.fullName,
            address: `${body.shippingAddress.street}, ${body.shippingAddress.city}`,
            phone: body.shippingAddress.phone,
            items: result.items.map(item => ({
                name: item.productName,
                variantName: item.variantName,
                quantity: item.quantity,
                price: item.price,
                image: Array.isArray(item.image) ? item.image[0] : item.image
            }))
        });

        if (body.shippingAddress.email) {
            sendEmail(body.shippingAddress.email, `Order Confirmation #${result.order.orderNumber}`, emailHtml);
        }

        return res.status(201).json({
            success: true,
            message: "Order placed successfully",
            orderId: result.order.id,          // Database UUID (for API calls)
            orderNumber: result.order.orderNumber // Human ID (for display)
        });

    } catch (error: any) {
        console.error("Create Order Error:", error);

        if (error instanceof z.ZodError) {
            const validationMessage = error.issues.map((e) => e.message).join(", ");
            return res.status(400).json({ success: false, message: validationMessage });
        }

        return res.status(400).json({
            success: false,
            message: error.message || "Order failed"
        });
    }
};

export const updateOrderStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        // 1. Validate Input Status
        const validStatuses = orderStatusEnum.enumValues;
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                message: `Invalid status. Allowed: ${validStatuses.join(", ")}`
            });
        }

        await db.transaction(async (tx) => {
            // 2. Fetch Order with Items
            const order = await tx.query.orders.findFirst({
                where: eq(orders.id, id),
                with: { items: true }
            });

            if (!order) throw new Error("Order not found");

            // 3. Status Transition Checks
            const currentStatus = order.status;
            const newStatus = status;

            // No-op if status is same
            if (currentStatus === newStatus) {
                return;
            }

            // Guard: Cannot edit a Cancelled order (unless you implement complex re-stocking logic)
            if (currentStatus === 'cancelled') {
                throw new Error("Cannot update a cancelled order. Please create a new order.");
            }

            // Guard: Cannot cancel if already Shipped/Delivered
            if (newStatus === 'cancelled' && (currentStatus === 'shipped' || currentStatus === 'delivered')) {
                throw new Error("Cannot cancel an order that has already been shipped or delivered.");
            }

            // 4. Update the Status
            await tx.update(orders)
                .set({ status: newStatus })
                .where(eq(orders.id, id));

            // 5. CONDITIONAL LOGIC: Handle Restocking if Cancelling
            if (newStatus === 'cancelled') {
                for (const item of order.items) {
                    // Safety check: If variant was deleted from DB (null), skip
                    if (!item.variantId) continue;

                    await tx.update(productVariants)
                        .set({
                            // RESTOCK: Add quantity back to inventory
                            stock: sql`${productVariants.stock} + ${item.quantity}`
                        })
                        .where(eq(productVariants.id, item.variantId));
                }
            }
        });

        return res.json({
            success: true,
            message: `Order status updated to ${status}` + (status === 'cancelled' ? " and inventory restocked." : ".")
        });

    } catch (error: any) {
        return res.status(400).json({
            success: false,
            message: error.message || "Failed to update order status"
        });
    }
};


// GET: User Specific Order List
export const getUserOrders = async (req: AuthRequest, res: Response) => {
    try {
        // 1. Get the logged-in user's ID
        const userId = req.customer?.id;

        console.log(userId);
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized. Please log in." });
        }

        // 2. Fetch orders with relations
        const userOrders = await db.query.orders.findMany({
            where: eq(orders.customerId, userId),
            // Include the items relation to show what was bought
            with: {
                items: true,
            },
            // Sort by newest first
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






export const createAdminOrder = async (req: AdminAuthRequest, res: Response) => {
    try {
        // 1. Validate Input
        const body = createAdminOrderSchema.parse(req.body);

        const result = await db.transaction(async (tx) => {

            // A. Fetch Product Details for the requested items
            // We need prices and stock validation
            const variantIds = body.items.map(i => i.variantId);

            const productsData = await tx
                .select({
                    productId: products.id,
                    variantId: productVariants.id,
                    price: productVariants.price,
                    stock: productVariants.stock,
                    productName: products.title,
                    variantName: productVariants.title
                })
                .from(productVariants)
                .innerJoin(products, eq(productVariants.productId, products.id))
                .where(inArray(productVariants.id, variantIds));

            // B. Calculate Totals & Validate Stock
            let subtotal = 0;
            const orderItemsData = [];

            for (const reqItem of body.items) {
                const product = productsData.find(p => p.variantId === reqItem.variantId);

                if (!product) throw new Error(`Invalid Product Variant ID: ${reqItem.variantId}`);

                if ((product.stock || 0) < reqItem.quantity) {
                    throw new Error(`Insufficient stock for ${product.productName}`);
                }

                const lineTotal = Number(product.price) * reqItem.quantity;
                subtotal += lineTotal;

                // Prepare Item Payload
                orderItemsData.push({
                    variantId: product.variantId,
                    productId: product.productId, // You might need to select this above if your schema needs it
                    name: `${product.productName} - ${product.variantName}`,
                    quantity: reqItem.quantity,
                    priceAtPurchase: product.price.toString()
                });
            }

            // Apply manual discount if any
            const finalTotal = subtotal - (body.discount || 0);

            // C. Generate Order Number
            const orderNumber = await generateUniqueOrderNumber(tx);

            // D. Create Order Record
            const [newOrder] = await tx.insert(orders).values({
                orderNumber: orderNumber,
                source: 'offline', // <--- MARK AS OFFLINE
                customerId: body.customerId || null, // Nullable

                // For offline, we might construct a dummy address or leave null
                shippingAddress: body.customerDetails ? {
                    fullName: body.customerDetails.name || "Walk-in Customer",
                    phone: body.customerDetails.phone || "",
                    street: "Counter Sale",
                    city: "Dhaka"
                } : null,

                totalAmount: finalTotal.toString(),
                status: body.status,        // e.g., 'delivered'
                paymentStatus: body.paymentStatus, // e.g., 'paid'
                paymentMethod: body.paymentMethod,

                createdAt: new Date(),
            }).returning();

            // E. Insert Order Items
            await tx.insert(orderItems).values(
                orderItemsData.map(item => ({
                    ...item,
                    orderId: newOrder.id
                }))
            );

            // F. Deduct Stock
            for (const item of body.items) {
                await tx
                    .update(productVariants)
                    .set({
                        stock: sql`${productVariants.stock} - ${item.quantity}`
                    })
                    .where(eq(productVariants.id, item.variantId));
            }

            return newOrder;
        });

        return res.status(201).json({
            success: true,
            message: "Offline order created successfully",
            order: result
        });

    } catch (error: any) {
        return res.status(400).json({ success: false, message: error.message });
    }
};