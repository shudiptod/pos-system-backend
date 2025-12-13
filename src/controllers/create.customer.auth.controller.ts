import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { db } from "../db"; // your drizzle db instance
import { customers, registerCustomerSchema, RegisterCustomerInput } from "../models/customer.model";

export const createCustomer = async (req: Request, res: Response) => {
  try {
    // Validate input
    const parsed: RegisterCustomerInput = registerCustomerSchema.parse(req.body);

    // Hash password
    const passwordHash = await bcrypt.hash(parsed.password, 12);

    // Insert into customers table
    const [newCustomer] = await db.insert(customers).values({
      email: parsed.email,
      name: parsed.name,
      phone: parsed.phone,
      passwordHash,
    }).returning();

    res.status(201).json({
      success: true,
      message: "Customer created successfully",
      customer: newCustomer,
      // createdBy: req.user?.id,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};


