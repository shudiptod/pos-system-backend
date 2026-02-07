import { Request, Response } from "express";
import { db } from "../db";
import { categories, createCategorySchema, updateCategorySchema } from "../models/category.model";
import { products } from "../models/product.model";
import { productVariants } from "../models/productVariant.model";
import { eq, inArray, min, max, and, isNull } from "drizzle-orm";
import { AuthRequest } from "@/middleware/auth";


// --- CREATE CATEGORY ---

export const createCategory = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    // 1. Prepare Data
    // We assume the frontend has already uploaded the image and sent us the URL.
    const rawBody = {
      ...req.body,
      // Map 'image' to 'imagePath' to match your DB schema, just in case frontend sends generic 'image' key
      imagePath: req.body.imagePath || req.body.image,

      // Safety check: ensure boolean is treated correctly
      isActive: req.body.isActive === true || req.body.isActive === 'true',
    };

    // 2. Validate with Zod
    const parsed = createCategorySchema.safeParse(rawBody);

    if (!parsed.success) {
      return res.status(400).json({ errors: parsed.error.format() });
    }

    // 3. Insert into DB
    const [newCategory] = await db
      .insert(categories)
      .values(parsed.data)
      .returning();

    res.status(201).json({ success: true, category: newCategory });

  } catch (error: any) {
    console.error("Create Category Error:", error);

    // Postgres Error Code 23505 = Unique Violation (Duplicate Slug)
    if (error.code === '23505') {
      return res.status(409).json({ success: false, message: "A category with this slug already exists." });
    }

    res.status(500).json({ success: false, message: error.message });
  }
};

// --- GET ALL CATEGORIES ---
export const getCategories = async (req: Request, res: Response) => {
  try {
    // You might want to build a tree structure here if you have sub-categories
    const allCategories = await db.select().from(categories);
    res.json({ success: true, data: allCategories });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};


export const getRootCategories = async (req: Request, res: Response) => {
  try {
    const rootCategories = await db
      .select()
      .from(categories)
      .where(
        and(
          isNull(categories.parentId), // The key filter
          eq(categories.isActive, true) // Only active categories
        )
      );

    return res.json({
      success: true,
      data: rootCategories,
    });
  } catch (error: any) {
    console.error("Get Root Categories Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};


// --- GET Single CATEGORY With Ancestors and Children by Slug ---
export const getCategoryBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    if (!slug) {
      return res.status(400).json({ success: false, message: "Slug is required" });
    }

    // 1. Fetch Current Category
    const [currentCategory] = await db
      .select()
      .from(categories)
      .where(eq(categories.slug, slug))
      .limit(1);

    if (!currentCategory) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    // 2. Fetch Direct Children (Sub-categories)
    const children = await db
      .select()
      .from(categories)
      .where(eq(categories.parentId, currentCategory.id));

    // 3. Fetch Ancestors (Breadcrumbs)
    // We walk up the tree: Current -> Parent -> Grandparent
    const ancestors = [];
    let currentParentId = currentCategory.parentId;

    while (currentParentId) {
      const [parent] = await db
        .select()
        .from(categories)
        .where(eq(categories.id, currentParentId))
        .limit(1);

      if (parent) {
        // Add to the START of the array to maintain order: Root -> Parent
        ancestors.unshift(parent);
        currentParentId = parent.parentId;
      } else {
        break;
      }
    }

    // 4. Calculate Price Range (Min/Max)
    // We want the price range for the current category AND its sub-categories.
    const categoryIdsToCheck = [
      currentCategory.id,
      ...children.map(c => c.id)
    ];

    const [priceStats] = await db
      .select({
        minPrice: min(productVariants.price),
        maxPrice: max(productVariants.price)
      })
      .from(productVariants)
      // Join Variants -> Products to filter by Category
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(inArray(products.categoryId, categoryIdsToCheck));

    // 5. Construct Final Response
    res.json({
      success: true,
      data: {
        ...currentCategory,
        ancestors: ancestors, // [Grandparent, Parent]
        children: children,   // [Child1, Child2]

        // Price stats (Default to 0 if no products exist)
        // Note: Drizzle/PG returns aggregations as strings to preserve precision
        minPrice: priceStats?.minPrice || 0,
        maxPrice: priceStats?.maxPrice || 0,
      }
    });

  } catch (error: any) {
    console.error('Error fetching category:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};


// --- UPDATE CATEGORY ---

export const updateCategory = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;

    // 1. Prepare Data
    const parsed = updateCategorySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ errors: parsed.error.format() });
    }
    const data = parsed.data;

    // 2. Update Database
    const [updated] = await db
      .update(categories)
      .set(data)
      .where(eq(categories.id, id))
      .returning();

    if (!updated) return res.status(404).json({ message: "Category not found" });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// --- DELETE CATEGORY ---
export const deleteCategory = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;

    // Optional: Check if category has products or sub-categories before allowing deletion
    const hasProducts = await db.select().from(products).where(eq(products.categoryId, id)).limit(1);
    const hasChildren = await db.select().from(categories).where(eq(categories.parentId, id)).limit(1);

    if (hasProducts.length > 0 || hasChildren.length > 0) {
      // update the products to set categoryId to null 
      await db.update(products).set({ categoryId: null }).where(eq(products.categoryId, id));
      // update the child categories to set parentId to null
      await db.update(categories).set({ parentId: null }).where(eq(categories.parentId, id));
    }

    await db.delete(categories).where(eq(categories.id, id));

    res.json({ success: true, message: "Category deleted" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
