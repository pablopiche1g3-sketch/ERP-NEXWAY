'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  ArrowLeftRight, 
  Search, 
  Plus, 
  Trash2, 
  Warehouse, 
  Truck, 
  History, 
  Package, 
  CheckCircle2, 
  Loader2,
  MapPin,
  ArrowRight,
  ClipboardList,
  User,
  ShieldCheck,
  AlertTriangle,
  FileText,
  Boxes,
  RefreshCw,
  Send,
  Eye,
  Check,
  Zap,
  ShoppingCart,
  DollarSign,
  TrendingDown,
  Printer,
  ChevronRight,
  Building2,
  Filter
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/supabase/use-user';
import { fetchSystemAppUsers } from '@/lib/session-operator';

export interface TransferCircuitItem {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  cost?: number;
  picked?: boolean;
  receivedQty?: number;
}

export interface TransferCircuitRecord {
  id: string;
  correlativo: string;
  origen_id: string;
  origen_nombre: string;
  destino_id: string;
  destino_nombre: string;
  tipo: 'INTERNO' | 'INTERTIENDA';
  estado: 'SOLICITADO' | 'EN_PICKING' | 'DESPACHADO' | 'RECIBIDO' | 'CANCELADO';
  solicitado_por: string;
  despachado_por?: string;
  recibido_por?: string;
  transportista?: string;
  vehiculo_placa?: string;
  observaciones?: string;
  items: TransferCircuitItem[];
  created_at: string;
  despachado_at?: string;
  recibido_at?: string;
}

export interface ReplenishmentSuggestion {
  sku: string;
  producto_nombre: string;
  sucursal_id: string;
  sucursal_nombre: string;
  stock_actual: number;
  stock_reservado: number;
  stock_minimo: number;
  punto_reorden: number;
  stock_maximo: number;
  cantidad_sugerida: number;
  costo_unitario: number;
  total_estimado: number;
  proveedor_nombre: string;
}

