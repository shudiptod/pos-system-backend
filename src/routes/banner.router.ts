// src/routes/banner.router.ts
import { Router } from "express";
import { authenticateJWT, authorize } from "../middleware/auth";
import {
	createBanner,
	getPublicBanners,
	getAllBanners,
	updateBanner,
	deleteBanner,
} from "../controllers/banner.controller";

const router = Router();

// ==========================================
// PUBLIC ROUTE (For Main Website Frontend)
// ==========================================
// Only returns active banners (isDisabled: false)
router.get("/", getPublicBanners as any);

// ==========================================
// ADMIN ROUTES (Protected)
// ==========================================

// Get all banners including disabled ones (for Admin Dashboard)
router.get(
	"/admin",
	authenticateJWT as any,
	authorize(["SUPER_ADMIN", "ADMIN", "MANAGER"]) as any,
	getAllBanners as any,
);

// Create a new banner
router.post("/", authenticateJWT as any, authorize(["SUPER_ADMIN", "ADMIN", "MANAGER"]) as any, createBanner as any);

// Update banner (position, image, toggle visibility)
router.patch(
	"/:id",
	authenticateJWT as any,
	authorize(["SUPER_ADMIN", "ADMIN", "MANAGER"]) as any,
	updateBanner as any,
);

// Delete banner (Soft delete)
router.delete("/:id", authenticateJWT as any, authorize(["SUPER_ADMIN", "ADMIN"]) as any, deleteBanner as any);

export default router;
