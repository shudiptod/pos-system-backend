import { authenticateCustomer, optionalAuthenticate } from "../middleware/customerAuth";
import { createAdminOrder, createOrder, getAllOrders, getOrder, getUserOrders, updateOrderStatus } from "../controllers/order.controller";
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

// update order status
router.patch("/:id", authenticateJWT as any, authorize(["SUPER_ADMIN", "ADMIN"]) as any, updateOrderStatus as any);


router.post("/admin", authenticateJWT as any, authorize(["SUPER_ADMIN", "ADMIN"]) as any, createAdminOrder as any);

export default router;