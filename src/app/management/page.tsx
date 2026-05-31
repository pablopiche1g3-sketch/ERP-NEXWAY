
'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  ArrowLeft, 
  Lock, 
  Unlock, 
  Save,
  Loader2,
  AlertCircle,
  Coins,
  DollarSign,
  Mail,
  Users,
  Trash2,
  Database,
  CheckCircle2,
  XCircle,
  Terminal,
  AlertTriangle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { supabase } from '@/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

export default function ManagementPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [cashFloat, setCashFloat] = useState<string>('0');
  const [catchAllEmail, setCatchAllEmail] = useState<string>('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [preAssignEmail, setPreAssignEmail] = useState('');
  const [preAssignRole, setPreAssignRole] = useState('vendedor');

  // Estados de datos
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [config, setConfig] = useState<any>({
    inventory: true,
    accounting: true,
    customers: true,
    suppliers: true,
    purchases: true,
    billing: true,
    orders: true,
    transfers: true,
    quotations: true,
    quedan: true,
    institutional: true,
    management: true
  });

  // Estados para Auditoría de Supabase
  const [dbStatus, setDbStatus] = useState<Record<string, 'idle' | 'checking' | 'ok' | 'error'>>({
    inventory: 'idle',
    inventory_stock: 'idle',
    company_mappings: 'idle',
    daily_closings: 'idle',
    internal_orders: 'idle',
    supplier_orders: 'idle',
    customers: 'idle'
  });
  const [dbErrors, setDbErrors] = useState<Record<string, string>>({});
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);

  const runDiagnostics = async () => {
    setIsDiagnosing(true);
    const tablesToTest = {
      inventory: 'sku, name, category, price',
      inventory_stock: 'id, sku, warehouse_id, quantity',
      company_mappings: 'id, master_sku, product_name, company_name, company_sku',
      daily_closings: 'id, date, system_cash_sales, system_card_sales, system_check_sales, system_transfer_sales, system_credit_sales',
      internal_orders: 'id, code, source_warehouse, destination_warehouse, requested_by, items, status',
      supplier_orders: 'id, code, supplier_name, supplier_email, from_email, authorized_by, digitized_by, supplier_phone, status',
      customers: 'id, name, is_authorized_credit, credit_limit'
    };

    // Reset status to checking
    const initialStatus = { ...dbStatus };
    Object.keys(tablesToTest).forEach(t => {
      initialStatus[t] = 'checking';
    });
    setDbStatus(initialStatus);
    setDbErrors({});

    for (const [table, cols] of Object.entries(tablesToTest)) {
      try {
        const { error } = await supabase
          .from(table)
          .select(cols)
          .limit(1);

        if (error) {
          setDbStatus(prev => ({ ...prev, [table]: 'error' }));
          setDbErrors(prev => ({ ...prev, [table]: error.message || 'Error de conexión o columnas faltantes.' }));
        } else {
          setDbStatus(prev => ({ ...prev, [table]: 'ok' }));
        }
      } catch (err: any) {
        setDbStatus(prev => ({ ...prev, [table]: 'error' }));
        setDbErrors(prev => ({ ...prev, [table]: err?.message || 'Error inesperado.' }));
      }
    }
    setIsDiagnosing(false);
  };

  const loadData = async () => {
    try {
      setLoadingUsers(true);
      
      // 1. Cargar usuarios/perfiles reales de Supabase
      const { data: profsData, error: profsErr } = await supabase.from('profiles').select('*').order('email');
      if (profsErr) throw profsErr;

      // 2. Cargar roles preasignados
      const { data: preConf } = await supabase.from('system_config').select('*').eq('key', 'preassigned_roles').maybeSingle();
      const preassignedMap = preConf?.value || {};

      const consolidatedUsers = (profsData || []).map(p => ({
        id: p.id,
        email: p.email,
        role: p.role,
        isPreassigned: false,
        createdAt: p.created_at
      }));

      Object.keys(preassignedMap).forEach(email => {
        if (!consolidatedUsers.some(u => u.email?.toLowerCase() === email.toLowerCase())) {
          consolidatedUsers.push({
            id: 'preassigned:' + email,
            email: email,
            role: preassignedMap[email],
            isPreassigned: true,
            createdAt: new Date().toISOString()
          });
        }
      });

      setUsersList(consolidatedUsers);

      // 3. Cargar configuración de módulos
      const { data: modConf, error: modErr } = await supabase.from('system_config').select('*').eq('key', 'module_config').maybeSingle();
      if (modConf && modConf.value) {
        setConfig(modConf.value);
      }

      // 4. Cargar configuración de caja
      const { data: cashConf, error: cashErr } = await supabase.from('system_config').select('*').eq('key', 'cash_config').maybeSingle();
      if (cashConf && cashConf.value) {
        setCashFloat(cashConf.value.cashFloat?.toString() || '0');
        setCatchAllEmail(cashConf.value.catchAllEmail || '');
      }

    } catch (e: any) {
      console.error('Error al cargar datos de gerencia:', e);
      toast({ 
        variant: "destructive", 
        title: "Error de Carga", 
        description: e.message || e.details || "No se pudieron cargar las configuraciones." 
      });
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleModule = async (moduleId: string, value: boolean) => {
    const newConfig = { ...config, [moduleId]: value };
    setIsSaving(true);
    try {
      const { error } = await supabase.from('system_config').upsert({ key: 'module_config', value: newConfig });
      if (error) throw error;
      setConfig(newConfig);
      toast({ title: "Módulo Actualizado", description: `Estado cambiado exitosamente.` });
    } catch (error: any) {
      console.error('Error al cambiar estado de módulo:', error);
      toast({ 
        variant: "destructive", 
        title: "Error al actualizar", 
        description: error.message || error.details || "No se pudo actualizar." 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const ROLE_NAMES: Record<string, string> = {
    admin: 'Administrador / Gerente',
    gerencia: 'Gerencia',
    encargado: 'Encargado',
    sub_encargado: 'Sub Encargado',
    cajero: 'Cajero',
    vendedor: 'Vendedor',
    bodeguero: 'Bodeguero',
    motociclista: 'Motociclista',
    pedidos: 'Solo Pedidos',
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    setIsSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
      if (error) throw error;
      toast({ title: "Rol de Usuario Actualizado", description: `El usuario ahora tiene el rol de ${ROLE_NAMES[newRole] || newRole}.` });
      await loadData();
    } catch (error: any) {
      console.error('Error al actualizar rol de usuario:', error);
      toast({ 
        variant: "destructive", 
        title: "Error al cambiar rol", 
        description: error.message || error.details || "No se pudo actualizar el rol de usuario." 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevokeRole = async (userId: string, email: string) => {
    setIsSaving(true);
    try {
      if (userId.startsWith('preassigned:')) {
        // Eliminar del mapa de preassigned_roles en system_config
        const { data: preConf } = await supabase.from('system_config').select('*').eq('key', 'preassigned_roles').maybeSingle();
        const currentPreassigned = preConf?.value || {};
        const cleanEmail = userId.replace('preassigned:', '');
        
        // Eliminar llave
        delete currentPreassigned[cleanEmail];
        
        const { error } = await supabase.from('system_config').upsert({ key: 'preassigned_roles', value: currentPreassigned });
        if (error) throw error;
      } else {
        // Eliminar de profiles
        const { error } = await supabase.from('profiles').delete().eq('id', userId);
        if (error) throw error;
      }
      toast({ title: "Asignación Revocada", description: `Se ha revocado el acceso de ${email}.` });
      await loadData();
    } catch (error: any) {
      console.error('Error al revocar acceso:', error);
      toast({ 
        variant: "destructive", 
        title: "Error al revocar", 
        description: error.message || error.details || "No se pudo revocar el acceso." 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePreAssignRole = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailToAssign = preAssignEmail.trim().toLowerCase();
    if (!emailToAssign) {
      toast({ variant: "destructive", title: "Campo requerido", description: "Por favor ingrese un correo electrónico." });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailToAssign)) {
      toast({ variant: "destructive", title: "Formato inválido", description: "Ingrese un correo electrónico válido." });
      return;
    }

    setIsSaving(true);
    try {
      const existingUser = usersList?.find((usr: any) => usr.email?.toLowerCase() === emailToAssign);
      
      if (existingUser) {
        const { error } = await supabase.from('profiles').update({ role: preAssignRole }).eq('id', existingUser.id);
        if (error) throw error;
        toast({ 
          title: "Usuario Actualizado", 
          description: `El usuario ya estaba registrado. Se actualizó su rol a ${ROLE_NAMES[preAssignRole]}.` 
        });
      } else {
        // Preasignar en public.system_config para evitar violaciones de llave foránea en profiles
        const { data: preConf } = await supabase.from('system_config').select('*').eq('key', 'preassigned_roles').maybeSingle();
        const currentPreassigned = preConf?.value || {};
        const updatedPreassigned = { ...currentPreassigned, [emailToAssign]: preAssignRole };
        await supabase.from('system_config').upsert({ key: 'preassigned_roles', value: updatedPreassigned });

        toast({ 
          title: "Rol Pre-asignado", 
          description: `El correo ${emailToAssign} fue pre-asignado como ${ROLE_NAMES[preAssignRole]} exitosamente.` 
        });
      }
      setPreAssignEmail('');
      await loadData();
    } catch (error: any) {
      console.error('Error al preasignar rol:', error);
      toast({ 
        variant: "destructive", 
        title: "Error al preasignar", 
        description: error.message || error.details || "No se pudo pre-asignar el rol." 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSystemConfig = async () => {
    const val = parseFloat(cashFloat);
    if (isNaN(val)) {
      toast({ variant: "destructive", title: "Valor Inválido", description: "Ingrese un número válido para el fondo." });
      return;
    }
    
    setIsSaving(true);
    try {
      const { error } = await supabase.from('system_config').upsert({
        key: 'cash_config',
        value: {
          cashFloat: val,
          catchAllEmail: catchAllEmail.trim()
        }
      });
      if (error) throw error;
      toast({ title: "Configuración Actualizada", description: "Los ajustes globales han sido guardados." });
      setIsInitialized(true);
      await loadData();
    } catch (error: any) {
      console.error('Error al guardar ajustes globales:', error);
      toast({ 
        variant: "destructive", 
        title: "Error al guardar", 
        description: error.message || error.details || "Error al guardar en la base de datos." 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const modules = [
    { 
      id: 'billing', 
      label: 'Módulo de Facturación', 
      desc: 'Ventas, cobros y arqueos',
      tabs: [
        { id: 'facturacion', label: 'Facturación' },
        { id: 'historial', label: 'Historial' },
        { id: 'nota_credito', label: 'Nota de Crédito' },
        { id: 'nota_debito', label: 'Nota de Débito' },
        { id: 'arqueo', label: 'Arqueo de Caja' },
        { id: 'creditos', label: 'Créditos' },
      ]
    },
    { 
      id: 'accounting', 
      label: 'Contabilidad Básica', 
      desc: 'Estado de resultados e IVA',
      tabs: [
        { id: 'diario', label: 'Libro Diario' },
        { id: 'balance-comprobacion', label: 'Balance de Comprobación' },
        { id: 'rentabilidad', label: 'Rentabilidad' },
        { id: 'libros_iva', label: 'Libros de IVA' },
        { id: 'mh_forms', label: 'MH Formularios' },
        { id: 'tributario', label: 'Tributario' },
        { id: 'caja-chica', label: 'Caja Chica' },
        { id: 'pnl', label: 'Estado de Resultados' },
        { id: 'settings', label: 'Configuración' },
      ]
    },
    { 
      id: 'orders', 
      label: 'Módulo de Pedidos', 
      desc: 'Pedidos internos y externos (proveedor)',
      tabs: [
        { id: 'interno', label: 'Pedidos Internos' },
        { id: 'externo', label: 'Pedidos de Proveedor' },
        { id: 'cargar-codigos', label: 'Cargar y Limpiar Códigos Excel' },
      ]
    },
    { 
      id: 'inventory', 
      label: 'Inventario Maestro', 
      desc: 'Control de SKUs y Stock',
      tabs: [
        { id: 'existencia', label: 'Existencias por Bodega' },
        { id: 'maestro', label: 'Maestro de Catálogo' },
        { id: 'kardex', label: 'Kardex de Almacén' },
        { id: 'toma-fisica', label: 'Toma Física (Ajustes)' },
        { id: 'carga-masiva', label: 'Carga Masiva (Excel)' },
        { id: 'entradas', label: 'Entrada Rápida de Stock' },
        { id: 'config', label: 'Bodegas' },
      ]
    },
    { id: 'purchases', label: 'Registro de Compras', desc: 'Ingreso de mercadería al stock' },
    { id: 'suppliers', label: 'Directorio de Proveedores', desc: 'Gestión de suministrantes' },
    { id: 'quedan', label: 'Gestión de Quedan', desc: 'Programación de pagos' },
    { id: 'quotations', label: 'Cotizaciones', desc: 'Presupuestos para clientes' },
    { id: 'transfers', label: 'Traslados', desc: 'Movimientos logísticos' },
    { id: 'customers', label: 'Registro de Clientes', desc: 'Cartera de contribuyentes' },
    { id: 'institutional', label: 'Ventas Institucionales', desc: 'Licitaciones y Proyectos' },
  ];

  const [activeTab, setActiveTab] = useState('config');

  useEffect(() => {
    if (activeTab === 'config') {
      runDiagnostics();
    }
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 transition-colors duration-300">
      <div className="max-w-4xl mx-auto mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="rounded-full bg-card shadow-sm border" onClick={() => router.push('/')}>
            <ArrowLeft className="text-foreground" size={20} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gerencia y Control</h1>
            <p className="text-muted-foreground text-sm">Configuración global del sistema</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-muted p-1 rounded-2xl border flex w-full justify-start md:w-fit overflow-x-auto no-scrollbar">
            <TabsTrigger value="config" className="rounded-xl px-6 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              ⚙️ Configuración Global
            </TabsTrigger>
            <TabsTrigger value="permissions" className="rounded-xl px-6 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              🔒 Permisos de Módulos
            </TabsTrigger>
            <TabsTrigger value="roles" className="rounded-xl px-6 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              👥 Roles de Usuario
            </TabsTrigger>
          </TabsList>

          {/* pestaña 1: CONFIGURACIÓN GLOBAL */}
          <TabsContent value="config" className="grid grid-cols-1 md:grid-cols-12 gap-6 outline-none">
            <div className="md:col-span-7 space-y-6">
              <Card className="border shadow-md rounded-3xl bg-card overflow-hidden">
                <CardHeader className="bg-slate-900 text-white p-6 dark:bg-slate-950">
                  <CardTitle className="flex items-center gap-2 text-base font-black uppercase tracking-tight">
                    <Coins className="text-blue-400" size={20} />
                    Ajustes Operativos
                  </CardTitle>
                  <CardDescription className="text-slate-400 text-xs">Fondo base y correo de respaldo para DTE.</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Fondo Base de Caja ($)</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                        <Input 
                          type="number" 
                          placeholder="0.00" 
                          value={cashFloat}
                          onChange={(e) => setCashFloat(e.target.value)}
                          className="h-12 pl-12 text-lg font-black bg-muted rounded-xl border-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Correo Bolsón (Catch-all)</Label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                        <Input 
                          type="email" 
                          placeholder="facturas@empresa.com" 
                          value={catchAllEmail}
                          onChange={(e) => setCatchAllEmail(e.target.value)}
                          className="h-12 pl-12 text-sm font-bold bg-muted rounded-xl border-none"
                        />
                      </div>
                      <p className="text-[9px] text-muted-foreground italic">Recibirá copia de todos los DTEs emitidos.</p>
                    </div>
                  </div>

                  <Button 
                    onClick={handleSaveSystemConfig} 
                    disabled={isSaving}
                    className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 active:scale-95 transition-all"
                  >
                    {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" size={18} />}
                    GUARDAR AJUSTES
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="md:col-span-5 space-y-6">
              <div className="bg-blue-50 border border-blue-100 p-6 rounded-3xl flex flex-col justify-center gap-3 dark:bg-blue-900/10 dark:border-blue-900/20">
                <div className="flex items-center gap-2 text-blue-800 font-bold dark:text-blue-300">
                  <AlertCircle size={20} />
                  <p className="text-sm uppercase tracking-tight">Notificaciones DTE</p>
                </div>
                <p className="text-xs text-blue-700 leading-relaxed dark:text-blue-400">
                  El correo bolsón es obligatorio para cumplir con la normativa de respaldo digital. Si un cliente no está registrado o no proporciona correo, el sistema enviará automáticamente el DTE a la dirección configurada arriba para su posterior entrega física o reenvío manual.
                </p>
              </div>

              <Card className="border shadow-md rounded-3xl bg-card overflow-hidden">
                <CardHeader className="bg-slate-900 text-white p-6 dark:bg-slate-950">
                  <CardTitle className="flex items-center gap-2 text-base font-black uppercase tracking-tight">
                    <Database className="text-emerald-400" size={20} />
                    Auditoría de Supabase
                  </CardTitle>
                  <CardDescription className="text-slate-400 text-xs">
                    Verifique el estado de las tablas relacionales y esquemas en tiempo real.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="space-y-3">
                    {Object.keys(dbStatus).map((table) => {
                      const status = dbStatus[table];
                      const errorMsg = dbErrors[table];
                      
                      return (
                        <div key={table} className="flex flex-col gap-1.5 p-3 rounded-2xl bg-muted/50 border border-muted-foreground/10">
                          <div className="flex items-center justify-between">
                            <code className="text-xs font-mono font-bold text-foreground">{table}</code>
                            <div className="flex items-center gap-2">
                              {status === 'checking' && (
                                <Loader2 className="animate-spin text-amber-500" size={14} />
                              )}
                              {status === 'ok' && (
                                <span className="flex items-center gap-1 text-[9px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                                  <CheckCircle2 size={10} /> OK
                                </span>
                              )}
                              {status === 'error' && (
                                <span className="flex items-center gap-1 text-[9px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-full">
                                  <XCircle size={10} /> ERROR
                                </span>
                              )}
                              {status === 'idle' && (
                                <span className="text-[9px] font-bold bg-slate-500/10 text-slate-500 px-2 py-0.5 rounded-full">
                                  PENDIENTE
                                </span>
                              )}
                            </div>
                          </div>
                          {errorMsg && (
                            <p className="text-[10px] text-rose-500 font-semibold leading-tight break-words border-t border-rose-500/10 pt-1.5 mt-0.5">
                              {errorMsg}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-2 space-y-2">
                    <Button
                      onClick={runDiagnostics}
                      disabled={isDiagnosing}
                      variant="outline"
                      className="w-full h-11 border-dashed font-bold rounded-xl text-xs active:scale-95 transition-all"
                    >
                      {isDiagnosing ? (
                        <>
                          <Loader2 className="animate-spin mr-2" size={14} />
                          VERIFICANDO...
                        </>
                      ) : (
                        "EJECUTAR DIAGNÓSTICO MANUAL"
                      )}
                    </Button>

                    <Button
                      onClick={() => setIsSqlModalOpen(true)}
                      className="w-full h-11 bg-slate-900 text-slate-100 dark:bg-slate-100 dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-slate-900/10 active:scale-95 transition-all"
                    >
                      <Terminal size={14} />
                      VER SCRIPT SQL DE ACTUALIZACIÓN
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* pestaña 2: PERMISOS DE MÓDULOS */}
          <TabsContent value="permissions" className="outline-none">
            <Card className="border shadow-md rounded-3xl bg-card overflow-hidden">
              <CardHeader className="bg-slate-900 text-white p-6 dark:bg-slate-950">
                <CardTitle className="flex items-center gap-2 text-base font-black uppercase tracking-tight">
                  <ShieldCheck className="text-blue-400" size={20} />
                  Estado de Módulos Operativos
                </CardTitle>
                <CardDescription className="text-slate-400 text-xs">Active o desactive funciones para toda la empresa.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {modules.map((m) => (
                    <div key={m.id} className="p-6 hover:bg-muted/10 transition-colors space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <Label className="text-sm font-bold text-foreground">{m.label}</Label>
                          <p className="text-xs text-muted-foreground">{m.desc}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          {config?.[m.id] === false ? <Lock className="text-rose-500" size={16} /> : <Unlock className="text-emerald-500" size={16} />}
                          <Switch 
                            checked={config?.[m.id] !== false} 
                            onCheckedChange={(val) => handleToggleModule(m.id, val)}
                            disabled={isSaving}
                          />
                        </div>
                      </div>

                      {config?.[m.id] !== false && m.tabs && (
                        <div className="ml-6 pl-4 border-l-2 border-slate-200 dark:border-slate-800 space-y-3 pt-2">
                          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Habilitar Pestañas del Módulo</p>
                          {m.tabs.map((tab) => (
                            <div key={tab.id} className="flex items-center justify-between py-1">
                              <Label className="text-xs font-semibold text-slate-600 dark:text-slate-300">{tab.label}</Label>
                              <Switch 
                                checked={config?.[`${m.id}_${tab.id}`] !== false} 
                                onCheckedChange={(val) => handleToggleModule(`${m.id}_${tab.id}`, val)}
                                disabled={isSaving}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* pestaña 3: ROLES DE USUARIO */}
          <TabsContent value="roles" className="outline-none">
            <Card className="border shadow-md rounded-3xl bg-card overflow-hidden">
              <CardHeader className="bg-slate-900 text-white p-6 dark:bg-slate-950">
                <CardTitle className="flex items-center gap-2 text-base font-black uppercase tracking-tight">
                  <Users className="text-violet-400" size={20} />
                  Gestión de Usuarios y Roles
                </CardTitle>
                <CardDescription className="text-slate-400 text-xs">Asigne roles de acceso para controlar los módulos visibles.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {/* Formulario de pre-asignación */}
                <div className="p-6 bg-slate-50 dark:bg-slate-900/30 border-b border-border">
                  <form onSubmit={handlePreAssignRole} className="flex flex-col sm:flex-row items-end gap-4">
                    <div className="flex-1 space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Pre-asignar Acceso por Correo</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                        <Input 
                          type="email" 
                          placeholder="correo@empleado.com" 
                          value={preAssignEmail}
                          onChange={(e) => setPreAssignEmail(e.target.value)}
                          className="h-10 pl-10 text-xs font-bold bg-background rounded-xl border-border"
                        />
                      </div>
                    </div>

                    <div className="w-full sm:w-[200px] space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Rol del Puesto</Label>
                      <Select 
                        value={preAssignRole} 
                        onValueChange={setPreAssignRole}
                      >
                        <SelectTrigger className="w-full h-10 bg-background border-border rounded-xl text-xs font-bold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gerencia">Gerencia</SelectItem>
                          <SelectItem value="encargado">Encargado</SelectItem>
                          <SelectItem value="sub_encargado">Sub Encargado</SelectItem>
                          <SelectItem value="cajero">Cajero</SelectItem>
                          <SelectItem value="vendedor">Vendedor</SelectItem>
                          <SelectItem value="bodeguero">Bodeguero</SelectItem>
                          <SelectItem value="motociclista">Motociclista</SelectItem>
                          <SelectItem value="pedidos">Solo Pedidos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button 
                      type="submit" 
                      disabled={isSaving}
                      className="w-full sm:w-auto h-10 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl shadow-lg shadow-violet-600/20 px-6"
                    >
                      {isSaving ? <Loader2 className="animate-spin" size={16} /> : "+ ASIGNAR"}
                    </Button>
                  </form>
                </div>

                {loadingUsers ? (
                  <div className="p-6 flex items-center justify-center">
                    <Loader2 className="animate-spin text-violet-600 animate-pulse" />
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {usersList.map((usr: any) => {
                      const isPreassigned = usr.isPreassigned || usr.id.startsWith('email:');
                      return (
                        <div key={usr.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/30 transition-colors">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Label className="text-sm font-bold text-foreground">{usr.email || 'Usuario sin correo'}</Label>
                              {isPreassigned ? (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                  Pre-asignado (Pendiente)
                                </span>
                              ) : (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                  Registrado
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground font-mono">
                              {isPreassigned ? 'ID Pre: ' + usr.id : 'UID: ' + (usr.uid || usr.id)}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <Select 
                              value={usr.role || 'pedidos'} 
                              onValueChange={(val) => handleChangeRole(usr.id, val)}
                              disabled={isSaving || 
                                        usr.email === 'pablopiche1g3@gmail.com' || 
                                        usr.email === 'pinturas.tecnicolorsw@gmail.com' ||
                                        usr.email === 'saladventastecnicolor@gmail.com'}
                            >
                              <SelectTrigger className="w-[180px] h-10 bg-muted border-none rounded-xl text-xs font-bold">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Administrador / Gerente</SelectItem>
                                <SelectItem value="gerencia">Gerencia</SelectItem>
                                <SelectItem value="encargado">Encargado</SelectItem>
                                <SelectItem value="sub_encargado">Sub Encargado</SelectItem>
                                <SelectItem value="cajero">Cajero</SelectItem>
                                <SelectItem value="vendedor">Vendedor</SelectItem>
                                <SelectItem value="bodeguero">Bodeguero</SelectItem>
                                <SelectItem value="motociclista">Motociclista</SelectItem>
                                <SelectItem value="pedidos">Solo Pedidos</SelectItem>
                              </SelectContent>
                            </Select>

                            {usr.email !== 'pablopiche1g3@gmail.com' && 
                             usr.email !== 'pinturas.tecnicolorsw@gmail.com' && 
                             usr.email !== 'saladventastecnicolor@gmail.com' && (
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => handleRevokeRole(usr.id, usr.email)}
                                disabled={isSaving}
                                className="text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-xl h-10 w-10 flex items-center justify-center"
                                title="Revocar acceso / eliminar pre-asignación"
                              >
                                <Trash2 size={18} />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {usersList.length === 0 && (
                      <div className="p-6 text-center text-sm text-muted-foreground">
                        No hay otros usuarios registrados en el sistema.
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={isSqlModalOpen} onOpenChange={setIsSqlModalOpen}>
        <DialogContent className="max-w-2xl bg-slate-950 text-slate-100 border-slate-800 rounded-3xl overflow-hidden p-6 max-h-[85vh] flex flex-col">
          <DialogHeader className="pb-4 border-b border-slate-800">
            <DialogTitle className="flex items-center gap-2 text-white text-lg font-black uppercase tracking-tight">
              <Terminal className="text-emerald-400" size={20} />
              Script SQL de Migración Supabase
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs text-left">
              Copia y pega este script en el SQL Editor de tu panel de control de Supabase para asegurar que todas las tablas y columnas necesarias estén creadas y configuradas correctamente.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto my-4 rounded-xl bg-slate-900/80 p-4 border border-slate-850 font-mono text-xs text-slate-350 leading-relaxed no-scrollbar select-all whitespace-pre-wrap">
{`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. CREACIÓN DE TABLAS DE PEDIDOS SI NO EXISTEN
CREATE TABLE IF NOT EXISTS public.internal_orders (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  code text,
  source_warehouse text NOT NULL,
  destination_warehouse text NOT NULL,
  requested_by text NOT NULL,
  items jsonb NOT NULL,
  status text NOT NULL DEFAULT 'PENDIENTE', -- PENDIENTE, APROBADO, CANCELADO
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.supplier_orders (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  code text,
  supplier_name text NOT NULL,
  destination_warehouse text NOT NULL,
  requested_by text NOT NULL,
  items jsonb NOT NULL,
  total numeric(10,2) DEFAULT 0.00,
  supplier_email text,
  from_email text,
  authorized_by text,
  digitized_by text,
  supplier_phone text,
  status text NOT NULL DEFAULT 'PENDIENTE', -- PENDIENTE, APROBADO, RECHAZADO
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Asegurar columnas si las tablas ya existían a medias
ALTER TABLE public.internal_orders ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE public.supplier_orders ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE public.supplier_orders ADD COLUMN IF NOT EXISTS total numeric(10,2) DEFAULT 0.00;

-- 🛠️ CORRECCIÓN: Asegurar columnas de IVA y Percepción en la tabla de Proveedores (Suppliers)
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS apply_retention boolean NOT NULL DEFAULT false;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS apply_perception boolean NOT NULL DEFAULT false;

-- 🛠️ CONTROL DE CRÉDITO CLIENTES: Asegurar columnas de autorización y límite en la tabla de Clientes (Customers)
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS is_authorized_credit boolean NOT NULL DEFAULT false;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS credit_limit numeric(10,2) NOT NULL DEFAULT 0.00;

-- 2. CONFIGURACIÓN DEL SISTEMA
CREATE TABLE IF NOT EXISTS public.system_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL
);

INSERT INTO public.system_config (key, value)
VALUES 
  ('module_config', '{"orders": true, "transfers": true, "quotations": true, "quedan": true, "institutional": true, "management": true}'::jsonb),
  ('cash_config', '{"cashFloat": 100.00, "catchAllEmail": "pablopiche1g3@gmail.com"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 3. TRASLADOS
CREATE TABLE IF NOT EXISTS public.transfers (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  type text NOT NULL, -- 'INTERNO' o 'INTERTIENDA'
  source text NOT NULL,
  destination text NOT NULL,
  authorized_by text NOT NULL,
  items jsonb NOT NULL,
  status text NOT NULL DEFAULT 'COMPLETADO',
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. AREA DE QUEDAN
CREATE TABLE IF NOT EXISTS public.quedan (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  supplier text NOT NULL,
  due_date date NOT NULL,
  invoices jsonb NOT NULL,
  total_amount numeric(10,2) NOT NULL DEFAULT 0.00,
  status text NOT NULL DEFAULT 'PENDIENTE',
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. LICITACIONES / INSTITUCIONAL
CREATE TABLE IF NOT EXISTS public.institutional_projects (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text NOT NULL,
  purchase_order text,
  total_budget numeric(10,2) NOT NULL DEFAULT 0.00,
  customer_name text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'EN CURSO',
  documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.institutional_sales (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id uuid REFERENCES public.institutional_projects(id) ON DELETE SET NULL,
  doc_number text NOT NULL,
  total numeric(10,2) NOT NULL DEFAULT 0.00,
  date date NOT NULL DEFAULT current_date,
  items text,
  cart_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  concept text,
  customer_name text,
  customer_email text,
  status text NOT NULL DEFAULT 'COMPLETADA',
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.institutional_purchases (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id uuid REFERENCES public.institutional_projects(id) ON DELETE SET NULL,
  supplier text,
  doc_number text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total numeric(10,2) NOT NULL DEFAULT 0.00,
  date date NOT NULL DEFAULT current_date,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. ACTIVAR TIEMPO REAL (REAL-TIME) PARA ESCUCHAR CAMBIOS ACTIVAMENTE
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.system_config;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.transfers;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.quedan;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.institutional_projects;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.institutional_sales;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.institutional_purchases;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_orders;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.supplier_orders;
EXCEPTION WHEN OTHERS THEN NULL; END $$;`}
          </div>
          <div className="flex justify-end pt-2 gap-2 border-t border-slate-800">
            <Button
              onClick={() => {
                navigator.clipboard.writeText(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. CREACIÓN DE TABLAS DE PEDIDOS SI NO EXISTEN
CREATE TABLE IF NOT EXISTS public.internal_orders (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  code text,
  source_warehouse text NOT NULL,
  destination_warehouse text NOT NULL,
  requested_by text NOT NULL,
  items jsonb NOT NULL,
  status text NOT NULL DEFAULT 'PENDIENTE', -- PENDIENTE, APROBADO, CANCELADO
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.supplier_orders (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  code text,
  supplier_name text NOT NULL,
  destination_warehouse text NOT NULL,
  requested_by text NOT NULL,
  items jsonb NOT NULL,
  total numeric(10,2) DEFAULT 0.00,
  supplier_email text,
  from_email text,
  authorized_by text,
  digitized_by text,
  supplier_phone text,
  status text NOT NULL DEFAULT 'PENDIENTE', -- PENDIENTE, APROBADO, RECHAZADO
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Asegurar columnas si las tablas ya existían a medias
ALTER TABLE public.internal_orders ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE public.supplier_orders ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE public.supplier_orders ADD COLUMN IF NOT EXISTS total numeric(10,2) DEFAULT 0.00;

-- 🛠️ CORRECCIÓN: Asegurar columnas de IVA y Percepción en la tabla de Proveedores (Suppliers)
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS apply_retention boolean NOT NULL DEFAULT false;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS apply_perception boolean NOT NULL DEFAULT false;

-- 🛠️ CONTROL DE CRÉDITO CLIENTES: Asegurar columnas de autorización y límite en la tabla de Clientes (Customers)
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS is_authorized_credit boolean NOT NULL DEFAULT false;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS credit_limit numeric(10,2) NOT NULL DEFAULT 0.00;

-- 2. CONFIGURACIÓN DEL SISTEMA
CREATE TABLE IF NOT EXISTS public.system_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL
);

INSERT INTO public.system_config (key, value)
VALUES 
  ('module_config', '{"orders": true, "transfers": true, "quotations": true, "quedan": true, "institutional": true, "management": true}'::jsonb),
  ('cash_config', '{"cashFloat": 100.00, "catchAllEmail": "pablopiche1g3@gmail.com"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 3. TRASLADOS
CREATE TABLE IF NOT EXISTS public.transfers (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  type text NOT NULL, -- 'INTERNO' o 'INTERTIENDA'
  source text NOT NULL,
  destination text NOT NULL,
  authorized_by text NOT NULL,
  items jsonb NOT NULL,
  status text NOT NULL DEFAULT 'COMPLETADO',
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. AREA DE QUEDAN
CREATE TABLE IF NOT EXISTS public.quedan (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  supplier text NOT NULL,
  due_date date NOT NULL,
  invoices jsonb NOT NULL,
  total_amount numeric(10,2) NOT NULL DEFAULT 0.00,
  status text NOT NULL DEFAULT 'PENDIENTE',
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. LICITACIONES / INSTITUCIONAL
CREATE TABLE IF NOT EXISTS public.institutional_projects (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text NOT NULL,
  purchase_order text,
  total_budget numeric(10,2) NOT NULL DEFAULT 0.00,
  customer_name text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'EN CURSO',
  documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.institutional_sales (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id uuid REFERENCES public.institutional_projects(id) ON DELETE SET NULL,
  doc_number text NOT NULL,
  total numeric(10,2) NOT NULL DEFAULT 0.00,
  date date NOT NULL DEFAULT current_date,
  items text,
  cart_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  concept text,
  customer_name text,
  customer_email text,
  status text NOT NULL DEFAULT 'COMPLETADA',
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.institutional_purchases (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id uuid REFERENCES public.institutional_projects(id) ON DELETE SET NULL,
  supplier text,
  doc_number text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total numeric(10,2) NOT NULL DEFAULT 0.00,
  date date NOT NULL DEFAULT current_date,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. ACTIVAR TIEMPO REAL (REAL-TIME) PARA ESCUCHAR CAMBIOS ACTIVAMENTE
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.system_config;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.transfers;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.quedan;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.institutional_projects;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.institutional_sales;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.institutional_purchases;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_orders;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.supplier_orders;
EXCEPTION WHEN OTHERS THEN NULL; END $$;`);
                toast({ title: "Copiado", description: "Script SQL copiado al portapapeles exitosamente." });
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl"
            >
              COPIAR AL PORTAPAPELES
            </Button>
            <Button
              variant="ghost"
              onClick={() => setIsSqlModalOpen(false)}
              className="text-slate-400 hover:text-white rounded-xl"
            >
              CERRAR
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
