// // src/routes/product.routes.ts
// import { Router } from "express";
// import {
//   getProducts,
//   getProductById,
//   createProduct,
//   updateProduct,
//   deleteProduct,
// } from "../controllers/product.controller";
// import { requireAdmin, requireAdminOrHigher } from "../middleware/adminAuth";
// import { validate } from "../middleware/validate";
// import {
//   createProductSchema,
//   updateProductSchema,
// } from "../models/product.model";

// const router = Router();

// // PUBLIC ROUTES
// router.get("/", getProducts);
// router.get("/:id", getProductById);

// // ADMIN PROTECTED ROUTES
// router.post(
//   "/",
//   requireAdmin,
//   validate(createProductSchema),
//   createProduct
// );

// router.put(
//   "/:id",
//   requireAdminOrHigher,
//   validate(updateProductSchema),
//   updateProduct
// );

// router.delete(
//   "/:id",
//   requireAdminOrHigher,
//   deleteProduct
// );

// export default router;



// import { Router } from "express";
// import { createProduct, updateProduct, deleteProduct } from "../controllers/product.controller";
// import { authenticateJWT } from "../middleware/auth";
// import { authorizeResource } from "../middleware/permissions";

// const router = Router();

// router.post("/", authenticateJWT, authorizeResource("product", "create"), createProduct);
// router.put("/:id", authenticateJWT, authorizeResource("product", "update"), updateProduct);
// router.delete("/:id", authenticateJWT, authorizeResource("product", "delete"), deleteProduct);

// export default router;



// new code


// import { Router } from "express";
// import { createProduct } from "../controllers/product.controller";
// import { authenticateJWT } from "../middleware/auth";
// import { authorizeResource } from "../middleware/permissions";

// const router = Router();

// router.post("/", authenticateJWT, authorizeResource("product", "create"), createProduct);

// export default router;


import { Router } from "express";
import { authenticateJWT, authorize } from "../middleware/auth"; 
import { createCategory, getCategories } from "../controllers/category.controller";
import { createProduct, getProductById, getProducts } from "../controllers/product.controller";
import { updateVariant } from "../controllers/variant.controller";



const router = Router();


router.post("/categories", authenticateJWT as any,authorize(["SUPER_ADMIN", "ADMIN"]) as any,   createCategory);
router.get("/categories", getCategories);

router.post(
  "/", 
  authenticateJWT as any, 
  authorize(["SUPER_ADMIN", "ADMIN"]) as any, 
  createProduct as any
);


router.get("/:id", getProductById);
router.patch("/variants/:id", authenticateJWT as any, authorize(["SUPER_ADMIN", "ADMIN"]) as any,  updateVariant);
router.get("/", getProducts as any); 

export default router;