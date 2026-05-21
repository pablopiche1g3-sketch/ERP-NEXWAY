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
  DollarSign
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useFirestore, useDoc } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';

export default function ManagementPage() {
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [cashFloat, setCashFloat] = useState<string>('0');

  // Referencias estables a documentos de configuración global
  const configRef = useMemo(() => doc(db, 'system', 'module_config'), [db]);
  const { data: config, loading: loadingConfig } = useDoc<any>(configRef);

  const cashConfigRef = useMemo(() => doc(db, 'system', 'cash_config'), [db]);
  const { data: cashConfig, loading: loadingCash } = useDoc<any>(cashConfigRef);

  // Sincronizar el estado local con la base de datos cuando los datos lleguen
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
      toast({ title: "Módulo Actualizado", description: `Estado cambiado exitosamente.` });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveCashFloat = async () => {
    if (!cashFloat || isNaN(parseFloat(cashFloat))) return;
    setIsSaving(true);
    try {
      await setDoc(cashConfigRef, { cashFloat: parseFloat(cashFloat) || 0 }, { merge: true });
      toast({ title: "Configuración Guardada", description: "El fondo base ha sido actualizado." });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Error al guardar el monto." });
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
              <CardTitle className="flex items-center gap-2 text-base">
                <Coins className="text-blue-400" size={20} />
                Fondo Base de Caja
              </CardTitle>
              <CardDescription className="text-slate-400 text-xs">Monto inicial diario sugerido.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {loadingCash ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : (
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
              )}
              <Button 
                onClick={handleSaveCashFloat} 
                disabled={isSaving || loadingCash}
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20"
              >
                {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" size={18} />}
                Establecer Fondo
              </Button>
            </CardContent>
          </Card>

          <div className="bg-blue-50 border border-blue-100 p-6 rounded-3xl flex flex-col justify-center gap-3 dark:bg-blue-900/10 dark:border-blue-900/20">
            <div className="flex items-center gap-2 text-blue-800 font-bold dark:text-blue-300">
              <AlertCircle size={20} />
              <p className="text-sm uppercase tracking-tight">Nota de Control</p>
            </div>
            <p className="text-xs text-blue-700 leading-relaxed dark:text-blue-400">
              El fondo base se utiliza para el cálculo automático de ventas reales en el **Arqueo de Caja**. Mantener un monto fijo ayuda a prevenir errores de cuadre.
            </p>
          </div>
        </div>

        <Card className="border-none shadow-sm rounded-3xl bg-card overflow-hidden border">
          <CardHeader className="bg-slate-900 text-white p-6 dark:bg-slate-950">
            <CardTitle className="flex items-center gap-2 text-base">
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
                    {loadingConfig ? (
                      <Skeleton className="h-6 w-11 rounded-full" />
                    ) : (
                      <>
                        {config?.[m.id] === false ? <Lock className="text-rose-500" size={16} /> : <Unlock className="text-emerald-500" size={16} />}
                        <Switch 
                          checked={config?.[m.id] !== false} 
                          onCheckedChange={(val) => handleToggleModule(m.id, val)}
                          disabled={isSaving}
                        />
                      </>
                    )}
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
