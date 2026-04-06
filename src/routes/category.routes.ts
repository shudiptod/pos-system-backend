// src/routes/category.routes.ts
import { Router } from "express";
import { authenticateJWT, authorize } from "../middleware/auth";
import {
    createCategory,
    deleteCategory,
    getCategories,
    getCategoryById,
    getRootCategories,
    updateCategory,
} from "../controllers/category.controller";

const router = Router();

// GET /api/categories
router.get("/", getCategories as any);
router.get("/:id", getCategoryById as any);

// GET /api/categories/roots
router.get("/roots", getRootCategories as any);

// POST /api/categories
router.post(
    "/",
    authenticateJWT as any,
    authorize(["SUPER_ADMIN", "ADMIN", "MANAGER"]) as any,
    createCategory as any,
);

// PATCH /api/categories/:id
router.patch(
    "/:id",
    authenticateJWT as any,
    authorize(["SUPER_ADMIN", "ADMIN", "MANAGER"]) as any,
    updateCategory as any,
);

// DELETE /api/categories/:id
router.delete(
    "/:id",
    authenticateJWT as any,
    authorize(["SUPER_ADMIN", "ADMIN"]) as any,
    deleteCategory as any,
);

export default router;