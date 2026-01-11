import { Request, Response } from "express";
import { uploadImageToSupabase } from "../lib/supabase";

export const uploadFile = async (req: Request, res: Response) => {
    try {
        console.log("hello");
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No file uploaded" });
        }
        const folder = req.query.folder as string | "default";
        console.log(folder, "folder");
        const publicUrl = await uploadImageToSupabase(req.file, folder);

        res.json({ success: true, url: publicUrl });
    } catch (error: any) {
        console.error("Upload Error:", error);
        res.status(500).json({ success: false, message: "Upload failed" });
    }
};