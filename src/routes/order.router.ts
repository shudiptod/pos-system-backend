import { optionalAuthenticate } from "../middleware/customerAuth";
import { cancelOrder, createOrder, getOrder } from "../controllers/order.controller";
import { Router } from "express";

const router = Router();

// POST /api/orders (Place new order)
router.post("/", optionalAuthenticate, createOrder);

// GET /api/orders/:id (View order receipt)
router.get("/:id", getOrder);

// POST /api/orders/:id/cancel (Cancel & Restock)
router.post("/:id/cancel", cancelOrder);

export default router;