// src/routes/product.routes.ts
import { Router } from "express";
import { authenticateJWT, authorize } from "../middleware/auth";
import {
	createCategory,
	deleteCategory,
	getCategories,
	getCategoryBySlug,
	getRootCategories,
	updateCategory,
} from "../controllers/category.controller";
import {
	createProduct,
	deleteProduct,
	getAllProducts,
	getFeaturedProducts,
	getProductById,
	getProductBySlug,
	getProducts,
	updateProduct,
	getProductsByCategorySlug
} from "../controllers/product.controller";
// Note: variant.controller imports have been completely removed

const router = Router();

// get all products from db
router.get("/all", getAllProducts as any);

router.post(
	"/categories",
	authenticateJWT as any,
	authorize(["SUPER_ADMIN", "ADMIN", "MANAGER"]) as any,
	createCategory as any,
);
router.get("/categories", getCategories);

router.get("/roots", getRootCategories);

// get single category
router.get("/categories/:slug", getCategoryBySlug);

router.get("/featured", getFeaturedProducts);

// update category
router.patch(
	"/categories/:id",
	authenticateJWT as any,
	authorize(["SUPER_ADMIN", "ADMIN", "MANAGER"]) as any,
	updateCategory as any,
);

// delete category
router.delete(
	"/categories/:id",
	authenticateJWT as any,
	authorize(["SUPER_ADMIN", "ADMIN"]) as any,
	deleteCategory as any,
);

// Note: All variant routes (POST, PATCH, DELETE /variants) have been removed

// Product Routes
router.post("/", authenticateJWT as any, authorize(["SUPER_ADMIN", "ADMIN", "MANAGER"]) as any, createProduct as any);
router.get("/:id", getProductById);
router.get("/slug/:slug", getProductBySlug);
router.patch(
	"/:id",
	authenticateJWT as any,
	authorize(["SUPER_ADMIN", "ADMIN", "MANAGER"]) as any,
	updateProduct as any,
);
router.delete("/:id", authenticateJWT as any, authorize(["SUPER_ADMIN", "ADMIN"]) as any, deleteProduct as any);
router.delete("/", authenticateJWT as any, authorize(["SUPER_ADMIN", "ADMIN"]) as any, deleteProduct as any);
router.get("/", getProducts as any);
router.get("/category/:slug", getProductsByCategorySlug  as any);


export default router;
