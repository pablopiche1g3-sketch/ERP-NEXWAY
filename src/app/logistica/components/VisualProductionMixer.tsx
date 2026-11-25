'use client';

import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Droplets,
  Factory,
  FlaskConical,
  Layers,
  Loader2,
  PackagePlus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { PackagingBomPreset } from '@/lib/product-fraction-rules';

export interface BatchIngredient {
  id: string;
  sku: string;
  name: string;
  unitCost: number;
  availableStock: number;
  mode: 'FRACTION' | 'PERCENT' | 'CUSTOM';
  fractionLabel: string;
  quantity: number; // in base units (e.g. Gal / L / Kg)
  percentValue: number;
  color: string;
}

interface VisualProductionMixerProps {
  warehouses: any[];
  selectedWarehouseId: string;
  onWarehouseChange: (id: string) => void;
  inventory: any[];
  stockMap: Record<string, number>; // sku -> stock in selected warehouse
  packagingPresets: PackagingBomPreset[];
  operatorName: string;
  onCompleted: (summary: {
    actionType: 'NEW_SKU' | 'REFILL' | 'INTERNAL';
    sourceSku: string;
    sourceName: string;
    sourceQty: number;
    targetSku?: string;
    targetName?: string;
    targetQty?: number;
    totalCost: number;
    notes: string;
    batchCode: string;
  }) => Promise<void> | void;
}

const FRACTION_OPTIONS = [
  { label: '1/2', value: 0.5, desc: '0.50 (50%)' },
  { label: '1/4', value: 0.25, desc: '0.25 (25%)' },
  { label: '1/8', value: 0.125, desc: '0.125 (12.5%)' },
  { label: '1/16', value: 0.0625, desc: '0.0625 (6.25%)' },
  { label: '1/32', value: 0.03125, desc: '0.03125 (3.1%)' },
  { label: '1/64', value: 0.015625, desc: '0.0156 (1.56%)' },
];

const LAYER_COLORS = [
  { name: 'Base Blanca', hex: '#e2e8f0' },
  { name: 'Gris Base', hex: '#94a3b8' },
  { name: 'Verde Aditivo', hex: '#22c55e' },
  { name: 'Azul Tinte', hex: '#2563eb' },
  { name: 'Rojo Tinte', hex: '#ef4444' },
  { name: 'Amarillo Tinte', hex: '#eab308' },
  { name: 'Naranja', hex: '#f97316' },
  { name: 'Morado', hex: '#8b5cf6' },
];

