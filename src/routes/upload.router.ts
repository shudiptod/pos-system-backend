import { Request, Response } from "express";
import { uploadImageToSupabase } from "../lib/supabase";

export const uploadFile = async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No file uploaded" });
        }

        // Allow specifying bucket via query (e.g., ?bucket=categories)
        const bucket = (req.query.bucket as string) || "products";

        const publicUrl = await uploadImageToSupabase(req.file, bucket);

        res.json({ success: true, url: publicUrl });
    } catch (error: any) {
        console.error("Upload Error:", error);
        res.status(500).json({ success: false, message: "Upload failed" });
    }
};