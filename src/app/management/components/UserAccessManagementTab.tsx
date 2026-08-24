'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  Lock, 
  Unlock, 
  Search, 
  RefreshCw, 
  LogOut,
  Laptop,
  CheckCircle2,
  Edit3,
  Sliders,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Trash2
} from 'lucide-react';

export interface ModuleDefinition {
  id: string;
  name: string;
  tabs: { id: string; name: string }[];
}

export const MODULE_CATALOG: ModuleDefinition[] = [
  {
    id: 'billing',
    name: 'Facturación y POS',
    tabs: [
      { id: 'facturacion', name: 'Facturación Rápida' },
      { id: 'historial', name: 'Historial / Ventas' },
      { id: 'nota_credito', name: 'Nota de Crédito' },
      { id: 'nota_debito', name: 'Nota de Débito' },
      { id: 'arqueo', name: 'Arqueo / Cierre de Caja' },
      { id: 'creditos', name: 'Créditos / Abonos' },
    ]
  },
  {
    id: 'compras',
    name: 'Compras y Proveedores',
    tabs: [
      { id: 'interno', name: 'Pedidos Internos (Tiendas)' },
      { id: 'externo', name: 'Pedidos Externos (Proveedores)' },
      { id: 'cargar-codigos', name: 'Cargar Códigos (Excel)' },
      { id: 'historial', name: 'Historial de Pedidos' },
    ]
  },
  {
    id: 'logistica',
    name: 'Logística e Inventarios',
    tabs: [
      { id: 'existencia', name: 'Existencias y Kárdex' },
      { id: 'maestro', name: 'Catálogo Maestro' },
      { id: 'auditoria', name: 'Auditoría de Bodegas' },
      { id: 'config', name: 'Mapeo / Configuración' },
    ]
  },
  {
    id: 'accounting',
    name: 'Contabilidad y Hacienda',
    tabs: [
      { id: 'diario', name: 'Libro Diario' },
      { id: 'balance-comprobacion', name: 'Balance de Comprobación' },
      { id: 'libros_iva', name: 'Libros IVA' },
      { id: 'mh_forms', name: 'Formularios MH' },
      { id: 'tributario', name: 'Resumen Tributario' },
      { id: 'caja-chica', name: 'Caja Chica' },
      { id: 'pnl', name: 'Estado PnL' },
    ]
  },
  {
    id: 'finanzas',
    name: 'Finanzas, Bancos y Créditos',
    tabs: [
      { id: 'cuentas', name: 'Cuentas Bancarias' },
      { id: 'movimientos', name: 'Movimientos' },
      { id: 'creditos', name: 'Créditos y Préstamos' },
    ]
  },
  {
    id: 'crm',
    name: 'CRM Comercial',
    tabs: [
      { id: 'clientes', name: 'Clientes y Oportunidades' },
      { id: 'cotizaciones', name: 'Cotizaciones' },
      { id: 'seguimiento', name: 'Seguimiento' },
    ]
  },
  {
    id: 'management',
    name: 'Gerencia y Reportes',
    tabs: [
      { id: 'usuarios', name: 'Control de Usuarios' },
      { id: 'bi', name: 'Centro Analítico (BI)' },
      { id: 'payroll', name: 'Nómina y RH' },
    ]
  }
];

export const ROLE_PRESETS: Record<string, { label: string; modules: string[]; tabs: string[] }> = {
  cajero: {
    label: '🛒 Cajero POS',
    modules: ['billing', 'compras', 'management'],
    tabs: [
      'billing_facturacion', 'billing_historial', 'billing_arqueo', 'billing_creditos', 
      'compras_interno', 
      'management_usuarios'
    ]
  },
  bodeguero: {
    label: '📦 Bodeguero / Logística',
    modules: ['logistica', 'compras', 'management'],
    tabs: [
      'logistica_existencia', 'logistica_maestro', 'logistica_auditoria', 'logistica_config',
      'compras_interno', 'compras_cargar-codigos', 'compras_historial',
      'management_usuarios'
    ]
  },
  compras: {
    label: '🚚 Encargado de Compras',
    modules: ['compras', 'logistica', 'management'],
    tabs: [
      'compras_interno', 'compras_externo', 'compras_cargar-codigos', 'compras_historial',
      'logistica_existencia', 'logistica_maestro',
      'management_usuarios'
    ]
  },
  contador: {
    label: '📊 Contador / Hacienda',
    modules: ['accounting', 'finanzas', 'billing', 'management'],
    tabs: [
      'accounting_diario', 'accounting_balance-comprobacion', 'accounting_libros_iva', 
      'accounting_mh_forms', 'accounting_tributario', 'accounting_caja-chica', 'accounting_pnl',
      'finanzas_cuentas', 'finanzas_movimientos',
      'management_usuarios'
    ]
  },
  administrador: {
    label: '👑 Administrador Total',
    modules: MODULE_CATALOG.map(m => m.id),
    tabs: MODULE_CATALOG.flatMap(m => m.tabs.map(t => `${m.id}_${t.id}`))
  }
};

