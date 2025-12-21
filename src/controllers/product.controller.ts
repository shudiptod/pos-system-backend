import { Request, Response } from "express";
import { db } from "../db";
import { eq, and, ilike, gte, lte, desc, asc, sql, inArray } from "drizzle-orm";
import { z } from "zod";
import { AuthRequest } from "../middleware/auth";

// Models
import { products, createProductSchema } from "../models/product.model";
import { categories } from "../models/category.model";
import { productVariants, createVariantSchema } from "../models/productVariant.model";

// ---------------------------------------------------------
// 1. CREATE PRODUCT (Transaction: Parent + Variants)
// ---------------------------------------------------------

// Schema that accepts either explicit 'variants' OR flat fields (for single products)
const incomingPayloadSchema = createProductSchema.extend({
  // Option A: Explicit Variants Array
  variants: z.array(createVariantSchema).optional(),

  // Option B: Flat fields (for single products without variants)
  barcode: z.string().optional(),
  price: z.number().optional(),
  stock: z.number().optional(),
  images: z.array(z.string().url()).optional(),
  video: z.string().url().optional(),
  sku: z.string().optional(),
});

export const createProduct = async (req: AuthRequest, res: Response) => {
  try {
    // 1. Validate Payload
    const parsed = incomingPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, errors: parsed.error.format() });
    }

    const data = parsed.data;
    const adminId = (req as any).user?.id;

    // 2. Normalize Variants
    // If 'variants' array exists, use it. Otherwise, create one "Default" variant from flat fields.
    let variantsToInsert: any[] = [];

    if (data.variants && data.variants.length > 0) {
      variantsToInsert = data.variants;
    } else if (data.price !== undefined) {
      // Logic for "Single Product" (No variants selected in frontend)
      variantsToInsert = [{
        title: "Default", // Internal name
        price: data.price,
        stock: data.stock || 0,
        barcode: data.barcode,
        images: data.images || [],
        video: data.video,
        sku: data.sku,
      }];
    } else {
      return res.status(400).json({ success: false, message: "Product must have at least one variant or a price." });
    }

    // 3. Database Transaction
    const result = await db.transaction(async (tx) => {
      // A. Insert Parent Product (General Info)
      const [newProduct] = await tx
        .insert(products)
        .values({
          title: data.title,
          description: data.description,
          categoryId: data.categoryId,
          slug: data.slug,
          isPublished: data.isPublished ?? true, // Default to true if not sent
          createdByAdminId: adminId,
          updatedByAdminId: adminId,
        })
        .returning();

      // B. Attach Product ID to Variants
      const rows = variantsToInsert.map((v) => ({
        productId: newProduct.id,
        title: v.title,
        price: v.price,
        stock: v.stock,
        barcode: v.barcode,
        images: v.images, // Array of URLs
        video: v.video,
        sku: v.sku,
      }));

      // C. Insert Variants
      const newVariants = await tx.insert(productVariants).values(rows).returning();

      return { product: newProduct, variants: newVariants };
    });

    res.status(201).json({ success: true, data: result });

  } catch (error: any) {
    console.error("Create Product Error:", error);
    if (error.code === "23505") {
      return res.status(409).json({ success: false, message: "Duplicate Slug, SKU, or Barcode detected" });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------------------------------------------------------
// 2. GET SINGLE PRODUCT (With All Variants)
// ---------------------------------------------------------
export const getProductById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // 1. Fetch Product details
    const [product] = await db
      .select({
        id: products.id,
        title: products.title,
        description: products.description,
        slug: products.slug,
        categoryId: products.categoryId,
        categoryName: categories.name,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(eq(products.id, id));

    if (!product) return res.status(404).json({ message: "Product not found" });

    // 2. Fetch All Variants for this product
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
// 3. GET ALL PRODUCTS (Catalog List)
// ---------------------------------------------------------


export const getProducts = async (req: Request, res: Response) => {
  try {
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
      minPrice?: string; // Type as string
      maxPrice?: string; // Type as string
      page?: string;
      limit?: string;
      sort?: string;
    };

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(Math.max(1, Number(limit)), 100);
    const offset = (pageNum - 1) * limitNum;

    // --- Build Conditions ---
    const whereConditions = [eq(products.isPublished, true)];

    if (category) whereConditions.push(eq(categories.slug, category));
    if (search) whereConditions.push(ilike(products.title, `%${search}%`));

    // FIX: Remove Number() wrapper. 
    // Drizzle 'decimal' columns expect string inputs for comparison.
    if (minPrice) whereConditions.push(gte(productVariants.price, minPrice));
    if (maxPrice) whereConditions.push(lte(productVariants.price, maxPrice));

    // --- Sorting Strategy ---
    let orderByClause: any = desc(products.createdAt);

    // Logic: Sort by the minimum price available for that product
    if (sort === "price_asc") orderByClause = asc(sql`min(${productVariants.price})`);
    if (sort === "price_desc") orderByClause = desc(sql`min(${productVariants.price})`);
    if (sort === "name_asc") orderByClause = asc(products.title);
    if (sort === "oldest") orderByClause = asc(products.createdAt);

    // --- EXECUTE QUERY ---
    const [data, totalCountResult] = await Promise.all([
      db
        .select({
          id: products.id,
          title: products.title,
          slug: products.slug,
          categoryName: categories.name,
          categorySlug: categories.slug,
          createdAt: products.createdAt,
          // Aggregates
          minPrice: sql<number>`min(${productVariants.price})`,
          maxPrice: sql<number>`max(${productVariants.price})`,
          stock: sql<number>`sum(${productVariants.stock})`,
          thumbnail: sql<string>`(array_agg(${productVariants.images}))[1][1]`,
        })
        .from(products)
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .leftJoin(productVariants, eq(products.id, productVariants.productId))
        .where(and(...whereConditions))
        .groupBy(products.id, categories.id, categories.name, categories.slug)
        .orderBy(orderByClause)
        .limit(limitNum)
        .offset(offset),

      // Count Query
      db
        .select({ count: sql<number>`count(distinct ${products.id})` })
        .from(products)
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .leftJoin(productVariants, eq(products.id, productVariants.productId))
        .where(and(...whereConditions)),
    ]);

    const total = Number(totalCountResult[0]?.count || 0);

    res.json({
      success: true,
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });

  } catch (error: any) {
    console.error("Get Products Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch products" });
  }
};



// ---------------------------------------------------------
// 4. GET SINGLE PRODUCT by slug (With All Variants)
// ---------------------------------------------------------
export const getProductBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    // 1. Fetch Product details
    const [product] = await db
      .select({
        id: products.id,
        title: products.title,
        description: products.description,
        slug: products.slug,
        categoryId: products.categoryId,
        categoryName: categories.name,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(eq(products.slug, slug));

    if (!product) return res.status(404).json({ message: "Product not found" });

    // 2. Fetch All Variants for this product
    const variants = await db
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, product.id));

    res.json({ success: true, data: { ...product, variants } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};