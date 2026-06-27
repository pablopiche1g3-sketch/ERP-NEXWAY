'use client';

import React, { useEffect, useState } from 'react';
import { useUser, ROLE_PERMISSIONS, hasPermission } from '@/supabase/use-user';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Sidebar } from '@/components/Sidebar';
import { NexBotFlotante } from '@/components/NexBotFlotante';
import { BmsProvider } from '@/contexts/BmsContext';
import { AgendaWidget } from '@/components/AgendaWidget';

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
  '/documents': 'documents',
  '/crm': 'crm',
  '/management': 'management',
};

export function ClientAuthGate({ children }: { children: React.ReactNode }) {
  const { user, role, isAdmin, loading, permissions } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => console.log('Service Worker registrado con éxito:', reg.scope))
        .catch((err) => console.error('Error al registrar Service Worker:', err));
    }
  }, []);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      if (pathname !== '/login') {
        router.push('/login');
      }
      return;
    }

    // Permissions-based route gating
    if (pathname !== '/' && pathname !== '/login') {
      const matchingRoute = Object.keys(ROUTE_TO_MODULE).find(route => 
        pathname === route || pathname.startsWith(route + '/')
      );
      const moduleId = matchingRoute ? ROUTE_TO_MODULE[matchingRoute] : null;

      if (moduleId) {
        if (!isAdmin && !hasPermission(role, moduleId, permissions)) {
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

    if (!moduleId || (!isAdmin && !hasPermission(role, moduleId, permissions))) {
      return null; // Will redirect in useEffect
    }
  }

  return (
    <BmsProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-transparent">
        <Sidebar isCollapsed={isCollapsed} onToggle={() => setIsCollapsed(prev => !prev)} />
        <main className="flex-1 h-full overflow-y-auto no-scrollbar relative">
          {children}
          <AgendaWidget />
          <NexBotFlotante />
        </main>
      </div>
    </BmsProvider>
  );
}
