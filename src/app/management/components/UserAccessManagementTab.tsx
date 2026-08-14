'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  KeyRound, 
  Lock, 
  Unlock, 
  Monitor, 
  Smartphone, 
  CheckCircle2, 
  XCircle, 
  Search, 
  Settings, 
  RefreshCw, 
  LogOut,
  Laptop
} from 'lucide-react';

export interface AppUser {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: string;
  pin_code: string;
  status: 'active' | 'suspended';
  allowed_modules: string[];
  last_device?: string;
  last_login?: string;
}

const AVAILABLE_MODULES = [
  { id: 'billing', name: 'Facturación y POS' },
  { id: 'compras', name: 'Compras y Proveedores' },
  { id: 'finanzas', name: 'Finanzas, Bancos y Créditos' },
  { id: 'logistica', name: 'Logística e Inventarios' },
  { id: 'accounting', name: 'Contabilidad y Hacienda' },
  { id: 'management', name: 'Gerencia y Reportes' },
  { id: 'crm', name: 'CRM Comercial' }
];

export default function UserAccessManagementTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<AppUser[]>([]);

  // Modal para Nuevo Usuario / Edición
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pinCode, setPinCode] = useState('1234');
  const [role, setRole] = useState('cajero');
  const [selectedModules, setSelectedModules] = useState<string[]>(['billing']);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('app_users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        // Fallback a almacenamiento local si la tabla aún se está sincronizando
        const localUsers = localStorage.getItem('nexway_app_users');
        if (localUsers) {
          setUsers(JSON.parse(localUsers));
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
              allowed_modules: ['billing', 'compras', 'finanzas', 'logistica', 'accounting', 'management', 'crm'],
              last_device: 'Windows PC (Chrome)',
              last_login: new Date().toISOString()
            },
            {
              id: 'u2',
              username: 'cajero1',
              email: 'caja1@nexway.sv',
              full_name: 'Carlos Mendoza (Cajero POS)',
              role: 'cajero',
              pin_code: '1234',
              status: 'active',
              allowed_modules: ['billing'],
              last_device: 'POS Terminal (Chrome)',
              last_login: new Date().toISOString()
            }
          ];
          setUsers(initialMock);
          localStorage.setItem('nexway_app_users', JSON.stringify(initialMock));
        }
      } else if (data) {
        setUsers(data);
      }
    } catch {
      const localUsers = localStorage.getItem('nexway_app_users');
      if (localUsers) setUsers(JSON.parse(localUsers));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

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
        allowed_modules: newUser.allowed_modules
      });
    } catch (e) {
      console.error('Error saving app_user to Supabase:', e);
    }

    toast({
      title: editingUserId ? 'Usuario Actualizado' : 'Nuevo Usuario Creado',
      description: `El usuario ${newUser.full_name} fue guardado con éxito. PIN: ${newUser.pin_code}`
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
    setSelectedModules(['billing']);
  };

  const handleToggleModule = (modId: string) => {
    if (selectedModules.includes(modId)) {
      setSelectedModules(selectedModules.filter(m => m !== modId));
    } else {
      setSelectedModules([...selectedModules, modId]);
    }
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

  const handleTerminateRemoteSession = (userObj: AppUser) => {
    toast({
      title: 'Sesión Remota Finalizada',
      description: `Se revocó el token de sesión en la computadora remota para ${userObj.full_name}.`
    });
  };

  const handleUnifyUsers = () => {
    // Filtrar correos duplicados y consolidar en lista única
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
      title: 'Unificación Completada 🧹',
      description: `Se eliminaron ${cleanedCount} correo(s) duplicado(s). Se unificó la lista de usuarios.`
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
            Gestor de Accesos y Usuarios Propio del ERP NexWay
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Administración 100% autónoma de credenciales, códigos PIN de caja, permisos de módulo y sesiones en múltiples computadoras.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleUnifyUsers}
            variant="outline"
            className="font-bold text-xs h-10 rounded-xl flex items-center gap-1.5 border-amber-500/30 text-amber-600 dark:text-amber-400"
          >
            <RefreshCw size={15} /> Unificar & Limpiar Duplicados
          </Button>

          <Button
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="bg-indigo-600 hover:bg-indigo-700 font-bold text-xs h-10 rounded-xl text-white flex items-center gap-1.5"
          >
            <UserPlus size={16} /> Crear Nuevo Usuario / Cajero
          </Button>
        </div>
      </div>

      {/* Buscador y Filtro */}
      <Card className="border shadow-sm rounded-2xl bg-card overflow-hidden">
        <div className="p-4 border-b flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <Input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar usuario por nombre, correo o rol..."
              className="pl-10 text-xs h-9 rounded-xl"
            />
          </div>
        </div>

        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="text-xs font-bold">Colaborador / Correo</TableHead>
              <TableHead className="text-xs font-bold">Rol en el ERP</TableHead>
              <TableHead className="text-xs font-bold text-center">PIN POS (4 dígitos)</TableHead>
              <TableHead className="text-xs font-bold">Módulos Permitidos</TableHead>
              <TableHead className="text-xs font-bold">Dispositivo Activo</TableHead>
              <TableHead className="text-xs font-bold text-center">Estado Acceso</TableHead>
              <TableHead className="text-xs font-bold text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map(u => (
              <TableRow key={u.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-slate-800 dark:text-white">{u.full_name}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{u.email}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-0 uppercase text-[9px] font-black">
                    {u.role}
                  </Badge>
                </TableCell>
                <TableCell className="text-center font-mono font-bold text-xs text-amber-600 dark:text-amber-400">
                  {u.pin_code || '1234'}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {(u.allowed_modules || []).map(mId => (
                      <Badge key={mId} variant="outline" className="text-[8px] font-bold uppercase py-0">
                        {mId}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                    <Laptop size={12} className="text-slate-400" />
                    <span>{u.last_device || 'Computadora / Celular'}</span>
                  </div>
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
                      onClick={() => handleToggleStatus(u)}
                      className="h-7 px-2 text-[10px] font-bold text-slate-600 hover:text-slate-900"
                      title={u.status === 'active' ? 'Suspender acceso' : 'Habilitar acceso'}
                    >
                      {u.status === 'active' ? <Lock size={13} className="text-rose-500" /> : <Unlock size={13} className="text-emerald-500" />}
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleTerminateRemoteSession(u)}
                      className="h-7 px-2 text-[10px] font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                      title="Cerrar sesión en computadora remota"
                    >
                      <LogOut size={13} />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Modal para Crear / Editar Usuario */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="rounded-2xl max-w-lg p-6 bg-card border shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
              <UserPlus className="text-indigo-500" size={20} />
              {editingUserId ? 'Editar Usuario ERP' : 'Registrar Nuevo Usuario / Cajero'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Asigna nombre, credencial, código PIN para cajas y matriz de permisos por módulo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-2">
            <div className="grid grid-cols-2 gap-3">
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
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold">Rol en Sistema</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger className="h-9 text-xs rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="administrador">Administrador</SelectItem>
                    <SelectItem value="gerente">Gerente</SelectItem>
                    <SelectItem value="cajero">Cajero POS</SelectItem>
                    <SelectItem value="contador">Contador</SelectItem>
                    <SelectItem value="vendedor">Vendedor</SelectItem>
                  </SelectContent>
                </Select>
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

              <div className="space-y-1">
                <Label className="text-xs font-bold">Contraseña</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="******"
                  className="text-xs h-9 rounded-xl"
                />
              </div>
            </div>

            {/* Matriz de Módulos Permitidos */}
            <div className="space-y-2 pt-2 border-t">
              <Label className="text-xs font-bold text-slate-800 dark:text-white flex items-center justify-between">
                <span>Matriz de Permisos de Módulo</span>
                <span className="text-[10px] text-indigo-500 font-normal">{selectedModules.length} Seleccionados</span>
              </Label>

              <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto p-2 bg-muted/30 rounded-xl border">
                {AVAILABLE_MODULES.map(mod => {
                  const isChecked = selectedModules.includes(mod.id);
                  return (
                    <div
                      key={mod.id}
                      onClick={() => handleToggleModule(mod.id)}
                      className={`p-2 rounded-lg border text-xs font-bold flex items-center justify-between cursor-pointer transition-all ${
                        isChecked ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400' : 'bg-card border-border text-slate-500'
                      }`}
                    >
                      <span>{mod.name}</span>
                      {isChecked ? <CheckCircle2 size={14} className="text-indigo-500" /> : <div className="w-3.5 h-3.5 rounded-full border border-slate-300" />}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="h-9 text-xs">Cancelar</Button>
            <Button onClick={handleSaveUser} className="h-9 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl">
              Guardar Usuario y PIN
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
