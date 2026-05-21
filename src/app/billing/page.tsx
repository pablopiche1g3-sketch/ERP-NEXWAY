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
  CreditCard,
  PlusCircle
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
import { ModeToggle } from '@/components/mode-toggle';

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
    <div className="min-h-screen bg-background p-4 md:p-6 transition-colors duration-300">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="rounded-full bg-card shadow-sm border" onClick={() => router.push('/')}>
            <ArrowLeft className="text-foreground" size={20} />
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground">NexWay Facturación</h1>
            <p className="text-muted-foreground text-xs md:text-sm">Terminal de punto de venta y gestión documental</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          {activeTab === 'cierre' && (
            <div className="bg-emerald-600 px-4 py-2 rounded-2xl shadow-lg shadow-emerald-600/20 text-white flex flex-col items-end animate-in fade-in slide-in-from-right-4">
               <p className="text-[8px] font-black uppercase opacity-80 tracking-widest leading-tight">Efectivo Teórico</p>
               <p className="text-lg font-black">${expectedCashInDrawer.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
          )}
          <ModeToggle />
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-card p-1 rounded-2xl shadow-sm border h-auto flex-wrap w-full justify-start overflow-x-auto no-scrollbar">
            <TabsTrigger value="facturacion" className="rounded-xl px-4 py-2 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs md:text-sm whitespace-nowrap">
              <ShoppingCart size={14} className="mr-2" /> Venta
            </TabsTrigger>
            <TabsTrigger value="nota_credito" className="rounded-xl px-4 py-2 font-bold data-[state=active]:bg-rose-600 data-[state=active]:text-white text-xs md:text-sm whitespace-nowrap">
              <FileMinus size={14} className="mr-2" /> N. Crédito
            </TabsTrigger>
            <TabsTrigger value="nota_debito" className="rounded-xl px-4 py-2 font-bold data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-xs md:text-sm whitespace-nowrap">
              <FilePlus size={14} className="mr-2" /> N. Débito
            </TabsTrigger>
            <TabsTrigger value="historial" className="rounded-xl px-4 py-2 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs md:text-sm whitespace-nowrap">
              <History size={14} className="mr-2" /> Historial
            </TabsTrigger>
            <TabsTrigger value="cierre" className="rounded-xl px-4 py-2 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs md:text-sm whitespace-nowrap">
              <Calculator size={14} className="mr-2" /> Arqueo
            </TabsTrigger>
          </TabsList>

          <TabsContent value="facturacion" className="grid grid-cols-1 lg:grid-cols-12 gap-6 focus-visible:outline-none">
            <div className="lg:col-span-5 order-2 lg:order-1 space-y-4">
              <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-card border">
                <CardHeader className="bg-slate-950 text-white p-4 md:p-5">
                  <div className="flex justify-between items-center mb-2">
                    <CardTitle className="text-sm md:text-base font-bold">Resumen de Venta</CardTitle>
                    <Badge variant="outline" className="text-[8px] md:text-[10px] text-blue-400 border-blue-400 uppercase">{docType}</Badge>
                  </div>
                  <div>
                    <p className="text-[8px] md:text-[9px] uppercase font-bold text-slate-500">Total Gravado</p>
                    <p className="text-3xl md:text-4xl font-black text-blue-400">${totalCart.toFixed(2)}</p>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[250px] md:h-[300px]">
                    <Table>
                      <TableHeader className="bg-muted/50">
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
                            <TableCell colSpan={4} className="text-center py-12 md:py-20 text-muted-foreground italic text-[10px] md:text-xs">
                              Escanee o seleccione productos
                            </TableCell>
                          </TableRow>
                        ) : cart.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="text-center font-black text-blue-600 dark:text-blue-400 text-xs">{item.quantity}</TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-bold text-[10px] md:text-xs text-foreground leading-tight line-clamp-1">{item.name}</span>
                                <div className="flex items-center gap-1 mt-1">
                                  <span className="text-[8px] md:text-[9px] text-muted-foreground font-bold">$</span>
                                  <Input 
                                    type="number" 
                                    step="0.01" 
                                    value={item.price} 
                                    onFocus={e => e.target.select()}
                                    onChange={(e) => updateCartPrice(item.id, parseFloat(e.target.value) || 0)} 
                                    className="h-5 w-16 text-[9px] bg-muted font-bold border-none px-1" 
                                  />
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-bold text-[10px] md:text-xs text-foreground">${(item.price * item.quantity).toFixed(2)}</TableCell>
                            <TableCell className="px-1">
                              <Button variant="ghost" size="icon" onClick={() => removeFromCart(item.id)} className="h-6 w-6 text-muted-foreground hover:text-destructive">
                                <Trash2 size={12} />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                  <div className="p-3 md:p-4 border-t bg-muted/20 space-y-3">
                    <Label className="text-[8px] md:text-[10px] font-black uppercase text-muted-foreground">Método de Pago</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <Button variant={paymentMethod === 'Efectivo' ? 'default' : 'outline'} size="sm" onClick={() => setPaymentMethod('Efectivo')} className="h-8 md:h-9 text-[9px] md:text-[10px] font-bold rounded-xl px-1">
                        <Wallet size={12} className="mr-1 md:mr-2" /> Efectivo
                      </Button>
                      <Button variant={paymentMethod === 'Tarjeta' ? 'default' : 'outline'} size="sm" onClick={() => setPaymentMethod('Tarjeta')} className="h-8 md:h-9 text-[9px] md:text-[10px] font-bold rounded-xl px-1">
                        <CardIcon size={12} className="mr-1 md:mr-2" /> Tarjeta
                      </Button>
                      <Button variant={paymentMethod === 'Transferencia' ? 'default' : 'outline'} size="sm" onClick={() => setPaymentMethod('Transferencia')} className="h-8 md:h-9 text-[9px] md:text-[10px] font-bold rounded-xl px-1">
                        <Landmark size={12} className="mr-1 md:mr-2" /> Transf.
                      </Button>
                      <Button variant={paymentMethod === 'Cheque' ? 'default' : 'outline'} size="sm" onClick={() => setPaymentMethod('Cheque')} className="h-8 md:h-9 text-[9px] md:text-[10px] font-bold rounded-xl px-1">
                        <Ticket size={12} className="mr-1 md:mr-2" /> Cheque
                      </Button>
                      <Button variant={paymentMethod === 'Credito' ? 'default' : 'outline'} size="sm" onClick={() => setPaymentMethod('Credito')} className="h-8 md:h-9 text-[9px] md:text-[10px] font-bold rounded-xl px-1">
                        <Clock size={12} className="mr-1 md:mr-2" /> Crédito
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Button className="w-full h-14 md:h-16 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-base md:text-lg shadow-xl" disabled={cart.length === 0} onClick={handleOpenCheckout}>
                FINALIZAR VENTA
              </Button>
            </div>

            <div className="lg:col-span-7 order-1 lg:order-2 space-y-4">
              <Card className="border-none shadow-sm rounded-2xl bg-card border p-3 md:p-4 flex flex-col sm:flex-row gap-3 md:gap-4">
                <div className="flex-1 space-y-2">
                  <Label className="text-[9px] md:text-[10px] font-black uppercase text-muted-foreground">Cliente Receptor</Label>
                  <div className="flex gap-2">
                    <Input placeholder="Nombre..." value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="h-9 md:h-10 bg-muted rounded-xl font-bold text-xs" />
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="h-9 md:h-10 rounded-xl px-3"><Users size={16} /></Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[calc(100vw-32px)] sm:w-80 p-0" align="end">
                        <div className="p-3 border-b"><Input placeholder="Buscar cliente..." value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} className="h-8 text-xs" /></div>
                        <ScrollArea className="h-60">
                          <div className="p-1">
                            {filteredCustomers.length === 0 ? (
                              <p className="p-4 text-center text-[10px] text-muted-foreground">No se encontraron clientes</p>
                            ) : filteredCustomers.map((c: any) => (
                              <div key={c.id} onClick={() => { setCustomerName(c.name); setDocType(c.category === 'Crédito Fiscal' ? 'CCF' : 'CF'); }} className="p-3 hover:bg-muted cursor-pointer rounded-lg transition-colors">
                                <p className="text-[11px] font-bold">{c.name}</p>
                                <p className="text-[9px] text-muted-foreground">NIT: {c.nit || 'C/F'}</p>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div className="w-full sm:w-48 space-y-2">
                  <Label className="text-[9px] md:text-[10px] font-black uppercase text-muted-foreground">Tipo Documento</Label>
                  <Select value={docType} onValueChange={(v: any) => setDocType(v)}>
                    <SelectTrigger className="h-9 md:h-10 rounded-xl bg-muted border-none text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="CF" className="text-xs">Consumidor Final</SelectItem><SelectItem value="CCF" className="text-xs">Crédito Fiscal</SelectItem></SelectContent>
                  </Select>
                </div>
              </Card>

              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} md-size={18} />
                <Input placeholder="Buscar por SKU o Nombre..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 md:pl-12 h-10 md:h-12 bg-card border shadow-sm rounded-2xl text-xs md:text-sm" />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-3">
                {filteredProducts.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-muted-foreground text-xs italic">Cargando inventario...</div>
                ) : filteredProducts.map((p: any) => (
                  <div key={p.id} onClick={() => addToCart(p)} className="bg-card p-3 rounded-2xl shadow-sm border border-border hover:border-blue-400 cursor-pointer transition-all flex flex-col justify-between aspect-square group active:scale-95">
                    <div>
                      <p className="text-[8px] md:text-[10px] font-bold text-muted-foreground">{p.sku}</p>
                      <h3 className="text-[10px] md:text-xs font-bold text-foreground leading-tight line-clamp-2 h-7 md:h-8">{p.name}</h3>
                    </div>
                    <div className="mt-2 pt-2 border-t flex justify-between items-center">
                      <span className="text-xs md:text-sm font-black text-foreground">${(p.price || 0).toFixed(2)}</span>
                      <Badge variant="outline" className={`text-[7px] md:text-[9px] font-black h-5 px-1 ${p.quantity <= 0 ? 'text-destructive border-destructive/20 bg-destructive/5' : 'text-emerald-500 border-emerald-500/20 bg-emerald-500/5'}`}>{p.quantity} un.</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="nota_credito" className="space-y-6 outline-none">
            <div className="max-w-2xl mx-auto">
              <Card className="border-none shadow-sm rounded-3xl bg-card border overflow-hidden">
                <CardHeader className="bg-rose-600 text-white p-4 md:p-6">
                  <CardTitle className="text-base md:text-lg font-bold flex items-center gap-2"><FileMinus size={20}/> Emisión de Nota de Crédito</CardTitle>
                  <CardDescription className="text-rose-100 text-xs">Ajustes a favor del cliente</CardDescription>
                </CardHeader>
                <CardContent className="p-4 md:p-6 space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-[9px] md:text-[10px] font-bold uppercase text-muted-foreground">Buscar Venta</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                        <Input placeholder="Cliente o ID de venta..." value={adjustmentSearch} onChange={e => setAdjustmentSearch(e.target.value)} className="h-10 pl-9 rounded-xl bg-muted text-xs" />
                      </div>
                      {filteredSalesForAdjustment.length > 0 && !selectedSaleForAdjustment && (
                        <ScrollArea className="h-40 border rounded-xl mt-2 bg-card">
                          {filteredSalesForAdjustment.map((s: any) => (
                            <div key={s.id} onClick={() => setSelectedSaleForAdjustment(s)} className="p-3 border-b hover:bg-muted cursor-pointer transition-colors">
                              <p className="text-[10px] md:text-[11px] font-bold text-foreground">{s.customer}</p>
                              <p className="text-[8px] md:text-[9px] text-muted-foreground">{new Date(s.timestamp).toLocaleDateString()} - ${s.total.toFixed(2)}</p>
                            </div>
                          ))}
                        </ScrollArea>
                      )}
                    </div>

                    {selectedSaleForAdjustment && (
                      <div className="p-4 bg-muted/40 rounded-2xl border space-y-3 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] md:text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Venta Seleccionada</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedSaleForAdjustment(null)}><XCircle size={14}/></Button>
                        </div>
                        <p className="text-xs md:text-sm font-bold text-foreground leading-tight">{selectedSaleForAdjustment.customer}</p>
                        <p className="text-lg md:text-xl font-black text-rose-600 dark:text-rose-400">${selectedSaleForAdjustment.total.toFixed(2)}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                          <Button variant="outline" className="h-20 md:h-24 rounded-2xl flex flex-col gap-1 md:gap-2 border-rose-100 hover:border-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/10 active:scale-95 transition-all" onClick={() => handleCreateAdjustmentNote('CREDITO', 'DEVOLUCION')}>
                            <Undo2 size={18} className="text-rose-500" />
                            <span className="text-[9px] md:text-[10px] font-bold uppercase">Por Devolución</span>
                            <span className="text-[7px] md:text-[8px] text-muted-foreground italic">Reintegra Inventario</span>
                          </Button>
                          <Button variant="outline" className="h-20 md:h-24 rounded-2xl flex flex-col gap-1 md:gap-2 border-rose-100 hover:border-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/10 active:scale-95 transition-all" onClick={() => handleCreateAdjustmentNote('CREDITO', 'PRECIO')}>
                            <ArrowDownCircle size={18} className="text-rose-500" />
                            <span className="text-[9px] md:text-[10px] font-bold uppercase">Por Precio</span>
                            <span className="text-[7px] md:text-[8px] text-muted-foreground italic">Descuento Posterior</span>
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
              <Card className="border-none shadow-sm rounded-3xl bg-card border overflow-hidden">
                <CardHeader className="bg-emerald-600 text-white p-4 md:p-6">
                  <CardTitle className="text-base md:text-lg font-bold flex items-center gap-2"><FilePlus size={20}/> Emisión de Nota de Débito</CardTitle>
                  <CardDescription className="text-emerald-100 text-xs">Cargos a favor de la empresa (Aumenta saldo)</CardDescription>
                </CardHeader>
                <CardContent className="p-4 md:p-6 space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-[9px] md:text-[10px] font-bold uppercase text-muted-foreground">Buscar Venta</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                        <Input placeholder="Cliente o ID de venta..." value={adjustmentSearch} onChange={e => setAdjustmentSearch(e.target.value)} className="h-10 pl-9 rounded-xl bg-muted text-xs" />
                      </div>
                      {filteredSalesForAdjustment.length > 0 && !selectedSaleForAdjustment && (
                        <ScrollArea className="h-40 border rounded-xl mt-2 bg-card">
                          {filteredSalesForAdjustment.map((s: any) => (
                            <div key={s.id} onClick={() => setSelectedSaleForAdjustment(s)} className="p-3 border-b hover:bg-muted cursor-pointer transition-colors">
                              <p className="text-[10px] md:text-[11px] font-bold text-foreground">{s.customer}</p>
                              <p className="text-[8px] md:text-[9px] text-muted-foreground">{new Date(s.timestamp).toLocaleDateString()} - ${s.total.toFixed(2)}</p>
                            </div>
                          ))}
                        </ScrollArea>
                      )}
                    </div>

                    {selectedSaleForAdjustment && (
                      <div className="p-4 bg-muted/40 rounded-2xl border space-y-3 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] md:text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Venta Seleccionada</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedSaleForAdjustment(null)}><XCircle size={14}/></Button>
                        </div>
                        <p className="text-xs md:text-sm font-bold text-foreground leading-tight">{selectedSaleForAdjustment.customer}</p>
                        <p className="text-lg md:text-xl font-black text-emerald-600 dark:text-emerald-400">${selectedSaleForAdjustment.total.toFixed(2)}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                          <Button variant="outline" className="h-20 md:h-24 rounded-2xl flex flex-col gap-1 md:gap-2 border-emerald-100 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 active:scale-95 transition-all" onClick={() => handleCreateAdjustmentNote('DEBITO', 'AJUSTE_VALOR')}>
                            <TrendingUp size={18} className="text-emerald-500" />
                            <span className="text-[9px] md:text-[10px] font-bold uppercase">Por Ajuste de Valor</span>
                            <span className="text-[7px] md:text-[8px] text-muted-foreground italic">Diferencia de Precio</span>
                          </Button>
                          <Button variant="outline" className="h-20 md:h-24 rounded-2xl flex flex-col gap-1 md:gap-2 border-emerald-100 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 active:scale-95 transition-all" onClick={() => handleCreateAdjustmentNote('DEBITO', 'CARGO_ADICIONAL')}>
                            <PlusCircle size={18} className="text-emerald-500" />
                            <span className="text-[9px] md:text-[10px] font-bold uppercase">Cargo Adicional</span>
                            <span className="text-[7px] md:text-[8px] text-muted-foreground italic">Intereses o Servicios</span>
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
            <Card className="border shadow-sm rounded-3xl bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="px-4 md:px-6 text-[10px] uppercase">Hora</TableHead>
                      <TableHead className="text-[10px] uppercase">DTE</TableHead>
                      <TableHead className="text-[10px] uppercase">Cliente</TableHead>
                      <TableHead className="text-[10px] uppercase">Pago</TableHead>
                      <TableHead className="text-right text-[10px] uppercase">Total</TableHead>
                      <TableHead className="text-center text-[10px] uppercase">Estado</TableHead>
                      <TableHead className="text-right px-4 md:px-6 text-[10px] uppercase">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salesTodayList.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground text-xs italic">No hay ventas registradas hoy</TableCell></TableRow>
                    ) : salesTodayList.map((sale: any) => (
                      <TableRow key={sale.id} onDoubleClick={() => handleLoadSaleDetail(sale)} className={`cursor-pointer transition-colors ${sale.status === 'CANCELADA' || sale.status === 'INVALIDADA' ? 'opacity-40 grayscale' : 'hover:bg-muted/30'}`}>
                        <TableCell className="px-4 md:px-6 text-[10px] md:text-xs text-muted-foreground whitespace-nowrap">{new Date(sale.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[8px] md:text-[9px] font-black h-5">{sale.docType}</Badge></TableCell>
                        <TableCell className="font-bold text-[10px] md:text-xs text-foreground max-w-[120px] truncate">{sale.customer}</TableCell>
                        <TableCell><Badge variant="secondary" className="text-[8px] md:text-[9px] font-bold h-5">{sale.paymentMethod}</Badge></TableCell>
                        <TableCell className="text-right font-black text-foreground text-[10px] md:text-xs">${sale.total.toFixed(2)}</TableCell>
                        <TableCell className="text-center">
                          <Badge className={`text-[8px] md:text-[9px] font-black h-5 ${sale.status === 'CANCELADA' ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/20' : sale.status === 'INVALIDADA' ? 'bg-slate-200 text-slate-600 dark:bg-slate-800' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20'}`}>{sale.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right px-4 md:px-6">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" disabled={sale.status !== 'COMPLETADA'} onClick={(e) => { e.stopPropagation(); handleInvalidateDTE(sale); }}><Ban size={12} /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-500" disabled={sale.status !== 'COMPLETADA'} onClick={(e) => { e.stopPropagation(); handleOpenCorrection(sale); }}><Edit3 size={12} /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500" disabled={sale.status !== 'COMPLETADA'} onClick={(e) => { e.stopPropagation(); handleVoidSale(sale); }}><XCircle size={12} /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="cierre" className="space-y-6 outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
              <div className="lg:col-span-4 order-2 lg:order-1 space-y-6">
                <Card className="border shadow-sm rounded-3xl bg-card p-4 md:p-5">
                  <h3 className="text-sm md:text-base font-bold mb-4 flex items-center gap-2"><Coins className="text-blue-600" /> Conteo Físico</h3>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {Object.entries({
                      '$100': 'b100', '$50': 'b50', '$20': 'b20', 
                      '$10': 'b10', '$5': 'b5', '$1': 'b1',
                      '0.25¢': 'c25', '0.10¢': 'c10', '0.05¢': 'c5', '0.01¢': 'c01'
                    }).map(([label, key]) => (
                      <div key={key} className="flex items-center justify-between gap-2 border-b border-muted pb-1">
                        <Label className="text-[8px] md:text-[9px] font-black text-muted-foreground uppercase w-8">{label}</Label>
                        <Input 
                          type="number" 
                          min="0" 
                          value={denominations[key]} 
                          onFocus={e => e.target.select()}
                          onChange={e => setDenominations({...denominations, [key]: parseInt(e.target.value) || 0})}
                          className="h-6 md:h-7 w-10 md:w-12 text-center text-[9px] md:text-[10px] font-bold bg-muted border-none p-1 focus:ring-1 focus:ring-blue-400"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="pt-3 border-t mt-3 flex justify-between items-center">
                    <span className="text-[9px] md:text-[10px] font-black uppercase text-muted-foreground">Total Físico en Gaveta</span>
                    <span className="text-base md:text-lg font-black text-blue-600 dark:text-blue-400">${physicalCashTotal.toFixed(2)}</span>
                  </div>
                </Card>
              </div>

              <div className="lg:col-span-8 order-1 lg:order-2 space-y-4 md:space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                   <Card className="border shadow-sm rounded-2xl bg-card p-4 md:p-5">
                      <p className="text-[8px] md:text-[9px] font-black uppercase text-muted-foreground tracking-widest mb-1">Fondo Base</p>
                      <h2 className="text-lg md:text-xl font-bold text-foreground">${currentCashFloat.toFixed(2)}</h2>
                   </Card>

                   <Card className="border-none shadow-sm rounded-2xl bg-slate-950 text-white p-4 md:p-5">
                      <p className="text-[8px] md:text-[9px] font-black uppercase text-blue-400 tracking-widest mb-1">Vendido Real (Físico)</p>
                      <h2 className="text-lg md:text-xl font-black text-blue-400">${realCashSalesFound.toFixed(2)}</h2>
                   </Card>

                   <Card className={`border shadow-sm rounded-2xl p-4 md:p-5 ${Math.abs(cashDifference) < 0.01 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
                      <p className="text-[8px] md:text-[9px] font-black uppercase text-muted-foreground tracking-widest mb-1">Diferencia vs Sistema</p>
                      <h2 className={`text-lg md:text-xl font-black ${Math.abs(cashDifference) < 0.01 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {cashDifference >= 0 ? '+' : '-'}${Math.abs(cashDifference).toFixed(2)}
                      </h2>
                   </Card>
                </div>

                <Card className="border shadow-sm rounded-3xl bg-card overflow-hidden">
                   <CardHeader className="border-b bg-muted/30 p-4">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <CardTitle className="text-xs md:text-sm font-bold text-foreground uppercase tracking-tight">Resumen de Controles</CardTitle>
                        <Button variant="outline" size="sm" className="rounded-xl h-8 text-[9px] md:text-[10px] font-bold w-full sm:w-auto" onClick={() => setIsExpenseModalOpen(true)}>
                          <TrendingDown size={14} className="mr-1 text-rose-500" /> REGISTRAR GASTO
                        </Button>
                      </div>
                   </CardHeader>
                   <div className="p-0 overflow-x-auto">
                      <Table>
                         <TableBody>
                            <TableRow><TableCell className="px-4 md:px-6 font-bold flex items-center gap-2 text-[10px] md:text-xs text-foreground whitespace-nowrap"><Wallet size={14}/> Ventas en Efectivo</TableCell><TableCell className="text-right px-4 md:px-6 font-black text-foreground text-[10px] md:text-xs">${dailyClosingTotals.Efectivo.toFixed(2)}</TableCell></TableRow>
                            <TableRow><TableCell className="px-4 md:px-6 font-bold flex items-center gap-2 text-rose-500 text-[10px] md:text-xs whitespace-nowrap"><TrendingDown size={14}/> Gastos Reportados</TableCell><TableCell className="text-right px-4 md:px-6 font-black text-rose-500 text-[10px] md:text-xs">-${totalExpensesToday.toFixed(2)}</TableCell></TableRow>
                            <TableRow className="bg-muted/30"><TableCell className="px-4 md:px-6 font-black text-foreground text-[10px] md:text-xs whitespace-nowrap uppercase">Saldo Teórico (Sistema)</TableCell><TableCell className="text-right px-4 md:px-6 font-black text-blue-600 dark:text-blue-400 text-xs md:text-sm">${expectedCashInDrawer.toFixed(2)}</TableCell></TableRow>
                         </TableBody>
                      </Table>
                   </div>
                </Card>

                <Card className="border shadow-sm rounded-3xl bg-card overflow-hidden">
                   <CardHeader className="bg-muted/30 border-b px-4 md:px-6 py-3 md:py-4">
                      <CardTitle className="text-xs md:text-sm font-bold flex items-center gap-2 text-foreground">
                        <CreditCard size={16} className="text-muted-foreground" /> Ventas por Método de Pago
                      </CardTitle>
                   </CardHeader>
                   <div className="p-0 overflow-x-auto">
                      <Table>
                        <TableBody>
                          <TableRow><TableCell className="px-4 md:px-6 flex items-center gap-2 text-[10px] md:text-xs text-foreground"><Wallet size={14} className="text-muted-foreground" /> Efectivo</TableCell><TableCell className="text-right px-4 md:px-6 font-bold text-foreground text-[10px] md:text-xs">${dailyClosingTotals.Efectivo.toFixed(2)}</TableCell></TableRow>
                          <TableRow><TableCell className="px-4 md:px-6 flex items-center gap-2 text-[10px] md:text-xs text-foreground"><CardIcon size={14} className="text-blue-500" /> Tarjeta (POS)</TableCell><TableCell className="text-right px-4 md:px-6 font-bold text-foreground text-[10px] md:text-xs">${dailyClosingTotals.Tarjeta.toFixed(2)}</TableCell></TableRow>
                          <TableRow><TableCell className="px-4 md:px-6 flex items-center gap-2 text-[10px] md:text-xs text-foreground"><Landmark size={14} className="text-emerald-500" /> Transferencia</TableCell><TableCell className="text-right px-4 md:px-6 font-bold text-foreground text-[10px] md:text-xs">${dailyClosingTotals.Transferencia.toFixed(2)}</TableCell></TableRow>
                          <TableRow><TableCell className="px-4 md:px-6 flex items-center gap-2 text-[10px] md:text-xs text-foreground"><Ticket size={14} className="text-amber-500" /> Cheque</TableCell><TableCell className="text-right px-4 md:px-6 font-bold text-foreground text-[10px] md:text-xs">${dailyClosingTotals.Cheque.toFixed(2)}</TableCell></TableRow>
                          <TableRow><TableCell className="px-4 md:px-6 flex items-center gap-2 text-[10px] md:text-xs text-foreground"><Clock size={14} className="text-purple-500" /> Crédito</TableCell><TableCell className="text-right px-4 md:px-6 font-bold text-foreground text-[10px] md:text-xs">${dailyClosingTotals.Credito.toFixed(2)}</TableCell></TableRow>
                          <TableRow className="bg-blue-600/5 dark:bg-blue-900/10 border-t-2"><TableCell className="px-4 md:px-6 font-black uppercase text-blue-900 dark:text-blue-300 text-[10px] md:text-xs">TOTAL FACTURADO</TableCell><TableCell className="text-right px-4 md:px-6 font-black text-blue-700 dark:text-blue-400 text-sm md:text-lg">${dailyClosingTotals.total.toFixed(2)}</TableCell></TableRow>
                        </TableBody>
                      </Table>
                   </div>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals con soporte responsivo */}
      <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
        <DialogContent className="rounded-[1.5rem] md:rounded-[2rem] max-w-[95vw] md:max-w-md p-4 md:p-8 bg-card border overflow-y-auto max-h-[90vh]">
          <DialogHeader className="mb-4 md:mb-6">
            <DialogTitle className="text-xl md:text-2xl font-black text-foreground">Finalizar Venta</DialogTitle>
            <DialogDescription className="text-xs md:text-sm">Confirme fondos y emita documento.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 md:space-y-6">
            <div className="bg-slate-950 rounded-2xl md:rounded-3xl p-4 md:p-6 text-white flex justify-between items-center">
               <div><p className="text-[8px] md:text-[10px] font-black uppercase opacity-60">Total a Pagar</p><p className="text-2xl md:text-3xl font-black text-blue-400">${totalCart.toFixed(2)}</p></div>
               <div className="w-10 h-10 md:w-12 md:h-12 bg-white/10 rounded-xl md:rounded-2xl flex items-center justify-center"><Calculator size={20} md-size={24} /></div>
            </div>

            {paymentMethod === 'Efectivo' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[9px] md:text-[10px] font-black uppercase text-muted-foreground">Dinero Recibido</Label>
                  <input type="number" placeholder="0.00" value={cashReceived} onChange={e => setCashReceived(e.target.value)} className="h-10 md:h-12 w-full text-lg md:text-xl font-bold rounded-xl border border-border px-4 bg-muted focus:outline-none focus:ring-2 focus:ring-blue-500 text-foreground" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[9px] md:text-[10px] font-black uppercase text-muted-foreground">Cambio</Label>
                  <div className="h-10 md:h-12 flex items-center px-4 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl font-black text-lg md:text-xl border border-emerald-500/20">${changeDue.toFixed(2)}</div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-[9px] md:text-[10px] font-black uppercase text-muted-foreground">Referencia de Pago ({paymentMethod})</Label>
                <Input placeholder="ID de transacción..." value={paymentReference} onChange={e => setPaymentReference(e.target.value)} className="h-10 md:h-12 rounded-xl bg-muted border-none text-xs md:text-sm" />
              </div>
            )}
          </div>
          <DialogFooter className="mt-6 md:mt-8">
            <Button className="w-full h-12 md:h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-base md:text-lg shadow-xl transition-all active:scale-95" onClick={handleFinalizeSale} disabled={isProcessing}>
              {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2" />}
              CONFIRMAR VENTA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Expense Modal */}
      <Dialog open={isExpenseModalOpen} onOpenChange={setIsExpenseModalOpen}>
        <DialogContent className="rounded-2xl max-w-[90vw] md:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><TrendingDown className="text-rose-500" /> Registrar Gasto de Caja</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase">Descripción</Label>
              <Input placeholder="Ej. Pago de Gasolina..." value={newExpense.description} onChange={e => setNewExpense({...newExpense, description: e.target.value})} className="rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase">Monto ($)</Label>
                <Input type="number" placeholder="0.00" value={newExpense.amount} onChange={e => setNewExpense({...newExpense, amount: e.target.value})} className="rounded-xl font-bold" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase">Categoría</Label>
                <Select value={newExpense.category} onValueChange={v => setNewExpense({...newExpense, category: v})}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Gasolina">Gasolina</SelectItem>
                    <SelectItem value="Alimentación">Alimentación</SelectItem>
                    <SelectItem value="Otros">Otros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button className="w-full bg-rose-600 text-white rounded-xl" onClick={handleAddExpense}>GUARDAR GASTO</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Correction Modal */}
      <Dialog open={isCorrectionOpen} onOpenChange={setIsCorrectionOpen}>
        <DialogContent className="rounded-2xl max-w-[90vw] md:max-w-sm">
          <DialogHeader>
            <DialogTitle>Corregir Método de Pago</DialogTitle>
            <DialogDescription>Cambie la forma en que se registró el ingreso.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Label className="text-[10px] font-bold uppercase">Nuevo Método de Pago</Label>
            <div className="grid grid-cols-2 gap-2">
               {['Efectivo', 'Tarjeta', 'Transferencia', 'Cheque', 'Credito'].map((m: any) => (
                 <Button key={m} variant={newPaymentMethod === m ? 'default' : 'outline'} onClick={() => setNewPaymentMethod(m)} className="h-10 text-[10px] rounded-xl">{m}</Button>
               ))}
            </div>
          </div>
          <DialogFooter>
            <Button className="w-full bg-blue-600 text-white rounded-xl" onClick={handleApplyCorrection} disabled={isProcessing}>
               {isProcessing ? <Loader2 className="animate-spin mr-2" /> : "APLICAR CAMBIO"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
