
'use client';

import React, { useState, useMemo, useEffect } from 'react';
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
  User,
  FileText,
  Wallet,
  Landmark,
  CreditCard as CardIcon,
  BookOpen,
  Hash,
  UserCheck,
  Receipt,
  MinusCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  Coins,
  Banknote,
  Users,
  History,
  CheckCircle,
  FileSearch,
  AlertCircle,
  Clock,
  ArrowRightLeft,
  Ticket
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFirestore, useCollection, useUser, useDoc } from '@/firebase';
import { collection, doc, updateDoc, addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';

interface CartItem {
  id: string;
  name: string;
  sku: string;
  price: number;
  quantity: number;
}

type PaymentMethod = 'Efectivo' | 'Tarjeta' | 'Transferencia' | 'Credito' | 'Cheque';

export default function BillingPage() {
  const db = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  const [docType, setDocType] = useState<'CF' | 'CCF'>('CF');
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Efectivo');
  const [paymentReference, setPaymentReference] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  const userProfileRef = useMemo(() => user ? doc(db, 'users', user.uid) : null, [db, user]);
  const { data: userProfile } = useDoc<any>(userProfileRef);

  const isAdminOrManager = useMemo(() => {
    return userProfile?.role === 'admin' || userProfile?.role === 'manager';
  }, [userProfile]);

  const inventoryQuery = useMemo(() => collection(db, 'inventory'), [db]);
  const salesQuery = useMemo(() => collection(db, 'sales'), [db]);
  const customersQuery = useMemo(() => collection(db, 'customers'), [db]);

  const { data: inventory } = useCollection<any>(inventoryQuery);
  const { data: salesAll } = useCollection<any>(salesQuery);
  const { data: customers } = useCollection<any>(customersQuery);

  const filteredProducts = useMemo(() => {
    if (!inventory) return [];
    return inventory.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.sku.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, inventory]);

  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    return customers.filter(c => 
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      (c.nit && c.nit.toLowerCase().includes(customerSearch.toLowerCase()))
    );
  }, [customerSearch, customers]);

  const accountsReceivable = useMemo(() => {
    if (!salesAll) return [];
    const credits = salesAll.filter((s: any) => s.paymentMethod === 'Credito' && s.status !== 'CANCELADA');
    const grouped = credits.reduce((acc: any, sale: any) => {
      const name = sale.customer || 'Consumidor Final';
      if (!acc[name]) acc[name] = { total: 0, count: 0, items: [] };
      acc[name].total += sale.total;
      acc[name].count += 1;
      acc[name].items.push(sale);
      return acc;
    }, {});
    return Object.entries(grouped).map(([name, data]: [string, any]) => ({ name, ...data }));
  }, [salesAll]);

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { id: product.id, name: product.name, sku: product.sku, price: product.price || 0, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => setCart(prev => prev.filter(item => item.id !== id));
  const updateCartPrice = (id: string, newPrice: number) => setCart(prev => prev.map(item => item.id === id ? { ...item, price: newPrice } : item));
  const totalCart = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  const handleFinalizeSale = async () => {
    if (cart.length === 0) return;
    if (paymentMethod === 'Credito' && !isAdminOrManager) {
      toast({ variant: "destructive", title: "Acceso Denegado", description: "Solo gerentes o encargados pueden autorizar ventas al crédito." });
      return;
    }

    setIsProcessing(true);
    try {
      await addDoc(collection(db, 'sales'), {
        items: cart,
        total: totalCart,
        timestamp: new Date().toISOString(),
        docType,
        paymentMethod,
        paymentReference,
        status: paymentMethod === 'Credito' ? 'PENDIENTE' : 'COMPLETADA',
        customer: customerName || (docType === 'CF' ? 'Consumidor Final' : 'Cliente CCF'),
        authorizedBy: paymentMethod === 'Credito' ? userProfile?.fullName : null
      });
      for (const item of cart) {
        const product = inventory.find((p: any) => p.id === item.id);
        if (product) updateDoc(doc(db, 'inventory', item.id), { quantity: Math.max(0, product.quantity - item.quantity) });
      }
      toast({ title: "Venta Exitosa", description: "Operación procesada correctamente." });
      setCart([]);
      setCustomerName('');
      setPaymentMethod('Efectivo');
      setPaymentReference('');
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo procesar." });
    } finally {
      setIsProcessing(false);
    }
  };

  const selectRegisteredCustomer = (c: any) => {
    setCustomerName(c.name);
    setDocType(c.category === 'Crédito Fiscal' ? 'CCF' : 'CF');
    toast({ title: "Cliente Cargado", description: `${c.name} seleccionado.` });
  };

  const accountingStats = useMemo(() => {
    if (!mounted) return { efectivoSales: 0, totalExpenses: 0, salesTodayList: [] };
    const today = new Date().toISOString().split('T')[0];
    const salesToday = (salesAll || []).filter((s: any) => s.timestamp.startsWith(today));
    const efectivo = salesToday.filter((s: any) => s.paymentMethod === 'Efectivo').reduce((acc: number, s: any) => acc + s.total, 0);
    return { efectivoSales: efectivo, salesTodayList: salesToday };
  }, [salesAll, mounted]);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="rounded-full bg-white shadow-sm" onClick={() => router.push('/')}>
            <ArrowLeft className="text-slate-600" size={20} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Módulo de Facturación</h1>
            <p className="text-slate-500 text-sm">Operaciones de venta y control de clientes</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        <Tabs defaultValue="facturacion" className="space-y-6">
          <TabsList className="bg-white p-1 rounded-2xl shadow-sm border border-slate-100 h-auto flex-wrap">
            <TabsTrigger value="facturacion" className="rounded-xl data-[state=active]:bg-blue-600 data-[state=active]:text-white px-6 py-2">
              <ShoppingCart size={16} className="mr-2" /> Facturación
            </TabsTrigger>
            <TabsTrigger value="historial" className="rounded-xl data-[state=active]:bg-blue-600 data-[state=active]:text-white px-6 py-2">
              <History size={16} className="mr-2" /> Ventas del Día
            </TabsTrigger>
            <TabsTrigger value="cuentas" className="rounded-xl data-[state=active]:bg-blue-600 data-[state=active]:text-white px-6 py-2">
              <FileSearch size={16} className="mr-2" /> Estado de Cuenta
            </TabsTrigger>
          </TabsList>

          <TabsContent value="facturacion" className="grid grid-cols-1 lg:grid-cols-12 gap-6 focus-visible:outline-none">
            <div className="lg:col-span-5 space-y-4">
              <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
                <CardHeader className="bg-slate-900 text-white p-5">
                  <div className="flex justify-between items-center mb-2">
                    <CardTitle className="text-base font-bold">Detalle de Venta</CardTitle>
                    <Badge variant="outline" className="text-[10px] text-blue-400 border-blue-400 uppercase">{docType}</Badge>
                  </div>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[9px] uppercase font-bold text-slate-500">Total a Pagar</p>
                      <p className="text-3xl font-black text-blue-400">${totalCart.toFixed(2)}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[300px]">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="w-[50px] text-[10px] px-3">CANT</TableHead>
                          <TableHead className="text-[10px]">PRODUCTO</TableHead>
                          <TableHead className="text-right text-[10px]">TOTAL</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cart.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center py-20 text-slate-400 italic text-xs">
                              Escanee o seleccione productos
                            </TableCell>
                          </TableRow>
                        ) : cart.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-black text-blue-600">{item.quantity}</TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-bold text-xs">{item.name}</span>
                                <div className="flex items-center gap-1 mt-1">
                                  <span className="text-[9px] text-slate-400 uppercase font-bold">Precio:</span>
                                  <Input 
                                    type="number" 
                                    step="0.01" 
                                    value={item.price} 
                                    onChange={(e) => updateCartPrice(item.id, parseFloat(e.target.value) || 0)} 
                                    className="h-6 w-20 text-[10px] bg-slate-50 font-bold" 
                                  />
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-bold text-xs">${(item.price * item.quantity).toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                  <div className="p-4 border-t bg-slate-50/50 space-y-4">
                    <Label className="text-[10px] font-bold uppercase text-slate-400">Forma de Pago</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      <Button variant={paymentMethod === 'Efectivo' ? 'default' : 'outline'} size="sm" onClick={() => setPaymentMethod('Efectivo')} className="h-9 text-[10px] font-bold rounded-xl">
                        <Wallet size={14} className="mr-2" /> Efectivo
                      </Button>
                      <Button variant={paymentMethod === 'Tarjeta' ? 'default' : 'outline'} size="sm" onClick={() => setPaymentMethod('Tarjeta')} className="h-9 text-[10px] font-bold rounded-xl">
                        <CardIcon size={14} className="mr-2" /> Tarjeta
                      </Button>
                      <Button variant={paymentMethod === 'Transferencia' ? 'default' : 'outline'} size="sm" onClick={() => setPaymentMethod('Transferencia')} className="h-9 text-[10px] font-bold rounded-xl">
                        <Landmark size={14} className="mr-2" /> Transf.
                      </Button>
                      <Button variant={paymentMethod === 'Cheque' ? 'default' : 'outline'} size="sm" onClick={() => setPaymentMethod('Cheque')} className="h-9 text-[10px] font-bold rounded-xl">
                        <Ticket size={14} className="mr-2" /> Cheque
                      </Button>
                      <Button 
                        variant={paymentMethod === 'Credito' ? 'default' : 'outline'} 
                        size="sm" 
                        disabled={!isAdminOrManager}
                        onClick={() => setPaymentMethod('Credito')} 
                        className={`h-9 text-[10px] font-bold rounded-xl ${!isAdminOrManager ? 'opacity-50' : ''}`}
                      >
                        <Clock size={14} className="mr-2" /> {isAdminOrManager ? 'Crédito' : 'Crédito (Bloq)'}
                      </Button>
                    </div>
                    {!isAdminOrManager && (
                      <p className="text-[9px] text-rose-500 font-bold italic">
                        * El pago al crédito requiere autorización de gerencia.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
              <Button className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold" disabled={cart.length === 0 || isProcessing} onClick={handleFinalizeSale}>
                {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <CreditCard className="mr-2" />} Finalizar Venta
              </Button>
            </div>

            <div className="lg:col-span-7 space-y-4">
              <Card className="border-none shadow-sm rounded-2xl bg-white p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Receptor de Factura</Label>
                    <div className="flex gap-2">
                      <Input placeholder="Nombre del receptor..." value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="h-10 bg-slate-50 rounded-xl" />
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="h-10 rounded-xl px-3 border-slate-200">
                            <Users size={16} className="mr-2 text-blue-600" /> <span className="text-xs font-bold">Clientes</span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-0" align="end">
                          <div className="p-3 border-b">
                            <Input placeholder="Buscar cliente..." value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} className="h-8 text-xs" />
                          </div>
                          <ScrollArea className="h-60">
                            <div className="p-1">
                              {filteredCustomers.map((c: any) => (
                                <div key={c.id} onClick={() => selectRegisteredCustomer(c)} className="p-3 hover:bg-slate-50 cursor-pointer rounded-lg transition-colors group">
                                  <p className="text-[11px] font-bold text-slate-900 group-hover:text-blue-600">{c.name}</p>
                                  <p className="text-[9px] text-slate-400">{c.category || c.type} • NIT: {c.nit || 'CF'}</p>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  <div className="w-full md:w-48 space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Tipo de Documento</Label>
                    <Select value={docType} onValueChange={(v: any) => setDocType(v)}>
                      <SelectTrigger className="h-10 rounded-xl bg-slate-50 border-slate-100"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="CF">Consumidor Final</SelectItem><SelectItem value="CCF">Crédito Fiscal</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
              </Card>

              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <Input placeholder="Buscar producto por SKU o Nombre..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-12 h-12 bg-white border-none shadow-sm rounded-2xl" />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {filteredProducts.map((p: any) => (
                  <div key={p.id} onClick={() => addToCart(p)} className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 hover:border-blue-400 cursor-pointer transition-all flex flex-col justify-between aspect-square">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400">{p.sku}</p>
                      <h3 className="text-xs font-bold text-slate-900 leading-tight line-clamp-2 h-8">{p.name}</h3>
                    </div>
                    <div className="mt-2 pt-2 border-t flex justify-between items-center">
                      <span className="text-sm font-black">${(p.price || 0).toFixed(2)}</span>
                      <Badge variant="outline" className={`text-[9px] ${p.quantity <= 0 ? 'text-rose-500 border-rose-100' : 'text-emerald-600 border-emerald-100'}`}>{p.quantity} un.</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="historial" className="space-y-4 outline-none">
            <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
              <CardHeader className="bg-slate-900 text-white p-6">
                <CardTitle className="flex items-center gap-2"><History /> Registro de Ventas de Hoy</CardTitle>
                <CardDescription className="text-slate-400">Ventas procesadas en la fecha actual</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="px-6">Hora</TableHead>
                      <TableHead>Documento</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Pago</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accountingStats.salesTodayList.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-20 text-slate-400 italic">No hay ventas registradas hoy.</TableCell></TableRow>
                    ) : accountingStats.salesTodayList.map((sale: any) => (
                      <TableRow key={sale.id}>
                        <TableCell className="px-6 text-xs text-slate-500">{new Date(sale.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[9px] font-black">{sale.docType}</Badge></TableCell>
                        <TableCell className="font-bold text-xs">{sale.customer}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
                             {sale.paymentMethod === 'Efectivo' && <Wallet size={12} className="text-emerald-500" />}
                             {sale.paymentMethod === 'Tarjeta' && <CardIcon size={12} className="text-blue-500" />}
                             {sale.paymentMethod === 'Transferencia' && <Landmark size={12} className="text-purple-500" />}
                             {sale.paymentMethod === 'Cheque' && <Ticket size={12} className="text-slate-400" />}
                             {sale.paymentMethod === 'Credito' && <Clock size={12} className="text-amber-500" />}
                             {sale.paymentMethod}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-black text-slate-900">${sale.total.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cuentas" className="space-y-4 outline-none">
            <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
              <CardHeader className="bg-slate-900 text-white p-6">
                <CardTitle className="flex items-center gap-2"><FileSearch /> Estado de Cuenta: Cuentas por Cobrar</CardTitle>
                <CardDescription className="text-slate-400">Créditos otorgados a clientes</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="px-6">Cliente</TableHead>
                      <TableHead>Facturas Pendientes</TableHead>
                      <TableHead className="text-right">Saldo Deudor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accountsReceivable.length === 0 ? (
                      <TableRow><TableCell colSpan={3} className="text-center py-20 text-slate-400 italic">No hay cuentas por cobrar pendientes.</TableCell></TableRow>
                    ) : accountsReceivable.map((acc: any) => (
                      <TableRow key={acc.name}>
                        <TableCell className="px-6 font-bold">{acc.name}</TableCell>
                        <TableCell>{acc.count} ventas al crédito</TableCell>
                        <TableCell className="text-right font-black text-rose-600">${acc.total.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
