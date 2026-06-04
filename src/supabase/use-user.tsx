'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/supabase/client';
import { User } from '@supabase/supabase-js';

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: [
    'billing', 'accounting', 'purchases', 'suppliers', 'quedan', 'quotations',
    'transfers', 'orders', 'customers', 'inventory', 'institutional', 'management'
  ],
  gerencia: [
    'billing', 'accounting', 'purchases', 'suppliers', 'quedan', 'quotations',
    'transfers', 'orders', 'customers', 'inventory', 'institutional', 'management'
  ],
  encargado: [
    'billing', 'accounting', 'purchases', 'suppliers', 'quedan', 'quotations',
    'transfers', 'orders', 'customers', 'inventory', 'institutional'
  ],
  sub_encargado: [
    'purchases', 'suppliers', 'quotations', 'transfers', 'orders', 'customers', 'inventory'
  ],
  bodeguero: [
    'inventory', 'transfers', 'orders'
  ],
  cajero: [
    'billing', 'orders', 'customers'
  ],
  vendedor: [
    'billing', 'quotations', 'orders', 'customers'
  ],
  motociclista: [
    'transfers', 'orders'
  ],
  pedidos: [
    'orders'
  ]
};

export function hasPermission(role: string | null | undefined, moduleId: string): boolean {
  if (!role) return false;
  if (role === 'admin' || role === 'gerencia') return true;
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
}

const UserContext = createContext<UserContextType>({
  user: null,
  role: null,
  isAdmin: false,
  loading: true,
});

export function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
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
        setLoading(false);
        return;
      }

      const cleanEmail = currentUser.email?.trim().toLowerCase() || '';
      const isAdminEmail = cleanEmail === 'pablopiche1g3@gmail.com' || 
                           cleanEmail === 'pinturas.tecnicolorsw@gmail.com' ||
                           cleanEmail === 'saladventastecnicolor@gmail.com';

      // Cargar rol desde Supabase profiles
      let currentRole = isAdminEmail ? 'admin' : 'pedidos';

      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', currentUser.id)
          .single();

        if (profile && profile.role) {
          currentRole = profile.role;
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
    <UserContext.Provider value={{ user, role, isAdmin, loading }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
