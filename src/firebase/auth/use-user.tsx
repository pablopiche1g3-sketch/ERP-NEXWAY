
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { useAuth, useFirestore } from '../provider';
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

export function UserProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const db = useFirestore();
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currUser) => {
      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = null;
      }

      if (!currUser) {
        setUser(null);
        setRole(null);
        setLoading(false);
        return;
      }

      setUser(currUser);

      const cleanEmail = currUser.email?.trim().toLowerCase();
      const isAdminEmail = cleanEmail === 'pablopiche1g3@gmail.com' || 
                           cleanEmail === 'pinturas.tecnicolorsw@gmail.com' ||
                           cleanEmail === 'saladventastecnicolor@gmail.com';

      // Listen to role reactively from /users/{uid}
      const userDocRef = doc(db, 'users', currUser.uid);
      
      unsubscribeDoc = onSnapshot(userDocRef, async (snapshot) => {
        let currentRole = 'pedidos';
        const cleanEmail = currUser.email?.toLowerCase().trim();

        // 1. Sincronizar desde la fuente de verdad (Supabase) primero
        try {
          if (cleanEmail) {
            // A. Buscar en perfiles activos de Supabase
            const { data: profile } = await supabase
              .from('profiles')
              .select('role')
              .eq('email', cleanEmail)
              .maybeSingle();

            if (profile && profile.role) {
              currentRole = profile.role;
            } else {
              // B. Si no existe perfil en Supabase, buscar si tiene rol preasignado
              const { data: preConf } = await supabase
                .from('system_config')
                .select('value')
                .eq('key', 'preassigned_roles')
                .maybeSingle();

              const preassignedMap = preConf?.value || {};
              if (preassignedMap[cleanEmail]) {
                currentRole = preassignedMap[cleanEmail];

                // Crear automáticamente el perfil consolidado en Supabase con su UID real
                await supabase.from('profiles').insert({
                  id: currUser.uid,
                  email: cleanEmail,
                  role: currentRole
                });

                // Remover el correo del mapa de preasignados para limpiar
                const updatedPreassigned = { ...preassignedMap };
                delete updatedPreassigned[cleanEmail];
                await supabase.from('system_config').upsert({
                  key: 'preassigned_roles',
                  value: updatedPreassigned
                });
              }
            }
          }
        } catch (supabaseErr) {
          console.error("Error al sincronizar roles desde Supabase:", supabaseErr);
        }

        // 2. Resolver rol final y sincronizar con Firestore
        if (snapshot.exists()) {
          const data = snapshot.data();
          const firestoreRole = data.role || 'pedidos';

          if (isAdminEmail) {
            currentRole = 'admin';
          } else if (currentRole === 'pedidos' && firestoreRole !== 'pedidos') {
            // Si Supabase no devolvió un rol personalizado, respetamos el de Firestore
            currentRole = firestoreRole;
          }

          // Si difieren los roles o si es admin y no está marcado en Firestore
          if (firestoreRole !== currentRole || (isAdminEmail && data.role !== 'admin')) {
            await setDoc(userDocRef, { role: currentRole }, { merge: true });
            
            // Garantizar consistencia en Supabase
            try {
              if (cleanEmail) {
                await supabase.from('profiles').upsert({
                  id: currUser.uid,
                  email: cleanEmail,
                  role: currentRole
                });
              }
            } catch (err) {
              console.error("Error al actualizar profiles en Supabase:", err);
            }
          }

          setRole(currentRole);
        } else {
          // Si no existe el documento del usuario en Firestore (Primer Login)
          if (isAdminEmail) {
            currentRole = 'admin';
          } else if (currentRole === 'pedidos' && cleanEmail) {
            // Revisar compatibilidad heredada del documento temporal de Firestore
            try {
              const preassignedDocRef = doc(db, 'users', 'email:' + cleanEmail);
              const preassignedSnap = await getDoc(preassignedDocRef);
              if (preassignedSnap.exists()) {
                const preassignedData = preassignedSnap.data();
                if (preassignedData && preassignedData.role) {
                  currentRole = preassignedData.role;
                }
                await deleteDoc(preassignedDocRef);
              }
            } catch (err) {
              console.warn('Error checking Firestore preassigned fallback:', err);
            }
          }

          // Registrar documento definitivo en Firestore
          await setDoc(userDocRef, {
            uid: currUser.uid,
            email: currUser.email,
            role: currentRole,
            createdAt: new Date().toISOString()
          });

          // Registrar en Supabase si no está creado
          try {
            if (cleanEmail) {
              await supabase.from('profiles').upsert({
                id: currUser.uid,
                email: cleanEmail,
                role: currentRole
              });
            }
          } catch (err) {
            console.error("Error al asegurar perfil en Supabase:", err);
          }

          setRole(currentRole);
        }
        setLoading(false);
      }, (error) => {
        if (error.message?.includes('offline') || error.code === 'unavailable') {
          console.warn('Firestore is offline, using fallback role:', error);
        } else {
          console.error('Error fetching user role:', error);
        }
        const defaultRole = isAdminEmail ? 'admin' : 'pedidos';
        setRole(defaultRole);
        setLoading(false);
      });
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, [auth, db]);

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
