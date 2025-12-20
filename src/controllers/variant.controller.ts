import { Request, Response } from "express";
import { db } from "../db";
import { productVariants, updateVariantSchema } from "../models/productVariant.model";
import { eq } from "drizzle-orm";

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