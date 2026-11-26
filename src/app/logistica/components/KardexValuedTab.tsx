'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  FileSpreadsheet,
  Search,
  Layers,
  Loader2,
  RefreshCw,
  Pencil,
  Save,
} from 'lucide-react';

interface ValuedRow {
  sku: string;
  description: string;
  category: string;
  quantity: number;
  avg_cost: number;
  last_purchase_cost: number | null;
  purchase_count: number;
  sale_price: number;
  warehouse: string;
}

export default function KardexValuedTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [stockValued, setStockValued] = useState<ValuedRow[]>([]);

  // Modal de Edición Rápida de Producto directo desde Kardex
  const [editingProd, setEditingProd] = useState<ValuedRow | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const loadValuedKardex = async () => {
    setLoading(true);
    try {
      const [invRes, stockRes, purchItemsRes] = await Promise.all([
        supabase.from('inventory').select('*').order('sku', { ascending: true }),
        supabase.from('inventory_stock').select('sku, quantity, warehouses(name)'),
        supabase
          .from('purchase_items')
          .select('sku, quantity, cost, subtotal, purchases(created_at)')
          .order('id', { ascending: false })
          .limit(3000),
      ]);

      const invData = invRes.data || [];
      const stockRows = stockRes.data || [];
      const purchRows = purchItemsRes.data || [];

      // 1. Agrupar existencias reales por SKU y bodegas
      const stockBySku: Record<string, { totalQty: number; warehouses: Set<string> }> = {};
      stockRows.forEach((sr: any) => {
        const sku = String(sr.sku || '');
        if (!sku) return;
        const qty = Number(sr.quantity || 0);
        if (!stockBySku[sku]) stockBySku[sku] = { totalQty: 0, warehouses: new Set() };
        stockBySku[sku].totalQty += qty;
        const whName = sr.warehouses?.name;
        if (whName && qty > 0) stockBySku[sku].warehouses.add(whName);
      });

      // 2. Calcular costo promedio ponderado real + último costo de compra desde purchase_items
      const costBySku: Record<
        string,
        { weightedSum: number; qtySum: number; lastCost: number | null; lastTime: number; count: number }
      > = {};

      purchRows.forEach((pi: any) => {
        const sku = String(pi.sku || '');
        const qty = Number(pi.quantity || 0);
        const unitCost = Number(pi.cost || 0) || (qty > 0 ? Number(pi.subtotal || 0) / qty : 0);
        if (!sku || unitCost <= 0) return;

        if (!costBySku[sku]) {
          costBySku[sku] = { weightedSum: 0, qtySum: 0, lastCost: null, lastTime: 0, count: 0 };
        }
        costBySku[sku].weightedSum += unitCost * (qty > 0 ? qty : 1);
        costBySku[sku].qtySum += qty > 0 ? qty : 1;
        costBySku[sku].count += 1;

        const ts = pi.purchases?.created_at ? new Date(pi.purchases.created_at).getTime() : Date.now();
        if (costBySku[sku].lastCost === null || ts >= costBySku[sku].lastTime) {
          costBySku[sku].lastCost = unitCost;
          costBySku[sku].lastTime = ts;
        }
      });

      const formatted: ValuedRow[] = invData.map((item: any) => {
        const stInfo = stockBySku[item.sku];
        const qty = stInfo ? Number(stInfo.totalQty.toFixed(2)) : Number(item.quantity ?? item.stock ?? 0);
        const price = Number(item.price ?? 0);
        const cInfo = costBySku[item.sku];
        const avgCost =
          cInfo && cInfo.qtySum > 0
            ? Number((cInfo.weightedSum / cInfo.qtySum).toFixed(4))
            : Number(item.cost ?? 0);

        const whLabel =
          stInfo && stInfo.warehouses.size > 0
            ? Array.from(stInfo.warehouses).join(', ')
            : item.location || 'Sin stock asignado';

        return {
          sku: item.sku,
          description: item.name || item.description || item.sku,
          category: item.category || 'General',
          quantity: qty,
          avg_cost: avgCost,
          last_purchase_cost: cInfo?.lastCost ?? null,
          purchase_count: cInfo?.count ?? 0,
          sale_price: price,
          warehouse: whLabel,
        };
      });

      setStockValued(formatted);
    } catch (e) {
      console.error('Error al obtener datos de Kardex Valorizado:', e);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cargar el Kardex valorizado.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadValuedKardex();
  }, []);

  const handleOpenQuickEdit = (row: ValuedRow) => {
    setEditingProd(row);
    setEditName(row.description);
    setEditPrice(String(row.sale_price || 0));
    setEditCategory(row.category || 'General');
  };

  const handleSaveQuickEdit = async () => {
    if (!editingProd) return;
    setSavingEdit(true);
    try {
      const { error } = await supabase
        .from('inventory')
        .update({
          name: editName.trim() || editingProd.description,
          price: parseFloat(editPrice) || 0,
          category: editCategory.trim() || 'General',
        })
        .eq('sku', editingProd.sku);
      if (error) throw error;
      toast({
        title: 'Producto Actualizado ✓',
        description: `${editingProd.sku} actualizado en catálogo.`,
      });
      setEditingProd(null);
      await loadValuedKardex();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err?.message || 'No se pudo actualizar el producto.' });
    } finally {
      setSavingEdit(false);
    }
  };

  const filteredStock = useMemo(
    () =>
      stockValued.filter(
        s =>
          s.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.warehouse.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [stockValued, searchTerm]
  );

  const handleExportExcel = () => {
    const headers = ['SKU', 'Producto', 'Bodega', 'Existencia', 'Último Costo Compra ($)', 'Costo Promedio FIFO ($)', 'Valor Inventario ($)', 'PVP ($)', 'Margen %'];
    const rows = filteredStock.map(s => {
      const val = s.quantity * s.avg_cost;
      const margin = s.sale_price > 0 && s.avg_cost > 0 ? ((s.sale_price - s.avg_cost) / s.sale_price) * 100 : 0;
      return [
        s.sku,
        s.description,
        s.warehouse,
        s.quantity.toFixed(2),
        s.last_purchase_cost !== null ? s.last_purchase_cost.toFixed(2) : '0.00',
        s.avg_cost.toFixed(2),
        val.toFixed(2),
        s.sale_price.toFixed(2),
        `${margin.toFixed(1)}%`,
      ];
    });
    const csv = '\uFEFF' + [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Kardex_Valorizado_FIFO_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Kardex Exportado 📊', description: `Se exportaron ${filteredStock.length} productos con costos de compra.` });
  };

  const totalInventoryValue = filteredStock.reduce((sum, s) => sum + s.quantity * s.avg_cost, 0);
  const totalUnits = filteredStock.reduce((sum, s) => sum + s.quantity, 0);
  const totalSaleValue = filteredStock.reduce((sum, s) => sum + s.quantity * s.sale_price, 0);
  const withPurchaseCostCount = filteredStock.filter(s => s.purchase_count > 0).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-black text-foreground flex items-center gap-2">
            <Layers size={18} className="text-indigo-500" />
            Kardex Valorizado FIFO (Sincronizado con Compras)
          </h3>
          <p className="text-xs text-muted-foreground">
            Costos calculados directamente desde facturas de compra (`purchase_items`) y existencias por bodega (`inventory_stock`).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadValuedKardex} disabled={loading} className="h-9 rounded-xl text-xs font-bold gap-1.5">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Actualizar
          </Button>
          <Button size="sm" onClick={handleExportExcel} className="h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-1.5">
            <FileSpreadsheet size={14} /> Exportar CSV
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border rounded-2xl p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase text-muted-foreground">Valor Inventario (Costo Compra)</p>
          <p className="text-2xl font-black font-mono text-foreground mt-1">
            ${totalInventoryValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </Card>
        <Card className="bg-card border-border rounded-2xl p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase text-muted-foreground">Valor Potencial Venta (PVP)</p>
          <p className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">
            ${totalSaleValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </Card>
        <Card className="bg-card border-border rounded-2xl p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase text-muted-foreground">Unidades en Bodegas</p>
          <p className="text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400 mt-1">
            {totalUnits.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
        </Card>
        <Card className="bg-card border-border rounded-2xl p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase text-muted-foreground">SKUs con Costo de Compra</p>
          <p className="text-2xl font-black font-mono text-foreground mt-1">
            {withPurchaseCostCount} <span className="text-xs font-normal text-muted-foreground">/ {filteredStock.length}</span>
          </p>
        </Card>
      </div>

      <Card className="bg-card border-border rounded-2xl shadow-sm overflow-hidden">
        <CardHeader className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar por SKU, producto o bodega en Kardex..."
              className="pl-9 h-9 text-xs rounded-xl"
            />
          </div>
          <span className="text-[11px] text-muted-foreground">
            Usa el botón <strong>Editar</strong> en cualquier fila para actualizar nombre, categoría o PVP.
          </span>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-xs text-muted-foreground gap-2">
              <Loader2 size={16} className="animate-spin text-indigo-600" /> Calculando costos desde Compras...
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/40 border-b border-border text-[10px] font-black uppercase text-muted-foreground">
                  <th className="text-left px-4 py-3">SKU / Producto</th>
                  <th className="text-left px-3 py-3">Bodega</th>
                  <th className="text-right px-3 py-3">Stock</th>
                  <th className="text-right px-3 py-3">Últ. Compra</th>
                  <th className="text-right px-3 py-3">Costo FIFO</th>
                  <th className="text-right px-3 py-3">Valor Inv.</th>
                  <th className="text-right px-3 py-3">PVP</th>
                  <th className="text-right px-3 py-3">Margen</th>
                  <th className="text-right px-4 py-3">Editar</th>
                </tr>
              </thead>
              <tbody>
                {filteredStock.map(row => {
                  const invVal = row.quantity * row.avg_cost;
                  const margin = row.sale_price > 0 && row.avg_cost > 0 ? ((row.sale_price - row.avg_cost) / row.sale_price) * 100 : 0;
                  return (
                    <tr key={row.sku} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="px-4 py-2.5">
                        <div className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{row.sku}</div>
                        <div className="font-semibold text-foreground truncate max-w-[240px]">{row.description}</div>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">{row.warehouse}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold">{row.quantity.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-right font-mono">
                        {row.last_purchase_cost !== null ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">${row.last_purchase_cost.toFixed(2)}</span>
                        ) : (
                          <span className="text-muted-foreground">Sin compra</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold">${row.avg_cost.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-black">${invVal.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold">${row.sale_price.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-right">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-mono ${
                            margin >= 25
                              ? 'text-emerald-600 border-emerald-300'
                              : margin > 0
                              ? 'text-amber-600 border-amber-300'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {margin > 0 ? `${margin.toFixed(1)}%` : '—'}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenQuickEdit(row)}
                          className="h-7 px-2 text-[11px] rounded-lg gap-1"
                        >
                          <Pencil size={11} /> Editar
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Modal Edición Rápida de Producto */}
      <Dialog open={!!editingProd} onOpenChange={open => !open && setEditingProd(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-black">Editar Producto · {editingProd?.sku}</DialogTitle>
            <DialogDescription className="text-xs">
              Modifica el nombre, categoría o precio de venta (PVP) directamente en el catálogo maestro.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-[11px] font-bold">Nombre del Producto</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-9 text-xs mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] font-bold">Categoría</Label>
                <Input value={editCategory} onChange={e => setEditCategory(e.target.value)} className="h-9 text-xs mt-1" />
              </div>
              <div>
                <Label className="text-[11px] font-bold">Precio de Venta PVP ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editPrice}
                  onChange={e => setEditPrice(e.target.value)}
                  className="h-9 text-xs font-mono font-bold mt-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditingProd(null)} className="h-9 rounded-xl text-xs">
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={savingEdit}
              onClick={handleSaveQuickEdit}
              className="h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold gap-1.5"
            >
              {savingEdit ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
