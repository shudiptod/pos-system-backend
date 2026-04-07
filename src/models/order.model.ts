// src/models/order.model.ts
import { pgTable, uuid, varchar, timestamp, pgEnum, decimal, integer, text, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { customers } from "./customer.model";
import { products } from "./product.model";
import { z } from "zod";
import { jsonb } from "drizzle-orm/pg-core";

// =======================
// 1. ENUMS
// =======================
export const orderStatusEnum = pgEnum("order_status", ["pending", "completed", "cancelled", "refunded"]);
export const paymentStatusEnum = pgEnum("payment_status", ["unpaid", "paid", "refunded"]);
export const paymentMethodEnum = pgEnum("payment_method", ["cash", "card", "mobile_banking"]);

// =======================
// 2. TABLES
// =======================
export const orders = pgTable("orders", {
	id: uuid("id").primaryKey().defaultRandom(),
	customerId: uuid("customer_id").references(() => customers.id), // Nullable for anonymous walk-ins
	customerSnapshot: jsonb("customer_snapshot").$type<{
		fullName: string | null;
		phone: string | null;
	}>(),
	orderNumber: varchar("order_number", { length: 20 }).unique(),

	servedBy: varchar("served_by", { length: 255 }), // Name or ID of the cashier
	subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
	discount: decimal("discount", { precision: 12, scale: 2 }).default("0.00"),
	totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
	currency: varchar("currency", { length: 3 }).default("BDT"),

	paymentMethod: paymentMethodEnum("payment_method").default("cash").notNull(),
	paymentStatus: paymentStatusEnum("payment_status").default("paid"),
	status: orderStatusEnum("status").default("completed"),

	orderNote: text("order_note"),

	isDeleted: boolean("is_deleted").default(false),
	createdAt: timestamp("created_at").defaultNow(),
	updatedAt: timestamp("updated_at").defaultNow(),
});

export const orderItems = pgTable("order_items", {
	id: uuid("id").primaryKey().defaultRandom(),
	orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }).notNull(),
	productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),

	name: varchar("name", { length: 255 }).notNull(),
	sku: varchar("sku", { length: 100 }),
	quantity: integer("quantity").notNull().default(1),
	buyingPriceAtPurchase: decimal("buying_price_at_purchase", { precision: 12, scale: 2 }).notNull(),
	priceAtPurchase: decimal("price_at_purchase", { precision: 12, scale: 2 }).notNull(),
	isDeleted: boolean("is_deleted").default(false),
});

// =======================
// 3. RELATIONS
// =======================
export const ordersRelations = relations(orders, ({ many }) => ({
	items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
	order: one(orders, {
		fields: [orderItems.orderId],
		references: [orders.id],
	}),
}));

// =======================
// 4. ZOD SCHEMAS
// =======================
const posOrderItemSchema = z.object({
	quantity: z.coerce.number().min(1),
	productId: z.string().uuid().optional().nullable(),
	name: z.string().min(1, "Item name is required"),
	sku: z.string().optional().nullable(),
	buyingPriceAtPurchase: z.coerce.number().min(0).default(0),
	priceAtPurchase: z.coerce.number().min(0),
});

export const createPosOrderSchema = z.object({
	customerId: z.string().uuid().optional().nullable(),

	customerName: z.string().optional().nullable(),
	customerPhone: z.string().optional().nullable(),

	servedBy: z.string().min(1, "Staff name is required"),
	items: z.array(posOrderItemSchema).min(1),
	paymentMethod: z.enum(["cash", "card", "mobile_banking"]).default("cash"),
	paymentStatus: z.enum(["paid", "unpaid"]).default("paid"),
	status: z.enum(["completed", "pending", "cancelled", "refunded"]).default("completed"),
	discount: z.coerce.number().optional().default(0),
	orderNote: z.string().optional(),
});

export type CreatePosOrderInput = z.infer<typeof createPosOrderSchema>;