
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { useAuth, useFirestore } from '../provider';

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

        if (snapshot.exists()) {
          const data = snapshot.data();
          let currentRole = data.role || 'pedidos';

          // Force admin role if it's the admin email but not saved as admin
          if (isAdminEmail && currentRole !== 'admin') {
            currentRole = 'admin';
            await setDoc(userDocRef, { role: 'admin' }, { merge: true });
          }

          setRole(currentRole);
        } else {
          // Auto-seed
          let defaultRole = isAdminEmail ? 'admin' : 'pedidos';

          if (currUser.email) {
            try {
              const preassignedDocRef = doc(db, 'users', 'email:' + currUser.email.toLowerCase());
              const preassignedSnap = await getDoc(preassignedDocRef);
              if (preassignedSnap.exists()) {
                const preassignedData = preassignedSnap.data();
                if (preassignedData && preassignedData.role) {
                  defaultRole = preassignedData.role;
                }
                // Delete the preassigned temporary document
                await deleteDoc(preassignedDocRef);
              }
            } catch (err: any) {
              if (err.message?.includes('offline') || err.code === 'unavailable') {
                console.warn('Error checking pre-assigned role (client is offline):', err);
              } else {
                console.error('Error checking pre-assigned role:', err);
              }
            }
          }

          await setDoc(userDocRef, {
            uid: currUser.uid,
            email: currUser.email,
            role: defaultRole,
            createdAt: new Date().toISOString()
          });
          setRole(defaultRole);
        }
        setLoading(false);
      }, (error) => {
        if (error.message?.includes('offline') || error.code === 'unavailable') {
          console.warn('Firestore is offline, using fallback role:', error);
        } else {
          console.error('Error fetching user role:', error);
        }
        // Fallback based on email if document access fails
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
