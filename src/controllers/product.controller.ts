




// src/controllers/product.controller.ts
import { NextFunction, Request, Response } from "express";
import { db } from "../db";
import { eq, and, gte, lte, desc, asc, sql, inArray, or, not, SQL, getTableColumns } from "drizzle-orm";
import { AuthRequest } from "../middleware/auth";

// Models
import { products, createProductSchema } from "../models/product.model";
import { categories } from "../models/category.model";
import { generateSlug } from "../utils/slugify";
import { logger } from "../lib/logger";

// Helper function to safely parse arrays from multipart/form-data
const safelyParseArray = (field: any): string[] => {
  if (!field) return [];
  if (Array.isArray(field)) return field.filter((item) => typeof item === "string");
  if (typeof field === "string") {
    try {
      const parsed = JSON.parse(field);
      return Array.isArray(parsed) ? parsed : [field];
    } catch (e) {
      return [field]; // It was just a single string, not JSON
    }
  }
  return [];
};

// ---------------------------------------------------------
// 1. CREATE PRODUCT (Single Table Insert)
// ---------------------------------------------------------
export const createProduct = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    // ✨ UPDATED: Safely parse both images and lists
    const cleanImages = safelyParseArray(req.body.images);
    const cleanLists = safelyParseArray(req.body.lists);

    const cleanedData = {
      ...req.body,
      isPublished: req.body.isPublished !== undefined ? req.body.isPublished : true,
      images: cleanImages,
      lists: cleanLists,
      price: Number(req.body.price) || 0,
      stock: Number(req.body.stock) || 0,
      minOrderQuantity: Number(req.body.minOrderQuantity) || 1,
    };

    const parsed = createProductSchema.safeParse(cleanedData);

    if (!parsed.success) {
      console.error("Validation Error:", JSON.stringify(parsed.error.format(), null, 2));
      return res.status(400).json({ success: false, errors: parsed.error.format() });
    }

    const data = parsed.data;

    const [newProduct] = await db
      .insert(products)
      .values({
        ...data,
        price: String(data.price),
        discountValue: String(data.discountValue || 0),
        createdByAdminId: user.id,
        updatedByAdminId: user.id,
      })
      .returning();

    res.status(201).json({ success: true, data: { product: newProduct } });
  } catch (error: any) {
    console.error("Create Product Error:", error);
    next(error);
  }
};

