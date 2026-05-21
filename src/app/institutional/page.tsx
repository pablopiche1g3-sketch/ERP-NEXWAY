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
  XCircle
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
  const inventoryRef = useMemo(() => collection(db, 'inventory'), [db]);
  const salesRef = useMemo(() => collection(db, 'institutional_sales'), [db]);
  const purchasesRef = useMemo(() => collection(db, 'institutional_purchases'), [db]);
  
  const { data: projects } = useCollection<any>(projectsRef);
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

  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', description: '', customerId: '' });

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

      // Update inventory
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

  const handleInvalidateInstitutionalDTE = async (sale: any) => {
    if (!confirm('¿Desea invalidar este documento institucional y reintegrar el stock?')) return;
    setIsProcessing(true);
    try {
      await updateDoc(doc(db, 'institutional_sales', sale.id), { 
        status: 'INVALIDADA',
        invalidatedAt: new Date().toISOString()
      });
      
      if (sale.cartItems) {
        for (const item of sale.cartItems) {
          const product = inventory.find((p: any) => p.id === item.id);
          if (product) {
            await updateDoc(doc(db, 'inventory', item.id), { 
              quantity: (product.quantity || 0) + item.quantity 
            });
          }
        }
      }
      toast({ title: "DTE Institucional Invalidado" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo invalidar." });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLoadSaleDetail = (sale: any) => {
    setCart(sale.cartItems || []);
    setCustomerName(sale.customerName || '');
    setDocNumber(sale.docNumber || '');
    setBillingConcept(sale.concept || '');
    setSelectedProjectId(sale.projectId || '');
    setActiveTab('billing');
    toast({ title: "Factura Cargada", description: "Detalles visibles en la pestaña de facturación." });
  };

  const handleCreateProject = async () => {
    if (!newProject.name) return;
    try {
      await addDoc(projectsRef, {
        ...newProject,
        customerName: customers?.find(c => c.id === newProject.customerId)?.name || 'Cliente Externo',
        status: 'ACTIVO',
        createdAt: new Date().toISOString()
      });
      toast({ title: "Proyecto Creado", description: "El expediente ha sido abierto." });
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
        const json = JSON.parse(event.target?.result as string);
        let purchasesToProcess: any[] = [];

        // Lógica Ministerio de Hacienda DTE SV V3
        if (json.identificacion && json.emisor && json.resumen && json.cuerpoDocumento) {
          purchasesToProcess = [{
            docNumber: json.identificacion.codigoGeneracion || json.identificacion.numeroControl || 'DTE-SV-V3',
            total: json.resumen.totalPagar || json.resumen.montoTotalOperacion || 0,
            supplierName: json.emisor.nombre || 'Proveedor DTE',
            date: json.identificacion.fecEmi || new Date().toISOString().split('T')[0],
            items: json.cuerpoDocumento?.map((item: any) => `${item.cantidad} ${item.descripcion}`).join(', ') || 'Compra DTE'
          }];
        } else if (Array.isArray(json)) {
          purchasesToProcess = json;
        } else {
          toast({ variant: "destructive", title: "Formato Desconocido", description: "No coincide con el estándar DTE V3 de Hacienda." });
          return;
        }

        for (const item of purchasesToProcess) {
          await addDoc(purchasesRef, {
            projectId: selectedProjectId || item.projectId || null,
            docNumber: item.docNumber || item.numeroDocumento || 'S/N',
            total: parseFloat(item.total) || 0,
            supplierName: item.supplierName || item.nombreProveedor || 'Proveedor Externo',
            date: item.date || new Date().toISOString().split('T')[0],
            items: item.items || 'Carga vía DTE V3',
            createdAt: new Date().toISOString()
          });
        }
        toast({ title: "Carga de DTE Exitosa" });
      } catch (error) {
        toast({ variant: "destructive", title: "Error de lectura" });
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
            <p className="text-slate-500 text-sm">Ventas gubernamentales y soporte DTE V3 Hacienda</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white p-1 rounded-2xl shadow-sm border border-slate-100 flex-wrap h-auto">
            <TabsTrigger value="billing" className="rounded-xl px-8 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Receipt size={14} className="mr-2"/> Nueva Factura Inst.
            </TabsTrigger>
            <TabsTrigger value="projects" className="rounded-xl px-8 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Briefcase size={14} className="mr-2"/> Gestión de Proyectos
            </TabsTrigger>
            <TabsTrigger value="costs" className="rounded-xl px-8 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <FileUp size={14} className="mr-2"/> Carga de Costos DTE
            </TabsTrigger>
            <TabsTrigger value="history" className="rounded-xl px-8 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Calculator size={14} className="mr-2"/> Historial y Cuadre
            </TabsTrigger>
          </TabsList>

          <TabsContent value="billing" className="grid grid-cols-1 lg:grid-cols-12 gap-6 outline-none">
            <div className="lg:col-span-5 space-y-4">
              <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
                <CardHeader className="bg-slate-900 text-white p-5">
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
                              Escanee o seleccione productos del catálogo maestro
                            </TableCell>
                          </TableRow>
                        ) : cart.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="text-center font-black text-blue-600">{item.quantity}</TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-bold text-xs">{item.name}</span>
                                <span className="text-[9px] text-slate-400">${item.price.toFixed(2)} unit.</span>
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
                  <div className="p-4 border-t bg-slate-50/50 space-y-3">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Concepto Único para Factura</Label>
                    <textarea 
                      placeholder="Ej. Suministro global según contrato No..." 
                      value={billingConcept}
                      onChange={e => setBillingConcept(e.target.value)}
                      className="w-full min-h-[80px] bg-white border border-slate-200 rounded-xl p-3 text-xs focus:ring-2 focus:ring-blue-500/20 outline-none"
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
              <Card className="border-none shadow-sm rounded-2xl bg-white p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Seleccionar Cliente</Label>
                  <div className="flex gap-2">
                    <Input placeholder="Nombre..." value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="h-10 bg-slate-50 rounded-xl font-bold" />
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="h-10 rounded-xl px-3"><Users size={16} /></Button>
                      </DialogTrigger>
                      <DialogContent className="rounded-3xl max-w-sm">
                        <DialogHeader><DialogTitle>Cartera de Clientes</DialogTitle></DialogHeader>
                        <Input placeholder="Buscar..." value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} className="mb-4" />
                        <ScrollArea className="h-60">
                          {filteredCustomers.map(c => (
                            <div key={c.id} onClick={() => setCustomerName(c.name)} className="p-3 border-b hover:bg-slate-50 cursor-pointer text-xs font-bold">{c.name}</div>
                          ))}
                        </ScrollArea>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Asociar a Proyecto</Label>
                  <select 
                    className="w-full h-10 bg-slate-50 border border-slate-100 rounded-xl px-4 text-xs font-bold"
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
                  <Label className="text-[10px] font-black uppercase text-slate-400">Número de Factura / Documento</Label>
                  <Input placeholder="FAC-000-001..." value={docNumber} onChange={e => setDocNumber(e.target.value)} className="h-10 bg-slate-50 rounded-xl font-bold font-mono" />
                </div>
              </Card>

              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <Input placeholder="Buscar en inventario maestro..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-12 h-12 bg-white border-none shadow-sm rounded-2xl" />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {filteredInventory.map((p: any) => (
                  <div key={p.id} onClick={() => addToCart(p)} className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 hover:border-blue-400 cursor-pointer transition-all flex flex-col justify-between aspect-square">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400">{p.sku}</p>
                      <h3 className="text-xs font-bold text-slate-900 leading-tight line-clamp-2 h-8">{p.name}</h3>
                    </div>
                    <div className="mt-2 pt-2 border-t flex justify-between items-center">
                      <span className="text-sm font-black text-slate-900">${(p.price || 0).toFixed(2)}</span>
                      <div className="w-8 h-8 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all"><Plus size={16} /></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="costs" className="space-y-6 outline-none">
             <div className="max-w-2xl mx-auto">
                <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
                   <CardHeader className="bg-blue-600 text-white p-6">
                      <CardTitle className="text-lg font-bold flex items-center gap-2">
                         <FileUp size={20} /> Importar Costos de Proyecto
                      </CardTitle>
                      <CardDescription className="text-blue-100">Cargue el DTE V3 del proveedor para asignar costos directos</CardDescription>
                   </CardHeader>
                   <CardContent className="p-8 space-y-6">
                      <div className="space-y-4">
                         <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold uppercase text-slate-400">Asignar a Proyecto (Opcional)</Label>
                            <select 
                               className="w-full h-11 bg-slate-50 border border-slate-100 rounded-xl px-4 text-xs font-bold"
                               value={selectedProjectId}
                               onChange={e => setSelectedProjectId(e.target.value)}
                            >
                               <option value="">Carga General (Sin Proyecto)</option>
                               {projects?.map((p: any) => (
                                  <option key={p.id} value={p.id}>{p.name}</option>
                               ))}
                            </select>
                         </div>
                         
                         <div className="border-2 border-dashed border-slate-200 rounded-3xl p-10 flex flex-col items-center justify-center text-center gap-4 bg-slate-50/50">
                            <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center text-blue-600">
                               <FileCode size={32} />
                            </div>
                            <div>
                               <p className="text-sm font-bold text-slate-900">Suelta el JSON de Hacienda aquí</p>
                               <p className="text-xs text-slate-500">Soporta estándar DTE Versión 3 (Facturas/CCF)</p>
                            </div>
                            <input 
                               type="file" 
                               ref={purchaseFileInputRef} 
                               onChange={handleBulkPurchaseUpload} 
                               className="hidden" 
                               accept=".json" 
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

          <TabsContent value="history" className="space-y-6 outline-none">
            <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl mb-4 text-[10px] font-bold text-blue-700">
               TIP: Haz doble clic en una fila para ver el detalle de productos en la terminal.
            </div>
            <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="px-6">Fecha</TableHead>
                    <TableHead>Documento / DTE</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Proyecto</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead className="text-right px-6">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allSales?.map((s: any) => (
                    <TableRow 
                      key={s.id} 
                      onDoubleClick={() => handleLoadSaleDetail(s)}
                      className={`cursor-pointer hover:bg-slate-50/80 transition-colors ${s.status === 'INVALIDADA' ? 'opacity-40 grayscale' : ''}`}
                    >
                      <TableCell className="px-6 text-xs">{s.date}</TableCell>
                      <TableCell className="font-mono text-xs font-bold">{s.docNumber}</TableCell>
                      <TableCell className="text-xs font-bold">{s.customerName}</TableCell>
                      <TableCell className="text-[10px] text-slate-500 italic">
                        {projects?.find(p => p.id === s.projectId)?.name || 'Venta Libre'}
                      </TableCell>
                      <TableCell className="text-right font-black text-emerald-600">${s.total.toFixed(2)}</TableCell>
                      <TableCell className="text-center">
                        <Badge className={`text-[9px] font-black ${s.status === 'INVALIDADA' ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-600'}`}>
                          {s.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right px-6">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-slate-400 hover:text-rose-600"
                          disabled={s.status === 'INVALIDADA'}
                          onClick={(e) => { e.stopPropagation(); handleInvalidateInstitutionalDTE(s); }}
                        >
                          <Ban size={14} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={isNewProjectOpen} onOpenChange={setIsNewProjectOpen}>
        {/* Modal content remains unchanged */}
      </Dialog>
    </div>
  );
}
