import { Router } from "express";
import { authenticateJWT, authorize } from "../middleware/auth";
import { getSettings, updateSettings } from "../controllers/storeSettings.controller";

const router = Router();

// Staff fetching settings (e.g., for printing the store logo/address on the invoice)
router.get("/", authenticateJWT as any, getSettings as any);

// Only Admins can update store details
router.patch("/", authenticateJWT as any, authorize(["SUPER_ADMIN", "ADMIN"]) as any, updateSettings as any);

export default router;