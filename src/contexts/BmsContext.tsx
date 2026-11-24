'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { supabase } from '@/supabase/client';

export const logNexbotEvent = async (modulo: string, tipo_evento: string, payload: any, descripcion: string) => {
  try {
    await supabase.from('nexbot_context_feed').insert({
      modulo,
      tipo_evento,
      payload_datos: payload,
      descripcion_natural: descripcion
    });
  } catch (error) {
    console.error('Error logging to nexbot_context_feed:', error);
  }
};
export interface CriticalProductItem {
  sku: string;
  name: string;
  currentStock: number;
  reorderPoint: number;
  suggestedOrderQty: number;
  unitCost: number;
  price: number;
  estimatedTotal: number;
  supplierName: string;
  priority: 'URGENTE' | 'ALTA' | 'MEDIA';
}

export interface StagnantProductItem {
  sku: string;
  name: string;
  stock: number;
  unitCost: number;
  price: number;
  tiedCapital: number;
}

export interface PendingOrderDetail {
  id: string;
  code: string;
  supplierName: string;
  destinationWarehouse: string;
  itemsCount: number;
  itemsPreview: string[];
  total: number;
}

export interface GuideTask {
  id: string;
  title: string;
  description: string;
  category: 'setup' | 'operations' | 'opportunities';
  status: 'pending' | 'completed' | 'info';
  priority?: 'URGENTE' | 'ALTA' | 'NORMAL';
  badgeText?: string;
  itemsPreview?: string[];
  actionLabel?: string;
  actionPath?: string;
  secondaryActionLabel?: string;
  secondaryActionPath?: string;
}

export interface BmsStats {
  branchesCount: number;
  productsCount: number;
  zeroStockProductsCount: number;
  zeroStockNames?: string;
  stagnantProductsCount: number;
  stagnantCapitalTotal?: number;
  estimatedRestockCost?: number;
  todaySalesCount?: number;
  todaySalesTotal?: number;
  hasSalesToday: boolean;
  hasClosingToday: boolean;
  crmTasksCount: number;
  pendingOrdersCount: number;
  pendingTransfersCount: number;
  inTransitTransfersCount: number;
  criticalProductsList?: CriticalProductItem[];
  stagnantProductsList?: StagnantProductItem[];
  pendingOrdersDetails?: PendingOrderDetail[];
}

export interface MapLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: 'VIP' | 'BRANCH' | 'DELIVERY';
  balance?: number;
  address?: string;
}

export interface MapWaypoint {
  order: number;
  lat: number;
  lng: number;
  name: string;
  invoiceCorrelative?: string;
  amount?: number;
  paymentMethod?: string;
  timestamp?: string;
  customerName?: string;
}

export interface MapRoute {
  id: string;
  driverName?: string;
  driverEmail?: string;
  date?: string;
  path: { lat: number; lng: number }[];
  waypoints?: MapWaypoint[];
  totalDistanceKm?: number;
  totalBilled?: number;
  status: 'ACTIVE' | 'PENDING' | 'COMPLETED';
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
  processChange: (_total: number, _paid: number) => void;
  triggerArqueoAlert: (_difference: number) => void;
  requestChange: () => void;
  confirmChange: () => void;
  // Guide Mode State
  isGuideActive: boolean;
  targetElementId: string | null;
  guideMessage: string | null;
  startGuide: (_targetId: string, _message: string) => void;
  stopGuide: () => void;
  // Map Data
  mapData: MapData;
  setMapData: React.Dispatch<React.SetStateAction<MapData>>;
}

const defaultStats: BmsStats = {
  branchesCount: 0,
  productsCount: 0,
  zeroStockProductsCount: 0,
  zeroStockNames: '',
  stagnantProductsCount: 0,
  stagnantCapitalTotal: 0,
  estimatedRestockCost: 0,
  todaySalesCount: 0,
  todaySalesTotal: 0,
  hasSalesToday: false,
  hasClosingToday: false,
  crmTasksCount: 0,
  pendingOrdersCount: 0,
  pendingTransfersCount: 0,
  inTransitTransfersCount: 0,
  criticalProductsList: [],
  stagnantProductsList: [],
  pendingOrdersDetails: []
};

