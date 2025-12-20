import { Router } from "express";
import { loginAdmin, createAdmin, updateAdmin,getCustomers,getCustomer } from "../controllers/admin.auth.controller";
import { authenticateJWT } from "../middleware/auth";

const router = Router();

// Login route (any role)
router.post("/login", loginAdmin as any);

// Create admin/manager/technician based on hierarchy
router.post("/", authenticateJWT as any, createAdmin as any);

// Update admin info/role based on hierarchy
router.put("/:id", authenticateJWT as any, updateAdmin as any);

router.get("/customers",authenticateJWT as any,getCustomers as any)
router.get("/customers/:id",authenticateJWT as any,getCustomer as any)

export default router;
