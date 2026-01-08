import { Router } from "express";
import { upload } from "../middleware/upload"; // Re-use your multer middleware
import { uploadFile } from "@/routes/upload.router";
import { authenticateJWT, authorize } from "@/middleware/auth";


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