// ---------------------------------------------------------
// 2. GET SINGLE PRODUCT
// ---------------------------------------------------------
export const getProductById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const [product] = await db
      .select({
        ...getTableColumns(products), // ✨ 'lists' is automatically included here
        categoryName: categories.name,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(and(eq(products.id, id), eq(products.isDeleted, false)));

    if (!product) return res.status(404).json({ message: "Product not found" });

    res.json({ success: true, data: product });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------------------------------------------------------
// 3. GET ALL PRODUCTS (Catalog List)
// ---------------------------------------------------------
export const getProducts = async (req: Request, res: Response) => {
  try {
    // ✨ UPDATED: Added 'list' parameter and defaulted sort to 'random'
    const { category, search, minPrice, maxPrice, page = "1", limit = "12", sort = "random", list, availability = null, ...dynamicFilters } = req.query;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(Math.max(1, Number(limit)), 100);
    const offset = (pageNum - 1) * limitNum;

    // --- 1. Global Conditions ---
    const globalConditions: SQL[] = [eq(products.isDeleted, false)]; 

    // ✨ UPDATED: Filter by lists array if requested
    if (list && typeof list === "string") {
        globalConditions.push(sql`${products.lists} @> ARRAY[${list}]::text[]`);
    }

    if (category) {
      const [rootCategory] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.slug, category as string), eq(categories.isDeleted, false)));

      if (rootCategory) {
        const recursiveResult = await db.execute(sql`
          WITH RECURSIVE category_tree AS (
            SELECT id FROM ${categories} WHERE id = ${rootCategory.id} AND is_deleted = false
            UNION ALL
            SELECT c.id FROM ${categories} c
            INNER JOIN category_tree ct ON ct.id = c.parent_id
            WHERE c.is_deleted = false
          )
          SELECT id FROM category_tree
        `);
        const categoryIds = recursiveResult.map((row: any) => row.id);
        globalConditions.push(inArray(products.categoryId, categoryIds));
      } else {
        return res.json({ success: true, data: [], facets: [], pagination: { total: 0, totalPages: 0 } });
      }
    }

    if (search) {
      const pattern = `%${search}%`;
      globalConditions.push(sql`${products.title} ILIKE ${pattern}`);
    }

    if (minPrice) globalConditions.push(sql`CAST(${products.price} AS NUMERIC) >= ${Number(minPrice)}`);
    if (maxPrice) globalConditions.push(sql`CAST(${products.price} AS NUMERIC) <= ${Number(maxPrice)}`);
    if (availability === "in-stock") globalConditions.push(gte(products.stock, 1));

    // --- 2. Dynamic Filter Logic ---
    const filterEntries = Object.entries(dynamicFilters).filter(([_, v]) => !!v);
    const allConditions = [...globalConditions];

    filterEntries.forEach(([key, value]) => {
      const stringVal = String(value);
      const values = stringVal
        .split("|")
        .map((v) => v.trim())
        .filter((v) => v !== "");

      if (values.length > 0) {
        const likeConditions = values.map((v) => sql`${products.options}->>${key} ILIKE ${`%${v}%`}`);
        allConditions.push(sql`(${sql.join(likeConditions, sql` OR `)})`);
      }
    });

    // --- Sorting Logic ---
    const stockSort = sql`CASE WHEN ${products.stock} > 0 THEN 1 ELSE 0 END`;
    
    // ✨ UPDATED: Handles 'random' sorting 
    let orderBy: any[] = [desc(stockSort), desc(products.createdAt)];
    if (sort === "price_asc") orderBy = [desc(stockSort), asc(products.price)];
    if (sort === "price_desc") orderBy = [desc(stockSort), desc(products.price)];
    if (sort === "random") orderBy = [desc(stockSort), sql`RANDOM()`]; 

    // --- 3. Parallel Database Execution ---
    const [productData, totalCountResult, facetsResult] = await Promise.all([
      db
        .select({
          id: products.id,
          title: products.title,
          slug: products.slug,
          price: products.price,
          discountStatus: products.discountStatus,
          discountType: products.discountType,
          discountValue: products.discountValue,
          stock: products.stock,
          thumbnail: sql<string>`${products.images}[0]`,
          options: products.options,
          lists: products.lists, // ✨ UPDATED: Added lists to output
          categoryName: categories.name,
          categorySlug: categories.slug,
          isPublished: products.isPublished,
        })
        .from(products)
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .where(and(...allConditions))
        .orderBy(...orderBy)
        .limit(limitNum)
        .offset(offset),

      db
        .select({ count: sql<number>`count(*)` })
        .from(products)
        .where(and(...allConditions)),

      db.execute(sql`
        WITH base_products AS (
          SELECT 
            ${products.id} as id, 
            ${products.options} as options 
          FROM ${products} 
          WHERE ${and(...globalConditions)}
        ),
        unpacked_options AS (
          SELECT DISTINCT key, trim(unnest(string_to_array(value, ','))) as split_value
          FROM base_products, jsonb_each_text(options)
        )
        SELECT 
          key as "id", 
          key as "title",
          jsonb_agg(DISTINCT jsonb_build_object(
            'label', split_value, 
            'value', split_value,
            'count', (
              SELECT count(DISTINCT bp2.id)::int 
              FROM base_products bp2
              WHERE bp2.options->>key ILIKE '%' || split_value || '%'
              ${
                filterEntries.length > 0
                  ? sql`AND ${and(
                      ...filterEntries.map(([k, v]) => {
                        if (!v) return sql`TRUE`;
                        const vals = String(v)
                          .split("|")
                          .map((item) => item.trim())
                          .filter((i) => i !== "");
                        return sql`(${k} = key OR ${sql.raw(`bp2.options->>'${k}'`)} ILIKE ANY(ARRAY[${sql.join(
                          vals.map((val) => sql`'%' || ${val} || '%'`),
                          sql`, `,
                        )}]))`;
                      }),
                    )}`
                  : sql``
              }
            )
          )) as "options"
        FROM unpacked_options
        GROUP BY key
      `),
    ]);

    // --- 4. Result Transformation ---
    const total = Number(totalCountResult[0]?.count || 0);

    const formattedProducts = productData.map((item) => {
      const basePrice = Number(item.price);
      const discValue = Number(item.discountValue || 0);
      let salePrice = basePrice;

      if (item.discountStatus && discValue > 0) {
        salePrice = item.discountType === "PERCENTAGE" ? basePrice * (1 - discValue / 100) : basePrice - discValue;
      }

      return {
        ...item,
        price: basePrice,
        salePrice: Math.round(salePrice),
        fullTitle: item.title,
      };
    });

    res.json({
      success: true,
      data: formattedProducts,
      facets: facetsResult || [],
      pagination: {
        total,
        totalPages: Math.ceil(total / limitNum),
        page: pageNum,
        limit: limitNum,
      },
    });
  } catch (error: any) {
    console.error("Controller Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ---------------------------------------------------------
// 4. GET SINGLE PRODUCT by slug
// ---------------------------------------------------------
export const getProductBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const [product] = await db
      .select({
        ...getTableColumns(products), // ✨ 'lists' is automatically included here
        categoryName: categories.name,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(and(eq(products.slug, slug), eq(products.isDeleted, false)));

    if (!product) return res.status(404).json({ message: "Product not found" });

    res.json({ success: true, data: product });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------------------------------------------------------
// 5. UPDATE PRODUCT
// ---------------------------------------------------------
export const updateProduct = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;
    const updateData = { ...req.body };

    // ✨ UPDATED: Safely parse lists/images if they exist in the update payload
    if (updateData.images !== undefined) {
      updateData.images = safelyParseArray(updateData.images);
    }
    if (updateData.lists !== undefined) {
      updateData.lists = safelyParseArray(updateData.lists);
    }

    // Check for unique title/slug conflict
    if (updateData.title) {
      const existingProduct = await db
        .select()
        .from(products)
        .where(and(not(eq(products.id, id)), or(eq(products.title, updateData.title), eq(products.slug, generateSlug(updateData.title))), eq(products.isDeleted, false)))
        .limit(1);

      if (existingProduct.length > 0) {
        return res.status(400).json({ message: "Product title already exists" });
      }

      updateData.slug = generateSlug(updateData.title);
    }

    const [product] = await db
      .update(products)
      .set({
        ...updateData,
        updatedByAdminId: user.id,
      })
      .where(and(eq(products.id, id), eq(products.isDeleted, false)))
      .returning();

    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json({ success: true, data: product });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------------------------------------------------------
// 6. DELETE PRODUCT (Soft Delete)
// ---------------------------------------------------------

export const deleteProduct = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    // 1. Handle Single Deletion (e.g., DELETE /products/e8c08f99-...)
    if (req.params.id) {
      const [deletedProduct] = await db
        .update(products)
        .set({ isDeleted: true, updatedByAdminId: user.id })
        .where(eq(products.id, req.params.id))
        .returning();

      if (!deletedProduct) {
        return res.status(404).json({ message: "Product not found" });
      }

      return res.json({ success: true, message: "Product deleted successfully" });
    }

    // 2. Handle Bulk Deletion (e.g., DELETE /products with array payload)
    if (Array.isArray(req.body) && req.body.length > 0) {
      // Extract just the UUID strings from the array of objects
      const productIds = req.body.map((item: { productId: string }) => item.productId).filter(Boolean);

      if (productIds.length === 0) {
        return res.status(400).json({ message: "No valid product IDs provided" });
      }

      // Use inArray to soft-delete all matching products in one query
      const deletedProducts = await db
        .update(products)
        .set({ isDeleted: true, updatedByAdminId: user.id })
        .where(inArray(products.id, productIds))
        .returning();

      return res.json({ 
        success: true, 
        message: `${deletedProducts.length} products deleted successfully` 
      });
    }

    // 3. Fallback if neither an ID nor an array was provided
    return res.status(400).json({ message: "Provide a product ID in the URL or an array of products in the body" });

  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------------------------------------------------------
// 7. GET FEATURED PRODUCTS
// ---------------------------------------------------------
export const getFeaturedProducts = async (req: Request, res: Response) => {
  try {
    const featuredLimit = Number(req.query.limit) || 8;

    const data = await db
      .select({
        id: products.id,
        title: products.title,
        slug: products.slug,
        price: products.price,
        stock: products.stock,
        thumbnail: sql<string>`${products.images}[0]`,
        lists: products.lists, // ✨ UPDATED: Added lists to output
        categoryName: categories.name,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(
        and(
          eq(products.isPublished, true),
          eq(products.isDeleted, false),
          // ✨ UPDATED: Strictly check if "featured" exists in the lists array
          sql`${products.lists} @> ARRAY['featured']::text[]`
        ),
      )
      .orderBy(sql`RANDOM()`) // ✨ UPDATED: Randomize featured display
      .limit(featuredLimit);

    const formattedData = data.map((item) => ({
      ...item,
      fullTitle: item.title,
      minPrice: item.price,
      maxPrice: item.price,
      options: [],
    }));

    logger.info(`Featured Products fetched`, { count: formattedData.length });

    res.json({ success: true, data: formattedData });
  } catch (error: any) {
    console.error("Featured Products Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------------------------------------------------------
// 8. GET ALL PRODUCTS (Admin List)
// ---------------------------------------------------------
export const getAllProducts = async (req: Request, res: Response) => {
  try {
    const data = await db.select({ 
      id: products.id, 
      slug: products.slug, 
      lists: products.lists, // ✨ UPDATED: Added lists here too
      updatedAt: products.updatedAt 
    })
    .from(products)
    .where(eq(products.isDeleted, false))
    .orderBy(desc(products.updatedAt));

    res.json({ success: true, data });
  } catch (error: any) {
    console.error("Get All Products Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------------------------------------------------------
// 9. GET PRODUCTS BY CATEGORY SLUG
// ---------------------------------------------------------
export const getProductsByCategorySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { page = "1", limit = "12", sort = "random" } = req.query; // ✨ Default to random

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(Math.max(1, Number(limit)), 100);
    const offset = (pageNum - 1) * limitNum;

    const [rootCategory] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.slug, slug as string), eq(categories.isDeleted, false)));

    if (!rootCategory) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
        data: [],
        pagination: { total: 0, totalPages: 0, page: pageNum, limit: limitNum },
      });
    }

    const recursiveResult = await db.execute(sql`
            WITH RECURSIVE category_tree AS (
                SELECT id FROM ${categories} WHERE id = ${rootCategory.id} AND is_deleted = false
                UNION ALL
                SELECT c.id FROM ${categories} c
                INNER JOIN category_tree ct ON ct.id = c.parent_id
                WHERE c.is_deleted = false
            )
            SELECT id FROM category_tree
        `);
    const categoryIds = recursiveResult.map((row: any) => row.id);

    const allConditions = and(eq(products.isDeleted, false), inArray(products.categoryId, categoryIds));

    const stockSort = sql`CASE WHEN ${products.stock} > 0 THEN 1 ELSE 0 END`;
    
    // ✨ UPDATED: Handles 'random' sorting 
    let orderBy: any[] = [desc(stockSort), desc(products.createdAt)];
    if (sort === "price_asc") orderBy = [desc(stockSort), asc(products.price)];
    if (sort === "price_desc") orderBy = [desc(stockSort), desc(products.price)];
    if (sort === "menu_order") orderBy = [desc(stockSort), desc(products.createdAt)];
    if (sort === "random") orderBy = [desc(stockSort), sql`RANDOM()`];

    const [productData, totalCountResult] = await Promise.all([
      db
        .select({
          id: products.id,
          title: products.title,
          slug: products.slug,
          price: products.price,
          discountStatus: products.discountStatus,
          discountType: products.discountType,
          discountValue: products.discountValue,
          stock: products.stock,
          thumbnail: sql<string>`${products.images}[0]`,
          options: products.options,
          lists: products.lists, // ✨ UPDATED: Added lists to output
          categoryName: categories.name,
          categorySlug: categories.slug,
          isPublished: products.isPublished,
        })
        .from(products)
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .where(allConditions)
        .orderBy(...orderBy)
        .limit(limitNum)
        .offset(offset),

      db
        .select({ count: sql<number>`count(*)` })
        .from(products)
        .where(allConditions),
    ]);

    const total = Number(totalCountResult[0]?.count || 0);

    const formattedProducts = productData.map((item) => {
      const basePrice = Number(item.price);
      const discValue = Number(item.discountValue || 0);
      let salePrice = basePrice;

      if (item.discountStatus && discValue > 0) {
        salePrice = item.discountType === "PERCENTAGE" ? basePrice * (1 - discValue / 100) : basePrice - discValue;
      }

      return {
        ...item,
        price: basePrice,
        salePrice: Math.round(salePrice),
        fullTitle: item.title,
      };
    });

    res.json({
      success: true,
      data: formattedProducts,
      pagination: {
        total,
        totalPages: Math.ceil(total / limitNum),
        page: pageNum,
        limit: limitNum,
      },
    });
  } catch (error: any) {
    console.error("Get Products By Category Slug Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};