import { Request, Response } from "express";
import { db } from "../db";
import { eq, and, ilike, gte, lte, desc, asc, sql, inArray } from "drizzle-orm";
import { z } from "zod";
import { AuthRequest } from "../middleware/auth";

// Models
import { products, createProductSchema } from "../models/product.model";
import { categories } from "../models/category.model";
import { productVariants, createVariantSchema } from "../models/productVariant.model";
import { uploadImageToSupabase } from "../lib/supabase";

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

export const createProduct = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthRequest).user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    // 1. INITIALIZE VARIANTS MAP
    // We do this to ensure we have a clean structure to work with, 
    // ignoring whatever messy structure req.body might have initially for arrays.
    const rawBody = req.body || {};
    let variants = rawBody.variants || [];

    // Ensure variants is an array (sometimes parser makes it an object: { '0': {}, '1': {} })
    if (typeof variants === 'object' && !Array.isArray(variants)) {
      variants = Object.values(variants);
    }

    const files = (req.files as Express.Multer.File[]) || [];

    // 2. PROCESS FILES & ATTACH TO VARIANTS
    // We assume the index in 'variants[0][images]' matches the index in our variants array
    await Promise.all(files.map(async (file) => {
      // Matches: variants[0][images] OR variants[0][video]
      const match = file.fieldname.match(/variants\[(\d+)\]\[(images|video)\]/);

      if (match) {
        const index = parseInt(match[1]);
        const type = match[2]; // 'images' or 'video'

        const publicUrl = await uploadImageToSupabase(file, 'products');

        // Ensure variant exists
        if (!variants[index]) variants[index] = {};

        if (type === 'video') {
          variants[index].video = publicUrl;
        } else {
          // FORCE images to be an array. 
          // If req.body had garbage there (like an object), we overwrite or append.
          if (!Array.isArray(variants[index].images)) {
            variants[index].images = [];
          }
          variants[index].images.push(publicUrl);
        }
      }
    }));

    // 3. AGGRESSIVE TYPE CLEANUP (The Fix for your Error)
    const cleanedVariants = variants.map((v: any) => {
      // A. Fix Options: Ensure values are strings
      let cleanOptions: Record<string, string> | undefined = undefined;

      if (v.options) {
        cleanOptions = {};
        Object.keys(v.options).forEach((key) => {
          const val = v.options[key];
          // If val is an object/array, take the first item or stringify it.
          // This fixes "expected string, received object"
          if (typeof val === 'object') {
            cleanOptions![key] = Array.isArray(val) ? String(val[0]) : JSON.stringify(val);
          } else {
            cleanOptions![key] = String(val);
          }
        });
      }

      // B. Fix Images: Ensure it's an array of strings
      // If no images uploaded, ensure it's empty array [] not undefined or object
      let cleanImages = Array.isArray(v.images) ? v.images : [];

      return {
        ...v,
        title: v.title || "Default", // Handle empty titles
        price: Number(v.price) || 0,
        stock: Number(v.stock) || 0,
        // Drizzle requires strings for decimal columns, but Zod might check number first?
        // Check your schema. If Zod expects number, use Number().
        // If your Zod schema expects strings for price, use String(v.price).
        // Based on previous error, Zod wanted number, so keep Number().

        images: cleanImages, // Fix "expected array, received object"
        options: cleanOptions, // Fix "expected string, received object"
      };
    });

    const cleanedData = {
      ...rawBody,
      isPublished: rawBody.isPublished === 'true' || rawBody.isPublished === true,
      variants: cleanedVariants
    };

    // 4. VALIDATE WITH ZOD
    const parsed = incomingPayloadSchema.safeParse(cleanedData);

    if (!parsed.success) {
      console.error("Validation Error:", JSON.stringify(parsed.error.format(), null, 2));
      return res.status(400).json({ success: false, errors: parsed.error.format() });
    }

    const data = parsed.data;

    // ... [REST OF YOUR DB INSERTION CODE IS UNCHANGED] ...
    // ... db.transaction(...) ...

    // Quick DB Transaction recap for completeness:
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

      const rows = data.variants!.map((v) => ({
        productId: newProduct.id,
        title: v.title,
        // Drizzle Decimal Fix: Convert number to string for DB insertion
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
    });

    res.status(201).json({ success: true, data: result });

  } catch (error: any) {
    console.error("Create Product Error:", error);
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