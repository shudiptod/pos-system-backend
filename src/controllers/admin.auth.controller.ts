// src/controllers/admin.auth.controller.ts
import { Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { eq, desc, and } from "drizzle-orm";
import { db } from "../db";
import { admins, createAdminSchema, CreateAdminInput, UserRole } from "../models/admin.model";
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

		// Ensure we only login active and non-deleted admins
		const [admin] = await db
			.select()
			.from(admins)
			.where(and(eq(admins.email, email), eq(admins.isDeleted, false)));

		if (!admin) return res.status(404).json({ success: false, message: "Admin not found or deleted" });

		const isMatch = await bcrypt.compare(password, admin.passwordHash);

		if (!isMatch) return res.status(401).json({ success: false, message: "Invalid credentials" });

		const token = jwt.sign({ id: admin.id, email: admin.email, role: admin.role }, JWT_SECRET, {
			expiresIn: JWT_EXPIRES_IN,
		});

		res.cookie("authToken", token, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "strict",
			maxAge: 7 * 24 * 60 * 60 * 1000,
		});

		res.json({
			success: true,
			message: "Logged in successfully",
			token,
			id: admin.id,
			email: admin.email,
			role: admin.role,
		});
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

// ---------------- ROLE HIERARCHY (Updated) ----------------
const hierarchy: Record<UserRole, UserRole[]> = {
	SUPER_ADMIN: ["ADMIN", "MANAGER", "MODERATOR"],
	ADMIN: ["MANAGER", "MODERATOR"],
	MANAGER: ["MODERATOR"],
	MODERATOR: [],
};

const canCreateRole = (creatorRole: UserRole, targetRole: UserRole) => hierarchy[creatorRole].includes(targetRole);

const canUpdateRole = (updaterRole: UserRole, targetRole: UserRole) =>
	[updaterRole, ...hierarchy[updaterRole]].includes(targetRole);

// ---------------- CREATE ADMIN ----------------
export const createAdmin = async (req: AuthRequest, res: Response) => {
	try {
		const creatorRole = req.user?.role;
		if (!creatorRole) return res.status(401).json({ success: false, message: "Unauthorized" });

		const parsed: CreateAdminInput = createAdminSchema.parse(req.body);

		if (!canCreateRole(creatorRole, parsed.role))
			return res.status(403).json({ success: false, message: "Cannot create this role" });

		const hash = await bcrypt.hash(parsed.password, 12);

		const [newAdmin] = await db
			.insert(admins)
			.values({
				email: parsed.email,
				name: parsed.name,
				role: parsed.role,
				passwordHash: hash,
			})
			.returning();

		const { passwordHash, ...safeAdmin } = newAdmin;

		res.status(201).json({ success: true, message: "Admin created successfully", admin: safeAdmin });
	} catch (err: any) {
		res.status(400).json({ success: false, message: err.message });
	}
};

// ---------------- UPDATE ADMIN ----------------
export const updateAdmin = async (req: AuthRequest, res: Response) => {
	try {
		const updaterRole = req.user?.role;
		if (!updaterRole) return res.status(401).json({ success: false, message: "Unauthorized" });

		const { id } = req.params;
		const { name, role, isDeleted } = req.body; // Added isDeleted support for soft delete

		const [targetAdmin] = await db.select().from(admins).where(eq(admins.id, id));

		if (!targetAdmin) return res.status(404).json({ success: false, message: "Admin not found" });

		if (role && !canUpdateRole(updaterRole, targetAdmin.role))
			return res.status(403).json({ success: false, message: "Cannot update this role" });

		const [updated] = await db
			.update(admins)
			.set({
				name: name ?? targetAdmin.name,
				role: role ?? targetAdmin.role,
				isDeleted: isDeleted ?? targetAdmin.isDeleted, // Allow soft deleting an admin
			})
			.where(eq(admins.id, id))
			.returning();

		const { passwordHash, ...safeAdmin } = updated;

		res.json({ success: true, message: "Admin updated successfully", admin: safeAdmin });
	} catch (err: any) {
		res.status(400).json({ success: false, message: err.message });
	}
};

// ---------------- GET ALL ADMINS ----------------
export const getAllAdmins = async (req: AuthRequest, res: Response) => {
	try {
		const adminId = req.user?.id;
		if (!adminId) {
			return res.status(401).json({ success: false, message: "Unauthorized" });
		}

		// Only fetch admins that are not deleted
		const allAdmins = await db.select().from(admins).where(eq(admins.isDeleted, false));
		const safeAdmins = allAdmins.map(({ passwordHash, ...admin }) => admin);
		res.status(200).json({ success: true, data: safeAdmins });
	} catch (err: any) {
		res.status(500).json({ success: false, message: err.message });
	}
};

export const getAdminInfo = async (req: AuthRequest, res: Response) => {
	try {
		const adminId = req.user?.id;
		if (!adminId) {
			return res.status(401).json({ success: false, message: "Unauthorized" });
		}

		const [admin] = await db
			.select()
			.from(admins)
			.where(and(eq(admins.id, adminId), eq(admins.isDeleted, false)));

		if (!admin) {
			return res.status(404).json({ success: false, message: "Admin not found" });
		}

		const { passwordHash, ...safeAdmin } = admin;

		res.status(200).json({ success: true, data: safeAdmin });
	} catch (err: any) {
		res.status(500).json({ success: false, message: err.message });
	}
};

// ---------------- GET CUSTOMERS ----------------
export const getCustomers = async (req: any, res: Response) => {
	try {
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
			.where(eq(customers.isDeleted, false)) // Only fetch non-deleted customers
			.orderBy(desc(customers.createdAt));

		return res.status(200).json({
			success: true,
			data: allCustomers,
		});
	} catch (err: any) {
		console.error("Get Customers Error:", err);
		return res.status(500).json({
			success: false,
			message: "Internal server error",
		});
	}
};

// ---------------- GET SINGLE CUSTOMER ----------------
export const getCustomer = async (req: any, res: Response) => {
	try {
		const { id } = req?.params;

		if (!id) {
			return res.status(400).json({ success: false, message: "Customer ID is required" });
		}

		const [customer] = await db
			.select({
				id: customers.id,
				name: customers.name,
				email: customers.email,
				phone: customers.phone,
				avatarUrl: customers.avatarUrl,
				isBanned: customers.isBanned,
				notes: customers.notes,
				createdAt: customers.createdAt,
			})
			.from(customers)
			.where(and(eq(customers.id, id), eq(customers.isDeleted, false))) // Ensure not deleted
			.limit(1);

		if (!customer) {
			return res.status(404).json({ success: false, message: "Customer not found" });
		}

		return res.status(200).json({
			success: true,
			data: customer,
		});
	} catch (err: any) {
		console.error("Get Customer Error:", err);
		return res.status(500).json({ success: false, message: "Internal server error" });
	}
};
