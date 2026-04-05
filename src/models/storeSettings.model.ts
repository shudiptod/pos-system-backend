// src/models/websiteSettings.model.ts
import { pgTable, uuid, text, varchar, timestamp, boolean } from "drizzle-orm/pg-core";
import { z } from "zod";

export const storeSettings = pgTable("store_settings", {
	id: uuid("id").primaryKey().defaultRandom(),

	// General Info
	storeName: varchar("store_name", { length: 255 }).default("General POS"),
	address: text("address"),
	contactEmail: varchar("contact_email", { length: 255 }),
	contactPhone: varchar("contact_phone", { length: 50 }),
	logo: text("logo"),

	// INVOICE CUSTOMIZATION STATE
	invoiceBrandColor: varchar("invoice_brand_color", { length: 7 }).default("#00B050"),
	invoiceFooterNote: text("invoice_footer_note").default("Thank you for your purchase!"),

	// Feature Toggles for Invoice
	showStaffOnInvoice: boolean("show_staff_on_invoice").default(true),
	showAmountInWords: boolean("show_amount_in_words").default(true),

	createdAt: timestamp("created_at").defaultNow(),
	updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),

	isDeleted: boolean("is_deleted").default(false),
});

export const settingsSchema = z.object({
	storeName: z.string().min(1, "Store name is required"),
	address: z.string().optional(),
	contactEmail: z.string().email().optional().or(z.literal("")),
	contactPhone: z.string().optional(),
	logo: z.string().url().optional().or(z.literal("")),

	// Invoice Customizer Validation
	invoiceBrandColor: z
		.string()
		.regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid Hex Color")
		.default("#00B050"),
	invoiceFooterNote: z.string().optional(),

	showStaffOnInvoice: z.boolean().default(true),
	showAmountInWords: z.boolean().default(true),
});

export type StoreSettingsInput = z.infer<typeof settingsSchema>;