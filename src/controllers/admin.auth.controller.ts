import { Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm"; // Required for WHERE clauses
import { db } from "../db";
import {
  admins,
  createAdminSchema,
  CreateAdminInput,
  UserRole,
} from "../models/admin.model";
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

    res.json({ success: true, message: "Logged in successfully", token });
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