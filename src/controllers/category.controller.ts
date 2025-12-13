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