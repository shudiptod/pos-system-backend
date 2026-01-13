import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { settingsSchema, websiteSettings } from "../models/websiteSettings.model";
import { success } from "../utils/apiResponse";
import { AuthRequest } from "../middleware/auth";
import { eq } from "drizzle-orm";

// GET: Fetch the one and only settings row
export const getSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const settings = await db.select().from(websiteSettings).limit(1);

        // If no settings exist yet, return an empty object or default values
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

        console.log("update settings");

        const user = req.user;
        if (!user) return res.status(401).json({ message: "Unauthorized" });

        // 1. Validate Input
        const payload = settingsSchema.parse(req.body);

        console.log("payload", payload);

        // 2. Check if row exists
        const existing = await db.select().from(websiteSettings).limit(1);

        let result;

        if (existing.length === 0) {
            // CREATE (if table is empty)
            result = await db.insert(websiteSettings).values(payload).returning();
        } else {
            // UPDATE (the first row found)
            const id = existing[0].id;
            result = await db
                .update(websiteSettings)
                .set(payload)
                .where(eq(websiteSettings.id, id)) // Pseudo-code (fix below)
                .returning();
        }

        success(res, result[0], "Settings updated successfully");
    } catch (error) {
        next(error);
    }
};