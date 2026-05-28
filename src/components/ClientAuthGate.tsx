'use client';

import React, { useEffect } from 'react';
import { useUser } from '@/firebase';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export function ClientAuthGate({ children }: { children: React.ReactNode }) {
  const { user, role, isAdmin, loading } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      if (pathname !== '/login') {
        router.push('/login');
      }
      return;
    }

    // Role-based route gating
    // If not admin, the only allowed pages are / and /orders.
    if (!isAdmin && pathname !== '/' && pathname !== '/orders' && pathname !== '/login') {
      router.push('/');
    }
  }, [user, role, isAdmin, loading, pathname, router]);

  if (pathname === '/login') {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-blue-600 dark:text-blue-400" size={48} />
          <p className="text-muted-foreground text-sm font-medium animate-pulse">Cargando perfil...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect in useEffect
  }

  if (!isAdmin && pathname !== '/' && pathname !== '/orders') {
    return null; // Will redirect in useEffect
  }

  return <>{children}</>;
}
