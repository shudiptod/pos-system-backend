import { Router } from "express";
import { authenticateJWT, authorize } from "../middleware/auth";
import {
    createPosOrder,
    getAllOrders,
    getOrderById,
    updateOrderStatus
} from "../controllers/order.controller";

const router = Router();

// Staff must be logged in to process or view orders
router.use(authenticateJWT as any);

// Create a new POS checkout order
router.post("/checkout", authorize(["SUPER_ADMIN", "ADMIN", "MANAGER", "CASHIER"]) as any, createPosOrder as any);

// View sales history
router.get("/", authorize(["SUPER_ADMIN", "ADMIN", "MANAGER", "CASHIER"]) as any, getAllOrders as any);

// View single receipt/order details
router.get("/:id", authorize(["SUPER_ADMIN", "ADMIN", "MANAGER", "CASHIER"]) as any, getOrderById as any);

// Update order status (e.g., issue refund)
router.patch("/:id/status", authorize(["SUPER_ADMIN", "ADMIN", "MANAGER"]) as any, updateOrderStatus as any);

export default router;