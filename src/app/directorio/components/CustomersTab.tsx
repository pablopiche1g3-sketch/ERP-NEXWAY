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
  ClipboardList,
  Eye,
  MessageCircle,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  FileText,
  DollarSign,
  TrendingUp,
  ShieldCheck,
  Filter,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
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

export interface CustomerRecord {
  id: string;
  name: string;
  commercial_name?: string;
  nit?: string;
  nrc?: string;
  giro?: string;
  email?: string;
  phone?: string;
  address?: string;
  department?: string;
  municipality?: string;
  type?: string;
  category?: string;
  is_authorized_credit?: boolean;
  credit_limit?: number;
  credit_days?: number;
  balance?: number;
  is_gran_contribuyente?: boolean;
  notes?: string;
  price_list_id?: string;
  created_at?: string;
}

export default function CustomersTab() {
  const router = useRouter();
  const { toast } = useToast();
  
  // Pestaña principal
  const [mainTab, setMainTab] = useState('cartera');

  // Búsqueda y filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'cf' | 'ccf' | 'credit'>('all');
  const [activeFormTab, setActiveFormTab] = useState<'cf' | 'ccf'>('cf');

  // Formulario de Alta
  const [form, setForm] = useState({
    name: '',
    commercial_name: '',
    nit: '',
    nrc: '',
    giro: '',
    email: '',
    phone: '',
    address: '',
    department: 'San Salvador',
    municipality: 'San Salvador Centro',
    is_authorized_credit: false,
    credit_limit: '0.00',
    credit_days: '30',
    is_gran_contribuyente: false,
    price_list_id: '',
    notes: ''
  });

  // Modal de Edición
  const [editingCustomer, setEditingCustomer] = useState<CustomerRecord | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    id: '',
    name: '',
    commercial_name: '',
    nit: '',
    nrc: '',
    giro: '',
    email: '',
    phone: '',
    address: '',
    department: 'San Salvador',
    municipality: 'San Salvador Centro',
    type: 'Individual',
    category: 'Consumidor Final',
    is_authorized_credit: false,
    credit_limit: '0.00',
    credit_days: '30',
    is_gran_contribuyente: false,
    price_list_id: '',
    notes: ''
  });

  // Modal de Ficha 360°
  const [selectedCust360, setSelectedCust360] = useState<CustomerRecord | null>(null);
  const [custSalesHistory, setCustSalesHistory] = useState<any[]>([]);
  const [loadingCustSales, setLoadingCustSales] = useState(false);

  // Listas de Precios
  const [priceLists, setPriceLists] = useState<any[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [newListName, setNewListName] = useState('');
  const [priceListItems, setPriceListItems] = useState<any[]>([]);
  const [loadingListItems, setLoadingListItems] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [itemsSearchTerm, setItemsSearchTerm] = useState('');

  // Clientes cargados
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Cargar datos
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

  // Cargar historial de ventas al abrir Ficha 360°
  const handleOpen360Modal = async (cust: CustomerRecord) => {
    setSelectedCust360(cust);
    setLoadingCustSales(true);
    try {
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .or(`customer_id.eq.${cust.id},customer_name.ilike.%${cust.name}%`)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!error && data) {
        setCustSalesHistory(data);
      } else {
        setCustSalesHistory([]);
      }
    } catch (e) {
      setCustSalesHistory([]);
    } finally {
      setLoadingCustSales(false);
    }
  };

  // Crear Cliente
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast({ variant: 'destructive', title: 'Campo Obligatorio', description: 'El nombre o razón social es requerido.' });
      return;
    }

    try {
      const payload: any = {
        name: form.name.trim(),
        commercial_name: form.commercial_name.trim() || null,
        nit: form.nit.trim() || null,
        nrc: form.nrc.trim() || null,
        giro: form.giro.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        department: form.department || 'San Salvador',
        municipality: form.municipality || 'San Salvador Centro',
        type: activeFormTab === 'cf' ? 'Individual' : 'Empresa',
        category: activeFormTab === 'cf' ? 'Consumidor Final' : 'Crédito Fiscal',
        is_authorized_credit: form.is_authorized_credit,
        credit_limit: parseFloat(form.credit_limit) || 0.00,
        credit_days: parseInt(form.credit_days) || 30,
        is_gran_contribuyente: form.is_gran_contribuyente,
        price_list_id: form.price_list_id || null,
        notes: form.notes.trim() || null
      };

      const { error } = await supabase.from('customers').insert(payload);
      if (error) throw error;

      toast({ 
        title: "Cliente Registrado con Éxito", 
        description: `${form.name} se incorporó a la cartera comercial.` 
      });

      setForm({
        name: '',
        commercial_name: '',
        nit: '',
        nrc: '',
        giro: '',
        email: '',
        phone: '',
        address: '',
        department: 'San Salvador',
        municipality: 'San Salvador Centro',
        is_authorized_credit: false,
        credit_limit: '0.00',
        credit_days: '30',
        is_gran_contribuyente: false,
        price_list_id: '',
        notes: ''
      });

      await loadCustomersData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error al registrar", description: err.message });
    }
  };

  // Actualizar Cliente
  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.name.trim()) {
      toast({ variant: 'destructive', title: 'Faltan campos', description: 'El nombre es obligatorio.' });
      return;
    }

    try {
      setIsSavingEdit(true);
      const { error } = await supabase
        .from('customers')
        .update({
          name: editForm.name.trim(),
          commercial_name: editForm.commercial_name.trim() || null,
          nit: editForm.nit.trim() || null,
          nrc: editForm.nrc.trim() || null,
          giro: editForm.giro.trim() || null,
          email: editForm.email.trim() || null,
          phone: editForm.phone.trim() || null,
          address: editForm.address.trim() || null,
          department: editForm.department || 'San Salvador',
          municipality: editForm.municipality || 'San Salvador Centro',
          type: editForm.type,
          category: editForm.category,
          is_authorized_credit: editForm.is_authorized_credit,
          credit_limit: parseFloat(editForm.credit_limit) || 0.00,
          credit_days: parseInt(editForm.credit_days) || 30,
          is_gran_contribuyente: editForm.is_gran_contribuyente,
          price_list_id: editForm.price_list_id || null,
          notes: editForm.notes.trim() || null
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

  // Eliminar Cliente
  const handleDeleteCustomer = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar este cliente de la cartera?')) return;
    try {
      const { error } = await supabase.from('customers').delete().eq('id', id);
      if (error) throw error;
      toast({ title: "Cliente Removido", description: "El registro ha sido eliminado." });
      await loadCustomersData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error al eliminar", description: err.message });
    }
  };

  // Exportar a Excel
  const handleExportToExcel = () => {
    if (customers.length === 0) {
      toast({ variant: 'destructive', title: 'Sin Datos', description: 'No hay clientes para exportar.' });
      return;
    }

    const exportRows = customers.map(c => ({
      "Nombre / Razón Social": c.name,
      "Nombre Comercial": c.commercial_name || '',
      "Categoría": c.category || 'Consumidor Final',
      "Tipo": c.type || 'Individual',
      "NIT": c.nit || '',
      "NRC": c.nrc || '',
      "Giro Comercial": c.giro || '',
      "Gran Contribuyente": c.is_gran_contribuyente ? 'SÍ' : 'NO',
      "Teléfono": c.phone || '',
      "Correo Electrónico": c.email || '',
      "Dirección": c.address || '',
      "Departamento": c.department || '',
      "Municipio": c.municipality || '',
      "Crédito Autorizado": c.is_authorized_credit ? 'SÍ' : 'NO',
      "Límite Crédito ($)": c.credit_limit || 0,
      "Plazo (Días)": c.credit_days || 0,
      "Fecha Registro": c.created_at ? new Date(c.created_at).toLocaleDateString() : ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cartera_Clientes");
    XLSX.writeFile(wb, `Cartera_Clientes_NexWay_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast({ title: "Exportación Completada", description: `Se descargaron ${customers.length} registros en Excel.` });
  };

  // Métricas Calculadas
  const stats = useMemo(() => {
    const total = customers.length;
    const ccfCount = customers.filter(c => c.category === 'Crédito Fiscal').length;
    const cfCount = total - ccfCount;
    const creditCount = customers.filter(c => c.is_authorized_credit).length;
    const totalCreditLimit = customers.reduce((acc, c) => acc + (Number(c.credit_limit) || 0), 0);
    const granContribCount = customers.filter(c => c.is_gran_contribuyente).length;

    return { total, ccfCount, cfCount, creditCount, totalCreditLimit, granContribCount };
  }, [customers]);

  // Filtrado reactivo
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const q = searchTerm.toLowerCase().trim();
      const matchSearch = !q || (
        c.name.toLowerCase().includes(q) ||
        (c.commercial_name && c.commercial_name.toLowerCase().includes(q)) ||
        (c.nit && c.nit.toLowerCase().includes(q)) ||
        (c.nrc && c.nrc.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q)) ||
        (c.giro && c.giro.toLowerCase().includes(q))
      );

      const matchType = 
        typeFilter === 'all' ||
        (typeFilter === 'cf' && c.category === 'Consumidor Final') ||
        (typeFilter === 'ccf' && c.category === 'Crédito Fiscal') ||
        (typeFilter === 'credit' && c.is_authorized_credit);

      return matchSearch && matchType;
    });
  }, [searchTerm, typeFilter, customers]);

  return (
    <div className="min-h-screen bg-transparent p-4 md:p-6 transition-colors duration-300 relative overflow-hidden space-y-6">
      
      {/* HEADER PRINCIPAL */}
      <div className="max-w-7xl mx-auto bg-card/60 backdrop-blur-md border border-border/60 rounded-2xl p-4 md:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="icon" 
            className="w-9 h-9 rounded-xl border-border/60 hover:bg-muted" 
            onClick={() => router.push('/')}
          >
            <ArrowLeft className="text-foreground" size={16} />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-500" />
              <h1 className="text-lg md:text-xl font-bold text-foreground font-headline leading-tight">
                Directorio Comercial & Cartera 360°
              </h1>
            </div>
            <p className="text-muted-foreground text-xs mt-0.5">
              Gestión integral de clientes, datos fiscales DTE, control de líneas de crédito y listas de precios.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportToExcel}
            className="h-8 text-xs font-semibold gap-1.5 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
          >
            <FileSpreadsheet size={13} />
            Exportar Excel
          </Button>
          <ModeToggle />
        </div>
      </div>

      {/* TARJETAS DE KPIs EJECUTIVOS */}
      <div className="max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border/60 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Clientes</div>
              <div className="text-2xl font-black text-foreground">{stats.total}</div>
              <div className="text-[10px] text-muted-foreground">{stats.cfCount} CF • {stats.ccfCount} Empresas CCF</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <Users size={20} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/60 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Créditos Autorizados</div>
              <div className="text-2xl font-black text-emerald-500">{stats.creditCount}</div>
              <div className="text-[10px] text-muted-foreground">Clientes con línea activa</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <CreditCard size={20} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/60 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Límite Global de Cartera</div>
              <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                ${stats.totalCreditLimit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-muted-foreground">Cupo rotativo total</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <DollarSign size={20} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/60 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Grandes Contribuyentes</div>
              <div className="text-2xl font-black text-amber-500">{stats.granContribCount}</div>
              <div className="text-[10px] text-muted-foreground">Aplica 1% Retención IVA</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <ShieldCheck size={20} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* PESTAÑAS PRINCIPALES */}
      <Tabs value={mainTab} onValueChange={setMainTab} className="max-w-7xl mx-auto space-y-6">
        <TabsList className="bg-muted/40 border border-border/60 rounded-xl p-1 justify-start h-auto gap-1">
          <TabsTrigger value="cartera" className="rounded-lg text-xs px-5 py-2 font-bold gap-1.5">
            <Users size={14} /> Cartera de Clientes (Directorio 360°)
          </TabsTrigger>
          <TabsTrigger value="precios" className="rounded-lg text-xs px-5 py-2 font-bold gap-1.5">
            <Settings size={14} /> Listas de Precios Personalizadas
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: CARTERA DE CLIENTES */}
        <TabsContent value="cartera" className="outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Formulario Lateral: Alta de Cliente */}
            <div className="lg:col-span-4 space-y-4">
              <Card className="border-border/60 shadow-sm rounded-2xl overflow-hidden">
                <CardHeader className="border-b border-border/50 p-4 bg-muted/20">
                  <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                    <Plus size={16} className="text-indigo-500" />
                    Registrar Nuevo Cliente
                  </CardTitle>
                  <CardDescription className="text-muted-foreground text-xs">
                    Ingresa los datos para facturación electrónica y crédito.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                  <Tabs value={activeFormTab} onValueChange={(v: any) => setActiveFormTab(v)} className="w-full">
                    <TabsList className="grid grid-cols-2 mb-4 bg-muted/40 rounded-xl p-1">
                      <TabsTrigger value="cf" className="rounded-lg text-xs font-semibold">
                        <User size={12} className="mr-1.5" /> Consumidor Final
                      </TabsTrigger>
                      <TabsTrigger value="ccf" className="rounded-lg text-xs font-semibold">
                        <Building2 size={12} className="mr-1.5" /> Crédito Fiscal
                      </TabsTrigger>
                    </TabsList>

                    <form onSubmit={handleCreateCustomer} className="space-y-3.5">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">
                          Nombre Completo / Razón Social *
                        </Label>
                        <Input 
                          placeholder={activeFormTab === 'cf' ? "Ej. Juan Carlos Pérez" : "Ej. Distribuidora Salvadoreña S.A. de C.V."}
                          value={form.name}
                          onChange={e => setForm({...form, name: e.target.value})}
                          className="h-9 text-xs font-semibold"
                          required
                        />
                      </div>

                      {activeFormTab === 'ccf' && (
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">
                            Nombre Comercial (Opcional)
                          </Label>
                          <Input 
                            placeholder="Ej. Súper Tienda El Ahorro"
                            value={form.commercial_name}
                            onChange={e => setForm({...form, commercial_name: e.target.value})}
                            className="h-8 text-xs"
                          />
                        </div>
                      )}

                      {activeFormTab === 'ccf' && (
                        <div className="grid grid-cols-2 gap-2.5">
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">NIT</Label>
                            <Input 
                              placeholder="0614-000000-000-0" 
                              value={form.nit}
                              onChange={e => setForm({...form, nit: e.target.value})}
                              className="h-8 text-xs font-mono font-semibold"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">NRC</Label>
                            <Input 
                              placeholder="Registro..." 
                              value={form.nrc}
                              onChange={e => setForm({...form, nrc: e.target.value})}
                              className="h-8 text-xs font-mono font-semibold"
                            />
                          </div>
                        </div>
                      )}

                      {activeFormTab === 'ccf' && (
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Giro Comercial Oficial</Label>
                          <Select value={form.giro} onValueChange={(val) => setForm({...form, giro: val})}>
                            <SelectTrigger className="h-8 text-xs font-medium">
                              <SelectValue placeholder="Seleccione giro del contribuyente..." />
                            </SelectTrigger>
                            <SelectContent className="max-w-[340px]">
                              {GIROS_AUTORIZADOS.map((giro, idx) => (
                                <SelectItem key={idx} value={giro} className="text-xs py-2">{giro}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Teléfono / WhatsApp</Label>
                          <Input 
                            value={form.phone} 
                            onChange={e => setForm({...form, phone: e.target.value})} 
                            placeholder="7000-0000" 
                            className="h-8 text-xs font-medium" 
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Correo DTE</Label>
                          <Input 
                            type="email" 
                            value={form.email} 
                            onChange={e => setForm({...form, email: e.target.value})} 
                            placeholder="cliente@mail.com" 
                            className="h-8 text-xs" 
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Dirección Física</Label>
                        <Input 
                          value={form.address} 
                          onChange={e => setForm({...form, address: e.target.value})} 
                          placeholder="Calle principal, Local #2..." 
                          className="h-8 text-xs" 
                        />
                      </div>

                      {/* Lista de Precios */}
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Lista de Precios Vinculada</Label>
                        <Select value={form.price_list_id || '__none'} onValueChange={(val) => setForm({...form, price_list_id: val === '__none' ? '' : val})}>
                          <SelectTrigger className="h-8 text-xs font-semibold">
                            <SelectValue placeholder="Precio General (Por Defecto)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none" className="text-xs">Precio General (Sin Lista Especial)</SelectItem>
                            {priceLists.map(pl => (
                              <SelectItem key={pl.id} value={pl.id} className="text-xs">{pl.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Control de Crédito */}
                      <div className="p-3 rounded-xl bg-muted/20 border border-border/60 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                              <CreditCard size={13} className="text-indigo-500" /> Línea de Crédito
                            </div>
                            <p className="text-[10px] text-muted-foreground">Autorizar compras a plazo</p>
                          </div>
                          <Switch 
                            checked={form.is_authorized_credit}
                            onCheckedChange={val => setForm({...form, is_authorized_credit: val})}
                          />
                        </div>

                        {form.is_authorized_credit && (
                          <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-border/40 animate-in fade-in">
                            <div className="space-y-1">
                              <Label className="text-[9px] font-bold uppercase text-muted-foreground">Límite ($)</Label>
                              <Input 
                                type="number" 
                                value={form.credit_limit} 
                                onChange={e => setForm({...form, credit_limit: e.target.value})} 
                                className="h-7 text-xs font-bold text-emerald-600 dark:text-emerald-400" 
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[9px] font-bold uppercase text-muted-foreground">Plazo (Días)</Label>
                              <Input 
                                type="number" 
                                value={form.credit_days} 
                                onChange={e => setForm({...form, credit_days: e.target.value})} 
                                className="h-7 text-xs font-bold" 
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <Button 
                        type="submit" 
                        className="w-full h-9 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-sm gap-1.5"
                      >
                        <Plus size={14} /> Registrar en Cartera
                      </Button>
                    </form>
                  </Tabs>
                </CardContent>
              </Card>
            </div>

            {/* Panel Central/Derecho: Tabla Densa y Filtros */}
            <div className="lg:col-span-8 space-y-4">
              
              {/* Barra de Filtros */}
              <div className="bg-card p-3 rounded-2xl border border-border/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-sm">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                  <Input 
                    placeholder="Buscar por nombre, NIT, NRC, giro o teléfono..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-8 h-8 text-xs bg-background"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <Button 
                    size="sm" 
                    variant={typeFilter === 'all' ? 'default' : 'outline'}
                    onClick={() => setTypeFilter('all')}
                    className="h-8 text-xs px-2.5"
                  >
                    Todos ({stats.total})
                  </Button>
                  <Button 
                    size="sm" 
                    variant={typeFilter === 'ccf' ? 'default' : 'outline'}
                    onClick={() => setTypeFilter('ccf')}
                    className="h-8 text-xs px-2.5"
                  >
                    Empresas ({stats.ccfCount})
                  </Button>
                  <Button 
                    size="sm" 
                    variant={typeFilter === 'credit' ? 'default' : 'outline'}
                    onClick={() => setTypeFilter('credit')}
                    className="h-8 text-xs px-2.5 text-emerald-600 dark:text-emerald-400"
                  >
                    Con Crédito ({stats.creditCount})
                  </Button>
                </div>
              </div>

              {/* Tabla de Clientes de Alta Densidad */}
              <Card className="border-border/60 shadow-sm rounded-2xl overflow-hidden">
                <ScrollArea className="h-[600px]">
                  <Table>
                    <TableHeader className="bg-muted/40 sticky top-0 z-10 border-b border-border/50 text-[11px]">
                      <TableRow>
                        <TableHead className="px-4">Cliente & Categoría</TableHead>
                        <TableHead>Datos Fiscales DTE</TableHead>
                        <TableHead>Contacto Rápido</TableHead>
                        <TableHead>Condiciones / Crédito</TableHead>
                        <TableHead className="text-right px-4">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingData ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-20">
                            <Loader2 className="animate-spin mx-auto text-indigo-500 h-6 w-6" />
                            <span className="text-xs text-muted-foreground mt-2 block">Cargando directorio comercial...</span>
                          </TableCell>
                        </TableRow>
                      ) : filteredCustomers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-16 text-xs text-muted-foreground">
                            No se encontraron clientes que coincidan con la búsqueda.
                          </TableCell>
                        </TableRow>
                      ) : filteredCustomers.map((customer) => {
                        const cleanPhone = customer.phone ? customer.phone.replace(/[^0-9]/g, '') : '';
                        const waLink = cleanPhone ? `https://wa.me/503${cleanPhone}` : null;
                        const creditLimit = Number(customer.credit_limit || 0);

                        return (
                          <TableRow key={customer.id} className="hover:bg-muted/30 border-border/40 text-xs">
                            {/* 1. Cliente & Categoría */}
                            <TableCell className="px-4 py-3">
                              <div className="space-y-1">
                                <div className="font-bold text-foreground flex items-center gap-1.5">
                                  <span>{customer.name}</span>
                                  {customer.is_gran_contribuyente && (
                                    <Badge className="bg-amber-500 text-white text-[8px] h-4 px-1 font-bold">
                                      Gran Contrib.
                                    </Badge>
                                  )}
                                </div>
                                {customer.commercial_name && (
                                  <div className="text-[10px] text-muted-foreground italic">
                                    "{customer.commercial_name}"
                                  </div>
                                )}
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <Badge variant="outline" className={`text-[9px] font-semibold ${
                                    customer.category === 'Crédito Fiscal' 
                                      ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/30' 
                                      : 'bg-muted text-muted-foreground'
                                  }`}>
                                    {customer.category || 'Consumidor Final'}
                                  </Badge>
                                  {customer.address && (
                                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 truncate max-w-[150px]" title={customer.address}>
                                      <MapPin size={10} /> {customer.address}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </TableCell>

                            {/* 2. Datos Fiscales DTE */}
                            <TableCell className="py-3">
                              <div className="space-y-0.5 font-mono text-[10px]">
                                {customer.nit && (
                                  <div className="text-foreground font-semibold">NIT: {customer.nit}</div>
                                )}
                                {customer.nrc && (
                                  <div className="text-muted-foreground">NRC: {customer.nrc}</div>
                                )}
                                {customer.giro && (
                                  <div className="text-[9px] font-sans text-muted-foreground truncate max-w-[180px]" title={customer.giro}>
                                    {customer.giro}
                                  </div>
                                )}
                                {!customer.nit && !customer.nrc && (
                                  <span className="text-muted-foreground font-sans italic text-[10px]">Sin Registro Tributario</span>
                                )}
                              </div>
                            </TableCell>

                            {/* 3. Contacto Rápido */}
                            <TableCell className="py-3">
                              <div className="flex items-center gap-1.5">
                                {waLink && (
                                  <a 
                                    href={waLink} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    title={`Abrir WhatsApp (${customer.phone})`}
                                    className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                                  >
                                    <MessageCircle size={13} />
                                  </a>
                                )}
                                {customer.phone && (
                                  <a 
                                    href={`tel:${customer.phone}`}
                                    title={`Llamar a ${customer.phone}`}
                                    className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 transition-colors"
                                  >
                                    <Phone size={13} />
                                  </a>
                                )}
                                {customer.email && (
                                  <a 
                                    href={`mailto:${customer.email}`}
                                    title={`Enviar correo a ${customer.email}`}
                                    className="p-1.5 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 transition-colors"
                                  >
                                    <Mail size={13} />
                                  </a>
                                )}
                                {!customer.phone && !customer.email && (
                                  <span className="text-[10px] text-muted-foreground italic">Sin contacto</span>
                                )}
                              </div>
                            </TableCell>

                            {/* 4. Condiciones & Crédito */}
                            <TableCell className="py-3">
                              <div className="space-y-1">
                                {customer.is_authorized_credit ? (
                                  <div className="space-y-0.5">
                                    <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[9px] font-bold">
                                      Límite: ${creditLimit.toFixed(2)} ({customer.credit_days || 30}d)
                                    </Badge>
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground">Contado</span>
                                )}

                                {customer.price_list_id && (
                                  <div>
                                    <Badge variant="outline" className="text-[8px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">
                                      Lista: {priceLists.find(pl => pl.id === customer.price_list_id)?.name || 'Especial'}
                                    </Badge>
                                  </div>
                                )}
                              </div>
                            </TableCell>

                            {/* 5. Acciones */}
                            <TableCell className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  title="Ver Expediente 360°"
                                  onClick={() => handleOpen360Modal(customer)}
                                  className="h-7 w-7 text-indigo-500 hover:text-indigo-600 hover:bg-indigo-500/10"
                                >
                                  <Eye size={13} />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  title="Editar Cliente"
                                  onClick={() => {
                                    setEditForm({
                                      id: customer.id,
                                      name: customer.name,
                                      commercial_name: customer.commercial_name || '',
                                      nit: customer.nit || '',
                                      nrc: customer.nrc || '',
                                      giro: customer.giro || '',
                                      email: customer.email || '',
                                      phone: customer.phone || '',
                                      address: customer.address || '',
                                      department: customer.department || 'San Salvador',
                                      municipality: customer.municipality || 'San Salvador Centro',
                                      type: customer.type || 'Individual',
                                      category: customer.category || 'Consumidor Final',
                                      is_authorized_credit: !!customer.is_authorized_credit,
                                      credit_limit: (customer.credit_limit || 0).toString(),
                                      credit_days: (customer.credit_days || 30).toString(),
                                      is_gran_contribuyente: !!customer.is_gran_contribuyente,
                                      price_list_id: customer.price_list_id || '',
                                      notes: customer.notes || ''
                                    });
                                    setIsEditOpen(true);
                                  }}
                                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                >
                                  <Pencil size={13} />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  title="Eliminar Cliente"
                                  onClick={() => handleDeleteCustomer(customer.id)} 
                                  className="h-7 w-7 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                                >
                                  <Trash2 size={13} />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: GESTOR DE LISTAS DE PRECIOS */}
        <TabsContent value="precios" className="outline-none">
          <PriceListManager />
        </TabsContent>
      </Tabs>

      {/* MODAL 1: FICHA Y EXPEDIENTE 360° DEL CLIENTE */}
      <Dialog open={!!selectedCust360} onOpenChange={(open) => !open && setSelectedCust360(null)}>
        <DialogContent className="max-w-2xl bg-card border-border/60">
          <DialogHeader className="border-b border-border/50 pb-3">
            <div className="flex items-center justify-between pr-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-500" />
                <DialogTitle className="text-base font-bold">
                  Expediente Comercial 360°: {selectedCust360?.name}
                </DialogTitle>
              </div>
              <Badge className={selectedCust360?.category === 'Crédito Fiscal' ? 'bg-indigo-500 text-white' : 'bg-muted text-foreground'}>
                {selectedCust360?.category || 'Consumidor Final'}
              </Badge>
            </div>
            <DialogDescription className="text-xs">
              Historial de compras, facturas DTE emitidas y estado de línea de crédito.
            </DialogDescription>
          </DialogHeader>

          {selectedCust360 && (
            <div className="space-y-4 py-2 text-xs">
              
              {/* Resumen de Datos Clave */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-xl bg-muted/20 border border-border/60">
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase font-bold">NIT / DTE</div>
                  <div className="font-mono font-semibold text-foreground mt-0.5">{selectedCust360.nit || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase font-bold">NRC</div>
                  <div className="font-mono font-semibold text-foreground mt-0.5">{selectedCust360.nrc || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase font-bold">Teléfono</div>
                  <div className="font-semibold text-foreground mt-0.5">{selectedCust360.phone || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase font-bold">Línea Crédito</div>
                  <div className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {selectedCust360.is_authorized_credit ? `$${Number(selectedCust360.credit_limit || 0).toFixed(2)}` : 'Contado'}
                  </div>
                </div>
              </div>

              {/* Giro y Dirección */}
              {selectedCust360.giro && (
                <div className="p-2.5 rounded-lg bg-card border border-border/50 text-[11px]">
                  <span className="font-bold text-muted-foreground">Giro Económico: </span>
                  <span className="text-foreground">{selectedCust360.giro}</span>
                </div>
              )}

              {/* Historial Reciente de Ventas DTE */}
              <div className="space-y-2">
                <div className="font-bold text-xs flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <FileText size={14} className="text-indigo-500" /> Últimas Facturas / DTE Emitidos
                  </span>
                  <span className="text-[10px] text-muted-foreground">Mostrando hasta 10 registros</span>
                </div>

                <div className="border border-border/60 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                  <Table>
                    <TableHeader className="bg-muted/40 text-[10px]">
                      <TableRow>
                        <TableHead>Correlativo / DTE</TableHead>
                        <TableHead>Tipo Doc</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead className="text-right">Monto Total</TableHead>
                        <TableHead className="text-center">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingCustSales ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-6">
                            <Loader2 className="animate-spin mx-auto text-indigo-500 h-4 w-4" />
                          </TableCell>
                        </TableRow>
                      ) : custSalesHistory.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-6 text-muted-foreground text-[11px]">
                            No hay compras registradas para este cliente todavía.
                          </TableCell>
                        </TableRow>
                      ) : (
                        custSalesHistory.map((s) => (
                          <TableRow key={s.id} className="text-[11px]">
                            <TableCell className="font-mono font-bold text-foreground">{s.correlative}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[9px]">
                                {s.doc_type === 'CCF' ? 'Crédito Fiscal' : 'Factura'}
                              </Badge>
                            </TableCell>
                            <TableCell>{new Date(s.created_at).toLocaleDateString()}</TableCell>
                            <TableCell className="text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              ${Number(s.total || 0).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className={`text-[8px] ${s.status === 'ACTIVA' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                                {s.status || 'EMITIDO'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Botones de Acción Directa */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                {selectedCust360.phone && (
                  <Button 
                    size="sm"
                    onClick={() => {
                      const clean = selectedCust360.phone!.replace(/[^0-9]/g, '');
                      window.open(`https://wa.me/503${clean}`, '_blank');
                    }}
                    className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                  >
                    <MessageCircle size={13} /> Chat WhatsApp
                  </Button>
                )}
                <Button 
                  size="sm"
                  variant="outline"
                  onClick={() => router.push(`/billing?customer=${encodeURIComponent(selectedCust360.name)}`)}
                  className="h-8 text-xs gap-1.5 border-indigo-500/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10"
                >
                  <ExternalLink size={13} /> Facturar en POS
                </Button>
              </div>

            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL 2: EDICIÓN COMPLETA DE CLIENTE */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-xl bg-card border-border/60">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Pencil size={16} className="text-indigo-500" />
              Editar Cliente: {editForm.name}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Modifica los datos tributarios, contacto y límites comerciales.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateCustomer} className="space-y-3.5 py-2">
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Nombre / Razón Social *</Label>
              <Input 
                value={editForm.name} 
                onChange={e => setEditForm({...editForm, name: e.target.value})} 
                className="h-9 text-xs font-semibold"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Categoría Fiscal</Label>
                <Select value={editForm.category} onValueChange={(val) => setEditForm({...editForm, category: val})}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Consumidor Final" className="text-xs">Consumidor Final</SelectItem>
                    <SelectItem value="Crédito Fiscal" className="text-xs">Crédito Fiscal (CCF)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Nombre Comercial</Label>
                <Input 
                  value={editForm.commercial_name} 
                  onChange={e => setEditForm({...editForm, commercial_name: e.target.value})} 
                  className="h-8 text-xs" 
                />
              </div>
            </div>

            {editForm.category === 'Crédito Fiscal' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">NIT</Label>
                  <Input 
                    value={editForm.nit} 
                    onChange={e => setEditForm({...editForm, nit: e.target.value})} 
                    className="h-8 text-xs font-mono font-semibold" 
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">NRC</Label>
                  <Input 
                    value={editForm.nrc} 
                    onChange={e => setEditForm({...editForm, nrc: e.target.value})} 
                    className="h-8 text-xs font-mono font-semibold" 
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Teléfono / WhatsApp</Label>
                <Input 
                  value={editForm.phone} 
                  onChange={e => setEditForm({...editForm, phone: e.target.value})} 
                  className="h-8 text-xs" 
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Correo Electrónico</Label>
                <Input 
                  type="email" 
                  value={editForm.email} 
                  onChange={e => setEditForm({...editForm, email: e.target.value})} 
                  className="h-8 text-xs" 
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Dirección</Label>
              <Input 
                value={editForm.address} 
                onChange={e => setEditForm({...editForm, address: e.target.value})} 
                className="h-8 text-xs" 
              />
            </div>

            <div className="p-3 rounded-xl bg-muted/20 border border-border/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">¿Autorizar Línea de Crédito?</span>
                <Switch 
                  checked={editForm.is_authorized_credit}
                  onCheckedChange={val => setEditForm({...editForm, is_authorized_credit: val})}
                />
              </div>

              {editForm.is_authorized_credit && (
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/40">
                  <div className="space-y-1">
                    <Label className="text-[9px] font-bold uppercase text-muted-foreground">Límite ($)</Label>
                    <Input 
                      type="number" 
                      value={editForm.credit_limit} 
                      onChange={e => setEditForm({...editForm, credit_limit: e.target.value})} 
                      className="h-7 text-xs font-bold text-emerald-500" 
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] font-bold uppercase text-muted-foreground">Plazo (Días)</Label>
                    <Input 
                      type="number" 
                      value={editForm.credit_days} 
                      onChange={e => setEditForm({...editForm, credit_days: e.target.value})} 
                      className="h-7 text-xs font-bold" 
                    />
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsEditOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={isSavingEdit} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
                {isSavingEdit ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : 'Guardar Cambios'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
