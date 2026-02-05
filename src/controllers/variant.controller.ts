import { Request, Response } from "express";
import { db } from "../db";
import { createVariantSchema, productVariants, updateVariantSchema } from "../models/productVariant.model";
import { eq, inArray, or, sql } from "drizzle-orm";
import { AuthRequest } from "@/middleware/auth";
import { deleteProductsSchema, products } from "../models";
import z from "zod";

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


export const deleteVariants = async (req: Request, res: Response) => {
  try {

    const payload = deleteProductsSchema.parse(req.body);

    if (payload.length === 0) {
      return res.status(400).json({ success: false, message: "No items selected" });
    }

    const variantIdsToDelete = payload.map((p) => p.variantId);

    // We collect unique Product IDs to check for cleanup later
    const touchedProductIds = [...new Set(payload.map((p) => p.productId))];

    // 2. Perform Deletion in a Transaction
    await db.transaction(async (tx) => {
      // A. Delete the requested variants
      await tx.delete(productVariants).where(
        inArray(productVariants.id, variantIdsToDelete)
      );

      // B. Cleanup: Check if parent products are now empty (Orphan check)
      // This is optional but keeps your DB clean.
      for (const productId of touchedProductIds) {
        // Count remaining variants for this product
        const [result] = await tx
          .select({ count: sql<number>`count(*)` })
          .from(productVariants)
          .where(eq(productVariants.productId, productId));

        // If count is 0, delete the parent product
        if (Number(result.count) === 0) {
          await tx.delete(products).where(eq(products.id, productId));
          console.log(`Auto-deleted orphan product: ${productId}`);
        }
      }
    });

    return res.status(200).json({
      success: true,
      message: `Successfully deleted ${variantIdsToDelete.length} item(s)`,
    });

  } catch (error) {
    console.error("Delete error:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Invalid data format",
        errors: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};