export default function VisualProductionMixer({
  warehouses,
  selectedWarehouseId,
  onWarehouseChange,
  inventory,
  stockMap,
  packagingPresets,
  operatorName,
  onCompleted,
}: VisualProductionMixerProps) {
  const { toast } = useToast();

  // Paso 1: búsqueda de insumos
  const [searchQuery, setSearchQuery] = useState('');
  const [ingredients, setIngredients] = useState<BatchIngredient[]>([]);
  const [activeIngredientId, setActiveIngredientId] = useState<string | null>(null);

  // Paso 3: Lote objetivo y Presets de Envase/Tapa/Extra (conservando BOM de envasado)
  const [targetBatchSize, setTargetBatchSize] = useState<string>('1');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('none');
  const [containerSku, setContainerSku] = useState<string>('none');
  const [lidSku, setLidSku] = useState<string>('none');
  const [extraSku, setExtraSku] = useState<string>('none');
  const [packagingUnits, setPackagingUnits] = useState<string>('1');

  // Paso 4: Acción de salida
  const [outputAction, setOutputAction] = useState<'NEW_SKU' | 'REFILL' | 'INTERNAL'>('NEW_SKU');
  const [newSkuCode, setNewSkuCode] = useState('');
  const [newSkuName, setNewSkuName] = useState('');
  const [newSkuPvp, setNewSkuPvp] = useState('');
  const [refillTargetSku, setRefillTargetSku] = useState('');
  const [refillSearch, setRefillSearch] = useState('');
  const [batchCode, setBatchCode] = useState(() => `LOT-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}`);
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  const filteredInventory = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = inventory.filter((p) => !p.is_service);
    if (!q) return list.slice(0, 30);
    return list
      .filter(
        (p) =>
          (p.sku || '').toLowerCase().includes(q) ||
          (p.name || '').toLowerCase().includes(q)
      )
      .slice(0, 30);
  }, [inventory, searchQuery]);

  const activeIngredient = useMemo(
    () => ingredients.find((i) => i.id === activeIngredientId) || ingredients[0] || null,
    [ingredients, activeIngredientId]
  );

  const handleAddIngredient = (prod: any) => {
    const existing = ingredients.find((i) => i.sku === prod.sku);
    if (existing) {
      setActiveIngredientId(existing.id);
      return;
    }
    const nextColor = LAYER_COLORS[ingredients.length % LAYER_COLORS.length].hex;
    const defaultQty = ingredients.length === 0 ? 0.5 : 0.25;
    const defaultLabel = ingredients.length === 0 ? '1/2' : '1/4';
    const unitCost = Number(prod.cost) > 0 ? Number(prod.cost) : Number(((Number(prod.price) || 10) * 0.65).toFixed(2));
    const item: BatchIngredient = {
      id: `ing-${prod.sku}-${Date.now()}`,
      sku: prod.sku,
      name: prod.name || prod.sku,
      unitCost,
      availableStock: Number(stockMap[prod.sku] || 0),
      mode: 'FRACTION',
      fractionLabel: defaultLabel,
      quantity: defaultQty,
      percentValue: defaultQty * 100,
      color: nextColor,
    };
    setIngredients((prev) => [...prev, item]);
    setActiveIngredientId(item.id);
  };

  const updateActiveIngredient = (patch: Partial<BatchIngredient>) => {
    if (!activeIngredient) return;
    setIngredients((prev) =>
      prev.map((i) => (i.id === activeIngredient.id ? { ...i, ...patch } : i))
    );
  };

  const removeIngredient = (id: string) => {
    setIngredients((prev) => {
      const next = prev.filter((i) => i.id !== id);
      if (activeIngredientId === id) {
        setActiveIngredientId(next[0]?.id || null);
      }
      return next;
    });
  };

  const handleApplyPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    if (presetId === 'none') {
      setContainerSku('none');
      setLidSku('none');
      setExtraSku('none');
      return;
    }
    const found = packagingPresets.find((p) => p.id === presetId);
    if (found) {
      setContainerSku(found.packageSku || 'none');
      setLidSku(found.capSku || 'none');
      setExtraSku(found.extraSku || 'none');
    }
  };

  const batchTargetNum = Math.max(0.01, parseFloat(targetBatchSize) || 1);
  const pkgUnitsNum = Math.max(1, parseInt(packagingUnits) || 1);

  const totalVolume = useMemo(
    () => ingredients.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0),
    [ingredients]
  );

  const rawMaterialCost = useMemo(
    () => ingredients.reduce((sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unitCost) || 0), 0),
    [ingredients]
  );

  const getSkuCost = (sku: string) => {
    if (!sku || sku === 'none') return 0;
    const p = inventory.find((x) => x.sku === sku);
    if (!p) return 0;
    return Number(p.cost) > 0 ? Number(p.cost) : Number(p.price) || 0;
  };

  const packagingCost = useMemo(() => {
    return (getSkuCost(containerSku) + getSkuCost(lidSku) + getSkuCost(extraSku)) * pkgUnitsNum;
  }, [containerSku, lidSku, extraSku, pkgUnitsNum, inventory]);

  const totalBatchCost = rawMaterialCost + packagingCost;
  const fillRatio = Math.min(1, totalVolume / batchTargetNum);

  const handleProcessBatch = async () => {
    if (!selectedWarehouseId) {
      toast({ variant: 'destructive', title: 'Bodega requerida', description: 'Selecciona la bodega de operación.' });
      return;
    }
    if (ingredients.length === 0) {
      toast({ variant: 'destructive', title: 'Sin ingredientes', description: 'Agrega al menos 1 insumo en el Paso 1.' });
      return;
    }
    if (outputAction === 'NEW_SKU' && (!newSkuCode.trim() || !newSkuName.trim())) {
      toast({ variant: 'destructive', title: 'Datos del nuevo SKU', description: 'Ingresa el código SKU y nombre del producto final.' });
      return;
    }
    if (outputAction === 'REFILL' && !refillTargetSku) {
      toast({ variant: 'destructive', title: 'Destino requerido', description: 'Selecciona el SKU existente que deseas rellenar.' });
      return;
    }

    setProcessing(true);
    try {
      // 1. Consolidar todos los descuentos (ingredientes + envases BOM)
      const deductions = new Map<string, number>();
      ingredients.forEach((ing) => {
        const qty = Number(ing.quantity) || 0;
        if (qty > 0) deductions.set(ing.sku, (deductions.get(ing.sku) || 0) + qty);
      });
      [containerSku, lidSku, extraSku].forEach((sku) => {
        if (sku && sku !== 'none') {
          deductions.set(sku, (deductions.get(sku) || 0) + pkgUnitsNum);
        }
      });

      const affectedSkus = Array.from(deductions.keys());
      if (outputAction === 'NEW_SKU') affectedSkus.push(newSkuCode.trim().toUpperCase());
      if (outputAction === 'REFILL') affectedSkus.push(refillTargetSku);

      const { data: currentStockRows } = await supabase
        .from('inventory_stock')
        .select('sku, quantity')
        .eq('warehouse_id', selectedWarehouseId)
        .in('sku', Array.from(new Set(affectedSkus)));

      const dbStock = new Map<string, number>();
      (currentStockRows || []).forEach((r: any) => {
        dbStock.set(r.sku, parseFloat(r.quantity) || 0);
      });

      const upserts: Array<{ sku: string; warehouse_id: string; quantity: number }> = [];
      deductions.forEach((decQty, sku) => {
        const current = dbStock.get(sku) ?? Number(stockMap[sku] || 0);
        const nextQty = Number(Math.max(0, current - decQty).toFixed(4));
        dbStock.set(sku, nextQty);
        upserts.push({ sku, warehouse_id: selectedWarehouseId, quantity: nextQty });
      });

      let finalTargetSku: string | undefined;
      let finalTargetName: string | undefined;
      const producedUnits = pkgUnitsNum;

      if (outputAction === 'NEW_SKU') {
        const cleanSku = newSkuCode.trim().toUpperCase();
        const unitFinalCost = Number((totalBatchCost / producedUnits).toFixed(2));
        const finalPvp = parseFloat(newSkuPvp) || Number((unitFinalCost * 1.35).toFixed(2));

        const { data: existsInv } = await supabase
          .from('inventory')
          .select('sku')
          .eq('sku', cleanSku)
          .maybeSingle();

        if (!existsInv) {
          const { error: invErr } = await supabase.from('inventory').insert({
            sku: cleanSku,
            name: newSkuName.trim(),
            category: 'Producción / Mezclas',
            cost: unitFinalCost,
            price: finalPvp,
          });
          if (invErr) throw invErr;
        }

        const prevTarget = dbStock.get(cleanSku) || 0;
        upserts.push({
          sku: cleanSku,
          warehouse_id: selectedWarehouseId,
          quantity: Number((prevTarget + producedUnits).toFixed(4)),
        });
        finalTargetSku = cleanSku;
        finalTargetName = newSkuName.trim();
      } else if (outputAction === 'REFILL') {
        const prevTarget = dbStock.get(refillTargetSku) ?? Number(stockMap[refillTargetSku] || 0);
        upserts.push({
          sku: refillTargetSku,
          warehouse_id: selectedWarehouseId,
          quantity: Number((prevTarget + producedUnits).toFixed(4)),
        });
        const targetProd = inventory.find((p) => p.sku === refillTargetSku);
        finalTargetSku = refillTargetSku;
        finalTargetName = targetProd?.name || refillTargetSku;
      }

      const { error: stockErr } = await supabase
        .from('inventory_stock')
        .upsert(upserts, { onConflict: 'sku,warehouse_id' });
      if (stockErr) throw stockErr;

      const ingSummary = ingredients
        .map((i) => `${i.fractionLabel || i.quantity.toFixed(3)} ${i.name}`)
        .join(' + ');

      await onCompleted({
        actionType: outputAction,
        sourceSku: ingredients[0].sku,
        sourceName: ingredients.length > 1 ? `Mezcla (${ingredients.length} insumos)` : ingredients[0].name,
        sourceQty: Number(totalVolume.toFixed(4)),
        targetSku: finalTargetSku,
        targetName: finalTargetName,
        targetQty: outputAction === 'INTERNAL' ? 0 : producedUnits,
        totalCost: Number(totalBatchCost.toFixed(2)),
        notes: `[Lote ${batchCode}] ${ingSummary}${notes.trim() ? ` · ${notes.trim()}` : ''}`,
        batchCode,
      });

      toast({
        title: 'Mezcla Procesada e Inventario Actualizado ✓',
        description:
          outputAction === 'NEW_SKU'
            ? `Se creó/ingresó ${finalTargetSku} (+${producedUnits} ud) descontando ${ingredients.length} insumo(s).`
            : outputAction === 'REFILL'
            ? `Se rellenó ${finalTargetSku} (+${producedUnits} ud) descontando ${ingredients.length} insumo(s).`
            : `Se registró consumo interno de ${ingredients.length} insumo(s) (Costo: $${totalBatchCost.toFixed(2)}).`,
      });

      setIngredients([]);
      setActiveIngredientId(null);
      setNewSkuCode('');
      setNewSkuName('');
      setNewSkuPvp('');
      setNotes('');
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error procesando mezcla',
        description: err?.message || 'No se pudo actualizar el inventario.',
      });
    } finally {
      setProcessing(false);
    }
  };

  // Capas apiladas para el cilindro SVG (de abajo hacia arriba)
  const cylinderHeight = 148;
  const cylinderTopY = 34;
  const cylinderBottomY = cylinderTopY + cylinderHeight;
  let runningHeight = 0;
  const svgLayers = ingredients.map((ing) => {
    const share = totalVolume > 0 ? (Number(ing.quantity) || 0) / Math.max(batchTargetNum, totalVolume) : 0;
    const h = Math.max(8, share * cylinderHeight);
    const y = Math.max(cylinderTopY, cylinderBottomY - runningHeight - h);
    const midY = y + h / 2;
    runningHeight += h;
    return { ...ing, y, h, midY };
  });

  const packagingCatalog = useMemo(() => inventory.filter((p) => !p.is_service), [inventory]);

  return (
    <div className="space-y-4">
      {/* Barra superior compacta de Bodega y Lote */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-card border border-border/70 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-500 border border-indigo-500/25">
            <FlaskConical size={16} />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-foreground">
              Estudio Visual de Dosificación y Mezcla (Producción)
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Combina insumos por fracción o cantidad, visualiza el lote y elige la acción de salida al inventario.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedWarehouseId} onValueChange={onWarehouseChange}>
            <SelectTrigger className="h-8 w-48 text-xs font-bold rounded-xl">
              <SelectValue placeholder="Bodega..." />
            </SelectTrigger>
            <SelectContent>
              {warehouses.map((w) => (
                <SelectItem key={w.id} value={w.id} className="text-xs">{w.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            value={batchCode}
            onChange={(e) => setBatchCode(e.target.value.toUpperCase())}
            className="h-8 w-32 text-xs font-mono font-bold rounded-xl"
            placeholder="Lote..."
            title="Código de lote de producción"
          />
        </div>
      </div>

      {/* PIPELINE VISUAL DE 4 PASOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-stretch">
        {/* PASO 1: SELECCIONAR INSUMO O LOTE ORIGEN */}
        <Card className="border-border/70 bg-card rounded-2xl shadow-sm flex flex-col overflow-hidden">
          <CardHeader className="p-3.5 border-b border-border/60 bg-indigo-500/5">
            <CardTitle className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">
              Paso 1 · Insumo o Lote Origen
            </CardTitle>
            <CardDescription className="text-[11px]">
              Elige los insumos base, aditivos o tintes a combinar.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 flex-1 flex flex-col gap-2.5">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar SKU o insumo..."
                className="pl-8 h-8 text-xs rounded-xl"
              />
            </div>

            <ScrollArea className="h-[340px] pr-1">
              <div className="space-y-1.5">
                {filteredInventory.map((prod) => {
                  const st = Number(stockMap[prod.sku] || 0);
                  const added = ingredients.find((i) => i.sku === prod.sku);
                  return (
                    <button
                      key={prod.sku}
                      type="button"
                      onClick={() => handleAddIngredient(prod)}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center gap-2.5 ${
                        added
                          ? 'border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500/30'
                          : 'border-border/60 bg-background/60 hover:border-indigo-500/40 hover:bg-muted/40'
                      }`}
                    >
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border border-white/15"
                        style={{ backgroundColor: added ? added.color : '#334155' }}
                      >
                        <Droplets size={13} className="text-white drop-shadow" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-foreground truncate">{prod.name}</div>
                        <div className="text-[10px] text-muted-foreground font-mono flex items-center justify-between">
                          <span>{prod.sku}</span>
                          <span className={st <= 0 ? 'text-rose-500 font-bold' : 'text-emerald-600 dark:text-emerald-400 font-bold'}>
                            {st.toFixed(2)} uds
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* PASO 2: MENÚ DE FRACCIONAMIENTO Y CANTIDAD */}
        <Card className="border-border/70 bg-card rounded-2xl shadow-sm flex flex-col overflow-hidden">
          <CardHeader className="p-3.5 border-b border-border/60 bg-blue-500/5">
            <CardTitle className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-wide">
              Paso 2 · Fraccionamiento y Cantidad
            </CardTitle>
            <CardDescription className="text-[11px]">
              Define la fracción, porcentaje o cantidad exacta de cada componente.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 flex-1 flex flex-col gap-3">
            {ingredients.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-xs text-muted-foreground">
                <Layers size={28} className="opacity-30 mb-2" />
                Selecciona uno o más insumos en el <strong>Paso 1</strong> para dosificarlos aquí.
              </div>
            ) : (
              <>
                {/* Selector de ingrediente activo */}
                <div className="flex flex-wrap gap-1.5">
                  {ingredients.map((ing) => (
                    <div
                      key={ing.id}
                      onClick={() => setActiveIngredientId(ing.id)}
                      className={`cursor-pointer px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition-all ${
                        activeIngredient?.id === ing.id
                          ? 'border-indigo-500 bg-indigo-500/15 text-foreground'
                          : 'border-border bg-muted/40 text-muted-foreground'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: ing.color }} />
                      <span className="max-w-[110px] truncate">{ing.name}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeIngredient(ing.id);
                        }}
                        className="text-muted-foreground hover:text-rose-500 ml-0.5"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>

                {activeIngredient && (
                  <div className="space-y-3 pt-1">
                    <div className="p-2.5 rounded-xl bg-muted/40 border border-border/60">
                      <div className="text-xs font-black text-foreground truncate">{activeIngredient.name}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        SKU: {activeIngredient.sku} · Stock: {activeIngredient.availableStock.toFixed(2)} · Costo: ${activeIngredient.unitCost.toFixed(2)}
                      </div>
                    </div>

                    {/* Menú visual de fracciones */}
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground">Fracción Rápida</Label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {FRACTION_OPTIONS.map((opt) => (
                          <button
                            key={opt.label}
                            type="button"
                            onClick={() =>
                              updateActiveIngredient({
                                mode: 'FRACTION',
                                fractionLabel: opt.label,
                                quantity: Number((opt.value * batchTargetNum).toFixed(5)),
                                percentValue: Number((opt.value * 100).toFixed(2)),
                              })
                            }
                            className={`py-2 px-2 rounded-xl border text-xs font-black transition-all ${
                              activeIngredient.mode === 'FRACTION' && activeIngredient.fractionLabel === opt.label
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                : 'bg-background border-border hover:border-indigo-500/50 text-foreground'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Porcentaje y Cantidad Personalizada */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">Porcentaje (%)</Label>
                        <Input
                          type="number"
                          step="0.5"
                          min="0"
                          value={activeIngredient.percentValue}
                          onChange={(e) => {
                            const pct = Math.max(0, parseFloat(e.target.value) || 0);
                            const qty = Number(((pct / 100) * batchTargetNum).toFixed(5));
                            updateActiveIngredient({
                              mode: 'PERCENT',
                              percentValue: pct,
                              quantity: qty,
                              fractionLabel: `${pct}%`,
                            });
                          }}
                          className="h-8 text-xs font-mono font-bold rounded-xl"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">Cant. Personalizada</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={activeIngredient.quantity}
                          onChange={(e) => {
                            const qty = Math.max(0, parseFloat(e.target.value) || 0);
                            updateActiveIngredient({
                              mode: 'CUSTOM',
                              quantity: qty,
                              percentValue: Number(((qty / batchTargetNum) * 100).toFixed(1)),
                              fractionLabel: `${qty}`,
                            });
                          }}
                          className="h-8 text-xs font-mono font-bold rounded-xl"
                        />
                      </div>
                    </div>

                    {/* Color de capa en el cilindro */}
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase text-muted-foreground">Color Visual de Capa</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {LAYER_COLORS.map((c) => (
                          <button
                            key={c.hex}
                            type="button"
                            onClick={() => updateActiveIngredient({ color: c.hex })}
                            title={c.name}
                            className={`w-6 h-6 rounded-full border-2 transition-transform ${
                              activeIngredient.color === c.hex ? 'border-indigo-500 scale-110 ring-2 ring-indigo-500/40' : 'border-white/20'
                            }`}
                            style={{ backgroundColor: c.hex }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* PASO 3: DOSIFICACIÓN Y MEZCLA DEL LOTE OBJETIVO (CILINDRO VISUAL SVG + ENVASES BOM) */}
        <Card className="border-border/70 bg-card rounded-2xl shadow-sm flex flex-col overflow-hidden">
          <CardHeader className="p-3.5 border-b border-border/60 bg-cyan-500/5">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-xs font-black text-cyan-600 dark:text-cyan-400 uppercase tracking-wide">
                Paso 3 · Mezcla del Lote
              </CardTitle>
              <Badge variant="outline" className="text-[10px] font-mono font-black border-cyan-500/40 text-cyan-600 dark:text-cyan-300">
                {(fillRatio * 100).toFixed(0)}% lleno
              </Badge>
            </div>
            <CardDescription className="text-[11px]">
              Visualización en vivo del lote objetivo y sus capas.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 flex-1 flex flex-col gap-3">
            {/* CILINDRO SVG INTERACTIVO */}
            <div className="rounded-xl bg-slate-950/90 border border-slate-800 p-2.5 flex items-center justify-center">
              <svg viewBox="0 0 280 205" className="w-full max-w-[270px] h-[195px]">
                {/* Cuerpo del cilindro vacío */}
                <defs>
                  <clipPath id="drumBodyClip">
                    <rect x="26" y={cylinderTopY} width="108" height={cylinderHeight} rx="6" />
                  </clipPath>
                </defs>

                {/* Fondo del tambor */}
                <rect
                  x="26"
                  y={cylinderTopY}
                  width="108"
                  height={cylinderHeight}
                  rx="6"
                  fill="#0f172a"
                  stroke="#475569"
                  strokeWidth="1.5"
                />

                {/* Capas apiladas por ingrediente */}
                <g clipPath="url(#drumBodyClip)">
                  {svgLayers.map((layer) => (
                    <rect
                      key={layer.id}
                      x="26"
                      y={layer.y}
                      width="108"
                      height={layer.h}
                      fill={layer.color}
                      fillOpacity="0.92"
                    />
                  ))}
                  {/* Brillo vertical sutil 3D */}
                  <rect x="34" y={cylinderTopY} width="14" height={cylinderHeight} fill="#ffffff" fillOpacity="0.12" />
                </g>

                {/* Tapa elíptica superior del cilindro */}
                <ellipse cx="80" cy={cylinderTopY} rx="54" ry="11" fill="#1e293b" stroke="#64748b" strokeWidth="1.5" />
                {/* Base elíptica inferior */}
                <path d={`M 26 ${cylinderBottomY} A 54 10 0 0 0 134 ${cylinderBottomY}`} fill="none" stroke="#64748b" strokeWidth="1.5" />

                {/* Etiqueta central */}
                <text x="80" y="102" textAnchor="middle" fill="#ffffff" fontSize="10.5" fontWeight="800" style={{ textShadow: '0 1px 4px #000' }}>
                  {totalVolume.toFixed(2)} / {batchTargetNum}
                </text>
                <text x="80" y="116" textAnchor="middle" fill="#cbd5e1" fontSize="8.5" fontWeight="600">
                  Lote (Batch)
                </text>

                {/* Líneas guía y etiquetas derechas */}
                {svgLayers.slice(0, 6).map((layer, idx) => {
                  const labelY = 38 + idx * 27;
                  return (
                    <g key={`lbl-${layer.id}`}>
                      <circle cx="136" cy={layer.midY} r="2.5" fill={layer.color} />
                      <line x1="138" y1={layer.midY} x2="154" y2={labelY} stroke="#64748b" strokeWidth="1" />
                      <text x="158" y={labelY - 2} fill="#f8fafc" fontSize="9" fontWeight="700">
                        {layer.fractionLabel} · {layer.name.slice(0, 14)}
                      </text>
                      <text x="158" y={labelY + 9} fill="#94a3b8" fontSize="8" fontFamily="monospace">
                        {layer.quantity.toFixed(3)} uds (${(layer.quantity * layer.unitCost).toFixed(2)})
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Tamaño objetivo + Envases / Presets BOM (conservado intacto) */}
            <div className="space-y-2 p-2.5 rounded-xl bg-muted/40 border border-border/60 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[9.5px] font-bold uppercase text-muted-foreground">Lote Objetivo</Label>
                  <Input
                    type="number"
                    step="0.25"
                    min="0.1"
                    value={targetBatchSize}
                    onChange={(e) => setTargetBatchSize(e.target.value)}
                    className="h-7 text-xs font-mono font-bold mt-0.5"
                  />
                </div>
                <div>
                  <Label className="text-[9.5px] font-bold uppercase text-muted-foreground">Unid. a Producir</Label>
                  <Input
                    type="number"
                    min="1"
                    value={packagingUnits}
                    onChange={(e) => setPackagingUnits(e.target.value)}
                    className="h-7 text-xs font-mono font-bold mt-0.5"
                  />
                </div>
              </div>

              <div className="space-y-1 pt-1 border-t border-border/50">
                <Label className="text-[9.5px] font-bold uppercase text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                  <Sparkles size={10} /> Envase / Tapa / Extra (BOM)
                </Label>
                {packagingPresets.length > 0 && (
                  <Select value={selectedPresetId} onValueChange={handleApplyPreset}>
                    <SelectTrigger className="h-7 text-[11px] font-semibold">
                      <SelectValue placeholder="Aplicar Preset de Envase..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="text-xs italic">Sin preset / Ninguno</SelectItem>
                      {packagingPresets.map((p) => (
                        <SelectItem key={p.id} value={p.id} className="text-xs font-bold">{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <div className="grid grid-cols-3 gap-1">
                  <Select value={containerSku} onValueChange={setContainerSku}>
                    <SelectTrigger className="h-7 text-[10px]" title="Bote / Envase"><SelectValue placeholder="Bote" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="text-xs">Sin Bote</SelectItem>
                      {packagingCatalog.slice(0, 60).map((p) => (
                        <SelectItem key={p.sku} value={p.sku} className="text-xs">{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={lidSku} onValueChange={setLidSku}>
                    <SelectTrigger className="h-7 text-[10px]" title="Tapa / Cierre"><SelectValue placeholder="Tapa" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="text-xs">Sin Tapa</SelectItem>
                      {packagingCatalog.slice(0, 60).map((p) => (
                        <SelectItem key={p.sku} value={p.sku} className="text-xs">{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={extraSku} onValueChange={setExtraSku}>
                    <SelectTrigger className="h-7 text-[10px]" title="Insumo Extra"><SelectValue placeholder="Extra" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="text-xs">Sin Extra</SelectItem>
                      {packagingCatalog.slice(0, 60).map((p) => (
                        <SelectItem key={p.sku} value={p.sku} className="text-xs">{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-between items-center pt-1.5 border-t border-border/50 font-mono">
                <span className="text-[10px] text-muted-foreground">Costo Total Lote:</span>
                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">${totalBatchCost.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* PASO 4: CONFIRMAR Y ELEGIR ACCIÓN DE SALIDA */}
        <Card className="border-border/70 bg-card rounded-2xl shadow-sm flex flex-col overflow-hidden">
          <CardHeader className="p-3.5 border-b border-border/60 bg-emerald-500/5">
            <CardTitle className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
              Paso 4 · Acción de Salida
            </CardTitle>
            <CardDescription className="text-[11px]">
              Elige cómo actualizar el inventario al procesar la mezcla.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 flex-1 flex flex-col justify-between gap-3">
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setOutputAction('NEW_SKU')}
                className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center gap-2.5 ${
                  outputAction === 'NEW_SKU'
                    ? 'border-indigo-500 bg-indigo-500/15 ring-1 ring-indigo-500/40'
                    : 'border-border/60 hover:bg-muted/40'
                }`}
              >
                <PackagePlus size={16} className="text-indigo-500 shrink-0" />
                <div>
                  <div className="text-xs font-black text-foreground">A) Crear Nuevo SKU</div>
                  <div className="text-[10px] text-muted-foreground">Crea e ingresa el producto mezclado</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setOutputAction('REFILL')}
                className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center gap-2.5 ${
                  outputAction === 'REFILL'
                    ? 'border-blue-500 bg-blue-500/15 ring-1 ring-blue-500/40'
                    : 'border-border/60 hover:bg-muted/40'
                }`}
              >
                <RefreshCw size={16} className="text-blue-500 shrink-0" />
                <div>
                  <div className="text-xs font-black text-foreground">B) Rellenado (Refill)</div>
                  <div className="text-[10px] text-muted-foreground">Suma stock a un SKU existente</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setOutputAction('INTERNAL')}
                className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center gap-2.5 ${
                  outputAction === 'INTERNAL'
                    ? 'border-amber-500 bg-amber-500/15 ring-1 ring-amber-500/40'
                    : 'border-border/60 hover:bg-muted/40'
                }`}
              >
                <Factory size={16} className="text-amber-500 shrink-0" />
                <div>
                  <div className="text-xs font-black text-foreground">C) Consumo Interno</div>
                  <div className="text-[10px] text-muted-foreground">Descarga insumos para orden interna</div>
                </div>
              </button>

              {/* Campos dinámicos según acción */}
              {outputAction === 'NEW_SKU' && (
                <div className="space-y-2 p-2.5 rounded-xl bg-muted/40 border border-border/60 mt-2">
                  <Input
                    value={newSkuCode}
                    onChange={(e) => setNewSkuCode(e.target.value.toUpperCase())}
                    placeholder="Nuevo SKU (Ej. MEZ-AZUL-01)"
                    className="h-8 text-xs font-mono font-bold"
                  />
                  <Input
                    value={newSkuName}
                    onChange={(e) => setNewSkuName(e.target.value)}
                    placeholder="Nombre del producto final..."
                    className="h-8 text-xs"
                  />
                  <Input
                    type="number"
                    step="0.01"
                    value={newSkuPvp}
                    onChange={(e) => setNewSkuPvp(e.target.value)}
                    placeholder={`PVP Sugerido ($${((totalBatchCost / pkgUnitsNum) * 1.35).toFixed(2)})`}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              )}

              {outputAction === 'REFILL' && (
                <div className="space-y-2 p-2.5 rounded-xl bg-muted/40 border border-border/60 mt-2">
                  <Input
                    value={refillSearch}
                    onChange={(e) => setRefillSearch(e.target.value)}
                    placeholder="Filtrar SKU destino..."
                    className="h-7 text-xs"
                  />
                  <Select value={refillTargetSku} onValueChange={setRefillTargetSku}>
                    <SelectTrigger className="h-8 text-xs font-bold">
                      <SelectValue placeholder="Seleccionar SKU a rellenar..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {inventory
                        .filter(
                          (p) =>
                            !refillSearch.trim() ||
                            (p.sku || '').toLowerCase().includes(refillSearch.toLowerCase()) ||
                            (p.name || '').toLowerCase().includes(refillSearch.toLowerCase())
                        )
                        .slice(0, 40)
                        .map((p) => (
                          <SelectItem key={p.sku} value={p.sku} className="text-xs">
                            {p.sku} — {p.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observaciones / Orden de producción (opc.)"
                className="h-8 text-xs"
              />
            </div>

            <Button
              type="button"
              onClick={handleProcessBatch}
              disabled={processing || ingredients.length === 0}
              className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs gap-1.5 shadow-md shadow-emerald-600/20"
            >
              {processing ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              Procesar y Actualizar Inventario
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
