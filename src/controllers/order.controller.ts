
import { Request, Response } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db } from "../db";
import { orders, orderItems, createOrderSchema, createAdminOrderSchema } from "../models/order.model";
import { carts } from "../models/carts.model";
 import { cartItems } from "../models";
import { products } from "../models/product.model";
import { websiteSettings } from "../models/websiteSettings.model";
import { generateUniqueOrderNumber } from "../utils/order-helper";
import { AuthRequest } from "../middleware/customerAuth";
import { AuthRequest as AdminAuthRequest } from "../middleware/auth";
// @ts-ignore - Bypassing missing types for old SSL Commerz library
const SSLCommerzPayment = require("sslcommerz-lts");
import { sendOrderConfirmationEmail } from "../utils/sendEmail"; // 👈 Import Resend


// --- 1. Create Order (Updated for SSL Commerz) ---
export const createOrder = async (req: AuthRequest, res: Response) => {
    try {
        const body = createOrderSchema.parse(req.body);
        const userId = req.customer?.id;
        
        // Generate a unique transaction ID for SSL Commerz tracking
        const tran_id = `REF_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

        const [settings] = await db.select().from(websiteSettings).limit(1);
        const rateInside = Number(settings?.shippingInsideDhaka ?? 60);
        const rateOutside = Number(settings?.shippingOutsideDhaka ?? 120);

        const isDhaka = body.shippingAddress.district.trim().toLowerCase().includes("dhaka");
        const shippingCost = isDhaka ? rateInside : rateOutside;

        const result = await db.transaction(async (tx) => {
            const userCartItems = await tx
                .select({
                    productId: cartItems.productId,
                    quantity: cartItems.quantity,
                    price: products.price,
                    discountStatus: products.discountStatus,
                    discountType: products.discountType,
                    discountValue: products.discountValue,
                    stock: products.stock,
                    image: products.images,
                    productName: products.title,
                })
                .from(cartItems)
                .innerJoin(products, eq(cartItems.productId, products.id))
                .where(and(eq(cartItems.cartId, body.cartId), eq(cartItems.isDeleted, false)));

            if (userCartItems.length === 0) throw new Error("Cart is empty or items are unavailable");

            let subtotal = 0;
            const finalizedItems = [];

            for (const item of userCartItems) {
                if ((item.stock || 0) < item.quantity) throw new Error(`Out of stock: ${item.productName}`);

                const basePrice = Number(item.price);
                const discValue = Number(item.discountValue || 0);
                let salePrice = basePrice;

                if (item.discountStatus && discValue > 0) {
                    salePrice = item.discountType === "PERCENTAGE" ? basePrice * (1 - discValue / 100) : basePrice - discValue;
                }

                const finalPrice = Math.round(salePrice);
                subtotal += finalPrice * item.quantity;

                finalizedItems.push({
                    productId: item.productId,
                    name: item.productName,
                    quantity: item.quantity,
                    priceAtPurchase: finalPrice.toString(),
                    thumbnailAtPurchase: Array.isArray(item.image) ? item.image[0] : null,
                });
            }

            const discount = 0; 
            const totalAmount = subtotal + shippingCost - discount;

            // INSERT ORDER
            const [newOrder] = await tx
                .insert(orders)
                .values({
                    customerId: userId,
                    orderNumber: await generateUniqueOrderNumber(tx),
                    source: "online",
                    subtotal: subtotal.toString(),
                    shippingCost: shippingCost.toString(),
                    discount: discount.toString(),
                    totalAmount: totalAmount.toString(),
                    status: "pending",
                    paymentMethod: body.paymentMethod,
                    paymentStatus: "unpaid",
                    contactInfo: body.contactInfo,
                    district: body.shippingAddress.district,
                    address: body.shippingAddress.address,
                    orderNote: body.orderNote,
                    transactionId: tran_id, // 👈 Store the Transaction ID
                })
                .returning();

            await tx.insert(orderItems).values(
                finalizedItems.map((item) => ({
                    orderId: newOrder.id,
                    ...item,
                })),
            );

            // Deduct Stock & Close Cart
            for (const item of userCartItems) {
                await tx.update(products).set({ stock: sql`${products.stock} - ${item.quantity}` }).where(eq(products.id, item.productId));
            }
            await tx.update(carts).set({ status: "ordered" }).where(eq(carts.id, body.cartId));

            return { order: newOrder };
        });

        const orderData = result.order;
        // @ts-ignore - Assuming email exists on contactInfo schema
        const customerEmail = body.contactInfo.email || ""; 

        // --- Handle Cash on Delivery ---
        if (body.paymentMethod === "cod") {
            await sendOrderConfirmationEmail(customerEmail, body.contactInfo.fullName, orderData.orderNumber || "", orderData.totalAmount, "cod");
            return res.status(201).json({ success: true, orderId: orderData.id });
        }
		

        // --- Handle SSL Commerz (Online) ---
        if (body.paymentMethod === "online") {
           const sslcommerzData = {
            total_amount: Number(orderData.totalAmount),
            currency: "BDT",
            tran_id: tran_id,
            success_url: `${process.env.BACKEND_URL}/api/orders/ssl-success/${tran_id}`,
            fail_url: `${process.env.BACKEND_URL}/api/orders/ssl-fail/${tran_id}`,
            cancel_url: `${process.env.BACKEND_URL}/api/orders/ssl-cancel/${tran_id}`,
            ipn_url: `${process.env.BACKEND_URL}/api/orders/ssl-ipn`,
            shipping_method: "Courier",
            product_name: "E-Commerce Items",
            product_category: "General",
            product_profile: "general",
            
            // Customer Details
            cus_name: body.contactInfo.fullName,
            cus_email: customerEmail || "no-email@example.com",
            cus_phone: body.contactInfo.phone,
            cus_add1: body.shippingAddress.address,
            cus_city: body.shippingAddress.district,
            cus_country: "Bangladesh",
            
            // 👇 ADDED THESE: Required Shipping Details 👇
            ship_name: body.contactInfo.fullName,
            ship_add1: body.shippingAddress.address,
            ship_city: body.shippingAddress.district,
            ship_state: body.shippingAddress.district,
            ship_postcode: "1000", // Fallback postcode
            ship_country: "Bangladesh",
        };

            const sslcz = new SSLCommerzPayment(
                process.env.STORE_ID as string, 
                process.env.STORE_PASSWORD as string, 
                process.env.IS_LIVE === "true"
            );
            
            sslcz.init(sslcommerzData).then((apiResponse: any) => {
                if (apiResponse?.GatewayPageURL) {
                    return res.status(200).json({ success: true, paymentUrl: apiResponse.GatewayPageURL });
                } else {
					console.error("SSL COMMERZ REJECTION REASON:", apiResponse);
                    return res.status(400).json({ success: false, message: "Failed to generate SSL Commerz URL" });
                }
            });
        }

    } catch (error: any) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// --- 2. SSL Webhook: Success ---
export const paymentSuccess = async (req: Request, res: Response) => {
    try {
        const { tran_id } = req.params;

        // Update Order Status to Paid
        const [updatedOrder] = await db.update(orders)
            .set({ paymentStatus: "paid", status: "processing" })
            .where(eq(orders.transactionId, tran_id))
            .returning();

        if (updatedOrder) {
            // Send Email dynamically using the jsonb contact info
            const contactInfo = updatedOrder.contactInfo as any;
            if (contactInfo?.email) {
                await sendOrderConfirmationEmail(contactInfo.email, contactInfo.fullName, updatedOrder.orderNumber || "", updatedOrder.totalAmount, "online");
            }
        }

        // Redirect user back to Next.js Frontend
        res.redirect(`${process.env.FRONTEND_URL}/order-success?id=${updatedOrder.id}`);
    } catch (error) {
        console.error("Payment Success Error:", error);
        res.redirect(`${process.env.FRONTEND_URL}/cart?error=payment_processing_failed`);
    }
};

// --- 3. SSL Webhook: Fail / Cancel ---
export const paymentFail = async (req: Request, res: Response) => {
    try {
        const { tran_id } = req.params;
        
        // Mark payment as failed, order as cancelled
        await db.update(orders)
            .set({ paymentStatus: "failed", status: "cancelled" })
            .where(eq(orders.transactionId, tran_id));
        
        // Redirect to frontend cart page with error param
        res.redirect(`${process.env.FRONTEND_URL}/cart?error=payment_failed`);
    } catch (error) {
        res.redirect(`${process.env.FRONTEND_URL}/cart`);
    }
};

// --- SSL Webhook: Background IPN ---
export const paymentIpn = async (req: Request, res: Response) => {
    try {
        // SSL Commerz sends data in the body for IPN requests, not the URL
        const { tran_id, status } = req.body;
        console.log(`📡 IPN Webhook received for Transaction: ${tran_id} | Status: ${status}`);

        // Only update if the payment was actually successful
        if (status === 'VALID' || status === 'VALIDATED') {
            await db.update(orders)
                .set({ paymentStatus: "paid", status: "processing" })
                .where(eq(orders.transactionId, tran_id));
                
            console.log(`✅ IPN: Database updated to 'paid' for ${tran_id}`);
        }

        // IMPORTANT: Never use res.redirect() in an IPN. Just return a 200 status.
        return res.status(200).json({ message: "IPN received successfully" });

    } catch (error) {
        console.error("❌ IPN Crash Error:", error);
        return res.status(500).json({ message: "Server error processing IPN" });
    }
};



// --- Create Admin Order (POS/Offline) ---
export const createAdminOrder = async (req: AdminAuthRequest, res: Response) => {
	try {
		const body = createAdminOrderSchema.parse(req.body);

		let finalShipping = body.shippingCost;

		const result = await db.transaction(async (tx) => {
			let subtotal = 0;
			const finalizedItems = [];

			for (const item of body.items) {
				if (item.productId) {
					const [product] = await tx
						.select({
							price: products.price,
							stock: products.stock,
							discountStatus: products.discountStatus,
							discountType: products.discountType,
							discountValue: products.discountValue,
						})
						.from(products)
						.where(eq(products.id, item.productId));

					if (!product) throw new Error(`Product not found`);
					if (product.stock < item.quantity) throw new Error(`Out of stock for ${item.name}`);

					// Calculate actual price with discounts
					const basePrice = Number(product.price);
					const discValue = Number(product.discountValue || 0);
					let salePrice = basePrice;

					if (product.discountStatus && discValue > 0) {
						salePrice =
							product.discountType === "PERCENTAGE"
								? basePrice * (1 - discValue / 100)
								: basePrice - discValue;
					}

					const finalPrice = Math.round(salePrice);
					subtotal += finalPrice * item.quantity;

					finalizedItems.push({ ...item, priceAtPurchase: finalPrice.toString() });

					// Deduct stock directly from products
					await tx
						.update(products)
						.set({ stock: sql`${products.stock} - ${item.quantity}` })
						.where(eq(products.id, item.productId));
				} else {
					// Custom product not in DB
					subtotal += (item.priceAtPurchase || 0) * item.quantity;
					finalizedItems.push(item);
				}
			}

			const totalAmount = subtotal + finalShipping - (body.discount || 0);

			const [newOrder] = await tx
				.insert(orders)
				.values({
					orderNumber: await generateUniqueOrderNumber(tx),
					source: body.source || "offline",
					servedBy: body.servedBy || "Admin",
					customerId: body.customerId,
					subtotal: subtotal.toString(),
					shippingCost: finalShipping.toString(),
					discount: (body.discount || 0).toString(),
					totalAmount: totalAmount.toString(),
					status: body.status || "delivered",
					paymentStatus: body.paymentStatus || "paid",
					paymentMethod: body.paymentMethod,
					contactInfo: body.contactInfo,
					// Handle partial/optional address from admin
					district: body.shippingAddress?.district || "N/A",
					address: body.shippingAddress?.address || "POS Sale",
				})
				.returning();

			await tx.insert(orderItems).values(
				finalizedItems.map((item) => ({
					orderId: newOrder.id,
					productId: item.productId,
					name: item.name,
					sku: item.sku,
					quantity: item.quantity,
					priceAtPurchase: item.priceAtPurchase.toString(),
					thumbnailAtPurchase: item.thumbnailAtPurchase,
				})),
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
			where: and(eq(orders.id, req.params.id), eq(orders.isDeleted, false)),
			with: {
				items: {
					where: eq(orderItems.isDeleted, false),
				},
			},
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
		const allOrders = await db
			.select()
			.from(orders)
			.where(eq(orders.isDeleted, false))
			.orderBy(sql`${orders.createdAt} DESC`);
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
				where: and(eq(orders.id, id), eq(orders.isDeleted, false)),
				with: { items: true },
			});

			if (!order) throw new Error("Order not found");
			if (order.status === "cancelled") throw new Error("Order is already cancelled");

			await tx.update(orders).set({ status }).where(eq(orders.id, id));

			// Restore stock if cancelled
			if (status === "cancelled") {
				for (const item of order.items) {
					if (!item.productId) continue;
					await tx
						.update(products)
						.set({ stock: sql`${products.stock} + ${item.quantity}` })
						.where(eq(products.id, item.productId));
				}
			}
		});

		res.json({ success: true, message: `Order updated to ${status}` });
	} catch (error: any) {
		res.status(400).json({ success: false, message: error.message });
	}
};

// GET: User Specific Order List
export const getUserOrders = async (req: AuthRequest, res: Response) => {
	try {
		const userId = req.customer?.id;

		if (!userId) {
			return res.status(401).json({
				success: false,
				message: "Unauthorized. Please log in.",
			});
		}

		const userOrders = await db.query.orders.findMany({
			where: and(eq(orders.customerId, userId), eq(orders.isDeleted, false)),
			with: {
				items: {
					where: eq(orderItems.isDeleted, false),
				},
			},
			orderBy: (orders, { desc }) => [desc(orders.createdAt)],
		});

		return res.json({
			success: true,
			data: userOrders,
		});
	} catch (error) {
		console.error("Error fetching user orders:", error);
		return res.status(500).json({
			success: false,
			message: "Failed to fetch orders",
		});
	}
};

