import { NextFunction, Request, Response } from "express";
import { db } from "../db";
import { eq, and, ilike, gte, lte, desc, asc, sql, inArray, or, not } from "drizzle-orm";
import { z } from "zod";
import { AuthRequest } from "../middleware/auth";

// Models
import { products, createProductSchema } from "../models/product.model";
import { categories } from "../models/category.model";
import { productVariants, createVariantSchema } from "../models/productVariant.model";
import { generateSlug } from "../utils/slugify";

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

export const createProduct = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });


    const rawBody = req.body || {};
    let variants = rawBody.variants || [];

    // Safety check if variants is undefined
    if (!Array.isArray(variants)) {
      variants = [];
    }


    const cleanedVariants = variants.map((v: any) => {

      let cleanOptions: Record<string, string> | undefined = undefined;

      if (v.options && typeof v.options === 'object') {
        cleanOptions = {};
        Object.keys(v.options).forEach((key) => {
          const val = v.options[key];

          cleanOptions![key] = typeof val === 'string' ? val : String(val);
        });
      }

      let cleanImages: string[] = [];
      if (Array.isArray(v.images)) {
        cleanImages = v.images.filter((img: any) => typeof img === 'string');
      }

      let responseObject = {
        ...v,
        title: v.title || "Default",
        price: Number(v.price) || 0,
        stock: Number(v.stock) || 0,
        images: cleanImages,
        options: cleanOptions,
        sku: v.sku || null,
        barcode: v.barcode || null
      };

      if (typeof v.video === 'string') {
        responseObject.video = v.video;
      }

      return responseObject;
    });

    const cleanedData = {
      ...rawBody,
      isPublished: rawBody.isPublished === true,
      variants: cleanedVariants
    };


    const parsed = incomingPayloadSchema.safeParse(cleanedData);

    if (!parsed.success) {
      console.error("Validation Error:", JSON.stringify(parsed.error.format(), null, 2));
      return res.status(400).json({ success: false, errors: parsed.error.format() });
    }

    const data = parsed.data;


    const result = await db.transaction(async (tx) => {
      const [newProduct] = await tx.insert(products).values({
        title: data.title,
        description: data.description,
        categoryId: data.categoryId,
        slug: data.slug,
        isPublished: data.isPublished ?? true,
        createdByAdminId: user.id,
        updatedByAdminId: user.id,
      }).returning();

      if (data.variants && data.variants.length > 0) {
        const rows = data.variants.map((v) => ({
          productId: newProduct.id,
          title: v.title,
          price: String(v.price),
          stock: v.stock,
          barcode: v.barcode,
          images: v.images,
          video: v.video,
          sku: v.sku,
          options: v.options,
        }));

        const newVariants = await tx.insert(productVariants).values(rows).returning();
        return { product: newProduct, variants: newVariants };
      }

      return { product: newProduct, variants: [] };
    });

    res.status(201).json({ success: true, data: result });

  } catch (error: any) {
    console.error("Create Product Error:", error);
    next(error);
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
      minPrice?: string;
      maxPrice?: string;
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

    // Ensure minPrice/maxPrice are handled safely (Drizzle expects strings for decimal cols)
    if (minPrice) whereConditions.push(gte(productVariants.price, minPrice));
    if (maxPrice) whereConditions.push(lte(productVariants.price, maxPrice));

    // --- Sorting Strategy ---
    let orderByClause: any = desc(products.createdAt);

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

          // 🔥 FIXED LINE: Extract scalar string first, then aggregate
          thumbnail: sql<string>`(array_agg(${productVariants.images}[1]))[1]`,
        })
        .from(products)
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .leftJoin(productVariants, eq(products.id, productVariants.productId))
        .where(and(...whereConditions))
        .groupBy(
          products.id,
          products.title,
          products.slug,
          products.createdAt,
          categories.id,
          categories.name,
          categories.slug
        )
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
    // Return the actual error message to help debugging
    res.status(500).json({ success: false, message: "Failed to fetch products", error: error.message });
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


// ---------------------------------------------------------
// 5. UPDATE PRODUCT
// ---------------------------------------------------------

export const updateProduct = async (req: AuthRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ message: "Unauthorized" });
  // Implementation for updating a product goes here
  try {
    const { id } = req.params;
    const { title, description, categoryId } = req.body;

    // check if new title or slug already exists for other products
    const existingProduct = await db
      .select()
      .from(products)
      .where(
        and(
          not(eq(products.id, id)),
          or(eq(products.title, title), eq(products.slug, generateSlug(title)))
        )
      )
      .limit(1);

    if (existingProduct.length > 0) {
      return res.status(400).json({ message: "Product title already exists" });
    }

    const [product] = await db
      .update(products)
      .set({ title, description, categoryId, slug: generateSlug(title), updatedByAdminId: user.id })
      .where(eq(products.id, id))
      .returning();

    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json({ success: true, data: product });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}


export const deleteProduct = async (req: AuthRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ message: "Unauthorized" });
  // Implementation for deleting a product goes here
  try {
    const { id } = req.params;

    const deletedCount = await db
      .delete(products)
      .where(eq(products.id, id))
      .returning()
      .then((rows) => rows.length);

    if (deletedCount === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json({ success: true, message: "Product deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
}