// src/db/seed-categories.ts
import "dotenv/config";
import { db } from "../db";
import { categories } from "../models/category.model";

// The hierarchy extracted from your HTML
const categoryHierarchy = [
    { name: "Cellophane Paper", slug: "cellophane-paper" },
    {
        name: "Hair Care",
        slug: "hair-care",
        children: [
            { name: "Hair Serum", slug: "hair-serum" },
            { name: "Hair Pack", slug: "hair-pack" },
            { name: "Hair Oil", slug: "hair-oil" },
        ],
    },
    { name: "Henna Powder", slug: "henna-powder" },
    { name: "Nail Cone", slug: "nail-cone" },
    { name: "Oil", slug: "oil" },
    {
        name: "Organic Mehedi",
        slug: "organic-mehedi",
        children: [
            { name: "Organic Henna Cone", slug: "organic-henna-cone" },
        ],
    },
    { name: "Perfume", slug: "perfume" },
    { name: "Special Combo", slug: "special-combo" },
    { name: "Tape Dispenser", slug: "tape-dispenser" },
];

async function seedCategories() {
    console.log("🌱 Seeding Categories...");

    try {
        for (const cat of categoryHierarchy) {
            // 1. Insert the parent category
            const [parent] = await db.insert(categories).values({
                name: cat.name,
                slug: cat.slug,
                isActive: true,
                isDeleted: false,
            }).returning();

            console.log(`✅ Created Parent: ${parent.name}`);

            // 2. If it has children, insert them using the parent's generated ID
            if (cat.children && cat.children.length > 0) {
                for (const child of cat.children) {
                    const [childCat] = await db.insert(categories).values({
                        name: child.name,
                        slug: child.slug,
                        parentId: parent.id, // Link to the parent category
                        isActive: true,
                        isDeleted: false,
                    }).returning();

                    console.log(`   ↳ ✅ Created Child: ${childCat.name}`);
                }
            }
        }

        console.log("\n🎉 All categories seeded successfully!");
        process.exit(0);
    } catch (error: any) {
        if (error.code === "23505") {
            console.error("❌ Error: One or more of these categories already exist (Duplicate Slug).");
        } else {
            console.error("❌ DB Error:", error);
        }
        process.exit(1);
    }
}

seedCategories();