const defaultMapData: MapData = {
  locations: [
    { id: 'b1', name: 'Sucursal Matriz', lat: 13.7029, lng: -89.2082, type: 'BRANCH' },
    { id: 'b2', name: 'Sucursal Norte', lat: 13.6829, lng: -89.2282, type: 'BRANCH' },
    { id: 'c1', name: 'Cliente Alfa (VIP)', lat: 13.6850, lng: -89.2250, type: 'VIP', balance: 1500 },
    { id: 'c2', name: 'Distribuidora Beta', lat: 13.6810, lng: -89.2290, type: 'VIP', balance: 3200 },
    { id: 'd1', name: 'Entrega Express A', lat: 13.6880, lng: -89.2210, type: 'DELIVERY', balance: 150 },
    { id: 'd2', name: 'Entrega Express B', lat: 13.6800, lng: -89.2300, type: 'DELIVERY', balance: 400 },
  ],
  routes: [
    { id: 'r1', status: 'ACTIVE', path: [{ lat: 13.7029, lng: -89.2082 }, { lat: 13.6850, lng: -89.2250 }] }
  ],
  densityAlert: 'Detecté varias entregas pendientes en la misma zona para esta tarde. Sugiero consolidar la carga en un solo viaje para ahorrar costos de combustible y optimizar el tiempo del conductor.'
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
  mapData: defaultMapData,
  setMapData: () => {}
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
      const todayStr = new Date().toISOString().split('T')[0];
      const limitDate = new Date();
      limitDate.setDate(limitDate.getDate() - 30);

      // Ejecutar usuario + todas las consultas de lectura del BMS EN PARALELO (en vez de 12+ secuenciales)
      const [
        authRes,
        branchesRes,
        invRes,
        stockRes,
        supRes,
        ordersRes,
        salesTodayRes,
        closingTodayRes,
        sales30dRes,
        transfersRes,
        customersRes
      ] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('branches').select('id, name'),
        supabase.from('inventory').select('sku, name, cost, price, reorder_point, min_stock, max_stock, is_service'),
        supabase.from('inventory_stock').select('sku, quantity'),
        supabase.from('suppliers').select('name').limit(1),
        supabase.from('supplier_orders').select('*').in('status', ['PENDIENTE', 'ENVIADA']).order('created_at', { ascending: false }).limit(25),
        supabase.from('sales').select('id, total').neq('status', 'CANCELADA').gte('created_at', todayStr),
        supabase.from('daily_closings').select('id').gte('date', todayStr).limit(1),
        supabase.from('sales_items').select('sku, sales!inner(created_at, status)').neq('sales.status', 'CANCELADA').gte('sales.created_at', limitDate.toISOString()).limit(500),
        supabase.from('transfers').select('status').limit(100),
        supabase.from('customers').select('id, name, credit_limit').order('created_at', { ascending: false }).limit(20)
      ]);

      const user = authRes.data?.user;
      let pendingCrmTasks = 0;
      if (user?.email) {
        const { count } = await supabase
          .from('crm_tasks')
          .select('*', { count: 'exact', head: true })
          .eq('assigned_to', user.email)
          .eq('status', 'PENDIENTE');
        pendingCrmTasks = count || 0;
      }

      const realBranches = branchesRes.data || [];
      const branchesCount = realBranches.length;
      const allInventory = invRes.data || [];
      const productsCount = allInventory.length;
      const allStockRows = stockRes.data || [];
      const fallbackSupplierName = supRes.data?.[0]?.name || 'PROVEEDOR PRINCIPAL';
      const pendingOrdersRaw = ordersRes.data || [];
      const salesToday = salesTodayRes.data || [];
      const closingToday = closingTodayRes.data || [];
      const sales30d = sales30dRes.data || [];
      const realCustomers = customersRes.data || [];

      // Consolidar existencias por SKU
      const skuStockMap: Record<string, number> = {};
      allStockRows.forEach((st: any) => {
        if (!st?.sku) return;
        skuStockMap[st.sku] = (skuStockMap[st.sku] || 0) + (parseFloat(st.quantity) || 0);
      });

      // Identificar SKUs que ya están en una orden activa (PENDIENTE o ENVIADA) para no pedirlos dos veces
      const skusAlreadyOrdered = new Set<string>();
      (ordersRes.data || []).forEach((po: any) => {
        if (Array.isArray(po?.items)) {
          po.items.forEach((it: any) => {
            if (it?.sku) skusAlreadyOrdered.add(String(it.sku).trim().toUpperCase());
          });
        }
      });

      // Construir lista detallada de productos críticos / por pedir
      const criticalProductsList: CriticalProductItem[] = [];
      allInventory.forEach((prod: any) => {
        if (!prod?.sku || prod.is_service) return;
        const skuUpper = String(prod.sku).trim().toUpperCase();
        if (skusAlreadyOrdered.has(skuUpper)) return;

        const currentStock = skuStockMap[prod.sku] ?? 0;
        const explicitReorder = Math.max(parseFloat(prod.reorder_point) || 0, parseFloat(prod.min_stock) || 0);
        // Si el producto no tiene mínimo configurado, solo pedir cuando esté realmente en 0 (agotado)
        const effectiveThreshold = explicitReorder > 0 ? explicitReorder : 0;

        if (currentStock <= effectiveThreshold) {
          const maxStock = parseFloat(prod.max_stock) || 0;
          const suggestedOrderQty = maxStock > currentStock ? (maxStock - currentStock) : Math.max(6, ((explicitReorder || 2) * 3) - currentStock);
          const unitCost = parseFloat(prod.cost) > 0
            ? parseFloat(prod.cost)
            : parseFloat(((parseFloat(prod.price) || 10) * 0.65).toFixed(2));
          const estimatedTotal = parseFloat((suggestedOrderQty * unitCost).toFixed(2));
          const priority: 'URGENTE' | 'ALTA' | 'MEDIA' =
            currentStock <= 0 ? 'URGENTE' : currentStock <= 1 ? 'ALTA' : 'MEDIA';

          criticalProductsList.push({
            sku: prod.sku,
            name: prod.name || prod.sku,
            currentStock,
            reorderPoint: effectiveThreshold,
            suggestedOrderQty,
            unitCost,
            price: parseFloat(prod.price) || 0,
            estimatedTotal,
            supplierName: fallbackSupplierName,
            priority
          });
        }
      });

      // Ordenar primero los agotados (0 stock) y de mayor prioridad
      criticalProductsList.sort((a, b) => a.currentStock - b.currentStock);

      const lowStockProducts = criticalProductsList.length;
      const estimatedRestockCost = criticalProductsList.reduce((acc, it) => acc + it.estimatedTotal, 0);
      const zeroStockNamesStr = criticalProductsList
        .slice(0, 4)
        .map(it => `[${it.sku}] ${it.name} (Stock: ${it.currentStock}, Pedir: +${it.suggestedOrderQty})`)
        .join(' • ');

      // Procesar órdenes pendientes a proveedor (solo las que siguen PENDIENTE de solicitar/autorizar)
      const onlyPendingOrders = pendingOrdersRaw.filter((po: any) => (po.status || '').toUpperCase() === 'PENDIENTE');
      const pendingOrdersDetails: PendingOrderDetail[] = onlyPendingOrders.map((po: any) => {
        const itemsArr = Array.isArray(po.items) ? po.items : [];
        const calcTotal = parseFloat(po.total) > 0
          ? parseFloat(po.total)
          : itemsArr.reduce((sum: number, it: any) => sum + ((parseFloat(it.quantity) || 1) * (parseFloat(it.cost) || parseFloat(it.price) || 12)), 0);
        return {
          id: po.id,
          code: po.code || 'ORD-PEND',
          supplierName: po.supplier_name || fallbackSupplierName,
          destinationWarehouse: po.destination_warehouse || 'CASA MATRIZ',
          itemsCount: itemsArr.length,
          itemsPreview: itemsArr.slice(0, 4).map((it: any) => `[${it.sku}] ${it.name || it.sku} (${it.quantity || 1} uds)`),
          total: parseFloat(calcTotal.toFixed(2))
        };
      });

      let pendingOrdersCount = pendingOrdersDetails.length;

      const todaySalesCount = salesToday.length;
      const todaySalesTotal = salesToday.reduce((acc, s: any) => acc + (parseFloat(s.total) || 0), 0);

      const soldSkuSet = new Set<string>();
      sales30d.forEach((row: any) => {
        if (row?.sku) soldSkuSet.add(row.sku);
      });

      const stagnantProductsList: StagnantProductItem[] = [];
      allInventory.forEach((p: any) => {
        if (!p?.sku) return;
        const stockVal = skuStockMap[p.sku] || 0;
        if (stockVal >= 1 && !soldSkuSet.has(p.sku)) {
          const unitPrice = parseFloat(p.price) || 0;
          const unitCost = parseFloat(p.cost) || parseFloat((unitPrice * 0.65).toFixed(2));
          const tiedCapital = parseFloat((stockVal * (unitPrice || unitCost || 15)).toFixed(2));
          stagnantProductsList.push({
            sku: p.sku,
            name: p.name || p.sku,
            stock: stockVal,
            unitCost,
            price: unitPrice,
            tiedCapital
          });
        }
      });

      stagnantProductsList.sort((a, b) => b.tiedCapital - a.tiedCapital);
      const stagnantCount = stagnantProductsList.length;
      const stagnantCapitalTotal = stagnantProductsList.reduce((acc, it) => acc + it.tiedCapital, 0);

      // 6.5 Auditar traslados (usando tabla transfers + respaldo local)
      let pendingTransfers = 0;
      let inTransitTransfers = 0;
      try {
        const trData = transfersRes?.data;
        if (trData && trData.length > 0) {
          pendingTransfers = trData.filter((t: any) => t.status === 'PETICION' || t.status === 'SOLICITADO' || t.status === 'EN_PICKING').length;
          inTransitTransfers = trData.filter((t: any) => t.status === 'ENVIADO' || t.status === 'DESPACHADO').length;
        } else if (typeof window !== 'undefined') {
          const localTr = localStorage.getItem('nexway_circuit_transfers');
          if (localTr) {
            const parsed = JSON.parse(localTr);
            pendingTransfers = (parsed || []).filter((t: any) => t.estado === 'SOLICITADO' || t.estado === 'EN_PICKING').length;
            inTransitTransfers = (parsed || []).filter((t: any) => t.estado === 'DESPACHADO').length;
          }
        }
      } catch {}

      setStats({
        branchesCount: branchesCount || 0,
        productsCount: productsCount || allInventory.length,
        zeroStockProductsCount: lowStockProducts,
        zeroStockNames: zeroStockNamesStr,
        stagnantProductsCount: stagnantCount,
        stagnantCapitalTotal: parseFloat(stagnantCapitalTotal.toFixed(2)),
        estimatedRestockCost: parseFloat(estimatedRestockCost.toFixed(2)),
        todaySalesCount,
        todaySalesTotal: parseFloat(todaySalesTotal.toFixed(2)),
        hasSalesToday: todaySalesCount > 0,
        hasClosingToday: closingToday.length > 0,
        crmTasksCount: pendingCrmTasks,
        pendingOrdersCount: pendingOrdersCount,
        pendingTransfersCount: pendingTransfers,
        inTransitTransfersCount: inTransitTransfers,
        criticalProductsList,
        stagnantProductsList,
        pendingOrdersDetails
      });

      // 7. Mapear clientes y sucursales reales (ya cargados en paralelo)
      const newLocations: MapLocation[] = [];
      (realBranches || []).forEach((b, idx) => {
        newLocations.push({
          id: b.id,
          name: b.name,
          lat: 13.7029 - (idx * 0.02),
          lng: -89.2082 - (idx * 0.02),
          type: 'BRANCH'
        });
      });

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
    auditSystem();
    const interval = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        auditSystem();
      }
    }, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Generar tareas y pasos lógicos dinámicos basados en la auditoría (El motor del BMS)
  const tasks = useMemo<GuideTask[]>(() => {
    const list: GuideTask[] = [];

    // --- CATEGORÍA 1: ABASTECIMIENTO & PRODUCTOS POR PEDIR (SETUP / STOCK) ---
    if ((stats.criticalProductsList || []).length > 0) {
      const critList = stats.criticalProductsList || [];
      const urgentCount = critList.filter(c => c.currentStock <= 0).length;
      list.push({
        id: 'setup_critical_restock',
        title: `Productos por Pedir (${critList.length} SKUs)`,
        description: `Se detectaron ${critList.length} productos en nivel crítico (${urgentCount} agotados). Reposición estimada: $${(stats.estimatedRestockCost || 0).toFixed(2)}.`,
        category: 'setup',
        status: 'pending',
        priority: urgentCount > 0 ? 'URGENTE' : 'ALTA',
        badgeText: urgentCount > 0 ? `${urgentCount} EN CERO` : 'REORDEN',
        itemsPreview: critList.slice(0, 5).map(
          c => `[${c.sku}] ${c.name} • Stock: ${c.currentStock} ➔ Pedir: +${c.suggestedOrderQty} uds ($${c.estimatedTotal.toFixed(2)})`
        ),
        actionLabel: 'Generar Pedido a Proveedor',
        actionPath: '/compras?tab=ordenes',
        secondaryActionLabel: 'Solicitar Traslado',
        secondaryActionPath: '/logistica?tab=traslados'
      });
    }

    if (stats.branchesCount === 0) {
      list.push({
        id: 'setup_branch',
        title: 'Registrar Primera Sucursal',
        description: 'No se detectan sucursales activas en el sistema. Es obligatorio tener al menos una.',
        category: 'setup',
        status: 'pending',
        priority: 'URGENTE',
        actionLabel: 'Ir a Gerencia',
        actionPath: '/management?tab=sucursales'
      });
    } else {
      list.push({
        id: 'setup_branch_done',
        title: 'Sucursales y Catálogo Activos',
        description: `Operando con ${stats.branchesCount} sucursal(es) y ${stats.productsCount} producto(s) registrados en catálogo maestro.`,
        category: 'setup',
        status: 'completed',
        actionLabel: 'Ver Catálogo',
        actionPath: '/logistica?tab=inventario'
      });
    }

    // --- CATEGORÍA 2: OPERACIONES DIARIAS, PEDIDOS Y CAJA ---
    if (stats.pendingOrdersCount > 0) {
      const ordersDetails = stats.pendingOrdersDetails || [];
      const totalOrdersValue = ordersDetails.reduce((s, o) => s + o.total, 0);
      list.push({
        id: 'ops_pending_orders',
        title: `Órdenes de Compra por Autorizar (${stats.pendingOrdersCount})`,
        description: `NexBot preparó ${stats.pendingOrdersCount} orden(es) de abastecimiento para proveedor por un valor estimado de $${totalOrdersValue.toFixed(2)}.`,
        category: 'operations',
        status: 'pending',
        priority: 'ALTA',
        badgeText: `$${totalOrdersValue.toFixed(2)}`,
        itemsPreview: ordersDetails.slice(0, 3).flatMap(o => [
          `📄 ${o.code} — ${o.supplierName} (${o.itemsCount} ítems • $${o.total.toFixed(2)})`,
          ...o.itemsPreview.slice(0, 2).map(it => `   ↳ ${it}`)
        ]),
        actionLabel: 'Revisar y Autorizar Pedidos',
        actionPath: '/compras?tab=ordenes',
        secondaryActionLabel: 'Registrar Compra DTE',
        secondaryActionPath: '/compras?tab=registro'
      });
    }

    if (stats.pendingTransfersCount > 0) {
      list.push({
        id: 'ops_pending_transfers',
        title: `📦 Requisiciones de Traslado Pendientes (${stats.pendingTransfersCount})`,
        description: 'Solicitudes de reabastecimiento entre bodegas en espera de picking y despacho.',
        category: 'operations',
        status: 'pending',
        priority: 'ALTA',
        actionLabel: 'Ir a Mesa de Despacho',
        actionPath: '/logistica?tab=traslados'
      });
    }

    if (stats.inTransitTransfersCount > 0) {
      list.push({
        id: 'ops_intransit_transfers',
        title: `🚚 Mercadería en Tránsito (${stats.inTransitTransfersCount})`,
        description: 'Traslados despachados esperando confirmación de recepción física en bodega destino.',
        category: 'operations',
        status: 'pending',
        priority: 'URGENTE',
        actionLabel: 'Confirmar Recepción',
        actionPath: '/logistica?tab=traslados'
      });
    }

    if (!stats.hasSalesToday) {
      list.push({
        id: 'ops_first_sale',
        title: 'Terminal POS Lista — Sin Ventas Hoy',
        description: 'La jornada está abierta pero aún no se han emitido facturas DTE (CF/CCF) en el turno actual.',
        category: 'operations',
        status: 'info',
        priority: 'NORMAL',
        badgeText: '$0.00 HOY',
        actionLabel: 'Abrir Punto de Venta (POS)',
        actionPath: '/billing',
        secondaryActionLabel: 'Ver Cotizaciones',
        secondaryActionPath: '/crm'
      });
    } else {
      list.push({
        id: 'ops_sale_done',
        title: `Ventas del Día Activas (${stats.todaySalesCount} DTE)`,
        description: `Facturación acumulada hoy: $${(stats.todaySalesTotal || 0).toFixed(2)}.`,
        category: 'operations',
        status: 'completed',
        badgeText: `$${(stats.todaySalesTotal || 0).toFixed(2)}`,
        actionLabel: 'Ir a Facturación',
        actionPath: '/billing'
      });
    }

    if (stats.hasSalesToday && !stats.hasClosingToday) {
      list.push({
        id: 'ops_pending_closing',
        title: 'Arqueo y Cierre de Turno Pendiente',
        description: `Se registran ${stats.todaySalesCount} venta(s) por $${(stats.todaySalesTotal || 0).toFixed(2)} sin cierre de caja formalizado hoy.`,
        category: 'operations',
        status: 'pending',
        priority: 'ALTA',
        actionLabel: 'Ejecutar Arqueo de Caja',
        actionPath: '/billing',
        secondaryActionLabel: 'Auditoría Contable',
        secondaryActionPath: '/accounting'
      });
    }

    if (stats.crmTasksCount > 0) {
      list.push({
        id: 'ops_crm_tasks',
        title: `Seguimientos Comerciales CRM (${stats.crmTasksCount})`,
        description: `Tienes ${stats.crmTasksCount} gestión(es) de clientes pendientes de contacto hoy.`,
        category: 'operations',
        status: 'pending',
        priority: 'ALTA',
        actionLabel: 'Abrir Embudo CRM',
        actionPath: '/crm'
      });
    }

    // --- CATEGORÍA 3: OPORTUNIDADES COMERCIALES & ROTACIÓN DE CAPITAL ---
    if (stats.stagnantProductsCount > 0) {
      const stagList = stats.stagnantProductsList || [];
      list.push({
        id: 'opp_stagnant',
        title: `Priorizar Rotación de Stock Estancado (${stats.stagnantProductsCount} SKUs)`,
        description: `Capital inmovilizado sin ventas en 30 días: $${(stats.stagnantCapitalTotal || 0).toFixed(2)}. Impulsa su salida en sala de ventas o crea combos.`,
        category: 'opportunities',
        status: 'pending',
        priority: 'ALTA',
        badgeText: `$${(stats.stagnantCapitalTotal || 0).toFixed(2)} RETENIDO`,
        itemsPreview: stagList.slice(0, 5).map(
          s => `[${s.sku}] ${s.name} • ${s.stock} uds estancadas (Valor: $${s.tiedCapital.toFixed(2)})`
        ),
        actionLabel: 'Dar Prioridad en Foco de Venta',
        actionPath: '/crm',
        secondaryActionLabel: 'Ajustar Precio / Promo',
        secondaryActionPath: '/logistica?tab=inventario'
      });
    }

    // --- ALERTA DE SENCILLO (BMS SMART CHANGE) ---
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
      mapData, setMapData
    }}>
      {children}
    </BmsContext.Provider>
  );
}
