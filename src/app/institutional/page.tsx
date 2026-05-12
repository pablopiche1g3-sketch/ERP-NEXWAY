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
  Package
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

export default function InstitutionalModulePage() {
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  
  // Data Fetching
  const projectsRef = useMemo(() => collection(db, 'institutional_projects'), [db]);
  const customersRef = useMemo(() => collection(db, 'customers'), [db]);
  const suppliersRef = useMemo(() => collection(db, 'suppliers'), [db]);
  const inventoryRef = useMemo(() => collection(db, 'inventory'), [db]);
  const salesRef = useMemo(() => collection(db, 'institutional_sales'), [db]);
  const purchasesRef = useMemo(() => collection(db, 'institutional_purchases'), [db]);
  
  const { data: projects, loading: loadingProjects } = useCollection<any>(projectsRef);
  const { data: customers } = useCollection<any>(customersRef);
  const { data: suppliers } = useCollection<any>(suppliersRef);
  const { data: inventory } = useCollection<any>(inventoryRef);
  const { data: allSales } = useCollection<any>(salesRef);
  const { data: allPurchases } = useCollection<any>(purchasesRef);

  // States for POS
  const [searchTerm, setSearchTerm] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [docNumber, setDocNumber] = useState('');
  const [billingConcept, setBillingConcept] = useState(''); 
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // States for Projects
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', description: '', customerId: '' });

  // Refs
  const purchaseFileInputRef = useRef<HTMLInputElement>(null);

  // Calculations
  const totalCart = useMemo(() => cart.reduce((acc, item) => acc + (item.price * item.quantity), 0), [cart]);

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
  
  const handleFinalizeSale = async () => {
    if (cart.length === 0 || !docNumber || !customerName) {
      toast({ variant: "destructive", title: "Faltan datos", description: "Asegúrese de seleccionar cliente, productos y número de documento." });
      return;
    }
    setIsProcessing(true);
    try {
      const finalItemsDetail = billingConcept 
        ? `${billingConcept} (Consolidado)`
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
        createdAt: new Date().toISOString()
      });

      toast({ title: "Factura Institucional Exitosa", description: "Venta registrada correctamente." });
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
    if (!newProject.name || !newProject.customerId) return;
    try {
      await addDoc(projectsRef, {
        ...newProject,
        customerName: customers.find(c => c.id === newProject.customerId)?.name || 'Cliente Desconocido',
        status: 'ACTIVO',
        createdAt: new Date().toISOString()
      });
      toast({ title: "Proyecto Creado", description: "Ya puede vincular facturas a este proyecto." });
      setIsNewProjectOpen(false);
      setNewProject({ name: '', description: '', customerId: '' });
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo crear el proyecto." });
    }
  };

  const handleBulkPurchaseUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (Array.isArray(data)) {
          let count = 0;
          for (const item of data) {
            await addDoc(purchasesRef, {
              projectId: item.projectId || null,
              docNumber: item.docNumber || 'S/N',
              total: parseFloat(item.total) || 0,
              supplierName: item.supplierName || 'Proveedor Desconocido',
              date: item.date || new Date().toISOString().split('T')[0],
              items: item.items || 'Carga masiva',
              createdAt: new Date().toISOString()
            });
            count++;
          }
          toast({ title: "Carga Masiva Exitosa", description: `Se han registrado ${count} costos.` });
        }
      } catch (error) {
        toast({ variant: "destructive", title: "Error", description: "Archivo JSON no válido." });
      } finally {
        if (purchaseFileInputRef.current) purchaseFileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="rounded-full bg-white shadow-sm" onClick={() => router.push('/')}>
            <ArrowLeft className="text-slate-600" size={20} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 font-headline">NexWay Institucional</h1>
            <p className="text-slate-500 text-sm">Terminal de ventas gubernamentales y gestión de contratos</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        <Tabs defaultValue="billing" className="space-y-6">
          <TabsList className="bg-white p-1 rounded-2xl shadow-sm border border-slate-100 flex-wrap h-auto">
            <TabsTrigger value="billing" className="rounded-xl px-8 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Receipt size={14} className="mr-2"/> Nueva Factura Inst.
            </TabsTrigger>
            <TabsTrigger value="projects" className="rounded-xl px-8 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Briefcase size={14} className="mr-2"/> Gestión de Proyectos
            </TabsTrigger>
            <TabsTrigger value="costs" className="rounded-xl px-8 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <ShoppingBag size={14} className="mr-2"/> Compras y Costos
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-xl px-8 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Calculator size={14} className="mr-2"/> Historial y Cuadre
            </TabsTrigger>
          </TabsList>

          <TabsContent value="billing" className="grid grid-cols-1 lg:grid-cols-12 gap-6 outline-none">
            {/* Left side: Cart and Summary */}
            <div className="lg:col-span-5 space-y-4">
              <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
                <CardHeader className="bg-slate-900 text-white p-5">
                  <div className="flex justify-between items-center mb-2">
                    <CardTitle className="text-base font-bold">Resumen Institucional</CardTitle>
                    <Badge variant="outline" className="text-[10px] text-blue-400 border-blue-400 uppercase">Factura Inst.</Badge>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase font-bold text-slate-500">Monto Total Gravado</p>
                    <p className="text-4xl font-black text-blue-400">${totalCart.toFixed(2)}</p>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[300px]">
                    <Table>
                      <TableHeader className="bg-slate-50">
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
                              Escanee o seleccione productos del catálogo
                            </TableCell>
                          </TableRow>
                        ) : cart.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="text-center font-black text-blue-600">{item.quantity}</TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-bold text-xs">{item.name}</span>
                                <span className="text-[9px] text-slate-400">{item.sku} • ${(item.price).toFixed(2)} u.</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-bold text-xs">${(item.price * item.quantity).toFixed(2)}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" onClick={() => removeFromCart(item.id)} className="h-6 w-6 text-slate-300 hover:text-rose-500">
                                <Trash2 size={12} />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                  <div className="p-4 border-t bg-blue-50/30 space-y-3">
                    <div className="flex items-center gap-2">
                      <Info size={14} className="text-blue-600" />
                      <Label className="text-[10px] font-black uppercase text-blue-700 tracking-widest">Concepto Global Factura</Label>
                    </div>
                    <textarea 
                      placeholder="Escriba el concepto que aparecerá en la factura única..." 
                      value={billingConcept}
                      onChange={e => setBillingConcept(e.target.value)}
                      className="w-full min-h-[80px] bg-white border border-blue-100 rounded-xl p-3 text-xs font-medium focus:ring-2 focus:ring-blue-500/20 outline-none"
                    />
                  </div>
                </CardContent>
              </Card>
              <Button 
                className="w-full h-16 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-lg shadow-xl shadow-blue-500/20" 
                disabled={cart.length === 0 || isProcessing} 
                onClick={handleFinalizeSale}
              >
                {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <Receipt className="mr-2" />}
                EMITIR FACTURA INSTITUCIONAL
              </Button>
            </div>

            {/* Right side: Catalog and Customer */}
            <div className="lg:col-span-7 space-y-4">
              <Card className="border-none shadow-sm rounded-2xl bg-white p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Cliente Receptor</Label>
                  <div className="flex gap-2">
                    <Input placeholder="Nombre..." value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="h-10 bg-slate-50 rounded-xl font-bold" />
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="h-10 rounded-xl px-3"><Users size={16} /></Button>
                      </DialogTrigger>
                      <DialogContent className="rounded-3xl max-w-sm">
                        <DialogHeader><DialogTitle>Buscar Cliente</DialogTitle></DialogHeader>
                        <Input placeholder="Nombre o NIT..." value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} className="h-10 rounded-xl" />
                        <ScrollArea className="h-60">
                          {filteredCustomers.map(c => (
                            <div key={c.id} onClick={() => {setCustomerName(c.name); toast({title: "Cliente Cargado"})}} className="p-3 hover:bg-slate-50 cursor-pointer rounded-lg border-b">
                              <p className="text-xs font-bold">{c.name}</p>
                              <p className="text-[10px] text-slate-400">{c.nit}</p>
                            </div>
                          ))}
                        </ScrollArea>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Vincular a Proyecto (Opcional)</Label>
                  <select 
                    className="w-full h-10 bg-slate-50 border border-slate-100 rounded-xl px-4 text-xs font-bold"
                    value={selectedProjectId}
                    onChange={e => setSelectedProjectId(e.target.value)}
                  >
                    <option value="">Venta Libre (Sin Proyecto)</option>
                    {projects?.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2 space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">No. Documento / Factura</Label>
                  <Input placeholder="FAC-INST-000..." value={docNumber} onChange={e => setDocNumber(e.target.value)} className="h-10 bg-slate-50 rounded-xl font-bold font-mono" />
                </div>
              </Card>

              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <Input 
                  placeholder="Buscar en catálogo maestro por SKU o Nombre..." 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
                  className="pl-12 h-12 bg-white border-none shadow-sm rounded-2xl font-bold" 
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {filteredInventory.map((p: any) => (
                  <div key={p.id} onClick={() => addToCart(p)} className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 hover:border-blue-400 cursor-pointer transition-all flex flex-col justify-between aspect-square group">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400">{p.sku}</p>
                      <h3 className="text-xs font-bold text-slate-900 leading-tight line-clamp-2 h-8">{p.name}</h3>
                    </div>
                    <div className="mt-2 pt-2 border-t flex justify-between items-center">
                      <span className="text-sm font-black text-slate-900">${(p.price || 0).toFixed(2)}</span>
                      <div className="w-8 h-8 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all">
                        <Plus size={16} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="projects" className="space-y-6 outline-none">
            <div className="flex justify-between items-center">
               <h2 className="text-xl font-bold text-slate-900">Proyectos Activos</h2>
               <Button className="bg-blue-600 rounded-xl font-bold" onClick={() => setIsNewProjectOpen(true)}>
                 <Plus size={16} className="mr-2" /> Crear Proyecto
               </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {projects?.length === 0 ? (
                <Card className="col-span-full border-dashed p-20 flex flex-col items-center justify-center text-slate-400">
                  <Briefcase size={48} className="mb-4 opacity-20" />
                  <p className="font-bold">No hay proyectos institucionales registrados.</p>
                </Card>
              ) : projects?.map((p: any) => {
                const pSales = allSales?.filter(s => s.projectId === p.id).reduce((acc, s) => acc + s.total, 0) || 0;
                const pPurchases = allPurchases?.filter(pur => pur.projectId === p.id).reduce((acc, pur) => acc + pur.total, 0) || 0;
                return (
                  <Card key={p.id} className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
                    <CardContent className="p-6">
                      <div className="flex justify-between mb-4">
                        <Badge variant={p.status === 'ACTIVO' ? 'outline' : 'secondary'} className="font-black text-[9px]">{p.status}</Badge>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-200 hover:text-rose-500"><Archive size={14} /></Button>
                      </div>
                      <h3 className="text-base font-bold text-slate-900 mb-1">{p.name}</h3>
                      <p className="text-xs text-slate-500 mb-4">{p.customerName}</p>
                      <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                        <div>
                          <p className="text-[9px] font-black uppercase text-slate-400">Ventas</p>
                          <p className="text-sm font-bold text-emerald-600">${pSales.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black uppercase text-slate-400">Costos</p>
                          <p className="text-sm font-bold text-rose-500">-${pPurchases.toLocaleString()}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </TabsContent>

          <TabsContent value="costs" className="space-y-4 outline-none">
            <Card className="border-none shadow-sm rounded-3xl bg-white p-12 text-center space-y-6">
              <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center mx-auto">
                <FileJson size={32} />
              </div>
              <div className="max-w-md mx-auto">
                <h3 className="text-xl font-bold text-slate-900 mb-2">Carga Masiva de Costos</h3>
                <p className="text-slate-500 text-sm">Importe facturas de proveedores y costos operativos directamente mediante archivos JSON para alimentar sus proyectos.</p>
              </div>
              <div className="flex justify-center gap-4">
                <input type="file" ref={purchaseFileInputRef} onChange={handleBulkPurchaseUpload} className="hidden" accept=".json" />
                <Button className="bg-slate-900 rounded-xl h-12 px-8 font-bold" onClick={() => purchaseFileInputRef.current?.click()}>
                   <FileJson size={18} className="mr-2" /> SELECCIONAR ARCHIVO JSON
                </Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-6 outline-none">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-slate-900 text-white rounded-3xl p-6">
                <p className="text-[10px] font-black uppercase opacity-60">Total Ventas Inst.</p>
                <p className="text-3xl font-black">${allSales?.reduce((acc, s) => acc + s.total, 0).toLocaleString()}</p>
              </Card>
              <Card className="bg-white rounded-3xl p-6 border-none shadow-sm">
                <p className="text-[10px] font-black uppercase text-slate-400">Total Costos Inv.</p>
                <p className="text-3xl font-black text-rose-600">${allPurchases?.reduce((acc, p) => acc + p.total, 0).toLocaleString()}</p>
              </Card>
              <Card className="bg-blue-600 text-white rounded-3xl p-6">
                <p className="text-[10px] font-black uppercase opacity-60">Utilidad Acumulada</p>
                <p className="text-3xl font-black">${(allSales?.reduce((acc, s) => acc + s.total, 0) - allPurchases?.reduce((acc, p) => acc + p.total, 0)).toLocaleString()}</p>
              </Card>
              <Card className="bg-white rounded-3xl p-6 border-none shadow-sm flex flex-col justify-center">
                <p className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1"><TrendingUp size={12} /> Margen Bruto</p>
                <p className="text-2xl font-black text-slate-900">
                  {allSales?.length > 0 ? (
                    ((allSales?.reduce((acc, s) => acc + s.total, 0) - allPurchases?.reduce((acc, p) => acc + p.total, 0)) / allSales?.reduce((acc, s) => acc + s.total, 0) * 100).toFixed(1)
                  ) : '0'}%
                </p>
              </Card>
            </div>

            <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="px-6">Fecha</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Proyecto Asociado</TableHead>
                    <TableHead className="text-right">Monto Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allSales?.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-20 text-slate-400">No hay historial de ventas institucionales.</TableCell></TableRow>
                  ) : allSales?.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="px-6 text-xs">{s.date}</TableCell>
                      <TableCell className="font-mono text-xs font-bold">{s.docNumber}</TableCell>
                      <TableCell className="text-xs font-bold">{s.customerName}</TableCell>
                      <TableCell>
                        {s.projectId ? (
                          <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-100 font-bold text-[9px]">
                            {projects?.find(p => p.id === s.projectId)?.name || 'Cargando...'}
                          </Badge>
                        ) : <span className="text-slate-300 text-[10px] italic">Venta Libre</span>}
                      </TableCell>
                      <TableCell className="text-right font-black text-emerald-600">${s.total.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* New Project Dialog */}
      <Dialog open={isNewProjectOpen} onOpenChange={setIsNewProjectOpen}>
        <DialogContent className="rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-black">
              <Briefcase className="text-blue-600" /> Nuevo Proyecto / Licitación
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-400">Nombre de Proyecto</Label>
              <Input placeholder="Ej. Licitación Hospital Rosales..." value={newProject.name} onChange={e => setNewProject({...newProject, name: e.target.value})} className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-400">Cliente Institucional</Label>
              <select 
                className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold"
                value={newProject.customerId}
                onChange={e => setNewProject({...newProject, customerId: e.target.value})}
              >
                <option value="">Seleccione un cliente de cartera...</option>
                {customers?.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase text-slate-400">Descripción del Alcance</Label>
              <textarea 
                className="w-full min-h-[80px] bg-slate-50 border rounded-xl p-4 text-sm outline-none"
                placeholder="Detalles del contrato..."
                value={newProject.description}
                onChange={e => setNewProject({...newProject, description: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button className="w-full bg-blue-600 h-12 rounded-xl font-bold text-white shadow-lg" onClick={handleCreateProject}>CREAR EXPEDIENTE DE PROYECTO</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
