import { Router } from "express";
import { authenticateJWT, authorize } from "../middleware/auth";
import { createCategory, getCategories, getCategoryBySlug, getRootCategories } from "../controllers/category.controller";
import { createProduct, deleteProduct, getFeaturedProducts, getProductById, getProductBySlug, getProducts, updateProduct } from "../controllers/product.controller";
import { addVariantToProduct, deleteVariant, deleteVariants, updateVariant } from "../controllers/variant.controller";

const router = Router();


router.post(
    "/categories",
    authenticateJWT as any,
    authorize(["SUPER_ADMIN", "ADMIN"]) as any,
    createCategory as any
);
router.get("/categories", getCategories);

router.get("/roots", getRootCategories);

// get single category
router.get("/categories/:slug", getCategoryBySlug);

router.get("/featured", getFeaturedProducts);

router.post("/", authenticateJWT as any, authorize(["SUPER_ADMIN", "ADMIN"]) as any, createProduct as any);

router.get("/:id", getProductById);
// get product by slug
router.get("/slug/:slug", getProductBySlug);

// update product 
router.patch("/:id", authenticateJWT as any, authorize(["SUPER_ADMIN", "ADMIN"]) as any, updateProduct as any);

// delete product 
router.delete("/:id", authenticateJWT as any, authorize(["SUPER_ADMIN", "ADMIN"]) as any,
    deleteProduct as any
);

// add new variant
router.post(
    "/variants",
    authenticateJWT as any,
    authorize(["SUPER_ADMIN", "ADMIN"]) as any,
    addVariantToProduct as any
);
// update product variant
router.patch("/variants/:id", authenticateJWT as any, authorize(["SUPER_ADMIN", "ADMIN"]) as any, updateVariant);

// get all products
router.get("/", getProducts as any);



// delete multiple products and variants
// delete variant
router.delete(
    "/variants",
    authenticateJWT as any,
    authorize(["SUPER_ADMIN", "ADMIN"]) as any,
    deleteVariants as any
);


// delete variant
router.delete(
    "/variants/:id",
    authenticateJWT as any,
    authorize(["SUPER_ADMIN", "ADMIN"]) as any,
    deleteVariant as any
);
export default router;
