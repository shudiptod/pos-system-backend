// src/models/banner.model.ts
import { pgTable, uuid, text, integer, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
import { z } from "zod";

// Enum for Asset Type based on your requirements
export const assetTypeEnum = pgEnum("asset_type", ["banner", "single"]);

export const banners = pgTable("banners", {
	id: uuid("id").primaryKey().defaultRandom(),

	imagePath: text("image_path").notNull(),
	assetType: assetTypeEnum("asset_type").notNull(),
	bannerPosition: integer("banner_position"), // Nullable for flexible positioning

	isDisabled: boolean("is_disabled").default(false), // To temporarily hide a banner
	isDeleted: boolean("is_deleted").default(false), // Soft Delete

	createdAt: timestamp("created_at").defaultNow(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.$onUpdate(() => new Date()),
});

// --- ZOD SCHEMAS ---
export const createBannerSchema = z.object({
	imagePath: z.string().url("A valid image URL is required"),
	assetType: z.enum(["banner", "single"]),
	bannerPosition: z.number().int("Position must be an integer").optional().nullable(),
	isDisabled: z.boolean().optional().default(false),

});

export const updateBannerSchema = createBannerSchema.partial().extend({
  isDeleted: z.boolean().optional(), 
});

export type CreateBannerInput = z.infer<typeof createBannerSchema>;
export type UpdateBannerInput = z.infer<typeof updateBannerSchema>;
