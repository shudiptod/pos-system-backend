// src/models/review.model.ts
import { pgTable, uuid, text, integer, timestamp, time } from "drizzle-orm/pg-core";
import { z } from "zod";
import { products } from "./product.model";

export const reviews = pgTable("reviews", {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
        .references(() => products.id, { onDelete: "cascade" })
        .notNull(),
    
    name: text("name").notNull(),
    email: text("email").notNull(),
    rating: integer("rating").notNull(), // 1 to 5
    description: text("description").notNull(),

    // OPTIONAL: If you want a strictly "Time Only" column (e.g., "14:30:00")
    // reviewTime: time("review_time").defaultNow(), 

    // RECOMMENDED: Store Date + Time + Timezone (timestamptz in Postgres)
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ZOD SCHEMAS (Validation)
export const createReviewSchema = z.object({
    productId: z.string().uuid("Invalid Product ID"),
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    rating: z.number().int().min(1, "Minimum rating is 1").max(5, "Maximum rating is 5"),
    description: z.string().min(5, "Review description must be at least 5 characters"),
    // If you added the explicit reviewTime column, you could validate it here:
    // reviewTime: z.string().regex(/^([01]\d|2[0-3]):?([0-5]\d):?([0-5]\d)$/).optional(),
});

export const updateReviewSchema = createReviewSchema.partial();

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;