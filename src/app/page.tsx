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
import { useUser, ROLE_PERMISSIONS } from '@/firebase';
import { supabase } from '@/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ModeToggle } from '@/components/mode-toggle';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

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
      iconBg: 'bg-blue-500/10 text-blue-500 border border-blue-500/20 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/10',
      glowClass: 'shadow-lg shadow-blue-500/20 hover:shadow-[0_0_40px_rgba(59,130,246,0.6)] hover:shadow-blue-500/60 hover:border-blue-500/50 dark:hover:border-blue-500/50',
      icon: <ShoppingCart size={22} /> 
    },
    { 
      id: 'purchases', 
      title: 'Registro de Compra', 
      description: 'Entrada de mercadería', 
      path: '/purchases', 
      iconBg: 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/10',
      glowClass: 'shadow-lg shadow-emerald-500/20 hover:shadow-[0_0_40px_rgba(16,185,129,0.6)] hover:shadow-emerald-500/60 hover:border-emerald-500/50 dark:hover:border-emerald-500/50',
      icon: <Truck size={22} /> 
    },
    { 
      id: 'quotations', 
      title: 'Cotización', 
      description: 'Presupuestos para clientes', 
      path: '/quotations', 
      iconBg: 'bg-orange-500/10 text-orange-500 border border-orange-500/20 dark:bg-orange-500/20 dark:text-orange-400 dark:border-orange-500/10',
      glowClass: 'shadow-lg shadow-orange-500/20 hover:shadow-[0_0_40px_rgba(249,115,22,0.6)] hover:shadow-orange-500/60 hover:border-orange-500/50 dark:hover:border-orange-500/50',
      icon: <FileText size={22} /> 
    },
    { 
      id: 'orders', 
      title: 'Orden de Compra', 
      description: 'Gestión de pedidos', 
      path: '/orders', 
      iconBg: 'bg-purple-500/10 text-purple-500 border border-purple-500/20 dark:bg-purple-500/20 dark:text-purple-400 dark:border-purple-500/10',
      glowClass: 'shadow-lg shadow-purple-500/20 hover:shadow-[0_0_40px_rgba(168,85,247,0.6)] hover:shadow-purple-500/60 hover:border-purple-500/50 dark:hover:border-purple-500/50',
      icon: <ClipboardList size={22} /> 
    },
    { 
      id: 'customers', 
      title: 'Registro de Cliente', 
      description: 'Contribuyentes y CF', 
      path: '/customers', 
      iconBg: 'bg-indigo-600/10 text-indigo-600 border border-indigo-600/20 dark:bg-indigo-500/20 dark:text-indigo-400 dark:border-indigo-500/10',
      glowClass: 'shadow-lg shadow-indigo-500/20 hover:shadow-[0_0_40px_rgba(79,70,229,0.6)] hover:shadow-indigo-500/60 hover:border-indigo-500/50 dark:hover:border-indigo-500/50',
      icon: <Users size={22} /> 
    },
    { 
      id: 'inventory', 
      title: 'Inventario', 
      description: 'Existencias y stock real', 
      path: '/inventory', 
      iconBg: 'bg-rose-500/10 text-rose-500 border border-rose-500/20 dark:bg-rose-500/20 dark:text-rose-400 dark:border-rose-500/10',
      glowClass: 'shadow-lg shadow-rose-500/20 hover:shadow-[0_0_40px_rgba(225,29,72,0.6)] hover:shadow-rose-500/60 hover:border-rose-500/50 dark:hover:border-rose-500/50',
      icon: <Package size={22} /> 
    },
    { 
      id: 'accounting', 
      title: 'Contabilidad', 
      description: 'Cierres y balances', 
      path: '/accounting', 
      iconBg: 'bg-blue-500/10 text-blue-500 border border-blue-500/20 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/10',
      glowClass: 'shadow-lg shadow-blue-500/20 hover:shadow-[0_0_40px_rgba(59,130,246,0.6)] hover:shadow-blue-500/60 hover:border-blue-500/50 dark:hover:border-blue-500/50',
      icon: <BarChart3 size={22} /> 
    },
    { 
      id: 'suppliers', 
      title: 'Proveedores', 
      description: 'Gestión de socios', 
      path: '/suppliers', 
      iconBg: 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/10',
      glowClass: 'shadow-lg shadow-emerald-500/20 hover:shadow-[0_0_40px_rgba(16,185,129,0.6)] hover:shadow-emerald-500/60 hover:border-emerald-500/50 dark:hover:border-emerald-500/50',
      icon: <Building2 size={22} /> 
    },
    { 
      id: 'quedan', 
      title: 'Gestión de Quedan', 
      description: 'Control de pagos', 
      path: '/quedan', 
      iconBg: 'bg-amber-500/10 text-amber-500 border border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/10',
      glowClass: 'shadow-lg shadow-amber-500/20 hover:shadow-[0_0_40px_rgba(245,158,11,0.6)] hover:shadow-amber-500/60 hover:border-amber-500/50 dark:hover:border-amber-500/50',
      icon: <CalendarClock size={22} /> 
    },
    { 
      id: 'transfers', 
      title: 'Traslados', 
      description: 'Movimientos de bodega', 
      path: '/transfers', 
      iconBg: 'bg-rose-500/10 text-rose-500 border border-rose-500/20 dark:bg-rose-500/20 dark:text-rose-400 dark:border-rose-500/10',
      glowClass: 'shadow-lg shadow-rose-500/20 hover:shadow-[0_0_40px_rgba(225,29,72,0.6)] hover:shadow-rose-500/60 hover:border-rose-500/50 dark:hover:border-rose-500/50',
      icon: <ArrowLeftRight size={22} /> 
    },
    { 
      id: 'institutional', 
      title: 'Institucional', 
      description: 'Información general', 
      path: '/institutional', 
      iconBg: 'bg-slate-500/10 text-slate-500 border border-slate-500/20 dark:bg-slate-500/20 dark:text-slate-400 dark:border-slate-500/10',
      glowClass: 'shadow-lg shadow-slate-500/20 hover:shadow-[0_0_40px_rgba(100,116,139,0.6)] hover:shadow-slate-500/60 hover:border-slate-500/50 dark:hover:border-slate-500/50',
      icon: <Building size={22} /> 
    },
    { 
      id: 'management', 
      title: 'Gerencia', 
      description: 'Panel de control', 
      path: '/management', 
      iconBg: 'bg-indigo-600/10 text-indigo-600 border border-indigo-600/20 dark:bg-indigo-500/20 dark:text-indigo-400 dark:border-indigo-500/10',
      glowClass: 'shadow-lg shadow-indigo-500/20 hover:shadow-[0_0_40px_rgba(79,70,229,0.6)] hover:shadow-indigo-500/60 hover:border-indigo-500/50 dark:hover:border-indigo-500/50',
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
    <div className="min-h-screen bg-slate-50 dark:bg-[#090D16] p-4 md:p-8 lg:p-10 font-body select-none transition-colors duration-300">
      
      {/* Header Dashboard al Estilo Mockup */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white font-headline">
            ¡Bienvenido de vuelta! 👋
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs md:text-sm mt-0.5">
            Centro de operaciones NexWay
          </p>
        </div>

        {/* Controles de barra superior */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Botón Filtrar */}
          <Button 
            variant="outline" 
            className="h-10 px-4 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 text-xs font-bold text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1.5"
          >
            <SlidersHorizontal size={13} />
            <span>Filtrar</span>
          </Button>

          {/* Buscador */}
          <div className="relative flex-1 sm:flex-initial sm:w-64">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-3.5 h-3.5" />
            <Input 
              type="text" 
              placeholder="Buscar..." 
              className="h-10 pl-10 pr-4 bg-white dark:bg-zinc-900/60 border-slate-200 dark:border-zinc-800 text-xs font-medium rounded-xl focus-visible:ring-indigo-500 transition-colors"
            />
          </div>



          <ModeToggle />

          {/* Perfil del Administrador */}
          <div className="flex items-center gap-2.5 bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 p-1.5 pr-3.5 rounded-xl">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-500 text-white flex items-center justify-center font-black text-xs uppercase shadow-md shadow-indigo-500/10">
              AD
            </div>
            <div className="flex flex-col text-left">
              <span className="text-[10px] font-black text-slate-800 dark:text-white leading-tight">Admin</span>
              <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mt-0.5">
                {ROLE_PERMISSIONS[userRole] ? 'Colaborador' : 'Administrador'}
              </span>
            </div>
          </div>
        </div>
      </header>



      {/* Contenedor central: Módulos principales con glows */}
      <Card className="border border-slate-200/60 dark:border-zinc-900/40 bg-white dark:bg-slate-900/20 rounded-[28px] shadow-sm mb-8 overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-zinc-800/80 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider font-headline">Módulos principales</h2>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-normal mt-0.5">Accede rápidamente a las funciones más utilizadas.</p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => router.push('/management')}
            className="h-9 px-4 bg-slate-50 dark:bg-zinc-900/60 border-slate-100 dark:border-zinc-800/80 rounded-xl text-xs font-bold hover:bg-slate-100 dark:hover:bg-zinc-800 flex items-center gap-1.5"
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
                  className={`bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-zinc-800 p-5 rounded-[22px] flex items-center justify-between gap-4 cursor-pointer group transition-all duration-300 hover:-translate-y-0.5 relative overflow-hidden ${m.glowClass}`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`w-12 h-12 shrink-0 ${m.iconBg} rounded-xl flex items-center justify-center shadow-md transition-all duration-300 group-hover:scale-105`}>
                      {m.icon}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs font-black text-slate-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors leading-snug flex items-center gap-1.5">
                        {m.title}
                        {!hasModuleAccess && (
                          <Badge variant="outline" className="text-[7px] px-1 h-3.5 border-amber-500/20 text-amber-500 bg-amber-500/5">
                            Cerrado
                          </Badge>
                        )}
                      </h3>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate leading-normal mt-0.5">{m.description}</p>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-slate-300 dark:text-slate-600 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all duration-300 shrink-0" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>


    </div>
  );
}