export interface AppUser {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: string;
  pin_code: string;
  status: 'active' | 'suspended';
  allowed_modules: string[];
  allowed_tabs?: string[];
  last_device?: string;
  last_login?: string;
}

export default function UserAccessManagementTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<AppUser[]>([]);

  // Modal para Nuevo Usuario / Edición de Accesos
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pinCode, setPinCode] = useState('1234');
  const [role, setRole] = useState('cajero');

  const [selectedModules, setSelectedModules] = useState<string[]>(['billing']);
  const [selectedTabs, setSelectedTabs] = useState<string[]>([
    'billing_facturacion', 'billing_historial', 'billing_arqueo'
  ]);
  const [expandedModule, setExpandedModule] = useState<string | null>('billing');

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('app_users')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        const cleanUsers = data.filter(u => u.email !== 'caja1@nexway.sv');
        setUsers(cleanUsers);
        localStorage.setItem('nexway_app_users', JSON.stringify(cleanUsers));
      } else {
        const localUsers = localStorage.getItem('nexway_app_users');
        if (localUsers) {
          const parsed = JSON.parse(localUsers).filter((u: any) => u.email !== 'caja1@nexway.sv');
          setUsers(parsed);
        } else {
          const initialMock: AppUser[] = [
            {
              id: 'u1',
              username: 'pablopiche1g3',
              email: 'admin@nexway.sv',
              full_name: 'Pablo Piche (Administrador)',
              role: 'administrador',
              pin_code: '9999',
              status: 'active',
              allowed_modules: MODULE_CATALOG.map(m => m.id),
              allowed_tabs: MODULE_CATALOG.flatMap(m => m.tabs.map(t => `${m.id}_${t.id}`)),
              last_device: 'Windows PC (Chrome)',
              last_login: new Date().toISOString()
            }
          ];
          setUsers(initialMock);
          localStorage.setItem('nexway_app_users', JSON.stringify(initialMock));
        }
      }
    } catch {
      const localUsers = localStorage.getItem('nexway_app_users');
      if (localUsers) {
        const parsed = JSON.parse(localUsers).filter((u: any) => u.email !== 'caja1@nexway.sv');
        setUsers(parsed);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleApplyRolePreset = (presetKey: string) => {
    const preset = ROLE_PRESETS[presetKey];
    if (!preset) return;
    setRole(presetKey);
    setSelectedModules(preset.modules);
    setSelectedTabs(preset.tabs);
    toast({
      title: `Categoría Aplicada: ${preset.label}`,
      description: `Se han configurado automáticamente los accesos a módulos y pestañas.`
    });
  };

  const handleEditUser = (user: AppUser) => {
    setEditingUserId(user.id);
    setFullName(user.full_name);
    setEmail(user.email);
    setPinCode(user.pin_code || '1234');
    setRole(user.role || 'cajero');
    setSelectedModules(user.allowed_modules || []);
    setSelectedTabs(user.allowed_tabs || ROLE_PRESETS[user.role]?.tabs || []);
    setIsModalOpen(true);
  };

  const handleSaveUser = async () => {
    if (!fullName || !email) {
      toast({ variant: 'destructive', title: 'Campos Incompletos', description: 'Por favor ingresa nombre y correo.' });
      return;
    }

    const newUser: AppUser = {
      id: editingUserId || 'usr_' + Date.now(),
      username: email.split('@')[0],
      email: email,
      full_name: fullName,
      role: role,
      pin_code: pinCode || '1234',
      status: 'active',
      allowed_modules: selectedModules,
      allowed_tabs: selectedTabs,
      last_device: 'Computadora Registrada',
      last_login: new Date().toISOString()
    };

    const updated = editingUserId
      ? users.map(u => u.id === editingUserId ? newUser : u)
      : [newUser, ...users];

    setUsers(updated);
    localStorage.setItem('nexway_app_users', JSON.stringify(updated));

    try {
      await supabase.from('app_users').upsert({
        id: newUser.id,
        email: newUser.email,
        full_name: newUser.full_name,
        role: newUser.role,
        pin_code: newUser.pin_code,
        status: newUser.status,
        allowed_modules: newUser.allowed_modules,
        allowed_tabs: newUser.allowed_tabs
      });
    } catch (e) {
      console.error('Error saving app_user to Supabase:', e);
    }

    toast({
      title: editingUserId ? 'Accesos Actualizados' : 'Nuevo Usuario Creado',
      description: `Se guardó ${newUser.full_name} con ${selectedModules.length} módulos y ${selectedTabs.length} pestañas autorizadas.`
    });

    setIsModalOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setEditingUserId(null);
    setFullName('');
    setEmail('');
    setPassword('');
    setPinCode('1234');
    setRole('cajero');
    setSelectedModules(ROLE_PRESETS.cajero.modules);
    setSelectedTabs(ROLE_PRESETS.cajero.tabs);
  };

  const handleToggleModule = (modId: string) => {
    const isChecked = selectedModules.includes(modId);
    const modDef = MODULE_CATALOG.find(m => m.id === modId);
    const modTabKeys = modDef ? modDef.tabs.map(t => `${modId}_${t.id}`) : [];

    if (isChecked) {
      setSelectedModules(selectedModules.filter(m => m !== modId));
      setSelectedTabs(selectedTabs.filter(t => !modTabKeys.includes(t)));
    } else {
      setSelectedModules([...selectedModules, modId]);
      setSelectedTabs(Array.from(new Set([...selectedTabs, ...modTabKeys])));
    }
  };

  const handleToggleTab = (tabKey: string, modId: string) => {
    const isTabChecked = selectedTabs.includes(tabKey);
    let newTabs: string[];

    if (isTabChecked) {
      newTabs = selectedTabs.filter(t => t !== tabKey);
    } else {
      newTabs = [...selectedTabs, tabKey];
      // Si activa una pestaña, asegurar que el módulo padre esté activo
      if (!selectedModules.includes(modId)) {
        setSelectedModules([...selectedModules, modId]);
      }
    }
    setSelectedTabs(newTabs);
  };

  const handleToggleStatus = async (userObj: AppUser) => {
    const newStatus = userObj.status === 'active' ? 'suspended' : 'active';
    const updated = users.map(u => u.id === userObj.id ? { ...u, status: newStatus as any } : u);
    setUsers(updated);
    localStorage.setItem('nexway_app_users', JSON.stringify(updated));

    try {
      await supabase.from('app_users').update({ status: newStatus }).eq('id', userObj.id);
    } catch (e) {
      console.error(e);
    }

    toast({
      title: newStatus === 'active' ? 'Acceso Habilitado' : 'Acceso Suspendido',
      description: `Se actualizó el estado de ${userObj.full_name}.`
    });
  };

  const handleDeleteUser = async (userObj: AppUser) => {
    const updated = users.filter(u => u.id !== userObj.id && u.email !== userObj.email);
    setUsers(updated);
    localStorage.setItem('nexway_app_users', JSON.stringify(updated));

    try {
      await supabase.from('app_users').delete().eq('email', userObj.email);
    } catch (e) {
      console.error('Error deleting user from Supabase:', e);
    }

    toast({
      title: 'Usuario Eliminado 🗑️',
      description: `Se eliminó a ${userObj.full_name} (${userObj.email}).`
    });
  };

  const handleUnifyUsers = () => {
    const seen = new Set<string>();
    const unified: AppUser[] = [];
    let cleanedCount = 0;

    users.forEach(u => {
      const normalizedEmail = u.email.toLowerCase().trim();
      if (!seen.has(normalizedEmail)) {
        seen.add(normalizedEmail);
        unified.push(u);
      } else {
        cleanedCount++;
      }
    });

    setUsers(unified);
    localStorage.setItem('nexway_app_users', JSON.stringify(unified));

    toast({
      title: 'Lista Unificada 🧹',
      description: `Se eliminaron ${cleanedCount} duplicados.`
    });
  };

  const filteredUsers = users.filter(u => 
    u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-6 rounded-2xl border shadow-sm">
        <div>
          <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
            <ShieldCheck className="text-indigo-500" size={22} />
            Gestión de Usuarios y Accesos a Pestañas
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Asigne permisos detallados por módulo y por pestaña o utilice la selección rápida según categoría de empleado.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleUnifyUsers}
            variant="outline"
            className="font-bold text-xs h-10 rounded-xl flex items-center gap-1.5 border-amber-500/30 text-amber-600 dark:text-amber-400"
          >
            <RefreshCw size={15} /> Limpiar Duplicados
          </Button>

          <Button
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="bg-indigo-600 hover:bg-indigo-700 font-bold text-xs h-10 rounded-xl text-white flex items-center gap-1.5"
          >
            <UserPlus size={16} /> Crear Nuevo Usuario / Cajero
          </Button>
        </div>
      </div>

      {/* Buscador y Tabla Principal de Usuarios */}
      <Card className="border shadow-sm rounded-2xl bg-card overflow-hidden">
        <div className="p-4 border-b flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <Input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre, correo o rol..."
              className="pl-10 text-xs h-9 rounded-xl"
            />
          </div>
        </div>

        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="text-xs font-bold">Colaborador / Correo</TableHead>
              <TableHead className="text-xs font-bold">Categoría / Rol</TableHead>
              <TableHead className="text-xs font-bold text-center">PIN POS</TableHead>
              <TableHead className="text-xs font-bold">Módulos Autorizados</TableHead>
              <TableHead className="text-xs font-bold text-center">Pestañas Activas</TableHead>
              <TableHead className="text-xs font-bold text-center">Estado</TableHead>
              <TableHead className="text-xs font-bold text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map(u => (
              <TableRow key={u.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-slate-800 dark:text-white">{u.full_name}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{u.email}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-0 uppercase text-[9px] font-black">
                    {ROLE_PRESETS[u.role]?.label || u.role}
                  </Badge>
                </TableCell>
                <TableCell className="text-center font-mono font-bold text-xs text-amber-600 dark:text-amber-400">
                  {u.pin_code || '1234'}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1 max-w-[200px]">
                    {(u.allowed_modules || []).map(mId => (
                      <Badge key={mId} variant="outline" className="text-[8px] font-bold uppercase py-0 bg-white/5">
                        {mId}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary" className="font-mono text-xs font-bold bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200">
                    {(u.allowed_tabs || ROLE_PRESETS[u.role]?.tabs || []).length} Pestañas
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Badge className={`border-0 text-[9px] font-black uppercase ${
                    u.status === 'active' ? 'bg-emerald-500/20 text-emerald-600' : 'bg-rose-500/20 text-rose-600'
                  }`}>
                    {u.status === 'active' ? 'Activo' : 'Suspendido'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEditUser(u)}
                      className="h-7 px-2 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-lg gap-1"
                      title="Editar Accesos y Pestañas"
                    >
                      <Sliders size={13} />
                      Configurar
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleToggleStatus(u)}
                      className="h-7 px-2 text-[10px] font-bold text-slate-600 hover:text-slate-900"
                      title={u.status === 'active' ? 'Suspender acceso' : 'Habilitar acceso'}
                    >
                      {u.status === 'active' ? <Lock size={13} className="text-amber-500" /> : <Unlock size={13} className="text-emerald-500" />}
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteUser(u)}
                      className="h-7 px-2 text-[10px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg gap-1"
                      title="Eliminar usuario permanentemente"
                    >
                      <Trash2 size={13} />
                      Eliminar
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Modal Configuración de Accesos por Categoría y Pestaña */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="rounded-2xl max-w-2xl p-6 bg-card border shadow-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
              <Sliders className="text-indigo-500" size={20} />
              {editingUserId ? `Configurar Accesos: ${fullName}` : 'Registrar Nuevo Usuario / Cajero'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Seleccione la categoría del colaborador o ajuste de forma precisa el acceso a cada pestaña.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 overflow-y-auto pr-1 my-2 flex-1">
            {/* Datos Básicos */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold">Nombre Completo</Label>
                <Input
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Ej. Carlos Mendoza"
                  className="text-xs h-9 rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">Correo Electrónico</Label>
                <Input
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="ejemplo@empresa.com"
                  className="text-xs h-9 rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">PIN POS (4 dígitos)</Label>
                <Input
                  value={pinCode}
                  onChange={e => setPinCode(e.target.value)}
                  maxLength={4}
                  placeholder="1234"
                  className="text-xs h-9 rounded-xl font-mono font-bold text-center"
                />
              </div>
            </div>

            {/* SELECCIÓN RÁPIDA POR CATEGORÍA */}
            <div className="p-3.5 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-blue-500/10 rounded-2xl border border-indigo-500/20 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-black text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 uppercase tracking-wide">
                  <Sparkles size={14} /> Selección Rápida por Categoría
                </Label>
                <span className="text-[10px] text-slate-500">1-Clic configura módulos y pestañas</span>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(ROLE_PRESETS).map(([presetKey, preset]) => {
                  const isSelected = role === presetKey;
                  return (
                    <Button
                      key={presetKey}
                      type="button"
                      variant={isSelected ? 'default' : 'outline'}
                      onClick={() => handleApplyRolePreset(presetKey)}
                      className={`h-9 text-xs font-bold rounded-xl justify-start px-3 transition-all ${
                        isSelected 
                          ? 'bg-indigo-600 text-white shadow-md' 
                          : 'bg-white/50 dark:bg-black/20 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border-slate-200 dark:border-white/10'
                      }`}
                    >
                      {preset.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* MATRIZ DETALLADA DE ACCESO A PESTAÑAS POR MÓDULO */}
            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-white/10">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-slate-800 dark:text-white">
                  Permisos Específicos por Pestaña
                </Label>
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                  <Badge variant="outline" className="bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border-indigo-200">
                    {selectedModules.length} Módulos
                  </Badge>
                  <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200">
                    {selectedTabs.length} Pestañas
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                {MODULE_CATALOG.map((mod) => {
                  const isModActive = selectedModules.includes(mod.id);
                  const isExpanded = expandedModule === mod.id;
                  const activeTabsCount = mod.tabs.filter(t => selectedTabs.includes(`${mod.id}_${t.id}`)).length;

                  return (
                    <div 
                      key={mod.id} 
                      className={`rounded-xl border transition-all ${
                        isModActive 
                          ? 'border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/20 dark:bg-indigo-950/20' 
                          : 'border-slate-200 dark:border-white/10 bg-white/40 dark:bg-black/20 opacity-75'
                      }`}
                    >
                      {/* Encabezado Módulo */}
                      <div className="p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => handleToggleModule(mod.id)}>
                          <div className={`w-4 h-4 rounded-md flex items-center justify-center border ${
                            isModActive ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 dark:border-slate-600'
                          }`}>
                            {isModActive && <CheckCircle2 size={12} />}
                          </div>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{mod.name}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-400">
                            {activeTabsCount} / {mod.tabs.length} pestañas
                          </span>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-slate-400 hover:text-slate-700"
                            onClick={() => setExpandedModule(isExpanded ? null : mod.id)}
                          >
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </Button>
                        </div>
                      </div>

                      {/* Desglose de Pestañas */}
                      {isExpanded && (
                        <div className="px-3 pb-3 pt-1 border-t border-slate-100 dark:border-white/5 grid grid-cols-2 gap-2 bg-white/50 dark:bg-black/40 rounded-b-xl">
                          {mod.tabs.map((tab) => {
                            const tabKey = `${mod.id}_${tab.id}`;
                            const isTabActive = selectedTabs.includes(tabKey);

                            return (
                              <div
                                key={tabKey}
                                onClick={() => handleToggleTab(tabKey, mod.id)}
                                className={`p-2 rounded-lg border text-[11px] font-medium flex items-center justify-between cursor-pointer transition-all ${
                                  isTabActive 
                                    ? 'bg-indigo-600/10 border-indigo-500/40 text-indigo-700 dark:text-indigo-300 font-bold' 
                                    : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500'
                                }`}
                              >
                                <span>{tab.name}</span>
                                {isTabActive ? (
                                  <CheckCircle2 size={13} className="text-indigo-600 dark:text-indigo-400 shrink-0 ml-1" />
                                ) : (
                                  <div className="w-3 h-3 rounded-full border border-slate-300 dark:border-slate-600 shrink-0 ml-1" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="pt-3 border-t">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="h-9 text-xs font-semibold">Cancelar</Button>
            <Button onClick={handleSaveUser} className="h-9 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md">
              Guardar Accesos y Pestañas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
