
'use client';

import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Plus, 
  Trash2, 
  ArrowLeft, 
  ShoppingCart,
  Package,
  CreditCard,
  Loader2,
  AlertCircle,
  UserCircle,
  History,
  Calculator,
  DollarSign,
  TrendingUp
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFirestore, useCollection } from '@/firebase';
import { collection, doc, updateDoc, addDoc, query, where, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

interface CartItem {
  id: string;
  name: string;
  sku: string;
  price: number;
  quantity: number;
}

export default function BillingPage() {
  const db = useFirestore();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Inventario real
  const { data: inventory, loading: loadingInv } = useCollection<any>(collection(db, 'inventory'));
  
  // Ventas para el cuadre
  const { data: salesToday } = useCollection<any>(collection(db, 'sales'));

  // Lógica de Venta
  const filteredProducts = useMemo(() => {
    if (!inventory) return [];
    return inventory.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.sku.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, inventory]);

  const addToCart = (product: any) => {
    if (product.quantity <= 0) {
      toast({ variant: "destructive", title: "Sin Existencias", description: "No hay stock disponible para este código." });
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.quantity) {
          toast({ variant: "destructive", title: "Límite alcanzado", description: "No puedes vender más de la existencia actual." });
          return prev;
        }
        return prev.map(item => 
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { 
        id: product.id, 
        name: product.name, 
        sku: product.sku, 
        price: product.price || 0, 
        quantity: 1 
      }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const totalCart = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  const handleFinalizeSale = async () => {
    if (cart.length === 0) return;
    setIsProcessing(true);

    try {
      // Registrar venta
      await addDoc(collection(db, 'sales'), {
        items: cart,
        total: totalCart,
        timestamp: new Date().toISOString(),
        type: 'contado'
      });

      // Actualizar stock
      for (const item of cart) {
        const product = inventory.find(p => p.id === item.id);
        if (product) {
          const productRef = doc(db, 'inventory', item.id);
          await updateDoc(productRef, {
            quantity: Math.max(0, product.quantity - item.quantity)
          });
        }
      }

      toast({ title: "Venta Exitosa", description: "La factura ha sido procesada y el stock descargado." });
      setCart([]);
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo procesar la venta." });
    } finally {
      setIsProcessing(false);
    }
  };

  // Lógica Cuadre de Caja (Simplificada para hoy)
  const todaySalesTotal = useMemo(() => {
    if (!salesToday) return 0;
    const today = new Date().toISOString().split('T')[0];
    return salesToday
      .filter((s: any) => s.timestamp.startsWith(today))
      .reduce((acc: number, s: any) => acc + (s.total || 0), 0);
  }, [salesToday]);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" className="rounded-full bg-white shadow-sm hover:bg-slate-100">
              <ArrowLeft className="text-slate-600" size={20} />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Módulo de Facturación</h1>
            <p className="text-slate-500 text-sm">Operaciones de venta y control de caja</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        <Tabs defaultValue="facturacion" className="space-y-6">
          <TabsList className="bg-white p-1 rounded-2xl shadow-sm border border-slate-100">
            <TabsTrigger value="facturacion" className="rounded-xl data-[state=active]:bg-blue-600 data-[state=active]:text-white px-6">
              <ShoppingCart size={16} className="mr-2" />
              Facturación
            </TabsTrigger>
            <TabsTrigger value="abono" className="rounded-xl data-[state=active]:bg-blue-600 data-[state=active]:text-white px-6">
              <UserCircle size={16} className="mr-2" />
              Abono de Clientes
            </TabsTrigger>
            <TabsTrigger value="cuadre" className="rounded-xl data-[state=active]:bg-blue-600 data-[state=active]:text-white px-6">
              <Calculator size={16} className="mr-2" />
              Cuadre de Caja
            </TabsTrigger>
          </TabsList>

          {/* CONTENIDO: FACTURACIÓN */}
          <TabsContent value="facturacion" className="grid grid-cols-1 lg:grid-cols-12 gap-8 focus-visible:outline-none">
            <div className="lg:col-span-5 space-y-4">
              <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
                <CardHeader className="bg-slate-900 text-white p-6">
                  <div className="flex justify-between items-center mb-4">
                    <CardTitle className="text-lg font-bold">Resumen de Venta</CardTitle>
                    <div className="text-[10px] font-bold uppercase text-slate-400">Punto de Venta</div>
                  </div>
                  <div className="flex justify-between items-end border-t border-slate-800 pt-4">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-500">Total a Pagar</p>
                      <p className="text-4xl font-black text-blue-400">${totalCart.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase font-bold text-slate-500">Ítems</p>
                      <p className="text-xl font-bold">{cart.length}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-[400px] overflow-y-auto">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="w-[50px] text-[10px] font-bold">CANT</TableHead>
                          <TableHead className="text-[10px] font-bold">PRODUCTO</TableHead>
                          <TableHead className="text-right text-[10px] font-bold">UNIT</TableHead>
                          <TableHead className="text-right text-[10px] font-bold">TOTAL</TableHead>
                          <TableHead className="w-[40px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cart.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-10 text-slate-400 italic">
                              Cargue productos al carrito
                            </TableCell>
                          </TableRow>
                        ) : cart.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-black text-blue-600">{item.quantity}</TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-900">{item.name}</span>
                                <span className="text-[9px] font-mono text-slate-400">{item.sku}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-slate-500">${item.price.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-bold text-slate-900">${(item.price * item.quantity).toFixed(2)}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" onClick={() => removeFromCart(item.id)} className="h-8 w-8 text-slate-300 hover:text-rose-500">
                                <Trash2 size={14} />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
              
              <Button 
                className="w-full h-16 rounded-3xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xl shadow-lg"
                disabled={cart.length === 0 || isProcessing}
                onClick={handleFinalizeSale}
              >
                {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <CreditCard className="mr-2" />}
                Finalizar Factura
              </Button>
            </div>

            <div className="lg:col-span-7 space-y-6">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input 
                  placeholder="Buscar por código SKU o descripción..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-12 h-14 bg-white border-none shadow-sm rounded-2xl"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredProducts.map((product) => {
                  const isOutOfStock = product.quantity <= 0;
                  return (
                    <Card 
                      key={product.id}
                      onClick={() => !isOutOfStock && addToCart(product)}
                      className={`border-none shadow-sm rounded-3xl bg-white hover:shadow-md transition-all cursor-pointer group ${isOutOfStock ? 'opacity-60 grayscale' : ''}`}
                    >
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isOutOfStock ? 'bg-rose-100 text-rose-500' : 'bg-blue-50 text-blue-500'}`}>
                            <Package size={24} />
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Existencia</p>
                            <p className={`text-lg font-black ${isOutOfStock ? 'text-rose-600' : 'text-slate-900'}`}>
                              {product.quantity} un.
                            </p>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <h3 className="font-bold text-slate-900 truncate">{product.name}</h3>
                          <p className="text-xs font-mono font-bold text-slate-400">{product.sku}</p>
                        </div>
                        <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-50">
                          <div className="text-2xl font-black text-slate-900">${(product.price || 0).toFixed(2)}</div>
                          {isOutOfStock ? (
                            <div className="text-[10px] font-black text-rose-500 uppercase flex items-center gap-1">
                              <AlertCircle size={14} /> Agotado
                            </div>
                          ) : (
                            <div className="w-10 h-10 bg-slate-900 text-white rounded-full flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                              <Plus size={18} />
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          {/* CONTENIDO: ABONO DE CLIENTES */}
          <TabsContent value="abono" className="focus-visible:outline-none">
            <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
              <CardHeader className="bg-slate-50 border-b border-slate-100 p-8">
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <UserCircle className="text-blue-600" />
                  Registro de Abonos a Cuentas por Cobrar
                </CardTitle>
                <CardDescription>Gestión de créditos y pagos de clientes recurrentes</CardDescription>
              </CardHeader>
              <CardContent className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase text-slate-400">Seleccionar Cliente</label>
                      <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <Input placeholder="Buscar por nombre o NRC..." className="pl-12 h-12 rounded-xl bg-slate-50 border-slate-200" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase text-slate-400">Monto del Abono ($)</label>
                      <Input type="number" step="0.01" className="h-14 text-2xl font-black rounded-xl bg-slate-50 border-slate-200" placeholder="0.00" />
                    </div>
                    <Button className="w-full h-14 bg-blue-600 rounded-xl font-bold text-lg">
                      Registrar Pago
                    </Button>
                  </div>
                  <div className="bg-slate-50 rounded-3xl p-8 border border-slate-100 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm">
                      <History className="text-slate-300" size={32} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">Sin Cliente Seleccionado</h4>
                      <p className="text-sm text-slate-500 max-w-[200px]">Busque un cliente para ver su saldo actual y procesar abonos.</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* CONTENIDO: CUADRE DE CAJA */}
          <TabsContent value="cuadre" className="focus-visible:outline-none">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <Card className="border-none shadow-sm rounded-3xl bg-blue-600 text-white">
                <CardContent className="p-8 space-y-2">
                  <p className="text-blue-100 text-xs font-bold uppercase tracking-wider">Ventas del Día (Contado)</p>
                  <p className="text-4xl font-black">${todaySalesTotal.toFixed(2)}</p>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-blue-200">
                    <TrendingUp size={12} /> +12.5% vs ayer
                  </div>
                </CardContent>
              </Card>
              <Card className="border-none shadow-sm rounded-3xl bg-white">
                <CardContent className="p-8 space-y-2">
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Abonos Recibidos</p>
                  <p className="text-4xl font-black text-slate-900">$0.00</p>
                  <div className="text-[10px] font-bold text-slate-300 italic">No se registran abonos hoy</div>
                </CardContent>
              </Card>
              <Card className="border-none shadow-sm rounded-3xl bg-slate-900 text-white">
                <CardContent className="p-8 space-y-2">
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Total en Caja Esperado</p>
                  <p className="text-4xl font-black text-emerald-400">${todaySalesTotal.toFixed(2)}</p>
                  <Button variant="ghost" className="h-auto p-0 text-blue-400 text-[10px] font-bold uppercase hover:bg-transparent">Imprimir Reporte X</Button>
                </CardContent>
              </Card>
            </div>

            <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
              <CardHeader className="p-8 border-b border-slate-50">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <DollarSign className="text-emerald-500" />
                  Detalle de Transacciones (Hoy)
                </CardTitle>
              </CardHeader>
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="text-[10px] font-bold uppercase">Hora</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase">Transacción</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase">Tipo</TableHead>
                    <TableHead className="text-right text-[10px] font-bold uppercase">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesToday?.filter((s: any) => s.timestamp.startsWith(new Date().toISOString().split('T')[0])).map((sale: any) => (
                    <TableRow key={sale.id}>
                      <TableCell className="text-xs text-slate-500">{new Date(sale.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</TableCell>
                      <TableCell className="font-bold">Factura de Venta</TableCell>
                      <TableCell>
                        <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border border-blue-100">
                          {sale.type || 'Contado'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-black text-slate-900">${sale.total.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                  {(!salesToday || salesToday.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-20 text-slate-400 italic">No hay ventas registradas este día</TableCell>
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
