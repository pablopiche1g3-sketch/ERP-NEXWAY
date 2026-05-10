'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  Truck, 
  ArrowLeft, 
  Search, 
  Save,
  AlertTriangle,
  Upload,
  FileJson,
  Loader2,
  CheckCircle2,
  XCircle,
  QrCode,
  FileCode,
  User,
  Warehouse,
  CreditCard,
  Calendar,
  ClipboardList,
  Plus,
  Trash2,
  Wallet,
  Landmark
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, where, getDocs, updateDoc, doc, addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

interface PurchaseItem {
  id: string;
  sku: string;
  name: string;
  quantity: number;
}

type PaymentMethod = 'Efectivo' | 'Transferencia' | 'Credito';

export default function PurchasesPage() {
  const db = useFirestore();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const [pedidoId, setPedidoId] = useState('');
  const [generationCode, setGenerationCode] = useState('');
  const [docType, setDocType] = useState<'FACTURA' | 'CCF'>('FACTURA');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Efectivo');
  const [creditDays, setCreditDays] = useState<string | number>('');
  const [enteredBy, setEnteredBy] = useState('');
  const [warehouse, setWarehouse] = useState('Bodega Central');

  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [skuSearch, setSkuSearch] = useState('');
  const [manualQty, setManualQty] = useState<number | string>(1);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: inventory } = useCollection<any>(collection(db, 'inventory'));

  useEffect(() => {
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randPart = Math.floor(1000 + Math.random() * 9000);
    setPedidoId(`ORD-${datePart}-${randPart}`);
  }, []);

  const handleAddItem = async () => {
    if (!skuSearch) return;
    
    const product = inventory?.find((p: any) => p.sku === skuSearch.toUpperCase());
    const qty = parseInt(manualQty.toString()) || 0;
    
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

    const existing = purchaseItems.find(item => item.sku === product.sku);
    if (existing) {
      setPurchaseItems(prev => prev.map(item => 
        item.sku === product.sku ? { ...item, quantity: item.quantity + qty } : item
      ));
    } else {
      setPurchaseItems(prev => [...prev, {
        id: product.id,
        sku: product.sku,
        name: product.name,
        quantity: qty
      }]);
    }

    setSkuSearch('');
    setManualQty(1);
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
        items: purchaseItems,
        status,
        timestamp: new Date().toISOString()
      });

      if (status === 'CERRADA') {
        for (const item of purchaseItems) {
          const productRef = doc(db, 'inventory', item.id);
          const currentProduct = inventory?.find((p: any) => p.id === item.id);
          const currentQty = currentProduct?.quantity || 0;
          
          await updateDoc(productRef, {
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target?.result as string);
          if (Array.isArray(json)) {
             let count = 0;
             const newItems: PurchaseItem[] = [...purchaseItems];
             json.forEach(item => {
               const product = inventory?.find((p: any) => p.sku === item.sku?.toUpperCase());
               if (product) {
                 const existingIdx = newItems.findIndex(ni => ni.sku === product.sku);
                 const qty = parseInt(item.quantity) || 0;
                 if (existingIdx > -1) {
                   newItems[existingIdx].quantity += qty;
                 } else {
                   newItems.push({
                     id: product.id,
                     sku: product.sku,
                     name: product.name,
                     quantity: qty
                   });
                 }
                 count++;
               }
             });
             setPurchaseItems(newItems);
             toast({ title: "Carga Masiva Exitosa", description: `Se añadieron ${count} productos válidos.` });
          }
        } catch (err) {
          toast({ variant: "destructive", title: "Error", description: "Formato JSON inválido." });
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" className="rounded-full bg-white shadow-sm hover:bg-slate-100">
              <ArrowLeft className="text-slate-600" size={20} />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Registro de Compra Operativa</h1>
            <p className="text-slate-500 text-sm">Control de ingresos, bodegas y términos de crédito</p>
          </div>
        </div>
        <div className="flex gap-2">
           <Badge className="bg-emerald-600 text-white px-4 py-2 rounded-xl border-none shadow-lg">
             <Truck size={16} className="mr-2" />
             Ingreso de Mercadería
           </Badge>
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
                <Label className="text-[10px] font-black uppercase text-slate-400">Encargado de Ingreso</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <Input 
                    placeholder="Nombre completo..." 
                    value={enteredBy}
                    onChange={e => setEnteredBy(e.target.value)}
                    className="h-10 pl-9 bg-slate-50 border-slate-100 rounded-xl text-xs text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Tipo Documento</Label>
                  <Select value={docType} onValueChange={(v: any) => setDocType(v)}>
                    <SelectTrigger className="h-10 rounded-xl bg-slate-50 border-slate-100 text-slate-900">
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
                    <SelectTrigger className="h-10 rounded-xl bg-slate-50 border-slate-100 text-slate-900">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Bodega Central">Bodega Central</SelectItem>
                      <SelectItem value="Zona Exhibición">Zona Exhibición</SelectItem>
                      <SelectItem value="Sucursal Norte">Sucursal Norte</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-400">Factura / Cód. Generación</Label>
                <div className="relative">
                  <FileCode className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <Input 
                    placeholder="GEN-123456..." 
                    value={generationCode}
                    onChange={e => setGenerationCode(e.target.value)}
                    className="h-10 pl-9 bg-slate-50 border-slate-100 rounded-xl text-xs font-mono text-slate-900"
                  />
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                 <Label className="text-[10px] font-black uppercase text-slate-400 block mb-2">Forma de Pago</Label>
                 <div className="grid grid-cols-1 gap-2">
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
                          className="h-8 bg-white text-slate-900 font-bold"
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
            <Label className="text-[10px] font-black uppercase text-slate-400 mb-4 block tracking-widest">Agregar Producto</Label>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input 
                  placeholder="SKU..." 
                  value={skuSearch}
                  onChange={e => setSkuSearch(e.target.value.toUpperCase())}
                  className="h-12 bg-slate-50 border-slate-100 font-bold text-lg text-slate-900"
                />
                <Input 
                  type="number" 
                  value={manualQty}
                  onFocus={e => e.target.select()}
                  onChange={e => setManualQty(e.target.value === '' ? '' : (parseInt(e.target.value) || 0))}
                  className="w-20 h-12 bg-slate-50 border-slate-100 font-bold text-lg text-center text-slate-900"
                />
              </div>
              <Button onClick={handleAddItem} className="w-full h-12 bg-blue-600 hover:bg-blue-700 rounded-xl font-bold text-white shadow-lg">
                <Plus size={18} className="mr-2" />
                Añadir a la Lista
              </Button>
            </div>
            
            <div className="mt-6 pt-6 border-t border-slate-50">
               <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept=".json" />
               <Button 
                variant="outline" 
                className="w-full h-12 border-dashed border-slate-300 rounded-xl text-slate-500 font-bold hover:bg-slate-50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
               >
                 <FileJson size={18} className="mr-2" />
                 Carga Masiva (JSON)
               </Button>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-8 space-y-6">
          <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden h-[500px] flex flex-col">
            <CardHeader className="bg-slate-50 border-b border-slate-100 px-6 py-4">
              <div className="flex justify-between items-center">
                <CardTitle className="text-sm font-bold text-slate-900">Items del Pedido</CardTitle>
                <Badge variant="secondary" className="font-mono text-[10px] bg-slate-100 text-slate-600">{purchaseItems.length} ítems</Badge>
              </div>
            </CardHeader>
            <ScrollArea className="flex-1">
              <Table>
                <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                  <TableRow>
                    <TableHead className="text-[10px] font-black uppercase px-6">SKU</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Producto</TableHead>
                    <TableHead className="text-center text-[10px] font-black uppercase">Cantidad</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchaseItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-20 text-slate-400 italic text-xs">
                        No hay productos seleccionados para esta compra.
                      </TableCell>
                    </TableRow>
                  ) : purchaseItems.map((item) => (
                    <TableRow key={item.sku} className="hover:bg-slate-50/50">
                      <TableCell className="px-6 font-mono font-bold text-slate-600 text-[11px]">{item.sku}</TableCell>
                      <TableCell className="font-bold text-slate-900 text-xs">{item.name}</TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-blue-50 text-blue-700 border-blue-100 px-3 py-1 font-black">
                          {item.quantity}
                        </Badge>
                      </TableCell>
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
