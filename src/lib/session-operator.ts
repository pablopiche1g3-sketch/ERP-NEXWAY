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
      return data;
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
        return parsed.map((u: any) => ({
          id: u.id,
          full_name: u.full_name,
          email: u.email,
          role: u.role
        }));
      } catch (e) {
        console.error(e);
      }
    }
  }

  return [
    { id: 'u1', full_name: 'Pablo Piche (Administrador)', email: 'admin@nexway.sv', role: 'administrador' },
    { id: 'u2', full_name: 'Carlos Mendoza (Cajero POS)', email: 'caja1@nexway.sv', role: 'cajero' }
  ];
}
