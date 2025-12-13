import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcrypt';

const supabaseUrl = process.env.SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function createSuperAdmin() {
  const email = 'ashish@store.com';
  const password = 'admin123';
  const name = 'Super Admin';
  const role = 'SUPER_ADMIN';

  // 1️⃣ Create user in Supabase Auth
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError) {
    console.error('Auth error:', authError.message);
    process.exit(1);
  }

  // 2️⃣ Hash password for your DB
  const passwordHash = await bcrypt.hash(password, 12);

  // 3️⃣ Upsert into admins table
  const { error: dbError } = await supabase.from('admins').upsert(
    {
      id: authUser.user.id,
      email,
      name,
      role,
      password_hash: passwordHash,
      is_active: true,
    },
    { onConflict: 'id' } // Avoid duplicates
  );

  if (dbError) {
    console.error('DB error:', dbError.message);
    process.exit(1);
  }

  console.log('SUPER ADMIN CREATED SUCCESSFULLY!');
  console.log('Email   →', email);
  console.log('Password →', password);
}

createSuperAdmin().catch(console.error);


