
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Building2, 
  ArrowLeft, 
  Plus, 
  Search, 
  Trash2, 
  Briefcase, 
  TrendingUp, 
  Receipt, 
  ShoppingBag, 
  Users, 
  Truck, 
  Calculator,
  ChevronRight,
  DollarSign,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  Sparkles,
  Archive,
  BarChart3,
  Box
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
import { useFirestore, useCollection, useUser } from '@/firebase';
import { collection, addDoc, deleteDoc, doc, query, where, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

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
  
  const { data: projects, loading: loadingProjects } = useCollection<any>(projectsRef);
  const { data: customers } = useCollection<any>(customersRef);
  const { data: suppliers } = useCollection<any>(suppliersRef);

  // Sales and Purchases for all or selected project
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

  // Forms
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', description: '', customerId: '' });
  
  const [isNewSaleOpen, setIsNewSaleOpen] = useState(false);
  const [newSale, setNewSale] = useState({ docNumber: '', total: '', date: new Date().toISOString().split('T')[0], items: '' });

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

  const handleAddSale = async () => {
    if (!selectedProjectId || !newSale.total) return;
    try {
      await addDoc(salesRef, {
        projectId: selectedProjectId,
        ...newSale,
        total: parseFloat(newSale.total.toString()),
        createdAt: new Date().toISOString()
      });
      toast({ title: "Factura Registrada", description: "Venta añadida al proyecto." });
      setIsNewSaleOpen(false);
      setNewSale({ docNumber: '', total: '', date: new Date().toISOString().split('T')[0], items: '' });
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

      // Ventas detalladas
      const sales = [
        { docNumber: 'FAC-INST-001', total: 45000.00, date: '2024-03-01', items: '30 Camas UCI Modelo X-500 @ $1,500' },
        { docNumber: 'FAC-INST-002', total: 32500.50, date: '2024-03-15', items: '20 Camas UCI Modelo X-500 + 5 Monitores @ $1,300 avg' }
      ];

      for (const s of sales) {
        await addDoc(salesRef, { ...s, projectId: pId, createdAt: new Date().toISOString() });
      }

      // Compras detalladas
      const purchases = [
        { docNumber: 'CCF-PROV-882', total: 28000.00, supplierName: 'MediCorp International', date: '2024-03-05', items: 'Importación de 50 kits de estructura metálica @ $560' },
        { docNumber: 'CCF-PROV-901', total: 12400.00, supplierName: 'Suministros Médicos El Salvador', date: '2024-03-10', items: '50 Colchones anti-escaras + Instalación @ $248' }
      ];

      for (const p of purchases) {
        await addDoc(purchasesRef, { ...p, projectId: pId, createdAt: new Date().toISOString() });
      }

      toast({ title: "Datos Cargados", description: "Se ha generado el proyecto 'Hospital Rosales 2024' con detalles de objetos y cantidades." });
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
            <h1 className="text-2xl font-bold text-slate-900">NexWay Institucional</h1>
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
                <p className="mb-4 text-center">No hay proyectos institucionales registrados.</p>
                <div className="flex gap-4">
                  <Button variant="outline" className="rounded-xl" onClick={handleLoadDemoData}>Ver ejemplo detallado</Button>
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
                    <p className="text-xs text-slate-400 mb-4 flex items-center gap-1">
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
                <h2 className="text-xl font-bold text-slate-900">{selectedProject?.name}</h2>
              </div>
              {selectedProject?.status !== 'FINALIZADO' && (
                <Button variant="outline" className="rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50" onClick={handleCloseProject} disabled={isClosingProject}>
                  {isClosingProject ? <Loader2 className="animate-spin mr-2" size={16} /> : <Archive className="mr-2" size={16} />}
                  Finalizar Proyecto
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-slate-900 text-white border-none rounded-3xl p-6">
                <p className="text-[10px] font-black uppercase opacity-60">Total Facturado (Ventas)</p>
                <p className="text-2xl font-black text-emerald-400">${stats.sales.toLocaleString()}</p>
              </Card>
              <Card className="bg-white border-none shadow-sm rounded-3xl p-6">
                <p className="text-[10px] font-black uppercase text-slate-400">Inversión Total (Compras)</p>
                <p className="text-2xl font-black text-rose-500">${stats.purchases.toLocaleString()}</p>
              </Card>
              <Card className="bg-blue-600 text-white border-none rounded-3xl p-6">
                <p className="text-[10px] font-black uppercase opacity-60">Ganancia Neta</p>
                <p className="text-2xl font-black">${stats.profit.toLocaleString()}</p>
              </Card>
              <Card className="bg-white border-none shadow-sm rounded-3xl p-6 flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 className="text-emerald-500" size={16} />
                  <p className="text-[10px] font-black uppercase text-slate-400">Rentabilidad</p>
                </div>
                <p className="text-2xl font-black text-slate-900">
                  {stats.sales > 0 ? ((stats.profit / stats.sales) * 100).toFixed(1) : '0'}%
                </p>
              </Card>
            </div>

            <Tabs defaultValue="billing" className="space-y-6">
              <TabsList className="bg-white p-1 rounded-2xl shadow-sm border border-slate-100">
                <TabsTrigger value="billing" className="rounded-xl px-8"><Receipt size={14} className="mr-2"/> Facturación Institucional</TabsTrigger>
                <TabsTrigger value="purchases" className="rounded-xl px-8"><ShoppingBag size={14} className="mr-2"/> Registro de Compras</TabsTrigger>
                <TabsTrigger value="overview" className="rounded-xl px-8"><Box size={14} className="mr-2"/> Análisis de Objetos</TabsTrigger>
                <TabsTrigger value="setup" className="rounded-xl px-8"><FileText size={14} className="mr-2"/> Detalle Legal</TabsTrigger>
              </TabsList>

              <TabsContent value="billing" className="space-y-4">
                 <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between border-b px-6 py-4">
                       <CardTitle className="text-sm font-bold">Control de Ingresos Facturados</CardTitle>
                       <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-9 rounded-xl font-bold" onClick={() => setIsNewSaleOpen(true)} disabled={selectedProject?.status === 'FINALIZADO'}>
                          <Plus size={16} className="mr-2" /> Nueva Factura Institucional
                       </Button>
                    </CardHeader>
                    <Table>
                       <TableHeader className="bg-slate-50">
                          <TableRow>
                             <TableHead className="px-6 text-[10px] font-black">FECHA</TableHead>
                             <TableHead className="text-[10px] font-black">DOCUMENTO</TableHead>
                             <TableHead className="text-[10px] font-black">DETALLE DE OBJETOS Y CANTIDADES</TableHead>
                             <TableHead className="text-right text-[10px] font-black pr-6">MONTO TOTAL</TableHead>
                          </TableRow>
                       </TableHeader>
                       <TableBody>
                          {projectSales.length === 0 ? (
                            <TableRow><TableCell colSpan={4} className="text-center py-20 text-slate-400 text-xs italic">No hay facturas emitidas para este proyecto.</TableCell></TableRow>
                          ) : projectSales.map((s: any) => (
                            <TableRow key={s.id}>
                               <TableCell className="px-6 text-xs text-slate-500">{s.date}</TableCell>
                               <TableCell className="font-bold text-xs">{s.docNumber}</TableCell>
                               <TableCell className="text-xs text-slate-600 italic">{s.items || 'Sin detalle de ítems'}</TableCell>
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
                             <TableHead className="px-6 text-[10px] font-black">PROVEEDOR</TableHead>
                             <TableHead className="text-[10px] font-black">DOC.</TableHead>
                             <TableHead className="text-[10px] font-black">MATERIALES / SERVICIOS COMPRADOS</TableHead>
                             <TableHead className="text-right text-[10px] font-black pr-6">COSTO TOTAL</TableHead>
                          </TableRow>
                       </TableHeader>
                       <TableBody>
                          {projectPurchases.length === 0 ? (
                            <TableRow><TableCell colSpan={4} className="text-center py-20 text-slate-400 text-xs italic">No hay registros de compras para este proyecto.</TableCell></TableRow>
                          ) : projectPurchases.map((p: any) => (
                            <TableRow key={p.id}>
                               <TableCell className="px-6 text-xs font-bold">{p.supplierName}</TableCell>
                               <TableCell className="text-xs font-mono">{p.docNumber}</TableCell>
                               <TableCell className="text-xs text-slate-600">{p.items || 'Sin detalle de materiales'}</TableCell>
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
                      <span className="text-xs text-slate-500">Total Facturado</span>
                      <span className="text-lg font-bold text-emerald-600">${stats.sales.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-end border-b pb-2">
                      <span className="text-xs text-slate-500">Total Compras</span>
                      <span className="text-lg font-bold text-rose-500">-${stats.purchases.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-end pt-2">
                      <span className="text-sm font-black">Utilidad de Proyecto</span>
                      <span className="text-2xl font-black text-blue-600">${stats.profit.toLocaleString()}</span>
                    </div>
                  </div>
                </Card>

                <Card className="rounded-3xl border-none shadow-sm bg-blue-600 text-white p-8 flex flex-col justify-center text-center">
                   <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 size={32} />
                   </div>
                   <h3 className="text-xl font-bold mb-2">Cuadre de Proyecto</h3>
                   <p className="text-sm text-blue-100 leading-relaxed">
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
                                <p className="text-xs text-slate-500 leading-relaxed">{selectedProject?.description || 'Sin descripción.'}</p>
                             </div>
                          </div>
                          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 flex flex-col justify-center">
                             <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                                <Archive size={16} /> Estado del Ciclo
                             </h4>
                             <div className="space-y-3">
                                <div className="flex justify-between items-center text-xs">
                                   <span className="text-slate-500">Creado el</span>
                                   <span className="font-medium">{new Date(selectedProject?.createdAt).toLocaleDateString()}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                   <span className="text-slate-500">Estado Actual</span>
                                   <Badge variant={selectedProject?.status === 'FINALIZADO' ? 'secondary' : 'outline'} className="text-[10px]">
                                      {selectedProject?.status}
                                   </Badge>
                                </div>
                             </div>
                             {selectedProject?.status !== 'FINALIZADO' && (
                               <Button className="w-full mt-6 bg-rose-600 hover:bg-rose-700 font-bold rounded-xl" onClick={handleCloseProject} disabled={isClosingProject}>
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
              <Label className="text-[10px] font-bold uppercase text-slate-400">Nombre de Proyecto</Label>
              <Input placeholder="Ej. Licitación MINSAL 2024..." value={newProject.name} onChange={e => setNewProject({...newProject, name: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-400">Cliente Institucional</Label>
              <select 
                className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-medium outline-none"
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
              <Label className="text-[10px] font-bold uppercase text-slate-400">Detalles del Contrato</Label>
              <textarea 
                className="w-full min-h-[80px] bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm outline-none"
                placeholder="Alcance del proyecto..."
                value={newProject.description}
                onChange={e => setNewProject({...newProject, description: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button className="w-full bg-blue-600 h-12 rounded-xl font-bold" onClick={handleCreateProject}>CREAR PROYECTO</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Sale Dialog */}
      <Dialog open={isNewSaleOpen} onOpenChange={setIsNewSaleOpen}>
        <DialogContent className="rounded-3xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-bold">
               <Receipt className="text-emerald-600" /> Registrar Factura Institucional
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-400">No. Factura / Doc.</Label>
              <Input placeholder="FAC-INST-..." value={newSale.docNumber} onChange={e => setNewSale({...newSale, docNumber: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-400">Detalle de Objetos y Cantidades</Label>
              <textarea 
                className="w-full h-20 bg-slate-50 border rounded-xl p-3 text-xs"
                placeholder="Ej. 10 Monitores de signos vitales @ $500 c/u"
                value={newSale.items}
                onChange={e => setNewSale({...newSale, items: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-400">Monto Total Facturado ($)</Label>
              <Input type="number" placeholder="0.00" value={newSale.total} onChange={e => setNewSale({...newSale, total: e.target.value})} className="h-12 text-lg font-black" />
            </div>
          </div>
          <DialogFooter>
            <Button className="w-full bg-emerald-600 font-bold h-12 rounded-xl" onClick={handleAddSale}>REGISTRAR VENTA</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Purchase Dialog */}
      <Dialog open={isNewPurchaseOpen} onOpenChange={setIsNewPurchaseOpen}>
        <DialogContent className="rounded-3xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-bold">
               <ShoppingBag className="text-rose-600" /> Registrar Inversión / Compra
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-400">Proveedor</Label>
              <select 
                className="w-full h-10 bg-slate-50 border rounded-xl px-4 text-xs"
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
              <Label className="text-[10px] font-bold uppercase text-slate-400">No. Documento Compra</Label>
              <Input placeholder="CCF-..." value={newPurchase.docNumber} onChange={e => setNewPurchase({...newPurchase, docNumber: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-400">Detalle de Materiales</Label>
              <textarea 
                className="w-full h-20 bg-slate-50 border rounded-xl p-3 text-xs"
                placeholder="Ej. 20 estructuras metálicas + flete"
                value={newPurchase.items}
                onChange={e => setNewPurchase({...newPurchase, items: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-400">Costo Total de Compra ($)</Label>
              <Input type="number" placeholder="0.00" value={newPurchase.total} onChange={e => setNewPurchase({...newPurchase, total: e.target.value})} className="h-12 text-lg font-black text-rose-600" />
            </div>
          </div>
          <DialogFooter>
            <Button className="w-full bg-slate-900 font-bold h-12 rounded-xl" onClick={handleAddPurchase}>REGISTRAR COSTO</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
