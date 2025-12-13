import { Request, Response } from "express";
import { registerCustomerSchema, updateCustomerSchema, customers, addresses } from "../models/customer.model";
import { db } from "../db";
import bcrypt from "bcrypt";
import { eq, ne, and } from "drizzle-orm";
import jwt from "jsonwebtoken";

import { AuthRequest } from "../middleware/customerAuth";

export const registerUser = async (req: Request, res: Response) => {
  try {
    const parsed = registerCustomerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        errors: parsed.error.format(),
      });
    }

    const { email, password, name, phone } = parsed.data;

    const existing = await db.select().from(customers).where(eq(customers.email, email));

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Email already registered",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [newUser] = await db
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
      message: "User registered successfully!",
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        phone: newUser.phone,
      },
    });
  } catch (err) {
    console.error("Register Error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const loginUser = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const [user] = await db.select().from(customers).where(eq(customers.email, email));

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }
    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET || "your-secret-key", { expiresIn: "7d" });

    return res.status(200).json({
      success: true,
      message: "User logged in successfully",
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (err) {
    console.error("Login Error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateCustomer = async (req: AuthRequest, res: Response) => {
  try {
    const customerId = req.customer?.id;
    if (!customerId) return res.status(401).json({ success: false, message: "Unauthorized" });

    // 1. Validate using the imported schema
    const parsed = updateCustomerSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ success: false, errors: parsed.error.format() });
    }

    const { address, ...profileData } = parsed.data;

    // 2. Check for Unique Conflicts (Email/Phone)
    if (profileData.email || profileData.phone) {
      const existingUser = await db.query.customers.findFirst({
        where: and(profileData.email ? eq(customers.email, profileData.email) : undefined, ne(customers.id, customerId)),
      });

      if (existingUser) {
        return res.status(409).json({ success: false, message: "Email or Phone already in use" });
      }
    }

    // 3. Transaction
    const result = await db.transaction(async (tx) => {
      let updatedUser;
      let newAddress = null;

      // Update Profile
      if (Object.keys(profileData).length > 0) {
        [updatedUser] = await tx.update(customers).set(profileData).where(eq(customers.id, customerId)).returning({
          id: customers.id,
          name: customers.name,
          email: customers.email,
          phone: customers.phone,
        });
      }

      // Insert Address
      if (address) {
        if (address.isDefault) {
          await tx.update(addresses).set({ isDefault: false }).where(eq(addresses.customerId, customerId));
        }

        [newAddress] = await tx
          .insert(addresses)
          .values({
            customerId: customerId,
            ...address,
          })
          .returning();
      }

      return { user: updatedUser, address: newAddress };
    });

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: result,
    });
  } catch (err: any) {
    console.error("Update Error:", err);
    if (err.code === "23505") return res.status(409).json({ success: false, message: "Duplicate data detected" });
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
