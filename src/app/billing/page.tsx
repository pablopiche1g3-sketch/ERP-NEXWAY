
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
  AlertCircle
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
import { useFirestore, useCollection } from '@/firebase';
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

type PaymentMethod = 'Efectivo' | 'Tarjeta' | 'Transferencia' | 'Cheque' | 'Credito';

export default function BillingPage() {
  const db = useFirestore();
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

  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState<string | number>('');
  const [expenseCat, setExpenseCat] = useState('Otros');
  const [isRegisteringExpense, setIsRegisteringExpense] = useState(false);

  const [baseCash, setBaseCash] = useState<string>('0');
  const [denominations, setDenominations] = useState<Record<string, string | number>>({
    b100: '', b50: '', b20: '', b10: '', b5: '', b1: '',
    c1: '', c025: '', c010: '', c005: '', c001: ''
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const inventoryQuery = useMemo(() => collection(db, 'inventory'), [db]);
  const salesQuery = useMemo(() => collection(db, 'sales'), [db]);
  const expensesQuery = useMemo(() => collection(db, 'expenses'), [db]);
  const customersQuery = useMemo(() => collection(db, 'customers'), [db]);

  const { data: inventory } = useCollection<any>(inventoryQuery);
  const { data: salesAll } = useCollection<any>(salesQuery);
  const { data: expensesAll } = useCollection<any>(expensesQuery);
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

  // Cuentas por Cobrar (Estado de Cuenta)
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
    if (product.quantity <= 0) {
      toast({ variant: "destructive", title: "Sin Existencias", description: "No hay stock disponible." });
      return;
    }
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.quantity) return prev;
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
        customer: customerName || (docType === 'CF' ? 'Consumidor Final' : 'Cliente CCF')
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

  const handleRegisterExpense = async () => {
    if (!expenseDesc || !expenseAmount) return;
    setIsRegisteringExpense(true);
    try {
      await addDoc(collection(db, 'expenses'), { description: expenseDesc, amount: parseFloat(expenseAmount.toString()) || 0, category: expenseCat, timestamp: new Date().toISOString() });
      toast({ title: "Gasto Registrado", description: "Egreso aplicado al flujo de caja." });
      setExpenseDesc(''); setExpenseAmount('');
    } catch (error) { toast({ variant: "destructive", title: "Error", description: "No se pudo registrar." });
    } finally { setIsRegisteringExpense(false); }
  };

  const accountingStats = useMemo(() => {
    if (!mounted) return { total: 0, efectivoSales: 0, tarjeta: 0, transferencia: 0, cheque: 0, totalExpenses: 0, salesTodayList: [], expensesTodayList: [] };
    const today = new Date().toISOString().split('T')[0];
    const salesToday = (salesAll || []).filter((s: any) => s.timestamp.startsWith(today));
    const expensesToday = (expensesAll || []).filter((e: any) => e.timestamp.startsWith(today));
    const summary = salesToday.reduce((acc: any, s: any) => {
      acc.total += s.total;
      const method = s.paymentMethod || 'Efectivo';
      if (method === 'Efectivo') acc.efectivoSales += s.total;
      else if (method === 'Tarjeta') acc.tarjeta += s.total;
      else if (method === 'Transferencia') acc.transferencia += s.total;
      else if (method === 'Cheque') acc.cheque += s.total;
      return acc;
    }, { total: 0, efectivoSales: 0, tarjeta: 0, transferencia: 0, cheque: 0 });
    return { ...summary, totalExpenses: expensesToday.reduce((acc: number, e: any) => acc + (e.amount || 0), 0), salesTodayList: salesToday, expensesTodayList: expensesToday };
  }, [salesAll, expensesAll, mounted]);

  const physicalStats = useMemo(() => {
    const val = (k: string) => parseFloat(denominations[k]?.toString() || '0');
    const physicalCount = (val('b100') * 100) + (val('b50') * 50) + (val('b20') * 20) + (val('b10') * 10) + (val('b5') * 5) + (val('b1') * 1) + (val('c1') * 1) + (val('c025') * 0.25) + (val('c010') * 0.1) + (val('c005') * 0.05) + (val('c001') * 0.01);
    const expected = accountingStats.efectivoSales - accountingStats.totalExpenses + (parseFloat(baseCash) || 0);
    return { expected, physicalCount, difference: physicalCount - expected };
  }, [denominations, baseCash, accountingStats]);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="rounded-full bg-white shadow-sm" onClick={() => router.push('/')}>
            <ArrowLeft className="text-slate-600" size={20} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Módulo de Facturación</h1>
            <p className="text-slate-500 text-sm">Operaciones de venta y control de caja</p>
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
            <TabsTrigger value="cuadre" className="rounded-xl data-[state=active]:bg-blue-600 data-[state=active]:text-white px-6 py-2">
              <Calculator size={16} className="mr-2" /> Cuadre de Caja
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
                        {cart.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-black text-blue-600">{item.quantity}</TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-bold text-xs">{item.name}</span>
                                <Input type="number" step="0.01" value={item.price} onChange={(e) => updateCartPrice(item.id, parseFloat(e.target.value) || 0)} className="h-6 w-20 text-[10px] bg-slate-50" />
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
                    <div className="grid grid-cols-3 gap-2">
                      {['Efectivo', 'Tarjeta', 'Transferencia', 'Credito'].map((method) => (
                        <Button key={method} variant={paymentMethod === method ? 'default' : 'outline'} size="sm" onClick={() => setPaymentMethod(method as any)} className="h-8 text-[9px] font-bold">
                          {method}
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Button className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold" disabled={cart.length === 0 || isProcessing} onClick={handleFinalizeSale}>
                {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <CreditCard className="mr-2" />} Finalizar Venta
              </Button>
            </div>

            <div className="lg:col-span-7 space-y-4">
              <Card className="border-none shadow-sm rounded-2xl bg-white p-4">
                <div className="flex gap-4">
                  <Select value={docType} onValueChange={(v: any) => setDocType(v)}>
                    <SelectTrigger className="w-48 h-10 rounded-xl bg-slate-50 border-slate-100"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="CF">Consumidor Final</SelectItem><SelectItem value="CCF">Crédito Fiscal</SelectItem></SelectContent>
                  </Select>
                  <Input placeholder="Nombre del receptor..." value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="flex-1 h-10 bg-slate-50 rounded-xl" />
                </div>
              </Card>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {filteredProducts.map((p: any) => (
                  <div key={p.id} onClick={() => addToCart(p)} className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 hover:border-blue-400 cursor-pointer transition-all">
                    <p className="text-[10px] font-bold text-slate-400">{p.sku}</p>
                    <h3 className="text-xs font-bold text-slate-900 leading-tight h-8 line-clamp-2">{p.name}</h3>
                    <div className="flex justify-between items-center mt-2 pt-2 border-t">
                      <span className="text-sm font-black">${(p.price || 0).toFixed(2)}</span>
                      <Badge variant="outline" className="text-[9px]">{p.quantity} un.</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="cuentas" className="space-y-4 outline-none">
            <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
              <CardHeader className="bg-slate-900 text-white p-6">
                <CardTitle className="flex items-center gap-2"><FileSearch /> Estado de Cuenta: Cuentas por Cobrar</CardTitle>
                <CardDescription className="text-slate-400">Listado de créditos pendientes de clientes</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="px-6">Cliente</TableHead>
                      <TableHead>Facturas Pendientes</TableHead>
                      <TableHead className="text-right">Saldo Deudor</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accountsReceivable.map((acc: any) => (
                      <TableRow key={acc.name}>
                        <TableCell className="px-6 font-bold">{acc.name}</TableCell>
                        <TableCell>{acc.count} ventas al crédito</TableCell>
                        <TableCell className="text-right font-black text-rose-600">${acc.total.toFixed(2)}</TableCell>
                        <TableCell className="px-6"><Button variant="outline" size="sm" className="h-7 text-[10px] font-bold">Ver Detalle</Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="historial" className="space-y-4">
            {/* ... (Contenido de historial similar al anterior) ... */}
          </TabsContent>

          <TabsContent value="cuadre" className="space-y-6">
            {/* ... (Contenido de cuadre similar al anterior) ... */}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
