
'use client';

import React, { useMemo, useState } from 'react';
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
  Database,
  Sparkles
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useFirestore, useDoc } from '@/firebase';
import { doc, setDoc, collection, addDoc, getDocs, query, limit } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

export default function ManagementPage() {
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [cashFloat, setCashFloat] = useState<string>('300'); // Por defecto 300 solicitado

  // Configuración de módulos
  const configRef = useMemo(() => doc(db, 'system', 'module_config'), [db]);
  const { data: config, loading: loadingConfig } = useDoc<any>(configRef);

  // Configuración de caja (Fondo Base)
  const cashConfigRef = useMemo(() => doc(db, 'system', 'cash_config'), [db]);
  const { data: cashConfig, loading: loadingCash } = useDoc<any>(cashConfigRef);

  // Inicializar el input de cashFloat cuando carguen los datos
  React.useEffect(() => {
    if (cashConfig?.cashFloat !== undefined) {
      setCashFloat(cashConfig.cashFloat.toString());
    } else {
      // Si no existe, forzamos el set de 300 inicial solicitado
      setDoc(cashConfigRef, { cashFloat: 300 }, { merge: true });
    }
  }, [cashConfig, cashConfigRef]);

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

  const handleSeedData = async () => {
    setIsSaving(true);
    try {
      // 1. Verificar si ya hay datos para evitar duplicados masivos
      const invCheck = await getDocs(query(collection(db, 'inventory'), limit(1)));
      if (!invCheck.empty) {
        const confirm = window.confirm("Ya existen datos en el sistema. ¿Desea agregar registros demo adicionales?");
        if (!confirm) {
          setIsSaving(false);
          return;
        }
      }

      // 2. Poblar Inventario Maestro
      const invRef = collection(db, 'inventory');
      const products = [
        { sku: 'ACE-5W30', name: 'Aceite Sintético Motul 5W30 (Galeón)', price: 48.50, quantity: 24, category: 'Lubricantes' },
        { sku: 'BAT-L3', name: 'Batería Bosch S5 12V 70Ah', price: 135.00, quantity: 15, category: 'Eléctrico' },
        { sku: 'LLAN-R17', name: 'Llanta Bridgestone Dueler 265/65R17', price: 185.00, quantity: 12, category: 'Llantas' },
        { sku: 'FRE-SET', name: 'Set de Pastillas Cerámicas (Delanteras)', price: 42.00, quantity: 30, category: 'Frenos' },
        { sku: 'FIL-OIL', name: 'Filtro de Aceite Premium High-Flow', price: 8.75, quantity: 100, category: 'Filtros' }
      ];
      for (const p of products) await addDoc(invRef, { ...p, createdAt: new Date().toISOString() });

      // 3. Poblar Clientes
      const custRef = collection(db, 'customers');
      const clients = [
        { name: 'Talleres El Salvador S.A.', type: 'Empresa', category: 'Crédito Fiscal', nit: '0614-123456-101-1', nrc: '45678-9', email: 'admin@talleressv.com', phone: '2222-3333' },
        { name: 'Ministerio de Obras Públicas (MOP)', type: 'Empresa', category: 'Crédito Fiscal', nit: '0511-010101-001-0', nrc: '111-2', email: 'uaci@mop.gob.sv', phone: '2525-0000' },
        { name: 'María Eugenia Rivas', type: 'Individual', category: 'Consumidor Final', nit: '0614-150588-102-5', email: 'maria.rivas@gmail.com', phone: '7878-9999' }
      ];
      for (const c of clients) await addDoc(custRef, { ...c, createdAt: new Date().toISOString() });

      // 4. Poblar Proveedores
      const suppRef = collection(db, 'suppliers');
      const vendors = [
        { name: 'Importadora Automotriz S.A.', nit: '0614-998877-001-5', nrc: '987-0', applyRetention: true, applyPerception: false, email: 'ventas@importadora.com' },
        { name: 'Logística Regional Express', nit: '0614-111222-003-1', nrc: '321-4', applyRetention: false, applyPerception: false, email: 'operaciones@logex.com' }
      ];
      for (const v of vendors) await addDoc(suppRef, { ...v, createdAt: new Date().toISOString() });

      // 5. Proyecto Institucional Demo
      const projRef = collection(db, 'institutional_projects');
      await addDoc(projRef, {
        name: 'Mantenimiento Flota Gubernamental 2024',
        customerName: 'Ministerio de Obras Públicas (MOP)',
        customerId: 'demo-id',
        status: 'ACTIVO',
        description: 'Contrato para suministro de lubricantes y repuestos para vehículos pesados.',
        createdAt: new Date().toISOString()
      });

      toast({ 
        title: "Sistema Inicializado", 
        description: "Se han cargado productos, clientes, proveedores y un proyecto demo. Fondo base: $300." 
      });

    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Error", description: "No se pudieron sembrar los datos demo." });
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
    { id: 'billing', label: 'Módulo de Facturación', desc: 'Ventas, cobros y estado de cuenta' },
    { id: 'purchases', label: 'Registro de Compras', desc: 'Ingreso de mercadería al sistema' },
    { id: 'suppliers', label: 'Directorio de Proveedores', desc: 'Base de datos de suministrantes' },
    { id: 'quedan', label: 'Gestión de Quedan', desc: 'Control de pagos a proveedores' },
    { id: 'quotations', label: 'Módulo de Cotizaciones', desc: 'Generación de presupuestos' },
    { id: 'transfers', label: 'Traslados', desc: 'Movimientos entre bodegas' },
    { id: 'customers', label: 'Registro de Clientes', desc: 'Cartera de contribuyentes' },
    { id: 'inventory', label: 'Inventario Maestro', desc: 'Códigos y control de stock' },
    { id: 'institutional', label: 'Módulo Institucional', desc: 'Perfil legal e identidad de la empresa' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="rounded-full bg-white shadow-sm" onClick={() => router.push('/')}>
            <ArrowLeft className="text-slate-600" size={20} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Gerencia y Control</h1>
            <p className="text-slate-500 text-sm">Configuración de seguridad y parámetros financieros</p>
          </div>
        </div>
        <Button 
          variant="outline" 
          className="rounded-xl border-blue-200 bg-blue-50 text-blue-700 font-bold hover:bg-blue-100 transition-all h-10 px-6"
          onClick={handleSeedData}
          disabled={isSaving}
        >
          <Sparkles className="mr-2" size={16} /> 
          Sembrar Datos Demo
        </Button>
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
            <CardHeader className="bg-slate-900 text-white p-6">
              <CardTitle className="flex items-center gap-2 text-base">
                <Coins className="text-blue-400" size={20} />
                Fondo Base de Caja
              </CardTitle>
              <CardDescription className="text-slate-400 text-xs">
                Monto inicial en efectivo para cambio diario.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">Monto del Fondo ($)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <Input 
                    type="number" 
                    placeholder="0.00" 
                    value={cashFloat}
                    onChange={(e) => setCashFloat(e.target.value)}
                    className="h-12 pl-10 text-xl font-bold bg-slate-50 rounded-xl"
                  />
                </div>
              </div>
              <Button 
                onClick={handleSaveCashFloat} 
                disabled={isSaving}
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl"
              >
                {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" size={18} />}
                Establecer Fondo Base
              </Button>
            </CardContent>
          </Card>

          <div className="bg-blue-50 border border-blue-100 p-6 rounded-3xl flex flex-col justify-center gap-3">
            <div className="flex items-center gap-2 text-blue-800 font-bold">
              <AlertCircle size={20} />
              <p className="text-sm">Control de Seguridad</p>
            </div>
            <p className="text-xs text-blue-700 leading-relaxed">
              El <strong>Fondo Base</strong> es el dinero que el empleado recibe al iniciar el día. Actualmente configurado en <strong>${parseFloat(cashFloat).toFixed(2)}</strong>. Este monto es la base para el arqueo automático.
            </p>
          </div>
        </div>

        <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
          <CardHeader className="bg-slate-900 text-white p-6">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="text-blue-400" size={20} />
              Control de Accesos a Módulos
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs">
              Active o desactive los módulos operativos de la terminal.
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
      </div>
    </div>
  );
}
