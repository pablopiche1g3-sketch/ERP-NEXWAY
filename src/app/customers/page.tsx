
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
  Pencil,
  Lock
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
    credit_limit: '0.00',
    credit_days: '30'
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
    credit_days: '30'
  });

  // Estados para Modal de Autorización
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [pendingAuthAction, setPendingAuthAction] = useState<'create' | 'edit' | null>(null);

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

  const [customers, setCustomers] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

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

  useEffect(() => {
    loadCustomersData();
  }, []);

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
          credit_days: parseInt(form.credit_days) || 0
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
        credit_days: '30'
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
          credit_days: parseInt(editForm.credit_days) || 0
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

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
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
                                credit_days: (customer.credit_days || 30).toString()
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

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-6">
          <form onSubmit={handleUpdateCustomer} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-400">Nombre</Label>
              <Input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="h-10 bg-white/5 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl" />
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
            <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 rounded-xl">Guardar Cambios</Button>
          </form>
        </DialogContent>
      </Dialog>

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
              className="h-12 text-center text-lg tracking-[0.5em] bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl"
              autoFocus
            />
            {authError && <p className="text-[10px] text-rose-500 font-bold text-center">{authError}</p>}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setAuthModalOpen(false)} className="rounded-xl flex-1 text-xs">Cancelar</Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 rounded-xl flex-1 text-xs">Autorizar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
