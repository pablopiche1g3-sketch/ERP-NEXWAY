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
  AlertTriangle,
  Boxes,
  CheckCircle2,
  AlertCircle,
  X,
  Layers,
  ExternalLink,
  Warehouse as WarehouseIcon,
  Tag
} from 'lucide-react';
import Link from 'next/link';
import {  useUser, ROLE_PERMISSIONS  } from '@/supabase/compat';
import { supabase } from '@/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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

  // Estados para Buscador Rápido de Existencias
  const [stockQuery, setStockQuery] = useState('');
  const [isStockSearchOpen, setIsStockSearchOpen] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [inventoryList, setInventoryList] = useState<any[]>([]);
  const [stockMap, setStockMap] = useState<Record<string, Record<string, number>>>({});
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loadingStock, setLoadingStock] = useState(false);
  const [selectedProductStock, setSelectedProductStock] = useState<any | null>(null);

  useEffect(() => {
    const fetchStockData = async () => {
      setLoadingStock(true);
      try {
        const [invRes, stockRes, whRes] = await Promise.all([
          supabase.from('inventory').select('*').order('name'),
          supabase.from('inventory_stock').select('*'),
          supabase.from('warehouses').select('*').order('name')
        ]);

        setInventoryList(invRes.data || []);
        setWarehouses(whRes.data || []);

        const map: Record<string, Record<string, number>> = {};
        (stockRes.data || []).forEach((row: any) => {
          if (!map[row.sku]) map[row.sku] = {};
          map[row.sku][row.warehouse_id] = parseFloat(row.quantity) || 0;
        });
        setStockMap(map);
      } catch (err) {
        console.error('Error cargando existencias para búsqueda rápida:', err);
      } finally {
        setLoadingStock(false);
      }
    };

    fetchStockData();
  }, []);

  // Productos filtrados para la búsqueda rápida
  const filteredStockResults = useMemo(() => {
    if (!stockQuery.trim()) return [];
    const q = stockQuery.toLowerCase().trim();
    return inventoryList.filter(p => 
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.sku && p.sku.toLowerCase().includes(q)) ||
      (p.category && p.category.toLowerCase().includes(q)) ||
      (p.barcode && p.barcode.toLowerCase().includes(q))
    ).slice(0, 8); // Top 8 resultados rápidos
  }, [stockQuery, inventoryList]);

  // Total de stock para un producto
  const getProductTotalStock = (sku: string) => {
    const whStocks = stockMap[sku] || {};
    return Object.values(whStocks).reduce((a, b) => a + b, 0);
  };

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

        {/* Controles de barra inferior: BUSCADOR RÁPIDO DE EXISTENCIAS */}
        <div className="relative w-full z-30">
          <div className="flex items-center gap-3 w-full">
            {/* Buscador de Stock con Autocompletado */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-indigo-500 dark:text-indigo-400 w-4 h-4" />
              <Input 
                type="text" 
                placeholder="🔍 Búsqueda rápida de existencia (Nombre, SKU, Código de Barras)..." 
                value={stockQuery}
                onChange={(e) => setStockQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                className="h-12 pl-10 pr-10 bg-card text-xs font-bold rounded-2xl focus-visible:ring-indigo-500 transition-all w-full border-border shadow-md"
              />
              {stockQuery && (
                <button 
                  onClick={() => setStockQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Botón Lupa / Catálogo Completo */}
            <Button 
              onClick={() => setIsStockSearchOpen(true)}
              className="h-12 px-5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-2xl shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2 shrink-0"
            >
              <Boxes size={16} />
              <span className="hidden sm:inline">Consultar Existencias</span>
            </Button>
          </div>

          {/* DROPDOWN FLOTANTE DE RESULTADOS RÁPIDOS */}
          {isSearchFocused && stockQuery.trim().length > 0 && (
            <div 
              className="absolute top-full left-0 right-0 mt-2 bg-card/95 backdrop-blur-md border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 p-2 max-h-96 overflow-y-auto"
            >
              <div className="flex justify-between items-center px-3 py-1.5 border-b border-border/50 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                <span>Resultados de Stock ({filteredStockResults.length})</span>
                <span className="text-indigo-500 cursor-pointer hover:underline" onClick={() => setIsStockSearchOpen(true)}>
                  Abrir vista completa ➔
                </span>
              </div>

              {filteredStockResults.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground italic">
                  No se encontraron productos con "{stockQuery}"
                </div>
              ) : (
                <div className="divide-y divide-border/30">
                  {filteredStockResults.map((p) => {
                    const total = getProductTotalStock(p.sku);
                    const isAvailable = total > 5;
                    const isLow = total > 0 && total <= 5;
                    const isOut = total <= 0;

                    return (
                      <div 
                        key={p.sku} 
                        onClick={() => setSelectedProductStock(p)}
                        className="p-3 hover:bg-muted/50 rounded-xl cursor-pointer transition-colors flex items-center justify-between gap-3 group"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-foreground group-hover:text-indigo-500 transition-colors truncate">
                              {p.name}
                            </span>
                            <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              {p.sku}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1">
                            <span>Precio: <strong className="text-foreground font-mono">${parseFloat(p.price || 0).toFixed(2)}</strong></span>
                            {p.category && <span>• {p.category}</span>}
                          </div>
                        </div>

                        {/* Badges de Existencia */}
                        <div className="text-right shrink-0 flex items-center gap-3">
                          <div className="flex flex-col items-end">
                            <span className="text-sm font-black font-mono text-foreground">{total} unds</span>
                            <Badge className={`border-0 text-[8px] font-black uppercase px-1.5 py-0.2 ${
                              isAvailable ? 'bg-emerald-500/20 text-emerald-500' : isLow ? 'bg-amber-500/20 text-amber-500' : 'bg-rose-500/20 text-rose-500'
                            }`}>
                              {isAvailable ? 'Disponible' : isLow ? 'Stock Bajo' : 'Agotado'}
                            </Badge>
                          </div>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/billing?addSku=${p.sku}`);
                            }}
                            className="h-8 w-8 p-0 rounded-lg text-indigo-500 hover:bg-indigo-500/10"
                            title="Facturar en POS"
                          >
                            <ShoppingCart size={15} />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
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

      {/* ─── MODAL 1: CONSULTA RÁPIDA DE EXISTENCIAS (LUPA DE STOCK) ─── */}
      <Dialog open={isStockSearchOpen} onOpenChange={setIsStockSearchOpen}>
        <DialogContent className="max-w-3xl rounded-3xl p-6 bg-card border shadow-2xl space-y-4 max-h-[88vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-lg font-black flex items-center gap-2">
              <Boxes className="text-indigo-500" size={22} /> Consulta Rápida de Existencias
            </DialogTitle>
            <DialogDescription className="text-xs">
              Verifica el stock físico y ubicación en tiempo real de todos los productos del inventario.
            </DialogDescription>
          </DialogHeader>

          {/* Buscador dentro del Modal */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-indigo-500 w-4 h-4" />
            <Input 
              type="text" 
              placeholder="Buscar por Nombre, SKU, Categoría o Código de Barras..." 
              value={stockQuery}
              onChange={(e) => setStockQuery(e.target.value)}
              autoFocus
              className="h-11 pl-10 pr-4 rounded-xl text-xs font-bold bg-muted/40 border-border"
            />
          </div>

          {/* Tabla de Resultados de Existencias */}
          <div className="flex-1 overflow-y-auto border rounded-2xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/60 sticky top-0 border-b text-[10px] font-black uppercase text-muted-foreground">
                <tr>
                  <th className="p-3">Producto / SKU</th>
                  <th className="p-3 text-center">Categoría</th>
                  <th className="p-3 text-right">Precio Venta</th>
                  <th className="p-3 text-center">Stock Total</th>
                  <th className="p-3 text-center">Estado</th>
                  <th className="p-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {(stockQuery.trim() ? filteredStockResults : inventoryList.slice(0, 20)).map((prod) => {
                  const total = getProductTotalStock(prod.sku);
                  const isAvailable = total > 5;
                  const isLow = total > 0 && total <= 5;

                  return (
                    <tr 
                      key={prod.sku} 
                      onClick={() => setSelectedProductStock(prod)}
                      className="hover:bg-muted/40 cursor-pointer transition-colors"
                    >
                      <td className="p-3">
                        <strong className="text-foreground block">{prod.name}</strong>
                        <span className="text-[10px] text-muted-foreground font-mono">{prod.sku}</span>
                      </td>
                      <td className="p-3 text-center">
                        <span className="text-[11px] text-muted-foreground">{prod.category || 'General'}</span>
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-foreground">
                        ${parseFloat(prod.price || 0).toFixed(2)}
                      </td>
                      <td className="p-3 text-center font-mono font-black text-sm text-foreground">
                        {total} unds
                      </td>
                      <td className="p-3 text-center">
                        <Badge className={`border-0 text-[9px] font-black uppercase px-2 py-0.5 ${
                          isAvailable ? 'bg-emerald-500/20 text-emerald-500' : isLow ? 'bg-amber-500/20 text-amber-500' : 'bg-rose-500/20 text-rose-500'
                        }`}>
                          {isAvailable ? 'Disponible' : isLow ? 'Stock Bajo' : 'Agotado'}
                        </Badge>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => {
                              setIsStockSearchOpen(false);
                              router.push(`/billing?addSku=${prod.sku}`);
                            }}
                            className="h-8 text-[11px] font-bold rounded-xl text-indigo-600 dark:text-indigo-400"
                          >
                            <ShoppingCart size={13} className="mr-1" /> Facturar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL 2: DESGLOSE DE EXISTENCIAS POR BODEGA ──────────────── */}
      <Dialog open={!!selectedProductStock} onOpenChange={(open) => !open && setSelectedProductStock(null)}>
        <DialogContent className="max-w-md rounded-3xl p-6 bg-card border shadow-2xl space-y-4">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <WarehouseIcon className="text-indigo-500" size={20} /> Desglose de Existencias por Bodega
            </DialogTitle>
            <DialogDescription className="text-xs">
              Ubicación física del producto en cada almacén de la empresa.
            </DialogDescription>
          </DialogHeader>

          {selectedProductStock && (
            <div className="space-y-4">
              {/* Resumen del Producto */}
              <div className="p-4 bg-muted/40 rounded-2xl border space-y-2 text-xs">
                <div>
                  <h4 className="font-black text-sm text-foreground">{selectedProductStock.name}</h4>
                  <span className="text-[10px] font-mono text-muted-foreground">SKU: {selectedProductStock.sku}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t text-[11px]">
                  <span>Precio de Venta: <strong className="font-mono text-foreground font-bold">${parseFloat(selectedProductStock.price || 0).toFixed(2)}</strong></span>
                  <span>Stock Global: <strong className="font-mono text-indigo-600 dark:text-indigo-400 font-black text-sm">{getProductTotalStock(selectedProductStock.sku)} unds</strong></span>
                </div>
              </div>

              {/* Lista de Bodegas */}
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground">Existencias por Bodega / Sucursal</Label>
                <div className="space-y-1.5 max-h-52 overflow-y-auto">
                  {warehouses.map((wh) => {
                    const qty = (stockMap[selectedProductStock.sku] || {})[wh.id] || 0;
                    return (
                      <div key={wh.id} className="flex justify-between items-center p-2.5 bg-card border rounded-xl text-xs">
                        <div className="flex items-center gap-2">
                          <WarehouseIcon size={14} className="text-muted-foreground" />
                          <span className="font-bold text-foreground">{wh.name}</span>
                        </div>
                        <span className={`font-mono font-black ${qty > 0 ? 'text-foreground' : 'text-rose-500'}`}>
                          {qty} unds
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t">
                <Button 
                  onClick={() => {
                    const sku = selectedProductStock.sku;
                    setSelectedProductStock(null);
                    setIsStockSearchOpen(false);
                    router.push(`/billing?addSku=${sku}`);
                  }}
                  className="flex-1 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black"
                >
                  <ShoppingCart size={14} className="mr-1.5" /> Facturar Producto en POS
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSelectedProductStock(null);
                    setIsStockSearchOpen(false);
                    router.push('/logistica?tab=inventario');
                  }}
                  className="h-10 rounded-xl text-xs font-bold"
                >
                  Ver en Logística
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}