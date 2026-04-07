
import { Router } from "express";
import { authenticateJWT, authorize } from "../middleware/auth";
import { getSalesReport } from "../controllers/report.controller";


const router = Router();

// Staff must be logged in to process or view orders
router.use(authenticateJWT as any);

// Create a new POS checkout order
router.get("/sales", authorize(["SUPER_ADMIN", "ADMIN", "MANAGER", "CASHIER"]) as any, getSalesReport as any);

export default router;