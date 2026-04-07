// src/controllers/product.controller.ts
import { Request, Response } from "express";
import { db } from "../db";
import { products, createProductSchema } from "../models/product.model";
import { eq, and, ilike, or, SQL } from "drizzle-orm";
import { AuthRequest } from "../middleware/auth";
import { categories } from "../models";


export const createProduct = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const parsed = createProductSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, errors: parsed.error.format() });

    const [newProduct] = await db.insert(products).values({
      ...parsed.data,
      buyingPrice: String(parsed.data.buyingPrice), // Convert to string for decimal storage
      price: String(parsed.data.price),
      createdByAdminId: user.id,
      updatedByAdminId: user.id,
    }).returning();

    res.status(201).json({ success: true, data: newProduct });
  } catch (error: any) {
    if (error.code === "23505") return res.status(409).json({ success: false, message: "SKU must be unique" });
    res.status(500).json({ success: false, message: error.message });
  }
};


export const getProducts = async (req: Request, res: Response) => {
  try {
    const { search, categoryId } = req.query;

    // 1. Build the query with a Join
    let query = db
      .select({
        // Product Fields
        id: products.id,
        title: products.title,
        sku: products.sku,
        price: products.price,
        buyingPrice: products.buyingPrice,
        stock: products.stock,
        images: products.images,
        createdAt: products.createdAt,
        // Category Fields (Joined)
        category: {
          id: categories.id,
          name: categories.name,
          // slug: categories.slug, // Uncomment this if you add slug to your category model
        },
      })
      .from(products)
      // Left join ensures products show up even if categoryId is null
      .leftJoin(categories, eq(products.categoryId, categories.id));

    // 2. Build Conditions
    const conditions = [eq(products.isDeleted, false)];

    if (search && typeof search === "string") {
      const searchPattern = `%${search}%`;


      const searchConditions = [
        ilike(products.title, searchPattern),
        products.sku ? ilike(products.sku, searchPattern) : null
      ].filter(Boolean) as SQL[];

      if (searchConditions.length > 0) {
        conditions.push(or(...searchConditions)!);
      }
    }

    if (categoryId && typeof categoryId === "string") {
      conditions.push(eq(products.categoryId, categoryId));
    }

    // 3. Execute
    const data = await query
      .where(and(...conditions))
      .orderBy(products.title);

    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllProducts = async (req: Request, res: Response) => {
  try {
    const data = await db.select().from(products).where(eq(products.isDeleted, false));
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getProductById = async (req: Request, res: Response) => {
  try {
    const [product] = await db.select().from(products).where(and(eq(products.id, req.params.id), eq(products.isDeleted, false)));
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json({ success: true, data: product });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateProduct = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const [updated] = await db
      .update(products)
      .set({ ...req.body, updatedByAdminId: user.id })
      .where(and(eq(products.id, req.params.id), eq(products.isDeleted, false)))
      .returning();

    if (!updated) return res.status(404).json({ message: "Product not found" });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteProduct = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;

    const [deleted] = await db.update(products).set({ isDeleted: true, updatedByAdminId: user.id }).where(eq(products.id, id)).returning();
    if (!deleted) return res.status(404).json({ message: "Product not found" });

    res.json({ success: true, message: "Product deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};