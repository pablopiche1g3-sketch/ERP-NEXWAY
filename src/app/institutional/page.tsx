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
  Mail,
  PlusCircle,
  ArrowDownCircle,
  Activity,
  Target,
  DollarSign,
  ArrowUpRight
} from 'lucide-react';
import { 
  Bar, 
  BarChart, 
  ResponsiveContainer, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Cell 
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { DEFAULT_FROM_EMAIL } from '@/lib/admin-emails';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { sendDteEmail } from '@/ai/flows/send-dte-email-flow';
import { useEffect } from 'react';
import { ModeToggle } from '@/components/mode-toggle';

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
  const router = useRouter();
  const { toast } = useToast();
  
  // Supabase Data States
  const [projects, setProjects] = useState<any[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [customers, setCustomers] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [allSales, setAllSales] = useState<any[]>([]);
  const [allPurchases, setAllPurchases] = useState<any[]>([]);
  const [cashConfig, setCashConfig] = useState<any>({ cashFloat: 100, catchAllEmail: DEFAULT_FROM_EMAIL });

  const loadData = async () => {
    try {
      setLoadingProjects(true);
      // 1. Cargar proyectos institucionales
      const { data: projData } = await supabase.from('institutional_projects').select('*').order('created_at', { ascending: false });
      setProjects((projData || []).map(p => ({
        id: p.id,
        name: p.name,
        purchaseOrder: p.purchase_order,
        totalBudget: parseFloat(p.total_budget) || 0,
        customerName: p.customer_name,
        items: p.items,
        status: p.status,
        documents: p.documents,
        createdAt: p.created_at
      })));

      // 2. Cargar clientes
      const { data: custData } = await supabase.from('customers').select('*').order('name');
      setCustomers(custData || []);

      // 3. Cargar ventas institucionales
      const { data: salesData } = await supabase.from('institutional_sales').select('*').order('created_at', { ascending: false });
      setAllSales((salesData || []).map(s => ({
        id: s.id,
        projectId: s.project_id,
        docNumber: s.doc_number,
        total: parseFloat(s.total) || 0,
        date: s.date,
        items: s.items,
        cartItems: s.cart_items,
        concept: s.concept,
        customerName: s.customer_name,
        customerEmail: s.customer_email,
        status: s.status,
        createdAt: s.created_at
      })));

      // 4. Cargar compras/costos institucionales
      const { data: purchData } = await supabase.from('institutional_purchases').select('*').order('created_at', { ascending: false });
      setAllPurchases((purchData || []).map(p => ({
        id: p.id,
        projectId: p.project_id,
        supplier: p.supplier,
        docNumber: p.doc_number,
        items: p.items,
        total: parseFloat(p.total) || 0,
        date: p.date,
        createdAt: p.created_at
      })));

      // 5. Cargar configuración
      const { data: confData } = await supabase.from('system_config').select('*').eq('key', 'cash_config').maybeSingle();
      if (confData && confData.value) {
        setCashConfig(confData.value);
      }

    } catch (e) {
      console.error("Error al cargar datos en institucional:", e);
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleSearchInventory = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchTerm.trim()) {
      setInventory([]);
      return;
    }
    setLoadingProjects(true);
    try {
      const { data: whData } = await supabase.from('warehouses').select('*');
      const { data: invData } = await supabase
        .from('inventory')
        .select('*')
        .or(`sku.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%`)
        .limit(50);
      
      const foundSkus = (invData || []).map(item => item.sku);
      let stockData: any[] = [];
      if (foundSkus.length > 0) {
        const { data: stData } = await supabase
          .from('inventory_stock')
          .select('*')
          .in('sku', foundSkus);
        stockData = stData || [];
      }

      const whMap: Record<string, string> = {};
      (whData || []).forEach(w => {
        whMap[w.id] = w.name;
      });

      const mappedInventory = (invData || []).map(item => {
        const itemStocks = stockData.filter(s => s.sku === item.sku);
        const bodegasMap: Record<string, number> = {};
        itemStocks.forEach(s => {
          const whName = whMap[s.warehouse_id];
          if (whName) {
            bodegasMap[whName] = parseFloat(s.quantity) || 0;
          }
        });

        const totalQty = Object.values(bodegasMap).reduce((sum, val) => sum + val, 0);

        return {
          id: item.sku,
          sku: item.sku,
          name: item.name,
          category: item.category,
          price: parseFloat(item.price) || 0,
          quantity: totalQty,
          bodegas: bodegasMap
        };
      });

      setInventory(mappedInventory);
    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "Error", description: "No se pudo realizar la búsqueda." });
    } finally {
      setLoadingProjects(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // States
  const [activeTab, setActiveTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [docNumber, setDocNumber] = useState('');
  const [billingConcept, setBillingConcept] = useState(''); 
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Project Creation State
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [newProject, setNewProject] = useState({
    name: '',
    purchaseOrder: '',
    totalBudget: '',
    customerName: '',
    items: [] as any[]
  });
  const [docFile, setDocFile] = useState<ProjectDocument | null>(null);

  // Manual Cost State
  const [manualCost, setManualCost] = useState({
    supplier: '',
    docNumber: '',
    projectId: '',
    items: [] as any[]
  });
  const [manualCostSku, setManualCostSku] = useState('');
  const [manualCostQty, setManualCostQty] = useState<number | string>(1);
  const [manualCostPrice, setManualCostPrice] = useState<number | string>('');

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

      const saleData = {
        project_id: selectedProjectId || null,
        doc_number: docNumber,
        total: totalCart,
        date: new Date().toISOString().split('T')[0],
        items: finalItemsDetail,
        cart_items: cart,
        concept: billingConcept || null,
        customer_name: customerName,
        customer_email: customerEmail || null,
        status: 'COMPLETADA'
      };

      const { data: newSale, error: saleErr } = await supabase
        .from('institutional_sales')
        .insert(saleData)
        .select()
        .single();

      if (saleErr) throw saleErr;

      // Notificar por correo
      const targetEmail = customerEmail || cashConfig?.catchAllEmail;
      if (targetEmail) {
        sendDteEmail({
          recipientEmail: targetEmail,
          customerName,
          docType: 'Factura Institucional',
          docNumber: docNumber || newSale.id,
          total: totalCart,
          items: cart.map(i => ({ name: i.name, quantity: i.quantity, price: i.price }))
        });
      }

      // Descontar inventario de Supabase relacional
      const { data: whList } = await supabase.from('warehouses').select('*');
      const defaultWh = whList?.[0]; // Usar la primera bodega disponible

      if (defaultWh) {
        for (const item of cart) {
          const { data: stockItem } = await supabase
            .from('inventory_stock')
            .select('*')
            .eq('sku', item.sku)
            .eq('warehouse_id', defaultWh.id)
            .maybeSingle();

          const currentQty = stockItem ? parseFloat(stockItem.quantity) || 0 : 0;
          await supabase.from('inventory_stock').upsert({
            sku: item.sku,
            warehouse_id: defaultWh.id,
            quantity: Math.max(0, currentQty - item.quantity)
          }, { onConflict: 'sku,warehouse_id' });
        }
      }

      toast({ title: "Venta Institucional Procesada", description: `Notificación enviada a ${targetEmail || 'sin correo'}` });
      setCart([]);
      setDocNumber('');
      setBillingConcept('');
      setCustomerName('');
      setCustomerEmail('');
      setSelectedProjectId('');
      await loadData();
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Error", description: "No se pudo registrar la venta." });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateProject = async () => {
    if (!newProject.name || !newProject.totalBudget) {
      toast({ variant: "destructive", title: "Datos incompletos" });
      return;
    }
    setIsProcessing(true);
    try {
      const { error } = await supabase.from('institutional_projects').insert({
        name: newProject.name,
        purchase_order: newProject.purchaseOrder || null,
        total_budget: parseFloat(newProject.totalBudget as string),
        customer_name: newProject.customerName || null,
        items: newProject.items,
        status: 'EN CURSO',
        documents: docFile ? [docFile] : []
      });

      if (error) throw error;

      toast({ title: "Proyecto Aperturado", description: "Expediente listo para facturar." });
      setIsProjectModalOpen(false);
      setNewProject({ name: '', purchaseOrder: '', totalBudget: '', customerName: '', items: [] });
      setDocFile(null);
      await loadData();
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Error al crear proyecto" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setDocFile({
        name: file.name,
        data: event.target?.result as string,
        type: file.type,
        date: new Date().toISOString()
      });
      toast({ title: "Archivo Cargado", description: "Documento adjunto al proyecto." });
    };
    reader.readAsDataURL(file);
  };

  const handlePrintReport = () => {
    window.print();
  };

  const handleAddManualCost = async () => {
    if (manualCost.items.length === 0 || !manualCost.projectId) {
      toast({ variant: "destructive", title: "Faltan datos de costo" });
      return;
    }
    setIsProcessing(true);
    const total = manualCost.items.reduce((acc, i) => acc + (i.price * i.quantity), 0);
    try {
      const { error } = await supabase.from('institutional_purchases').insert({
        project_id: manualCost.projectId,
        supplier: manualCost.supplier || null,
        doc_number: manualCost.docNumber || null,
        items: manualCost.items,
        total,
        date: new Date().toISOString().split('T')[0]
      });

      if (error) throw error;

      toast({ title: "Costo Registrado", description: "El balance del proyecto ha sido actualizado." });
      setManualCost({ supplier: '', docNumber: '', projectId: '', items: [] });
      await loadData();
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Error al registrar costo" });
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredInventory = inventory;

  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    return customers.filter(c => 
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      (c.nit && c.nit.toLowerCase().includes(customerSearch.toLowerCase()))
    );
  }, [customerSearch, customers]);

  // Ledger calculation
  const ledgerMovements = useMemo(() => {
    const moves = [
      ...(allSales?.map(s => ({ ...s, type: 'VENTA', color: 'text-emerald-600' })) || []),
      ...(allPurchases?.map(p => ({ ...p, type: 'COSTO', color: 'text-rose-600' })) || [])
    ];
    return moves.sort((a, b) => new Date(b.createdAt || b.timestamp).getTime() - new Date(a.createdAt || a.timestamp).getTime());
  }, [allSales, allPurchases]);

  // Dashboard Calculations
  const totalRevenue = useMemo(() => (allSales || []).reduce((acc, curr) => acc + (curr.total || 0), 0), [allSales]);
  const totalCosts = useMemo(() => (allPurchases || []).reduce((acc, curr) => acc + (curr.total || 0), 0), [allPurchases]);
  const totalProfit = totalRevenue - totalCosts;
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  const chartData = useMemo(() => {
    return ledgerMovements.slice(0, 10).reverse().map(t => ({
      name: t.docNumber || 'S/N',
      value: t.total || 0,
      type: t.type === 'COSTO' ? 'purchase' : 'sale'
    }));
  }, [ledgerMovements]);

  return (
    <div className="min-h-screen bg-transparent p-4 md:p-6 transition-colors duration-300 relative overflow-hidden">
<div className="max-w-7xl mx-auto flex items-center justify-between mb-8 gap-4 bg-white/5 dark:bg-white/5 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-2xl p-4 md:p-5 relative z-10 print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="w-10 h-10 rounded-xl bg-white/5 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10" onClick={() => router.push('/')}>
            <ArrowLeft className="text-slate-800 dark:text-slate-300" size={18} />
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white font-headline leading-tight">NexWay Institucional</h1>
            <p className="text-slate-500 dark:text-white/40 text-[11px] md:text-xs">Control avanzado de proyectos y envío de DTE</p>
          </div>
        </div>
        <ModeToggle />
      </div>

      <div className="max-w-7xl mx-auto print:hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white/5 dark:bg-white/5 backdrop-blur-md border border-slate-200 dark:border-white/10 p-1 rounded-2xl shadow-sm h-auto flex-wrap w-full justify-start overflow-x-auto no-scrollbar">
            <TabsTrigger value="overview" className="rounded-xl px-4 md:px-6 py-2 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs whitespace-nowrap">
              <Activity size={14} className="mr-2"/> Resumen
            </TabsTrigger>
            <TabsTrigger value="billing" className="rounded-xl px-4 md:px-6 py-2 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs whitespace-nowrap">
              <Receipt size={14} className="mr-2"/> Venta Inst.
            </TabsTrigger>
            <TabsTrigger value="projects" className="rounded-xl px-4 md:px-6 py-2 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs whitespace-nowrap">
              <Briefcase size={14} className="mr-2"/> Proyectos
            </TabsTrigger>
            <TabsTrigger value="costs" className="rounded-xl px-4 md:px-6 py-2 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs whitespace-nowrap">
              <ArrowDownCircle size={14} className="mr-2"/> Cargar Costos
            </TabsTrigger>
            <TabsTrigger value="consolidation" className="rounded-xl px-4 md:px-6 py-2 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs whitespace-nowrap">
              <Scale size={14} className="mr-2"/> Consolidación
            </TabsTrigger>
            <TabsTrigger value="ledger" className="rounded-xl px-4 md:px-6 py-2 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs whitespace-nowrap">
              <BookOpen size={14} className="mr-2"/> Libro Mayor
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 outline-none">
            {/* Metric Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card className="relative overflow-hidden bg-white/5 dark:bg-white/5 backdrop-blur-md border border-slate-200 dark:border-white/10 shadow-sm rounded-2xl">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-bold text-slate-500">Ingresos Totales</CardTitle>
                  <DollarSign className="w-4 h-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-black">${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className="text-blue-500 inline-flex items-center">
                      <ArrowUpRight className="w-3 h-3 mr-1" /> General
                    </span>
                  </p>
                </CardContent>
                <div className="absolute bottom-0 left-0 h-1 bg-blue-500 w-full" />
              </Card>

              <Card className="relative overflow-hidden bg-white/5 dark:bg-white/5 backdrop-blur-md border border-slate-200 dark:border-white/10 shadow-sm rounded-2xl">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-bold text-slate-500">Costos Totales</CardTitle>
                  <TrendingDown className="w-4 h-4 text-rose-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-black">${totalCosts.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Procesado en {(allPurchases || []).length} registros
                  </p>
                </CardContent>
                <div className="absolute bottom-0 left-0 h-1 bg-rose-500 w-full" />
              </Card>

              <Card className="relative overflow-hidden bg-white/5 dark:bg-white/5 backdrop-blur-md border border-slate-200 dark:border-white/10 shadow-sm rounded-2xl">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-bold text-slate-500">Beneficio Neto</CardTitle>
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-black">${totalProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Utilidad Bruta Acumulada
                  </p>
                </CardContent>
                <div className="absolute bottom-0 left-0 h-1 bg-emerald-500 w-full" />
              </Card>

              <Card className="relative overflow-hidden bg-white/5 dark:bg-white/5 backdrop-blur-md border border-slate-200 dark:border-white/10 shadow-sm rounded-2xl">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-bold text-slate-500">Margen de Beneficio</CardTitle>
                  <Target className="w-4 h-4 text-purple-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-black">{profitMargin.toFixed(1)}%</div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full mt-3">
                    <div 
                      className="bg-purple-500 h-full rounded-full transition-all duration-1000" 
                      style={{ width: `${Math.min(profitMargin, 100)}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Chart Section */}
            <Card className="w-full bg-white/5 dark:bg-white/5 backdrop-blur-md border border-slate-200 dark:border-white/10 shadow-sm rounded-2xl">
              <CardHeader>
                <CardTitle className="font-bold text-lg">Actividad Financiera Reciente</CardTitle>
                <CardDescription>Visualización de los últimos flujos de compras y ventas institucionales.</CardDescription>
              </CardHeader>
              <CardContent className="pl-2">
                <div className="h-[350px] w-full">
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <XAxis 
                          dataKey="name" 
                          stroke="#888888" 
                          fontSize={11} 
                          tickLine={false} 
                          axisLine={false} 
                        />
                        <YAxis 
                          stroke="#888888" 
                          fontSize={11} 
                          tickLine={false} 
                          axisLine={false} 
                          tickFormatter={(value) => `$${value}`}
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '1rem', fontWeight: 'bold' }}
                          labelFormatter={(label) => `Doc: ${label}`}
                        />
                        <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.type === 'purchase' ? '#f43f5e' : '#3b82f6'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground border-2 border-dashed rounded-2xl">
                      No hay transacciones disponibles para visualización en el gráfico.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="billing" className="grid grid-cols-1 lg:grid-cols-12 gap-6 outline-none">
             <div className="lg:col-span-5 space-y-4">
                <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white/5 dark:bg-white/5 backdrop-blur-md border border-slate-200 dark:border-white/10">
                  <CardHeader className="border-b border-white/10 text-white bg-white/5 p-5">
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
                <Card className="p-4 bg-white/5 dark:bg-white/5 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-2xl space-y-4">
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

                 <form onSubmit={handleSearchInventory} className="relative flex gap-2">
                    <div className="relative flex-1">
                       <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                       <Input placeholder="Buscar suministros (Presione Enter)..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 h-12 bg-white/5 dark:bg-white/5 backdrop-blur-md border border-slate-200 dark:border-white/10 shadow-sm rounded-2xl text-sm font-medium" />
                    </div>
                    <Button type="submit" className="h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl px-6 font-bold shrink-0">
                       Buscar
                    </Button>
                 </form>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                   {filteredInventory.slice(0, 12).map(p => (
                     <div key={p.id} onClick={() => setCart([...cart, { ...p, quantity: 1 }])} className="p-3 bg-white/5 dark:bg-white/5 backdrop-blur-md border border-slate-200 dark:border-white/10 hover:border-blue-500 cursor-pointer transition-all flex flex-col justify-between aspect-square rounded-xl">
                        <p className="text-[9px] font-mono text-muted-foreground">{p.sku}</p>
                        <h4 className="text-[11px] font-bold leading-tight line-clamp-2 h-7">{p.name}</h4>
                        <div className="mt-2 pt-2 border-t border-white/10 flex justify-between items-center">
                           <span className="font-black text-blue-600">${p.price}</span>
                           <PlusCircle size={14} className="text-blue-500" />
                        </div>
                     </div>
                   ))}
                </div>
             </div>
          </TabsContent>

          <TabsContent value="projects" className="space-y-4 outline-none">
            <div className="flex justify-between items-center">
               <h3 className="text-lg font-bold">Expedientes de Licitación</h3>
               <Button onClick={() => setIsProjectModalOpen(true)} className="bg-blue-600 rounded-xl font-bold">
                  <PlusCircle size={16} className="mr-2" /> Aperturar Proyecto
               </Button>
            </div>
            <Card className="bg-white/5 dark:bg-white/5 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden">
               <Table>
                  <TableHeader className="bg-muted/50">
                     <TableRow>
                        <TableHead className="px-6 text-[10px] uppercase">Proyecto</TableHead>
                        <TableHead className="text-[10px] uppercase">Orden Compra</TableHead>
                        <TableHead className="text-right text-[10px] uppercase">Presupuesto</TableHead>
                        <TableHead className="text-center text-[10px] uppercase">Estado</TableHead>
                        <TableHead className="w-20"></TableHead>
                     </TableRow>
                  </TableHeader>
                  <TableBody>
                     {projects?.map(p => (
                        <TableRow key={p.id}>
                           <TableCell className="px-6 py-4">
                              <p className="font-bold text-xs">{p.name}</p>
                              <p className="text-[9px] text-muted-foreground">{p.customerName}</p>
                           </TableCell>
                           <TableCell className="font-mono text-[10px]">{p.purchaseOrder || 'S/N'}</TableCell>
                           <TableCell className="text-right font-black text-xs">${p.totalBudget?.toLocaleString()}</TableCell>
                           <TableCell className="text-center">
                              <Badge className={p.status === 'FINALIZADO' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}>
                                 {p.status}
                              </Badge>
                           </TableCell>
                           <TableCell>
                              <div className="flex gap-1">
                                 <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-500"><Edit3 size={12}/></Button>
                                 <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-500" onClick={async () => {
                                    try {
                                       await supabase.from('institutional_projects').update({ status: 'FINALIZADO' }).eq('id', p.id);
                                       toast({ title: "Proyecto Finalizado" });
                                       await loadData();
                                    } catch (err) {
                                       toast({ variant: "destructive", title: "Error al finalizar proyecto" });
                                    }
                                 }}><CheckCircle size={12}/></Button>
                                 <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500" onClick={async () => {
                                    try {
                                       await supabase.from('institutional_projects').delete().eq('id', p.id);
                                       toast({ title: "Proyecto Eliminado" });
                                       await loadData();
                                    } catch (err) {
                                       toast({ variant: "destructive", title: "Error al eliminar" });
                                    }
                                 }}><Trash2 size={12}/></Button>
                              </div>
                           </TableCell>
                        </TableRow>
                     ))}
                  </TableBody>
               </Table>
            </Card>
          </TabsContent>

          <TabsContent value="costs" className="grid grid-cols-1 lg:grid-cols-12 gap-6 outline-none">
             <div className="lg:col-span-4 space-y-4">
                <Card className="bg-white/5 dark:bg-white/5 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-2xl">
                   <CardHeader className="bg-slate-900 text-white p-5 rounded-t-3xl">
                      <CardTitle className="text-sm">Registro Manual de Costos</CardTitle>
                   </CardHeader>
                   <CardContent className="p-5 space-y-4">
                      <div className="space-y-1">
                         <Label className="text-[9px] font-bold uppercase">Proveedor</Label>
                         <Input value={manualCost.supplier} onChange={e => setManualCost({...manualCost, supplier: e.target.value})} className="h-9 text-xs" />
                      </div>
                      <div className="space-y-1">
                         <Label className="text-[9px] font-bold uppercase">No. Documento</Label>
                         <Input value={manualCost.docNumber} onChange={e => setManualCost({...manualCost, docNumber: e.target.value})} className="h-9 text-xs" />
                      </div>
                      <div className="space-y-1">
                         <Label className="text-[9px] font-bold uppercase">Asignar Proyecto</Label>
                         <Select value={manualCost.projectId} onValueChange={v => setManualCost({...manualCost, projectId: v})}>
                            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                            <SelectContent>{projects?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                         </Select>
                      </div>
                      <div className="pt-4 border-t border-white/10 space-y-2">
                         <Label className="text-[9px] font-bold uppercase">Agregar Suministro</Label>
                         <div className="grid grid-cols-3 gap-2">
                            <Input placeholder="Cant" type="number" value={manualCostQty} onChange={e => setManualCostQty(e.target.value)} className="h-8 text-xs" />
                            <Input placeholder="Costo" type="number" value={manualCostPrice} onChange={e => setManualCostPrice(e.target.value)} className="h-8 text-xs" />
                            <Button size="sm" onClick={() => {
                               setManualCost({
                                  ...manualCost,
                                  items: [...manualCost.items, { name: manualCostSku, quantity: parseFloat(manualCostQty as string), price: parseFloat(manualCostPrice as string) }]
                               });
                               setManualCostSku(''); setManualCostQty(1); setManualCostPrice('');
                            }} className="h-8"><Plus size={14}/></Button>
                         </div>
                         <Input placeholder="Nombre/SKU..." value={manualCostSku} onChange={e => setManualCostSku(e.target.value)} className="h-8 text-xs" />
                      </div>
                      <Button className="w-full bg-emerald-600 rounded-xl font-bold mt-4" onClick={handleAddManualCost} disabled={isProcessing}>
                         GUARDAR COSTO MANUAL
                      </Button>
                   </CardContent>
                </Card>
             </div>
             <div className="lg:col-span-8">
                <Card className="bg-white/5 dark:bg-white/5 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-2xl h-full">
                   <CardHeader className="border-b p-5">
                      <CardTitle className="text-sm">Detalle de Suministros (Factura Física)</CardTitle>
                   </CardHeader>
                   <CardContent className="p-0">
                      <Table>
                         <TableHeader>
                            <TableRow>
                               <TableHead>Cant</TableHead>
                               <TableHead>Descripción</TableHead>
                               <TableHead className="text-right">Costo</TableHead>
                               <TableHead className="text-right">Subtotal</TableHead>
                            </TableRow>
                         </TableHeader>
                         <TableBody>
                             {manualCost.items.map((item, idx) => (
                                <TableRow key={item.name + '-' + idx}>
                                  <TableCell className="text-xs">{item.quantity}</TableCell>
                                  <TableCell className="text-xs font-bold">{item.name}</TableCell>
                                  <TableCell className="text-right text-xs">${item.price.toFixed(2)}</TableCell>
                                  <TableCell className="text-right text-xs font-bold">${(item.price * item.quantity).toFixed(2)}</TableCell>
                               </TableRow>
                            ))}
                         </TableBody>
                      </Table>
                   </CardContent>
                </Card>
             </div>
          </TabsContent>

          <TabsContent value="consolidation" className="space-y-6 outline-none">
             <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="md:col-span-1 p-5 bg-card">
                   <Label className="text-[10px] font-bold uppercase mb-2 block">Seleccionar Proyecto</Label>
                   <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                      <SelectTrigger><SelectValue placeholder="Proyecto..." /></SelectTrigger>
                      <SelectContent>{projects?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                   </Select>
                   {selectedProjectId && (
                     <Button className="w-full mt-6 bg-slate-900 font-bold" onClick={handlePrintReport}>
                        <Printer size={16} className="mr-2" /> Reporte Margen
                     </Button>
                   )}
                </Card>
                <div className="md:col-span-3 space-y-4">
                   <div className="grid grid-cols-3 gap-4">
                      <Card className="p-5 bg-blue-600 text-white"><p className="text-[10px] opacity-60">Adjudicado</p><p className="text-2xl font-black">${projects?.find(p => p.id === selectedProjectId)?.totalBudget?.toLocaleString() || '0'}</p></Card>
                      <Card className="p-5 bg-rose-600 text-white"><p className="text-[10px] opacity-60">Costos Directos</p><p className="text-2xl font-black">${allPurchases?.filter(p => p.projectId === selectedProjectId).reduce((acc, p) => acc + p.total, 0).toLocaleString() || '0'}</p></Card>
                      <Card className="p-5 bg-emerald-600 text-white"><p className="text-[10px] opacity-60">Utilidad Bruta</p><p className="text-2xl font-black">${( (projects?.find(p => p.id === selectedProjectId)?.totalBudget || 0) - (allPurchases?.filter(p => p.projectId === selectedProjectId).reduce((acc, p) => acc + p.total, 0) || 0) ).toLocaleString()}</p></Card>
                   </div>
                   <Card className="border rounded-2xl overflow-hidden bg-white">
                      <Table>
                         <TableHeader className="bg-muted/50"><TableRow><TableHead>Documento</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right">Monto</TableHead></TableRow></TableHeader>
                         <TableBody>
                             {ledgerMovements.filter(m => m.projectId === selectedProjectId).map((m, idx) => (
                                <TableRow key={m.id}><TableCell className="text-xs font-bold">{m.docNumber}</TableCell><TableCell><Badge variant="outline">{m.type}</Badge></TableCell><TableCell className={`text-right font-black ${m.color}`}>${m.total?.toFixed(2)}</TableCell></TableRow>
                            ))}
                         </TableBody>
                      </Table>
                   </Card>
                </div>
             </div>
          </TabsContent>

          <TabsContent value="ledger" className="outline-none">
             <Card className="border rounded-2xl bg-card overflow-hidden">
                <Table>
                   <TableHeader className="bg-muted/50"><TableRow><TableHead className="px-6">Fecha</TableHead><TableHead>Proyecto</TableHead><TableHead>Documento</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right px-6">Monto</TableHead></TableRow></TableHeader>
                   <TableBody>
                       {ledgerMovements.map((m, idx) => (
                          <TableRow key={m.id}>
                            <TableCell className="px-6 text-xs text-muted-foreground">{new Date(m.createdAt || m.timestamp).toLocaleDateString()}</TableCell>
                            <TableCell className="text-xs font-bold">{projects?.find(p => p.id === m.projectId)?.name || 'General'}</TableCell>
                            <TableCell className="text-xs font-mono">{m.docNumber}</TableCell>
                            <TableCell><Badge variant="outline">{m.type}</Badge></TableCell>
                            <TableCell className={`text-right px-6 font-black ${m.color}`}>${m.total?.toFixed(2)}</TableCell>
                         </TableRow>
                      ))}
                   </TableBody>
                </Table>
             </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* MODAL CREAR PROYECTO */}
      <Dialog open={isProjectModalOpen} onOpenChange={setIsProjectModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 rounded-2xl">
           <DialogHeader className="p-6 bg-slate-900 text-white">
              <DialogTitle className="text-xl font-bold flex items-center gap-2"><Briefcase className="text-blue-400"/> Apertura de Expediente Institucional</DialogTitle>
              <DialogDescription className="text-slate-400">Complete los datos de la Orden de Compra y suministros comprometidos.</DialogDescription>
           </DialogHeader>
           <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                 <div className="space-y-4">
                    <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase">Nombre del Proyecto</Label><Input value={newProject.name} onChange={e => setNewProject({...newProject, name: e.target.value})} className="rounded-xl h-11" placeholder="Ej. Licitación MINED 2024..." /></div>
                    <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase">No. Orden de Compra</Label><Input value={newProject.purchaseOrder} onChange={e => setNewProject({...newProject, purchaseOrder: e.target.value})} className="rounded-xl h-11 font-mono" placeholder="OC-123456..." /></div>
                    <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase">Monto Adjudicado ($)</Label><Input type="number" value={newProject.totalBudget} onChange={e => setNewProject({...newProject, totalBudget: e.target.value})} className="rounded-xl h-11 text-lg font-black text-blue-600" /></div>
                    <div className="space-y-1.5">
                       <Label className="text-[10px] font-bold uppercase">Subir Documentación (PDF)</Label>
                       <div className="flex items-center gap-2">
                          <Input type="file" accept=".pdf" onChange={handleFileUpload} className="h-10 p-1 text-xs" />
                          {docFile && <Badge className="bg-emerald-500"><Paperclip size={10} className="mr-1"/> Cargado</Badge>}
                       </div>
                    </div>
                 </div>
                 <div className="space-y-4">
                    <Label className="text-[10px] font-bold uppercase">Suministros Comprometidos</Label>
                    <form onSubmit={handleSearchInventory} className="flex gap-1.5">
                       <div className="relative flex-1">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={12} />
                          <Input placeholder="Buscar en maestro..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-8 h-8 text-xs bg-white" />
                       </div>
                       <Button type="submit" size="sm" className="h-8 text-[10px] font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-2">Buscar</Button>
                    </form>
                    <ScrollArea className="h-[250px] border rounded-2xl p-2 bg-muted/20">
                       {filteredInventory.slice(0, 20).map(p => (
                          <div key={p.id} onClick={() => setNewProject({...newProject, items: [...newProject.items, { ...p, quantity: 1 }]})} className="p-2 hover:bg-card cursor-pointer rounded-lg border-b last:border-0 flex justify-between items-center transition-colors">
                             <div className="flex flex-col"><span className="text-[10px] font-bold leading-tight">{p.name}</span><span className="text-[8px] font-mono text-muted-foreground">{p.sku}</span></div>
                             <PlusCircle size={14} className="text-blue-500" />
                          </div>
                       ))}
                    </ScrollArea>
                 </div>
              </div>
              <div className="border-t border-white/10 pt-4">
                 <Label className="text-[10px] font-bold uppercase mb-2 block">Detalle de Oferta (Total: {newProject.items.length})</Label>
                 <ScrollArea className="h-[150px] border rounded-2xl p-0">
                    <Table>
                       <TableBody>
                           {newProject.items.map((item, idx) => (
                              <TableRow key={item.id || item.name + '-' + idx}><TableCell className="font-bold text-xs">{item.name}</TableCell><TableCell className="text-right text-xs font-black">${item.price}</TableCell><TableCell className="w-10"><Button variant="ghost" size="icon" className="h-6 w-6 text-rose-500" onClick={() => setNewProject({...newProject, items: newProject.items.filter((_, i) => i !== idx)})}><Trash2 size={12}/></Button></TableCell></TableRow>
                          ))}
                       </TableBody>
                    </Table>
                 </ScrollArea>
              </div>
           </div>
           <DialogFooter className="p-6 bg-slate-50 border-t border-white/10">
              <Button className="w-full h-12 bg-blue-600 rounded-xl font-bold shadow-lg" onClick={handleCreateProject} disabled={isProcessing}>
                 {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2" />} FINALIZAR APERTURA
              </Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
