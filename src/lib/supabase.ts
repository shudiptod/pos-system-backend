import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase URL or Anon Key in .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const createSupabaseClient = (token?: string) => {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: token
      ? {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
      : undefined,
  });
};

// Helper to upload file
export const uploadImageToSupabase = async (file: Express.Multer.File, bucket: string = 'images') => {
  try {
    // Create a unique filename: timestamp-originalName
    const fileExt = file.originalname.split('.').pop();
    const fileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}.${fileExt}`;
    const filePath = `categories/${fileName}`;

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (error) throw error;

    // Get Public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return publicUrl;
  } catch (error) {
    console.error("Supabase Upload Error:", error);
    throw new Error("Image upload failed");
  }
};