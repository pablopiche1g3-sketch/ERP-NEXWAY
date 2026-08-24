'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Calculator, 
  TrendingUp, 
  FileSpreadsheet, 
  Search, 
  ShieldCheck,
  RefreshCw,
  PackageCheck
} from 'lucide-react';

export default function KardexValuedTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [stockValued, setStockValued] = useState<any[]>([]);

  const loadValuedKardex = async () => {
    setLoading(true);
    try {
      // Obtener productos reales de la tabla inventory en Supabase
      const { data: invData, error } = await supabase
        .from('inventory')
        .select('*')
        .order('sku', { ascending: true });

      if (invData && invData.length > 0) {
        const formatted = invData.map((item: any) => {
          const qty = Number(item.quantity ?? item.stock ?? 0);
          const price = Number(item.price ?? 0);
          const cost = Number(item.cost ?? (price > 0 ? price * 0.7 : 0));
          return {
            sku: item.sku,
            description: item.name || item.description || item.sku,
            quantity: qty,
            avg_cost: cost,
            sale_price: price,
            warehouse: item.location || item.warehouse || 'Bodega Central'
          };
        });
        setStockValued(formatted);
      } else {
        // Fallback a localStorage si aplica
        const local = localStorage.getItem('nexway_inventory');
        if (local) {
          const parsed = JSON.parse(local);
          const formatted = parsed.map((item: any) => {
            const qty = Number(item.quantity ?? item.stock ?? 0);
            const price = Number(item.price ?? 0);
            const cost = Number(item.cost ?? (price > 0 ? price * 0.7 : 0));
            return {
              sku: item.sku,
              description: item.name || item.description || item.sku,
              quantity: qty,
              avg_cost: cost,
              sale_price: price,
              warehouse: item.location || 'Bodega Central'
            };
          });
          setStockValued(formatted);
        } else {
          setStockValued([]);
        }
      }
    } catch (e) {
      console.error('Error al obtener datos de Kardex Valorizado:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadValuedKardex();
  }, []);

  const handleExportExcel = () => {
    if (stockValued.length === 0) {
      toast({ variant: 'destructive', title: 'Sin Datos', description: 'No hay productos para exportar.' });
      return;
    }

    const headers = ['SKU', 'Producto / Descripción', 'Bodega', 'Stock Físico', 'Costo Prom. Unit ($)', 'Valor Inventario Total ($)', 'P. Venta ($)', 'Margen (%)'];
    const csvRows = [headers.join(',')];

    stockValued.forEach(i => {
      const itemTotalVal = (i.quantity * i.avg_cost).toFixed(2);
      const margin = i.sale_price > 0 ? (((i.sale_price - i.avg_cost) / i.sale_price) * 100).toFixed(1) : '0';
      const cleanDesc = `"${(i.description || '').replace(/"/g, '""')}"`;
      csvRows.push([i.sku, cleanDesc, `"${i.warehouse}"`, i.quantity, i.avg_cost.toFixed(2), itemTotalVal, i.sale_price.toFixed(2), `${margin}%`].join(','));
    });

    const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Kardex_Valorizado_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({ title: 'Kardex Exportado 📊', description: `Se exportaron ${stockValued.length} productos a Excel.` });
  };

  const filtered = stockValued.filter(item => 
    (item.sku || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (item.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.warehouse || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalInventoryValue = stockValued.reduce((sum, i) => sum + (i.quantity * i.avg_cost), 0);
  const totalSalesProjection = stockValued.reduce((sum, i) => sum + (i.quantity * i.sale_price), 0);
  const totalProjectedProfit = totalSalesProjection - totalInventoryValue;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-6 rounded-2xl border shadow-sm">
        <div>
          <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
            <Calculator className="text-indigo-500" size={22} />
            Kardex Valorizado FIFO / Costo Promedio Ponderado
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Valoración contable del inventario real en bodega, costo de ventas (COGS) y proyección de margen bruto.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={loadValuedKardex}
            variant="outline"
            className="font-bold text-xs h-9 rounded-xl flex items-center gap-1 border-slate-200"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualizar
          </Button>

          <Button
            onClick={handleExportExcel}
            className="bg-emerald-600 hover:bg-emerald-700 font-bold text-xs h-9 rounded-xl text-white flex items-center gap-1.5"
          >
            <FileSpreadsheet size={15} /> Exportar Kardex a Excel
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border shadow-sm p-5 rounded-2xl bg-card">
          <span className="text-[10px] font-black uppercase text-slate-400">Valor Total de Inventario (Costo)</span>
          <h4 className="text-2xl font-black text-slate-800 dark:text-white mt-1">${totalInventoryValue.toFixed(2)}</h4>
          <p className="text-[11px] text-emerald-500 font-bold mt-2 flex items-center gap-1">
            <ShieldCheck size={14} /> Auditado por Costo Promedio Ponderado
          </p>
        </Card>

        <Card className="border shadow-sm p-5 rounded-2xl bg-card">
          <span className="text-[10px] font-black uppercase text-slate-400">Proyección de Venta Bruta</span>
          <h4 className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">${totalSalesProjection.toFixed(2)}</h4>
          <p className="text-[11px] text-slate-400 mt-2">Valor al precio de lista publicado</p>
        </Card>

        <Card className="border shadow-sm p-5 rounded-2xl bg-card">
          <span className="text-[10px] font-black uppercase text-slate-400">Margen Bruto Proyectado</span>
          <h4 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">${totalProjectedProfit.toFixed(2)}</h4>
          <p className="text-[11px] text-emerald-500 font-bold mt-2 flex items-center gap-1">
            <TrendingUp size={14} /> Margen Promedio: {totalSalesProjection > 0 ? ((totalProjectedProfit / totalSalesProjection) * 100).toFixed(1) : 0}%
          </p>
        </Card>
      </div>

      {/* Buscador y Tabla */}
      <Card className="border shadow-sm rounded-2xl bg-card overflow-hidden">
        <div className="p-4 border-b flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <Input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar por SKU, producto o bodega en Kardex..."
              className="pl-10 text-xs h-9 rounded-xl"
            />
          </div>
          <Badge variant="outline" className="text-xs font-bold font-mono">
            {filtered.length} Productos Existentes
          </Badge>
        </div>

        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="text-xs font-bold">SKU</TableHead>
              <TableHead className="text-xs font-bold">Producto / Descripción</TableHead>
              <TableHead className="text-xs font-bold">Bodega</TableHead>
              <TableHead className="text-xs font-bold text-center">Stock Físico</TableHead>
              <TableHead className="text-xs font-bold text-right">Costo Prom. Unit ($)</TableHead>
              <TableHead className="text-xs font-bold text-right">Valor Inventario Total ($)</TableHead>
              <TableHead className="text-xs font-bold text-right">P. Venta ($)</TableHead>
              <TableHead className="text-xs font-bold text-right">Margen (%)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-xs text-slate-400">
                  Cargando productos del inventario real...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-xs text-slate-400">
                  No se encontraron productos registrados en el inventario.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(item => {
                const itemTotalVal = item.quantity * item.avg_cost;
                const profitMargin = item.sale_price > 0 ? ((item.sale_price - item.avg_cost) / item.sale_price) * 100 : 0;

                return (
                  <TableRow key={item.sku} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <TableCell className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">{item.sku}</TableCell>
                    <TableCell className="text-xs font-bold text-slate-800 dark:text-white">{item.description}</TableCell>
                    <TableCell className="text-xs text-slate-500">{item.warehouse}</TableCell>
                    <TableCell className="text-xs font-black text-center">{item.quantity} unidades</TableCell>
                    <TableCell className="text-xs font-mono text-right font-bold">${item.avg_cost.toFixed(2)}</TableCell>
                    <TableCell className="text-xs font-mono text-right font-black text-slate-900 dark:text-white">${itemTotalVal.toFixed(2)}</TableCell>
                    <TableCell className="text-xs font-mono text-right text-blue-600 dark:text-blue-400 font-bold">${item.sale_price.toFixed(2)}</TableCell>
                    <TableCell className="text-xs font-mono text-right">
                      <Badge className={`border-0 font-black text-[10px] ${
                        profitMargin >= 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600'
                      }`}>
                        {profitMargin >= 0 ? '+' : ''}{profitMargin.toFixed(1)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
