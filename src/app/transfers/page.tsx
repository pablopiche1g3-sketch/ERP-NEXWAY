
'use client';

import React, { useState, useMemo } from 'react';
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
import { useFirestore, useCollection } from '@/firebase';
import { collection, addDoc, doc, updateDoc, query, where, getDocs } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRouter } from 'next/navigation';

interface TransferItem {
  id: string;
  sku: string;
  name: string;
  quantity: number;
}

export default function TransfersPage() {
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('nuevo');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // States para el traslado
  const [transferType, setTransferType] = useState<'INTERNO' | 'INTERTIENDA'>('INTERNO');
  const [sourceWarehouse, setSourceWarehouse] = useState('');
  const [destinationWarehouse, setDestinationWarehouse] = useState('');
  const [destinationStore, setDestinationStore] = useState('');
  const [authorizedBy, setAuthorizedBy] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<TransferItem[]>([]);

  // Data Fetching
  const inventoryRef = useMemo(() => collection(db, 'inventory'), [db]);
  const warehousesRef = useMemo(() => collection(db, 'warehouses'), [db]);
  const transfersRef = useMemo(() => collection(db, 'transfers'), [db]);

  const { data: inventory, loading: loadingInv } = useCollection<any>(inventoryRef);
  const { data: warehouses } = useCollection<any>(warehousesRef);
  const { data: transfers } = useCollection<any>(transfersRef);

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
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
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
      const transferData = {
        type: transferType,
        source: sourceWarehouse,
        destination: transferType === 'INTERNO' ? destinationWarehouse : destinationStore,
        authorizedBy,
        items: cart,
        timestamp: new Date().toISOString(),
        status: 'COMPLETADO'
      };

      await addDoc(transfersRef, transferData);

      // Actualizar Inventario (Lógica simplificada para el prototipo)
      for (const item of cart) {
        const product = inventory.find((p: any) => p.id === item.id);
        if (product) {
          const productRef = doc(db, 'inventory', item.id);
          // En un traslado interno se asume que el stock global no cambia, 
          // pero en un sistema multi-bodega real se descontaría de una y sumaría a otra.
          // Para este MVP, si es Intertienda, descontamos del stock local.
          if (transferType === 'INTERTIENDA') {
            await updateDoc(productRef, {
              quantity: Math.max(0, (product.quantity || 0) - item.quantity)
            });
          }
        }
      }

      toast({ title: "Traslado Procesado", description: "El movimiento ha sido registrado exitosamente." });
      setCart([]);
      setSourceWarehouse('');
      setDestinationWarehouse('');
      setDestinationStore('');
      setAuthorizedBy('');
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo procesar el traslado." });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="rounded-full bg-white shadow-sm" onClick={() => router.push('/')}>
            <ArrowLeft className="text-slate-600" size={20} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 font-headline">Centro de Traslados</h1>
            <p className="text-slate-500 text-sm">Gestión de logística interna e inter-sucursal</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white p-1 rounded-2xl shadow-sm border border-slate-100">
            <TabsTrigger value="nuevo" className="rounded-xl px-8 font-bold data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
              <Plus size={14} className="mr-2"/> Nuevo Traslado
            </TabsTrigger>
            <TabsTrigger value="historial" className="rounded-xl px-8 font-bold data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
              <History size={14} className="mr-2"/> Historial Logístico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="nuevo" className="grid grid-cols-1 lg:grid-cols-12 gap-6 outline-none">
            <div className="lg:col-span-5 space-y-4">
              <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
                <CardHeader className="bg-indigo-900 text-white p-5">
                  <div className="flex justify-between items-center mb-2">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
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
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="w-[50px] text-[10px] px-3 text-center">Cant</TableHead>
                          <TableHead className="text-[10px]">Producto</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cart.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center py-20 text-slate-400 italic text-xs">
                              Seleccione productos para trasladar
                            </TableCell>
                          </TableRow>
                        ) : cart.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="px-3">
                              <Input 
                                type="number" 
                                value={item.quantity}
                                onFocus={e => e.target.select()}
                                onChange={e => updateQuantity(item.id, parseInt(e.target.value) || 1)}
                                className="h-8 w-14 text-center font-bold text-indigo-600 rounded-lg"
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-bold text-xs">{item.name}</span>
                                <span className="text-[9px] text-slate-400 uppercase font-mono">{item.sku}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" onClick={() => removeFromCart(item.id)} className="h-8 w-8 text-slate-300 hover:text-rose-500">
                                <Trash2 size={14} />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                  <div className="p-6 border-t bg-slate-50/50 space-y-4">
                     <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-400">Responsable / Autorizado por</Label>
                        <div className="relative">
                           <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                           <Input 
                              placeholder="Nombre de quien autoriza..." 
                              value={authorizedBy}
                              onChange={e => setAuthorizedBy(e.target.value)}
                              className="h-10 pl-9 bg-white rounded-xl text-xs font-bold"
                           />
                        </div>
                     </div>
                  </div>
                </CardContent>
              </Card>
              <Button 
                className="w-full h-16 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-lg shadow-xl" 
                disabled={isProcessing || cart.length === 0}
                onClick={handleProcessTransfer}
              >
                {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <ArrowLeftRight className="mr-2" />}
                PROCESAR MOVIMIENTO
              </Button>
            </div>

            <div className="lg:col-span-7 space-y-4">
              <Card className="border-none shadow-sm rounded-2xl bg-white p-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                       <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Tipo de Traslado</Label>
                       <div className="flex gap-2">
                          <Button 
                            variant={transferType === 'INTERNO' ? 'default' : 'outline'} 
                            className="flex-1 rounded-xl h-12"
                            onClick={() => setTransferType('INTERNO')}
                          >
                             <Warehouse size={16} className="mr-2" /> Interno
                          </Button>
                          <Button 
                            variant={transferType === 'INTERTIENDA' ? 'default' : 'outline'} 
                            className="flex-1 rounded-xl h-12"
                            onClick={() => setTransferType('INTERTIENDA')}
                          >
                             <Truck size={16} className="mr-2" /> Inter-Tienda
                          </Button>
                       </div>
                    </div>
                    
                    <div className="space-y-4">
                       <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Ruta Logística</Label>
                       <div className="flex items-center gap-3">
                          <div className="flex-1">
                             <Select value={sourceWarehouse} onValueChange={setSourceWarehouse}>
                                <SelectTrigger className="rounded-xl h-12 bg-slate-50"><SelectValue placeholder="Origen" /></SelectTrigger>
                                <SelectContent>
                                   {warehouses?.map((wh: any) => (
                                      <SelectItem key={wh.id} value={wh.name}>{wh.name}</SelectItem>
                                   ))}
                                </SelectContent>
                             </Select>
                          </div>
                          <ArrowRight size={20} className="text-slate-300" />
                          <div className="flex-1">
                             {transferType === 'INTERNO' ? (
                                <Select value={destinationWarehouse} onValueChange={setDestinationWarehouse}>
                                   <SelectTrigger className="rounded-xl h-12 bg-slate-50"><SelectValue placeholder="Destino" /></SelectTrigger>
                                   <SelectContent>
                                      {warehouses?.map((wh: any) => (
                                         <SelectItem key={wh.id} value={wh.name}>{wh.name}</SelectItem>
                                      ))}
                                   </SelectContent>
                                </Select>
                             ) : (
                                <Input 
                                   placeholder="Sucursal Destino..." 
                                   value={destinationStore}
                                   onChange={e => setDestinationStore(e.target.value)}
                                   className="h-12 rounded-xl bg-slate-50 font-bold text-xs"
                                />
                             )}
                          </div>
                       </div>
                    </div>
                 </div>
              </Card>

              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <Input 
                  placeholder="Buscar productos en inventario..." 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
                  className="pl-12 h-12 bg-white border-none shadow-sm rounded-2xl" 
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {filteredInventory.map((p: any) => (
                  <div key={p.id} onClick={() => addToCart(p)} className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 hover:border-indigo-400 cursor-pointer transition-all flex flex-col justify-between aspect-square group">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400">{p.sku}</p>
                      <h3 className="text-xs font-bold text-slate-900 leading-tight line-clamp-2 h-8">{p.name}</h3>
                    </div>
                    <div className="mt-2 pt-2 border-t flex justify-between items-center">
                      <Badge variant="secondary" className="text-[9px] bg-slate-50 text-slate-500">{p.quantity} un.</Badge>
                      <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all">
                        <Plus size={16} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="historial" className="space-y-4 outline-none">
            <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="px-6">Fecha / Hora</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Ruta (Origen &rarr; Destino)</TableHead>
                    <TableHead>Productos</TableHead>
                    <TableHead>Autoriza</TableHead>
                    <TableHead className="text-center px-6">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transfers?.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-20 text-slate-400 italic">No hay traslados registrados.</TableCell></TableRow>
                  ) : transfers?.map((t: any) => (
                    <TableRow key={t.id}>
                      <TableCell className="px-6 text-xs text-slate-500">
                        {new Date(t.timestamp).toLocaleDateString()} {new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[9px] font-black ${t.type === 'INTERNO' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                          {t.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-xs font-bold">
                          <span>{t.source}</span>
                          <ArrowRight size={12} className="text-slate-400" />
                          <span className="text-indigo-600">{t.destination}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                         <div className="flex flex-wrap gap-1">
                            {t.items?.map((item: any, idx: number) => (
                               <Badge key={idx} variant="secondary" className="text-[8px] font-mono">{item.quantity}x {item.sku}</Badge>
                            ))}
                         </div>
                      </TableCell>
                      <TableCell className="text-xs font-bold">{t.authorizedBy}</TableCell>
                      <TableCell className="text-center px-6">
                        <Badge className="bg-emerald-100 text-emerald-600 text-[9px] font-black">
                           <CheckCircle2 size={10} className="mr-1" /> {t.status}
                        </Badge>
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
