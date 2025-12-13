// // src/controllers/product.controller.ts
// import { Request, Response } from "express";
// import { eq, and, like, gte, lte, sql, desc, asc } from "drizzle-orm";
// import { db } from "../db/index";
// import { products } from "../models/product.model";

// // 1. GET ALL PRODUCTS (With filters/sort/pagination)
// export const getProducts = async (req: Request, res: Response) => {
//   try {
//     const {
//       collection,
//       category,
//       search,
//       minPrice,
//       maxPrice,
//       page = "1",
//       limit = "20",
//       sort = "newest",
//     } = req.query as {
//       collection?: string;
//       category?: string;
//       search?: string;
//       minPrice?: string;
//       maxPrice?: string;
//       page?: string;
//       limit?: string;
//       sort?: "newest" | "oldest" | "price_asc" | "price_desc" | "name_asc";
//     };

//     const pageNum = Math.max(1, parseInt(page, 10) || 1);
//     const limitNum = Math.min(Math.max(1, parseInt(limit, 10) || 20), 100);
//     const offset = (pageNum - 1) * limitNum;

//     // Build WHERE conditions
//     const conditions = [eq(products.isActive, true)];

//     if (collection) conditions.push(eq(products.collection, collection));
//     if (category) conditions.push(eq(products.category, category));
//     if (search) conditions.push(like(products.name, `%${search}%`));
//     if (minPrice) conditions.push(gte(products.priceCents, Number(minPrice)));
//     if (maxPrice) conditions.push(lte(products.priceCents, Number(maxPrice)));

//     // Sorting Logic
//     let orderByClause: any = desc(products.createdAt);

//     switch (sort) {
//       case "price_asc":
//         orderByClause = asc(products.priceCents);
//         break;
//       case "price_desc":
//         orderByClause = desc(products.priceCents);
//         break;
//       case "name_asc":
//         orderByClause = asc(products.name);
//         break;
//       case "oldest":
//         orderByClause = asc(products.createdAt);
//         break;
//       default:
//         orderByClause = desc(products.createdAt);
//         break;
//     }

//     // Execute queries in parallel
//     const [items, totalResult] = await Promise.all([
//       db
//         .select({
//           id: products.id,
//           name: products.name,
//           slug: products.slug,
//           description: products.description,
//           priceCents: products.priceCents,
//           imagePath: products.imagePath,
//           stock: products.stock,
//           category: products.category,
//           collection: products.collection,
//           isActive: products.isActive,
//           createdAt: products.createdAt,
//           updatedAt: products.updatedAt,
//         })
//         .from(products)
//         .where(and(...conditions))
//         .orderBy(orderByClause)
//         .limit(limitNum)
//         .offset(offset),

//       db
//         .select({ count: sql<number>`count(*)` })
//         .from(products)
//         .where(and(...conditions))
//         .then((r) => Number(r[0].count)),
//     ]);

//     res.json({
//       success: true,
//       data: items,
//       pagination: {
//         page: pageNum,
//         limit: limitNum,
//         total: totalResult,
//         totalPages: Math.ceil(totalResult / limitNum),
//         hasNext: pageNum < Math.ceil(totalResult / limitNum),
//         hasPrev: pageNum > 1,
//       },
//     });
//   } catch (error: any) {
//     console.error("Product fetch error:", error);
//     res.status(500).json({
//       success: false,
//       message: error.message || "Failed to fetch products",
//     });
//   }
// };

// // 2. GET SINGLE PRODUCT
// export const getProductById = async (req: Request, res: Response) => {
//   try {
//     const { id } = req.params;

//     const result = await db
//       .select()
//       .from(products)
//       .where(and(eq(products.id, id), eq(products.isActive, true)))
//       .limit(1);

//     if (!result[0]) {
//       return res.status(404).json({ success: false, message: "Product not found" });
//     }

//     res.json({ success: true, data: result[0] });
//   } catch (error) {
//     res.status(500).json({ success: false, message: "Server error" });
//   }
// };

// // 3. CREATE PRODUCT (Admin)
// export const createProduct = async (req: Request, res: Response) => {
//   try {
//     const result = await db
//       .insert(products)
//       .values({
//         ...(req as any).validatedData,
//         createdByAdminId: (req as any).user!.id,
//       })
//       .returning();

