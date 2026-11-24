'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  DollarSign,
  Eye,
  FileSpreadsheet,
  Loader2,
  Package,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Send,
  Trash2,
  Truck,
  Warehouse
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/supabase/client';
import { useUser } from '@/supabase/use-user';
import { useToast } from '@/hooks/use-toast';
import {
  buildPurchaseOrderDocumentHtml,
  loadPrintBranding,
  printHtmlDocument
} from '@/lib/print-engine';
import {
  executeRestockOrderAndReceiveDte,
  syncExternalSuppliersToDirectory,
} from '@/lib/hacienda-sandbox';
import { useBms } from '@/contexts/BmsContext';

export interface PurchaseOrderItem {
  sku: string;
  name: string;
  quantity: number;
  cost: number;
  currentStock?: number;
}

export interface PurchaseOrderRecord {
  id: string;
  code: string;
  supplier: string;
  supplierNit?: string;
  supplierEmail?: string;
  supplierPhone?: string;
  destinationWarehouse: string;
  requestedBy: string;
  items: PurchaseOrderItem[];
  total: number;
  status: 'PENDIENTE' | 'ENVIADA' | 'RECIBIDA';
  createdAt: string;
  expectedDate?: string;
  paymentTerms?: string;
  notes?: string;
}

interface OrdersTabProps {
  onReceiveToPurchase?: (order: PurchaseOrderRecord) => void;
  onImportDteToPurchase?: (dte: any) => void;
}

function normalizeStatus(raw: string): 'PENDIENTE' | 'ENVIADA' | 'RECIBIDA' {
  const up = (raw || '').toUpperCase();
  if (up === 'RECIBIDO' || up === 'RECIBIDA' || up === 'COMPLETADA') return 'RECIBIDA';
  if (up === 'ENVIADO' || up === 'ENVIADA') return 'ENVIADA';
  return 'PENDIENTE';
}

