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
  Filter,
  Percent,
  DollarSign,
  TrendingUp,
  Tag,
  Factory,
  ShieldCheck,
  Info
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
  type: 'FRACCIONAMIENTO' | 'MERMA' | 'USO_INTERNO' | 'MUESTRA' | 'AJUSTE' | 'CONSUMO_PRODUCCION';
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
  flowType?: 'VENTA' | 'PRODUCCION';
  wasteQuantity?: number;
  unitCostResulting?: number;
  batchNumber?: string;
  expiryDate?: string;
  created_at: string;
}

interface ProductionRecipe {
  id: string;
  name: string;
  targetSku: string;
  targetName: string;
  yieldQuantity: number;
}

const COMMON_UNITS = [
  'Barril',
  'Tambor',
  'Saco',
  'Galón',
  'Litro',
  'Cuarto (1/4 Gal)',
  'Botella',
  'Kilogramo (Kg)',
  'Libra (Lb)',
  'Onza (Oz)',
  'Unidad',
  'Caja',
  'Paca'
];

function detectUnitFromName(name: string): string {
  const lower = (name || '').toLowerCase();
  if (lower.includes('barril')) return 'Barril';
  if (lower.includes('tambor')) return 'Tambor';
  if (lower.includes('saco')) return 'Saco';
  if (lower.includes('galon') || lower.includes('galón') || lower.includes('gl')) return 'Galón';
  if (lower.includes('litro') || lower.includes(' lt') || lower.includes('1l')) return 'Litro';
  if (lower.includes('cuarto') || lower.includes('1/4') || lower.includes('qt')) return 'Cuarto (1/4 Gal)';
  if (lower.includes('botella')) return 'Botella';
  if (lower.includes('kg') || lower.includes('kilo')) return 'Kilogramo (Kg)';
  if (lower.includes('lb') || lower.includes('libra')) return 'Libra (Lb)';
  if (lower.includes('oz') || lower.includes('onza')) return 'Onza (Oz)';
  if (lower.includes('caja') || lower.includes('cj')) return 'Caja';
  if (lower.includes('paca')) return 'Paca';
  return 'Unidad';
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
  const [history, setHistory] = useState<SpecialDischargeRecord[]>([]);
  const [recipes, setRecipes] = useState<ProductionRecipe[]>([]);
  const [operatorName, setOperatorName] = useState<string>('');

  // Formulario Fraccionamiento
  const [fractionFlow, setFractionFlow] = useState<'VENTA' | 'PRODUCCION'>('VENTA');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [sourceSku, setSourceSku] = useState<string>('');
  const [sourceQuantity, setSourceQuantity] = useState<string>('1');
  const [sourceUnit, setSourceUnit] = useState<string>('Barril');
  
  const [destinationSku, setDestinationSku] = useState<string>('');
  const [targetUnit, setTargetUnit] = useState<string>('Galón');
  const [conversionFactor, setConversionFactor] = useState<string>('55');
  
  // Producción vinculada
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>('');

  // Manejo de Merma
  const [applyWaste, setApplyWaste] = useState<boolean>(false);
  const [wasteType, setWasteType] = useState<'PERCENT' | 'FIXED'>('PERCENT');
  const [wasteValue, setWasteValue] = useState<string>('0');

  // Trazabilidad
  const [batchNumber, setBatchNumber] = useState<string>('');
  const [expiryDate, setExpiryDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Formulario Salidas Especiales
  const [dischargeType, setDischargeType] = useState<'MERMA' | 'USO_INTERNO' | 'MUESTRA' | 'AJUSTE'>('MERMA');
  const [dischargeSku, setDischargeSku] = useState<string>('');
  const [dischargeQuantity, setDischargeQuantity] = useState<string>('1');
  const [dischargeReason, setDischargeReason] = useState<string>('');

  // Filtros Historial
  const [historyFilterType, setHistoryFilterType] = useState<string>('ALL');
  const [historySearch, setHistorySearch] = useState<string>('');

  // Carga inicial
  useEffect(() => {
    loadData();
    resolveActiveOperator();
  }, []);

  const resolveActiveOperator = async () => {
    try {
      const storedOperator = typeof window !== 'undefined' ? localStorage.getItem('nexway_session_operator') : null;
      if (storedOperator) {
        const parsed = JSON.parse(storedOperator);
        if (parsed?.full_name || parsed?.name || parsed?.email) {
          setOperatorName(parsed.full_name || parsed.name || parsed.email);
          return;
        }
      }
      const appUsers = await fetchSystemAppUsers();
      if (user?.email) {
        const matched = appUsers.find(u => u.email?.toLowerCase() === user.email?.toLowerCase());
        if (matched?.full_name) {
          setOperatorName(matched.full_name);
          return;
        }
        setOperatorName(user.email);
      }
    } catch (e) {
      if (user?.email) setOperatorName(user.email);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Cargar productos
      const { data: prods, error: pErr } = await supabase
        .from('products')
        .select('*')
        .order('name');
      if (pErr) throw pErr;
      setProducts(prods || []);

      // 2. Cargar bodegas
      const { data: whs, error: wErr } = await supabase
        .from('warehouses')
        .select('*')
        .order('name');
      if (wErr) throw wErr;
      setWarehouses(whs || []);
      if (whs && whs.length > 0 && !selectedWarehouseId) {
        setSelectedWarehouseId(whs[0].id);
      }

      // 3. Cargar recetas de producción
      const { data: recipeConf } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'production_recipes')
        .maybeSingle();
      if (recipeConf?.value && Array.isArray(recipeConf.value)) {
        setRecipes(recipeConf.value);
      }

      // 4. Cargar historial
      const { data: histConf } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'special_discharges_history')
        .maybeSingle();
      if (histConf?.value && Array.isArray(histConf.value)) {
        setHistory(histConf.value);
      }
    } catch (err: any) {
      console.error('Error cargando datos de logística:', err);
      toast({
        title: 'Error de Conexión',
        description: 'No se pudieron cargar los inventarios ni bodegas.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Autodetectar unidades al cambiar producto origen
  const handleSourceProductChange = (sku: string) => {
    setSourceSku(sku);
    const prod = products.find(p => p.sku === sku);
    if (prod) {
      const detected = detectUnitFromName(prod.name);
      setSourceUnit(detected);
    }
  };

  // Autodetectar unidades al cambiar producto destino
  const handleDestinationProductChange = (sku: string) => {
    setDestinationSku(sku);
    const prod = products.find(p => p.sku === sku);
    if (prod) {
      const detected = detectUnitFromName(prod.name);
      setTargetUnit(detected);
    }
  };

  // Cálculos reactivos de fraccionamiento
  const selectedSourceProduct = useMemo(() => {
    return products.find(p => p.sku === sourceSku);
  }, [products, sourceSku]);

  const selectedDestinationProduct = useMemo(() => {
    return products.find(p => p.sku === destinationSku);
  }, [products, destinationSku]);

  const parsedSourceQty = useMemo(() => {
    const val = parseFloat(sourceQuantity);
    return isNaN(val) || val <= 0 ? 0 : val;
  }, [sourceQuantity]);

  const parsedFactor = useMemo(() => {
    const val = parseFloat(conversionFactor);
    return isNaN(val) || val <= 0 ? 0 : val;
  }, [conversionFactor]);

  const parsedWasteVal = useMemo(() => {
    if (!applyWaste) return 0;
    const val = parseFloat(wasteValue);
    return isNaN(val) || val <= 0 ? 0 : val;
  }, [applyWaste, wasteValue]);

  // Cálculos de unidades
  const grossResultingUnits = useMemo(() => {
    return parsedSourceQty * parsedFactor;
  }, [parsedSourceQty, parsedFactor]);

  const calculatedWasteUnits = useMemo(() => {
    if (!applyWaste || parsedWasteVal <= 0 || grossResultingUnits <= 0) return 0;
    if (wasteType === 'PERCENT') {
      return (grossResultingUnits * parsedWasteVal) / 100;
    }
    return Math.min(grossResultingUnits, parsedWasteVal);
  }, [applyWaste, wasteType, parsedWasteVal, grossResultingUnits]);

  const netResultingUnits = useMemo(() => {
    return Math.max(0, grossResultingUnits - calculatedWasteUnits);
  }, [grossResultingUnits, calculatedWasteUnits]);

  // Cálculos de costos y márgenes
  const sourceUnitCost = useMemo(() => {
    return Number(selectedSourceProduct?.cost || 0);
  }, [selectedSourceProduct]);

  const totalSourceCost = useMemo(() => {
    return parsedSourceQty * sourceUnitCost;
  }, [parsedSourceQty, sourceUnitCost]);

  const unitCostResulting = useMemo(() => {
    if (netResultingUnits <= 0) return 0;
    return totalSourceCost / netResultingUnits;
  }, [totalSourceCost, netResultingUnits]);

  const destinationPrice = useMemo(() => {
    return Number(selectedDestinationProduct?.price || 0);
  }, [selectedDestinationProduct]);

  const projectedGrossMargin = useMemo(() => {
    if (destinationPrice <= 0 || unitCostResulting <= 0) return 0;
    return ((destinationPrice - unitCostResulting) / destinationPrice) * 100;
  }, [destinationPrice, unitCostResulting]);

  // Validaciones
  const currentSourceStock = Number(selectedSourceProduct?.stock || 0);
  const isStockInsufficient = parsedSourceQty > currentSourceStock;
  
  const canCalculate = useMemo(() => {
    if (!selectedSourceProduct) return false;
    if (fractionFlow === 'VENTA' && !selectedDestinationProduct) return false;
    if (fractionFlow === 'PRODUCCION' && !selectedRecipeId && !destinationSku) return false;
    if (parsedSourceQty <= 0) return false;
    if (parsedFactor <= 0) return false;
    return true;
  }, [selectedSourceProduct, fractionFlow, selectedDestinationProduct, selectedRecipeId, destinationSku, parsedSourceQty, parsedFactor]);

  const isFormValid = useMemo(() => {
    if (!canCalculate) return false;
    if (isStockInsufficient) return false;
    if (!selectedWarehouseId) return false;
    if (netResultingUnits <= 0) return false;
    return true;
  }, [canCalculate, isStockInsufficient, selectedWarehouseId, netResultingUnits]);

  // Procesar Fraccionamiento
  const handleExecuteFraction = async () => {
    if (!isFormValid || !selectedSourceProduct) return;

    setIsProcessing(true);
    try {
      const warehouse = warehouses.find(w => w.id === selectedWarehouseId);
      const warehouseName = warehouse?.name || 'Bodega Principal';

      // 1. Descontar producto origen (Matriz)
      const newSourceStock = Math.max(0, currentSourceStock - parsedSourceQty);
      const { error: srcErr } = await supabase
        .from('products')
        .update({ stock: newSourceStock })
        .eq('id', selectedSourceProduct.id);
      if (srcErr) throw srcErr;

      // 2. Registrar movimiento Kardex de Origen
      await supabase.from('kardex').insert({
        product_id: selectedSourceProduct.id,
        sku: selectedSourceProduct.sku,
        name: selectedSourceProduct.name,
        type: 'OUT',
        reason: fractionFlow === 'VENTA' 
          ? `FRACCIONAMIENTO_ORIGEN: Descarga de ${parsedSourceQty} ${sourceUnit}(s) para fraccionar en ${netResultingUnits.toFixed(2)} ${targetUnit}(s) de SKU ${destinationSku || selectedRecipeId}`
          : `CONSUMO_PRODUCCION_FRACCION: Descarga directa de ${parsedSourceQty} ${sourceUnit}(s) para orden de producción/fórmula ${selectedRecipeId}`,
        quantity: parsedSourceQty,
        cost: sourceUnitCost,
        total_cost: totalSourceCost,
        warehouse_id: selectedWarehouseId,
        responsible: operatorName || user?.email || 'Sistema',
        created_at: new Date().toISOString()
      });

      // 3. Manejar Destino según el Flujo
      if (fractionFlow === 'VENTA') {
        if (selectedDestinationProduct) {
          const currentDestStock = Number(selectedDestinationProduct.stock || 0);
          const newDestStock = currentDestStock + netResultingUnits;
          
          // Actualizar costo promedio ponderado si aplica, o mantener stock
          const { error: dstErr } = await supabase
            .from('products')
            .update({ 
              stock: newDestStock,
              cost: unitCostResulting > 0 ? unitCostResulting : selectedDestinationProduct.cost
            })
            .eq('id', selectedDestinationProduct.id);
          if (dstErr) throw dstErr;

          // Registrar entrada Kardex
          await supabase.from('kardex').insert({
            product_id: selectedDestinationProduct.id,
            sku: selectedDestinationProduct.sku,
            name: selectedDestinationProduct.name,
            type: 'IN',
            reason: `FRACCIONAMIENTO_DESTINO: Ingreso de ${netResultingUnits.toFixed(2)} ${targetUnit}(s) desde ${parsedSourceQty} ${sourceUnit}(s) de ${selectedSourceProduct.name}`,
            quantity: netResultingUnits,
            cost: unitCostResulting,
            total_cost: totalSourceCost - (calculatedWasteUnits * unitCostResulting),
            warehouse_id: selectedWarehouseId,
            responsible: operatorName || user?.email || 'Sistema',
            created_at: new Date().toISOString()
          });
        }
      }

      // 4. Si hubo merma, registrar asiento en Kardex
      if (calculatedWasteUnits > 0) {
        await supabase.from('kardex').insert({
          product_id: selectedSourceProduct.id,
          sku: selectedSourceProduct.sku,
          name: selectedSourceProduct.name,
          type: 'OUT',
          reason: `MERMA_FRACCIONAMIENTO: Pérdida de ${calculatedWasteUnits.toFixed(2)} ${targetUnit}(s) durante el proceso de fraccionamiento (${wasteType === 'PERCENT' ? `${wasteValue}%` : `${wasteValue} fijos`})`,
          quantity: calculatedWasteUnits,
          cost: unitCostResulting,
          total_cost: calculatedWasteUnits * unitCostResulting,
          warehouse_id: selectedWarehouseId,
          responsible: operatorName || user?.email || 'Sistema',
          created_at: new Date().toISOString()
        });
      }

      // 5. Guardar registro en historial de descargos especiales
      const newRecord: SpecialDischargeRecord = {
        id: `FRAC-${Date.now()}`,
        type: fractionFlow === 'VENTA' ? 'FRACCIONAMIENTO' : 'CONSUMO_PRODUCCION',
        sku: selectedSourceProduct.sku,
        name: selectedSourceProduct.name,
        quantity: parsedSourceQty,
        resultingSku: fractionFlow === 'VENTA' ? destinationSku : selectedRecipeId,
        resultingName: fractionFlow === 'VENTA' ? (selectedDestinationProduct?.name || destinationSku) : `Receta / Fórmula: ${selectedRecipeId}`,
        resultingQuantity: netResultingUnits,
        warehouseId: selectedWarehouseId,
        warehouseName: warehouseName,
        flowType: fractionFlow,
        wasteQuantity: calculatedWasteUnits,
        unitCostResulting: unitCostResulting,
        batchNumber: batchNumber || undefined,
        expiryDate: expiryDate || undefined,
        reason: notes || (fractionFlow === 'VENTA' ? `Fraccionamiento para venta (${sourceUnit} -> ${targetUnit})` : `Consumo directo en orden/receta de producción`),
        responsibleEmail: operatorName || user?.email || 'Desconocido',
        created_at: new Date().toISOString()
      };

      const updatedHistory = [newRecord, ...history];
      setHistory(updatedHistory);

      await supabase
        .from('system_config')
        .upsert({
          key: 'special_discharges_history',
          value: updatedHistory,
          updated_at: new Date().toISOString()
        });

      toast({
        title: 'Operación Exitosa',
        description: fractionFlow === 'VENTA' 
          ? `Se fraccionaron ${parsedSourceQty} ${sourceUnit}(s) en ${netResultingUnits.toFixed(2)} ${targetUnit}(s) para venta.`
          : `Se descargaron ${parsedSourceQty} ${sourceUnit}(s) directamente para consumo en producción.`,
      });

      // Resetear campos parciales
      setSourceQuantity('1');
      setBatchNumber('');
      setExpiryDate('');
      setNotes('');
      setWasteValue('0');
      setApplyWaste(false);
      loadData(); // Recargar inventarios actualizados

    } catch (err: any) {
      console.error('Error al procesar fraccionamiento:', err);
      toast({
        title: 'Error al Procesar',
        description: err.message || 'No se pudo completar el movimiento de fraccionamiento.',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Procesar Salida Especial (Merma, Muestra, etc.)
  const handleExecuteDischarge = async () => {
    const selectedProd = products.find(p => p.sku === dischargeSku);
    const qty = parseFloat(dischargeQuantity);

    if (!selectedProd) {
      toast({ title: 'Atención', description: 'Selecciona un producto válido.', variant: 'destructive' });
      return;
    }
    if (isNaN(qty) || qty <= 0) {
      toast({ title: 'Atención', description: 'La cantidad debe ser mayor a 0.', variant: 'destructive' });
      return;
    }
    if (qty > (selectedProd.stock || 0)) {
      toast({ title: 'Stock Insuficiente', description: 'La cantidad excede el stock disponible.', variant: 'destructive' });
      return;
    }
    if (!dischargeReason.trim()) {
      toast({ title: 'Motivo Requerido', description: 'Ingresa la justificación de la salida.', variant: 'destructive' });
      return;
    }

    setIsProcessing(true);
    try {
      const warehouse = warehouses.find(w => w.id === selectedWarehouseId);
      const warehouseName = warehouse?.name || 'Bodega Principal';

      // Descontar inventario
      const newStock = Math.max(0, (selectedProd.stock || 0) - qty);
      const { error: pErr } = await supabase
        .from('products')
        .update({ stock: newStock })
        .eq('id', selectedProd.id);
      if (pErr) throw pErr;

      // Kardex
      await supabase.from('kardex').insert({
        product_id: selectedProd.id,
        sku: selectedProd.sku,
        name: selectedProd.name,
        type: 'OUT',
        reason: `SALIDA_${dischargeType}: ${dischargeReason}`,
        quantity: qty,
        cost: selectedProd.cost || 0,
        total_cost: qty * (selectedProd.cost || 0),
        warehouse_id: selectedWarehouseId,
        responsible: operatorName || user?.email || 'Sistema',
        created_at: new Date().toISOString()
      });

      // Historial
      const newRecord: SpecialDischargeRecord = {
        id: `DIS-${Date.now()}`,
        type: dischargeType,
        sku: selectedProd.sku,
        name: selectedProd.name,
        quantity: qty,
        warehouseId: selectedWarehouseId,
        warehouseName: warehouseName,
        reason: dischargeReason,
        responsibleEmail: operatorName || user?.email || 'Desconocido',
        created_at: new Date().toISOString()
      };

      const updatedHistory = [newRecord, ...history];
      setHistory(updatedHistory);

      await supabase
        .from('system_config')
        .upsert({
          key: 'special_discharges_history',
          value: updatedHistory,
          updated_at: new Date().toISOString()
        });

      toast({
        title: 'Salida Registrada',
        description: `Se descargaron ${qty} unidades de ${selectedProd.name} por concepto de ${dischargeType}.`
      });

      setDischargeQuantity('1');
      setDischargeReason('');
      setDischargeSku('');
      loadData();

    } catch (err: any) {
      console.error('Error al registrar salida:', err);
      toast({
        title: 'Error',
        description: err.message || 'No se pudo procesar la salida especial.',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Filtrado de Historial
  const filteredHistory = useMemo(() => {
    return history.filter(item => {
      const matchType = historyFilterType === 'ALL' || item.type === historyFilterType;
      const searchLower = historySearch.toLowerCase();
      const matchSearch = !historySearch || 
        item.sku.toLowerCase().includes(searchLower) ||
        item.name.toLowerCase().includes(searchLower) ||
        (item.resultingName && item.resultingName.toLowerCase().includes(searchLower)) ||
        item.responsibleEmail.toLowerCase().includes(searchLower) ||
        item.reason.toLowerCase().includes(searchLower);
      return matchType && matchSearch;
    });
  }, [history, historyFilterType, historySearch]);

  return (
    <div className="space-y-6">
      {/* Subnavegación */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Scissors className="h-5 w-5 text-indigo-500" />
            Fraccionamiento y Salidas Especiales
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            División de productos a granel en unidades menores para venta o recetas de producción.
          </p>
        </div>

        <Tabs value={activeSubTab} onValueChange={(v: any) => setActiveSubTab(v)} className="w-full sm:w-auto">
          <TabsList className="grid grid-cols-3 w-full sm:w-auto">
            <TabsTrigger value="fraccionar" className="text-xs gap-1.5">
              <Scissors className="h-3.5 w-3.5" /> Fraccionar
            </TabsTrigger>
            <TabsTrigger value="salidas" className="text-xs gap-1.5">
              <ArrowDownCircle className="h-3.5 w-3.5" /> Salidas Especiales
            </TabsTrigger>
            <TabsTrigger value="historial" className="text-xs gap-1.5">
              <History className="h-3.5 w-3.5" /> Historial
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* 1. SUB-TAB: FRACCIONAMIENTO */}
      {activeSubTab === 'fraccionar' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Panel Izquierdo: Configuración del Fraccionamiento */}
          <div className="lg:col-span-7 space-y-5">
            
            {/* Selector de Flujo */}
            <Card className="border-indigo-500/30 bg-gradient-to-br from-card via-card to-indigo-950/10 shadow-sm">
              <CardContent className="p-4">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                  Propósito del Fraccionamiento:
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div 
                    onClick={() => setFractionFlow('VENTA')}
                    className={`cursor-pointer rounded-lg p-3.5 border transition-all ${
                      fractionFlow === 'VENTA' 
                        ? 'border-indigo-500 bg-indigo-500/10 shadow-sm ring-1 ring-indigo-500/50' 
                        : 'border-border/60 bg-card hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2 rounded-md ${fractionFlow === 'VENTA' ? 'bg-indigo-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                        <Boxes className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-foreground">Fraccionar para Venta</div>
                        <div className="text-xs text-muted-foreground">Genera unidades al stock de tienda</div>
                      </div>
                    </div>
                  </div>

                  <div 
                    onClick={() => setFractionFlow('PRODUCCION')}
                    className={`cursor-pointer rounded-lg p-3.5 border transition-all ${
                      fractionFlow === 'PRODUCCION' 
                        ? 'border-amber-500 bg-amber-500/10 shadow-sm ring-1 ring-amber-500/50' 
                        : 'border-border/60 bg-card hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`p-2 rounded-md ${fractionFlow === 'PRODUCCION' ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                        <Factory className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-foreground">Consumo en Producción</div>
                        <div className="text-xs text-muted-foreground">Se consume directo en fórmula/receta</div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Formulario Principal */}
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-3 border-b border-border/40">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  Parámetros de Conversión y Productos
                </CardTitle>
                <CardDescription className="text-xs">
                  Especifica el producto matriz a descargar y el destino a cargar.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                
                {/* Bodega y Responsable */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Bodega de Operación *</Label>
                    <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Seleccionar bodega..." />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouses.map(w => (
                          <SelectItem key={w.id} value={w.id} className="text-xs">
                            {w.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                      <span>Responsable</span>
                      <span className="text-[10px] text-emerald-500 flex items-center gap-0.5">
                        <ShieldCheck className="h-3 w-3" /> Verificado
                      </span>
                    </Label>
                    <div className="h-9 px-3 rounded-md border border-input bg-muted/50 flex items-center text-xs font-medium text-foreground truncate">
                      {operatorName || user?.email || 'Operador en sesión'}
                    </div>
                  </div>
                </div>

                {/* Producto Origen (Matriz) */}
                <div className="p-3.5 rounded-lg border border-border/60 bg-muted/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500"></span> 1. Producto Origen (A Granel / Matriz)
                    </span>
                    {selectedSourceProduct && (
                      <Badge variant="outline" className={`text-[10px] ${isStockInsufficient ? 'border-rose-500 text-rose-500 bg-rose-500/10 font-bold' : 'text-muted-foreground'}`}>
                        Stock Disp: {currentSourceStock} {sourceUnit}s
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Seleccionar Producto Matriz *</Label>
                    <Select value={sourceSku} onValueChange={handleSourceProductChange}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Buscar producto origen..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-56">
                        {products.map(p => (
                          <SelectItem key={p.sku} value={p.sku} className="text-xs">
                            [{p.sku}] {p.name} (Stock: {p.stock})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Cantidad a Fraccionar *</Label>
                      <Input 
                        type="number"
                        min="0.01"
                        step="any"
                        value={sourceQuantity}
                        onChange={e => setSourceQuantity(e.target.value)}
                        className={`h-9 text-xs font-semibold ${isStockInsufficient ? 'border-rose-500 text-rose-500 focus-visible:ring-rose-500' : ''}`}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Unidad de Medida Matriz</Label>
                      <Select value={sourceUnit} onValueChange={setSourceUnit}>
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {COMMON_UNITS.map(u => (
                            <SelectItem key={u} value={u} className="text-xs">{u}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {isStockInsufficient && (
                    <div className="text-xs text-rose-500 flex items-center gap-1.5 bg-rose-500/10 p-2 rounded-md font-medium border border-rose-500/30">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>Stock insuficiente: Solicitas descargar {parsedSourceQty} {sourceUnit}s pero solo hay {currentSourceStock} disponibles.</span>
                    </div>
                  )}
                </div>

                {/* Producto Destino / Receta */}
                <div className="p-3.5 rounded-lg border border-border/60 bg-muted/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span> 2. Destino ({fractionFlow === 'VENTA' ? 'Stock de Venta' : 'Fórmula Industrial'})
                    </span>
                  </div>

                  {fractionFlow === 'VENTA' ? (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Producto Resultante (Presentación Menor) *</Label>
                        <Select value={destinationSku} onValueChange={handleDestinationProductChange}>
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue placeholder="Seleccionar producto resultante..." />
                          </SelectTrigger>
                          <SelectContent className="max-h-56">
                            {products.filter(p => p.sku !== sourceSku).map(p => (
                              <SelectItem key={p.sku} value={p.sku} className="text-xs">
                                [{p.sku}] {p.name} (Stock Actual: {p.stock})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Factor de Conversión *</Label>
                          <Input 
                            type="number"
                            min="0.01"
                            step="any"
                            value={conversionFactor}
                            onChange={e => setConversionFactor(e.target.value)}
                            placeholder="Ej: 55"
                            className="h-9 text-xs font-semibold"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Unidad Resultante</Label>
                          <Select value={targetUnit} onValueChange={setTargetUnit}>
                            <SelectTrigger className="h-9 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {COMMON_UNITS.map(u => (
                                <SelectItem key={u} value={u} className="text-xs">{u}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Vincular a Receta / Orden de Producción *</Label>
                        {recipes.length > 0 ? (
                          <Select value={selectedRecipeId} onValueChange={setSelectedRecipeId}>
                            <SelectTrigger className="h-9 text-xs">
                              <SelectValue placeholder="Seleccionar receta industrial..." />
                            </SelectTrigger>
                            <SelectContent>
                              {recipes.map(r => (
                                <SelectItem key={r.id} value={r.id} className="text-xs">
                                  {r.name} (Produce: {r.targetName})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input 
                            value={selectedRecipeId} 
                            onChange={e => setSelectedRecipeId(e.target.value)}
                            placeholder="Escribe el nombre o código de la orden/fórmula..."
                            className="h-9 text-xs"
                          />
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Rendimiento en Unidades Menores *</Label>
                          <Input 
                            type="number"
                            min="0.01"
                            step="any"
                            value={conversionFactor}
                            onChange={e => setConversionFactor(e.target.value)}
                            placeholder="Ej: 55"
                            className="h-9 text-xs font-semibold"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Unidad Consumida</Label>
                          <Select value={targetUnit} onValueChange={setTargetUnit}>
                            <SelectTrigger className="h-9 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {COMMON_UNITS.map(u => (
                                <SelectItem key={u} value={u} className="text-xs">{u}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Etiqueta explicativa de la regla de conversión */}
                  {parsedFactor > 0 && (
                    <div className="p-2 rounded bg-background/80 border border-border/50 text-[11px] text-muted-foreground flex items-center justify-between">
                      <span className="font-medium text-foreground">Regla de Fraccionamiento:</span>
                      <span className="font-semibold text-primary">
                        1 {sourceUnit} = {parsedFactor} {targetUnit}s
                      </span>
                    </div>
                  )}
                </div>

                {/* Sección de Merma */}
                <div className="p-3.5 rounded-lg border border-border/60 bg-muted/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        id="waste-check"
                        checked={applyWaste} 
                        onChange={e => setApplyWaste(e.target.checked)}
                        className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                      />
                      <label htmlFor="waste-check" className="text-xs font-semibold text-foreground cursor-pointer">
                        ¿Aplica merma o residuo durante el proceso?
                      </label>
                    </div>
                    {applyWaste && (
                      <Badge variant="secondary" className="text-[10px] text-amber-500 bg-amber-500/10 border-amber-500/30">
                        {calculatedWasteUnits.toFixed(2)} {targetUnit}s de merma
                      </Badge>
                    )}
                  </div>

                  {applyWaste && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Tipo de Merma</Label>
                        <Select value={wasteType} onValueChange={(v: any) => setWasteType(v)}>
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PERCENT" className="text-xs">Porcentaje (%)</SelectItem>
                            <SelectItem value="FIXED" className="text-xs">Cantidad Fija ({targetUnit})</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">
                          {wasteType === 'PERCENT' ? 'Porcentaje de Merma (%)' : `Merma Fija (${targetUnit}s)`}
                        </Label>
                        <Input 
                          type="number"
                          min="0"
                          step="any"
                          value={wasteValue}
                          onChange={e => setWasteValue(e.target.value)}
                          placeholder={wasteType === 'PERCENT' ? 'Ej: 2%' : 'Ej: 0.5'}
                          className="h-9 text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Trazabilidad y Lote */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <Tag className="h-3 w-3" /> N° de Lote (Opcional)
                    </Label>
                    <Input 
                      value={batchNumber}
                      onChange={e => setBatchNumber(e.target.value)}
                      placeholder="Ej: LOTE-2026-001"
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Fecha de Vencimiento (Opcional)
                    </Label>
                    <Input 
                      type="date"
                      value={expiryDate}
                      onChange={e => setExpiryDate(e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Notas / Observaciones</Label>
                  <Input 
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Detalles adicionales del proceso o motivo..."
                    className="h-9 text-xs"
                  />
                </div>

              </CardContent>
            </Card>
          </div>

          {/* Panel Derecho: Resumen Financiero y Validación en Tiempo Real */}
          <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-4">
            <Card className="border-border/60 shadow-md overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-muted/50 to-muted/20 border-b border-border/40 pb-3">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-indigo-500" /> Resumen de Fraccionamiento
                  </span>
                  {canCalculate && (
                    <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
                      Calculado en Vivo
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-xs">
                  Proyección de inventario físico, costo unitario resultante y margen.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-5 space-y-5">
                {!canCalculate ? (
                  <div className="py-10 text-center space-y-3 text-muted-foreground">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground/60">
                      <Scissors className="h-6 w-6" />
                    </div>
                    <div className="text-xs max-w-xs mx-auto">
                      Selecciona el <strong className="text-foreground">producto matriz</strong>, el <strong className="text-foreground">destino</strong> y la <strong className="text-foreground">cantidad</strong> para visualizar la proyección en tiempo real.
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Tarjeta de Movimiento Físico */}
                    <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-card border border-border/60 text-xs">
                      <div className="space-y-1">
                        <span className="text-[10px] text-muted-foreground uppercase font-semibold">Descarga Matriz</span>
                        <div className="text-base font-bold text-rose-500">
                          - {parsedSourceQty} <span className="text-xs font-normal">{sourceUnit}(s)</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {selectedSourceProduct?.name}
                        </div>
                      </div>

                      <div className="space-y-1 border-l border-border/40 pl-3">
                        <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                          {fractionFlow === 'VENTA' ? 'Ingreso Destino' : 'Consumo Receta'}
                        </span>
                        <div className="text-base font-bold text-emerald-500">
                          + {netResultingUnits.toFixed(2)} <span className="text-xs font-normal">{targetUnit}(s)</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {fractionFlow === 'VENTA' ? selectedDestinationProduct?.name : (selectedRecipeId || 'Fórmula')}
                        </div>
                      </div>
                    </div>

                    {/* Desglose de Merma si aplica */}
                    {applyWaste && calculatedWasteUnits > 0 && (
                      <div className="p-2.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs space-y-1">
                        <div className="flex justify-between text-amber-500 font-medium">
                          <span>Unidades Brutas Producidas:</span>
                          <span>{grossResultingUnits.toFixed(2)} {targetUnit}s</span>
                        </div>
                        <div className="flex justify-between text-amber-600 dark:text-amber-400">
                          <span>Merma / Desperdicio ({wasteType === 'PERCENT' ? `${wasteValue}%` : 'Fija'}):</span>
                          <span>- {calculatedWasteUnits.toFixed(2)} {targetUnit}s</span>
                        </div>
                        <div className="flex justify-between font-bold text-foreground pt-1 border-t border-amber-500/20">
                          <span>Unidades Netas Finales:</span>
                          <span>{netResultingUnits.toFixed(2)} {targetUnit}s</span>
                        </div>
                      </div>
                    )}

                    {/* Panel Financiero */}
                    <div className="space-y-2.5 pt-2 border-t border-border/40">
                      <div className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <DollarSign className="h-3.5 w-3.5 text-primary" /> Métricas de Costo y Rentabilidad
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="p-2.5 rounded-md border border-border/60 bg-muted/20">
                          <div className="text-[10px] text-muted-foreground">Costo Total Origen</div>
                          <div className="text-sm font-bold text-foreground mt-0.5">
                            ${totalSourceCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="text-[9px] text-muted-foreground">
                            (${sourceUnitCost.toFixed(2)} / {sourceUnit})
                          </div>
                        </div>

                        <div className="p-2.5 rounded-md border border-indigo-500/30 bg-indigo-500/5">
                          <div className="text-[10px] text-indigo-400 font-medium">Costo Unitario Resultante</div>
                          <div className="text-sm font-bold text-indigo-400 mt-0.5">
                            ${unitCostResulting.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                          </div>
                          <div className="text-[9px] text-muted-foreground">
                            Por cada {targetUnit}
                          </div>
                        </div>
                      </div>

                      {fractionFlow === 'VENTA' && selectedDestinationProduct && (
                        <div className="p-2.5 rounded-md border border-emerald-500/30 bg-emerald-500/5 space-y-1">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-muted-foreground">Precio de Venta (PVP):</span>
                            <span className="font-semibold text-foreground">${destinationPrice.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs font-semibold">
                            <span className="text-emerald-500 flex items-center gap-1">
                              <TrendingUp className="h-3.5 w-3.5" /> Margen Bruto Proyectado:
                            </span>
                            <span className={`text-xs ${projectedGrossMargin > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {projectedGrossMargin.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Botón de Ejecución */}
                    <div className="pt-2">
                      <Button
                        onClick={handleExecuteFraction}
                        disabled={!isFormValid || isProcessing}
                        className="w-full h-10 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all gap-2"
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" /> Procesando Movimiento...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            {fractionFlow === 'VENTA' ? 'Confirmar y Fraccionar para Venta' : 'Confirmar Consumo en Producción'}
                          </>
                        )}
                      </Button>
                      {!isFormValid && (
                        <div className="text-[11px] text-muted-foreground text-center mt-2">
                          {isStockInsufficient ? '❌ Corrige la cantidad por exceso de stock.' : 'Completa los campos obligatorios para habilitar el registro.'}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

        </div>
      )}

      {/* 2. SUB-TAB: SALIDAS ESPECIALES */}
      {activeSubTab === 'salidas' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 space-y-4">
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-3 border-b border-border/40">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ArrowDownCircle className="h-4 w-4 text-rose-500" /> Registro de Salida Especial
                </CardTitle>
                <CardDescription className="text-xs">
                  Descarga física por conceptos de mermas, productos dañados, muestras o consumo interno.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Tipo de Salida *</Label>
                  <Select value={dischargeType} onValueChange={(v: any) => setDischargeType(v)}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MERMA" className="text-xs">Merma / Desecho / Vencido</SelectItem>
                      <SelectItem value="USO_INTERNO" className="text-xs">Uso Interno de la Empresa</SelectItem>
                      <SelectItem value="MUESTRA" className="text-xs">Muestra Comercial / Regalo</SelectItem>
                      <SelectItem value="AJUSTE" className="text-xs">Ajuste de Auditoría</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Bodega de Origen *</Label>
                  <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Seleccionar bodega..." />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses.map(w => (
                        <SelectItem key={w.id} value={w.id} className="text-xs">{w.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Producto a Descargar *</Label>
                  <Select value={dischargeSku} onValueChange={setDischargeSku}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Buscar producto..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {products.map(p => (
                        <SelectItem key={p.sku} value={p.sku} className="text-xs">
                          [{p.sku}] {p.name} (Stock: {p.stock})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Cantidad *</Label>
                  <Input 
                    type="number"
                    min="0.01"
                    step="any"
                    value={dischargeQuantity}
                    onChange={e => setDischargeQuantity(e.target.value)}
                    className="h-9 text-xs font-semibold"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Motivo / Justificación *</Label>
                  <Textarea 
                    value={dischargeReason}
                    onChange={e => setDischargeReason(e.target.value)}
                    placeholder="Explica detalladamente por qué se da de baja este inventario..."
                    className="text-xs resize-none h-20"
                  />
                </div>

                <Button
                  onClick={handleExecuteDischarge}
                  disabled={isProcessing || !dischargeSku || !dischargeReason.trim()}
                  className="w-full h-10 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-md gap-2"
                >
                  {isProcessing ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Procesando Salida...</>
                  ) : (
                    <><CheckCircle2 className="h-4 w-4" /> Registrar Salida en Kardex</>
                  )}
                </Button>

              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-6 space-y-4">
            <Card className="border-border/60 bg-muted/10 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Info className="h-4 w-4 text-primary" /> Política de Descargos Especiales
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 text-xs text-muted-foreground space-y-3">
                <p>
                  Toda salida registrada en esta pestaña afecta inmediatamente el balance de inventario físico en Kardex bajo tipo <strong className="text-foreground">OUT</strong>.
                </p>
                <ul className="list-disc list-inside space-y-1.5 pl-1">
                  <li><strong className="text-foreground">Merma:</strong> Utilizado para producto dañado, evaporado o vencido.</li>
                  <li><strong className="text-foreground">Uso Interno:</strong> Suministros consumidos por operaciones de la empresa.</li>
                  <li><strong className="text-foreground">Muestras:</strong> Ensayos a clientes o demostraciones comerciales.</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* 3. SUB-TAB: HISTORIAL */}
      {activeSubTab === 'historial' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-lg border border-border/60">
            <div className="relative flex-1">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input 
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                placeholder="Buscar por SKU, producto, responsable o motivo..."
                className="h-8 pl-8 text-xs"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <Select value={historyFilterType} onValueChange={setHistoryFilterType}>
                <SelectTrigger className="h-8 text-xs w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL" className="text-xs">Todos los tipos</SelectItem>
                  <SelectItem value="FRACCIONAMIENTO" className="text-xs">Fraccionamientos</SelectItem>
                  <SelectItem value="CONSUMO_PRODUCCION" className="text-xs">Consumo en Producción</SelectItem>
                  <SelectItem value="MERMA" className="text-xs">Mermas</SelectItem>
                  <SelectItem value="USO_INTERNO" className="text-xs">Uso Interno</SelectItem>
                  <SelectItem value="MUESTRA" className="text-xs">Muestras</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card className="border-border/60 shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 text-[11px]">
                  <TableHead className="w-[140px]">Fecha / Hora</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Origen (Descargado)</TableHead>
                  <TableHead>Destino / Consumo</TableHead>
                  <TableHead>Costo Resultante</TableHead>
                  <TableHead>Bodega</TableHead>
                  <TableHead>Responsable</TableHead>
                  <TableHead className="w-[200px]">Detalle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHistory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-xs text-muted-foreground">
                      No se encontraron registros de fraccionamientos ni salidas.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredHistory.map(record => (
                    <TableRow key={record.id} className="text-xs hover:bg-muted/30">
                      <TableCell className="font-mono text-[11px] text-muted-foreground">
                        {new Date(record.created_at).toLocaleString('es-SV', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={`text-[10px] font-semibold ${
                            record.type === 'FRACCIONAMIENTO' 
                              ? 'border-indigo-500/40 text-indigo-400 bg-indigo-500/10' 
                              : record.type === 'CONSUMO_PRODUCCION'
                              ? 'border-amber-500/40 text-amber-500 bg-amber-500/10'
                              : 'border-rose-500/40 text-rose-500 bg-rose-500/10'
                          }`}
                        >
                          {record.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">{record.name}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          [{record.sku}] - Qty: {record.quantity}
                        </div>
                      </TableCell>
                      <TableCell>
                        {record.resultingName ? (
                          <div>
                            <div className="font-medium text-foreground">{record.resultingName}</div>
                            <div className="text-[10px] text-emerald-500 font-semibold font-mono">
                              +{record.resultingQuantity} uds {record.wasteQuantity ? `(Merma: ${record.wasteQuantity.toFixed(2)})` : ''}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic text-[11px]">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {record.unitCostResulting ? (
                          <div className="font-semibold text-foreground font-mono text-[11px]">
                            ${record.unitCostResulting.toFixed(4)}
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic text-[11px]">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {record.warehouseName}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-[11px]">
                          <UserCheck className="h-3 w-3 text-emerald-500 shrink-0" />
                          <span className="truncate max-w-[120px]">{record.responsibleEmail}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-[11px]">
                        <div className="truncate max-w-[200px]" title={record.reason}>
                          {record.reason}
                        </div>
                        {record.batchNumber && (
                          <div className="text-[10px] text-primary">Lote: {record.batchNumber}</div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}
    </div>
  );
}
