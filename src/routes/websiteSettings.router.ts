import { authenticateJWT, authorize } from "../middleware/auth";
import { getSettings, updateSettings } from "../controllers/websiteSettings.controller";
import { Router } from "express";

const router = Router();

// Public can view settings (for footer, header, etc.)
router.get("/", getSettings);

// Only Admin can update
router.patch("/", authenticateJWT as any, authorize(["SUPER_ADMIN", "ADMIN"]) as any, updateSettings as any);

export default router;