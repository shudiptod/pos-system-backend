import { Router } from "express";
import { getCart, addToCart, updateCartItem, removeCartItem } from "../controllers/cart.controller";

const router = Router();



router.get("/", getCart);
router.post("/items", addToCart);
router.patch("/items/:itemId", updateCartItem);
router.delete("/items/:itemId", removeCartItem);

export default router;