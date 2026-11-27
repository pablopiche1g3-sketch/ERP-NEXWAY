'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Gift,
  Plus,
  Trash2,
  Save,
  Search,
  Loader2,
  CheckCircle2,
  Package,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  loadProductCombos,
  saveProductCombos,
  type ProductCombo,
  type ProductComboItem,
} from '@/lib/product-combos';

export default function ProductCombosTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [combos, setCombos] = useState<ProductCombo[]>([]);
  const [inventory, setInventory] = useState<Array<{ sku: string; name: string; price: number }>>([]);
  const [prodSearch, setProdSearch] = useState('');

  // Formulario de Combo
  const [editingId, setEditingId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetComboPrice, setTargetComboPrice] = useState('');
  const [items, setItems] = useState<ProductComboItem[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [loadedCombos, invRes] = await Promise.all([
          loadProductCombos(),
          supabase.from('inventory').select('sku, name, price').order('name').limit(1000),
        ]);
        setCombos(loadedCombos);
        setInventory((invRes.data || []).map((i: any) => ({ sku: i.sku, name: i.name || i.sku, price: Number(i.price || 0) })));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filteredProducts = useMemo(() => {
    const q = prodSearch.trim().toLowerCase();
    return inventory
      .filter(p => !q || p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q))
      .slice(0, 30);
  }, [inventory, prodSearch]);

  const itemsSum = useMemo(
    () => items.reduce((s, it) => s + Number(it.quantity || 0) * Number(it.unitPrice || 0), 0),
    [items]
  );

  const handleAddComponent = (p: { sku: string; name: string; price: number }) => {
    if (items.some(i => i.sku === p.sku)) {
      setItems(prev => prev.map(i => (i.sku === p.sku ? { ...i, quantity: i.quantity + 1 } : i)));
      return;
    }
    setItems(prev => [...prev, { sku: p.sku, name: p.name, quantity: 1, unitPrice: p.price }]);
  };

  // Prorratea el precio objetivo del combo entre los ítems para que si se factura parcial el total sea exacto
  const handleProrateComboPrice = () => {
    const target = parseFloat(targetComboPrice) || 0;
    if (target <= 0 || items.length === 0) return;
    const baseSum = items.reduce((s, it) => s + Math.max(0.01, it.unitPrice) * it.quantity, 0);
    if (baseSum <= 0) return;
    const factor = target / baseSum;
    setItems(prev =>
      prev.map(it => ({
        ...it,
        unitPrice: Number((Math.max(0.01, it.unitPrice) * factor).toFixed(2)),
      }))
    );
    toast({ title: 'Precio de combo prorrateado ✓', description: `Los componentes ahora suman ~$${target.toFixed(2)}.` });
  };

  const resetForm = () => {
    setEditingId(null);
    setCode('');
    setName('');
    setDescription('');
    setTargetComboPrice('');
    setItems([]);
  };

  const handleSaveCombo = async () => {
    if (!name.trim() || items.length < 2) {
      toast({
        variant: 'destructive',
        title: 'Datos incompletos',
        description: 'Asigna un nombre y al menos 2 productos al combo.',
      });
      return;
    }
    setSaving(true);
    try {
      const finalPrice = Number(itemsSum.toFixed(2));
      const newCombo: ProductCombo = {
        id: editingId || `COMBO-${Date.now().toString().slice(-6)}`,
        code: (code.trim() || `CMB-${Date.now().toString().slice(-4)}`).toUpperCase(),
        name: name.trim(),
        description: description.trim(),
        comboPrice: finalPrice,
        active: true,
        items,
        createdAt: new Date().toISOString(),
      };

      const nextList = editingId
        ? combos.map(c => (c.id === editingId ? newCombo : c))
        : [newCombo, ...combos];

      const ok = await saveProductCombos(nextList);
      if (!ok) throw new Error('No se pudo guardar en system_config');

      setCombos(nextList);
      resetForm();
      toast({
        title: editingId ? 'Combo Actualizado ✓' : 'Combo Creado ✓',
        description: `"${newCombo.name}" ($${finalPrice.toFixed(2)}) ya está disponible en el botón Combos de Facturación POS.`,
      });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err?.message || 'No se pudo guardar el combo.' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (comboId: string) => {
    const next = combos.map(c => (c.id === comboId ? { ...c, active: !c.active } : c));
    setCombos(next);
    await saveProductCombos(next);
  };

  const handleDeleteCombo = async (comboId: string) => {
    const next = combos.filter(c => c.id !== comboId);
    setCombos(next);
    await saveProductCombos(next);
    toast({ title: 'Combo eliminado' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-xs text-muted-foreground gap-2">
        <Loader2 size={16} className="animate-spin text-indigo-600" /> Cargando combos y catálogo...
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* Izquierda: Constructor de Combo */}
      <Card className="lg:col-span-6 bg-card border-border rounded-2xl shadow-sm">
        <CardHeader className="p-5 border-b border-border">
          <CardTitle className="text-sm font-black flex items-center gap-2">
            <Gift size={16} className="text-indigo-600" />
            {editingId ? 'Editar Kit de Complementos' : 'Crear Kit / Producto con Complementos'}
          </CardTitle>
          <CardDescription className="text-xs">
            Agrupa productos que llevan complementos (ej. pintura + catalizador/diluyente). En Facturación POS se desglosan automáticamente y puedes quitar ítems para facturarlo parcial.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Código Combo</Label>
              <Input
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="Ej. CMB-PINT-01"
                className="h-8 text-xs font-mono mt-1"
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Nombre del Combo</Label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ej. Combo Pintura + Rodillo + Brocha"
                className="h-8 text-xs font-semibold mt-1"
              />
            </div>
          </div>

          {/* Buscador de productos para agregar al combo */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold uppercase text-muted-foreground">Agregar Productos al Combo</Label>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={prodSearch}
                onChange={e => setProdSearch(e.target.value)}
                placeholder="Buscar SKU o producto..."
                className="pl-8 h-8 text-xs rounded-lg"
              />
            </div>
            <div className="max-h-36 overflow-y-auto rounded-xl border border-border bg-background/60 divide-y divide-border/50">
              {filteredProducts.map(p => (
                <button
                  key={p.sku}
                  type="button"
                  onClick={() => handleAddComponent(p)}
                  className="w-full px-3 py-1.5 text-left text-xs hover:bg-indigo-50/70 dark:hover:bg-indigo-950/30 flex items-center justify-between gap-2"
                >
                  <span className="truncate">
                    <strong className="font-mono text-indigo-600 dark:text-indigo-400 mr-1.5">{p.sku}</strong>
                    {p.name}
                  </span>
                  <span className="font-mono font-bold text-emerald-600 shrink-0">+ ${p.price.toFixed(2)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Lista de componentes seleccionados */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">
                Componentes del Combo ({items.length})
              </Label>
              <span className="text-xs font-mono font-black text-indigo-600 dark:text-indigo-400">
                Total Combo: ${itemsSum.toFixed(2)}
              </span>
            </div>

            {items.length === 0 ? (
              <p className="text-xs text-muted-foreground italic text-center py-4 border border-dashed border-border rounded-xl">
                Haz clic en los productos arriba para armar tu combo.
              </p>
            ) : (
              <div className="space-y-1.5">
                {items.map((it, idx) => (
                  <div key={it.sku} className="flex items-center gap-2 p-2 rounded-xl border border-border bg-muted/20 text-xs">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold truncate">{it.name}</div>
                      <div className="text-[10px] font-mono text-muted-foreground">{it.sku}</div>
                    </div>
                    <Input
                      type="number"
                      min={1}
                      value={it.quantity}
                      onChange={e =>
                        setItems(prev =>
                          prev.map((x, i) => (i === idx ? { ...x, quantity: Math.max(1, Number(e.target.value) || 1) } : x))
                        )
                      }
                      className="w-14 h-7 text-xs text-center font-mono"
                      title="Cantidad"
                    />
                    <Input
                      type="number"
                      step="0.01"
                      value={it.unitPrice}
                      onChange={e =>
                        setItems(prev =>
                          prev.map((x, i) => (i === idx ? { ...x, unitPrice: Math.max(0, parseFloat(e.target.value) || 0) } : x))
                        )
                      }
                      className="w-20 h-7 text-xs text-right font-mono font-bold"
                      title="Precio unitario en combo"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}
                      className="h-7 w-7 text-rose-600"
                    >
                      <Trash2 size={12} />
                    </Button>
                  </div>
                ))}

                {/* Prorrateo rápido de precio objetivo del combo */}
                <div className="flex items-center gap-2 pt-1">
                  <Input
                    type="number"
                    step="0.01"
                    value={targetComboPrice}
                    onChange={e => setTargetComboPrice(e.target.value)}
                    placeholder="Precio total especial del combo ($)..."
                    className="h-8 text-xs font-mono"
                  />
                  <Button type="button" size="sm" variant="outline" onClick={handleProrateComboPrice} className="h-8 text-xs font-bold shrink-0">
                    Ajustar Precios
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            {editingId && (
              <Button type="button" variant="outline" onClick={resetForm} className="h-9 rounded-xl text-xs">
                Cancelar
              </Button>
            )}
            <Button
              type="button"
              disabled={saving || items.length < 2 || !name.trim()}
              onClick={handleSaveCombo}
              className="flex-1 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold gap-1.5"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {editingId ? 'Guardar Cambios del Combo' : 'Guardar Combo'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Derecha: Catálogo de Combos Activos */}
      <Card className="lg:col-span-6 bg-card border-border rounded-2xl shadow-sm">
        <CardHeader className="p-5 border-b border-border">
          <CardTitle className="text-sm font-black flex items-center gap-2">
            <Package size={16} className="text-emerald-600" />
            Combos Configurados ({combos.length})
          </CardTitle>
          <CardDescription className="text-xs">
            Todos los combos activos aparecen en el botón <strong>Combos</strong> de Facturación POS.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 space-y-3 max-h-[540px] overflow-y-auto">
          {combos.length === 0 ? (
            <p className="text-xs text-muted-foreground italic text-center py-12">
              Aún no has creado ningún combo. Crea el primero a la izquierda.
            </p>
          ) : (
            combos.map(c => (
              <div key={c.id} className="p-3.5 rounded-xl border border-border bg-background/60 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-[10px] font-bold">{c.code}</Badge>
                      <span className="text-xs font-black text-foreground">{c.name}</span>
                    </div>
                    <div className="text-[11px] font-mono font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                      Precio Combo: ${c.comboPrice.toFixed(2)} ({c.items.length} productos)
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={c.active} onCheckedChange={() => handleToggleActive(c.id)} />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingId(c.id);
                        setCode(c.code);
                        setName(c.name);
                        setDescription(c.description || '');
                        setItems(c.items);
                      }}
                      className="h-7 px-2 text-[10px] rounded-lg"
                    >
                      Editar
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDeleteCombo(c.id)}
                      className="h-7 w-7 text-rose-600"
                    >
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </div>
                <div className="pl-2 border-l-2 border-indigo-500/30 space-y-0.5">
                  {c.items.map(it => (
                    <div key={it.sku} className="text-[11px] text-muted-foreground flex justify-between">
                      <span>{it.quantity}x {it.name} ({it.sku})</span>
                      <span className="font-mono">${(it.quantity * it.unitPrice).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
