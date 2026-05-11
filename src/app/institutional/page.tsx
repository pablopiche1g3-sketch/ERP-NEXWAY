'use client';

import React, { useState, useMemo, useEffect } from 'react';
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
  Info
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

      // Compras detalladas (Registros de inversión)
      const purchases = [
        { docNumber: 'CCF-PROV-882', total: 28000.00, supplierName: 'MediCorp International', date: '2024-03-05', items: 'Importación de 50 kits de estructura metálica @ $560' },
        { docNumber: 'CCF-PROV-901', total: 12400.00, supplierName: 'Suministros Médicos El Salvador', date: '2024-03-10', items: '50 Colchones anti-escaras + Instalación @ $248' },
        { docNumber: 'CCF-PROV-1025', total: 3500.00, supplierName: 'Logística Global S.A.', date: '2024-03-12', items: 'Fletes y desaduanaje de contenedores de equipo médico' },
        { docNumber: 'CCF-PROV-1150', total: 5200.00, supplierName: 'Técnicos del Norte', date: '2024-03-20', items: 'Subcontratación de cableado estructurado y tomas de oxígeno' }
      ];

      for (const p of purchases) {
        await addDoc(purchasesRef, { ...p, projectId: pId, createdAt: new Date().toISOString() });
      }

      toast({ title: "Datos Cargados", description: "Se ha generado el proyecto 'Hospital Rosales 2024' con ingresos y registros de compra detallados." });
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
                  <BarChart3 className="text-emerald-500" size={16} />
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
                <TabsTrigger value="overview" className="rounded-xl px-8 font-bold"><Box size={14} className="mr-2"/> Análisis de Objetos</TabsTrigger>
                <TabsTrigger value="setup" className="rounded-xl px-8 font-bold"><FileText size={14} className="mr-2"/> Detalle Legal</TabsTrigger>
              </TabsList>

              <TabsContent value="billing" className="space-y-4">
                 <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between border-b px-6 py-4">
                       <CardTitle className="text-sm font-bold">Control de Ingresos Facturados</CardTitle>
                       <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-9 rounded-xl font-bold" onClick={() => setIsNewSaleOpen(true)} disabled={selectedProject?.status === 'FINALIZADO'}>
                          <Plus size={16} className="mr-2" /> Nueva Factura Institucional (POS Style)
                       </Button>
                    </CardHeader>
                    <Table>
                       <TableHeader className="bg-slate-50">
                          <TableRow>
                             <TableHead className="px-6 text-[10px] font-black uppercase">FECHA</TableHead>
                             <TableHead className="text-[10px] font-black uppercase">DOCUMENTO</TableHead>
                             <TableHead className="text-[10px] font-black uppercase">DETALLE DE OBJETOS O CONCEPTO ÚNICO</TableHead>
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
                                 {s.items || 'Sin detalle de ítems'}
                               </TableCell>
                               <TableCell className="text-right pr-6 font-black text-emerald-600">${s.total.toLocaleString()}</TableCell>
                            </TableRow>
                          ))}
                       </TableBody>
                    </Table>
                 </Card>
              </TabsContent>

              <TabsContent value="purchases" className="space-y-4">
                 <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between border-b px-6 py-4">
                       <CardTitle className="text-sm font-bold">Registro de Inversión y Costos</CardTitle>
                       <Button size="sm" variant="outline" className="border-slate-200 h-9 rounded-xl font-bold" onClick={() => setIsNewPurchaseOpen(true)} disabled={selectedProject?.status === 'FINALIZADO'}>
                          <Plus size={16} className="mr-2" /> Registrar Compra de Material
                       </Button>
                    </CardHeader>
                    <Table>
                       <TableHeader className="bg-slate-50">
                          <TableRow>
                             <TableHead className="px-6 text-[10px] font-black uppercase">PROVEEDOR</TableHead>
                             <TableHead className="text-[10px] font-black uppercase">DOC.</TableHead>
                             <TableHead className="text-[10px] font-black uppercase">MATERIALES / SERVICIOS COMPRADOS</TableHead>
                             <TableHead className="text-right text-[10px] font-black uppercase pr-6">COSTO TOTAL</TableHead>
                          </TableRow>
                       </TableHeader>
                       <TableBody>
                          {projectPurchases.length === 0 ? (
                            <TableRow><TableCell colSpan={4} className="text-center py-20 text-slate-400 text-xs italic font-bold">No hay registros de compras para este proyecto.</TableCell></TableRow>
                          ) : projectPurchases.map((p: any) => (
                            <TableRow key={p.id}>
                               <TableCell className="px-6 text-xs font-bold">{p.supplierName}</TableCell>
                               <TableCell className="text-xs font-mono font-medium">{p.docNumber}</TableCell>
                               <TableCell className="text-xs text-slate-600 font-medium">{p.items || 'Sin detalle de materiales'}</TableCell>
                               <TableCell className="text-right pr-6 font-black text-rose-600">-${p.total.toLocaleString()}</TableCell>
                            </TableRow>
                          ))}
                       </TableBody>
                    </Table>
                 </Card>
              </TabsContent>

              <TabsContent value="overview" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="rounded-3xl border-none shadow-sm bg-white p-6">
                  <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                    <BarChart3 size={18} className="text-blue-600" /> Comparativa de Flujo
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-end border-b pb-2">
                      <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Facturado</span>
                      <span className="text-lg font-black text-emerald-600">${stats.sales.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-end border-b pb-2">
                      <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Compras</span>
                      <span className="text-lg font-black text-rose-500">-${stats.purchases.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-end pt-2">
                      <span className="text-sm font-black uppercase">Utilidad de Proyecto</span>
                      <span className="text-2xl font-black text-blue-600">${stats.profit.toLocaleString()}</span>
                    </div>
                  </div>
                </Card>

                <Card className="rounded-3xl border-none shadow-sm bg-blue-600 text-white p-8 flex flex-col justify-center text-center">
                   <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 size={32} />
                   </div>
                   <h3 className="text-xl font-bold mb-2">Cuadre de Proyecto</h3>
                   <p className="text-sm text-blue-100 leading-relaxed font-medium">
                     El balance de este proyecto se maneja de forma estricta mediante el cruce de facturas comerciales y comprobantes de crédito fiscal de proveedores.
                   </p>
                </Card>
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
                                <Label className="text-[10px] font-black uppercase text-slate-400">Nombre de Licitación / Proyecto</Label>
                                <p className="text-lg font-bold text-slate-900">{selectedProject?.name}</p>
                             </div>
                             <div className="space-y-1">
                                <Label className="text-[10px] font-black uppercase text-slate-400">Cliente / Institución</Label>
                                <p className="text-sm font-bold text-slate-700">{selectedProject?.customerName}</p>
                             </div>
                             <div className="space-y-1">
                                <Label className="text-[10px] font-black uppercase text-slate-400">Descripción del Alcance</Label>
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

      {/* POS Style Billing Dialog for Institutional */}
      <Dialog open={isNewSaleOpen} onOpenChange={setIsNewSaleOpen}>
        <DialogContent className="max-w-6xl w-[95vw] rounded-3xl p-0 overflow-hidden bg-slate-50 h-[90vh]">
          <div className="flex flex-col h-full">
            <div className="p-6 bg-emerald-600 text-white flex justify-between items-center">
              <div>
                <DialogTitle className="text-xl font-black uppercase tracking-tight">Nueva Factura Institucional</DialogTitle>
                <DialogDescription className="text-emerald-100 font-bold">Proceso de facturación para proyecto: {selectedProject?.name}</DialogDescription>
              </div>
              <div className="bg-white/20 px-6 py-3 rounded-2xl border border-white/20">
                <p className="text-[10px] font-black uppercase opacity-60">Total Presupuestado</p>
                <p className="text-2xl font-black">${totalCart.toFixed(2)}</p>
              </div>
            </div>
            
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden">
              {/* Left: Product Selection */}
              <div className="lg:col-span-7 p-6 space-y-4 overflow-hidden flex flex-col">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <Input 
                    placeholder="Buscar producto por SKU o Nombre..." 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                    className="pl-12 h-12 bg-white border-none shadow-sm rounded-2xl font-bold" 
                  />
                </div>
                <ScrollArea className="flex-1">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pr-4">
                    {filteredInventory.map((p: any) => (
                      <div 
                        key={p.id} 
                        onClick={() => addToCart(p)} 
                        className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 hover:border-emerald-400 cursor-pointer transition-all flex flex-col justify-between aspect-square group"
                      >
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 group-hover:text-emerald-600">{p.sku}</p>
                          <h3 className="text-xs font-bold text-slate-900 leading-tight line-clamp-2 h-8">{p.name}</h3>
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
              
              {/* Right: Cart & Summary & Concept */}
              <div className="lg:col-span-5 bg-white border-l p-6 flex flex-col overflow-hidden">
                <div className="space-y-4 flex-1 flex flex-col overflow-hidden">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">No. Documento / Factura</Label>
                      <div className="relative">
                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <Input 
                          placeholder="FAC-INST-000..." 
                          value={docNumber} 
                          onChange={e => setDocNumber(e.target.value)}
                          className="h-10 pl-9 bg-slate-50 border-slate-100 rounded-xl font-bold" 
                        />
                      </div>
                    </div>
                  </div>

                  {/* Nuevo Campo de Concepto Único / Consolidado */}
                  <Card className="border-none shadow-none bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Info size={14} className="text-emerald-600" />
                        <Label className="text-[10px] font-black uppercase text-emerald-700 tracking-widest">Concepto de Facturación Institucional</Label>
                      </div>
                      <textarea 
                        placeholder="Ej: Suministro de equipo médico según Licitación 04/2024..." 
                        value={billingConcept}
                        onChange={e => setBillingConcept(e.target.value)}
                        className="w-full min-h-[80px] bg-white border border-emerald-100 rounded-xl p-3 text-xs font-medium focus:ring-2 focus:ring-emerald-500/20 outline-none"
                      />
                      <p className="text-[9px] text-emerald-600 italic">Deje vacío para listar todos los productos individualmente.</p>
                    </div>
                  </Card>
                  
                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block pt-2">Detalle Interno de Objetos</Label>
                  <ScrollArea className="flex-1 border-t border-b py-2">
                    <Table>
                      <TableBody>
                        {cart.length === 0 ? (
                          <TableRow>
                            <TableCell className="text-center py-10 text-slate-400 italic text-xs font-bold">Añada productos del catálogo</TableCell>
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
                                    onFocus={e => e.target.select()}
                                    onChange={e => updateCartQty(item.id, parseInt(e.target.value) || 1)}
                                    className="h-7 w-12 text-[10px] text-center font-black bg-slate-50 border-none rounded-lg" 
                                  />
                                  <span className="text-[10px] text-slate-400 font-black">x</span>
                                  <Input 
                                    type="number" 
                                    step="0.01"
                                    value={item.price} 
                                    onFocus={e => e.target.select()}
                                    onChange={e => updateCartPrice(item.id, parseFloat(e.target.value) || 0)}
                                    className="h-7 w-20 text-[10px] font-black bg-slate-50 border-none rounded-lg" 
                                  />
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
                    <span className="text-sm font-black text-slate-400 uppercase">Total Factura</span>
                    <span className="text-4xl font-black text-emerald-600">${totalCart.toFixed(2)}</span>
                  </div>
                  <Button 
                    className="w-full h-16 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-lg shadow-xl shadow-emerald-500/20"
                    disabled={cart.length === 0 || !docNumber}
                    onClick={handleFinalizeSale}
                  >
                    FINALIZAR VENTA INSTITUCIONAL
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
              <Briefcase className="text-blue-600" /> Nuevo Proyecto Institucional
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Nombre de Proyecto</Label>
              <Input placeholder="Ej. Licitación MINSAL 2024..." value={newProject.name} onChange={e => setNewProject({...newProject, name: e.target.value})} className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Cliente Institucional</Label>
              <select 
                className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold outline-none"
                value={newProject.customerId}
                onChange={e => setNewProject({...newProject, customerId: e.target.value})}
              >
                <option value="">Seleccione cliente...</option>
                {customers?.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Detalles del Contrato</Label>
              <textarea 
                className="w-full min-h-[80px] bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm outline-none font-medium"
                placeholder="Alcance del proyecto..."
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

      {/* New Purchase Dialog */}
      <Dialog open={isNewPurchaseOpen} onOpenChange={setIsNewPurchaseOpen}>
        <DialogContent className="rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-black text-xl">
               <ShoppingBag className="text-rose-600" /> Registrar Inversión / Compra
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Proveedor</Label>
              <select 
                className="w-full h-11 bg-slate-50 border rounded-xl px-4 text-sm font-bold"
                value={newPurchase.supplierId}
                onChange={e => setNewPurchase({...newPurchase, supplierId: e.target.value})}
              >
                <option value="">Seleccione proveedor...</option>
                {suppliers?.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">No. Documento Compra</Label>
              <Input placeholder="CCF-..." value={newPurchase.docNumber} onChange={e => setNewPurchase({...newPurchase, docNumber: e.target.value})} className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Detalle de Materiales</Label>
              <textarea 
                className="w-full h-24 bg-slate-50 border rounded-xl p-3 text-sm font-medium"
                placeholder="Ej. 20 estructuras metálicas + flete"
                value={newPurchase.items}
                onChange={e => setNewPurchase({...newPurchase, items: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Costo Total de Compra ($)</Label>
              <div className="relative">
                <Calculator className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <Input type="number" placeholder="0.00" value={newPurchase.total} onChange={e => setNewPurchase({...newPurchase, total: e.target.value})} className="h-14 pl-10 text-2xl font-black text-rose-600 bg-slate-50 border-none rounded-xl" />
              </div>
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