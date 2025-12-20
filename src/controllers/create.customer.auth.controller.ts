import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { eq, or } from "drizzle-orm"; // Import these operators
import { db } from "../db";
import { customers, registerCustomerSchema } from "../models/customer.model";

export const createCustomer = async (req: Request, res: Response) => {
  try {
    const parsed = registerCustomerSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: parsed.error.format(),
      });
    }

    const { email, name, phone, password } = parsed.data;

    const [existing] = await db
      .select()
      .from(customers)
      .where(or(eq(customers.email, email), eq(customers.phone, phone)))
      .limit(1);

    if (existing) {
      let errorMessage = "Customer already exists.";
      let errorField = "general";

      if (existing.email === email) {
        errorMessage = "Email is already registered.";
        errorField = "email";
      } else if (existing.phone === phone) {
        errorMessage = "Phone number is already registered.";
        errorField = "phone";
      }

      return res.status(409).json({
        success: false,
        message: errorMessage,
        field: errorField,
      });
    }


    const passwordHash = await bcrypt.hash(password, 12);

  
    const [newCustomer] = await db
      .insert(customers)
      .values({
        email,
        name,
        phone,
        passwordHash,
      })
      .returning();

    return res.status(201).json({
      success: true,
      message: "Customer created successfully",
      customer: {
        id: newCustomer.id,
        name: newCustomer.name,
        email: newCustomer.email,
        phone: newCustomer.phone,
      },
    });
  } catch (error: any) {
    console.error("Create Customer Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
