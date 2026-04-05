// src/controllers/category.controller.ts
import { Request, Response } from "express";
import { db } from "../db";
import { categories, createCategorySchema, updateCategorySchema } from "../models/category.model";
import { products } from "../models/product.model";
import { eq, and, isNull } from "drizzle-orm";

export const createCategory = async (req: Request, res: Response) => {
	try {
		const parsed = createCategorySchema.safeParse(req.body);
		if (!parsed.success) return res.status(400).json({ errors: parsed.error.format() });

		const [newCategory] = await db.insert(categories).values(parsed.data).returning();
		res.status(201).json({ success: true, data: newCategory });
	} catch (error: any) {
		res.status(500).json({ success: false, message: error.message });
	}
};

export const getCategories = async (req: Request, res: Response) => {
	try {
		const data = await db.select().from(categories).where(eq(categories.isDeleted, false));
		res.json({ success: true, data });
	} catch (error: any) {
		res.status(500).json({ success: false, message: error.message });
	}
};

export const getRootCategories = async (req: Request, res: Response) => {
	try {
		const data = await db
			.select()
			.from(categories)
			.where(and(isNull(categories.parentId), eq(categories.isActive, true), eq(categories.isDeleted, false)));
		res.json({ success: true, data });
	} catch (error: any) {
		res.status(500).json({ success: false, message: error.message });
	}
};

export const updateCategory = async (req: Request, res: Response) => {
	try {
		const parsed = updateCategorySchema.safeParse(req.body);
		if (!parsed.success) return res.status(400).json({ errors: parsed.error.format() });

		const [updated] = await db
			.update(categories)
			.set(parsed.data)
			.where(and(eq(categories.id, req.params.id), eq(categories.isDeleted, false)))
			.returning();

		if (!updated) return res.status(404).json({ message: "Category not found" });
		res.json({ success: true, data: updated });
	} catch (error: any) {
		res.status(500).json({ success: false, message: error.message });
	}
};

export const deleteCategory = async (req: Request, res: Response) => {
	try {
		const { id } = req.params;

		// Unlink products: Set categoryId to null for any product that belonged to this category
		await db.update(products).set({ categoryId: null }).where(eq(products.categoryId, id));

		// Unlink subcategories: Set parentId to null so they become root categories
		await db.update(categories).set({ parentId: null }).where(eq(categories.parentId, id));

		const [deleted] = await db.update(categories).set({ isDeleted: true }).where(eq(categories.id, id)).returning();
		if (!deleted) return res.status(404).json({ message: "Category not found" });

		res.json({ success: true, message: "Category deleted" });
	} catch (error: any) {
		res.status(500).json({ success: false, message: error.message });
	}
};