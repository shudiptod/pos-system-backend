
import { Router } from "express";
import { authenticateJWT, authorize } from "../middleware/auth";
import { getDynamicSalesReport, getDashboardOverview } from "../controllers/report.controller";


const router = Router();

// Staff must be logged in to process or view orders
router.use(authenticateJWT as any);


router.post("/sales", authorize(["SUPER_ADMIN", "ADMIN", "MANAGER", "CASHIER"]) as any, getDynamicSalesReport as any);
router.get("/dashboard", authorize(["SUPER_ADMIN", "ADMIN", "MANAGER", "CASHIER"]) as any, getDashboardOverview as any);

export default router;