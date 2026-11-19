import { supabase } from '@/supabase/client';

export interface SystemUserOption {
  id: string;
  full_name: string;
  name: string;
  email: string;
  role: string;
  branch_id?: string | null;
  station_id?: string | null;
  status?: string;
}

function formatUserDisplayName(email: string, explicitName?: string | null): string {
  if (explicitName && explicitName.trim().length > 0 && !explicitName.includes('@')) {
    return explicitName.trim();
  }
  const prefix = (email || '').split('@')[0] || 'Usuario';
  return prefix
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

export async function fetchSystemAppUsers(): Promise<SystemUserOption[]> {
  const userMap = new Map<string, SystemUserOption>();

  const registerUser = (raw: {
    id?: string;
    email?: string;
    full_name?: string | null;
    name?: string | null;
    role?: string | null;
    branch_id?: string | null;
    station_id?: string | null;
    status?: string | null;
    permissions?: any;
  }) => {
    if (!raw?.email) return;
    const emailLower = raw.email.toLowerCase().trim();
    if (!emailLower || emailLower === 'caja1@nexway.sv') return;

    const status = (raw.status || raw.permissions?.status || 'ACTIVO').toUpperCase();
    if (status === 'INACTIVO') return;

    const existing = userMap.get(emailLower);
    const displayName = formatUserDisplayName(
      raw.email,
      raw.full_name || raw.name || raw.permissions?.full_name || existing?.full_name
    );

    userMap.set(emailLower, {
      id: raw.id || existing?.id || `usr-${emailLower.split('@')[0]}`,
      full_name: displayName,
      name: displayName,
      email: raw.email,
      role: raw.role || existing?.role || 'vendedor',
      branch_id: raw.branch_id ?? existing?.branch_id ?? null,
      station_id: raw.station_id ?? existing?.station_id ?? null,
      status,
    });
  };

  try {
    // 1. Si estamos en el navegador, consultar endpoint de reconciliación /api/users/create (GET)
    // que sincroniza auth.users con public.profiles automáticamente.
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch('/api/users/create', { method: 'GET', cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json?.users)) {
            json.users.forEach((u: any) => registerUser(u));
          }
        }
      } catch {
        // Ignorar fallo de red y continuar con consulta directa a Supabase
      }
    }

    // 2. Cargar directamente desde public.profiles (select('*') para evitar error de columna full_name)
    const { data: profs } = await supabase.from('profiles').select('*');
    if (Array.isArray(profs)) {
      profs.forEach((p: any) => registerUser(p));
    }

    // 3. Cargar desde system_config (app_users_registry y preassigned_roles)
    const { data: cfgRows } = await supabase
      .from('system_config')
      .select('key, value')
      .in('key', ['app_users_registry', 'preassigned_roles']);

    if (Array.isArray(cfgRows)) {
      const regRow = cfgRows.find((r: any) => r.key === 'app_users_registry');
      if (Array.isArray(regRow?.value)) {
        regRow.value.forEach((u: any) => registerUser(u));
      }

      const preRow = cfgRows.find((r: any) => r.key === 'preassigned_roles');
      const preVal = preRow?.value;
      if (Array.isArray(preVal)) {
        preVal.forEach((u: any) => registerUser(u));
      } else if (preVal && typeof preVal === 'object') {
        Object.entries(preVal).forEach(([em, val]: [string, any]) => {
          const parsed = typeof val === 'string' ? { role: val } : val;
          registerUser({
            id: `pre-${em.split('@')[0]}`,
            email: em,
            role: parsed?.role || 'vendedor',
            branch_id: parsed?.branch_id || null,
            station_id: parsed?.station_id || null,
          });
        });
      }
    }
  } catch (err) {
    console.error('Error al cargar usuarios del sistema:', err);
  }

  // 4. Combinar y actualizar respaldo en localStorage
  if (typeof window !== 'undefined') {
    const localUsers = localStorage.getItem('nexway_app_users');
    if (localUsers) {
      try {
        const parsed = JSON.parse(localUsers);
        if (Array.isArray(parsed)) {
          parsed.forEach((u: any) => registerUser(u));
        }
      } catch (e) {
        console.error(e);
      }
    }
  }

  const result = Array.from(userMap.values());
  if (result.length > 0) {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('nexway_app_users', JSON.stringify(result));
      } catch {
        // Ignore storage quota error
      }
    }
    return result;
  }

  return [
    {
      id: 'u1',
      full_name: 'Pablo Piche (Administrador)',
      name: 'Pablo Piche (Administrador)',
      email: 'pablopiche1g3@gmail.com',
      role: 'admin',
    },
  ];
}
