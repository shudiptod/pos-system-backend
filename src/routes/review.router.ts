// src/routes/review.routes.ts
import { Router } from "express";
import { getProductReviews, createProductReview } from "../controllers/review.controller";

const router = Router();


router.get("/:productId", getProductReviews as any);


router.post(
  "/:productId",
  createProductReview as any,
);

export default router;
