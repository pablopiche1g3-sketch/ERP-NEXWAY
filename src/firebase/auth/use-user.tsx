
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/supabase/client';

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

interface UserContextType {
  user: any | null;
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

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function handleSession(session: any) {
      if (!session || !session.user) {
        setUser(null);
        setRole(null);
        setLoading(false);
        return;
      }

      const currUser = session.user;
      const mappedUser = {
        ...currUser,
        uid: currUser.id,
        id: currUser.id,
      };

      setUser(mappedUser);

      const cleanEmail = currUser.email?.trim().toLowerCase();
      const isAdminEmail = cleanEmail === 'pablopiche1g3@gmail.com' || 
                           cleanEmail === 'pinturas.tecnicolorsw@gmail.com' ||
                           cleanEmail === 'saladventastecnicolor@gmail.com';

      let currentRole = 'pedidos';

      try {
        if (cleanEmail) {
          // A. Buscar en perfiles activos de Supabase
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', currUser.id)
            .maybeSingle();

          if (profile && profile.role) {
            currentRole = profile.role;
          } else {
            // B. Si es correo administrador, lo auto-creamos
            if (isAdminEmail) {
              currentRole = 'admin';
              await supabase.from('profiles').upsert({
                id: currUser.id,
                email: cleanEmail,
                role: currentRole
              });
            } else {
              // C. Buscar si tiene rol preasignado en system_config
              const { data: preConf } = await supabase
                .from('system_config')
                .select('value')
                .eq('key', 'preassigned_roles')
                .maybeSingle();

              const preassignedMap = preConf?.value || {};
              if (preassignedMap[cleanEmail]) {
                currentRole = preassignedMap[cleanEmail];

                await supabase.from('profiles').insert({
                  id: currUser.id,
                  email: cleanEmail,
                  role: currentRole
                });

                // Limpiar preasignados
                const updatedPreassigned = { ...preassignedMap };
                delete updatedPreassigned[cleanEmail];
                await supabase.from('system_config').upsert({
                  key: 'preassigned_roles',
                  value: updatedPreassigned
                });
              } else {
                // Rol por defecto si no hay preasignación
                await supabase.from('profiles').insert({
                  id: currUser.id,
                  email: cleanEmail,
                  role: currentRole
                });
              }
            }
          }
        }
      } catch (err) {
        console.error("Error al resolver perfil/rol del usuario en Supabase:", err);
      }

      setRole(currentRole);
      setLoading(false);
    }

    // 1. Cargar sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
    });

    // 2. Escuchar cambios de sesión
    const { data: { subscription } } = supabase.auth.onAuthStateChanged((_event, session) => {
      handleSession(session);
    });

    return () => {
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
