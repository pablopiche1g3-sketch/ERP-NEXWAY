
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  ArrowLeftRight, 
  ArrowLeft, 
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
  User
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRouter } from 'next/navigation';
import { ModeToggle } from '@/components/mode-toggle';

interface TransferItem {
  id: string;
  sku: string;
  name: string;
  quantity: number;
}

export default function TransfersPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('solicitud');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [activeBranchId, setActiveBranchId] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('activeBranchId');
      if (stored) setActiveBranchId(stored);
    }

    const handleBranchChange = () => {
      const stored = localStorage.getItem('activeBranchId');
      if (stored) setActiveBranchId(stored);
    };

    window.addEventListener('branchChanged', handleBranchChange);
    return () => window.removeEventListener('branchChanged', handleBranchChange);
  }, []);

  // States para el traslado
  const [transferType, setTransferType] = useState<'INTERNO' | 'INTERTIENDA'>('INTERNO');
  const [sourceWarehouse, setSourceWarehouse] = useState('');
  const [destinationWarehouse, setDestinationWarehouse] = useState('');
  const [destinationStore, setDestinationStore] = useState('');
  const [authorizedBy, setAuthorizedBy] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<TransferItem[]>([]);
  const [isPreTransfer, setIsPreTransfer] = useState(false);

  // Estados de datos
  const [inventory, setInventory] = useState<any[]>([]);
  const [loadingInv, setLoadingInv] = useState(true);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);

  const sourceWhOptions = useMemo(() => {
    if (!warehouses) return [];
    if (activeTab === 'solicitud') {
      return warehouses.filter(w => w.branch_id !== activeBranchId);
    } else {
      return activeBranchId ? warehouses.filter(w => w.branch_id === activeBranchId) : warehouses;
    }
  }, [warehouses, activeTab, activeBranchId]);

  const destWhOptions = useMemo(() => {
    if (!warehouses) return [];
    if (activeTab === 'solicitud') {
      return warehouses.filter(w => w.branch_id === activeBranchId);
    } else {
      return activeBranchId ? warehouses.filter(w => w.branch_id === activeBranchId) : warehouses;
    }
  }, [warehouses, activeTab, activeBranchId]);

  const loadData = async () => {
    try {
      setLoadingInv(true);
      
      // 1. Cargar bodegas
      const { data: whData } = await supabase.from('warehouses').select('*').order('name');
      setWarehouses(whData || []);

      // 2. Cargar traslados
      const { data: trData } = await supabase.from('transfers').select('*').order('created_at', { ascending: false });
      setTransfers((trData || []).map(t => ({
        id: t.id,
        type: t.type,
        source: t.source,
        destination: t.destination,
        authorizedBy: t.authorized_by,
        items: t.items,
        timestamp: t.created_at,
        status: t.status
      })));

      // 3. Cargar catálogo de inventario maestro y stock consolidado por bodega
      const { data: invData } = await supabase.from('inventory').select('*').order('sku');
      const { data: stockData } = await supabase.from('inventory_stock').select('*');

      const whMap: Record<string, string> = {};
      (whData || []).forEach(w => {
        whMap[w.id] = w.name;
      });

      const mappedInventory = (invData || []).map(item => {
        const itemStocks = (stockData || []).filter(s => s.sku === item.sku);
        const bodegasMap: Record<string, number> = {};
        itemStocks.forEach(s => {
          const whName = whMap[s.warehouse_id];
          if (whName) {
            bodegasMap[whName] = parseFloat(s.quantity) || 0;
          }
        });

        // En Traslados, la cantidad global del producto para la lista del catálogo
        // se puede ver reflejada como el total consolidado o el stock de la bodega origen seleccionada.
        // Para que sea útil en el front-end de traslados, mostraremos la cantidad global consolidada.
        const totalQty = Object.values(bodegasMap).reduce((sum, val) => sum + val, 0);

        return {
          id: item.sku,
          sku: item.sku,
          name: item.name,
          category: item.category,
          price: parseFloat(item.price) || 0,
          quantity: totalQty,
          bodegas: bodegasMap
        };
      });

      setInventory(mappedInventory);

    } catch (e) {
      console.error("Error al cargar datos en traslados:", e);
    } finally {
      setLoadingInv(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredInventory = useMemo(() => {
    if (!inventory) return [];
    return inventory.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.sku.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, inventory]);

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: Number(item.quantity || 0) + 1 } : item);
      }
      return [...prev, { id: product.id, sku: product.sku, name: product.name, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => setCart(prev => prev.filter(item => item.id !== id));
  
  const updateQuantity = (id: string, qty: number) => {
    if (qty < 1) return;
    setCart(prev => prev.map(item => item.id === id ? { ...item, quantity: qty } : item));
  };

  const handleProcessTransfer = async () => {
    if (cart.length === 0 || !sourceWarehouse || !authorizedBy) {
      toast({ variant: "destructive", title: "Faltan datos", description: "Complete origen, ítems y responsable." });
      return;
    }

    if (transferType === 'INTERNO' && (!destinationWarehouse || sourceWarehouse === destinationWarehouse)) {
      toast({ variant: "destructive", title: "Destino inválido", description: "Seleccione una bodega de destino diferente al origen." });
      return;
    }

    if (transferType === 'INTERTIENDA' && !destinationStore) {
      toast({ variant: "destructive", title: "Tienda de destino requerida" });
      return;
    }

    setIsProcessing(true);
    try {
      // 1. Guardar el registro de traslado en public.transfers
      const isPeticion = activeTab === 'solicitud';
      const transferData = {
        type: transferType,
        source: sourceWarehouse,
        destination: transferType === 'INTERNO' ? destinationWarehouse : destinationStore,
        authorized_by: authorizedBy,
        items: cart,
        status: isPeticion ? 'PETICION' : 'COMPLETADO'
      };

      const { error: insertErr } = await supabase.from('transfers').insert(transferData);
      if (insertErr) throw insertErr;

      // 2. Lógica de Inventario Multibodega (Solo si no es petición)
      if (!isPeticion) {
        const whOrigen = warehouses.find(w => w.name === sourceWarehouse);
        const whDestino = transferType === 'INTERNO' ? warehouses.find(w => w.name === destinationWarehouse) : null;

        if (!whOrigen) {
          toast({ variant: "destructive", title: "Error", description: "No se encontró la bodega de origen." });
          setIsProcessing(false);
          return;
        }

        for (const item of cart) {
          // Restar de bodega origen
          const { data: stockOrig } = await supabase
            .from('inventory_stock')
            .select('*')
            .eq('sku', item.sku)
            .eq('warehouse_id', whOrigen.id)
            .maybeSingle();

          const currentOrigQty = stockOrig ? parseFloat(stockOrig.quantity) || 0 : 0;
          await supabase.from('inventory_stock').upsert({
            sku: item.sku,
            warehouse_id: whOrigen.id,
            quantity: Math.max(0, currentOrigQty - item.quantity)
          }, { onConflict: 'sku,warehouse_id' });

          // Sumar a bodega de destino si es traslado interno
          if (transferType === 'INTERNO' && whDestino) {
            const { data: stockDest } = await supabase
              .from('inventory_stock')
              .select('*')
              .eq('sku', item.sku)
              .eq('warehouse_id', whDestino.id)
              .maybeSingle();

            const currentDestQty = stockDest ? parseFloat(stockDest.quantity) || 0 : 0;
            await supabase.from('inventory_stock').upsert({
              sku: item.sku,
              warehouse_id: whDestino.id,
              quantity: currentDestQty + item.quantity
            }, { onConflict: 'sku,warehouse_id' });
          }
        }
      }

      toast({ 
        title: isPeticion ? "Solicitud Registrada" : "Traslado Procesado", 
        description: isPeticion ? "La solicitud de traslado ha sido registrada como Petición." : "El movimiento ha sido registrado exitosamente." 
      });
      setCart([]);
      setSourceWarehouse('');
      setDestinationWarehouse('');
      setDestinationStore('');
      setAuthorizedBy('');
      setIsPreTransfer(false);
      await loadData();
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Error", description: "No se pudo procesar el traslado." });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendTransfer = async (transfer: any) => {
    setIsProcessing(true);
    try {
      const whOrigen = warehouses.find(w => w.name === transfer.source);
      if (!whOrigen) {
        toast({ variant: "destructive", title: "Error", description: "No se encontró la bodega de origen." });
        setIsProcessing(false);
        return;
      }

      for (const item of transfer.items) {
        const { data: stockOrig } = await supabase
          .from('inventory_stock')
          .select('*')
          .eq('sku', item.sku)
          .eq('warehouse_id', whOrigen.id)
          .maybeSingle();

        const currentOrigQty = stockOrig ? parseFloat(stockOrig.quantity) || 0 : 0;
        await supabase.from('inventory_stock').upsert({
          sku: item.sku,
          warehouse_id: whOrigen.id,
          quantity: Math.max(0, currentOrigQty - item.quantity)
        }, { onConflict: 'sku,warehouse_id' });
      }

      const { error } = await supabase
        .from('transfers')
        .update({ status: 'ENVIADO' })
        .eq('id', transfer.id);

      if (error) throw error;

      toast({ title: "Mercadería Enviada", description: "El stock fue descargado de la bodega de origen y está en tránsito." });
      await loadData();
    } catch (err: any) {
      console.error(err);
      toast({ variant: "destructive", title: "Error", description: err.message || "No se pudo realizar el envío." });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReceiveTransfer = async (transfer: any) => {
    setIsProcessing(true);
    try {
      const whDestino = warehouses.find(w => w.name === transfer.destination);
      if (whDestino) {
        for (const item of transfer.items) {
          const { data: stockDest } = await supabase
            .from('inventory_stock')
            .select('*')
            .eq('sku', item.sku)
            .eq('warehouse_id', whDestino.id)
            .maybeSingle();

          const currentDestQty = stockDest ? parseFloat(stockDest.quantity) || 0 : 0;
          await supabase.from('inventory_stock').upsert({
            sku: item.sku,
            warehouse_id: whDestino.id,
            quantity: currentDestQty + item.quantity
          }, { onConflict: 'sku,warehouse_id' });
        }
      }

      const { error } = await supabase
        .from('transfers')
        .update({ status: 'RECIBIDO' })
        .eq('id', transfer.id);

      if (error) throw error;

      toast({ title: "Mercadería Recepcionada", description: "El stock fue cargado exitosamente en el destino." });
      await loadData();
    } catch (err: any) {
      console.error(err);
      toast({ variant: "destructive", title: "Error", description: err.message || "No se pudo completar la recepción." });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent p-4 md:p-6 transition-colors duration-300 relative overflow-hidden">
<div className="max-w-7xl mx-auto flex items-center justify-between mb-8 gap-4 bg-white/5 dark:bg-white/5 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-2xl p-4 md:p-5 relative z-10">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="w-10 h-10 rounded-xl bg-white/5 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10" onClick={() => router.push('/')}>
            <ArrowLeft className="text-foreground" size={20} />
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground font-headline leading-tight">Centro de Traslados</h1>
            <p className="text-muted-foreground text-xs md:text-sm">Gestión de logística interna e inter-sucursal</p>
          </div>
        </div>
        <ModeToggle />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white/5 dark:bg-white/5 backdrop-blur-md border border-slate-200 dark:border-white/10 p-1 rounded-2xl flex w-fit gap-2">
            <TabsTrigger value="solicitud" className="rounded-xl px-8 font-bold data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all text-xs md:text-sm">
              <Plus size={14} className="mr-2"/> Solicitud de Traslado
            </TabsTrigger>
            <TabsTrigger value="nuevo" className="rounded-xl px-8 font-bold data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all text-xs md:text-sm">
              <Plus size={14} className="mr-2"/> Nuevo Traslado Directo
            </TabsTrigger>
            <TabsTrigger value="historial" className="rounded-xl px-8 font-bold data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all text-xs md:text-sm">
              <History size={14} className="mr-2"/> Historial Logístico
            </TabsTrigger>
          </TabsList>

          {(activeTab === 'solicitud' || activeTab === 'nuevo') && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 outline-none animate-in fade-in duration-300">
            <div className="lg:col-span-5 space-y-4">
              <Card className="bg-white/5 dark:bg-white/5 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden">
                <CardHeader className="border-b border-white/10 text-white bg-white/5 p-5">
                  <div className="flex justify-between items-center mb-2">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <ClipboardList size={18} /> Detalle del Traslado
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px] text-indigo-400 border-indigo-400 uppercase">
                      {transferType}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[300px]">
                    <Table>
                      <TableHeader className="bg-slate-50/50 dark:bg-zinc-950/40 sticky top-0 z-10">
                        <TableRow>
                          <TableHead className="w-[50px] text-[10px] px-3 text-center">Cant</TableHead>
                          <TableHead className="text-[10px]">Producto</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cart.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center py-20 text-muted-foreground italic text-xs">
                              Seleccione productos para trasladar
                            </TableCell>
                          </TableRow>
                        ) : cart.map((item) => (
                          <TableRow key={item.id} className="hover:bg-muted/30">
                            <TableCell className="px-3">
                              <Input 
                                type="number" 
                                value={item.quantity}
                                onFocus={e => e.target.select()}
                                onChange={e => updateQuantity(item.id, parseInt(e.target.value) || 1)}
                                className="h-8 w-14 text-center font-bold text-indigo-600 dark:text-indigo-400 rounded-lg bg-card border"
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-bold text-xs text-foreground">{item.name}</span>
                                <span className="text-[9px] text-muted-foreground uppercase font-mono">{item.sku}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" onClick={() => removeFromCart(item.id)} className="h-8 w-8 text-muted-foreground hover:text-rose-500">
                                <Trash2 size={14} />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                  <div className="p-6 border-t border-white/10 bg-slate-50/20 dark:bg-zinc-950/20 space-y-4">
                     <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Responsable / Autorizado por</Label>
                        <div className="relative">
                           <User className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                           <Input 
                              placeholder="Nombre de quien autoriza..." 
                              value={authorizedBy}
                              onChange={e => setAuthorizedBy(e.target.value)}
                              className="h-10 pl-9 bg-card border rounded-xl text-xs font-bold text-foreground"
                           />
                        </div>
                     </div>
                  </div>
                </CardContent>
              </Card>
              <Button 
                className="w-full h-16 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-lg shadow-xl border-none active:scale-95 transition-all" 
                disabled={isProcessing || cart.length === 0}
                onClick={handleProcessTransfer}
              >
                {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <ArrowLeftRight className="mr-2" />}
                {activeTab === 'solicitud' ? 'ENVIAR SOLICITUD' : 'PROCESAR MOVIMIENTO'}
              </Button>
            </div>

            <div className="lg:col-span-7 space-y-4">
              <Card className="bg-white/5 dark:bg-white/5 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-2xl p-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                       <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Tipo de Traslado</Label>
                       <div className="flex gap-2">
                          <Button 
                            variant={transferType === 'INTERNO' ? 'default' : 'outline'} 
                            className="flex-1 rounded-xl h-12 text-xs font-bold transition-all shadow-sm px-2"
                            onClick={() => setTransferType('INTERNO')}
                          >
                             <Warehouse size={16} className="mr-1 lg:mr-2" /> Interno
                          </Button>
                          <Button 
                            variant={transferType === 'INTERTIENDA' ? 'default' : 'outline'} 
                            className="flex-1 rounded-xl h-12 text-xs font-bold transition-all shadow-sm px-2"
                            onClick={() => setTransferType('INTERTIENDA')}
                          >
                             <Truck size={16} className="mr-1 lg:mr-2" /> Inter-Tienda
                          </Button>
                       </div>
                    </div>
                    
                     {activeTab !== 'solicitud' && (
                       <div className="space-y-4">
                          <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Modalidad de Envío</Label>
                          <div className="flex gap-2">
                             <Button 
                               variant={!isPreTransfer ? 'default' : 'outline'} 
                               className="flex-1 rounded-xl h-12 text-xs font-bold transition-all shadow-sm px-2"
                               onClick={() => setIsPreTransfer(false)}
                             >
                                Directo
                             </Button>
                             <Button 
                               variant={isPreTransfer ? 'default' : 'outline'} 
                               className="flex-1 rounded-xl h-12 text-xs font-bold transition-all shadow-sm px-2"
                               onClick={() => setIsPreTransfer(true)}
                             >
                                Pre-traslado
                             </Button>
                          </div>
                       </div>
                     )}
 
                     <div className="space-y-4 md:col-span-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Ruta Logística</Label>
                        <div className="flex items-center gap-3">
                           <div className="flex-1">
                              <Select value={sourceWarehouse} onValueChange={setSourceWarehouse}>
                                 <SelectTrigger className="rounded-xl h-12 bg-card border text-xs text-foreground"><SelectValue placeholder="Origen" /></SelectTrigger>
                                 <SelectContent className="rounded-xl">
                                    {sourceWhOptions?.map((wh: any) => (
                                       <SelectItem key={wh.id} value={wh.name}>{wh.name}</SelectItem>
                                    ))}
                                 </SelectContent>
                              </Select>
                           </div>
                           <ArrowRight size={20} className="text-muted-foreground" />
                           <div className="flex-1">
                              {transferType === 'INTERNO' ? (
                                 <Select value={destinationWarehouse} onValueChange={setDestinationWarehouse}>
                                    <SelectTrigger className="rounded-xl h-12 bg-card border text-xs text-foreground"><SelectValue placeholder="Destino" /></SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                       {destWhOptions?.filter(w => w.name !== sourceWarehouse).map((wh: any) => (
                                          <SelectItem key={wh.id} value={wh.name}>{wh.name}</SelectItem>
                                       ))}
                                    </SelectContent>
                                 </Select>
                              ) : (
                                 <Select value={destinationStore} onValueChange={setDestinationStore}>
                                    <SelectTrigger className="rounded-xl h-12 bg-card border text-xs text-foreground"><SelectValue placeholder="Tienda Destino" /></SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                       {destWhOptions?.filter(w => w.name !== sourceWarehouse).map((wh: any) => (
                                          <SelectItem key={wh.id} value={wh.name}>{wh.name}</SelectItem>
                                       ))}
                                    </SelectContent>
                                 </Select>
                              )}
                           </div>
                        </div>
                     </div>
                 </div>
              </Card>

              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input 
                  placeholder="Buscar productos en inventario..." 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
                  className="pl-12 h-12 bg-card border rounded-2xl text-xs text-foreground" 
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {filteredInventory.map((p: any) => (
                  <div key={p.id} onClick={() => addToCart(p)} className="bg-white dark:bg-white/5 p-3 rounded-2xl shadow-sm border border-slate-100 dark:border-white/10 hover:border-indigo-400 dark:hover:border-indigo-400 cursor-pointer transition-all flex flex-col justify-between aspect-square group">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400">{p.sku}</p>
                      <h3 className="text-xs font-bold text-slate-900 leading-tight line-clamp-2 h-8">{p.name}</h3>
                    </div>
                    <div className="mt-2 pt-2 border-t border-white/10 flex justify-between items-center">
                      <Badge variant="secondary" className="text-[9px] bg-slate-50 dark:bg-white/10 text-slate-500 dark:text-slate-300">{p.quantity} un.</Badge>
                      <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white dark:group-hover:text-white transition-all">
                        <Plus size={16} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

          <TabsContent value="historial" className="space-y-4 outline-none animate-in fade-in duration-300">
            <Card className="border border-slate-200/60 dark:border-zinc-800/60 shadow-md rounded-2xl bg-white/80 dark:bg-zinc-900/40 backdrop-blur-md overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50/50 dark:bg-zinc-950/40 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="px-6 text-xs text-muted-foreground">Fecha / Hora</TableHead>
                    <TableHead className="text-xs text-muted-foreground">Tipo</TableHead>
                    <TableHead className="text-xs text-muted-foreground">Ruta (Origen &rarr; Destino)</TableHead>
                    <TableHead className="text-xs text-muted-foreground">Productos</TableHead>
                    <TableHead className="text-xs text-muted-foreground">Autoriza</TableHead>
                    <TableHead className="text-center px-6 text-xs text-muted-foreground">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transfers?.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-20 text-muted-foreground italic text-xs">No hay traslados registrados.</TableCell></TableRow>
                  ) : transfers?.map((t: any) => (
                    <TableRow key={t.id} className="hover:bg-muted/30">
                      <TableCell className="px-6 text-xs text-muted-foreground font-medium">
                        {new Date(t.timestamp).toLocaleDateString()} {new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[9px] font-black ${t.type === 'INTERNO' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'}`}>
                          {t.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                          <span>{t.source}</span>
                          <ArrowRight size={12} className="text-muted-foreground" />
                          <span className="text-indigo-600 dark:text-indigo-400">{t.destination}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                         <div className="flex flex-wrap gap-1">
                            {t.items?.map((item: any, idx: number) => (
                                <Badge key={item.sku} variant="secondary" className="text-[8px] font-mono">{item.quantity}x {item.sku}</Badge>
                            ))}
                         </div>
                      </TableCell>
                      <TableCell className="text-xs font-bold text-foreground">{t.authorizedBy}</TableCell>
                      <TableCell className="text-center px-6">
                        <div className="flex items-center justify-center gap-2">
                          {t.status === 'PETICION' ? (
                            <>
                              <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[9px] font-black">
                                PETICIÓN
                              </Badge>
                              <Button 
                                size="sm" 
                                onClick={() => handleSendTransfer(t)} 
                                disabled={isProcessing}
                                className="h-7 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] rounded-lg border-none"
                              >
                                Enviar
                              </Button>
                            </>
                          ) : t.status === 'ENVIADO' ? (
                            <>
                              <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-[9px] font-black">
                                EN TRÁNSITO
                              </Badge>
                              <Button 
                                size="sm" 
                                onClick={() => handleReceiveTransfer(t)} 
                                disabled={isProcessing}
                                className="h-7 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded-lg border-none"
                              >
                                Recepcionar
                              </Button>
                            </>
                          ) : (
                            <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[9px] font-black">
                              <CheckCircle2 size={10} className="mr-1" /> {t.status}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
