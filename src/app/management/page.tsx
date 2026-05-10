
'use client';

import React, { useMemo, useState } from 'react';
import { 
  ShieldCheck, 
  ArrowLeft, 
  Lock, 
  Unlock, 
  Save,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useFirestore, useDoc } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

export default function ManagementPage() {
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const configRef = useMemo(() => doc(db, 'system', 'module_config'), [db]);
  const { data: config, loading } = useDoc<any>(configRef);

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  const modules = [
    { id: 'billing', label: 'Módulo de Facturación', desc: 'Ventas, cobros y estado de cuenta' },
    { id: 'purchases', label: 'Registro de Compras', desc: 'Ingreso de mercadería al sistema' },
    { id: 'suppliers', label: 'Directorio de Proveedores', desc: 'Base de datos de suministrantes' },
    { id: 'quedan', label: 'Gestión de Quedan', desc: 'Control de pagos a proveedores' },
    { id: 'quotations', label: 'Módulo de Cotizaciones', desc: 'Generación de presupuestos' },
    { id: 'transfers', label: 'Traslados', desc: 'Movimientos entre bodegas' },
    { id: 'customers', label: 'Registro de Clientes', desc: 'Cartera de contribuyentes' },
    { id: 'inventory', label: 'Inventario Maestro', desc: 'Códigos y control de stock' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="rounded-full bg-white shadow-sm" onClick={() => router.push('/')}>
            <ArrowLeft className="text-slate-600" size={20} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Administración de Accesos</h1>
            <p className="text-slate-500 text-sm">Control central de módulos activos para usuarios</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
          <CardHeader className="bg-slate-900 text-white p-6">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="text-blue-400" />
              Consola de Permisos Globales
            </CardTitle>
            <CardDescription className="text-slate-400 italic">
              Desactive módulos para restringir su uso a nivel general en la terminal.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {modules.map((m) => (
                <div key={m.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="space-y-1">
                    <Label className="text-sm font-bold text-slate-900">{m.label}</Label>
                    <p className="text-xs text-slate-400">{m.desc}</p>
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

        <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex items-start gap-3">
          <AlertCircle className="text-blue-600 shrink-0 mt-0.5" size={18} />
          <p className="text-[11px] text-blue-700 leading-relaxed">
            <strong>Nota de Seguridad:</strong> Los cambios realizados en esta consola se aplican de forma inmediata en el panel principal. 
            Esta función permite que la gerencia limite la operatividad del sistema durante cierres de inventario o auditorías.
          </p>
        </div>
      </div>
    </div>
  );
}
