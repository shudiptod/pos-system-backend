import { pgTable, uuid, varchar, timestamp, pgEnum, decimal, integer, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm"; // <--- Import this
import { customers } from "./customer.model";
import { products } from "./product.model";
import { productVariants } from "./productVariant.model";
import { email, z } from "zod";

// =======================
// 1. ENUMS
// =======================
export const orderStatusEnum = pgEnum('order_status', ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']);
export const paymentStatusEnum = pgEnum('payment_status', ['unpaid', 'paid', 'refunded', 'failed']);
export const paymentMethodEnum = pgEnum('payment_method', ['cod', 'online']);

// =======================
// 2. TABLES
// =======================

// --- ORDERS TABLE ---
export const orders = pgTable("orders", {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id").references(() => customers.id),

    totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default('BDT'),

    paymentMethod: paymentMethodEnum("payment_method").default('cod').notNull(),
    paymentStatus: paymentStatusEnum("payment_status").default('unpaid'),
    paymentIntentId: varchar("payment_intent_id", { length: 255 }),

    status: orderStatusEnum("status").default('pending'),

    shippingAddress: jsonb("shipping_address").notNull(),
    billingAddress: jsonb("billing_address"),
    trackingNumber: varchar("tracking_number", { length: 100 }),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});

// --- ORDER ITEMS TABLE ---
export const orderItems = pgTable("order_items", {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: 'cascade' }).notNull(),

    productId: uuid("product_id").references(() => products.id, { onDelete: 'set null' }), // Set null if product deleted
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: 'set null' }),

    name: varchar("name", { length: 255 }).notNull(),
    quantity: integer("quantity").notNull().default(1),
    priceAtPurchase: decimal("price_at_purchase", { precision: 12, scale: 2 }).notNull(),
});

// =======================
// 3. RELATIONS (This is what you were missing)
// =======================

// A. Order Relations: "An order has many items"
export const ordersRelations = relations(orders, ({ many }) => ({
    items: many(orderItems),
}));

// B. Item Relations: "An item belongs to one order"
export const orderItemsRelations = relations(orderItems, ({ one }) => ({
    order: one(orders, {
        fields: [orderItems.orderId],
        references: [orders.id],
    }),
}));

// =======================
// 4. ZOD SCHEMAS
// =======================

const addressSchema = z.object({
    fullName: z.string().min(1, "Name is required"),
    phone: z.string().min(11, "Phone number is required"),
    email: z.string().email("Invalid email address").optional(),
    street: z.string().min(5, "Street address is required"),
    city: z.string().min(1, "City is required"),
    postalCode: z.string().optional(),
});

export const createOrderSchema = z.object({
    cartId: z.string().uuid(),
    paymentMethod: z.enum(['cod', 'online']),
    shippingAddress: addressSchema,
    billingAddress: addressSchema.optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;