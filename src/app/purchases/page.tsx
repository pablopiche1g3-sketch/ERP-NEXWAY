'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Truck, 
  ArrowLeft, 
  Search, 
  Save,
  AlertTriangle,
  FileJson,
  Loader2,
  CheckCircle2,
  FileCode,
  User,
  CreditCard,
  Calendar,
  ClipboardList,
  Plus,
  Trash2,
  Wallet,
  Landmark,
  Building2,
  DollarSign,
  Info
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DteReader } from '@/components/DteReader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import {  useFirestore, useCollection  } from '@/supabase/compat';
import { supabase } from '@/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { ModeToggle } from '@/components/mode-toggle';

interface PurchaseItem {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  cost: number;
}

type PaymentMethod = 'Efectivo' | 'Transferencia' | 'Credito';

export default function PurchasesPage() {
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const [pedidoId, setPedidoId] = useState('');
  const [generationCode, setGenerationCode] = useState('');
  const [docType, setDocType] = useState<'FACTURA' | 'CCF'>('FACTURA');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Efectivo');
  const [creditDays, setCreditDays] = useState<string | number>('');
  const [enteredBy, setEnteredBy] = useState('');
  const [warehouse, setWarehouse] = useState('');
  
  // Proveedor seleccionado
  const [supplierName, setSupplierName] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');

  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [skuSearch, setSkuSearch] = useState('');
  const [manualQty, setManualQty] = useState<number | string>(1);
  const [manualPrice, setManualPrice] = useState<number | string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados para datos cargados desde Supabase
  const [inventory, setInventory] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Función para cargar los datos relacionados de forma segura
  const loadPurchasesData = async () => {
    try {
      setLoadingData(true);

      // Cargar bodegas
      const { data: whData } = await supabase.from('warehouses').select('*').order('name');
      setWarehouses(whData || []);

      // Cargar proveedores
      const { data: supData } = await supabase.from('suppliers').select('*').order('name');
      setSuppliers((supData || []).map(s => ({
        id: s.id,
        name: s.name,
        nit: s.nit,
        nrc: s.nrc,
        giro: s.giro,
        email: s.email,
        phone: s.phone,
        address: s.address,
        applyRetention: s.apply_retention,
        applyPerception: s.apply_perception
      })));

      // Cargar inventario maestro y stock consolidado
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

    } catch (e: any) {
      console.error('Error al cargar datos en compras:', e);
    } finally {
      setLoadingData(false);
    }
  };

  // Cargar datos en el montaje
  useEffect(() => {
    loadPurchasesData();
  }, []);

  const filteredSuppliers = useMemo(() => {
    if (!suppliers) return [];
    return suppliers.filter(s => 
      s.name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
      (s.nit && s.nit.toLowerCase().includes(supplierSearch.toLowerCase()))
    );
  }, [supplierSearch, suppliers]);

  useEffect(() => {
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randPart = Math.floor(1000 + Math.random() * 9000);
    setPedidoId(`ORD-${datePart}-${randPart}`);
  }, []);

  const totalPurchase = useMemo(() => 
    purchaseItems.reduce((acc, item) => acc + (item.cost * item.quantity), 0), [purchaseItems]
  );

  const handleAddItem = async () => {
    if (!skuSearch) return;
    
    const product = inventory?.find((p: any) => p.sku === skuSearch.toUpperCase());
    const qty = parseInt(manualQty.toString()) || 0;
    const price = parseFloat(manualPrice.toString()) || 0;
    
    if (!product) {
      toast({ 
        variant: "destructive", 
        title: "Código no autorizado", 
        description: "El SKU no existe en el inventario maestro." 
      });
      return;
    }

    if (qty <= 0) {
      toast({ variant: "destructive", title: "Error", description: "La cantidad debe ser mayor a 0." });
      return;
    }

    if (price <= 0) {
      toast({ variant: "destructive", title: "Error", description: "El precio de compra debe ser mayor a 0." });
      return;
    }

    const existing = purchaseItems.find(item => item.sku === product.sku);
    if (existing) {
      setPurchaseItems(prev => prev.map(item => 
        item.sku === product.sku ? { ...item, quantity: item.quantity + qty, cost: price } : item
      ));
    } else {
      setPurchaseItems(prev => [...prev, {
        id: product.id,
        sku: product.sku,
        name: product.name,
        quantity: qty,
        cost: price
      }]);
    }

    setSkuSearch('');
    setManualQty(1);
    setManualPrice('');
    toast({ title: "Producto Añadido", description: `${product.name} agregado a la lista.` });
  };

  const removeItem = (sku: string) => {
    setPurchaseItems(prev => prev.filter(item => item.sku !== sku));
  };

  const savePurchase = async (status: 'PENDIENTE' | 'CERRADA') => {
    if (purchaseItems.length === 0) {
      toast({ variant: "destructive", title: "Error", description: "No hay productos en la compra." });
      return;
    }
    if (!enteredBy) {
      toast({ variant: "destructive", title: "Encargado Requerido", description: "Por favor ingrese su nombre." });
      return;
    }
    if (!warehouse) {
      toast({ variant: "destructive", title: "Bodega Requerida", description: "Seleccione una bodega de destino." });
      return;
    }
    if (!supplierName) {
      toast({ variant: "destructive", title: "Proveedor Requerido", description: "Debe seleccionar un proveedor." });
      return;
    }

    setLoading(true);
    try {
      const selectedSup = suppliers.find(s => s.name === supplierName);
      const selectedWh = warehouses.find(w => w.name === warehouse);

      if (!selectedWh) {
        toast({ variant: 'destructive', title: 'Error', description: 'Bodega de destino no encontrada.' });
        setLoading(false);
        return;
      }

      // 1. Insert into public.purchases
      const { data: insertedPurch, error: purchErr } = await supabase
        .from('purchases')
        .insert({
          order_id: pedidoId,
          supplier_id: selectedSup ? selectedSup.id : null,
          entered_by: enteredBy,
          warehouse_id: selectedWh.id,
          total: totalPurchase,
          status: status,
          payment_method: paymentMethod,
          credit_days: paymentMethod === 'Credito' ? (parseInt(creditDays.toString()) || 0) : null,
          payment_status: paymentMethod === 'Credito' && status === 'CERRADA' ? 'PENDIENTE' : (paymentMethod === 'Credito' ? null : 'PAGADO')
        })
        .select()
        .single();

      if (purchErr) throw purchErr;

      // 2. Insert items into public.purchase_items
      const itemsToInsert = purchaseItems.map(item => ({
        purchase_id: insertedPurch.id,
        sku: item.sku,
        quantity: item.quantity,
        cost: item.cost,
        subtotal: item.quantity * item.cost
      }));

      const { error: itemsErr } = await supabase
        .from('purchase_items')
        .insert(itemsToInsert);

      if (itemsErr) throw itemsErr;

      // 3. Update stock if status === 'CERRADA'
      if (status === 'CERRADA') {
        for (const item of purchaseItems) {
          const currentProduct = inventory.find(p => p.sku === item.sku);
          const currentWhStock = currentProduct ? (currentProduct.bodegas[warehouse] || 0) : 0;
          const newQty = currentWhStock + item.quantity;

          const { error: stockErr } = await supabase
            .from('inventory_stock')
            .upsert({
              sku: item.sku,
              warehouse_id: selectedWh.id,
              quantity: newQty
            }, {
              onConflict: 'sku,warehouse_id'
            });

          if (stockErr) throw stockErr;
        }
        toast({ title: "Compra Cerrada", description: `Stock actualizado en la bodega '${warehouse}' de forma exitosa.` });
      } else {
        toast({ title: "Borrador Guardado", description: "La compra está pendiente. El stock NO ha sido afectado." });
      }

      setPurchaseItems([]);
      setGenerationCode('');
      setEnteredBy('');
      setSupplierName('');
      setPaymentMethod('Efectivo');
      setCreditDays('');
      const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randPart = Math.floor(1000 + Math.random() * 9000);
      setPedidoId(`ORD-${datePart}-${randPart}`);
      await loadPurchasesData();

    } catch (error: any) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: error.message || "No se pudo procesar la compra." });
    } finally {
      setLoading(false);
    }
  };

  const selectSupplier = (supplier: any) => {
    setSupplierName(supplier.name);
    toast({ title: "Proveedor Seleccionado", description: `${supplier.name} cargado correctamente.` });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        let itemsToLoad: any[] = [];
        let detectedCount = 0;

        if (json.identificacion && json.emisor && json.cuerpoDocumento) {
          setSupplierName(json.emisor.nombre || '');
          setGenerationCode(json.identificacion.codigoGeneracion || '');
          setDocType(json.identificacion.tipoDte === '03' ? 'CCF' : 'FACTURA');
          
          json.cuerpoDocumento?.forEach((item: any) => {
            const product = inventory?.find((p: any) => 
              p.sku === (item.codigo || '').toUpperCase() || 
              p.name.toLowerCase() === (item.descripcion || '').toLowerCase()
            );

            if (product) {
              itemsToLoad.push({
                id: product.id,
                sku: product.sku,
                name: product.name,
                quantity: item.cantidad || 0,
                cost: item.precioUnitario || 0
              });
              detectedCount++;
            }
          });
          toast({ title: "DTE V3 Detectado", description: `Se identificó proveedor y ${detectedCount} productos compatibles.` });
        } 
        else if (Array.isArray(json)) {
          json.forEach(item => {
            const product = inventory?.find((p: any) => p.sku === item.sku?.toUpperCase());
            if (product) {
              itemsToLoad.push({
                id: product.id,
                sku: product.sku,
                name: product.name,
                quantity: parseInt(item.quantity) || 0,
                cost: parseFloat(item.price) || 0
              });
              detectedCount++;
            }
          });
          toast({ title: "JSON Cargado", description: `Se añadieron ${detectedCount} productos válidos.` });
        } else {
          toast({ variant: "destructive", title: "Formato Desconocido", description: "El archivo no coincide con el estándar DTE V3 de El Salvador." });
          return;
        }

        if (itemsToLoad.length > 0) {
          setPurchaseItems(prev => {
            const newList = [...prev];
            itemsToLoad.forEach(newItem => {
              const idx = newList.findIndex(i => i.sku === newItem.sku);
              if (idx > -1) {
                newList[idx].quantity += newItem.quantity;
                newList[idx].cost = newItem.cost;
              } else {
                newList.push(newItem);
              }
            });
            return newList;
          });
        }
      } catch (err) {
        toast({ variant: "destructive", title: "Error", description: "No se pudo leer el archivo JSON." });
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 transition-colors duration-300">
      <div className="max-w-7xl mx-auto mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="rounded-full bg-card shadow-sm border" onClick={() => router.push('/')}>
            <ArrowLeft className="text-foreground" size={20} />
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground font-headline leading-tight">Registro de Compra Operativa</h1>
            <p className="text-muted-foreground text-xs md:text-sm">Soporte nativo para DTE V3 Hacienda El Salvador</p>
          </div>
        </div>
        <ModeToggle />
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        <div className="lg:col-span-4 space-y-6">
          <Card className="border shadow-sm rounded-3xl bg-card overflow-hidden">
            <CardHeader className="bg-slate-900 dark:bg-slate-950 text-white p-5">
              <div className="flex justify-between items-center">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <ClipboardList size={18} className="text-blue-400" />
                  Control de Pedido
                </CardTitle>
                <span className="text-[10px] font-mono opacity-60">{pedidoId}</span>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Proveedor</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                    <Input 
                      placeholder="Seleccione proveedor..." 
                      value={supplierName}
                      onChange={e => setSupplierName(e.target.value)}
                      className="h-10 pl-9 bg-muted border-none rounded-xl text-xs font-bold text-foreground"
                    />
                  </div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl bg-card border">
                        <Search size={16} />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0" align="end">
                      <div className="p-3 border-b"><Input placeholder="Buscar proveedor..." value={supplierSearch} onChange={e => setSupplierSearch(e.target.value)} className="h-8 text-xs bg-muted border-none" /></div>
                      <ScrollArea className="h-60">
                        <div className="p-1">
                          {filteredSuppliers.length === 0 ? (
                            <div className="p-4 text-center text-muted-foreground text-[10px] italic">No se encontraron proveedores</div>
                          ) : filteredSuppliers.map((s: any) => (
                            <div key={s.id} onClick={() => selectSupplier(s)} className="p-3 hover:bg-muted cursor-pointer rounded-lg transition-colors group">
                              <span className="text-[11px] font-bold text-foreground group-hover:text-primary block">{s.name}</span>
                              <span className="text-[9px] text-muted-foreground font-mono">NIT: {s.nit}</span>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Encargado de Ingreso</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                  <Input 
                    placeholder="Nombre completo..." 
                    value={enteredBy}
                    onChange={e => setEnteredBy(e.target.value)}
                    className="h-10 pl-9 bg-muted border-none rounded-xl text-xs text-foreground"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Tipo Documento</Label>
                  <Select value={docType} onValueChange={(v: any) => setDocType(v)}>
                    <SelectTrigger className="h-10 rounded-xl bg-muted border-none text-xs text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FACTURA">FACTURA</SelectItem>
                      <SelectItem value="CCF">CCF</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Bodega Destino</Label>
                  <Select value={warehouse} onValueChange={setWarehouse}>
                    <SelectTrigger className="h-10 rounded-xl bg-muted border-none text-xs text-foreground">
                      <SelectValue placeholder="Seleccione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses?.map((wh: any) => (
                        <SelectItem key={wh.id} value={wh.name}>{wh.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">DTE / Cód. Generación</Label>
                <div className="relative">
                  <FileCode className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                  <Input 
                    placeholder="GEN-123456..." 
                    value={generationCode}
                    onChange={e => setGenerationCode(e.target.value)}
                    className="h-10 pl-9 bg-muted border-none rounded-xl text-xs font-mono text-foreground"
                  />
                </div>
              </div>

              <div className="p-4 bg-muted/40 rounded-2xl border space-y-4">
                 <Label className="text-[10px] font-black uppercase text-muted-foreground block mb-2 tracking-widest">Forma de Pago</Label>
                 <div className="flex gap-2">
                    <Button variant={paymentMethod === 'Efectivo' ? 'default' : 'outline'} size="sm" onClick={() => setPaymentMethod('Efectivo')} className="flex-1 h-9 text-[9px] font-bold rounded-xl transition-all shadow-sm">
                      <Wallet size={12} className="mr-1.5" /> Efectivo
                    </Button>
                    <Button variant={paymentMethod === 'Transferencia' ? 'default' : 'outline'} size="sm" onClick={() => setPaymentMethod('Transferencia')} className="flex-1 h-9 text-[9px] font-bold rounded-xl transition-all shadow-sm">
                      <Landmark size={12} className="mr-1.5" /> Transf.
                    </Button>
                    <Button variant={paymentMethod === 'Credito' ? 'default' : 'outline'} size="sm" onClick={() => setPaymentMethod('Credito')} className="flex-1 h-9 text-[9px] font-bold rounded-xl transition-all shadow-sm">
                      <CreditCard size={12} className="mr-1.5" /> Crédito
                    </Button>
                 </div>
                 {paymentMethod === 'Credito' && (
                   <div className="space-y-2 animate-in fade-in slide-in-from-top-2 pt-2 border-t">
                      <Label className="text-[10px] font-bold text-primary uppercase">Plazo de Crédito</Label>
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-muted-foreground" />
                        <Input type="number" value={creditDays} onFocus={e => e.target.select()} onChange={e => setCreditDays(e.target.value)} className="h-8 bg-card font-bold text-xs" placeholder="0" />
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">Días</span>
                      </div>
                   </div>
                 )}
              </div>
            </CardContent>
          </Card>

          <Card className="border shadow-sm rounded-3xl bg-card p-6">
            <div className="flex items-center justify-between mb-4">
               <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Cargar DTE V3</Label>
               <Popover>
                  <PopoverTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6"><Info size={14} /></Button></PopoverTrigger>
                  <PopoverContent className="w-64 text-[10px] space-y-2">
                     <p className="font-bold">Hacienda El Salvador V3:</p>
                     <p>Extrae automáticamente proveedor, códigos de productos, cantidades y precios directamente desde el archivo oficial del Ministerio.</p>
                  </PopoverContent>
               </Popover>
            </div>
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept=".json" />
            <Button 
              className="w-full h-14 bg-slate-900 dark:bg-blue-600 rounded-2xl font-bold shadow-xl flex flex-col items-center justify-center gap-0.5 text-white" 
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="flex items-center gap-2">
                 <FileJson size={20} />
                 <span>IMPORTAR DTE V3 (JSON)</span>
              </div>
              <span className="text-[9px] opacity-60 font-medium">Soporta Ministerio de Hacienda SV</span>
            </Button>
            
            <div className="mt-8 pt-6 border-t space-y-4">
              <Label className="text-[10px] font-black uppercase text-muted-foreground block tracking-widest">Agregar Manualmente</Label>
              <div className="grid grid-cols-4 gap-2">
                <div className="col-span-2 space-y-1">
                  <Label className="text-[9px] font-bold uppercase text-muted-foreground">SKU</Label>
                  <Input placeholder="SKU..." value={skuSearch} onChange={e => setSkuSearch(e.target.value.toUpperCase())} className="h-10 bg-muted border-none font-bold text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-bold uppercase text-muted-foreground">Cant.</Label>
                  <Input type="number" value={manualQty} onFocus={e => e.target.select()} onChange={e => setManualQty(e.target.value === '' ? '' : (parseInt(e.target.value) || 0))} className="h-10 bg-muted border-none font-bold text-center text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-bold uppercase text-muted-foreground">Costo</Label>
                  <Input type="number" placeholder="0.00" value={manualPrice} onFocus={e => e.target.select()} onChange={e => setManualPrice(e.target.value)} className="h-10 bg-muted border-none font-bold text-emerald-600 dark:text-emerald-400 text-xs" />
                </div>
              </div>
              <Button onClick={handleAddItem} variant="outline" className="w-full h-10 border-primary/20 text-primary rounded-xl font-bold text-xs">
                <Plus size={16} className="mr-2" />
                Añadir a la Lista
              </Button>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-8 space-y-6">
          <Card className="border shadow-sm rounded-3xl bg-card overflow-hidden h-[550px] flex flex-col">
            <CardHeader className="bg-muted/30 border-b px-6 py-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex items-center gap-4">
                  <CardTitle className="text-sm font-bold text-foreground">Items del Pedido</CardTitle>
                  <Badge variant="secondary" className="font-mono text-[10px]">{purchaseItems.length} ítems</Badge>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-[9px] font-black uppercase text-muted-foreground">Total de Inversión</p>
                  <p className="text-xl md:text-2xl font-black text-emerald-600 dark:text-emerald-400">${totalPurchase.toFixed(2)}</p>
                </div>
              </div>
            </CardHeader>
            <ScrollArea className="flex-1">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
                  <TableRow>
                    <TableHead className="text-[10px] font-black uppercase px-6">SKU</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Producto</TableHead>
                    <TableHead className="text-center text-[10px] font-black uppercase">Cant.</TableHead>
                    <TableHead className="text-right text-[10px] font-black uppercase">Costo Un.</TableHead>
                    <TableHead className="text-right text-[10px] font-black uppercase">Subtotal</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchaseItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-24 text-muted-foreground italic text-xs">
                        No hay productos seleccionados. Importe un DTE V3 o agréguelos manualmente.
                      </TableCell>
                    </TableRow>
                  ) : purchaseItems.map((item) => (
                    <TableRow key={item.sku} className="hover:bg-muted/30">
                      <TableCell className="px-6 font-mono font-bold text-muted-foreground text-[11px]">{item.sku}</TableCell>
                      <TableCell className="font-bold text-foreground text-xs">{item.name}</TableCell>
                      <TableCell className="text-center font-bold text-foreground text-xs">{item.quantity}</TableCell>
                      <TableCell className="text-right font-bold text-muted-foreground text-xs">${item.cost.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-black text-foreground text-xs">${(item.cost * item.quantity).toFixed(2)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => removeItem(item.sku)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                          <Trash2 size={14} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Button 
              variant="outline" 
              className="h-14 md:h-16 rounded-2xl border-2 font-black text-muted-foreground text-base md:text-lg hover:border-primary hover:text-primary transition-all bg-card"
              disabled={loading || purchaseItems.length === 0}
              onClick={() => savePurchase('PENDIENTE')}
            >
              <Save size={20} className="mr-2" />
              Borrador Pendiente
            </Button>
            <Button 
              className="h-14 md:h-16 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base md:text-lg shadow-xl transition-all group border-none"
              disabled={loading || purchaseItems.length === 0}
              onClick={() => savePurchase('CERRADA')}
            >
              {loading ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 size={20} className="mr-2 group-hover:scale-110" />}
              Cerrar e Ingresar Stock
            </Button>
          </div>

          <div className="p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20 flex items-start gap-3">
             <AlertTriangle className="text-amber-600 dark:text-amber-400 mt-1" size={20} />
             <div>
                <p className="text-[11px] font-bold text-amber-900 dark:text-amber-300 uppercase tracking-tight">Aviso de Operación</p>
                <p className="text-[10px] text-amber-800 dark:text-amber-400/80 leading-relaxed">
                  Al **Borrador Pendiente**, la compra queda registrada pero el stock no cambia. 
                  Al **Cerrar e Ingresar**, el stock se carga inmediatamente al inventario maestro y queda disponible para venta.
                </p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}