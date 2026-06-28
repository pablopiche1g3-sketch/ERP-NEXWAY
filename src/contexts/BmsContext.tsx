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
  zeroStockNames?: string;
  stagnantProductsCount: number;
  hasSalesToday: boolean;
  hasClosingToday: boolean;
  crmTasksCount: number;
  pendingOrdersCount: number;
}

export interface MapLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: 'VIP' | 'BRANCH' | 'DELIVERY';
  balance?: number;
}

export interface MapRoute {
  id: string;
  path: { lat: number; lng: number }[];
  status: 'ACTIVE' | 'PENDING';
}

export interface MapData {
  locations: MapLocation[];
  routes: MapRoute[];
  densityAlert: string | null;
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
  // Guide Mode State
  isGuideActive: boolean;
  targetElementId: string | null;
  guideMessage: string | null;
  startGuide: (targetId: string, message: string) => void;
  stopGuide: () => void;
  // Map Data
  mapData: MapData;
}

const defaultStats: BmsStats = {
  branchesCount: 0,
  productsCount: 0,
  zeroStockProductsCount: 0,
  zeroStockNames: '',
  stagnantProductsCount: 0,
  hasSalesToday: false,
  hasClosingToday: false,
  crmTasksCount: 0,
  pendingOrdersCount: 0
};

const defaultMapData: MapData = {
  locations: [
    { id: 'b1', name: 'Sucursal Matriz', lat: 13.7029, lng: -89.2082, type: 'BRANCH' },
    { id: 'b2', name: 'Sucursal Puma', lat: 13.6829, lng: -89.2282, type: 'BRANCH' },
    { id: 'c1', name: 'Cliente Alfa (VIP)', lat: 13.6850, lng: -89.2250, type: 'VIP', balance: 1500 },
    { id: 'c2', name: 'Distribuidora Beta', lat: 13.6810, lng: -89.2290, type: 'VIP', balance: 3200 },
    { id: 'd1', name: 'Entrega Express A', lat: 13.6880, lng: -89.2210, type: 'DELIVERY', balance: 150 },
    { id: 'd2', name: 'Entrega Express B', lat: 13.6800, lng: -89.2300, type: 'DELIVERY', balance: 400 },
  ],
  routes: [
    { id: 'r1', status: 'ACTIVE', path: [{ lat: 13.7029, lng: -89.2082 }, { lat: 13.6850, lng: -89.2250 }] }
  ],
  densityAlert: 'Detecté 4 entregas pendientes concentradas en la zona de la sucursal Puma para esta tarde. Sugiero consolidar la carga en un solo viaje para ahorrar costos de combustible y optimizar el tiempo del conductor.'
};

const BmsContext = createContext<BmsContextType>({
  stats: defaultStats,
  tasks: [],
  loading: true,
  auditSystem: async () => {},
  processChange: () => {},
  triggerArqueoAlert: () => {},
  requestChange: () => {},
  confirmChange: () => {},
  isGuideActive: false,
  targetElementId: null,
  guideMessage: null,
  startGuide: () => {},
  stopGuide: () => {},
  mapData: defaultMapData
});

export const useBms = () => useContext(BmsContext);

