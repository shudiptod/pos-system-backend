// src/controllers/banner.controller.ts
import { Request, Response } from "express";
import { db } from "../db";
import { banners, createBannerSchema, updateBannerSchema } from "../models/banner.model";
import { eq, and, asc, desc } from "drizzle-orm";
import { AuthRequest } from "../middleware/auth";

// ==========================================
// 1. CREATE BANNER (Admin Only)
// ==========================================
export const createBanner = async (req: AuthRequest, res: Response) => {
	try {
		const user = req.user;
		if (!user) return res.status(401).json({ message: "Unauthorized" });

		// Validate Input
		const parsed = createBannerSchema.safeParse(req.body);
		if (!parsed.success) {
			return res.status(400).json({ success: false, errors: parsed.error.format() });
		}

		// Insert into DB
		const [newBanner] = await db.insert(banners).values(parsed.data).returning();

		res.status(201).json({ success: true, message: "Banner created successfully", data: newBanner });
	} catch (error: any) {
		console.error("Create Banner Error:", error);
		res.status(500).json({ success: false, message: "Internal server error" });
	}
};

// ==========================================
// 2. GET PUBLIC BANNERS (For Main Website)
// ==========================================
export const getPublicBanners = async (req: Request, res: Response) => {
	try {
		// Only fetch banners that are NOT disabled and NOT deleted
		const activeBanners = await db
			.select()
			.from(banners)
			.where(and(eq(banners.isDisabled, false), eq(banners.isDeleted, false)))
			.orderBy(asc(banners.bannerPosition), desc(banners.createdAt)); // Sort by position

		res.status(200).json({ success: true, data: activeBanners });
	} catch (error: any) {
		res.status(500).json({ success: false, message: "Internal server error" });
	}
};

// ==========================================
// 3. GET ALL BANNERS (For Admin Panel)
// ==========================================
export const getAllBanners = async (req: AuthRequest, res: Response) => {
	try {
		const user = req.user;
		if (!user) return res.status(401).json({ message: "Unauthorized" });

		// Fetch all non-deleted banners (including disabled ones)
		const allBanners = await db
			.select()
			.from(banners)
			.where(eq(banners.isDeleted, false))
			.orderBy(asc(banners.bannerPosition), desc(banners.createdAt));

		res.status(200).json({ success: true, data: allBanners });
	} catch (error: any) {
		res.status(500).json({ success: false, message: "Internal server error" });
	}
};

// ==========================================
// 4. UPDATE BANNER (Admin Only)
// ==========================================
export const updateBanner = async (req: AuthRequest, res: Response) => {
	try {
		const user = req.user;
		if (!user) return res.status(401).json({ message: "Unauthorized" });

		const { id } = req.params;

		// Validate Input
		const parsed = updateBannerSchema.safeParse(req.body);
		if (!parsed.success) {
			return res.status(400).json({ success: false, errors: parsed.error.format() });
		}

		const [updatedBanner] = await db
			.update(banners)
			.set(parsed.data)
			.where(and(eq(banners.id, id), eq(banners.isDeleted, false)))
			.returning();

		if (!updatedBanner) {
			return res.status(404).json({ success: false, message: "Banner not found" });
		}

		res.status(200).json({ success: true, message: "Banner updated successfully", data: updatedBanner });
	} catch (error: any) {
		res.status(500).json({ success: false, message: "Internal server error" });
	}
};

// ==========================================
// 5. DELETE BANNER (Soft Delete - Admin Only)
// ==========================================
export const deleteBanner = async (req: AuthRequest, res: Response) => {
	try {
		const user = req.user;
		if (!user) return res.status(401).json({ message: "Unauthorized" });

		const { id } = req.params;

		// Soft Delete
		const [deletedBanner] = await db.update(banners).set({ isDeleted: true }).where(eq(banners.id, id)).returning();

		if (!deletedBanner) {
			return res.status(404).json({ success: false, message: "Banner not found" });
		}

		res.status(200).json({ success: true, message: "Banner deleted successfully" });
	} catch (error: any) {
		res.status(500).json({ success: false, message: "Internal server error" });
	}
};
