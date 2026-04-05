// src/routes/customer.auth.router.ts
import { Router } from "express";
import { 
  registerUser, 
  loginUser, 
  updateCustomer, 
  getCustomerInfo
} from "../controllers/customer.auth.controller";
import { authenticateCustomer } from "../middleware/customerAuth";

const router = Router();

router.post("/register", registerUser);
router.post("/login", loginUser);


router.get("/info", authenticateCustomer, getCustomerInfo);

router.patch("/update", authenticateCustomer, updateCustomer);

export default router;