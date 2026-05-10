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
  UserCircle,
  Calculator,
  DollarSign,
  TrendingUp,
  User,
  FileText,
  Wallet,
  Landmark,
  CreditCard as CardIcon,
  BookOpen,
  Hash,
  UserCheck
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirestore, useCollection } from '@/firebase';
import { collection, doc, updateDoc, addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

interface CartItem {
  id: string;
  name: string;
  sku: string;
  price: number;
  quantity: number;
}

type PaymentMethod = 'Efectivo' | 'Tarjeta' | 'Transferencia' | 'Cheque';

export default function BillingPage() {
  const db = useFirestore();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Estado para el cliente, documento y método de pago
  const [docType, setDocType] = useState<'CF' | 'CCF'>('CF');
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Efectivo');
  const [paymentReference, setPaymentReference] = useState('');

  // Inventario real
  const { data: inventory, loading: loadingInv } = useCollection<any>(collection(db, 'inventory'));
  
  // Ventas para el cuadre
  const { data: salesToday } = useCollection<any>(collection(db, 'sales'));

  // Lógica de Búsqueda de Productos
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

    // Validar referencias de pago según el método
    if (paymentMethod === 'Tarjeta' && paymentReference.length < 4) {
      toast({ variant: "destructive", title: "Referencia Requerida", description: "Ingrese los últimos 4 dígitos de la tarjeta." });
      return;
    }
    if (paymentMethod === 'Transferencia' && !paymentReference) {
      toast({ variant: "destructive", title: "Referencia Requerida", description: "Ingrese el nombre de quien realiza la transferencia." });
      return;
    }
    if (paymentMethod === 'Cheque' && !paymentReference) {
      toast({ variant: "destructive", title: "Referencia Requerida", description: "Ingrese el código o número de cheque." });
      return;
    }

    setIsProcessing(true);

    try {
      await addDoc(collection(db, 'sales'), {
        items: cart,
        total: totalCart,
        timestamp: new Date().toISOString(),
        type: 'contado',
        docType: docType,
        paymentMethod: paymentMethod,
        paymentReference: paymentReference,
        customer: customerName || (docType === 'CF' ? 'Consumidor Final (Venta Bolsón)' : 'Cliente Genérico CCF')
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
      setCustomerName('');
      setPaymentMethod('Efectivo');
      setPaymentReference('');
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo procesar la venta." });
    } finally {
      setIsProcessing(false);
    }
  };

  const todaySalesStats = useMemo(() => {
    if (!salesToday) return { total: 0, efectivo: 0, tarjeta: 0, transferencia: 0, cheque: 0 };
    const today = new Date().toISOString().split('T')[0];
    const filtered = salesToday.filter((s: any) => s.timestamp.startsWith(today));
    
    return filtered.reduce((acc: any, s: any) => {
      const amount = s.total || 0;
      acc.total += amount;
      
      const method = (s.paymentMethod || 'Efectivo').toLowerCase();
      if (method === 'efectivo') acc.efectivo += amount;
      else if (method === 'tarjeta') acc.tarjeta += amount;
      else if (method === 'transferencia') acc.transferencia += amount;
      else if (method === 'cheque') acc.cheque += amount;
      
      return acc;
    }, { total: 0, efectivo: 0, tarjeta: 0, transferencia: 0, cheque: 0 });
  }, [salesToday]);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between mb-6">
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
          <TabsList className="bg-white p-1 rounded-2xl shadow-sm border border-slate-100 h-auto">
            <TabsTrigger value="facturacion" className="rounded-xl data-[state=active]:bg-blue-600 data-[state=active]:text-white px-6 py-2">
              <ShoppingCart size={16} className="mr-2" />
              Facturación
            </TabsTrigger>
            <TabsTrigger value="abono" className="rounded-xl data-[state=active]:bg-blue-600 data-[state=active]:text-white px-6 py-2">
              <UserCircle size={16} className="mr-2" />
              Abono de Clientes
            </TabsTrigger>
            <TabsTrigger value="cuadre" className="rounded-xl data-[state=active]:bg-blue-600 data-[state=active]:text-white px-6 py-2">
              <Calculator size={16} className="mr-2" />
              Cuadre de Caja
            </TabsTrigger>
          </TabsList>

          <TabsContent value="facturacion" className="grid grid-cols-1 lg:grid-cols-12 gap-6 focus-visible:outline-none">
            {/* PANEL IZQUIERDO: DETALLE DE VENTA */}
            <div className="lg:col-span-4 space-y-4">
              <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
                <CardHeader className="bg-slate-900 text-white p-5">
                  <div className="flex justify-between items-center mb-2">
                    <CardTitle className="text-base font-bold">Detalle de Venta</CardTitle>
                    <Badge variant="outline" className="text-[10px] text-blue-400 border-blue-400 uppercase">
                      {docType === 'CF' ? 'Consumidor Final' : 'Crédito Fiscal'}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[9px] uppercase font-bold text-slate-500">Total a Pagar</p>
                      <p className="text-3xl font-black text-blue-400">${totalCart.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] uppercase font-bold text-slate-500">Método: {paymentMethod}</p>
                      <p className="text-lg font-bold">{cart.length} Items</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-[300px] overflow-y-auto">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="w-[40px] text-[10px] font-bold px-3">CANT</TableHead>
                          <TableHead className="text-[10px] font-bold">PRODUCTO</TableHead>
                          <TableHead className="text-right text-[10px] font-bold">TOTAL</TableHead>
                          <TableHead className="w-[30px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cart.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-12 text-slate-400 italic text-xs">
                              Haga clic en los productos para agregar
                            </TableCell>
                          </TableRow>
                        ) : cart.map((item) => (
                          <TableRow key={item.id} className="hover:bg-slate-50 border-b border-slate-50">
                            <TableCell className="font-black text-blue-600 px-3">{item.quantity}</TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-900 text-[11px] leading-tight">{item.name}</span>
                                <span className="text-[9px] font-mono text-slate-400">${item.price.toFixed(2)} unit.</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-bold text-slate-900 text-[11px]">${(item.price * item.quantity).toFixed(2)}</TableCell>
                            <TableCell className="px-2">
                              <Button variant="ghost" size="icon" onClick={() => removeFromCart(item.id)} className="h-6 w-6 text-slate-300 hover:text-rose-500">
                                <Trash2 size={12} />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Selector de Pago en la Factura */}
                  <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-4">
                    <div>
                      <Label className="text-[10px] font-bold uppercase text-slate-400 mb-2 block">Forma de Pago</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {(['Efectivo', 'Tarjeta', 'Transferencia', 'Cheque'] as PaymentMethod[]).map((method) => (
                          <Button 
                            key={method}
                            variant={paymentMethod === method ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => {
                              setPaymentMethod(method);
                              setPaymentReference('');
                            }}
                            className={`h-9 rounded-xl text-[10px] font-bold transition-all ${paymentMethod === method ? 'bg-blue-600 shadow-md' : 'bg-white border-slate-200'}`}
                          >
                            {method === 'Efectivo' && <Wallet size={12} className="mr-1.5" />}
                            {method === 'Tarjeta' && <CardIcon size={12} className="mr-1.5" />}
                            {method === 'Transferencia' && <Landmark size={12} className="mr-1.5" />}
                            {method === 'Cheque' && <BookOpen size={12} className="mr-1.5" />}
                            {method}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Campos condicionales según el método de pago */}
                    {paymentMethod !== 'Efectivo' && (
                      <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                        <Label className="text-[10px] font-bold uppercase text-blue-600 flex items-center gap-1">
                          {paymentMethod === 'Tarjeta' && <><Hash size={10} /> Últimos 4 Dígitos</>}
                          {paymentMethod === 'Transferencia' && <><UserCheck size={10} /> Nombre de quien transfiere</>}
                          {paymentMethod === 'Cheque' && <><Hash size={10} /> Número de Cheque / Código</>}
                        </Label>
                        <Input 
                          placeholder={
                            paymentMethod === 'Tarjeta' ? "0000" : 
                            paymentMethod === 'Transferencia' ? "Nombre completo..." : 
                            "Número de cheque..."
                          }
                          value={paymentReference}
                          onChange={(e) => setPaymentReference(e.target.value)}
                          className="h-10 bg-white border-blue-100 rounded-xl focus:ring-blue-500/20 text-xs font-bold"
                          maxLength={paymentMethod === 'Tarjeta' ? 4 : 50}
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              <Button 
                className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg shadow-lg"
                disabled={cart.length === 0 || isProcessing}
                onClick={handleFinalizeSale}
              >
                {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <CreditCard className="mr-2" />}
                Cobrar y Descargar Stock
              </Button>
            </div>

            {/* PANEL DERECHO: BÚSQUEDA Y CUADRÍCULA */}
            <div className="lg:col-span-8 space-y-4">
              
              {/* AREA DE CLIENTE */}
              <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-100 px-4 py-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Información del Receptor</span>
                </div>
                <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-end">
                  <div className="w-full md:w-48 space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase text-slate-400">Tipo de Documento</Label>
                    <Select value={docType} onValueChange={(v: any) => setDocType(v)}>
                      <SelectTrigger className="h-10 rounded-xl bg-slate-50 border-slate-100 focus:ring-blue-500/20">
                        <SelectValue placeholder="Tipo Doc" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CF">Consumidor Final</SelectItem>
                        <SelectItem value="CCF">Crédito Fiscal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1 w-full space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase text-slate-400">
                      {docType === 'CF' ? 'Nombre Cliente (Bolsón)' : 'Razón Social / NRC'}
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <Input 
                        placeholder={docType === 'CF' ? "Venta a Consumidor Final..." : "Escriba razón social o NRC..."}
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="pl-10 h-10 bg-slate-50 border-slate-100 rounded-xl focus:ring-blue-500/20"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* BUSCADOR DE PRODUCTOS */}
              <div className="flex justify-end">
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <Input 
                    placeholder="Filtrar por código o nombre..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-10 bg-white border-none shadow-sm rounded-xl text-sm font-medium"
                  />
                </div>
              </div>

              {/* CUADRÍCULA DE PRODUCTOS */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
                {filteredProducts.map((product) => {
                  const isOutOfStock = product.quantity <= 0;
                  return (
                    <div 
                      key={product.id}
                      onClick={() => !isOutOfStock && addToCart(product)}
                      className={`relative bg-white p-3 rounded-2xl shadow-sm border border-slate-100 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between aspect-square ${isOutOfStock ? 'opacity-50 grayscale' : ''}`}
                    >
                      <div className="flex justify-between items-start">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isOutOfStock ? 'bg-rose-100 text-rose-500' : 'bg-blue-50 text-blue-500'}`}>
                          <Package size={16} />
                        </div>
                        <Badge className={`text-[9px] font-black px-1.5 h-5 ${isOutOfStock ? 'bg-rose-100 text-rose-600 border-rose-200' : 'bg-emerald-100 text-emerald-600 border-emerald-200'}`} variant="outline">
                          {product.quantity}
                        </Badge>
                      </div>
                      
                      <div className="mt-2 flex-1">
                        <h3 className="text-[11px] font-bold text-slate-900 leading-tight line-clamp-2">{product.name}</h3>
                        <p className="text-[9px] font-mono font-bold text-slate-400 mt-0.5">{product.sku}</p>
                      </div>

                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50">
                        <span className="text-sm font-black text-slate-900">${(product.price || 0).toFixed(2)}</span>
                        {!isOutOfStock && (
                          <div className="w-6 h-6 bg-slate-900 text-white rounded-lg flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                            <Plus size={12} />
                          </div>
                        )}
                      </div>
                      
                      {isOutOfStock && (
                        <div className="absolute inset-0 bg-white/10 flex items-center justify-center rounded-2xl backdrop-blur-[0.5px]">
                          <span className="bg-rose-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-lg border border-rose-400 uppercase">Sin Stock</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          {/* CONTENIDO: ABONO DE CLIENTES */}
          <TabsContent value="abono" className="focus-visible:outline-none">
            <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
              <CardHeader className="bg-slate-50 border-b border-slate-100 p-8">
                <CardTitle className="text-xl font-bold flex items-center gap-2 text-slate-900">
                  <UserCircle className="text-blue-600" />
                  Registro de Abonos a Cuentas por Cobrar
                </CardTitle>
                <CardDescription>Gestión de créditos y pagos de clientes recurrentes</CardDescription>
              </CardHeader>
              <CardContent className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-slate-400">Buscar Cliente</Label>
                      <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <Input placeholder="Nombre del cliente o NRC..." className="pl-12 h-12 rounded-xl bg-slate-50 border-slate-200" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-slate-400">Monto del Abono ($)</Label>
                      <Input type="number" step="0.01" className="h-14 text-2xl font-black rounded-xl bg-slate-50 border-slate-200" placeholder="0.00" />
                    </div>
                    <Button className="w-full h-14 bg-blue-600 hover:bg-blue-700 rounded-xl font-bold text-lg shadow-lg">
                      Registrar Pago
                    </Button>
                  </div>
                  <div className="bg-slate-50 rounded-3xl p-8 border border-slate-100 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm">
                      <FileText className="text-slate-200" size={32} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">Estado de Cuenta</h4>
                      <p className="text-sm text-slate-500 max-w-[200px] mx-auto">Seleccione un cliente para ver su saldo actual y procesar abonos.</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* CONTENIDO: CUADRE DE CAJA */}
          <TabsContent value="cuadre" className="focus-visible:outline-none">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              {/* Resumen General */}
              <Card className="border-none shadow-sm rounded-3xl bg-blue-600 text-white md:col-span-2">
                <CardContent className="p-8 space-y-2">
                  <p className="text-blue-100 text-xs font-bold uppercase tracking-wider">Total Ventas Brutas Hoy</p>
                  <p className="text-5xl font-black">${todaySalesStats.total.toFixed(2)}</p>
                  <div className="flex items-center gap-1 text-[10px] font-bold text-blue-200">
                    <TrendingUp size={12} /> Desglose de operaciones en tiempo real
                  </div>
                </CardContent>
              </Card>

              {/* Efectivo Esperado */}
              <Card className="border-none shadow-sm rounded-3xl bg-emerald-600 text-white">
                <CardContent className="p-6 space-y-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Wallet size={16} className="text-emerald-200" />
                    <p className="text-emerald-100 text-[10px] font-bold uppercase">Caja (Efectivo)</p>
                  </div>
                  <p className="text-3xl font-black">${todaySalesStats.efectivo.toFixed(2)}</p>
                </CardContent>
              </Card>

              {/* No Efectivo */}
              <Card className="border-none shadow-sm rounded-3xl bg-slate-900 text-white shadow-xl">
                <CardContent className="p-6 space-y-1">
                  <div className="flex items-center gap-2 mb-2">
                    <CardIcon size={16} className="text-slate-400" />
                    <p className="text-slate-500 text-[10px] font-bold uppercase">Otros Métodos</p>
                  </div>
                  <p className="text-3xl font-black text-blue-400">${(todaySalesStats.tarjeta + todaySalesStats.transferencia + todaySalesStats.cheque).toFixed(2)}</p>
                </CardContent>
              </Card>
            </div>

            {/* Desglose por Método de Pago */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              {[
                { label: 'Efectivo', value: todaySalesStats.efectivo, icon: <Wallet className="text-emerald-500" /> },
                { label: 'Tarjeta', value: todaySalesStats.tarjeta, icon: <CardIcon className="text-blue-500" /> },
                { label: 'Transferencia', value: todaySalesStats.transferencia, icon: <Landmark className="text-purple-500" /> },
                { label: 'Cheque', value: todaySalesStats.cheque, icon: <BookOpen className="text-orange-500" /> }
              ].map((item) => (
                <Card key={item.label} className="border-none shadow-sm rounded-2xl bg-white border border-slate-100">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center">
                      {item.icon}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">{item.label}</p>
                      <p className="text-xl font-black text-slate-900">${item.value.toFixed(2)}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Listado de Transacciones */}
            <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden border border-slate-100">
              <CardHeader className="p-8 border-b border-slate-50 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-900">
                    <DollarSign className="text-emerald-500" />
                    Transacciones del Día
                  </CardTitle>
                  <CardDescription>Registro cronológico de ventas por método de pago</CardDescription>
                </div>
                <Button variant="outline" className="rounded-xl border-slate-200 font-bold text-xs h-10">
                  Imprimir Reporte
                </Button>
              </CardHeader>
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="text-[10px] font-bold uppercase">Hora</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase">Cliente</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase">Documento</TableHead>
                    <TableHead className="text-[10px] font-bold uppercase">Método / Ref</TableHead>
                    <TableHead className="text-right text-[10px] font-bold uppercase">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesToday?.filter((s: any) => s.timestamp.startsWith(new Date().toISOString().split('T')[0]))
                    .sort((a: any, b: any) => b.timestamp.localeCompare(a.timestamp))
                    .map((sale: any) => (
                    <TableRow key={sale.id} className="hover:bg-slate-50">
                      <TableCell className="text-xs text-slate-500 font-mono">
                        {new Date(sale.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </TableCell>
                      <TableCell className="font-bold text-slate-900 text-xs">{sale.customer}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[9px] font-black uppercase tracking-tighter bg-slate-50">
                          {sale.docType || 'CF'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600">
                            {sale.paymentMethod === 'Tarjeta' && <CardIcon size={10} />}
                            {sale.paymentMethod === 'Efectivo' && <Wallet size={10} />}
                            {sale.paymentMethod === 'Transferencia' && <Landmark size={10} />}
                            {sale.paymentMethod === 'Cheque' && <BookOpen size={10} />}
                            {sale.paymentMethod || 'Efectivo'}
                          </div>
                          {sale.paymentReference && (
                            <span className="text-[9px] text-blue-500 font-bold truncate max-w-[120px]">
                              Ref: {sale.paymentReference}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-black text-slate-900">${(sale.total || 0).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                  {(!salesToday || salesToday.filter((s: any) => s.timestamp.startsWith(new Date().toISOString().split('T')[0])).length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-20 text-slate-400 italic">No se han registrado ventas hoy</TableCell>
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
