import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from "fs";
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase URL or Anon Key in .env');
}



export const createSupabaseClient = (token?: string) => {
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    global: token
      ? {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
      : undefined,
  });
};



// --- UPDATED HELPER ---
export const uploadImageToSupabase = async (file: Express.Multer.File, folder = "default") => {
  try {

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    // CHANGE 2: Create a Read Stream from the file path (Low Memory usage)
    const fileStream = fs.createReadStream(file.path);

    const { data, error } = await supabase
      .storage
      .from("store-assets")
      .upload(`${folder}/${file.originalname}`, fileStream, {
        contentType: file.mimetype,
        duplex: 'half', // Important for streaming in Node.js environments
        upsert: true,
      });

    if (error) {
      throw error;
    }

    // CHANGE 3: Clean up! Delete the temp file from disk
    fs.unlink(file.path, (err) => {
      if (err) console.error("Error deleting temp file:", err);
    });

    const { data: publicUrlData } = supabase.storage.from("store-assets").getPublicUrl(data.path);
    return publicUrlData.publicUrl;

  } catch (error) {
    // Ensure we delete the file even if upload fails
    if (file?.path) {
      fs.unlink(file.path, () => { });
    }
    throw error;
  }
};