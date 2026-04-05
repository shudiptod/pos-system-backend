import { Router } from "express";
import {
    loginAdmin,
    createAdmin,
    updateAdmin,
    getAdminInfo,
    getAllAdmins,
    logoutAdmin
} from "../controllers/admin.auth.controller";
import { authenticateJWT, authorize } from "../middleware/auth";

const router = Router();

// Auth routes
router.post("/login", loginAdmin as any);
router.post("/logout", logoutAdmin as any);

// Get current logged-in staff info
router.get("/me", authenticateJWT as any, getAdminInfo as any);

// Staff management
router.get("/", authenticateJWT as any, authorize(["SUPER_ADMIN", "ADMIN"]) as any, getAllAdmins as any);
router.post("/", authenticateJWT as any, authorize(["SUPER_ADMIN", "ADMIN"]) as any, createAdmin as any);
router.put("/:id", authenticateJWT as any, authorize(["SUPER_ADMIN", "ADMIN"]) as any, updateAdmin as any);

export default router;