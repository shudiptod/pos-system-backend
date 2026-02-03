import { Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { eq, desc } from "drizzle-orm";
import { db } from "../db";
import {
  admins,
  createAdminSchema,
  CreateAdminInput,
  UserRole,
} from "../models/admin.model";
import { customers } from "../models/customer.model";
import { AuthRequest } from "../middleware/auth";

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRES_IN = "7d";

// ---------------- LOGIN ----------------
export const loginAdmin = async (req: AuthRequest, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: "Email and password required" });


    const [admin] = await db
      .select()
      .from(admins)
      .where(eq(admins.email, email));

    if (!admin)
      return res.status(404).json({ success: false, message: "Admin not found" });


    const isMatch = await bcrypt.compare(password, admin.passwordHash);

    if (!isMatch)
      return res.status(401).json({ success: false, message: "Invalid credentials" });

    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // send token in http only cookie 
    res.cookie("authToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({ success: true, message: "Logged in successfully", token, id: admin.id, email: admin.email, role: admin.role });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ---------------- LOGOUT ----------------
export const logoutAdmin = async (req: AuthRequest, res: Response) => {
  try {
    res.clearCookie("authToken");
    res.json({ success: true, message: "Logged out successfully" });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ---------------- ROLE HIERARCHY ----------------
const hierarchy: Record<UserRole, UserRole[]> = {
  SUPER_ADMIN: ["ADMIN", "MANAGER", "TECHNICIAN"],
  ADMIN: ["MANAGER", "TECHNICIAN"],
  MANAGER: ["TECHNICIAN"],
  TECHNICIAN: [],
};

const canCreateRole = (creatorRole: UserRole, targetRole: UserRole) =>
  hierarchy[creatorRole].includes(targetRole);

const canUpdateRole = (updaterRole: UserRole, targetRole: UserRole) =>
  [updaterRole, ...hierarchy[updaterRole]].includes(targetRole);

// ---------------- CREATE ADMIN ----------------
export const createAdmin = async (req: AuthRequest, res: Response) => {
  try {
    const creatorRole = req.user?.role;
    // Ensure req.user exists (Auth middleware should handle this, but safety check)
    if (!creatorRole)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const parsed: CreateAdminInput = createAdminSchema.parse(req.body);

    if (!canCreateRole(creatorRole, parsed.role))
      return res.status(403).json({ success: false, message: "Cannot create this role" });

    const hash = await bcrypt.hash(parsed.password, 12);

    const [newAdmin] = await db.insert(admins).values({
      email: parsed.email,
      name: parsed.name,
      role: parsed.role,
      passwordHash: hash,
    }).returning();

    // Remove passwordHash from response for security
    const { passwordHash, ...safeAdmin } = newAdmin;

    res.status(201).json({ success: true, message: "Admin created successfully", admin: safeAdmin });
  } catch (err: any) {
    // Handle Zod errors or DB constraint errors
    res.status(400).json({ success: false, message: err.message });
  }
};

// ---------------- UPDATE ADMIN ----------------
export const updateAdmin = async (req: AuthRequest, res: Response) => {
  try {
    const updaterRole = req.user?.role;
    if (!updaterRole)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const { id } = req.params;
    const { name, role } = req.body;


    const [targetAdmin] = await db
      .select()
      .from(admins)
      .where(eq(admins.id, id));

    if (!targetAdmin)
      return res.status(404).json({ success: false, message: "Admin not found" });

    if (role && !canUpdateRole(updaterRole, targetAdmin.role))
      return res.status(403).json({ success: false, message: "Cannot update this role" });

    const [updated] = await db.update(admins).set({
      name: name ?? targetAdmin.name,
      role: role ?? targetAdmin.role,
    })
      .where(eq(admins.id, id))
      .returning();

    const { passwordHash, ...safeAdmin } = updated;

    res.json({ success: true, message: "Admin updated successfully", admin: safeAdmin });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const getAllAdmins = async (req: AuthRequest, res: Response) => {
  try {

    const adminId = req.user?.id;
    if (!adminId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const allAdmins = await db.select().from(admins);
    const safeAdmins = allAdmins.map(({ passwordHash, ...admin }) => admin);
    res.status(200).json({ success: true, data: safeAdmins });
  }
  catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export const getAdminInfo = async (req: AuthRequest, res: Response) => {
  try {
    const adminId = req.user?.id;
    if (!adminId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const [admin] = await db
      .select()
      .from(admins)
      .where(eq(admins.id, adminId));

    if (!admin) {
      return res.status(404).json({ success: false, message: "Admin not found" });
    }

    const { passwordHash, ...safeAdmin } = admin;

    res.status(200).json({ success: true, data: safeAdmin });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};



export const getCustomers = async (req: Request, res: Response) => {
  try {
    // Select specific fields to avoid sending passwordHash
    const allCustomers = await db
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
      .orderBy(desc(customers.createdAt)); // Newest first

    return res.status(200).json({
      success: true,
      data: allCustomers,
    });
  } catch (err: any) {
    console.error("Get Customers Error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

export const getCustomer = async (req: import("express").Request, res: Response) => {
  try {
    const { id } = req?.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Customer ID is required"
      });
    }

    // Fetch single customer
    const [customer] = await db
      .select({
        id: customers.id,
        name: customers.name,
        email: customers.email,
        phone: customers.phone,
        avatarUrl: customers.avatarUrl,
        isBanned: customers.isBanned,
        notes: customers.notes, // Maybe only admins should see notes?
        createdAt: customers.createdAt,
      })
      .from(customers)
      .where(eq(customers.id, id))
      .limit(1);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: customer,
    });
  } catch (err: any) {
    console.error("Get Customer Error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};