import { Router } from "express";
import { createCustomer } from "../controllers/create.customer.auth.controller";
import { authenticateJWT } from "../middleware/auth";
import { authorizeResource } from "../middleware/permissions";

const router = Router();

// Only allowed roles can create a customer
router.post("/", authenticateJWT as any, authorizeResource("customer", "create"), createCustomer as any);

export default router;
