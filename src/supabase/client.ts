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
  const mockUser = {
    id: 'mock-user-id',
    email: 'admin@nexway.local',
    role: 'authenticated'
  };

  const mockSession = {
    access_token: 'mock-token',
    user: mockUser
  };

  const authMock = {
    getSession: () => Promise.resolve({ data: { session: mockSession }, error: null }),
    onAuthStateChange: (cb: any) => {
      setTimeout(() => cb('SIGNED_IN', mockSession), 100);
      return { data: { subscription: { unsubscribe: () => {} } } };
    },
    signOut: () => Promise.resolve({ error: null }),
    getUser: () => Promise.resolve({ data: { user: mockUser }, error: null }),
    signInWithPassword: () => Promise.resolve({ data: { user: mockUser, session: mockSession }, error: null }),
    signUp: () => Promise.resolve({ data: { user: mockUser, session: mockSession }, error: null })
  };

  return new Proxy({} as any, {
    get(_target, prop: string) {
      if (prop === 'auth') return authMock;
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
