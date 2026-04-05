



import { authenticateCustomer, optionalAuthenticate } from "../middleware/customerAuth";
import {
    createAdminOrder,
    createOrder,
    getAllOrders,
    getOrder,
    getUserOrders,
    updateOrderStatus,
    paymentSuccess, 
    paymentFail,    
	paymentIpn
} from "../controllers/order.controller";
import { Router } from "express";
import { authenticateJWT, authorize } from "../middleware/auth";

const router = Router();

// --- SSL COMMERZ WEBHOOKS (Must be POST) ---
// Place these ABOVE /:id so Express doesn't confuse "ssl-success" for an ID
router.post("/ssl-success/:tran_id", paymentSuccess);
router.post("/ssl-fail/:tran_id", paymentFail);
router.post("/ssl-cancel/:tran_id", paymentFail);
router.post('/ssl-ipn', paymentIpn);

// --- ORDER ROUTES ---
router.post("/", optionalAuthenticate, createOrder);
router.get("/", authenticateJWT as any, authorize(["SUPER_ADMIN", "ADMIN"]) as any, getAllOrders as any);
router.get("/me", authenticateCustomer as any, getUserOrders as any);
router.get("/:id", getOrder);
router.patch("/:id", authenticateJWT as any, authorize(["SUPER_ADMIN", "ADMIN"]) as any, updateOrderStatus as any);
router.post("/admin", authenticateJWT as any, authorize(["SUPER_ADMIN", "ADMIN"]) as any, createAdminOrder as any);

export default router;