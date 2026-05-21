
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
  Ban,
  TrendingUp,
  TrendingDown,
  Scale,
  MinusCircle,
  Info,
  CreditCard
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { useFirestore, useCollection, useUser, useDoc } from '@/firebase';
import { collection, doc, updateDoc, addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

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
  const [denominations, setDenominations] = useState<Record<string, number>>({
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
    const saleData = {
      items: cart,
      total: totalCart,
      timestamp: new Date().toISOString(),
      docType,
      paymentMethod,
      paymentReference: paymentMethod === 'Efectivo' ? `Efectivo: $${parseFloat(cashReceived).toFixed(2)} - Cambio: $${changeDue.toFixed(2)}` : paymentReference,
      status: paymentMethod === 'Credito' ? 'PENDIENTE' : 'COMPLETADA',
      customer: customerName || (docType === 'CF' ? 'Consumidor Final' : 'Cliente CCF'),
      authorizedBy: paymentMethod === 'Credito' ? (userProfile?.fullName || 'Admin Demo') : null
    };

    addDoc(collection(db, 'sales'), saleData)
      .then(async () => {
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
      })
      .catch(async (err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'sales', operation: 'create', requestResourceData: saleData }));
      })
      .finally(() => setIsProcessing(false));
  };

  const handleVoidSale = async (sale: any) => {
    setIsProcessing(true);
    const saleRef = doc(db, 'sales', sale.id);
    updateDoc(saleRef, { status: 'CANCELADA' })
      .then(async () => {
        for (const item of sale.items) {
          const product = inventory.find((p: any) => p.id === item.id);
          if (product) {
            await updateDoc(doc(db, 'inventory', item.id), { 
              quantity: (product.quantity || 0) + item.quantity 
            });
          }
        }
        toast({ title: "Venta Anulada", description: "Stock devuelto e historial actualizado." });
      })
      .catch(async (err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: saleRef.path, operation: 'update', requestResourceData: { status: 'CANCELADA' } }));
      })
      .finally(() => setIsProcessing(false));
  };

  const handleInvalidateDTE = async (sale: any) => {
    setIsProcessing(true);
    const saleRef = doc(db, 'sales', sale.id);
    const invalidateData = { 
      status: 'INVALIDADA',
      invalidatedAt: new Date().toISOString(),
      invalidatedBy: userProfile?.fullName || 'Admin Demo'
    };

    updateDoc(saleRef, invalidateData)
      .then(async () => {
        for (const item of sale.items) {
          const product = inventory.find((p: any) => p.id === item.id);
          if (product) {
            await updateDoc(doc(db, 'inventory', item.id), { 
              quantity: (product.quantity || 0) + item.quantity 
            });
          }
        }
        toast({ title: "DTE Invalidado", description: "Documento anulado fiscalmente y stock reintegrado." });
      })
      .catch(async (err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: saleRef.path, operation: 'update', requestResourceData: invalidateData }));
      })
      .finally(() => setIsProcessing(false));
  };

  const handleLoadSaleDetail = (sale: any) => {
    setCart(sale.items || []);
    setCustomerName(sale.customer || '');
    setDocType(sale.docType || 'CF');
    setActiveTab('facturacion');
    toast({ title: "Documento Cargado", description: "Detalles visibles en la terminal." });
  };

  const handleOpenCorrection = (sale: any) => {
    setSelectedSale(sale);
    setNewPaymentMethod(sale.paymentMethod);
    setIsCorrectionOpen(true);
  };

  const handleApplyCorrection = async () => {
    if (!selectedSale) return;
    setIsProcessing(true);
    const saleRef = doc(db, 'sales', selectedSale.id);
    const correctionData = { 
      paymentMethod: newPaymentMethod,
      correctedAt: new Date().toISOString(),
      correctedBy: userProfile?.fullName || 'Admin Demo'
    };

    updateDoc(saleRef, correctionData)
      .then(() => {
        toast({ title: "Corrección Aplicada", description: "El arqueo se actualizará automáticamente." });
        setIsCorrectionOpen(false);
        setSelectedSale(null);
      })
      .catch(async (err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: saleRef.path, operation: 'update', requestResourceData: correctionData }));
      })
      .finally(() => setIsProcessing(false));
  };

  const handleAddExpense = async () => {
    if (!newExpense.description || !newExpense.amount) return;
    const expenseData = {
      description: newExpense.description,
      amount: parseFloat(newExpense.amount),
      category: newExpense.category,
      timestamp: new Date().toISOString()
    };

    addDoc(collection(db, 'expenses'), expenseData)
      .then(() => {
        toast({ title: "Gasto Registrado", description: "Egreso de caja guardado." });
        setNewExpense({ description: '', amount: '', category: 'Otros' });
        setIsExpenseModalOpen(false);
      })
      .catch(async (err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'expenses', operation: 'create', requestResourceData: expenseData }));
      });
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

  const expectedCashInDrawer = currentCashFloat + dailyClosingTotals.Efectivo - totalExpensesToday;
  const realCashSalesFound = physicalCashTotal - currentCashFloat + totalExpensesToday;
  const cashDifference = realCashSalesFound - dailyClosingTotals.Efectivo;

  const handleCreateAdjustmentNote = async (type: 'CREDITO' | 'DEBITO', reason: string) => {
    if (!selectedSaleForAdjustment) return;
    setIsProcessing(true);
    const adjustmentData = {
      saleId: selectedSaleForAdjustment.id,
      customer: selectedSaleForAdjustment.customer,
      type,
      reason,
      amount: selectedSaleForAdjustment.total, 
      timestamp: new Date().toISOString(),
      status: 'EMITIDA'
    };

    addDoc(collection(db, 'adjustment_notes'), adjustmentData)
      .then(async () => {
        // Lógica de reintegro si es crédito por devolución
        if (type === 'CREDITO' && reason === 'DEVOLUCION') {
          for (const item of selectedSaleForAdjustment.items || []) {
            const product = inventory?.find((p: any) => p.id === item.id);
            if (product) {
              await updateDoc(doc(db, 'inventory', item.id), { 
                quantity: (product.quantity || 0) + item.quantity 
              });
            }
          }
          toast({ title: "Nota de Crédito Emitida", description: "Stock reintegrado por devolución." });
        } else {
          toast({ title: `Nota de ${type === 'CREDITO' ? 'Crédito' : 'Débito'} Emitida` });
        }
        setSelectedSaleForAdjustment(null);
        setAdjustmentSearch('');
      })
      .catch(async (err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'adjustment_notes', operation: 'create', requestResourceData: adjustmentData }));
      })
      .finally(() => setIsProcessing(false));
  };

  const filteredSalesForAdjustment = useMemo(() => {
    if (!adjustmentSearch || !salesAll) return [];
    return salesAll.filter((s: any) => 
      s.customer.toLowerCase().includes(adjustmentSearch.toLowerCase()) || 
      s.id.toLowerCase().includes(adjustmentSearch.toLowerCase())
    );
  }, [adjustmentSearch, salesAll]);

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
        
        {activeTab === 'cierre' && (
          <div className="bg-emerald-600 px-6 py-2 rounded-2xl shadow-lg shadow-emerald-600/20 text-white flex flex-col items-end animate-in fade-in slide-in-from-right-4">
             <p className="text-[10px] font-black uppercase opacity-80 tracking-widest leading-tight">Efectivo Teórico en Gaveta</p>
             <p className="text-xl font-black">${expectedCashInDrawer.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white p-1 rounded-2xl shadow-sm border border-slate-100 h-auto flex-wrap">
            <TabsTrigger value="facturacion" className="rounded-xl px-6 py-2 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <ShoppingCart size={16} className="mr-2" /> Nueva Venta
            </TabsTrigger>
            <TabsTrigger value="nota_credito" className="rounded-xl px-6 py-2 font-bold data-[state=active]:bg-rose-600 data-[state=active]:text-white">
              <FileMinus size={16} className="mr-2" /> Nota de Crédito
            </TabsTrigger>
            <TabsTrigger value="nota_debito" className="rounded-xl px-6 py-2 font-bold data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
              <FilePlus size={16} className="mr-2" /> Nota de Débito
            </TabsTrigger>
            <TabsTrigger value="historial" className="rounded-xl px-6 py-2 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <History size={16} className="mr-2" /> Ventas del Día
            </TabsTrigger>
            <TabsTrigger value="cierre" className="rounded-xl px-6 py-2 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Calculator size={16} className="mr-2" /> Arqueo de Caja
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
                      <Button variant={paymentMethod === 'Credito' ? 'default' : 'outline'} size="sm" onClick={() => setPaymentMethod('Credito')} className="h-9 text-[10px] font-bold rounded-xl">
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
              <Card className="border-none shadow-sm rounded-2xl bg-white p-4 flex flex-col md:flex-row gap-4">
                <div className="flex-1 space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Cliente Receptor</Label>
                  <div className="flex gap-2">
                    <Input placeholder="Nombre..." value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="h-10 bg-slate-50 rounded-xl font-bold" />
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="h-10 rounded-xl px-3 border-slate-200"><Users size={16} /></Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 p-0" align="end">
                        <div className="p-3 border-b"><Input placeholder="Buscar cliente..." value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} className="h-8 text-xs" /></div>
                        <ScrollArea className="h-60">
                          <div className="p-1">
                            {filteredCustomers.map((c: any) => (
                              <div key={c.id} onClick={() => { setCustomerName(c.name); setDocType(c.category === 'Crédito Fiscal' ? 'CCF' : 'CF'); }} className="p-3 hover:bg-slate-50 cursor-pointer rounded-lg">
                                <p className="text-[11px] font-bold">{c.name}</p>
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
                  <div className="flex items-center gap-2">
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
            <div className="max-w-2xl mx-auto">
              <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
                <CardHeader className="bg-rose-600 text-white p-6">
                  <CardTitle className="text-lg font-bold flex items-center gap-2"><FileMinus size={20}/> Emisión de Nota de Crédito</CardTitle>
                  <CardDescription className="text-rose-100">Devolución de mercadería o ajuste de precio a favor del cliente</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-slate-400">Buscar Venta</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <Input placeholder="Cliente o ID de venta..." value={adjustmentSearch} onChange={e => setAdjustmentSearch(e.target.value)} className="h-10 pl-9 rounded-xl bg-slate-50" />
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
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-slate-400">VENTA SELECCIONADA</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedSaleForAdjustment(null)}><XCircle size={14}/></Button>
                        </div>
                        <p className="text-xs font-bold">{selectedSaleForAdjustment.customer}</p>
                        <p className="text-lg font-black text-rose-600">${selectedSaleForAdjustment.total.toFixed(2)}</p>
                        <div className="grid grid-cols-2 gap-4 pt-2">
                          <Button variant="outline" className="h-24 rounded-2xl flex flex-col gap-2 border-rose-100 hover:border-rose-500 hover:bg-rose-50" onClick={() => handleCreateAdjustmentNote('CREDITO', 'DEVOLUCION')}>
                            <Undo2 size={20} className="text-rose-500" />
                            <span className="text-[10px] font-bold uppercase">Por Devolución</span>
                            <span className="text-[8px] text-slate-400 italic">Reintegra Inventario</span>
                          </Button>
                          <Button variant="outline" className="h-24 rounded-2xl flex flex-col gap-2 border-rose-100 hover:border-rose-500 hover:bg-rose-50" onClick={() => handleCreateAdjustmentNote('CREDITO', 'PRECIO')}>
                            <ArrowDownCircle size={20} className="text-rose-500" />
                            <span className="text-[10px] font-bold uppercase">Por Precio</span>
                            <span className="text-[8px] text-slate-400 italic">Descuento Posterior</span>
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="nota_debito" className="space-y-6 outline-none">
            <div className="max-w-2xl mx-auto">
              <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
                <CardHeader className="bg-emerald-600 text-white p-6">
                  <CardTitle className="text-lg font-bold flex items-center gap-2"><FilePlus size={20}/> Emisión de Nota de Débito</CardTitle>
                  <CardDescription className="text-emerald-100">Cargos adicionales, intereses o aumentos de precio posteriores</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-slate-400">Buscar Venta / Cuenta</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <Input placeholder="Buscar por cliente..." value={adjustmentSearch} onChange={e => setAdjustmentSearch(e.target.value)} className="h-10 pl-9 rounded-xl bg-slate-50" />
                      </div>
                      {filteredSalesForAdjustment.length > 0 && !selectedSaleForAdjustment && (
                        <ScrollArea className="h-40 border rounded-xl mt-2 bg-white">
                          {filteredSalesForAdjustment.map((s: any) => (
                            <div key={s.id} onClick={() => setSelectedSaleForAdjustment(s)} className="p-3 border-b hover:bg-slate-50 cursor-pointer">
                              <p className="text-[11px] font-bold">{s.customer}</p>
                              <p className="text-[9px] text-slate-400">Venta ID: {s.id.slice(0, 8)} - ${s.total.toFixed(2)}</p>
                            </div>
                          ))}
                        </ScrollArea>
                      )}
                    </div>

                    {selectedSaleForAdjustment && (
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-slate-400">RECEPTOR SELECCIONADO</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedSaleForAdjustment(null)}><XCircle size={14}/></Button>
                        </div>
                        <p className="text-xs font-bold">{selectedSaleForAdjustment.customer}</p>
                        <div className="grid grid-cols-2 gap-4 pt-2">
                          <Button variant="outline" className="h-24 rounded-2xl flex flex-col gap-2 border-emerald-100 hover:border-emerald-500 hover:bg-emerald-50" onClick={() => handleCreateAdjustmentNote('DEBITO', 'CARGO_ADICIONAL')}>
                            <ArrowUpCircle size={20} className="text-emerald-500" />
                            <span className="text-[10px] font-bold uppercase">Cargo Adicional</span>
                            <span className="text-[8px] text-slate-400">Intereses o Servicios</span>
                          </Button>
                          <Button variant="outline" className="h-24 rounded-2xl flex flex-col gap-2 border-emerald-100 hover:border-emerald-500 hover:bg-emerald-50" onClick={() => handleCreateAdjustmentNote('DEBITO', 'AJUSTE_PRECIO')}>
                            <TrendingUp size={20} className="text-emerald-500" />
                            <span className="text-[10px] font-bold uppercase">Ajuste de Precio</span>
                            <span className="text-[8px] text-slate-400">Aumento de Valor</span>
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
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
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead className="text-right px-6">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesTodayList.map((sale: any) => (
                    <TableRow key={sale.id} onDoubleClick={() => handleLoadSaleDetail(sale)} className={`cursor-pointer ${sale.status === 'CANCELADA' || sale.status === 'INVALIDADA' ? 'opacity-40 grayscale' : ''}`}>
                      <TableCell className="px-6 text-xs text-slate-500">{new Date(sale.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[9px] font-black">{sale.docType}</Badge></TableCell>
                      <TableCell className="font-bold text-xs">{sale.customer}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-[9px] font-bold">{sale.paymentMethod}</Badge></TableCell>
                      <TableCell className="text-right font-black text-slate-900">${sale.total.toFixed(2)}</TableCell>
                      <TableCell className="text-center">
                        <Badge className={`text-[9px] font-black ${sale.status === 'CANCELADA' ? 'bg-rose-100 text-rose-600' : sale.status === 'INVALIDADA' ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-600'}`}>{sale.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right px-6">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-900" disabled={sale.status !== 'COMPLETADA'} onClick={(e) => { e.stopPropagation(); handleInvalidateDTE(sale); }}><Ban size={14} /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500" disabled={sale.status !== 'COMPLETADA'} onClick={(e) => { e.stopPropagation(); handleOpenCorrection(sale); }}><Edit3 size={14} /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500" disabled={sale.status !== 'COMPLETADA'} onClick={(e) => { e.stopPropagation(); handleVoidSale(sale); }}><XCircle size={14} /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="cierre" className="space-y-6 outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-4 space-y-6">
                <Card className="border-none shadow-sm rounded-3xl bg-white p-5">
                  <h3 className="text-base font-bold mb-4 flex items-center gap-2"><Coins className="text-blue-600" /> Conteo Físico</h3>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {Object.entries({
                      '$100': 'b100', '$50': 'b50', '$20': 'b20', 
                      '$10': 'b10', '$5': 'b5', '$1': 'b1',
                      '0.25¢': 'c25', '0.10¢': 'c10', '0.05¢': 'c5', '0.01¢': 'c01'
                    }).map(([label, key]) => (
                      <div key={key} className="flex items-center justify-between gap-2 border-b border-slate-50 pb-1">
                        <Label className="text-[9px] font-black text-slate-400 uppercase w-8">{label}</Label>
                        <Input 
                          type="number" 
                          min="0" 
                          value={denominations[key]} 
                          onFocus={e => e.target.select()}
                          onChange={e => setDenominations({...denominations, [key]: parseInt(e.target.value) || 0})}
                          className="h-7 w-12 text-center text-[10px] font-bold bg-slate-50 border-none p-1 focus:ring-1 focus:ring-blue-400"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="pt-3 border-t mt-3 flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-slate-400">Total Físico en Gaveta</span>
                    <span className="text-lg font-black text-blue-600">${physicalCashTotal.toFixed(2)}</span>
                  </div>
                </Card>
              </div>

              <div className="lg:col-span-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   <Card className="border-none shadow-sm rounded-2xl bg-white p-5">
                      <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">Fondo Base</p>
                      <h2 className="text-xl font-bold">${currentCashFloat.toFixed(2)}</h2>
                      <p className="text-[9px] text-slate-400 mt-1">Monto inicial para cambio</p>
                   </Card>

                   <Card className="border-none shadow-sm rounded-2xl bg-slate-900 text-white p-5">
                      <p className="text-[9px] font-black uppercase text-blue-400 tracking-widest mb-1">Vendido Real (Físico)</p>
                      <h2 className="text-xl font-black text-blue-400">${realCashSalesFound.toFixed(2)}</h2>
                      <p className="text-[9px] opacity-60 mt-1">Total Físico - Fondo + Gastos</p>
                   </Card>

                   <Card className={`border-none shadow-sm rounded-2xl p-5 ${Math.abs(cashDifference) < 0.01 ? 'bg-emerald-50 border border-emerald-100' : 'bg-rose-50 border border-rose-100'}`}>
                      <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">Diferencia vs Sistema</p>
                      <h2 className={`text-xl font-black ${Math.abs(cashDifference) < 0.01 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {cashDifference >= 0 ? '+' : '-'}${Math.abs(cashDifference).toFixed(2)}
                      </h2>
                      <p className="text-[9px] font-bold text-slate-500 mt-1">
                        {Math.abs(cashDifference) < 0.01 ? 'Caja Cuadrada' : cashDifference > 0 ? 'Sobrante detectado' : 'Faltante en caja'}
                      </p>
                   </Card>
                </div>

                <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
                   <CardHeader className="border-b bg-slate-50/50">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-sm font-bold">Resumen de Sistema (Controles)</CardTitle>
                        <Button variant="outline" size="sm" className="rounded-xl h-8 text-[10px] font-bold" onClick={() => setIsExpenseModalOpen(true)}>
                          <TrendingDown size={14} className="mr-1 text-rose-500" /> REGISTRAR GASTO
                        </Button>
                      </div>
                   </CardHeader>
                   <div className="p-0">
                      <Table>
                         <TableHeader>
                            <TableRow>
                               <TableHead className="px-6 text-[10px] uppercase">Categoría</TableHead>
                               <TableHead className="text-right px-6 text-[10px] uppercase">Monto en Sistema</TableHead>
                            </TableRow>
                         </TableHeader>
                         <TableBody>
                            <TableRow><TableCell className="px-6 font-bold flex items-center gap-2"><Wallet size={14}/> Ventas en Efectivo Registradas</TableCell><TableCell className="text-right px-6 font-black">${dailyClosingTotals.Efectivo.toFixed(2)}</TableCell></TableRow>
                            <TableRow><TableCell className="px-6 font-bold flex items-center gap-2 text-rose-600"><TrendingDown size={14}/> Gastos Reportados (Salidas)</TableCell><TableCell className="text-right px-6 font-black text-rose-600">-${totalExpensesToday.toFixed(2)}</TableCell></TableRow>
                            <TableRow className="bg-slate-50"><TableCell className="px-6 font-black">SALDO QUE DEBERÍA HABER (SISTEMA)</TableCell><TableCell className="text-right px-6 font-black text-blue-600">${expectedCashInDrawer.toFixed(2)}</TableCell></TableRow>
                         </TableBody>
                      </Table>
                   </div>
                </Card>

                {/* Desglose por Método de Pago */}
                <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
                   <CardHeader className="bg-slate-50 border-b px-6 py-4">
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <CreditCard size={18} className="text-slate-400" /> Ventas del Día por Método de Pago
                      </CardTitle>
                   </CardHeader>
                   <div className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="px-6 text-[10px] uppercase">Método</TableHead>
                            <TableHead className="text-right px-6 text-[10px] uppercase">Venta Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell className="px-6 flex items-center gap-2"><Wallet size={14} className="text-slate-400" /> Efectivo</TableCell>
                            <TableCell className="text-right px-6 font-bold">${dailyClosingTotals.Efectivo.toFixed(2)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="px-6 flex items-center gap-2"><CardIcon size={14} className="text-blue-500" /> Tarjeta (POS)</TableCell>
                            <TableCell className="text-right px-6 font-bold">${dailyClosingTotals.Tarjeta.toFixed(2)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="px-6 flex items-center gap-2"><Landmark size={14} className="text-emerald-500" /> Transferencia Bancaria</TableCell>
                            <TableCell className="text-right px-6 font-bold">${dailyClosingTotals.Transferencia.toFixed(2)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="px-6 flex items-center gap-2"><Ticket size={14} className="text-amber-500" /> Cheque</TableCell>
                            <TableCell className="text-right px-6 font-bold">${dailyClosingTotals.Cheque.toFixed(2)}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="px-6 flex items-center gap-2"><Clock size={14} className="text-purple-500" /> Crédito (Ctas. por Cobrar)</TableCell>
                            <TableCell className="text-right px-6 font-bold">${dailyClosingTotals.Credito.toFixed(2)}</TableCell>
                          </TableRow>
                          <TableRow className="bg-blue-50/50 border-t-2">
                            <TableCell className="px-6 font-black uppercase text-blue-900">Total Facturado Hoy</TableCell>
                            <TableCell className="text-right px-6 font-black text-blue-700 text-lg">${dailyClosingTotals.total.toFixed(2)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                   </div>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Checkout Modal */}
      <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
        <DialogContent className="rounded-[2rem] max-w-md p-8">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl font-black text-slate-900">Finalizar Operación</DialogTitle>
            <DialogDescription>Confirme el recibo de fondos y emita el documento.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="bg-slate-900 rounded-3xl p-6 text-white flex justify-between items-center">
               <div><p className="text-[10px] font-black uppercase opacity-60">Total a Pagar</p><p className="text-3xl font-black text-blue-400">${totalCart.toFixed(2)}</p></div>
               <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center"><Calculator size={24} /></div>
            </div>

            {paymentMethod === 'Efectivo' ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Efectivo Recibido</Label>
                  <input type="number" placeholder="0.00" value={cashReceived} onChange={e => setCashReceived(e.target.value)} className="h-12 w-full text-xl font-bold rounded-xl border border-slate-200 px-4 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Cambio a Entregar</Label>
                  <div className="h-12 flex items-center px-4 bg-emerald-50 text-emerald-600 rounded-xl font-black text-xl border border-emerald-100">${changeDue.toFixed(2)}</div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">Referencia de Pago ({paymentMethod})</Label>
                <Input placeholder="No. de transacción, autorización..." value={paymentReference} onChange={e => setPaymentReference(e.target.value)} className="h-12 rounded-xl" />
              </div>
            )}
          </div>
          <DialogFooter className="mt-8">
            <Button className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-lg shadow-xl" onClick={handleFinalizeSale} disabled={isProcessing}>
              {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2" />}
              CONFIRMAR VENTA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Correction Modal */}
      <Dialog open={isCorrectionOpen} onOpenChange={setIsCorrectionOpen}>
        <DialogContent className="rounded-3xl max-w-sm">
           <DialogHeader>
              <DialogTitle className="text-lg font-bold">Corregir Forma de Pago</DialogTitle>
              <DialogDescription>Esto ajustará los totales en el arqueo de caja.</DialogDescription>
           </DialogHeader>
           <div className="py-4 space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                 <p className="text-[10px] font-bold text-slate-400 uppercase">Venta Seleccionada</p>
                 <p className="text-xs font-bold">{selectedSale?.customer}</p>
                 <p className="text-sm font-black text-blue-600">${selectedSale?.total.toFixed(2)}</p>
              </div>
              <div className="space-y-2">
                 <Label className="text-[10px] font-bold uppercase text-slate-400">Nuevo Método de Pago</Label>
                 <Select value={newPaymentMethod} onValueChange={(v: any) => setNewPaymentMethod(v)}>
                    <SelectTrigger className="h-10 rounded-xl">
                       <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                       <SelectItem value="Efectivo">Efectivo</SelectItem>
                       <SelectItem value="Tarjeta">Tarjeta</SelectItem>
                       <SelectItem value="Transferencia">Transferencia</SelectItem>
                       <SelectItem value="Cheque">Cheque</SelectItem>
                    </SelectContent>
                 </Select>
              </div>
           </div>
           <DialogFooter>
              <Button className="w-full bg-blue-600 h-12 rounded-xl font-bold" onClick={handleApplyCorrection} disabled={isProcessing}>
                 APLICAR CORRECCIÓN
              </Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Expense Modal */}
      <Dialog open={isExpenseModalOpen} onOpenChange={setIsExpenseModalOpen}>
        <DialogContent className="rounded-3xl max-w-sm">
           <DialogHeader>
              <DialogTitle className="text-lg font-bold">Registrar Gasto de Caja</DialogTitle>
              <DialogDescription>Cualquier salida de efectivo debe ser reportada aquí.</DialogDescription>
           </DialogHeader>
           <div className="py-4 space-y-4">
              <div className="space-y-2">
                 <Label className="text-[10px] font-bold uppercase text-slate-400">Descripción del Gasto</Label>
                 <Input placeholder="Ej. Pago de Gasolina..." value={newExpense.description} onChange={e => setNewExpense({...newExpense, description: e.target.value})} className="rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase text-slate-400">Monto ($)</Label>
                  <Input type="number" placeholder="0.00" value={newExpense.amount} onChange={e => setNewExpense({...newExpense, amount: e.target.value})} className="rounded-xl font-bold" />
                </div>
                <div className="space-y-2">
                   <Label className="text-[10px] font-bold uppercase text-slate-400">Categoría</Label>
                   <Select value={newExpense.category} onValueChange={v => setNewExpense({...newExpense, category: v})}>
                      <SelectTrigger className="rounded-xl h-10"><SelectValue /></SelectTrigger>
                      <SelectContent>
                         <SelectItem value="Gasolina">Gasolina</SelectItem>
                         <SelectItem value="Alimentación">Alimentación</SelectItem>
                         <SelectItem value="Reintegro">Reintegro</SelectItem>
                         <SelectItem value="Anticipo">Anticipo</SelectItem>
                         <SelectItem value="Otros">Otros</SelectItem>
                      </SelectContent>
                   </Select>
                </div>
              </div>
           </div>
           <DialogFooter>
              <Button className="w-full bg-slate-900 h-12 rounded-xl font-bold text-white" onClick={handleAddExpense}>
                 GUARDAR GASTO
              </Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
