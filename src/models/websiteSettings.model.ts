import { pgTable, uuid, text, varchar, jsonb, integer, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod";


export const websiteSettings = pgTable("website_settings", {
    id: uuid("id").primaryKey().defaultRandom(),

    // General Info
    appName: varchar("app_name", { length: 255 }).default("MMH Station 25"),
    description: text("description"),
    logo: text("logo"),
    favicon: text("favicon"),

    // Contact Info
    contactEmail: varchar("contact_email", { length: 255 }),
    contactPhone: varchar("contact_phone", { length: 50 }),
    address: text("address"),

    // Social Media
    socialLinks: jsonb("social_links").default({}),

    // NEW: Shipping Charges (in BDT)
    shippingInsideDhaka: integer("shipping_inside_dhaka").default(60),
    shippingOutsideDhaka: integer("shipping_outside_dhaka").default(120),

    // SEO
    metaKeywords: text("meta_keywords"),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
});




export const settingsSchema = z.object({
    appName: z.string().min(1).optional(),
    description: z.string().optional(),
    logo: z.string().url().optional().or(z.literal("")),
    favicon: z.string().url().optional().or(z.literal("")),

    contactEmail: z.string().email().optional().or(z.literal("")),
    contactPhone: z.string().optional(),
    address: z.string().optional(),
    socialLinks: z.record(z.string(), z.string().url()).optional(),

    // NEW: Shipping Validation
    shippingInsideDhaka: z.coerce.number().min(0, "Must be a positive number").default(60),
    shippingOutsideDhaka: z.coerce.number().min(0, "Must be a positive number").default(120),

    metaKeywords: z.string().optional(),
});

export type WebsiteSettingsInput = z.infer<typeof settingsSchema>;