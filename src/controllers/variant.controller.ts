import { Request, Response } from "express";
import { db } from "../db";
import { createVariantSchema, productVariants, updateVariantSchema } from "../models/productVariant.model";
import { eq, or } from "drizzle-orm";
import { AuthRequest } from "@/middleware/auth";
import { products } from "../models";

export const updateVariant = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // 1. Validate Input (Zod treats price as a number)
    const parsed = updateVariantSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ errors: parsed.error.format() });
    }

    const data = parsed.data;

    // 2. Format for Database (Convert Number -> String for Decimal columns)
    const updateData: any = { ...data };

    if (data.price !== undefined) {
      updateData.price = data.price.toString();
    }

    // 3. Update Database
    const [updated] = await db
      .update(productVariants)
      .set(updateData)
      .where(eq(productVariants.id, id))
      .returning();

    if (!updated) return res.status(404).json({ message: "Variant not found" });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("Update Variant Error:", error);
    if (error.code === "23505") {
      return res.status(409).json({ success: false, message: "Duplicate SKU or Barcode detected" });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------------------------------------------------------
// 6. ADD VARIANT TO PRODUCT
// ---------------------------------------------------------
export const addVariantToProduct = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const { productId } = req.query;
    if (!productId || typeof productId !== "string") {
      return res.status(400).json({ success: false, message: "Product ID is required" });
    }
    const rawBody = req.body;

    // 1. Validate Input Data
    const parsed = createVariantSchema.safeParse(rawBody);
    if (!parsed.success) {
      return res.status(400).json({ success: false, errors: parsed.error.format() });
    }
    const data = parsed.data;

    // 2. Check if Parent Product Exists
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!product) {
      return res.status(404).json({ success: false, message: "Parent product not found" });
    }

    // 3. Check for Duplicate SKU or Barcode (Optional but recommended)
    if (data.sku || data.barcode) {
      const existingVariant = await db
        .select()
        .from(productVariants)
        .where(
          or(
            data.sku ? eq(productVariants.sku, data.sku) : undefined,
            data.barcode ? eq(productVariants.barcode, data.barcode) : undefined
          )
        )
        .limit(1);

      if (existingVariant.length > 0) {
        return res.status(409).json({ success: false, message: "Variant with this SKU or Barcode already exists" });
      }
    }

    // 4. Insert New Variant
    const [newVariant] = await db
      .insert(productVariants)
      .values({
        productId: productId,
        title: data.title,
        price: String(data.price), // Convert number to string for Decimal/Numeric column
        stock: data.stock,
        sku: data.sku,
        barcode: data.barcode,
        images: data.images,
        video: data.video,
        options: data.options,
      })
      .returning();

    res.status(201).json({ success: true, data: newVariant });

  } catch (error: any) {
    console.error("Add Variant Error:", error);
    // Handle unique constraint violations that might slip through race conditions
    if (error.code === '23505') { // Postgres unique_violation code
      return res.status(409).json({ success: false, message: "Duplicate SKU or Barcode detected" });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};


export const deleteVariant = async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;

    // Check if variant exists
    const [existingVariant] = await db
      .select()
      .from(productVariants)
      .where(eq(productVariants.id, id))
      .limit(1);

    if (!existingVariant) {
      return res.status(404).json({ success: false, message: "Variant not found" });
    }

    // Delete the variant
    await db
      .delete(productVariants)
      .where(eq(productVariants.id, id));

    res.json({ success: true, message: "Variant deleted successfully" });
  } catch (error: any) {
    console.error("Delete Variant Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
}