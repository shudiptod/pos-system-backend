import { pgTable, uuid, varchar, timestamp, pgEnum, decimal, integer, jsonb, text } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { customers } from "./customer.model";
import { products } from "./product.model";
import { productVariants } from "./productVariant.model";
import { z } from "zod";

// =======================
// 1. ENUMS
// =======================
export const orderStatusEnum = pgEnum('order_status', ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']);
export const paymentStatusEnum = pgEnum('payment_status', ['unpaid', 'paid', 'refunded', 'failed']);
export const paymentMethodEnum = pgEnum('payment_method', ['cod', 'online', 'cash', 'card']);
export const orderSourceEnum = pgEnum('order_source', ['online', 'offline']);

// =======================
// 2. TABLES
// =======================

// ... existing imports

export const orders = pgTable("orders", {
    id: uuid("id").primaryKey().defaultRandom(),
    source: orderSourceEnum("source").default('online').notNull(),
    customerId: uuid("customer_id").references(() => customers.id),
    orderNumber: varchar("order_number", { length: 20 }).unique(),

    // NEW: Staff Attribution (G&G Style)
    servedBy: varchar("served_by", { length: 255 }),
    subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
    shippingCost: decimal("shipping_cost", { precision: 12, scale: 2 }).notNull(),
    totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
    discount: decimal("discount", { precision: 12, scale: 2 }).default("0.00"), // Added column
    currency: varchar("currency", { length: 3 }).default('BDT'),

    paymentMethod: paymentMethodEnum("payment_method").default('cod').notNull(),
    paymentStatus: paymentStatusEnum("payment_status").default('unpaid'),
    paymentIntentId: varchar("payment_intent_id", { length: 255 }),

    status: orderStatusEnum("status").default('pending'),

    contactInfo: jsonb("contact_info").notNull(),
    shippingAddress: jsonb("shipping_address"),

    orderNote: text("order_note"),
    trackingNumber: varchar("tracking_number", { length: 100 }),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});

export const orderItems = pgTable("order_items", {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: 'cascade' }).notNull(),
    productId: uuid("product_id").references(() => products.id, { onDelete: 'set null' }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: 'set null' }),

    name: varchar("name", { length: 255 }).notNull(),
    sku: varchar("sku", { length: 100 }), // Added for item barcode

    // NEW: Unit Level Tracking
    imei: varchar("imei", { length: 100 }),    // Serial/IMEI Number
    warranty: varchar("warranty", { length: 100 }), // e.g. "12 Months"

    thumbnailAtPurchase: text("thumbnail_at_purchase"),
    quantity: integer("quantity").notNull().default(1),
    priceAtPurchase: decimal("price_at_purchase", { precision: 12, scale: 2 }).notNull(),
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

// --- Updated Item Schema ---
const posOrderItemSchema = z.object({
    quantity: z.coerce.number().min(1), // Automatically converts "1" to 1
    variantId: z.string().uuid().optional().nullable(),
    productId: z.string().uuid().optional().nullable(),
    name: z.string().min(1, "Item name is required"),
    sku: z.string().optional().nullable(), // For barcode display

    // NEW: Retail Fields
    imei: z.string().optional().nullable(),
    warranty: z.string().optional().nullable(),

    priceAtPurchase: z.coerce.number().min(0),
    thumbnailAtPurchase: z.string().url().optional().nullable(),
});



const contactInfoSchema = z.object({
    fullName: z.string().min(2, "Full name is required"),
    phone: z.string().min(11, "Valid phone number is required"),
    email: z.string().email("Invalid email address").optional().or(z.literal("")),
});

const addressSchema = z.object({
    street: z.string().min(5, "Street address is required"),
    area: z.string().min(1, "Area/Upazila is required"),
    city: z.string().min(1, "District/City is required"),
    division: z.string().min(1, "Division is required"),
    postalCode: z.string().min(4, "Postal code is required"),
});

// --- Online Order Schema ---
export const createOrderSchema = z.object({
    cartId: z.string().uuid("Invalid cart session"),
    paymentMethod: z.enum(['cod', 'online']),
    contactInfo: contactInfoSchema, // Reusing your existing sub-schema
    shippingAddress: addressSchema,   // Required for online orders
    orderNote: z.string().optional(),
});
// --- Updated Admin Order Schema ---
export const createAdminOrderSchema = z.object({
    source: z.enum(['online', 'offline']).default('offline'),
    servedBy: z.string().min(1, "Staff name is required for offline orders").optional(), // NEW
    customerId: z.string().uuid().optional(),
    contactInfo: contactInfoSchema,
    items: z.array(posOrderItemSchema).min(1),
    paymentMethod: z.enum(['cod', 'cash', 'card', 'online']),
    paymentStatus: z.enum(['paid', 'unpaid']),
    status: z.enum(['delivered', 'processing', 'pending', 'confirmed']),
    shippingAddress: addressSchema.partial().optional().nullable(),
    shippingCost: z.coerce.number().optional().default(0), // Added
    discount: z.coerce.number().optional().default(0),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;