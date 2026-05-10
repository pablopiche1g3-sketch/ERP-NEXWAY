
'use client';

import React, { useState, useMemo } from 'react';
import { 
  Package, 
  Plus, 
  ArrowLeft, 
  Search, 
  Trash2,
  AlertCircle,
  Warehouse,
  History,
  ArrowUpCircle,
  ArrowDownCircle,
  Settings2,
  CheckCircle2,
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
import { ScrollArea } from '@/components/ui/scroll-area';
import Link from 'next/link';

export default function InventoryMasterPage() {
  const db = useFirestore();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('Todas');
  
  // Formulario Maestro
  const [productForm, setProductForm] = useState({
    sku: '',
    name: '',
    category: 'General',
    price: '' as string | number
  });

  // Formulario Entrada Rápida
  const [quickEntry, setQuickEntry] = useState({
    sku: '',
    quantity: '' as string | number
  });

  const [warehouseName, setWarehouseName] = useState('');

  const { data: inventory, loading: loadingInv } = useCollection<any>(collection(db, 'inventory'));
  const { data: warehouses, loading: loadingWh } = useCollection<any>(collection(db, 'warehouses'));

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.sku || !productForm.name) {
      toast({ variant: "destructive", title: "Campos incompletos", description: "SKU y Nombre son obligatorios." });
      return;
    }

    setLoading(true);
    try {
      const q = query(collection(db, 'inventory'), where("sku", "==", productForm.sku));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        toast({ variant: "destructive", title: "Error", description: "Este código SKU ya existe en el sistema." });
        setLoading(false);
        return;
      }

      await addDoc(collection(db, 'inventory'), {
        sku: productForm.sku,
        name: productForm.name,
        category: productForm.category,
        price: parseFloat(productForm.price.toString()) || 0,
        quantity: 0,
        createdAt: new Date().toISOString()
      });

      toast({ title: "Código Autorizado", description: "El producto ha sido registrado en el maestro." });
      setProductForm({ sku: '', name: '', category: 'General', price: '' });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo crear el producto." });
    } finally {
      setLoading(false);
    }
  };

  const handleQuickStockEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickEntry.sku || !quickEntry.quantity) {
      toast({ variant: "destructive", title: "Datos Faltantes", description: "Debe ingresar SKU y Cantidad." });
      return;
    }

    setLoading(true);
    try {
      const product = inventory?.find((p: any) => p.sku === quickEntry.sku.toUpperCase());
      if (!product) {
        toast({ variant: "destructive", title: "No Encontrado", description: "El SKU no existe en el maestro." });
        setLoading(false);
        return;
      }

      const productRef = doc(db, 'inventory', product.id);
      await updateDoc(productRef, {
        quantity: (product.quantity || 0) + (parseInt(quickEntry.quantity.toString()) || 0)
      });

      toast({ title: "Stock Actualizado", description: `Se agregaron ${quickEntry.quantity} unidades a ${product.name}.` });
      setQuickEntry({ sku: '', quantity: '' });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar el stock." });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWarehouse = async () => {
    if (!warehouseName) return;
    try {
      await addDoc(collection(db, 'warehouses'), { name: warehouseName });
      toast({ title: "Bodega Configurada", description: "La bodega ya está disponible." });
      setWarehouseName('');
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo guardar la bodega." });
    }
  };

  const handleDeleteWarehouse = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'warehouses', id));
      toast({ title: "Bodega Eliminada", description: "Se ha removido la bodega del sistema." });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar." });
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
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" className="rounded-full bg-white shadow-sm hover:bg-slate-100">
              <ArrowLeft className="text-slate-600" size={20} />
            </Button>
          </Link>
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
            <TabsTrigger value="kardex" className="rounded-xl data-[state=active]:bg-blue-600 data-[state=active]:text-white px-6 py-2">
              <History size={16} className="mr-2" />
              Kardex
            </TabsTrigger>
            <TabsTrigger value="salida" className="rounded-xl data-[state=active]:bg-blue-600 data-[state=active]:text-white px-6 py-2">
              <ArrowDownCircle size={16} className="mr-2" />
              Salida
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
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-slate-400">Precio de Venta ($)</Label>
                    <Input 
                      type="number"
                      step="0.01"
                      value={productForm.price}
                      onFocus={e => e.target.select()}
                      onChange={e => setProductForm({...productForm, price: e.target.value})}
                      className="bg-slate-50 border-slate-200"
                    />
                  </div>
                  <Button disabled={loading} className="w-full bg-blue-600 h-12 rounded-xl font-bold">
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
                  <Button disabled={loading} className="w-full bg-slate-900 h-14 rounded-2xl font-bold shadow-lg">
                    {loading ? <Loader2 className="animate-spin" /> : 'Cargar Existencia Inmediata'}
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

          <TabsContent value="kardex" className="outline-none">
            <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
              <CardHeader className="p-8">
                <CardTitle className="text-xl font-bold">Libro de Movimientos (Kardex)</CardTitle>
                <CardDescription>Registro cronológico de entradas, salidas y traslados</CardDescription>
              </CardHeader>
              <CardContent className="p-0 pb-20 text-center space-y-4 flex flex-col items-center justify-center grayscale opacity-30">
                <History size={64} />
                <p className="text-sm font-bold">Trazabilidad detallada disponible próximamente.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="salida" className="outline-none">
            <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
              <CardHeader className="p-8">
                <CardTitle className="text-xl font-bold">Salidas de Inventario</CardTitle>
                <CardDescription>Bajas por merma, daño o autoconsumo</CardDescription>
              </CardHeader>
              <CardContent className="p-0 pb-20 text-center space-y-4 flex flex-col items-center justify-center grayscale opacity-30">
                <ArrowDownCircle size={64} />
                <p className="text-sm font-bold">Módulo de ajustes de salida disponible próximamente.</p>
              </CardContent>
            </Card>
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
                <Button onClick={handleCreateWarehouse} className="w-full bg-slate-900 h-12 rounded-xl font-bold">
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
                  {warehouses?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center py-10 text-slate-400 italic text-xs">
                        No hay bodegas configuradas.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
