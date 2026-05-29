'use client';

import React, { useEffect } from 'react';
import { useUser, ROLE_PERMISSIONS } from '@/firebase';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

const ROUTE_TO_MODULE: Record<string, string> = {
  '/billing': 'billing',
  '/accounting': 'accounting',
  '/purchases': 'purchases',
  '/suppliers': 'suppliers',
  '/quedan': 'quedan',
  '/quotations': 'quotations',
  '/transfers': 'transfers',
  '/orders': 'orders',
  '/customers': 'customers',
  '/inventory': 'inventory',
  '/institutional': 'institutional',
  '/management': 'management',
};

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
    if (pathname !== '/' && pathname !== '/login') {
      const matchingRoute = Object.keys(ROUTE_TO_MODULE).find(route => 
        pathname === route || pathname.startsWith(route + '/')
      );
      const moduleId = matchingRoute ? ROUTE_TO_MODULE[matchingRoute] : null;

      if (moduleId) {
        if (!isAdmin && (!role || !ROLE_PERMISSIONS[role]?.includes(moduleId))) {
          router.push('/');
        }
      } else {
        if (!isAdmin) {
          router.push('/');
        }
      }
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

  // Double render gate check for non-admin on forbidden subpaths or modules
  if (pathname !== '/' && pathname !== '/login' && !isAdmin) {
    const matchingRoute = Object.keys(ROUTE_TO_MODULE).find(route => 
      pathname === route || pathname.startsWith(route + '/')
    );
    const moduleId = matchingRoute ? ROUTE_TO_MODULE[matchingRoute] : null;

    if (!moduleId || (!role || !ROLE_PERMISSIONS[role]?.includes(moduleId))) {
      return null; // Will redirect in useEffect
    }
  }

  return <>{children}</>;
}
