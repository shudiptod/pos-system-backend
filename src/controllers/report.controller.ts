import { Request, Response } from "express";
import { db } from "../db";
import { orders, orderItems } from "../models/order.model";
import { products } from "../models/product.model";
import { categories } from "../models/category.model";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { format, startOfDay } from "date-fns"; // Recommended for easy date cleaning

export const getDynamicSalesReport = async (req: Request, res: Response) => {
    try {
        const { startDate, endDate, selectedColumns, filterCategoryIds } = req.body;

        // 1. Define Column Mapping
        const columnMap: Record<string, any> = {
            orderDate: orders.createdAt,
            orderNumber: orders.orderNumber,
            productName: orderItems.name,
            categoryName: categories.name,
            quantity: orderItems.quantity,
            priceAtPurchase: orderItems.priceAtPurchase,
            paymentMethod: orders.paymentMethod,
            servedBy: orders.servedBy,
            customerPhone: sql`${orders.customerSnapshot}->>'phone'`,
            revenue: sql<string>`(${orderItems.priceAtPurchase} * ${orderItems.quantity})::numeric`,
            profit: sql<string>`((${orderItems.priceAtPurchase} - COALESCE(${orderItems.buyingPriceAtPurchase}, 0)) * ${orderItems.quantity})::numeric`,
        };

        const dynamicSelection: Record<string, any> = {};
        selectedColumns.forEach((col: string) => {
            if (columnMap[col]) dynamicSelection[col] = columnMap[col];
        });

        const conditions = [eq(orders.isDeleted, false), eq(orders.status, "completed")];

        if (startDate) conditions.push(gte(orders.createdAt, new Date(startDate)));
        if (endDate) conditions.push(lte(orders.createdAt, new Date(endDate)));

        if (filterCategoryIds?.length > 0) {
            conditions.push(sql`${products.categoryId} IN (${sql.join(filterCategoryIds.map((id: any) => sql`${id}`), sql`, `)})`);
        }

        const rawData = await db
            .select(dynamicSelection)
            .from(orderItems)
            .innerJoin(orders, eq(orderItems.orderId, orders.id))
            .leftJoin(products, eq(orderItems.productId, products.id))
            .leftJoin(categories, eq(products.categoryId, categories.id))
            .where(and(...conditions))
            .orderBy(sql`${orders.createdAt} DESC`);

        // 5. Data Cleaning Transformation
        const cleanedData = rawData.map((item: any) => {
            const cleanedItem = { ...item };

            // Format Date: "April 28, 2026"
            if (cleanedItem.orderDate) {
                cleanedItem.orderDate = format(new Date(cleanedItem.orderDate), "MMMM dd, yyyy");
            }

            // Format Payment Method: "mobile_banking" -> "Mobile Banking"
            if (cleanedItem.paymentMethod) {
                cleanedItem.paymentMethod = cleanedItem.paymentMethod
                    .split('_')
                    .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ');
            }

            return cleanedItem;
        });

        res.json({ success: true, count: cleanedData.length, data: cleanedData });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};




export const getDashboardOverview = async (req: Request, res: Response) => {
    try {
        const today = startOfDay(new Date());

        // 1. FETCH THE "BIG THREE" (Today's Stats)
        // We calculate these in a single query for efficiency
        const [todayStats] = await db
            .select({
                totalRevenue: sql<string>`COALESCE(SUM(${orders.totalAmount}), 0)::text`,
                orderCount: sql<number>`COUNT(${orders.id})::int`,
                // Profit calculation: (Price - Buying Price) * Quantity
                totalProfit: sql<string>`
                    COALESCE(
                        SUM(
                            (${orderItems.priceAtPurchase} - COALESCE(${orderItems.buyingPriceAtPurchase}, 0)) * ${orderItems.quantity}
                        ), 
                        0
                    )::text`
            })
            .from(orders)
            .leftJoin(orderItems, eq(orders.id, orderItems.orderId))
            .where(
                and(
                    eq(orders.isDeleted, false),
                    eq(orders.status, "completed"),
                    gte(orders.createdAt, today)
                )
            );

        // 2. FETCH LOW STOCK ALERTS (Restock Needed)
        const lowStockItems = await db
            .select({
                id: products.id,
                title: products.title,
                stock: products.stock,
                sku: products.sku
            })
            .from(products)
            .where(
                and(
                    eq(products.isDeleted, false),
                    sql`${products.stock} < 5` // Threshold for "Low Stock"
                )
            )
            .limit(10)
            .orderBy(products.stock);

        // 3. RECENT ACTIVITY (Last 5 Sales)
        const recentSales = await db
            .select({
                id: orders.id,
                orderNumber: orders.orderNumber,
                totalAmount: orders.totalAmount,
                paymentMethod: orders.paymentMethod,
                createdAt: orders.createdAt
            })
            .from(orders)
            .where(eq(orders.isDeleted, false))
            .orderBy(desc(orders.createdAt))
            .limit(5);

        // 4. COMBINED RESPONSE
        res.json({
            success: true,
            data: {
                summary: {
                    revenue: todayStats?.totalRevenue || "0",
                    profit: todayStats?.totalProfit || "0",
                    orders: todayStats?.orderCount || 0
                },
                lowStock: lowStockItems,
                recentSales: recentSales.map(sale => ({
                    ...sale,
                    // Clean payment method formatting for UI
                    paymentMethod: sale.paymentMethod
                        .split('_')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ')
                }))
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};