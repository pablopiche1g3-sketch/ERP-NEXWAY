'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/supabase/client';
import { 
  CheckCircle, 
  AlertCircle, 
  Sparkles, 
  Play, 
  RotateCcw, 
  HelpCircle, 
  TrendingUp,
  Package,
  Building2,
  CalendarCheck,
  ChevronDown,
  ChevronUp,
  Award
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface GuideTask {
  id: string;
  title: string;
  description: string;
  category: 'setup' | 'operations' | 'opportunities';
  status: 'pending' | 'completed' | 'info';
  actionLabel?: string;
  actionPath?: string;
}

export function AsistenteGuiaERP() {
  const [isOpen, setIsOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  
  // Datos auditados en tiempo real
  const [stats, setStats] = useState({
    branchesCount: 0,
    productsCount: 0,
    zeroStockProductsCount: 0,
    stagnantProductsCount: 0,
    hasSalesToday: false,
    hasClosingToday: false
  });

  const auditSystem = async () => {
    setLoading(true);
    try {
      // 1. Auditar sucursales
      const { count: branchesCount } = await supabase
        .from('branches')
        .select('*', { count: 'exact', head: true });

      // 2. Auditar catálogo de productos
      const { count: productsCount } = await supabase
        .from('inventory')
        .select('*', { count: 'exact', head: true });

      // 3. Auditar stock en cero
      const { data: stockData } = await supabase
        .from('inventory_stock')
        .select('quantity');
      
      const zeroStockProducts = (stockData || []).filter(s => (parseFloat(s.quantity) || 0) <= 0).length;

      // 4. Auditar si hay ventas hoy
      const todayStr = new Date().toISOString().split('T')[0];
      const { data: salesToday } = await supabase
        .from('sales')
        .select('id')
        .neq('status', 'CANCELADA')
        .gte('created_at', todayStr)
        .limit(1);

      // 5. Auditar si hay cierre de caja hoy
      const { data: closingToday } = await supabase
        .from('daily_closings')
        .select('id')
        .gte('date', todayStr)
        .limit(1);

      // 6. Auditar productos estancados (Matemática tradicional sin IA)
      // Buscamos productos que tengan stock actual > 10 pero 0 ventas en los últimos 30 días
      const limitDate = new Date();
      limitDate.setDate(limitDate.getDate() - 30);
      
      const { data: sales30d } = await supabase
        .from('sales')
        .select('items')
        .neq('status', 'CANCELADA')
        .gte('created_at', limitDate.toISOString());

      const soldSkuSet = new Set<string>();
      (sales30d || []).forEach(sale => {
        if (sale.items && Array.isArray(sale.items)) {
          sale.items.forEach((item: any) => {
            if (item.sku) soldSkuSet.add(item.sku);
          });
        }
      });

      const { data: inventoryList } = await supabase
        .from('inventory')
        .select('sku');

      let stagnantCount = 0;
      if (inventoryList && stockData) {
        // Mapeamos cantidad por sku
        const skuStockMap: Record<string, number> = {};
        // Para este demo simplificado, si tienen existencias y el sku no está en las ventas de 30 días, lo contamos
        const { data: stockItems } = await supabase.from('inventory_stock').select('sku, quantity');
        (stockItems || []).forEach(st => {
          skuStockMap[st.sku] = (skuStockMap[st.sku] || 0) + (parseFloat(st.quantity) || 0);
        });

        inventoryList.forEach(p => {
          const stockVal = skuStockMap[p.sku] || 0;
          if (stockVal > 15 && !soldSkuSet.has(p.sku)) {
            stagnantCount++;
          }
        });
      }

      setStats({
        branchesCount: branchesCount || 0,
        productsCount: productsCount || 0,
        zeroStockProductsCount: zeroStockProducts,
        stagnantProductsCount: stagnantCount,
        hasSalesToday: (salesToday || []).length > 0,
        hasClosingToday: (closingToday || []).length > 0
      });
    } catch (error) {
      console.error('Error al auditar el ERP para la guía:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    auditSystem();
  }, []);

  // Generar tareas y pasos lógicos dinámicos basados en la auditoría
  const tasks = useMemo<GuideTask[]>(() => {
    const list: GuideTask[] = [];

    // --- CATEGORÍA 1: CONFIGURACIÓN Y PUESTA EN MARCHA (SETUP) ---
    if (stats.branchesCount === 0) {
      list.push({
        id: 'setup_branch',
        title: 'Registrar tu Primera Sucursal',
        description: 'No se detectan sucursales activas en el sistema. Es obligatorio tener al menos una sucursal para poder facturar.',
        category: 'setup',
        status: 'pending',
        actionLabel: 'Ir a Gerencia',
        actionPath: '/management'
      });
    } else {
      list.push({
        id: 'setup_branch_done',
        title: 'Sucursales Inicializadas',
        description: `¡Perfecto! Tienes ${stats.branchesCount} sucursal(es) registrada(s) y lista(s) para operar.`,
        category: 'setup',
        status: 'completed'
      });
    }

    if (stats.productsCount === 0) {
      list.push({
        id: 'setup_products',
        title: 'Cargar Catálogo de Productos',
        description: 'Tu catálogo maestro está vacío. Agrega tus productos con sus códigos para habilitar las compras y ventas.',
        category: 'setup',
        status: 'pending',
        actionLabel: 'Ir a Inventario',
        actionPath: '/inventory'
      });
    } else {
      list.push({
        id: 'setup_products_done',
        title: 'Catálogo con Productos',
        description: `¡Excelente! Ya cuentas con ${stats.productsCount} producto(s) cargado(s) en tu inventario.`,
        category: 'setup',
        status: 'completed'
      });
    }

    // --- CATEGORÍA 2: OPERACIONES DIARIAS ---
    if (stats.productsCount > 0 && stats.zeroStockProductsCount > 0) {
      list.push({
        id: 'ops_zero_stock',
        title: 'Ingresar Stock en Productos Agotados',
        description: `Tienes ${stats.zeroStockProductsCount} productos con stock en 0. Haz un Registro de Compra para abastecer bodega.`,
        category: 'operations',
        status: 'pending',
        actionLabel: 'Hacer Compra',
        actionPath: '/purchases'
      });
    }

    if (!stats.hasSalesToday) {
      list.push({
        id: 'ops_first_sale',
        title: 'Registrar la Primera Venta del Día',
        description: 'Aún no se reportan transacciones el día de hoy. Habilita una caja y comienza a facturar.',
        category: 'operations',
        status: 'info',
        actionLabel: 'Ir a Facturación',
        actionPath: '/billing'
      });
    } else {
      list.push({
        id: 'ops_sale_done',
        title: 'Flujo de Ventas Iniciado',
        description: '¡Muy bien! Ya se han registrado transacciones comerciales el día de hoy.',
        category: 'operations',
        status: 'completed'
      });
    }

    if (stats.hasSalesToday && !stats.hasClosingToday) {
      list.push({
        id: 'ops_pending_closing',
        title: 'Realizar Cierre de Caja al Final del Turno',
        description: 'Hay ventas activas hoy pero no se ha asentado el Cierre de Caja Diario en Contabilidad.',
        category: 'operations',
        status: 'pending',
        actionLabel: 'Ir a Contabilidad',
        actionPath: '/accounting'
      });
    }

    // --- CATEGORÍA 3: OPORTUNIDADES COMERCIALES (KPIs) ---
    if (stats.stagnantProductsCount > 0) {
      list.push({
        id: 'opp_stagnant_stock',
        title: 'Rotar Stock Estancado en Bodega',
        description: `Se detectan ${stats.stagnantProductsCount} productos con alta existencia pero sin ventas en 30 días. ¡Crea una oferta!`,
        category: 'opportunities',
        status: 'info',
        actionLabel: 'Ver Foco de Venta',
        actionPath: '/management'
      });
    }

    return list;
  }, [stats]);

  // Contadores para el badge de tareas pendientes
  const pendingTasksCount = useMemo(() => {
    return tasks.filter(t => t.status === 'pending').length;
  }, [tasks]);

  if (loading) {
    return null; // Oculto durante la carga para una transición limpia
  }

  return (
    <Card className="glass-card rounded-2xl mb-8 overflow-hidden relative z-10 border border-white/10 shadow-xl">
      <CardHeader 
        className="p-5 bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border-b border-white/10 flex flex-row items-center justify-between cursor-pointer select-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/5">
            <Award size={18} className="animate-pulse" />
          </div>
          <div>
            <CardTitle className="text-xs md:text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              Asistente de Control y Puesta en Marcha
              {pendingTasksCount > 0 && (
                <Badge className="bg-amber-500 text-slate-950 text-[9px] font-black h-4 px-1.5 rounded-full animate-bounce">
                  {pendingTasksCount} PENDIENTES
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-[10px] text-slate-400 mt-0.5">
              Auditoría interna de procesos comerciales y salud del sistema sin IA.
            </CardDescription>
          </div>
        </div>
        <div className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg">
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </CardHeader>

      {isOpen && (
        <CardContent className="p-6 bg-slate-950/20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Columna 1: Configuración Maestro */}
            <div>
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                <Building2 size={12} className="text-indigo-400" /> 1. Configuración de Base
              </h4>
              <div className="space-y-3.5">
                {tasks.filter(t => t.category === 'setup').map(task => (
                  <div key={task.id} className={`p-4 rounded-xl border transition-all ${
                    task.status === 'completed' 
                      ? 'bg-emerald-500/5 border-emerald-500/10' 
                      : 'bg-rose-500/5 border-rose-500/10 shadow-[0_0_15px_rgba(239,68,68,0.05)]'
                  }`}>
                    <div className="flex gap-2.5 items-start">
                      {task.status === 'completed' ? (
                        <CheckCircle size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle size={14} className="text-rose-500 shrink-0 mt-0.5 animate-pulse" />
                      )}
                      <div>
                        <p className="text-xs font-bold text-white leading-snug">{task.title}</p>
                        <p className="text-[9.5px] text-slate-400 leading-relaxed mt-1">{task.description}</p>
                        {task.status === 'pending' && task.actionLabel && (
                          <Button 
                            variant="link" 
                            className="text-indigo-400 hover:text-indigo-300 p-0 h-auto text-[9.5px] font-black uppercase tracking-wider mt-2 flex items-center gap-1"
                            onClick={() => window.location.href = task.actionPath || '#'}
                          >
                            <Play size={8} /> {task.actionLabel}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Columna 2: Operaciones Diarias */}
            <div>
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                <CalendarCheck size={12} className="text-blue-400" /> 2. Operación Diaria
              </h4>
              <div className="space-y-3.5">
                {tasks.filter(t => t.category === 'operations').map(task => (
                  <div key={task.id} className={`p-4 rounded-xl border transition-all ${
                    task.status === 'completed' 
                      ? 'bg-emerald-500/5 border-emerald-500/10' 
                      : task.status === 'pending'
                        ? 'bg-rose-500/5 border-rose-500/10'
                        : 'bg-blue-500/5 border-blue-500/10'
                  }`}>
                    <div className="flex gap-2.5 items-start">
                      {task.status === 'completed' ? (
                        <CheckCircle size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                      ) : task.status === 'pending' ? (
                        <AlertCircle size={14} className="text-rose-500 shrink-0 mt-0.5 animate-pulse" />
                      ) : (
                        <HelpCircle size={14} className="text-blue-400 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <p className="text-xs font-bold text-white leading-snug">{task.title}</p>
                        <p className="text-[9.5px] text-slate-400 leading-relaxed mt-1">{task.description}</p>
                        {task.status === 'pending' && task.actionLabel && (
                          <Button 
                            variant="link" 
                            className="text-indigo-400 hover:text-indigo-300 p-0 h-auto text-[9.5px] font-black uppercase tracking-wider mt-2 flex items-center gap-1"
                            onClick={() => window.location.href = task.actionPath || '#'}
                          >
                            <Play size={8} /> {task.actionLabel}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {tasks.filter(t => t.category === 'operations').length === 0 && (
                  <p className="text-[10px] text-muted-foreground italic text-center py-4">Felicidades, todas las tareas operacionales de hoy están al día.</p>
                )}
              </div>
            </div>

            {/* Columna 3: Oportunidades y KPIs */}
            <div>
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                <Sparkles size={12} className="text-amber-400" /> 3. Oportunidades Comerciales
              </h4>
              <div className="space-y-3.5">
                {tasks.filter(t => t.category === 'opportunities').map(task => (
                  <div key={task.id} className="p-4 rounded-xl border bg-amber-500/5 border-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.02)] transition-all">
                    <div className="flex gap-2.5 items-start">
                      <TrendingUp size={14} className="text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-white leading-snug">{task.title}</p>
                        <p className="text-[9.5px] text-slate-400 leading-relaxed mt-1">{task.description}</p>
                        {task.actionLabel && (
                          <Button 
                            variant="link" 
                            className="text-amber-400 hover:text-amber-300 p-0 h-auto text-[9.5px] font-black uppercase tracking-wider mt-2 flex items-center gap-1"
                            onClick={() => window.location.href = task.actionPath || '#'}
                          >
                            <Play size={8} /> {task.actionLabel}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {tasks.filter(t => t.category === 'opportunities').length === 0 && (
                  <div className="p-4 rounded-xl border bg-slate-900/40 border-border text-center">
                    <p className="text-[10px] text-emerald-400 font-bold">🎯 Rotación de Stock Óptima</p>
                    <p className="text-[9px] text-muted-foreground mt-1 leading-relaxed">No se detectan inventarios estancados significativos en bodega en los últimos 30 días.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Botón de re-auditoría manual */}
          <div className="flex justify-end mt-5 pt-4 border-t border-white/5">
            <Button 
              onClick={auditSystem} 
              variant="ghost" 
              size="sm" 
              className="text-[9px] font-bold text-slate-400 hover:text-white hover:bg-white/5 h-7 rounded-lg flex items-center gap-1"
            >
              <RotateCcw size={10} /> Re-auditar Sistema
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
