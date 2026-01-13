import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { storeLocations, storeLocationSchema } from "../models/storeLocation.model";
import { eq, desc } from "drizzle-orm";
import { success, error } from "../utils/apiResponse";
import { ZodError } from "zod";
import { AuthRequest } from "../middleware/auth";

// GET ALL (Public) - Show active stores first
export const getLocations = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const locations = await db
            .select()
            .from(storeLocations)
            .where(eq(storeLocations.isActive, true))
            .orderBy(desc(storeLocations.createdAt));

        success(res, locations, "Store locations fetched successfully");
    } catch (err) {
        next(err);
    }
};

// GET SINGLE (Public/Admin)
export const getLocationById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const result = await db
            .select()
            .from(storeLocations)
            .where(eq(storeLocations.id, id))
            .limit(1);

        if (result.length === 0) {
            return error(res, "Store location not found", 404);
        }

        success(res, result[0]);
    } catch (err) {
        next(err);
    }
};

// CREATE (Admin Only)
export const createLocation = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        // Admin Only
        const user = req.user;
        if (!user) return res.status(401).json({ message: "Unauthorized" });
        // 1. Validate Input
        const payload = storeLocationSchema.parse(req.body);

        // 2. Insert into DB
        const [newLocation] = await db
            .insert(storeLocations)
            .values(payload)
            .returning();

        success(res, newLocation, "Store location added successfully", 201);
    } catch (err) {
        if (err instanceof ZodError) {
            return error(res, err.issues[0].message, 400);
        }
        next(err);
    }
};

// UPDATE (Admin Only)
export const updateLocation = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {

        const user = req.user;
        if (!user) return res.status(401).json({ message: "Unauthorized" });

        const { id } = req.params;

        // 1. Validate Input (Partial is okay if you want, but strictly validate the body)
        const payload = storeLocationSchema.partial().parse(req.body);

        // 2. Update
        const [updatedLocation] = await db
            .update(storeLocations)
            .set({
                ...payload,
                updatedAt: new Date(), // Force update timestamp
            })
            .where(eq(storeLocations.id, id))
            .returning();

        if (!updatedLocation) {
            return error(res, "Store location not found", 404);
        }

        success(res, updatedLocation, "Store location updated");
    } catch (err) {
        if (err instanceof ZodError) {
            return error(res, err.issues[0].message, 400);
        }
        next(err);
    }
};

// DELETE (Admin Only)
export const deleteLocation = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {

        const user = req.user;
        if (!user) return res.status(401).json({ message: "Unauthorized" });

        const { id } = req.params;

        const [deleted] = await db
            .delete(storeLocations)
            .where(eq(storeLocations.id, id))
            .returning();

        if (!deleted) {
            return error(res, "Store location not found", 404);
        }

        success(res, null, "Store location deleted successfully");
    } catch (err) {
        next(err);
    }
};