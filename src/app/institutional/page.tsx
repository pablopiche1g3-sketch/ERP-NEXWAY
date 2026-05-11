
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
  Sparkles
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
  const { user } = useUser();
  
  // Navigation States
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeMainTab, setActiveMainTab] = useState('projects');
  const [isSeeding, setIsSeeding] = useState(false);
  
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
  const [newSale, setNewSale] = useState({ docNumber: '', total: '', date: new Date().toISOString().split('T')[0] });

  const [isNewPurchaseOpen, setIsNewPurchaseOpen] = useState(false);
  const [newPurchase, setNewPurchase] = useState({ docNumber: '', total: '', supplierId: '', date: new Date().toISOString().split('T')[0] });

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
      setNewSale({ docNumber: '', total: '', date: new Date().toISOString().split('T')[0] });
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
      setNewPurchase({ docNumber: '', total: '', supplierId: '', date: new Date().toISOString().split('T')[0] });
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo registrar la compra." });
    }
  };

  const handleLoadDemoData = async () => {
    setIsSeeding(true);
    try {
      // 1. Crear Proyecto Demo
      const projectDoc = await addDoc(projectsRef, {
        name: 'Equipamiento Hospital Rosales 2024',
        customerName: 'Ministerio de Salud (MINSAL)',
        customerId: 'demo-minsal',
        description: 'Suministro e instalación de equipos médicos de alta gama para la nueva ala del hospital.',
        status: 'ACTIVO',
        createdAt: new Date().toISOString()
      });

      const pId = projectDoc.id;

      // 2. Cargar Facturas de Venta (Ingresos)
      const sales = [
        { docNumber: 'FAC-INST-001', total: 45000.00, date: '2024-03-01' },
        { docNumber: 'FAC-INST-002', total: 32500.50, date: '2024-03-15' }
      ];

      for (const s of sales) {
        await addDoc(salesRef, { ...s, projectId: pId, createdAt: new Date().toISOString() });
      }

      // 3. Cargar Compras (Costos)
      const purchases = [
        { docNumber: 'CCF-PROV-882', total: 28000.00, supplierName: 'MediCorp International', date: '2024-03-05' },
        { docNumber: 'CCF-PROV-901', total: 12400.00, supplierName: 'Suministros Médicos El Salvador', date: '2024-03-10' }
      ];

      for (const p of purchases) {
        await addDoc(purchasesRef, { ...p, projectId: pId, createdAt: new Date().toISOString() });
      }

      toast({ title: "Datos Cargados", description: "Se ha generado el proyecto 'Hospital Rosales 2024' para demostración." });
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
            <h1 className="text-2xl font-bold text-slate-900">Institucional: Gobierno y Corporativos</h1>
            <p className="text-slate-500 text-sm">Control de proyectos, licitaciones y márgenes de ganancia</p>
          </div>
        </div>
        {!selectedProjectId && (
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-xl font-bold border-blue-200 text-blue-600 hover:bg-blue-50" onClick={handleLoadDemoData} disabled={isSeeding}>
              {isSeeding ? <Loader2 className="animate-spin mr-2" size={16} /> : <Sparkles className="mr-2" size={16} />}
              Cargar Ejemplo
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
                <p className="mb-4 text-center">No hay proyectos gubernamentales registrados.</p>
                <div className="flex gap-4">
                  <Button variant="outline" className="rounded-xl" onClick={handleLoadDemoData}>Ver un ejemplo ahora</Button>
                  <Button className="rounded-xl" onClick={() => setIsNewProjectOpen(true)}>Crear el primer proyecto</Button>
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
                      <Badge variant="outline" className="text-[10px] font-black uppercase">{p.status}</Badge>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-1 line-clamp-1">{p.name}</h3>
                    <p className="text-xs text-slate-400 mb-4 flex items-center gap-1">
                      <Building2 size={12} /> {p.customerName}
                    </p>
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                      <div>
                        <p className="text-[10px] font-black uppercase text-slate-400">Ventas</p>
                        <p className="text-sm font-bold text-emerald-600">${pSales.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase text-slate-400">Ganancia</p>
                        <p className={`text-sm font-bold ${profit >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>${profit.toFixed(2)}</p>
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-slate-900 text-white border-none rounded-3xl p-6">
                <p className="text-[10px] font-black uppercase opacity-60">Total Facturado</p>
                <p className="text-2xl font-black text-emerald-400">${stats.sales.toFixed(2)}</p>
              </Card>
              <Card className="bg-white border-none shadow-sm rounded-3xl p-6">
                <p className="text-[10px] font-black uppercase text-slate-400">Total Inversión/Compra</p>
                <p className="text-2xl font-black text-rose-500">${stats.purchases.toFixed(2)}</p>
              </Card>
              <Card className="bg-blue-600 text-white border-none rounded-3xl p-6">
                <p className="text-[10px] font-black uppercase opacity-60">Utilidad Proyectada</p>
                <p className="text-2xl font-black">${stats.profit.toFixed(2)}</p>
              </Card>
              <Card className="bg-white border-none shadow-sm rounded-3xl p-6 flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="text-emerald-500" size={16} />
                  <p className="text-[10px] font-black uppercase text-slate-400">Margen Bruto</p>
                </div>
                <p className="text-2xl font-black text-slate-900">
                  {stats.sales > 0 ? ((stats.profit / stats.sales) * 100).toFixed(1) : '0'}%
                </p>
              </Card>
            </div>

            <Tabs defaultValue="overview" className="space-y-6">
              <TabsList className="bg-white p-1 rounded-2xl shadow-sm border border-slate-100">
                <TabsTrigger value="overview" className="rounded-xl px-6"><Calculator size={14} className="mr-2"/> Resumen Financiero</TabsTrigger>
                <TabsTrigger value="sales" className="rounded-xl px-6"><Receipt size={14} className="mr-2"/> Facturación</TabsTrigger>
                <TabsTrigger value="purchases" className="rounded-xl px-6"><ShoppingBag size={14} className="mr-2"/> Compras/Inversión</TabsTrigger>
                <TabsTrigger value="setup" className="rounded-xl px-6"><FileText size={14} className="mr-2"/> Detalle Proyecto</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card className="rounded-3xl border-none shadow-sm bg-white">
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="text-sm font-bold">Últimas Ventas (Ingresos)</CardTitle>
                      <Button variant="outline" size="sm" className="h-8 rounded-lg text-[10px]" onClick={() => setIsNewSaleOpen(true)}>
                        <Plus size={14} className="mr-1" /> Registrar Factura
                      </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader className="bg-slate-50">
                          <TableRow>
                            <TableHead className="px-6 text-[10px]">Fecha</TableHead>
                            <TableHead className="text-[10px]">Doc No.</TableHead>
                            <TableHead className="text-right text-[10px] pr-6">Monto</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {projectSales.length === 0 ? (
                            <TableRow><TableCell colSpan={3} className="text-center py-10 text-slate-400 text-xs italic">No hay facturas registradas.</TableCell></TableRow>
                          ) : projectSales.map((s: any) => (
                            <TableRow key={s.id}>
                              <TableCell className="px-6 text-xs text-slate-500 font-mono">{s.date}</TableCell>
                              <TableCell className="font-bold text-xs">{s.docNumber}</TableCell>
                              <TableCell className="text-right pr-6 font-black text-emerald-600">${s.total.toFixed(2)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  <Card className="rounded-3xl border-none shadow-sm bg-white">
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="text-sm font-bold">Inversión en Compras (Costos)</CardTitle>
                      <Button variant="outline" size="sm" className="h-8 rounded-lg text-[10px]" onClick={() => setIsNewPurchaseOpen(true)}>
                        <Plus size={14} className="mr-1" /> Registrar Compra
                      </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader className="bg-slate-50">
                          <TableRow>
                            <TableHead className="px-6 text-[10px]">Proveedor</TableHead>
                            <TableHead className="text-[10px]">Doc No.</TableHead>
                            <TableHead className="text-right text-[10px] pr-6">Costo</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {projectPurchases.length === 0 ? (
                            <TableRow><TableCell colSpan={3} className="text-center py-10 text-slate-400 text-xs italic">No hay compras vinculadas.</TableCell></TableRow>
                          ) : projectPurchases.map((p: any) => (
                            <TableRow key={p.id}>
                              <TableCell className="px-6 text-xs font-bold">{p.supplierName}</TableCell>
                              <TableCell className="text-xs font-mono">{p.docNumber}</TableCell>
                              <TableCell className="text-right pr-6 font-black text-rose-600">-${p.total.toFixed(2)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="sales" className="space-y-4">
                 <Card className="border-none shadow-sm rounded-3xl bg-white p-8 text-center space-y-4">
                    <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
                       <Receipt size={32} />
                    </div>
                    <div>
                       <h3 className="text-lg font-bold">Facturación Especial para {selectedProject?.name}</h3>
                       <p className="text-slate-500 text-sm max-w-md mx-auto">Registre las facturas comerciales o créditos fiscales emitidos específicamente para este proyecto de gobierno.</p>
                    </div>
                    <Button className="bg-emerald-600 hover:bg-emerald-700 font-bold h-12 rounded-xl px-8" onClick={() => setIsNewSaleOpen(true)}>
                       EMITIR FACTURA DE PROYECTO
                    </Button>
                 </Card>
              </TabsContent>

              <TabsContent value="purchases" className="space-y-4">
                 <Card className="border-none shadow-sm rounded-3xl bg-white p-8 text-center space-y-4">
                    <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
                       <ShoppingBag size={32} />
                    </div>
                    <div>
                       <h3 className="text-lg font-bold">Registro de Inversión (Compras)</h3>
                       <p className="text-slate-500 text-sm max-w-md mx-auto">Todas las compras de materiales o servicios que se carguen aquí restarán de la utilidad final del proyecto.</p>
                    </div>
                    <Button className="bg-slate-900 hover:bg-slate-800 font-bold h-12 rounded-xl px-8" onClick={() => setIsNewPurchaseOpen(true)}>
                       CARGAR COMPRA DE MATERIALES
                    </Button>
                 </Card>
              </TabsContent>

              <TabsContent value="setup" className="space-y-6">
                 <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
                    <CardHeader className="bg-slate-50 p-6 border-b">
                       <CardTitle className="text-base font-bold">Datos Generales del Proyecto</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                       <div className="space-y-4">
                          <div className="space-y-1">
                             <Label className="text-[10px] font-black uppercase text-slate-400">Nombre del Proyecto / Licitación</Label>
                             <p className="text-lg font-bold text-slate-900">{selectedProject?.name}</p>
                          </div>
                          <div className="space-y-1">
                             <Label className="text-[10px] font-black uppercase text-slate-400">Cliente / Institución</Label>
                             <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="bg-blue-50 text-blue-700">GUBERNAMENTAL</Badge>
                                <p className="text-sm font-bold text-slate-700">{selectedProject?.customerName}</p>
                             </div>
                          </div>
                          <div className="space-y-1">
                             <Label className="text-[10px] font-black uppercase text-slate-400">Descripción Técnica</Label>
                             <p className="text-xs text-slate-500 leading-relaxed">{selectedProject?.description || 'Sin descripción detallada.'}</p>
                          </div>
                       </div>
                       <div className="bg-blue-50 p-6 rounded-[2rem] border border-blue-100 flex flex-col justify-center items-center text-center">
                          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-4">
                             <AlertCircle className="text-blue-600" size={24} />
                          </div>
                          <h4 className="font-bold text-blue-900 mb-2">Cuadre de Caja del Proyecto</h4>
                          <p className="text-xs text-blue-700 mb-4">Este proyecto maneja su propio flujo de caja independiente de la terminal de facturación general.</p>
                          <Button className="w-full bg-blue-600 font-bold rounded-xl" onClick={() => toast({ title: "Módulo en Desarrollo", description: "El arqueo exclusivo por proyecto estará disponible pronto." })}>
                             VER ARQUEO DEL PROYECTO
                          </Button>
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
              <Briefcase className="text-blue-600" /> Crear Proyecto Nuevo
            </DialogTitle>
            <DialogDescription>Defina el nombre y el cliente para iniciar el control de costos.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-400">Nombre del Proyecto</Label>
              <Input placeholder="Ej. Licitación Hospital Rosales 2024..." value={newProject.name} onChange={e => setNewProject({...newProject, name: e.target.value})} className="rounded-xl h-11" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-400">Institución / Cliente Especial</Label>
              <select 
                className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/20"
                value={newProject.customerId}
                onChange={e => setNewProject({...newProject, customerId: e.target.value})}
              >
                <option value="">Seleccione un cliente...</option>
                {customers?.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-400">Descripción Breve</Label>
              <textarea 
                className="w-full min-h-[80px] bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm outline-none"
                placeholder="Detalles del contrato..."
                value={newProject.description}
                onChange={e => setNewProject({...newProject, description: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button className="w-full bg-blue-600 h-12 rounded-xl font-bold text-white shadow-lg" onClick={handleCreateProject}>GUARDAR PROYECTO</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Sale Dialog */}
      <Dialog open={isNewSaleOpen} onOpenChange={setIsNewSaleOpen}>
        <DialogContent className="rounded-3xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-bold">
               <Receipt className="text-emerald-600" /> Registrar Ingreso
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-400">No. Documento / Factura</Label>
              <Input placeholder="FAC-001..." value={newSale.docNumber} onChange={e => setNewSale({...newSale, docNumber: e.target.value})} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-400">Monto Total de Venta ($)</Label>
              <Input type="number" placeholder="0.00" value={newSale.total} onChange={e => setNewSale({...newSale, total: e.target.value})} className="rounded-xl h-12 text-lg font-black" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-400">Fecha de Emisión</Label>
              <Input type="date" value={newSale.date} onChange={e => setNewSale({...newSale, date: e.target.value})} className="rounded-xl" />
            </div>
          </div>
          <DialogFooter>
            <Button className="w-full bg-emerald-600 font-bold h-12 rounded-xl text-white" onClick={handleAddSale}>REGISTRAR FACTURA</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Purchase Dialog */}
      <Dialog open={isNewPurchaseOpen} onOpenChange={setIsNewPurchaseOpen}>
        <DialogContent className="rounded-3xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-bold">
               <ShoppingBag className="text-rose-600" /> Registrar Gasto/Compra
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-400">Proveedor</Label>
              <select 
                className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-4 text-xs font-medium outline-none"
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
              <Label className="text-[10px] font-bold uppercase text-slate-400">No. Documento de Compra</Label>
              <Input placeholder="CCF-123..." value={newPurchase.docNumber} onChange={e => setNewPurchase({...newPurchase, docNumber: e.target.value})} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-400">Inversión Total ($)</Label>
              <Input type="number" placeholder="0.00" value={newPurchase.total} onChange={e => setNewPurchase({...newPurchase, total: e.target.value})} className="rounded-xl h-12 text-lg font-black text-rose-600" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-400">Fecha de Gasto</Label>
              <Input type="date" value={newPurchase.date} onChange={e => setNewPurchase({...newPurchase, date: e.target.value})} className="rounded-xl" />
            </div>
          </div>
          <DialogFooter>
            <Button className="w-full bg-slate-900 font-bold h-12 rounded-xl text-white" onClick={handleAddPurchase}>REGISTRAR COSTO</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
