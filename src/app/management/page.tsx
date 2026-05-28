
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
  Users
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useFirestore, useDoc, useCollection, collection, doc } from '@/firebase';
import { setDoc, query } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function ManagementPage() {
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [cashFloat, setCashFloat] = useState<string>('0');
  const [catchAllEmail, setCatchAllEmail] = useState<string>('');
  const [isInitialized, setIsInitialized] = useState(false);

  const usersQuery = useMemo(() => query(collection(db, 'users')), [db]);
  const { data: usersList, loading: loadingUsers } = useCollection<any>(usersQuery);

  // Referencias estables a documentos de configuración global
  const configRef = useMemo(() => doc(db, 'system', 'module_config'), [db]);
  const { data: config } = useDoc<any>(configRef);

  const cashConfigRef = useMemo(() => doc(db, 'system', 'cash_config'), [db]);
  const { data: cashConfig, loading: loadingCash } = useDoc<any>(cashConfigRef);

  // Sincronizar el estado local solo la primera vez que se reciben datos
  useEffect(() => {
    if (!isInitialized && cashConfig) {
      if (cashConfig.cashFloat !== undefined) setCashFloat(cashConfig.cashFloat.toString());
      if (cashConfig.catchAllEmail !== undefined) setCatchAllEmail(cashConfig.catchAllEmail);
      setIsInitialized(true);
    }
  }, [cashConfig, isInitialized]);

  const handleToggleModule = async (moduleId: string, value: boolean) => {
    const newConfig = { ...config, [moduleId]: value };
    setIsSaving(true);
    try {
      await setDoc(configRef, newConfig, { merge: true });
      toast({ title: "Módulo Actualizado", description: `Estado cambiado exitosamente.` });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    setIsSaving(true);
    try {
      const userRef = doc(db, 'users', userId);
      await setDoc(userRef, { role: newRole }, { merge: true });
      toast({ title: "Rol de Usuario Actualizado", description: `El usuario ahora tiene el rol de ${newRole === 'admin' ? 'Administrador' : 'Solo Pedidos'}.` });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar el rol de usuario." });
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
      await setDoc(cashConfigRef, { 
        cashFloat: val,
        catchAllEmail: catchAllEmail.trim()
      }, { merge: true });
      toast({ title: "Configuración Actualizada", description: "Los ajustes globales han sido guardados." });
      setIsInitialized(true);
    } catch (error) {
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

      <div className="max-w-4xl mx-auto space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-none shadow-sm rounded-3xl bg-card overflow-hidden border">
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

          <div className="bg-blue-50 border border-blue-100 p-6 rounded-3xl flex flex-col justify-center gap-3 dark:bg-blue-900/10 dark:border-blue-900/20 h-fit">
            <div className="flex items-center gap-2 text-blue-800 font-bold dark:text-blue-300">
              <AlertCircle size={20} />
              <p className="text-sm uppercase tracking-tight">Notificaciones DTE</p>
            </div>
            <p className="text-xs text-blue-700 leading-relaxed dark:text-blue-400">
              El correo bolsón es obligatorio para cumplir con la normativa de respaldo digital. Si un cliente no está registrado o no proporciona correo, el sistema enviará automáticamente el DTE a la dirección configurada arriba para su posterior entrega física o reenvío manual.
            </p>
          </div>
        </div>

        <Card className="border-none shadow-sm rounded-3xl bg-card overflow-hidden border">
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

        {/* Gestor de Roles y Usuarios */}
        <Card className="border-none shadow-sm rounded-3xl bg-card overflow-hidden border">
          <CardHeader className="bg-slate-900 text-white p-6 dark:bg-slate-950">
            <CardTitle className="flex items-center gap-2 text-base font-black uppercase tracking-tight">
              <Users className="text-violet-400" size={20} />
              Gestión de Usuarios y Roles
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs">Asigne roles de acceso para controlar los módulos visibles.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loadingUsers ? (
              <div className="p-6 flex items-center justify-center">
                <Loader2 className="animate-spin text-violet-600 animate-pulse" />
              </div>
            ) : (
              <div className="divide-y divide-border">
                {usersList.map((usr: any) => (
                  <div key={usr.id} className="p-6 flex items-center justify-between hover:bg-muted/30 transition-colors">
                    <div className="space-y-1">
                      <Label className="text-sm font-bold text-foreground">{usr.email || 'Usuario sin correo'}</Label>
                      <p className="text-[10px] text-muted-foreground font-mono">UID: {usr.uid || usr.id}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Select 
                        value={usr.role || 'pedidos'} 
                        onValueChange={(val) => handleChangeRole(usr.id, val)}
                        disabled={isSaving || usr.email === 'saladventastecnicolor@gmail.com'}
                      >
                        <SelectTrigger className="w-[200px] h-10 bg-muted border-none rounded-xl text-xs font-bold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Administrador (Todos)</SelectItem>
                          <SelectItem value="pedidos">Solo Pedidos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
                {usersList.length === 0 && (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    No hay otros usuarios registrados en el sistema.
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
