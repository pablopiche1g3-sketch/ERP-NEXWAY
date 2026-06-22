'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/supabase/client';
import { User } from '@supabase/supabase-js';
import { isAdminEmail } from '@/lib/admin-emails';

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: [
    'billing', 'accounting', 'purchases', 'suppliers', 'quedan', 'quotations',
    'transfers', 'orders', 'customers', 'inventory', 'institutional', 'management', 'documents'
  ],
  gerencia: [
    'billing', 'accounting', 'purchases', 'suppliers', 'quedan', 'quotations',
    'transfers', 'orders', 'customers', 'inventory', 'institutional', 'management', 'documents'
  ],
  encargado: [
    'billing', 'accounting', 'purchases', 'suppliers', 'quedan', 'quotations',
    'transfers', 'orders', 'customers', 'inventory', 'institutional', 'documents'
  ],
  sub_encargado: [
    'purchases', 'suppliers', 'quotations', 'transfers', 'orders', 'customers', 'inventory', 'documents'
  ],
  bodeguero: [
    'inventory', 'transfers', 'orders', 'documents'
  ],
  cajero: [
    'billing', 'orders', 'customers', 'documents'
  ],
  vendedor: [
    'billing', 'quotations', 'orders', 'customers', 'documents'
  ],
  motociclista: [
    'transfers', 'orders', 'documents'
  ],
  pedidos: [
    'orders', 'documents'
  ]
};

export function hasPermission(
  role: string | null | undefined,
  moduleId: string,
  customPermissions?: { modules: string[]; tabs: string[] } | null
): boolean {
  if (role === 'admin' || role === 'gerencia') return true;
  if (customPermissions && Array.isArray(customPermissions.modules)) {
    return customPermissions.modules.includes(moduleId);
  }
  if (!role) return false;
  const allowed = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS['pedidos'];
  return allowed.includes(moduleId);
}

export function getTenantName(): string | null {
  if (typeof window !== 'undefined') {
    return window.localStorage.getItem('nexway_tenant');
  }
  return null;
}

interface UserContextType {
  user: User | null;
  role: string | null;
  isAdmin: boolean;
  loading: boolean;
  branchId: string | null;
  permissions: {
    modules: string[];
    tabs: string[];
  } | null;
}

const UserContext = createContext<UserContextType>({
  user: null,
  role: null,
  isAdmin: false,
  loading: true,
  branchId: null,
  permissions: null,
});

export function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Obtener sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) handleSession(session);
    });

    // Escuchar cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (mounted) handleSession(session);
    });

    async function handleSession(session: any) {
      const currentUser = session?.user || null;
      setUser(currentUser);

      if (!currentUser) {
        setRole(null);
        setBranchId(null);
        setPermissions(null);
        setLoading(false);
        return;
      }

      const cleanEmail = currentUser.email?.trim().toLowerCase() || '';
      const userIsAdmin = isAdminEmail(cleanEmail);

      // Cargar rol desde Supabase profiles
      let currentRole = userIsAdmin ? 'admin' : 'pedidos';

      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role, branch_id, permissions')
          .eq('id', currentUser.id)
          .single();

        if (profile) {
          // Force admin role if it's an admin email, regardless of DB value
          if (userIsAdmin && profile.role !== 'admin') {
            currentRole = 'admin';
            // Update the DB to reflect the correct role
            await supabase.from('profiles').update({ role: 'admin' }).eq('id', currentUser.id);
          } else {
            currentRole = profile.role;
          }
          if (mounted) {
            setBranchId(profile.branch_id);
            setPermissions(profile.permissions);
            
            // Si el usuario tiene una sucursal asignada y no es administrador,
            // forzamos a que su active_branch_id inicial sea la asignada.
            if (profile.branch_id && profile.role !== 'admin' && profile.role !== 'gerencia') {
              localStorage.setItem('active_branch_id', profile.branch_id);
              // Disparar evento para que otras vistas se actualicen reactivamente
              window.dispatchEvent(new Event('branchChanged'));
            }
          }
        } else if (error && error.code === 'PGRST116') {
          // El perfil no existe aún, lo creamos
          await supabase.from('profiles').upsert({
            id: currentUser.id,
            email: cleanEmail,
            role: currentRole
          });
        }
      } catch (err) {
        console.error("Error cargando perfil de Supabase:", err);
      }

      if (mounted) {
        setRole(currentRole);
        setLoading(false);
      }
    }

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const isAdmin = role === 'admin' || role === 'gerencia';

  return (
    <UserContext.Provider value={{ user, role, isAdmin, loading, branchId, permissions }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
