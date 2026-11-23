'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRouter } from 'next/navigation';
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
  Trash2,
  Building2,
  Store,
  TrendingUp
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
      { id: 'facturacion', name: 'Facturación Rápida / POS' },
      { id: 'historial', name: 'Historial / Ventas DTE' },
      { id: 'pendientes', name: 'Pre-Facturas / En Espera' },
      { id: 'cotizaciones', name: 'Cotizaciones y Presupuestos' },
      { id: 'nota_credito', name: 'Notas de Crédito / Débito' },
      { id: 'arqueo', name: 'Arqueo / Cierre de Caja' },
      { id: 'creditos', name: 'Abonos y Cobros de Crédito' },
    ]
  },
  {
    id: 'compras',
    name: 'Compras y Proveedores',
    tabs: [
      { id: 'compras', name: 'Registro de Compras DTE' },
      { id: 'ordenes', name: 'Órdenes de Compra' },
      { id: 'credito', name: 'Notas de Crédito Proveedores (DTE-05)' },
      { id: 'mappings', name: 'Mapeo de Códigos (Excel/JSON)' },
      { id: 'historial', name: 'Historial de Compras y Pedidos' },
    ]
  },
  {
    id: 'logistica',
    name: 'Logística, Producción e Inventarios',
    tabs: [
      { id: 'inventario', name: 'Inventario General' },
      { id: 'produccion', name: 'Producción & Fórmulas (BOM)' },
      { id: 'fraccionamiento', name: 'Fraccionamiento & Salidas Especiales' },
      { id: 'kardex-valued', name: 'Kardex Valorizado FIFO' },
      { id: 'traslados', name: 'Traslados entre Bodegas' },
    ]
  },
  {
    id: 'accounting',
    name: 'Contabilidad y Hacienda',
    tabs: [
      { id: 'diario', name: 'Libro Diario & Partidas' },
      { id: 'mayor', name: 'Libro Mayor' },
      { id: 'balance-comprobacion', name: 'Balance de Comprobación' },
      { id: 'libros_iva', name: 'Libros IVA (Compras, CF, CCF)' },
      { id: 'mh_forms', name: 'Formularios MH (F07, F14, F987)' },
      { id: 'tributario', name: 'Resumen Tributario' },
      { id: 'caja-chica', name: 'Caja Chica' },
      { id: 'pnl', name: 'Estado PnL & Balance' },
    ]
  },
  {
    id: 'finanzas',
    name: 'Finanzas, Bancos y Créditos',
    tabs: [
      { id: 'cuentas', name: 'Cuentas Bancarias & Conciliación' },
      { id: 'quedan', name: 'Gestión de Quedan (Cuentas por Pagar)' },
      { id: 'creditos', name: 'Cuentas por Cobrar & Créditos' },
      { id: 'movimientos', name: 'Flujo de Caja & Movimientos' },
    ]
  },
  {
    id: 'crm',
    name: 'CRM & Directorio Comercial',
    tabs: [
      { id: 'clientes', name: 'Clientes y Contribuyentes' },
      { id: 'proveedores', name: 'Directorio de Proveedores' },
      { id: 'cotizaciones', name: 'Cotizaciones & Oportunidades' },
      { id: 'seguimiento', name: 'Embudo Comercial & Pipeline' },
    ]
  },
  {
    id: 'management',
    name: 'Gerencia y Configuración',
    tabs: [
      { id: 'usuarios', name: 'Control de Usuarios y Roles' },
      { id: 'perfil_fiscal', name: 'Perfil Fiscal & DTE Hacienda' },
      { id: 'bi', name: 'Centro Analítico (BI) & KPIs' },
      { id: 'auditoria', name: 'Auditoría BMS & NexBot' },
      { id: 'payroll', name: 'Nómina y Planilla RH' },
    ]
  }
];

