import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ddabsivmifzotbpfrjzj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkYWJzaXZtaWZ6b3RicGZyanpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM4Mjc5NjMsImV4cCI6MjA1OTQwMzk2M30.kJydXXrHp2s18cmGfBnnjRhSX_RcGfjcNnqgk4kQrWk';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
}); 