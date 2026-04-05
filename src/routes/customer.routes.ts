import { Router } from "express";
import { authenticateJWT, authorize } from "../middleware/auth";
import {
    createCustomer,
    getCustomers,
    getCustomerById,
    updateCustomer
} from "../controllers/customer.controller";

const router = Router();

// Require staff login for all customer actions
router.use(authenticateJWT as any);

// Create a new walk-in customer
router.post("/", authorize(["SUPER_ADMIN", "ADMIN", "MANAGER", "CASHIER"]) as any, createCustomer as any);

// Search/list customers (useful for typeahead in POS)
router.get("/", authorize(["SUPER_ADMIN", "ADMIN", "MANAGER", "CASHIER"]) as any, getCustomers as any);

// Get specific customer profile
router.get("/:id", authorize(["SUPER_ADMIN", "ADMIN", "MANAGER", "CASHIER"]) as any, getCustomerById as any);

// Update customer details
router.patch("/:id", authorize(["SUPER_ADMIN", "ADMIN", "MANAGER"]) as any, updateCustomer as any);

export default router;