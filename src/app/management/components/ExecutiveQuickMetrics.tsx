'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/supabase/client';
import { TrendingUp, ShoppingBag, DollarSign, Receipt, Award, Loader2 } from 'lucide-react';

export default function ExecutiveQuickMetrics() {
  const [loading, setLoading] = useState(true);
  const [monthSales, setMonthSales] = useState(0);
  const [monthPurchases, setMonthPurchases] = useState(0);
  const [pendingCxc, setPendingCxc] = useState(0);
  const [pendingCxp, setPendingCxp] = useState(0);
  const [topProducts, setTopProducts] = useState<Array<{ sku: string; qty: number; revenue: number }>>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const now = new Date();
        const startMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01T00:00:00.000Z`;

        const [salesRes, purchRes, itemsRes, cfgRes] = await Promise.all([
          supabase.from('sales').select('id, total, payment_method, status, created_at').neq('status', 'CANCELADA'),
          supabase.from('purchases').select('id, total, payment_method, payment_status, created_at'),
          supabase
            .from('sales_items')
            .select('sku, quantity, price, subtotal, sales!inner(created_at, status)')
            .gte('sales.created_at', startMonth)
            .neq('sales.status', 'CANCELADA')
            .limit(1000),
          supabase
            .from('system_config')
            .select('key, value')
            .in('key', ['cxc_payments_registry', 'cxp_payments_registry']),
        ]);

        const cfgRows = cfgRes.data || [];
        const cxcPays: any[] = cfgRows.find((r: any) => r.key === 'cxc_payments_registry')?.value || [];
        const cxpPays: any[] = cfgRows.find((r: any) => r.key === 'cxp_payments_registry')?.value || [];

        const salesData = salesRes.data || [];
        const purchData = purchRes.data || [];

        const mSales = salesData
          .filter((s: any) => s.created_at && s.created_at >= startMonth)
          .reduce((sum: number, s: any) => sum + Number(s.total || 0), 0);

        const mPurch = purchData
          .filter((p: any) => p.created_at && p.created_at >= startMonth)
          .reduce((sum: number, p: any) => sum + Number(p.total || 0), 0);

        const openCxc = salesData
          .filter((s: any) => String(s.payment_method || '').toLowerCase().includes('cred') || s.status === 'PENDIENTE')
          .reduce((sum: number, s: any) => {
            const paid = cxcPays.filter(p => p.sale_id === s.id).reduce((a, b) => a + Number(b.amount || 0), 0);
            return sum + Math.max(0, Number(s.total || 0) - paid);
          }, 0);

        const openCxp = purchData
          .filter((p: any) => p.payment_status !== 'PAGADO' && (String(p.payment_method || '').toLowerCase().includes('cred') || p.payment_status === 'PENDIENTE'))
          .reduce((sum: number, p: any) => {
            const paid = cxpPays.filter(x => x.purchase_id === p.id).reduce((a, b) => a + Number(b.amount || 0), 0);
            return sum + Math.max(0, Number(p.total || 0) - paid);
          }, 0);

        const skuMap: Record<string, { sku: string; qty: number; revenue: number }> = {};
        (itemsRes.data || []).forEach((it: any) => {
          const sku = String(it.sku || '');
          if (!sku) return;
          if (!skuMap[sku]) skuMap[sku] = { sku, qty: 0, revenue: 0 };
          skuMap[sku].qty += Number(it.quantity || 0);
          skuMap[sku].revenue += Number(it.subtotal || Number(it.quantity || 0) * Number(it.price || 0));
        });

        const sortedTop = Object.values(skuMap)
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5);

        setMonthSales(mSales);
        setMonthPurchases(mPurch);
        setPendingCxc(openCxc);
        setPendingCxp(openCxp);
        setTopProducts(sortedTop);
      } catch (err) {
        console.warn('Error cargando métricas ejecutivas:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-xs text-muted-foreground gap-2">
        <Loader2 size={15} className="animate-spin text-indigo-500" /> Calculando métricas del mes...
      </div>
    );
  }

  const netDiff = monthSales - monthPurchases;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-bold uppercase text-[10px]">Ventas del Mes</span>
            <TrendingUp size={15} className="text-emerald-500" />
          </div>
          <p className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">
            ${monthSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Facturado acumulado mes actual</p>
        </Card>

        <Card className="bg-card border-border rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-bold uppercase text-[10px]">Compras del Mes</span>
            <ShoppingBag size={15} className="text-blue-500" />
          </div>
          <p className="text-2xl font-black font-mono text-foreground mt-1">
            ${monthPurchases.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className={`text-[10px] font-bold mt-0.5 ${netDiff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            Flujo Neto Mes: {netDiff >= 0 ? '+' : ''}${netDiff.toFixed(2)}
          </p>
        </Card>

        <Card className="bg-card border-border rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-bold uppercase text-[10px]">Por Cobrar (CxC)</span>
            <DollarSign size={15} className="text-indigo-500" />
          </div>
          <p className="text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400 mt-1">
            ${pendingCxc.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Saldo activo en cartera clientes</p>
        </Card>

        <Card className="bg-card border-border rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-bold uppercase text-[10px]">Por Pagar (CxP)</span>
            <Receipt size={15} className="text-rose-500" />
          </div>
          <p className="text-2xl font-black font-mono text-rose-600 dark:text-rose-400 mt-1">
            ${pendingCxp.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Saldo pendiente a proveedores</p>
        </Card>
      </div>

      {topProducts.length > 0 && (
        <Card className="bg-card border-border rounded-2xl shadow-sm overflow-hidden">
          <CardHeader className="p-4 border-b border-border">
            <CardTitle className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5 text-foreground">
              <Award size={14} className="text-amber-500" /> Top 5 Productos Más Vendidos del Mes
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            {topProducts.map((p, idx) => (
              <div key={p.sku} className="p-3 rounded-xl border border-border bg-background/60 space-y-1">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[9px] font-black">#{idx + 1}</Badge>
                  <span className="text-[10px] font-mono text-muted-foreground">{p.qty} uds</span>
                </div>
                <div className="font-mono text-xs font-black text-indigo-600 dark:text-indigo-400 truncate">{p.sku}</div>
                <div className="font-mono text-sm font-black text-foreground">${p.revenue.toFixed(2)}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
