import { Router } from "express";
import { authenticateJWT, authorize } from "../middleware/auth";
import { createCategory, getCategories } from "../controllers/category.controller";
import { createProduct, getProductById, getProductBySlug, getProducts } from "../controllers/product.controller";
import { updateVariant } from "../controllers/variant.controller";

const router = Router();

router.post("/categories", authenticateJWT as any, authorize(["SUPER_ADMIN", "ADMIN"]) as any, createCategory);
router.get("/categories", getCategories);

router.post("/", authenticateJWT as any, authorize(["SUPER_ADMIN", "ADMIN"]) as any, createProduct as any);

router.get("/:id", getProductById);
// get product by slug
router.get("/slug/:slug", getProductBySlug);


router.patch("/variants/:id", authenticateJWT as any, authorize(["SUPER_ADMIN", "ADMIN"]) as any, updateVariant);
router.get("/", getProducts as any);

export default router;
