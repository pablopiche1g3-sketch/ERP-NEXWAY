
'use client';

import React, { useMemo } from 'react';
import { initializeFirebase } from './index';
import { FirebaseProvider } from './provider';
import { UserProvider } from './auth/use-user';

export function FirebaseClientProvider({ children }: { children: React.ReactNode }) {
  const { app, db, auth } = useMemo(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const tenantParam = searchParams.get('tenant');
      if (tenantParam) {
        if (tenantParam === 'default' || tenantParam === 'main') {
          window.localStorage.removeItem('nexway_tenant');
        } else {
          window.localStorage.setItem('nexway_tenant', tenantParam);
        }
      }
    }
    return initializeFirebase();
  }, []);

  return (
    <FirebaseProvider app={app} db={db} auth={auth}>
      <UserProvider>
        {children}
      </UserProvider>
    </FirebaseProvider>
  );
}
