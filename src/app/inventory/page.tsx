'use client';

import React, { useState, useMemo } from 'react';
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
  Tag
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFirestore, useCollection } from '@/firebase';
import { collection, addDoc, deleteDoc, doc, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useRouter } from 'next/navigation';

export default function InventoryMasterPage() {
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('Todas');
  
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

  const { data: inventory, loading: loadingInv } = useCollection<any>(inventoryQuery);
  const { data: warehouses } = useCollection<any>(warehousesQuery);

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
      price: 0, // Precio base en 0, se puede definir en otros módulos o editar luego
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

  const filteredItems = useMemo(() => {
    if (!inventory) return [];
    return inventory.filter(item => 
      item.sku.toLowerCase().includes(searchTerm.toLowerCase()) || 
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, inventory]);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto mb-8 flex items-center justify-between">
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
            <h1 className="text-2xl font-bold text-slate-900">Centro Logístico</h1>
            <p className="text-slate-500 text-sm">Administración de stock, bodegas y entradas rápidas</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        <Tabs defaultValue="existencia" className="space-y-6">
          <TabsList className="bg-white p-1 rounded-2xl shadow-sm border border-slate-100 h-auto overflow-x-auto">
            <TabsTrigger value="existencia" className="rounded-xl data-[state=active]:bg-blue-600 data-[state=active]:text-white px-6 py-2">
              <Package size={16} className="mr-2" />
              Existencias
            </TabsTrigger>
            <TabsTrigger value="maestro" className="rounded-xl data-[state=active]:bg-blue-600 data-[state=active]:text-white px-6 py-2">
              <Tag size={16} className="mr-2" />
              Maestro (Códigos)
            </TabsTrigger>
            <TabsTrigger value="entradas" className="rounded-xl data-[state=active]:bg-blue-600 data-[state=active]:text-white px-6 py-2">
              <Zap size={16} className="mr-2" />
              Entrada Rápida
            </TabsTrigger>
            <TabsTrigger value="config" className="rounded-xl data-[state=active]:bg-blue-600 data-[state=active]:text-white px-6 py-2">
              <Settings2 size={16} className="mr-2" />
              Bodegas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="existencia" className="space-y-4 outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-1 space-y-4">
                <Card className="border-none shadow-sm rounded-3xl bg-white h-fit">
                  <CardHeader>
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Warehouse size={18} className="text-blue-600" />
                      Filtro de Bodega
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 pb-4">
                    <div className="px-4 space-y-1">
                      <Button 
                        variant={selectedWarehouse === 'Todas' ? 'default' : 'ghost'} 
                        className="w-full justify-start rounded-xl h-10 text-xs font-bold"
                        onClick={() => setSelectedWarehouse('Todas')}
                      >
                        Todas las Bodegas
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
              </div>

              <div className="lg:col-span-3 space-y-4">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <Input 
                    placeholder="Buscar existencia por SKU o Nombre..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-12 h-12 bg-white border-none shadow-sm rounded-2xl"
                  />
                </div>

                <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="text-[10px] font-bold uppercase">SKU</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase">Producto</TableHead>
                        <TableHead className="text-center text-[10px] font-bold uppercase">Stock Actual</TableHead>
                        <TableHead className="text-right text-[10px] font-bold uppercase">Precio Sug.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingInv ? (
                        <TableRow><TableCell colSpan={4} className="text-center py-10">Consultando existencias...</TableCell></TableRow>
                      ) : filteredItems?.map((item) => (
                        <TableRow key={item.id} className="hover:bg-slate-50 transition-colors">
                          <TableCell className="font-mono font-bold text-slate-600 text-[11px]">{item.sku}</TableCell>
                          <TableCell className="font-bold text-slate-900 text-xs">{item.name}</TableCell>
                          <TableCell className="text-center">
                            <Badge className={`font-black ${item.quantity <= 0 ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`} variant="outline">
                              {item.quantity} un.
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-bold text-slate-900 text-xs">
                            ${(item.price || 0).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="maestro" className="grid grid-cols-1 lg:grid-cols-3 gap-8 outline-none">
            <Card className="border-none shadow-sm rounded-3xl bg-white h-fit">
              <CardHeader>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Tag size={20} className="text-blue-600" />
                  Autorizar Nuevo Código
                </CardTitle>
                <CardDescription>Definición base del SKU en el sistema</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateProduct} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-slate-400">Código SKU</Label>
                    <Input 
                      placeholder="Ej. REP-001" 
                      value={productForm.sku}
                      onChange={e => setProductForm({...productForm, sku: e.target.value.toUpperCase()})}
                      className="bg-slate-50 border-slate-200"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-slate-400">Nombre del Producto</Label>
                    <Input 
                      placeholder="Descripción técnica..." 
                      value={productForm.name}
                      onChange={e => setProductForm({...productForm, name: e.target.value})}
                      className="bg-slate-50 border-slate-200"
                    />
                  </div>
                  <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 mb-2">
                    <p className="text-[10px] text-blue-700 font-medium">
                      El precio de venta no es requerido en el maestro. Se podrá definir en Facturación o Compras.
                    </p>
                  </div>
                  <Button disabled={loading} className="w-full bg-blue-600 h-12 rounded-xl font-bold text-white shadow-lg">
                    {loading ? <Loader2 className="animate-spin" /> : 'Crear Código Maestro'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <div className="lg:col-span-2 space-y-4">
              <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="text-[10px] font-bold uppercase">SKU</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase">Producto</TableHead>
                      <TableHead className="text-right text-[10px] font-bold uppercase">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems?.slice(0, 10).map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono font-bold text-slate-600 text-[11px]">{item.sku}</TableCell>
                        <TableCell className="font-bold text-slate-900 text-xs">{item.name}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-100 font-bold uppercase text-[9px]">Maestro OK</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="entradas" className="grid grid-cols-1 lg:grid-cols-2 gap-8 outline-none">
            <Card className="border-none shadow-sm rounded-3xl bg-white h-fit">
              <CardHeader>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Zap size={20} className="text-amber-500" />
                  Entrada Rápida de Stock
                </CardTitle>
                <CardDescription>
                  Ingreso inmediato sin factura (para emergencias). 
                  Recuerde conciliar esto luego en Compras.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleQuickStockEntry} className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-slate-400">SKU del Producto</Label>
                    <Input 
                      placeholder="Escriba el SKU autorizado..." 
                      value={quickEntry.sku}
                      onChange={e => setQuickEntry({...quickEntry, sku: e.target.value.toUpperCase()})}
                      className="bg-slate-50 border-slate-200 h-12 text-lg font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-slate-400">Cantidad a Ingresar</Label>
                    <Input 
                      type="number"
                      placeholder="0"
                      value={quickEntry.quantity}
                      onFocus={e => e.target.select()}
                      onChange={e => setQuickEntry({...quickEntry, quantity: e.target.value})}
                      className="bg-slate-50 border-slate-200 h-12 text-xl font-black text-blue-600"
                    />
                  </div>
                  <Button className="w-full bg-slate-900 h-14 rounded-2xl font-bold shadow-lg text-white">
                    Cargar Existencia Inmediata
                  </Button>
                </form>
              </CardContent>
            </Card>

            <div className="bg-blue-600 rounded-3xl p-8 text-white flex flex-col justify-center">
              <History size={48} className="mb-4 text-blue-200" />
              <h3 className="text-xl font-bold mb-2">¿Por qué usar Entrada Rápida?</h3>
              <p className="text-blue-100 text-sm leading-relaxed mb-6">
                Use este espacio cuando necesite vender un producto que acaba de llegar "a la carrera" y aún no tiene la factura legal. 
                Esto permite que el sistema habilite el stock para facturación inmediata.
              </p>
              <div className="bg-blue-500/30 p-4 rounded-2xl border border-blue-400/30">
                <p className="text-xs font-bold uppercase text-blue-200 mb-1">Nota Contable</p>
                <p className="text-[11px] italic">"Media vez tenga la factura, regístrela en el módulo de Compras para formalizar el inventario legal."</p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="config" className="grid grid-cols-1 lg:grid-cols-2 gap-8 outline-none">
            <Card className="border-none shadow-sm rounded-3xl bg-white h-fit">
              <CardHeader>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Warehouse size={20} className="text-blue-600" />
                  Nueva Bodega
                </CardTitle>
                <CardDescription>Defina las zonas de descarga para el Registro de Compra</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-slate-400">Nombre de Bodega / Zona</Label>
                  <Input 
                    placeholder="Ej. Bodega Principal" 
                    value={warehouseName}
                    onChange={e => setWarehouseName(e.target.value)}
                    className="bg-slate-50 h-12 rounded-xl"
                  />
                </div>
                <Button onClick={handleCreateWarehouse} className="w-full bg-slate-900 h-12 rounded-xl font-bold text-white shadow-lg">
                  Guardar Bodega
                </Button>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="text-[10px] font-bold uppercase">Bodega</TableHead>
                    <TableHead className="text-right text-[10px] font-bold uppercase">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {warehouses?.map((wh: any) => (
                    <TableRow key={wh.id}>
                      <TableCell className="font-bold text-slate-700">{wh.name}</TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-slate-300 hover:text-rose-600"
                          onClick={() => handleDeleteWarehouse(wh.id)}
                        >
                          <Trash2 size={16} />
                        </Button>
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
