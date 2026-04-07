import { Request, Response } from "express";
import { db } from "../db";
import { orders, orderItems } from "../models/order.model";
import { products } from "../models/product.model";
import { categories } from "../models/category.model";
import { eq, and, sql, gte, lte, sum, count } from "drizzle-orm";

export const getSalesReport = async (req: Request, res: Response) => {
    try {
        const { startDate, endDate } = req.query;

        const conditions = [
            eq(orders.isDeleted, false),
            eq(orders.status, "completed")
        ];

        if (startDate) conditions.push(gte(orders.createdAt, new Date(startDate as string)));
        if (endDate) conditions.push(lte(orders.createdAt, new Date(endDate as string)));

        // --- QUERY 1: ORDER LEVEL SUMMARY ---
        // We query 'orders' alone to avoid multiplying revenue by the number of items
        const [orderSummary] = await db
            .select({
                totalRevenue: sum(orders.totalAmount),
                totalDiscount: sum(orders.discount),
                totalOrders: count(orders.id),
            })
            .from(orders)
            .where(and(...conditions));

        // --- QUERY 2: PROFIT CALCULATION ---
        // Profit must join with items, so we do it separately
        const [profitSummary] = await db
            .select({
                totalProfit: sql<string>`
      COALESCE(
        SUM(
          (
            ${orderItems.priceAtPurchase}::numeric - 
            COALESCE(${orderItems.buyingPriceAtPurchase}::numeric, 0)
          ) * ${orderItems.quantity}
        ), 
        0
      )::text`,
            })
            .from(orderItems)
            .innerJoin(orders, eq(orderItems.orderId, orders.id))
            .where(and(...conditions));

        // --- QUERY 3: CATEGORY STATS ---
        const categoryStats = await db
            .select({
                categoryName: categories.name,
                revenue: sum(sql`${orderItems.priceAtPurchase} * ${orderItems.quantity}`),
                itemsSold: sum(orderItems.quantity),
            })
            .from(orderItems)
            .innerJoin(orders, eq(orderItems.orderId, orders.id))
            .innerJoin(products, eq(orderItems.productId, products.id))
            .innerJoin(categories, eq(products.categoryId, categories.id))
            .where(and(...conditions))
            .groupBy(categories.id, categories.name);

        // --- QUERY 4: STAFF PERFORMANCE ---
        const staffStats = await db
            .select({
                staffName: orders.servedBy,
                totalSales: sum(orders.totalAmount),
                orderCount: count(orders.id),
                avgOrderValue: sql<string>`AVG(${orders.totalAmount}::numeric)::text`,
            })
            .from(orders)
            .where(and(...conditions))
            .groupBy(orders.servedBy)
            // FIX: Order by the SUM function directly, not the alias string
            .orderBy(sql`sum(${orders.totalAmount}) DESC`);

        // --- QUERY 5: PAYMENT METHODS ---
        const paymentStats = await db
            .select({
                method: orders.paymentMethod,
                amount: sum(orders.totalAmount),
                count: count(orders.id),
            })
            .from(orders)
            .where(and(...conditions))
            .groupBy(orders.paymentMethod);

        res.json({
            success: true,
            data: {
                summary: {
                    totalRevenue: orderSummary?.totalRevenue || "0",
                    totalDiscount: orderSummary?.totalDiscount || "0",
                    totalOrders: Number(orderSummary?.totalOrders || 0),
                    totalProfit: profitSummary?.totalProfit || "0",
                },
                categoryStats,
                staffStats,
                paymentStats,
            },
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};