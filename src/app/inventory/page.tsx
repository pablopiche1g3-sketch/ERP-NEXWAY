'use client';

import React, { useState, useMemo, useRef } from 'react';
import { 
  Package, 
  Plus, 
  ArrowLeft, 
  Search, 
  Trash2,
  Warehouse,
  History,
  ArrowDownCircle,
  Settings2,
  Loader2,
  Zap,
  Tag,
  FileJson,
  ArrowRightLeft,
  CheckCircle2,
  Link2,
  Info
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFirestore, useCollection } from '@/firebase';
import { collection, addDoc, deleteDoc, doc, query, where, getDocs, updateDoc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useRouter } from 'next/navigation';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface SupplierItem {
  code: string;
  name: string;
  mappedInternalSku?: string;
}

export default function InventoryMasterPage() {
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('Todas');
  
  // Vinculación States
  const [supplierItems, setSupplierItems] = useState<SupplierItem[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [productForm, setProductForm] = useState({
    sku: '',
    name: '',
    category: 'General'
  });

  const [quickEntry, setQuickEntry] = useState({
    sku: '',
    quantity: '' as string | number
  });

  const [warehouseName, setWarehouseName] = useState('');

  // Estabilizar consultas
  const inventoryQuery = useMemo(() => collection(db, 'inventory'), [db]);
  const warehousesQuery = useMemo(() => collection(db, 'warehouses'), [db]);
  const mappingsQuery = useMemo(() => collection(db, 'supplier_mappings'), [db]);

  const { data: inventory, loading: loadingInv } = useCollection<any>(inventoryQuery);
  const { data: warehouses } = useCollection<any>(warehousesQuery);
  const { data: savedMappings } = useCollection<any>(mappingsQuery);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.sku || !productForm.name) {
      toast({ variant: "destructive", title: "Campos incompletos", description: "SKU y Nombre son obligatorios." });
      return;
    }

    setLoading(true);
    const q = query(inventoryQuery, where("sku", "==", productForm.sku));
    const snap = await getDocs(q);
    
    if (!snap.empty) {
      toast({ variant: "destructive", title: "Error", description: "Este código SKU ya existe en el sistema." });
      setLoading(false);
      return;
    }

    const data = {
      sku: productForm.sku,
      name: productForm.name,
      category: productForm.category,
      price: 0,
      quantity: 0,
      createdAt: new Date().toISOString()
    };

    addDoc(inventoryQuery, data)
      .catch(async (err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'inventory', operation: 'create', requestResourceData: data }));
      });

    toast({ title: "Código Autorizado", description: "El producto ha sido registrado en el maestro." });
    setProductForm({ sku: '', name: '', category: 'General' });
    setLoading(false);
  };

  const handleQuickStockEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickEntry.sku || !quickEntry.quantity) {
      toast({ variant: "destructive", title: "Datos Faltantes", description: "Debe ingresar SKU y Cantidad." });
      return;
    }

    const product = inventory?.find((p: any) => p.sku === quickEntry.sku.toUpperCase());
    if (!product) {
      toast({ variant: "destructive", title: "No Encontrado", description: "El SKU no existe en el maestro." });
      return;
    }

    const productRef = doc(db, 'inventory', product.id);
    const updateData = {
      quantity: (product.quantity || 0) + (parseInt(quickEntry.quantity.toString()) || 0)
    };

    updateDoc(productRef, updateData)
      .catch(async (err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: productRef.path, operation: 'update', requestResourceData: updateData }));
      });

    toast({ title: "Stock Actualizado", description: `Se agregaron ${quickEntry.quantity} unidades a ${product.name}.` });
    setQuickEntry({ sku: '', quantity: '' });
  };

  const handleCreateWarehouse = () => {
    if (!warehouseName) return;
    const data = { name: warehouseName };
    addDoc(warehousesQuery, data)
      .catch(async (err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'warehouses', operation: 'create', requestResourceData: data }));
      });
    toast({ title: "Bodega Configurada", description: "La bodega ya está disponible." });
    setWarehouseName('');
  };

  const handleDeleteWarehouse = (id: string) => {
    const whRef = doc(db, 'warehouses', id);
    deleteDoc(whRef)
      .catch(async (err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: whRef.path, operation: 'delete' }));
      });
    toast({ title: "Bodega Eliminada", description: "Se ha removido la bodega del sistema." });
  };

  const handleJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        let items: SupplierItem[] = [];

        if (json.cuerpoDocumento) {
          items = json.cuerpoDocumento.map((item: any) => ({
            code: item.codigo || item.sku || 'S/C',
            name: item.descripcion || item.nombre || 'Sin descripción'
          }));
        } 
        else if (Array.isArray(json)) {
          items = json.map((item: any) => ({
            code: item.codigo || item.code || item.sku || 'S/C',
            name: item.descripcion || item.name || 'Sin descripción'
          }));
        } else {
          toast({ variant: "destructive", title: "Formato Inválido", description: "El JSON no tiene una estructura compatible." });
          return;
        }

        setSupplierItems(items);
        
        const initialMappings: Record<string, string> = {};
        items.forEach(item => {
          const existing = savedMappings?.find((m: any) => m.supplierCode === item.code);
          if (existing) {
            initialMappings[item.code] = existing.internalSku;
          }
        });
        setMappings(initialMappings);

        toast({ title: "JSON Cargado", description: `Se encontraron ${items.length} productos del proveedor.` });
      } catch (error) {
        toast({ variant: "destructive", title: "Error al leer archivo" });
      }
    };
    reader.readAsText(file);
  };

  const saveMappings = async () => {
    setLoading(true);
    try {
      for (const [supCode, intSku] of Object.entries(mappings)) {
        await setDoc(doc(db, 'supplier_mappings', supCode), {
          supplierCode: supCode,
          internalSku: intSku,
          updatedAt: new Date().toISOString()
        });
      }
      toast({ title: "Vinculaciones Guardadas", description: "Los códigos han sido asociados correctamente." });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al guardar vinculaciones" });
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = useMemo(() => {
    if (!inventory) return [];
    return inventory.filter(item => 
      item.sku.toLowerCase().includes(searchTerm.toLowerCase()) || 
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, inventory]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 transition-colors duration-300">
      <div className="max-w-7xl mx-auto mb-6 md:mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-full bg-white shadow-sm hover:bg-slate-100" 
            onClick={() => router.push('/')}
          >
            <ArrowLeft className="text-slate-600" size={20} />
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">Centro Logístico</h1>
            <p className="text-slate-500 text-xs md:text-sm">Administración de stock y bodegas</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        <Tabs defaultValue="existencia" className="space-y-6">
          <TabsList className="bg-white p-1 rounded-2xl shadow-sm border border-slate-100 h-auto w-full justify-start overflow-x-auto no-scrollbar">
            <TabsTrigger value="existencia" className="rounded-xl px-4 md:px-6 py-2 text-xs md:text-sm font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white whitespace-nowrap">
              <Package size={14} className="mr-2" /> Existencias
            </TabsTrigger>
            <TabsTrigger value="maestro" className="rounded-xl px-4 md:px-6 py-2 text-xs md:text-sm font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white whitespace-nowrap">
              <Tag size={14} className="mr-2" /> Maestro
            </TabsTrigger>
            <TabsTrigger value="vinculacion" className="rounded-xl px-4 md:px-6 py-2 text-xs md:text-sm font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white whitespace-nowrap">
              <ArrowRightLeft size={14} className="mr-2" /> Vincular
            </TabsTrigger>
            <TabsTrigger value="entradas" className="rounded-xl px-4 md:px-6 py-2 text-xs md:text-sm font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white whitespace-nowrap">
              <Zap size={14} className="mr-2" /> Entrada
            </TabsTrigger>
            <TabsTrigger value="config" className="rounded-xl px-4 md:px-6 py-2 text-xs md:text-sm font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white whitespace-nowrap">
              <Settings2 size={14} className="mr-2" /> Bodegas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="existencia" className="space-y-4 outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-1 space-y-4">
                <Card className="border-none shadow-sm rounded-3xl bg-white h-fit hidden lg:block">
                  <CardHeader>
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Warehouse size={18} className="text-blue-600" /> Bodega
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 pb-4">
                    <div className="px-4 space-y-1">
                      <Button 
                        variant={selectedWarehouse === 'Todas' ? 'default' : 'ghost'} 
                        className="w-full justify-start rounded-xl h-10 text-xs font-bold"
                        onClick={() => setSelectedWarehouse('Todas')}
                      >
                        Todas
                      </Button>
                      {warehouses?.map((wh: any) => (
                        <Button 
                          key={wh.id}
                          variant={selectedWarehouse === wh.name ? 'default' : 'ghost'} 
                          className="w-full justify-start rounded-xl h-10 text-xs font-bold"
                          onClick={() => setSelectedWarehouse(wh.name)}
                        >
                          {wh.name}
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                <div className="lg:hidden">
                  <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                    <SelectTrigger className="w-full rounded-xl bg-white h-11 border-none shadow-sm text-xs font-bold">
                      <SelectValue placeholder="Filtrar por bodega" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Todas">Todas las Bodegas</SelectItem>
                      {warehouses?.map((wh: any) => (
                        <SelectItem key={wh.id} value={wh.name}>{wh.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="lg:col-span-3 space-y-4">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} md-size={18} />
                  <Input 
                    placeholder="Buscar existencia..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-10 md:pl-12 h-10 md:h-12 bg-white border-none shadow-sm rounded-2xl text-xs md:text-sm"
                  />
                </div>

                <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="text-[10px] font-bold uppercase px-4 md:px-6">SKU</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase">Producto</TableHead>
                          <TableHead className="text-center text-[10px] font-bold uppercase">Stock</TableHead>
                          <TableHead className="text-right text-[10px] font-bold uppercase px-4 md:px-6">Precio</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loadingInv ? (
                          <TableRow><TableCell colSpan={4} className="text-center py-12 text-xs">Cargando...</TableCell></TableRow>
                        ) : filteredItems?.map((item) => (
                          <TableRow key={item.id} className="hover:bg-slate-50 transition-colors">
                            <TableCell className="px-4 md:px-6 font-mono font-bold text-slate-600 text-[10px] md:text-[11px] whitespace-nowrap">{item.sku}</TableCell>
                            <TableCell className="font-bold text-slate-900 text-[10px] md:text-xs min-w-[120px]">{item.name}</TableCell>
                            <TableCell className="text-center">
                              <Badge className={`font-black text-[9px] h-5 ${item.quantity <= 0 ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`} variant="outline">
                                {item.quantity} un.
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right px-4 md:px-6 font-bold text-slate-900 text-[10px] md:text-xs whitespace-nowrap">
                              ${(item.price || 0).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="vinculacion" className="space-y-6 outline-none">
             <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
                <div className="lg:col-span-4 space-y-6">
                   <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
                      <CardHeader className="bg-slate-900 text-white p-5 md:p-6">
                         <CardTitle className="text-base md:text-lg font-bold flex items-center gap-2">
                            <FileJson size={20} className="text-blue-400" /> Mapeo Catálogo
                         </CardTitle>
                         <CardDescription className="text-slate-400 text-xs">Vincule códigos del proveedor</CardDescription>
                      </CardHeader>
                      <CardContent className="p-4 md:p-6 space-y-4 md:space-y-6">
                         <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl space-y-2">
                            <div className="flex items-center gap-2 text-blue-800 font-bold">
                               <Info size={14} />
                               <span className="text-[10px] uppercase tracking-tight">Instrucciones</span>
                            </div>
                            <p className="text-[9px] md:text-[10px] text-blue-700 leading-relaxed">
                               Cargue el JSON del proveedor. Asocie sus códigos para automatizar futuras compras.
                            </p>
                         </div>
                         
                         <input type="file" hide-file-input="true" ref={fileInputRef} className="hidden" accept=".json" onChange={handleJsonUpload} />
                         <Button 
                            className="w-full h-12 md:h-14 bg-blue-600 hover:bg-blue-700 rounded-2xl font-bold text-xs"
                            onClick={() => fileInputRef.current?.click()}
                         >
                            <FileJson className="mr-2" size={16} md-size={20} /> CARGAR JSON
                         </Button>

                         {supplierItems.length > 0 && (
                            <Button 
                               className="w-full h-12 md:h-14 bg-emerald-600 hover:bg-emerald-700 rounded-2xl font-bold text-xs mt-2"
                               onClick={saveMappings}
                               disabled={loading}
                            >
                               {loading ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2" size={16} md-size={20} />}
                               GUARDAR VINCULACIONES
                            </Button>
                         )}
                      </CardContent>
                   </Card>
                </div>

                <div className="lg:col-span-8">
                   <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
                      <div className="overflow-x-auto">
                        <Table>
                           <TableHeader className="bg-slate-50">
                              <TableRow>
                                 <TableHead className="px-4 md:px-6 text-[10px] font-black uppercase whitespace-nowrap">Código Prov.</TableHead>
                                 <TableHead className="text-[10px] font-black uppercase whitespace-nowrap">Descripción</TableHead>
                                 <TableHead className="text-[10px] font-black uppercase pr-4 md:pr-6 min-w-[150px]">SKU Interno</TableHead>
                              </TableRow>
                           </TableHeader>
                           <TableBody>
                              {supplierItems.length === 0 ? (
                                 <TableRow>
                                    <TableCell colSpan={3} className="text-center py-20 md:py-24 text-slate-400 text-xs italic">
                                       Cargue un archivo para comenzar
                                    </TableCell>
                                 </TableRow>
                              ) : supplierItems.map((item, idx) => (
                                 <TableRow key={idx}>
                                    <TableCell className="px-4 md:px-6 font-mono text-[10px] md:text-[11px] font-bold text-slate-600 whitespace-nowrap">{item.code}</TableCell>
                                    <TableCell className="text-[10px] md:text-xs text-slate-500 font-medium max-w-[120px] truncate">{item.name}</TableCell>
                                    <TableCell className="pr-4 md:pr-6">
                                       <Select 
                                          value={mappings[item.code] || ""} 
                                          onValueChange={(val) => setMappings(prev => ({...prev, [item.code]: val}))}
                                       >
                                          <SelectTrigger className="h-8 md:h-9 rounded-xl text-[9px] md:text-[10px] font-bold bg-slate-50 border-slate-100">
                                             <SelectValue placeholder="Vincular a..." />
                                          </SelectTrigger>
                                          <SelectContent>
                                             {inventory?.map((inv: any) => (
                                                <SelectItem key={inv.id} value={inv.sku} className="text-[10px]">
                                                   {inv.sku} - {inv.name}
                                                </SelectItem>
                                             ))}
                                          </SelectContent>
                                       </Select>
                                    </TableCell>
                                 </TableRow>
                              ))}
                           </TableBody>
                        </Table>
                      </div>
                   </Card>
                </div>
             </div>
          </TabsContent>

          <TabsContent value="entradas" className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 outline-none">
            <Card className="border-none shadow-sm rounded-3xl bg-white h-fit">
              <CardHeader className="p-5 md:p-6">
                <CardTitle className="text-base md:text-lg font-bold flex items-center gap-2">
                  <Zap size={18} md-size={20} className="text-amber-500" /> Entrada Rápida
                </CardTitle>
                <CardDescription className="text-xs">Ingreso inmediato sin factura de respaldo</CardDescription>
              </CardHeader>
              <CardContent className="px-5 md:px-6 pb-6">
                <form onSubmit={handleQuickStockEntry} className="space-y-4 md:space-y-6">
                  <div className="space-y-2">
                    <Label className="text-[9px] md:text-[10px] font-bold uppercase text-slate-400">SKU del Producto</Label>
                    <Input 
                      placeholder="SKU..." 
                      value={quickEntry.sku}
                      onChange={e => setQuickEntry({...quickEntry, sku: e.target.value.toUpperCase()})}
                      className="bg-slate-50 border-slate-200 h-10 md:h-12 text-base md:text-lg font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[9px] md:text-[10px] font-bold uppercase text-slate-400">Cantidad</Label>
                    <Input 
                      type="number"
                      placeholder="0"
                      value={quickEntry.quantity}
                      onFocus={e => e.target.select()}
                      onChange={e => setQuickEntry({...quickEntry, quantity: e.target.value})}
                      className="bg-slate-50 border-slate-200 h-10 md:h-12 text-lg md:text-xl font-black text-blue-600"
                    />
                  </div>
                  <Button className="w-full bg-slate-900 h-12 md:h-14 rounded-2xl font-bold shadow-lg text-white text-xs md:text-sm">
                    CARGAR STOCK
                  </Button>
                </form>
              </CardContent>
            </Card>

            <div className="bg-blue-600 rounded-3xl p-6 md:p-8 text-white flex flex-col justify-center">
              <History size={40} md-size={48} className="mb-4 text-blue-200" />
              <h3 className="text-lg md:text-xl font-bold mb-2">¿Emergencia de Stock?</h3>
              <p className="text-blue-100 text-xs md:text-sm leading-relaxed mb-6">
                Utiliza la entrada rápida para habilitar productos recién llegados que necesitan ser vendidos de inmediato antes de procesar la factura legal en Compras.
              </p>
              <div className="bg-blue-500/30 p-3 md:p-4 rounded-2xl border border-blue-400/30">
                <p className="text-[9px] md:text-[11px] italic">"Formaliza este ingreso más tarde registrando la factura oficial en el módulo de Registro de Compra."</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}