export default function TransfersTab() {
  const { toast } = useToast();
  const { user } = useUser();

  const [activeTab, setActiveTab] = useState<'solicitud' | 'despacho' | 'recepcion' | 'reabastecimiento' | 'historial'>('solicitud');
  const [loading, setLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Datos Generales
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [stockMap, setStockMap] = useState<Record<string, number>>({}); // sku::warehouse_id -> qty
  const [transfers, setTransfers] = useState<TransferCircuitRecord[]>([]);
  const [operatorName, setOperatorName] = useState<string>('');

  // Formulario de Solicitud de Traslado
  const [sourceWarehouseId, setSourceWarehouseId] = useState<string>('');
  const [destinationWarehouseId, setDestinationWarehouseId] = useState<string>('');
  const [transferType, setTransferType] = useState<'INTERNO' | 'INTERTIENDA'>('INTERNO');
  const [productSearch, setProductSearch] = useState<string>('');
  const [cart, setCart] = useState<TransferCircuitItem[]>([]);
  const [notes, setNotes] = useState<string>('');

  // Modal de Picking / Despacho Guiado
  const [selectedTransferForDispatch, setSelectedTransferForDispatch] = useState<TransferCircuitRecord | null>(null);
  const [dispatchDriver, setDispatchDriver] = useState<string>('');
  const [dispatchPlaca, setDispatchPlaca] = useState<string>('');
  const [pickingChecklist, setPickingChecklist] = useState<Record<string, boolean>>({});

  // Modal de Detalle / Guía de Remisión
  const [viewingTransfer, setViewingTransfer] = useState<TransferCircuitRecord | null>(null);

  // Filtros de Historial
  const [historyFilterState, setHistoryFilterState] = useState<string>('ALL');
  const [historySearchTerm, setHistorySearchTerm] = useState<string>('');

  useEffect(() => {
    loadData();
    resolveActiveOperator();
  }, []);

  const resolveActiveOperator = async () => {
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('nexway_session_operator') : null;
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.full_name || parsed?.name || parsed?.email) {
          setOperatorName(parsed.full_name || parsed.name || parsed.email);
          return;
        }
      }
      const appUsers = await fetchSystemAppUsers();
      if (user?.email) {
        const matched = appUsers.find(u => u.email?.toLowerCase() === user.email?.toLowerCase());
        if (matched?.full_name) {
          setOperatorName(matched.full_name);
          return;
        }
        setOperatorName(user.email);
      }
    } catch (e) {
      if (user?.email) setOperatorName(user.email);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Cargar Bodegas
      let whList: any[] = [];
      try {
        const { data: whs } = await supabase.from('warehouses').select('*').order('name');
        if (whs && whs.length > 0) whList = whs;
      } catch (e) {}

      if (whList.length === 0) {
        whList = [
          { id: 'wh-central', name: 'Bodega Central (Matriz)', branch_id: 'b-matriz' },
          { id: 'wh-tienda-1', name: 'Sucursal Escalón (Tienda)', branch_id: 'b-esca' },
          { id: 'wh-tienda-2', name: 'Sucursal Santa Tecla', branch_id: 'b-tecla' }
        ];
      }
      setWarehouses(whList);
      if (whList.length >= 2) {
        if (!sourceWarehouseId) setSourceWarehouseId(whList[0].id);
        if (!destinationWarehouseId) setDestinationWarehouseId(whList[1].id);
      }

      // 2. Cargar Inventario
      let invList: any[] = [];
      try {
        const { data: invData } = await supabase.from('inventory').select('*').order('name');
        if (invData && invData.length > 0) invList = invData;
      } catch (e) {}

      if (invList.length === 0 && typeof window !== 'undefined') {
        const local = localStorage.getItem('nexway_inventory');
        if (local) invList = JSON.parse(local);
      }
      setProducts(invList);

      // 3. Cargar Stock por Bodega
      const stockKeyMap: Record<string, number> = {};
      try {
        const { data: stockData } = await supabase.from('inventory_stock').select('sku, warehouse_id, quantity');
        if (stockData && stockData.length > 0) {
          stockData.forEach(s => {
            stockKeyMap[`${s.sku}::${s.warehouse_id}`] = parseFloat(s.quantity) || 0;
          });
        }
      } catch (e) {}
      setStockMap(stockKeyMap);

      // 4. Cargar Traslados de Circuito
      try {
        const { data: trData } = await supabase
          .from('traslados_circuito')
          .select('*')
          .order('created_at', { ascending: false });

        if (trData && trData.length > 0) {
          setTransfers(trData);
        } else if (typeof window !== 'undefined') {
          const localTr = localStorage.getItem('nexway_circuit_transfers');
          if (localTr) setTransfers(JSON.parse(localTr));
        }
      } catch (e) {
        if (typeof window !== 'undefined') {
          const localTr = localStorage.getItem('nexway_circuit_transfers');
          if (localTr) setTransfers(JSON.parse(localTr));
        }
      }

    } catch (err: any) {
      console.error('Error cargando datos de traslados:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStockInWarehouse = (sku: string, whId: string): number => {
    if (!sku || !whId) return 0;
    const key = `${sku}::${whId}`;
    if (stockMap[key] !== undefined) return stockMap[key];
    const prod = products.find(p => p.sku === sku);
    return prod ? Number(prod.quantity ?? prod.stock ?? 0) : 0;
  };

  // Agregar ítem al carrito de solicitud
  const handleAddToCart = (product: any) => {
    const existing = cart.find(i => i.sku === product.sku);
    const available = getStockInWarehouse(product.sku, sourceWarehouseId);

    if (available <= 0) {
      toast({
        variant: 'destructive',
        title: 'Sin Stock en Origen',
        description: `No hay existencias de ${product.name} en la bodega origen.`
      });
      return;
    }

    if (existing) {
      if (existing.quantity + 1 > available) {
        toast({
          variant: 'destructive',
          title: 'Límite de Stock',
          description: `Solo hay ${available} unidades disponibles en la bodega origen.`
        });
        return;
      }
      setCart(cart.map(i => i.sku === product.sku ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setCart([...cart, {
        id: `item-${Date.now()}-${product.sku}`,
        sku: product.sku,
        name: product.name || product.description || product.sku,
        quantity: 1,
        cost: product.cost || 0
      }]);
    }
  };

  const handleUpdateCartQuantity = (sku: string, newQty: number) => {
    const available = getStockInWarehouse(sku, sourceWarehouseId);
    if (newQty <= 0) {
      setCart(cart.filter(i => i.sku !== sku));
      return;
    }
    if (newQty > available) {
      toast({
        variant: 'destructive',
        title: 'Exceso de Cantidad',
        description: `La cantidad solicitada supera el stock disponible (${available}).`
      });
      return;
    }
    setCart(cart.map(i => i.sku === sku ? { ...i, quantity: newQty } : i));
  };

  // Crear Solicitud de Traslado
  const handleCreateTransferRequest = async () => {
    if (cart.length === 0) {
      toast({ variant: 'destructive', title: 'Carrito Vacío', description: 'Agrega al menos un producto a transferir.' });
      return;
    }
    if (sourceWarehouseId === destinationWarehouseId) {
      toast({ variant: 'destructive', title: 'Bodegas Inválidas', description: 'La bodega de origen y destino no pueden ser iguales.' });
      return;
    }

    setIsProcessing(true);
    const correlativo = `TRA-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
    const sourceWh = warehouses.find(w => w.id === sourceWarehouseId);
    const destWh = warehouses.find(w => w.id === destinationWarehouseId);

    const newTransfer: TransferCircuitRecord = {
      id: `TR-${Date.now()}`,
      correlativo,
      origen_id: sourceWarehouseId,
      origen_nombre: sourceWh?.name || 'Bodega Origen',
      destino_id: destinationWarehouseId,
      destino_nombre: destWh?.name || 'Bodega Destino',
      tipo: transferType,
      estado: 'SOLICITADO',
      solicitado_por: operatorName || user?.email || 'Operador',
      observaciones: notes,
      items: cart,
      created_at: new Date().toISOString()
    };

    try {
      // Guardar en Supabase
      try {
        await supabase.from('traslados_circuito').insert({
          id: newTransfer.id,
          correlativo: newTransfer.correlativo,
          origen_id: newTransfer.origen_id,
          origen_nombre: newTransfer.origen_nombre,
          destino_id: newTransfer.destino_id,
          destino_nombre: newTransfer.destino_nombre,
          tipo: newTransfer.tipo,
          estado: 'SOLICITADO',
          solicitado_por: newTransfer.solicitado_por,
          observaciones: newTransfer.observaciones,
          total_items: cart.reduce((sum, i) => sum + i.quantity, 0),
          items: newTransfer.items,
          created_at: newTransfer.created_at
        });
      } catch (dbErr) {
        console.warn('Fallback local para traslados:', dbErr);
      }

      // Guardar en memoria y localStorage
      const updated = [newTransfer, ...transfers];
      setTransfers(updated);
      if (typeof window !== 'undefined') {
        localStorage.setItem('nexway_circuit_transfers', JSON.stringify(updated));
      }

      toast({
        title: 'Solicitud Creada con Éxito',
        description: `Se generó la solicitud [${correlativo}] pendiente de picking en bodega.`
      });

      setCart([]);
      setNotes('');
      setActiveTab('despacho'); // Pasar a mesa de despacho
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error al solicitar', description: err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  // Abrir modal de Picking / Despacho
  const handleOpenDispatchModal = (transfer: TransferCircuitRecord) => {
    setSelectedTransferForDispatch(transfer);
    setDispatchDriver(transfer.transportista || '');
    setDispatchPlaca(transfer.vehiculo_placa || '');
    const checklist: Record<string, boolean> = {};
    transfer.items.forEach(i => {
      checklist[i.sku] = false;
    });
    setPickingChecklist(checklist);
  };

  // Confirmar Despacho Físico (Bodeguero)
  const handleConfirmDispatch = async () => {
    if (!selectedTransferForDispatch) return;
    const allPicked = selectedTransferForDispatch.items.every(i => pickingChecklist[i.sku]);
    if (!allPicked) {
      toast({
        variant: 'destructive',
        title: 'Picking Incompleto',
        description: 'Debes marcar como verificado cada producto antes de autorizar el despacho.'
      });
      return;
    }

    setIsProcessing(true);
    try {
      // 1. Descontar stock de origen en inventory_stock y Kardex
      for (const it of selectedTransferForDispatch.items) {
        const currentWhStock = getStockInWarehouse(it.sku, selectedTransferForDispatch.origen_id);
        const newWhStock = Math.max(0, currentWhStock - it.quantity);

        try {
          await supabase.from('inventory_stock').upsert({
            sku: it.sku,
            warehouse_id: selectedTransferForDispatch.origen_id,
            quantity: newWhStock
          }, { onConflict: 'sku,warehouse_id' });

          await supabase.from('kardex').insert({
            sku: it.sku,
            movement_type: 'TRASLADO_SALIDA',
            location: selectedTransferForDispatch.origen_nombre,
            document_ref: selectedTransferForDispatch.correlativo,
            qty_in: 0,
            qty_out: it.quantity,
            balance: newWhStock,
            unit_cost: it.cost || 0
          });
        } catch (e) {}
      }

      // 2. Actualizar estado del traslado
      const updatedTransfer: TransferCircuitRecord = {
        ...selectedTransferForDispatch,
        estado: 'DESPACHADO',
        despachado_por: operatorName || user?.email || 'Bodeguero',
        transportista: dispatchDriver,
        vehiculo_placa: dispatchPlaca,
        despachado_at: new Date().toISOString()
      };

      try {
        await supabase
          .from('traslados_circuito')
          .update({
            estado: 'DESPACHADO',
            despachado_por: updatedTransfer.despachado_por,
            transportista: dispatchDriver,
            vehiculo_placa: dispatchPlaca,
            despachado_at: updatedTransfer.despachado_at,
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedTransferForDispatch.id);
      } catch (e) {}

      const updated = transfers.map(t => t.id === selectedTransferForDispatch.id ? updatedTransfer : t);
      setTransfers(updated);
      if (typeof window !== 'undefined') {
        localStorage.setItem('nexway_circuit_transfers', JSON.stringify(updated));
      }

      toast({
        title: 'Despacho Autorizado',
        description: `El traslado [${selectedTransferForDispatch.correlativo}] ahora está EN TRÁNSITO hacia ${selectedTransferForDispatch.destino_nombre}.`
      });

      setSelectedTransferForDispatch(null);
      loadData();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error al despachar', description: err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  // Confirmar Recepción en Destino
  const handleConfirmReception = async (transfer: TransferCircuitRecord) => {
    setIsProcessing(true);
    try {
      // 1. Cargar stock en destino en inventory_stock y Kardex
      for (const it of transfer.items) {
        const currentDestStock = getStockInWarehouse(it.sku, transfer.destino_id);
        const newDestStock = currentDestStock + it.quantity;

        try {
          await supabase.from('inventory_stock').upsert({
            sku: it.sku,
            warehouse_id: transfer.destino_id,
            quantity: newDestStock
          }, { onConflict: 'sku,warehouse_id' });

          await supabase.from('kardex').insert({
            sku: it.sku,
            movement_type: 'TRASLADO_ENTRADA',
            location: transfer.destino_nombre,
            document_ref: transfer.correlativo,
            qty_in: it.quantity,
            qty_out: 0,
            balance: newDestStock,
            unit_cost: it.cost || 0
          });
        } catch (e) {}
      }

      // 2. Actualizar estado a RECIBIDO
      const updatedTransfer: TransferCircuitRecord = {
        ...transfer,
        estado: 'RECIBIDO',
        recibido_por: operatorName || user?.email || 'Encargado de Tienda',
        recibido_at: new Date().toISOString()
      };

      try {
        await supabase
          .from('traslados_circuito')
          .update({
            estado: 'RECIBIDO',
            recibido_por: updatedTransfer.recibido_por,
            recibido_at: updatedTransfer.recibido_at,
            updated_at: new Date().toISOString()
          })
          .eq('id', transfer.id);
      } catch (e) {}

      const updated = transfers.map(t => t.id === transfer.id ? updatedTransfer : t);
      setTransfers(updated);
      if (typeof window !== 'undefined') {
        localStorage.setItem('nexway_circuit_transfers', JSON.stringify(updated));
      }

      toast({
        title: 'Mercancía Recibida e Ingresada',
        description: `Se ingresaron ${transfer.items.reduce((s, i) => s + i.quantity, 0)} unidades al stock de ${transfer.destino_nombre}.`
      });

      loadData();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error al recibir', description: err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  // Cálculo de Reabastecimiento Automático (Punto de Reorden)
  const replenishmentSuggestions: ReplenishmentSuggestion[] = useMemo(() => {
    const list: ReplenishmentSuggestion[] = [];

    products.forEach(p => {
      warehouses.forEach(w => {
        const stockActual = getStockInWarehouse(p.sku, w.id);
        const minStock = Number(p.min_stock || 5);
        const reorderPoint = Number(p.reorder_point || minStock * 2 || 10);
        const maxStock = Number(p.max_stock || reorderPoint * 3 || 30);

        if (stockActual <= reorderPoint) {
          const qtySugerida = Math.max(1, maxStock - stockActual);
          const costUni = Number(p.cost || 0);

          list.push({
            sku: p.sku,
            producto_nombre: p.name || p.sku,
            sucursal_id: w.id,
            sucursal_nombre: w.name,
            stock_actual: stockActual,
            stock_reservado: 0,
            stock_minimo: minStock,
            punto_reorden: reorderPoint,
            stock_maximo: maxStock,
            cantidad_sugerida: qtySugerida,
            costo_unitario: costUni,
            total_estimado: qtySugerida * costUni,
            proveedor_nombre: p.brand || p.category || 'PROVEEDOR PRINCIPAL'
          });
        }
      });
    });

    return list;
  }, [products, warehouses, stockMap]);

  // Filtrado de productos para la solicitud
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const search = productSearch.toLowerCase();
      return (
        p.sku.toLowerCase().includes(search) ||
        (p.name && p.name.toLowerCase().includes(search)) ||
        (p.category && p.category.toLowerCase().includes(search))
      );
    });
  }, [products, productSearch]);

  // Filtrado de historial
  const filteredHistory = useMemo(() => {
    return transfers.filter(t => {
      const matchState = historyFilterState === 'ALL' || t.estado === historyFilterState;
      const search = historySearchTerm.toLowerCase();
      const matchSearch = !search ||
        t.correlativo.toLowerCase().includes(search) ||
        t.origen_nombre.toLowerCase().includes(search) ||
        t.destino_nombre.toLowerCase().includes(search) ||
        t.solicitado_por.toLowerCase().includes(search) ||
        t.items.some(i => i.name.toLowerCase().includes(search) || i.sku.toLowerCase().includes(search));
      return matchState && matchSearch;
    });
  }, [transfers, historyFilterState, historySearchTerm]);

  // Solicitudes pendientes de despacho
  const pendingDispatchTransfers = useMemo(() => {
    return transfers.filter(t => t.estado === 'SOLICITADO' || t.estado === 'EN_PICKING');
  }, [transfers]);

  // Traslados en tránsito pendientes de recepción
  const inTransitTransfers = useMemo(() => {
    return transfers.filter(t => t.estado === 'DESPACHADO');
  }, [transfers]);

  return (
    <div className="space-y-6">
      
      {/* Encabezado Principal */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-indigo-500" />
            Circuito Integrado de Traslados & Despacho
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Flujo guiado: Solicitud de tienda → Picking en bodega → Despacho con remisión → Recepción y Reabastecimiento.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={loadData} 
            disabled={loading}
            className="h-8 text-xs gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>

          <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full sm:w-auto">
            <TabsList className="grid grid-cols-5 w-full sm:w-auto">
              <TabsTrigger value="solicitud" className="text-xs gap-1">
                <ClipboardList className="h-3.5 w-3.5" /> 1. Solicitud
              </TabsTrigger>
              <TabsTrigger value="despacho" className="text-xs gap-1 relative">
                <Truck className="h-3.5 w-3.5" /> 2. Despacho
                {pendingDispatchTransfers.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[9px] font-bold">
                    {pendingDispatchTransfers.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="recepcion" className="text-xs gap-1 relative">
                <Package className="h-3.5 w-3.5" /> 3. Recepción
                {inTransitTransfers.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full bg-indigo-500 text-white text-[9px] font-bold">
                    {inTransitTransfers.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="reabastecimiento" className="text-xs gap-1 relative">
                <Zap className="h-3.5 w-3.5 text-amber-400" /> 4. Reabastecer
                {replenishmentSuggestions.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-bold">
                    {replenishmentSuggestions.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="historial" className="text-xs gap-1">
                <History className="h-3.5 w-3.5" /> 5. Historial
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* 1. SUBPESTAÑA: SOLICITUD DE TRASLADO */}
      {activeTab === 'solicitud' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Panel Izquierdo: Catálogo y Buscador */}
          <div className="lg:col-span-7 space-y-4">
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-3 border-b border-border/40">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Boxes className="h-4 w-4 text-indigo-400" /> Catálogo de Productos Disponibles en Origen
                  </span>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    Bodega Origen Activa
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  Haz clic en (+) para agregar productos al pedido de traslado.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="relative">
                  <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input 
                    value={productSearch}
                    onChange={e => setProductSearch(e.target.value)}
                    placeholder="Buscar producto por SKU, nombre o categoría..."
                    className="h-8 pl-8 text-xs"
                  />
                </div>

                <div className="max-h-[420px] overflow-y-auto space-y-2 pr-1">
                  {filteredProducts.slice(0, 40).map(p => {
                    const stockInOrigin = getStockInWarehouse(p.sku, sourceWarehouseId);
                    const isOutOfStock = stockInOrigin <= 0;

                    return (
                      <div 
                        key={p.sku}
                        className={`p-2.5 rounded-lg border transition-all flex items-center justify-between ${
                          isOutOfStock 
                            ? 'bg-muted/20 border-border/40 opacity-60' 
                            : 'bg-card border-border/60 hover:border-indigo-500/50 hover:bg-muted/30'
                        }`}
                      >
                        <div className="flex-1 pr-2">
                          <div className="text-xs font-semibold text-foreground flex items-center gap-2">
                            <span>{p.name}</span>
                            <Badge variant="outline" className="text-[9px] font-mono">
                              {p.sku}
                            </Badge>
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-3">
                            <span>Stock Origen: <strong className={stockInOrigin > 0 ? 'text-emerald-500' : 'text-rose-500'}>{stockInOrigin} uds</strong></span>
                            <span>Costo: ${Number(p.cost || 0).toFixed(2)}</span>
                          </div>
                        </div>

                        <Button 
                          size="sm" 
                          variant={isOutOfStock ? 'outline' : 'default'}
                          disabled={isOutOfStock}
                          onClick={() => handleAddToCart(p)}
                          className="h-7 text-xs px-2.5 gap-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                          <Plus className="h-3 w-3" /> Agregar
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Panel Derecho: Configuración de Bodegas y Carrito */}
          <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-4">
            <Card className="border-border/60 shadow-md">
              <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-indigo-400" /> Resumen del Traslado
                  </span>
                  <Badge variant="secondary" className="text-[10px]">
                    {cart.reduce((sum, i) => sum + i.quantity, 0)} Unidades
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                
                {/* Selector de Bodega Origen y Destino */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg bg-muted/10 border border-border/50">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground uppercase font-bold flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-rose-500"></span> Desde (Origen)
                    </Label>
                    <Select value={sourceWarehouseId} onValueChange={setSourceWarehouseId}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouses.map(w => (
                          <SelectItem key={w.id} value={w.id} className="text-xs">
                            {w.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground uppercase font-bold flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Hacia (Destino)
                    </Label>
                    <Select value={destinationWarehouseId} onValueChange={setDestinationWarehouseId}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouses.filter(w => w.id !== sourceWarehouseId).map(w => (
                          <SelectItem key={w.id} value={w.id} className="text-xs">
                            {w.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Carrito de Productos */}
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Productos Seleccionados:
                  </div>

                  {cart.length === 0 ? (
                    <div className="py-8 text-center text-xs text-muted-foreground border border-dashed border-border/60 rounded-lg">
                      Agrega productos desde el catálogo para solicitar el traslado.
                    </div>
                  ) : (
                    <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1">
                      {cart.map(item => (
                        <div key={item.sku} className="p-2 rounded-md bg-card border border-border/60 flex items-center justify-between text-xs">
                          <div className="flex-1 pr-2">
                            <div className="font-semibold text-foreground truncate">{item.name}</div>
                            <div className="text-[10px] text-muted-foreground font-mono">[{item.sku}]</div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Input 
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={e => handleUpdateCartQuantity(item.sku, parseInt(e.target.value) || 0)}
                              className="h-7 w-16 text-xs text-center font-bold"
                            />
                            <button 
                              onClick={() => handleUpdateCartQuantity(item.sku, 0)}
                              className="p-1 text-rose-500 hover:text-rose-700"
                              title="Eliminar"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Observaciones / Motivo de Traslado</Label>
                  <Input 
                    value={notes} 
                    onChange={e => setNotes(e.target.value)} 
                    placeholder="Ej: Reabastecimiento urgente de fin de semana..." 
                    className="h-8 text-xs" 
                  />
                </div>

                <Button
                  onClick={handleCreateTransferRequest}
                  disabled={cart.length === 0 || isProcessing}
                  className="w-full h-9 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md gap-1.5"
                >
                  {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Enviar Solicitud a Mesa de Despacho
                </Button>

              </CardContent>
            </Card>
          </div>

        </div>
      )}

      {/* 2. SUBPESTAÑA: MESA DE DESPACHO & PICKING GUIADO (BODEGUERO) */}
      {activeTab === 'despacho' && (
        <div className="space-y-4">
          <div className="bg-card p-3 rounded-lg border border-border/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-amber-500" />
              <span className="text-xs font-semibold text-foreground">Solicitudes Pendientes de Preparación y Despacho Físico</span>
            </div>
            <Badge variant="outline" className="text-xs text-amber-500 bg-amber-500/10 border-amber-500/30">
              {pendingDispatchTransfers.length} Pendientes
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingDispatchTransfers.length === 0 ? (
              <div className="col-span-full py-12 text-center text-xs text-muted-foreground border border-dashed border-border/60 rounded-xl">
                No hay traslados pendientes de despacho en este momento.
              </div>
            ) : (
              pendingDispatchTransfers.map(t => (
                <Card key={t.id} className="border-border/60 shadow-sm hover:border-primary/50 transition-all flex flex-col justify-between">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-primary">{t.correlativo}</span>
                      <Badge variant="outline" className="text-[10px] text-amber-500 bg-amber-500/10 border-amber-500/30">
                        {t.estado}
                      </Badge>
                    </div>
                    <CardTitle className="text-xs font-semibold flex items-center gap-1 mt-1">
                      <span>{t.origen_nombre}</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-emerald-500">{t.destino_nombre}</span>
                    </CardTitle>
                    <CardDescription className="text-[10px]">
                      Solicitado por: {t.solicitado_por} ({new Date(t.created_at).toLocaleDateString()})
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-3 pt-0">
                    <div className="p-2 rounded bg-muted/30 border border-border/40 text-[11px] space-y-1">
                      <div className="font-bold text-foreground">Ítems a Despachar ({t.items.length}):</div>
                      <div className="max-h-24 overflow-y-auto space-y-0.5">
                        {t.items.map(it => (
                          <div key={it.sku} className="flex justify-between text-muted-foreground text-[10px]">
                            <span className="truncate">{it.quantity}x {it.name}</span>
                            <span className="font-mono">[{it.sku}]</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Button
                      onClick={() => handleOpenDispatchModal(t)}
                      className="w-full h-8 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
                    >
                      <ClipboardList className="h-3.5 w-3.5" /> Iniciar Picking & Despachar
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {/* 3. SUBPESTAÑA: RECEPCIÓN EN DESTINO */}
      {activeTab === 'recepcion' && (
        <div className="space-y-4">
          <div className="bg-card p-3 rounded-lg border border-border/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-indigo-500" />
              <span className="text-xs font-semibold text-foreground">Cargas en Tránsito Pendientes de Ingreso Físico en Destino</span>
            </div>
            <Badge variant="outline" className="text-xs text-indigo-400 bg-indigo-500/10 border-indigo-500/30">
              {inTransitTransfers.length} En Tránsito
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {inTransitTransfers.length === 0 ? (
              <div className="col-span-full py-12 text-center text-xs text-muted-foreground border border-dashed border-border/60 rounded-xl">
                No hay traslados en camino hacia ninguna sucursal.
              </div>
            ) : (
              inTransitTransfers.map(t => (
                <Card key={t.id} className="border-indigo-500/30 bg-gradient-to-b from-card to-indigo-950/10 shadow-sm flex flex-col justify-between">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-indigo-400">{t.correlativo}</span>
                      <Badge variant="outline" className="text-[10px] text-indigo-400 bg-indigo-500/10 border-indigo-500/30">
                        EN TRÁNSITO
                      </Badge>
                    </div>
                    <CardTitle className="text-xs font-semibold flex items-center gap-1 mt-1">
                      <span>{t.origen_nombre}</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-emerald-400 font-bold">{t.destino_nombre}</span>
                    </CardTitle>
                    <CardDescription className="text-[10px]">
                      Despachó: {t.despachado_por} • Chofer: {t.transportista || 'N/A'} (Placa: {t.vehiculo_placa || 'N/A'})
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-3 pt-0">
                    <div className="p-2 rounded bg-muted/40 border border-border/40 text-[11px] space-y-1">
                      <div className="font-bold text-foreground">Mercancía Recibida:</div>
                      <div className="max-h-24 overflow-y-auto space-y-0.5">
                        {t.items.map(it => (
                          <div key={it.sku} className="flex justify-between text-muted-foreground text-[10px]">
                            <span>{it.quantity}x {it.name}</span>
                            <span className="font-mono">[{it.sku}]</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Button
                      onClick={() => handleConfirmReception(t)}
                      disabled={isProcessing}
                      className="w-full h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-sm"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Confirmar Conteo y Cargar a Stock
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {/* 4. SUBPESTAÑA: REABASTECIMIENTO AUTOMÁTICO INTELIGENTE */}
      {activeTab === 'reabastecimiento' && (
        <div className="space-y-4">
          <div className="bg-card p-4 rounded-xl border border-border/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-foreground flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-400" />
                Disparador de Reabastecimiento Automático por Punto de Reorden
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Productos cuyo stock físico descendió al punto crítico, agrupados con la cantidad sugerida de compra para reponer al stock máximo.
              </p>
            </div>

            <Badge variant="outline" className="text-xs bg-rose-500/10 text-rose-500 border-rose-500/30">
              {replenishmentSuggestions.length} Productos en Quiebre / Reorden
            </Badge>
          </div>

          <Card className="border-border/60 shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 text-[11px]">
                  <TableHead>Producto / SKU</TableHead>
                  <TableHead>Sucursal / Bodega</TableHead>
                  <TableHead className="text-center">Stock Actual</TableHead>
                  <TableHead className="text-center">Punto Reorden</TableHead>
                  <TableHead className="text-center">Stock Máx</TableHead>
                  <TableHead className="text-center font-bold text-amber-500">Cant. Sugerida</TableHead>
                  <TableHead className="text-right">Costo Est.</TableHead>
                  <TableHead>Proveedor Habitual</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {replenishmentSuggestions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-10 text-xs text-emerald-500">
                      <div className="flex flex-col items-center gap-2">
                        <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                        <span className="font-semibold">¡Todos los niveles de inventario están saludables!</span>
                        <span className="text-muted-foreground text-[11px]">Ningún producto se encuentra por debajo del punto de reorden.</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  replenishmentSuggestions.map((sug, idx) => (
                    <TableRow key={`${sug.sku}-${sug.sucursal_id}-${idx}`} className="text-xs hover:bg-muted/30">
                      <TableCell>
                        <div className="font-semibold text-foreground">{sug.producto_nombre}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">[{sug.sku}]</div>
                      </TableCell>
                      <TableCell>{sug.sucursal_nombre}</TableCell>
                      <TableCell className="text-center font-bold text-rose-500">{sug.stock_actual} uds</TableCell>
                      <TableCell className="text-center text-muted-foreground font-mono">{sug.punto_reorden}</TableCell>
                      <TableCell className="text-center text-muted-foreground font-mono">{sug.stock_maximo}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="text-xs font-bold text-amber-500 bg-amber-500/10">
                          +{sug.cantidad_sugerida} uds
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        ${sug.total_estimado.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {sug.proveedor_nombre}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          size="sm"
                          onClick={() => {
                            toast({
                              title: 'Orden de Compra Sugerida Generada',
                              description: `Se agrupó la compra de ${sug.cantidad_sugerida}x ${sug.producto_nombre} para ${sug.proveedor_nombre}.`
                            });
                          }}
                          className="h-7 text-xs px-2 bg-indigo-600 hover:bg-indigo-700 text-white gap-1"
                        >
                          <ShoppingCart className="h-3 w-3" /> Reponer
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}

      {/* 5. SUBPESTAÑA: HISTORIAL & TRAZABILIDAD */}
      {activeTab === 'historial' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-lg border border-border/60">
            <div className="relative flex-1">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input 
                value={historySearchTerm}
                onChange={e => setHistorySearchTerm(e.target.value)}
                placeholder="Buscar por guía, sucursal, responsable o SKU..."
                className="h-8 pl-8 text-xs"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <Select value={historyFilterState} onValueChange={setHistoryFilterState}>
                <SelectTrigger className="h-8 text-xs w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL" className="text-xs">Todos los estados</SelectItem>
                  <SelectItem value="SOLICITADO" className="text-xs">Solicitados</SelectItem>
                  <SelectItem value="DESPACHADO" className="text-xs">En Tránsito</SelectItem>
                  <SelectItem value="RECIBIDO" className="text-xs">Recibidos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card className="border-border/60 shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 text-[11px]">
                  <TableHead>N° Guía</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Origen → Destino</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Ítems</TableHead>
                  <TableHead>Solicitado Por</TableHead>
                  <TableHead>Despacho / Chofer</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHistory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-xs text-muted-foreground">
                      No se encontraron traslados en el historial.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredHistory.map(tr => (
                    <TableRow key={tr.id} className="text-xs hover:bg-muted/30">
                      <TableCell className="font-mono font-bold text-primary">{tr.correlativo}</TableCell>
                      <TableCell className="text-muted-foreground text-[11px]">
                        {new Date(tr.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{tr.origen_nombre} → <span className="text-emerald-500 font-semibold">{tr.destino_nombre}</span></div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline"
                          className={`text-[10px] font-semibold ${
                            tr.estado === 'RECIBIDO' 
                              ? 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10' 
                              : tr.estado === 'DESPACHADO' 
                              ? 'text-indigo-400 border-indigo-500/30 bg-indigo-500/10' 
                              : 'text-amber-500 border-amber-500/30 bg-amber-500/10'
                          }`}
                        >
                          {tr.estado}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {tr.items.reduce((s, i) => s + i.quantity, 0)} uds ({tr.items.length} líneas)
                      </TableCell>
                      <TableCell className="text-muted-foreground text-[11px]">{tr.solicitado_por}</TableCell>
                      <TableCell className="text-muted-foreground text-[11px]">
                        {tr.transportista ? `${tr.transportista} (${tr.vehiculo_placa || 'N/A'})` : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setViewingTransfer(tr)}
                          className="h-7 text-xs px-2 gap-1 text-primary hover:text-primary"
                        >
                          <Eye className="h-3.5 w-3.5" /> Ver Detalle
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}

      {/* MODAL: CHECKLIST DE PICKING & DESPACHO GUIADO */}
      <Dialog open={!!selectedTransferForDispatch} onOpenChange={(open) => !open && setSelectedTransferForDispatch(null)}>
        <DialogContent className="max-w-2xl bg-slate-950 border-slate-800 text-slate-100">
          <DialogHeader className="border-b border-slate-800 pb-3">
            <DialogTitle className="text-sm font-bold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-amber-400" />
                Mesa de Picking & Despacho [{selectedTransferForDispatch?.correlativo}]
              </span>
              <Badge variant="outline" className="text-[10px] text-amber-400 bg-amber-400/10 border-amber-400/30">
                Modo Bodeguero
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Verifica físicamente cada producto en la estantería antes de autorizar la salida del camión.
            </DialogDescription>
          </DialogHeader>

          {selectedTransferForDispatch && (
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs flex justify-between">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Ruta de Transporte:</span>
                  <div className="font-semibold text-slate-200 mt-0.5">
                    {selectedTransferForDispatch.origen_nombre} ➔ {selectedTransferForDispatch.destino_nombre}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Solicitante:</span>
                  <div className="text-slate-200 mt-0.5">{selectedTransferForDispatch.solicitado_por}</div>
                </div>
              </div>

              {/* Checklist de Picking */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Checklist de Preparación Física:
                </div>
                <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                  {selectedTransferForDispatch.items.map(it => {
                    const isChecked = !!pickingChecklist[it.sku];
                    return (
                      <div 
                        key={it.sku}
                        onClick={() => setPickingChecklist({ ...pickingChecklist, [it.sku]: !isChecked })}
                        className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                          isChecked 
                            ? 'bg-emerald-950/30 border-emerald-500/50 text-emerald-300' 
                            : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded flex items-center justify-center border ${
                            isChecked ? 'bg-emerald-600 border-emerald-500 text-white' : 'border-slate-700 bg-slate-800'
                          }`}>
                            {isChecked && <Check className="h-3.5 w-3.5" />}
                          </div>
                          <div>
                            <div className="text-xs font-semibold">{it.name}</div>
                            <div className="text-[10px] opacity-70 font-mono">SKU: {it.sku}</div>
                          </div>
                        </div>

                        <div className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                          {it.quantity} unidades
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Datos del Conductor */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-400">Nombre del Chofer / Transportista *</Label>
                  <Input 
                    value={dispatchDriver} 
                    onChange={e => setDispatchDriver(e.target.value)} 
                    placeholder="Ej: Carlos Ramos" 
                    className="h-8 text-xs bg-slate-900 border-slate-800 text-slate-100" 
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-400">Placa del Vehículo / Camión</Label>
                  <Input 
                    value={dispatchPlaca} 
                    onChange={e => setDispatchPlaca(e.target.value)} 
                    placeholder="Ej: C-124982" 
                    className="h-8 text-xs bg-slate-900 border-slate-800 text-slate-100" 
                  />
                </div>
              </div>

              <Button
                onClick={handleConfirmDispatch}
                disabled={isProcessing || !dispatchDriver.trim()}
                className="w-full h-9 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white gap-1.5 shadow-md"
              >
                {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Truck className="h-3.5 w-3.5" />}
                Autorizar Salida de Bodega & Generar Guía de Remisión
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL: DETALLE DE TRASLADO / GUÍA DE REMISIÓN */}
      <Dialog open={!!viewingTransfer} onOpenChange={(open) => !open && setViewingTransfer(null)}>
        <DialogContent className="max-w-xl bg-slate-950 border-slate-800 text-slate-100">
          <DialogHeader className="border-b border-slate-800 pb-3">
            <DialogTitle className="text-sm font-bold flex items-center justify-between">
              <span>Guía de Remisión & Trazabilidad [{viewingTransfer?.correlativo}]</span>
              <Badge variant="outline" className="text-[10px] text-emerald-400 bg-emerald-400/10">
                {viewingTransfer?.estado}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {viewingTransfer && (
            <div className="space-y-4 py-2 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-slate-900 border border-slate-800">
                <div>
                  <span className="text-slate-400 text-[10px]">ORIGEN:</span>
                  <div className="font-bold text-slate-200">{viewingTransfer.origen_nombre}</div>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px]">DESTINO:</span>
                  <div className="font-bold text-emerald-400">{viewingTransfer.destino_nombre}</div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-[11px] font-bold text-slate-300">Detalle de Mercancía:</div>
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-800 text-[10px] text-slate-400">
                      <TableHead>Cant</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>SKU</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewingTransfer.items.map(it => (
                      <TableRow key={it.sku} className="border-slate-800/60 text-xs">
                        <TableCell className="font-bold">{it.quantity}x</TableCell>
                        <TableCell>{it.name}</TableCell>
                        <TableCell className="font-mono text-[10px] text-slate-400">{it.sku}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-[11px] space-y-1 text-slate-400">
                <div><strong>Solicitado por:</strong> {viewingTransfer.solicitado_por}</div>
                {viewingTransfer.despachado_por && <div><strong>Despachado por:</strong> {viewingTransfer.despachado_por} (Chofer: {viewingTransfer.transportista || 'N/A'})</div>}
                {viewingTransfer.recibido_por && <div><strong>Recibido por:</strong> {viewingTransfer.recibido_por}</div>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
