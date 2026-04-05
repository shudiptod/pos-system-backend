// src/controllers/websiteSettings.controller.ts
import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { settingsSchema, websiteSettings } from "../models/websiteSettings.model";
import { AuthRequest } from "../middleware/auth";
import { eq, and } from "drizzle-orm";

// Utility for consistent API responses (assuming you have this in your codebase)
const success = (res: Response, data: any, message = "Success") => {
	return res.status(200).json({ success: true, message, data });
};

// GET: Fetch the one and only settings row
export const getSettings = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const settings = await db
			.select()
			.from(websiteSettings)
			.where(eq(websiteSettings.isDeleted, false)) // Only fetch non-deleted
			.limit(1);

		if (settings.length === 0) {
			return success(res, {}, "No settings configured yet");
		}

		success(res, settings[0]);
	} catch (error) {
		next(error);
	}
};

// PATCH: Update the settings (or create if missing)
export const updateSettings = async (req: AuthRequest, res: Response, next: NextFunction) => {
	try {
		const user = req.user;
		if (!user) return res.status(401).json({ message: "Unauthorized" });

		// 1. Validate Input using the updated Zod Schema
		const parsed = settingsSchema.safeParse(req.body);

		if (!parsed.success) {
			return res.status(400).json({ success: false, errors: parsed.error.format() });
		}

		const payload = parsed.data;

		// 2. Check if a valid row exists
		const existing = await db.select().from(websiteSettings).where(eq(websiteSettings.isDeleted, false)).limit(1);

		let result;

		if (existing.length === 0) {
			// CREATE (if table is empty or only has deleted rows)
			result = await db.insert(websiteSettings).values(payload).returning();
		} else {
			// UPDATE (the active row)
			const id = existing[0].id;

			result = await db.update(websiteSettings).set(payload).where(eq(websiteSettings.id, id)).returning();
		}

		success(res, result[0], "Settings updated successfully");
	} catch (error) {
		next(error);
	}
};
