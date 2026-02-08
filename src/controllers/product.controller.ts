import { NextFunction, Request, Response } from "express";
import { db } from "../db";
import { eq, and, gte, lte, desc, asc, sql, inArray, or, not } from "drizzle-orm";
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
  variants: z.array(createVariantSchema).optional(),
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
      };

      if (typeof v.sku === 'string' && v.sku.length > 0) {
        responseObject.sku = v.sku;
      }

      if (typeof v.barcode === 'string' && v.barcode.length > 0) {
        responseObject.barcode = v.barcode;
      }

      if (typeof v.video === 'string' && v.video.length > 0) {
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
          isFeatured: v.isFeatured || false,
          isPublished: v.isPublished !== undefined ? v.isPublished : true,
          discountStatus: v.discountStatus || false,
          discountType: v.discountType || 'FIXED',
          discountValue: String(v.discountValue || 0),
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
      ...dynamicFilters
    } = req.query;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(Math.max(1, Number(limit)), 100);
    const offset = (pageNum - 1) * limitNum;

    // --- Build Conditions ---
    const whereConditions = [];

    // 1. RECURSIVE CATEGORY FILTER
    if (category) {
      const [rootCategory] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.slug, category as string));

      if (rootCategory) {
        const recursiveResult = await db.execute(sql`
          WITH RECURSIVE category_tree AS (
            SELECT id FROM ${categories} WHERE id = ${rootCategory.id}
            UNION ALL
            SELECT c.id FROM ${categories} c
            INNER JOIN category_tree ct ON ct.id = c.parent_id
          )
          SELECT id FROM category_tree
        `);

        const categoryIds = recursiveResult.map((row: any) => row.id);
        if (categoryIds.length > 0) {
          whereConditions.push(inArray(products.categoryId, categoryIds));
        } else {
          whereConditions.push(eq(products.categoryId, rootCategory.id));
        }
      } else {
        return res.json({ success: true, data: [], pagination: { page: pageNum, limit: limitNum, total: 0, totalPages: 0 } });
      }
    }

    // 2. SEARCH FILTER
    if (search) {
      whereConditions.push(
        sql`(${products.title} ILIKE ${`%${search}%`} OR ${productVariants.title} ILIKE ${`%${search}%`} OR ${productVariants.sku} ILIKE ${`%${search}%`}`
      );
    }

    // 3. PRICE FILTERS
    if (minPrice) whereConditions.push(gte(productVariants.price, minPrice as string));
    if (maxPrice) whereConditions.push(lte(productVariants.price, maxPrice as string));

    // 4. DYNAMIC FILTERS
    Object.entries(dynamicFilters).forEach(([key, value]) => {
      if (!value) return;
      let values: string[] = Array.isArray(value) ? (value as string[]) : (value as string).split(',');
      if (values.length > 0) {
        whereConditions.push(inArray(sql<string>`${productVariants.options}->>${key}`, values));
      }
    });

    // --- Sorting Strategy ---
    const stockSort = sql`CASE WHEN ${productVariants.stock} > 0 THEN 1 ELSE 0 END`;
    let orderByClause: any = [desc(stockSort), desc(products.createdAt)];

    if (sort === "price_asc") orderByClause = [desc(stockSort), asc(productVariants.price)];
    if (sort === "price_desc") orderByClause = [desc(stockSort), desc(productVariants.price)];
    if (sort === "name_asc") orderByClause = [desc(stockSort), asc(products.title)];
    if (sort === "oldest") orderByClause = [desc(stockSort), asc(products.createdAt)];

    // --- EXECUTE QUERY ---
    const [data, totalCountResult] = await Promise.all([
      db
        .select({
          productId: products.id,
          productTitle: products.title,
          slug: products.slug,
          id: productVariants.id,
          variantTitle: productVariants.title,
          price: productVariants.price,

          // Discount Fields
          discountStatus: productVariants.discountStatus,
          discountType: productVariants.discountType,
          discountValue: productVariants.discountValue,

          stock: productVariants.stock,
          thumbnail: sql<string>`${productVariants.images}[1]`,
          options: productVariants.options,
          isFeatured: productVariants.isFeatured,
          categoryName: categories.name,
          categorySlug: categories.slug,
          createdAt: products.createdAt,
          isPublished: productVariants.isPublished,
        })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .where(and(...whereConditions))
        .orderBy(...orderByClause)
        .limit(limitNum)
        .offset(offset),

      db
        .select({ count: sql<number>`count(${productVariants.id})` })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .where(and(...whereConditions)),
    ]);

    const total = Number(totalCountResult[0]?.count || 0);

    // --- Transform Data ---
    const formattedData = data.map(item => {
      const basePrice = Number(item.price);
      const discValue = Number(item.discountValue || 0);
      let salePrice = basePrice;

      // Only calculate sale price if discount is active and value > 0
      if (item.discountStatus && discValue > 0) {
        if (item.discountType === 'PERCENTAGE') {
          salePrice = basePrice - (basePrice * (discValue / 100));
        } else {
          salePrice = Math.max(0, basePrice - discValue);
        }
      }

      return {
        id: item.productId,
        variantId: item.id,
        title: item.productTitle,
        variantTitle: item.variantTitle,
        fullTitle: item.variantTitle ? `${item.productTitle} - ${item.variantTitle}` : item.productTitle,

        // Pricing Cleaned Up
        price: basePrice,
        salePrice: Number(salePrice.toFixed(2)),
        discountStatus: item.discountStatus,
        discountType: item.discountType,
        discountValue: discValue,

        slug: item.slug,
        stock: item.stock,
        thumbnail: item.thumbnail,
        options: [item.options],
        isFeatured: item.isFeatured,
        categoryName: item.categoryName,
        categorySlug: item.categorySlug,
        createdAt: item.createdAt,
        isPublished: item.isPublished,
      };
    });

    res.json({
      success: true,
      data: formattedData,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });

  } catch (error: any) {
    console.error("Get Products Error:", error);
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


export const getFeaturedProducts = async (req: Request, res: Response) => {
  try {
    const featuredLimit = Number(req.query.limit) || 8;

    // Fetch specifically the variants marked as featured
    const data = await db
      .select({
        // Parent Info
        productId: products.id,
        productTitle: products.title,
        slug: products.slug,

        // Variant Info
        id: productVariants.id,
        variantTitle: productVariants.title,
        price: productVariants.price,
        stock: productVariants.stock,
        thumbnail: sql<string>`${productVariants.images}[1]`, // 1st image of this specific variant

        // Meta
        categoryName: categories.name,
      })
      .from(productVariants)
      // Join Parent to get the Name/Slug
      .innerJoin(products, eq(products.id, productVariants.productId))
      // Join Category for the label
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(and(
        eq(productVariants.isPublished, true),       // Parent must be published
        eq(productVariants.isFeatured, true)  // Variant must be featured
      ))
      // You might want to order by recently added, or add a 'featuredOrder' column later
      .orderBy(desc(products.createdAt))
      .limit(featuredLimit);

    // Transform to match Frontend IProduct Interface
    const formattedData = data.map(item => ({
      id: item.productId,
      variantId: item.id,

      title: item.productTitle,
      variantTitle: item.variantTitle,
      // Create a nice display title like "iPhone 15 - Midnight Black"
      fullTitle: item.variantTitle
        ? `${item.productTitle} - ${item.variantTitle}`
        : item.productTitle,

      slug: item.slug,
      minPrice: item.price,
      maxPrice: item.price,
      stock: item.stock,
      thumbnail: item.thumbnail,
      categoryName: item.categoryName,
      options: [] // Not needed for homepage cards
    }));

    res.json({ success: true, data: formattedData });

  } catch (error: any) {
    console.error("Featured Products Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};


//  get all products regardless of the category or filters
export const getAllProducts = async (req: Request, res: Response) => {
  try {
    // only get updatedat, slug and id
    const data = await db
      .select(
        { id: products.id, slug: products.slug, updatedAt: products.updatedAt }
      )
      .from(products)
      .orderBy(desc(products.updatedAt));

    res.json({ success: true, data });

  } catch (error: any) {
    console.error("Get All Products Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};