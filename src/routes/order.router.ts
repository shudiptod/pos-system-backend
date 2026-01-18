import { authenticateCustomer, optionalAuthenticate } from "../middleware/customerAuth";
import { cancelOrder, createOrder, getAllOrders, getOrder, getUserOrders } from "../controllers/order.controller";
import { Router } from "express";
import { authenticateJWT, authorize } from "../middleware/auth";

const router = Router();

// POST /api/orders (Place new order)
router.post("/", optionalAuthenticate, createOrder);

// get all orders
router.get("/", authenticateJWT as any, authorize(["SUPER_ADMIN", "ADMIN"]) as any, getAllOrders as any);

router.get("/me", authenticateCustomer as any, getUserOrders as any);

// GET /api/orders/:id (View order receipt)
router.get("/:id", getOrder);


// POST /api/orders/:id/cancel (Cancel & Restock)
router.post("/:id/cancel", cancelOrder);

export default router;