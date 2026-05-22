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
  CheckCircle
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
import { useFirestore, useCollection } from '@/firebase';
import { collection, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

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

  // States
  const [activeTab, setActiveTab] = useState('billing');
  const [searchTerm, setSearchTerm] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [docNumber, setDocNumber] = useState('');
  const [billingConcept, setBillingConcept] = useState(''); 
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // States for New Project
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [newProject, setNewProject] = useState({ 
    name: '', 
    description: '', 
    customerId: '', 
    purchaseOrder: '', 
    totalBudget: '' 
  });
  const [projectCart, setProjectCart] = useState<CartItem[]>([]);
  const [projectDocs, setProjectDocs] = useState<ProjectDocument[]>([]);
  const [projectSearchTerm, setProjectSearchTerm] = useState('');

  // States for Consolidation
  const [consolidationProjectId, setConsolidationProjectId] = useState<string>('');

  const purchaseFileInputRef = useRef<HTMLInputElement>(null);
  const docUploadRef = useRef<HTMLInputElement>(null);

  // Calculations
  const totalCart = useMemo(() => cart.reduce((acc, item) => acc + (item.price * item.quantity), 0), [cart]);
  const projectTotalCart = useMemo(() => projectCart.reduce((acc, item) => acc + (item.price * item.quantity), 0), [projectCart]);

  // Consolidation Logic
  const selectedProjectData = useMemo(() => {
    return projects?.find(p => p.id === consolidationProjectId);
  }, [projects, consolidationProjectId]);

  const projectSummary = useMemo(() => {
    if (!consolidationProjectId) return null;
    const projectSales = allSales?.filter(s => s.projectId === consolidationProjectId) || [];
    const projectPurchases = allPurchases?.filter(p => p.projectId === consolidationProjectId) || [];
    
    const totalSold = projectSales.reduce((acc, s) => acc + (s.total || 0), 0);
    const totalCost = projectPurchases.reduce((acc, p) => acc + (p.total || 0), 0);
    const profit = totalSold - totalCost;
    
    return { totalSold, totalCost, profit, sales: projectSales, purchases: projectPurchases };
  }, [consolidationProjectId, allSales, allPurchases]);

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

  // Libro Mayor Logic
  const ledgerEntries = useMemo(() => {
    const entries = [
      ...(allSales?.map(s => ({ ...s, type: 'VENTA', amount: s.total, label: 'Ingreso' })) || []),
      ...(allPurchases?.map(p => ({ ...p, type: 'COMPRA', amount: -p.total, label: 'Egreso' })) || [])
    ];
    return entries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [allSales, allPurchases]);

  const addToCart = (product: any, isProject = false) => {
    const targetSet = isProject ? setProjectCart : setCart;
    targetSet(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { id: product.id, sku: product.sku, name: product.name, price: product.price || 0, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string, isProject = false) => {
    const targetSet = isProject ? setProjectCart : setCart;
    targetSet(prev => prev.filter(item => item.id !== id));
  };
  
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

      await addDoc(salesRef, {
        projectId: selectedProjectId || null,
        docNumber,
        total: totalCart,
        date: new Date().toISOString().split('T')[0],
        items: finalItemsDetail,
        cartItems: cart,
        concept: billingConcept || null,
        customerName,
        status: 'COMPLETADA',
        createdAt: new Date().toISOString()
      });

      for (const item of cart) {
        const product = inventory.find((p: any) => p.id === item.id);
        if (product) {
          updateDoc(doc(db, 'inventory', item.id), { 
            quantity: Math.max(0, (product.quantity || 0) - item.quantity) 
          });
        }
      }

      toast({ title: "Factura Institucional Emitida", description: "Se ha registrado la venta exitosamente." });
      setCart([]);
      setDocNumber('');
      setBillingConcept('');
      setCustomerName('');
      setSelectedProjectId('');
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo registrar la venta." });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateProject = async () => {
    if (!newProject.name || !newProject.customerId) {
      toast({ variant: "destructive", title: "Campos incompletos", description: "Nombre y Cliente son obligatorios." });
      return;
    }
    setIsProcessing(true);
    try {
      await addDoc(projectsRef, {
        ...newProject,
        totalBudget: parseFloat(newProject.totalBudget) || projectTotalCart,
        items: projectCart,
        documents: projectDocs,
        customerName: customers?.find(c => c.id === newProject.customerId)?.name || 'Cliente Externo',
        status: 'ACTIVO',
        createdAt: new Date().toISOString()
      });
      toast({ title: "Proyecto Creado", description: "El expediente ha sido abierto." });
      setIsNewProjectOpen(false);
      setNewProject({ name: '', description: '', customerId: '', purchaseOrder: '', totalBudget: '' });
      setProjectCart([]);
      setProjectDocs([]);
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo crear el proyecto." });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!confirm('¿Confirma que desea eliminar este expediente?')) return;
    try {
      await deleteDoc(doc(db, 'institutional_projects', id));
      toast({ title: "Proyecto Eliminado" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al eliminar" });
    }
  };

  const handleMarkAsDelivered = async (id: string) => {
    try {
      await updateDoc(doc(db, 'institutional_projects', id), { status: 'FINALIZADO' });
      toast({ title: "Proyecto Finalizado", description: "El estado ha sido actualizado a Entregado." });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al actualizar estado" });
    }
  };

  const handleDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast({ variant: "destructive", title: "Formato no permitido", description: "Solo se permiten archivos PDF." });
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setProjectDocs(prev => [...prev, {
        name: file.name,
        data: base64,
        type: file.type,
        date: new Date().toLocaleDateString()
      }]);
      toast({ title: "Documento Adjunto", description: `${file.name} guardado.` });
    };
    reader.readAsDataURL(file);
  };

  const handleImportCost = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.cuerpoDocumento) {
          const total = json.cuerpoDocumento.reduce((acc: number, item: any) => acc + (item.montoEntrega || item.precioUnitario * item.cantidad || 0), 0);
          
          await addDoc(purchasesRef, {
            projectId: selectedProjectId || null,
            docNumber: json.identificacion?.codigoGeneracion || 'COSTO-EXT',
            supplier: json.emisor?.nombre || 'Proveedor Hacienda',
            total,
            items: json.cuerpoDocumento.map((i: any) => `${i.cantidad} ${i.descripcion}`).join(', '),
            createdAt: new Date().toISOString()
          });

          toast({ title: "Carga de Costo Exitosa", description: `Se asignaron $${total.toFixed(2)} al proyecto.` });
        }
      } catch (err) {
        toast({ variant: "destructive", title: "JSON Inválido", description: "El archivo no cumple con el estándar DTE V3." });
      }
    };
    reader.readAsText(file);
  };

  const handlePrintConsolidation = () => {
    window.print();
  };

  const filteredProjects = useMemo(() => {
    if (!projects) return [];
    return projects.filter(p => 
      p.name.toLowerCase().includes(projectSearchTerm.toLowerCase()) || 
      p.purchaseOrder?.toLowerCase().includes(projectSearchTerm.toLowerCase())
    );
  }, [projectSearchTerm, projects]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background p-4 md:p-6 transition-colors duration-300">
      {/* HEADER PRINT HIDDEN */}
      <div className="max-w-7xl mx-auto flex items-center justify-between mb-8 print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="rounded-full bg-white dark:bg-card shadow-sm border" onClick={() => router.push('/')}>
            <ArrowLeft className="text-slate-600 dark:text-foreground" size={20} />
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-foreground font-headline">NexWay Institucional</h1>
            <p className="text-slate-500 dark:text-muted-foreground text-xs md:text-sm">Control avanzado de proyectos, márgenes y consolidación</p>
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
            <TabsTrigger value="costs" className="rounded-xl px-4 md:px-6 py-2 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs whitespace-nowrap">
              <FileUp size={14} className="mr-2"/> Cargar Costos
            </TabsTrigger>
            <TabsTrigger value="consolidation" className="rounded-xl px-4 md:px-6 py-2 font-bold data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-xs whitespace-nowrap">
              <PieChart size={14} className="mr-2"/> Consolidación
            </TabsTrigger>
            <TabsTrigger value="ledger" className="rounded-xl px-4 md:px-6 py-2 font-bold data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-xs whitespace-nowrap">
              <BookOpen size={14} className="mr-2"/> Libro Mayor
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
                                <TableCell><Button variant="ghost" size="icon" onClick={() => removeFromCart(item.id)}><Trash2 size={12}/></Button></TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                       </Table>
                    </ScrollArea>
                  </CardContent>
                </Card>
                <Button className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black shadow-xl" onClick={handleFinalizeSale} disabled={isProcessing}>
                   {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <Receipt className="mr-2" />}
                   FACTURAR PROYECTO
                </Button>
             </div>
             <div className="lg:col-span-7 space-y-4">
                <Card className="p-4 bg-white dark:bg-card rounded-2xl border space-y-4">
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                      <div className="space-y-1">
                         <Label className="text-[10px] font-bold uppercase text-muted-foreground">Cliente Receptor</Label>
                         <div className="flex gap-2">
                            <Input value={customerName} onChange={e => setCustomerName(e.target.value)} className="bg-muted border-none h-10 rounded-xl" placeholder="Nombre..." />
                            <Popover>
                               <PopoverTrigger asChild><Button variant="outline" className="h-10 rounded-xl px-3"><User size={16}/></Button></PopoverTrigger>
                               <PopoverContent className="w-80 p-0" align="end">
                                  <div className="p-3 border-b"><Input placeholder="Buscar cliente..." value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} className="h-8 text-xs" /></div>
                                  <ScrollArea className="h-48">
                                     {filteredCustomers.map(c => (
                                        <div key={c.id} onClick={() => setCustomerName(c.name)} className="p-3 hover:bg-muted cursor-pointer text-[11px] font-bold border-b">{c.name}</div>
                                     ))}
                                  </ScrollArea>
                               </PopoverContent>
                            </Popover>
                         </div>
                      </div>
                   </div>
                   <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground">Concepto Institucional (Opcional)</Label>
                      <Input value={billingConcept} onChange={e => setBillingConcept(e.target.value)} className="bg-muted border-none h-10 rounded-xl" placeholder="Ej: Pago de primer hito de suministro..." />
                   </div>
                </Card>

                <div className="relative">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                   <Input placeholder="Buscar suministros..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 h-12 bg-white dark:bg-card border-none shadow-sm rounded-2xl" />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                   {filteredInventory.slice(0, 12).map(p => (
                     <div key={p.id} onClick={() => addToCart(p)} className="p-3 bg-white dark:bg-card rounded-xl border border-border hover:border-blue-500 cursor-pointer transition-all flex flex-col justify-between aspect-square">
                        <p className="text-[9px] font-mono text-muted-foreground">{p.sku}</p>
                        <h4 className="text-[11px] font-bold leading-tight line-clamp-2 h-7">{p.name}</h4>
                        <div className="mt-2 pt-2 border-t flex justify-between items-center">
                           <span className="font-black text-blue-600">${p.price}</span>
                           <Plus size={14} className="text-muted-foreground" />
                        </div>
                     </div>
                   ))}
                </div>
             </div>
          </TabsContent>

          <TabsContent value="projects" className="space-y-4 outline-none">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="relative w-full md:w-80">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                   <Input placeholder="Buscar por OC o nombre..." value={projectSearchTerm} onChange={e => setProjectSearchTerm(e.target.value)} className="pl-10 h-10 bg-white dark:bg-card border-none rounded-xl shadow-sm" />
                </div>
                <Button className="w-full md:w-auto h-11 bg-blue-600 text-white font-bold rounded-xl shadow-lg" onClick={() => setIsNewProjectOpen(true)}>
                   <Plus size={18} className="mr-2" /> APERTURA DE EXPEDIENTE
                </Button>
             </div>

             <Card className="border shadow-sm rounded-3xl bg-white dark:bg-card overflow-hidden">
                <Table>
                   <TableHeader className="bg-slate-50 dark:bg-muted/50">
                      <TableRow>
                         <TableHead className="px-6 text-[10px] uppercase font-black">Proyecto / Orden de Compra</TableHead>
                         <TableHead className="text-[10px] uppercase font-black">Cliente</TableHead>
                         <TableHead className="text-[10px] uppercase font-black text-right">Presupuesto</TableHead>
                         <TableHead className="text-[10px] uppercase font-black text-center">Estado</TableHead>
                         <TableHead className="text-right px-6 text-[10px] uppercase font-black">Acciones</TableHead>
                      </TableRow>
                   </TableHeader>
                   <TableBody>
                      {loadingProjects ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-20"><Loader2 className="animate-spin mx-auto text-blue-600" /></TableCell></TableRow>
                      ) : filteredProjects.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-20 text-muted-foreground italic">No hay proyectos activos registrados</TableCell></TableRow>
                      ) : filteredProjects.map(p => (
                        <TableRow key={p.id} className="hover:bg-slate-50/50">
                           <TableCell className="px-6 py-4">
                              <div className="flex flex-col">
                                 <span className="font-bold text-xs">{p.name}</span>
                                 <span className="text-[10px] font-mono text-muted-foreground uppercase">{p.purchaseOrder || 'Sin OC'}</span>
                              </div>
                           </TableCell>
                           <TableCell className="text-xs font-medium">{p.customerName}</TableCell>
                           <TableCell className="text-right font-black text-blue-600">${parseFloat(p.totalBudget || 0).toLocaleString()}</TableCell>
                           <TableCell className="text-center">
                              <Badge className={`text-[8px] font-black ${p.status === 'FINALIZADO' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                                 {p.status}
                              </Badge>
                           </TableCell>
                           <TableCell className="text-right px-6">
                              <div className="flex justify-end gap-2">
                                 <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-500" onClick={() => handleMarkAsDelivered(p.id)} disabled={p.status === 'FINALIZADO'}>
                                    <CheckCircle size={14} />
                                 </Button>
                                 <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500">
                                    <Edit3 size={14} />
                                 </Button>
                                 <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500" onClick={() => handleDeleteProject(p.id)}>
                                    <Trash2 size={14} />
                                 </Button>
                              </div>
                           </TableCell>
                        </TableRow>
                      ))}
                   </TableBody>
                </Table>
             </Card>
          </TabsContent>

          <TabsContent value="consolidation" className="space-y-6 outline-none">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
               <div className="flex-1 w-full max-w-md space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Analizar Proyecto</Label>
                  <Select value={consolidationProjectId} onValueChange={setConsolidationProjectId}>
                    <SelectTrigger className="h-12 bg-white dark:bg-card rounded-2xl border-none shadow-sm text-sm font-bold">
                      <SelectValue placeholder="Seleccione expediente..." />
                    </SelectTrigger>
                    <SelectContent>
                      {projects?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
               </div>
               {consolidationProjectId && (
                 <Button className="h-12 rounded-2xl bg-slate-900 text-white font-bold px-8 shadow-lg" onClick={handlePrintConsolidation}>
                   <Printer size={18} className="mr-2" /> IMPRIMIR COMPARATIVA
                 </Button>
               )}
            </div>

            {consolidationProjectId ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-4 space-y-6">
                  <Card className="border-none shadow-sm rounded-3xl bg-white dark:bg-card overflow-hidden border">
                    <CardHeader className="bg-emerald-600 text-white p-6">
                      <CardTitle className="text-lg font-bold">Balance de Proyecto</CardTitle>
                      <CardDescription className="text-emerald-100">{selectedProjectData?.name}</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-muted-foreground">Total Ventas (Ingreso)</span>
                          <span className="text-lg font-black text-emerald-600">${projectSummary?.totalSold.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-muted-foreground">Total Compras (Costo)</span>
                          <span className="text-lg font-black text-rose-500">-${projectSummary?.totalCost.toLocaleString()}</span>
                        </div>
                        <div className="pt-4 border-t border-dashed flex justify-between items-center">
                          <span className="text-base font-black">UTILIDAD NETA</span>
                          <span className={`text-2xl font-black ${projectSummary && projectSummary.profit >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
                            ${projectSummary?.profit.toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100 flex items-center gap-3">
                         <Scale className="text-blue-600" />
                         <div>
                            <p className="text-[10px] font-bold text-blue-800">Rendimiento</p>
                            <p className="text-xs font-black text-blue-600">
                              {(( (projectSummary?.profit || 0) / (projectSummary?.totalSold || 1) ) * 100).toFixed(2)}% de Margen
                            </p>
                         </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="lg:col-span-8 space-y-4">
                   <h3 className="text-sm font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                     <BarChart3 size={18} /> Comparativa Precios Compra vs Venta
                   </h3>
                   <Card className="border-none shadow-sm rounded-3xl bg-white dark:bg-card overflow-hidden border">
                      <Table>
                        <TableHeader className="bg-slate-50 dark:bg-muted/50">
                          <TableRow>
                            <TableHead className="text-[10px] uppercase font-black px-6">Tipo</TableHead>
                            <TableHead className="text-[10px] uppercase font-black">Documento</TableHead>
                            <TableHead className="text-[10px] uppercase font-black">Descripción / Concepto</TableHead>
                            <TableHead className="text-[10px] uppercase font-black text-right px-6">Monto</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {projectSummary?.purchases.map((p: any) => (
                            <TableRow key={p.id} className="bg-rose-50/20">
                              <TableCell className="px-6"><Badge className="bg-rose-100 text-rose-600 text-[8px]">COSTO</Badge></TableCell>
                              <TableCell className="text-xs font-mono">{p.docNumber}</TableCell>
                              <TableCell className="text-xs">{p.items || 'Carga DTE'}</TableCell>
                              <TableCell className="text-right px-6 font-black text-rose-500">-${p.total.toFixed(2)}</TableCell>
                            </TableRow>
                          ))}
                          {projectSummary?.sales.map((s: any) => (
                            <TableRow key={s.id} className="bg-emerald-50/20">
                              <TableCell className="px-6"><Badge className="bg-emerald-100 text-emerald-600 text-[8px]">VENTA</Badge></TableCell>
                              <TableCell className="text-xs font-mono">{s.docNumber}</TableCell>
                              <TableCell className="text-xs">{s.concept || 'Facturación Normal'}</TableCell>
                              <TableCell className="text-right px-6 font-black text-emerald-600">+${s.total.toFixed(2)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                   </Card>
                </div>
              </div>
            ) : (
              <div className="py-20 text-center bg-white dark:bg-card rounded-[2.5rem] border-2 border-dashed border-border">
                 <Scale size={48} className="mx-auto mb-4 text-muted-foreground opacity-20" />
                 <h2 className="text-lg font-bold text-muted-foreground">Seleccione un proyecto para ver el análisis de rentabilidad</h2>
              </div>
            )}
          </TabsContent>

          <TabsContent value="ledger" className="space-y-6 outline-none">
             <div className="flex justify-between items-center mb-2">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <BookOpen size={20} className="text-indigo-600" /> Libro Mayor Institucional
                </h2>
                <Badge variant="outline" className="text-[10px] font-black">{ledgerEntries.length} Movimientos</Badge>
             </div>
             <Card className="border-none shadow-sm rounded-3xl bg-white dark:bg-card overflow-hidden border">
                <Table>
                   <TableHeader className="bg-indigo-50 dark:bg-indigo-900/10">
                      <TableRow>
                         <TableHead className="px-6 text-[10px] uppercase font-black">Fecha</TableHead>
                         <TableHead className="text-[10px] uppercase font-black">Categoría</TableHead>
                         <TableHead className="text-[10px] uppercase font-black">Documento</TableHead>
                         <TableHead className="text-[10px] uppercase font-black">Beneficiario / Cliente</TableHead>
                         <TableHead className="text-right px-6 text-[10px] uppercase font-black">Monto Transacción</TableHead>
                      </TableRow>
                   </TableHeader>
                   <TableBody>
                      {ledgerEntries.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-20 text-muted-foreground italic">No hay registros en el libro mayor.</TableCell></TableRow>
                      ) : ledgerEntries.map((entry, idx) => (
                        <TableRow key={idx} className="hover:bg-slate-50 dark:hover:bg-muted/30">
                           <TableCell className="px-6 text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleDateString()}</TableCell>
                           <TableCell>
                              <Badge className={`text-[8px] font-black ${entry.type === 'VENTA' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                {entry.type}
                              </Badge>
                           </TableCell>
                           <TableCell className="font-mono text-[11px] font-bold">{entry.docNumber}</TableCell>
                           <TableCell className="text-xs font-medium">{entry.customerName || entry.supplier}</TableCell>
                           <TableCell className={`text-right px-6 font-black text-sm ${entry.amount > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {entry.amount > 0 ? '+' : ''}${entry.amount.toFixed(2)}
                           </TableCell>
                        </TableRow>
                      ))}
                   </TableBody>
                </Table>
             </Card>
          </TabsContent>

          <TabsContent value="costs" className="space-y-6 outline-none">
             <div className="max-w-2xl mx-auto">
                <Card className="border-none shadow-sm rounded-3xl bg-white dark:bg-card border overflow-hidden">
                   <CardHeader className="bg-blue-600 text-white p-6">
                      <CardTitle className="text-lg font-bold flex items-center gap-2"><FileUp size={20} /> Registrar Costo de Proyecto</CardTitle>
                      <CardDescription className="text-blue-100">Vincule compras de suministros a un expediente abierto</CardDescription>
                   </CardHeader>
                   <CardContent className="p-8 space-y-6">
                      <div className="space-y-4">
                         <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold uppercase">Asignar a Proyecto</Label>
                            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                               <SelectTrigger className="h-12 bg-muted border-none rounded-xl"><SelectValue placeholder="Seleccione proyecto..." /></SelectTrigger>
                               <SelectContent>{projects?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                            </Select>
                         </div>
                         <div className="border-2 border-dashed rounded-3xl p-10 flex flex-col items-center gap-4 bg-muted/20">
                            <FileCode size={32} className="text-blue-600" />
                            <div className="text-center">
                               <p className="text-sm font-bold">Cargar DTE V3 de Proveedor</p>
                               <p className="text-[10px] text-muted-foreground">Importación automática de montos y códigos</p>
                            </div>
                            <input type="file" ref={purchaseFileInputRef} className="hidden" accept=".json" onChange={handleImportCost} />
                            <Button variant="outline" className="rounded-xl border-blue-200" onClick={() => purchaseFileInputRef.current?.click()}>SELECCIONAR JSON</Button>
                         </div>
                      </div>
                   </CardContent>
                </Card>
             </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* CONSOLIDATION REPORT PRINT VIEW */}
      <div className="hidden print:block p-10 bg-white text-black font-sans">
        <div className="flex justify-between items-start border-b-4 border-black pb-6 mb-8">
           <div>
              <h1 className="text-3xl font-black uppercase">Reporte de Consolidación</h1>
              <p className="text-sm font-bold">Proyecto: {selectedProjectData?.name}</p>
              <p className="text-sm">Orden de Compra: {selectedProjectData?.purchaseOrder}</p>
           </div>
           <div className="text-right">
              <h2 className="text-xl font-black">NexWay Institucional</h2>
              <p className="text-xs">Fecha Reporte: {new Date().toLocaleDateString()}</p>
           </div>
        </div>

        <div className="grid grid-cols-3 gap-6 mb-10">
           <div className="p-4 border-2 border-black text-center">
              <p className="text-[10px] font-black uppercase">Ingreso Bruto (Ventas)</p>
              <p className="text-2xl font-black">${projectSummary?.totalSold.toLocaleString()}</p>
           </div>
           <div className="p-4 border-2 border-black text-center">
              <p className="text-[10px] font-black uppercase">Costo Directo (Compras)</p>
              <p className="text-2xl font-black">${projectSummary?.totalCost.toLocaleString()}</p>
           </div>
           <div className="p-4 bg-black text-white text-center">
              <p className="text-[10px] font-black uppercase">Utilidad Neta</p>
              <p className="text-2xl font-black">${projectSummary?.profit.toLocaleString()}</p>
           </div>
        </div>

        <h3 className="font-black border-b-2 border-black text-sm uppercase mb-4">Análisis Comparativo de Movimientos</h3>
        <table className="w-full text-[10px] border-collapse mb-10">
           <thead>
              <tr className="border-b-2 border-black">
                 <th className="text-left p-2">TIPO</th>
                 <th className="text-left p-2">DOCUMENTO</th>
                 <th className="text-left p-2">DETALLE</th>
                 <th className="text-right p-2">MONTO</th>
              </tr>
           </thead>
           <tbody>
              {projectSummary?.purchases.map((p: any) => (
                <tr key={p.id} className="border-b border-gray-200">
                   <td className="p-2 font-bold">COMPRA (COSTO)</td>
                   <td className="p-2">{p.docNumber}</td>
                   <td className="p-2">{p.items}</td>
                   <td className="p-2 text-right">-${p.total.toFixed(2)}</td>
                </tr>
              ))}
              {projectSummary?.sales.map((s: any) => (
                <tr key={s.id} className="border-b border-gray-200">
                   <td className="p-2 font-bold">VENTA (INGRESO)</td>
                   <td className="p-2">{s.docNumber}</td>
                   <td className="p-2">{s.concept || 'Suministro'}</td>
                   <td className="p-2 text-right">+${s.total.toFixed(2)}</td>
                </tr>
              ))}
           </tbody>
           <tfoot>
              <tr className="font-black text-base bg-gray-100">
                 <td colSpan={3} className="p-2 text-right">RESULTADO FINAL:</td>
                 <td className="p-2 text-right">${projectSummary?.profit.toFixed(2)}</td>
              </tr>
           </tfoot>
        </table>

        <div className="grid grid-cols-2 gap-20 text-center mt-20">
           <div className="border-t border-black pt-2">
              <p className="text-[10px] font-black uppercase">Responsable Institucional</p>
           </div>
           <div className="border-t border-black pt-2">
              <p className="text-[10px] font-black uppercase">Gerencia Financiera / Auditoría</p>
           </div>
        </div>
      </div>

      {/* NEW PROJECT MODAL */}
      <Dialog open={isNewProjectOpen} onOpenChange={setIsNewProjectOpen}>
        <DialogContent className="rounded-3xl max-w-4xl p-0 overflow-hidden border-none shadow-2xl bg-white dark:bg-card">
          <div className="grid grid-cols-1 lg:grid-cols-12 h-[90vh] lg:h-auto">
            <div className="lg:col-span-7 p-6 md:p-8 space-y-6 overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black flex items-center gap-2 text-foreground">
                  <FilePlus className="text-blue-600" size={28} /> Apertura de Proyecto
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">Gestión de licitaciones y ventas institucionales.</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase text-muted-foreground">Nombre del Proyecto</Label><Input placeholder="Proyecto..." value={newProject.name} onChange={e => setNewProject({...newProject, name: e.target.value})} className="h-10 bg-muted border-none rounded-xl" /></div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">Cliente Adjudicado</Label>
                  <Select value={newProject.customerId} onValueChange={v => setNewProject({...newProject, customerId: v})}>
                    <SelectTrigger className="h-10 bg-muted border-none rounded-xl"><SelectValue placeholder="Cliente..." /></SelectTrigger>
                    <SelectContent>{customers?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase text-muted-foreground">Orden de Compra / Contrato</Label><Input placeholder="OC-..." value={newProject.purchaseOrder} onChange={e => setNewProject({...newProject, purchaseOrder: e.target.value})} className="h-10 bg-muted border-none rounded-xl" /></div>
                <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase text-muted-foreground">Presupuesto Adjudicado ($)</Label><Input type="number" value={newProject.totalBudget} onChange={e => setNewProject({...newProject, totalBudget: e.target.value})} className="h-10 bg-muted border-none rounded-xl font-black text-blue-600" /></div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Expediente (Documentos PDF)</Label>
                <input type="file" ref={docUploadRef} className="hidden" accept=".pdf" onChange={handleDocumentUpload} />
                <Button variant="outline" className="w-full h-12 rounded-xl border-dashed border-border" onClick={() => docUploadRef.current?.click()}>
                   <Paperclip className="mr-2" /> Adjuntar Documentación Técnica
                </Button>
                {projectDocs.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {projectDocs.map((d, i) => (
                      <div key={i} className="flex justify-between items-center p-2 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-100">
                         <span className="text-[10px] font-bold text-blue-700 truncate max-w-[200px]">{d.name}</span>
                         <Badge className="bg-blue-100 text-blue-600 text-[8px]">{d.date}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="lg:col-span-5 bg-slate-50 dark:bg-slate-900/50 p-6 md:p-8 flex flex-col border-l">
               <div className="flex justify-between items-center mb-4">
                  <h4 className="text-sm font-black uppercase text-foreground">Suministros Comprometidos</h4>
                  <Badge variant="outline" className="text-[9px] font-black">{projectCart.length} Ítems</Badge>
               </div>
               <ScrollArea className="flex-1 bg-white dark:bg-black/20 rounded-2xl p-4 border border-border/50 mb-6">
                  {projectCart.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground text-center py-10 italic">No hay suministros seleccionados en la oferta</p>
                  ) : projectCart.map(item => (
                    <div key={item.id} className="flex justify-between items-center py-2 border-b border-border/50">
                       <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-foreground">{item.quantity}x {item.name}</span>
                          <span className="text-[9px] text-muted-foreground">${item.price} c/u</span>
                       </div>
                       <Button variant="ghost" size="icon" onClick={() => removeFromCart(item.id, true)} className="h-7 w-7 text-slate-300 hover:text-rose-500">
                          <Trash2 size={12}/>
                       </Button>
                    </div>
                  ))}
               </ScrollArea>
               <Button className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-lg" onClick={handleCreateProject} disabled={isProcessing}>
                  {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <FilePlus className="mr-2" />}
                  ABRIR EXPEDIENTE
               </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
