'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Trash2, 
  ArrowLeft, 
  ShoppingCart,
  History,
  FileSearch,
  Clock,
  Ticket,
  CheckCircle2,
  Calculator,
  Receipt,
  Wallet,
  Landmark,
  CreditCard as CardIcon,
  Users,
  Briefcase,
  Coins,
  ArrowDownCircle,
  AlertTriangle,
  Loader2,
  DollarSign,
  Settings2
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
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
  
  // States
  const [searchTerm, setSearchTerm] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  const [docType, setDocType] = useState<'CF' | 'CCF'>('CF');
  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Efectivo');
  
  // Checkout Modal States
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentReference, setPaymentReference] = useState('');
  const [cashReceived, setCashReceived] = useState<string>('');

  // Arqueo Denominations State
  const [denominations, setDenominations] = useState({
    b100: 0, b50: 0, b20: 0, b10: 0, b5: 0, b1: 0,
    c25: 0, c10: 0, c5: 0, c01: 0
  });

  // Expense Modal State
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [newExpense, setNewExpense] = useState({ description: '', amount: '', category: 'Otros' });

  useEffect(() => {
    setMounted(true);
  }, []);

  const userProfileRef = useMemo(() => user ? doc(db, 'users', user.uid) : null, [db, user]);
  const { data: userProfile } = useDoc<any>(userProfileRef);

  const isAdminOrManager = useMemo(() => {
    return userProfile?.role === 'admin' || userProfile?.role === 'manager';
  }, [userProfile]);

  // Configuración de Fondo Base (solo lectura aquí)
  const cashConfigRef = useMemo(() => doc(db, 'system', 'cash_config'), [db]);
  const { data: cashConfig } = useDoc<any>(cashConfigRef);
  const currentCashFloat = cashConfig?.cashFloat || 0;

  const inventoryQuery = useMemo(() => collection(db, 'inventory'), [db]);
  const salesQuery = useMemo(() => collection(db, 'sales'), [db]);
  const customersQuery = useMemo(() => collection(db, 'customers'), [db]);
  const expensesQuery = useMemo(() => collection(db, 'expenses'), [db]);

  const { data: inventory } = useCollection<any>(inventoryQuery);
  const { data: salesAll } = useCollection<any>(salesQuery);
  const { data: customers } = useCollection<any>(customersQuery);
  const { data: expensesAll } = useCollection<any>(expensesQuery);

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

  const totalCart = useMemo(() => cart.reduce((acc, item) => acc + (item.price * item.quantity), 0), [cart]);

  const changeDue = useMemo(() => {
    const received = parseFloat(cashReceived) || 0;
    return Math.max(0, received - totalCart);
  }, [cashReceived, totalCart]);

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

  const handleOpenCheckout = () => {
    if (cart.length === 0) {
      toast({ variant: "destructive", title: "Carrito vacío", description: "Agregue productos antes de finalizar." });
      return;
    }
    if (paymentMethod === 'Credito' && !isAdminOrManager) {
      toast({ variant: "destructive", title: "Acceso Denegado", description: "Solo gerentes pueden autorizar ventas al crédito." });
      return;
    }
    setCashReceived('');
    setPaymentReference('');
    setIsCheckoutOpen(true);
  };

  const handleFinalizeSale = async () => {
    if (paymentMethod === 'Efectivo' && (parseFloat(cashReceived) || 0) < totalCart) {
      toast({ variant: "destructive", title: "Monto Insuficiente", description: "El dinero recibido es menor al total de la venta." });
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
        paymentReference: paymentMethod === 'Efectivo' ? `Efectivo: $${parseFloat(cashReceived).toFixed(2)} - Cambio: $${changeDue.toFixed(2)}` : paymentReference,
        status: paymentMethod === 'Credito' ? 'PENDIENTE' : 'COMPLETADA',
        customer: customerName || (docType === 'CF' ? 'Consumidor Final' : 'Cliente CCF'),
        authorizedBy: paymentMethod === 'Credito' ? userProfile?.fullName : null
      });

      for (const item of cart) {
        const product = inventory.find((p: any) => p.id === item.id);
        if (product) {
          updateDoc(doc(db, 'inventory', item.id), { 
            quantity: Math.max(0, product.quantity - item.quantity) 
          });
        }
      }

      toast({ title: "Venta Exitosa", description: "Operación procesada correctamente." });
      setCart([]);
      setCustomerName('');
      setPaymentMethod('Efectivo');
      setIsCheckoutOpen(false);
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo procesar la venta." });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddExpense = async () => {
    if (!newExpense.description || !newExpense.amount) return;
    try {
      await addDoc(collection(db, 'expenses'), {
        description: newExpense.description,
        amount: parseFloat(newExpense.amount),
        category: newExpense.category,
        timestamp: new Date().toISOString()
      });
      toast({ title: "Gasto Registrado", description: "El egreso de caja ha sido guardado." });
      setNewExpense({ description: '', amount: '', category: 'Otros' });
      setIsExpenseModalOpen(false);
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo guardar el gasto." });
    }
  };

  const salesTodayList = useMemo(() => {
    if (!mounted || !salesAll) return [];
    const today = new Date().toISOString().split('T')[0];
    return salesAll.filter((s: any) => s.timestamp.startsWith(today));
  }, [salesAll, mounted]);

  const dailyClosingTotals = useMemo(() => {
    const summary = { Efectivo: 0, Tarjeta: 0, Transferencia: 0, Cheque: 0, Credito: 0, total: 0 };
    salesTodayList.forEach((s: any) => {
      if (s.paymentMethod in summary) {
        summary[s.paymentMethod as keyof typeof summary] += s.total;
      }
      summary.total += s.total;
    });
    return summary;
  }, [salesTodayList]);

  const expensesToday = useMemo(() => {
    if (!mounted || !expensesAll) return [];
    const today = new Date().toISOString().split('T')[0];
    return expensesAll.filter((e: any) => e.timestamp.startsWith(today));
  }, [expensesAll, mounted]);

  const totalExpensesToday = useMemo(() => 
    expensesToday.reduce((acc, exp) => acc + exp.amount, 0), [expensesToday]
  );

  const physicalCashTotal = useMemo(() => {
    return (
      (denominations.b100 * 100) + (denominations.b50 * 50) + (denominations.b20 * 20) + 
      (denominations.b10 * 10) + (denominations.b5 * 5) + (denominations.b1 * 1) + 
      (denominations.c25 * 0.25) + (denominations.c10 * 0.10) + (denominations.c5 * 0.05) + 
      (denominations.c01 * 0.01)
    );
  }, [denominations]);

  // Cálculo corregido con Fondo Base
  const expectedCashBalance = currentCashFloat + dailyClosingTotals.Efectivo - totalExpensesToday;
  const cashDifference = physicalCashTotal - expectedCashBalance;

  const accountsReceivable = useMemo(() => {
    if (!salesAll) return [];
    const credits = salesAll.filter((s: any) => s.paymentMethod === 'Credito' && s.status !== 'CANCELADA');
    const grouped = credits.reduce((acc: any, sale: any) => {
      const name = sale.customer || 'Consumidor Final';
      if (!acc[name]) acc[name] = { total: 0, count: 0 };
      acc[name].total += sale.total;
      acc[name].count += 1;
      return acc;
    }, {});
    return Object.entries(grouped).map(([name, data]: [string, any]) => ({ name, ...data }));
  }, [salesAll]);

  const selectRegisteredCustomer = (c: any) => {
    setCustomerName(c.name);
    setDocType(c.category === 'Crédito Fiscal' ? 'CCF' : 'CF');
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="rounded-full bg-white shadow-sm" onClick={() => router.push('/')}>
            <ArrowLeft className="text-slate-600" size={20} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">NexWay Facturación</h1>
            <p className="text-slate-500 text-sm">Terminal de punto de venta y cierre de caja</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        <Tabs defaultValue="facturacion" className="space-y-6">
          <TabsList className="bg-white p-1 rounded-2xl shadow-sm border border-slate-100 h-auto flex-wrap">
            <TabsTrigger value="facturacion" className="rounded-xl data-[state=active]:bg-blue-600 data-[state=active]:text-white px-6 py-2">
              <ShoppingCart size={16} className="mr-2" /> Nueva Venta
            </TabsTrigger>
            <TabsTrigger value="historial" className="rounded-xl data-[state=active]:bg-blue-600 data-[state=active]:text-white px-6 py-2">
              <History size={16} className="mr-2" /> Ventas del Día
            </TabsTrigger>
            <TabsTrigger value="cierre" className="rounded-xl data-[state=active]:bg-blue-600 data-[state=active]:text-white px-6 py-2">
              <Calculator size={16} className="mr-2" /> Arqueo de Caja
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
                    <CardTitle className="text-base font-bold">Resumen de Venta</CardTitle>
                    <Badge variant="outline" className="text-[10px] text-blue-400 border-blue-400 uppercase">{docType}</Badge>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase font-bold text-slate-500">Total Gravado</p>
                    <p className="text-4xl font-black text-blue-400">${totalCart.toFixed(2)}</p>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[300px]">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="w-[50px] text-[10px] px-3 text-center">Cant</TableHead>
                          <TableHead className="text-[10px]">Producto</TableHead>
                          <TableHead className="text-right text-[10px]">Total</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cart.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-20 text-slate-400 italic text-xs">
                              Escanee o seleccione productos
                            </TableCell>
                          </TableRow>
                        ) : cart.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="text-center font-black text-blue-600">{item.quantity}</TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-bold text-xs">{item.name}</span>
                                <div className="flex items-center gap-1 mt-1">
                                  <span className="text-[9px] text-slate-400 font-bold">$</span>
                                  <Input 
                                    type="number" 
                                    step="0.01" 
                                    value={item.price} 
                                    onFocus={e => e.target.select()}
                                    onChange={(e) => updateCartPrice(item.id, parseFloat(e.target.value) || 0)} 
                                    className="h-6 w-20 text-[10px] bg-slate-50 font-bold border-none" 
                                  />
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-bold text-xs">${(item.price * item.quantity).toFixed(2)}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" onClick={() => removeFromCart(item.id)} className="h-6 w-6 text-slate-300 hover:text-rose-500">
                                <Trash2 size={12} />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                  <div className="p-4 border-t bg-slate-50/50 space-y-4">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Método de Pago Seleccionado</Label>
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
                        <Clock size={14} className="mr-2" /> Crédito
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Button className="w-full h-16 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-lg shadow-xl" disabled={cart.length === 0} onClick={handleOpenCheckout}>
                FINALIZAR VENTA
              </Button>
            </div>

            <div className="lg:col-span-7 space-y-4">
              <Card className="border-none shadow-sm rounded-2xl bg-white p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Cliente Receptor</Label>
                    <div className="flex gap-2">
                      <Input placeholder="Nombre del receptor..." value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="h-10 bg-slate-50 rounded-xl" />
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="h-10 rounded-xl px-3 border-slate-200">
                            <Users size={16} className="mr-2 text-blue-600" /> <span className="text-xs font-bold">Cargar</span>
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
                                  <p className="text-[9px] text-slate-400">NIT: {c.nit || 'C/F'}</p>
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
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="px-6">Hora</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Pago</TableHead>
                    <TableHead>Referencia / Detalle</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesTodayList.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-20 text-slate-400 italic">No hay ventas registradas hoy.</TableCell></TableRow>
                  ) : salesTodayList.map((sale: any) => (
                    <TableRow key={sale.id}>
                      <TableCell className="px-6 text-xs text-slate-500">{new Date(sale.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[9px] font-black">{sale.docType}</Badge></TableCell>
                      <TableCell className="font-bold text-xs">{sale.customer}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[9px] font-bold">
                           {sale.paymentMethod}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[10px] font-mono text-slate-400 max-w-[200px] truncate">{sale.paymentReference || 'N/A'}</TableCell>
                      <TableCell className="text-right font-black text-slate-900">${sale.total.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="cierre" className="space-y-6 outline-none">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
               <Card className="border-none shadow-sm rounded-2xl bg-white p-4">
                  <p className="text-[9px] font-black uppercase text-slate-400">Fondo Base</p>
                  <p className="text-xl font-bold text-slate-600">${currentCashFloat.toFixed(2)}</p>
               </Card>
               <Card className="border-none shadow-sm rounded-2xl bg-white p-4">
                  <p className="text-[9px] font-black uppercase text-slate-400">Efectivo Venta</p>
                  <p className="text-xl font-bold text-emerald-600">${dailyClosingTotals.Efectivo.toFixed(2)}</p>
               </Card>
               <Card className="border-none shadow-sm rounded-2xl bg-white p-4">
                  <p className="text-[9px] font-black uppercase text-slate-400">Gastos Caja</p>
                  <p className="text-xl font-bold text-rose-600">${totalExpensesToday.toFixed(2)}</p>
               </Card>
               <Card className="border-none shadow-sm rounded-2xl bg-slate-900 p-4 text-white">
                  <p className="text-[9px] font-black uppercase opacity-60">Balance Caja</p>
                  <p className="text-xl font-black">${expectedCashBalance.toFixed(2)}</p>
               </Card>
               <Card className="border-none shadow-sm rounded-2xl bg-white p-4">
                  <p className="text-[9px] font-black uppercase text-slate-400">Tarjeta</p>
                  <p className="text-xl font-bold text-slate-900">${dailyClosingTotals.Tarjeta.toFixed(2)}</p>
               </Card>
               <Card className="border-none shadow-sm rounded-2xl bg-white p-4">
                  <p className="text-[9px] font-black uppercase text-slate-400">Créditos</p>
                  <p className="text-xl font-bold text-blue-600">${dailyClosingTotals.Credito.toFixed(2)}</p>
               </Card>
               <Card className="border-none shadow-sm rounded-2xl bg-blue-600 p-4 text-white">
                  <p className="text-[9px] font-black uppercase opacity-60">Total Venta Bruta</p>
                  <p className="text-xl font-black">${dailyClosingTotals.total.toFixed(2)}</p>
               </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Conteo de Denominaciones */}
              <Card className="lg:col-span-5 border-none shadow-sm rounded-3xl bg-white overflow-hidden">
                <CardHeader className="bg-slate-50 border-b">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Coins className="text-blue-600" size={18} />
                    Conteo de Efectivo Físico
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                    <div className="space-y-3">
                      <p className="text-[10px] font-black uppercase text-slate-400 border-b pb-1">Billetes</p>
                      {[100, 50, 20, 10, 5, 1].map((v) => (
                        <div key={v} className="flex items-center justify-between gap-4">
                          <Label className="text-xs font-bold w-12">${v}.00</Label>
                          <Input 
                            type="number" 
                            className="h-8 w-20 text-right bg-slate-50 font-bold" 
                            placeholder="0"
                            value={denominations[`b${v}` as keyof typeof denominations]}
                            onFocus={e => e.target.select()}
                            onChange={e => setDenominations({...denominations, [`b${v}`]: parseInt(e.target.value) || 0})}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="space-y-3">
                      <p className="text-[10px] font-black uppercase text-slate-400 border-b pb-1">Monedas</p>
                      {[
                        { label: '$0.25', key: 'c25' },
                        { label: '$0.10', key: 'c10' },
                        { label: '$0.05', key: 'c5' },
                        { label: '$0.01', key: 'c01' }
                      ].map((c) => (
                        <div key={c.key} className="flex items-center justify-between gap-4">
                          <Label className="text-xs font-bold w-12">{c.label}</Label>
                          <Input 
                            type="number" 
                            className="h-8 w-20 text-right bg-slate-50 font-bold" 
                            placeholder="0"
                            value={denominations[c.key as keyof typeof denominations]}
                            onFocus={e => e.target.select()}
                            onChange={e => setDenominations({...denominations, [c.key]: parseInt(e.target.value) || 0})}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-6 pt-4 border-t bg-slate-50 -mx-6 px-6 pb-4">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-black uppercase text-slate-500 tracking-widest">Total Físico Contado</span>
                      <span className="text-2xl font-black text-slate-900">${physicalCashTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Gastos de Caja */}
              <Card className="lg:col-span-7 border-none shadow-sm rounded-3xl bg-white overflow-hidden flex flex-col">
                <CardHeader className="bg-slate-50 border-b px-6 py-4">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <ArrowDownCircle className="text-rose-600" size={18} />
                      Gastos de Caja (Salidas)
                    </CardTitle>
                    <Button size="sm" variant="outline" className="h-8 rounded-lg font-bold text-[10px]" onClick={() => setIsExpenseModalOpen(true)}>
                      <Plus size={14} className="mr-1" /> Registrar Gasto
                    </Button>
                  </div>
                </CardHeader>
                <div className="flex-1">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px] font-bold uppercase px-6">Descripción</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase">Categoría</TableHead>
                        <TableHead className="text-right text-[10px] font-bold uppercase pr-6">Monto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expensesToday.length === 0 ? (
                        <TableRow><TableCell colSpan={3} className="text-center py-20 text-slate-400 italic text-xs">No hay gastos hoy.</TableCell></TableRow>
                      ) : expensesToday.map((exp: any) => (
                        <TableRow key={exp.id}>
                          <TableCell className="px-6 font-bold text-xs">{exp.description}</TableCell>
                          <TableCell><Badge variant="outline" className="text-[9px] uppercase">{exp.category}</Badge></TableCell>
                          <TableCell className="text-right pr-6 font-black text-rose-600">-${exp.amount.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="p-6 bg-rose-50 border-t border-rose-100 mt-auto">
                   <div className="flex justify-between items-center">
                      <span className="text-xs font-black uppercase text-rose-600">Total Egresos Hoy</span>
                      <span className="text-xl font-black text-rose-700">-${totalExpensesToday.toFixed(2)}</span>
                   </div>
                </div>
              </Card>
            </div>

            {/* Resultado Final de Arqueo */}
            <Card className={`border-none shadow-xl rounded-3xl overflow-hidden ${cashDifference === 0 ? 'bg-emerald-600' : cashDifference > 0 ? 'bg-blue-600' : 'bg-rose-600'} text-white`}>
               <CardContent className="p-8">
                  <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="space-y-1 text-center md:text-left">
                      <p className="text-[10px] font-black uppercase opacity-60 tracking-widest">Resultado de Arqueo</p>
                      <h2 className="text-3xl font-black">
                        {cashDifference === 0 ? 'Caja Cuadrada' : cashDifference > 0 ? `Sobrante de $${cashDifference.toFixed(2)}` : `Faltante de $${Math.abs(cashDifference).toFixed(2)}`}
                      </h2>
                      <p className="text-sm opacity-80">
                        {cashDifference === 0 
                          ? 'El dinero físico coincide perfectamente con el sistema.' 
                          : 'Existe una discrepancia entre lo esperado y lo contado.'}
                      </p>
                    </div>
                    <div className="flex gap-4">
                       <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-sm border border-white/10 text-center">
                          <p className="text-[9px] font-black uppercase opacity-60 mb-1">Efectivo Esperado</p>
                          <p className="text-xl font-bold">${expectedCashBalance.toFixed(2)}</p>
                       </div>
                       <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-sm border border-white/20 text-center">
                          <p className="text-[9px] font-black uppercase opacity-60 mb-1">Efectivo Físico</p>
                          <p className="text-xl font-bold">${physicalCashTotal.toFixed(2)}</p>
                       </div>
                    </div>
                  </div>
               </CardContent>
            </Card>
            
            <div className="flex justify-center">
              <Button 
                variant="outline" 
                className="rounded-full border-slate-200 bg-white text-slate-500 font-bold px-8 h-10 hover:bg-slate-50 transition-all"
                onClick={() => router.push('/management')}
              >
                <Settings2 className="mr-2" size={16} /> Configurar Fondo Base en Gerencia
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="cuentas" className="space-y-4 outline-none">
            <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="px-6">Cliente</TableHead>
                    <TableHead>Ventas Pendientes</TableHead>
                    <TableHead className="text-right">Saldo Deudor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accountsReceivable.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center py-20 text-slate-400 italic">No hay cuentas por cobrar.</TableCell></TableRow>
                  ) : accountsReceivable.map((acc: any) => (
                    <TableRow key={acc.name}>
                      <TableCell className="px-6 font-bold">{acc.name}</TableCell>
                      <TableCell>{acc.count} facturas al crédito</TableCell>
                      <TableCell className="text-right font-black text-rose-600">${acc.total.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Checkout Dialog */}
      <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-black">
              <Receipt className="text-blue-600" /> Confirmar Venta
            </DialogTitle>
            <DialogDescription>Revise los detalles antes de imprimir el comprobante.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase text-slate-400">Cliente</span>
                <span className="text-xs font-bold text-slate-900">{customerName || 'Consumidor Final'}</span>
              </div>
              <div className="flex justify-between items-center border-t pt-2 mt-2">
                <span className="text-sm font-black text-slate-900">TOTAL A PAGAR</span>
                <span className="text-2xl font-black text-blue-600">${totalCart.toFixed(2)}</span>
              </div>
            </div>

            {paymentMethod === 'Efectivo' ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Efectivo Recibido</Label>
                  <div className="relative">
                    <Calculator className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <Input 
                      type="number" 
                      placeholder="0.00" 
                      value={cashReceived}
                      onFocus={e => e.target.select()}
                      onChange={e => setCashReceived(e.target.value)}
                      className="h-14 pl-10 text-2xl font-black bg-white border-slate-200"
                    />
                  </div>
                </div>
                {parseFloat(cashReceived) >= totalCart && (
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 animate-in fade-in slide-in-from-top-2">
                    <p className="text-[10px] font-black uppercase text-emerald-600 mb-1">Cambio para el cliente</p>
                    <p className="text-3xl font-black text-emerald-700">${changeDue.toFixed(2)}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">Referencia de Operación</Label>
                <div className="relative">
                  <CardIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <Input 
                    placeholder="Últimos 4 dígitos o Cód. Transf..."
                    value={paymentReference}
                    onChange={e => setPaymentReference(e.target.value)}
                    className="h-12 pl-10 font-bold"
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setIsCheckoutOpen(false)} className="rounded-xl font-bold">Cancelar</Button>
            <Button 
              disabled={isProcessing || (paymentMethod === 'Efectivo' && (parseFloat(cashReceived) || 0) < totalCart)} 
              onClick={handleFinalizeSale}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl h-12 px-8 shadow-lg shadow-blue-500/20"
            >
              {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2" />}
              CONFIRMAR VENTA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Expense Modal */}
      <Dialog open={isExpenseModalOpen} onOpenChange={setIsExpenseModalOpen}>
        <DialogContent className="rounded-3xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
               <ArrowDownCircle className="text-rose-600" /> Nuevo Gasto de Caja
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
               <Label className="text-[10px] font-bold uppercase text-slate-400">Descripción</Label>
               <Input 
                 placeholder="Ej. Gasolina entrega..." 
                 value={newExpense.description} 
                 onChange={e => setNewExpense({...newExpense, description: e.target.value})}
               />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                 <Label className="text-[10px] font-bold uppercase text-slate-400">Monto</Label>
                 <Input 
                   type="number" 
                   placeholder="0.00" 
                   value={newExpense.amount} 
                   onChange={e => setNewExpense({...newExpense, amount: e.target.value})}
                 />
              </div>
              <div className="space-y-2">
                 <Label className="text-[10px] font-bold uppercase text-slate-400">Categoría</Label>
                 <Select value={newExpense.category} onValueChange={(v) => setNewExpense({...newExpense, category: v})}>
                    <SelectTrigger className="h-10">
                       <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                       {['Gasolina', 'Anticipo', 'Reintegro', 'Alimentación', 'Otros'].map(c => (
                         <SelectItem key={c} value={c}>{c}</SelectItem>
                       ))}
                    </SelectContent>
                 </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button className="w-full bg-slate-900 text-white font-bold h-12 rounded-xl" onClick={handleAddExpense}>
               GUARDAR EGRESO
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
