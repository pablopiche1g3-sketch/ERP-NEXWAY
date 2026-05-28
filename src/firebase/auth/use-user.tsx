
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { useAuth, useFirestore } from '../provider';

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

      const isAdminEmail = currUser.email?.toLowerCase() === 'pablopiche1g3@gmail.com' || currUser.email?.toLowerCase() === 'pinturas.tecnicolorsw@gmail.com';

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
          const defaultRole = isAdminEmail ? 'admin' : 'pedidos';
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
        console.error('Error fetching user role:', error);
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

  const isAdmin = role === 'admin';

  return (
    <UserContext.Provider value={{ user, role, isAdmin, loading }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
