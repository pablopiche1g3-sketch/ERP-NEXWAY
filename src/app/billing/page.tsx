
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
  Users
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
  const [customerSearch, setCustomerSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
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

  const { data: inventory } = useCollection<any>(collection(db, 'inventory'));
  const { data: salesAll } = useCollection<any>(collection(db, 'sales'));
  const { data: expensesAll } = useCollection<any>(collection(db, 'expenses'));
  const { data: customers } = useCollection<any>(collection(db, 'customers'));

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

      for (const item of cart) {
        const product = inventory.find((p: any) => p.id === item.id);
        if (product) {
          const productRef = doc(db, 'inventory', item.id);
          updateDoc(productRef, {
            quantity: Math.max(0, product.quantity - item.quantity)
          });
        }
      }

      toast({ title: "Venta Exitosa", description: "La venta ha sido procesada y el stock descargado." });
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

  const handleRegisterExpense = async () => {
    if (!expenseDesc || !expenseAmount) {
      toast({ variant: "destructive", title: "Faltan Datos", description: "Descripción y monto son obligatorios." });
      return;
    }

    setIsRegisteringExpense(true);
    try {
      await addDoc(collection(db, 'expenses'), {
        description: expenseDesc,
        amount: parseFloat(expenseAmount.toString()) || 0,
        category: expenseCat,
        timestamp: new Date().toISOString()
      });
      toast({ title: "Gasto Registrado", description: "El egreso ha sido aplicado al efectivo de hoy." });
      setExpenseDesc('');
      setExpenseAmount('');
      setExpenseCat('Otros');
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo registrar el gasto." });
    } finally {
      setIsRegisteringExpense(false);
    }
  };

  const accountingStats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const salesToday = (salesAll || []).filter((s: any) => s.timestamp.startsWith(today));
    const expensesToday = (expensesAll || []).filter((e: any) => e.timestamp.startsWith(today));

    const salesSummary = salesToday.reduce((acc: any, s: any) => {
      const amount = s.total || 0;
      acc.total += amount;
      const method = (s.paymentMethod || 'Efectivo');
      if (method === 'Efectivo') acc.efectivoSales += amount;
      else if (method === 'Tarjeta') acc.tarjeta += amount;
      else if (method === 'Transferencia') acc.transferencia += amount;
      else if (method === 'Cheque') acc.cheque += amount;
      return acc;
    }, { total: 0, efectivoSales: 0, tarjeta: 0, transferencia: 0, cheque: 0 });

    const totalExpenses = expensesToday.reduce((acc: number, e: any) => acc + (e.amount || 0), 0);
    
    return {
      ...salesSummary,
      totalExpenses,
      salesTodayList: salesToday,
      expensesTodayList: expensesToday
    };
  }, [salesAll, expensesAll]);

  const physicalStats = useMemo(() => {
    const val = (k: string) => parseFloat(denominations[k]?.toString() || '0');
    
    const physicalCount = (val('b100') * 100) + (val('b50') * 50) + (val('b20') * 20) + 
                          (val('b10') * 10) + (val('b5') * 5) + (val('b1') * 1) + 
                          (val('c1') * 1) + (val('c025') * 0.25) + (val('c010') * 0.1) + 
                          (val('c005') * 0.05) + (val('c001') * 0.01);

    const baseAmountValue = parseFloat(baseCash) || 0;
    const expectedCash = accountingStats.efectivoSales - accountingStats.totalExpenses + baseAmountValue;
    const difference = physicalCount - expectedCash;

    return {
      baseAmountValue,
      expectedCash,
      physicalCount,
      difference
    };
  }, [denominations, baseCash, accountingStats.efectivoSales, accountingStats.totalExpenses]);

  const updateDenomination = (key: string, val: string) => {
    setDenominations(prev => ({ ...prev, [key]: val }));
  };

  const handleNextInput = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const form = (e.currentTarget as HTMLElement).closest('.conteo-grid');
      if (form) {
        const inputs = Array.from(form.querySelectorAll('input'));
        const index = inputs.indexOf(e.currentTarget as HTMLInputElement);
        if (index > -1 && inputs[index + 1]) {
          (inputs[index + 1] as HTMLInputElement).focus();
          (inputs[index + 1] as HTMLInputElement).select();
        }
      }
    }
  };

  const selectCustomer = (customer: any) => {
    setCustomerName(customer.name);
    setDocType(customer.category === 'Crédito Fiscal' ? 'CCF' : 'CF');
    toast({ title: "Cliente Seleccionado", description: `${customer.name} cargado correctamente.` });
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="rounded-full bg-white shadow-sm hover:bg-slate-100" asChild>
            <Link href="/">
              <ArrowLeft className="text-slate-600" size={20} />
            </Link>
          </Button>
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

                    {paymentMethod !== 'Efectivo' && (
                      <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                        <Label className="text-[10px] font-bold uppercase text-blue-600 flex items-center gap-1">
                          {paymentMethod === 'Tarjeta' && <><Hash size={10} /> Últimos 4 Dígitos</>}
                          {paymentMethod === 'Transferencia' && <><UserCheck size={10} /> Nombre Transferencia</>}
                          {paymentMethod === 'Cheque' && <><Hash size={10} /> Número de Cheque</>}
                        </Label>
                        <Input 
                          placeholder={
                            paymentMethod === 'Tarjeta' ? "0000" : 
                            paymentMethod === 'Transferencia' ? "Nombre..." : 
                            "No. Cheque..."
                          }
                          value={paymentReference}
                          onChange={(e) => setPaymentReference(e.target.value)}
                          className="h-10 bg-white border-blue-100 rounded-xl focus:ring-blue-500/20 text-xs font-bold"
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

            <div className="lg:col-span-8 space-y-4">
              <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-100 px-4 py-2 flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Información del Receptor</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-7 text-[9px] font-bold rounded-lg border-blue-200 text-blue-600 hover:bg-blue-50">
                        <Users size={12} className="mr-1.5" />
                        Seleccionar Cliente Registrado
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0" align="end">
                      <div className="p-3 border-b border-slate-100">
                        <div className="relative">
                          <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                          <Input 
                            placeholder="Buscar en cartera..." 
                            value={customerSearch}
                            onChange={(e) => setCustomerSearch(e.target.value)}
                            className="pl-8 h-8 text-xs bg-slate-50 border-none rounded-lg"
                          />
                        </div>
                      </div>
                      <ScrollArea className="h-60">
                        <div className="p-1">
                          {filteredCustomers.length === 0 ? (
                            <div className="p-4 text-center text-slate-400 text-[10px] italic">No se encontraron clientes</div>
                          ) : filteredCustomers.map((c: any) => (
                            <div 
                              key={c.id} 
                              onClick={() => selectCustomer(c)}
                              className="p-3 hover:bg-slate-50 cursor-pointer rounded-lg transition-colors group"
                            >
                              <div className="flex justify-between items-start">
                                <span className="text-[11px] font-bold text-slate-900 group-hover:text-blue-600">{c.name}</span>
                                <Badge variant="outline" className="text-[8px] h-4 px-1">{c.category === 'Crédito Fiscal' ? 'CCF' : 'CF'}</Badge>
                              </div>
                              <p className="text-[9px] text-slate-400 font-mono mt-0.5">{c.nit || 'Consumidor Final'}</p>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
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

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
                {filteredProducts.map((product: any) => {
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
                          {product.quantity} un.
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

          <TabsContent value="abono" className="focus-visible:outline-none">
            <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
              <CardHeader className="bg-slate-50 border-b border-slate-100 p-8">
                <CardTitle className="text-xl font-bold flex items-center gap-2 text-slate-900">
                  <UserCircle className="text-blue-600" />
                  Registro de Abonos
                </CardTitle>
                <CardDescription>Gestión de pagos de clientes recurrentes</CardDescription>
              </CardHeader>
              <CardContent className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-slate-400">Buscar Cliente</Label>
                      <Input placeholder="Nombre o NRC..." className="h-12 rounded-xl bg-slate-50" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-slate-400">Monto del Abono ($)</Label>
                      <Input type="number" step="0.01" onFocus={e => e.target.select()} className="h-14 text-2xl font-black rounded-xl bg-slate-50" placeholder="0.00" />
                    </div>
                    <Button className="w-full h-14 bg-blue-600 hover:bg-blue-700 rounded-xl font-bold text-lg">
                      Registrar Pago
                    </Button>
                  </div>
                  <div className="bg-slate-50 rounded-3xl p-8 border border-dashed border-slate-200 flex flex-col items-center justify-center text-center space-y-4">
                    <FileText className="text-slate-300" size={48} />
                    <p className="text-sm text-slate-500">Seleccione un cliente para ver su saldo actual.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cuadre" className="focus-visible:outline-none space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="border-none shadow-sm rounded-3xl bg-blue-600 text-white md:col-span-2">
                <CardContent className="p-8 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-blue-100 text-xs font-bold uppercase tracking-wider">Total Ventas Brutas Hoy</p>
                      <p className="text-5xl font-black">${accountingStats.total.toFixed(2)}</p>
                    </div>
                    <div className="bg-blue-500/30 p-4 rounded-2xl border border-blue-400/30">
                      <p className="text-blue-100 text-[10px] font-bold uppercase">Monto Base (Fondo)</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-black">${physicalStats.baseAmountValue.toFixed(2)}</span>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-blue-400/30">
                              <Plus size={14} />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-60">
                            <div className="space-y-2">
                              <Label className="text-[10px] font-bold uppercase">Ajustar Base de Caja</Label>
                              <Input 
                                type="number" 
                                value={baseCash} 
                                onFocus={e => e.target.select()}
                                onChange={(e) => setBaseCash(e.target.value)} 
                                className="h-8 font-bold"
                              />
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] font-bold text-blue-200 border-t border-blue-400/30 pt-4">
                    <div className="flex items-center gap-1"><Wallet size={12} /> Efec: ${accountingStats.efectivoSales.toFixed(2)}</div>
                    <div className="flex items-center gap-1"><CardIcon size={12} /> Tarj: ${accountingStats.tarjeta.toFixed(2)}</div>
                    <div className="flex items-center gap-1"><Landmark size={12} /> Trans: ${accountingStats.transferencia.toFixed(2)}</div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm rounded-3xl bg-emerald-600 text-white">
                <CardContent className="p-6 space-y-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Wallet size={16} className="text-emerald-200" />
                    <p className="text-emerald-100 text-[10px] font-bold uppercase">Arqueo: Efectivo Esperado</p>
                  </div>
                  <p className="text-3xl font-black">${physicalStats.expectedCash.toFixed(2)}</p>
                  <p className="text-[9px] text-emerald-100 font-medium">Ventas + Base - Gastos.</p>
                  <div className={`mt-2 p-2 rounded-xl text-center text-xs font-black ${physicalStats.difference >= 0 ? 'bg-emerald-500/50' : 'bg-rose-500/50'}`}>
                    Diferencia: ${physicalStats.difference.toFixed(2)}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm rounded-3xl bg-rose-600 text-white">
                <CardContent className="p-6 space-y-1">
                  <div className="flex items-center gap-2 mb-2">
                    <MinusCircle size={16} className="text-rose-200" />
                    <p className="text-rose-100 text-[10px] font-bold uppercase">Total Gastos Internos</p>
                  </div>
                  <p className="text-3xl font-black">${accountingStats.totalExpenses.toFixed(2)}</p>
                  <p className="text-[9px] text-rose-200 font-bold">{accountingStats.expensesTodayList.length} registros hoy</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              <Card className="md:col-span-4 border-none shadow-sm rounded-3xl bg-white overflow-hidden h-fit">
                <CardHeader className="bg-slate-50 border-b border-slate-100 p-4">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Coins className="text-blue-600" size={18} />
                    Conteo Físico (Enter para bajar)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 conteo-grid">
                    <div className="space-y-2">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Banknote size={10} /> Billetes</p>
                      {[100, 50, 20, 10, 5, 1].map(b => (
                        <div key={b} className="flex items-center gap-2">
                          <Label className="text-11px font-bold w-12 text-slate-600">${b}</Label>
                          <Input 
                            type="number" 
                            inputMode="numeric"
                            className="h-8 text-xs bg-slate-50 rounded-lg text-center" 
                            placeholder=""
                            onFocus={e => e.target.select()}
                            onKeyDown={handleNextInput}
                            value={denominations[`b${b}`] || ''}
                            onChange={(e) => updateDenomination(`b${b}`, e.target.value)}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Coins size={10} /> Monedas</p>
                      {[
                        { label: '1.00', key: 'c1' },
                        { label: '0.25', key: 'c025' },
                        { label: '0.10', key: 'c010' },
                        { label: '0.05', key: 'c005' },
                        { label: '0.01', key: 'c001' }
                      ].map(c => (
                        <div key={c.key} className="flex items-center gap-2">
                          <Label className="text-11px font-bold w-12 text-slate-600">${c.label}</Label>
                          <Input 
                            type="number" 
                            inputMode="numeric"
                            className="h-8 text-xs bg-slate-50 rounded-lg text-center" 
                            placeholder=""
                            onFocus={e => e.target.select()}
                            onKeyDown={handleNextInput}
                            value={denominations[c.key] || ''}
                            onChange={(e) => updateDenomination(c.key, e.target.value)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="pt-4 border-t border-slate-100 bg-slate-900 -mx-4 -mb-4 p-4 text-white">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold uppercase text-slate-400">Total Conteo Físico</span>
                      <span className="text-2xl font-black text-blue-400">${physicalStats.physicalCount.toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="md:col-span-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
                    <CardHeader className="bg-slate-50 border-b border-slate-100 p-4">
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <ArrowDownCircle className="text-rose-500" size={18} />
                        Registrar Gasto (Efectivo)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase text-slate-400">Categoría</Label>
                        <Select value={expenseCat} onValueChange={setExpenseCat}>
                          <SelectTrigger className="h-10 rounded-xl bg-slate-50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Gasolina">Gasolina</SelectItem>
                            <SelectItem value="Anticipo">Anticipo</SelectItem>
                            <SelectItem value="Reintegro">Reintegro</SelectItem>
                            <SelectItem value="Alimentación">Alimentación</SelectItem>
                            <SelectItem value="Otros">Otros</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase text-slate-400">Descripción / Concepto</Label>
                        <Input 
                          placeholder="Ej. Combustible camión 2"
                          value={expenseDesc}
                          onChange={(e) => setExpenseDesc(e.target.value)}
                          className="h-10 rounded-xl bg-slate-50 text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase text-slate-400">Monto ($)</Label>
                        <Input 
                          type="number"
                          placeholder="0.00"
                          onFocus={e => e.target.select()}
                          value={expenseAmount}
                          onChange={(e) => setExpenseAmount(e.target.value)}
                          className="h-10 rounded-xl bg-slate-50 text-xl font-black"
                        />
                      </div>
                      <Button 
                        className="w-full bg-rose-600 hover:bg-rose-700 h-12 rounded-xl font-bold"
                        onClick={handleRegisterExpense}
                        disabled={isRegisteringExpense}
                      >
                        {isRegisteringExpense ? <Loader2 className="animate-spin" /> : 'Aplicar Egreso'}
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden border border-slate-100">
                    <CardHeader className="p-6 border-b border-slate-50 flex flex-row items-center justify-between">
                      <CardTitle className="text-base font-bold flex items-center gap-2">
                        <Receipt className="text-blue-600" />
                        Detalle de Gastos
                      </CardTitle>
                    </CardHeader>
                    <ScrollArea className="h-[280px]">
                      <Table>
                        <TableHeader className="bg-slate-50/50">
                          <TableRow>
                            <TableHead className="text-[10px] font-bold">HORA</TableHead>
                            <TableHead className="text-[10px] font-bold">CATEGORÍA</TableHead>
                            <TableHead className="text-right text-[10px] font-bold">MONTO</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {accountingStats.expensesTodayList.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center py-8 text-slate-400 italic text-xs">
                                No hay gastos hoy
                              </TableCell>
                            </TableRow>
                          ) : accountingStats.expensesTodayList.sort((a: any, b: any) => b.timestamp.localeCompare(a.timestamp)).map((exp: any) => (
                            <TableRow key={exp.id} className="hover:bg-rose-50/30 transition-colors">
                              <TableCell className="text-xs text-slate-500 font-mono">
                                {new Date(exp.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="text-[9px] font-bold uppercase">{exp.category}</Badge>
                              </TableCell>
                              <TableCell className="text-right font-black text-rose-600">-${exp.amount.toFixed(2)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Efectivo (Ventas)', value: accountingStats.efectivoSales, icon: <Wallet className="text-emerald-500" />, sub: 'En gaveta' },
                    { label: 'Tarjeta', value: accountingStats.tarjeta, icon: <CardIcon className="text-blue-500" />, sub: 'Banco' },
                    { label: 'Transferencia', value: accountingStats.transferencia, icon: <Landmark className="text-purple-500" />, sub: 'Banco' },
                    { label: 'Cheque', value: accountingStats.cheque, icon: <BookOpen className="text-orange-500" />, sub: 'En tránsito' }
                  ].map((item) => (
                    <Card key={item.label} className="border-none shadow-sm rounded-2xl bg-white border border-slate-100">
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center">
                          {item.icon}
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">{item.label}</p>
                          <p className="text-xl font-black text-slate-900">${item.value.toFixed(2)}</p>
                          <p className="text-[8px] text-slate-400 font-medium">{item.sub}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden border border-slate-100">
                  <CardHeader className="p-6 border-b border-slate-50">
                    <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900">
                      <ArrowUpCircle className="text-emerald-500" />
                      Ventas Consolidadas (Historial del Día)
                    </CardTitle>
                  </CardHeader>
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader className="bg-slate-50/50">
                        <TableRow>
                          <TableHead className="text-[10px] font-bold uppercase">Hora</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase">Cliente</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase">Método / Ref</TableHead>
                          <TableHead className="text-right text-[10px] font-bold uppercase">Monto</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {accountingStats.salesTodayList.sort((a: any, b: any) => b.timestamp.localeCompare(a.timestamp)).map((sale: any) => (
                          <TableRow key={sale.id} className="hover:bg-slate-50 transition-colors">
                            <TableCell>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {new Date(sale.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </TableCell>
                            <TableCell className="font-bold text-slate-900 text-xs">{sale.customer}</TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-slate-600">{sale.paymentMethod || 'Efectivo'}</span>
                                {sale.paymentReference && <span className="text-[9px] text-blue-500 font-bold">Ref: {sale.paymentReference}</span>}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-black text-slate-900">${(sale.total || 0).toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
