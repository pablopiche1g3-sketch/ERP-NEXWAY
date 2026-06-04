'use client';

import React, { useEffect, useState } from 'react';
import { useUser, ROLE_PERMISSIONS } from '@/supabase/use-user';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Sidebar } from '@/components/Sidebar';

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
  const [isCollapsed, setIsCollapsed] = useState(false);

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
        const safeRole = role ? role.toLowerCase().trim() : 'pedidos';
        const allowed = ROLE_PERMISSIONS[safeRole] || ROLE_PERMISSIONS['pedidos'];
        if (!isAdmin && !allowed.includes(moduleId)) {
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
    const safeRole = role ? role.toLowerCase().trim() : 'pedidos';
    const allowed = ROLE_PERMISSIONS[safeRole] || ROLE_PERMISSIONS['pedidos'];

    if (!moduleId || (!isAdmin && !allowed.includes(moduleId))) {
      return null; // Will redirect in useEffect
    }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <Sidebar isCollapsed={isCollapsed} onToggle={() => setIsCollapsed(prev => !prev)} />
      <main className="flex-1 h-full overflow-y-auto no-scrollbar">
        {children}
      </main>
    </div>
  );
}
