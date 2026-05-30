import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

let client: any = null;

if (supabaseUrl && supabaseUrl.startsWith('http')) {
  try {
    client = createClient(supabaseUrl, supabaseAnonKey);
  } catch (err) {
    console.error('Error al crear el cliente de Supabase:', err);
  }
} else {
  console.warn('Advertencia: Las credenciales de Supabase no están configuradas o el formato es incorrecto.');
}

// Proxy seguro para evitar que la aplicación falle al importarse si no hay variables de entorno en producción
export const supabase = new Proxy({} as any, {
  get(target, prop) {
    if (client && typeof (client as any)[prop] !== 'undefined') {
      const value = (client as any)[prop];
      if (typeof value === 'function') {
        return value.bind(client);
      }
      return value;
    }
    
    // Retornar un mock seguro si Supabase no está configurado
    if (prop === 'from') {
      return (table: string) => {
        const dummyQuery = () => {
          const chain = {
            select: () => chain,
            order: () => chain,
            eq: () => chain,
            maybeSingle: () => Promise.resolve({ data: null, error: { message: 'Supabase no configurado en producción.' } }),
            single: () => Promise.resolve({ data: null, error: { message: 'Supabase no configurado en producción.' } }),
            insert: () => Promise.resolve({ data: null, error: { message: 'Supabase no configurado en producción.' } }),
            upsert: () => Promise.resolve({ data: null, error: { message: 'Supabase no configurado en producción.' } }),
            update: () => chain,
            delete: () => chain,
            then: (resolve: any) => resolve({ data: null, error: { message: 'Supabase no configurado en producción.' } })
          };
          return chain;
        };
        return dummyQuery();
      };
    }
    
    return () => Promise.resolve({ data: null, error: { message: 'Supabase no configurado en producción.' } });
  }
});
