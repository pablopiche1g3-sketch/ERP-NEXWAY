'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { supabase } from '@/supabase/client';

export interface GuideTask {
  id: string;
  title: string;
  description: string;
  category: 'setup' | 'operations' | 'opportunities';
  status: 'pending' | 'completed' | 'info';
  actionLabel?: string;
  actionPath?: string;
}

interface BmsStats {
  branchesCount: number;
  productsCount: number;
  zeroStockProductsCount: number;
  stagnantProductsCount: number;
  hasSalesToday: boolean;
  hasClosingToday: boolean;
  crmTasksCount: number;
}

interface BmsContextType {
  stats: BmsStats;
  tasks: GuideTask[];
  loading: boolean;
  auditSystem: () => Promise<void>;
  processChange: (total: number, paid: number) => void;
  triggerArqueoAlert: (difference: number) => void;
  requestChange: () => void;
  confirmChange: () => void;
}

const defaultStats: BmsStats = {
  branchesCount: 0,
  productsCount: 0,
  zeroStockProductsCount: 0,
  stagnantProductsCount: 0,
  hasSalesToday: false,
  hasClosingToday: false,
  crmTasksCount: 0
};

const BmsContext = createContext<BmsContextType>({
  stats: defaultStats,
  tasks: [],
  loading: true,
  auditSystem: async () => {},
  processChange: () => {},
  triggerArqueoAlert: () => {},
  requestChange: () => {},
  confirmChange: () => {}
});

export const useBms = () => useContext(BmsContext);