//     res.status(201).json({
//       success: true,
//       message: "Product created successfully",
//       data: result[0],
//     });
//   } catch (error: any) {
//     res.status(500).json({
//       success: false,
//       message: error.message || "Failed to create product",
//     });
//   }
// };

// // 4. UPDATE PRODUCT (Manager+)
// export const updateProduct = async (req: Request, res: Response) => {
//   try {
//     const { id } = req.params;

//     const result = await db
//       .update(products)
//       .set({ ...(req as any).validatedData, updatedAt: new Date() })
//       .where(eq(products.id, id))
//       .returning();

//     if (result.length === 0) {
//       return res.status(404).json({ success: false, message: "Product not found" });
//     }

//     res.json({
//       success: true,
//       message: "Product updated successfully",
//       data: result[0],
//     });
//   } catch (error: any) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// };

// // 5. DELETE PRODUCT (Manager+)
// export const deleteProduct = async (req: Request, res: Response) => {
//   try {
//     const { id } = req.params;

//     const result = await db
//       .delete(products)
//       .where(eq(products.id, id))
//       .returning();

//     if (result.length === 0) {
//       return res.status(404).json({ success: false, message: "Product not found" });
//     }

//     res.status(204).send();
//   } catch (error) {
//     res.status(500).json({ success: false, message: "Failed to delete product" });
//   }
// };




import { Request, Response } from "express";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { AuthRequest } from "../middleware/auth"; // Assuming you have this

// Import Models
import { products, createProductSchema } from "../models/product.model";
import { productVariants, createVariantSchema } from "../models/productVariant.model";

// --- COMPOSITE SCHEMA FOR API REQUEST ---
// We extend the base product schema to expect an array of variants
const createProductWithVariantsSchema = createProductSchema.extend({
  variants: z.array(createVariantSchema).min(1, "At least one variant is required"),
});

// ---------------------------------------------------------
// 1. CREATE PRODUCT + VARIANTS (Transactional)
// ---------------------------------------------------------
export const createProduct = async (req: AuthRequest, res: Response) => {
  try {
    // 1. Validate the combined payload
    const parsed = createProductWithVariantsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, errors: parsed.error.format() });
    }

    const { variants, ...productData } = parsed.data;
    const adminId = req.user?.id; // From Auth Middleware

    // 2. Start Transaction
    const result = await db.transaction(async (tx) => {
      
      // A. Insert Product
      const [newProduct] = await tx
        .insert(products)
        .values({
          ...productData,
          createdByAdminId: adminId,
          updatedByAdminId: adminId,
        })
        .returning();

      // B. Prepare Variants (Attach the new Product ID)
      const variantsWithProductId = variants.map((v) => ({
        ...v,
        productId: newProduct.id,
      }));

      // C. Insert Variants
      const newVariants = await tx
        .insert(productVariants)
        .values(variantsWithProductId)
        .returning();

      return { product: newProduct, variants: newVariants };
    });

    res.status(201).json({ success: true, data: result });

  } catch (error: any) {
    console.error(error);
    // Handle Unique Constraint errors (e.g., Duplicate Slug or SKU)
    if (error.code === '23505') {
      return res.status(409).json({ success: false, message: "Duplicate Slug or SKU detected" });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------------------------------------------------------
// 2. GET SINGLE PRODUCT (With Variants)
// ---------------------------------------------------------
export const getProductById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Fetch Product
    const [product] = await db
        .select()
        .from(products)
        .where(eq(products.id, id));

    if (!product) return res.status(404).json({ message: "Product not found" });

    // Fetch Associated Variants
    const variants = await db
        .select()
        .from(productVariants)
        .where(eq(productVariants.productId, id));

    res.json({ success: true, data: { ...product, variants } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------------------------------------------------------
// 3. GET ALL PRODUCTS (Pagination)
// ---------------------------------------------------------
export const getProducts = async (req: Request, res: Response) => {
  try {
    const limit = 10;
    // Simple fetch. For advanced filtering, you'd add WHERE clauses here.
    const allProducts = await db.select().from(products).limit(limit);
    
    res.json({ success: true, data: allProducts });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};