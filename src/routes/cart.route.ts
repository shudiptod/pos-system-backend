// src/routes/cart.route.ts
import { Router } from "express";
import { getCart, addToCart, updateCartItem, removeCartItem } from "../controllers/cart.controller";
import { optionalAuthenticate } from "../middleware/customerAuth";

const router = Router();

router.get("/", optionalAuthenticate, getCart);
router.post("/items", optionalAuthenticate, addToCart);
router.patch("/items/:itemId", optionalAuthenticate, updateCartItem);
router.delete("/items/:itemId", optionalAuthenticate, removeCartItem);

export default router;
