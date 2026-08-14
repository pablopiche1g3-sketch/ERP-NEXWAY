'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { 
  ShoppingCart, 
  Truck, 
  BarChart3, 
  Building2, 
  CalendarClock, 
  FileText, 
  ArrowLeftRight, 
  ClipboardList, 
  Users, 
  Package, 
  Building, 
  ShieldCheck,
  Search,
  ChevronRight,
  Sparkles,
  Info,
  SlidersHorizontal,
  Bell,
  ArrowUpRight,
  TrendingUp,
  Activity,
  AlertTriangle
} from 'lucide-react';
import Link from 'next/link';
import {  useUser, ROLE_PERMISSIONS  } from '@/supabase/compat';
import { supabase } from '@/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ModeToggle } from '@/components/mode-toggle';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { AsistenteGuiaERP } from '@/components/AsistenteGuiaERP';
import { PwaInstallButton } from '@/components/PwaInstallButton';

interface ModuleConfig {
  id: string;
  title: string;
  description: string;
  path: string;
  iconBg: string;
  glowClass: string;
  icon: React.ReactNode;
}

export default function Home() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, role } = useUser();

  const modulesList: ModuleConfig[] = [
    { 
      id: 'billing', 
      title: 'Facturación', 
      description: 'Generar DTE y facturas', 
      path: '/billing', 
      iconBg: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
      glowClass: 'hover:border-blue-500/50 hover:bg-blue-50/50 dark:hover:bg-blue-900/10',
      icon: <ShoppingCart size={22} /> 
    },
    { 
      id: 'purchases', 
      title: 'Registro de Compra', 
      description: 'Entrada de mercadería', 
      path: '/compras', 
      iconBg: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
      glowClass: 'hover:border-emerald-500/50 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10',
      icon: <Truck size={22} /> 
    },
    { 
      id: 'quotations', 
      title: 'Cotización', 
      description: 'Presupuestos para clientes', 
path: '/billing?tab=cotizaciones', 
      iconBg: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
      glowClass: 'hover:border-orange-500/50 hover:bg-orange-50/50 dark:hover:bg-orange-900/10',
      icon: <FileText size={22} /> 
    },
    { 
      id: 'orders', 
      title: 'Orden de Compra', 
      description: 'Gestión de pedidos', 
path: '/compras?tab=ordenes', 
      iconBg: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
      glowClass: 'hover:border-purple-500/50 hover:bg-purple-50/50 dark:hover:bg-purple-900/10',
      icon: <ClipboardList size={22} />
    },
    { 
      id: 'customers', 
      title: 'Registro de Cliente', 
      description: 'Contribuyentes y CF', 
path: '/directorio?tab=clientes', 
      iconBg: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
      glowClass: 'hover:border-indigo-500/50 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10',
      icon: <Users size={22} /> 
    },
    { 
      id: 'documents', 
      title: 'Centro Documental', 
      description: 'Documentos y hojas libres', 
      path: '/management', 
      iconBg: 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400',
      glowClass: 'hover:border-rose-500/50 hover:bg-rose-50/50 dark:hover:bg-rose-900/10',
      icon: <FileText size={22} /> 
    },
    { 
      id: 'inventory', 
      title: 'Inventario', 
description: 'Control de existencias', 
      path: '/logistica?tab=inventario', 
      iconBg: 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400',
      glowClass: 'hover:border-rose-500/50 hover:bg-rose-50/50 dark:hover:bg-rose-900/10',
      icon: <Package size={22} /> 
    },
    { 
      id: 'accounting', 
      title: 'Contabilidad', 
      description: 'Libros y finanzas', 
      path: '/accounting', 
iconBg: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
      glowClass: 'hover:border-blue-500/50 hover:bg-blue-50/50 dark:hover:bg-blue-900/10',
      icon: <BarChart3 size={22} /> 
    },
    { 
      id: 'suppliers', 
      title: 'Proveedores', 
description: 'Catálogo de compras', 
      path: '/directorio?tab=proveedores', 
      iconBg: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
      glowClass: 'hover:border-emerald-500/50 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10',
      icon: <Building2 size={22} />
    },
    { 
      id: 'quedan', 
      title: 'Gestión de Quedan', 
description: 'Cuentas por pagar', 
      path: '/finanzas?tab=quedan', 
      iconBg: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
      glowClass: 'hover:border-amber-500/50 hover:bg-amber-50/50 dark:hover:bg-amber-900/10',
      icon: <CalendarClock size={22} /> 
    },
    { 
      id: 'transfers', 
      title: 'Traslados', 
description: 'Movimiento entre bodegas', 
      path: '/logistica?tab=traslados', 
      iconBg: 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400',
      glowClass: 'hover:border-rose-500/50 hover:bg-rose-50/50 dark:hover:bg-rose-900/10',
      icon: <ArrowLeftRight size={22} /> 
    },
    { 
      id: 'crm', 
      title: 'CRM Comercial', 
      description: 'Gestión de clientes y embudo', 
      path: '/crm', 
      iconBg: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
      glowClass: 'hover:border-amber-500/50 hover:bg-amber-50/50 dark:hover:bg-amber-900/10',
      icon: <Sparkles size={22} /> 
    },
    { 
      id: 'institutional', 
      title: 'Institucional', 
      description: 'Información general', 
      path: '/institutional', 
      iconBg: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
      glowClass: 'hover:border-slate-500/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/50',
      icon: <Building size={22} /> 
    },
    { 
      id: 'management', 
      title: 'Gerencia', 
      description: 'Panel de control', 
      path: '/management', 
      iconBg: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
      glowClass: 'hover:border-indigo-500/50 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10',
      icon: <ShieldCheck size={22} /> 
    }
  ];

  const userRole = role ? role.toLowerCase().trim() : 'pedidos';
  const isUserAdmin = userRole === 'admin' || userRole === 'gerencia';

  const filteredModules = modulesList.filter(module => {
    if (isUserAdmin) return true;
    const allowed = ROLE_PERMISSIONS[userRole] || ROLE_PERMISSIONS['pedidos'];
    return allowed.includes(module.id);
  });

  const hasAccess = (moduleId: string) => {
    if (isUserAdmin) return true;
    const allowed = ROLE_PERMISSIONS[userRole] || ROLE_PERMISSIONS['pedidos'];
    return allowed.includes(moduleId);
  };

  const handleModuleClick = (moduleId: string, path: string, title: string) => {
    if (!hasAccess(moduleId)) {
      toast({
        variant: "destructive",
        title: "Acceso Restringido 🔒",
        description: `Tu rol actual no tiene autorización para acceder al módulo de "${title}".`
      });
      return;
    }
    router.push(path);
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 lg:p-10 font-body select-none transition-colors duration-300 relative overflow-hidden">

      
      {/* Header Dashboard al Estilo Mockup */}
      <header className="flex flex-col gap-5 mb-8 relative z-10">
        <div className="flex justify-between items-start gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-foreground font-headline">
              ¡Bienvenido de vuelta! 👋
            </h1>
            <p className="text-muted-foreground text-xs md:text-sm mt-0.5">
              Centro de operaciones NexWay
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <PwaInstallButton />
            <ModeToggle />
            {/* Perfil del Administrador (Solo Icono en Móvil) */}
            <div className="hidden sm:flex items-center gap-2.5 bg-card border border-border p-1.5 pr-3.5 rounded-xl shadow-sm">
              <div className="w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-black text-xs uppercase">
                AD
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[10px] font-black text-foreground leading-tight">Admin</span>
                <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest leading-none mt-0.5">
                  {ROLE_PERMISSIONS[userRole] ? 'Colaborador' : 'Administrador'}
                </span>
              </div>
            </div>
            <div className="sm:hidden w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-black text-sm uppercase shadow-sm">
              AD
            </div>
          </div>
        </div>

        {/* Controles de barra inferior (Buscador y Filtro) */}
        <div className="flex items-center gap-3 w-full">
          {/* Buscador */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
            <Input 
              type="text" 
              placeholder="Buscar..." 
              className="h-11 pl-10 pr-4 bg-card text-xs font-medium rounded-xl focus-visible:ring-primary transition-colors w-full border-border shadow-sm"
            />
          </div>

          {/* Botón Filtrar */}
          <Button 
            variant="outline" 
            className="h-11 px-4 bg-card text-xs font-bold text-foreground rounded-xl transition-all flex items-center gap-2 shrink-0 border-border shadow-sm hover:bg-accent"
          >
            <SlidersHorizontal size={14} />
            <span className="hidden sm:inline">Filtrar</span>
          </Button>
        </div>
      </header>

      {/* Asistente de Puesta en Marcha y Control */}
      <AsistenteGuiaERP />

      {/* Contenedor central: Módulos principales con glows */}
      <Card className="bg-card rounded-2xl mb-8 overflow-hidden relative z-10 border-border shadow-sm">
        <div className="p-6 border-b border-border flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider font-headline">Módulos principales</h2>
            <p className="text-[11px] text-muted-foreground leading-normal mt-0.5">Accede rápidamente a las funciones más utilizadas.</p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => router.push('/management')}
            className="h-9 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <ShieldCheck size={14} /> Ajustar Módulos
          </Button>
        </div>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {modulesList.map((m) => {
              const hasModuleAccess = hasAccess(m.id);
              return (
                <div 
                  key={m.id}
                  onClick={() => handleModuleClick(m.id, m.path, m.title)}
                  className={`bg-card border border-border shadow-sm p-5 rounded-xl flex items-center justify-between gap-4 cursor-pointer group transition-all duration-200 relative overflow-hidden ${m.glowClass}`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`w-12 h-12 shrink-0 ${m.iconBg} rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-105`}>
                      {m.icon}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs font-black text-foreground group-hover:text-primary transition-colors leading-snug flex items-center gap-1.5">
                        {m.title}
                        {!hasModuleAccess && (
                          <Badge variant="outline" className="text-[7px] px-1 h-3.5 border-amber-500/20 text-amber-500 bg-amber-500/5">
                            Cerrado
                          </Badge>
                        )}
                      </h3>
                      <p className="text-[10px] text-muted-foreground truncate leading-normal mt-0.5">{m.description}</p>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-300 shrink-0" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}