
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
  PlusCircle,
  Printer,
  Lock,
  Mail
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
import { sendDteEmail } from '@/ai/flows/send-dte-email-flow';

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
  const [customerEmail, setCustomerEmail] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Efectivo');
  
  // Checkout Modal States
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentReference, setPaymentReference] = useState('');
  const [cashReceived, setCashReceived] = useState<string>('');

  useEffect(() => {
    setMounted(true);
  }, []);

  const userProfileRef = useMemo(() => user ? doc(db, 'users', user.uid) : null, [db, user]);
  const { data: userProfile } = useDoc<any>(userProfileRef);

  const cashConfigRef = useMemo(() => doc(db, 'system', 'cash_config'), [db]);
  const { data: cashConfig } = useDoc<any>(cashConfigRef);

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
      .then(async (docRef) => {
        // 1. Actualizar Stock
        for (const item of cart) {
          const product = inventory.find((p: any) => p.id === item.id);
          if (product) {
            updateDoc(doc(db, 'inventory', item.id), { 
              quantity: Math.max(0, (product.quantity || 0) - item.quantity) 
            });
          }
        }

        // 2. Proceso de notificación por Correo
        const targetEmail = customerEmail || cashConfig?.catchAllEmail;
        if (targetEmail) {
          sendDteEmail({
            recipientEmail: targetEmail,
            customerName: saleData.customer,
            docType: saleData.docType,
            docNumber: docRef.id,
            total: saleData.total,
            items: saleData.items.map(i => ({ name: i.name, quantity: i.quantity, price: i.price }))
          }).then(res => {
            if (res.success) {
              toast({ title: "DTE Enviado", description: `Notificación enviada a ${targetEmail}` });
            }
          }).catch(e => {
            console.error("Error al enviar email:", e);
          });
        }

        toast({ title: "Venta Exitosa", description: "Operación procesada correctamente." });
        setCart([]);
        setCustomerName('');
        setCustomerEmail('');
        setPaymentMethod('Efectivo');
        setIsCheckoutOpen(false);
      })
      .catch(async (err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'sales', operation: 'create', requestResourceData: saleData }));
      })
      .finally(() => setIsProcessing(false));
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 transition-colors duration-300 print:p-0">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="rounded-full bg-card shadow-sm border" onClick={() => router.push('/')}>
            <ArrowLeft className="text-foreground" size={20} />
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground">NexWay Facturación</h1>
            <p className="text-muted-foreground text-xs md:text-sm">Terminal de punto de venta con notificación DTE</p>
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
                                <span className="text-[9px] text-muted-foreground font-bold">${item.price.toFixed(2)}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-bold text-[10px] md:text-xs text-foreground">${(item.price * item.quantity).toFixed(2)}</TableCell>
                            <TableCell className="px-1">
                              <Button variant="ghost" size="icon" onClick={() => setCart(cart.filter(i => i.id !== item.id))} className="h-6 w-6 text-muted-foreground hover:text-destructive">
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
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Button className="w-full h-14 md:h-16 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-base md:text-lg shadow-xl" disabled={cart.length === 0} onClick={handleOpenCheckout}>
                FINALIZAR Y ENVIAR
              </Button>
            </div>

            <div className="lg:col-span-7 order-1 lg:order-2 space-y-4">
              <Card className="border-none shadow-sm rounded-2xl bg-card border p-3 md:p-4 flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row gap-3">
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
                              {filteredCustomers.map((c: any) => (
                                <div key={c.id} onClick={() => { setCustomerName(c.name); setCustomerEmail(c.email || ''); setDocType(c.category === 'Crédito Fiscal' ? 'CCF' : 'CF'); }} className="p-3 hover:bg-muted cursor-pointer rounded-lg transition-colors">
                                  <p className="text-[11px] font-bold">{c.name}</p>
                                  <p className="text-[9px] text-muted-foreground">{c.email || 'Sin correo'}</p>
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
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] md:text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1"><Mail size={10}/> Correo de Notificación</Label>
                  <Input 
                    placeholder={cashConfig?.catchAllEmail || "correo@ejemplo.com"} 
                    value={customerEmail} 
                    onChange={e => setCustomerEmail(e.target.value)} 
                    className="h-8 bg-muted/50 border-none rounded-lg text-[10px] font-medium"
                  />
                  {!customerEmail && cashConfig?.catchAllEmail && (
                    <p className="text-[8px] text-blue-500 font-bold italic">Se usará correo bolsón institucional.</p>
                  )}
                </div>
              </Card>

              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <Input placeholder="Buscar por SKU o Nombre..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 h-10 md:h-12 bg-card border shadow-sm rounded-2xl text-xs md:text-sm" />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-3">
                {filteredProducts.map((p: any) => (
                  <div key={p.id} onClick={() => addToCart(p)} className="bg-card p-3 rounded-2xl shadow-sm border border-border hover:border-blue-400 cursor-pointer transition-all flex flex-col justify-between aspect-square group active:scale-95">
                    <div>
                      <p className="text-[8px] md:text-[10px] font-bold text-muted-foreground">{p.sku}</p>
                      <h3 className="text-[10px] md:text-xs font-bold text-foreground leading-tight line-clamp-2 h-7 md:h-8">{p.name}</h3>
                    </div>
                    <div className="mt-2 pt-2 border-t flex justify-between items-center">
                      <span className="text-xs md:text-sm font-black text-foreground">${(p.price || 0).toFixed(2)}</span>
                      <PlusCircle size={16} className="text-blue-500 opacity-0 group-hover:opacity-100 transition-all" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="historial" className="space-y-4 outline-none">
            <Card className="border shadow-sm rounded-3xl bg-card overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="px-4 text-[10px] uppercase">Hora</TableHead>
                    <TableHead className="text-[10px] uppercase">DTE</TableHead>
                    <TableHead className="text-[10px] uppercase">Cliente</TableHead>
                    <TableHead className="text-right text-[10px] uppercase">Total</TableHead>
                    <TableHead className="text-center text-[10px] uppercase">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesAll?.map((sale: any) => (
                    <TableRow key={sale.id}>
                      <TableCell className="px-4 text-[10px] md:text-xs text-muted-foreground">{new Date(sale.timestamp).toLocaleTimeString()}</TableCell>
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
        </Tabs>
      </div>

      {/* Checkout Modal */}
      <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
        <DialogContent className="rounded-[1.5rem] md:rounded-[2rem] max-w-[95vw] md:max-w-md p-4 md:p-8 bg-card border">
          <DialogHeader>
            <DialogTitle className="text-xl md:text-2xl font-black">Confirmar Venta</DialogTitle>
            <DialogDescription>El DTE será enviado por correo tras el pago.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 md:space-y-6">
            <div className="bg-slate-950 rounded-2xl p-4 md:p-6 text-white flex justify-between items-center">
               <div><p className="text-[8px] font-black uppercase opacity-60">Total a Pagar</p><p className="text-2xl font-black text-blue-400">${totalCart.toFixed(2)}</p></div>
               <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center"><Calculator size={20} /></div>
            </div>

            {paymentMethod === 'Efectivo' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[9px] font-black uppercase text-muted-foreground">Efectivo Recibido</Label>
                  <input type="number" placeholder="0.00" value={cashReceived} onChange={e => setCashReceived(e.target.value)} className="h-10 md:h-12 w-full text-lg font-bold rounded-xl border border-border px-4 bg-muted text-foreground" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[9px] font-black uppercase text-muted-foreground">Cambio</Label>
                  <div className="h-10 md:h-12 flex items-center px-4 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl font-black text-lg">${changeDue.toFixed(2)}</div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-[9px] font-black uppercase text-muted-foreground">Referencia ({paymentMethod})</Label>
                <Input placeholder="ID Transacción..." value={paymentReference} onChange={e => setPaymentReference(e.target.value)} className="h-10 md:h-12 rounded-xl bg-muted border-none" />
              </div>
            )}
            
            <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 flex items-center gap-3">
               <Mail className="text-blue-600" size={16} />
               <p className="text-[9px] font-bold text-blue-800">Se enviará copia digital a: {customerEmail || cashConfig?.catchAllEmail || "No configurado"}</p>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button className="w-full h-12 md:h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-base shadow-xl" onClick={handleFinalizeSale} disabled={isProcessing}>
              {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2" />}
              CONFIRMAR Y NOTIFICAR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
