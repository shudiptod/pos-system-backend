import { Request, Response } from "express";
import { db } from "../db";
import { categories, createCategorySchema } from "../models/category.model";
import { products } from "../models/product.model";
import { productVariants } from "../models/productVariant.model";
import { eq, inArray, min, max } from "drizzle-orm";
import { uploadImageToSupabase } from "@/lib/supabase";

// --- CREATE CATEGORY ---
export const createCategory = async (req: Request, res: Response) => {
  try {
    let imagePath = null;

    // 1. Check if a file was uploaded
    if (req.file) {
      imagePath = await uploadImageToSupabase(req.file);
    } else if (req.body.image) {
      // Handle case where user sends a string URL instead of a file
      imagePath = req.body.image;
    }

    const rawBody = {
      ...req.body,
      image: imagePath,
      isActive: req.body.isActive === 'true' || req.body.isActive === true,
    };


    const parsed = createCategorySchema.safeParse(rawBody);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.format() });


    const [newCategory] = await db.insert(categories).values(parsed.data).returning();

    res.status(201).json({ success: true, category: newCategory });
  } catch (error: any) {
    console.error(error);
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