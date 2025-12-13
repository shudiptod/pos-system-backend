import { Request, Response } from "express";
import { db } from "../db";
import { eq, and, ilike, gte, lte, desc, asc, sql } from "drizzle-orm";
import { z } from "zod";
import { AuthRequest } from "../middleware/auth"; // Assuming you have this

// Import Models
import { products, createProductSchema } from "../models/product.model";
import { categories } from "../models/category.model";
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
      const newVariants = await tx.insert(productVariants).values(variantsWithProductId).returning();

      return { product: newProduct, variants: newVariants };
    });

    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    console.error(error);
    // Handle Unique Constraint errors (e.g., Duplicate Slug or SKU)
    if (error.code === "23505") {
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
    const [product] = await db.select().from(products).where(eq(products.id, id));

    if (!product) return res.status(404).json({ message: "Product not found" });

    // Fetch Associated Variants
    const variants = await db.select().from(productVariants).where(eq(productVariants.productId, id));

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
    // 1. Destructure query params
    const {
      category,
      search,
      minPrice,
      maxPrice,
      page = "1",
      limit = "12",
      sort = "newest",
    } = req.query as {
      category?: string;
      search?: string;
      minPrice?: string;
      maxPrice?: string;
      page?: string;
      limit?: string;
      sort?: "newest" | "oldest" | "price_asc" | "price_desc" | "name_asc";
    };

    // 2. Pagination Calculations
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(Math.max(1, parseInt(limit, 10) || 12), 100);
    const offset = (pageNum - 1) * limitNum;

    // 3. Build WHERE Conditions
    const conditions = [eq(products.isPublished, true)];

    // FILTER BY CATEGORY SLUG
    // If a category slug is provided, we filter the JOINED table 'categories'
    if (category) {
      conditions.push(eq(categories.slug, category));
    }

    if (search) {
      conditions.push(ilike(products.title, `%${search}%`));
    }

    if (minPrice) {
      conditions.push(gte(products.basePrice, parseInt(minPrice)));
    }

    if (maxPrice) {
      conditions.push(lte(products.basePrice, parseInt(maxPrice)));
    }

    // 4. Sorting Logic
    let orderByClause: any = desc(products.createdAt);
    switch (sort) {
      case "price_asc":
        orderByClause = asc(products.basePrice);
        break;
      case "price_desc":
        orderByClause = desc(products.basePrice);
        break;
      case "name_asc":
        orderByClause = asc(products.title);
        break;
      case "oldest":
        orderByClause = asc(products.createdAt);
        break;
      default:
        orderByClause = desc(products.createdAt);
        break;
    }

    // 5. Execute Queries
    const [data, totalCountResult] = await Promise.all([
      db
        .select({
          id: products.id,
          title: products.title,
          slug: products.slug,
          basePrice: products.basePrice,
          images: products.images,
          categoryId: products.categoryId,
          createdAt: products.createdAt,
          categoryName: categories.name,
          categorySlug: categories.slug,
        })
        .from(products)
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .where(and(...conditions))
        .orderBy(orderByClause)
        .limit(limitNum)
        .offset(offset),

      db
        .select({ count: sql<number>`count(*)` })
        .from(products)
        .leftJoin(categories, eq(products.categoryId, categories.id)) // <--- ADDED THIS
        .where(and(...conditions)),
    ]);

    const total = Number(totalCountResult[0]?.count || 0);
    const totalPages = Math.ceil(total / limitNum);

    res.json({
      success: true,
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
    });
  } catch (error: any) {
    console.error("Get Products Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch products" });
  }
};
