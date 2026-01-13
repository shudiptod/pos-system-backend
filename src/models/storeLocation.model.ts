import { pgTable, uuid, varchar, text, boolean, timestamp } from "drizzle-orm/pg-core";
import z from "zod";

export const storeLocations = pgTable("store_locations", {
    id: uuid("id").primaryKey().defaultRandom(),

    name: varchar("name", { length: 255 }).notNull(),
    address: text("address").notNull(),

    // Optional fields (No .notNull())
    phone: varchar("phone", { length: 50 }),
    email: varchar("email", { length: 255 }),

    // New Time Fields
    openTime: varchar("open_time", { length: 20 }), // e.g., "10:00 AM"
    closeTime: varchar("close_time", { length: 20 }), // e.g., "08:00 PM"

    mapEmbedIframe: text("map_embed_iframe"),

    isActive: boolean("is_active").default(true),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
});




export const storeLocationSchema = z.object({
    name: z.string().min(1, "Store name is required"),
    address: z.string().min(1, "Address is required"),

    phone: z.string().nullable().optional().or(z.literal("")),
    email: z.string().email("Invalid email format").nullable().optional().or(z.literal("")),

    openTime: z.string().optional(),
    closeTime: z.string().optional(),

    // FIX: Wrap custom messages in { message: ... }
    mapEmbedIframe: z.string()
        .trim()
        .startsWith("<iframe", { message: "Must be a valid iframe tag" })
        .includes("google.com/maps", { message: "Must be a Google Maps embed" }).optional(),

    isActive: z.boolean().optional(),
});

export type StoreLocationInput = z.infer<typeof storeLocationSchema>;