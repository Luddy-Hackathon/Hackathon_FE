import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

// Ensure environment variables are correctly loaded
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Create a single supabase client for interacting with your database
const supabaseClient = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: true,
  },
});

export default supabaseClient; 