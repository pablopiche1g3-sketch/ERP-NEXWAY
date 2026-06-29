'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Users, 
  ArrowLeft, 
  Search, 
  Trash2, 
  Mail, 
  Phone, 
  MapPin, 
  Hash, 
  BadgeInfo, 
  Building2, 
  User, 
  Briefcase,
  UserCheck,
  Loader2,
  Plus,
  Pencil,
  Lock,
  FileSpreadsheet,
  Upload,
  Download,
  Calendar,
  Settings,
  ClipboardList
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ModeToggle } from '@/components/mode-toggle';
import { PriceListManager } from '@/components/PriceListManager';
import * as XLSX from 'xlsx';

const GIROS_AUTORIZADOS = [
  "Venta de partes, piezas y accesorios para vehículos automotores",
  "Mantenimiento y reparación de vehículos automotores",
  "Venta al por menor de productos de ferretería, pinturas y vidrio",
  "Construcción de edificios residenciales",
  "Venta al por menor de productos farmacéuticos y medicinales",
  "Venta al por mayor de materias primas agropecuarias",
  "Transporte de carga por carretera",
  "Servicios de consultoría en gestión y administración",
  "Actividades de arquitectura e ingeniería",
  "Venta al por menor de artículos de uso doméstico",
  "Servicios de limpieza general de edificios",
  "Venta de comidas y bebidas en restaurantes",
  "Servicios de contabilidad, teneduría de libros y auditoría",
  "Alquiler de bienes inmuebles",
  "Servicios de publicidad y marketing",
  "Otros servicios n.c.p."
];

