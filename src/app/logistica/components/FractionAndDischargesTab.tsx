'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Scissors, 
  ArrowDownCircle, 
  History, 
  Boxes, 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  Warehouse, 
  FileText, 
  Sparkles, 
  UserCheck,
  Calendar,
  Layers,
  Search,
  Filter
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/supabase/use-user';
import { fetchSystemAppUsers } from '@/lib/session-operator';

export interface SpecialDischargeRecord {
  id: string;
  type: 'FRACCIONAMIENTO' | 'MERMA' | 'USO_INTERNO' | 'MUESTRA' | 'AJUSTE';
  sku: string;
  name: string;
  quantity: number;
  resultingSku?: string;
  resultingName?: string;
  resultingQuantity?: number;
  warehouseId: string;
  warehouseName: string;
  reason: string;
  responsibleEmail: string;
  created_at: string;
}

export default function FractionAndDischargesTab() {
  const { toast } = useToast();
  const { user } = useUser();

  const [activeSubTab, setActiveSubTab] = useState<'fraccionar' | 'salidas' | 'historial'>('fraccionar');
  const [loading, setLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Datos del Sistema
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  const [appUsers, setAppUsers] = useState<any[]>([]);
  const [dischargesHistory, setDischargesHistory] = useState<SpecialDischargeRecord[]>([]);

  // 1. Estado para Fraccionamiento
  const [fracWarehouseId, setFracWarehouseId] = useState<string>('');
  const [parentSku, setParentSku] = useState<string>('');
  const [parentQty, setParentQty] = useState<number>(1);
  const [childSku, setChildSku] = useState<string>('');
  const [conversionRate, setConversionRate] = useState<number>(1); // Cuántas unidades hijas produce 1 unidad padre
  const [fracOperatorEmail, setFracOperatorEmail] = useState<string>('');

  // 2. Estado para Salidas Especiales / Mermas / Uso Interno
  const [dischargeWarehouseId, setDischargeWarehouseId] = useState<string>('');
  const [dischargeSku, setDischargeSku] = useState<string>('');
  const [dischargeQty, setDischargeQty] = useState<number>(1);
  const [dischargeType, setDischargeType] = useState<'MERMA' | 'USO_INTERNO' | 'MUESTRA' | 'AJUSTE'>('MERMA');
  const [dischargeReason, setDischargeReason] = useState<string>('');
  const [dischargeOperatorEmail, setDischargeOperatorEmail] = useState<string>('');

  // Cargar Datos Iniciales
  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Productos
      const { data: prods } = await supabase.from('inventory').select('*').order('name');
      setProducts(prods || []);

      // 2. Bodegas
      const { data: whs } = await supabase.from('warehouses').select('*').order('name');
      setWarehouses(whs || []);
      if (whs && whs.length > 0) {
        if (!fracWarehouseId) setFracWarehouseId(whs[0].id);
        if (!dischargeWarehouseId) setDischargeWarehouseId(whs[0].id);
      }

      // 3. Usuarios
      const users = await fetchSystemAppUsers();
      setAppUsers(users);
      if (user?.email) {
        setFracOperatorEmail(user.email);
        setDischargeOperatorEmail(user.email);
      }

      // 4. Historial de Salidas / Fraccionamientos
      const { data: histConfig } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'inventory_special_discharges')
        .maybeSingle();

      if (histConfig?.value && Array.isArray(histConfig.value)) {
        setDischargesHistory(histConfig.value);
      }

    } catch (e: any) {
      console.error('Error cargando datos de fraccionamiento:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Cargar Stock de la bodega activa
  const fetchStock = async (whId: string) => {
    if (!whId) return;
    const { data: stocks } = await supabase
      .from('inventory_stock')
      .select('sku, quantity')
      .eq('warehouse_id', whId);

    const map: Record<string, number> = {};
    (stocks || []).forEach(s => {
      map[s.sku] = parseFloat(s.quantity) || 0;
    });
    setStockMap(map);
  };

  useEffect(() => {
    if (activeSubTab === 'fraccionar') {
      fetchStock(fracWarehouseId);
    } else if (activeSubTab === 'salidas') {
      fetchStock(dischargeWarehouseId);
    }
  }, [activeSubTab, fracWarehouseId, dischargeWarehouseId]);

  // Cálculos de Fraccionamiento
  const parentProduct = useMemo(() => products.find(p => p.sku === parentSku), [products, parentSku]);
  const childProduct = useMemo(() => products.find(p => p.sku === childSku), [products, childSku]);
  const parentAvailableStock = useMemo(() => stockMap[parentSku] || 0, [stockMap, parentSku]);
  const resultingUnitsTotal = useMemo(() => parentQty * conversionRate, [parentQty, conversionRate]);
  const canFraction = useMemo(() => {
    return parentProduct && childProduct && parentSku !== childSku && parentQty > 0 && conversionRate > 0 && parentAvailableStock >= parentQty;
  }, [parentProduct, childProduct, parentSku, childSku, parentQty, conversionRate, parentAvailableStock]);

  // Cálculos de Salidas Especiales
  const dischargeProduct = useMemo(() => products.find(p => p.sku === dischargeSku), [products, dischargeSku]);
  const dischargeAvailableStock = useMemo(() => stockMap[dischargeSku] || 0, [stockMap, dischargeSku]);
  const canDischarge = useMemo(() => {
    return dischargeProduct && dischargeQty > 0 && dischargeReason.trim().length > 3 && dischargeAvailableStock >= dischargeQty;
  }, [dischargeProduct, dischargeQty, dischargeReason, dischargeAvailableStock]);

  // ✂️ EJECUTAR FRACCIONAMIENTO DE INVENTARIO
  const handleExecuteFraction = async () => {
    if (!canFraction || !parentProduct || !childProduct || !fracWarehouseId) {
      toast({
        variant: 'destructive',
        title: 'Datos incompletos o stock insuficiente',
        description: 'Verifique que haya suficiente stock del producto matriz.'
      });
      return;
    }

    setIsProcessing(true);
    const wh = warehouses.find(w => w.id === fracWarehouseId);
    const correlative = `FRAC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    try {
      // 1. Descontar Producto Matriz
      const newParentStock = parentAvailableStock - parentQty;
      await supabase.from('inventory_stock').upsert({
        sku: parentSku,
        warehouse_id: fracWarehouseId,
        quantity: newParentStock
      }, { onConflict: 'sku,warehouse_id' });

      await supabase.from('kardex').insert({
        sku: parentSku,
        movement_type: 'FRACCIONAMIENTO_ORIGEN',
        location: wh?.name || 'Bodega',
        document_ref: correlative,
        qty_in: 0,
        qty_out: parentQty,
        balance: newParentStock,
        unit_cost: parseFloat(parentProduct.cost) || parseFloat(parentProduct.price) || 0
      });

      // 2. Ingresar Producto Fraccionado
      const currentChildStock = stockMap[childSku] || 0;
      const newChildStock = currentChildStock + resultingUnitsTotal;
      const childUnitCost = ((parseFloat(parentProduct.cost) || parseFloat(parentProduct.price) || 0) * parentQty) / resultingUnitsTotal;

      await supabase.from('inventory_stock').upsert({
        sku: childSku,
        warehouse_id: fracWarehouseId,
        quantity: newChildStock
      }, { onConflict: 'sku,warehouse_id' });

      await supabase.from('kardex').insert({
        sku: childSku,
        movement_type: 'FRACCIONAMIENTO_DESTINO',
        location: wh?.name || 'Bodega',
        document_ref: correlative,
        qty_in: resultingUnitsTotal,
        qty_out: 0,
        balance: newChildStock,
        unit_cost: childUnitCost
      });

      // 3. Registrar en Historial
      const newRecord: SpecialDischargeRecord = {
        id: correlative,
        type: 'FRACCIONAMIENTO',
        sku: parentSku,
        name: parentProduct.name,
        quantity: parentQty,
        resultingSku: childSku,
        resultingName: childProduct.name,
        resultingQuantity: resultingUnitsTotal,
        warehouseId: fracWarehouseId,
        warehouseName: wh?.name || 'Bodega',
        reason: `Fraccionamiento de ${parentQty}x ${parentProduct.name} en ${resultingUnitsTotal}x ${childProduct.name}`,
        responsibleEmail: fracOperatorEmail || user?.email || 'Encargado de Bodega',
        created_at: new Date().toISOString()
      };

      const updatedHistory = [newRecord, ...dischargesHistory];
      await supabase.from('system_config').upsert({
        key: 'inventory_special_discharges',
        value: updatedHistory
      }, { onConflict: 'key' });

      setDischargesHistory(updatedHistory);
      await fetchStock(fracWarehouseId);

      // Limpiar Formulario
      setParentQty(1);
      setConversionRate(1);

      toast({
        title: '¡Fraccionamiento Ejecutado! ✂️',
        description: `Se descargaron ${parentQty}x ${parentProduct.name} e ingresaron ${resultingUnitsTotal}x ${childProduct.name}.`
      });

    } catch (e: any) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error en fraccionamiento', description: e.message });
    } finally {
      setIsProcessing(false);
    }
  };

  // 📤 EJECUTAR SALIDA ESPECIAL / MERMA / USO INTERNO
  const handleExecuteDischarge = async () => {
    if (!canDischarge || !dischargeProduct || !dischargeWarehouseId) {
      toast({
        variant: 'destructive',
        title: 'Verifique los campos',
        description: 'Asegúrese de ingresar una justificación válida y verificar el stock disponible.'
      });
      return;
    }

    setIsProcessing(true);
    const wh = warehouses.find(w => w.id === dischargeWarehouseId);
    const correlative = `SAL-${dischargeType.slice(0, 3)}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    try {
      // 1. Descontar Producto de Bodega
      const newStock = dischargeAvailableStock - dischargeQty;
      await supabase.from('inventory_stock').upsert({
        sku: dischargeSku,
        warehouse_id: dischargeWarehouseId,
        quantity: newStock
      }, { onConflict: 'sku,warehouse_id' });

      const movementLabel = dischargeType === 'MERMA' 
        ? 'SALIDA_MERMA' 
        : dischargeType === 'USO_INTERNO' 
        ? 'USO_INTERNO' 
        : dischargeType === 'MUESTRA' 
        ? 'MUESTRA_COMERCIAL' 
        : 'AJUSTE_INVENTARIO';

      await supabase.from('kardex').insert({
        sku: dischargeSku,
        movement_type: movementLabel,
        location: wh?.name || 'Bodega',
        document_ref: correlative,
        qty_in: 0,
        qty_out: dischargeQty,
        balance: newStock,
        unit_cost: parseFloat(dischargeProduct.cost) || parseFloat(dischargeProduct.price) * 0.7 || 0
      });

      // 2. Registrar en Historial
      const newRecord: SpecialDischargeRecord = {
        id: correlative,
        type: dischargeType,
        sku: dischargeSku,
        name: dischargeProduct.name,
        quantity: dischargeQty,
        warehouseId: dischargeWarehouseId,
        warehouseName: wh?.name || 'Bodega',
        reason: dischargeReason.trim(),
        responsibleEmail: dischargeOperatorEmail || user?.email || 'Encargado de Bodega',
        created_at: new Date().toISOString()
      };

      const updatedHistory = [newRecord, ...dischargesHistory];
      await supabase.from('system_config').upsert({
        key: 'inventory_special_discharges',
        value: updatedHistory
      }, { onConflict: 'key' });

      setDischargesHistory(updatedHistory);
      await fetchStock(dischargeWarehouseId);

      // Limpiar Formulario
      setDischargeQty(1);
      setDischargeReason('');

      toast({
        title: 'Salida de Inventario Registrada 📤',
        description: `Se dio de baja ${dischargeQty} unidades de "${dischargeProduct.name}" (${dischargeType}).`
      });

    } catch (e: any) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error en salida de inventario', description: e.message });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 text-white p-4 rounded-3xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-2xl">
            <Scissors size={26} />
          </div>
          <div>
            <h3 className="text-base font-black tracking-tight">Fraccionamiento & Salidas Especiales</h3>
            <p className="text-xs text-slate-400">Subdivisión de unidades, mermas, muestras y consumos de uso interno.</p>
          </div>
        </div>
      </div>

      <Tabs value={activeSubTab} onValueChange={(v: any) => setActiveSubTab(v)} className="space-y-4">
        <TabsList className="bg-muted p-1 rounded-2xl">
          <TabsTrigger value="fraccionar" className="rounded-xl text-xs font-bold gap-1.5">
            <Scissors size={14} /> Fraccionamiento & Despiece
          </TabsTrigger>
          <TabsTrigger value="salidas" className="rounded-xl text-xs font-bold gap-1.5">
            <ArrowDownCircle size={14} /> Salidas Especiales / Mermas
          </TabsTrigger>
          <TabsTrigger value="historial" className="rounded-xl text-xs font-bold gap-1.5">
            <History size={14} /> Historial de Movimientos ({dischargesHistory.length})
          </TabsTrigger>
        </TabsList>

        {/* ─── PESTAÑA 1: FRACCIONAMIENTO Y DESPIECE ─────────────────── */}
        <TabsContent value="fraccionar" className="space-y-6 outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Panel de Configuración de Fraccionamiento */}
            <Card className="rounded-3xl border shadow-sm p-5 space-y-5 lg:col-span-2 bg-card">
              <div className="space-y-1">
                <h4 className="text-sm font-black flex items-center gap-1.5">
                  <Scissors size={16} className="text-indigo-500" /> Conversión de Unidad Matriz a Unidades Menores
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Transforma unidades mayores (Cajas, Rollos, Tambores, Sacos) en unidades fraccionadas para venta individual.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Bodega de Operación</Label>
                  <Select value={fracWarehouseId} onValueChange={setFracWarehouseId}>
                    <SelectTrigger className="rounded-xl font-bold text-xs h-10">
                      <SelectValue placeholder="Seleccione bodega..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      {warehouses.map(w => (
                        <SelectItem key={w.id} value={w.id} className="text-xs font-bold">
                          {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-2xl border">
                  {/* Origen: Matriz */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs font-black uppercase text-indigo-500">1. Producto Matriz (Origen)</Label>
                      {parentProduct && (
                        <span className="text-[11px] font-mono font-bold text-muted-foreground">
                          Stock: {parentAvailableStock}
                        </span>
                      )}
                    </div>
                    <Select value={parentSku} onValueChange={setParentSku}>
                      <SelectTrigger className="rounded-xl font-bold text-xs h-10 bg-background">
                        <SelectValue placeholder="Seleccionar producto matriz..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl max-h-56">
                        {products.map(p => (
                          <SelectItem key={p.sku} value={p.sku} className="text-xs font-bold">
                            {p.name} ({p.sku})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold">Cantidad a Fraccionar</Label>
                      <Input
                        type="number"
                        min={1}
                        max={parentAvailableStock || 1}
                        value={parentQty}
                        onChange={e => setParentQty(Math.max(1, parseInt(e.target.value) || 1))}
                        className="h-10 rounded-xl font-black text-sm bg-background"
                      />
                    </div>
                  </div>

                  {/* Destino: Fraccionado */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs font-black uppercase text-emerald-600 dark:text-emerald-400">2. Producto Resultante (Destino)</Label>
                      {childProduct && (
                        <span className="text-[11px] font-mono font-bold text-muted-foreground">
                          Stock actual: {stockMap[childSku] || 0}
                        </span>
                      )}
                    </div>
                    <Select value={childSku} onValueChange={setChildSku}>
                      <SelectTrigger className="rounded-xl font-bold text-xs h-10 bg-background">
                        <SelectValue placeholder="Seleccionar producto unitario..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl max-h-56">
                        {products.filter(p => p.sku !== parentSku).map(p => (
                          <SelectItem key={p.sku} value={p.sku} className="text-xs font-bold">
                            {p.name} ({p.sku})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold">Factor de Conversión (Unidades por cada Matriz)</Label>
                      <Input
                        type="number"
                        min={1}
                        placeholder="Ej: 24 (si una caja trae 24 unds)"
                        value={conversionRate}
                        onChange={e => setConversionRate(Math.max(1, parseFloat(e.target.value) || 1))}
                        className="h-10 rounded-xl font-black text-sm bg-background"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Responsable de Operación</Label>
                  <Select value={fracOperatorEmail} onValueChange={setFracOperatorEmail}>
                    <SelectTrigger className="rounded-xl font-bold text-xs h-10">
                      <SelectValue placeholder="Seleccione colaborador..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      {appUsers.map(u => (
                        <SelectItem key={u.email} value={u.email} className="text-xs font-bold">
                          {u.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleExecuteFraction}
                  disabled={!canFraction || isProcessing}
                  className="w-full h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                >
                  {isProcessing ? <Loader2 size={16} className="animate-spin mr-2" /> : <Scissors size={16} className="mr-2" />}
                  ✂️ Confirmar Fraccionamiento en Bodega
                </Button>
              </div>
            </Card>

            {/* Resumen de Conversión */}
            <Card className="rounded-3xl border shadow-sm p-5 space-y-4 lg:col-span-1 bg-card flex flex-col justify-between">
              <div className="space-y-3">
                <h4 className="text-sm font-black flex items-center gap-1.5">
                  <Sparkles size={16} className="text-indigo-500" /> Resumen de Conversión
                </h4>
                <p className="text-[11px] text-muted-foreground">Validación de existencias y resultado físico.</p>

                <div className="p-4 bg-muted/40 rounded-2xl border space-y-3 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Descarga Física Matriz</span>
                    <p className="text-sm font-black text-rose-500 font-mono">
                      -{parentQty} {parentProduct ? parentProduct.name : 'Unidades'}
                    </p>
                  </div>

                  <div className="pt-2 border-t">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Ingreso Físico Fraccionado</span>
                    <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">
                      +{resultingUnitsTotal} {childProduct ? childProduct.name : 'Fracciones'}
                    </p>
                  </div>

                  <div className="pt-2 border-t flex justify-between items-center text-[11px]">
                    <span className="text-muted-foreground">Stock Matriz Disponible:</span>
                    <strong className={`font-mono ${parentAvailableStock >= parentQty ? 'text-foreground' : 'text-rose-500'}`}>
                      {parentAvailableStock} unds
                    </strong>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-[11px] text-indigo-700 dark:text-indigo-300">
                💡 <strong>Nota Contable:</strong> El costo del producto matriz se divide proporcionalmente entre las unidades resultantes para mantener el Kardex 100% valorizado.
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* ─── PESTAÑA 2: SALIDAS ESPECIALES & MERMAS ─────────────────── */}
        <TabsContent value="salidas" className="space-y-6 outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="rounded-3xl border shadow-sm p-5 space-y-5 lg:col-span-2 bg-card">
              <div className="space-y-1">
                <h4 className="text-sm font-black flex items-center gap-1.5">
                  <ArrowDownCircle size={16} className="text-rose-500" /> Registro de Salida Especial / Baja de Mercadería
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Registra mermas, productos vencidos, muestras comerciales y consumo de uso interno con justificación formal.
                </p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Bodega Origen</Label>
                    <Select value={dischargeWarehouseId} onValueChange={setDischargeWarehouseId}>
                      <SelectTrigger className="rounded-xl font-bold text-xs h-10">
                        <SelectValue placeholder="Seleccione bodega..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl">
                        {warehouses.map(w => (
                          <SelectItem key={w.id} value={w.id} className="text-xs font-bold">
                            {w.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Tipo de Salida / Motivo</Label>
                    <Select value={dischargeType} onValueChange={(v: any) => setDischargeType(v)}>
                      <SelectTrigger className="rounded-xl font-bold text-xs h-10">
                        <SelectValue placeholder="Seleccione tipo..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl">
                        <SelectItem value="MERMA" className="text-xs font-bold text-rose-500">
                          🥀 Merma / Producto Dañado / Vencido
                        </SelectItem>
                        <SelectItem value="USO_INTERNO" className="text-xs font-bold text-indigo-500">
                          🏢 Uso Interno / Consumo Propio
                        </SelectItem>
                        <SelectItem value="MUESTRA" className="text-xs font-bold text-blue-500">
                          🎁 Muestra Comercial a Clientes
                        </SelectItem>
                        <SelectItem value="AJUSTE" className="text-xs font-bold text-amber-500">
                          ⚙️ Ajuste por Faltante de Inventario
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 space-y-1.5">
                    <Label className="text-xs font-bold">Producto a Descargar</Label>
                    <Select value={dischargeSku} onValueChange={setDischargeSku}>
                      <SelectTrigger className="rounded-xl font-bold text-xs h-10">
                        <SelectValue placeholder="Seleccione producto..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl max-h-56">
                        {products.map(p => (
                          <SelectItem key={p.sku} value={p.sku} className="text-xs font-bold">
                            {p.name} ({p.sku})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Cantidad a Bajar</Label>
                    <Input
                      type="number"
                      min={1}
                      max={dischargeAvailableStock || 1}
                      value={dischargeQty}
                      onChange={e => setDischargeQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="h-10 rounded-xl font-black text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Justificación / Motivo Detallado (Obligatorio)</Label>
                  <Textarea
                    placeholder="Especifique el motivo de la baja, número de lote afectado o destino del producto..."
                    value={dischargeReason}
                    onChange={e => setDischargeReason(e.target.value)}
                    className="rounded-2xl text-xs min-h-[80px]"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Colaborador / Autorizador</Label>
                  <Select value={dischargeOperatorEmail} onValueChange={setDischargeOperatorEmail}>
                    <SelectTrigger className="rounded-xl font-bold text-xs h-10">
                      <SelectValue placeholder="Seleccione colaborador..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      {appUsers.map(u => (
                        <SelectItem key={u.email} value={u.email} className="text-xs font-bold">
                          {u.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleExecuteDischarge}
                  disabled={!canDischarge || isProcessing}
                  className="w-full h-12 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-lg shadow-rose-600/20 disabled:opacity-50"
                >
                  {isProcessing ? <Loader2 size={16} className="animate-spin mr-2" /> : <ArrowDownCircle size={16} className="mr-2" />}
                  📤 Confirmar Salida y Descarga en Kardex
                </Button>
              </div>
            </Card>

            <Card className="rounded-3xl border shadow-sm p-5 space-y-4 lg:col-span-1 bg-card flex flex-col justify-between">
              <div className="space-y-3">
                <h4 className="text-sm font-black flex items-center gap-1.5">
                  <FileText size={16} className="text-rose-500" /> Resumen de Descarga
                </h4>
                <p className="text-[11px] text-muted-foreground">Impacto en Kardex y existencias físicas.</p>

                <div className="p-4 bg-muted/40 rounded-2xl border space-y-3 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Producto Afectado</span>
                    <p className="text-sm font-black text-foreground">
                      {dischargeProduct ? dischargeProduct.name : 'Ninguno seleccionado'}
                    </p>
                    <span className="text-[10px] font-mono text-muted-foreground">{dischargeSku || '---'}</span>
                  </div>

                  <div className="pt-2 border-t">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Cantidad de Baja</span>
                    <p className="text-lg font-black text-rose-500 font-mono">
                      -{dischargeQty} Unidades
                    </p>
                  </div>

                  <div className="pt-2 border-t flex justify-between items-center text-[11px]">
                    <span className="text-muted-foreground">Disponible Actual:</span>
                    <strong className={`font-mono ${dischargeAvailableStock >= dischargeQty ? 'text-foreground' : 'text-rose-500'}`}>
                      {dischargeAvailableStock} unds
                    </strong>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-[11px] text-rose-700 dark:text-rose-300">
                ⚠️ <strong>Auditoría Permanente:</strong> Todas las salidas por merma y uso interno quedan registradas en el Kardex y en el log de auditoría del sistema.
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* ─── PESTAÑA 3: HISTORIAL DE SALIDAS Y FRACCIONAMIENTOS ──────── */}
        <TabsContent value="historial" className="space-y-4 outline-none">
          <Card className="rounded-3xl border shadow-sm overflow-hidden bg-card">
            <Table className="text-xs">
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="font-bold">ID / Documento</TableHead>
                  <TableHead className="font-bold">Fecha / Hora</TableHead>
                  <TableHead className="font-bold">Tipo de Operación</TableHead>
                  <TableHead className="font-bold">Producto Origen</TableHead>
                  <TableHead className="text-center font-bold">Cantidad</TableHead>
                  <TableHead className="font-bold">Resultado / Motivo</TableHead>
                  <TableHead className="text-center font-bold">Bodega</TableHead>
                  <TableHead className="font-bold">Responsable</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dischargesHistory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground italic">
                      No hay registros de fraccionamientos o salidas especiales aún.
                    </TableCell>
                  </TableRow>
                ) : (
                  dischargesHistory.map(rec => (
                    <TableRow key={rec.id}>
                      <TableCell className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {rec.id}
                      </TableCell>
                      <TableCell>{new Date(rec.created_at).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge className={`border-0 text-[9px] font-black ${
                          rec.type === 'FRACCIONAMIENTO' 
                            ? 'bg-indigo-500/20 text-indigo-500' 
                            : rec.type === 'MERMA' 
                            ? 'bg-rose-500/20 text-rose-500'
                            : rec.type === 'USO_INTERNO'
                            ? 'bg-purple-500/20 text-purple-500'
                            : 'bg-blue-500/20 text-blue-500'
                        }`}>
                          {rec.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <p className="font-bold text-foreground">{rec.name}</p>
                        <span className="text-[10px] text-muted-foreground font-mono">{rec.sku}</span>
                      </TableCell>
                      <TableCell className="text-center font-mono font-bold">
                        {rec.quantity} unds
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {rec.resultingName ? (
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            ➔ {rec.resultingQuantity}x {rec.resultingName}
                          </span>
                        ) : (
                          rec.reason
                        )}
                      </TableCell>
                      <TableCell className="text-center">{rec.warehouseName}</TableCell>
                      <TableCell className="text-muted-foreground">{rec.responsibleEmail}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
