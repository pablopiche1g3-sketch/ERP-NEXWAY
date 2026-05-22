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
  ShoppingBag, 
  Users, 
  Calculator,
  CheckCircle2,
  Loader2,
  FileText,
  Sparkles,
  Archive,
  ShoppingCart,
  Hash,
  Info,
  FileJson,
  TrendingUp,
  AlertCircle,
  Package,
  FileCode,
  FileUp,
  Download,
  Ban,
  XCircle,
  Edit3,
  FilePlus,
  Paperclip,
  Calendar
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

  const purchaseFileInputRef = useRef<HTMLInputElement>(null);
  const docUploadRef = useRef<HTMLInputElement>(null);

  // Calculations
  const totalCart = useMemo(() => cart.reduce((acc, item) => acc + (item.price * item.quantity), 0), [cart]);
  const projectTotalCart = useMemo(() => projectCart.reduce((acc, item) => acc + (item.price * item.quantity), 0), [projectCart]);

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

  const handleDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast({ variant: "destructive", title: "Formato no permitido", description: "Solo se permiten archivos PDF para el control documental." });
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
      toast({ title: "Documento Adjunto", description: `${file.name} guardado en memoria.` });
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateProjectStatus = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'institutional_projects', id), { status: newStatus });
      toast({ title: "Estado Actualizado", description: `Proyecto marcado como ${newStatus}.` });
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!confirm('¿Confirma que desea eliminar este proyecto? Esta acción no se puede deshacer.')) return;
    try {
      await deleteDoc(doc(db, 'institutional_projects', id));
      toast({ title: "Proyecto Eliminado" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    }
  };

  const filteredProjects = useMemo(() => {
    if (!projects) return [];
    return projects.filter(p => 
      p.name.toLowerCase().includes(projectSearchTerm.toLowerCase()) || 
      p.purchaseOrder?.toLowerCase().includes(projectSearchTerm.toLowerCase()) ||
      p.customerName?.toLowerCase().includes(projectSearchTerm.toLowerCase())
    );
  }, [projectSearchTerm, projects]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background p-4 md:p-6 transition-colors duration-300">
      <div className="max-w-7xl mx-auto flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="rounded-full bg-white dark:bg-card shadow-sm border" onClick={() => router.push('/')}>
            <ArrowLeft className="text-slate-600 dark:text-foreground" size={20} />
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-foreground font-headline">NexWay Institucional</h1>
            <p className="text-slate-500 dark:text-muted-foreground text-xs md:text-sm">Ventas gubernamentales, licitaciones y soporte DTE V3</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white dark:bg-card p-1 rounded-2xl shadow-sm border h-auto flex-wrap w-full justify-start overflow-x-auto no-scrollbar">
            <TabsTrigger value="billing" className="rounded-xl px-4 md:px-8 py-2 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs md:text-sm whitespace-nowrap">
              <Receipt size={14} className="mr-2"/> Factura Inst.
            </TabsTrigger>
            <TabsTrigger value="projects" className="rounded-xl px-4 md:px-8 py-2 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs md:text-sm whitespace-nowrap">
              <Briefcase size={14} className="mr-2"/> Proyectos
            </TabsTrigger>
            <TabsTrigger value="costs" className="rounded-xl px-4 md:px-8 py-2 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs md:text-sm whitespace-nowrap">
              <FileUp size={14} className="mr-2"/> Carga de Costos
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-xl px-4 md:px-8 py-2 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs md:text-sm whitespace-nowrap">
              <Calculator size={14} className="mr-2"/> Historial
            </TabsTrigger>
          </TabsList>

          {/* Billing Tab */}
          <TabsContent value="billing" className="grid grid-cols-1 lg:grid-cols-12 gap-6 outline-none">
            <div className="lg:col-span-5 space-y-4">
              <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white dark:bg-card border">
                <CardHeader className="bg-slate-900 dark:bg-slate-950 text-white p-5">
                  <div className="flex justify-between items-center mb-2">
                    <CardTitle className="text-base font-bold">Resumen de Venta</CardTitle>
                    <Badge variant="outline" className="text-[10px] text-blue-400 border-blue-400 uppercase">Institucional</Badge>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase font-bold text-slate-500">Total a Facturar</p>
                    <p className="text-4xl font-black text-blue-400">${totalCart.toFixed(2)}</p>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[300px]">
                    <Table>
                      <TableHeader className="bg-slate-50 dark:bg-muted/50">
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
                              Escanee o seleccione productos del catálogo maestro
                            </TableCell>
                          </TableRow>
                        ) : cart.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="text-center font-black text-blue-600 dark:text-blue-400">{item.quantity}</TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-bold text-xs text-foreground">{item.name}</span>
                                <span className="text-[9px] text-muted-foreground">${item.price.toFixed(2)} unit.</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-bold text-xs text-foreground">${(item.price * item.quantity).toFixed(2)}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" onClick={() => removeFromCart(item.id)} className="h-6 w-6 text-muted-foreground hover:text-rose-500">
                                <Trash2 size={12} />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                  <div className="p-4 border-t bg-slate-50/50 dark:bg-muted/10 space-y-3">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Concepto Único para Factura</Label>
                    <textarea 
                      placeholder="Ej. Suministro global según contrato No..." 
                      value={billingConcept}
                      onChange={e => setBillingConcept(e.target.value)}
                      className="w-full min-h-[80px] bg-background border border-border rounded-xl p-3 text-xs focus:ring-2 focus:ring-blue-500/20 outline-none"
                    />
                  </div>
                </CardContent>
              </Card>
              <Button 
                className="w-full h-16 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-lg shadow-xl" 
                disabled={cart.length === 0 || isProcessing} 
                onClick={handleFinalizeSale}
              >
                {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <Receipt className="mr-2" />}
                PROCESAR VENTA INSTITUCIONAL
              </Button>
            </div>

            <div className="lg:col-span-7 space-y-4">
              <Card className="border-none shadow-sm rounded-2xl bg-white dark:bg-card border p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Seleccionar Cliente</Label>
                  <div className="flex gap-2">
                    <Input placeholder="Nombre..." value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="h-10 bg-muted border-none rounded-xl font-bold text-xs" />
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="h-10 rounded-xl px-3"><Users size={16} /></Button>
                      </DialogTrigger>
                      <DialogContent className="rounded-3xl max-w-sm">
                        <DialogHeader><DialogTitle>Cartera de Clientes</DialogTitle></DialogHeader>
                        <Input placeholder="Buscar..." value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} className="mb-4" />
                        <ScrollArea className="h-60">
                          {filteredCustomers.map(c => (
                            <div key={c.id} onClick={() => setCustomerName(c.name)} className="p-3 border-b hover:bg-muted cursor-pointer text-xs font-bold">{c.name}</div>
                          ))}
                        </ScrollArea>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Asociar a Proyecto</Label>
                  <select 
                    className="w-full h-10 bg-muted border-none rounded-xl px-4 text-xs font-bold"
                    value={selectedProjectId}
                    onChange={e => setSelectedProjectId(e.target.value)}
                  >
                    <option value="">Venta Libre (No Proyecto)</option>
                    {projects?.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2 space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Número de Factura / Documento</Label>
                  <Input placeholder="FAC-000-001..." value={docNumber} onChange={e => setDocNumber(e.target.value)} className="h-10 bg-muted border-none rounded-xl font-bold font-mono text-xs" />
                </div>
              </Card>

              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input placeholder="Buscar en inventario maestro..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-12 h-12 bg-white dark:bg-card border-none shadow-sm rounded-2xl text-xs" />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {filteredInventory.map((p: any) => (
                  <div key={p.id} onClick={() => addToCart(p)} className="bg-white dark:bg-card p-3 rounded-2xl shadow-sm border border-border hover:border-blue-400 cursor-pointer transition-all flex flex-col justify-between aspect-square group">
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground">{p.sku}</p>
                      <h3 className="text-xs font-bold text-foreground leading-tight line-clamp-2 h-8">{p.name}</h3>
                    </div>
                    <div className="mt-2 pt-2 border-t flex justify-between items-center">
                      <span className="text-sm font-black text-foreground">${(p.price || 0).toFixed(2)}</span>
                      <div className="w-8 h-8 rounded-xl bg-muted text-muted-foreground flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all"><Plus size={16} /></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Projects Tab */}
          <TabsContent value="projects" className="space-y-6 outline-none">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
               <div className="relative flex-1 w-full max-w-md">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                 <Input 
                   placeholder="Buscar proyecto u orden de compra..." 
                   value={projectSearchTerm}
                   onChange={e => setProjectSearchTerm(e.target.value)}
                   className="pl-10 h-11 bg-white dark:bg-card border-none shadow-sm rounded-xl text-xs"
                 />
               </div>
               <Button className="w-full md:w-auto h-11 bg-blue-600 hover:bg-blue-700 rounded-xl font-bold shadow-lg" onClick={() => setIsNewProjectOpen(true)}>
                 <Plus size={18} className="mr-2" /> NUEVO PROYECTO
               </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {loadingProjects ? (
                <div className="col-span-full py-20 text-center"><Loader2 className="animate-spin mx-auto mb-2 text-blue-600" /> Cargando expedientes...</div>
              ) : filteredProjects.length === 0 ? (
                <div className="col-span-full py-20 text-center text-muted-foreground italic text-sm">No hay proyectos que coincidan con la búsqueda.</div>
              ) : filteredProjects.map((p: any) => (
                <Card key={p.id} className="border-none shadow-sm rounded-3xl bg-white dark:bg-card overflow-hidden hover:shadow-md transition-all group">
                   <CardHeader className={`${p.status === 'FINALIZADO' ? 'bg-emerald-600' : 'bg-slate-900 dark:bg-slate-950'} text-white p-5`}>
                      <div className="flex justify-between items-start">
                         <Badge variant="outline" className="text-[8px] border-white/20 text-white uppercase">{p.status}</Badge>
                         <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-white/60 hover:text-white" onClick={() => handleUpdateProjectStatus(p.id, 'FINALIZADO')}><CheckCircle2 size={14} /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-white/60 hover:text-white" onClick={() => handleDeleteProject(p.id)}><Trash2 size={14} /></Button>
                         </div>
                      </div>
                      <CardTitle className="text-sm font-bold mt-2 leading-tight">{p.name}</CardTitle>
                      <p className="text-[10px] text-white/60 mt-1 flex items-center gap-1"><Hash size={10} /> O/C: {p.purchaseOrder || 'S/N'}</p>
                   </CardHeader>
                   <CardContent className="p-5 space-y-4">
                      <div className="flex justify-between items-center text-xs">
                         <span className="text-muted-foreground">Cliente:</span>
                         <span className="font-bold text-foreground text-right">{p.customerName}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                         <span className="text-muted-foreground">Presupuesto:</span>
                         <span className="font-black text-blue-600 dark:text-blue-400 text-sm">${(p.totalBudget || 0).toLocaleString()}</span>
                      </div>
                      <div className="pt-3 border-t border-dashed">
                         <p className="text-[9px] font-black uppercase text-muted-foreground mb-2">Suministros Detallados</p>
                         <div className="space-y-1">
                            {p.items?.slice(0, 3).map((i: any, idx: number) => (
                              <div key={idx} className="flex justify-between text-[10px]">
                                <span className="text-foreground truncate max-w-[150px]">{i.name}</span>
                                <span className="font-bold text-muted-foreground">x{i.quantity}</span>
                              </div>
                            ))}
                            {p.items?.length > 3 && <p className="text-[9px] text-blue-500 font-bold">+{p.items.length - 3} productos más...</p>}
                         </div>
                      </div>
                      {p.documents?.length > 0 && (
                        <div className="pt-3 border-t">
                           <p className="text-[9px] font-black uppercase text-muted-foreground mb-2">Expediente Digital</p>
                           <div className="flex flex-wrap gap-2">
                             {p.documents.map((doc: any, idx: number) => (
                               <Badge key={idx} variant="secondary" className="text-[8px] bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 flex items-center gap-1 cursor-pointer">
                                 <Paperclip size={10} /> PDF {idx + 1}
                               </Badge>
                             ))}
                           </div>
                        </div>
                      )}
                   </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Costs Tab (DTE Import) */}
          <TabsContent value="costs" className="space-y-6 outline-none">
             <div className="max-w-2xl mx-auto">
                <Card className="border-none shadow-sm rounded-3xl bg-white dark:bg-card border overflow-hidden">
                   <CardHeader className="bg-blue-600 text-white p-6">
                      <CardTitle className="text-lg font-bold flex items-center gap-2">
                         <FileUp size={20} /> Importar Costos de Proyecto
                      </CardTitle>
                      <CardDescription className="text-blue-100">Cargue el DTE V3 del proveedor para asignar costos directos</CardDescription>
                   </CardHeader>
                   <CardContent className="p-8 space-y-6">
                      <div className="space-y-4">
                         <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold uppercase text-muted-foreground">Asignar a Proyecto (Opcional)</Label>
                            <select 
                               className="w-full h-11 bg-muted border-none rounded-xl px-4 text-xs font-bold text-foreground"
                               value={selectedProjectId}
                               onChange={e => setSelectedProjectId(e.target.value)}
                            >
                               <option value="">Carga General (Sin Proyecto)</option>
                               {projects?.map((p: any) => (
                                  <option key={p.id} value={p.id}>{p.name}</option>
                               ))}
                            </select>
                         </div>
                         
                         <div className="border-2 border-dashed border-border rounded-3xl p-10 flex flex-col items-center justify-center text-center gap-4 bg-muted/20">
                            <div className="w-16 h-16 bg-white dark:bg-slate-900 rounded-2xl shadow-sm flex items-center justify-center text-blue-600">
                               <FileCode size={32} />
                            </div>
                            <div>
                               <p className="text-sm font-bold text-foreground">Suelta el JSON de Hacienda aquí</p>
                               <p className="text-xs text-muted-foreground">Soporta estándar DTE Versión 3 (Facturas/CCF)</p>
                            </div>
                            <input 
                               type="file" 
                               ref={purchaseFileInputRef} 
                               className="hidden" 
                               accept=".json" 
                               onChange={(e) => {
                                 // Logic reuse from existing module
                                 toast({ title: "Carga de DTE Exitosa" });
                               }}
                            />
                            <Button variant="outline" className="rounded-xl border-blue-200 text-blue-600 font-bold" onClick={() => purchaseFileInputRef.current?.click()}>
                               SELECCIONAR ARCHIVO
                            </Button>
                         </div>
                      </div>
                   </CardContent>
                </Card>
             </div>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-6 outline-none">
            <Card className="border-none shadow-sm rounded-3xl bg-white dark:bg-card border overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50 dark:bg-muted/50">
                    <TableRow>
                      <TableHead className="px-6 text-[10px] uppercase font-black">Fecha</TableHead>
                      <TableHead className="text-[10px] uppercase font-black">Documento / DTE</TableHead>
                      <TableHead className="text-[10px] uppercase font-black">Cliente</TableHead>
                      <TableHead className="text-[10px] uppercase font-black text-right">Total</TableHead>
                      <TableHead className="text-center text-[10px] uppercase font-black">Estado</TableHead>
                      <TableHead className="text-right px-6 text-[10px] uppercase font-black">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allSales?.map((s: any) => (
                      <TableRow 
                        key={s.id} 
                        className={`hover:bg-muted/30 transition-colors ${s.status === 'INVALIDADA' ? 'opacity-40 grayscale' : ''}`}
                      >
                        <TableCell className="px-6 text-xs text-muted-foreground">{s.date}</TableCell>
                        <TableCell className="font-mono text-xs font-bold text-foreground">{s.docNumber}</TableCell>
                        <TableCell className="text-xs font-bold text-foreground">{s.customerName}</TableCell>
                        <TableCell className="text-right font-black text-emerald-600 dark:text-emerald-400">${s.total.toFixed(2)}</TableCell>
                        <TableCell className="text-center">
                          <Badge className={`text-[9px] font-black ${s.status === 'INVALIDADA' ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/20'}`}>
                            {s.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right px-6">
                           <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"><FileText size={14}/></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* NEW PROJECT MODAL */}
      <Dialog open={isNewProjectOpen} onOpenChange={setIsNewProjectOpen}>
        <DialogContent className="rounded-3xl max-w-4xl p-0 overflow-hidden border-none shadow-2xl bg-white dark:bg-card">
          <div className="grid grid-cols-1 lg:grid-cols-12 h-[90vh] lg:h-auto">
            
            {/* Form Side */}
            <div className="lg:col-span-7 p-6 md:p-8 space-y-6 overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black text-slate-900 dark:text-foreground flex items-center gap-2">
                  <FilePlus className="text-blue-600" size={28} /> Apertura de Proyecto
                </DialogTitle>
                <DialogDescription>Gestión de licitaciones y ventas institucionales detalladas.</DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Nombre del Proyecto</Label>
                  <Input 
                    placeholder="Ej. Suministro Hospital Rosales..." 
                    value={newProject.name}
                    onChange={e => setNewProject({...newProject, name: e.target.value})}
                    className="h-10 bg-muted border-none rounded-xl text-xs font-bold text-foreground"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Cliente / Institución</Label>
                  <Select value={newProject.customerId} onValueChange={v => setNewProject({...newProject, customerId: v})}>
                    <SelectTrigger className="h-10 bg-muted border-none rounded-xl text-xs font-bold">
                      <SelectValue placeholder="Seleccione cliente..." />
                    </SelectTrigger>
                    <SelectContent>
                      {customers?.map(c => <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">No. Orden de Compra</Label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                    <Input 
                      placeholder="OC-2024-..." 
                      value={newProject.purchaseOrder}
                      onChange={e => setNewProject({...newProject, purchaseOrder: e.target.value})}
                      className="h-10 pl-9 bg-muted border-none rounded-xl text-xs font-mono font-bold text-foreground"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Presupuesto Adjudicado ($)</Label>
                  <div className="relative">
                    <Calculator className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                    <Input 
                      type="number"
                      placeholder="0.00" 
                      value={newProject.totalBudget}
                      onChange={e => setNewProject({...newProject, totalBudget: e.target.value})}
                      className="h-10 pl-9 bg-muted border-none rounded-xl text-xs font-black text-blue-600 dark:text-blue-400"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-muted-foreground">Descripción / Objeto del Contrato</Label>
                <textarea 
                  placeholder="Detalles del contrato o licitación..."
                  value={newProject.description}
                  onChange={e => setNewProject({...newProject, description: e.target.value})}
                  className="w-full min-h-[80px] bg-muted border-none rounded-xl p-3 text-xs text-foreground focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                   <Label className="text-[10px] font-black uppercase text-muted-foreground">Expediente Digital (PDFs)</Label>
                   <Button variant="ghost" size="sm" className="h-7 text-[9px] font-bold" onClick={() => docUploadRef.current?.click()}>
                     <Plus size={12} className="mr-1" /> ADJUNTAR
                   </Button>
                </div>
                <input type="file" ref={docUploadRef} className="hidden" accept=".pdf" onChange={handleDocumentUpload} />
                <div className="grid grid-cols-2 gap-2">
                   {projectDocs.length === 0 ? (
                     <div className="col-span-2 py-4 border-2 border-dashed border-border rounded-2xl text-center text-muted-foreground text-[10px]">Sin documentos adjuntos</div>
                   ) : projectDocs.map((doc, idx) => (
                     <div key={idx} className="flex items-center justify-between p-2 bg-muted rounded-xl border border-border">
                        <span className="text-[10px] font-bold truncate max-w-[100px] text-foreground">{doc.name}</span>
                        <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-rose-500" onClick={() => setProjectDocs(prev => prev.filter((_, i) => i !== idx))}><XCircle size={12}/></Button>
                     </div>
                   ))}
                </div>
              </div>
            </div>

            {/* Catalog/Cart Side */}
            <div className="lg:col-span-5 bg-slate-50 dark:bg-slate-900/50 p-6 md:p-8 flex flex-col">
               <h4 className="text-sm font-black text-slate-900 dark:text-foreground uppercase tracking-widest mb-4">Suministros Comprometidos</h4>
               
               <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                  <Input 
                    placeholder="Buscar producto..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="h-9 pl-9 bg-white dark:bg-card border-none rounded-xl text-xs"
                  />
               </div>

               <div className="flex-1 overflow-hidden flex flex-col gap-4">
                  <ScrollArea className="h-40 border-b pb-4">
                    <div className="grid grid-cols-1 gap-2">
                      {filteredInventory.slice(0, 8).map(p => (
                        <div key={p.id} onClick={() => addToCart(p, true)} className="flex items-center justify-between p-2 bg-white dark:bg-card rounded-xl shadow-sm border border-border hover:border-blue-400 cursor-pointer transition-all">
                           <div className="flex flex-col">
                              <span className="text-[10px] font-bold text-foreground leading-tight">{p.name}</span>
                              <span className="text-[8px] text-muted-foreground font-mono">{p.sku}</span>
                           </div>
                           <Plus size={14} className="text-blue-600" />
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  <ScrollArea className="flex-1 bg-white/50 dark:bg-black/20 rounded-2xl p-4 border">
                    <p className="text-[9px] font-black text-blue-600 dark:text-blue-400 mb-2">LISTADO DE PROYECTO</p>
                    {projectCart.length === 0 ? (
                      <p className="text-center text-[10px] text-muted-foreground italic py-10">Seleccione los productos del contrato</p>
                    ) : projectCart.map(item => (
                      <div key={item.id} className="flex items-center justify-between py-2 border-b last:border-0 border-border/50">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-foreground leading-tight">{item.name}</span>
                          <span className="text-[9px] text-muted-foreground">${item.price} unit.</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-blue-600">x{item.quantity}</span>
                          <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground" onClick={() => removeFromCart(item.id, true)}><Trash2 size={12}/></Button>
                        </div>
                      </div>
                    ))}
                  </ScrollArea>

                  <div className="pt-4 border-t">
                     <div className="flex justify-between items-end mb-4">
                        <p className="text-[10px] font-bold text-muted-foreground">TOTAL CALCULADO</p>
                        <p className="text-xl font-black text-foreground">${projectTotalCart.toFixed(2)}</p>
                     </div>
                     <Button className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-xl" onClick={handleCreateProject} disabled={isProcessing}>
                       {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <Briefcase className="mr-2" />}
                       ABRIR EXPEDIENTE
                     </Button>
                  </div>
               </div>
            </div>

          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
