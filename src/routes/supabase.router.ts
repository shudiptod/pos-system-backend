


import { authenticateCustomer } from "../middleware/customerAuth";
import { getStorageLibrary, uploadFile } from "../controllers/supabase.controller";
import { authenticateJWT, authorize } from "../middleware/auth";
import { upload } from "../middleware/upload";
import { Router } from "express";

const router = Router();


// get all files and folders in storage library
router.get(
    "/library",
    authenticateJWT as any,
    authorize(["ADMIN", "SUPER_ADMIN", "MANAGER"]) as any,
    getStorageLibrary as any
);

// POST /api/upload
router.post(
    "/",
    authenticateJWT as any,
    authorize(["ADMIN", "SUPER_ADMIN", "MANAGER"]) as any,
    upload.single("file"), // Expect field name 'file'
    uploadFile
);

router.post(
    "/customer",
    authenticateCustomer as any,
    upload.single("file"), // Expect field name 'file'
    uploadFile
);

export default router;