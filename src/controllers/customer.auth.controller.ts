import { Request, Response } from "express";
import { registerCustomerSchema, updateCustomerSchema, customers, addresses } from "../models/customer.model";
import { db } from "../db";
import bcrypt from "bcrypt";
import { eq, ne, and, or,desc } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { AuthRequest } from "../middleware/customerAuth";

// ==========================================
// 1. REGISTER USER
// ==========================================
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

    // Check for existing user by Email OR Phone
    const [existingUser] = await db
      .select()
      .from(customers)
      .where(or(eq(customers.email, email), eq(customers.phone, phone)))
      .limit(1);

    // Determine precisely which field matched
    if (existingUser) {
      let errorMessage = "User already registered.";
      let errorField = "general";

      if (existingUser.email === email) {
        errorMessage = "Email is already registered.";
        errorField = "email";
      } else if (existingUser.phone === phone) {
        errorMessage = "Phone number is already registered.";
        errorField = "phone";
      }

      return res.status(409).json({
        success: false,
        message: errorMessage,
        field: errorField,
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

// ==========================================
// 2. LOGIN USER
// ==========================================
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

// ==========================================
// 3. GET CUSTOMER INFO (New)
// ==========================================

export const getCustomerInfo = async (req: AuthRequest, res: Response) => {
  try {
    // 1. Get ID from the authenticated user
    const userId = req.customer?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // 2. Fetch Customer & Addresses in parallel for performance
    const [customerResult, addressResult] = await Promise.all([
      // Fetch Profile (Exclude password)
      db
        .select({
          id: customers.id,
          name: customers.name,
          email: customers.email,
          phone: customers.phone,
          avatarUrl: customers.avatarUrl,
          isBanned: customers.isBanned,
          createdAt: customers.createdAt,
        })
        .from(customers)
        .where(eq(customers.id, userId))
        .limit(1),

      // Fetch All Addresses for this user
      db
        .select()
        .from(addresses)
        .where(eq(addresses.customerId, userId))
        // Optional: Sort so Default address comes first
        .orderBy(desc(addresses.isDefault)),
    ]);

    const customer = customerResult[0];

    if (!customer) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // 3. Combine data and return
    return res.status(200).json({
      success: true,
      user: {
        ...customer,
        addresses: addressResult, // Array of address objects (empty [] if none)
      },
    });
  } catch (err) {
    console.error("Get Info Error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ==========================================
// 4. UPDATE CUSTOMER (Updated with Password)
// ==========================================
export const updateCustomer = async (req: AuthRequest, res: Response) => {
  try {
    const customerId = req.customer?.id;
    if (!customerId) return res.status(401).json({ success: false, message: "Unauthorized" });

    // 1. Validate profile data using schema
    const parsed = updateCustomerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, errors: parsed.error.format() });
    }

    // Extract address separately, keep remaining profile fields
    const { address, ...profileData } = parsed.data;

    // Define an object to hold the values to update
    const updateValues: any = { ...profileData };

    // 2. Handle Password Update Explicitly
    // (We check req.body directly because 'updateCustomerSchema' usually omits password)
    if (req.body.password && req.body.password.length >= 6) {
      const passwordHash = await bcrypt.hash(req.body.password, 10);
      updateValues.passwordHash = passwordHash;
    }

    // 3. Check for Unique Conflicts (Email/Phone) if they are being changed
    if (updateValues.email || updateValues.phone) {
      // We look for ANY user that has this email/phone BUT has a different ID
      const conflictCheck = await db
        .select()
        .from(customers)
        .where(
          and(
            ne(customers.id, customerId), // NOT the current user
            or(updateValues.email ? eq(customers.email, updateValues.email) : undefined, updateValues.phone ? eq(customers.phone, updateValues.phone) : undefined)
          )
        )
        .limit(1);

      if (conflictCheck.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Email or Phone already in use by another account",
        });
      }
    }

    // 4. Transaction: Update Profile & Address safely
    const result = await db.transaction(async (tx) => {
      let updatedUser;
      let newAddress = null;

      // Update Profile Table if there is data
      if (Object.keys(updateValues).length > 0) {
        [updatedUser] = await tx.update(customers).set(updateValues).where(eq(customers.id, customerId)).returning({
          id: customers.id,
          name: customers.name,
          email: customers.email,
          phone: customers.phone,
        });
      }

      // Update/Insert Address Table if address data exists
      if (address) {
        // If setting as default, unset previous defaults for this user
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
    // Unique constraint violation (Postgres error 23505) fallback
    if (err.code === "23505") return res.status(409).json({ success: false, message: "Duplicate data detected" });
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
