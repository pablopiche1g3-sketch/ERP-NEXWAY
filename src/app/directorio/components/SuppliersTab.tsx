'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Truck, 
  ArrowLeft, 
  Search, 
  Trash2, 
  Mail, 
  Phone, 
  MapPin, 
  Hash, 
  BadgeInfo, 
  Building2, 
  Briefcase,
  Loader2,
  Plus,
  Pencil,
  Eye,
  FileSpreadsheet,
  Download,
  ShieldCheck,
  Percent,
  CreditCard,
  ShoppingCart,
  MessageCircle,
  ExternalLink,
  DollarSign,
  Landmark,
  UserCheck
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
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRouter } from 'next/navigation';
import { ModeToggle } from '@/components/mode-toggle';
import * as XLSX from 'xlsx';

const BANCOS_EL_SALVADOR = [
  "Banco Agrícola",
  "Banco Cuscatlán",
  "Banco Davivienda",
  "Banco Promerica",
  "Banco de América Central (BAC)",
  "Banco Hipotecario",
  "Banco de Fomento Agropecuario (BFA)",
  "Banco Industrial El Salvador",
  "Banco Azul",
  "Banco Cédula / Cooperativa"
];

const CATEGORIAS_PROVEEDOR = [
  "Mercadería General / Distribución",
  "Repuestos y Autopartes",
  "Ferretería y Construcción",
  "Materia Prima",
  "Servicios Profesionales / Asesoría",
  "Transporte y Logística",
  "Consumibles y Papelería",
  "Tecnología y Equipamiento"
];

export interface SupplierRecord {
  id: string;
  name: string;
  commercial_name?: string;
  nit?: string;
  nrc?: string;
  giro?: string;
  email?: string;
  phone?: string;
  address?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  bank_name?: string;
  bank_account?: string;
  bank_account_type?: string;
  credit_days?: number;
  payment_terms?: string;
  apply_retention: boolean;
  apply_perception: boolean;
  is_gran_contribuyente?: boolean;
  category?: string;
  notes?: string;
  created_at?: string;
}