export const ROLE_PRESETS: Record<string, { label: string; modules: string[]; tabs: string[] }> = {
  cajero: {
    label: '🛒 Cajero POS',
    modules: ['billing', 'compras', 'management'],
    tabs: [
      'billing_facturacion', 'billing_historial', 'billing_pendientes', 'billing_arqueo', 'billing_creditos', 
      'compras_compras', 
      'management_usuarios'
    ]
  },
  bodeguero: {
    label: '📦 Bodeguero / Logística',
    modules: ['logistica', 'compras', 'management'],
    tabs: [
      'logistica_inventario', 'logistica_produccion', 'logistica_fraccionamiento', 'logistica_traslados', 'logistica_kardex-valued',
      'compras_compras', 'compras_mappings', 'compras_historial',
      'management_usuarios'
    ]
  },
  compras: {
    label: '🚚 Encargado de Compras',
    modules: ['compras', 'logistica', 'management'],
    tabs: [
      'compras_compras', 'compras_ordenes', 'compras_credito', 'compras_mappings', 'compras_historial',
      'logistica_inventario', 'logistica_produccion', 'logistica_fraccionamiento',
      'management_usuarios'
    ]
  },
  contador: {
    label: '📊 Contador / Hacienda',
    modules: ['accounting', 'finanzas', 'billing', 'compras', 'management'],
    tabs: [
      'accounting_diario', 'accounting_mayor', 'accounting_balance-comprobacion', 'accounting_libros_iva', 
      'accounting_mh_forms', 'accounting_tributario', 'accounting_caja-chica', 'accounting_pnl',
      'finanzas_cuentas', 'finanzas_quedan', 'finanzas_creditos', 'finanzas_movimientos',
      'billing_nota_credito', 'compras_credito',
      'management_usuarios', 'management_auditoria'
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
  branch_id?: string | null;
  station_id?: string | null;
  pin_code: string;
  status: 'active' | 'suspended';
  allowed_modules: string[];
  allowed_tabs?: string[];
  last_device?: string;
  last_login?: string;
}

export default function UserAccessManagementTab() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<AppUser[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [posStations, setPosStations] = useState<{ id: string; name: string; warehouse_name?: string }[]>([]);

  // Modal para Nuevo Usuario / Edición de Accesos
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pinCode, setPinCode] = useState('1234');
  const [role, setRole] = useState('cajero');
  const [branchId, setBranchId] = useState<string>('__none');
  const [stationId, setStationId] = useState<string>('__none');

  const [selectedModules, setSelectedModules] = useState<string[]>(['billing']);
  const [selectedTabs, setSelectedTabs] = useState<string[]>([
    'billing_facturacion', 'billing_historial', 'billing_arqueo'
  ]);
  const [expandedModule, setExpandedModule] = useState<string | null>('billing');

  const mapProfileToAppUser = (raw: any): AppUser => {
    const rawEmail = (raw.email || '').toLowerCase().trim();
    const rawRole = (raw.role || 'cajero').toLowerCase();
    const presetKey =
      rawRole === 'admin' || rawRole === 'gerencia' || rawRole === 'encargado'
        ? 'administrador'
        : ROLE_PRESETS[rawRole]
        ? rawRole
        : 'cajero';
    const preset = ROLE_PRESETS[presetKey] || ROLE_PRESETS.cajero;
    const perms = raw.permissions && typeof raw.permissions === 'object' ? raw.permissions : {};

    const mods =
      Array.isArray(raw.allowed_modules) && raw.allowed_modules.length > 0
        ? raw.allowed_modules
        : Array.isArray(perms.modules) && perms.modules.length > 0
        ? perms.modules
        : preset.modules;

    const tabs =
      Array.isArray(raw.allowed_tabs) && raw.allowed_tabs.length > 0
        ? raw.allowed_tabs
        : Array.isArray(perms.tabs) && perms.tabs.length > 0
        ? perms.tabs
        : preset.tabs;

    const rawStatus = (raw.status || perms.status || 'active').toString().toLowerCase();
    const isSuspended = rawStatus === 'suspended' || rawStatus === 'inactivo';

    const prefix = rawEmail.split('@')[0] || 'usuario';
    const formattedPrefix = prefix
      .replace(/[._-]+/g, ' ')
      .replace(/\b\w/g, (l: string) => l.toUpperCase());

    return {
      id: raw.id || `usr_${prefix}`,
      username: prefix,
      email: raw.email || `${prefix}@nexway.local`,
      full_name: raw.full_name || raw.name || perms.full_name || formattedPrefix,
      role: raw.role || 'cajero',
      branch_id: raw.branch_id ?? perms.branch_id ?? null,
      station_id: raw.station_id ?? perms.station_id ?? null,
      pin_code: raw.pin_code || perms.pin_code || '1234',
      status: isSuspended ? 'suspended' : 'active',
      allowed_modules: mods,
      allowed_tabs: tabs,
      last_device: raw.last_device || 'Terminal ERP Registrada',
      last_login: raw.last_login || raw.created_at || new Date().toISOString(),
    };
  };

  const loadUsers = async () => {
    setLoading(true);
    const mergedMap = new Map<string, AppUser>();

    const addRawUser = (raw: any) => {
      if (!raw?.email) return;
      const em = raw.email.toLowerCase().trim();
      if (!em || em === 'caja1@nexway.sv') return;
      const mapped = mapProfileToAppUser(raw);
      mergedMap.set(em, mapped);
    };

    try {
      // 1. Reconciliar y obtener lista unificada desde /api/users/create (GET)
      try {
        const res = await fetch('/api/users/create', { method: 'GET', cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json?.users)) {
            json.users.forEach((u: any) => addRawUser(u));
          }
        }
      } catch {
        // Fallback a consulta directa con cliente Supabase
      }

      // 2. Consultar directamente public.profiles, branches, pos_stations y system_config
      const [profsRes, cfgRes, branchesRes, stationsRes] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('system_config').select('key, value').eq('key', 'app_users_registry').maybeSingle(),
        supabase.from('branches').select('id, name').order('name'),
        supabase.from('system_config').select('value').eq('key', 'pos_stations').maybeSingle(),
      ]);

      setBranches((branchesRes.data || []) as { id: string; name: string }[]);
      setPosStations(Array.isArray(stationsRes.data?.value) ? stationsRes.data.value : []);

      if (Array.isArray(profsRes.data)) {
        profsRes.data.forEach((p: any) => addRawUser(p));
      }
      if (Array.isArray(cfgRes.data?.value)) {
        cfgRes.data.value.forEach((u: any) => addRawUser(u));
      }

      const finalUsers = Array.from(mergedMap.values());
      if (finalUsers.length > 0) {
        setUsers(finalUsers);
        localStorage.setItem('nexway_app_users', JSON.stringify(finalUsers));
      } else {
        const localUsers = localStorage.getItem('nexway_app_users');
        if (localUsers) {
          const parsed = JSON.parse(localUsers)
            .filter((u: any) => u.email !== 'caja1@nexway.sv')
            .map((u: any) => mapProfileToAppUser(u));
          setUsers(parsed);
        }
      }
    } catch {
      const localUsers = localStorage.getItem('nexway_app_users');
      if (localUsers) {
        const parsed = JSON.parse(localUsers)
          .filter((u: any) => u.email !== 'caja1@nexway.sv')
          .map((u: any) => mapProfileToAppUser(u));
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
    setBranchId(user.branch_id || '__none');
    setStationId(user.station_id || '__none');
    setSelectedModules(user.allowed_modules || []);
    setSelectedTabs(user.allowed_tabs || ROLE_PRESETS[user.role]?.tabs || []);
    setIsModalOpen(true);
  };

  const handleQuickAssignBranch = async (userObj: AppUser, nextBranchVal: string) => {
    const normalizedBranch = nextBranchVal && nextBranchVal !== '__none' ? nextBranchVal : null;
    setUsers((prev) => prev.map((u) => (u.id === userObj.id ? { ...u, branch_id: normalizedBranch } : u)));
    try {
      const res = await fetch('/api/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userObj.email,
          full_name: userObj.full_name,
          role: userObj.role,
          branch_id: normalizedBranch,
          station_id: userObj.station_id ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Error guardando sucursal');
      const bName = branches.find((b) => b.id === normalizedBranch)?.name || 'Sin sucursal';
      toast({ title: 'Sucursal Asignada', description: `${userObj.full_name} → ${bName}` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error al asignar sucursal', description: err?.message });
      loadUsers();
    }
  };

  const handleQuickAssignStation = async (userObj: AppUser, nextStationVal: string) => {
    const normalizedStation = nextStationVal && nextStationVal !== '__none' ? nextStationVal : null;
    setUsers((prev) => prev.map((u) => (u.id === userObj.id ? { ...u, station_id: normalizedStation } : u)));
    try {
      const res = await fetch('/api/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userObj.email,
          full_name: userObj.full_name,
          role: userObj.role,
          branch_id: userObj.branch_id ?? null,
          station_id: normalizedStation,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Error guardando caja POS');
      const sName = posStations.find((s) => s.id === normalizedStation)?.name || 'Sin caja asignada';
      toast({ title: 'Caja POS Asignada ✓', description: `${userObj.full_name} → ${sName}` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error al asignar caja', description: err?.message });
      loadUsers();
    }
  };

  const handleSaveUser = async () => {
    if (!fullName || !email) {
      toast({ variant: 'destructive', title: 'Campos Incompletos', description: 'Por favor ingresa nombre y correo o usuario.' });
      return;
    }

    const formattedEmail = email.includes('@')
      ? email.toLowerCase().trim()
      : `${email.toLowerCase().trim().replace(/\s+/g, '.')}@nexway.local`;

    const resolvedBranchId = branchId && branchId !== '__none' ? branchId : null;
    const resolvedStationId = stationId && stationId !== '__none' ? stationId : null;

    let savedId = editingUserId || 'usr_' + Date.now();

    try {
      const res = await fetch('/api/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formattedEmail,
          username: formattedEmail.split('@')[0],
          full_name: fullName.trim(),
          password: password && password.trim().length >= 6 ? password.trim() : undefined,
          role,
          branch_id: resolvedBranchId,
          station_id: resolvedStationId,
          pin_code: pinCode || '1234',
          status: 'ACTIVO',
          allowed_modules: selectedModules,
          allowed_tabs: selectedTabs,
        }),
      });
      const json = await res.json();
      if (res.ok && json?.user?.id) {
        savedId = json.user.id;
      } else if (!res.ok && json?.error) {
        toast({ variant: 'destructive', title: 'Advertencia', description: json.error });
      }
    } catch (e) {
      console.error('Error invocando /api/users/create:', e);
    }

    const newUser: AppUser = {
      id: savedId,
      username: formattedEmail.split('@')[0],
      email: formattedEmail,
      full_name: fullName.trim(),
      role: role,
      branch_id: resolvedBranchId,
      station_id: resolvedStationId,
      pin_code: pinCode || '1234',
      status: 'active',
      allowed_modules: selectedModules,
      allowed_tabs: selectedTabs,
      last_device: 'Computadora Registrada',
      last_login: new Date().toISOString()
    };

    const existingIdx = users.findIndex(
      u => u.id === editingUserId || u.id === savedId || u.email.toLowerCase() === formattedEmail
    );
    const updated =
      existingIdx >= 0
        ? users.map((u, idx) => (idx === existingIdx ? newUser : u))
        : [newUser, ...users];

    setUsers(updated);
    localStorage.setItem('nexway_app_users', JSON.stringify(updated));

    toast({
      title: editingUserId ? 'Accesos Actualizados' : 'Nuevo Usuario Creado',
      description: `Se guardó ${newUser.full_name} (${newUser.email}) con ${selectedModules.length} módulos y ${selectedTabs.length} pestañas autorizadas.`
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
    setBranchId('__none');
    setStationId('__none');
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
      await fetch('/api/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userObj.email,
          full_name: userObj.full_name,
          role: userObj.role,
          pin_code: userObj.pin_code,
          status: newStatus === 'active' ? 'ACTIVO' : 'INACTIVO',
          allowed_modules: userObj.allowed_modules,
          allowed_tabs: userObj.allowed_tabs,
        }),
      });
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
      await supabase.from('profiles').delete().eq('id', userObj.id);
      await supabase.from('system_config').upsert(
        {
          key: 'app_users_registry',
          value: updated,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' }
      );
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

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={() => router.push('/finanzas?tab=payroll')}
            variant="outline"
            className="font-bold text-xs h-10 rounded-xl flex items-center gap-1.5 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
          >
            <TrendingUp size={15} /> Metas y Bonos (Finanzas)
          </Button>

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
              <TableHead className="text-xs font-bold">Sucursal</TableHead>
              <TableHead className="text-xs font-bold">Caja POS / Bodega</TableHead>
              <TableHead className="text-xs font-bold text-center">PIN POS</TableHead>
              <TableHead className="text-xs font-bold">Accesos</TableHead>
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
                <TableCell>
                  <Select
                    value={u.branch_id || '__none'}
                    onValueChange={(val) => handleQuickAssignBranch(u, val)}
                  >
                    <SelectTrigger className="h-8 w-36 text-[11px] font-semibold rounded-lg bg-background">
                      <SelectValue placeholder="Sin sucursal" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none" className="text-xs">Sin sucursal</SelectItem>
                      {branches.map((b) => (
                        <SelectItem key={b.id} value={b.id} className="text-xs">
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select
                    value={u.station_id || '__none'}
                    onValueChange={(val) => handleQuickAssignStation(u, val)}
                  >
                    <SelectTrigger className="h-8 w-44 text-[11px] font-semibold rounded-lg bg-background">
                      <SelectValue placeholder="Sin caja asignada" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none" className="text-xs">Sin caja asignada</SelectItem>
                      {posStations.map((st) => (
                        <SelectItem key={st.id} value={st.id} className="text-xs">
                          {st.name}{st.warehouse_name ? ` (${st.warehouse_name})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-center font-mono font-bold text-xs text-amber-600 dark:text-amber-400">
                  {u.pin_code || '1234'}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="font-mono text-[10px] font-bold bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200">
                    {(u.allowed_modules || []).length} Mód · {(u.allowed_tabs || ROLE_PRESETS[u.role]?.tabs || []).length} Pest.
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

            {/* Sucursal, Caja POS y Contraseña */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold flex items-center gap-1">
                  <Building2 size={12} className="text-blue-500" /> Sucursal Asignada
                </Label>
                <Select value={branchId} onValueChange={setBranchId}>
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue placeholder="Sin sucursal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none" className="text-xs">Sin sucursal</SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id} className="text-xs">{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold flex items-center gap-1">
                  <Store size={12} className="text-emerald-500" /> Caja POS / Bodega
                </Label>
                <Select value={stationId} onValueChange={setStationId}>
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue placeholder="Sin caja asignada" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none" className="text-xs">Sin caja asignada</SelectItem>
                    {posStations.map((st) => (
                      <SelectItem key={st.id} value={st.id} className="text-xs">
                        {st.name}{st.warehouse_name ? ` (${st.warehouse_name})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">Contraseña (Opcional)</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={editingUserId ? 'Dejar vacío para no cambiar' : 'Mín. 6 caracteres'}
                  className="text-xs h-9 rounded-xl"
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
