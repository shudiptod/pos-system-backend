// import { Router } from "express";
// import { createOrder, dispatchOrder } from "../controllers/order.controller";
// import { authenticateJWT } from "../middleware/auth";
// import { authorizeResource } from "../middleware/permissions";

// const router = Router();

// // Create order
// router.post("/", authenticateJWT, authorizeResource("order", "create"), createOrder);

// // Dispatch order
// router.post("/dispatch/:id", authenticateJWT, authorizeResource("order", "dispatch"), dispatchOrder);

// export default router;
