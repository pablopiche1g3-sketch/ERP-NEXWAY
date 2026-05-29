import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Advertencia: Las credenciales de Supabase no están configuradas en .env.local');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
