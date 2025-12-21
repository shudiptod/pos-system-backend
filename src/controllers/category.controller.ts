import { Request, Response } from "express";
import { db } from "../db";
import { categories, createCategorySchema } from "../models/category.model";
import { eq } from "drizzle-orm";

// --- CREATE CATEGORY ---
export const createCategory = async (req: Request, res: Response) => {
  try {
    const parsed = createCategorySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.format() });

    const [newCategory] = await db.insert(categories).values(parsed.data).returning();

    res.status(201).json({ success: true, category: newCategory });
  } catch (error: any) {
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

    // 1. Fetch the Target Category
    const [currentCategory] = await db
      .select()
      .from(categories)
      .where(eq(categories.slug, slug))
      .limit(1);

    if (!currentCategory) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    // 2. Fetch Direct Children
    const children = await db
      .select()
      .from(categories)
      .where(eq(categories.parentId, currentCategory.id));

    // 3. Fetch Ancestors (The JS Loop)
    const ancestors = [];
    let currentParentId = currentCategory.parentId;

    while (currentParentId) {
      // Fetch the parent category
      const [parent] = await db
        .select()
        .from(categories)
        .where(eq(categories.id, currentParentId))
        .limit(1);

      if (parent) {
        // Add to the START of the array to keep order: Root -> Grandparent -> Parent
        ancestors.unshift(parent);

        // Move up the tree
        currentParentId = parent.parentId;
      } else {
        // If parentId exists but record is missing (broken data), stop.
        break;
      }
    }

    // 4. Return Combined Data
    res.json({
      success: true,
      data: {
        ...currentCategory,
        ancestors: ancestors, // [Grandparent, Parent]
        children: children    // [Child1, Child2]
      }
    });

  } catch (error: any) {
    console.error('Error fetching category:', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};