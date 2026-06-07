import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

function createSupabaseClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseUrl.startsWith('http') || !supabaseAnonKey) return null;
  return createClient(supabaseUrl, supabaseAnonKey);
}

const realClient = createSupabaseClient();

function createMockClient(): SupabaseClient {
  const response = Promise.resolve({ data: null, error: null });
  const chain: any = {
    select: () => chain,
    order: () => chain,
    eq: () => chain,
    limit: () => chain,
    maybeSingle: () => response,
    single: () => response,
    insert: () => response,
    upsert: () => response,
    update: () => chain,
    delete: () => chain,
  };
  return new Proxy({} as any, {
    get(_target, prop: string) {
      if (prop === 'from') return () => chain;
      if (prop === 'channel') return () => ({ on: () => ({}), subscribe: () => ({}), unsubscribe: () => {} });
      if (prop === 'removeChannel') return () => {};
      return () => response;
    }
  });
}

export const supabase: SupabaseClient = realClient || createMockClient();
if (!realClient && typeof window !== 'undefined') {
  console.warn('Supabase: variables de entorno ausentes. Usando mock.');
}
