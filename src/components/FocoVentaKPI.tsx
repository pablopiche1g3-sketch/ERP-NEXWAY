'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, 
  Package, 
  Clock, 
  AlertTriangle, 
  Search, 
  Loader2, 
  Sparkles,
  CalendarDays
} from 'lucide-react';
import { supabase } from '@/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface FocoVentaKPIProps {
  embeddedView?: boolean;
}

interface KPIRow {
  sku: string;
  name: string;
  stock: number;
  unitsSold: number;
  dailyVelocity: number;
  rotationIndex: number; // Days to exhaust, Infinity if no sales
  diagnostic: 'Urgente' | 'Normal';
}

export function FocoVentaKPI({ embeddedView = false }: FocoVentaKPIProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | '90days' | '180days' | 'year'>('month');
  const [searchTerm, setSearchTerm] = useState('');
  const [kpiRows, setKpiRows] = useState<KPIRow[]>([]);

  // Map period to number of days
  const periodDaysMap = useMemo(() => ({
    day: 1,
    week: 7,
    month: 30,
    '90days': 90,
    '180days': 180,
    year: 365
  }), []);

  const fetchKPIData = async () => {
    setLoading(true);
    try {
      // 1-3. Fetch master catalog, consolidated stock and sales for the period in parallel
      const days = periodDaysMap[period];
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const [invRes, stockRes, salesRes] = await Promise.all([
        supabase.from('inventory').select('sku, name').order('sku'),
        supabase.from('inventory_stock').select('sku, quantity'),
        supabase
          .from('sales_items')
          .select('sku, quantity, sales!inner(created_at, status)')
          .eq('sales.status', 'ACTIVA')
          .gte('sales.created_at', startDate.toISOString())
      ]);

      if (invRes.error) throw invRes.error;
      if (stockRes.error) throw stockRes.error;
      if (salesRes.error) throw salesRes.error;

      const invData = invRes.data;
      const stockData = stockRes.data;
      const salesItems = salesRes.data;

      // Map stock by SKU
      const stockMap: Record<string, number> = {};
      (stockData || []).forEach(s => {
        const qty = parseFloat(s.quantity) || 0;
        stockMap[s.sku] = (stockMap[s.sku] || 0) + qty;
      });

      // Group sales quantities by SKU
      const salesMap: Record<string, number> = {};
      (salesItems || []).forEach((item: any) => {
        const qty = parseFloat(item.quantity) || 0;
        salesMap[item.sku] = (salesMap[item.sku] || 0) + qty;
      });

      // 4. Calculate KPIs based on Statistical Formulas
      const computed: KPIRow[] = (invData || []).map((prod: any) => {
        const stock = stockMap[prod.sku] || 0;
        const unitsSold = salesMap[prod.sku] || 0;
        
        // Formula 1: Daily Sales Velocity (Media de Ventas Diarias)
        const dailyVelocity = unitsSold / days;
        
        // Formula 2: Turnover index / Days to exhaust stock (Índice de Rotación)
        let rotationIndex = Infinity;
        if (dailyVelocity > 0) {
          rotationIndex = stock / dailyVelocity;
        }

        // Formula 3: Diagnostic (Foco de Venta Urgente if rotation > 90 days or Infinity stagnant stock)
        const isStagnant = stock > 0 && (rotationIndex > 90 || rotationIndex === Infinity);
        const diagnostic = isStagnant ? 'Urgente' : 'Normal';

        return {
          sku: prod.sku,
          name: prod.name,
          stock,
          unitsSold,
          dailyVelocity,
          rotationIndex,
          diagnostic
        };
      });

      setKpiRows(computed);
    } catch (err: any) {
      console.error('Error calculating Sales KPIs:', err);
      toast({
        variant: 'destructive',
        title: 'Error de Analítica',
        description: err.message || 'No se pudieron calcular los indicadores de rotación de stock.'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKPIData();
  }, [period]);

  // Filtered rows for UI
  const filteredRows = useMemo(() => {
    return kpiRows.filter(row => 
      row.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [kpiRows, searchTerm]);

  // Urgent / Stagnant items count
  const stagnantCount = useMemo(() => {
    return kpiRows.filter(r => r.diagnostic === 'Urgente').length;
  }, [kpiRows]);

  return (
    <div className="space-y-4">
      
      {/* KPI SUMARIO CARD */}
      {!embeddedView && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-card border border-border rounded-2xl shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                <AlertTriangle size={18} className="animate-pulse" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Stock Estancado</p>
                <p className="text-xl font-black text-foreground">{stagnantCount} productos</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">Índice de rotación &gt; 90 días</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border border-border rounded-2xl shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <TrendingUp size={18} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Período de Medición</p>
                <p className="text-xl font-black text-foreground capitalize">{period === 'day' ? 'Último Día' : period === 'week' ? 'Semana' : period === 'month' ? 'Mensual' : period === '90days' ? '90 Días' : period === '180days' ? '6 Meses' : 'Anual'}</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">Basado en velocidad de venta diaria</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border border-border rounded-2xl shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <Sparkles size={18} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Acción Sugerida</p>
                <p className="text-sm font-black text-purple-600 dark:text-purple-300">Dar prioridad y promocionar hoy</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">Evita depreciación de activos</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* FILTER CONTROLS */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card border border-border p-3 rounded-2xl shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
          <Input 
            placeholder="Buscar por SKU o producto..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9 h-9 bg-background border-input text-xs text-foreground rounded-xl placeholder:text-muted-foreground"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <CalendarDays size={14} className="text-indigo-500 dark:text-indigo-400 shrink-0" />
          <Select 
            value={period} 
            onValueChange={(val: any) => setPeriod(val)}
          >
            <SelectTrigger className="h-9 w-44 bg-background border-input text-xs font-bold rounded-xl text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border text-popover-foreground rounded-xl">
              <SelectItem value="day" className="text-xs">Día (Últimas 24h)</SelectItem>
              <SelectItem value="week" className="text-xs">Semana (7 días)</SelectItem>
              <SelectItem value="month" className="text-xs">Mes (30 días)</SelectItem>
              <SelectItem value="90days" className="text-xs">90 Días</SelectItem>
              <SelectItem value="180days" className="text-xs">6 Meses</SelectItem>
              <SelectItem value="year" className="text-xs">Anual (365 días)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* DATA TABLE */}
      <div className="border border-border rounded-2xl bg-card overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-24 text-center text-muted-foreground flex flex-col items-center gap-2">
            <Loader2 className="animate-spin text-indigo-500" size={32} />
            <span className="text-xs font-medium animate-pulse">Procesando KPIs estadísticos...</span>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground italic text-xs">
            No se encontraron productos para el período analizado.
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/50 sticky top-0">
              <TableRow className="border-b border-border hover:bg-transparent">
                <TableHead className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-6 h-9">Producto</TableHead>
                <TableHead className="text-[10px] font-black text-muted-foreground uppercase tracking-widest text-center h-9 w-28">Stock Actual</TableHead>
                <TableHead className="text-[10px] font-black text-muted-foreground uppercase tracking-widest text-center h-9 w-32">Ventas del Período</TableHead>
                <TableHead className="text-[10px] font-black text-muted-foreground uppercase tracking-widest text-center h-9 w-36">Días para Agotarse</TableHead>
                <TableHead className="text-[10px] font-black text-muted-foreground uppercase tracking-widest text-center h-9 w-48 pr-6">Diagnóstico Comercial</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((row) => (
                <TableRow key={row.sku} className="border-b border-border/60 hover:bg-muted/30 transition-colors">
                  <TableCell className="pl-6 py-3">
                    <div className="flex flex-col">
                      <span className="font-bold text-foreground text-xs leading-normal">{row.name}</span>
                      <span className="text-[9px] font-mono text-muted-foreground mt-0.5">SKU: {row.sku}</span>
                    </div>
                  </TableCell>
                  
                  <TableCell className="text-center font-black text-foreground text-xs">
                    {row.stock}
                  </TableCell>

                  <TableCell className="text-center text-xs text-muted-foreground">
                    <div className="flex flex-col items-center">
                      <span className="font-bold text-foreground">{row.unitsSold} u</span>
                      <span className="text-[8.5px] font-mono text-muted-foreground">Vel: {row.dailyVelocity.toFixed(2)}/día</span>
                    </div>
                  </TableCell>

                  <TableCell className="text-center text-xs">
                    {row.rotationIndex === Infinity ? (
                      <span className="text-rose-600 dark:text-rose-400 font-bold font-mono">Sin rotación</span>
                    ) : (
                      <div className="flex flex-col items-center">
                        <span className={`font-mono font-bold ${row.rotationIndex > 90 ? 'text-orange-600 dark:text-orange-400' : 'text-foreground'}`}>
                          {Math.round(row.rotationIndex)} días
                        </span>
                        <span className="text-[8.5px] text-muted-foreground">cobertura estimada</span>
                      </div>
                    )}
                  </TableCell>

                  <TableCell className="text-center pr-6">
                    {row.diagnostic === 'Urgente' ? (
                      <Badge className="bg-gradient-to-r from-purple-500/20 to-orange-500/20 border border-orange-500/45 text-orange-600 dark:text-orange-400 text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-md animate-pulse shadow-[0_0_10px_rgba(249,115,22,0.1)]">
                        Promocionar hoy: Stock Estancado
                      </Badge>
                    ) : (
                      <Badge className="bg-muted border border-border text-muted-foreground text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-md">
                        Rotación Saludable
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      
    </div>
  );
}

// Global compat initialization function for legacy/raw JS calls
if (typeof window !== 'undefined') {
  (window as any).cargarPestañaKPIVentas = (contenedorId: string) => {
    console.log(`Pestaña KPI Ventas cargada de forma modular en el contenedor #${contenedorId}.`);
  };
}