export default function SuppliersTab() {
  const router = useRouter();
  const { toast } = useToast();
  
  // Búsqueda y filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'retention' | 'perception' | 'credit'>('all');

  // Formulario de Alta
  const [form, setForm] = useState({
    name: '',
    commercial_name: '',
    nit: '',
    nrc: '',
    giro: '',
    category: 'Mercadería General / Distribución',
    email: '',
    phone: '',
    address: '',
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    bank_name: 'Banco Agrícola',
    bank_account: '',
    bank_account_type: 'Corriente',
    credit_days: '30',
    apply_retention: false,
    apply_perception: false,
    is_gran_contribuyente: false,
    notes: ''
  });

  // Modal de Edición
  const [editingSupplier, setEditingSupplier] = useState<SupplierRecord | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    id: '',
    name: '',
    commercial_name: '',
    nit: '',
    nrc: '',
    giro: '',
    category: 'Mercadería General / Distribución',
    email: '',
    phone: '',
    address: '',
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    bank_name: 'Banco Agrícola',
    bank_account: '',
    bank_account_type: 'Corriente',
    credit_days: '30',
    apply_retention: false,
    apply_perception: false,
    is_gran_contribuyente: false,
    notes: ''
  });

  // Modal Ficha 360°
  const [selectedSupplier360, setSelectedSupplier360] = useState<SupplierRecord | null>(null);
  const [supplierOrdersHistory, setSupplierOrdersHistory] = useState<any[]>([]);
  const [loadingOrdersHistory, setLoadingOrdersHistory] = useState(false);

  // Estados de datos
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Cargar proveedores desde Supabase
  const loadSuppliersData = async () => {
    try {
      setLoadingData(true);
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setSuppliers(data || []);
    } catch (err: any) {
      console.error('Error al cargar proveedores:', err);
      toast({
        variant: 'destructive',
        title: 'Error de Conexión',
        description: 'No se pudo cargar el directorio de proveedores.'
      });
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    loadSuppliersData();
  }, []);

  // Cargar historial de órdenes al abrir 360°
  const handleOpen360Modal = async (sup: SupplierRecord) => {
    setSelectedSupplier360(sup);
    setLoadingOrdersHistory(true);
    try {
      const { data, error } = await supabase
        .from('supplier_orders')
        .select('*')
        .ilike('supplier_name', `%${sup.name}%`)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!error && data) {
        setSupplierOrdersHistory(data);
      } else {
        setSupplierOrdersHistory([]);
      }
    } catch (e) {
      setSupplierOrdersHistory([]);
    } finally {
      setLoadingOrdersHistory(false);
    }
  };

  // Crear Proveedor
  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.name.trim()) {
      toast({
        variant: 'destructive',
        title: 'Campo Requerido',
        description: 'La Razón Social o Nombre del Proveedor es obligatorio.'
      });
      return;
    }

    try {
      const payload: any = {
        name: form.name.trim(),
        commercial_name: form.commercial_name.trim() || null,
        nit: form.nit.trim() || null,
        nrc: form.nrc.trim() || null,
        giro: form.giro.trim() || null,
        category: form.category || 'Mercadería General / Distribución',
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        contact_name: form.contact_name.trim() || null,
        contact_phone: form.contact_phone.trim() || null,
        contact_email: form.contact_email.trim() || null,
        bank_name: form.bank_name || null,
        bank_account: form.bank_account.trim() || null,
        bank_account_type: form.bank_account_type || 'Corriente',
        credit_days: parseInt(form.credit_days) || 30,
        apply_retention: form.apply_retention,
        apply_perception: form.apply_perception,
        is_gran_contribuyente: form.is_gran_contribuyente,
        notes: form.notes.trim() || null
      };

      const { error } = await supabase.from('suppliers').insert(payload);
      if (error) throw error;

      toast({
        title: "Proveedor Registrado",
        description: `${form.name} ha sido incorporado al directorio.`
      });

      setForm({
        name: '',
        commercial_name: '',
        nit: '',
        nrc: '',
        giro: '',
        category: 'Mercadería General / Distribución',
        email: '',
        phone: '',
        address: '',
        contact_name: '',
        contact_phone: '',
        contact_email: '',
        bank_name: 'Banco Agrícola',
        bank_account: '',
        bank_account_type: 'Corriente',
        credit_days: '30',
        apply_retention: false,
        apply_perception: false,
        is_gran_contribuyente: false,
        notes: ''
      });

      await loadSuppliersData();
    } catch (err: any) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'Error al Registrar',
        description: err.message || 'No se pudo guardar el proveedor.'
      });
    }
  };

  // Actualizar Proveedor
  const handleUpdateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.name.trim()) return;

    try {
      setIsSavingEdit(true);
      const { error } = await supabase
        .from('suppliers')
        .update({
          name: editForm.name.trim(),
          commercial_name: editForm.commercial_name.trim() || null,
          nit: editForm.nit.trim() || null,
          nrc: editForm.nrc.trim() || null,
          giro: editForm.giro.trim() || null,
          category: editForm.category,
          email: editForm.email.trim() || null,
          phone: editForm.phone.trim() || null,
          address: editForm.address.trim() || null,
          contact_name: editForm.contact_name.trim() || null,
          contact_phone: editForm.contact_phone.trim() || null,
          contact_email: editForm.contact_email.trim() || null,
          bank_name: editForm.bank_name,
          bank_account: editForm.bank_account.trim() || null,
          bank_account_type: editForm.bank_account_type,
          credit_days: parseInt(editForm.credit_days) || 30,
          apply_retention: editForm.apply_retention,
          apply_perception: editForm.apply_perception,
          is_gran_contribuyente: editForm.is_gran_contribuyente,
          notes: editForm.notes.trim() || null
        })
        .eq('id', editForm.id);

      if (error) throw error;

      toast({ title: "Proveedor Actualizado", description: `${editForm.name} fue modificado con éxito.` });
      setIsEditOpen(false);
      setEditingSupplier(null);
      await loadSuppliersData();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Toggle Retención / Percepción directa en tabla
  const handleToggleTax = async (id: string, field: 'apply_retention' | 'apply_perception', currentValue: boolean) => {
    try {
      const { error } = await supabase
        .from('suppliers')
        .update({ [field]: !currentValue })
        .eq('id', id);

      if (error) throw error;
      setSuppliers(prev => prev.map(s => s.id === id ? { ...s, [field]: !currentValue } : s));
      toast({
        title: "Condición Fiscal Actualizada",
        description: `Se actualizó la ${field === 'apply_retention' ? 'Retención del 1%' : 'Percepción del 1%'}.`
      });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

  // Eliminar Proveedor
  const handleDeleteSupplier = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar este proveedor?')) return;
    try {
      const { error } = await supabase.from('suppliers').delete().eq('id', id);
      if (error) throw error;
      toast({ title: "Proveedor Eliminado" });
      await loadSuppliersData();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error al eliminar', description: err.message });
    }
  };

  // Exportar a Excel
  const handleExportToExcel = () => {
    if (suppliers.length === 0) {
      toast({ variant: 'destructive', title: 'Sin Datos', description: 'No hay proveedores registrados.' });
      return;
    }

    const exportRows = suppliers.map(s => ({
      "Razón Social": s.name,
      "Nombre Comercial": s.commercial_name || '',
      "Categoría": s.category || '',
      "NIT": s.nit || '',
      "NRC": s.nrc || '',
      "Giro Comercial": s.giro || '',
      "Retención 1%": s.apply_retention ? 'SÍ' : 'NO',
      "Percepción 1%": s.apply_perception ? 'SÍ' : 'NO',
      "Gran Contribuyente": s.is_gran_contribuyente ? 'SÍ' : 'NO',
      "Teléfono Empresa": s.phone || '',
      "Correo Pedidos": s.email || '',
      "Ejecutivo / Vendedor": s.contact_name || '',
      "Teléfono Vendedor": s.contact_phone || '',
      "Banco": s.bank_name || '',
      "N° Cuenta": s.bank_account || '',
      "Días Crédito": s.credit_days || 0,
      "Dirección": s.address || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Proveedores");
    XLSX.writeFile(wb, `Directorio_Proveedores_NexWay_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast({ title: "Exportación Exitosa", description: `Se descargaron ${suppliers.length} proveedores en Excel.` });
  };

  // KPIs
  const stats = useMemo(() => {
    const total = suppliers.length;
    const retentionCount = suppliers.filter(s => s.apply_retention).length;
    const perceptionCount = suppliers.filter(s => s.apply_perception).length;
    const granContribCount = suppliers.filter(s => s.is_gran_contribuyente).length;

    return { total, retentionCount, perceptionCount, granContribCount };
  }, [suppliers]);

  // Filtrado reactivo
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => {
      const q = searchTerm.toLowerCase().trim();
      const matchSearch = !q || (
        s.name.toLowerCase().includes(q) ||
        (s.commercial_name && s.commercial_name.toLowerCase().includes(q)) ||
        (s.nit && s.nit.toLowerCase().includes(q)) ||
        (s.nrc && s.nrc.toLowerCase().includes(q)) ||
        (s.contact_name && s.contact_name.toLowerCase().includes(q)) ||
        (s.giro && s.giro.toLowerCase().includes(q))
      );

      const matchFilter = 
        filterType === 'all' ||
        (filterType === 'retention' && s.apply_retention) ||
        (filterType === 'perception' && s.apply_perception) ||
        (filterType === 'credit' && (s.credit_days || 0) > 0);

      return matchSearch && matchFilter;
    });
  }, [searchTerm, filterType, suppliers]);

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
              <Truck className="h-5 w-5 text-emerald-500" />
              <h1 className="text-lg md:text-xl font-bold text-foreground font-headline leading-tight">
                Directorio de Proveedores & Abastecimiento
              </h1>
            </div>
            <p className="text-muted-foreground text-xs mt-0.5">
              Gestión de suministrantes, condiciones tributarias DTE, retenciones de IVA y cuentas bancarias.
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
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Proveedores</div>
              <div className="text-2xl font-black text-foreground">{stats.total}</div>
              <div className="text-[10px] text-muted-foreground">Suministrantes en red</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <Truck size={20} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/60 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Agentes Retención 1%</div>
              <div className="text-2xl font-black text-indigo-500">{stats.retentionCount}</div>
              <div className="text-[10px] text-muted-foreground">Retención IVA en compras</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <Percent size={20} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/60 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Agentes Percepción 1%</div>
              <div className="text-2xl font-black text-sky-500">{stats.perceptionCount}</div>
              <div className="text-[10px] text-muted-foreground">Percepción IVA aplicada</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center">
              <Percent size={20} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/60 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Grandes Contribuyentes</div>
              <div className="text-2xl font-black text-amber-500">{stats.granContribCount}</div>
              <div className="text-[10px] text-muted-foreground">Clasificación DTE / MH</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <ShieldCheck size={20} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CUERPO PRINCIPAL */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Formulario Lateral: Nuevo Proveedor */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="border-border/60 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-border/50 p-4 bg-muted/20">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                <Plus size={16} className="text-emerald-500" />
                Registrar Nuevo Proveedor
              </CardTitle>
              <CardDescription className="text-muted-foreground text-xs">
                Datos legales, comerciales y bancarios para pagos.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <form onSubmit={handleCreateSupplier} className="space-y-3.5">
                
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Razón Social / Proveedor *</Label>
                  <Input 
                    placeholder="Ej. Distribuidora Automotriz S.A. de C.V."
                    value={form.name}
                    onChange={e => setForm({...form, name: e.target.value})}
                    className="h-9 text-xs font-semibold"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Categoría de Suministro</Label>
                  <Select value={form.category} onValueChange={(val) => setForm({...form, category: val})}>
                    <SelectTrigger className="h-8 text-xs font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS_PROVEEDOR.map((cat, idx) => (
                        <SelectItem key={idx} value={cat} className="text-xs py-2">{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

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

                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Giro Comercial</Label>
                  <Input 
                    placeholder="Ej. Venta de repuestos al por mayor..." 
                    value={form.giro}
                    onChange={e => setForm({...form, giro: e.target.value})}
                    className="h-8 text-xs"
                  />
                </div>

                {/* Condiciones Fiscales */}
                <div className="p-3 rounded-xl bg-muted/20 border border-border/60 space-y-2">
                  <div className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1">
                    <Percent size={12} className="text-indigo-500" /> Condiciones Tributarias DTE
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center justify-between p-2 rounded-lg bg-card border border-border/50 cursor-pointer">
                      <span className="text-[11px] font-semibold text-foreground">Retención 1%</span>
                      <Switch 
                        checked={form.apply_retention}
                        onCheckedChange={val => setForm({...form, apply_retention: val})}
                      />
                    </label>
                    <label className="flex items-center justify-between p-2 rounded-lg bg-card border border-border/50 cursor-pointer">
                      <span className="text-[11px] font-semibold text-foreground">Percepción 1%</span>
                      <Switch 
                        checked={form.apply_perception}
                        onCheckedChange={val => setForm({...form, apply_perception: val})}
                      />
                    </label>
                  </div>
                </div>

                {/* Contacto del Ejecutivo de Ventas */}
                <div className="p-3 rounded-xl bg-muted/20 border border-border/60 space-y-2">
                  <div className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1">
                    <UserCheck size={12} className="text-emerald-500" /> Ejecutivo / Vendedor Asignado
                  </div>
                  <div className="space-y-1.5">
                    <Input 
                      placeholder="Nombre del Vendedor..."
                      value={form.contact_name}
                      onChange={e => setForm({...form, contact_name: e.target.value})}
                      className="h-8 text-xs font-medium"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input 
                        placeholder="WhatsApp / Tel..."
                        value={form.contact_phone || form.phone}
                        onChange={e => setForm({...form, contact_phone: e.target.value, phone: e.target.value})}
                        className="h-8 text-xs"
                      />
                      <Input 
                        type="email"
                        placeholder="Correo Pedidos..."
                        value={form.email}
                        onChange={e => setForm({...form, email: e.target.value})}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Datos Bancarios */}
                <div className="p-3 rounded-xl bg-muted/20 border border-border/60 space-y-2">
                  <div className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1">
                    <Landmark size={12} className="text-amber-500" /> Cuenta Bancaria para Transferencias
                  </div>
                  <div className="space-y-1.5">
                    <Select value={form.bank_name} onValueChange={(val) => setForm({...form, bank_name: val})}>
                      <SelectTrigger className="h-8 text-xs font-semibold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BANCOS_EL_SALVADOR.map((banco, idx) => (
                          <SelectItem key={idx} value={banco} className="text-xs">{banco}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="grid grid-cols-2 gap-2">
                      <Input 
                        placeholder="N° de Cuenta..."
                        value={form.bank_account}
                        onChange={e => setForm({...form, bank_account: e.target.value})}
                        className="h-8 text-xs font-mono font-semibold"
                      />
                      <Input 
                        placeholder="Días Crédito (ej. 30)"
                        type="number"
                        value={form.credit_days}
                        onChange={e => setForm({...form, credit_days: e.target.value})}
                        className="h-8 text-xs font-bold text-emerald-600 dark:text-emerald-400"
                      />
                    </div>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-9 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-sm gap-1.5"
                >
                  <Plus size={14} /> Registrar Proveedor
                </Button>
              </form>
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
                placeholder="Buscar proveedor por razón social, NIT, NRC, vendedor o giro..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8 h-8 text-xs bg-background"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <Button 
                size="sm" 
                variant={filterType === 'all' ? 'default' : 'outline'}
                onClick={() => setFilterType('all')}
                className="h-8 text-xs px-2.5"
              >
                Todos ({stats.total})
              </Button>
              <Button 
                size="sm" 
                variant={filterType === 'retention' ? 'default' : 'outline'}
                onClick={() => setFilterType('retention')}
                className="h-8 text-xs px-2.5"
              >
                Retención 1% ({stats.retentionCount})
              </Button>
              <Button 
                size="sm" 
                variant={filterType === 'perception' ? 'default' : 'outline'}
                onClick={() => setFilterType('perception')}
                className="h-8 text-xs px-2.5"
              >
                Percepción 1% ({stats.perceptionCount})
              </Button>
            </div>
          </div>

          {/* Tabla de Proveedores de Alta Densidad */}
          <Card className="border-border/60 shadow-sm rounded-2xl overflow-hidden">
            <ScrollArea className="h-[600px]">
              <Table>
                <TableHeader className="bg-muted/40 sticky top-0 z-10 border-b border-border/50 text-[11px]">
                  <TableRow>
                    <TableHead className="px-4">Proveedor & Razón Social</TableHead>
                    <TableHead>Contacto Comercial</TableHead>
                    <TableHead>Condición DTE (1%)</TableHead>
                    <TableHead>Pago / Banco</TableHead>
                    <TableHead className="text-right px-4">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingData ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-20">
                        <Loader2 className="animate-spin mx-auto text-emerald-500 h-6 w-6" />
                        <span className="text-xs text-muted-foreground mt-2 block">Cargando proveedores...</span>
                      </TableCell>
                    </TableRow>
                  ) : filteredSuppliers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-16 text-xs text-muted-foreground">
                        No se encontraron proveedores que coincidan con la búsqueda.
                      </TableCell>
                    </TableRow>
                  ) : filteredSuppliers.map((supplier) => {
                    const cleanPhone = (supplier.contact_phone || supplier.phone) ? (supplier.contact_phone || supplier.phone)!.replace(/[^0-9]/g, '') : '';
                    const waLink = cleanPhone ? `https://wa.me/503${cleanPhone}` : null;

                    return (
                      <TableRow key={supplier.id} className="hover:bg-muted/30 border-border/40 text-xs">
                        
                        {/* 1. Proveedor & Razón Social */}
                        <TableCell className="px-4 py-3">
                          <div className="space-y-1">
                            <div className="font-bold text-foreground flex items-center gap-1.5">
                              <span>{supplier.name}</span>
                              {supplier.is_gran_contribuyente && (
                                <Badge className="bg-amber-500 text-white text-[8px] h-4 px-1 font-bold">
                                  Gran Contrib.
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                              {supplier.nit && <span>NIT: {supplier.nit}</span>}
                              {supplier.nrc && <span>NRC: {supplier.nrc}</span>}
                            </div>
                            {supplier.category && (
                              <Badge variant="outline" className="text-[8px] font-semibold bg-muted/40">
                                {supplier.category}
                              </Badge>
                            )}
                          </div>
                        </TableCell>

                        {/* 2. Contacto Comercial */}
                        <TableCell className="py-3">
                          <div className="space-y-1">
                            {supplier.contact_name && (
                              <div className="font-semibold text-foreground text-[11px] flex items-center gap-1">
                                <UserCheck size={11} className="text-emerald-500" />
                                {supplier.contact_name}
                              </div>
                            )}
                            <div className="flex items-center gap-1.5">
                              {waLink && (
                                <a 
                                  href={waLink} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  title={`WhatsApp a ${supplier.name}`}
                                  className="p-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                                >
                                  <MessageCircle size={12} />
                                </a>
                              )}
                              {(supplier.contact_phone || supplier.phone) && (
                                <a 
                                  href={`tel:${supplier.contact_phone || supplier.phone}`}
                                  title="Llamar"
                                  className="p-1 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20"
                                >
                                  <Phone size={12} />
                                </a>
                              )}
                              {(supplier.contact_email || supplier.email) && (
                                <a 
                                  href={`mailto:${supplier.contact_email || supplier.email}`}
                                  title="Enviar Correo de Pedidos"
                                  className="p-1 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20"
                                >
                                  <Mail size={12} />
                                </a>
                              )}
                              <span className="text-[10px] font-mono text-muted-foreground ml-1">
                                {supplier.contact_phone || supplier.phone || 'Sin teléfono'}
                              </span>
                            </div>
                          </div>
                        </TableCell>

                        {/* 3. Condición DTE (1%) */}
                        <TableCell className="py-3">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-muted-foreground w-16">Retención 1%:</span>
                              <Switch 
                                checked={supplier.apply_retention}
                                onCheckedChange={() => handleToggleTax(supplier.id, 'apply_retention', supplier.apply_retention)}
                                className="scale-75 origin-left"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-muted-foreground w-16">Percepción 1%:</span>
                              <Switch 
                                checked={supplier.apply_perception}
                                onCheckedChange={() => handleToggleTax(supplier.id, 'apply_perception', supplier.apply_perception)}
                                className="scale-75 origin-left"
                              />
                            </div>
                          </div>
                        </TableCell>

                        {/* 4. Pago / Banco */}
                        <TableCell className="py-3">
                          <div className="space-y-0.5 font-mono text-[10px]">
                            {supplier.bank_name && (
                              <div className="text-foreground font-sans font-semibold flex items-center gap-1">
                                <Landmark size={10} className="text-amber-500" />
                                {supplier.bank_name}
                              </div>
                            )}
                            {supplier.bank_account && (
                              <div className="text-muted-foreground">Cta: {supplier.bank_account}</div>
                            )}
                            <div className="text-emerald-600 dark:text-emerald-400 font-bold font-sans">
                              Crédito: {supplier.credit_days || 30} días
                            </div>
                          </div>
                        </TableCell>

                        {/* 5. Acciones */}
                        <TableCell className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              title="Crear Pedido de Compra"
                              onClick={() => router.push(`/compras?tab=orders&supplier=${encodeURIComponent(supplier.name)}`)}
                              className="h-7 w-7 text-indigo-500 hover:text-indigo-600 hover:bg-indigo-500/10"
                            >
                              <ShoppingCart size={13} />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              title="Ver Expediente 360°"
                              onClick={() => handleOpen360Modal(supplier)}
                              className="h-7 w-7 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10"
                            >
                              <Eye size={13} />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              title="Editar Proveedor"
                              onClick={() => {
                                setEditForm({
                                  id: supplier.id,
                                  name: supplier.name,
                                  commercial_name: supplier.commercial_name || '',
                                  nit: supplier.nit || '',
                                  nrc: supplier.nrc || '',
                                  giro: supplier.giro || '',
                                  category: supplier.category || 'Mercadería General / Distribución',
                                  email: supplier.email || '',
                                  phone: supplier.phone || '',
                                  address: supplier.address || '',
                                  contact_name: supplier.contact_name || '',
                                  contact_phone: supplier.contact_phone || '',
                                  contact_email: supplier.contact_email || '',
                                  bank_name: supplier.bank_name || 'Banco Agrícola',
                                  bank_account: supplier.bank_account || '',
                                  bank_account_type: supplier.bank_account_type || 'Corriente',
                                  credit_days: (supplier.credit_days || 30).toString(),
                                  apply_retention: supplier.apply_retention,
                                  apply_perception: supplier.apply_perception,
                                  is_gran_contribuyente: !!supplier.is_gran_contribuyente,
                                  notes: supplier.notes || ''
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
                              title="Eliminar Proveedor"
                              onClick={() => handleDeleteSupplier(supplier.id)} 
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

      {/* MODAL 1: FICHA Y EXPEDIENTE 360° DEL PROVEEDOR */}
      <Dialog open={!!selectedSupplier360} onOpenChange={(open) => !open && setSelectedSupplier360(null)}>
        <DialogContent className="max-w-2xl bg-card border-border/60">
          <DialogHeader className="border-b border-border/50 pb-3">
            <div className="flex items-center justify-between pr-4">
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-emerald-500" />
                <DialogTitle className="text-base font-bold">
                  Expediente de Proveedor 360°: {selectedSupplier360?.name}
                </DialogTitle>
              </div>
              <Badge className="bg-emerald-500 text-white text-xs">
                {selectedSupplier360?.category || 'Proveedor'}
              </Badge>
            </div>
            <DialogDescription className="text-xs">
              Datos fiscales para compras, cuenta bancaria para transferencias e historial de pedidos.
            </DialogDescription>
          </DialogHeader>

          {selectedSupplier360 && (
            <div className="space-y-4 py-2 text-xs">
              
              {/* Tarjetas Informativas */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-xl bg-muted/20 border border-border/60">
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase font-bold">NIT / DTE</div>
                  <div className="font-mono font-semibold text-foreground mt-0.5">{selectedSupplier360.nit || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase font-bold">NRC</div>
                  <div className="font-mono font-semibold text-foreground mt-0.5">{selectedSupplier360.nrc || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase font-bold">Retención 1%</div>
                  <div className="font-bold text-foreground mt-0.5">{selectedSupplier360.apply_retention ? 'APLICA' : 'NO APLICA'}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase font-bold">Crédito</div>
                  <div className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {selectedSupplier360.credit_days || 30} Días
                  </div>
                </div>
              </div>

              {/* Cuenta Bancaria */}
              {selectedSupplier360.bank_account && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Landmark className="h-4 w-4 text-amber-500" />
                    <div>
                      <div className="text-[10px] uppercase font-bold text-muted-foreground">Datos de Transferencia Bancaria</div>
                      <div className="font-bold text-foreground">
                        {selectedSupplier360.bank_name || 'Banco'} • Cuenta {selectedSupplier360.bank_account_type || 'Corriente'}: <span className="font-mono text-amber-600 dark:text-amber-400">{selectedSupplier360.bank_account}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Historial de Órdenes de Pedido Recientes */}
              <div className="space-y-2">
                <div className="font-bold text-xs flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <ShoppingCart size={14} className="text-emerald-500" /> Órdenes de Compra Realizadas
                  </span>
                  <span className="text-[10px] text-muted-foreground">Mostrando hasta 10 órdenes</span>
                </div>

                <div className="border border-border/60 rounded-xl overflow-hidden max-h-44 overflow-y-auto">
                  <Table>
                    <TableHeader className="bg-muted/40 text-[10px]">
                      <TableRow>
                        <TableHead>Código Orden</TableHead>
                        <TableHead>Bodega Destino</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead className="text-right">Monto Total</TableHead>
                        <TableHead className="text-center">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingOrdersHistory ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-6">
                            <Loader2 className="animate-spin mx-auto text-emerald-500 h-4 w-4" />
                          </TableCell>
                        </TableRow>
                      ) : supplierOrdersHistory.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-6 text-muted-foreground text-[11px]">
                            No hay órdenes de compra registradas para este proveedor.
                          </TableCell>
                        </TableRow>
                      ) : (
                        supplierOrdersHistory.map((o) => (
                          <TableRow key={o.id} className="text-[11px]">
                            <TableCell className="font-mono font-bold text-foreground">{o.code}</TableCell>
                            <TableCell>{o.destination_warehouse || 'CASA MATRIZ'}</TableCell>
                            <TableCell>{new Date(o.created_at).toLocaleDateString()}</TableCell>
                            <TableCell className="text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              ${Number(o.total || 0).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className={`text-[8px] ${o.status === 'PENDIENTE' ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white'}`}>
                                {o.status || 'PENDIENTE'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Botones de Acción */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
                <Button 
                  size="sm"
                  onClick={() => router.push(`/compras?tab=orders&supplier=${encodeURIComponent(selectedSupplier360.name)}`)}
                  className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
                >
                  <ShoppingCart size={13} /> Generar Orden de Compra
                </Button>
              </div>

            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL 2: EDICIÓN COMPLETA DE PROVEEDOR */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-xl bg-card border-border/60">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Pencil size={16} className="text-emerald-500" />
              Editar Proveedor: {editForm.name}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Modifica los datos tributarios, contacto comercial y cuentas bancarias.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateSupplier} className="space-y-3.5 py-2">
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Razón Social *</Label>
              <Input 
                value={editForm.name} 
                onChange={e => setEditForm({...editForm, name: e.target.value})} 
                className="h-9 text-xs font-semibold"
                required
              />
            </div>

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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Ejecutivo / Vendedor</Label>
                <Input 
                  value={editForm.contact_name} 
                  onChange={e => setEditForm({...editForm, contact_name: e.target.value})} 
                  className="h-8 text-xs" 
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Teléfono / WhatsApp</Label>
                <Input 
                  value={editForm.contact_phone || editForm.phone} 
                  onChange={e => setEditForm({...editForm, contact_phone: e.target.value, phone: e.target.value})} 
                  className="h-8 text-xs" 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Banco</Label>
                <Select value={editForm.bank_name} onValueChange={(val) => setEditForm({...editForm, bank_name: val})}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BANCOS_EL_SALVADOR.map((banco, idx) => (
                      <SelectItem key={idx} value={banco} className="text-xs">{banco}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">N° Cuenta Bancaria</Label>
                <Input 
                  value={editForm.bank_account} 
                  onChange={e => setEditForm({...editForm, bank_account: e.target.value})} 
                  className="h-8 text-xs font-mono font-semibold" 
                />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-muted/20 border border-border/60 space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center justify-between p-2 rounded-lg bg-card border border-border/50 cursor-pointer">
                  <span className="text-[11px] font-semibold text-foreground">Retención 1%</span>
                  <Switch 
                    checked={editForm.apply_retention}
                    onCheckedChange={val => setEditForm({...editForm, apply_retention: val})}
                  />
                </label>
                <label className="flex items-center justify-between p-2 rounded-lg bg-card border border-border/50 cursor-pointer">
                  <span className="text-[11px] font-semibold text-foreground">Percepción 1%</span>
                  <Switch 
                    checked={editForm.apply_perception}
                    onCheckedChange={val => setEditForm({...editForm, apply_perception: val})}
                  />
                </label>
              </div>
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsEditOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={isSavingEdit} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                {isSavingEdit ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : 'Guardar Cambios'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
