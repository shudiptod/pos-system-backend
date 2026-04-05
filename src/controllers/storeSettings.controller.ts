// src/controllers/storeSettings.controller.ts
import { Request, Response } from "express";
import { db } from "../db";
import { settingsSchema, storeSettings } from "../models/storeSettings.model";
import { AuthRequest } from "../middleware/auth";
import { eq } from "drizzle-orm";

export const getSettings = async (req: Request, res: Response) => {
	try {
		const settings = await db.select().from(storeSettings).where(eq(storeSettings.isDeleted, false)).limit(1);
		if (settings.length === 0) return res.status(200).json({ success: true, data: null });
		res.status(200).json({ success: true, data: settings[0] });
	} catch (error: any) {
		res.status(500).json({ success: false, message: error.message });
	}
};

export const updateSettings = async (req: AuthRequest, res: Response) => {
	try {
		const parsed = settingsSchema.safeParse(req.body);
		if (!parsed.success) return res.status(400).json({ success: false, errors: parsed.error.format() });

		const existing = await db.select().from(storeSettings).where(eq(storeSettings.isDeleted, false)).limit(1);

		let result;
		if (existing.length === 0) {
			result = await db.insert(storeSettings).values(parsed.data).returning();
		} else {
			result = await db.update(storeSettings).set(parsed.data).where(eq(storeSettings.id, existing[0].id)).returning();
		}

		res.status(200).json({ success: true, data: result[0], message: "Settings updated successfully" });
	} catch (error: any) {
		res.status(500).json({ success: false, message: error.message });
	}
};