export default function OrdersTab({ onReceiveToPurchase, onImportDteToPurchase }: OrdersTabProps = {}) {
  const { toast } = useToast();
  const { user } = useUser();
  const { auditSystem } = useBms();

  // Datos livianos cargados en paralelo (sin descargar todo el inventario)
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncingSups, setSyncingSups] = useState(false);
  const [restockingOrderId, setRestockingOrderId] = useState<string | null>(null);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [orders, setOrders] = useState<PurchaseOrderRecord[]>([]);

  // Paso 1: Proveedor y Condiciones
  const [supplierName, setSupplierName] = useState('');
  const [supplierNit, setSupplierNit] = useState('');
  const [supplierEmail, setSupplierEmail] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [destWarehouse, setDestWarehouse] = useState('');
  const [expectedDate, setExpectedDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().slice(0, 10);
  });
  const [paymentTerms, setPaymentTerms] = useState('Crédito 30 días');
  const [responsible, setResponsible] = useState('');
  const [notes, setNotes] = useState('');
  const [includeIva, setIncludeIva] = useState(true);

  // Paso 2: Buscador rápido bajo demanda en Supabase
  const [productQuery, setProductQuery] = useState('');
  const [searchingProducts, setSearchingProducts] = useState(false);
  const [productResults, setProductResults] = useState<Array<{ sku: string; name: string; cost: number; stock: number }>>([]);
  const [orderItems, setOrderItems] = useState<PurchaseOrderItem[]>([]);

  // Agregar producto nuevo rápido (opcional)
  const [showCustomItem, setShowCustomItem] = useState(false);
  const [customSku, setCustomSku] = useState('');
  const [customName, setCustomName] = useState('');
  const [customQty, setCustomQty] = useState('1');
  const [customCost, setCustomCost] = useState('');

  // Filtros y vista previa de historial
  const [searchOrders, setSearchOrders] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDIENTE' | 'ENVIADA' | 'RECIBIDA'>('ALL');
  const [previewOrder, setPreviewOrder] = useState<PurchaseOrderRecord | null>(null);

  useEffect(() => {
    if (user?.email && !responsible) {
      setResponsible(user.email);
    }
  }, [user]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [whRes, supRes, ordRes] = await Promise.all([
        supabase.from('warehouses').select('id, name').order('name'),
        supabase.from('suppliers').select('id, name, nit, email, phone').order('name').limit(200),
        supabase.from('supplier_orders').select('*').order('created_at', { ascending: false }).limit(60)
      ]);

      const whList = whRes.data || [];
      setWarehouses(whList);
      if (!destWarehouse && whList.length > 0) {
        setDestWarehouse(whList[0].name);
      }
      setSuppliers(supRes.data || []);

      const mapped: PurchaseOrderRecord[] = (ordRes.data || []).map((o: any) => ({
        id: o.id,
        code: o.code || `OC-${String(o.id).slice(0, 6).toUpperCase()}`,
        supplier: o.supplier_name || 'Proveedor',
        supplierEmail: o.supplier_email || '',
        supplierPhone: o.supplier_phone || '',
        destinationWarehouse: o.destination_warehouse || 'Bodega Principal',
        requestedBy: o.requested_by || '',
        items: Array.isArray(o.items) ? o.items : [],
        total: Number(o.total || 0),
        status: normalizeStatus(o.status),
        createdAt: o.created_at,
        paymentTerms: o.authorized_by || undefined,
        notes: o.digitized_by || undefined
      }));
      setOrders(mapped);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error cargando órdenes',
        description: err?.message || 'No se pudieron cargar las órdenes de compra.'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Buscador de productos bajo demanda (solo 25 resultados -> instantáneo)
  const handleSearchProducts = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = productQuery.trim();
    if (!q) {
      setProductResults([]);
      return;
    }

    setSearchingProducts(true);
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select('sku, name, cost, price')
        .or(`sku.ilike.%${q}%,name.ilike.%${q}%`)
        .limit(25);

      if (error) throw error;
      const rows = data || [];
      const skus = rows.map((r: any) => r.sku).filter(Boolean);

      const stockBySku: Record<string, number> = {};
      if (skus.length > 0) {
        const { data: stRows } = await supabase
          .from('inventory_stock')
          .select('sku, quantity')
          .in('sku', skus);
        (stRows || []).forEach((s: any) => {
          stockBySku[s.sku] = (stockBySku[s.sku] || 0) + (Number(s.quantity) || 0);
        });
      }

      setProductResults(
        rows.map((r: any) => ({
          sku: r.sku,
          name: r.name || r.sku,
          cost: Number(r.cost ?? (r.price ? r.price * 0.7 : 0)),
          stock: Number((stockBySku[r.sku] || 0).toFixed(2))
        }))
      );
    } catch {
      toast({ variant: 'destructive', title: 'Error buscando catálogo' });
    } finally {
      setSearchingProducts(false);
    }
  };

  const addProductToOrder = (prod: { sku: string; name: string; cost: number; stock?: number }) => {
    setOrderItems((prev) => {
      const existing = prev.find((i) => i.sku === prod.sku);
      if (existing) {
        return prev.map((i) => (i.sku === prod.sku ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [
        ...prev,
        {
          sku: prod.sku,
          name: prod.name,
          quantity: 1,
          cost: Number(prod.cost || 0),
          currentStock: prod.stock
        }
      ];
    });
    setProductQuery('');
    setProductResults([]);
  };

  const handleAddCustomItem = () => {
    if (!customName.trim()) {
      toast({ variant: 'destructive', title: 'Nombre requerido', description: 'Ingresa la descripción del producto.' });
      return;
    }
    const sku = customSku.trim() || `NEW-${Date.now().toString().slice(-4)}`;
    addProductToOrder({
      sku,
      name: customName.trim(),
      cost: parseFloat(customCost) || 0
    });
    setOrderItems((prev) =>
      prev.map((i) => (i.sku === sku ? { ...i, quantity: Math.max(1, parseInt(customQty) || 1) } : i))
    );
    setCustomSku('');
    setCustomName('');
    setCustomQty('1');
    setCustomCost('');
    setShowCustomItem(false);
  };

  const subtotalOrder = useMemo(
    () => orderItems.reduce((acc, i) => acc + (Number(i.cost) || 0) * (Number(i.quantity) || 0), 0),
    [orderItems]
  );
  const ivaOrder = includeIva ? subtotalOrder * 0.13 : 0;
  const totalOrder = subtotalOrder + ivaOrder;

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName.trim() || !destWarehouse || orderItems.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Completa los 3 pasos',
        description: 'Selecciona proveedor, bodega destino y al menos 1 producto.'
      });
      return;
    }

    setSaving(true);
    try {
      const orderCode = `OC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
      const { error } = await supabase.from('supplier_orders').insert({
        code: orderCode,
        supplier_name: supplierName.trim(),
        destination_warehouse: destWarehouse,
        requested_by: responsible.trim() || user?.email || 'Compras',
        items: orderItems,
        total: Number(totalOrder.toFixed(2)),
        status: 'PENDIENTE',
        supplier_email: supplierEmail.trim() || null,
        from_email: user?.email || null,
        authorized_by: `${paymentTerms}${expectedDate ? ` | Entrega: ${expectedDate}` : ''}`,
        digitized_by: notes.trim() || null,
        supplier_phone: supplierPhone.trim() || null
      });

      if (error) throw error;

      toast({
        title: `Orden ${orderCode} Emitida ✓`,
        description: `Proveedor: ${supplierName.trim()} · Total: $${totalOrder.toFixed(2)}`
      });

      setOrderItems([]);
      setNotes('');
      await loadInitialData();
      auditSystem().catch(() => {});
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error al emitir orden', description: err?.message });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateOrderStatus = async (order: PurchaseOrderRecord, nextStatus: 'PENDIENTE' | 'ENVIADA' | 'RECIBIDA') => {
    try {
      const { error } = await supabase.from('supplier_orders').update({ status: nextStatus }).eq('id', order.id);
      if (error) throw error;
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: nextStatus } : o)));
      if (previewOrder?.id === order.id) setPreviewOrder({ ...previewOrder, status: nextStatus });
      toast({ title: `Estado actualizado: ${nextStatus}`, description: order.code });
      auditSystem().catch(() => {});
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error actualizando estado', description: err?.message });
    }
  };

  const handleDeleteOrder = async (order: PurchaseOrderRecord) => {
    if (!window.confirm(`¿Eliminar la orden ${order.code} de ${order.supplier}?`)) return;
    try {
      const { error } = await supabase.from('supplier_orders').delete().eq('id', order.id);
      if (error) throw error;
      setOrders((prev) => prev.filter((o) => o.id !== order.id));
      if (previewOrder?.id === order.id) setPreviewOrder(null);
      toast({ title: 'Orden Eliminada', description: order.code });
      auditSystem().catch(() => {});
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error al eliminar', description: err?.message });
    }
  };

  const handlePrintOrder = async (ord: PurchaseOrderRecord) => {
    const branding = await loadPrintBranding('purchases');
    const html = buildPurchaseOrderDocumentHtml({
      branding,
      orderNumber: ord.code,
      supplierName: ord.supplier,
      supplierNit: ord.supplierNit,
      warehouseName: ord.destinationWarehouse,
      expectedDate: ord.paymentTerms,
      notes: ord.notes,
      items: ord.items.map((i) => ({
        sku: i.sku,
        name: i.name,
        quantity: Number(i.quantity || 1),
        unitCost: Number(i.cost || 0)
      })),
      total: ord.total
    });
    printHtmlDocument(html, `Orden ${ord.code}`);
  };

  const handleExportOrderExcel = async (ord: PurchaseOrderRecord) => {
    const XLSX = await import('xlsx');
    const rows = ord.items.map((it, idx) => ({
      '#': idx + 1,
      SKU: it.sku,
      Producto: it.name,
      Cantidad: it.quantity,
      'Costo Unit ($)': Number(it.cost || 0),
      'Subtotal ($)': Number((it.quantity * (it.cost || 0)).toFixed(2))
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Orden_Compra');
    XLSX.writeFile(wb, `${ord.code}_${ord.supplier.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);
  };

  const handleSyncSuppliers = async () => {
    setSyncingSups(true);
    try {
      const res = await syncExternalSuppliersToDirectory();
      await loadInitialData();
      toast({
        title: 'Proveedores sincronizados',
        description:
          res.added > 0
            ? `Se agregaron ${res.added} proveedores nuevos al directorio.`
            : `Los ${res.total} proveedores ya están registrados en tu directorio.`,
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error al sincronizar proveedores',
        description: err?.message || 'Intenta nuevamente.',
      });
    } finally {
      setSyncingSups(false);
    }
  };

  const handleRestockOrder = async (ord: PurchaseOrderRecord) => {
    setRestockingOrderId(ord.id);
    try {
      const res = await executeRestockOrderAndReceiveDte({
        orderCode: ord.code,
        supplierName: ord.supplier,
        supplierNit: ord.supplierNit,
        destinationWarehouse: ord.destinationWarehouse,
        items: ord.items.map((it) => ({
          sku: it.sku,
          name: it.name,
          quantity: Number(it.quantity) || 1,
          cost: Number(it.cost) || 1,
        })),
      });

      if (!res.ok || !res.dteEntry) {
        throw new Error(res.error || 'No se pudo procesar el reabastecimiento.');
      }

      await supabase
        .from('supplier_orders')
        .update({ status: 'ENVIADA' })
        .eq('id', ord.id);

      toast({
        title: 'Factura CCF recibida',
        description: `Documento ${res.numeroControl} cargado en Registro de Compra.`,
      });
      auditSystem().catch(() => {});

      if (onImportDteToPurchase) {
        onImportDteToPurchase(res.dteEntry);
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error al reabastecer',
        description: err?.message || 'No se pudo obtener la factura del proveedor.',
      });
    } finally {
      setRestockingOrderId(null);
    }
  };

  const kpis = useMemo(() => {
    const pending = orders.filter((o) => o.status === 'PENDIENTE').length;
    const sent = orders.filter((o) => o.status === 'ENVIADA').length;
    const received = orders.filter((o) => o.status === 'RECIBIDA').length;
    const committed = orders
      .filter((o) => o.status !== 'RECIBIDA')
      .reduce((acc, o) => acc + (Number(o.total) || 0), 0);
    return { pending, sent, received, committed };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const q = searchOrders.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== 'ALL' && o.status !== statusFilter) return false;
      if (!q) return true;
      return (
        o.code.toLowerCase().includes(q) ||
        o.supplier.toLowerCase().includes(q) ||
        o.destinationWarehouse.toLowerCase().includes(q)
      );
    });
  }, [orders, searchOrders, statusFilter]);

  return (
    <div className="space-y-6">
      {/* KPIs SUPERIORES */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-card border-border rounded-2xl shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Pendientes</p>
              <p className="text-2xl font-black text-amber-600 dark:text-amber-400">{kpis.pending}</p>
            </div>
            <Clock className="text-amber-500/70" size={20} />
          </CardContent>
        </Card>
        <Card className="bg-card border-border rounded-2xl shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Enviadas</p>
              <p className="text-2xl font-black text-blue-600 dark:text-blue-400">{kpis.sent}</p>
            </div>
            <Send className="text-blue-500/70" size={20} />
          </CardContent>
        </Card>
        <Card className="bg-card border-border rounded-2xl shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Recibidas</p>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{kpis.received}</p>
            </div>
            <CheckCircle2 className="text-emerald-500/70" size={20} />
          </CardContent>
        </Card>
        <Card className="bg-card border-border rounded-2xl shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Inversión en Tránsito</p>
              <p className="text-xl font-black font-mono text-foreground">${kpis.committed.toFixed(2)}</p>
            </div>
            <DollarSign className="text-indigo-500/70" size={20} />
          </CardContent>
        </Card>
      </div>

      {/* PANEL PRINCIPAL: 3 PASOS SIMPLES (IZQUIERDA) + HISTORIAL ENRIQUECIDO (DERECHA) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* COLUMNA IZQUIERDA: FORMULARIO EN 3 PASOS */}
        <form onSubmit={handleCreateOrder} className="lg:col-span-5 space-y-4">
          {/* PASO 1: PROVEEDOR Y CONDICIONES */}
          <Card className="bg-card border-border rounded-2xl shadow-sm overflow-hidden">
            <CardHeader className="p-4 border-b border-border bg-muted/30">
              <CardTitle className="text-sm font-black flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center">1</span>
                Proveedor y Bodega Destino
              </CardTitle>
              <CardDescription className="text-xs">Elige el proveedor, bodega de recepción y plazo.</CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">Proveedor *</Label>
                  <button
                    type="button"
                    onClick={handleSyncSuppliers}
                    disabled={syncingSups}
                    className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
                  >
                    <RefreshCw size={10} className={syncingSups ? 'animate-spin' : ''} />
                    Sincronizar Proveedores
                  </button>
                </div>
                <Select
                  value={suppliers.find((s) => s.name === supplierName)?.id || '__manual'}
                  onValueChange={(supId) => {
                    const found = suppliers.find((s) => s.id === supId);
                    if (found) {
                      setSupplierName(found.name || '');
                      setSupplierNit(found.nit || '');
                      setSupplierEmail(found.email || '');
                      setSupplierPhone(found.phone || '');
                    }
                  }}
                >
                  <SelectTrigger className="h-9 text-xs bg-background">
                    <SelectValue placeholder="Seleccionar proveedor del directorio..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    <SelectItem value="__manual" className="text-xs">-- Escribir nombre abajo --</SelectItem>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id} className="text-xs">
                        {s.name}{s.nit ? ` (${s.nit})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Nombre / Razón Social del Proveedor..."
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="h-9 text-xs font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">Bodega Recepción *</Label>
                  <Select value={destWarehouse} onValueChange={setDestWarehouse}>
                    <SelectTrigger className="h-9 text-xs bg-background">
                      <SelectValue placeholder="Bodega..." />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses.map((w) => (
                        <SelectItem key={w.id} value={w.name} className="text-xs">{w.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">Condición de Pago</Label>
                  <Select value={paymentTerms} onValueChange={setPaymentTerms}>
                    <SelectTrigger className="h-9 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Contado" className="text-xs">Contado</SelectItem>
                      <SelectItem value="Crédito 15 días" className="text-xs">Crédito 15 días</SelectItem>
                      <SelectItem value="Crédito 30 días" className="text-xs">Crédito 30 días</SelectItem>
                      <SelectItem value="Crédito 45 días" className="text-xs">Crédito 45 días</SelectItem>
                      <SelectItem value="Crédito 60 días" className="text-xs">Crédito 60 días</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">Entrega Estimada</Label>
                  <Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className="h-9 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">Responsable</Label>
                  <Input value={responsible} onChange={(e) => setResponsible(e.target.value)} placeholder="Usuario compras" className="h-9 text-xs" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* PASO 2: PRODUCTOS A PEDIR */}
          <Card className="bg-card border-border rounded-2xl shadow-sm overflow-hidden">
            <CardHeader className="p-4 border-b border-border bg-muted/30 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-black flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center">2</span>
                  Productos a Pedir ({orderItems.length})
                </CardTitle>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowCustomItem((p) => !p)}
                className="h-7 text-[11px] rounded-lg gap-1"
              >
                <Plus size={12} /> Ítem Nuevo
              </Button>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {/* Buscador rápido bajo demanda */}
              <div className="flex gap-2 relative">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                  <Input
                    placeholder="Buscar SKU o producto y presiona Enter..."
                    value={productQuery}
                    onChange={(e) => {
                      setProductQuery(e.target.value);
                      if (!e.target.value.trim()) setProductResults([]);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSearchProducts();
                      }
                    }}
                    className="pl-9 h-9 text-xs"
                  />
                </div>
                <Button type="button" size="sm" variant="secondary" onClick={() => handleSearchProducts()} disabled={searchingProducts} className="h-9 text-xs px-3">
                  {searchingProducts ? <Loader2 size={13} className="animate-spin" /> : 'Buscar'}
                </Button>
              </div>

              {productResults.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-xl border border-border bg-popover divide-y divide-border">
                  {productResults.map((p) => (
                    <button
                      key={p.sku}
                      type="button"
                      onClick={() => addProductToOrder(p)}
                      className="w-full text-left px-3 py-2 hover:bg-muted/60 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-foreground truncate">{p.name}</div>
                        <div className="text-[10px] font-mono text-muted-foreground">
                          SKU: {p.sku} • Stock actual: {p.stock}
                        </div>
                      </div>
                      <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                        ${p.cost.toFixed(2)}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {showCustomItem && (
                <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <Input placeholder="SKU (opc.)" value={customSku} onChange={(e) => setCustomSku(e.target.value)} className="h-8 text-xs font-mono" />
                    <Input placeholder="Descripción *" value={customName} onChange={(e) => setCustomName(e.target.value)} className="h-8 text-xs col-span-2" />
                  </div>
                  <div className="flex gap-2">
                    <Input type="number" min="1" placeholder="Cant." value={customQty} onChange={(e) => setCustomQty(e.target.value)} className="h-8 text-xs w-20" />
                    <Input type="number" step="0.01" placeholder="Costo Unit ($)" value={customCost} onChange={(e) => setCustomCost(e.target.value)} className="h-8 text-xs flex-1 font-mono" />
                    <Button type="button" size="sm" onClick={handleAddCustomItem} className="h-8 text-xs bg-indigo-600 text-white">Agregar</Button>
                  </div>
                </div>
              )}

              {orderItems.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                  Busca arriba por SKU o nombre para añadir productos a la orden.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {orderItems.map((it) => (
                    <div key={it.sku} className="p-2 rounded-xl bg-muted/30 border border-border flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-foreground truncate">{it.name}</div>
                        <div className="text-[10px] font-mono text-muted-foreground">{it.sku}</div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Input
                          type="number"
                          min="1"
                          value={it.quantity}
                          onChange={(e) =>
                            setOrderItems((prev) =>
                              prev.map((x) => (x.sku === it.sku ? { ...x, quantity: Math.max(1, parseInt(e.target.value) || 1) } : x))
                            )
                          }
                          className="h-7 w-14 text-center text-xs font-bold p-1"
                        />
                        <Input
                          type="number"
                          step="0.01"
                          value={it.cost}
                          onChange={(e) =>
                            setOrderItems((prev) =>
                              prev.map((x) => (x.sku === it.sku ? { ...x, cost: Math.max(0, parseFloat(e.target.value) || 0) } : x))
                            )
                          }
                          className="h-7 w-20 text-right text-xs font-mono font-bold p-1"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setOrderItems((prev) => prev.filter((x) => x.sku !== it.sku))}
                          className="h-7 w-7 text-rose-500"
                        >
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* PASO 3: REVISAR Y EMITIR */}
          <Card className="bg-card border-indigo-500/30 rounded-2xl shadow-sm overflow-hidden">
            <CardHeader className="p-4 border-b border-border bg-indigo-500/5">
              <CardTitle className="text-sm font-black flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-black flex items-center justify-center">3</span>
                Resumen y Emisión
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <Input
                placeholder="Observaciones para el proveedor (opcional)..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="h-9 text-xs"
              />

              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-semibold">Calcular IVA (13%) en el total</span>
                <Switch checked={includeIva} onCheckedChange={setIncludeIva} />
              </div>

              <div className="p-3 rounded-xl bg-muted/40 border border-border text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="font-mono font-semibold">${subtotalOrder.toFixed(2)}</span>
                </div>
                {includeIva && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">IVA (13%):</span>
                    <span className="font-mono font-semibold">${ivaOrder.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-1.5 border-t border-border font-black text-sm text-indigo-600 dark:text-indigo-400">
                  <span>TOTAL INVERSIÓN:</span>
                  <span className="font-mono">${totalOrder.toFixed(2)}</span>
                </div>
              </div>

              <Button
                type="submit"
                disabled={saving || orderItems.length === 0 || !supplierName.trim()}
                className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl gap-2"
              >
                {saving ? <Loader2 className="animate-spin h-4 w-4" /> : <ClipboardList size={15} />}
                Emitir Orden de Compra
              </Button>
            </CardContent>
          </Card>
        </form>

        {/* COLUMNA DERECHA: HISTORIAL ENRIQUECIDO DE ÓRDENES */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-card border border-border rounded-2xl p-3 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between shadow-sm">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
              <Input
                placeholder="Buscar por código OC, proveedor o bodega..."
                value={searchOrders}
                onChange={(e) => setSearchOrders(e.target.value)}
                className="pl-9 h-9 text-xs bg-background"
              />
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              {(['ALL', 'PENDIENTE', 'ENVIADA', 'RECIBIDA'] as const).map((st) => (
                <Button
                  key={st}
                  size="sm"
                  variant={statusFilter === st ? 'default' : 'outline'}
                  onClick={() => setStatusFilter(st)}
                  className="h-8 text-[11px] px-2.5 rounded-lg"
                >
                  {st === 'ALL' ? 'Todas' : st}
                </Button>
              ))}
              <Button size="icon" variant="outline" onClick={loadInitialData} disabled={loading} className="h-8 w-8 rounded-lg" title="Actualizar">
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              </Button>
            </div>
          </div>

          <Card className="bg-card border-border rounded-2xl overflow-hidden shadow-sm">
            <ScrollArea className="h-[680px]">
              <Table>
                <TableHeader className="bg-muted/40 sticky top-0 z-10 border-b border-border">
                  <TableRow>
                    <TableHead className="text-[10px] font-bold uppercase px-4">Orden & Proveedor</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase">Bodega / Ítems</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase text-right">Inversión</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase text-center">Estado</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase text-right px-4">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-20 text-xs text-muted-foreground">
                        <Loader2 className="animate-spin mx-auto mb-2 text-indigo-500 h-5 w-5" />
                        Cargando órdenes...
                      </TableCell>
                    </TableRow>
                  ) : filteredOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-20 text-xs text-muted-foreground italic">
                        No hay órdenes de compra registradas.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredOrders.map((ord) => (
                      <TableRow key={ord.id} onClick={() => setPreviewOrder(ord)} className="hover:bg-muted/30 border-b border-border/60 cursor-pointer">
                        <TableCell className="px-4 py-3.5">
                          <div className="space-y-0.5">
                            <div className="font-mono font-black text-[11px] text-indigo-600 dark:text-indigo-400">{ord.code}</div>
                            <div className="font-bold text-xs text-foreground">{ord.supplier}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {new Date(ord.createdAt).toLocaleDateString()} {ord.paymentTerms ? `• ${ord.paymentTerms}` : ''}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-3.5">
                          <div className="text-xs font-semibold text-foreground flex items-center gap-1">
                            <Warehouse size={12} className="text-muted-foreground" /> {ord.destinationWarehouse}
                          </div>
                          <div className="text-[10px] text-muted-foreground">{ord.items.length} producto(s)</div>
                        </TableCell>
                        <TableCell className="text-right font-mono font-black text-sm text-foreground">
                          ${ord.total.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                          <Select value={ord.status} onValueChange={(v: any) => handleUpdateOrderStatus(ord, v)}>
                            <SelectTrigger className={`h-7 w-28 text-[10px] font-bold rounded-full mx-auto ${
                              ord.status === 'RECIBIDA'
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                                : ord.status === 'ENVIADA'
                                ? 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30'
                                : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                            }`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PENDIENTE" className="text-xs">PENDIENTE</SelectItem>
                              <SelectItem value="ENVIADA" className="text-xs">ENVIADA</SelectItem>
                              <SelectItem value="RECIBIDA" className="text-xs">RECIBIDA</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            {ord.status === 'PENDIENTE' && (
                              <Button
                                size="sm"
                                onClick={() => handleRestockOrder(ord)}
                                disabled={restockingOrderId === ord.id}
                                className="h-7 px-2.5 text-[10px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg gap-1"
                                title="Solicitar factura CCF electrónica del proveedor y abrirla lista para ingresar"
                              >
                                {restockingOrderId === ord.id ? (
                                  <Loader2 size={11} className="animate-spin" />
                                ) : (
                                  <>
                                    <Send size={10} /> Reabastecer
                                  </>
                                )}
                              </Button>
                            )}
                            {onReceiveToPurchase && ord.status === 'ENVIADA' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onReceiveToPurchase(ord)}
                                className="h-7 px-2.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/15 rounded-lg gap-1"
                                title="Pasar a Registro de Compra para confirmar el ingreso al inventario"
                              >
                                Ingresar Factura <ArrowRight size={11} />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => handlePrintOrder(ord)} className="h-7 w-7 text-indigo-500" title="Imprimir PDF">
                              <Printer size={13} />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleExportOrderExcel(ord)} className="h-7 w-7 text-emerald-600" title="Descargar Excel">
                              <FileSpreadsheet size={13} />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteOrder(ord)} className="h-7 w-7 text-rose-500" title="Eliminar">
                              <Trash2 size={13} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </Card>
        </div>
      </div>

      {/* MODAL DETALLE DE ORDEN */}
      <Dialog open={!!previewOrder} onOpenChange={(open) => !open && setPreviewOrder(null)}>
        <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto bg-card border-border">
          {previewOrder && (
            <>
              <DialogHeader className="border-b border-border pb-3">
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  <Truck size={17} className="text-indigo-500" />
                  Orden de Compra {previewOrder.code}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {previewOrder.supplier} • Bodega: {previewOrder.destinationWarehouse} • Estado: {previewOrder.status}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2 text-xs">
                <div className="border border-border rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/40 text-[10px]">
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>Producto</TableHead>
                        <TableHead className="text-right">Cant.</TableHead>
                        <TableHead className="text-right">Costo Unit.</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewOrder.items.map((it, idx) => (
                        <TableRow key={`${it.sku}-${idx}`}>
                          <TableCell className="font-mono text-muted-foreground">{it.sku}</TableCell>
                          <TableCell className="font-semibold">{it.name}</TableCell>
                          <TableCell className="text-right font-mono">{it.quantity}</TableCell>
                          <TableCell className="text-right font-mono">${Number(it.cost || 0).toFixed(2)}</TableCell>
                          <TableCell className="text-right font-mono font-bold">
                            ${(Number(it.quantity || 0) * Number(it.cost || 0)).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {previewOrder.notes && (
                  <div className="p-3 rounded-xl bg-muted/30 border border-border">
                    <strong>Observaciones:</strong> {previewOrder.notes}
                  </div>
                )}

                <div className="text-right font-mono font-black text-base text-indigo-600 dark:text-indigo-400">
                  Total Orden: ${previewOrder.total.toFixed(2)}
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" size="sm" onClick={() => handlePrintOrder(previewOrder)} className="text-xs gap-1.5">
                  <Printer size={14} /> Imprimir PDF (Carta)
                </Button>
                {onReceiveToPurchase && previewOrder.status !== 'RECIBIDA' && (
                  <Button
                    size="sm"
                    onClick={() => {
                      const ord = previewOrder;
                      setPreviewOrder(null);
                      onReceiveToPurchase(ord);
                    }}
                    className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                  >
                    Recibir en Registro de Compra <ArrowRight size={14} />
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
