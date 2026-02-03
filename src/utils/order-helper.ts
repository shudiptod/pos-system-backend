// utils/order-helper.ts
import { eq } from "drizzle-orm";
import { orders } from "../models/order.model";
import { generateOrderNumber } from "./order_number";

// This accepts the transaction 'tx' to check for duplicates
export async function generateUniqueOrderNumber(tx: any): Promise<string> {
    let orderNumber = "";
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 3) {
        orderNumber = generateOrderNumber();

        // Check DB for collision
        const existing = await tx.query.orders.findFirst({
            where: eq(orders.orderNumber, orderNumber),
        });

        if (!existing) {
            isUnique = true;
        }
        attempts++;
    }

    if (!isUnique) throw new Error("Failed to generate unique Order ID");
    return orderNumber;
}