export function BmsProvider({ children }: { children: ReactNode }) {
  const [stats, setStats] = useState<BmsStats>(defaultStats);
  const [loading, setLoading] = useState(true);
  const [mapData, setMapData] = useState<MapData>(defaultMapData);
  
  // Custom tasks for alerts
  const [customTasks, setCustomTasks] = useState<GuideTask[]>([]);

  // Smart Change Control State (In-Memory Simulator)
  // Smart Change Control State (In-Memory Simulator)
  const [inventoryQuarters, setInventoryQuarters] = useState(20); // $5 in coras
  const [inventoryOnes, setInventoryOnes] = useState(10); // $10 in $1 bills
  const [changeRequested, setChangeRequested] = useState(false);

  // Guide Mode State
  const [isGuideActive, setIsGuideActive] = useState(false);
  const [targetElementId, setTargetElementId] = useState<string | null>(null);
  const [guideMessage, setGuideMessage] = useState<string | null>(null);

  const startGuide = (targetId: string, message: string) => {
    setTargetElementId(targetId);
    setGuideMessage(message);
    setIsGuideActive(true);
  };

  const stopGuide = () => {
    setIsGuideActive(false);
    setTimeout(() => {
      setTargetElementId(null);
      setGuideMessage(null);
    }, 500); // Wait for transition
  };

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

      // 2.5 Precio automático: Auditar y corregir productos con precio 0 pero costo > 0 (30% margen)
      try {
        const { data: noPriceItems } = await supabase
          .from('inventory')
          .select('id, cost, price')
          .gt('cost', 0)
          .or('price.eq.0,price.is.null');

        if (noPriceItems && noPriceItems.length > 0) {
          console.log(`BMS: Encontrados ${noPriceItems.length} productos sin precio. Actualizando con margen del 30%...`);
          for (const item of noPriceItems) {
            await supabase
              .from('inventory')
              .update({ price: (item.cost * 1.3).toFixed(2) })
              .eq('id', item.id);
          }
        }
      } catch (priceErr) {
        console.error('Error auto-asignando precios:', priceErr);
      }

      // 3. Auditar stock vs punto de reorden (NexBot)
      const { data: stockData } = await supabase
        .from('inventory_stock')
        .select(`
          quantity,
          sku,
          inventory ( name, min_stock, max_stock, reorder_point )
        `);
      
      const lowStockItems = (stockData || []).filter(s => {
        const inv = s.inventory as any;
        const qty = parseFloat(s.quantity) || 0;
        const reorderPt = parseFloat(inv?.reorder_point) || 0;
        // Considera bajo stock si está igual o por debajo del punto de reorden
        return qty <= reorderPt;
      });
      const lowStockProducts = lowStockItems.length;

      let zeroStockNamesStr = '';
      let pendingOrdersCount = 0;

      if (lowStockProducts > 0) {
        const uniqueLowSkus = Array.from(new Set(lowStockItems.map(s => s.sku)));
        const names = uniqueLowSkus.map(sku => {
          const item = lowStockItems.find(s => s.sku === sku);
          const nameObj = item?.inventory as any;
          return nameObj?.name || sku;
        });
        zeroStockNamesStr = names.slice(0, 3).join(', ') + (names.length > 3 ? '...' : '');

        // AUTO-ORDER LOGIC (NEXBOT)
        try {
          const { data: pendingOrders } = await supabase
            .from('supplier_orders')
            .select('items')
            .eq('status', 'PENDIENTE');

          pendingOrdersCount = pendingOrders?.length || 0;

          const pendingSkus = new Set<string>();
          (pendingOrders || []).forEach(po => {
             if (po.items && Array.isArray(po.items)) {
               po.items.forEach((it: any) => {
                 if (it.sku) pendingSkus.add(it.sku);
               });
             }
          });

          // Solo pedimos lo que no está pendiente
          const itemsToOrder = uniqueLowSkus.filter(sku => !pendingSkus.has(sku)).map(sku => {
            const item = lowStockItems.find(s => s.sku === sku);
            const invObj = item?.inventory as any;
            
            // Sugerir cantidad basada en max_stock si está disponible
            let suggestedQty = 10;
            const maxStock = parseFloat(invObj?.max_stock) || 0;
            const currentQty = parseFloat(item?.quantity as string) || 0;
            if (maxStock > currentQty) {
              suggestedQty = maxStock - currentQty;
            }

            return {
              sku: sku,
              name: invObj?.name || sku,
              quantity: suggestedQty,
              cost: 0
            };
          });

          if (itemsToOrder.length > 0) {
            const orderCode = `NEXBOT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
            
            // Intentar buscar algún proveedor por defecto para NexBot
            const { data: defaultSupplier } = await supabase
              .from('suppliers')
              .select('name')
              .limit(1)
              .maybeSingle();

            const supplierName = defaultSupplier?.name || 'PROVEEDOR POR ASIGNAR';

            await supabase.from('supplier_orders').insert({
              code: orderCode,
              supplier_name: supplierName,
              destination_warehouse: 'CASA MATRIZ',
              requested_by: '🤖 NexBot (Auto)',
              items: itemsToOrder,
              status: 'PENDIENTE'
            });
            console.log('🤖 NexBot generó pedido automático:', orderCode);
            // Sumamos el que acabamos de crear
            pendingOrdersCount++;
          }
        } catch (botErr) {
          console.error('Error in NexBot auto-order:', botErr);
        }
      } else {
        // Aún si no hay stock bajo, revisamos si hay pedidos pendientes
        const { count } = await supabase.from('supplier_orders').select('*', { count: 'exact', head: true }).eq('status', 'PENDIENTE');
        pendingOrdersCount = count || 0;
      }

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
        zeroStockProductsCount: lowStockProducts,
        zeroStockNames: zeroStockNamesStr,
        stagnantProductsCount: stagnantCount,
        hasSalesToday: (salesToday || []).length > 0,
        hasClosingToday: (closingToday || []).length > 0,
        crmTasksCount: pendingCrmTasks,
        pendingOrdersCount: pendingOrdersCount
      });

      // 7. Mapear clientes y sucursales reales en el Mapa Logístico
      const { data: realBranches } = await supabase.from('branches').select('id, name');
      const { data: realCustomers } = await supabase.from('customers').select('id, name, credit_limit').order('created_at', { ascending: false }).limit(20);

      const newLocations: MapLocation[] = [];
      
      // Asignar sucursales reales (usamos coordenadas fijas porque la BD no las tiene aún)
      (realBranches || []).forEach((b, idx) => {
        newLocations.push({
          id: b.id,
          name: b.name,
          lat: 13.7029 - (idx * 0.02),
          lng: -89.2082 - (idx * 0.02),
          type: 'BRANCH'
        });
      });

      // Asignar clientes reales simulando su ubicación en San Salvador
      if (realCustomers) {
        realCustomers.forEach((c, idx) => {
          const lat = 13.68 + (Math.random() * 0.06 - 0.03);
          const lng = -89.22 + (Math.random() * 0.06 - 0.03);
          const type = (idx % 3 === 0) ? 'DELIVERY' : 'VIP';
          newLocations.push({
            id: c.id,
            name: c.name,
            lat,
            lng,
            type,
            balance: c.credit_limit || 0
          });
        });
      }

      setMapData({
        locations: newLocations.length > 0 ? newLocations : defaultMapData.locations,
        routes: defaultMapData.routes,
        densityAlert: defaultMapData.densityAlert
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
        title: 'Inventario Bajo Detectado',
        description: `Tienes ${stats.zeroStockProductsCount} productos bajo el punto de reorden. Prioridad: ${stats.zeroStockNames}`,
        category: 'operations',
        status: 'pending',
        actionLabel: 'Ver Inventario',
        actionPath: '/inventory'
      });
    }

    if (stats.pendingOrdersCount > 0) {
      list.push({
        id: 'ops_pending_orders',
        title: `Pedidos a Proveedor (${stats.pendingOrdersCount})`,
        description: '🤖 NexBot ha preparado pedidos automáticos por stock bajo. Por favor revísalos y autorízalos.',
        category: 'operations',
        status: 'pending',
        actionLabel: 'Ver Pedidos',
        actionPath: '/inventory'
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

    // --- ALERTA LOGÍSTICA CRM (NexBot Analytics) ---
    if (defaultMapData.densityAlert) {
      list.push({
        id: 'alert_logistics_density',
        title: '🤖 Análisis CRM: Logística',
        description: defaultMapData.densityAlert,
        category: 'opportunities',
        status: 'pending',
        actionLabel: 'Ver Mapa',
        actionPath: '/crm'
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
      processChange, triggerArqueoAlert, requestChange, confirmChange,
      isGuideActive, targetElementId, guideMessage, startGuide, stopGuide,
      mapData
    }}>
      {children}
    </BmsContext.Provider>
  );
}
