import { Router } from "express";
import {
    getLocations,
    getLocationById,
    createLocation,
    updateLocation,
    deleteLocation
} from "../controllers/storeLocation.controller";
import { authenticateJWT, authorize } from "../middleware/auth";



const router = Router();

// ==========================================
// PUBLIC ROUTES
// ==========================================
router.get("/", getLocations);
router.get("/:id", getLocationById);

// ==========================================
// PROTECTED ROUTES (Admin Only)
// ==========================================
router.post("/", authenticateJWT as any, authorize(["SUPER_ADMIN", "ADMIN"]) as any, createLocation as any);
router.patch("/:id", authenticateJWT as any, authorize(["SUPER_ADMIN", "ADMIN"]) as any, updateLocation as any);
router.delete("/:id", authenticateJWT as any, authorize(["SUPER_ADMIN", "ADMIN"]) as any, deleteLocation as any);

export default router;