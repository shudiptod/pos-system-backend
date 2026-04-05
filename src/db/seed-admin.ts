// src/db/seed-admin.ts
import "dotenv/config";
import { db } from "../db";
import { admins } from "../models/admin.model";
import bcrypt from "bcrypt";

async function createSuperAdmin() {
	const args = process.argv.slice(2);
	const emailInput = args[0];
	const passwordInput = args[1];

	if (!emailInput || !passwordInput) {
		console.error("❌ Error: Missing arguments.");
		console.error("Usage: npx ts-node src/db/seed-admin.ts <email> <password>");
		console.error("Example: npx ts-node src/db/seed-admin.ts admin@mehedihouse.com admin123");
		process.exit(1);
	}

	console.log(`🌱 Creating Super Admin...`);
	console.log(`Email: ${emailInput}`);

	try {
		const passwordHash = await bcrypt.hash(passwordInput, 12);

    // Inserting directly into the database using Drizzle
		await db.insert(admins).values({
			email: emailInput,
			name: "Super Admin",
			role: "SUPER_ADMIN",
			passwordHash: passwordHash,
			isActive: true,
      // id, createdAt, isDeleted are default in the model, so we don't need to provide them
		});

		console.log("\n✅ SUPER ADMIN CREATED SUCCESSFULLY!");
		console.log("-----------------------------------");
		console.log("Name     → Super Admin");
		console.log("Email    →", emailInput);
		console.log("Password →", passwordInput);
		console.log("-----------------------------------");

		process.exit(0);
	} catch (error: any) {
		if (error.code === "23505") {
			console.error("❌ Error: This email is already registered as an admin.");
		} else {
			console.error("❌ DB Error:", error || error);
		}
		process.exit(1);
	}
}

createSuperAdmin();
