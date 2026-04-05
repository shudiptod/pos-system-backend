// src/controllers/customer.controller.ts
import { Request, Response } from "express";
import { db } from "../db";
import { customers, registerCustomerSchema, updateCustomerSchema } from "../models/customer.model";
import { eq, or, and, ilike } from "drizzle-orm";

export const createCustomer = async (req: Request, res: Response) => {
  try {
    const parsed = registerCustomerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, errors: parsed.error.format() });

    const { name, phone, email } = parsed.data;

    // Check duplicate phone
    const [existing] = await db.select().from(customers).where(eq(customers.phone, phone)).limit(1);
    if (existing) return res.status(409).json({ success: false, message: "Phone number already registered." });

    const [newCustomer] = await db.insert(customers).values({ name, phone, email }).returning();
    res.status(201).json({ success: true, message: "Customer created", data: newCustomer });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCustomers = async (req: Request, res: Response) => {
  try {
    const { search } = req.query;
    let conditions = eq(customers.isDeleted, false);

    // Allow typeahead search by name or phone for POS checkout
    if (search && typeof search === "string") {
      conditions = and(
        conditions,
        or(ilike(customers.name, `%${search}%`), ilike(customers.phone, `%${search}%`))
      ) as any;
    }

    const data = await db.select().from(customers).where(conditions).orderBy(customers.createdAt);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCustomerById = async (req: Request, res: Response) => {
  try {
    const [customer] = await db
      .select()
      .from(customers)
      .where(and(eq(customers.id, req.params.id), eq(customers.isDeleted, false)));

    if (!customer) return res.status(404).json({ success: false, message: "Customer not found" });
    res.json({ success: true, data: customer });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateCustomer = async (req: Request, res: Response) => {
  try {
    const parsed = updateCustomerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, errors: parsed.error.format() });

    const [updated] = await db
      .update(customers)
      .set(parsed.data)
      .where(and(eq(customers.id, req.params.id), eq(customers.isDeleted, false)))
      .returning();

    if (!updated) return res.status(404).json({ success: false, message: "Customer not found" });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    if (error.code === "23505") return res.status(409).json({ success: false, message: "Phone number already exists" });
    res.status(500).json({ success: false, message: error.message });
  }
};