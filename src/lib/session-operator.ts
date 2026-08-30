import { supabase } from '@/supabase/client';

export interface SystemUserOption {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

export async function fetchSystemAppUsers(): Promise<SystemUserOption[]> {
  const userMap = new Map<string, SystemUserOption>();

  try {
    // 1. Cargar desde profiles (Supabase Auth users)
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, email, full_name, role');

    if (profs && profs.length > 0) {
      profs.forEach(p => {
        if (!p.email) return;
        const emailLower = p.email.toLowerCase().trim();
        if (emailLower === 'caja1@nexway.sv') return;
        userMap.set(emailLower, {
          id: p.id,
          full_name: p.full_name || p.email,
          email: p.email,
          role: p.role || 'cajero'
        });
      });
    }

    // 2. Cargar desde app_users (Usuarios de Gerencia)
    const { data: appUsers } = await supabase
      .from('app_users')
      .select('id, full_name, email, role')
      .eq('status', 'active');

    if (appUsers && appUsers.length > 0) {
      appUsers.forEach(u => {
        if (!u.email) return;
        const emailLower = u.email.toLowerCase().trim();
        if (emailLower === 'caja1@nexway.sv') return;
        userMap.set(emailLower, {
          id: u.id,
          full_name: u.full_name || u.email,
          email: u.email,
          role: u.role || 'cajero'
        });
      });
    }
  } catch (err) {
    console.error('Error al cargar usuarios:', err);
  }

  // Fallback a localStorage
  if (typeof window !== 'undefined') {
    const localUsers = localStorage.getItem('nexway_app_users');
    if (localUsers) {
      try {
        const parsed = JSON.parse(localUsers);
        parsed.forEach((u: any) => {
          if (!u.email) return;
          const emailLower = u.email.toLowerCase().trim();
          if (emailLower === 'caja1@nexway.sv') return;
          if (!userMap.has(emailLower)) {
            userMap.set(emailLower, {
              id: u.id,
              full_name: u.full_name || u.email,
              email: u.email,
              role: u.role || 'cajero'
            });
          }
        });
      } catch (e) {
        console.error(e);
      }
    }
  }

  const result = Array.from(userMap.values());
  if (result.length > 0) return result;

  return [
    { id: 'u1', full_name: 'Pablo Piche (Administrador)', email: 'admin@nexway.sv', role: 'administrador' }
  ];
}
