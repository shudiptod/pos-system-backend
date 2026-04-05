// src/controllers/supabase.controller.ts
import { Request, Response } from "express";
import { uploadImageToSupabase, createSupabaseClient } from "../lib/supabase";
import { AuthRequest } from "@/middleware/auth";

export const uploadFile = async (req: Request, res: Response) => {
	try {
		// For customer uploads, we might want to associate the file with the user or apply different rules
		const user = (req as AuthRequest).user;
		console.log(user);
		if (!req.file) {
			return res.status(400).json({ success: false, message: "No file uploaded" });
		}
		const folder = user?.id ? (req.query.folder as string) : "avatar";
		console.log(folder);
		const publicUrl = await uploadImageToSupabase(req.file, folder);
		console.log(publicUrl);

		res.json({ success: true, url: publicUrl });
	} catch (error: any) {
		console.error("Upload Error:", error);
		res.status(500).json({ success: false, message: "Upload failed" });
	}
};

export const getStorageLibrary = async (req: AuthRequest, res: Response) => {
	try {
		// check if user is admin or not
		const user = req.user;
		if (!user) {
			return res.status(401).json({ success: false, message: "Unauthorized" });
		}

		const supabase = createSupabaseClient();
		const BUCKET_NAME = "bucket-mehezabinmehedi";

		/**
		 * Recursive function to fetch files and folders
		 */
		async function fetchRecursive(path = ""): Promise<any[]> {
			const { data, error } = await supabase.storage.from(BUCKET_NAME).list(path, {
				limit: 100,
				offset: 0,
				sortBy: { column: "name", order: "asc" },
			});

			if (error) throw error;

			return Promise.all(
				data.map(async (item) => {
					const fullPath = path ? `${path}/${item.name}` : item.name;

					// Supabase marks folders by not having an 'id' or metadata
					const isFolder = !item.id;

					if (isFolder) {
						return {
							name: item.name,
							type: "folder",
							path: fullPath,
							children: await fetchRecursive(fullPath), // Dig deeper
						};
					}

					// It's a file - get the public URL
					const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fullPath);

					return {
						name: item.name,
						type: "file",
						path: fullPath,
						url: urlData.publicUrl,
						metadata: item.metadata,
					};
				}),
			);
		}

		const tree = await fetchRecursive();

		return res.status(200).json({
			success: true,
			data: tree,
		});
	} catch (error: any) {
		console.error("Storage Library Error:", error);
		return res.status(500).json({
			success: false,
			message: error.message || "Internal Server Error",
		});
	}
};