export function BmsProvider({ children }: { children: ReactNode }) {
  const [stats, setStats] = useState<BmsStats>(defaultStats);
  const [loading, setLoading] = useState(true);
  
  // Custom tasks for alerts
  const [customTasks, setCustomTasks] = useState<GuideTask[]>([]);

  // Smart Change Control State (In-Memory Simulator)
  const [inventoryQuarters, setInventoryQuarters] = useState(20); // $5 in coras
  const [inventoryOnes, setInventoryOnes] = useState(10); // $10 in $1 bills
  const [changeRequested, setChangeRequested] = useState(false);

  const triggerArqueoAlert = (difference: number) => {
    const alertId = 'alert_arqueo_ciego';
    setCustomTasks(prev => {
      if (prev.find(t => t.id === alertId)) return prev;
      return [...prev, {
        id: alertId,
        title: 'Descuadre Detectado',
        description: `La auditoría a ciegas falló por una diferencia de $${Math.abs(difference).toFixed(2)}. ${difference < 0 ? '(Faltante)' : '(Sobrante)'}. Contacta a tu supervisor.`,
        category: 'operations',
        status: 'pending'
      }];
    });
  };

  const requestChange = () => setChangeRequested(true);
  const confirmChange = () => {
    setInventoryQuarters(prev => prev + 40); // add $10 in quarters
    setInventoryOnes(prev => prev + 10); // add $10 in ones
    setChangeRequested(false);
  };

  const processChange = (total: number, paid: number) => {
    if (paid <= total) return;
    let change = paid - total;
    
    // Greedy algorithm for simulating change
    // We only care about $1 and $0.25 to decrement them.
    let onesUsed = 0;
    let quartersUsed = 0;

    // Remove larger bills mentally ($20, $10, $5)
    change = change % 5;
    
    // Calculate $1
    onesUsed = Math.floor(change / 1);
    change = change - (onesUsed * 1);
    
    // Calculate quarters
    quartersUsed = Math.floor(change / 0.25);

    if (onesUsed > 0) setInventoryOnes(prev => Math.max(0, prev - onesUsed));
    if (quartersUsed > 0) setInventoryQuarters(prev => Math.max(0, prev - quartersUsed));
  };

  const auditSystem = async () => {
    setLoading(true);
    try {
      // Obtener usuario activo para filtrar tareas personalizadas
      const { data: { user } } = await supabase.auth.getUser();

      // 0. Auditar tareas pendientes del CRM para el usuario activo
      let pendingCrmTasks = 0;
      if (user?.email) {
        const { count } = await supabase
          .from('crm_tasks')
          .select('*', { count: 'exact', head: true })
          .eq('assigned_to', user.email)
          .eq('status', 'PENDIENTE');
        pendingCrmTasks = count || 0;
      }

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
        const skuStockMap: Record<string, number> = {};
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
        hasClosingToday: (closingToday || []).length > 0,
        crmTasksCount: pendingCrmTasks
      });
    } catch (error) {
      console.error('Error al auditar el BMS:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Audit initially when the app loads
    auditSystem();
    
    // Auto-refresh the BMS every 5 minutes silently
    const interval = setInterval(() => {
      auditSystem();
    }, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  // Generar tareas y pasos lógicos dinámicos basados en la auditoría (El motor del BMS)
  const tasks = useMemo<GuideTask[]>(() => {
    const list: GuideTask[] = [];

    // --- CATEGORÍA 1: CONFIGURACIÓN Y PUESTA EN MARCHA (SETUP) ---
    if (stats.branchesCount === 0) {
      list.push({
        id: 'setup_branch',
        title: 'Registrar Primera Sucursal',
        description: 'No se detectan sucursales activas en el sistema. Es obligatorio tener al menos una.',
        category: 'setup',
        status: 'pending',
        actionLabel: 'Ir a Gerencia',
        actionPath: '/management'
      });
    } else {
      list.push({
        id: 'setup_branch_done',
        title: 'Sucursales Inicializadas',
        description: `Tienes ${stats.branchesCount} sucursal(es) registrada(s).`,
        category: 'setup',
        status: 'completed'
      });
    }

    if (stats.productsCount === 0) {
      list.push({
        id: 'setup_products',
        title: 'Cargar Catálogo',
        description: 'Tu catálogo maestro está vacío. Agrega tus productos.',
        category: 'setup',
        status: 'pending',
        actionLabel: 'Ir a Inventario',
        actionPath: '/inventory'
      });
    } else {
      list.push({
        id: 'setup_products_done',
        title: 'Catálogo Listo',
        description: `Cuentas con ${stats.productsCount} producto(s) en inventario.`,
        category: 'setup',
        status: 'completed'
      });
    }

    // --- CATEGORÍA 2: OPERACIONES DIARIAS ---
    if (stats.productsCount > 0 && stats.zeroStockProductsCount > 0) {
      list.push({
        id: 'ops_zero_stock',
        title: 'Ingresar Stock Agotado',
        description: `Tienes ${stats.zeroStockProductsCount} productos con stock en 0.`,
        category: 'operations',
        status: 'pending',
        actionLabel: 'Hacer Compra',
        actionPath: '/purchases'
      });
    }

    if (!stats.hasSalesToday) {
      list.push({
        id: 'ops_first_sale',
        title: 'Primera Venta del Día',
        description: 'Aún no se reportan transacciones hoy.',
        category: 'operations',
        status: 'info',
        actionLabel: 'Facturación',
        actionPath: '/billing'
      });
    } else {
      list.push({
        id: 'ops_sale_done',
        title: 'Flujo de Ventas Iniciado',
        description: 'Ya se han registrado transacciones comerciales hoy.',
        category: 'operations',
        status: 'completed'
      });
    }

    if (stats.hasSalesToday && !stats.hasClosingToday) {
      list.push({
        id: 'ops_pending_closing',
        title: 'Cierre de Caja Pendiente',
        description: 'Hay ventas activas pero falta Cierre de Caja.',
        category: 'operations',
        status: 'pending',
        actionLabel: 'Contabilidad',
        actionPath: '/accounting'
      });
    }

    // --- INTEGRACIÓN CRM: Tareas y Seguimientos ---
    if (stats.crmTasksCount > 0) {
      list.push({
        id: 'ops_crm_tasks',
        title: 'Tareas CRM Pendientes',
        description: `Tienes ${stats.crmTasksCount} tarea(s) comercial(es) sin completar.`,
        category: 'operations',
        status: 'pending',
        actionLabel: 'Ir al CRM',
        actionPath: '/crm'
      });
    }

    // --- CATEGORÍA 3: OPORTUNIDADES (ANALÍTICA) ---
    if (stats.stagnantProductsCount > 0) {
      list.push({
        id: 'opp_stagnant',
        title: 'Productos Estancados',
        description: `Tienes ${stats.stagnantProductsCount} productos sin movimiento en 30 días con alto stock. Arma una promo.`,
        category: 'opportunities',
        status: 'info',
        actionLabel: 'Inventario',
        actionPath: '/inventory'
      });
    }

    // --- ALERTAS DE SENCILLO (BMS SMART CHANGE) ---
    const quartersAmount = inventoryQuarters * 0.25;
    const onesAmount = inventoryOnes * 1;
    
    if (quartersAmount < 2.00 || onesAmount < 5.00) {
      const issue = quartersAmount < 2.00 ? 'monedas de a cora' : 'billetes de a $1';
      const amount = quartersAmount < 2.00 ? quartersAmount : onesAmount;
      
      list.push({
        id: 'alert_smart_change',
        title: '⚠️ Alerta de Sencillo',
        description: `Quedan $${amount.toFixed(2)} en ${issue}. Solicita cambio de $10.00 al supervisor.`,
        category: 'operations',
        status: changeRequested ? 'completed' : 'pending',
        actionLabel: changeRequested ? 'Confirmar Ingreso' : 'Solicitar Cambio'
      });
    }

    // Append any custom tasks (like Arqueo Ciego alert)
    return [...list, ...customTasks];
  }, [stats, customTasks, inventoryQuarters, inventoryOnes, changeRequested]);

  return (
    <BmsContext.Provider value={{ 
      stats, tasks, loading, auditSystem, 
      processChange, triggerArqueoAlert, requestChange, confirmChange 
    }}>
      {children}
    </BmsContext.Provider>
  );
}
