


import { uploadFile } from "../controllers/upload.controller";
import { authenticateJWT, authorize } from "../middleware/auth";
import { upload } from "../middleware/upload";
import { Router } from "express";

const router = Router();

// POST /api/upload
router.post(
    "/",
    authenticateJWT as any,
    authorize(["ADMIN", "SUPER_ADMIN", "MANAGER"]) as any,
    upload.single("file"), // Expect field name 'file'
    uploadFile
);

export default router;