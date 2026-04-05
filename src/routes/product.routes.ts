// src/routes/product.routes.ts
import { Router } from "express";
import { authenticateJWT, authorize } from "../middleware/auth";
import {
	createProduct,
	deleteProduct,
	getAllProducts,
	getProductById,
	getProducts,
	updateProduct,
} from "../controllers/product.controller";

const router = Router();

// GET /api/products
router.get("/", authenticateJWT as any, getProducts as any);

// GET /api/products/all
router.get("/all", authenticateJWT as any, getAllProducts as any);

// GET /api/products/:id
router.get("/:id", authenticateJWT as any, getProductById as any);

// POST /api/products
router.post(
	"/",
	authenticateJWT as any,
	authorize(["SUPER_ADMIN", "ADMIN", "MANAGER"]) as any,
	createProduct as any
);

// PATCH /api/products/:id
router.patch(
	"/:id",
	authenticateJWT as any,
	authorize(["SUPER_ADMIN", "ADMIN", "MANAGER"]) as any,
	updateProduct as any,
);

// DELETE /api/products/:id
router.delete(
	"/:id",
	authenticateJWT as any,
	authorize(["SUPER_ADMIN", "ADMIN"]) as any,
	deleteProduct as any
);

export default router;