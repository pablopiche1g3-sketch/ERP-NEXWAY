'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  ClipboardList, 
  ArrowLeft, 
  Search, 
  Plus, 
  Trash2, 
  Warehouse, 
  Truck, 
  Building2, 
  CheckCircle2, 
  Loader2, 
  Printer, 
  DollarSign, 
  Clock, 
  User, 
  ArrowRight,
  Info,
  Calendar,
  Eye,
  AlertTriangle,
  BadgeAlert
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFirestore, useCollection } from '@/firebase';
import { collection, addDoc, doc, updateDoc, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useRouter } from 'next/navigation';
import { ModeToggle } from '@/components/mode-toggle';

interface OrderItem {
  sku: string;
  name: string;
  quantity: number;
  cost?: number;
}

export default function OrdersPage() {
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'interno' | 'externo'>('interno');
  const [loading, setLoading] = useState(false);

  // Consultas Estables de Colecciones
  const inventoryQuery = useMemo(() => collection(db, 'inventory'), [db]);
  const warehousesQuery = useMemo(() => collection(db, 'warehouses'), [db]);
  const suppliersQuery = useMemo(() => collection(db, 'suppliers'), [db]);
  const internalOrdersQuery = useMemo(() => collection(db, 'internal_orders'), [db]);
  const supplierOrdersQuery = useMemo(() => collection(db, 'supplier_orders'), [db]);

  const { data: inventory, loading: loadingInv } = useCollection<any>(inventoryQuery);
  const { data: warehouses } = useCollection<any>(warehousesQuery);
  const { data: suppliers } = useCollection<any>(suppliersQuery);
  const { data: internalOrders } = useCollection<any>(internalOrdersQuery);
  const { data: supplierOrders } = useCollection<any>(supplierOrdersQuery);

  // --- PEDIDOS INTERNOS STATES ---
  const [intSourceWh, setIntSourceWh] = useState('');
  const [intDestWh, setIntDestWh] = useState('');
  const [intRequestedBy, setIntRequestedBy] = useState('');
  const [intItems, setIntItems] = useState<OrderItem[]>([]);
  const [intSearchTerm, setIntSearchTerm] = useState('');
  const [intItemQty, setIntItemQty] = useState<number | string>(1);
  const [intItemSku, setIntItemSku] = useState('');
  const [internalSearchFilter, setInternalSearchFilter] = useState('');

  // --- PEDIDOS EXTERNOS STATES ---
  const [extSupplier, setExtSupplier] = useState('');
  const [extDestWh, setExtDestWh] = useState('');
  const [extRequestedBy, setExtRequestedBy] = useState('');
  const [extItems, setExtItems] = useState<OrderItem[]>([]);
  const [extSearchTerm, setExtSearchTerm] = useState('');
  const [extItemQty, setExtItemQty] = useState<number | string>(1);
  const [extItemCost, setExtItemCost] = useState<number | string>('');
  const [extItemSku, setExtItemSku] = useState('');
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');
  const [externalSearchFilter, setExternalSearchFilter] = useState('');

  // Modal de Vista Previa / Impresión
  const [selectedOrderForPreview, setSelectedOrderForPreview] = useState<any>(null);
  const [previewType, setPreviewType] = useState<'interno' | 'externo'>('interno');

  // --- LOGICA DE PEDIDOS INTERNOS ---
  const handleIntAddItem = () => {
    if (!intItemSku) return;
    const product = inventory?.find((p: any) => p.sku === intItemSku.toUpperCase());
    const qty = parseInt(intItemQty.toString()) || 0;

    if (!product) {
      toast({ variant: "destructive", title: "Producto no encontrado", description: "El SKU ingresado no existe." });
      return;
    }
    if (qty <= 0) {
      toast({ variant: "destructive", title: "Cantidad inválida", description: "Debe solicitar al menos 1 unidad." });
      return;
    }

    // Advertencia de Stock de origen
    const sourceStock = intSourceWh ? (product.bodegas?.[intSourceWh] || 0) : 0;
    if (intSourceWh && qty > sourceStock) {
      toast({ 
        variant: "default", 
        title: "Stock Insuficiente en Origen", 
        description: `Advertencia: ${product.name} solo cuenta con ${sourceStock} un. en ${intSourceWh}. El pedido se puede registrar como pendiente.`,
        className: "bg-amber-500 text-white"
      });
    }

    setIntItems(prev => {
      const existing = prev.find(item => item.sku === product.sku);
      if (existing) {
        return prev.map(item => item.sku === product.sku ? { ...item, quantity: item.quantity + qty } : item);
      }
      return [...prev, { sku: product.sku, name: product.name, quantity: qty }];
    });

    setIntItemSku('');
    setIntItemQty(1);
    toast({ title: "Añadido", description: `${product.name} agregado a la lista.` });
  };

  const handleCreateInternalOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!intSourceWh || !intDestWh || !intRequestedBy || intItems.length === 0) {
      toast({ variant: "destructive", title: "Datos Incompletos", description: "Complete bodegas, solicitante e ítems." });
      return;
    }
    if (intSourceWh === intDestWh) {
      toast({ variant: "destructive", title: "Ruta Inválida", description: "El origen y destino deben ser bodegas diferentes." });
      return;
    }

    setLoading(true);
    try {
      const orderCode = `REQ-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
      await addDoc(internalOrdersQuery, {
        code: orderCode,
        sourceWarehouse: intSourceWh,
        destinationWarehouse: intDestWh,
        requestedBy: intRequestedBy,
        items: intItems,
        status: 'PENDIENTE',
        createdAt: new Date().toISOString()
      });

      toast({ title: "Requisición Enviada", description: `Se ha registrado el pedido ${orderCode} de forma exitosa.` });
      setIntItems([]);
      setIntRequestedBy('');
      setIntSourceWh('');
      setIntDestWh('');
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo registrar el pedido interno." });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateInternalStatus = async (orderId: string, currentStatus: string, nextStatus: 'DESPACHADO' | 'RECIBIDO') => {
    setLoading(true);
    try {
      const orderRef = doc(db, 'internal_orders', orderId);
      const order = internalOrders.find((o: any) => o.id === orderId);

      if (nextStatus === 'RECIBIDO') {
        // --- PROCESAR LOGICA DE INVENTARIO MULTIBODEGA ---
        // 1. Restar stock de la bodega origen
        // 2. Sumar stock en la bodega destino
        for (const item of order.items) {
          const product = inventory.find((p: any) => p.sku === item.sku);
          if (product) {
            const productRef = doc(db, 'inventory', product.id);
            const currentBodegas = product.bodegas || {};
            
            const sourceStock = currentBodegas[order.sourceWarehouse] || 0;
            const destStock = currentBodegas[order.destinationWarehouse] || 0;

            const updatedBodegas = {
              ...currentBodegas,
              [order.sourceWarehouse]: Math.max(0, sourceStock - item.quantity),
              [order.destinationWarehouse]: destStock + item.quantity
            };

            // Calcular nuevo total consolidado
            const consolidatedQty = Object.values(updatedBodegas).reduce((acc: number, val: any) => acc + (parseFloat(val) || 0), 0) as number;

            await updateDoc(productRef, {
              bodegas: updatedBodegas,
              quantity: consolidatedQty
            });
          }
        }
        toast({ title: "Inventario Actualizado", description: "Se ha transferido el stock físico entre las bodegas." });
      }

      await updateDoc(orderRef, { status: nextStatus, updatedAt: new Date().toISOString() });
      toast({ title: "Estado Actualizado", description: `El pedido ha sido marcado como ${nextStatus}.` });
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar el estado de la requisición." });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteInternalOrder = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'internal_orders', id));
      toast({ title: "Pedido Eliminado" });
    } catch (err) {
      toast({ variant: "destructive", title: "Error al eliminar" });
    }
  };


  // --- LOGICA DE PEDIDOS EXTERNOS ---
  const handleExtAddItem = () => {
    if (!extItemSku) return;
    const product = inventory?.find((p: any) => p.sku === extItemSku.toUpperCase());
    const qty = parseInt(extItemQty.toString()) || 0;
    const cost = parseFloat(extItemCost.toString()) || 0;

    if (!product) {
      toast({ variant: "destructive", title: "Producto no encontrado", description: "El SKU ingresado no existe." });
      return;
    }
    if (qty <= 0) {
      toast({ variant: "destructive", title: "Cantidad inválida" });
      return;
    }
    if (cost <= 0) {
      toast({ variant: "destructive", title: "Costo inválido", description: "Ingrese el precio de cotización." });
      return;
    }

    setExtItems(prev => {
      const existing = prev.find(item => item.sku === product.sku);
      if (existing) {
        return prev.map(item => item.sku === product.sku ? { ...item, quantity: item.quantity + qty, cost: cost } : item);
      }
      return [...prev, { sku: product.sku, name: product.name, quantity: qty, cost: cost }];
    });

    setExtItemSku('');
    setExtItemQty(1);
    setExtItemCost('');
    toast({ title: "Añadido", description: `${product.name} agregado.` });
  };

  const handleCreateSupplierOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extSupplier || !extDestWh || !extRequestedBy || extItems.length === 0) {
      toast({ variant: "destructive", title: "Datos Incompletos", description: "Complete todos los campos del pedido." });
      return;
    }

    setLoading(true);
    try {
      const orderCode = `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
      const totalAmount = extItems.reduce((acc, item) => acc + ((item.cost || 0) * item.quantity), 0);

      await addDoc(supplierOrdersQuery, {
        code: orderCode,
        supplier: extSupplier,
        destinationWarehouse: extDestWh,
        requestedBy: extRequestedBy,
        items: extItems,
        total: totalAmount,
        status: 'SOLICITADO',
        createdAt: new Date().toISOString()
      });

      toast({ title: "Orden de Pedido Creada", description: `Se registró la orden ${orderCode} para el proveedor ${extSupplier}.` });
      setExtItems([]);
      setExtRequestedBy('');
      setExtSupplier('');
      setExtDestWh('');
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo registrar el pedido externo." });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSupplierOrderStatus = async (orderId: string, nextStatus: 'RECIBIDO' | 'SOLICITADO') => {
    setLoading(true);
    try {
      const orderRef = doc(db, 'supplier_orders', orderId);
      const order = supplierOrders.find((o: any) => o.id === orderId);

      if (nextStatus === 'RECIBIDO') {
        // --- INGRESO DE STOCK AUTOMÁTICO ---
        for (const item of order.items) {
          const product = inventory.find((p: any) => p.sku === item.sku);
          if (product) {
            const productRef = doc(db, 'inventory', product.id);
            const currentBodegas = product.bodegas || {};
            
            const updatedBodegas = {
              ...currentBodegas,
              [order.destinationWarehouse]: (currentBodegas[order.destinationWarehouse] || 0) + item.quantity
            };

            // Calcular nuevo total consolidado
            const consolidatedQty = Object.values(updatedBodegas).reduce((acc: number, val: any) => acc + (parseFloat(val) || 0), 0) as number;

            await updateDoc(productRef, {
              bodegas: updatedBodegas,
              quantity: consolidatedQty,
              price: item.cost && item.cost > 0 ? item.cost : product.price // Actualizar precio con el nuevo costo si aplica
            });
          }
        }
        toast({ title: "Mercadería Recibida", description: `El stock se ha ingresado con éxito a la bodega '${order.destinationWarehouse}'.` });
      }

      await updateDoc(orderRef, { status: nextStatus, updatedAt: new Date().toISOString() });
      toast({ title: "Estado Actualizado", description: `La orden ha sido marcada como ${nextStatus}.` });
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo completar la orden de compra." });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSupplierOrder = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'supplier_orders', id));
      toast({ title: "Orden Eliminada" });
    } catch (err) {
      toast({ variant: "destructive", title: "Error al eliminar" });
    }
  };

  // --- FILTROS DE HISTORIAL ---
  const filteredInternalOrders = useMemo(() => {
    if (!internalOrders) return [];
    return internalOrders.filter((o: any) => 
      o.code.toLowerCase().includes(internalSearchFilter.toLowerCase()) ||
      o.sourceWarehouse.toLowerCase().includes(internalSearchFilter.toLowerCase()) ||
      o.destinationWarehouse.toLowerCase().includes(internalSearchFilter.toLowerCase()) ||
      o.requestedBy.toLowerCase().includes(internalSearchFilter.toLowerCase())
    );
  }, [internalSearchFilter, internalOrders]);

  const filteredSupplierOrders = useMemo(() => {
    if (!supplierOrders) return [];
    return supplierOrders.filter((o: any) => 
      o.code.toLowerCase().includes(externalSearchFilter.toLowerCase()) ||
      o.supplier.toLowerCase().includes(externalSearchFilter.toLowerCase()) ||
      o.destinationWarehouse.toLowerCase().includes(externalSearchFilter.toLowerCase())
    );
  }, [externalSearchFilter, supplierOrders]);

  const filteredSuppliers = useMemo(() => {
    if (!suppliers) return [];
    return suppliers.filter((s: any) => 
      s.name.toLowerCase().includes(supplierSearchQuery.toLowerCase()) ||
      (s.nit && s.nit.includes(supplierSearchQuery))
    );
  }, [supplierSearchQuery, suppliers]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background p-4 md:p-6 transition-colors duration-300">
      
      {/* HEADER PRINCIPAL */}
      <div className="max-w-7xl mx-auto mb-6 md:mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-full bg-white dark:bg-card shadow-sm hover:bg-slate-100 border border-slate-150" 
            onClick={() => router.push('/')}
          >
            <ArrowLeft className="text-slate-600 dark:text-foreground" size={20} />
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-foreground tracking-tight">Centro de Requisición & Pedidos</h1>
            <p className="text-slate-500 dark:text-muted-foreground text-xs md:text-sm">Gestión de órdenes de pedidos internas entre tiendas y externas con proveedores</p>
          </div>
        </div>
        <ModeToggle />
      </div>

      <div className="max-w-7xl mx-auto">
        <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="space-y-6">
          <TabsList className="bg-white dark:bg-card p-1 rounded-2xl shadow-sm border h-auto w-full justify-start overflow-x-auto no-scrollbar">
            <TabsTrigger value="interno" className="rounded-xl px-4 md:px-6 py-2 text-xs md:text-sm font-bold data-[state=active]:bg-violet-600 data-[state=active]:text-white whitespace-nowrap">
              <Warehouse size={14} className="mr-2" /> Pedidos Internos (Tiendas)
            </TabsTrigger>
            <TabsTrigger value="externo" className="rounded-xl px-4 md:px-6 py-2 text-xs md:text-sm font-bold data-[state=active]:bg-violet-600 data-[state=active]:text-white whitespace-nowrap">
              <Truck size={14} className="mr-2" /> Pedidos Externos (Proveedores)
            </TabsTrigger>
          </TabsList>

          {/* ==================== TAB PEDIDOS INTERNOS ==================== */}
          <TabsContent value="interno" className="space-y-6 outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Formulario Nueva Requisición */}
              <div className="lg:col-span-5 space-y-6">
                <Card className="border shadow-sm rounded-3xl bg-white dark:bg-card overflow-hidden">
                  <CardHeader className="bg-violet-900 dark:bg-violet-950 text-white p-5">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <ClipboardList size={18} className="text-violet-400" /> Nueva Requisición entre Sucursales
                    </CardTitle>
                    <CardDescription className="text-violet-200/80 text-xs">Solicite y traslade stock de forma ágil.</CardDescription>
                  </CardHeader>
                  
                  <CardContent className="p-6 space-y-4">
                    <form onSubmit={handleCreateInternalOrder} className="space-y-4">
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Bodega Origen (Suministra)</Label>
                          <Select value={intSourceWh} onValueChange={setIntSourceWh}>
                            <SelectTrigger className="h-10 bg-slate-50 dark:bg-muted border-none rounded-xl text-xs font-bold">
                              <SelectValue placeholder="Origen..." />
                            </SelectTrigger>
                            <SelectContent>
                              {warehouses?.map(w => (
                                <SelectItem key={w.id} value={w.name} className="text-xs">{w.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Bodega Destino (Tienda)</Label>
                          <Select value={intDestWh} onValueChange={setIntDestWh}>
                            <SelectTrigger className="h-10 bg-slate-50 dark:bg-muted border-none rounded-xl text-xs font-bold">
                              <SelectValue placeholder="Destino..." />
                            </SelectTrigger>
                            <SelectContent>
                              {warehouses?.map(w => (
                                <SelectItem key={w.id} value={w.name} className="text-xs">{w.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Responsable de Solicitud</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                          <Input 
                            placeholder="Nombre del encargado..." 
                            value={intRequestedBy}
                            onChange={e => setIntRequestedBy(e.target.value)}
                            className="pl-9 h-11 bg-slate-50 dark:bg-muted border-none rounded-xl text-xs font-bold"
                          />
                        </div>
                      </div>

                      {/* Buscador de items para añadir */}
                      <div className="p-4 bg-slate-50 dark:bg-muted/30 rounded-2xl border space-y-3">
                        <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest block">Agregar Productos</Label>
                        
                        <div className="grid grid-cols-3 gap-2">
                          <div className="col-span-2 space-y-1">
                            <Label className="text-[9px] font-bold text-slate-400">SKU del Producto</Label>
                            <Select value={intItemSku} onValueChange={setIntItemSku}>
                              <SelectTrigger className="h-9 bg-white dark:bg-card border-slate-200 text-xs font-semibold rounded-lg">
                                <SelectValue placeholder="Seleccionar SKU..." />
                              </SelectTrigger>
                              <SelectContent>
                                {inventory?.map(p => (
                                  <SelectItem key={p.id} value={p.sku} className="text-xs">{p.sku} - {p.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[9px] font-bold text-slate-400">Cantidad</Label>
                            <Input 
                              type="number" 
                              value={intItemQty} 
                              onChange={e => setIntItemQty(e.target.value)}
                              className="h-9 bg-white dark:bg-card text-center text-xs font-bold"
                            />
                          </div>
                        </div>

                        <Button 
                          type="button" 
                          onClick={handleIntAddItem} 
                          variant="outline" 
                          className="w-full h-9 border-violet-500/20 text-violet-600 dark:text-violet-400 font-bold text-xs rounded-xl"
                        >
                          <Plus size={14} className="mr-1.5" /> Agregar a Lista
                        </Button>
                      </div>

                      {/* Items Agregados */}
                      {intItems.length > 0 && (
                        <div className="space-y-2 pt-2">
                          <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Ítems Solicitados</Label>
                          <ScrollArea className="h-32 border rounded-xl bg-slate-50 dark:bg-muted/20">
                            <Table>
                              <TableBody>
                                {intItems.map((item, idx) => (
                                  <TableRow key={idx} className="hover:bg-transparent">
                                    <TableCell className="py-2 text-[10px] font-mono font-bold text-slate-600 dark:text-muted-foreground">{item.sku}</TableCell>
                                    <TableCell className="py-2 text-[11px] font-bold text-slate-800 dark:text-foreground">{item.name}</TableCell>
                                    <TableCell className="py-2 text-center text-[10px] font-black">{item.quantity} un.</TableCell>
                                    <TableCell className="py-2 text-right">
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-6 w-6 text-slate-400 hover:text-rose-500"
                                        onClick={() => setIntItems(prev => prev.filter(i => i.sku !== item.sku))}
                                      >
                                        <Trash2 size={12} />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </ScrollArea>
                        </div>
                      )}

                      <Button 
                        type="submit" 
                        className="w-full h-12 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl shadow-lg text-xs"
                        disabled={loading || intItems.length === 0}
                      >
                        {loading ? <Loader2 className="animate-spin mr-2" /> : <ClipboardList className="mr-2" size={16} />}
                        ENVIAR SOLICITUD INTERNA
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>

              {/* Historial de Pedidos Internos */}
              <div className="lg:col-span-7 space-y-4">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <Input 
                    placeholder="Buscar requisición por código, bodega o encargado..." 
                    value={internalSearchFilter}
                    onChange={e => setInternalSearchFilter(e.target.value)}
                    className="pl-12 h-12 bg-white dark:bg-card border-none shadow-sm rounded-2xl text-xs md:text-sm"
                  />
                </div>

                <Card className="border shadow-sm rounded-3xl bg-white dark:bg-card overflow-hidden">
                  <ScrollArea className="h-[520px]">
                    <Table>
                      <TableHeader className="bg-slate-50 dark:bg-muted/50 sticky top-0 z-10">
                        <TableRow>
                          <TableHead className="text-[10px] font-bold uppercase px-4 md:px-6">Código / Fecha</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase">Ruta</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase">Solicitante</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase text-center">Ítems</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase text-center">Estado</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredInternalOrders.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-24 text-slate-400 italic text-xs">
                              No se encontraron requisiciones registradas.
                            </TableCell>
                          </TableRow>
                        ) : filteredInternalOrders.map((o: any) => (
                          <TableRow key={o.id} className="hover:bg-slate-50 dark:hover:bg-muted/30">
                            <TableCell className="px-4 md:px-6 py-4">
                              <div className="flex flex-col">
                                <span className="font-mono font-black text-xs text-slate-700 dark:text-foreground">{o.code}</span>
                                <span className="text-[9px] text-slate-400 font-bold">{new Date(o.createdAt).toLocaleDateString()}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-foreground">
                                <span>{o.sourceWarehouse}</span>
                                <ArrowRight size={10} className="text-slate-400" />
                                <span className="text-violet-600">{o.destinationWarehouse}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs font-bold text-slate-500 dark:text-muted-foreground">{o.requestedBy}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="text-[9px] bg-slate-50 border-slate-200">
                                {o.items?.length || 0} productos
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center gap-1">
                                <Badge className={`font-black text-[9px] h-5 ${
                                  o.status === 'PENDIENTE' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                  o.status === 'DESPACHADO' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                  'bg-emerald-50 text-emerald-600 border-emerald-100'
                                }`} variant="outline">
                                  {o.status}
                                </Badge>
                                
                                {/* Acciones rápidas de cambio de estado */}
                                {o.status === 'PENDIENTE' && (
                                  <Button 
                                    size="sm" 
                                    onClick={() => handleUpdateInternalStatus(o.id, o.status, 'DESPACHADO')}
                                    className="h-6 px-2 text-[9px] font-bold bg-blue-600 text-white rounded-md mt-1"
                                  >
                                    Despachar
                                  </Button>
                                )}
                                {o.status === 'DESPACHADO' && (
                                  <Button 
                                    size="sm" 
                                    onClick={() => handleUpdateInternalStatus(o.id, o.status, 'RECIBIDO')}
                                    className="h-6 px-2 text-[9px] font-bold bg-emerald-600 text-white rounded-md mt-1"
                                  >
                                    Confirmar Recibido
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="px-4">
                              <div className="flex gap-1 items-center">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7 text-slate-400 hover:text-blue-500" 
                                  onClick={() => {
                                    setSelectedOrderForPreview(o);
                                    setPreviewType('interno');
                                  }}
                                >
                                  <Eye size={12} />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7 text-slate-400 hover:text-rose-500" 
                                  onClick={() => handleDeleteInternalOrder(o.id)}
                                >
                                  <Trash2 size={12} />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </Card>
              </div>

            </div>
          </TabsContent>

          {/* ==================== TAB PEDIDOS EXTERNOS ==================== */}
          <TabsContent value="externo" className="space-y-6 outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Formulario Nueva Orden Proveedor */}
              <div className="lg:col-span-5 space-y-6">
                <Card className="border shadow-sm rounded-3xl bg-white dark:bg-card overflow-hidden">
                  <CardHeader className="bg-slate-900 dark:bg-slate-950 text-white p-5">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Building2 size={18} className="text-violet-400" /> Nueva Orden de Pedido a Proveedor
                    </CardTitle>
                    <CardDescription className="text-slate-400 text-xs">Cree cotizaciones u órdenes formales de compra.</CardDescription>
                  </CardHeader>
                  
                  <CardContent className="p-6 space-y-4">
                    <form onSubmit={handleCreateSupplierOrder} className="space-y-4">
                      
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Seleccionar Proveedor</Label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <Input 
                              placeholder="Seleccione de la lista..." 
                              value={extSupplier}
                              onChange={e => setExtSupplier(e.target.value)}
                              className="h-10 pl-9 bg-slate-50 dark:bg-muted border-none rounded-xl text-xs font-bold"
                            />
                          </div>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl bg-card border border-slate-200">
                                <Search size={16} />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 p-0" align="end">
                              <div className="p-3 border-b">
                                <Input 
                                  placeholder="Buscar proveedor..." 
                                  value={supplierSearchQuery} 
                                  onChange={e => setSupplierSearchQuery(e.target.value)} 
                                  className="h-8 text-xs bg-muted border-none" 
                                />
                              </div>
                              <ScrollArea className="h-48">
                                {filteredSuppliers.length === 0 ? (
                                  <div className="p-4 text-center text-slate-400 text-xs italic">No hay proveedores registrados</div>
                                ) : filteredSuppliers.map((s: any) => (
                                  <div 
                                    key={s.id} 
                                    onClick={() => {
                                      setExtSupplier(s.name);
                                      toast({ title: "Cargado", description: `Proveedor ${s.name} seleccionado.` });
                                    }} 
                                    className="p-3 hover:bg-slate-50 dark:hover:bg-muted cursor-pointer rounded-lg transition-colors border-b last:border-0"
                                  >
                                    <span className="text-xs font-bold text-slate-800 dark:text-foreground block">{s.name}</span>
                                    <span className="text-[9px] font-mono text-slate-400">NIT: {s.nit}</span>
                                  </div>
                                ))}
                              </ScrollArea>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Bodega de Recepción</Label>
                          <Select value={extDestWh} onValueChange={setExtDestWh}>
                            <SelectTrigger className="h-10 bg-slate-50 dark:bg-muted border-none rounded-xl text-xs font-bold">
                              <SelectValue placeholder="Bodega..." />
                            </SelectTrigger>
                            <SelectContent>
                              {warehouses?.map(w => (
                                <SelectItem key={w.id} value={w.name} className="text-xs">{w.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Responsable de Orden</Label>
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                            <Input 
                              placeholder="Nombre..." 
                              value={extRequestedBy}
                              onChange={e => setExtRequestedBy(e.target.value)}
                              className="pl-8 h-10 bg-slate-50 dark:bg-muted border-none rounded-xl text-xs font-bold"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Cargar Ítems Manualmente */}
                      <div className="p-4 bg-slate-50 dark:bg-muted/30 rounded-2xl border space-y-3">
                        <Label className="text-[10px] font-black uppercase text-slate-500 block tracking-widest">Añadir Productos</Label>
                        <div className="grid grid-cols-4 gap-2">
                          <div className="col-span-2 space-y-1">
                            <Label className="text-[9px] font-bold text-slate-400">Producto / SKU</Label>
                            <Select value={extItemSku} onValueChange={setExtItemSku}>
                              <SelectTrigger className="h-9 bg-white dark:bg-card border-slate-200 text-xs font-semibold rounded-lg">
                                <SelectValue placeholder="SKU..." />
                              </SelectTrigger>
                              <SelectContent>
                                {inventory?.map(p => (
                                  <SelectItem key={p.id} value={p.sku} className="text-xs">{p.sku} - {p.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[9px] font-bold text-slate-400">Cant.</Label>
                            <Input 
                              type="number" 
                              value={extItemQty} 
                              onChange={e => setExtItemQty(e.target.value)}
                              className="h-9 bg-white dark:bg-card text-center text-xs font-bold"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[9px] font-bold text-slate-400">Costo ($)</Label>
                            <Input 
                              type="number" 
                              placeholder="0.00"
                              value={extItemCost} 
                              onChange={e => setExtItemCost(e.target.value)}
                              className="h-9 bg-white dark:bg-card text-right text-xs font-bold text-emerald-600"
                            />
                          </div>
                        </div>

                        <Button 
                          type="button" 
                          onClick={handleExtAddItem} 
                          variant="outline" 
                          className="w-full h-9 border-violet-500/20 text-violet-600 dark:text-violet-400 font-bold text-xs rounded-xl"
                        >
                          <Plus size={14} className="mr-1.5" /> Agregar Ítem
                        </Button>
                      </div>

                      {/* Lista de Ítems */}
                      {extItems.length > 0 && (
                        <div className="space-y-2 pt-2 border-t">
                          <div className="flex justify-between items-center">
                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Detalle de Pedido</Label>
                            <span className="text-xs font-black text-emerald-600">Total: ${extItems.reduce((acc, item) => acc + ((item.cost || 0) * item.quantity), 0).toFixed(2)}</span>
                          </div>
                          <ScrollArea className="h-32 border rounded-xl bg-slate-50 dark:bg-muted/20">
                            <Table>
                              <TableBody>
                                {extItems.map((item, idx) => (
                                  <TableRow key={idx} className="hover:bg-transparent">
                                    <TableCell className="py-2 text-[10px] font-mono font-bold text-slate-600 dark:text-muted-foreground">{item.sku}</TableCell>
                                    <TableCell className="py-2 text-[11px] font-bold text-slate-800 dark:text-foreground">{item.name}</TableCell>
                                    <TableCell className="py-2 text-center text-[10px] font-bold">{item.quantity}x</TableCell>
                                    <TableCell className="py-2 text-right text-[10px] font-bold text-emerald-600">${((item.cost || 0) * item.quantity).toFixed(2)}</TableCell>
                                    <TableCell className="py-2 text-right">
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-6 w-6 text-slate-400 hover:text-rose-500"
                                        onClick={() => setExtItems(prev => prev.filter(i => i.sku !== item.sku))}
                                      >
                                        <Trash2 size={12} />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </ScrollArea>
                        </div>
                      )}

                      <Button 
                        type="submit" 
                        className="w-full h-12 bg-slate-900 dark:bg-violet-600 hover:bg-slate-800 text-white font-bold rounded-xl shadow-lg text-xs"
                        disabled={loading || extItems.length === 0}
                      >
                        {loading ? <Loader2 className="animate-spin mr-2" /> : <Plus className="mr-2" size={16} />}
                        GENERAR ORDEN DE PEDIDO
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>

              {/* Historial de Pedidos Proveedores */}
              <div className="lg:col-span-7 space-y-4">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <Input 
                    placeholder="Buscar orden externa por código, proveedor o bodega..." 
                    value={externalSearchFilter}
                    onChange={e => setExternalSearchFilter(e.target.value)}
                    className="pl-12 h-12 bg-white dark:bg-card border-none shadow-sm rounded-2xl text-xs md:text-sm"
                  />
                </div>

                <Card className="border shadow-sm rounded-3xl bg-white dark:bg-card overflow-hidden">
                  <ScrollArea className="h-[520px]">
                    <Table>
                      <TableHeader className="bg-slate-50 dark:bg-muted/50 sticky top-0 z-10">
                        <TableRow>
                          <TableHead className="text-[10px] font-bold uppercase px-4 md:px-6">Código / Fecha</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase">Proveedor</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase">Destino</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase text-right">Inversión</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase text-center">Estado</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSupplierOrders.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-24 text-slate-400 italic text-xs">
                              No se encontraron órdenes registradas.
                            </TableCell>
                          </TableRow>
                        ) : filteredSupplierOrders.map((o: any) => (
                          <TableRow key={o.id} className="hover:bg-slate-50 dark:hover:bg-muted/30">
                            <TableCell className="px-4 md:px-6 py-4">
                              <div className="flex flex-col">
                                <span className="font-mono font-black text-xs text-slate-700 dark:text-foreground">{o.code}</span>
                                <span className="text-[9px] text-slate-400 font-bold">{new Date(o.createdAt).toLocaleDateString()}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs font-bold text-slate-800 dark:text-foreground">{o.supplier}</TableCell>
                            <TableCell className="text-xs font-semibold text-slate-500 dark:text-muted-foreground flex items-center gap-1 mt-3">
                              <Warehouse size={12} className="text-slate-400" />
                              <span>{o.destinationWarehouse}</span>
                            </TableCell>
                            <TableCell className="text-right text-xs font-black text-emerald-600">${o.total?.toFixed(2)}</TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center gap-1">
                                <Badge className={`font-black text-[9px] h-5 ${
                                  o.status === 'SOLICITADO' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                  'bg-emerald-50 text-emerald-600 border-emerald-100'
                                }`} variant="outline">
                                  {o.status}
                                </Badge>
                                
                                {o.status === 'SOLICITADO' && (
                                  <Button 
                                    size="sm" 
                                    onClick={() => handleUpdateSupplierOrderStatus(o.id, 'RECIBIDO')}
                                    className="h-6 px-2 text-[9px] font-bold bg-emerald-600 text-white rounded-md mt-1"
                                  >
                                    Cargar Stock
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="px-4">
                              <div className="flex gap-1 items-center">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7 text-slate-400 hover:text-blue-500" 
                                  onClick={() => {
                                    setSelectedOrderForPreview(o);
                                    setPreviewType('externo');
                                  }}
                                >
                                  <Eye size={12} />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7 text-slate-400 hover:text-rose-500" 
                                  onClick={() => handleDeleteSupplierOrder(o.id)}
                                >
                                  <Trash2 size={12} />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </Card>
              </div>

            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ==================== MODAL DE VISTA PREVIA & IMPRESIÓN DE ORDEN ==================== */}
      {selectedOrderForPreview && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white dark:bg-card border w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            
            {/* Header Modal */}
            <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Printer size={18} className="text-violet-400" />
                <span className="font-bold text-sm">Vista Previa del Documento</span>
              </div>
              <Badge className="font-mono bg-violet-600 text-white font-bold">{selectedOrderForPreview.code}</Badge>
            </div>

            {/* Area de Impresión */}
            <ScrollArea className="flex-1 p-6 md:p-8 bg-white dark:bg-slate-950 font-sans" id="order-print-area">
              <div className="space-y-6 text-slate-800 dark:text-slate-200">
                
                {/* Logo & Identificacion */}
                <div className="flex justify-between items-start border-b pb-6">
                  <div>
                    <h2 className="text-2xl font-black text-indigo-600 tracking-tight">NEXWAY S.A. DE C.V.</h2>
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Centro de Distribución Logística</p>
                    <p className="text-xs text-slate-500 mt-1">San Salvador, El Salvador</p>
                    <p className="text-xs text-slate-500">Tel: +503 2200-0000 | info@nexway.com</p>
                  </div>
                  <div className="text-right">
                    <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase">
                      {previewType === 'interno' ? 'Requisición Interna' : 'Orden de Compra'}
                    </h3>
                    <p className="text-xs font-mono font-bold text-violet-600 mt-1">{selectedOrderForPreview.code}</p>
                    <p className="text-[10px] text-slate-400 font-bold mt-1">Fecha Emisión: {new Date(selectedOrderForPreview.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>

                {/* Detalles de Ruta / Sujeto */}
                <div className="grid grid-cols-2 gap-6 bg-slate-50 dark:bg-muted/30 p-4 rounded-2xl border">
                  {previewType === 'interno' ? (
                    <>
                      <div>
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Bodega Suministradora</span>
                        <p className="text-sm font-bold text-slate-800 dark:text-white mt-0.5">{selectedOrderForPreview.sourceWarehouse}</p>
                        <p className="text-xs text-slate-500">Distribución local autorizada</p>
                      </div>
                      <div>
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Bodega Solicitante (Tienda)</span>
                        <p className="text-sm font-bold text-violet-600 mt-0.5">{selectedOrderForPreview.destinationWarehouse}</p>
                        <p className="text-xs text-slate-500">Destino del stock solicitado</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Proveedor Destinatario</span>
                        <p className="text-sm font-bold text-slate-800 dark:text-white mt-0.5">{selectedOrderForPreview.supplier}</p>
                        <p className="text-xs text-slate-500">Directorio de Suministrantes Oficiales</p>
                      </div>
                      <div>
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Bodega de Destino / Entrega</span>
                        <p className="text-sm font-bold text-violet-600 mt-0.5">{selectedOrderForPreview.destinationWarehouse}</p>
                        <p className="text-xs text-slate-500">Punto de recepción de mercancía</p>
                      </div>
                    </>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Encargado de Gestión</span>
                    <p className="text-xs font-bold text-slate-700 dark:text-foreground mt-0.5">{selectedOrderForPreview.requestedBy}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Estado Actual</span>
                    <p className="text-xs font-bold mt-0.5 uppercase text-violet-600">{selectedOrderForPreview.status}</p>
                  </div>
                </div>

                {/* Tabla de Productos */}
                <div className="border rounded-2xl overflow-hidden mt-4">
                  <Table>
                    <TableHeader className="bg-slate-50 dark:bg-muted/50">
                      <TableRow>
                        <TableHead className="px-4 text-[9px] font-black uppercase">SKU</TableHead>
                        <TableHead className="text-[9px] font-black uppercase">Descripción del Producto</TableHead>
                        <TableHead className="text-center text-[9px] font-black uppercase">Cantidad</TableHead>
                        {previewType === 'externo' && (
                          <>
                            <TableHead className="text-right text-[9px] font-black uppercase">Precio Unitario</TableHead>
                            <TableHead className="text-right text-[9px] font-black uppercase">Subtotal</TableHead>
                          </>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedOrderForPreview.items?.map((item: any, idx: number) => (
                        <TableRow key={idx} className="border-b last:border-0 hover:bg-transparent">
                          <TableCell className="px-4 py-3 font-mono text-[10px] font-bold text-slate-600">{item.sku}</TableCell>
                          <TableCell className="text-xs font-bold text-slate-800">{item.name}</TableCell>
                          <TableCell className="text-center text-xs font-black">{item.quantity} un.</TableCell>
                          {previewType === 'externo' && (
                            <>
                              <TableCell className="text-right text-xs font-bold text-slate-500">${(item.cost || 0).toFixed(2)}</TableCell>
                              <TableCell className="text-right text-xs font-black text-slate-800">${((item.cost || 0) * item.quantity).toFixed(2)}</TableCell>
                            </>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Total en Orden de Compra */}
                {previewType === 'externo' && (
                  <div className="flex justify-end pt-4">
                    <div className="w-64 bg-slate-50 dark:bg-muted/10 p-4 rounded-2xl border text-right">
                      <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Total de Inversión</span>
                      <p className="text-2xl font-black text-emerald-600 mt-1">${selectedOrderForPreview.total?.toFixed(2)}</p>
                      <p className="text-[8px] text-slate-400 mt-1 font-semibold">Sujeto a percepción de IVA del 1% si aplica</p>
                    </div>
                  </div>
                )}

                {/* Terminos y Firmas */}
                <div className="pt-12 grid grid-cols-2 gap-12 text-center text-xs text-slate-400">
                  <div className="space-y-4">
                    <div className="border-t border-dashed w-48 mx-auto pt-2 font-bold text-[10px] uppercase text-slate-500">Firma Encargado</div>
                    <p className="text-[8px]">Emitido y aprobado digitalmente por {selectedOrderForPreview.requestedBy}</p>
                  </div>
                  <div className="space-y-4">
                    <div className="border-t border-dashed w-48 mx-auto pt-2 font-bold text-[10px] uppercase text-slate-500">Autorización CD</div>
                    <p className="text-[8px]">NexWay Centro de Control y Despacho</p>
                  </div>
                </div>

              </div>
            </ScrollArea>

            {/* Footer Modal */}
            <div className="p-4 bg-slate-50 dark:bg-muted/50 border-t flex justify-end gap-3">
              <Button 
                variant="outline" 
                onClick={() => setSelectedOrderForPreview(null)}
                className="h-10 text-xs font-bold rounded-xl"
              >
                Cerrar
              </Button>
              <Button 
                onClick={() => {
                  window.print();
                }}
                className="h-10 bg-violet-600 hover:bg-violet-750 text-white font-bold text-xs rounded-xl"
              >
                <Printer size={14} className="mr-1.5" /> Imprimir Documento
              </Button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
