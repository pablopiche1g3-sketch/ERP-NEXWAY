import { supabase } from '@/supabase/client';

export interface SystemUserOption {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

export async function fetchSystemAppUsers(): Promise<SystemUserOption[]> {
  try {
    const { data, error } = await supabase
      .from('app_users')
      .select('id, full_name, email, role')
      .eq('status', 'active')
      .order('full_name', { ascending: true });

    if (!error && data && data.length > 0) {
      // Filtrar cuentas no registradas o de prueba si estuvieran en DB
      const clean = data.filter(u => u.email !== 'caja1@nexway.sv');
      if (clean.length > 0) return clean;
    }
  } catch (err) {
    console.error('Error al cargar usuarios de app_users:', err);
  }

  // Fallback a localStorage
  if (typeof window !== 'undefined') {
    const localUsers = localStorage.getItem('nexway_app_users');
    if (localUsers) {
      try {
        const parsed = JSON.parse(localUsers);
        const cleanLocal = parsed
          .filter((u: any) => u.email !== 'caja1@nexway.sv')
          .map((u: any) => ({
            id: u.id,
            full_name: u.full_name,
            email: u.email,
            role: u.role
          }));
        if (cleanLocal.length > 0) return cleanLocal;
      } catch (e) {
        console.error(e);
      }
    }
  }

  return [
    { id: 'u1', full_name: 'Pablo Piche (Administrador)', email: 'admin@nexway.sv', role: 'administrador' }
  ];
}
