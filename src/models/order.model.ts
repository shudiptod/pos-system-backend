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

export const orders = pgTable("orders", {
    id: uuid("id").primaryKey().defaultRandom(),
    source: orderSourceEnum("source").default('online').notNull(),
    customerId: uuid("customer_id").references(() => customers.id),
    orderNumber: varchar("order_number", { length: 20 }).unique(),
    totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
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
    thumbnailAtPurchase: text("thumbnail_at_purchase"), // Added to preserve order history visual 
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
    cartId: z.string().uuid(),
    paymentMethod: z.enum(['cod', 'online']),
    contactInfo: contactInfoSchema,
    shippingAddress: addressSchema,
    orderNote: z.string().optional(),
});

// --- Admin/Outlet Order Schema ---
export const createAdminOrderSchema = z.object({
    source: z.enum(['online', 'offline']).default('offline'),
    customerId: z.string().uuid().optional(),
    contactInfo: contactInfoSchema,
    items: z.array(z.object({
        variantId: z.string().uuid(),
        quantity: z.number().min(1)
    })).min(1),
    paymentMethod: z.enum(['cod', 'cash', 'card', 'online']),
    paymentStatus: z.enum(['paid', 'unpaid']),
    status: z.enum(['delivered', 'processing', 'pending', 'confirmed']),
    shippingAddress: addressSchema.optional(),
    discount: z.number().optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;