
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Trash2, 
  ArrowLeft, 
  ShoppingCart,
  History,
  Calculator,
  Receipt,
  Wallet,
  Landmark,
  CreditCard as CardIcon,
  Users,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Printer,
  Mail,
  PlusCircle,
  Coins,
  DollarSign,
  TrendingDown,
  TrendingUp,
  ArrowDownCircle,
  FileText,
  RotateCcw,
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { useFirestore, useCollection, useUser, useDoc } from '@/firebase';
import { collection, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ModeToggle } from '@/components/mode-toggle';
import { sendDteEmail } from '@/ai/flows/send-dte-email-flow';
import { Textarea } from '@/components/ui/textarea';

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
  
  // Tab States
  const [activeTab, setActiveTab] = useState('facturacion');
  const [searchTerm, setSearchTerm] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Customer & Payment States
  const [docType, setDocType] = useState<'CF' | 'CCF'>('CF');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Efectivo');
  
  // Adjustment States (Notas Crédito/Débito)
  const [adjustmentForm, setAdjustmentForm] = useState({
    refDoc: '',
    customerName: '',
    reason: '',
    items: [] as CartItem[],
    total: 0
  });

  // Arqueo States
  const [cashDenominations, setCashDenominations] = useState<Record<string, number>>({
    '100.00': 0, '50.00': 0, '20.00': 0, '10.00': 0, '5.00': 0, '1.00': 0,
    '0.25': 0, '0.10': 0, '0.05': 0, '0.01': 0
  });
  const [expenses, setExpenses] = useState<{description: string, amount: number}[]>([]);
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');

  // Physical counts for other payment methods
  const [physicalCard, setPhysicalCard] = useState<number>(0);
  const [physicalTransfer, setPhysicalTransfer] = useState<number>(0);
  const [physicalCredit, setPhysicalCredit] = useState<number>(0);
  const [physicalCheck, setPhysicalCheck] = useState<number>(0);


  // Checkout Modal States
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentReference, setPaymentReference] = useState('');
  const [cashReceived, setCashReceived] = useState<string>('');

  // Data Fetching
  const cashConfigRef = useMemo(() => doc(db, 'system', 'cash_config'), [db]);
  const { data: cashConfig } = useDoc<any>(cashConfigRef);

  const inventoryQuery = useMemo(() => collection(db, 'inventory'), [db]);
  const salesQuery = useMemo(() => collection(db, 'sales'), [db]);
  const customersQuery = useMemo(() => collection(db, 'customers'), [db]);

  const { data: inventory } = useCollection<any>(inventoryQuery);
  const { data: salesAll } = useCollection<any>(salesQuery);
  const { data: customers } = useCollection<any>(customersQuery);

  // Filters
  const filteredProducts = useMemo(() => {
    if (!inventory) return [];
    return inventory.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [searchTerm, inventory]);

  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    return customers.filter(c => 
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      (c.nit && c.nit.toLowerCase().includes(customerSearch.toLowerCase()))
    );
  }, [customerSearch, customers]);

  // Arqueo Calculations
  const systemCashSales = useMemo(() => 
    salesAll?.filter(s => s.paymentMethod === 'Efectivo' && s.status !== 'CANCELADA')
      .reduce((acc, s) => acc + (s.total || 0), 0) || 0
  , [salesAll]);

  const systemCardSales = useMemo(() => 
    salesAll?.filter(s => s.paymentMethod === 'Tarjeta' && s.status !== 'CANCELADA')
      .reduce((acc, s) => acc + (s.total || 0), 0) || 0
  , [salesAll]);

  const systemTransferSales = useMemo(() => 
    salesAll?.filter(s => s.paymentMethod === 'Transferencia' && s.status !== 'CANCELADA')
      .reduce((acc, s) => acc + (s.total || 0), 0) || 0
  , [salesAll]);

  const systemCreditSales = useMemo(() => 
    salesAll?.filter(s => s.paymentMethod === 'Credito' && s.status !== 'CANCELADA')
      .reduce((acc, s) => acc + (s.total || 0), 0) || 0
  , [salesAll]);

  const systemCheckSales = useMemo(() => 
    salesAll?.filter(s => s.paymentMethod === 'Cheque' && s.status !== 'CANCELADA')
      .reduce((acc, s) => acc + (s.total || 0), 0) || 0
  , [salesAll]);

  const totalPhysicalCash = useMemo(() => 
    Object.entries(cashDenominations).reduce((acc, [den, qty]) => acc + (parseFloat(den) * qty), 0)
  , [cashDenominations]);

  const totalExpenses = useMemo(() => 
    expenses.reduce((acc, e) => acc + e.amount, 0)
  , [expenses]);

  const cashDifference = useMemo(() => 
    totalPhysicalCash - (systemCashSales + (cashConfig?.cashFloat || 0) - totalExpenses)
  , [totalPhysicalCash, systemCashSales, cashConfig, totalExpenses]);

  const cardDifference = useMemo(() => physicalCard - systemCardSales, [physicalCard, systemCardSales]);
  const transferDifference = useMemo(() => physicalTransfer - systemTransferSales, [physicalTransfer, systemTransferSales]);
  const creditDifference = useMemo(() => physicalCredit - systemCreditSales, [physicalCredit, systemCreditSales]);
  const checkDifference = useMemo(() => physicalCheck - systemCheckSales, [physicalCheck, systemCheckSales]);


  // Cart Functions
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
      return [...prev, { id: product.id, name: product.name, sku: product.sku || 'N/A', price: product.price || 0, quantity: 1 }];
    });
  };

  const handleOpenCheckout = () => {
    if (cart.length === 0) {
      toast({ variant: "destructive", title: "Carrito vacío" });
      return;
    }
    setCashReceived('');
    setPaymentReference('');
    setIsCheckoutOpen(true);
  };

  const handleFinalizeSale = async () => {
    if (paymentMethod === 'Efectivo' && (parseFloat(cashReceived) || 0) < totalCart) {
      toast({ variant: "destructive", title: "Monto Insuficiente" });
      return;
    }

    setIsProcessing(true);
    const saleData = {
      items: cart,
      total: totalCart,
      timestamp: new Date().toISOString(),
      docType,
      paymentMethod,
      paymentReference: paymentMethod === 'Efectivo' ? `Efectivo: $${parseFloat(cashReceived).toFixed(2)}` : paymentReference,
      status: paymentMethod === 'Credito' ? 'PENDIENTE' : 'COMPLETADA',
      customer: customerName || (docType === 'CF' ? 'Consumidor Final' : 'Cliente CCF'),
    };

    addDoc(collection(db, 'sales'), saleData)
      .then(async (docRef) => {
        // Update Inventory
        for (const item of cart) {
          const product = inventory?.find((p: any) => p.id === item.id);
          if (product) {
            updateDoc(doc(db, 'inventory', item.id), { 
              quantity: Math.max(0, (product.quantity || 0) - item.quantity) 
            });
          }
        }

        // Send DTE Email
        const targetEmail = customerEmail || cashConfig?.catchAllEmail;
        if (targetEmail) {
          sendDteEmail({
            recipientEmail: targetEmail,
            customerName: saleData.customer,
            docType: saleData.docType,
            docNumber: docRef.id,
            total: saleData.total,
            items: saleData.items.map(i => ({ name: i.name, quantity: i.quantity, price: i.price }))
          });
        }

        toast({ title: "Venta Exitosa", description: "DTE enviado por correo." });
        setCart([]);
        setCustomerName('');
        setCustomerEmail('');
        setIsCheckoutOpen(false);
      })
      .catch((err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'sales', operation: 'create', requestResourceData: saleData }));
      })
      .finally(() => setIsProcessing(false));
  };

  const handleProcessAdjustment = async (type: 'CREDITO' | 'DEBITO') => {
    if (!adjustmentForm.refDoc || !adjustmentForm.reason || adjustmentForm.items.length === 0) {
      toast({ variant: "destructive", title: "Faltan Datos", description: "Complete documento de referencia, motivo y productos." });
      return;
    }

    setIsProcessing(true);
    const collectionName = type === 'CREDITO' ? 'credit_notes' : 'debit_notes';
    const totalAdjustment = adjustmentForm.items.reduce((acc, i) => acc + (i.price * i.quantity), 0);

    const data = {
      ...adjustmentForm,
      type,
      total: totalAdjustment,
      timestamp: new Date().toISOString(),
      status: 'EMITIDA'
    };

    try {
      await addDoc(collection(db, collectionName), data);
      
      // Si es nota de crédito (devolución), reintegrar stock
      if (type === 'CREDITO') {
        for (const item of adjustmentForm.items) {
          const product = inventory?.find((p: any) => p.sku === item.sku);
          if (product) {
            await updateDoc(doc(db, 'inventory', product.id), {
              quantity: (product.quantity || 0) + item.quantity
            });
          }
        }
      }

      toast({ 
        title: `Nota de ${type === 'CREDITO' ? 'Crédito' : 'Débito'} Emitida`, 
        description: `Se procesó el ajuste por $${totalAdjustment.toFixed(2)}.` 
      });
      setAdjustmentForm({ refDoc: '', customerName: '', reason: '', items: [], total: 0 });
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo registrar la nota." });
    } finally {
      setIsProcessing(false);
    }
  };

  const addAdjustmentItem = (product: any) => {
    setAdjustmentForm(prev => {
      const existing = prev.items.find(i => i.id === product.id);
      if (existing) {
        return {
          ...prev,
          items: prev.items.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
        };
      }
      return {
        ...prev,
        items: [...prev.items, { id: product.id, name: product.name, sku: product.sku, price: product.price, quantity: 1 }]
      };
    });
  };

  const addExpense = () => {
    const amt = parseFloat(expenseAmount);
    if (!expenseDesc || isNaN(amt)) return;
    setExpenses([...expenses, { description: expenseDesc, amount: amt }]);
    setExpenseDesc('');
    setExpenseAmount('');
  };

  const handleDayClosing = async () => {
    setIsProcessing(true);
    const closingData = {
      date: new Date().toISOString().split('T')[0],
      timestamp: new Date().toISOString(),
      cashFloat: cashConfig?.cashFloat || 0,
      
      // Cash details
      systemCashSales,
      physicalCashFound: totalPhysicalCash,
      expenses: totalExpenses,
      difference: cashDifference,
      denominations: cashDenominations,

      // Card details
      systemCardSales,
      physicalCardFound: physicalCard,
      cardDifference,

      // Check details
      systemCheckSales,
      physicalCheckFound: physicalCheck,
      checkDifference,

      // Transfer details
      systemTransferSales,
      physicalTransferFound: physicalTransfer,
      transferDifference,

      // Credit details
      systemCreditSales,
      physicalCreditFound: physicalCredit,
      creditDifference,

      closedBy: user?.email || 'Admin',
    };


    try {
      await addDoc(collection(db, 'daily_closings'), closingData);
      toast({ title: "Cierre de Día Guardado", description: "El arqueo ha sido formalizado." });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al guardar cierre" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 transition-colors duration-300 print:bg-white print:p-0">
      {/* Header Print Hidden */}
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="rounded-full bg-card shadow-sm border" onClick={() => router.push('/')}>
            <ArrowLeft className="text-foreground" size={20} />
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground font-headline">Terminal de Ventas NexWay</h1>
            <p className="text-muted-foreground text-xs md:text-sm">Gestión de caja y facturación con DTE</p>
          </div>
        </div>
        <ModeToggle />
      </div>

      <div className="max-w-7xl mx-auto print:hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-card p-1 rounded-2xl shadow-sm border h-auto flex-wrap w-full justify-start overflow-x-auto no-scrollbar">
            <TabsTrigger value="facturacion" className="rounded-xl px-4 py-2 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs md:text-sm whitespace-nowrap">
              <ShoppingCart size={14} className="mr-2" /> Venta
            </TabsTrigger>
            <TabsTrigger value="historial" className="rounded-xl px-4 py-2 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs md:text-sm whitespace-nowrap">
              <History size={14} className="mr-2" /> Historial
            </TabsTrigger>
            <TabsTrigger value="nota_credito" className="rounded-xl px-4 py-2 font-bold data-[state=active]:bg-rose-600 data-[state=active]:text-white text-xs md:text-sm whitespace-nowrap">
              <RotateCcw size={14} className="mr-2" /> Nota Crédito
            </TabsTrigger>
            <TabsTrigger value="nota_debito" className="rounded-xl px-4 py-2 font-bold data-[state=active]:bg-amber-600 data-[state=active]:text-white text-xs md:text-sm whitespace-nowrap">
              <TrendingUp size={14} className="mr-2" /> Nota Débito
            </TabsTrigger>
            <TabsTrigger value="arqueo" className="rounded-xl px-4 py-2 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs md:text-sm whitespace-nowrap">
              <Calculator size={14} className="mr-2" /> Arqueo / Cierre
            </TabsTrigger>
          </TabsList>

          {/* TAB VENTA */}
          <TabsContent value="facturacion" className="grid grid-cols-1 lg:grid-cols-12 gap-6 outline-none">
            <div className="lg:col-span-5 space-y-4">
              <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-card border">
                <CardHeader className="bg-slate-900 dark:bg-slate-950 text-white p-5">
                  <div className="flex justify-between items-center mb-1">
                    <CardTitle className="text-sm font-bold">Resumen de Venta</CardTitle>
                    <Badge variant="outline" className="text-[8px] text-blue-400 border-blue-400 uppercase">{docType}</Badge>
                  </div>
                  <p className="text-4xl font-black text-blue-400">${totalCart.toFixed(2)}</p>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[300px]">
                    <Table>
                      <TableBody>
                        {cart.length === 0 ? (
                          <TableRow><TableCell colSpan={3} className="text-center py-20 text-muted-foreground text-xs italic">Escanee productos</TableCell></TableRow>
                        ) : cart.map(item => (
                          <TableRow key={item.id}>
                            <TableCell className="font-bold text-xs">{item.quantity}x {item.name}</TableCell>
                            <TableCell className="text-right font-black">${(item.price * item.quantity).toFixed(2)}</TableCell>
                            <TableCell><Button variant="ghost" size="icon" onClick={() => setCart(cart.filter(i => i.id !== item.id))}><Trash2 size={12}/></Button></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                  <div className="p-4 bg-muted/20 border-t space-y-3">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Método de Pago</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      <Button variant={paymentMethod === 'Efectivo' ? 'default' : 'outline'} size="sm" onClick={() => setPaymentMethod('Efectivo')} className="h-9 text-[9px] font-bold rounded-xl px-1">
                        <Wallet size={12} className="mr-1" /> Efectivo
                      </Button>
                      <Button variant={paymentMethod === 'Tarjeta' ? 'default' : 'outline'} size="sm" onClick={() => setPaymentMethod('Tarjeta')} className="h-9 text-[9px] font-bold rounded-xl px-1">
                        <CardIcon size={12} className="mr-1" /> Tarjeta
                      </Button>
                      <Button variant={paymentMethod === 'Cheque' ? 'default' : 'outline'} size="sm" onClick={() => setPaymentMethod('Cheque')} className="h-9 text-[9px] font-bold rounded-xl px-1">
                        <FileText size={12} className="mr-1" /> Cheque
                      </Button>
                      <Button variant={paymentMethod === 'Transferencia' ? 'default' : 'outline'} size="sm" onClick={() => setPaymentMethod('Transferencia')} className="h-9 text-[9px] font-bold rounded-xl px-1">
                        <Landmark size={12} className="mr-1" /> Transf.
                      </Button>
                      <Button variant={paymentMethod === 'Credito' ? 'default' : 'outline'} size="sm" onClick={() => setPaymentMethod('Credito')} className="h-9 text-[9px] font-bold rounded-xl px-1">
                        <Receipt size={12} className="mr-1" /> Crédito
                      </Button>
                    </div>
                  </div>

                </CardContent>
              </Card>
              <Button className="w-full h-16 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-lg shadow-xl" onClick={handleOpenCheckout} disabled={cart.length === 0}>
                FINALIZAR Y NOTIFICAR
              </Button>
            </div>

            <div className="lg:col-span-7 space-y-4">
              <Card className="p-4 bg-card rounded-2xl border flex flex-col gap-3">
                <div className="flex gap-4">
                  <div className="flex-1 space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Cliente Receptor</Label>
                    <div className="flex gap-2">
                      <Input placeholder="Nombre..." value={customerName} onChange={e => setCustomerName(e.target.value)} className="h-10 bg-muted border-none rounded-xl text-xs font-bold" />
                      <Popover>
                        <PopoverTrigger asChild><Button variant="outline" className="h-10 rounded-xl px-3"><Users size={16}/></Button></PopoverTrigger>
                        <PopoverContent className="w-80 p-0" align="end">
                          <div className="p-3 border-b"><Input placeholder="Buscar cliente..." value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} className="h-8 text-xs" /></div>
                          <ScrollArea className="h-48">
                            {filteredCustomers.map(c => (
                              <div key={c.id} onClick={() => { setCustomerName(c.name); setCustomerEmail(c.email || ''); setDocType(c.category === 'Crédito Fiscal' ? 'CCF' : 'CF'); }} className="p-3 hover:bg-muted cursor-pointer border-b">
                                <p className="text-[11px] font-bold">{c.name}</p>
                                <p className="text-[9px] text-muted-foreground">{c.email || 'Sin correo'}</p>
                              </div>
                            ))}
                          </ScrollArea>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  <div className="w-48 space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Tipo de DTE</Label>
                    <Select value={docType} onValueChange={(v: any) => setDocType(v)}>
                      <SelectTrigger className="h-10 rounded-xl bg-muted border-none text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="CF">Factura CF</SelectItem><SelectItem value="CCF">Crédito Fiscal</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
              </Card>

              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <Input placeholder="Buscar por SKU o Nombre de producto..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 h-12 bg-card border shadow-sm rounded-2xl text-xs md:text-sm" />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {filteredProducts.map(p => (
                  <div key={p.id} onClick={() => addToCart(p)} className="bg-card p-3 rounded-2xl shadow-sm border hover:border-blue-500 cursor-pointer transition-all flex flex-col justify-between aspect-square group">
                    <div>
                      <p className="text-[9px] font-mono text-muted-foreground">{p.sku}</p>
                      <h3 className="text-[11px] font-bold text-foreground leading-tight line-clamp-2 h-7">{p.name}</h3>
                    </div>
                    <div className="mt-2 pt-2 border-t flex justify-between items-center">
                      <span className="font-black text-blue-600">${p.price}</span>
                      <PlusCircle size={16} className="text-blue-500 opacity-0 group-hover:opacity-100 transition-all" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* TAB NOTA CREDITO */}
          <TabsContent value="nota_credito" className="grid grid-cols-1 lg:grid-cols-12 gap-6 outline-none">
             <div className="lg:col-span-5 space-y-4">
                <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-card border">
                   <CardHeader className="bg-rose-700 text-white p-5">
                      <CardTitle className="text-sm font-bold">Nota de Crédito (Ajuste)</CardTitle>
                      <p className="text-4xl font-black">${adjustmentForm.items.reduce((acc, i) => acc + (i.price * i.quantity), 0).toFixed(2)}</p>
                   </CardHeader>
                   <CardContent className="p-0">
                      <ScrollArea className="h-[300px]">
                         <Table>
                            <TableBody>
                               {adjustmentForm.items.length === 0 ? (
                                  <TableRow><TableCell colSpan={3} className="text-center py-20 text-muted-foreground text-xs italic">Agregue ítems a descontar</TableCell></TableRow>
                               ) : adjustmentForm.items.map((item, idx) => (
                                  <TableRow key={idx}>
                                     <TableCell className="font-bold text-xs">{item.quantity}x {item.name}</TableCell>
                                     <TableCell className="text-right font-black text-rose-600">-${(item.price * item.quantity).toFixed(2)}</TableCell>
                                     <TableCell><Button variant="ghost" size="icon" onClick={() => setAdjustmentForm({...adjustmentForm, items: adjustmentForm.items.filter(i => i.id !== item.id)})}><Trash2 size={12}/></Button></TableCell>
                                  </TableRow>
                               ))}
                            </TableBody>
                         </Table>
                      </ScrollArea>
                   </CardContent>
                </Card>
                <Button 
                  className="w-full h-16 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-lg shadow-xl"
                  onClick={() => handleProcessAdjustment('CREDITO')}
                  disabled={isProcessing || adjustmentForm.items.length === 0}
                >
                  {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <RotateCcw className="mr-2" />}
                  EMITIR NOTA DE CRÉDITO
                </Button>
             </div>
             <div className="lg:col-span-7 space-y-4">
                <Card className="p-5 bg-card rounded-2xl border space-y-4">
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                         <Label className="text-[10px] font-black uppercase text-muted-foreground">Documento Referencia</Label>
                         <Input placeholder="FACT-001 / CCF-001" value={adjustmentForm.refDoc} onChange={e => setAdjustmentForm({...adjustmentForm, refDoc: e.target.value})} className="h-10 bg-muted border-none rounded-xl text-xs font-bold" />
                      </div>
                      <div className="space-y-1.5">
                         <Label className="text-[10px] font-black uppercase text-muted-foreground">Cliente</Label>
                         <Input placeholder="Nombre del cliente..." value={adjustmentForm.customerName} onChange={e => setAdjustmentForm({...adjustmentForm, customerName: e.target.value})} className="h-10 bg-muted border-none rounded-xl text-xs font-bold" />
                      </div>
                   </div>
                   <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground">Motivo del Ajuste / Devolución</Label>
                      <Textarea placeholder="Ej: Mercadería dañada, error en precio..." value={adjustmentForm.reason} onChange={e => setAdjustmentForm({...adjustmentForm, reason: e.target.value})} className="bg-muted border-none rounded-xl text-xs" />
                   </div>
                </Card>
                <div className="relative">
                   <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                   <Input placeholder="Buscar productos para devolución..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 h-12 bg-card border shadow-sm rounded-2xl text-xs" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                   {filteredProducts.slice(0, 8).map(p => (
                      <div key={p.id} onClick={() => addAdjustmentItem(p)} className="bg-card p-3 rounded-2xl border hover:border-rose-500 cursor-pointer transition-all flex flex-col justify-between aspect-square group">
                         <h3 className="text-[10px] font-bold leading-tight line-clamp-2">{p.name}</h3>
                         <div className="mt-2 pt-2 border-t flex justify-between items-center">
                            <span className="font-black text-rose-600">${p.price}</span>
                            <PlusCircle size={14} className="text-rose-500" />
                         </div>
                      </div>
                   ))}
                </div>
             </div>
          </TabsContent>

          {/* TAB NOTA DEBITO */}
          <TabsContent value="nota_debito" className="grid grid-cols-1 lg:grid-cols-12 gap-6 outline-none">
             <div className="lg:col-span-5 space-y-4">
                <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-card border">
                   <CardHeader className="bg-amber-600 text-white p-5">
                      <CardTitle className="text-sm font-bold">Nota de Débito (Cargo Extra)</CardTitle>
                      <p className="text-4xl font-black">${adjustmentForm.items.reduce((acc, i) => acc + (i.price * i.quantity), 0).toFixed(2)}</p>
                   </CardHeader>
                   <CardContent className="p-0">
                      <ScrollArea className="h-[300px]">
                         <Table>
                            <TableBody>
                               {adjustmentForm.items.length === 0 ? (
                                  <TableRow><TableCell colSpan={3} className="text-center py-20 text-muted-foreground text-xs italic">Agregue conceptos de cargo</TableCell></TableRow>
                               ) : adjustmentForm.items.map((item, idx) => (
                                  <TableRow key={idx}>
                                     <TableCell className="font-bold text-xs">{item.quantity}x {item.name}</TableCell>
                                     <TableCell className="text-right font-black text-amber-600">+${(item.price * item.quantity).toFixed(2)}</TableCell>
                                     <TableCell><Button variant="ghost" size="icon" onClick={() => setAdjustmentForm({...adjustmentForm, items: adjustmentForm.items.filter(i => i.id !== item.id)})}><Trash2 size={12}/></Button></TableCell>
                                  </TableRow>
                               ))}
                            </TableBody>
                         </Table>
                      </ScrollArea>
                   </CardContent>
                </Card>
                <Button 
                  className="w-full h-16 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-black text-lg shadow-xl"
                  onClick={() => handleProcessAdjustment('DEBITO')}
                  disabled={isProcessing || adjustmentForm.items.length === 0}
                >
                  {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <TrendingUp className="mr-2" />}
                  EMITIR NOTA DE DÉBITO
                </Button>
             </div>
             <div className="lg:col-span-7 space-y-4">
                <Card className="p-5 bg-card rounded-2xl border space-y-4">
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                         <Label className="text-[10px] font-black uppercase text-muted-foreground">Documento Referencia</Label>
                         <Input placeholder="FACT-001 / CCF-001" value={adjustmentForm.refDoc} onChange={e => setAdjustmentForm({...adjustmentForm, refDoc: e.target.value})} className="h-10 bg-muted border-none rounded-xl text-xs font-bold" />
                      </div>
                      <div className="space-y-1.5">
                         <Label className="text-[10px] font-black uppercase text-muted-foreground">Cliente</Label>
                         <Input placeholder="Nombre del cliente..." value={adjustmentForm.customerName} onChange={e => setAdjustmentForm({...adjustmentForm, customerName: e.target.value})} className="h-10 bg-muted border-none rounded-xl text-xs font-bold" />
                      </div>
                   </div>
                   <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground">Razón del Cargo Adicional</Label>
                      <Textarea placeholder="Ej: Intereses por mora, flete no cobrado, ajuste de precio..." value={adjustmentForm.reason} onChange={e => setAdjustmentForm({...adjustmentForm, reason: e.target.value})} className="bg-muted border-none rounded-xl text-xs" />
                   </div>
                </Card>
                <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-3">
                   <AlertCircle className="text-amber-600 mt-0.5" size={16} />
                   <p className="text-[10px] text-amber-700">Las notas de débito incrementan el valor del documento original. Asegúrese de que el concepto sea legalmente válido.</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                   {filteredProducts.slice(0, 4).map(p => (
                      <div key={p.id} onClick={() => addAdjustmentItem(p)} className="bg-card p-3 rounded-2xl border hover:border-amber-500 cursor-pointer transition-all flex flex-col justify-between aspect-square group">
                         <h3 className="text-[10px] font-bold leading-tight line-clamp-2">{p.name}</h3>
                         <div className="mt-2 pt-2 border-t flex justify-between items-center">
                            <span className="font-black text-amber-600">${p.price}</span>
                            <PlusCircle size={14} className="text-amber-500" />
                         </div>
                      </div>
                   ))}
                </div>
             </div>
          </TabsContent>

          {/* TAB HISTORIAL */}
          <TabsContent value="historial" className="outline-none">
            <Card className="border shadow-sm rounded-3xl bg-card overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="px-6 text-[10px] uppercase">Hora</TableHead>
                    <TableHead className="text-[10px] uppercase">Tipo</TableHead>
                    <TableHead className="text-[10px] uppercase">Cliente</TableHead>
                    <TableHead className="text-right text-[10px] uppercase">Total</TableHead>
                    <TableHead className="text-center text-[10px] uppercase">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesAll?.map((sale: any) => (
                    <TableRow key={sale.id}>
                      <TableCell className="px-6 text-[10px] md:text-xs text-muted-foreground">{new Date(sale.timestamp).toLocaleTimeString()}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[8px]">{sale.docType}</Badge></TableCell>
                      <TableCell className="font-bold text-[10px] md:text-xs">{sale.customer}</TableCell>
                      <TableCell className="text-right font-black text-[10px] md:text-xs">${sale.total.toFixed(2)}</TableCell>
                      <TableCell className="text-center"><Badge className="bg-emerald-100 text-emerald-600 text-[8px]">{sale.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* TAB ARQUEO */}
          <TabsContent value="arqueo" className="space-y-6 outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Conteo de Billetes/Monedas */}
              <div className="lg:col-span-4 space-y-4">
                <Card className="border shadow-sm rounded-3xl overflow-hidden bg-card">
                  <CardHeader className="bg-slate-900 text-white p-5">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Coins size={18} className="text-yellow-500" /> Conteo de Efectivo
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <ScrollArea className="h-[450px] pr-4">
                      {Object.keys(cashDenominations).map(den => (
                        <div key={den} className="flex items-center justify-between py-2 border-b last:border-0">
                          <Label className="text-xs font-bold text-muted-foreground">${den}</Label>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground">Cant.</span>
                            <Input 
                              type="number" 
                              className="h-8 w-20 text-right font-bold text-xs" 
                              value={cashDenominations[den]}
                              onFocus={e => e.target.select()}
                              onChange={e => setCashDenominations({...cashDenominations, [den]: parseInt(e.target.value) || 0})}
                            />
                          </div>
                        </div>
                      ))}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              {/* Conciliación y Gastos */}
              <div className="lg:col-span-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="p-5 border-none shadow-sm rounded-3xl bg-blue-600 text-white">
                    <p className="text-[10px] font-black uppercase opacity-60">Fondo Base</p>
                    <p className="text-2xl font-black">${(cashConfig?.cashFloat || 0).toFixed(2)}</p>
                  </Card>
                  <Card className="p-5 border-none shadow-sm rounded-3xl bg-emerald-600 text-white">
                    <p className="text-[10px] font-black uppercase opacity-60">Ventas Sistema</p>
                    <p className="text-2xl font-black">${systemCashSales.toFixed(2)}</p>
                  </Card>
                  <Card className={`p-5 border-none shadow-sm rounded-3xl text-white ${cashDifference < 0 ? 'bg-rose-600' : 'bg-slate-900'}`}>
                    <p className="text-[10px] font-black uppercase opacity-60">Diferencia</p>
                    <p className="text-2xl font-black">${cashDifference.toFixed(2)}</p>
                  </Card>
                </div>

                {/* Conciliación de Otros Medios de Pago */}
                <Card className="border shadow-sm rounded-3xl overflow-hidden bg-card border">
                  <CardHeader className="bg-slate-900 text-white p-4">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <CardIcon size={18} className="text-blue-400" /> Conciliación de Otros Medios de Pago
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead className="text-[10px] uppercase font-bold">Medio de Pago</TableHead>
                          <TableHead className="text-right text-[10px] uppercase font-bold">Ventas Sistema</TableHead>
                          <TableHead className="text-right text-[10px] uppercase font-bold w-36">Físico / Comprobantes</TableHead>
                          <TableHead className="text-right text-[10px] uppercase font-bold">Diferencia</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-bold text-xs flex items-center gap-2">
                            <CardIcon size={14} className="text-blue-500" /> Tarjeta
                          </TableCell>
                          <TableCell className="text-right font-black text-xs">${systemCardSales.toFixed(2)}</TableCell>
                          <TableCell className="text-right">
                            <Input 
                              type="number" 
                              className="h-8 w-24 text-right font-bold text-xs ml-auto" 
                              value={physicalCard || ''} 
                              placeholder="0.00"
                              onFocus={e => e.target.select()}
                              onChange={e => setPhysicalCard(parseFloat(e.target.value) || 0)} 
                            />
                          </TableCell>
                          <TableCell className={`text-right font-black text-xs ${cardDifference < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            ${cardDifference.toFixed(2)}
                          </TableCell>
                        </TableRow>
                        
                        <TableRow>
                          <TableCell className="font-bold text-xs flex items-center gap-2">
                            <FileText size={14} className="text-purple-500" /> Cheque
                          </TableCell>
                          <TableCell className="text-right font-black text-xs">${systemCheckSales.toFixed(2)}</TableCell>
                          <TableCell className="text-right">
                            <Input 
                              type="number" 
                              className="h-8 w-24 text-right font-bold text-xs ml-auto" 
                              value={physicalCheck || ''} 
                              placeholder="0.00"
                              onFocus={e => e.target.select()}
                              onChange={e => setPhysicalCheck(parseFloat(e.target.value) || 0)} 
                            />
                          </TableCell>
                          <TableCell className={`text-right font-black text-xs ${checkDifference < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            ${checkDifference.toFixed(2)}
                          </TableCell>
                        </TableRow>

                        <TableRow>
                          <TableCell className="font-bold text-xs flex items-center gap-2">
                            <Landmark size={14} className="text-amber-500" /> Transferencia
                          </TableCell>
                          <TableCell className="text-right font-black text-xs">${systemTransferSales.toFixed(2)}</TableCell>
                          <TableCell className="text-right">
                            <Input 
                              type="number" 
                              className="h-8 w-24 text-right font-bold text-xs ml-auto" 
                              value={physicalTransfer || ''} 
                              placeholder="0.00"
                              onFocus={e => e.target.select()}
                              onChange={e => setPhysicalTransfer(parseFloat(e.target.value) || 0)} 
                            />
                          </TableCell>
                          <TableCell className={`text-right font-black text-xs ${transferDifference < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            ${transferDifference.toFixed(2)}
                          </TableCell>
                        </TableRow>

                        <TableRow>
                          <TableCell className="font-bold text-xs flex items-center gap-2">
                            <Receipt size={14} className="text-teal-500" /> Crédito
                          </TableCell>
                          <TableCell className="text-right font-black text-xs">${systemCreditSales.toFixed(2)}</TableCell>
                          <TableCell className="text-right">
                            <Input 
                              type="number" 
                              className="h-8 w-24 text-right font-bold text-xs ml-auto" 
                              value={physicalCredit || ''} 
                              placeholder="0.00"
                              onFocus={e => e.target.select()}
                              onChange={e => setPhysicalCredit(parseFloat(e.target.value) || 0)} 
                            />
                          </TableCell>
                          <TableCell className={`text-right font-black text-xs ${creditDifference < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            ${creditDifference.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                  <Card className="border shadow-sm rounded-3xl bg-card">
                    <CardHeader className="p-5 border-b">
                      <CardTitle className="text-sm font-bold flex items-center gap-2"><TrendingDown size={18} className="text-rose-500" /> Gastos de Caja</CardTitle>
                    </CardHeader>
                    <CardContent className="p-5 space-y-4">
                      <div className="flex gap-2">
                        <Input placeholder="Descripción..." value={expenseDesc} onChange={e => setExpenseDesc(e.target.value)} className="h-10 text-xs bg-muted border-none rounded-xl" />
                        <Input type="number" placeholder="0.00" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} className="h-10 w-24 text-xs bg-muted border-none rounded-xl font-bold" />
                        <Button onClick={addExpense} variant="secondary" size="icon" className="h-10 w-10 rounded-xl"><Plus size={16}/></Button>
                      </div>
                      <ScrollArea className="h-40">
                        {expenses.map((exp, idx) => (
                          <div key={idx} className="flex justify-between items-center p-2 hover:bg-muted/50 rounded-lg">
                            <span className="text-xs font-medium">{exp.description}</span>
                            <span className="text-xs font-black text-rose-500">-${exp.amount.toFixed(2)}</span>
                          </div>
                        ))}
                      </ScrollArea>
                    </CardContent>
                  </Card>

                  <div className="space-y-4">
                    <Button className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black shadow-xl" onClick={handleDayClosing} disabled={isProcessing}>
                      {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2" />}
                      GUARDAR CIERRE DE DÍA
                    </Button>
                    <Button variant="outline" className="w-full h-14 rounded-2xl border-2 font-black text-foreground shadow-sm" onClick={handlePrintReport}>
                      <Printer size={20} className="mr-2" />
                      IMPRIMIR REPORTES
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* REPORT PRINT VIEW */}
      <div className="hidden print:block w-full max-w-4xl mx-auto p-8 space-y-8 text-black">
        <div className="text-center space-y-2 border-b pb-8">
           <h1 className="text-3xl font-black uppercase tracking-tighter">NexWay ERP - Reporte de Arqueo</h1>
           <p className="text-sm font-bold">Fecha de Cierre: {new Date().toLocaleDateString()} - {new Date().toLocaleTimeString()}</p>
           <p className="text-xs italic">Cajero Responsable: {user?.email || 'Admin'}</p>
        </div>

        <div className="grid grid-cols-2 gap-8">
           <div className="space-y-4">
              <h2 className="text-lg font-black border-b pb-2 uppercase text-blue-800">Resumen de Caja</h2>
              <div className="space-y-2 text-sm">
                 <div className="flex justify-between"><span>Fondo Inicial:</span> <span className="font-bold">${(cashConfig?.cashFloat || 0).toFixed(2)}</span></div>
                 <div className="flex justify-between"><span>Ventas Efectivo:</span> <span className="font-bold">${systemCashSales.toFixed(2)}</span></div>
                 <div className="flex justify-between"><span>Total Gastos:</span> <span className="font-bold text-red-600">-${totalExpenses.toFixed(2)}</span></div>
                 <div className="flex justify-between border-t pt-2 text-lg font-black">
                    <span>Esperado en Caja:</span> 
                    <span>${((cashConfig?.cashFloat || 0) + systemCashSales - totalExpenses).toFixed(2)}</span>
                 </div>
                 <div className="flex justify-between text-lg font-black text-blue-600">
                    <span>Físico Encontrado:</span> 
                    <span>${totalPhysicalCash.toFixed(2)}</span>
                 </div>
              </div>
           </div>

           <div className="space-y-4">
              <h2 className="text-lg font-black border-b pb-2 uppercase text-blue-800">Detalle Denominaciones</h2>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
                 {Object.entries(cashDenominations).map(([den, qty]) => (
                   <div key={den} className="flex justify-between">
                      <span>${den}:</span>
                      <span className="font-bold">{qty} un.</span>
                   </div>
                 ))}
              </div>
           </div>
        </div>

        <div className="space-y-4">
            <h2 className="text-lg font-black border-b pb-2 uppercase text-blue-800">Otros Medios de Pago</h2>
            <Table className="border text-xs">
               <TableHeader>
                  <TableRow className="bg-gray-100">
                     <TableHead className="font-bold text-black">Medio de Pago</TableHead>
                     <TableHead className="text-right font-bold text-black">Ventas Sistema</TableHead>
                     <TableHead className="text-right font-bold text-black">Físico / Comprobantes</TableHead>
                     <TableHead className="text-right font-bold text-black">Diferencia</TableHead>
                  </TableRow>
               </TableHeader>
               <TableBody>
                  <TableRow>
                     <TableCell className="font-bold">Tarjeta</TableCell>
                     <TableCell className="text-right font-mono">${systemCardSales.toFixed(2)}</TableCell>
                     <TableCell className="text-right font-mono">${physicalCard.toFixed(2)}</TableCell>
                     <TableCell className={`text-right font-black font-mono ${cardDifference < 0 ? 'text-red-600' : 'text-green-600'}`}>${cardDifference.toFixed(2)}</TableCell>
                  </TableRow>
                  <TableRow>
                     <TableCell className="font-bold">Cheque</TableCell>
                     <TableCell className="text-right font-mono">${systemCheckSales.toFixed(2)}</TableCell>
                     <TableCell className="text-right font-mono">${physicalCheck.toFixed(2)}</TableCell>
                     <TableCell className={`text-right font-black font-mono ${checkDifference < 0 ? 'text-red-600' : 'text-green-600'}`}>${checkDifference.toFixed(2)}</TableCell>
                  </TableRow>
                  <TableRow>
                     <TableCell className="font-bold">Transferencia</TableCell>
                     <TableCell className="text-right font-mono">${systemTransferSales.toFixed(2)}</TableCell>
                     <TableCell className="text-right font-mono">${physicalTransfer.toFixed(2)}</TableCell>
                     <TableCell className={`text-right font-black font-mono ${transferDifference < 0 ? 'text-red-600' : 'text-green-600'}`}>${transferDifference.toFixed(2)}</TableCell>
                  </TableRow>
                  <TableRow>
                     <TableCell className="font-bold">Crédito</TableCell>
                     <TableCell className="text-right font-mono">${systemCreditSales.toFixed(2)}</TableCell>
                     <TableCell className="text-right font-mono">${physicalCredit.toFixed(2)}</TableCell>
                     <TableCell className={`text-right font-black font-mono ${creditDifference < 0 ? 'text-red-600' : 'text-green-600'}`}>${creditDifference.toFixed(2)}</TableCell>
                  </TableRow>
               </TableBody>
            </Table>
         </div>

        <div className="space-y-4">
           <h2 className="text-lg font-black border-b pb-2 uppercase text-blue-800">Historial de Ventas del Día</h2>
           <Table className="border text-[10px]">
              <TableHeader>
                 <TableRow className="bg-gray-100">
                    <TableHead>Hora</TableHead>
                    <TableHead>DTE/Doc</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                 </TableRow>
              </TableHeader>
              <TableBody>
                 {salesAll?.map((sale: any) => (
                    <TableRow key={sale.id}>
                       <TableCell>{new Date(sale.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</TableCell>
                       <TableCell>{sale.docType}</TableCell>
                       <TableCell className="font-bold">{sale.customer}</TableCell>
                       <TableCell>{sale.paymentMethod}</TableCell>
                       <TableCell className="text-right font-black">${sale.total.toFixed(2)}</TableCell>
                    </TableRow>
                 ))}
              </TableBody>
           </Table>
        </div>

        <div className="grid grid-cols-2 gap-20 pt-20">
           <div className="border-t border-black text-center pt-4">
              <p className="text-sm font-black">Firma Cajero</p>
              <p className="text-[10px] text-gray-500 uppercase">{user?.email || 'Admin'}</p>
           </div>
           <div className="border-t border-black text-center pt-4">
              <p className="text-sm font-black">Firma Auditoría / Gerencia</p>
              <p className="text-[10px] text-gray-500 uppercase">NexWay Solutions</p>
           </div>
        </div>
      </div>

      {/* CHECKOUT DIALOG */}
      <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
        <DialogContent className="rounded-3xl max-w-md p-6 bg-card border shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">Confirmar Venta</DialogTitle>
            <DialogDescription>El DTE será notificado al cliente vía correo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="bg-slate-900 rounded-2xl p-6 text-white flex justify-between items-center">
               <div><p className="text-[10px] font-black uppercase opacity-60">Monto Total</p><p className="text-3xl font-black text-blue-400">${totalCart.toFixed(2)}</p></div>
               <div className="h-12 w-12 bg-white/10 rounded-2xl flex items-center justify-center"><Calculator size={24} /></div>
            </div>

            {paymentMethod === 'Efectivo' ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Efectivo Recibido</Label>
                  <Input type="number" placeholder="0.00" value={cashReceived} onChange={e => setCashReceived(e.target.value)} className="h-12 text-lg font-bold rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Cambio</Label>
                  <div className="h-12 flex items-center px-4 bg-emerald-500/10 text-emerald-600 rounded-xl font-black text-lg">${changeDue.toFixed(2)}</div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground">Referencia ({paymentMethod})</Label>
                <Input placeholder="ID Transacción..." value={paymentReference} onChange={e => setPaymentReference(e.target.value)} className="h-12 rounded-xl" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-lg shadow-xl" onClick={handleFinalizeSale} disabled={isProcessing}>
              {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2" />}
              COMPLETAR OPERACIÓN
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
