import { Router } from "express";
import { getStorageLibrary, uploadFile } from "../controllers/supabase.controller";
import { authenticateJWT, authorize } from "../middleware/auth";
import { upload } from "../middleware/upload";

const router = Router();

// Get all files in storage library
router.get(
    "/library",
    authenticateJWT as any,
    authorize(["ADMIN", "SUPER_ADMIN", "MANAGER"]) as any,
    getStorageLibrary as any
);

// Upload a new file (e.g., product image)
router.post(
    "/",
    authenticateJWT as any,
    authorize(["ADMIN", "SUPER_ADMIN", "MANAGER"]) as any,
    upload.single("file"),
    uploadFile as any
);

export default router;