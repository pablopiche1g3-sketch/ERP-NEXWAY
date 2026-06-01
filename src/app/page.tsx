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
  ArrowUpRight,
  Sparkles,
  Info
} from 'lucide-react';
import Link from 'next/link';
import { useFirestore, useDoc, useUser, ROLE_PERMISSIONS } from '@/firebase';
import { doc } from 'firebase/firestore';
import { supabase } from '@/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ModeToggle } from '@/components/mode-toggle';

interface ModuleConfig {
  id: string;
  title: string;
  description: string;
  path: string;
  iconBg: string;
  icon: React.ReactNode;
}

export default function Home() {
  const db = useFirestore();
  const configRef = useMemo(() => doc(db, 'system', 'module_config'), [db]);
  const { data: config } = useDoc<any>(configRef);
  const { user, role } = useUser();

  // Estados de datos dinámicos
  const [salesList, setSalesList] = useState<any[]>([]);
  const [stockList, setStockList] = useState<any[]>([]);
  const [loadingKpis, setLoadingKpis] = useState(true);

  useEffect(() => {
    const fetchKpisData = async () => {
      try {
        setLoadingKpis(true);
        const { data: sales } = await supabase.from('sales').select('total, created_at, status');
        setSalesList(sales || []);
        const { data: stock } = await supabase.from('inventory_stock').select('quantity');
        setStockList(stock || []);
      } catch (err) {
        console.error('Error al cargar métricas de dashboard:', err);
      } finally {
        setLoadingKpis(false);
      }
    };
    fetchKpisData();
  }, []);

  const modulesList: ModuleConfig[] = [
    { id: 'billing',       title: 'Facturación',          description: 'Ventas y Estado de Cuenta',     path: '/billing',       iconBg: 'bg-blue-600 dark:bg-blue-500',       icon: <ShoppingCart className="text-white" size={22} /> },
    { id: 'purchases',     title: 'Registro de Compra',   description: 'Entrada de mercadería',          path: '/purchases',     iconBg: 'bg-emerald-600 dark:bg-emerald-500', icon: <Truck className="text-white" size={22} /> },
    { id: 'accounting',    title: 'Contabilidad',          description: 'Resultados, P&L e IVA',         path: '/accounting',    iconBg: 'bg-slate-900 dark:bg-slate-800',     icon: <BarChart3 className="text-white" size={22} /> },
    { id: 'suppliers',     title: 'Proveedores',           description: 'Registro de suministrantes',    path: '/suppliers',     iconBg: 'bg-emerald-800 dark:bg-emerald-700', icon: <Building2 className="text-white" size={22} /> },
    { id: 'quedan',        title: 'Gestión de Quedan',    description: 'Programación de pagos',          path: '/quedan',        iconBg: 'bg-purple-600 dark:bg-purple-500',   icon: <CalendarClock className="text-white" size={22} /> },
    { id: 'quotations',    title: 'Cotización',            description: 'Presupuestos para clientes',    path: '/quotations',    iconBg: 'bg-orange-500 dark:bg-orange-400',   icon: <FileText className="text-white" size={22} /> },
    { id: 'transfers',     title: 'Traslados',             description: 'Movimiento entre bodegas',      path: '/transfers',     iconBg: 'bg-indigo-600 dark:bg-indigo-500',   icon: <ArrowLeftRight className="text-white" size={22} /> },
    { id: 'orders',        title: 'Pedidos',               description: 'Órdenes interna y proveedores', path: '/orders',        iconBg: 'bg-violet-600 dark:bg-violet-500',   icon: <ClipboardList className="text-white" size={22} /> },
    { id: 'customers',     title: 'Registro de Cliente',  description: 'Contribuyentes y CF',           path: '/customers',     iconBg: 'bg-sky-500 dark:bg-sky-400',         icon: <Users className="text-white" size={22} /> },
    { id: 'inventory',     title: 'Inventario',            description: 'Códigos y Stock',               path: '/inventory',     iconBg: 'bg-rose-500 dark:bg-rose-400',       icon: <Package className="text-white" size={22} /> },
    { id: 'institutional', title: 'Institucional',         description: 'Licitaciones y Proyectos',      path: '/institutional', iconBg: 'bg-blue-400 dark:bg-blue-300',       icon: <Building className="text-white" size={22} /> },
    { id: 'management',    title: 'Gerencia',              description: 'Control de Permisos',           path: '/management',    iconBg: 'bg-slate-700 dark:bg-slate-600',     icon: <ShieldCheck className="text-white" size={22} /> },
  ];

  const activeModulesConfig = config || {
    billing: true, purchases: true, suppliers: true, quedan: true,
    quotations: true, transfers: true, customers: true, inventory: true,
    institutional: true, accounting: true, management: true, orders: true
  };

  const visibleModules = modulesList.filter((m) => {
    const userRole = role || 'pedidos';
    const isUserAdmin = userRole === 'admin' || userRole === 'gerencia';
    const hasRolePermission = isUserAdmin || (ROLE_PERMISSIONS[userRole] && ROLE_PERMISSIONS[userRole].includes(m.id));
    if (!hasRolePermission) return false;
    return activeModulesConfig[m.id] !== false;
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 p-4 md:p-8 lg:p-10 font-body select-none">

      {/* Header Dashboard */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white font-headline flex items-center gap-2">
            ¡Bienvenido, {user?.email?.split('@')[0] || 'Usuario'}! 👋
          </h1>
          <p className="text-slate-500 dark:text-muted-foreground text-xs md:text-sm mt-1">
            Aquí tienes un resumen general de tu empresa.
          </p>
        </div>

        {/* Barra de búsqueda y selector de tema */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={15} />
            <Input 
              type="text" 
              placeholder="Buscar en el ERP..." 
              className="h-10 pl-10 pr-4 bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800/80 rounded-xl text-xs font-semibold focus-visible:ring-indigo-500"
            />
          </div>
          <ModeToggle />
        </div>
      </header>

      {/* Grid General */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Columna de Contenido Principal (Ancho: 9/12) */}
        <div className="lg:col-span-9 space-y-8">
          {/* Bloque Módulos Principales */}
          <section className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800 dark:text-white tracking-wide uppercase font-headline">Módulos principales</h2>
              <span className="text-[10px] font-black text-indigo-500 tracking-wider flex items-center gap-1">
                <Sparkles size={11} /> SISTEMA INTEGRADO
              </span>
            </div>

            {/* Grid de módulos — tarjetas más grandes */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {visibleModules.map((m) => (
                <Link key={m.id} href={m.path}>
                  <Card className="border border-slate-200/60 dark:border-zinc-900/60 bg-white dark:bg-zinc-900/80 hover:bg-slate-50 dark:hover:bg-zinc-900 hover:border-indigo-500/30 hover:shadow-xl dark:hover:shadow-indigo-950/10 hover:-translate-y-1 rounded-[22px] transition-all duration-300 group cursor-pointer h-full overflow-hidden">
                    <CardContent className="p-5 flex items-center justify-between gap-4 h-full">
                      <div className="flex items-center gap-4 min-w-0">
                        {/* Icono más grande */}
                        <div className={`w-14 h-14 shrink-0 ${m.iconBg} rounded-2xl flex items-center justify-center shadow-md shadow-black/10 group-hover:scale-[1.06] transition-all duration-300`}>
                          {m.icon}
                        </div>
                        {/* Textos */}
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-slate-800 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors leading-snug">{m.title}</h3>
                          <p className="text-xs text-slate-400 dark:text-muted-foreground truncate leading-normal mt-1">{m.description}</p>
                        </div>
                      </div>
                      {/* Flecha */}
                      <ChevronRight size={16} className="text-slate-300 dark:text-slate-600 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all duration-300 shrink-0" />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>

            {visibleModules.length === 0 && (
              <div className="text-center py-16 bg-white dark:bg-zinc-900/40 border border-dashed rounded-3xl">
                <p className="text-muted-foreground text-xs font-semibold">No posees permisos de rol asignados para ningún módulo operativo.</p>
              </div>
            )}

            {/* Banner Informativo — debajo del grid de módulos */}
            <footer className="p-5 rounded-[24px] bg-gradient-to-r from-indigo-900 to-indigo-950 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md shadow-indigo-950/20 border border-indigo-900/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center shrink-0 border border-indigo-500/10">
                  <Info size={18} className="text-indigo-400" />
                </div>
                <div className="text-center sm:text-left">
                  <h4 className="text-sm font-bold font-headline">Conectividad Total NexWay</h4>
                  <p className="text-xs text-indigo-300 mt-0.5 leading-normal">Todos tus procesos operativos, de ventas y contabilidad conectados en un solo lugar.</p>
                </div>
              </div>
              <Badge variant="outline" className="border-indigo-500/30 text-indigo-400 bg-indigo-950/30 text-[9px] font-black tracking-widest px-3 py-1 uppercase shrink-0">
                V 1.4.0 ESTABLE
              </Badge>
            </footer>
          </section>
        </div>

        {/* Columna de Acciones Rápidas (Ancho: 3/12) */}
        <div className="lg:col-span-3 space-y-6">
          <Card className="border border-slate-200/60 dark:border-zinc-900/60 bg-white dark:bg-zinc-900/80 rounded-[28px] overflow-hidden shadow-sm shadow-slate-100 dark:shadow-none">
            <div className="p-5 border-b border-slate-100 dark:border-zinc-800/80 bg-slate-50/50 dark:bg-zinc-950/30">
              <h3 className="text-xs font-bold text-slate-800 dark:text-white tracking-wide uppercase font-headline">Acciones rápidas</h3>
              <p className="text-[9px] text-slate-400 dark:text-muted-foreground mt-0.5 leading-normal">Accesos directos operacionales rápidos.</p>
            </div>
            <CardContent className="p-4 space-y-2.5">
              <QuickActionLink href="/billing"   label="Nueva Factura"    icon={<ShoppingCart size={16} />} colorClass="bg-blue-500/10 text-blue-600 dark:text-blue-400" />
              <QuickActionLink href="/orders"    label="Nuevo Pedido"     icon={<ClipboardList size={16} />} colorClass="bg-purple-500/10 text-purple-600 dark:text-purple-400" />
              <QuickActionLink href="/purchases" label="Registrar Compra" icon={<Truck size={16} />} colorClass="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" />
              <QuickActionLink href="/customers" label="Nuevo Cliente"    icon={<Users size={16} />} colorClass="bg-sky-500/10 text-sky-600 dark:text-sky-400" />
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}

function QuickActionLink({ href, label, icon, colorClass }: {
  href: string;
  label: string;
  icon: React.ReactNode;
  colorClass: string;
}) {
  return (
    <Link href={href} className="block">
      <div className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-100 dark:border-zinc-800/60 bg-slate-50/30 dark:bg-zinc-900/30 hover:bg-slate-50 dark:hover:bg-zinc-800 hover:border-indigo-500/20 active:scale-[0.98] transition-all group">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${colorClass} shrink-0`}>
            {icon}
          </div>
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{label}</span>
        </div>
        <ArrowUpRight size={14} className="text-slate-400 dark:text-slate-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-300 shrink-0" />
      </div>
    </Link>
  );
}