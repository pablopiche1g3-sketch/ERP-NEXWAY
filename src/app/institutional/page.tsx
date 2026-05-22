
'use client';

import React, { useState, useMemo, useRef } from 'react';
import { 
  Building2, 
  ArrowLeft, 
  Plus, 
  Search, 
  Trash2, 
  Briefcase, 
  Receipt, 
  Calculator,
  CheckCircle2,
  Loader2,
  FileText,
  ShoppingCart,
  Hash,
  Info,
  FileJson,
  TrendingUp,
  TrendingDown,
  FileCode,
  FileUp,
  XCircle,
  FilePlus,
  Paperclip,
  ArrowRight,
  Scale,
  Printer,
  History,
  BookOpen,
  PieChart,
  BarChart3,
  Edit3,
  User,
  CheckCircle,
  ListPlus,
  PackageSearch,
  Mail
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { useFirestore, useCollection, useDoc } from '@/firebase';
import { collection, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { sendDteEmail } from '@/ai/flows/send-dte-email-flow';

interface CartItem {
  id: string;
  sku: string;
  name: string;
  price: number;
  quantity: number;
}

interface ProjectDocument {
  name: string;
  data: string;
  type: string;
  date: string;
}

export default function InstitutionalModulePage() {
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  
  // Data Fetching
  const projectsRef = useMemo(() => collection(db, 'institutional_projects'), [db]);
  const customersRef = useMemo(() => collection(db, 'customers'), [db]);
  const inventoryRef = useMemo(() => collection(db, 'inventory'), [db]);
  const salesRef = useMemo(() => collection(db, 'institutional_sales'), [db]);
  const purchasesRef = useMemo(() => collection(db, 'institutional_purchases'), [db]);
  
  const { data: projects, loading: loadingProjects } = useCollection<any>(projectsRef);
  const { data: customers } = useCollection<any>(customersRef);
  const { data: inventory } = useCollection<any>(inventoryRef);
  const { data: allSales } = useCollection<any>(salesRef);
  const { data: allPurchases } = useCollection<any>(purchasesRef);

  const cashConfigRef = useMemo(() => doc(db, 'system', 'cash_config'), [db]);
  const { data: cashConfig } = useDoc<any>(cashConfigRef);

  // States
  const [activeTab, setActiveTab] = useState('billing');
  const [searchTerm, setSearchTerm] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [docNumber, setDocNumber] = useState('');
  const [billingConcept, setBillingConcept] = useState(''); 
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Calculations
  const totalCart = useMemo(() => cart.reduce((acc, item) => acc + (item.price * item.quantity), 0), [cart]);

  const handleFinalizeSale = async () => {
    if (cart.length === 0 || !docNumber || !customerName) {
      toast({ variant: "destructive", title: "Faltan datos", description: "Seleccione cliente, productos y No. de factura." });
      return;
    }
    setIsProcessing(true);
    try {
      const finalItemsDetail = billingConcept 
        ? `${billingConcept} (Detalle oculto)`
        : cart.map(i => `${i.quantity} ${i.name} @ $${i.price}`).join(', ');

      const saleRef = await addDoc(salesRef, {
        projectId: selectedProjectId || null,
        docNumber,
        total: totalCart,
        date: new Date().toISOString().split('T')[0],
        items: finalItemsDetail,
        cartItems: cart,
        concept: billingConcept || null,
        customerName,
        customerEmail,
        status: 'COMPLETADA',
        createdAt: new Date().toISOString()
      });

      // Notificar por correo
      const targetEmail = customerEmail || cashConfig?.catchAllEmail;
      if (targetEmail) {
        sendDteEmail({
          recipientEmail: targetEmail,
          customerName,
          docType: 'Factura Institucional',
          docNumber: docNumber || saleRef.id,
          total: totalCart,
          items: cart.map(i => ({ name: i.name, quantity: i.quantity, price: i.price }))
        });
      }

      for (const item of cart) {
        const product = inventory.find((p: any) => p.id === item.id);
        if (product) {
          updateDoc(doc(db, 'inventory', item.id), { 
            quantity: Math.max(0, (product.quantity || 0) - item.quantity) 
          });
        }
      }

      toast({ title: "Venta Institucional Procesada", description: `Notificación enviada a ${targetEmail || 'sin correo'}` });
      setCart([]);
      setDocNumber('');
      setBillingConcept('');
      setCustomerName('');
      setCustomerEmail('');
      setSelectedProjectId('');
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo registrar la venta." });
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredInventory = useMemo(() => {
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background p-4 md:p-6 transition-colors duration-300">
      <div className="max-w-7xl mx-auto flex items-center justify-between mb-8 print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="rounded-full bg-white dark:bg-card shadow-sm border" onClick={() => router.push('/')}>
            <ArrowLeft className="text-slate-600 dark:text-foreground" size={20} />
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-foreground font-headline">NexWay Institucional</h1>
            <p className="text-slate-500 dark:text-muted-foreground text-xs md:text-sm">Control avanzado de proyectos y envío de DTE</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto print:hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white dark:bg-card p-1 rounded-2xl shadow-sm border h-auto flex-wrap w-full justify-start overflow-x-auto no-scrollbar">
            <TabsTrigger value="billing" className="rounded-xl px-4 md:px-6 py-2 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs whitespace-nowrap">
              <Receipt size={14} className="mr-2"/> Venta Inst.
            </TabsTrigger>
            <TabsTrigger value="projects" className="rounded-xl px-4 md:px-6 py-2 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs whitespace-nowrap">
              <Briefcase size={14} className="mr-2"/> Proyectos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="billing" className="grid grid-cols-1 lg:grid-cols-12 gap-6 outline-none">
             <div className="lg:col-span-5 space-y-4">
                <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white dark:bg-card border">
                  <CardHeader className="bg-slate-900 dark:bg-slate-950 text-white p-5">
                    <CardTitle className="text-base font-bold">Terminal Institucional</CardTitle>
                    <p className="text-4xl font-black text-blue-400">${totalCart.toFixed(2)}</p>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[300px]">
                       <Table>
                          <TableBody>
                            {cart.length === 0 ? (
                               <TableRow><TableCell colSpan={3} className="text-center py-20 text-muted-foreground text-xs italic">Agregue suministros para facturar</TableCell></TableRow>
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
                  </CardContent>
                </Card>
                <Button className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black shadow-xl" onClick={handleFinalizeSale} disabled={isProcessing}>
                   {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <Receipt className="mr-2" />}
                   FACTURAR Y ENVIAR
                </Button>
             </div>
             <div className="lg:col-span-7 space-y-4">
                <Card className="p-4 bg-white dark:bg-card rounded-2xl border space-y-4">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                         <Label className="text-[10px] font-bold uppercase text-muted-foreground">No. Factura / CCF</Label>
                         <Input value={docNumber} onChange={e => setDocNumber(e.target.value)} className="bg-muted border-none h-10 rounded-xl" placeholder="000-000..." />
                      </div>
                      <div className="space-y-1">
                         <Label className="text-[10px] font-bold uppercase text-muted-foreground">Asignar Proyecto</Label>
                         <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                            <SelectTrigger className="bg-muted border-none h-10 rounded-xl"><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                            <SelectContent>{projects?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                         </Select>
                      </div>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                         <Label className="text-[10px] font-bold uppercase text-muted-foreground">Cliente Receptor</Label>
                         <div className="flex gap-2">
                            <Input value={customerName} onChange={e => setCustomerName(e.target.value)} className="bg-muted border-none h-10 rounded-xl font-bold" placeholder="Nombre..." />
                            <Popover>
                               <PopoverTrigger asChild><Button variant="outline" className="h-10 rounded-xl px-3"><User size={16}/></Button></PopoverTrigger>
                               <PopoverContent className="w-80 p-0" align="end">
                                  <div className="p-3 border-b"><Input placeholder="Buscar cliente..." value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} className="h-8 text-xs" /></div>
                                  <ScrollArea className="h-48">
                                     {filteredCustomers.map(c => (
                                        <div key={c.id} onClick={() => { setCustomerName(c.name); setCustomerEmail(c.email || ''); }} className="p-3 hover:bg-muted cursor-pointer border-b">
                                           <p className="text-[11px] font-bold">{c.name}</p>
                                           <p className="text-[9px] text-muted-foreground">{c.email}</p>
                                        </div>
                                     ))}
                                  </ScrollArea>
                               </PopoverContent>
                            </Popover>
                         </div>
                      </div>
                      <div className="space-y-1">
                         <Label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1"><Mail size={12}/> Correo Notificación</Label>
                         <Input value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} className="bg-muted border-none h-10 rounded-xl text-xs" placeholder={cashConfig?.catchAllEmail || "correo@ejemplo.com"} />
                      </div>
                   </div>
                   <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground">Concepto Institucional</Label>
                      <Input value={billingConcept} onChange={e => setBillingConcept(e.target.value)} className="bg-muted border-none h-10 rounded-xl" placeholder="Ej: Pago de primer hito de suministro..." />
                   </div>
                </Card>

                <div className="relative">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                   <Input placeholder="Buscar suministros..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 h-12 bg-white dark:bg-card border-none shadow-sm rounded-2xl" />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                   {filteredInventory.slice(0, 12).map(p => (
                     <div key={p.id} onClick={() => setCart([...cart, { ...p, quantity: 1 }])} className="p-3 bg-white dark:bg-card rounded-xl border border-border hover:border-blue-500 cursor-pointer transition-all flex flex-col justify-between aspect-square">
                        <p className="text-[9px] font-mono text-muted-foreground">{p.sku}</p>
                        <h4 className="text-[11px] font-bold leading-tight line-clamp-2 h-7">{p.name}</h4>
                        <div className="mt-2 pt-2 border-t flex justify-between items-center">
                           <span className="font-black text-blue-600">${p.price}</span>
                           <PlusCircle size={14} className="text-blue-500" />
                        </div>
                     </div>
                   ))}
                </div>
             </div>
          </TabsContent>
          {/* Resto de pestañas permanecen iguales */}
        </Tabs>
      </div>
    </div>
  );
}
