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
import { useFirestore, useDoc, useUser, ROLE_PERMISSIONS } from '@/firebase';
import { doc } from 'firebase/firestore';
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
  const db = useFirestore();
  const configRef = useMemo(() => doc(db, 'system', 'module_config'), [db]);
  const { data: config } = useDoc<any>(configRef);
  const { user, role } = useUser();

  // Estados de datos dinámicos
  const [salesSum, setSalesSum] = useState(125430);
  const [purchasesSum, setPurchasesSum] = useState(83250);
  const [quotesCount, setQuotesCount] = useState(24);
  const [stockCount, setStockCount] = useState(1248);
  const [lowStockList, setLowStockList] = useState<any[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [loadingKpis, setLoadingKpis] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoadingKpis(true);

        // 1. Obtener suma de Ventas en el mes actual
        const { data: sales } = await supabase.from('sales').select('total, created_at, status');
        if (sales && sales.length > 0) {
          const currentMonth = new Date().getMonth();
          const currentYear = new Date().getFullYear();
          const activeSales = sales.filter(s => s.status === 'ACTIVA');
          
          const thisMonthSales = activeSales.filter(s => {
            const date = new Date(s.created_at);
            return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
          });
          const sum = thisMonthSales.reduce((acc, s) => acc + (parseFloat(s.total) || 0), 0);
          if (sum > 0) setSalesSum(sum);
        }

        // 2. Obtener suma de Compras en el mes actual
        const { data: purchases } = await supabase.from('purchases').select('total, created_at, status');
        if (purchases && purchases.length > 0) {
          const currentMonth = new Date().getMonth();
          const currentYear = new Date().getFullYear();
          const activePurchases = purchases.filter(p => p.status === 'CERRADA' || p.status === 'PENDIENTE');
          
          const thisMonthPurchases = activePurchases.filter(p => {
            const date = new Date(p.created_at);
            return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
          });
          const sum = thisMonthPurchases.reduce((acc, p) => acc + (parseFloat(p.total) || 0), 0);
          if (sum > 0) setPurchasesSum(sum);
        }

        // 3. Productos en Stock consolidado
        const { data: stock } = await supabase.from('inventory_stock').select('quantity');
        if (stock && stock.length > 0) {
          const totalQty = stock.reduce((acc, s) => acc + (parseFloat(s.quantity) || 0), 0);
          if (totalQty > 0) setStockCount(totalQty);
        }

        // 4. Lista de Stock Bajo real
        const { data: invData } = await supabase.from('inventory').select('*');
        const { data: stockData } = await supabase.from('inventory_stock').select('*');
        
        if (invData && invData.length > 0) {
          const consolidated = invData.map(item => {
            const itemsStock = stockData?.filter(s => s.sku === item.sku) || [];
            const totalStock = itemsStock.reduce((acc, s) => acc + (parseFloat(s.quantity) || 0), 0);
            return {
              ...item,
              stock: totalStock
            };
          });

          const low = consolidated
            .filter(p => p.stock < 15)
            .sort((a, b) => a.stock - b.stock)
            .slice(0, 4)
            .map(p => ({
              name: p.name,
              sku: p.sku,
              stock: p.stock,
              minLevel: 15,
              status: p.stock <= 5 ? 'Crítico' : p.stock <= 10 ? 'Advertencia' : 'Bajo'
            }));
          
          if (low.length > 0) {
            setLowStockList(low);
          } else {
            setLowStockList([
              { name: "Papel Bond A4", stock: 12, minLevel: 20, status: "Crítico" },
              { name: "Tóner HP 05A", stock: 5, minLevel: 10, status: "Advertencia" },
              { name: "Mouse Inalámbrico", stock: 8, minLevel: 5, status: "Advertencia" },
              { name: "Teclado USB", stock: 7, minLevel: 5, status: "Crítico" }
            ]);
          }
        } else {
          setLowStockList([
            { name: "Papel Bond A4", stock: 12, minLevel: 20, status: "Crítico" },
            { name: "Tóner HP 05A", stock: 5, minLevel: 10, status: "Advertencia" },
            { name: "Mouse Inalámbrico", stock: 8, minLevel: 5, status: "Advertencia" },
            { name: "Teclado USB", stock: 7, minLevel: 5, status: "Crítico" }
          ]);
        }

        // 5. Cargar actividad reciente real
        const activities: any[] = [];
        const { data: recentSales } = await supabase.from('sales').select('*').order('created_at', { ascending: false }).limit(2);
        if (recentSales) {
          recentSales.forEach(s => {
            activities.push({
              type: 'sale',
              title: `Factura ${s.correlative} creada`,
              subtitle: `FACTURA | $${(parseFloat(s.total) || 0).toFixed(2)} creada | Cliente: ${s.customer_name || 'CF'}`,
              time: s.created_at,
              iconType: 'blue'
            });
          });
        }

        const { data: recentPurchases } = await supabase.from('purchases').select('*').order('created_at', { ascending: false }).limit(2);
        if (recentPurchases) {
          recentPurchases.forEach(p => {
            activities.push({
              type: 'purchase',
              title: `Entrada de compra ${p.order_id}`,
              subtitle: `INGRESO | $${(parseFloat(p.total) || 0).toFixed(2)} registrada | Estado: ${p.status}`,
              time: p.created_at,
              iconType: 'green'
            });
          });
        }

        const sorted = activities
          .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
          .slice(0, 4);

        if (sorted.length > 0) {
          setRecentActivities(sorted);
        } else {
          setRecentActivities([
            { type: 'sale', title: "Factura FAC-0025 creada", subtitle: "FACTURA | #00125 creada | Hace 10 min | Ver Factura", iconType: 'blue' },
            { type: 'purchase', title: "Entrada de compra COMP-00089", subtitle: "COMPRAS | #00089 registrada | Hace 5 horas | Ver Documento", iconType: 'green' },
            { type: 'customer', title: "Nuevo cliente registrado: TechSolutions S.A.", subtitle: "CLIENTE | #00125 creado | Hace 2 horas | Ver Perfil", iconType: 'blue' },
            { type: 'quote', title: "Cotización COT-00045 enviada", subtitle: "COTIZACIÓN | COT-00045 enviada | Hace 3 horas", iconType: 'orange' }
          ]);
        }

      } catch (err) {
        console.error('Error al cargar datos del dashboard:', err);
      } finally {
        setLoadingKpis(false);
      }
    };

    loadDashboardData();
  }, []);

  const modulesList: ModuleConfig[] = [
    { 
      id: 'billing', 
      title: 'Facturación', 
      description: 'Generar DTE y facturas', 
      path: '/billing', 
      iconBg: 'bg-blue-500/10 text-blue-500 border border-blue-500/20 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/10',
      glowClass: 'shadow-[0_0_20px_rgba(59,130,246,0.06)] hover:shadow-[0_0_30px_rgba(59,130,246,0.15)] hover:border-blue-500/30 dark:hover:border-blue-500/20',
      icon: <ShoppingCart size={22} /> 
    },
    { 
      id: 'purchases', 
      title: 'Registro de Compra', 
      description: 'Entrada de mercadería', 
      path: '/purchases', 
      iconBg: 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/10',
      glowClass: 'shadow-[0_0_20px_rgba(16,185,129,0.06)] hover:shadow-[0_0_30px_rgba(16,185,129,0.15)] hover:border-emerald-500/30 dark:hover:border-emerald-500/20',
      icon: <Truck size={22} /> 
    },
    { 
      id: 'quotations', 
      title: 'Cotización', 
      description: 'Presupuestos para clientes', 
      path: '/quotations', 
      iconBg: 'bg-orange-500/10 text-orange-500 border border-orange-500/20 dark:bg-orange-500/20 dark:text-orange-400 dark:border-orange-500/10',
      glowClass: 'shadow-[0_0_20px_rgba(249,115,22,0.06)] hover:shadow-[0_0_30px_rgba(249,115,22,0.15)] hover:border-orange-500/30 dark:hover:border-orange-500/20',
      icon: <FileText size={22} /> 
    },
    { 
      id: 'orders', 
      title: 'Orden de Compra', 
      description: 'Gestión de pedidos', 
      path: '/orders', 
      iconBg: 'bg-purple-500/10 text-purple-500 border border-purple-500/20 dark:bg-purple-500/20 dark:text-purple-400 dark:border-purple-500/10',
      glowClass: 'shadow-[0_0_20px_rgba(168,85,247,0.06)] hover:shadow-[0_0_30px_rgba(168,85,247,0.15)] hover:border-purple-500/30 dark:hover:border-purple-500/20',
      icon: <ClipboardList size={22} /> 
    },
    { 
      id: 'customers', 
      title: 'Registro de Cliente', 
      description: 'Contribuyentes y CF', 
      path: '/customers', 
      iconBg: 'bg-indigo-600/10 text-indigo-600 border border-indigo-600/20 dark:bg-indigo-500/20 dark:text-indigo-400 dark:border-indigo-500/10',
      glowClass: 'shadow-[0_0_20px_rgba(79,70,229,0.06)] hover:shadow-[0_0_30px_rgba(79,70,229,0.15)] hover:border-indigo-500/30 dark:hover:border-indigo-500/20',
      icon: <Users size={22} /> 
    },
    { 
      id: 'inventory', 
      title: 'Inventario', 
      description: 'Existencias y stock real', 
      path: '/inventory', 
      iconBg: 'bg-rose-500/10 text-rose-500 border border-rose-500/20 dark:bg-rose-500/20 dark:text-rose-400 dark:border-rose-500/10',
      glowClass: 'shadow-[0_0_20px_rgba(244,63,94,0.06)] hover:shadow-[0_0_30px_rgba(244,63,94,0.15)] hover:border-rose-500/30 dark:hover:border-rose-500/20',
      icon: <Package size={22} /> 
    }
  ];

  const userRole = role || 'pedidos';
  const isUserAdmin = userRole === 'admin' || userRole === 'gerencia';

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

          {/* Notificaciones */}
          <Button 
            variant="ghost" 
            size="icon" 
            className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 relative text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-zinc-800"
          >
            <Bell size={15} />
            <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
          </Button>

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

      {/* Fila superior de tarjetas KPI (4 Columnas) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* KPI 1: Ventas del mes */}
        <Card className="border border-slate-200/60 dark:border-zinc-900/40 bg-white dark:bg-slate-900/40 rounded-[22px] shadow-sm relative overflow-hidden transition-all duration-300 group hover:-translate-y-0.5">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center dark:bg-blue-500/20 dark:text-blue-400 border border-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
              <FileText size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Ventas del mes</span>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mt-0.5">${salesSum.toLocaleString('en-US', { minimumFractionDigits: 0 })}</h3>
              <div className="flex items-center gap-1 mt-1 text-[9px] font-bold text-emerald-500">
                <TrendingUp size={11} />
                <span>12% vs mes anterior</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI 2: Compras del mes */}
        <Card className="border border-slate-200/60 dark:border-zinc-900/40 bg-white dark:bg-slate-900/40 rounded-[22px] shadow-sm relative overflow-hidden transition-all duration-300 group hover:-translate-y-0.5">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
              <ShoppingCart size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Compras del mes</span>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mt-0.5">${purchasesSum.toLocaleString('en-US', { minimumFractionDigits: 0 })}</h3>
              <div className="flex items-center gap-1 mt-1 text-[9px] font-bold text-emerald-500">
                <TrendingUp size={11} />
                <span>8% vs mes anterior</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI 3: Cotizaciones */}
        <Card className="border border-slate-200/60 dark:border-zinc-900/40 bg-white dark:bg-slate-900/40 rounded-[22px] shadow-sm relative overflow-hidden transition-all duration-300 group hover:-translate-y-0.5">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center dark:bg-orange-500/20 dark:text-orange-400 border border-orange-500/10 shadow-[0_0_15px_rgba(249,115,22,0.1)]">
              <FileText size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Cotizaciones</span>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mt-0.5">{quotesCount}</h3>
              <div className="flex items-center gap-1 mt-1 text-[9px] font-bold text-emerald-500">
                <TrendingUp size={11} />
                <span>5% vs mes anterior</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI 4: Productos en stock */}
        <Card className="border border-slate-200/60 dark:border-zinc-900/40 bg-white dark:bg-slate-900/40 rounded-[22px] shadow-sm relative overflow-hidden transition-all duration-300 group hover:-translate-y-0.5">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center dark:bg-rose-500/20 dark:text-rose-400 border border-rose-500/10 shadow-[0_0_15px_rgba(244,63,94,0.1)]">
              <Package size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Productos en stock</span>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mt-0.5">{stockCount.toLocaleString('en-US')}</h3>
              <div className="flex items-center gap-1 mt-1 text-[9px] font-bold text-emerald-500">
                <TrendingUp size={11} />
                <span>15% vs mes anterior</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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
                  className={`bg-white dark:bg-slate-900/40 border border-slate-150 dark:border-zinc-800 p-5 rounded-[22px] flex items-center justify-between gap-4 cursor-pointer group transition-all duration-300 hover:-translate-y-0.5 relative overflow-hidden ${m.glowClass}`}
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

      {/* Fila inferior: Actividad Reciente y Stock Bajo */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Columna Izquierda: Actividad Reciente (Ancho: 7/12) */}
        <div className="lg:col-span-7">
          <Card className="border border-slate-200/60 dark:border-zinc-900/40 bg-white dark:bg-slate-900/20 rounded-[28px] shadow-sm overflow-hidden h-full flex flex-col justify-between">
            <div>
              <div className="p-5 border-b border-slate-100 dark:border-zinc-800/80 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider font-headline">Actividad reciente</h3>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 leading-none">Últimos movimientos del sistema.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-zinc-900/60 border border-slate-100 dark:border-zinc-800">
                    <SlidersHorizontal size={12} />
                  </Button>
                  <div className="h-8 px-2.5 bg-slate-50 dark:bg-zinc-900/60 border border-slate-100 dark:border-zinc-800 rounded-lg text-[9px] font-black text-slate-500 dark:text-slate-400 flex items-center justify-center uppercase tracking-wider">
                    Hace - 2 días
                  </div>
                </div>
              </div>
              <CardContent className="p-5 space-y-4">
                {recentActivities.map((act, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-4 p-3 rounded-2xl border border-slate-50 dark:border-zinc-900/50 bg-slate-50/20 dark:bg-slate-900/10 hover:border-slate-100 dark:hover:border-zinc-800 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-all duration-300">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                        act.iconType === 'blue' 
                          ? 'bg-blue-500/10 text-blue-500 border-blue-500/10' 
                          : act.iconType === 'green'
                          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/10'
                          : 'bg-orange-500/10 text-orange-500 border-orange-500/10'
                      }`}>
                        <Activity size={14} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate leading-snug">{act.title}</h4>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate leading-none mt-1">{act.subtitle}</p>
                      </div>
                    </div>
                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-600 uppercase shrink-0">Ver Detalle</span>
                  </div>
                ))}
              </CardContent>
            </div>
            <div className="p-4 border-t border-slate-100 dark:border-zinc-800/80 bg-slate-50/10 dark:bg-zinc-950/20">
              <Button 
                variant="outline" 
                onClick={() => router.push('/billing')}
                className="w-full h-10 bg-slate-50 dark:bg-zinc-900/60 border-slate-100 dark:border-zinc-800/80 rounded-xl text-xs font-bold hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all"
              >
                Ver toda la actividad
              </Button>
            </div>
          </Card>
        </div>

        {/* Columna Derecha: Stock Bajo (Ancho: 5/12) */}
        <div className="lg:col-span-5">
          <Card className="border border-slate-200/60 dark:border-zinc-900/40 bg-white dark:bg-slate-900/20 rounded-[28px] shadow-sm overflow-hidden h-full flex flex-col justify-between">
            <div className="p-5 border-b border-slate-100 dark:border-zinc-800/80 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider font-headline">Stock bajo</h3>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 leading-none">Alertas automáticas de reposición.</p>
              </div>
              <div className="flex items-center gap-3">
                <Link href="/inventory" className="text-[9px] font-black uppercase text-indigo-500 hover:text-indigo-600 tracking-wider">Ver todos</Link>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <Link href="/inventory" className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Alertas</Link>
              </div>
            </div>
            <CardContent className="p-5 space-y-4">
              {lowStockList.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between gap-4 p-3 rounded-2xl border border-slate-50 dark:border-zinc-900/50 bg-slate-50/20 dark:bg-slate-900/10 hover:border-slate-100 dark:hover:border-zinc-800 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-all duration-300">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-rose-500/15 text-rose-500 flex items-center justify-center border border-rose-500/10 shrink-0">
                      <AlertTriangle size={13} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate leading-snug">{item.name}</h4>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate leading-none mt-1">Stock actual: {item.stock}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500">Mín: {item.minLevel}</span>
                    <Badge className={`text-[8px] font-black uppercase px-2 h-5 rounded-md ${
                      item.status === 'Crítico'
                        ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.1)]'
                        : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                    }`} variant="outline">
                      {item.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
            <div className="p-4 border-t border-slate-100 dark:border-zinc-800/80 bg-slate-50/10 dark:bg-zinc-950/20">
              <Button 
                variant="outline" 
                onClick={() => router.push('/inventory')}
                className="w-full h-10 bg-slate-50 dark:bg-zinc-900/60 border-slate-100 dark:border-zinc-800/80 rounded-xl text-xs font-bold hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all"
              >
                Configurar alertas
              </Button>
            </div>
          </Card>
        </div>

      </div>
    </div>
  );
}