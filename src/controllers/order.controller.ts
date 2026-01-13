import { Request, Response } from "express";
import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { orders, orderItems, createOrderSchema } from "../models/order.model";
import { carts } from "../models/carts.model";
import { products } from "../models/product.model";
import { productVariants } from "../models/productVariant.model";
import { cartItems } from "../models";
import { AuthRequest } from "../middleware/customerAuth";
import { AuthRequest as AdminAuthRequest } from "../middleware/auth";
import { getOrderConfirmationEmail } from "../utils/orderConfirmationTemplate";
import { sendEmail } from "../utils/emails";
import { websiteSettings } from "../models/websiteSettings.model";

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

// POST: Place Order (The Complex One)
export const createOrder = async (req: AuthRequest, res: Response) => {
    try {
        // 1. Validate Input
        const body = createOrderSchema.parse(req.body);
        const userId = req.customer?.id;

        // 2. Fetch Global Settings (for Shipping Rates)
        const [settings] = await db.select().from(websiteSettings).limit(1);

        // Default fallbacks if settings table is empty
        const rateInside = settings?.shippingInsideDhaka ?? 60;
        const rateOutside = settings?.shippingOutsideDhaka ?? 120;

        // 3. Determine Shipping Cost
        // Simple logic: If city is "Dhaka", use inside rate.
        const isDhaka = body.shippingAddress.city.trim().toLowerCase().includes("dhaka");
        const shippingCost = isDhaka ? rateInside : rateOutside;

        const result = await db.transaction(async (tx) => {
            // A. Fetch Cart & Product Details (Live Price/Stock)
            const userCartItems = await tx
                .select({
                    productId: cartItems.productId,
                    variantId: cartItems.variantId,
                    quantity: cartItems.quantity,
                    price: productVariants.price,
                    stock: productVariants.stock,
                    // Fetch images for the email
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

            // B. Validation & Subtotal Calculation
            let subtotal = 0;

            for (const item of userCartItems) {
                if ((item.stock || 0) < item.quantity) {
                    throw new Error(`Out of stock: ${item.productName} (${item.variantName})`);
                }
                subtotal += Number(item.price) * item.quantity;
            }

            // C. Final Total Calculation
            const totalAmount = subtotal + shippingCost;

            // D. Create Order
            const [newOrder] = await tx
                .insert(orders)
                .values({
                    customerId: userId,
                    totalAmount: totalAmount.toString(), // Grand Total
                    status: 'pending',
                    paymentMethod: body.paymentMethod,
                    paymentStatus: 'unpaid',
                    shippingAddress: body.shippingAddress,
                    billingAddress: body.billingAddress || body.shippingAddress,
                    // If you added a shippingCost column to orders, add it here:
                    // shippingCost: shippingCost.toString() 
                })
                .returning();

            // E. Snapshot Items
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

            // F. Deduct Stock
            for (const item of userCartItems) {
                await tx
                    .update(productVariants)
                    .set({
                        stock: sql`${productVariants.stock} - ${item.quantity}`
                    })
                    .where(eq(productVariants.id, item.variantId));
            }

            // G. Close Cart
            await tx
                .update(carts)
                .set({ status: 'ordered' })
                .where(eq(carts.id, body.cartId));

            // Return necessary data for the email
            return { order: newOrder, items: userCartItems, subtotal, shippingCost };
        });

        // 4. Send Confirmation Email (Async - don't block response)
        const emailHtml = getOrderConfirmationEmail({
            id: result.order.id,
            subtotal: result.subtotal,
            shippingCost: result.shippingCost,
            total: Number(result.order.totalAmount),
            customerName: body.shippingAddress.fullName,
            address: `${body.shippingAddress.street}, ${body.shippingAddress.city}`,
            phone: body.shippingAddress.phone,
            // Map the DB items to the format the email template expects
            items: result.items.map(item => ({
                name: item.productName,
                variantName: item.variantName,
                quantity: item.quantity,
                price: item.price,
                // Ensure image is a string (DB might store array or JSON)
                image: Array.isArray(item.image) ? item.image[0] : item.image
            }))
        });

        if (req.customer?.email) {
            sendEmail(req.customer.email, "Order Confirmation - Gajitto", emailHtml);
        }

        return res.status(201).json({
            success: true,
            message: "Order placed successfully",
            orderId: result.order.id
        });

    } catch (error: any) {
        console.error("Create Order Error:", error);
        return res.status(400).json({
            success: false,
            message: error.message || "Order failed"
        });
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