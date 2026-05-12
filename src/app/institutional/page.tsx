
'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  BarChart3,
  Box,
  ShoppingCart,
  Hash,
  Tag,
  Info,
  FileJson,
  Upload,
  DollarSign,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useFirestore, useCollection } from '@/firebase';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

interface CartItem {
  id: string;
  sku: string;
  name: string;
  price: number;
  quantity: number;
}

export default function InstitutionalProjectsPage() {
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  
  // Navigation States
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isClosingProject, setIsClosingProject] = useState(false);
  
  // Refs
  const purchaseFileInputRef = useRef<HTMLInputElement>(null);

  // Data Fetching
  const projectsRef = useMemo(() => collection(db, 'institutional_projects'), [db]);
  const customersRef = useMemo(() => collection(db, 'customers'), [db]);
  const suppliersRef = useMemo(() => collection(db, 'suppliers'), [db]);
  const inventoryRef = useMemo(() => collection(db, 'inventory'), [db]);
  
  const { data: projects, loading: loadingProjects } = useCollection<any>(projectsRef);
  const { data: customers } = useCollection<any>(customersRef);
  const { data: suppliers } = useCollection<any>(suppliersRef);
  const { data: inventory } = useCollection<any>(inventoryRef);

  // Sales and Purchases
  const salesRef = useMemo(() => collection(db, 'institutional_sales'), [db]);
  const purchasesRef = useMemo(() => collection(db, 'institutional_purchases'), [db]);
  
  const { data: allSales } = useCollection<any>(salesRef);
  const { data: allPurchases } = useCollection<any>(purchasesRef);

  // Selected Project Details
  const selectedProject = useMemo(() => 
    projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId]
  );

  const projectSales = useMemo(() => 
    allSales.filter(s => s.projectId === selectedProjectId), [allSales, selectedProjectId]
  );
  
  const projectPurchases = useMemo(() => 
    allPurchases.filter(p => p.projectId === selectedProjectId), [allPurchases, selectedProjectId]
  );

  const stats = useMemo(() => {
    const salesTotal = projectSales.reduce((acc, s) => acc + s.total, 0);
    const purchasesTotal = projectPurchases.reduce((acc, p) => acc + p.total, 0);
    return {
      sales: salesTotal,
      purchases: purchasesTotal,
      profit: salesTotal - purchasesTotal
    };
  }, [projectSales, projectPurchases]);

  // POS Style Billing States
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [docNumber, setDocNumber] = useState('');
  const [billingConcept, setBillingConcept] = useState(''); 
  const totalCart = useMemo(() => cart.reduce((acc, item) => acc + (item.price * item.quantity), 0), [cart]);

  const filteredInventory = useMemo(() => {
    if (!inventory) return [];
    return inventory.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.sku.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, inventory]);

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { id: product.id, sku: product.sku, name: product.name, price: product.price || 0, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => setCart(prev => prev.filter(item => item.id !== id));
  
  const updateCartPrice = (id: string, newPrice: number) => 
    setCart(prev => prev.map(item => item.id === id ? { ...item, price: newPrice } : item));
    
  const updateCartQty = (id: string, newQty: number) => 
    setCart(prev => prev.map(item => item.id === id ? { ...item, quantity: Math.max(1, newQty) } : item));

  // Forms
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', description: '', customerId: '' });
  
  const [isNewSaleOpen, setIsNewSaleOpen] = useState(false);
  const [isNewPurchaseOpen, setIsNewPurchaseOpen] = useState(false);
  const [newPurchase, setNewPurchase] = useState({ docNumber: '', total: '', supplierId: '', date: new Date().toISOString().split('T')[0], items: '' });

  // Actions
  const handleCreateProject = async () => {
    if (!newProject.name || !newProject.customerId) return;
    try {
      await addDoc(projectsRef, {
        ...newProject,
        customerName: customers.find(c => c.id === newProject.customerId)?.name || 'Cliente Desconocido',
        status: 'ACTIVO',
        createdAt: new Date().toISOString()
      });
      toast({ title: "Proyecto Creado", description: "Inicie la carga de facturas y compras." });
      setIsNewProjectOpen(false);
      setNewProject({ name: '', description: '', customerId: '' });
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo crear el proyecto." });
    }
  };

  const handleFinalizeSale = async () => {
    if (!selectedProjectId || cart.length === 0 || !docNumber) {
      toast({ variant: "destructive", title: "Datos Incompletos", description: "Asegúrese de tener productos y un número de documento." });
      return;
    }
    try {
      const finalItemsDetail = billingConcept 
        ? `${billingConcept} (Consolidado)`
        : cart.map(i => `${i.quantity} ${i.name} @ $${i.price}`).join(', ');

      await addDoc(salesRef, {
        projectId: selectedProjectId,
        docNumber,
        total: totalCart,
        date: new Date().toISOString().split('T')[0],
        items: finalItemsDetail,
        cartItems: cart,
        concept: billingConcept || null,
        createdAt: new Date().toISOString()
      });
      toast({ title: "Factura Institucional Guardada", description: "Venta añadida al proyecto correctamente." });
      setIsNewSaleOpen(false);
      setCart([]);
      setDocNumber('');
      setBillingConcept('');
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo registrar la venta." });
    }
  };

  const handleAddPurchase = async () => {
    if (!selectedProjectId || !newPurchase.total || !newPurchase.supplierId) return;
    try {
      await addDoc(purchasesRef, {
        projectId: selectedProjectId,
        ...newPurchase,
        supplierName: suppliers.find(s => s.id === newPurchase.supplierId)?.name || 'Proveedor Desconocido',
        total: parseFloat(newPurchase.total.toString()),
        createdAt: new Date().toISOString()
      });
      toast({ title: "Compra Registrada", description: "Gasto añadida al proyecto." });
      setIsNewPurchaseOpen(false);
      setNewPurchase({ docNumber: '', total: '', supplierId: '', date: new Date().toISOString().split('T')[0], items: '' });
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo registrar la compra." });
    }
  };

  const handleBulkPurchaseUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProjectId) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (Array.isArray(data)) {
          let count = 0;
          for (const item of data) {
            const supplierId = item.supplierId || (suppliers?.find((s: any) => s.name === item.supplierName)?.id) || '';
            const supplierName = item.supplierName || (suppliers?.find((s: any) => s.id === supplierId)?.name) || 'Proveedor Desconocido';
            
            await addDoc(purchasesRef, {
              projectId: selectedProjectId,
              docNumber: item.docNumber || 'CCF-S/N',
              total: parseFloat(item.total) || 0,
              supplierId: supplierId,
              supplierName: supplierName,
              date: item.date || new Date().toISOString().split('T')[0],
              items: item.items || 'Carga masiva por JSON',
              createdAt: new Date().toISOString()
            });
            count++;
          }
          toast({ title: "Carga Masiva Exitosa", description: `Se han registrado ${count} compras en el proyecto.` });
        }
      } catch (error) {
        toast({ variant: "destructive", title: "Error de Formato", description: "El archivo JSON no es válido o no tiene el formato esperado." });
      } finally {
        if (purchaseFileInputRef.current) purchaseFileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleCloseProject = async () => {
    if (!selectedProjectId) return;
    setIsClosingProject(true);
    try {
      await updateDoc(doc(db, 'institutional_projects', selectedProjectId), {
        status: 'FINALIZADO',
        closedAt: new Date().toISOString()
      });
      toast({ title: "Proyecto Finalizado", description: "El proyecto ha sido archivado con éxito." });
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo finalizar el proyecto." });
    } finally {
      setIsClosingProject(false);
    }
  };

  const handleLoadDemoData = async () => {
    setIsSeeding(true);
    try {
      const projectDoc = await addDoc(projectsRef, {
        name: 'Equipamiento Hospital Rosales 2024',
        customerName: 'Ministerio de Salud (MINSAL)',
        customerId: 'demo-minsal',
        description: 'Suministro e instalación de 50 camas UCI y 10 monitores de signos vitales de alta gama.',
        status: 'ACTIVO',
        createdAt: new Date().toISOString()
      });

      const pId = projectDoc.id;

      // Ventas iniciales (Licitación)
      const sales = [
        { docNumber: 'FAC-INST-001', total: 45000.00, date: '2024-03-01', items: 'Suministro de 30 Camas UCI Modelo X-500 según contrato Hospital Rosales' },
        { docNumber: 'FAC-INST-002', total: 32500.50, date: '2024-03-15', items: 'Instalación y puesta en marcha de equipos médicos UCI' }
      ];

      for (const s of sales) {
        await addDoc(salesRef, { ...s, projectId: pId, createdAt: new Date().toISOString() });
      }
      
      // Compras iniciales para el cuadre
      const purchases = [
        { docNumber: 'CCF-0982', total: 28000.00, supplierName: 'Importaciones Médicas S.A.', items: '30 Camas UCI X-500 (Costo Importación)', date: '2024-02-15' },
        { docNumber: 'CCF-0441', total: 5000.00, supplierName: 'Logística Global', items: 'Fletes y desaduanaje de equipos', date: '2024-02-20' }
      ];

      for (const p of purchases) {
        await addDoc(purchasesRef, { ...p, projectId: pId, createdAt: new Date().toISOString() });
      }

      toast({ title: "Proyecto Demo Cargado", description: "Se ha generado el proyecto con ingresos y costos base." });
      setSelectedProjectId(pId);
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo cargar el demo." });
    } finally {
      setIsSeeding(false);
    }
  };

  if (loadingProjects) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="rounded-full bg-white shadow-sm" onClick={() => selectedProjectId ? setSelectedProjectId(null) : router.push('/')}>
            <ArrowLeft className="text-slate-600" size={20} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 font-headline">NexWay Institucional</h1>
            <p className="text-slate-500 text-sm">Proyectos gubernamentales y corporativos de alto volumen</p>
          </div>
        </div>
        {!selectedProjectId && (
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-xl font-bold border-blue-200 text-blue-600 hover:bg-blue-50" onClick={handleLoadDemoData} disabled={isSeeding}>
              {isSeeding ? <Loader2 className="animate-spin mr-2" size={16} /> : <Sparkles className="mr-2" size={16} />}
              Ver Proyecto Demo
            </Button>
            <Button className="bg-blue-600 rounded-xl font-bold" onClick={() => setIsNewProjectOpen(true)}>
              <Plus className="mr-2" size={18} /> Nuevo Proyecto
            </Button>
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto">
        {!selectedProjectId ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.length === 0 ? (
              <Card className="col-span-full border-dashed p-20 flex flex-col items-center justify-center text-slate-400">
                <Briefcase size={48} className="mb-4 opacity-20" />
                <p className="mb-4 text-center font-bold">No hay proyectos institucionales registrados.</p>
                <div className="flex gap-4">
                  <Button variant="outline" className="rounded-xl font-bold" onClick={handleLoadDemoData}>Ver ejemplo detallado</Button>
                </div>
              </Card>
            ) : projects.map((p: any) => {
              const pSales = allSales.filter(s => s.projectId === p.id).reduce((acc, s) => acc + s.total, 0);
              const pPurchases = allPurchases.filter(pur => pur.projectId === p.id).reduce((acc, pur) => acc + pur.total, 0);
              const profit = pSales - pPurchases;

              return (
                <Card key={p.id} className="border-none shadow-sm rounded-3xl bg-white hover:shadow-md transition-all cursor-pointer group" onClick={() => setSelectedProjectId(p.id)}>
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <Briefcase size={20} />
                      </div>
                      <Badge variant={p.status === 'FINALIZADO' ? 'secondary' : 'outline'} className="text-[10px] font-black uppercase">
                        {p.status}
                      </Badge>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-1 line-clamp-1">{p.name}</h3>
                    <p className="text-xs text-slate-400 mb-4 flex items-center gap-1 font-medium">
                      <Building2 size={12} /> {p.customerName}
                    </p>
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                      <div>
                        <p className="text-[10px] font-black uppercase text-slate-400">Ventas</p>
                        <p className="text-sm font-bold text-emerald-600">${pSales.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase text-slate-400">Utilidad</p>
                        <p className={`text-sm font-bold ${profit >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>${profit.toLocaleString()}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            {/* Project Header Stats */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <Badge className="bg-blue-600 h-6 px-3">{selectedProject?.status}</Badge>
                <h2 className="text-xl font-bold text-slate-900 font-headline">{selectedProject?.name}</h2>
              </div>
              {selectedProject?.status !== 'FINALIZADO' && (
                <Button variant="outline" className="rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 font-bold" onClick={handleCloseProject} disabled={isClosingProject}>
                  {isClosingProject ? <Loader2 className="animate-spin mr-2" size={16} /> : <Archive className="mr-2" size={16} />}
                  Finalizar Proyecto
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-slate-900 text-white border-none rounded-3xl p-6">
                <p className="text-[10px] font-black uppercase opacity-60 tracking-widest">Total Facturado (Ventas)</p>
                <p className="text-2xl font-black text-emerald-400">${stats.sales.toLocaleString()}</p>
              </Card>
              <Card className="bg-white border-none shadow-sm rounded-3xl p-6">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Inversión Total (Compras)</p>
                <p className="text-2xl font-black text-rose-500">${stats.purchases.toLocaleString()}</p>
              </Card>
              <Card className="bg-blue-600 text-white border-none rounded-3xl p-6">
                <p className="text-[10px] font-black uppercase opacity-60 tracking-widest">Ganancia Neta</p>
                <p className="text-2xl font-black">${stats.profit.toLocaleString()}</p>
              </Card>
              <Card className="bg-white border-none shadow-sm rounded-3xl p-6 flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="text-emerald-500" size={16} />
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Rentabilidad</p>
                </div>
                <p className="text-2xl font-black text-slate-900">
                  {stats.sales > 0 ? ((stats.profit / stats.sales) * 100).toFixed(1) : '0'}%
                </p>
              </Card>
            </div>

            <Tabs defaultValue="billing" className="space-y-6">
              <TabsList className="bg-white p-1 rounded-2xl shadow-sm border border-slate-100 flex-wrap h-auto">
                <TabsTrigger value="billing" className="rounded-xl px-8 font-bold"><Receipt size={14} className="mr-2"/> Facturación Institucional</TabsTrigger>
                <TabsTrigger value="purchases" className="rounded-xl px-8 font-bold"><ShoppingBag size={14} className="mr-2"/> Registro de Compras</TabsTrigger>
                <TabsTrigger value="cuadre" className="rounded-xl px-8 font-bold"><Calculator size={14} className="mr-2"/> Cuadre de Rentabilidad</TabsTrigger>
                <TabsTrigger value="setup" className="rounded-xl px-8 font-bold"><FileText size={14} className="mr-2"/> Detalle Legal</TabsTrigger>
              </TabsList>

              <TabsContent value="billing" className="space-y-4">
                 <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between border-b px-6 py-4">
                       <CardTitle className="text-sm font-bold">Control de Ingresos Facturados</CardTitle>
                       <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-9 rounded-xl font-bold" onClick={() => setIsNewSaleOpen(true)} disabled={selectedProject?.status === 'FINALIZADO'}>
                          <Plus size={16} className="mr-2" /> Nueva Factura Institucional (POS)
                       </Button>
                    </CardHeader>
                    <Table>
                       <TableHeader className="bg-slate-50">
                          <TableRow>
                             <TableHead className="px-6 text-[10px] font-black uppercase">FECHA</TableHead>
                             <TableHead className="text-[10px] font-black uppercase">DOCUMENTO</TableHead>
                             <TableHead className="text-[10px] font-black uppercase">CONCEPTO O DETALLE</TableHead>
                             <TableHead className="text-right text-[10px] font-black uppercase pr-6">MONTO TOTAL</TableHead>
                          </TableRow>
                       </TableHeader>
                       <TableBody>
                          {projectSales.length === 0 ? (
                            <TableRow><TableCell colSpan={4} className="text-center py-20 text-slate-400 text-xs italic font-bold">No hay facturas emitidas para este proyecto.</TableCell></TableRow>
                          ) : projectSales.map((s: any) => (
                            <TableRow key={s.id}>
                               <TableCell className="px-6 text-xs text-slate-500 font-medium">{s.date}</TableCell>
                               <TableCell className="font-bold text-xs">{s.docNumber}</TableCell>
                               <TableCell className="text-xs text-slate-600 italic font-medium">
                                 {s.concept || s.items || 'Sin detalle'}
                               </TableCell>
                               <TableCell className="text-right pr-6 font-black text-emerald-600">${s.total.toLocaleString()}</TableCell>
                            </TableRow>
                          ))}
                       </TableBody>
                    </Table>
                 </Card>
              </TabsContent>

              <TabsContent value="purchases" className="space-y-4">
                 <div className="flex justify-end gap-2 mb-4">
                    <input 
                      type="file" 
                      ref={purchaseFileInputRef} 
                      onChange={handleBulkPurchaseUpload} 
                      className="hidden" 
                      accept=".json" 
                    />
                    <Button 
                      variant="outline" 
                      className="h-9 rounded-xl font-bold text-slate-600 border-slate-200" 
                      onClick={() => purchaseFileInputRef.current?.click()}
                      disabled={selectedProject?.status === 'FINALIZADO'}
                    >
                      <FileJson size={16} className="mr-2" /> Carga Masiva (JSON)
                    </Button>
                    <Button 
                      size="sm" 
                      className="bg-rose-600 hover:bg-rose-700 h-9 rounded-xl font-bold" 
                      onClick={() => setIsNewPurchaseOpen(true)} 
                      disabled={selectedProject?.status === 'FINALIZADO'}
                    >
                      <Plus size={16} className="mr-2" /> Registrar Compra Manual
                    </Button>
                 </div>
                 <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
                    <CardHeader className="bg-slate-50 border-b px-6 py-4">
                       <CardTitle className="text-sm font-bold text-slate-900">Registro de Inversión y Costos del Proyecto</CardTitle>
                    </CardHeader>
                    <Table>
                       <TableHeader className="bg-slate-50">
                          <TableRow>
                             <TableHead className="px-6 text-[10px] font-black uppercase">PROVEEDOR</TableHead>
                             <TableHead className="text-[10px] font-black uppercase">DOC.</TableHead>
                             <TableHead className="text-[10px] font-black uppercase">DETALLE DE COSTO</TableHead>
                             <TableHead className="text-right text-[10px] font-black uppercase pr-6">COSTO TOTAL</TableHead>
                          </TableRow>
                       </TableHeader>
                       <TableBody>
                          {projectPurchases.length === 0 ? (
                            <TableRow><TableCell colSpan={4} className="text-center py-20 text-slate-400 text-xs italic font-bold">No hay registros de compras.</TableCell></TableRow>
                          ) : projectPurchases.map((p: any) => (
                            <TableRow key={p.id}>
                               <TableCell className="px-6 text-xs font-bold">{p.supplierName}</TableCell>
                               <TableCell className="text-xs font-mono font-medium">{p.docNumber}</TableCell>
                               <TableCell className="text-xs text-slate-600 font-medium">{p.items || 'Sin detalle'}</TableCell>
                               <TableCell className="text-right pr-6 font-black text-rose-600">-${p.total.toLocaleString()}</TableCell>
                            </TableRow>
                          ))}
                       </TableBody>
                    </Table>
                 </Card>
              </TabsContent>

              <TabsContent value="cuadre" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="rounded-3xl border-none shadow-sm bg-white p-6">
                    <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                      <TrendingUp size={18} className="text-blue-600" /> Comparativa de Flujo Real
                    </h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-end border-b pb-2">
                        <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Facturado</span>
                        <span className="text-lg font-black text-emerald-600">${stats.sales.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-end border-b pb-2">
                        <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Inversión y Compras</span>
                        <span className="text-lg font-black text-rose-500">-${stats.purchases.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-end pt-2">
                        <span className="text-sm font-black uppercase">Ganancia Neta del Proyecto</span>
                        <span className="text-2xl font-black text-blue-600">${stats.profit.toLocaleString()}</span>
                      </div>
                    </div>
                  </Card>

                  <Card className={`rounded-3xl border-none shadow-sm p-8 flex flex-col justify-center text-center ${stats.profit >= 0 ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
                     <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        {stats.profit >= 0 ? <CheckCircle2 size={32} /> : <AlertCircle size={32} />}
                     </div>
                     <h3 className="text-xl font-bold mb-2">Cuadre de Proyecto</h3>
                     <p className="text-sm opacity-90 leading-relaxed font-medium">
                       {stats.profit >= 0 
                        ? 'El proyecto presenta una rentabilidad positiva. El balance entre facturación y costos es saludable.'
                        : 'El proyecto presenta un déficit. Los costos operativos han superado la facturación realizada hasta la fecha.'}
                     </p>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="setup" className="space-y-6">
                 <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
                    <CardHeader className="bg-slate-50 p-6 border-b">
                       <CardTitle className="text-base font-bold">Información del Contrato</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-4">
                             <div className="space-y-1">
                                <Label className="text-[10px] font-black uppercase text-slate-400">Nombre de Proyecto</Label>
                                <p className="text-lg font-bold text-slate-900">{selectedProject?.name}</p>
                             </div>
                             <div className="space-y-1">
                                <Label className="text-[10px] font-black uppercase text-slate-400">Cliente / Institución</Label>
                                <p className="text-sm font-bold text-slate-700">{selectedProject?.customerName}</p>
                             </div>
                             <div className="space-y-1">
                                <Label className="text-[10px] font-black uppercase text-slate-400">Alcance General</Label>
                                <p className="text-xs text-slate-500 leading-relaxed font-medium">{selectedProject?.description || 'Sin descripción.'}</p>
                             </div>
                          </div>
                          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 flex flex-col justify-center">
                             <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                                <Archive size={16} /> Estado del Ciclo
                             </h4>
                             <div className="space-y-3">
                                <div className="flex justify-between items-center text-xs">
                                   <span className="text-slate-500 font-bold uppercase tracking-wider">Creado el</span>
                                   <span className="font-bold">{new Date(selectedProject?.createdAt).toLocaleDateString()}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                   <span className="text-slate-500 font-bold uppercase tracking-wider">Estado Actual</span>
                                   <Badge variant={selectedProject?.status === 'FINALIZADO' ? 'secondary' : 'outline'} className="text-[10px] font-black">
                                      {selectedProject?.status}
                                   </Badge>
                                </div>
                             </div>
                             {selectedProject?.status !== 'FINALIZADO' && (
                               <Button className="w-full mt-6 bg-rose-600 hover:bg-rose-700 font-bold rounded-xl h-11 shadow-lg shadow-rose-200" onClick={handleCloseProject} disabled={isClosingProject}>
                                  FINALIZAR Y ARCHIVAR PROYECTO
                               </Button>
                             )}
                          </div>
                       </div>
                    </CardContent>
                 </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>

      {/* POS Style Billing Dialog */}
      <Dialog open={isNewSaleOpen} onOpenChange={setIsNewSaleOpen}>
        <DialogContent className="max-w-6xl w-[95vw] rounded-3xl p-0 overflow-hidden bg-slate-50 h-[90vh]">
          <div className="flex flex-col h-full">
            <div className="p-6 bg-emerald-600 text-white flex justify-between items-center">
              <div>
                <DialogTitle className="text-xl font-black uppercase">Facturación Institucional POS</DialogTitle>
                <DialogDescription className="text-emerald-100 font-bold">Proyecto: {selectedProject?.name}</DialogDescription>
              </div>
              <div className="bg-white/20 px-6 py-3 rounded-2xl border border-white/20">
                <p className="text-[10px] font-black uppercase opacity-60">Total Venta</p>
                <p className="text-2xl font-black">${totalCart.toFixed(2)}</p>
              </div>
            </div>
            
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden">
              {/* Product Selection */}
              <div className="lg:col-span-7 p-6 space-y-4 overflow-hidden flex flex-col">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <Input 
                    placeholder="Buscar producto..." 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                    className="pl-12 h-12 bg-white border-none shadow-sm rounded-2xl font-bold" 
                  />
                </div>
                <ScrollArea className="flex-1">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {filteredInventory.map((p: any) => (
                      <div 
                        key={p.id} 
                        onClick={() => addToCart(p)} 
                        className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 hover:border-emerald-400 cursor-pointer transition-all flex flex-col justify-between aspect-square group"
                      >
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 group-hover:text-emerald-600">{p.sku}</p>
                          <h3 className="text-xs font-bold text-slate-900 leading-tight line-clamp-2">{p.name}</h3>
                        </div>
                        <div className="mt-2 pt-2 border-t flex justify-between items-center">
                          <span className="text-sm font-black text-slate-900">${(p.price || 0).toFixed(2)}</span>
                          <div className="w-8 h-8 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all">
                            <Plus size={16} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
              
              {/* Summary and Cart */}
              <div className="lg:col-span-5 bg-white border-l p-6 flex flex-col overflow-hidden">
                <div className="space-y-4 flex-1 flex flex-col overflow-hidden">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">No. Factura</Label>
                    <Input 
                      placeholder="FAC-INST-000..." 
                      value={docNumber} 
                      onChange={e => setDocNumber(e.target.value)}
                      className="h-10 bg-slate-50 border-slate-100 rounded-xl font-bold" 
                    />
                  </div>

                  {/* Concepto Único para el Ministerio */}
                  <Card className="border-none shadow-none bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Info size={14} className="text-emerald-600" />
                        <Label className="text-[10px] font-black uppercase text-emerald-700 tracking-widest">Concepto Global (Opcional)</Label>
                      </div>
                      <textarea 
                        placeholder="Ej: Suministro de insumos según contrato..." 
                        value={billingConcept}
                        onChange={e => setBillingConcept(e.target.value)}
                        className="w-full min-h-[80px] bg-white border border-emerald-100 rounded-xl p-3 text-xs font-medium focus:ring-2 focus:ring-emerald-500/20 outline-none"
                      />
                      <p className="text-[9px] text-emerald-600 italic">Este texto aparecerá como descripción única en la factura.</p>
                    </div>
                  </Card>
                  
                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block pt-2">Detalle de Ítems</Label>
                  <ScrollArea className="flex-1 border-t border-b py-2">
                    <Table>
                      <TableBody>
                        {cart.length === 0 ? (
                          <TableRow>
                            <TableCell className="text-center py-10 text-slate-400 italic text-xs font-bold">Carrito vacío</TableCell>
                          </TableRow>
                        ) : cart.map((item) => (
                          <TableRow key={item.id} className="border-none">
                            <TableCell className="p-2">
                              <div className="flex flex-col">
                                <span className="font-bold text-xs text-slate-900">{item.name}</span>
                                <div className="flex items-center gap-2 mt-1">
                                  <Input 
                                    type="number" 
                                    value={item.quantity} 
                                    onChange={e => updateCartQty(item.id, parseInt(e.target.value) || 1)}
                                    className="h-7 w-12 text-[10px] text-center font-black bg-slate-50 border-none rounded-lg" 
                                  />
                                  <span className="text-[10px] text-slate-400 font-black">x</span>
                                  <span className="text-[10px] font-bold">${item.price.toFixed(2)}</span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-black text-xs p-2">${(item.price * item.quantity).toFixed(2)}</TableCell>
                            <TableCell className="p-2 w-10">
                              <Button variant="ghost" size="icon" onClick={() => removeFromCart(item.id)} className="h-6 w-6 text-slate-300 hover:text-rose-500">
                                <Trash2 size={12} />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
                
                <div className="pt-4 space-y-4">
                  <div className="flex justify-between items-end">
                    <span className="text-sm font-black text-slate-400 uppercase">Total Facturado</span>
                    <span className="text-4xl font-black text-emerald-600">${totalCart.toFixed(2)}</span>
                  </div>
                  <Button 
                    className="w-full h-16 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-lg shadow-xl shadow-emerald-500/20"
                    disabled={cart.length === 0 || !docNumber}
                    onClick={handleFinalizeSale}
                  >
                    FINALIZAR FACTURACIÓN
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Project Dialog */}
      <Dialog open={isNewProjectOpen} onOpenChange={setIsNewProjectOpen}>
        <DialogContent className="rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-black">
              <Briefcase className="text-blue-600" /> Nuevo Proyecto
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-400">Nombre de Proyecto</Label>
              <Input placeholder="Ej. Licitación Hospital..." value={newProject.name} onChange={e => setNewProject({...newProject, name: e.target.value})} className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-400">Cliente</Label>
              <select 
                className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold"
                value={newProject.customerId}
                onChange={e => setNewProject({...newProject, customerId: e.target.value})}
              >
                <option value="">Seleccione...</option>
                {customers?.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-400">Descripción</Label>
              <textarea 
                className="w-full min-h-[80px] bg-slate-50 border rounded-xl p-4 text-sm outline-none"
                placeholder="Alcance..."
                value={newProject.description}
                onChange={e => setNewProject({...newProject, description: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button className="w-full bg-blue-600 h-12 rounded-xl font-bold text-white shadow-lg" onClick={handleCreateProject}>CREAR PROYECTO</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Purchase Dialog (Manual) */}
      <Dialog open={isNewPurchaseOpen} onOpenChange={setIsNewPurchaseOpen}>
        <DialogContent className="rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-black text-xl">
               <ShoppingBag className="text-rose-600" /> Registro de Compra / Gasto
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-400">Proveedor</Label>
              <select 
                className="w-full h-11 bg-slate-50 border rounded-xl px-4 text-sm font-bold"
                value={newPurchase.supplierId}
                onChange={e => setNewPurchase({...newPurchase, supplierId: e.target.value})}
              >
                <option value="">Seleccione...</option>
                {suppliers?.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-400">No. Documento</Label>
              <Input placeholder="CCF-..." value={newPurchase.docNumber} onChange={e => setNewPurchase({...newPurchase, docNumber: e.target.value})} className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-400">Detalle de Gasto</Label>
              <textarea 
                className="w-full h-24 bg-slate-50 border rounded-xl p-3 text-sm font-medium"
                placeholder="Ej. Materiales de construcción"
                value={newPurchase.items}
                onChange={e => setNewPurchase({...newPurchase, items: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-400">Costo Total ($)</Label>
              <Input type="number" placeholder="0.00" value={newPurchase.total} onChange={e => setNewPurchase({...newPurchase, total: e.target.value})} className="h-12 bg-slate-50 border-none rounded-xl font-black text-rose-600" />
            </div>
          </div>
          <DialogFooter>
            <Button className="w-full bg-slate-900 font-bold h-12 rounded-xl text-white shadow-lg" onClick={handleAddPurchase}>REGISTRAR COSTO</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
