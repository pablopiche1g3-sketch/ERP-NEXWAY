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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFirestore, useCollection } from '@/firebase';
import { collection, updateDoc, doc, addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';

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

  const inventoryQuery = useMemo(() => collection(db, 'inventory'), [db]);
  const warehousesQuery = useMemo(() => collection(db, 'warehouses'), [db]);
  const suppliersQuery = useMemo(() => collection(db, 'suppliers'), [db]);

  const { data: inventory } = useCollection<any>(inventoryQuery);
  const { data: warehouses } = useCollection<any>(warehousesQuery);
  const { data: suppliers } = useCollection<any>(suppliersQuery);

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
      await addDoc(collection(db, 'purchases'), {
        pedidoId,
        generationCode,
        docType,
        paymentMethod,
        creditDays: paymentMethod === 'Credito' ? (parseInt(creditDays.toString()) || 0) : 0,
        enteredBy,
        warehouse,
        supplier: supplierName,
        items: purchaseItems,
        total: totalPurchase,
        status,
        timestamp: new Date().toISOString()
      });

      if (status === 'CERRADA') {
        for (const item of purchaseItems) {
          const productRef = doc(db, 'inventory', item.id);
          const currentProduct = inventory?.find((p: any) => p.id === item.id);
          const currentQty = currentProduct?.quantity || 0;
          
          updateDoc(productRef, {
            quantity: currentQty + item.quantity
          });
        }
        toast({ title: "Compra Cerrada", description: "Stock actualizado y disponible para facturación." });
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

    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo procesar la compra." });
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

        // Lógica Ministerio de Hacienda El Salvador V3
        if (json.identificacion && json.emisor && json.cuerpoDocumento) {
          setSupplierName(json.emisor.nombre || '');
          setGenerationCode(json.identificacion.codigoGeneracion || '');
          setDocType(json.identificacion.tipoDte === '03' ? 'CCF' : 'FACTURA');
          
          json.cuerpoDocumento?.forEach((item: any) => {
            // Intentar buscar SKU por código del DTE o descripción en el inventario maestro
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
        // Soporte Formato Simple (Array)
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
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="rounded-full bg-white shadow-sm hover:bg-slate-100" onClick={() => router.push('/')}>
            <ArrowLeft className="text-slate-600" size={20} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 font-headline">Registro de Compra Operativa</h1>
            <p className="text-slate-500 text-sm">Soporte nativo para DTE V3 Hacienda El Salvador</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        <div className="lg:col-span-4 space-y-6">
          <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
            <CardHeader className="bg-slate-900 text-white p-5">
              <div className="flex justify-between items-center">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <ClipboardList size={18} className="text-blue-400" />
                  Control de Pedido
                </CardTitle>
                <span className="text-[10px] font-mono opacity-60">{pedidoId}</span>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4 text-slate-900">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-400">Proveedor</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <Input 
                      placeholder="Seleccione proveedor..." 
                      value={supplierName}
                      onChange={e => setSupplierName(e.target.value)}
                      className="h-10 pl-9 bg-slate-50 border-slate-100 rounded-xl text-xs font-bold"
                    />
                  </div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl border-slate-200">
                        <Search size={16} />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0" align="end">
                      <div className="p-3 border-b border-slate-100">
                        <Input 
                          placeholder="Buscar proveedor..." 
                          value={supplierSearch}
                          onChange={e => setSupplierSearch(e.target.value)}
                          className="h-8 text-xs bg-slate-50 border-none rounded-lg"
                        />
                      </div>
                      <ScrollArea className="h-60">
                        <div className="p-1">
                          {filteredSuppliers.length === 0 ? (
                            <div className="p-4 text-center text-slate-400 text-[10px] italic">No se encontraron proveedores</div>
                          ) : filteredSuppliers.map((s: any) => (
                            <div 
                              key={s.id} 
                              onClick={() => selectSupplier(s)}
                              className="p-3 hover:bg-slate-50 cursor-pointer rounded-lg transition-colors group"
                            >
                              <span className="text-[11px] font-bold text-slate-900 group-hover:text-emerald-600 block">{s.name}</span>
                              <span className="text-[9px] text-slate-400 font-mono">NIT: {s.nit}</span>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-400">Encargado de Ingreso</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <Input 
                    placeholder="Nombre completo..." 
                    value={enteredBy}
                    onChange={e => setEnteredBy(e.target.value)}
                    className="h-10 pl-9 bg-slate-50 border-slate-100 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Tipo Documento</Label>
                  <Select value={docType} onValueChange={(v: any) => setDocType(v)}>
                    <SelectTrigger className="h-10 rounded-xl bg-slate-50 border-slate-100">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FACTURA">FACTURA</SelectItem>
                      <SelectItem value="CCF">CCF</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Bodega Destino</Label>
                  <Select value={warehouse} onValueChange={setWarehouse}>
                    <SelectTrigger className="h-10 rounded-xl bg-slate-50 border-slate-100">
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
                <Label className="text-[10px] font-black uppercase text-slate-400">DTE / Cód. Generación</Label>
                <div className="relative">
                  <FileCode className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <Input 
                    placeholder="GEN-123456..." 
                    value={generationCode}
                    onChange={e => setGenerationCode(e.target.value)}
                    className="h-10 pl-9 bg-slate-50 border-slate-100 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                 <Label className="text-[10px] font-black uppercase text-slate-400 block mb-2">Forma de Pago</Label>
                 <div className="flex gap-2">
                    <Button 
                      variant={paymentMethod === 'Efectivo' ? 'default' : 'outline'} 
                      size="sm" 
                      onClick={() => setPaymentMethod('Efectivo')}
                      className={`flex-1 h-9 text-[9px] font-bold rounded-xl transition-all ${paymentMethod === 'Efectivo' ? 'shadow-md' : 'bg-white border-slate-200 text-slate-600'}`}
                    >
                      <Wallet size={12} className="mr-1.5" />
                      Efectivo
                    </Button>
                    <Button 
                      variant={paymentMethod === 'Transferencia' ? 'default' : 'outline'} 
                      size="sm" 
                      onClick={() => setPaymentMethod('Transferencia')}
                      className={`flex-1 h-9 text-[9px] font-bold rounded-xl transition-all ${paymentMethod === 'Transferencia' ? 'shadow-md' : 'bg-white border-slate-200 text-slate-600'}`}
                    >
                      <Landmark size={12} className="mr-1.5" />
                      Transf.
                    </Button>
                    <Button 
                      variant={paymentMethod === 'Credito' ? 'default' : 'outline'} 
                      size="sm" 
                      onClick={() => setPaymentMethod('Credito')}
                      className={`flex-1 h-9 text-[9px] font-bold rounded-xl transition-all ${paymentMethod === 'Credito' ? 'shadow-md' : 'bg-white border-slate-200 text-slate-600'}`}
                    >
                      <CreditCard size={12} className="mr-1.5" />
                      Crédito
                    </Button>
                 </div>
                 {paymentMethod === 'Credito' && (
                   <div className="space-y-2 animate-in fade-in slide-in-from-top-2 pt-2 border-t border-slate-200">
                      <Label className="text-[10px] font-bold text-blue-600 uppercase">Plazo de Crédito</Label>
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-slate-400" />
                        <Input 
                          type="number" 
                          value={creditDays} 
                          onFocus={e => e.target.select()}
                          onChange={e => setCreditDays(e.target.value)} 
                          className="h-8 bg-white font-bold"
                          placeholder="0"
                        />
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Días</span>
                      </div>
                   </div>
                 )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm rounded-3xl bg-white p-6">
            <div className="flex items-center justify-between mb-4">
               <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Cargar DTE V3</Label>
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
              className="w-full h-14 bg-slate-900 rounded-2xl font-bold shadow-xl shadow-slate-200 flex flex-col items-center justify-center gap-0.5" 
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="flex items-center gap-2">
                 <FileJson size={20} />
                 <span>IMPORTAR DTE V3 (JSON)</span>
              </div>
              <span className="text-[9px] opacity-60 font-medium">Soporta Ministerio de Hacienda SV</span>
            </Button>
            
            <div className="mt-8 pt-6 border-t border-slate-50 space-y-4">
              <Label className="text-[10px] font-black uppercase text-slate-400 block tracking-widest">Agregar Manualmente</Label>
              <div className="grid grid-cols-4 gap-2">
                <div className="col-span-2 space-y-1">
                  <Label className="text-[9px] font-bold uppercase text-slate-400">SKU</Label>
                  <Input 
                    placeholder="SKU..." 
                    value={skuSearch}
                    onChange={e => setSkuSearch(e.target.value.toUpperCase())}
                    className="h-10 bg-slate-50 border-slate-100 font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-bold uppercase text-slate-400">Cant.</Label>
                  <Input 
                    type="number" 
                    value={manualQty}
                    onFocus={e => e.target.select()}
                    onChange={e => setManualQty(e.target.value === '' ? '' : (parseInt(e.target.value) || 0))}
                    className="h-10 bg-slate-50 border-slate-100 font-bold text-center"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-bold uppercase text-slate-400">Costo</Label>
                  <Input 
                    type="number" 
                    placeholder="0.00"
                    value={manualPrice}
                    onFocus={e => e.target.select()}
                    onChange={e => setManualPrice(e.target.value)}
                    className="h-10 bg-slate-50 border-slate-100 font-bold text-emerald-600"
                  />
                </div>
              </div>
              <Button onClick={handleAddItem} variant="outline" className="w-full h-10 border-blue-200 text-blue-600 rounded-xl font-bold">
                <Plus size={16} className="mr-2" />
                Añadir a la Lista
              </Button>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-8 space-y-6">
          <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden h-[550px] flex flex-col">
            <CardHeader className="bg-slate-50 border-b border-slate-100 px-6 py-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <CardTitle className="text-sm font-bold text-slate-900">Items del Pedido</CardTitle>
                  <Badge variant="secondary" className="font-mono text-[10px] bg-slate-100 text-slate-600">{purchaseItems.length} ítems</Badge>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-black uppercase text-slate-400">Total de Inversión</p>
                  <p className="text-xl font-black text-emerald-600">${totalPurchase.toFixed(2)}</p>
                </div>
              </div>
            </CardHeader>
            <ScrollArea className="flex-1">
              <Table>
                <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
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
                      <TableCell colSpan={6} className="text-center py-20 text-slate-400 italic text-xs">
                        No hay productos seleccionados. Importe un DTE V3 o agréguelos manualmente.
                      </TableCell>
                    </TableRow>
                  ) : purchaseItems.map((item) => (
                    <TableRow key={item.sku} className="hover:bg-slate-50/50">
                      <TableCell className="px-6 font-mono font-bold text-slate-600 text-[11px]">{item.sku}</TableCell>
                      <TableCell className="font-bold text-slate-900 text-xs">{item.name}</TableCell>
                      <TableCell className="text-center font-bold text-slate-600">{item.quantity}</TableCell>
                      <TableCell className="text-right font-bold text-slate-500">${item.cost.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-black text-slate-900">${(item.cost * item.quantity).toFixed(2)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => removeItem(item.sku)} className="h-8 w-8 text-slate-300 hover:text-rose-500">
                          <Trash2 size={14} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <Button 
              variant="outline" 
              className="h-16 rounded-2xl border-2 border-slate-200 font-black text-slate-500 text-lg hover:bg-white hover:border-blue-600 hover:text-blue-600 transition-all bg-white"
              disabled={loading || purchaseItems.length === 0}
              onClick={() => savePurchase('PENDIENTE')}
            >
              <Save size={20} className="mr-2" />
              Guardar como Pendiente
            </Button>
            <Button 
              className="h-16 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-lg shadow-xl shadow-emerald-500/20 transition-all group border-none"
              disabled={loading || purchaseItems.length === 0}
              onClick={() => savePurchase('CERRADA')}
            >
              {loading ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 size={20} className="mr-2 group-hover:scale-110" />}
              Cerrar Compra e Ingresar Stock
            </Button>
          </div>

          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-3">
             <AlertTriangle className="text-amber-500 mt-1" size={20} />
             <div>
                <p className="text-[11px] font-bold text-amber-900 uppercase">Aviso de Operación</p>
                <p className="text-[10px] text-amber-700 leading-relaxed">
                  Al **Guardar como Pendiente**, la compra queda registrada en el historial pero el stock del inventario no cambia. 
                  Al **Cerrar Compra**, el sistema asume que el producto ya está en físico y lo habilita inmediatamente para la facturación.
                </p>
             </div>
          </div>
        </div>

      </div>
    </div>
  );
}
