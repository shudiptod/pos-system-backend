// src/controllers/category.controller.ts
import { Request, Response } from "express";
import { db } from "../db";
import { categories, createCategorySchema, updateCategorySchema } from "../models/category.model";
import { products } from "../models/product.model";
// Note: productVariants import removed
import { eq, inArray, min, max, and, isNull } from "drizzle-orm";
import { AuthRequest } from "@/middleware/auth";

// --- CREATE CATEGORY ---
export const createCategory = async (req: AuthRequest, res: Response) => {
	try {
		const user = req.user;
		if (!user) return res.status(401).json({ message: "Unauthorized" });

		const rawBody = {
			...req.body,
			imagePath: req.body.imagePath || req.body.image,
			isActive: req.body.isActive === true || req.body.isActive === "true",
		};

		const parsed = createCategorySchema.safeParse(rawBody);

		if (!parsed.success) {
			return res.status(400).json({ errors: parsed.error.format() });
		}

		const [newCategory] = await db.insert(categories).values(parsed.data).returning();

		res.status(201).json({ success: true, category: newCategory });
	} catch (error: any) {
		console.error("Create Category Error:", error);
		if (error.code === "23505") {
			return res.status(409).json({ success: false, message: "A category with this slug already exists." });
		}
		res.status(500).json({ success: false, message: error.message });
	}
};

// --- GET ALL CATEGORIES ---
export const getCategories = async (req: Request, res: Response) => {
	try {
		// Only fetch non-deleted categories
		const allCategories = await db.select().from(categories).where(eq(categories.isDeleted, false));
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
					isNull(categories.parentId),
					eq(categories.isActive, true),
					eq(categories.isDeleted, false), // Ensure it's not deleted
				),
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

		// 1. Fetch Current Category (Ensure not deleted)
		const [currentCategory] = await db
			.select()
			.from(categories)
			.where(and(eq(categories.slug, slug), eq(categories.isDeleted, false)))
			.limit(1);

		if (!currentCategory) {
			return res.status(404).json({ success: false, message: "Category not found" });
		}

		// 2. Fetch Direct Children (Ensure not deleted)
		const children = await db
			.select()
			.from(categories)
			.where(and(eq(categories.parentId, currentCategory.id), eq(categories.isDeleted, false)));

		// 3. Fetch Ancestors (Breadcrumbs)
		const ancestors = [];
		let currentParentId = currentCategory.parentId;

		while (currentParentId) {
			const [parent] = await db.select().from(categories).where(eq(categories.id, currentParentId)).limit(1);

			if (parent && !parent.isDeleted) {
				ancestors.unshift(parent);
				currentParentId = parent.parentId;
			} else {
				break;
			}
		}

		// 4. Calculate Price Range (Min/Max) directly from Products table
		const categoryIdsToCheck = [currentCategory.id, ...children.map((c) => c.id)];

		const [priceStats] = await db
			.select({
				minPrice: min(products.price),
				maxPrice: max(products.price),
			})
			.from(products)
			.where(and(inArray(products.categoryId, categoryIdsToCheck), eq(products.isDeleted, false)));

		// 5. Construct Final Response
		res.json({
			success: true,
			data: {
				...currentCategory,
				ancestors: ancestors,
				children: children,

				// Note: Drizzle/PG returns aggregations as strings to preserve precision
				minPrice: priceStats?.minPrice || 0,
				maxPrice: priceStats?.maxPrice || 0,
			},
		});
	} catch (error: any) {
		console.error("Error fetching category:", error);
		res.status(500).json({ success: false, message: "Internal server error" });
	}
};

// --- UPDATE CATEGORY ---
export const updateCategory = async (req: AuthRequest, res: Response) => {
	try {
		const user = req.user;
		if (!user) return res.status(401).json({ message: "Unauthorized" });

		const { id } = req.params;

		const parsed = updateCategorySchema.safeParse(req.body);
		if (!parsed.success) {
			return res.status(400).json({ errors: parsed.error.format() });
		}
		const data = parsed.data;

		const [updated] = await db
			.update(categories)
			.set(data)
			.where(and(eq(categories.id, id), eq(categories.isDeleted, false))) // Ensure not updating a deleted item
			.returning();

		if (!updated) return res.status(404).json({ message: "Category not found" });

		res.json({ success: true, data: updated });
	} catch (error: any) {
		res.status(500).json({ success: false, message: error.message });
	}
};

// --- DELETE CATEGORY (Soft Delete) ---
export const deleteCategory = async (req: AuthRequest, res: Response) => {
	try {
		const user = req.user;
		if (!user) return res.status(401).json({ message: "Unauthorized" });

		const { id } = req.params;

		// Check if category has active products or sub-categories
		const hasProducts = await db
			.select()
			.from(products)
			.where(and(eq(products.categoryId, id), eq(products.isDeleted, false)))
			.limit(1);
		const hasChildren = await db
			.select()
			.from(categories)
			.where(and(eq(categories.parentId, id), eq(categories.isDeleted, false)))
			.limit(1);

		if (hasProducts.length > 0 || hasChildren.length > 0) {
			// Disconnect active products
			await db.update(products).set({ categoryId: null }).where(eq(products.categoryId, id));
			// Disconnect active child categories
			await db.update(categories).set({ parentId: null }).where(eq(categories.parentId, id));
		}

		// Soft delete the category
		const [deleted] = await db.update(categories).set({ isDeleted: true }).where(eq(categories.id, id)).returning();

		if (!deleted) return res.status(404).json({ message: "Category not found" });

		res.json({ success: true, message: "Category deleted" });
	} catch (error: any) {
		res.status(500).json({ success: false, message: error.message });
	}
};
