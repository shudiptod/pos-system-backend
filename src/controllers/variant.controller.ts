import { Request, Response } from "express";
import { db } from "../db";
import { productVariants, updateVariantSchema } from "../models/productVariant.model";
import { eq } from "drizzle-orm";

export const updateVariant = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Validate only the fields provided (Partial Update)
    const parsed = updateVariantSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.format() });

    const [updated] = await db
      .update(productVariants)
      .set(parsed.data)
      .where(eq(productVariants.id, id))
      .returning();

    if (!updated) return res.status(404).json({ message: "Variant not found" });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};