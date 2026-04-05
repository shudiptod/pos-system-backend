// src/controllers/review.controller.ts
import { Request, Response } from "express";
import { db } from "../db";
import { eq, desc, sql } from "drizzle-orm";

// Models
import { reviews, createReviewSchema } from "../models/review.model";
import { products } from "../models/product.model";

// ---------------------------------------------------------
// 1. GET ALL REVIEWS FOR A PRODUCT (Without Email)
// ---------------------------------------------------------
export const getProductReviews = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;

    // Fetch reviews ordered by newest first, explicitly omitting the 'email' column
    const productReviews = await db
      .select({
        id: reviews.id,
        productId: reviews.productId,
        name: reviews.name,
        rating: reviews.rating,
        description: reviews.description,
        createdAt: reviews.createdAt,
      })
      .from(reviews)
      .where(eq(reviews.productId, productId))
      .orderBy(desc(reviews.createdAt));

    res.status(200).json({
      success: true,
      data: productReviews,
    });
  } catch (error: any) {
    console.error("Get Product Reviews Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------------------------------------------------------
// 2. CREATE A NEW PRODUCT REVIEW
// ---------------------------------------------------------
export const createProductReview = async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;

    // 1. Validate the incoming data using Zod
    const parsed = createReviewSchema.safeParse({
      productId,
      ...req.body,
    });

    if (!parsed.success) {
      console.error("Validation Error:", JSON.stringify(parsed.error.format(), null, 2));
      return res.status(400).json({ success: false, errors: parsed.error.format() });
    }

    const data = parsed.data;

    // 2. Check if the product actually exists before adding a review
    const [existingProduct] = await db.select({ id: products.id }).from(products).where(eq(products.id, productId)).limit(1);

    if (!existingProduct) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    // 3. Use a transaction to insert the review AND update the product's average rating
    const newReview = await db.transaction(async (tx) => {
      // A. Insert the new review
      const [insertedReview] = await tx
        .insert(reviews)
        .values({
          productId: data.productId,
          name: data.name,
          email: data.email,
          rating: data.rating,
          description: data.description,
        })
        .returning();

      // B. Calculate the new average rating and total review count
      const [stats] = await tx
        .select({
          avgRating: sql<number>`COALESCE(ROUND(AVG(${reviews.rating}), 2), 0)`,
          totalReviews: sql<number>`COUNT(${reviews.id})::int`,
        })
        .from(reviews)
        .where(eq(reviews.productId, productId));

      // C. Update the product table with the new stats
      await tx
        .update(products)
        .set({
          rating: String(stats.avgRating), // Stored as decimal/string in Drizzle PG
          reviewsCount: stats.totalReviews,
        })
        .where(eq(products.id, productId));

      return insertedReview;
    });

    res.status(201).json({
      success: true,
      data: newReview,
    });
  } catch (error: any) {
    console.error("Create Product Review Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
