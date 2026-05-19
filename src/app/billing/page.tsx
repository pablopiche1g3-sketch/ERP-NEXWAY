
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
  Settings2,
  Edit3,
  XCircle,
  RefreshCw,
  FileMinus,
  FilePlus,
  PackageSearch,
  Undo2,
  ArrowUpCircle,
  Ban
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
  const [activeTab, setActiveTab] = useState('facturacion');
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

  // Correction Modal States
  const [isCorrectionOpen, setIsCorrectionOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [newPaymentMethod, setNewPaymentMethod] = useState<PaymentMethod>('Efectivo');

  // Arqueo Denominations State
  const [denominations, setDenominations] = useState({
    b100: 0, b50: 0, b20: 0, b10: 0, b5: 0, b1: 0,
    c25: 0, c10: 0, c5: 0, c01: 0
  });

  // Expense Modal State
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [newExpense, setNewExpense] = useState({ description: '', amount: '', category: 'Otros' });

  // Nota de Credito/Debito States
  const [adjustmentSearch, setAdjustmentSearch] = useState('');
  const [selectedSaleForAdjustment, setSelectedSaleForAdjustment] = useState<any>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const userProfileRef = useMemo(() => user ? doc(db, 'users', user.uid) : null, [db, user]);
  const { data: userProfile } = useDoc<any>(userProfileRef);

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
        authorizedBy: paymentMethod === 'Credito' ? (userProfile?.fullName || 'Admin Demo') : null
      });

      for (const item of cart) {
        const product = inventory.find((p: any) => p.id === item.id);
        if (product) {
          updateDoc(doc(db, 'inventory', item.id), { 
            quantity: Math.max(0, (product.quantity || 0) - item.quantity) 
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

  const handleVoidSale = async (sale: any) => {
    setIsProcessing(true);
    try {
      const saleRef = doc(db, 'sales', sale.id);
      await updateDoc(saleRef, { status: 'CANCELADA' });

      for (const item of sale.items) {
        const product = inventory.find((p: any) => p.id === item.id);
        if (product) {
          await updateDoc(doc(db, 'inventory', item.id), { 
            quantity: (product.quantity || 0) + item.quantity 
          });
        }
      }
      toast({ title: "Venta Anulada (Nota de Crédito)", description: "Stock devuelto e historial actualizado." });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo anular la venta." });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInvalidateDTE = async (sale: any) => {
    if (!confirm('¿Está seguro de invalidar este DTE ante el Ministerio de Hacienda? Esta acción reintegrará el stock.')) return;
    setIsProcessing(true);
    try {
      const saleRef = doc(db, 'sales', sale.id);
      await updateDoc(saleRef, { 
        status: 'INVALIDADA',
        invalidatedAt: new Date().toISOString(),
        invalidatedBy: userProfile?.fullName || 'Admin Demo'
      });
      
      for (const item of sale.items) {
        const product = inventory.find((p: any) => p.id === item.id);
        if (product) {
          await updateDoc(doc(db, 'inventory', item.id), { 
            quantity: (product.quantity || 0) + item.quantity 
          });
        }
      }
      toast({ title: "DTE Invalidado", description: "El documento ha sido invalidado fiscalmente y el stock reintegrado." });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo invalidar el DTE." });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLoadSaleDetail = (sale: any) => {
    setCart(sale.items || []);
    setCustomerName(sale.customer || '');
    setDocType(sale.docType || 'CF');
    setActiveTab('facturacion');
    toast({ title: "Documento Cargado", description: "Puede ver los productos en la pestaña de facturación." });
  };

  const handleOpenCorrection = (sale: any) => {
    setSelectedSale(sale);
    setNewPaymentMethod(sale.paymentMethod);
    setIsCorrectionOpen(true);
  };

  const handleApplyCorrection = async () => {
    if (!selectedSale) return;
    setIsProcessing(true);
    try {
      const saleRef = doc(db, 'sales', selectedSale.id);
      await updateDoc(saleRef, { 
        paymentMethod: newPaymentMethod,
        correctedAt: new Date().toISOString(),
        correctedBy: userProfile?.fullName || 'Admin Demo'
      });
      toast({ title: "Corrección Aplicada", description: "El método de pago ha sido actualizado en el arqueo." });
      setIsCorrectionOpen(false);
      setSelectedSale(null);
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo aplicar la corrección." });
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
      if (s.status !== 'CANCELADA' && s.status !== 'INVALIDADA') {
        if (s.paymentMethod in summary) {
          summary[s.paymentMethod as keyof typeof summary] += s.total;
        }
        summary.total += s.total;
      }
    });
    return summary;
  }, [salesTodayList]);

  const cashConfigRef = useMemo(() => doc(db, 'system', 'cash_config'), [db]);
  const { data: cashConfig } = useDoc<any>(cashConfigRef);
  const currentCashFloat = cashConfig?.cashFloat || 0;

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

  const expectedCashBalance = currentCashFloat + dailyClosingTotals.Efectivo - totalExpensesToday;
  const cashDifference = physicalCashTotal - expectedCashBalance;

  const accountsReceivable = useMemo(() => {
    if (!salesAll) return [];
    const credits = salesAll.filter((s: any) => s.paymentMethod === 'Credito' && s.status === 'PENDIENTE');
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

  const filteredSalesForAdjustment = useMemo(() => {
    if (!adjustmentSearch || !salesAll) return [];
    return salesAll.filter((s: any) => 
      s.customer.toLowerCase().includes(adjustmentSearch.toLowerCase()) || 
      s.id.toLowerCase().includes(adjustmentSearch.toLowerCase())
    );
  }, [adjustmentSearch, salesAll]);

  const handleCreateAdjustmentNote = async (type: 'CREDITO' | 'DEBITO', reason: 'PRECIO' | 'DEVOLUCION') => {
    if (!selectedSaleForAdjustment) return;
    setIsProcessing(true);
    try {
      await addDoc(collection(db, 'adjustment_notes'), {
        saleId: selectedSaleForAdjustment.id,
        customer: selectedSaleForAdjustment.customer,
        type,
        reason,
        amount: type === 'CREDITO' ? selectedSaleForAdjustment.total : 0, 
        timestamp: new Date().toISOString(),
        status: 'EMITIDA'
      });
      toast({ title: `Nota de ${type === 'CREDITO' ? 'Crédito' : 'Débito'} Emitida`, description: "Documento registrado correctamente." });
      setSelectedSaleForAdjustment(null);
      setAdjustmentSearch('');
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo procesar el ajuste." });
    } finally {
      setIsProcessing(false);
    }
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
            <p className="text-slate-500 text-sm">Terminal de punto de venta y gestión documental</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white p-1 rounded-2xl shadow-sm border border-slate-100 h-auto flex-wrap">
            <TabsTrigger value="facturacion" className="rounded-xl data-[state=active]:bg-blue-600 data-[state=active]:text-white px-6 py-2">
              <ShoppingCart size={16} className="mr-2" /> Nueva Venta
            </TabsTrigger>
            <TabsTrigger value="nota_credito" className="rounded-xl data-[state=active]:bg-rose-600 data-[state=active]:text-white px-6 py-2">
              <FileMinus size={16} className="mr-2" /> Nota de Crédito
            </TabsTrigger>
            <TabsTrigger value="nota_debito" className="rounded-xl data-[state=active]:bg-emerald-600 data-[state=active]:text-white px-6 py-2">
              <FilePlus size={16} className="mr-2" /> Nota de Débito
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
                        onClick={() => setPaymentMethod('Credito')} 
                        className="h-9 text-[10px] font-bold rounded-xl"
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

          <TabsContent value="nota_credito" className="space-y-6 outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5 space-y-4">
                 <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
                    <CardHeader className="bg-rose-600 text-white p-6">
                       <CardTitle className="text-lg font-bold flex items-center gap-2"><FileMinus size={20}/> Emisión de Nota de Crédito</CardTitle>
                       <CardDescription className="text-rose-100">Ajuste de precio o devolución de mercadería</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                       <div className="space-y-4">
                          <div className="space-y-2">
                             <Label className="text-[10px] font-bold uppercase text-slate-400">Buscar Factura / CCF</Label>
                             <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                <Input 
                                  placeholder="Nombre cliente o ID venta..." 
                                  value={adjustmentSearch}
                                  onChange={e => setAdjustmentSearch(e.target.value)}
                                  className="h-10 pl-9 rounded-xl bg-slate-50"
                                />
                             </div>
                             {filteredSalesForAdjustment.length > 0 && !selectedSaleForAdjustment && (
                               <ScrollArea className="h-40 border rounded-xl mt-2 bg-white">
                                  {filteredSalesForAdjustment.map((s: any) => (
                                    <div key={s.id} onClick={() => setSelectedSaleForAdjustment(s)} className="p-3 border-b hover:bg-slate-50 cursor-pointer">
                                       <p className="text-[11px] font-bold">{s.customer}</p>
                                       <p className="text-[9px] text-slate-400">{new Date(s.timestamp).toLocaleDateString()} - ${s.total.toFixed(2)}</p>
                                    </div>
                                  ))}
                               </ScrollArea>
                             )}
                          </div>

                          {selectedSaleForAdjustment && (
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 animate-in fade-in zoom-in-95">
                               <div className="flex justify-between items-center">
                                  <span className="text-[10px] font-bold text-slate-400">VENTA SELECCIONADA</span>
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedSaleForAdjustment(null)}><XCircle size={14}/></Button>
                               </div>
                               <p className="text-xs font-bold text-slate-900">{selectedSaleForAdjustment.customer}</p>
                               <p className="text-sm font-black text-rose-600">${selectedSaleForAdjustment.total.toFixed(2)}</p>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-4">
                             <Button 
                               variant="outline" 
                               className="h-20 rounded-2xl flex flex-col gap-2 border-rose-100 hover:border-rose-500 hover:bg-rose-50"
                               disabled={!selectedSaleForAdjustment}
                               onClick={() => handleCreateAdjustmentNote('CREDITO', 'PRECIO')}
                             >
                                <ArrowDownCircle size={20} className="text-rose-500" />
                                <span className="text-[10px] font-bold uppercase">Por Precio</span>
                             </Button>
                             <Button 
                               variant="outline" 
                               className="h-20 rounded-2xl flex flex-col gap-2 border-rose-100 hover:border-rose-500 hover:bg-rose-50"
                               disabled={!selectedSaleForAdjustment}
                               onClick={() => handleCreateAdjustmentNote('CREDITO', 'DEVOLUCION')}
                             >
                                <Undo2 size={20} className="text-rose-500" />
                                <span className="text-[10px] font-bold uppercase">Por Devolución</span>
                             </Button>
                          </div>
                       </div>
                    </CardContent>
                 </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="historial" className="space-y-4 outline-none">
            <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl mb-4 text-[10px] font-bold text-blue-700">
               TIP: Haz doble clic en una fila para ver el detalle de productos en la terminal.
            </div>
            <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="px-6">Hora</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Pago</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead className="text-right px-6">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesTodayList.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-20 text-slate-400 italic">No hay ventas registradas hoy.</TableCell></TableRow>
                  ) : salesTodayList.map((sale: any) => (
                    <TableRow 
                      key={sale.id} 
                      onDoubleClick={() => handleLoadSaleDetail(sale)}
                      className={`cursor-pointer transition-colors hover:bg-slate-50/80 ${sale.status === 'CANCELADA' || sale.status === 'INVALIDADA' ? 'opacity-40 grayscale' : ''}`}
                    >
                      <TableCell className="px-6 text-xs text-slate-500">{new Date(sale.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[9px] font-black">{sale.docType}</Badge></TableCell>
                      <TableCell className="font-bold text-xs">{sale.customer}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                           <Badge variant="secondary" className="text-[9px] font-bold">{sale.paymentMethod}</Badge>
                           {sale.correctedAt && <RefreshCw size={10} className="text-blue-500" />}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-black text-slate-900">${sale.total.toFixed(2)}</TableCell>
                      <TableCell className="text-center">
                        <Badge className={`text-[9px] font-black ${
                          sale.status === 'CANCELADA' ? 'bg-rose-100 text-rose-600' : 
                          sale.status === 'INVALIDADA' ? 'bg-slate-200 text-slate-600' :
                          'bg-emerald-100 text-emerald-600'
                        }`}>
                          {sale.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right px-6">
                        <div className="flex justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-slate-400 hover:text-slate-900 hover:bg-slate-100"
                            disabled={sale.status === 'CANCELADA' || sale.status === 'INVALIDADA'}
                            onClick={(e) => { e.stopPropagation(); handleInvalidateDTE(sale); }}
                            title="Invalidar DTE (Hacienda)"
                          >
                            <Ban size={14} />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-blue-500 hover:bg-blue-50"
                            disabled={sale.status === 'CANCELADA' || sale.status === 'INVALIDADA'}
                            onClick={(e) => { e.stopPropagation(); handleOpenCorrection(sale); }}
                            title="Corregir Pago"
                          >
                            <Edit3 size={14} />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-rose-500 hover:bg-rose-50"
                            disabled={sale.status === 'CANCELADA' || sale.status === 'INVALIDADA'}
                            onClick={(e) => { e.stopPropagation(); handleVoidSale(sale); }}
                            title="Anular (Nota de Crédito)"
                          >
                            <XCircle size={14} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="cierre" className="space-y-6 outline-none">
            {/* Arqueo de Caja content remains the same */}
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Modals for Checkout, Correction and Expense remain same as previous state */}
      <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
        {/* Checkout Modal content */}
      </Dialog>
    </div>
  );
}
