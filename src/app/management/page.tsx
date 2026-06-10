
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
  AlertTriangle,
  Store,
  Warehouse,
  Plus,
  BarChart3,
  TrendingUp,
  Package,
  UserCheck,
  Award,
  ChevronDown,
  MonitorIcon,
  LogOut,
  Settings,
  Building
} from 'lucide-react';
import { ModeToggle } from '@/components/mode-toggle';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { supabase } from '@/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { isAdminEmail, isRoleChangeable, canRevokeAccess } from '@/lib/admin-emails';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ROLE_PERMISSIONS } from '@/supabase/use-user';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

export default function ManagementPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [cashFloat, setCashFloat] = useState<string>('0');
  const [catchAllEmail, setCatchAllEmail] = useState<string>('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [preAssignEmail, setPreAssignEmail] = useState('');
  const [preAssignPassword, setPreAssignPassword] = useState('');
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
  const [salesList, setSalesList] = useState<any[]>([]);
  const [stockList, setStockList] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [newBranchName, setNewBranchName] = useState('');
  const [isSavingBranch, setIsSavingBranch] = useState(false);

  // --- ESTADOS PARA PERMISOS INDIVIDUALES POR USUARIO ---
  const [selectedUserForPerms, setSelectedUserForPerms] = useState<any | null>(null);
  const [userPermsModules, setUserPermsModules] = useState<string[]>([]);
  const [userPermsTabs, setUserPermsTabs] = useState<string[]>([]);
  const [isPermsDialogOpen, setIsPermsDialogOpen] = useState(false);
  const [isSavingPerms, setIsSavingPerms] = useState(false);

  const handleOpenPermissionsEdit = (user: any) => {
    setSelectedUserForPerms(user);
    const perms = user.permissions || { modules: [], tabs: [] };
    
    // Si no tiene permisos asignados aún, los inicializamos con la plantilla del Rol
    if (!user.permissions) {
      const defaultModules = ROLE_PERMISSIONS[user.role] || [];
      setUserPermsModules(defaultModules);
      
      const defaultTabs: string[] = [];
      defaultModules.forEach((modId: string) => {
        const mod = modules.find(m => m.id === modId);
        if (mod && mod.tabs) {
          mod.tabs.forEach(tab => {
            defaultTabs.push(`${modId}_${tab.id}`);
          });
        }
      });
      setUserPermsTabs(defaultTabs);
    } else {
      setUserPermsModules(perms.modules || []);
      setUserPermsTabs(perms.tabs || []);
    }
    setIsPermsDialogOpen(true);
  };

  const handleTogglePermsModule = (modId: string, enabled: boolean) => {
    if (enabled) {
      setUserPermsModules(prev => [...prev, modId]);
      // Habilitar todas sus pestañas de forma predeterminada al activar el módulo
      const mod = modules.find(m => m.id === modId);
      if (mod && mod.tabs) {
        const newTabs = mod.tabs.map(t => `${modId}_${t.id}`);
        setUserPermsTabs(prev => [...new Set([...prev, ...newTabs])]);
      }
    } else {
      setUserPermsModules(prev => prev.filter(id => id !== modId));
      // Deshabilitar todas sus pestañas al desactivar el módulo
      const mod = modules.find(m => m.id === modId);
      if (mod && mod.tabs) {
        const tabsToRemove = mod.tabs.map(t => `${modId}_${t.id}`);
        setUserPermsTabs(prev => prev.filter(tKey => !tabsToRemove.includes(tKey)));
      }
    }
  };

  const handleTogglePermsTab = (tabKey: string, enabled: boolean) => {
    if (enabled) {
      setUserPermsTabs(prev => [...prev, tabKey]);
    } else {
      setUserPermsTabs(prev => prev.filter(k => k !== tabKey));
    }
  };

  const handleSaveCustomPermissions = async () => {
    if (!selectedUserForPerms) return;
    setIsSavingPerms(true);
    try {
      const newPerms = {
        modules: userPermsModules,
        tabs: userPermsTabs
      };

      const { error } = await supabase
        .from('profiles')
        .update({ permissions: newPerms })
        .eq('id', selectedUserForPerms.id);

      if (error) throw error;

      toast({
        title: "Permisos Guardados",
        description: `Se actualizaron los accesos individuales para ${selectedUserForPerms.email}.`
      });
      setIsPermsDialogOpen(false);
      await loadData();
    } catch (err: any) {
      console.error(err);
      toast({
        variant: "destructive",
        title: "Error al guardar",
        description: err.message || "No se pudieron guardar los permisos."
      });
    } finally {
      setIsSavingPerms(false);
    }
  };

  const handleResetToDefaultPermissions = async () => {
    if (!selectedUserForPerms) return;
    if (!confirm('¿Restablecer accesos individuales y usar la configuración del rol por defecto?')) return;
    setIsSavingPerms(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ permissions: null })
        .eq('id', selectedUserForPerms.id);

      if (error) throw error;

      toast({
        title: "Permisos Restablecidos",
        description: `El usuario ${selectedUserForPerms.email} ahora utilizará la configuración por defecto de su rol.`
      });
      setIsPermsDialogOpen(false);
      await loadData();
    } catch (err: any) {
      console.error(err);
      toast({
        variant: "destructive",
        title: "Error al restablecer",
        description: err.message
      });
    } finally {
      setIsSavingPerms(false);
    }
  };


  // Cálculos dinámicos en tiempo real para gerencia
  const todaySalesTotal = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return salesList
      .filter(s => s.status !== 'CANCELADA' && s.created_at?.startsWith(todayStr))
      .reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);
  }, [salesList]);

  const criticalItemsCount = useMemo(() => {
    const skuMap: Record<string, number> = {};
    stockList.forEach(s => {
      skuMap[s.sku] = (skuMap[s.sku] || 0) + (parseFloat(s.quantity) || 0);
    });
    return Object.values(skuMap).filter(qty => qty < 10).length;
  }, [stockList]);

  const lastInvoiceCorrelative = useMemo(() => {
    if (salesList.length === 0) return 'Ninguna emitida hoy';
    return salesList[0].correlative || 'N/A';
  }, [salesList]);

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
        branch_id: p.branch_id,
        isPreassigned: false,
        createdAt: p.created_at
      }));

      Object.keys(preassignedMap).forEach(email => {
        if (!consolidatedUsers.some(u => u.email?.toLowerCase() === email.toLowerCase())) {
          consolidatedUsers.push({
            id: 'preassigned:' + email,
            email: email,
            role: preassignedMap[email],
            branch_id: null,
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

      // Cargar configuración de caja
      const { data: cashConf, error: cashErr } = await supabase.from('system_config').select('*').eq('key', 'cash_config').maybeSingle();
      if (cashConf && cashConf.value) {
        setCashFloat(cashConf.value.cashFloat?.toString() || '0');
        setCatchAllEmail(cashConf.value.catchAllEmail || '');
      }

      // Cargar sucursales
      const { data: branchesData } = await supabase.from('branches').select('*').order('name');
      setBranches(branchesData || []);

      // Cargar datos de ventas para métricas de gerencia
      const { data: salesData } = await supabase.from('sales').select('*').order('created_at', { ascending: false });
      setSalesList(salesData || []);

      // Cargar existencias para métricas de inventario crítico
      const { data: stockData } = await supabase.from('inventory_stock').select('*');
      setStockList(stockData || []);

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

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;
    setIsSavingBranch(true);
    try {
      const { error } = await supabase
        .from('branches')
        .insert({ name: newBranchName.trim() });
      if (error) throw error;
      toast({ title: "Sucursal Creada", description: `Se registró la sucursal "${newBranchName}".` });
      setNewBranchName('');
      await loadData();
    } catch (err: any) {
      console.error(err);
      toast({ variant: "destructive", title: "Error", description: err.message || "No se pudo crear la sucursal." });
    } finally {
      setIsSavingBranch(false);
    }
  };

  const handleDeleteBranch = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar esta sucursal?')) return;
    try {
      const { error } = await supabase
        .from('branches')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast({ title: "Sucursal Eliminada", description: "La sucursal fue removida." });
      await loadData();
    } catch (err: any) {
      console.error(err);
      toast({ variant: "destructive", title: "Error", description: err.message || "No se pudo eliminar la sucursal." });
    }
  };

  const handleChangeUserBranch = async (userId: string, branchId: string | null) => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ branch_id: branchId })
        .eq('id', userId);
      if (error) throw error;
      toast({ title: "Sucursal de Usuario Actualizada", description: "Se reasignó la sucursal del usuario." });
      await loadData();
    } catch (err: any) {
      console.error(err);
      toast({ variant: "destructive", title: "Error", description: err.message || "No se pudo reasignar la sucursal." });
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
    const usernameToAssign = preAssignEmail.trim().toLowerCase();
    if (!usernameToAssign) {
      toast({ variant: "destructive", title: "Campo requerido", description: "Por favor ingrese un nombre de usuario o correo." });
      return;
    }

    // Permitir letras, números, puntos, guiones y correos normales (evitar espacios)
    const validUserRegex = /^[a-zA-Z0-9._%+-]+(@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})?$/;
    if (!validUserRegex.test(usernameToAssign)) {
      toast({ variant: "destructive", title: "Formato inválido", description: "El nombre de usuario no debe contener espacios ni caracteres especiales." });
      return;
    }

    const formattedEmail = usernameToAssign.includes('@') 
      ? usernameToAssign 
      : `${usernameToAssign}@nexway.local`;

    setIsSaving(true);
    try {
      const existingUser = usersList?.find((usr: any) => 
        usr.email?.toLowerCase() === formattedEmail || 
        usr.email?.toLowerCase() === usernameToAssign
      );
      
      if (existingUser) {
        // Si el usuario ya existe, solo actualizamos su rol en la tabla profiles
        const { error } = await supabase.from('profiles').update({ role: preAssignRole }).eq('id', existingUser.id);
        if (error) throw error;
        toast({ 
          title: "Usuario Actualizado", 
          description: `El usuario ya estaba registrado. Se actualizó su rol a ${ROLE_NAMES[preAssignRole]}.` 
        });
      } else {
        // Si es un usuario nuevo, la contraseña es obligatoria
        if (!preAssignPassword || preAssignPassword.length < 5) {
          toast({ 
            variant: "destructive", 
            title: "Contraseña requerida", 
            description: "La contraseña es obligatoria y debe tener al menos 5 caracteres." 
          });
          setIsSaving(false);
          return;
        }

        // Llamar a nuestra API segura en el servidor
        const response = await fetch('/api/users/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: usernameToAssign,
            password: preAssignPassword,
            role: preAssignRole
          })
        });

        const apiData = await response.json();
        if (!response.ok) {
          throw new Error(apiData.error || 'No se pudo crear el usuario.');
        }

        toast({ 
          title: "Usuario Creado", 
          description: `El usuario ${usernameToAssign} fue registrado con rol ${ROLE_NAMES[preAssignRole]} exitosamente.` 
        });
      }
      setPreAssignEmail('');
      setPreAssignPassword('');
      await loadData();
    } catch (error: any) {
      console.error('Error al gestionar rol/usuario:', error);
      toast({ 
        variant: "destructive", 
        title: "Error de registro", 
        description: error.message || "No se pudo completar la operación." 
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

  // ─── Estados Cajas/Sucursales ───────────────────────────────────
  const [posStations, setPosStations] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [newStationName, setNewStationName] = useState('');
  const [newStationWarehouse, setNewStationWarehouse] = useState('');
  const [isSavingStation, setIsSavingStation] = useState(false);

  // ─── Estados Análisis ───────────────────────────────────────────
  const [analyticsTab, setAnalyticsTab] = useState<'employees' | 'customers' | 'products'>('employees');
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'today' | 'week' | 'month' | 'all'>('month');
  const [allSalesItems, setAllSalesItems] = useState<any[]>([]);
  const [allSalesFull, setAllSalesFull] = useState<any[]>([]);
  const [inventoryMap, setInventoryMap] = useState<Record<string, string>>({});
  const [analyticsCustomerFilter, setAnalyticsCustomerFilter] = useState<string>('');
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // ─── Cargar bodegas y cajas ─────────────────────────────────────
  const loadStationsAndWarehouses = async () => {
    const { data: whData } = await supabase.from('warehouses').select('*').order('name');
    setWarehouses(whData || []);
    const { data: stConf } = await supabase.from('system_config').select('*').eq('key', 'pos_stations').maybeSingle();
    setPosStations(stConf?.value || []);
  };

  // ─── Cargar datos de análisis ───────────────────────────────────
  const loadAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const { data: sales } = await supabase.from('sales').select('*').order('created_at', { ascending: false });
      setAllSalesFull(sales || []);
      const { data: items } = await supabase.from('sales_items').select('*');
      setAllSalesItems(items || []);
      const { data: inv } = await supabase.from('inventory').select('sku, name');
      const m: Record<string, string> = {};
      (inv || []).forEach((i: any) => { m[i.sku] = i.name; });
      setInventoryMap(m);
    } catch (e) {
      console.error('Error cargando analytics:', e);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  // ─── Guardar nueva caja ─────────────────────────────────────────
  const handleAddStation = async () => {
    if (!newStationName.trim() || !newStationWarehouse) {
      toast({ variant: 'destructive', title: 'Campos requeridos', description: 'Ingrese nombre y seleccione una bodega.' });
      return;
    }
    setIsSavingStation(true);
    try {
      const wh = warehouses.find(w => w.id === newStationWarehouse);
      const newStation = {
        id: crypto.randomUUID(),
        name: newStationName.trim(),
        warehouse_id: newStationWarehouse,
        warehouse_name: wh?.name || 'Sin nombre'
      };
      const updated = [...posStations, newStation];
      const { error } = await supabase.from('system_config').upsert({ key: 'pos_stations', value: updated });
      if (error) throw error;
      setPosStations(updated);
      setNewStationName('');
      setNewStationWarehouse('');
      toast({ title: 'Caja Creada', description: `"${newStation.name}" vinculada a "${newStation.warehouse_name}".` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsSavingStation(false);
    }
  };

  const handleDeleteStation = async (id: string) => {
    const updated = posStations.filter(s => s.id !== id);
    await supabase.from('system_config').upsert({ key: 'pos_stations', value: updated });
    setPosStations(updated);
    toast({ title: 'Caja Eliminada' });
  };

  // ─── Asignar caja a usuario ─────────────────────────────────────
  const handleAssignStation = async (userId: string, stationId: string) => {
    if (userId.startsWith('preassigned:')) return;
    await supabase.from('profiles').update({ station_id: stationId || null }).eq('id', userId);
    await loadData();
    toast({ title: 'Caja asignada al usuario.' });
  };

  // ─── Análisis: datos filtrados por período ──────────────────────
  const filteredSales = useMemo(() => {
    const now = new Date();
    return allSalesFull.filter(s => {
      if (s.status === 'CANCELADA') return false;
      const d = new Date(s.created_at);
      if (analyticsPeriod === 'today') return d.toDateString() === now.toDateString();
      if (analyticsPeriod === 'week') {
        const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
        return d >= weekAgo;
      }
      if (analyticsPeriod === 'month') {
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }
      return true;
    });
  }, [allSalesFull, analyticsPeriod]);

  const employeeStats = useMemo(() => {
    const map: Record<string, { total: number; count: number; email: string }> = {};
    filteredSales.forEach(s => {
      const key = s.seller_email || 'Sin registro';
      if (!map[key]) map[key] = { total: 0, count: 0, email: key };
      map[key].total += parseFloat(s.total) || 0;
      map[key].count += 1;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [filteredSales]);

  const customerStats = useMemo(() => {
    const map: Record<string, { total: number; count: number; last: string }> = {};
    filteredSales.forEach(s => {
      const key = s.customer_name || 'Consumidor Final';
      if (!map[key]) map[key] = { total: 0, count: 0, last: s.created_at };
      map[key].total += parseFloat(s.total) || 0;
      map[key].count += 1;
      if (s.created_at > map[key].last) map[key].last = s.created_at;
    });
    return Object.entries(map)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.total - a.total);
  }, [filteredSales]);

  const topProducts = useMemo(() => {
    const filteredSaleIds = new Set(filteredSales.map(s => s.id));
    const customerSaleIds = analyticsCustomerFilter
      ? new Set(filteredSales.filter(s => s.customer_name === analyticsCustomerFilter).map(s => s.id))
      : filteredSaleIds;

    const map: Record<string, { qty: number; revenue: number }> = {};
    allSalesItems.forEach(item => {
      if (!customerSaleIds.has(item.sale_id)) return;
      if (!map[item.sku]) map[item.sku] = { qty: 0, revenue: 0 };
      map[item.sku].qty += parseFloat(item.quantity) || 0;
      map[item.sku].revenue += parseFloat(item.subtotal) || 0;
    });
    return Object.entries(map)
      .map(([sku, v]) => ({ sku, name: inventoryMap[sku] || sku, ...v }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 15);
  }, [allSalesItems, filteredSales, analyticsCustomerFilter, inventoryMap]);

  const totalFilteredRevenue = useMemo(() => filteredSales.reduce((s, v) => s + (parseFloat(v.total) || 0), 0), [filteredSales]);

  useEffect(() => {
    if (activeTab === 'config') {
      runDiagnostics();
      loadStationsAndWarehouses();
    }
    if (activeTab === 'analytics') {
      loadAnalytics();
    }
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-transparent p-4 md:p-6 transition-colors duration-300 relative overflow-hidden">
<div className="max-w-4xl mx-auto flex items-center justify-between mb-8 gap-4 bg-white/5 dark:bg-white/5 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-2xl p-4 md:p-5 relative z-10">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="w-10 h-10 rounded-xl bg-white/5 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10" onClick={() => router.push('/')}>
            <ArrowLeft className="text-foreground" size={20} />
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground font-headline leading-tight">Gerencia y Control</h1>
            <p className="text-muted-foreground text-xs md:text-sm">Configuración global del sistema</p>
          </div>
        </div>
        <ModeToggle />
      </div>

      <div className="max-w-4xl mx-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-muted p-1 rounded-2xl border flex w-full justify-start overflow-x-auto no-scrollbar gap-1">
            <TabsTrigger value="config" className="rounded-xl px-5 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs flex items-center gap-1.5">
              <Settings size={14} /> Configuración
            </TabsTrigger>
            <TabsTrigger value="permissions" className="rounded-xl px-5 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs flex items-center gap-1.5">
              <Lock size={14} /> Módulos
            </TabsTrigger>
            <TabsTrigger value="roles" className="rounded-xl px-5 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs flex items-center gap-1.5">
              <Users size={14} /> Usuarios
            </TabsTrigger>
            <TabsTrigger value="branches" className="rounded-xl px-5 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs flex items-center gap-1.5">
              <Building size={14} /> Sucursales
            </TabsTrigger>
            <TabsTrigger value="metrics" className="rounded-xl px-5 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs flex items-center gap-1.5">
              <BarChart3 size={14} /> Métricas
            </TabsTrigger>
            <TabsTrigger value="analytics" className="rounded-xl px-5 font-bold data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-xs flex items-center gap-1.5">
              <TrendingUp size={14} /> Análisis de Ventas
            </TabsTrigger>
          </TabsList>

          {/* pestaña 1: CONFIGURACIÓN GLOBAL */}
          <TabsContent value="config" className="space-y-6 outline-none">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              <div className="md:col-span-7 space-y-6">
                <Card className="border shadow-md rounded-2xl bg-card overflow-hidden">
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
                <div className="bg-blue-50 border border-blue-100 p-6 rounded-2xl flex flex-col justify-center gap-3 dark:bg-blue-900/10 dark:border-blue-900/20">
                <div className="flex items-center gap-2 text-blue-800 font-bold dark:text-blue-300">
                  <AlertCircle size={20} />
                  <p className="text-sm uppercase tracking-tight">Notificaciones DTE</p>
                </div>
                <p className="text-xs text-blue-700 leading-relaxed dark:text-blue-400">
                  El correo bolsón es obligatorio para cumplir con la normativa de respaldo digital. Si un cliente no está registrado o no proporciona correo, el sistema enviará automáticamente el DTE a la dirección configurada arriba para su posterior entrega física o reenvío manual.
                </p>
              </div>

              <Card className="border shadow-md rounded-2xl bg-card overflow-hidden">
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
                            <p className="text-[10px] text-rose-500 font-semibold leading-tight break-words border-t border-white/10 border-rose-500/10 pt-1.5 mt-0.5">
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
            </div>

            {/* ── Cajas / Sucursales ─────────────────────────────────── */}
            <Card className="border shadow-md rounded-2xl bg-card overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-6">
                <CardTitle className="flex items-center gap-2 text-base font-black uppercase tracking-tight">
                  <Store className="text-indigo-400" size={20} />
                  Cajas / Sucursales
                </CardTitle>
                <CardDescription className="text-slate-400 text-xs">
                  Defina las cajas de venta y vincule cada una a su bodega de despacho. El stock en facturación se filtra automáticamente por la bodega de la caja asignada al usuario.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {/* Lista de cajas existentes */}
                {posStations.length > 0 ? (
                  <div className="space-y-3">
                    {posStations.map((st: any) => (
                      <div key={st.id} className="flex items-center justify-between p-4 rounded-2xl bg-muted/40 border border-muted-foreground/10 hover:border-indigo-500/20 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                            <Store size={16} className="text-indigo-500" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-foreground">{st.name}</p>
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Warehouse size={10} /> {st.warehouse_name}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteStation(st.id)}
                          className="text-rose-500 hover:bg-rose-500/10 rounded-xl h-9 w-9"
                          title="Eliminar caja"
                        >
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center border border-dashed rounded-2xl">
                    <Store size={28} className="mx-auto text-muted-foreground/40 mb-2" />
                    <p className="text-xs text-muted-foreground font-semibold">No hay cajas configuradas aún.</p>
                  </div>
                )}

                {/* Formulario nueva caja */}
                <div className="border-t border-white/10 pt-5 space-y-4">
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">+ Agregar Nueva Caja</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-muted-foreground">Nombre de la Caja</Label>
                      <Input
                        placeholder="Ej: Caja 1 - Matriz"
                        value={newStationName}
                        onChange={e => setNewStationName(e.target.value)}
                        className="h-11 bg-muted rounded-xl border-none font-semibold text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-muted-foreground">Bodega Vinculada</Label>
                      <Select value={newStationWarehouse} onValueChange={setNewStationWarehouse}>
                        <SelectTrigger className="h-11 bg-muted rounded-xl border-none font-semibold text-sm">
                          <SelectValue placeholder="Seleccionar bodega..." />
                        </SelectTrigger>
                        <SelectContent>
                          {warehouses.map((wh: any) => (
                            <SelectItem key={wh.id} value={wh.id}>{wh.name}</SelectItem>
                          ))}
                          {warehouses.length === 0 && (
                            <SelectItem value="__none" disabled>No hay bodegas registradas</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button
                    onClick={handleAddStation}
                    disabled={isSavingStation}
                    className="h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 px-6 flex items-center gap-2"
                  >
                    {isSavingStation ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                    AGREGAR CAJA
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* pestaña 2: PERMISOS DE MÓDULOS */}
          <TabsContent value="permissions" className="outline-none">
            <Card className="border shadow-md rounded-2xl bg-card overflow-hidden">
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
                          <p className="text-[10px] font-black text-slate-400/80 uppercase tracking-widest mb-2">Habilitar Pestañas del Módulo</p>
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
            <Card className="border shadow-md rounded-2xl bg-card overflow-hidden">
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
                  <form onSubmit={handlePreAssignRole} className="flex flex-col lg:flex-row items-end gap-4">
                    <div className="flex-1 w-full space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Registrar / Asignar Usuario</Label>
                      <div className="relative">
                        <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                        <Input 
                          type="text" 
                          placeholder="Nombre de usuario (ej: carlos)" 
                          value={preAssignEmail}
                          onChange={(e) => setPreAssignEmail(e.target.value)}
                          className="h-10 pl-10 text-xs font-bold bg-white/5 dark:bg-white/5 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-xl"
                        />
                      </div>
                    </div>

                    <div className="flex-1 w-full space-y-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Contraseña Inicial</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                        <Input 
                          type="text" 
                          placeholder="Contraseña (mín. 5 caracteres)" 
                          value={preAssignPassword}
                          onChange={(e) => setPreAssignPassword(e.target.value)}
                          className="h-10 pl-10 text-xs font-bold bg-white/5 dark:bg-white/5 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-xl"
                        />
                      </div>
                    </div>

                    <div className="w-full lg:w-[200px] space-y-2">
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
                      className="w-full lg:w-auto h-10 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl shadow-lg shadow-violet-600/20 px-6"
                    >
                      {isSaving ? <Loader2 className="animate-spin" size={16} /> : "+ CREAR USUARIO"}
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
                          <div className="flex flex-wrap items-center gap-3">
                            <Select 
                              value={usr.role || 'pedidos'} 
                              onValueChange={(val) => handleChangeRole(usr.id, val)}
                              disabled={isSaving || !isRoleChangeable(usr.email)}
                            >
                              <SelectTrigger className="w-[170px] h-10 bg-muted border-none rounded-xl text-xs font-bold">
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

                            {/* Selector de Sucursal Asignada */}
                            {!usr.isPreassigned && (
                              <Select
                                value={usr.branch_id || '__none'}
                                onValueChange={(val) => handleChangeUserBranch(usr.id, val === '__none' ? null : val)}
                                disabled={isSaving}
                              >
                                <SelectTrigger className="w-[170px] h-10 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs font-bold text-indigo-700 dark:text-indigo-400">
                                  <Building size={12} className="mr-1 shrink-0" />
                                  <SelectValue placeholder="Sin sucursal" />
                                </SelectTrigger>
                                <SelectContent className="dark:bg-[#0a0a14] dark:border-white/10">
                                  <SelectItem value="__none">Sin sucursal</SelectItem>
                                  {branches.map((b: any) => (
                                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}

                            {/* Selector de Caja Asignada */}
                            {!usr.isPreassigned && (
                              <Select
                                value={usr.station_id || '__none'}
                                onValueChange={(val) => handleAssignStation(usr.id, val === '__none' ? '' : val)}
                                disabled={isSaving}
                              >
                                <SelectTrigger className="w-[160px] h-10 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs font-bold text-indigo-700 dark:text-indigo-400">
                                  <Store size={12} className="mr-1 shrink-0" />
                                  <SelectValue placeholder="Sin caja" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none">Sin caja asignada</SelectItem>
                                  {posStations.map((st: any) => (
                                    <SelectItem key={st.id} value={st.id}>{st.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                            {!usr.isPreassigned && (
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => handleOpenPermissionsEdit(usr)}
                                disabled={isSaving}
                                className="text-indigo-500 hover:text-indigo-650 hover:bg-indigo-500/10 rounded-xl h-10 w-10 flex items-center justify-center"
                                title="Editar accesos a módulos y pestañas"
                              >
                                <ShieldCheck size={18} />
                              </Button>
                            )}

                            {canRevokeAccess(usr.email) && (
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

          {/* pestaña 4: MÉTRICAS Y NEGOCIOS EXCLUSIVOS DE GERENCIA */}
          <TabsContent value="metrics" className="outline-none space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              <Card className="border shadow-md rounded-2xl overflow-hidden bg-card border-slate-100 dark:border-zinc-800">
                <CardHeader className="bg-slate-900 text-white p-5 dark:bg-slate-950 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5 text-blue-400">
                      Ventas de Hoy
                    </CardTitle>
                    <CardDescription className="text-[10px] text-slate-400 mt-1">Total facturado activo hoy.</CardDescription>
                  </div>
                  <Coins className="text-blue-400" size={20} />
                </CardHeader>
                <CardContent className="p-6 flex flex-col justify-center items-center h-32">
                  <p className="text-3xl font-black text-blue-600 dark:text-blue-400 font-headline">${todaySalesTotal.toFixed(2)}</p>
                  <span className="text-[9.5px] text-muted-foreground mt-1.5 font-bold uppercase tracking-wider">Flujo de caja del día</span>
                </CardContent>
              </Card>

              <Card className="border shadow-md rounded-2xl overflow-hidden bg-card border-slate-100 dark:border-zinc-800">
                <CardHeader className="bg-slate-900 text-white p-5 dark:bg-slate-950 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5 text-rose-400">
                      Inventario Crítico
                    </CardTitle>
                    <CardDescription className="text-[10px] text-slate-400 mt-1">Items con existencia menor a 10.</CardDescription>
                  </div>
                  <AlertTriangle className="text-rose-400" size={20} />
                </CardHeader>
                <CardContent className="p-6 flex flex-col justify-center items-center h-32">
                  <p className="text-3xl font-black text-rose-500 font-headline">{criticalItemsCount} items</p>
                  <span className="text-[9.5px] text-muted-foreground mt-1.5 font-bold uppercase tracking-wider">Requieren reabastecimiento</span>
                </CardContent>
              </Card>

              <Card className="border shadow-md rounded-2xl overflow-hidden bg-card border-slate-100 dark:border-zinc-800">
                <CardHeader className="bg-slate-900 text-white p-5 dark:bg-slate-950 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5 text-emerald-400">
                      Último DTE Emitido
                    </CardTitle>
                    <CardDescription className="text-[10px] text-slate-400 mt-1">Correlativo de venta reciente.</CardDescription>
                  </div>
                  <CheckCircle2 className="text-emerald-400" size={20} />
                </CardHeader>
                <CardContent className="p-6 flex flex-col justify-center items-center h-32">
                  <p className="text-[11px] font-mono font-black text-slate-800 dark:text-slate-100 text-center select-all">{lastInvoiceCorrelative}</p>
                  <span className="text-[9.5px] text-muted-foreground mt-1.5 font-bold uppercase tracking-wider">Última operación del sistema</span>
                </CardContent>
              </Card>

            </div>
          </TabsContent>

          {/* ═══════════ pestaña 5: ANÁLISIS DE VENTAS ═══════════════ */}
          <TabsContent value="analytics" className="outline-none space-y-6">
            {/* Header con filtro de período */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-foreground">Análisis de Ventas</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Resumen global por empleado, cliente y producto.</p>
              </div>
              <div className="flex items-center gap-2">
                <Select value={analyticsPeriod} onValueChange={(v: any) => setAnalyticsPeriod(v)}>
                  <SelectTrigger className="h-9 w-44 bg-muted rounded-xl border-none text-xs font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Hoy</SelectItem>
                    <SelectItem value="week">Últimos 7 días</SelectItem>
                    <SelectItem value="month">Este mes</SelectItem>
                    <SelectItem value="all">Todo el tiempo</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={loadAnalytics} variant="outline" size="sm" className="rounded-xl font-bold text-xs h-9" disabled={loadingAnalytics}>
                  {loadingAnalytics ? <Loader2 size={13} className="animate-spin" /> : '↺ Actualizar'}
                </Button>
              </div>
            </div>

            {/* KPI rápido */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Ventas del Período', value: `$${totalFilteredRevenue.toFixed(2)}`, icon: <TrendingUp size={18} className="text-emerald-400" />, bg: 'bg-emerald-500/10 border-emerald-500/20' },
                { label: 'Transacciones', value: filteredSales.length, icon: <BarChart3 size={18} className="text-blue-400" />, bg: 'bg-blue-500/10 border-blue-500/20' },
                { label: 'Clientes Únicos', value: customerStats.length, icon: <Users size={18} className="text-violet-400" />, bg: 'bg-violet-500/10 border-violet-500/20' },
                { label: 'Productos Distintos', value: topProducts.length, icon: <Package size={18} className="text-orange-400" />, bg: 'bg-orange-500/10 border-orange-500/20' },
              ].map(k => (
                <Card key={k.label} className={`border ${k.bg} rounded-xl shadow-sm`}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl border ${k.bg} flex items-center justify-center shrink-0`}>{k.icon}</div>
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{k.label}</p>
                      <p className="text-lg font-black text-foreground">{k.value}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Sub-tabs de análisis */}
            <div className="flex gap-2 flex-wrap">
              {[
                { id: 'employees', label: '👤 Por Empleado', icon: <UserCheck size={13}/> },
                { id: 'customers', label: '🛍️ Por Cliente', icon: <Users size={13}/> },
                { id: 'products', label: '🏆 Top Productos', icon: <Award size={13}/> },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setAnalyticsTab(t.id as any)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    analyticsTab === t.id
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {loadingAnalytics ? (
              <div className="py-16 flex items-center justify-center">
                <Loader2 className="animate-spin text-indigo-500" size={32} />
              </div>
            ) : (
              <>
                {/* ── A: Por Empleado ─────────────────────────────── */}
                {analyticsTab === 'employees' && (
                  <Card className="border shadow-md rounded-2xl bg-card overflow-hidden">
                    <CardHeader className="bg-slate-900 text-white p-5 dark:bg-slate-950">
                      <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-tight">
                        <UserCheck className="text-emerald-400" size={18} /> Ventas por Empleado
                      </CardTitle>
                      <CardDescription className="text-slate-400 text-xs">Ordenado por total facturado (mayor a menor).</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      {employeeStats.length === 0 ? (
                        <p className="p-6 text-sm text-center text-muted-foreground">Sin datos para el período seleccionado.</p>
                      ) : (
                        <div className="divide-y divide-border">
                          {employeeStats.map((e, i) => {
                            const pct = totalFilteredRevenue > 0 ? (e.total / totalFilteredRevenue) * 100 : 0;
                            return (
                              <div key={e.email} className="p-5 hover:bg-muted/20 transition-colors">
                                <div className="flex items-center justify-between gap-4 mb-2">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-xs font-black text-indigo-600 dark:text-indigo-400">{i + 1}</div>
                                    <div>
                                      <p className="text-sm font-bold text-foreground">{e.email}</p>
                                      <p className="text-[10px] text-muted-foreground">{e.count} ventas · Promedio ${e.count > 0 ? (e.total / e.count).toFixed(2) : '0.00'}</p>
                                    </div>
                                  </div>
                                  <p className="text-base font-black text-emerald-600 dark:text-emerald-400">${e.total.toFixed(2)}</p>
                                </div>
                                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* ── B: Por Cliente ──────────────────────────────── */}
                {analyticsTab === 'customers' && (
                  <Card className="border shadow-md rounded-2xl bg-card overflow-hidden">
                    <CardHeader className="bg-slate-900 text-white p-5 dark:bg-slate-950">
                      <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-tight">
                        <Users className="text-violet-400" size={18} /> Ventas por Cliente
                      </CardTitle>
                      <CardDescription className="text-slate-400 text-xs">Clientes ordenados por total comprado.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      {customerStats.length === 0 ? (
                        <p className="p-6 text-sm text-center text-muted-foreground">Sin datos para el período seleccionado.</p>
                      ) : (
                        <div className="divide-y divide-border">
                          {customerStats.map((c, i) => {
                            const pct = totalFilteredRevenue > 0 ? (c.total / totalFilteredRevenue) * 100 : 0;
                            return (
                              <div key={c.name} className="p-5 hover:bg-muted/20 transition-colors">
                                <div className="flex items-center justify-between gap-4 mb-2">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-xs font-black text-violet-600 dark:text-violet-400">{i + 1}</div>
                                    <div>
                                      <p className="text-sm font-bold text-foreground">{c.name}</p>
                                      <p className="text-[10px] text-muted-foreground">{c.count} compras · Última: {new Date(c.last).toLocaleDateString('es')}</p>
                                    </div>
                                  </div>
                                  <p className="text-base font-black text-violet-600 dark:text-violet-400">${c.total.toFixed(2)}</p>
                                </div>
                                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div className="h-full bg-gradient-to-r from-violet-500 to-pink-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* ── C: Top Productos ────────────────────────────── */}
                {analyticsTab === 'products' && (
                  <Card className="border shadow-md rounded-2xl bg-card overflow-hidden">
                    <CardHeader className="bg-slate-900 text-white p-5 dark:bg-slate-950">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-tight">
                            <Award className="text-amber-400" size={18} /> Top Productos Más Vendidos
                          </CardTitle>
                          <CardDescription className="text-slate-400 text-xs mt-1">Global o filtrado por cliente.</CardDescription>
                        </div>
                        <Select value={analyticsCustomerFilter} onValueChange={setAnalyticsCustomerFilter}>
                          <SelectTrigger className="w-52 h-9 bg-slate-800 border-slate-700 rounded-xl text-xs font-bold text-slate-200">
                            <SelectValue placeholder="Todos los clientes" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">🌐 Todos los clientes</SelectItem>
                            {customerStats.map(c => (
                              <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      {topProducts.length === 0 ? (
                        <p className="p-6 text-sm text-center text-muted-foreground">Sin datos de productos para el período seleccionado.</p>
                      ) : (
                        <div className="divide-y divide-border">
                          {topProducts.map((p, i) => {
                            const maxQty = topProducts[0]?.qty || 1;
                            const pct = (p.qty / maxQty) * 100;
                            return (
                              <div key={p.sku} className="p-5 hover:bg-muted/20 transition-colors">
                                <div className="flex items-center justify-between gap-4 mb-2">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${
                                      i === 0 ? 'bg-amber-400/20 border border-amber-400/30 text-amber-500' :
                                      i === 1 ? 'bg-slate-400/20 border border-slate-400/30 text-slate-500' :
                                      i === 2 ? 'bg-orange-400/20 border border-orange-400/30 text-orange-600' :
                                      'bg-muted border border-border text-muted-foreground'
                                    }`}>{i + 1}</div>
                                    <div className="min-w-0">
                                      <p className="text-sm font-bold text-foreground truncate max-w-[260px]">{p.name}</p>
                                      <p className="text-[10px] text-muted-foreground font-mono">{p.sku}</p>
                                    </div>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <p className="text-sm font-black text-amber-600 dark:text-amber-400">{p.qty} uds.</p>
                                    <p className="text-[10px] text-muted-foreground">${p.revenue.toFixed(2)}</p>
                                  </div>
                                </div>
                                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          {/* ═══════════ pestaña 6: SUCURSALES ═══════════════ */}
          <TabsContent value="branches" className="outline-none space-y-6">
            <Card className="border shadow-md rounded-2xl bg-card overflow-hidden">
              <CardHeader className="bg-slate-900 text-white p-6 dark:bg-slate-950">
                <CardTitle className="flex items-center gap-2 text-base font-black uppercase tracking-tight">
                  <Building className="text-blue-400" size={20} />
                  Gestión de Sucursales
                </CardTitle>
                <CardDescription className="text-slate-400 text-xs">Crea y administra las sucursales físicas de la empresa.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <form onSubmit={handleCreateBranch} className="flex gap-4 items-end bg-slate-100 dark:bg-white/5 p-4 rounded-xl border border-slate-200 dark:border-white/10">
                  <div className="flex-1 space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Nombre de la Sucursal</Label>
                    <Input 
                      placeholder="Ej. Sucursal Santa Tecla"
                      value={newBranchName}
                      onChange={e => setNewBranchName(e.target.value)}
                      className="h-10 bg-white dark:bg-zinc-900 border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold"
                    />
                  </div>
                  <Button type="submit" disabled={isSavingBranch || !newBranchName.trim()} className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-10 rounded-xl">
                    {isSavingBranch ? 'Creando...' : 'Crear Sucursal'}
                  </Button>
                </form>

                <div className="border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden bg-white dark:bg-zinc-900">
                  <Table>
                    <TableHeader className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10">
                      <TableRow>
                        <TableHead className="text-[10px] font-black uppercase px-6">Nombre de la Sucursal</TableHead>
                        <TableHead className="text-[10px] font-black uppercase text-center w-24">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {branches.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={2} className="text-center py-8 text-xs text-muted-foreground">
                            No hay sucursales registradas.
                          </TableCell>
                        </TableRow>
                      ) : (
                        branches.map((b: any) => (
                          <TableRow key={b.id} className="hover:bg-slate-50 dark:hover:bg-white/5 border-b border-slate-200 dark:border-white/10">
                            <TableCell className="px-6 py-4 font-bold text-xs">{b.name}</TableCell>
                            <TableCell className="text-center">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleDeleteBranch(b.id)}
                                className="text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-xl"
                              >
                                <Trash2 size={14} />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={isSqlModalOpen} onOpenChange={setIsSqlModalOpen}>
        <DialogContent className="max-w-2xl bg-slate-950 text-slate-100 border-slate-800 rounded-2xl overflow-hidden p-6 max-h-[85vh] flex flex-col">
          <DialogHeader className="pb-4 border-b border-white/10 border-slate-800">
            <DialogTitle className="flex items-center gap-2 text-white text-lg font-black uppercase tracking-tight">
              <Terminal className="text-emerald-400" size={20} />
              Script SQL Maestro — NexWay ERP
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs text-left">
              Script unificado completo. Copia y ejecuta en el SQL Editor de Supabase para crear o actualizar todas las tablas, columnas, políticas y publicaciones en un solo paso.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto my-4 rounded-xl bg-slate-900/80 p-4 border border-slate-850 font-mono text-xs text-slate-350 leading-relaxed no-scrollbar select-all whitespace-pre-wrap">
{`-- =========================================================================
-- NEXWAY ERP - SCRIPT MAESTRO UNIFICADO DE ESQUEMAS Y MIGRACIÓN (POSTGRESQL)
-- =========================================================================
-- Copia y pega este script completo en el SQL Editor de tu proyecto en Supabase para crear las tablas de forma automática.
-- Usamos "IF NOT EXISTS" para que puedas ejecutarlo completo sin borrar ni afectar tus datos actuales.

-- 1. EXTENSIONES ÚTILES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLA DE PERFILES DE USUARIOS (Roles de Acceso)
-- ADVERTENCIA: Borramos la tabla vieja en caso de que existiera con el tipo UUID incorrecto para evitar conflictos.
DROP TABLE IF EXISTS public.profiles CASCADE;
CREATE TABLE IF NOT EXISTS public.profiles (
  id text primary key, -- Se usa text para alojar el UID de Firebase Auth
  email text not null,
  role text not null default 'pedidos',
  station_id text, -- ID de la Caja/Sucursal asignada al usuario
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- Asegurar columnas básicas de perfiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS station_id text;

-- Habilitar Row Level Security (RLS) en la tabla perfiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Crear políticas básicas de acceso para perfiles (Usa 'OR REPLACE' si la base de datos lo soporta, o ignora errores si ya existen)
DO $$ BEGIN
  CREATE POLICY "Permitir lectura pública de perfiles" ON public.profiles FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Permitir a usuarios actualizar su propio perfil" ON public.profiles FOR UPDATE USING (auth.uid()::text = id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 3. DISPARADOR (TRIGGER) AUTOMÁTICO PARA NUEVOS USUARIOS (Si se usa auth nativo de Supabase)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (new.id::text, new.email, 'pedidos');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminamos el trigger si existe para volver a crearlo de forma segura
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. TABLA DE BODEGAS (ALMACENES)
CREATE TABLE IF NOT EXISTS public.warehouses (
  id uuid default uuid_generate_v4() primary key,
  name text not null unique,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 5. TABLA DE INVENTARIO MAESTRO (Catálogo de Productos)
CREATE TABLE IF NOT EXISTS public.inventory (
  sku text primary key,
  name text not null,
  category text not null default 'General',
  price numeric(10,2) not null default 0.00,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 6. TABLA DE EXISTENCIAS POR BODEGA
CREATE TABLE IF NOT EXISTS public.inventory_stock (
  id uuid default uuid_generate_v4() primary key,
  sku text references public.inventory(sku) on delete cascade not null,
  warehouse_id uuid references public.warehouses(id) on delete cascade not null,
  quantity numeric(10,2) not null default 0.00,
  constraint unique_sku_warehouse unique (sku, warehouse_id)
);

-- 7. TABLA DE PROVEEDORES
CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  nit text,
  nrc text,
  giro text,
  email text,
  phone text,
  address text,
  apply_retention boolean not null default false,
  apply_perception boolean not null default false,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 8. TABLA DE CLIENTES
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  nit text,
  nrc text,
  giro text,
  email text,
  phone text,
  address text,
  type text,
  category text,
  is_authorized_credit boolean not null default false,
  credit_limit numeric(10,2) not null default 0.00,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 9. TABLA DE COMPRAS (Ingresos de Stock)
CREATE TABLE IF NOT EXISTS public.purchases (
  id uuid default uuid_generate_v4() primary key,
  order_id text unique,
  supplier_name text, -- agregado por si order_id no basta
  document_type text,
  document_number text,
  supplier_id uuid references public.suppliers(id) on delete set null,
  entered_by text,
  warehouse_id uuid references public.warehouses(id) on delete set null,
  total numeric(10,2) not null default 0.00,
  status text not null default 'PENDIENTE',
  payment_method text,
  credit_days integer,
  payment_status text,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 10. DETALLES DE COMPRAS (Items)
CREATE TABLE IF NOT EXISTS public.purchase_items (
  id uuid default uuid_generate_v4() primary key,
  purchase_id uuid references public.purchases(id) on delete cascade not null,
  sku text references public.inventory(sku) on delete restrict not null,
  quantity numeric(10,2) not null default 0.00,
  cost numeric(10,2) not null default 0.00,
  subtotal numeric(10,2) not null default 0.00
);

-- 11. TABLA DE VENTAS (Facturación / DTE)
CREATE TABLE IF NOT EXISTS public.sales (
  id uuid default uuid_generate_v4() primary key,
  correlative text unique,
  doc_type text not null default 'CF',
  customer_id uuid references public.customers(id) on delete set null,
  total numeric(10,2) not null default 0.00,
  subtotal numeric(10,2) default 0.00,
  iva numeric(10,2) default 0.00,
  status text not null default 'ACTIVA',
  payment_method text,
  customer_name text,
  type text default 'Factura',
  seller_email text, -- Trazabilidad del empleado que realizó la venta
  station_name text, -- Caja/Sucursal desde donde se facturó
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- Asegurar columnas de trazabilidad en ventas
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS seller_email text;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS station_name text;

-- 12. DETALLES DE VENTAS (Items)
CREATE TABLE IF NOT EXISTS public.sales_items (
  id uuid default uuid_generate_v4() primary key,
  sale_id uuid references public.sales(id) on delete cascade not null,
  sku text not null,
  quantity numeric(10,2) not null default 0.00,
  price numeric(10,2) not null default 0.00,
  subtotal numeric(10,2) not null default 0.00,
  total numeric(10,2) default 0.00
);

-- 12.5 NUEVO: COTIZACIONES
CREATE TABLE IF NOT EXISTS public.quotations (
    id uuid default uuid_generate_v4() primary key,
    customer_name text not null,
    items jsonb not null default '[]'::jsonb,
    subtotal numeric(10,2) default 0.00,
    iva numeric(10,2) default 0.00,
    total numeric(10,2) default 0.00,
    status text default 'PENDIENTE',
    created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 13. LIBRO DIARIO CONTABLE (Asientos)
CREATE TABLE IF NOT EXISTS public.journal (
  id uuid default uuid_generate_v4() primary key,
  description text not null,
  type text not null default 'Egreso',
  amount numeric(10,2) not null default 0.00,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 14. LÍNEAS DE ASIENTOS DOBLES (Debe y Haber)
CREATE TABLE IF NOT EXISTS public.journal_lines (
  id uuid default uuid_generate_v4() primary key,
  journal_id uuid references public.journal(id) on delete cascade not null,
  account_code text not null,
  debit numeric(10,2) not null default 0.00,
  credit numeric(10,2) not null default 0.00
);

-- 15. TABLAS DE MAPEO DE PRODUCTOS
CREATE TABLE IF NOT EXISTS public.supplier_mappings (
  supplier_code text primary key,
  internal_sku text not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);
CREATE TABLE IF NOT EXISTS public.company_mappings (
  id uuid default uuid_generate_v4() primary key,
  master_sku text not null,
  product_name text not null,
  company_name text not null,
  company_sku text not null,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  constraint unique_company_mapping unique (company_name, company_sku)
);

-- 16. NOTAS DE CRÉDITO Y DÉBITO Y CIERRES
CREATE TABLE IF NOT EXISTS public.credit_notes (
  id uuid default uuid_generate_v4() primary key,
  ref_doc text not null,
  customer_name text not null,
  reason text not null,
  items jsonb not null,
  total numeric(10,2) not null default 0.00,
  status text not null default 'EMITIDA',
  created_at timestamptz default timezone('utc'::text, now()) not null
);
CREATE TABLE IF NOT EXISTS public.debit_notes (
  id uuid default uuid_generate_v4() primary key,
  ref_doc text not null,
  customer_name text not null,
  reason text not null,
  items jsonb not null,
  total numeric(10,2) not null default 0.00,
  status text not null default 'EMITIDA',
  created_at timestamptz default timezone('utc'::text, now()) not null
);
CREATE TABLE IF NOT EXISTS public.daily_closings (
  id uuid default uuid_generate_v4() primary key,
  date date not null unique,
  cash_float numeric(10,2) not null default 0.00,
  system_cash_sales numeric(10,2) not null default 0.00,
  physical_cash_found numeric(10,2) not null default 0.00,
  expenses numeric(10,2) not null default 0.00,
  difference numeric(10,2) not null default 0.00,
  denominations jsonb not null default '{}'::jsonb,
  system_card_sales numeric(10,2) not null default 0.00,
  physical_card_found numeric(10,2) not null default 0.00,
  card_difference numeric(10,2) not null default 0.00,
  system_check_sales numeric(10,2) not null default 0.00,
  physical_check_found numeric(10,2) not null default 0.00,
  check_difference numeric(10,2) not null default 0.00,
  system_transfer_sales numeric(10,2) not null default 0.00,
  physical_transfer_found numeric(10,2) not null default 0.00,
  transfer_difference numeric(10,2) not null default 0.00,
  system_credit_sales numeric(10,2) not null default 0.00,
  physical_credit_found numeric(10,2) not null default 0.00,
  credit_difference numeric(10,2) not null default 0.00,
  closed_by text,
  total_sales numeric(10,2) default 0.00,
  total_cash numeric(10,2) default 0.00,
  total_transfers numeric(10,2) default 0.00,
  status text not null default 'ABIERTO',
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 17. TABLAS DE PEDIDOS INTERNOS
CREATE TABLE IF NOT EXISTS public.internal_orders (
  id uuid default uuid_generate_v4() primary key,
  code text,
  source_warehouse text not null,
  destination_warehouse text not null,
  requested_by text not null,
  items jsonb not null,
  status text not null default 'PENDIENTE',
  created_at timestamptz default timezone('utc'::text, now()) not null
);
CREATE TABLE IF NOT EXISTS public.supplier_orders (
  id uuid default uuid_generate_v4() primary key,
  code text,
  supplier_name text not null,
  destination_warehouse text not null,
  requested_by text not null,
  items jsonb not null,
  total numeric(10,2) default 0.00,
  supplier_email text,
  from_email text,
  authorized_by text,
  digitized_by text,
  supplier_phone text,
  status text not null default 'PENDIENTE',
  created_at timestamptz default timezone('utc'::text, now()) not null
);

ALTER TABLE public.internal_orders ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE public.supplier_orders ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE public.supplier_orders ADD COLUMN IF NOT EXISTS total numeric(10,2) DEFAULT 0.00;
ALTER TABLE public.supplier_orders ADD COLUMN IF NOT EXISTS supplier_email text;
ALTER TABLE public.supplier_orders ADD COLUMN IF NOT EXISTS from_email text;
ALTER TABLE public.supplier_orders ADD COLUMN IF NOT EXISTS authorized_by text;
ALTER TABLE public.supplier_orders ADD COLUMN IF NOT EXISTS digitized_by text;
ALTER TABLE public.supplier_orders ADD COLUMN IF NOT EXISTS supplier_phone text;

-- 18. CONFIGURACIÓN GENERAL DEL SISTEMA
CREATE TABLE IF NOT EXISTS public.system_config (
  id uuid default uuid_generate_v4() unique,
  key text primary key,
  value jsonb not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- Cargar configuración inicial por defecto (incluye pos_stations vacío)
INSERT INTO public.system_config (key, value)
VALUES
  ('module_config', '{"orders": true, "transfers": true, "quotations": true, "quedan": true, "institutional": true, "management": true}'::jsonb),
  ('cash_config', '{"cashFloat": 100.00, "catchAllEmail": "pablopiche1g3@gmail.com"}'::jsonb),
  ('pos_stations', '[]'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 19. TABLA DE TRASLADOS
CREATE TABLE IF NOT EXISTS public.transfers (
  id uuid default uuid_generate_v4() primary key,
  type text not null,
  source text not null,
  destination text not null,
  authorized_by text not null,
  items jsonb not null,
  status text not null default 'COMPLETADO',
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 20. AREA DE QUEDAN (PAGOS A PROVEEDORES)
CREATE TABLE IF NOT EXISTS public.quedan (
  id uuid default uuid_generate_v4() primary key,
  supplier text not null,
  due_date date not null,
  invoices jsonb not null,
  total_amount numeric(10,2) not null default 0.00,
  status text not null default 'PENDIENTE',
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 21. LICITACIONES / INSTITUCIONAL
CREATE TABLE IF NOT EXISTS public.institutional_projects (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  purchase_order text,
  total_budget numeric(10,2) not null default 0.00,
  customer_name text,
  customer_id uuid references public.customers(id) on delete set null,
  items jsonb not null default '[]'::jsonb,
  status text not null default 'EN CURSO',
  budget numeric(15,2) default 0.00,
  documents jsonb not null default '[]'::jsonb,
  created_at timestamptz default timezone('utc'::text, now()) not null
);
CREATE TABLE IF NOT EXISTS public.institutional_sales (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.institutional_projects(id) on delete cascade,
  doc_number text,
  total numeric(10,2) not null default 0.00,
  amount numeric(15,2) default 0.00,
  date date default current_date,
  items text,
  cart_items jsonb default '[]'::jsonb,
  concept text,
  description text,
  customer_name text,
  customer_email text,
  status text not null default 'COMPLETADA',
  created_at timestamptz default timezone('utc'::text, now()) not null
);
CREATE TABLE IF NOT EXISTS public.institutional_purchases (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.institutional_projects(id) on delete cascade,
  supplier text,
  doc_number text,
  items jsonb default '[]'::jsonb,
  total numeric(10,2) not null default 0.00,
  amount numeric(15,2) default 0.00,
  description text,
  date date default current_date,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 22. REAL-TIME PARA TODAS LAS TABLAS CLAVE
DO $$ 
DECLARE
  t text;
  tables_to_publish text[] := ARRAY[
    'profiles', 'warehouses', 'inventory_stock', 'sales', 'purchases', 
    'journal', 'supplier_mappings', 'company_mappings', 'credit_notes', 
    'debit_notes', 'daily_closings', 'internal_orders', 'supplier_orders', 
    'system_config', 'transfers', 'quedan', 'institutional_projects', 
    'institutional_sales', 'institutional_purchases', 'quotations'
  ];
BEGIN
  FOREACH t IN ARRAY tables_to_publish
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', t);
    EXCEPTION WHEN undefined_object OR duplicate_object THEN
      NULL;
    END;
  END LOOP;
END $$;`}
          </div>
          <div className="flex justify-end pt-2 gap-2 border-t border-white/10 border-slate-800">
            <Button
              onClick={() => {
                navigator.clipboard.writeText(
`-- NEXWAY ERP - SCRIPT MAESTRO UNIFICADO DE ESQUEMAS Y MIGRACIÓN (POSTGRESQL)
-- Copia y ejecuta este script completo en una sola pestaña de tu SQL Editor en Supabase.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE TABLE IF NOT EXISTS public.profiles (id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY, email text NOT NULL, role text NOT NULL DEFAULT 'pedidos', station_id text, created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS station_id text;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Permitir lectura pública de perfiles" ON public.profiles FOR SELECT USING (true); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Permitir a usuarios actualizar su propio perfil" ON public.profiles FOR UPDATE USING (auth.uid() = id); EXCEPTION WHEN OTHERS THEN NULL; END $$;
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger AS $$ BEGIN INSERT INTO public.profiles (id, email, role) VALUES (new.id, new.email, 'pedidos'); RETURN new; END; $$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
CREATE TABLE IF NOT EXISTS public.warehouses (id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, name text NOT NULL UNIQUE, created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL);
CREATE TABLE IF NOT EXISTS public.inventory (sku text PRIMARY KEY, name text NOT NULL, category text NOT NULL DEFAULT 'General', price numeric(10,2) NOT NULL DEFAULT 0.00, created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL);
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS name text; ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS category text; ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS price numeric(10,2) DEFAULT 0.00;
CREATE TABLE IF NOT EXISTS public.inventory_stock (id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, sku text REFERENCES public.inventory(sku) ON DELETE CASCADE NOT NULL, warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE CASCADE NOT NULL, quantity numeric(10,2) NOT NULL DEFAULT 0.00, CONSTRAINT unique_sku_warehouse UNIQUE (sku, warehouse_id));
ALTER TABLE public.inventory_stock ADD COLUMN IF NOT EXISTS quantity numeric(10,2) DEFAULT 0.00;
CREATE TABLE IF NOT EXISTS public.suppliers (id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, name text NOT NULL, nit text, nrc text, giro text, email text, phone text, address text, apply_retention boolean NOT NULL DEFAULT false, apply_perception boolean NOT NULL DEFAULT false, created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL);
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS apply_retention boolean NOT NULL DEFAULT false; ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS apply_perception boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS public.customers (id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, name text NOT NULL, nit text, nrc text, giro text, email text, phone text, address text, type text, category text, is_authorized_credit boolean NOT NULL DEFAULT false, credit_limit numeric(10,2) NOT NULL DEFAULT 0.00, created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL);
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS is_authorized_credit boolean NOT NULL DEFAULT false; ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS credit_limit numeric(10,2) NOT NULL DEFAULT 0.00;
CREATE TABLE IF NOT EXISTS public.purchases (id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, order_id text NOT NULL UNIQUE, supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL, entered_by text NOT NULL, warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL, total numeric(10,2) NOT NULL DEFAULT 0.00, status text NOT NULL DEFAULT 'PENDIENTE', created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL);
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS payment_method text; ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS credit_days integer; ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS payment_status text;
CREATE TABLE IF NOT EXISTS public.purchase_items (id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, purchase_id uuid REFERENCES public.purchases(id) ON DELETE CASCADE NOT NULL, sku text REFERENCES public.inventory(sku) ON DELETE RESTRICT NOT NULL, quantity numeric(10,2) NOT NULL DEFAULT 0.00, cost numeric(10,2) NOT NULL DEFAULT 0.00, subtotal numeric(10,2) NOT NULL DEFAULT 0.00);
CREATE TABLE IF NOT EXISTS public.sales (id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, correlative text NOT NULL UNIQUE, doc_type text NOT NULL DEFAULT 'CF', customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL, total numeric(10,2) NOT NULL DEFAULT 0.00, status text NOT NULL DEFAULT 'ACTIVA', payment_method text, customer_name text, seller_email text, station_name text, created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL);
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS seller_email text; ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS station_name text;
CREATE TABLE IF NOT EXISTS public.sales_items (id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, sale_id uuid REFERENCES public.sales(id) ON DELETE CASCADE NOT NULL, sku text REFERENCES public.inventory(sku) ON DELETE RESTRICT NOT NULL, quantity numeric(10,2) NOT NULL DEFAULT 0.00, price numeric(10,2) NOT NULL DEFAULT 0.00, subtotal numeric(10,2) NOT NULL DEFAULT 0.00);
CREATE TABLE IF NOT EXISTS public.journal (id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, description text NOT NULL, type text NOT NULL DEFAULT 'Egreso', amount numeric(10,2) NOT NULL DEFAULT 0.00, created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL);
CREATE TABLE IF NOT EXISTS public.journal_lines (id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, journal_id uuid REFERENCES public.journal(id) ON DELETE CASCADE NOT NULL, account_code text NOT NULL, debit numeric(10,2) NOT NULL DEFAULT 0.00, credit numeric(10,2) NOT NULL DEFAULT 0.00);
CREATE TABLE IF NOT EXISTS public.supplier_mappings (supplier_code text PRIMARY KEY, internal_sku text NOT NULL, updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL);
CREATE TABLE IF NOT EXISTS public.company_mappings (id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, master_sku text NOT NULL, product_name text NOT NULL, company_name text NOT NULL, company_sku text NOT NULL, created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL, CONSTRAINT unique_company_mapping UNIQUE (company_name, company_sku));
CREATE TABLE IF NOT EXISTS public.credit_notes (id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, ref_doc text NOT NULL, customer_name text NOT NULL, reason text NOT NULL, items jsonb NOT NULL, total numeric(10,2) NOT NULL DEFAULT 0.00, status text NOT NULL DEFAULT 'EMITIDA', created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL);
CREATE TABLE IF NOT EXISTS public.debit_notes (id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, ref_doc text NOT NULL, customer_name text NOT NULL, reason text NOT NULL, items jsonb NOT NULL, total numeric(10,2) NOT NULL DEFAULT 0.00, status text NOT NULL DEFAULT 'EMITIDA', created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL);
CREATE TABLE IF NOT EXISTS public.daily_closings (id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, date date NOT NULL, cash_float numeric(10,2) NOT NULL DEFAULT 0.00, system_cash_sales numeric(10,2) NOT NULL DEFAULT 0.00, physical_cash_found numeric(10,2) NOT NULL DEFAULT 0.00, expenses numeric(10,2) NOT NULL DEFAULT 0.00, difference numeric(10,2) NOT NULL DEFAULT 0.00, denominations jsonb NOT NULL, system_card_sales numeric(10,2) NOT NULL DEFAULT 0.00, physical_card_found numeric(10,2) NOT NULL DEFAULT 0.00, card_difference numeric(10,2) NOT NULL DEFAULT 0.00, system_check_sales numeric(10,2) NOT NULL DEFAULT 0.00, physical_check_found numeric(10,2) NOT NULL DEFAULT 0.00, check_difference numeric(10,2) NOT NULL DEFAULT 0.00, system_transfer_sales numeric(10,2) NOT NULL DEFAULT 0.00, physical_transfer_found numeric(10,2) NOT NULL DEFAULT 0.00, transfer_difference numeric(10,2) NOT NULL DEFAULT 0.00, system_credit_sales numeric(10,2) NOT NULL DEFAULT 0.00, physical_credit_found numeric(10,2) NOT NULL DEFAULT 0.00, credit_difference numeric(10,2) NOT NULL DEFAULT 0.00, closed_by text NOT NULL, created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL);
ALTER TABLE public.daily_closings ADD COLUMN IF NOT EXISTS system_card_sales numeric(10,2) NOT NULL DEFAULT 0.00; ALTER TABLE public.daily_closings ADD COLUMN IF NOT EXISTS physical_card_found numeric(10,2) NOT NULL DEFAULT 0.00; ALTER TABLE public.daily_closings ADD COLUMN IF NOT EXISTS card_difference numeric(10,2) NOT NULL DEFAULT 0.00; ALTER TABLE public.daily_closings ADD COLUMN IF NOT EXISTS system_check_sales numeric(10,2) NOT NULL DEFAULT 0.00; ALTER TABLE public.daily_closings ADD COLUMN IF NOT EXISTS physical_check_found numeric(10,2) NOT NULL DEFAULT 0.00; ALTER TABLE public.daily_closings ADD COLUMN IF NOT EXISTS check_difference numeric(10,2) NOT NULL DEFAULT 0.00; ALTER TABLE public.daily_closings ADD COLUMN IF NOT EXISTS system_transfer_sales numeric(10,2) NOT NULL DEFAULT 0.00; ALTER TABLE public.daily_closings ADD COLUMN IF NOT EXISTS physical_transfer_found numeric(10,2) NOT NULL DEFAULT 0.00; ALTER TABLE public.daily_closings ADD COLUMN IF NOT EXISTS transfer_difference numeric(10,2) NOT NULL DEFAULT 0.00; ALTER TABLE public.daily_closings ADD COLUMN IF NOT EXISTS system_credit_sales numeric(10,2) NOT NULL DEFAULT 0.00; ALTER TABLE public.daily_closings ADD COLUMN IF NOT EXISTS physical_credit_found numeric(10,2) NOT NULL DEFAULT 0.00; ALTER TABLE public.daily_closings ADD COLUMN IF NOT EXISTS credit_difference numeric(10,2) NOT NULL DEFAULT 0.00;
CREATE TABLE IF NOT EXISTS public.internal_orders (id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, code text, source_warehouse text NOT NULL, destination_warehouse text NOT NULL, requested_by text NOT NULL, items jsonb NOT NULL, status text NOT NULL DEFAULT 'PENDIENTE', created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL);
CREATE TABLE IF NOT EXISTS public.supplier_orders (id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, code text, supplier_name text NOT NULL, destination_warehouse text NOT NULL, requested_by text NOT NULL, items jsonb NOT NULL, total numeric(10,2) DEFAULT 0.00, supplier_email text, from_email text, authorized_by text, digitized_by text, supplier_phone text, status text NOT NULL DEFAULT 'PENDIENTE', created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL);
ALTER TABLE public.internal_orders ADD COLUMN IF NOT EXISTS code text; ALTER TABLE public.supplier_orders ADD COLUMN IF NOT EXISTS code text; ALTER TABLE public.supplier_orders ADD COLUMN IF NOT EXISTS total numeric(10,2) DEFAULT 0.00; ALTER TABLE public.supplier_orders ADD COLUMN IF NOT EXISTS supplier_email text; ALTER TABLE public.supplier_orders ADD COLUMN IF NOT EXISTS from_email text; ALTER TABLE public.supplier_orders ADD COLUMN IF NOT EXISTS authorized_by text; ALTER TABLE public.supplier_orders ADD COLUMN IF NOT EXISTS digitized_by text; ALTER TABLE public.supplier_orders ADD COLUMN IF NOT EXISTS supplier_phone text;
CREATE TABLE IF NOT EXISTS public.system_config (key text PRIMARY KEY, value jsonb NOT NULL);
INSERT INTO public.system_config (key, value) VALUES ('module_config', '{"orders": true, "transfers": true, "quotations": true, "quedan": true, "institutional": true, "management": true}'::jsonb), ('cash_config', '{"cashFloat": 100.00, "catchAllEmail": "pablopiche1g3@gmail.com"}'::jsonb), ('pos_stations', '[]'::jsonb) ON CONFLICT (key) DO NOTHING;
CREATE TABLE IF NOT EXISTS public.transfers (id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, type text NOT NULL, source text NOT NULL, destination text NOT NULL, authorized_by text NOT NULL, items jsonb NOT NULL, status text NOT NULL DEFAULT 'COMPLETADO', created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL);
CREATE TABLE IF NOT EXISTS public.quedan (id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, supplier text NOT NULL, due_date date NOT NULL, invoices jsonb NOT NULL, total_amount numeric(10,2) NOT NULL DEFAULT 0.00, status text NOT NULL DEFAULT 'PENDIENTE', created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL);
CREATE TABLE IF NOT EXISTS public.institutional_projects (id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, name text NOT NULL, purchase_order text, total_budget numeric(10,2) NOT NULL DEFAULT 0.00, customer_name text, items jsonb NOT NULL DEFAULT '[]'::jsonb, status text NOT NULL DEFAULT 'EN CURSO', documents jsonb NOT NULL DEFAULT '[]'::jsonb, created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL);
CREATE TABLE IF NOT EXISTS public.institutional_sales (id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, project_id uuid REFERENCES public.institutional_projects(id) ON DELETE SET NULL, doc_number text NOT NULL, total numeric(10,2) NOT NULL DEFAULT 0.00, date date NOT NULL DEFAULT current_date, items text, cart_items jsonb NOT NULL DEFAULT '[]'::jsonb, concept text, customer_name text, customer_email text, status text NOT NULL DEFAULT 'COMPLETADA', created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL);
CREATE TABLE IF NOT EXISTS public.institutional_purchases (id uuid DEFAULT uuid_generate_v4() PRIMARY KEY, project_id uuid REFERENCES public.institutional_projects(id) ON DELETE SET NULL, supplier text, doc_number text, items jsonb NOT NULL DEFAULT '[]'::jsonb, total numeric(10,2) NOT NULL DEFAULT 0.00, date date NOT NULL DEFAULT current_date, created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL);
DO ${'$'}${'$'} BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles; EXCEPTION WHEN OTHERS THEN NULL; END ${'$'}${'$'};
DO ${'$'}${'$'} BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.warehouses; EXCEPTION WHEN OTHERS THEN NULL; END ${'$'}${'$'};
DO ${'$'}${'$'} BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_stock; EXCEPTION WHEN OTHERS THEN NULL; END ${'$'}${'$'};
DO ${'$'}${'$'} BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.sales; EXCEPTION WHEN OTHERS THEN NULL; END ${'$'}${'$'};
DO ${'$'}${'$'} BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.purchases; EXCEPTION WHEN OTHERS THEN NULL; END ${'$'}${'$'};
DO ${'$'}${'$'} BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.journal; EXCEPTION WHEN OTHERS THEN NULL; END ${'$'}${'$'};
DO ${'$'}${'$'} BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.system_config; EXCEPTION WHEN OTHERS THEN NULL; END ${'$'}${'$'};
DO ${'$'}${'$'} BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.transfers; EXCEPTION WHEN OTHERS THEN NULL; END ${'$'}${'$'};
DO ${'$'}${'$'} BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.quedan; EXCEPTION WHEN OTHERS THEN NULL; END ${'$'}${'$'};
DO ${'$'}${'$'} BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.institutional_projects; EXCEPTION WHEN OTHERS THEN NULL; END ${'$'}${'$'};
DO ${'$'}${'$'} BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.institutional_sales; EXCEPTION WHEN OTHERS THEN NULL; END ${'$'}${'$'};
DO ${'$'}${'$'} BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.institutional_purchases; EXCEPTION WHEN OTHERS THEN NULL; END ${'$'}${'$'};
DO ${'$'}${'$'} BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.internal_orders; EXCEPTION WHEN OTHERS THEN NULL; END ${'$'}${'$'};
DO ${'$'}${'$'} BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.supplier_orders; EXCEPTION WHEN OTHERS THEN NULL; END ${'$'}${'$'};`
                );
                toast({ title: "Copiado", description: "Script SQL Maestro copiado al portapapeles exitosamente." });
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

      {/* MODAL DE EDICIÓN DE PERMISOS INDIVIDUALES */}
      <Dialog open={isPermsDialogOpen} onOpenChange={setIsPermsDialogOpen}>
        <DialogContent className="max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-6 overflow-hidden flex flex-col max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800 dark:text-white text-lg font-black uppercase">
              <ShieldCheck className="text-indigo-600 dark:text-sky-500" size={22} />
              Configurar Permisos: {selectedUserForPerms?.email}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Personalice de forma detallada los módulos y pestañas a los que este usuario tiene acceso individual.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-2 my-4">
            <div className="space-y-6">
              {modules.map((m) => {
                const moduleEnabled = userPermsModules.includes(m.id);
                return (
                  <div key={m.id} className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-bold text-slate-800 dark:text-slate-200">{m.label}</Label>
                        <p className="text-[10px] text-muted-foreground">{m.desc}</p>
                      </div>
                      <Switch 
                        checked={moduleEnabled} 
                        onCheckedChange={(val) => handleTogglePermsModule(m.id, val)}
                      />
                    </div>

                    {moduleEnabled && m.tabs && (
                      <div className="ml-4 pl-4 border-l-2 border-slate-200 dark:border-slate-800 space-y-2 pt-2 animate-in fade-in slide-in-from-top-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Habilitar Pestañas</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {m.tabs.map((tab) => {
                            const tabKey = `${m.id}_${tab.id}`;
                            const tabEnabled = userPermsTabs.includes(tabKey);
                            return (
                              <div key={tab.id} className="flex items-center justify-between py-1 px-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5">
                                <Label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{tab.label}</Label>
                                <Switch 
                                  checked={tabEnabled} 
                                  onCheckedChange={(val) => handleTogglePermsTab(tabKey, val)}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-4 border-t border-slate-200 dark:border-white/10">
            <Button
              type="button"
              variant="outline"
              onClick={handleResetToDefaultPermissions}
              disabled={isSavingPerms}
              className="text-xs rounded-xl text-rose-500 hover:text-rose-600 dark:hover:bg-rose-500/10 border-rose-200"
            >
              USAR ROL POR DEFECTO
            </Button>
            <div className="flex gap-2 sm:ml-auto">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsPermsDialogOpen(false)}
                disabled={isSavingPerms}
                className="text-xs rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleSaveCustomPermissions}
                disabled={isSavingPerms}
                className="text-xs rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
              >
                {isSavingPerms ? <Loader2 className="animate-spin mr-1" size={14} /> : null}
                Guardar Accesos
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