export default function CustomersTab() {
  const router = useRouter();
  const { toast } = useToast();
  
  // General view tabs
  const [mainTab, setMainTab] = useState('cartera');

  // Customer registration/search states
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('cf');

  const [form, setForm] = useState({
    name: '',
    nit: '',
    nrc: '',
    giro: '',
    email: '',
    phone: '',
    address: '',
    is_authorized_credit: false,
    credit_limit: '0.00',
    credit_days: '30',
    price_list_id: ''
  });

  const [editingCustomer, setEditingCustomer] = useState<any | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    id: '',
    name: '',
    nit: '',
    nrc: '',
    giro: '',
    email: '',
    phone: '',
    address: '',
    type: 'Individual',
    category: 'Consumidor Final',
    is_authorized_credit: false,
    credit_limit: '0.00',
    credit_days: '30',
    price_list_id: ''
  });

  // Modal Authorization States
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [pendingAuthAction, setPendingAuthAction] = useState<'create' | 'edit' | null>(null);

  // Price lists states
  const [priceLists, setPriceLists] = useState<any[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [newListName, setNewListName] = useState('');
  const [priceListItems, setPriceListItems] = useState<any[]>([]);
  const [loadingListItems, setLoadingListItems] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [itemsSearchTerm, setItemsSearchTerm] = useState('');

  // Estados para Búsqueda Histórica de Precios
  const [historyCustId, setHistoryCustId] = useState('');
  const [historyStart, setHistoryStart] = useState('');
  const [historyEnd, setHistoryEnd] = useState('');
  const [historyResults, setHistoryResults] = useState<any[]>([]);
  const [searchingHistory, setSearchingHistory] = useState(false);
  
  // Report monthly states
  const [reportMonth, setReportMonth] = useState('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [customers, setCustomers] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Load state from sessionStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedMainTab = sessionStorage.getItem('cust_mainTab');
      if (storedMainTab) setMainTab(storedMainTab);

      const storedSearch = sessionStorage.getItem('cust_search');
      if (storedSearch) setSearchTerm(storedSearch);
      
      const storedTab = sessionStorage.getItem('cust_activeTab');
      if (storedTab) setActiveTab(storedTab);
      
      const storedForm = sessionStorage.getItem('cust_form');
      if (storedForm) {
        try {
          setForm(JSON.parse(storedForm));
        } catch (e) {}
      }
      
      const storedListId = sessionStorage.getItem('cust_selectedListId');
      if (storedListId) setSelectedListId(storedListId);
    }
  }, []);

  // Save states to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('cust_mainTab', mainTab);
  }, [mainTab]);

  useEffect(() => {
    sessionStorage.setItem('cust_search', searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    sessionStorage.setItem('cust_activeTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    sessionStorage.setItem('cust_form', JSON.stringify(form));
  }, [form]);

  useEffect(() => {
    sessionStorage.setItem('cust_selectedListId', selectedListId);
  }, [selectedListId]);

  const loadCustomersData = async () => {
    try {
      setLoadingData(true);
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setCustomers(data || []);
    } catch (err: any) {
      console.error('Error al cargar clientes:', err);
      toast({
        variant: 'destructive',
        title: 'Error de Conexión',
        description: 'No se pudo cargar la cartera de clientes.'
      });
    } finally {
      setLoadingData(false);
    }
  };

  const loadPriceLists = async () => {
    try {
      const { data, error } = await supabase
        .from('price_lists')
        .select('*')
        .order('name');
      if (error) throw error;
      setPriceLists(data || []);
    } catch (err) {
      console.error('Error al cargar listas de precios:', err);
    }
  };

  const loadPriceListItems = async (listId: string) => {
    if (!listId) {
      setPriceListItems([]);
      return;
    }
    try {
      setLoadingListItems(true);
      const { data, error } = await supabase
        .from('price_list_items')
        .select('*')
        .eq('price_list_id', listId)
        .order('sku');
      if (error) throw error;
      setPriceListItems(data || []);
    } catch (err: any) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los productos de la lista.' });
    } finally {
      setLoadingListItems(false);
    }
  };

  useEffect(() => {
    loadCustomersData();
    loadPriceLists();
  }, []);

  useEffect(() => {
    if (selectedListId) {
      loadPriceListItems(selectedListId);
    } else {
      setPriceListItems([]);
    }
  }, [selectedListId]);

  const handleCreatePriceList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;
    try {
      const { data, error } = await supabase
        .from('price_lists')
        .insert({ name: newListName.trim() })
        .select()
        .single();
      if (error) throw error;
      toast({ title: 'Lista creada', description: `Se creó la lista "${newListName}"` });
      setNewListName('');
      await loadPriceLists();
      if (data) setSelectedListId(data.id);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message || 'No se pudo crear la lista.' });
    }
  };

  const handleDeletePriceList = async () => {
    if (!selectedListId) return;
    if (!confirm('¿Está seguro de eliminar esta lista de precios por completo?')) return;
    try {
      const { error } = await supabase
        .from('price_lists')
        .delete()
        .eq('id', selectedListId);
      if (error) throw error;
      toast({ title: 'Lista eliminada', description: 'La lista de precios fue removida.' });
      setSelectedListId('');
      await loadPriceLists();
      await loadCustomersData(); // Refresh customers in case they were linked to it
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedListId) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        const itemsToInsert = data.map((row: any) => {
          const sku = (row.CODIGO || row.Codigo || row.codigo || row.SKU || row.sku || '').toString().trim().toUpperCase();
          const description = (row.DESCRIPCION || row.Descripcion || row.descripcion || row.NAME || row.name || '');
          const price = parseFloat(row.PRECIO || row.Precio || row.precio || row.PRICE || row.price || '0');

          return {
            price_list_id: selectedListId,
            sku,
            description,
            price
          };
        }).filter(item => item.sku && !isNaN(item.price));

        if (itemsToInsert.length === 0) {
          throw new Error('No se encontraron filas con columnas CODIGO y PRECIO válidas.');
        }

        // Upsert
        const { error } = await supabase
          .from('price_list_items')
          .upsert(itemsToInsert, { onConflict: 'price_list_id,sku' });

        if (error) throw error;

        toast({ title: 'Carga Exitosa', description: `Se importaron ${itemsToInsert.length} productos a la lista.` });
        loadPriceListItems(selectedListId);
      } catch (err: any) {
        console.error(err);
        toast({ variant: 'destructive', title: 'Error al cargar Excel', description: err.message || 'Verifique el formato.' });
      } finally {
        setIsUploading(false);
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleDownloadMonthlyReport = async () => {
    if (!selectedListId || !reportMonth) {
      toast({ variant: 'destructive', title: 'Datos Faltantes', description: 'Selecciona una lista y el mes para el reporte.' });
      return;
    }

    setIsGeneratingReport(true);
    try {
      const year = parseInt(reportMonth.split('-')[0]);
      const month = parseInt(reportMonth.split('-')[1]);
      
      const startDate = new Date(year, month - 1, 1).toISOString();
      const endDate = new Date(year, month, 1).toISOString();

      const { data: salesItems, error } = await supabase
        .from('sales_items')
        .select(`
          sku,
          quantity,
          price,
          subtotal,
          price_list_id,
          sales!inner (
            correlative,
            created_at,
            customer_name
          )
        `)
        .eq('price_list_id', selectedListId)
        .gte('sales.created_at', startDate)
        .lt('sales.created_at', endDate);

      if (error) throw error;

      if (!salesItems || salesItems.length === 0) {
        toast({ title: 'Sin Ventas', description: 'No se registraron ventas para esta lista en el mes seleccionado.' });
        return;
      }

      const reportRows = salesItems.map((item: any) => ({
        'FECHA': new Date(item.sales.created_at).toLocaleDateString('es-SV'),
        'FACTURA': item.sales.correlative,
        'CLIENTE': item.sales.customer_name,
        'CODIGO': item.sku,
        'CANTIDAD': parseFloat(item.quantity) || 0,
        'PRECIO ESPECIAL': parseFloat(item.price) || 0,
        'SUBTOTAL': parseFloat(item.subtotal) || 0
      }));

      const ws = XLSX.utils.json_to_sheet(reportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Reporte Especial');
      
      const listName = priceLists.find(pl => pl.id === selectedListId)?.name || 'Lista';
      XLSX.writeFile(wb, `Reporte_Precios_Especiales_${listName}_${reportMonth}.xlsx`);
      
      toast({ title: 'Reporte Generado', description: 'El reporte se ha descargado correctamente.' });
    } catch (err: any) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: err.message || 'No se pudo generar el reporte.' });
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleSearchPriceHistory = async () => {
    if (!historyCustId) {
      toast({ variant: "destructive", title: "Cliente Requerido", description: "Seleccione un cliente para ver su historial." });
      return;
    }
    setSearchingHistory(true);
    try {
      let query = supabase
        .from('sales')
        .select(`
          id,
          correlative,
          created_at,
          customer_name,
          sales_items (
            sku,
            price,
            quantity,
            inventory (
              name
            )
          )
        `)
        .eq('customer_id', historyCustId);
      
      if (historyStart) {
        query = query.gte('created_at', `${historyStart}T00:00:00Z`);
      }
      if (historyEnd) {
        query = query.lte('created_at', `${historyEnd}T23:59:59Z`);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;

      const results: any[] = [];
      (data || []).forEach((sale: any) => {
        (sale.sales_items || []).forEach((item: any) => {
          results.push({
            date: new Date(sale.created_at).toLocaleDateString(),
            correlative: sale.correlative,
            sku: item.sku,
            productName: item.inventory?.name || 'Producto Desconocido',
            price: parseFloat(item.price) || 0,
            quantity: parseFloat(item.quantity) || 0
          });
        });
      });

      setHistoryResults(results);
      if (results.length === 0) {
        toast({ title: "Sin Resultados", description: "No se encontraron facturas para los filtros aplicados." });
      }
    } catch (err: any) {
      console.error(err);
      toast({ variant: "destructive", title: "Error de Búsqueda", description: err.message });
    } finally {
      setSearchingHistory(false);
    }
  };

  const handleAuthorizeAttempt = (e: React.FormEvent) => {
    e.preventDefault();
    const masterPassword = process.env.NEXT_PUBLIC_ADMIN_PIN || '123456';
    if (authPassword === masterPassword) {
      if (pendingAuthAction === 'create') setForm({...form, is_authorized_credit: true});
      else if (pendingAuthAction === 'edit') setEditForm({...editForm, is_authorized_credit: true});
      setAuthModalOpen(false);
      setAuthPassword('');
      setAuthError('');
    } else {
      setAuthError('Contraseña incorrecta. Contacte a gerencia.');
    }
  };

  const handleCreateCustomer = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!form.name || (activeTab === 'ccf' && (!form.nit || !form.nrc || !form.giro))) {
      toast({ 
        variant: "destructive", 
        title: "Faltan campos", 
        description: activeTab === 'cf' ? "El nombre es obligatorio." : "Nombre, NIT, NRC y Giro son obligatorios." 
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('customers')
        .insert({
          name: form.name,
          nit: form.nit || null,
          nrc: form.nrc || null,
          giro: form.giro || null,
          email: form.email || null,
          phone: form.phone || null,
          address: form.address || null,
          type: activeTab === 'cf' ? 'Individual' : 'Empresa',
          category: activeTab === 'cf' ? 'Consumidor Final' : 'Crédito Fiscal',
          is_authorized_credit: form.is_authorized_credit,
          credit_limit: parseFloat(form.credit_limit) || 0.00,
          credit_days: parseInt(form.credit_days) || 0,
          price_list_id: form.price_list_id || null
        });

      if (error) throw error;

      toast({ title: "Cliente Registrado", description: `${form.name} ha sido añadido.` });
      setForm({
        name: '',
        nit: '',
        nrc: '',
        giro: '',
        email: '',
        phone: '',
        address: '',
        is_authorized_credit: false,
        credit_limit: '0.00',
        credit_days: '30',
        price_list_id: ''
      });
      await loadCustomersData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error al registrar", description: err.message });
    }
  };

  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.name) {
      toast({ variant: "destructive", title: "Faltan campos", description: "El nombre es obligatorio." });
      return;
    }

    try {
      setIsSavingEdit(true);
      const { error } = await supabase
        .from('customers')
        .update({
          name: editForm.name,
          nit: editForm.nit || null,
          nrc: editForm.nrc || null,
          giro: editForm.giro || null,
          email: editForm.email || null,
          phone: editForm.phone || null,
          address: editForm.address || null,
          type: editForm.type,
          category: editForm.category,
          is_authorized_credit: editForm.is_authorized_credit,
          credit_limit: parseFloat(editForm.credit_limit) || 0.00,
          credit_days: parseInt(editForm.credit_days) || 0,
          price_list_id: editForm.price_list_id || null
        })
        .eq('id', editForm.id);

      if (error) throw error;

      toast({ title: "Cliente Actualizado", description: `${editForm.name} ha sido modificado.` });
      setIsEditOpen(false);
      setEditingCustomer(null);
      await loadCustomersData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error al actualizar", description: err.message });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({ title: "Registro Eliminado", description: "El cliente ha sido removido." });
      await loadCustomersData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error al eliminar", description: err.message });
    }
  };

  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    return customers.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (c.nit && c.nit.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [searchTerm, customers]);

  const filteredItems = useMemo(() => {
    if (!priceListItems) return [];
    return priceListItems.filter(item =>
      item.sku.toLowerCase().includes(itemsSearchTerm.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(itemsSearchTerm.toLowerCase()))
    );
  }, [itemsSearchTerm, priceListItems]);

  return (
    <div className="min-h-screen bg-transparent p-4 md:p-6 transition-colors duration-300 relative overflow-hidden">
      <div className="relative z-10 max-w-7xl mx-auto mb-6 bg-white/5 dark:bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 md:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            className="w-10 h-10 rounded-xl bg-white/5 dark:bg-white/5 border border-white/10 hover:bg-white/10 dark:hover:bg-white/10" 
            onClick={() => router.push('/')}
          >
            <ArrowLeft className="text-slate-800 dark:text-slate-300" size={18} />
          </Button>
          <div>
            <h1 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white font-headline leading-tight">Registro de Clientes</h1>
            <p className="text-slate-500 dark:text-white/40 text-[11px] md:text-xs">Gestión de carteras y datos tributarios</p>
          </div>
        </div>
        <ModeToggle />
      </div>

      <Tabs value={mainTab} onValueChange={setMainTab} className="max-w-7xl mx-auto relative z-10 space-y-6">
        <TabsList className="bg-slate-100 dark:bg-white/5 rounded-xl p-1 justify-start h-auto gap-2">
          <TabsTrigger value="cartera" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-white/10 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white text-xs data-[state=active]:shadow-sm px-6 py-2.5 font-bold">
            👤 Cartera de Clientes
          </TabsTrigger>
          <TabsTrigger value="precios" className="rounded-lg data-[state=active]:bg-indigo-600 dark:data-[state=active]:bg-sky-500/30 data-[state=active]:text-white text-xs data-[state=active]:shadow-sm px-6 py-2.5 font-bold">
            🏷️ Precios a Cliente
          </TabsTrigger>
          <TabsTrigger value="historial-precios" className="rounded-lg data-[state=active]:bg-indigo-600 dark:data-[state=active]:bg-sky-500/30 data-[state=active]:text-white text-xs data-[state=active]:shadow-sm px-6 py-2.5 font-bold">
            📊 Historial de Precios
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: CARTERA DE CLIENTES */}
        <TabsContent value="cartera" className="outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-4">
              <Card className="bg-white/5 dark:bg-white/5 backdrop-blur-md border-white/10 shadow-sm rounded-2xl overflow-hidden">
                <CardHeader className="border-b border-slate-200 dark:border-white/10 p-6 bg-slate-50 dark:bg-white/5">
                  <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-white">
                    <Plus size={20} className="text-indigo-600 dark:text-sky-400" />
                    Alta de Cliente
                  </CardTitle>
                  <CardDescription className="text-slate-500 dark:text-slate-400 text-xs">Seleccione el tipo de contribuyente</CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <Tabs defaultValue="cf" value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid grid-cols-2 mb-6 bg-slate-100 dark:bg-white/5 rounded-xl p-1">
                      <TabsTrigger value="cf" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-white/10 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white text-xs data-[state=active]:shadow-sm">
                        <User size={14} className="mr-2" />
                        Consumidor Final
                      </TabsTrigger>
                      <TabsTrigger value="ccf" className="rounded-lg data-[state=active]:bg-indigo-600 dark:data-[state=active]:bg-sky-500/30 data-[state=active]:text-white text-xs data-[state=active]:shadow-sm">
                        <Building2 size={14} className="mr-2" />
                        Crédito Fiscal
                      </TabsTrigger>
                    </TabsList>

                    <form onSubmit={handleCreateCustomer} className="space-y-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Nombre Completo</Label>
                        <div className="relative">
                          <UserCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                          <Input 
                            placeholder={activeTab === 'cf' ? "Ej. Juan Pérez" : "Ej. Industrias El Salvador S.A."}
                            value={form.name}
                            onChange={e => setForm({...form, name: e.target.value})}
                            className="h-10 pl-9 bg-white/5 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-800 dark:text-white"
                          />
                        </div>
                      </div>

                      {activeTab === 'ccf' && (
                        <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">NIT</Label>
                            <div className="relative">
                              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                              <Input 
                                placeholder="0000-000000-000-0" 
                                value={form.nit}
                                onChange={e => setForm({...form, nit: e.target.value})}
                                className="h-10 pl-9 bg-white/5 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-mono font-bold text-slate-800 dark:text-white"
                              />
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">NRC</Label>
                            <div className="relative">
                              <BadgeInfo className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                              <Input 
                                placeholder="Registro..." 
                                value={form.nrc}
                                onChange={e => setForm({...form, nrc: e.target.value})}
                                className="h-10 pl-9 bg-white/5 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-mono font-bold text-slate-800 dark:text-white"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {activeTab === 'ccf' && (
                        <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2">
                          <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Giro Comercial</Label>
                          <Select value={form.giro} onValueChange={(val) => setForm({...form, giro: val})}>
                            <SelectTrigger className="h-11 bg-white/5 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-[11px] font-bold text-slate-800 dark:text-white">
                              <div className="flex items-center gap-2">
                                <Briefcase className="text-slate-400" size={14} />
                                <SelectValue placeholder="Seleccione giro..." />
                              </div>
                            </SelectTrigger>
                            <SelectContent className="max-w-[400px] bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10">
                              {GIROS_AUTORIZADOS.map((giro, idx) => (
                                <SelectItem key={idx} value={giro} className="text-[11px] py-3 text-slate-800 dark:text-white">{giro}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Correo</Label>
                          <Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="h-10 bg-white/5 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-800 dark:text-white" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Teléfono</Label>
                          <Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="h-10 bg-white/5 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-slate-800 dark:text-white" />
                        </div>
                      </div>

                      {/* Lista de Precios Vinculada */}
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Lista de Precios Vinculada</Label>
                        <Select value={form.price_list_id || '__none'} onValueChange={(val) => setForm({...form, price_list_id: val === '__none' ? '' : val})}>
                          <SelectTrigger className="h-10 bg-white/5 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-slate-800 dark:text-white font-bold">
                            <SelectValue placeholder="Sin lista especial (Precios de Lista General)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none">Sin lista especial (General)</SelectItem>
                            {priceLists.map(pl => (
                              <SelectItem key={pl.id} value={pl.id}>{pl.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-3">
                        <h4 className="text-[10px] font-black uppercase text-indigo-600 dark:text-sky-400 tracking-widest flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 dark:bg-sky-400"></span> Control de Crédito
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                          <div className="flex items-center justify-between p-2 bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm">
                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">¿Autorizar?</span>
                            <Switch 
                              checked={form.is_authorized_credit}
                              onCheckedChange={val => {
                                if (val) {
                                  setPendingAuthAction('create');
                                  setAuthModalOpen(true);
                                } else {
                                  setForm({...form, is_authorized_credit: false});
                                }
                              }}
                            />
                          </div>
                          
                          <div className="space-y-1">
                            <Label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Límite ($)</Label>
                            <Input type="number" value={form.credit_limit} onChange={e => setForm({...form, credit_limit: e.target.value})} disabled={!form.is_authorized_credit} className="h-9 bg-white/5 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-indigo-600 dark:text-sky-400 disabled:opacity-50" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Días</Label>
                            <Input type="number" value={form.credit_days} onChange={e => setForm({...form, credit_days: e.target.value})} disabled={!form.is_authorized_credit} className="h-9 bg-white/5 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-indigo-600 dark:text-sky-400 disabled:opacity-50" />
                          </div>
                        </div>
                      </div>

                      <Button type="submit" className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 dark:bg-sky-600 dark:hover:bg-sky-500 rounded-xl font-bold text-white shadow-lg transition-all">
                        Registrar en Cartera
                      </Button>
                    </form>
                  </Tabs>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-7 space-y-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <Input 
                  placeholder="Buscar por nombre o NIT..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-12 h-12 bg-white/5 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-xs md:text-sm text-slate-800 dark:text-white"
                />
              </div>

              <Card className="bg-white/5 dark:bg-white/5 backdrop-blur-md border-white/10 shadow-sm rounded-2xl overflow-hidden">
                <ScrollArea className="h-[550px]">
                  <Table>
                    <TableHeader className="bg-slate-50 dark:bg-white/5 sticky top-0 z-10 border-b border-slate-200 dark:border-white/10">
                      <TableRow>
                        <TableHead className="text-[10px] font-black uppercase px-6 text-slate-700 dark:text-white">Receptor</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-slate-700 dark:text-white">Datos</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingData ? (
                        <TableRow><TableCell colSpan={3} className="text-center py-20"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
                      ) : filteredCustomers.map((customer: any) => (
                        <TableRow key={customer.id} className="hover:bg-slate-50 dark:hover:bg-white/10 border-slate-100 dark:border-white/5">
                          <TableCell className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-800 dark:text-white text-xs">{customer.name}</span>
                              <span className="text-[10px] font-mono text-slate-500">{customer.nit || 'Consumidor Final'}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1.5 items-center flex-wrap">
                              <Badge variant="outline" className={`text-[8px] font-black uppercase ${customer.category === 'Crédito Fiscal' ? 'bg-sky-500/20 text-sky-400' : 'bg-white/10 text-slate-300'}`}>
                                {customer.category}
                              </Badge>
                              {customer.is_authorized_credit ? (
                                <Badge className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[8px] font-black uppercase">
                                  CRED: ${parseFloat(customer.credit_limit || 0).toFixed(2)} | {customer.credit_days || 0} DÍAS
                                </Badge>
                              ) : null}
                              {customer.price_list_id && (
                                <Badge className="bg-amber-500/20 text-amber-500 border border-amber-500/30 text-[8px] font-black uppercase">
                                  LISTA: {priceLists.find(pl => pl.id === customer.price_list_id)?.name || 'Especial'}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => {
                                  setEditForm({
                                    id: customer.id,
                                    name: customer.name,
                                    nit: customer.nit || '',
                                    nrc: customer.nrc || '',
                                    giro: customer.giro || '',
                                    email: customer.email || '',
                                    phone: customer.phone || '',
                                    address: customer.address || '',
                                    type: customer.type,
                                    category: customer.category,
                                    is_authorized_credit: !!customer.is_authorized_credit,
                                    credit_limit: (customer.credit_limit || 0).toString(),
                                    credit_days: (customer.credit_days || 30).toString(),
                                    price_list_id: customer.price_list_id || ''
                                  });
                                  setIsEditOpen(true);
                                }}
                                className="h-8 w-8"
                              >
                                <Pencil size={13} />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDeleteCustomer(customer.id)} className="h-8 w-8 text-rose-500">
                                <Trash2 size={13} />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: PRECIOS A CLIENTE (Manejo de Listas y Reportes) */}
        <TabsContent value="precios" className="outline-none">
          <PriceListManager />
        </TabsContent>

        <TabsContent value="historial-precios" className="outline-none animate-in fade-in duration-300">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* PANEL DE FILTROS */}
            <div className="lg:col-span-4 space-y-4">
              <Card className="bg-white/5 backdrop-blur-md border border-slate-200 dark:border-white/10 shadow-sm rounded-2xl overflow-hidden text-white">
                <CardHeader className="border-b border-slate-200 dark:border-white/10 p-5 bg-slate-50 dark:bg-white/5">
                  <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800 dark:text-white">
                    <Search size={16} className="text-indigo-500" />
                    Filtros de Búsqueda
                  </CardTitle>
                  <CardDescription className="text-xs text-white/50">Filtre precios históricos facturados a sus clientes.</CardDescription>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                  
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Seleccionar Cliente</Label>
                    <Select value={historyCustId} onValueChange={setHistoryCustId}>
                      <SelectTrigger className="h-10 bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold text-white">
                        <SelectValue placeholder="Busque o seleccione cliente..." />
                      </SelectTrigger>
                      <SelectContent>
                        {customers.map((c: any) => (
                          <SelectItem key={c.id} value={c.id} className="text-xs">
                            {c.nit ? `[${c.nit}] ` : ''}{c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Desde</Label>
                      <Input 
                        type="date"
                        value={historyStart}
                        onChange={e => setHistoryStart(e.target.value)}
                        className="h-10 bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-white font-bold"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Hasta</Label>
                      <Input 
                        type="date"
                        value={historyEnd}
                        onChange={e => setHistoryEnd(e.target.value)}
                        className="h-10 bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-xl text-xs text-white font-bold"
                      />
                    </div>
                  </div>

                  <Button 
                    onClick={handleSearchPriceHistory}
                    disabled={searchingHistory || !historyCustId}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 rounded-xl text-xs"
                  >
                    {searchingHistory ? <Loader2 className="animate-spin mr-1" /> : <Search size={14} className="mr-1.5" />}
                    CONSULTAR PRECIOS
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* TABLA DE RESULTADOS */}
            <div className="lg:col-span-8">
              <Card className="bg-white/5 backdrop-blur-md border border-slate-200 dark:border-white/10 shadow-sm rounded-2xl overflow-hidden">
                <CardHeader className="border-b border-slate-200 dark:border-white/10 p-5 bg-slate-50 dark:bg-white/5">
                  <CardTitle className="text-sm font-bold text-slate-800 dark:text-white">Precios Facturados Previamente</CardTitle>
                  <CardDescription className="text-xs">Registro histórico de artículos y precios unitarios asignados.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-white/5 border-b border-white/10">
                      <TableRow>
                        <TableHead className="text-[10px] font-black uppercase text-slate-400 pl-6">Fecha</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-slate-400">Producto</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-slate-400">Factura / Correlativo</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-slate-400 text-center">Cantidad</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-slate-400 text-right pr-6">Precio Unitario</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {searchingHistory ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-16 text-slate-400 dark:text-muted-foreground text-xs italic">
                            Consultando base de datos de ventas...
                          </TableCell>
                        </TableRow>
                      ) : historyResults.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-16 text-slate-400 dark:text-muted-foreground text-xs italic">
                            Seleccione un cliente y aplique filtros para ver el historial de facturación.
                          </TableCell>
                        </TableRow>
                      ) : historyResults.map((row, idx) => (
                        <TableRow key={idx} className="hover:bg-white/5 border-b border-white/5">
                          <TableCell className="pl-6 text-xs text-slate-400">
                            {row.date}
                          </TableCell>
                          <TableCell className="text-xs">
                            <span className="font-mono text-indigo-500 font-bold block">{row.sku}</span>
                            <span className="font-semibold text-slate-800 dark:text-white block">{row.productName}</span>
                          </TableCell>
                          <TableCell className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
                            {row.correlative}
                          </TableCell>
                          <TableCell className="text-center text-xs text-slate-900 dark:text-white font-bold">
                            {row.quantity} un.
                          </TableCell>
                          <TableCell className="text-right text-xs font-mono font-black text-emerald-600 dark:text-emerald-400 pr-6">
                            ${row.price.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

          </div>
        </TabsContent>
      </Tabs>

      {/* MODAL DE EDICIÓN DE CLIENTE */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-6">
          <form onSubmit={handleUpdateCustomer} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-400">Nombre</Label>
              <Input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="h-10 bg-white/5 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl" />
            </div>

            {/* Selector de Lista de Precios en Editar */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-400">Lista de Precios Vinculada</Label>
              <Select value={editForm.price_list_id || '__none'} onValueChange={(val) => setEditForm({...editForm, price_list_id: val === '__none' ? '' : val})}>
                <SelectTrigger className="h-10 bg-white/5 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold">
                  <SelectValue placeholder="Sin lista especial" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Sin lista especial (General)</SelectItem>
                  {priceLists.map(pl => (
                    <SelectItem key={pl.id} value={pl.id}>{pl.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-3">
              <h4 className="text-[10px] font-black uppercase text-indigo-600 dark:text-sky-400">Control de Crédito</h4>
              <div className="grid grid-cols-2 gap-4 items-center">
                <div className="flex items-center justify-between p-2 bg-white dark:bg-white/5 rounded-xl border border-slate-200 col-span-2 md:col-span-1">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">¿Autorizar?</span>
                  <Switch 
                    checked={editForm.is_authorized_credit}
                    onCheckedChange={val => {
                      if (val) {
                        setPendingAuthAction('edit');
                        setAuthModalOpen(true);
                      } else {
                        setEditForm({...editForm, is_authorized_credit: false});
                      }
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase">Límite ($)</Label>
                  <Input type="number" value={editForm.credit_limit} onChange={e => setEditForm({...editForm, credit_limit: e.target.value})} disabled={!editForm.is_authorized_credit} className="h-9 bg-white/5 rounded-xl" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase">Días</Label>
                  <Input type="number" value={editForm.credit_days} onChange={e => setEditForm({...editForm, credit_days: e.target.value})} disabled={!editForm.is_authorized_credit} className="h-9 bg-white/5 rounded-xl" />
                </div>
              </div>
            </div>
            <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 rounded-xl text-white font-bold h-11">Guardar Cambios</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL DE AUTORIZACIÓN PIN GERENCIAL */}
      <Dialog open={authModalOpen} onOpenChange={(open) => {
        if (!open) {
          setAuthModalOpen(false);
          setAuthPassword('');
          setAuthError('');
        }
      }}>
        <DialogContent className="max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800 dark:text-white text-lg font-black uppercase">
              <Lock className="text-indigo-600 dark:text-sky-500" size={20} />
              Autorización
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAuthorizeAttempt} className="space-y-4">
            <Input 
              type="password"
              placeholder="••••••••"
              value={authPassword}
              onChange={e => setAuthPassword(e.target.value)}
              className="h-12 text-center text-lg tracking-[0.5em] bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl font-bold"
              autoFocus
            />
            {authError && <p className="text-[10px] text-rose-500 font-bold text-center">{authError}</p>}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setAuthModalOpen(false)} className="rounded-xl flex-1 text-xs">Cancelar</Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 rounded-xl flex-1 text-xs text-white">Autorizar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
