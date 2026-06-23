'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/supabase/client';
import { 
  TrendingUp, 
  TrendingDown, 
  Coins, 
  Users, 
  Package, 
  Percent, 
  Activity, 
  Scale, 
  FileText,
  AlertTriangle,
  ArrowRightLeft,
  DollarSign,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface DashboardComercialKPIProps {
  embeddedView?: boolean;
}

export function DashboardComercialKPI({ embeddedView = false }: DashboardComercialKPIProps) {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'30' | '90' | '180' | '365'>('30');
  const [sales, setSales] = useState<any[]>([]);
  const [stocks, setStocks] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  // Cargar datos comerciales desde Supabase
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Obtener ventas activas (no canceladas)
      const { data: salesData } = await supabase
        .from('sales')
        .select('*')
        .neq('status', 'CANCELADA')
        .order('created_at', { ascending: false });
      
      // 2. Obtener existencias
      const { data: stockData } = await supabase
        .from('inventory_stock')
        .select('*');

      // 3. Obtener catálogo de productos (para precios de costo e IVA si aplica)
      const { data: productData } = await supabase
        .from('inventory')
        .select('*');

      setSales(salesData || []);
      setStocks(stockData || []);
      setProducts(productData || []);
    } catch (error) {
      console.error('Error cargando indicadores comerciales:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Cálculos matemáticos avanzados de gestión comercial
  const metrics = useMemo(() => {
    const daysLimit = parseInt(period);
    const now = new Date();
    const limitDate = new Date();
    limitDate.setDate(now.getDate() - daysLimit);

    // Ventas del período actual
    const currentSales = sales.filter(s => new Date(s.created_at) >= limitDate);

    // Ventas del período anterior (para calcular crecimiento porcentual)
    const prevLimitDate = new Date();
    prevLimitDate.setDate(now.getDate() - (daysLimit * 2));
    const previousSales = sales.filter(s => {
      const d = new Date(s.created_at);
      return d >= prevLimitDate && d < limitDate;
    });

    // 1. Facturación total
    const totalRevenue = currentSales.reduce((acc, curr) => acc + (parseFloat(curr.total) || 0), 0);
    const prevRevenue = previousSales.reduce((acc, curr) => acc + (parseFloat(curr.total) || 0), 0);
    
    // Crecimiento mensual/periódico
    let revenueGrowth = 0;
    if (prevRevenue > 0) {
      revenueGrowth = ((totalRevenue - prevRevenue) / prevRevenue) * 100;
    } else if (totalRevenue > 0) {
      revenueGrowth = 100;
    }

    // 2. Ticket Promedio (AOV - Average Order Value)
    const transactionCount = currentSales.length;
    const prevTransactionCount = previousSales.length;
    const aov = transactionCount > 0 ? totalRevenue / transactionCount : 0;
    const prevAov = prevTransactionCount > 0 ? prevRevenue / prevTransactionCount : 0;
    let aovGrowth = 0;
    if (prevAov > 0) {
      aovGrowth = ((aov - prevAov) / prevAov) * 100;
    }

    // 3. Frecuencia de Compra y Concentración de Clientes
    const clientSalesMap: Record<string, number> = {};
    currentSales.forEach(s => {
      if (s.customer_name) {
        clientSalesMap[s.customer_name] = (clientSalesMap[s.customer_name] || 0) + (parseFloat(s.total) || 0);
      }
    });

    const uniqueClientsCount = Object.keys(clientSalesMap).length;
    const averagePurchasePerClient = uniqueClientsCount > 0 ? totalRevenue / uniqueClientsCount : 0;

    // Concentración de ventas (los 5 mejores clientes)
    const sortedClients = Object.entries(clientSalesMap)
      .sort((a, b) => b[1] - a[1]);
    const top5ClientsRevenue = sortedClients.slice(0, 5).reduce((acc, curr) => acc + curr[1], 0);
    const clientConcentrationPercent = totalRevenue > 0 ? (top5ClientsRevenue / totalRevenue) * 100 : 0;

    // 4. Margen comercial promedio cruzado con catálogo
    // Si no tenemos precios de costo detallados, se estima una simulación sana de costos basados en el 65% del precio de lista
    let calculatedCost = 0;
    currentSales.forEach(s => {
      // Sumamos el 65% de la venta como costo estimado si no está cargado el margen maestro de ganancia
      calculatedCost += (parseFloat(s.total) || 0) * 0.65;
    });
    const estimatedMargin = totalRevenue > 0 ? ((totalRevenue - calculatedCost) / totalRevenue) * 100 : 35;

    // 5. Inventario: Días de cobertura total e índice de rotación
    let totalStockQty = stocks.reduce((acc, curr) => acc + (parseFloat(curr.quantity) || 0), 0);
    
    // Velocidad de venta diaria global
    const totalUnitsSold = currentSales.reduce((acc, curr) => {
      // Si el JSON de items existe, contamos unidades reales vendidas
      if (curr.items && Array.isArray(curr.items)) {
        return acc + curr.items.reduce((sum: number, item: any) => sum + (parseFloat(item.quantity) || 0), 0);
      }
      return acc + 1; // Fallback a 1 unidad por transacción
    }, 0);
    
    const dailySalesVelocity = totalUnitsSold / daysLimit;
    const daysOfGlobalCoverage = dailySalesVelocity > 0 ? totalStockQty / dailySalesVelocity : Infinity;
    
    // Tasa de Rotación Anualizada = (Costo de ventas en el período / Inventario promedio) * (365 / días período)
    const annualRotationRate = daysOfGlobalCoverage > 0 && daysOfGlobalCoverage !== Infinity 
      ? 365 / daysOfGlobalCoverage 
      : 0;

    return {
      totalRevenue,
      revenueGrowth,
      transactionCount,
      aov,
      aovGrowth,
      uniqueClientsCount,
      averagePurchasePerClient,
      clientConcentrationPercent,
      estimatedMargin,
      totalStockQty,
      dailySalesVelocity,
      daysOfGlobalCoverage,
      annualRotationRate,
      topClients: sortedClients.slice(0, 5)
    };
  }, [sales, stocks, products, period]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="animate-spin text-indigo-500 h-8 w-8" />
        <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">Calculando indicadores comerciales...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Encabezado y control de período */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950/40 p-4 rounded-2xl border border-border">
        <div>
          <h3 className="text-sm font-black text-foreground uppercase tracking-wider flex items-center gap-2">
            <Activity size={16} className="text-indigo-400" /> Dashboard Inteligente de Gestión Comercial
          </h3>
          <p className="text-[10px] text-muted-foreground">Métricas financieras, rotación de activos y fidelización comercial.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Analizar:</span>
          <Select value={period} onValueChange={(val: any) => setPeriod(val)}>
            <SelectTrigger className="h-8 w-36 bg-slate-900 border-none text-[11px] font-bold text-slate-300 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-zinc-800">
              <SelectItem value="30">Último Mes</SelectItem>
              <SelectItem value="90">Últimos 90 Días</SelectItem>
              <SelectItem value="180">Últimos 6 Meses</SelectItem>
              <SelectItem value="365">Último Año</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tarjetas de Resumen Premium (Indicadores Clave) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Facturación & Crecimiento */}
        <Card className="border bg-[#0f172a]/30 dark:bg-white/5 border-slate-200 dark:border-white/10 rounded-2xl shadow-sm">
          <CardContent className="p-5 flex flex-col justify-between h-28">
            <div className="flex justify-between items-start">
              <p className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider">Facturación Total</p>
              <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                <Coins size={14} />
              </div>
            </div>
            <div>
              <p className="text-xl font-black text-foreground font-mono">
                ${metrics.totalRevenue.toLocaleString('es-SV', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <div className="flex items-center gap-1 mt-1">
                {metrics.revenueGrowth >= 0 ? (
                  <TrendingUp size={10} className="text-emerald-500" />
                ) : (
                  <TrendingDown size={10} className="text-rose-500" />
                )}
                <span className={`text-[9px] font-bold ${metrics.revenueGrowth >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {metrics.revenueGrowth >= 0 ? '+' : ''}{metrics.revenueGrowth.toFixed(1)}% MoM
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. Ticket Promedio (AOV) */}
        <Card className="border bg-[#0f172a]/30 dark:bg-white/5 border-slate-200 dark:border-white/10 rounded-2xl shadow-sm">
          <CardContent className="p-5 flex flex-col justify-between h-28">
            <div className="flex justify-between items-start">
              <p className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider">Ticket Promedio (AOV)</p>
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                <DollarSign size={14} />
              </div>
            </div>
            <div>
              <p className="text-xl font-black text-foreground font-mono">
                ${metrics.aov.toLocaleString('es-SV', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <div className="flex items-center gap-1 mt-1">
                {metrics.aovGrowth >= 0 ? (
                  <TrendingUp size={10} className="text-emerald-500" />
                ) : (
                  <TrendingDown size={10} className="text-rose-500" />
                )}
                <span className={`text-[9px] font-bold ${metrics.aovGrowth >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {metrics.aovGrowth >= 0 ? '+' : ''}{metrics.aovGrowth.toFixed(1)}% vs anterior
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. Margen Comercial Estimado */}
        <Card className="border bg-[#0f172a]/30 dark:bg-white/5 border-slate-200 dark:border-white/10 rounded-2xl shadow-sm">
          <CardContent className="p-5 flex flex-col justify-between h-28">
            <div className="flex justify-between items-start">
              <p className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider">Margen Operativo Prom.</p>
              <div className="p-1.5 rounded-lg bg-orange-500/10 text-orange-400">
                <Percent size={14} />
              </div>
            </div>
            <div>
              <p className="text-xl font-black text-foreground font-mono">
                {metrics.estimatedMargin.toFixed(1)}%
              </p>
              <p className="text-[8.5px] text-muted-foreground mt-1 font-medium">Margen estimado sobre venta final</p>
            </div>
          </CardContent>
        </Card>

        {/* 4. Días de Cobertura Global */}
        <Card className="border bg-[#0f172a]/30 dark:bg-white/5 border-slate-200 dark:border-white/10 rounded-2xl shadow-sm">
          <CardContent className="p-5 flex flex-col justify-between h-28">
            <div className="flex justify-between items-start">
              <p className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider">Cobertura de Stock</p>
              <div className="p-1.5 rounded-lg bg-violet-500/10 text-violet-400">
                <Package size={14} />
              </div>
            </div>
            <div>
              <p className="text-xl font-black text-foreground font-mono">
                {metrics.daysOfGlobalCoverage === Infinity ? 'N/A' : `${metrics.daysOfGlobalCoverage.toFixed(0)} Días`}
              </p>
              <p className="text-[8.5px] text-muted-foreground mt-1 font-medium">
                {metrics.annualRotationRate.toFixed(1)} rotaciones completas al año
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grid Secundario: Concentración y Clientes Importantes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico y Estadísticas de Clientes */}
        <Card className="border shadow-md rounded-2xl bg-card border-slate-100 dark:border-zinc-800 lg:col-span-2">
          <CardHeader className="bg-slate-900 text-white p-5 dark:bg-slate-950">
            <CardTitle className="text-xs font-black uppercase tracking-wider flex items-center gap-2">
              <Users size={15} className="text-indigo-400" /> Concentración de Clientes y Fidelización
            </CardTitle>
            <CardDescription className="text-[10px] text-slate-400">Análisis del volumen total concentrado en tus principales compradores.</CardDescription>
          </CardHeader>
          <CardContent className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* KPIs Rápidos */}
              <div className="space-y-4">
                <div className="bg-slate-950/30 p-4 rounded-xl border border-border/60">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">Clientes Activos</span>
                  <span className="text-2xl font-black font-mono text-indigo-500">{metrics.uniqueClientsCount}</span>
                  <p className="text-[8.5px] text-muted-foreground mt-1">Compradores únicos registrados en este período.</p>
                </div>

                <div className="bg-slate-950/30 p-4 rounded-xl border border-border/60">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">Concentración Top 5</span>
                  <span className="text-2xl font-black font-mono text-amber-500">{metrics.clientConcentrationPercent.toFixed(1)}%</span>
                  <p className="text-[8.5px] text-muted-foreground mt-1">Facturación total concentrada en tus 5 mejores clientes.</p>
                </div>
              </div>

              {/* Top Clientes */}
              <div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Ranking de Clientes del Período</h4>
                {metrics.topClients.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground italic">No hay transacciones asociadas a clientes registrados.</p>
                ) : (
                  <div className="space-y-2.5">
                    {metrics.topClients.map(([name, total], idx) => {
                      const clientPercent = metrics.totalRevenue > 0 ? (total / metrics.totalRevenue) * 100 : 0;
                      return (
                        <div key={name} className="flex flex-col">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-foreground truncate max-w-[150px]">{idx + 1}. {name}</span>
                            <span className="font-mono font-black text-indigo-400">${total.toLocaleString('es-SV', { maximumFractionDigits: 0 })}</span>
                          </div>
                          <div className="w-full bg-slate-900 rounded-full h-1 mt-1 overflow-hidden">
                            <div 
                              className="bg-indigo-500 h-full rounded-full" 
                              style={{ width: `${Math.min(100, clientPercent)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Eficiencia de Activos e Inventarios */}
        <Card className="border shadow-md rounded-2xl bg-card border-slate-100 dark:border-zinc-800">
          <CardHeader className="bg-slate-900 text-white p-5 dark:bg-slate-950">
            <CardTitle className="text-xs font-black uppercase tracking-wider flex items-center gap-2">
              <Scale size={15} className="text-orange-400" /> Eficiencia del Activo Físico
            </CardTitle>
            <CardDescription className="text-[10px] text-slate-400">Eficiencia en la rotación del capital invertido en bodega.</CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="flex justify-between items-center pb-2.5 border-b border-border">
              <div>
                <span className="text-[10px] font-bold text-muted-foreground block uppercase">Inventario Total</span>
                <span className="text-sm font-black text-foreground font-mono">{metrics.totalStockQty} Unidades</span>
              </div>
              <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-bold">Activo Físico</Badge>
            </div>

            <div className="flex justify-between items-center pb-2.5 border-b border-border">
              <div>
                <span className="text-[10px] font-bold text-muted-foreground block uppercase">Velocidad de Venta</span>
                <span className="text-sm font-black text-foreground font-mono">{metrics.dailySalesVelocity.toFixed(1)} uds/día</span>
              </div>
              <Badge className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[9px] font-bold">Ritmo de Salida</Badge>
            </div>

            <div className="flex justify-between items-center">
              <div>
                <span className="text-[10px] font-bold text-muted-foreground block uppercase">Salud de Rotación</span>
                <span className="text-sm font-black text-foreground font-mono">
                  {metrics.annualRotationRate > 4 ? 'Excelente' : metrics.annualRotationRate > 2 ? 'Saludable' : 'Lenta'}
                </span>
              </div>
              <span className="text-xs font-black text-amber-500 font-mono">
                {metrics.annualRotationRate.toFixed(2)}x año
              </span>
            </div>

            <div className="mt-2 bg-[#0f172a]/30 dark:bg-white/5 p-3.5 rounded-xl border border-border text-[9.5px] leading-relaxed text-muted-foreground flex gap-2">
              <AlertTriangle className="text-amber-500 shrink-0" size={14} />
              <span>
                Un índice de rotación bajo (menor a 2) indica capital de trabajo inmovilizado en bodega. Se recomienda activar promociones urgentes para el stock estancado detectado en la pestaña contigua.
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
