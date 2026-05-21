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
  Database
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useFirestore, useDoc, useUser } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

export default function ManagementPage() {
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [cashFloat, setCashFloat] = useState<string>('300');

  const configRef = useMemo(() => doc(db, 'system', 'module_config'), [db]);
  const { data: config, loading: loadingConfig } = useDoc<any>(configRef);

  const cashConfigRef = useMemo(() => doc(db, 'system', 'cash_config'), [db]);
  const { data: cashConfig, loading: loadingCash } = useDoc<any>(cashConfigRef);

  useEffect(() => {
    if (cashConfig?.cashFloat !== undefined) {
      setCashFloat(cashConfig.cashFloat.toString());
    }
  }, [cashConfig]);

  const handleToggleModule = async (moduleId: string, value: boolean) => {
    const newConfig = { ...config, [moduleId]: value };
    setIsSaving(true);
    try {
      await setDoc(configRef, newConfig, { merge: true });
      toast({ title: "Configuración Actualizada", description: `El módulo ha sido ${value ? 'activado' : 'desactivado'}.` });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar la configuración." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveCashFloat = async () => {
    setIsSaving(true);
    try {
      await setDoc(cashConfigRef, { cashFloat: parseFloat(cashFloat) || 0 }, { merge: true });
      toast({ title: "Fondo Base Guardado", description: "El monto inicial de caja ha sido actualizado." });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo guardar el fondo base." });
    } finally {
      setIsSaving(false);
    }
  };

  if (loadingConfig || loadingCash) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

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
    { id: 'management', label: 'Gerencia', desc: 'Permisos y configuración base' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-6 transition-colors duration-300 dark:bg-background">
      <div className="max-w-4xl mx-auto mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="rounded-full bg-card shadow-sm border" onClick={() => router.push('/')}>
            <ArrowLeft className="text-foreground" size={20} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gerencia y Control</h1>
            <p className="text-muted-foreground text-sm">Configuración global y gestión de permisos</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-none shadow-sm rounded-3xl bg-card overflow-hidden border">
            <CardHeader className="bg-slate-900 text-white p-6 dark:bg-slate-950">
              <CardTitle className="flex items-center gap-2 text-base">
                <Coins className="text-blue-400" size={20} />
                Fondo Base de Caja
              </CardTitle>
              <CardDescription className="text-slate-400 text-xs">
                Monto inicial fijo para cambio diario.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground">Monto ($)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                  <Input 
                    type="number" 
                    placeholder="0.00" 
                    value={cashFloat}
                    onChange={(e) => setCashFloat(e.target.value)}
                    className="h-12 pl-10 text-xl font-bold bg-muted rounded-xl border-none"
                  />
                </div>
              </div>
              <Button 
                onClick={handleSaveCashFloat} 
                disabled={isSaving}
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl"
              >
                {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" size={18} />}
                Establecer Fondo
              </Button>
            </CardContent>
          </Card>

          <div className="bg-blue-50 border border-blue-100 p-6 rounded-3xl flex flex-col justify-center gap-3 dark:bg-blue-900/10 dark:border-blue-900/20">
            <div className="flex items-center gap-2 text-blue-800 font-bold dark:text-blue-300">
              <AlertCircle size={20} />
              <p className="text-sm">Nota Operativa</p>
            </div>
            <p className="text-xs text-blue-700 leading-relaxed dark:text-blue-400">
              El fondo base se utiliza para el arqueo de caja diario. Un monto de <strong>$300.00</strong> es la recomendación estándar para operaciones de NexWay.
            </p>
          </div>
        </div>

        <Card className="border-none shadow-sm rounded-3xl bg-card overflow-hidden border">
          <CardHeader className="bg-slate-900 text-white p-6 dark:bg-slate-950">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="text-blue-400" size={20} />
              Estado de Módulos
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs">Habilite o deshabilite funcionalidades para todos los usuarios.</CardDescription>
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
      </div>
    </div>
  );
}
