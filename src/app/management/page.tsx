
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
  Trash2
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

    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Error", description: "No se pudieron cargar las configuraciones." });
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
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar." });
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
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar el rol de usuario." });
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
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo revocar el acceso." });
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
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo pre-asignar el rol." });
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
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "Error al guardar en la base de datos." });
    } finally {
      setIsSaving(false);
    }
  };

  const modules = [
    { id: 'billing', label: 'Módulo de Facturación', desc: 'Ventas, cobros y arqueos' },
    { id: 'accounting', label: 'Contabilidad Básica', desc: 'Estado de resultados e IVA' },
    { id: 'purchases', label: 'Registro de Compras', desc: 'Ingreso de mercadería al stock' },
    { id: 'suppliers', label: 'Directorio de Proveedores', desc: 'Gestión de suministrantes' },
    { id: 'quedan', label: 'Gestión de Quedan', desc: 'Programación de pagos' },
    { id: 'quotations', label: 'Cotizaciones', desc: 'Presupuestos para clientes' },
    { id: 'transfers', label: 'Traslados', desc: 'Movimientos logísticos' },
    { id: 'customers', label: 'Registro de Clientes', desc: 'Cartera de contribuyentes' },
    { id: 'inventory', label: 'Inventario Maestro', desc: 'Control de SKUs y Stock' },
    { id: 'institutional', label: 'Ventas Institucionales', desc: 'Licitaciones y Proyectos' },
  ];

  const [activeTab, setActiveTab] = useState('config');

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

            <div className="md:col-span-5">
              <div className="bg-blue-50 border border-blue-100 p-6 rounded-3xl flex flex-col justify-center gap-3 dark:bg-blue-900/10 dark:border-blue-900/20">
                <div className="flex items-center gap-2 text-blue-800 font-bold dark:text-blue-300">
                  <AlertCircle size={20} />
                  <p className="text-sm uppercase tracking-tight">Notificaciones DTE</p>
                </div>
                <p className="text-xs text-blue-700 leading-relaxed dark:text-blue-400">
                  El correo bolsón es obligatorio para cumplir con la normativa de respaldo digital. Si un cliente no está registrado o no proporciona correo, el sistema enviará automáticamente el DTE a la dirección configurada arriba para su posterior entrega física o reenvío manual.
                </p>
              </div>
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
                    <div key={m.id} className="p-6 flex items-center justify-between hover:bg-muted/30 transition-colors">
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
    </div>
  );
}
