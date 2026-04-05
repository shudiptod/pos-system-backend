// src/models/order.model.ts
import { pgTable, uuid, varchar, timestamp, pgEnum, decimal, integer, jsonb, text, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { customers } from "./customer.model";
import { products } from "./product.model";
import { z } from "zod";

// =======================
// 1. ENUMS
// =======================
export const orderStatusEnum = pgEnum("order_status", [
	"pending",
	"confirmed",
	"processing",
	"shipped",
	"delivered",
	"cancelled",
]);
export const paymentStatusEnum = pgEnum("payment_status", ["unpaid", "paid", "refunded", "failed"]);
export const paymentMethodEnum = pgEnum("payment_method", ["cod", "online", "cash", "card"]);
export const orderSourceEnum = pgEnum("order_source", ["online", "offline"]);



export const orders = pgTable("orders", {
    id: uuid("id").primaryKey().defaultRandom(),
    source: orderSourceEnum("source").default("online").notNull(),
    customerId: uuid("customer_id").references(() => customers.id),
    orderNumber: varchar("order_number", { length: 20 }).unique(),

    servedBy: varchar("served_by", { length: 255 }),
    subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
    shippingCost: decimal("shipping_cost", { precision: 12, scale: 2 }).notNull(),
    totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
    discount: decimal("discount", { precision: 12, scale: 2 }).default("0.00"),
    currency: varchar("currency", { length: 3 }).default("BDT"),

    paymentMethod: paymentMethodEnum("payment_method").default("cod").notNull(),
    paymentStatus: paymentStatusEnum("payment_status").default("unpaid"),
    paymentIntentId: varchar("payment_intent_id", { length: 255 }),
    
    // 👇 NEW FIELD FOR SSL COMMERZ 👇
    transactionId: varchar("transaction_id", { length: 255 }).unique(), 

    status: orderStatusEnum("status").default("pending"),

    contactInfo: jsonb("contact_info").notNull(),
    district: varchar("district", { length: 100 }).notNull(),
    address: text("address").notNull(),

    orderNote: text("order_note"),
    trackingNumber: varchar("tracking_number", { length: 100 }),

    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});

export const orderItems = pgTable("order_items", {
	id: uuid("id").primaryKey().defaultRandom(),
	orderId: uuid("order_id")
		.references(() => orders.id, { onDelete: "cascade" })
		.notNull(),

	productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),

	name: varchar("name", { length: 255 }).notNull(),
	sku: varchar("sku", { length: 100 }),
	thumbnailAtPurchase: text("thumbnail_at_purchase"),
	quantity: integer("quantity").notNull().default(1),
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
	priceAtPurchase: z.coerce.number().min(0),
	thumbnailAtPurchase: z.string().url().optional().nullable(),
});

const contactInfoSchema = z.object({
	fullName: z.string().min(2, "Full name is required"),
	phone: z.string().min(11, "Valid phone number is required"),
	email: z.string().email("Invalid email address").optional().or(z.literal("")),
});

const addressSchema = z.object({
	district: z.string().min(1, "District is required"),
	address: z.string().min(5, "Full address details are required"),
});

// --- Online Order Schema ---
export const createOrderSchema = z.object({
	cartId: z.string().uuid("Invalid cart session"),
	paymentMethod: z.enum(["cod", "online"]),
	contactInfo: contactInfoSchema, // Reusing your existing sub-schema
	shippingAddress: addressSchema, // Required for online orders
	orderNote: z.string().optional(),
});

// --- Updated Admin Order Schema ---
export const createAdminOrderSchema = z.object({
	source: z.enum(["online", "offline"]).default("offline"),
	servedBy: z.string().min(1, "Staff name is required for offline orders").optional(),
	customerId: z.string().uuid().optional(),
	contactInfo: contactInfoSchema,
	items: z.array(posOrderItemSchema).min(1),
	paymentMethod: z.enum(["cod", "cash", "card", "online"]),
	paymentStatus: z.enum(["paid", "unpaid"]),
	status: z.enum(["delivered", "processing", "pending", "confirmed"]),
	shippingAddress: addressSchema.partial().optional().nullable(),
	shippingCost: z.coerce.number().optional().default(0),
	discount: z.coerce.number().optional().default(0),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
