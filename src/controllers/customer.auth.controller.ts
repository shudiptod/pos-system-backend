// src/controllers/customer.auth.controller.ts
import { Request, Response } from "express";
import { registerCustomerSchema, updateCustomerSchema, customers } from "../models/customer.model"; // removed addresses
import { db } from "../db";
import bcrypt from "bcrypt";
import { eq, ne, and, or, desc } from "drizzle-orm";
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

		const [existingUser] = await db
			.select()
			.from(customers)
			.where(or(eq(customers.email, email), eq(customers.phone, phone)))
			.limit(1);

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

		// Check if user exists and is NOT deleted
		const [user] = await db
			.select()
			.from(customers)
			.where(and(eq(customers.email, email), eq(customers.isDeleted, false)));

		if (!user) {
			return res.status(401).json({
				success: false,
				message: "Invalid email or password",
			});
		}

		// Optional: Check if banned
		if (user.isBanned) {
			return res.status(403).json({
				success: false,
				message: "This account has been banned.",
			});
		}

		const valid = await bcrypt.compare(password, user.passwordHash);
		if (!valid) {
			return res.status(401).json({
				success: false,
				message: "Invalid email or password",
			});
		}

		const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET || "your-secret-key", {
			expiresIn: "7d",
		});

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
// 3. GET CUSTOMER INFO
// ==========================================
export const getCustomerInfo = async (req: AuthRequest, res: Response) => {
	try {
		const userId = req.customer?.id;

		if (!userId) {
			return res.status(401).json({ success: false, message: "Unauthorized" });
		}

		// Fetch Profile (Addresses removed from logic)
		const [customer] = await db
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
			.where(and(eq(customers.id, userId), eq(customers.isDeleted, false)))
			.limit(1);

		if (!customer) {
			return res.status(404).json({ success: false, message: "User not found" });
		}

		return res.status(200).json({
			success: true,
			user: customer,
		});
	} catch (err) {
		console.error("Get Info Error:", err);
		return res.status(500).json({ success: false, message: "Internal server error" });
	}
};

// ==========================================
// 4. UPDATE CUSTOMER
// ==========================================
export const updateCustomer = async (req: AuthRequest, res: Response) => {
	try {
		const customerId = req.customer?.id;
		if (!customerId) return res.status(401).json({ success: false, message: "Unauthorized" });

		const parsed = updateCustomerSchema.safeParse(req.body);
		if (!parsed.success) {
			return res.status(400).json({ success: false, errors: parsed.error.format() });
		}

		// The Zod schema no longer contains 'address', so parsed.data is just profile info
		const profileData = parsed.data;
		const updateValues: any = { ...profileData };

		if (req.body.password && req.body.password.length >= 6) {
			const passwordHash = await bcrypt.hash(req.body.password, 10);
			updateValues.passwordHash = passwordHash;
		}

		if (updateValues.email || updateValues.phone) {
			const conflictCheck = await db
				.select()
				.from(customers)
				.where(
					and(
						ne(customers.id, customerId),
						or(
							updateValues.email ? eq(customers.email, updateValues.email) : undefined,
							updateValues.phone ? eq(customers.phone, updateValues.phone) : undefined,
						),
						eq(customers.isDeleted, false),
					),
				)
				.limit(1);

			if (conflictCheck.length > 0) {
				return res.status(409).json({
					success: false,
					message: "Email or Phone already in use by another account",
				});
			}
		}

		let updatedUser;
		if (Object.keys(updateValues).length > 0) {
			[updatedUser] = await db.update(customers).set(updateValues).where(eq(customers.id, customerId)).returning({
				id: customers.id,
				name: customers.name,
				email: customers.email,
				phone: customers.phone,
			});
		}

		return res.status(200).json({
			success: true,
			message: "Profile updated successfully",
			data: { user: updatedUser },
		});
	} catch (err: any) {
		console.error("Update Error:", err);
		if (err.code === "23505") return res.status(409).json({ success: false, message: "Duplicate data detected" });
		return res.status(500).json({ success: false, message: "Internal server error" });
	}
};
