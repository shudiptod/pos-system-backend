// src/models/websiteSettings.model.ts
import { pgTable, uuid, text, varchar, jsonb, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { z } from "zod";

export const websiteSettings = pgTable("website_settings", {
	id: uuid("id").primaryKey().defaultRandom(),

	// General Info
	appName: varchar("app_name", { length: 255 }).default("Mehezabin Mehedi House"),
	description: text("description"),
	logo: text("logo"),
	favicon: text("favicon"),

	// Contact Info
	contactEmail: varchar("contact_email", { length: 255 }),
	contactPhone: varchar("contact_phone", { length: 50 }),
	address: text("address"),

	// INVOICE CUSTOMIZATION STATE
	invoiceBrandColor: varchar("invoice_brand_color", { length: 7 }).default("#00B050"),
	invoiceFooterNote: text("invoice_footer_note").default("Once sold, items cannot be returned or exchanged."),

	// Feature Toggles for Invoice
	showStaffOnInvoice: boolean("show_staff_on_invoice").default(true),
	showAmountInWords: boolean("show_amount_in_words").default(true),

	// Social Media
	socialLinks: jsonb("social_links").default({}),

	// Shipping Charges
	shippingInsideDhaka: integer("shipping_inside_dhaka").default(60),
	shippingOutsideDhaka: integer("shipping_outside_dhaka").default(120),

	// Global E-commerce Settings
	availableDeliveryLocations: jsonb("available_delivery_locations").$type<string[]>().default(["All Bangladesh"]),

	// SEO
	metaKeywords: text("meta_keywords"),

	createdAt: timestamp("created_at").defaultNow(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.$onUpdate(() => new Date()),

	isDeleted: boolean("is_deleted").default(false), // Soft Delete
});

export const settingsSchema = z.object({
	appName: z.string().min(1, "Company name is required"),
	description: z.string().optional(),
	logo: z.string().url().optional().or(z.literal("")),
	favicon: z.string().url().optional().or(z.literal("")),

	contactEmail: z.string().email().optional().or(z.literal("")),
	contactPhone: z.string().optional(),
	address: z.string().optional(),

	// Invoice Customizer Validation
	invoiceBrandColor: z
		.string()
		.regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid Hex Color")
		.default("#00B050"),
	invoiceFooterNote: z.string().optional(),

	showStaffOnInvoice: z.boolean().default(true),
	showAmountInWords: z.boolean().default(true),

	socialLinks: z.record(z.string(), z.string().url().or(z.literal(""))).optional(),

	shippingInsideDhaka: z.coerce.number().min(0).default(60),
	shippingOutsideDhaka: z.coerce.number().min(0).default(120),

	availableDeliveryLocations: z.array(z.string()).optional().default(["All Bangladesh"]),

	metaKeywords: z.string().optional(),
});

export type WebsiteSettingsInput = z.infer<typeof settingsSchema>;
