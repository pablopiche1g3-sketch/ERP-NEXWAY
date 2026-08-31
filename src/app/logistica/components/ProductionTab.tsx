'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Factory, 
  Layers, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  Boxes, 
  ArrowRight, 
  History, 
  Calculator, 
  Sparkles, 
  Search, 
  Warehouse as WarehouseIcon, 
  FileText,
  Calendar,
  UserCheck
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/supabase/use-user';
import { fetchSystemAppUsers } from '@/lib/session-operator';

export interface RecipeIngredient {
  sku: string;
  name: string;
  quantity: number;
  wastePercent: number; // Porcentaje de merma esperada
}

export interface ProductionRecipe {
  id: string;
  name: string;
  targetSku: string;
  targetName: string;
  yieldQuantity: number; // Cantidad de producto terminado que produce 1 lote
  ingredients: RecipeIngredient[];
  description?: string;
  created_at: string;
}

export interface ProductionOrder {
  id: string;
  recipeId: string;
  recipeName: string;
  targetSku: string;
  targetName: string;
  lots: number;
  producedQuantity: number;
  warehouseId: string;
  warehouseName: string;
  responsibleEmail: string;
  totalCost: number;
  unitCost: number;
  created_at: string;
}

export default function ProductionTab() {
  const { toast } = useToast();
  const { user } = useUser();

  const [activeSubTab, setActiveSubTab] = useState<'fabricar' | 'recetas' | 'historial'>('fabricar');
  const [loading, setLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Datos del Sistema
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  const [recipes, setRecipes] = useState<ProductionRecipe[]>([]);
  const [productionHistory, setProductionHistory] = useState<ProductionOrder[]>([]);
  const [appUsers, setAppUsers] = useState<any[]>([]);

  // Formulario de Ejecución de Producción
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>('');
  const [productionLots, setProductionLots] = useState<number>(1);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [operatorEmail, setOperatorEmail] = useState<string>('');

  // Modal de Crear / Editar Receta (BOM)
  const [isRecipeDialogOpen, setIsRecipeDialogOpen] = useState(false);
  const [newRecipeName, setNewRecipeName] = useState('');
  const [newRecipeTargetSku, setNewRecipeTargetSku] = useState('');
  const [newRecipeYield, setNewRecipeYield] = useState<number>(1);
  const [newRecipeDescription, setNewRecipeDescription] = useState('');
  const [newRecipeIngredients, setNewRecipeIngredients] = useState<RecipeIngredient[]>([]);

  // Selector de Insumo para agregar a la receta
  const [selectedIngredientSku, setSelectedIngredientSku] = useState('');
  const [ingredientQuantity, setIngredientQuantity] = useState<number>(1);
  const [ingredientWaste, setIngredientWaste] = useState<number>(0);

  // Cargar Datos Iniciales
  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Cargar Productos de Inventario
      const { data: prods } = await supabase.from('inventory').select('*').order('name');
      setProducts(prods || []);

      // 2. Cargar Bodegas
      const { data: whs } = await supabase.from('warehouses').select('*').order('name');
      setWarehouses(whs || []);
      if (whs && whs.length > 0 && !selectedWarehouseId) {
        setSelectedWarehouseId(whs[0].id);
      }

      // 3. Cargar Usuarios
      const users = await fetchSystemAppUsers();
      setAppUsers(users);
      if (user?.email) setOperatorEmail(user.email);

      // 4. Cargar Fórmulas / Recetas desde system_config
      const { data: recipeConfig } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'production_recipes')
        .maybeSingle();

      if (recipeConfig?.value && Array.isArray(recipeConfig.value)) {
        setRecipes(recipeConfig.value);
        if (recipeConfig.value.length > 0 && !selectedRecipeId) {
          setSelectedRecipeId(recipeConfig.value[0].id);
        }
      }

      // 5. Cargar Historial de Producción
      const { data: historyConfig } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'production_history')
        .maybeSingle();

      if (historyConfig?.value && Array.isArray(historyConfig.value)) {
        setProductionHistory(historyConfig.value);
      }

    } catch (e: any) {
      console.error('Error cargando datos de producción:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Cargar existencias físicas de la bodega seleccionada
  useEffect(() => {
    if (!selectedWarehouseId) return;

    const fetchWarehouseStock = async () => {
      const { data: stocks } = await supabase
        .from('inventory_stock')
        .select('sku, quantity')
        .eq('warehouse_id', selectedWarehouseId);

      const map: Record<string, number> = {};
      (stocks || []).forEach(s => {
        map[s.sku] = parseFloat(s.quantity) || 0;
      });
      setStockMap(map);
    };

    fetchWarehouseStock();
  }, [selectedWarehouseId]);

  // Receta Seleccionada Actualmente
  const activeRecipe = useMemo(() => {
    return recipes.find(r => r.id === selectedRecipeId) || null;
  }, [recipes, selectedRecipeId]);

  // Cálculo de Requerimiento de Insumos según los lotes a producir
  const ingredientRequirements = useMemo(() => {
    if (!activeRecipe) return [];

    return activeRecipe.ingredients.map(ing => {
      const neededPerLot = ing.quantity * (1 + (ing.wastePercent || 0) / 100);
      const totalRequired = neededPerLot * (productionLots || 1);
      const currentStock = stockMap[ing.sku] || 0;
      const hasEnough = currentStock >= totalRequired;
      const prod = products.find(p => p.sku === ing.sku);
      const unitCost = parseFloat(prod?.cost) || parseFloat(prod?.price) * 0.7 || 0;
      const totalCost = totalRequired * unitCost;

      return {
        ...ing,
        totalRequired,
        currentStock,
        hasEnough,
        unitCost,
        totalCost
      };
    });
  }, [activeRecipe, productionLots, stockMap, products]);

  // Total de unidades terminadas a producir
  const totalProducedUnits = useMemo(() => {
    if (!activeRecipe) return 0;
    return activeRecipe.yieldQuantity * (productionLots || 1);
  }, [activeRecipe, productionLots]);

  // Costo total estimado del lote de producción
  const totalProductionCost = useMemo(() => {
    return ingredientRequirements.reduce((acc, ing) => acc + ing.totalCost, 0);
  }, [ingredientRequirements]);

  const unitProductionCost = useMemo(() => {
    if (totalProducedUnits <= 0) return 0;
    return totalProductionCost / totalProducedUnits;
  }, [totalProductionCost, totalProducedUnits]);

  const canProduce = useMemo(() => {
    if (!activeRecipe || productionLots <= 0 || ingredientRequirements.length === 0) return false;
    return ingredientRequirements.every(ing => ing.hasEnough);
  }, [activeRecipe, productionLots, ingredientRequirements]);

  // Agregar Insumo a la Receta en Construcción
  const handleAddIngredient = () => {
    if (!selectedIngredientSku) {
      toast({ variant: 'destructive', title: 'Seleccione un insumo' });
      return;
    }

    const prod = products.find(p => p.sku === selectedIngredientSku);
    if (!prod) return;

    if (newRecipeIngredients.some(i => i.sku === selectedIngredientSku)) {
      toast({ variant: 'destructive', title: 'El insumo ya está en la receta' });
      return;
    }

    setNewRecipeIngredients(prev => [
      ...prev,
      {
        sku: prod.sku,
        name: prod.name,
        quantity: Math.max(0.001, ingredientQuantity),
        wastePercent: Math.max(0, ingredientWaste)
      }
    ]);

    setSelectedIngredientSku('');
    setIngredientQuantity(1);
    setIngredientWaste(0);
  };

  const handleRemoveIngredient = (sku: string) => {
    setNewRecipeIngredients(prev => prev.filter(i => i.sku !== sku));
  };

  // Guardar Nueva Receta / Fórmula (BOM)
  const handleSaveRecipe = async () => {
    if (!newRecipeName.trim() || !newRecipeTargetSku || newRecipeIngredients.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Faltan datos obligatorios',
        description: 'Ingrese el nombre, el producto terminado a fabricar y al menos un insumo.'
      });
      return;
    }

    const targetProd = products.find(p => p.sku === newRecipeTargetSku);
    const newRecipe: ProductionRecipe = {
      id: `REC-${Date.now().toString().slice(-6)}`,
      name: newRecipeName.trim(),
      targetSku: newRecipeTargetSku,
      targetName: targetProd?.name || newRecipeTargetSku,
      yieldQuantity: Math.max(1, newRecipeYield),
      description: newRecipeDescription.trim(),
      ingredients: newRecipeIngredients,
      created_at: new Date().toISOString()
    };

    const updatedRecipes = [...recipes, newRecipe];

    try {
      await supabase.from('system_config').upsert({
        key: 'production_recipes',
        value: updatedRecipes
      }, { onConflict: 'key' });

      setRecipes(updatedRecipes);
      setSelectedRecipeId(newRecipe.id);
      setIsRecipeDialogOpen(false);

      // Limpiar Formulario
      setNewRecipeName('');
      setNewRecipeTargetSku('');
      setNewRecipeYield(1);
      setNewRecipeDescription('');
      setNewRecipeIngredients([]);

      toast({
        title: 'Receta Guardada ✨',
        description: `La fórmula "${newRecipe.name}" está lista para usarse en producción.`
      });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error al guardar receta', description: e.message });
    }
  };

  // Eliminar Receta
  const handleDeleteRecipe = async (id: string) => {
    const updated = recipes.filter(r => r.id !== id);
    try {
      await supabase.from('system_config').upsert({
        key: 'production_recipes',
        value: updated
      }, { onConflict: 'key' });

      setRecipes(updated);
      if (selectedRecipeId === id) {
        setSelectedRecipeId(updated.length > 0 ? updated[0].id : '');
      }
      toast({ title: 'Receta Eliminada' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error al eliminar', description: e.message });
    }
  };

  // 🚀 PROCESAR FABRICACIÓN / ORDEN DE PRODUCCIÓN
  const handleExecuteProduction = async () => {
    if (!canProduce || !activeRecipe || !selectedWarehouseId) {
      toast({
        variant: 'destructive',
        title: 'No se puede procesar la producción',
        description: 'Verifique que haya stock suficiente de todos los insumos requeridos.'
      });
      return;
    }

    setIsProcessing(true);
    const wh = warehouses.find(w => w.id === selectedWarehouseId);
    const orderCorrelative = `OP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    try {
      // 1. Descontar Insumos de Bodega y Registrar en Kardex
      for (const ing of ingredientRequirements) {
        const currentQty = stockMap[ing.sku] || 0;
        const newQty = currentQty - ing.totalRequired;

        await supabase.from('inventory_stock').upsert({
          sku: ing.sku,
          warehouse_id: selectedWarehouseId,
          quantity: newQty
        }, { onConflict: 'sku,warehouse_id' });

        await supabase.from('kardex').insert({
          sku: ing.sku,
          movement_type: 'PRODUCCION_SALIDA',
          location: wh?.name || 'Bodega Principal',
          document_ref: orderCorrelative,
          qty_in: 0,
          qty_out: ing.totalRequired,
          balance: newQty,
          unit_cost: ing.unitCost
        });
      }

      // 2. Ingresar Producto Terminado a Bodega y Registrar en Kardex
      const targetCurrentQty = stockMap[activeRecipe.targetSku] || 0;
      const targetNewQty = targetCurrentQty + totalProducedUnits;

      await supabase.from('inventory_stock').upsert({
        sku: activeRecipe.targetSku,
        warehouse_id: selectedWarehouseId,
        quantity: targetNewQty
      }, { onConflict: 'sku,warehouse_id' });

      await supabase.from('kardex').insert({
        sku: activeRecipe.targetSku,
        movement_type: 'PRODUCCION_ENTRADA',
        location: wh?.name || 'Bodega Principal',
        document_ref: orderCorrelative,
        qty_in: totalProducedUnits,
        qty_out: 0,
        balance: targetNewQty,
        unit_cost: unitProductionCost
      });

      // 3. Registrar Asiento Contable Automático (Transformación de Insumos a Producto Terminado)
      try {
        await supabase.from('journal').insert({
          concept: `Orden de Producción [${orderCorrelative}] - Fabricación de ${totalProducedUnits}x ${activeRecipe.targetName}`,
          document_ref: orderCorrelative,
          amount: totalProductionCost,
          lines: [
            { account_code: '1105', account_name: 'Inventario de Producto Terminado', debit: totalProductionCost, credit: 0 },
            { account_code: '1105', account_name: 'Inventario de Materias Primas e Insumos', debit: 0, credit: totalProductionCost }
          ]
        });
      } catch (jErr) {
        console.warn('Error al registrar partida contable de producción:', jErr);
      }

      // 4. Guardar Orden en el Historial de Producción
      const newOrder: ProductionOrder = {
        id: orderCorrelative,
        recipeId: activeRecipe.id,
        recipeName: activeRecipe.name,
        targetSku: activeRecipe.targetSku,
        targetName: activeRecipe.targetName,
        lots: productionLots,
        producedQuantity: totalProducedUnits,
        warehouseId: selectedWarehouseId,
        warehouseName: wh?.name || 'Bodega Principal',
        responsibleEmail: operatorEmail || user?.email || 'Operador de Planta',
        totalCost: totalProductionCost,
        unitCost: unitProductionCost,
        created_at: new Date().toISOString()
      };

      const updatedHistory = [newOrder, ...productionHistory];
      await supabase.from('system_config').upsert({
        key: 'production_history',
        value: updatedHistory
      }, { onConflict: 'key' });

      setProductionHistory(updatedHistory);

      // Recargar Stock Local
      const { data: updatedStocks } = await supabase
        .from('inventory_stock')
        .select('sku, quantity')
        .eq('warehouse_id', selectedWarehouseId);

      const map: Record<string, number> = {};
      (updatedStocks || []).forEach(s => {
        map[s.sku] = parseFloat(s.quantity) || 0;
      });
      setStockMap(map);

      toast({
        title: "¡Producción Completada con Éxito! 🏭",
        description: `Se fabricaron ${totalProducedUnits} unidades de "${activeRecipe.targetName}" y se actualizaron Kardex y Contabilidad.`
      });

    } catch (err: any) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error durante la fabricación', description: err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Subnavegación del Módulo de Producción */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 text-white p-4 rounded-3xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-2xl">
            <Factory size={26} />
          </div>
          <div>
            <h3 className="text-base font-black tracking-tight">Centro de Producción & Fórmulas (BOM)</h3>
            <p className="text-xs text-slate-400">Ensambles, recetas industriales y transformación de materias primas.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setIsRecipeDialogOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 rounded-xl shadow-md flex items-center gap-1.5"
          >
            <Plus size={15} /> Nueva Fórmula / Receta
          </Button>
        </div>
      </div>

      <Tabs value={activeSubTab} onValueChange={(v: any) => setActiveSubTab(v)} className="space-y-4">
        <TabsList className="bg-muted p-1 rounded-2xl">
          <TabsTrigger value="fabricar" className="rounded-xl text-xs font-bold gap-1.5">
            <Boxes size={14} /> Ejecutar Fabricación
          </TabsTrigger>
          <TabsTrigger value="recetas" className="rounded-xl text-xs font-bold gap-1.5">
            <Layers size={14} /> Fórmulas Guardadas ({recipes.length})
          </TabsTrigger>
          <TabsTrigger value="historial" className="rounded-xl text-xs font-bold gap-1.5">
            <History size={14} /> Historial de Lotes ({productionHistory.length})
          </TabsTrigger>
        </TabsList>

        {/* ─── PESTAÑA 1: EJECUTAR FABRICACIÓN ──────────────────────── */}
        <TabsContent value="fabricar" className="space-y-6 outline-none">
          {recipes.length === 0 ? (
            <Card className="p-12 text-center border-dashed rounded-3xl space-y-4">
              <Layers size={40} className="mx-auto text-indigo-400 opacity-60" />
              <div>
                <h4 className="text-base font-black">No tienes Fórmulas o Recetas Creadas</h4>
                <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1">
                  Para iniciar una orden de producción, primero crea una receta definiendo los insumos requeridos y el producto terminado.
                </p>
              </div>
              <Button onClick={() => setIsRecipeDialogOpen(true)} className="bg-indigo-600 text-white font-bold rounded-xl">
                <Plus size={15} className="mr-1" /> Crear Primera Fórmula
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Panel de Configuración de la Orden */}
              <Card className="rounded-3xl border shadow-sm p-5 space-y-5 lg:col-span-1 bg-card">
                <div className="space-y-1">
                  <h4 className="text-sm font-black flex items-center gap-1.5">
                    <Factory size={16} className="text-indigo-500" /> Parámetros de Fabricación
                  </h4>
                  <p className="text-[11px] text-muted-foreground">Elige la receta y el número de lotes a producir.</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Fórmula / Receta a Utilizar</Label>
                    <Select value={selectedRecipeId} onValueChange={setSelectedRecipeId}>
                      <SelectTrigger className="rounded-xl font-bold text-xs h-10">
                        <SelectValue placeholder="Seleccione una receta..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl">
                        {recipes.map(r => (
                          <SelectItem key={r.id} value={r.id} className="text-xs font-bold">
                            {r.name} ➔ {r.targetName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold">Lotes a Fabricar</Label>
                      <Input
                        type="number"
                        min={1}
                        value={productionLots}
                        onChange={e => setProductionLots(Math.max(1, parseInt(e.target.value) || 1))}
                        className="h-10 rounded-xl font-black text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold">Total Resultante</Label>
                      <div className="h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center px-3 text-indigo-600 dark:text-indigo-400 font-black text-sm font-mono">
                        {totalProducedUnits} Unidades
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold">Bodega de Producción (Origen & Destino)</Label>
                    <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
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
                    <Label className="text-xs font-bold">Responsable de Planta</Label>
                    <Select value={operatorEmail} onValueChange={setOperatorEmail}>
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

                  {/* Resumen Financiero de Costos */}
                  <div className="p-3.5 bg-muted/40 rounded-2xl border space-y-2 text-xs">
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>Costo Total Insumos:</span>
                      <strong className="text-foreground font-mono font-bold">${totalProductionCost.toFixed(2)}</strong>
                    </div>
                    <div className="flex justify-between items-center text-muted-foreground">
                      <span>Costo Unitario Resultante:</span>
                      <strong className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">${unitProductionCost.toFixed(4)} c/u</strong>
                    </div>
                  </div>

                  <Button
                    onClick={handleExecuteProduction}
                    disabled={!canProduce || isProcessing}
                    className="w-full h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                  >
                    {isProcessing ? <Loader2 size={16} className="animate-spin mr-2" /> : <Sparkles size={16} className="mr-2" />}
                    🚀 Procesar Fabricación en Bodega
                  </Button>
                </div>
              </Card>

              {/* Panel de Insumos y Verificación de Stock */}
              <Card className="rounded-3xl border shadow-sm p-5 space-y-4 lg:col-span-2 bg-card">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-sm font-black flex items-center gap-1.5">
                      <Layers size={16} className="text-indigo-500" /> Verificación de Insumos & Materias Primas
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      El sistema valida las existencias en bodega antes de autorizar el descargo.
                    </p>
                  </div>

                  <Badge className={`border-0 text-[10px] font-black ${canProduce ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500'}`}>
                    {canProduce ? '✓ Stock Suficiente para Producir' : '⚠️ Stock Insuficiente en Insumos'}
                  </Badge>
                </div>

                <div className="border rounded-2xl overflow-hidden">
                  <Table className="text-xs">
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="font-bold">Insumo / Materia Prima</TableHead>
                        <TableHead className="text-center font-bold">Por Lote</TableHead>
                        <TableHead className="text-center font-bold">Merma %</TableHead>
                        <TableHead className="text-center font-bold">Total Requerido</TableHead>
                        <TableHead className="text-center font-bold">Disponible en Bodega</TableHead>
                        <TableHead className="text-center font-bold">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ingredientRequirements.map(ing => (
                        <TableRow key={ing.sku}>
                          <TableCell>
                            <p className="font-bold text-foreground">{ing.name}</p>
                            <span className="text-[10px] text-muted-foreground font-mono">{ing.sku}</span>
                          </TableCell>
                          <TableCell className="text-center font-mono font-bold">{ing.quantity}</TableCell>
                          <TableCell className="text-center font-mono">{ing.wastePercent}%</TableCell>
                          <TableCell className="text-center font-mono font-black text-indigo-600 dark:text-indigo-400">
                            {ing.totalRequired.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-center font-mono font-bold">
                            {ing.currentStock.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-center">
                            {ing.hasEnough ? (
                              <Badge className="bg-emerald-500/20 text-emerald-500 border-0 text-[9px] font-black">
                                Disponible
                              </Badge>
                            ) : (
                              <Badge className="bg-rose-500/20 text-rose-500 border-0 text-[9px] font-black">
                                Faltan {(ing.totalRequired - ing.currentStock).toFixed(2)}
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ─── PESTAÑA 2: FÓRMULAS / RECETAS GUARDADAS (BOM) ────────── */}
        <TabsContent value="recetas" className="space-y-4 outline-none">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recipes.map(r => (
              <Card key={r.id} className="rounded-3xl border shadow-sm p-4 space-y-3 bg-card relative group hover:border-indigo-500/50 transition-all">
                <div className="flex justify-between items-start">
                  <div>
                    <Badge className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-0 text-[9px] font-mono font-black">
                      {r.id}
                    </Badge>
                    <h5 className="text-sm font-black text-foreground mt-1">{r.name}</h5>
                    <p className="text-[11px] text-muted-foreground">Produce: <strong>{r.yieldQuantity}x {r.targetName}</strong></p>
                  </div>

                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDeleteRecipe(r.id)}
                    className="h-7 w-7 text-muted-foreground hover:text-rose-500 rounded-xl"
                  >
                    <Trash2 size={13} />
                  </Button>
                </div>

                <div className="space-y-1.5 pt-2 border-t text-xs">
                  <p className="text-[10px] font-black uppercase text-muted-foreground">Insumos Requeridos ({r.ingredients.length}):</p>
                  <div className="space-y-1">
                    {r.ingredients.map(ing => (
                      <div key={ing.sku} className="flex justify-between items-center text-[11px] bg-muted/40 p-1.5 rounded-lg">
                        <span className="truncate pr-2">{ing.name}</span>
                        <span className="font-mono font-bold shrink-0">{ing.quantity} und {ing.wastePercent > 0 ? `(+${ing.wastePercent}% merma)` : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ─── PESTAÑA 3: HISTORIAL DE LOTES FABRICADOS ──────────────── */}
        <TabsContent value="historial" className="space-y-4 outline-none">
          <Card className="rounded-3xl border shadow-sm overflow-hidden bg-card">
            <Table className="text-xs">
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="font-bold">Orden ID</TableHead>
                  <TableHead className="font-bold">Fecha / Hora</TableHead>
                  <TableHead className="font-bold">Fórmula Utilizada</TableHead>
                  <TableHead className="font-bold">Producto Fabricado</TableHead>
                  <TableHead className="text-center font-bold">Lotes / Cantidad</TableHead>
                  <TableHead className="text-center font-bold">Bodega</TableHead>
                  <TableHead className="text-right font-bold">Costo Total</TableHead>
                  <TableHead className="font-bold">Responsable</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productionHistory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground italic">
                      No hay órdenes de producción ejecutadas aún.
                    </TableCell>
                  </TableRow>
                ) : (
                  productionHistory.map(order => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {order.id}
                      </TableCell>
                      <TableCell>{new Date(order.created_at).toLocaleString()}</TableCell>
                      <TableCell className="font-bold">{order.recipeName}</TableCell>
                      <TableCell>
                        <p className="font-bold text-foreground">{order.targetName}</p>
                        <span className="text-[10px] text-muted-foreground font-mono">{order.targetSku}</span>
                      </TableCell>
                      <TableCell className="text-center font-mono">
                        {order.lots} lotes • <strong className="text-foreground">{order.producedQuantity} unds</strong>
                      </TableCell>
                      <TableCell className="text-center">{order.warehouseName}</TableCell>
                      <TableCell className="text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        ${order.totalCost.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{order.responsibleEmail}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── MODAL: CREAR NUEVA FÓRMULA / RECETA (BOM) ─────────────── */}
      <Dialog open={isRecipeDialogOpen} onOpenChange={setIsRecipeDialogOpen}>
        <DialogContent className="max-w-2xl rounded-3xl p-6 bg-card border shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-black flex items-center gap-2">
              <Factory size={20} className="text-indigo-500" /> Crear Nueva Fórmula / Receta (BOM)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Define los insumos necesarios y el producto terminado resultante.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Nombre de la Receta / Proceso</Label>
                <Input
                  placeholder="Ej: Fabricación Bloque de Concreto 15cm"
                  value={newRecipeName}
                  onChange={e => setNewRecipeName(e.target.value)}
                  className="rounded-xl text-xs h-10"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Producto Terminado a Fabricar</Label>
                <Select value={newRecipeTargetSku} onValueChange={setNewRecipeTargetSku}>
                  <SelectTrigger className="rounded-xl font-bold text-xs h-10">
                    <SelectValue placeholder="Seleccione producto destino..." />
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
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Rendimiento por Lote (Unidades Resultantes)</Label>
                <Input
                  type="number"
                  min={1}
                  value={newRecipeYield}
                  onChange={e => setNewRecipeYield(Math.max(1, parseInt(e.target.value) || 1))}
                  className="rounded-xl text-xs h-10 font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Notas u Observaciones del Proceso</Label>
                <Input
                  placeholder="Instrucciones de mezcla, tiempo de curado..."
                  value={newRecipeDescription}
                  onChange={e => setNewRecipeDescription(e.target.value)}
                  className="rounded-xl text-xs h-10"
                />
              </div>
            </div>

            {/* Selector de Insumos */}
            <div className="p-4 bg-muted/40 rounded-2xl border space-y-3">
              <Label className="text-xs font-black uppercase tracking-wider text-foreground">Agregar Insumos / Materias Primas</Label>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <div className="sm:col-span-2">
                  <Select value={selectedIngredientSku} onValueChange={setSelectedIngredientSku}>
                    <SelectTrigger className="rounded-xl font-bold text-xs h-9 bg-background">
                      <SelectValue placeholder="Buscar insumo..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl max-h-48">
                      {products.map(p => (
                        <SelectItem key={p.sku} value={p.sku} className="text-xs font-bold">
                          {p.name} ({p.sku})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Cantidad"
                    value={ingredientQuantity}
                    onChange={e => setIngredientQuantity(parseFloat(e.target.value) || 0)}
                    className="h-9 rounded-xl text-xs font-bold bg-background"
                  />
                </div>

                <div>
                  <Button
                    type="button"
                    onClick={handleAddIngredient}
                    className="w-full h-9 rounded-xl bg-indigo-600 text-white font-bold text-xs"
                  >
                    <Plus size={14} className="mr-1" /> Agregar
                  </Button>
                </div>
              </div>

              {/* Lista de Insumos agregados */}
              <div className="space-y-1.5 pt-2">
                {newRecipeIngredients.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground italic text-center py-2">No has agregado insumos a la fórmula.</p>
                ) : (
                  newRecipeIngredients.map(ing => (
                    <div key={ing.sku} className="flex justify-between items-center bg-background p-2 rounded-xl border text-xs">
                      <div>
                        <strong className="text-foreground">{ing.name}</strong>
                        <span className="text-[10px] text-muted-foreground font-mono ml-2">{ing.sku}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-black text-indigo-600 dark:text-indigo-400">{ing.quantity} und</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleRemoveIngredient(ing.sku)}
                          className="h-6 w-6 text-muted-foreground hover:text-rose-500 rounded-lg"
                        >
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="flex gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => setIsRecipeDialogOpen(false)} className="rounded-xl text-xs font-bold">
              Cancelar
            </Button>
            <Button onClick={handleSaveRecipe} className="rounded-xl bg-indigo-600 text-white text-xs font-black">
              Guardar Fórmula
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
