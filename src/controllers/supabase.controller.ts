// src/controllers/supabase.controller.ts
import { Request, Response } from "express";
import { uploadImageToSupabase, createSupabaseClient } from "../lib/supabase";
import { AuthRequest } from "../middleware/auth";

export const uploadFile = async (req: AuthRequest, res: Response) => {
	try {
		if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

		const folder = req.query.folder ? String(req.query.folder) : "pos-assets";
		const publicUrl = await uploadImageToSupabase(req.file, folder);

		res.json({ success: true, url: publicUrl });
	} catch (error: any) {
		console.error("Upload Error:", error);
		res.status(500).json({ success: false, message: "Upload failed" });
	}
};

export const getStorageLibrary = async (req: AuthRequest, res: Response) => {
	try {
		const supabase = createSupabaseClient();
		const BUCKET_NAME = "bucket-mehezabinmehedi"; // Change to your POS bucket name if needed

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
					const isFolder = !item.id;

					if (isFolder) {
						return {
							name: item.name,
							type: "folder",
							path: fullPath,
							children: await fetchRecursive(fullPath),
						};
					}

					const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fullPath);

					return {
						name: item.name,
						type: "file",
						path: fullPath,
						url: urlData.publicUrl,
						metadata: item.metadata,
					};
				})
			);
		}

		const tree = await fetchRecursive();
		return res.status(200).json({ success: true, data: tree });
	} catch (error: any) {
		console.error("Storage Library Error:", error);
		return res.status(500).json({ success: false, message: error.message });
	}
};