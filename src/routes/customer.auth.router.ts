
import { Router } from "express";
import { registerUser, loginUser, updateCustomer } from "../controllers/customer.auth.controller";
import { authenticateCustomer } from "../middleware/customerAuth";

const router = Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.patch("/update", authenticateCustomer, updateCustomer);

export default router;
