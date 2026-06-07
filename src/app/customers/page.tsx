
'use client';

import React, { useState, useMemo, useEffect } from 'react';
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
  Pencil
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {  useFirestore, useCollection  } from '@/supabase/compat';
import { supabase } from '@/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

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

export default function CustomersPage() {
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
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
    credit_limit: '0.00'
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
    credit_limit: '0.00'
  });

  // Estados para datos cargados desde Supabase
  const [customers, setCustomers] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Función para cargar los clientes desde Supabase
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
      console.error('Error al cargar clientes desde Supabase:', err);
      toast({
        variant: 'destructive',
        title: 'Error de Conexión',
        description: 'No se pudo cargar la cartera de clientes de Supabase.'
      });
    } finally {
      setLoadingData(false);
    }
  };

  // Cargar clientes en el montaje
  useEffect(() => {
    loadCustomersData();
  }, []);

  const handleCreateCustomer = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!form.name || (activeTab === 'ccf' && (!form.nit || !form.nrc || !form.giro))) {
      toast({ 
        variant: "destructive", 
        title: "Faltan campos", 
        description: activeTab === 'cf' ? "El nombre es obligatorio." : "Nombre, NIT, NRC y Giro son obligatorios para Crédito Fiscal." 
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
          credit_limit: parseFloat(form.credit_limit) || 0.00
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
        credit_limit: '0.00'
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
          credit_limit: parseFloat(editForm.credit_limit) || 0.00
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

  return (
    <div className="min-h-screen bg-gradient-to-tr from-slate-50 via-white to-sky-50/30 dark:from-[#060A12] dark:via-[#090D18] dark:to-sky-950/10 p-4 md:p-6 transition-colors duration-300 relative overflow-x-hidden">
      {/* Orbes decorativos */}
      <div className="pointer-events-none fixed top-[-12%] right-[-8%] w-[38vw] h-[38vw] rounded-full bg-sky-500/5 dark:bg-sky-500/8 blur-[130px]" />
      <div className="pointer-events-none fixed bottom-[-10%] left-[-6%] w-[32vw] h-[32vw] rounded-full bg-indigo-500/5 dark:bg-indigo-500/8 blur-[110px]" />
      <div className="pointer-events-none fixed top-[45%] left-[35%] w-[16vw] h-[16vw] rounded-full bg-blue-500/3 dark:bg-blue-500/5 blur-[80px]" />
      <div className="max-w-7xl mx-auto mb-8 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-full bg-white dark:bg-card shadow-sm hover:bg-slate-100 border" 
            onClick={() => router.push('/')}
          >
            <ArrowLeft className="text-slate-600 dark:text-foreground" size={20} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-foreground">Registro de Clientes</h1>
            <p className="text-slate-500 dark:text-muted-foreground text-sm">Gestión de carteras y datos tributarios</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
        <div className="lg:col-span-5 space-y-4">
          <Card className="glass-card rounded-2xl overflow-hidden">
            <CardHeader className="bg-slate-900 dark:bg-slate-950 text-white p-6">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Plus size={20} className="text-sky-400" />
                Alta de Cliente
              </CardTitle>
              <CardDescription className="text-slate-400 text-xs">Seleccione el tipo de contribuyente</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <Tabs defaultValue="cf" value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid grid-cols-2 mb-6 bg-slate-100 dark:bg-muted rounded-xl p-1">
                  <TabsTrigger value="cf" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-card data-[state=active]:shadow-sm text-xs">
                    <User size={14} className="mr-2" />
                    Consumidor Final
                  </TabsTrigger>
                  <TabsTrigger value="ccf" className="rounded-lg data-[state=active]:bg-sky-600 data-[state=active]:text-white data-[state=active]:shadow-sm text-xs">
                    <Building2 size={14} className="mr-2" />
                    Crédito Fiscal
                  </TabsTrigger>
                </TabsList>

                <form onSubmit={handleCreateCustomer} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                      {activeTab === 'cf' ? 'Nombre Completo' : 'Nombre o Razón Social'}
                    </Label>
                    <div className="relative">
                      <UserCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                      <Input 
                        placeholder={activeTab === 'cf' ? "Ej. Juan Pérez" : "Ej. Industrias El Salvador S.A."}
                        value={form.name}
                        onChange={e => setForm({...form, name: e.target.value})}
                        className="h-10 pl-9 bg-slate-50 dark:bg-muted border-none rounded-xl text-xs font-bold"
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
                            className="h-10 pl-9 bg-slate-50 dark:bg-muted border-none rounded-xl text-xs font-mono font-bold"
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
                            className="h-10 pl-9 bg-slate-50 dark:bg-muted border-none rounded-xl text-xs font-mono font-bold"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'ccf' && (
                    <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Giro Comercial Autorizado</Label>
                      <Select value={form.giro} onValueChange={(val) => setForm({...form, giro: val})}>
                        <SelectTrigger className="h-11 bg-slate-50 dark:bg-muted border-none rounded-xl text-[11px] font-bold">
                          <div className="flex items-center gap-2">
                            <Briefcase className="text-slate-400" size={14} />
                            <SelectValue placeholder="Seleccione giro de Hacienda..." />
                          </div>
                        </SelectTrigger>
                        <SelectContent className="max-w-[400px]">
                          {GIROS_AUTORIZADOS.map((giro, idx) => (
                            <SelectItem key={idx} value={giro} className="text-[11px] py-3">
                              {giro}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Correo Electrónico</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <Input 
                          type="email"
                          placeholder="correo@ejemplo.com" 
                          value={form.email}
                          onChange={e => setForm({...form, email: e.target.value})}
                          className="h-10 pl-9 bg-slate-50 dark:bg-muted border-none rounded-xl text-xs"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Teléfono</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <Input 
                          placeholder="2222-0000" 
                          value={form.phone}
                          onChange={e => setForm({...form, phone: e.target.value})}
                          className="h-10 pl-9 bg-slate-50 dark:bg-muted border-none rounded-xl text-xs font-bold"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Dirección</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 text-slate-400" size={14} />
                      <textarea 
                        placeholder="Ubicación del cliente..."
                        value={form.address}
                        onChange={e => setForm({...form, address: e.target.value})}
                        className="w-full min-h-[60px] pl-9 pt-2.5 bg-slate-50 dark:bg-muted border-none rounded-xl text-xs focus:ring-2 focus:ring-sky-500/20 outline-none transition-all dark:text-foreground"
                      />
                    </div>
                  </div>

                  {/* Sección de Control de Crédito Premium */}
                  <div className="p-4 rounded-2xl bg-slate-50/50 dark:bg-muted/10 border border-slate-100 dark:border-border/60 space-y-3">
                    <h4 className="text-[10px] font-black uppercase text-sky-600 dark:text-sky-400 tracking-widest flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-sky-500"></span> Control de Crédito (Gerencia)
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                      <div className="flex items-center justify-between p-2 bg-background dark:bg-muted/30 rounded-xl border border-slate-100 dark:border-border/40 shadow-sm">
                        <span className="text-[11px] font-bold text-muted-foreground">¿Autorizar Crédito?</span>
                        <Switch 
                          checked={form.is_authorized_credit}
                          onCheckedChange={val => setForm({...form, is_authorized_credit: val})}
                        />
                      </div>
                      
                      <div className="space-y-1">
                        <Label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Límite Autorizado ($)</Label>
                        <Input 
                          type="number" 
                          placeholder="0.00" 
                          value={form.credit_limit}
                          onChange={e => setForm({...form, credit_limit: e.target.value})}
                          disabled={!form.is_authorized_credit}
                          className="h-9 bg-background border rounded-xl text-xs font-bold text-sky-600 dark:text-sky-400"
                        />
                      </div>
                    </div>
                  </div>

                  <Button type="submit" className="w-full h-12 bg-sky-600 hover:bg-sky-700 rounded-xl font-bold text-white shadow-lg shadow-sky-200 dark:shadow-sky-900/20">
                    <Users size={18} className="mr-2" />
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
              className="pl-12 h-12 glass-input border-none shadow-sm rounded-2xl text-xs md:text-sm"
            />
          </div>

          <Card className="glass-card rounded-2xl overflow-hidden">
            <ScrollArea className="h-[550px]">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-muted/50 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="text-[10px] font-black uppercase px-6">Receptor</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">Tipo / Giro</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-right">Contacto</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingData ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-20 text-slate-400"><Loader2 className="animate-spin mx-auto mb-2" /> Sincronizando datos...</TableCell></TableRow>
                  ) : filteredCustomers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-20 text-slate-400 italic text-xs">
                        No hay clientes registrados en la cartera.
                      </TableCell>
                    </TableRow>
                  ) : filteredCustomers.map((customer: any) => (
                    <TableRow key={customer.id} className="hover:bg-slate-50/50 dark:hover:bg-muted/30">
                      <TableCell className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 dark:text-foreground text-xs">{customer.name}</span>
                          <span className="text-[10px] font-mono text-slate-400">{customer.nit || 'Consumidor Final'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex gap-1.5 items-center flex-wrap">
                            <Badge variant="outline" className={`text-[8px] font-black uppercase ${customer.category === 'Crédito Fiscal' ? 'bg-sky-50 text-sky-600 border-sky-100' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                              {customer.category || customer.type}
                            </Badge>
                            {customer.is_authorized_credit ? (
                              <Badge className="bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 text-[8px] font-black uppercase">
                                CRÉDITO AUT: ${(parseFloat(customer.credit_limit) || 0).toFixed(2)}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[8px] font-black uppercase text-slate-400 dark:text-muted-foreground border-slate-200 dark:border-border">
                                SIN CRÉDITO
                              </Badge>
                            )}
                          </div>
                          {customer.giro && (
                            <span className="text-[9px] text-muted-foreground italic truncate max-w-[150px]">{customer.giro}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right px-6">
                        <div className="flex flex-col items-end gap-0.5">
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-600 dark:text-muted-foreground">
                            {customer.phone || 'N/A'}
                            <Phone size={10} className="text-slate-400" />
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-600 dark:text-muted-foreground">
                            {customer.email || 'N/A'}
                            <Mail size={10} className="text-slate-400" />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-4">
                        <div className="flex items-center gap-1 justify-end">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => {
                              setEditingCustomer(customer);
                              setEditForm({
                                id: customer.id,
                                name: customer.name || '',
                                nit: customer.nit || '',
                                nrc: customer.nrc || '',
                                giro: customer.giro || '',
                                email: customer.email || '',
                                phone: customer.phone || '',
                                address: customer.address || '',
                                type: customer.type || 'Individual',
                                category: customer.category || 'Consumidor Final',
                                is_authorized_credit: !!customer.is_authorized_credit,
                                credit_limit: (customer.credit_limit || 0.00).toString()
                              });
                              setIsEditOpen(true);
                            }}
                            className="h-8 w-8 text-slate-400 hover:text-sky-500 hover:bg-slate-100 dark:hover:bg-muted rounded-lg"
                          >
                            <Pencil size={13} />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleDeleteCustomer(customer.id)}
                            className="h-8 w-8 text-slate-300 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg"
                          >
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

      {/* Diálogo de Edición de Cliente Premium */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg bg-card text-foreground border rounded-2xl overflow-hidden p-6 max-h-[90vh] flex flex-col shadow-2xl">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="flex items-center gap-2 text-foreground text-lg font-black uppercase tracking-tight">
              <Pencil className="text-sky-500" size={20} />
              Editar Cliente
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs text-left">
              Actualice los datos comerciales y de crédito de la cuenta seleccionada.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateCustomer} className="flex-1 overflow-y-auto my-4 pr-1 space-y-4 no-scrollbar">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Nombre completo / Razón Social</Label>
              <Input 
                value={editForm.name}
                onChange={e => setEditForm({...editForm, name: e.target.value})}
                className="h-10 bg-muted border-none rounded-xl text-xs font-bold"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Tipo</Label>
                <Select value={editForm.type} onValueChange={val => setEditForm({...editForm, type: val})}>
                  <SelectTrigger className="h-10 bg-muted border-none rounded-xl text-xs font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Individual">Individual</SelectItem>
                    <SelectItem value="Empresa">Empresa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Categoría</Label>
                <Select value={editForm.category} onValueChange={val => setEditForm({...editForm, category: val})}>
                  <SelectTrigger className="h-10 bg-muted border-none rounded-xl text-xs font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Consumidor Final">Consumidor Final</SelectItem>
                    <SelectItem value="Crédito Fiscal">Crédito Fiscal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {editForm.category === 'Crédito Fiscal' && (
              <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-1">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">NIT</Label>
                  <Input 
                    placeholder="NIT..." 
                    value={editForm.nit}
                    onChange={e => setEditForm({...editForm, nit: e.target.value})}
                    className="h-10 bg-muted border-none rounded-xl text-xs font-mono font-bold"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">NRC</Label>
                  <Input 
                    placeholder="NRC..." 
                    value={editForm.nrc}
                    onChange={e => setEditForm({...editForm, nrc: e.target.value})}
                    className="h-10 bg-muted border-none rounded-xl text-xs font-mono font-bold"
                  />
                </div>
              </div>
            )}

            {editForm.category === 'Crédito Fiscal' && (
              <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Giro Comercial</Label>
                <Select value={editForm.giro} onValueChange={val => setEditForm({...editForm, giro: val})}>
                  <SelectTrigger className="h-10 bg-muted border-none rounded-xl text-xs font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent className="max-w-[400px]">
                    {GIROS_AUTORIZADOS.map((giro, idx) => (
                      <SelectItem key={idx} value={giro} className="text-[11px] py-2">{giro}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Correo Electrónico</Label>
                <Input 
                  type="email" 
                  value={editForm.email}
                  onChange={e => setEditForm({...editForm, email: e.target.value})}
                  className="h-10 bg-muted border-none rounded-xl text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Teléfono</Label>
                <Input 
                  value={editForm.phone}
                  onChange={e => setEditForm({...editForm, phone: e.target.value})}
                  className="h-10 bg-muted border-none rounded-xl text-xs font-bold"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Dirección</Label>
              <textarea 
                placeholder="Dirección..."
                value={editForm.address}
                onChange={e => setEditForm({...editForm, address: e.target.value})}
                className="w-full min-h-[50px] p-2.5 bg-muted border-none rounded-xl text-xs focus:ring-1 outline-none transition-all text-foreground"
              />
            </div>

            {/* Crédito */}
            <div className="p-4 rounded-2xl bg-muted/40 border space-y-3">
              <h4 className="text-[10px] font-black uppercase text-sky-600 dark:text-sky-400 tracking-widest flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500"></span> Control de Crédito
              </h4>
              <div className="grid grid-cols-2 gap-4 items-center">
                <div className="flex items-center justify-between p-2 bg-background rounded-xl border shadow-sm">
                  <span className="text-[11px] font-bold text-muted-foreground">¿Autorizar?</span>
                  <Switch 
                    checked={editForm.is_authorized_credit}
                    onCheckedChange={val => setEditForm({...editForm, is_authorized_credit: val})}
                  />
                </div>
                
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Límite ($)</Label>
                  <Input 
                    type="number" 
                    value={editForm.credit_limit}
                    onChange={e => setEditForm({...editForm, credit_limit: e.target.value})}
                    disabled={!editForm.is_authorized_credit}
                    className="h-9 bg-background border rounded-xl text-xs font-bold text-sky-600 dark:text-sky-400"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 gap-2 border-t">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsEditOpen(false)}
                className="rounded-xl text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSavingEdit}
                className="bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs px-5 shadow-md shadow-sky-500/20"
              >
                {isSavingEdit ? <Loader2 className="animate-spin mr-1" size={14} /> : null}
                Guardar Cambios
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
