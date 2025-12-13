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
  const args = process.argv.slice(2);
  const emailInput = args[0];
  const passwordInput = args[1];

  if (!emailInput || !passwordInput) {
    console.error('❌ Error: Missing arguments.');
    console.error('Usage: npm run seed:admin -- <email> <password>');
    console.error('Example: npm run seed:admin -- ashish@store.com admin123');
    process.exit(1);
  }

  const name = 'Super Admin';
  const role = 'SUPER_ADMIN';

  console.log(`Creating Super Admin...`);
  console.log(`Email: ${emailInput}`);


  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: emailInput,
    password: passwordInput,
    email_confirm: true,
  });

  if (authError) {
    console.log('⚠️ Auth Note:', authError.message); 
    if (!authError.message.includes('already registered')) {
       process.exit(1);
    }
  }


  let userId = authUser?.user?.id;
  
  if (!userId) {
     const { data: existingUser } = await supabase.from('auth.users').select('id').eq('email', emailInput).single();
     const { data: listData } = await supabase.auth.admin.listUsers();
     const found = listData.users.find(u => u.email === emailInput);
     if (found) userId = found.id;
  }

  if (!userId) {
      console.error("❌ Could not find or create user ID.");
      process.exit(1);
  }


  const passwordHash = await bcrypt.hash(passwordInput, 12);


  const { error: dbError } = await supabase.from('admins').upsert(
    {
      id: userId,
      email: emailInput,
      name,
      role,
      password_hash: passwordHash,
      is_active: true,
    },
    { onConflict: 'id' }
  );

  if (dbError) {
    console.error('❌ DB Error:', dbError.message);
    process.exit(1);
  }

  console.log('✅ SUPER ADMIN CREATED SUCCESSFULLY!');
  console.log('-----------------------------------');
  console.log('Email    →', emailInput);
  console.log('Password →', passwordInput);
  console.log('-----------------------------------');
}

createSuperAdmin().catch(console.error);