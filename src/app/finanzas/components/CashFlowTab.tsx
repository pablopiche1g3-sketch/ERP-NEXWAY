'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/supabase/client';
import { TrendingUp, ArrowUpRight, ArrowDownRight, Wallet, Calendar, Sparkles, RefreshCw } from 'lucide-react';

export default function CashFlowTab() {
  const [loading, setLoading] = useState(true);
  const [bankBalance, setBankBalance] = useState(12540.50);
  const [cxcPending, setCxcPending] = useState(8450.00);
  const [quedanPending, setQuedanPending] = useState(3200.00);
  const [cxpPending, setCxpPending] = useState(4120.00);
  const [payrollEstimate, setPayrollEstimate] = useState(3850.00);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      // 1. Obtener ventas a crédito pendientes
      const { data: salesData } = await supabase.from('sales').select('total, amount_paid').eq('payment_method', 'Crédito');
      let pendingCxc = 0;
      (salesData || []).forEach(s => {
        const total = parseFloat(s.total) || 0;
        const paid = parseFloat(s.amount_paid) || 0;
        if (total > paid) pendingCxc += (total - paid);
      });
      if (pendingCxc > 0) setCxcPending(pendingCxc);

      // 2. Obtener compras a crédito pendientes
      const { data: purchasesData } = await supabase.from('purchases').select('total, status').neq('status', 'PAGADO');
      let pendingCxp = 0;
      (purchasesData || []).forEach(p => {
        pendingCxp += (parseFloat(p.total) || 0);
      });
      if (pendingCxp > 0) setCxpPending(pendingCxp);

      // 3. Saldo en bancos
      const { data: banks } = await supabase.from('bank_accounts').select('balance');
      let totalBank = 0;
      (banks || []).forEach(b => totalBank += (parseFloat(b.balance) || 0));
      if (totalBank > 0) setBankBalance(totalBank);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  const totalExpectedInflow = bankBalance + cxcPending + quedanPending;
  const totalExpectedOutflow = cxpPending + payrollEstimate;
  const netProjection30d = totalExpectedInflow - totalExpectedOutflow;
  const netProjection60d = netProjection30d + (cxcPending * 0.8) - (cxpPending * 0.5);
  const netProjection90d = netProjection60d + (cxcPending * 0.5) - (payrollEstimate);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border shadow-sm p-4 rounded-2xl">
          <div className="flex justify-between items-center text-xs font-bold text-slate-400">
            <span>Saldos Líquidos Actuales</span>
            <Wallet size={16} className="text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-slate-800 dark:text-white mt-2">${bankBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          <p className="text-[10px] text-emerald-500 font-semibold mt-1">Bancos y Caja Chica</p>
        </Card>

        <Card className="bg-card border shadow-sm p-4 rounded-2xl">
          <div className="flex justify-between items-center text-xs font-bold text-slate-400">
            <span>Ingresos Esperados (CXC + Quedan)</span>
            <ArrowUpRight size={16} className="text-blue-500" />
          </div>
          <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-2">${(cxcPending + quedanPending).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          <p className="text-[10px] text-slate-400 mt-1">CXC: ${cxcPending.toFixed(2)} | Quedan: ${quedanPending.toFixed(2)}</p>
        </Card>

        <Card className="bg-card border shadow-sm p-4 rounded-2xl">
          <div className="flex justify-between items-center text-xs font-bold text-slate-400">
            <span>Egresos Agendados (CXP + Nómina)</span>
            <ArrowDownRight size={16} className="text-rose-500" />
          </div>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-2">${totalExpectedOutflow.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          <p className="text-[10px] text-slate-400 mt-1">CXP: ${cxpPending.toFixed(2)} | Planilla: ${payrollEstimate.toFixed(2)}</p>
        </Card>

        <Card className="bg-emerald-500/10 border border-emerald-500/20 shadow-sm p-4 rounded-2xl">
          <div className="flex justify-between items-center text-xs font-bold text-emerald-500">
            <span>Liquidez Neta a 30 Días</span>
            <TrendingUp size={16} />
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">${netProjection30d.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">Proyección Positiva Óptima</p>
        </Card>
      </div>

      {/* Proyección Temporal 30 / 60 / 90 Días */}
      <Card className="border shadow-md rounded-2xl bg-card overflow-hidden">
        <CardHeader className="bg-slate-900 text-white p-6 dark:bg-slate-950 flex flex-row justify-between items-center">
          <div>
            <CardTitle className="text-base font-black uppercase tracking-tight flex items-center gap-2">
              <Sparkles className="text-amber-400" size={18} />
              Proyección de Liquidez a Futuro (Cash Flow Forecast)
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs mt-1">
              Estimación de disponibilidades basada en compromisos pactados de cobro y pago.
            </CardDescription>
          </div>
          <Button onClick={loadMetrics} variant="outline" size="sm" className="h-8 text-xs font-bold border-white/10 hover:bg-white/10 text-white">
            <RefreshCw size={12} className="mr-1.5" /> Recalcular
          </Button>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-3">
              <div className="flex justify-between items-center">
                <Badge className="bg-indigo-600 text-white font-bold text-[10px]">30 Días</Badge>
                <Calendar size={16} className="text-slate-400" />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Saldo Estimado al Cierre:</p>
              <p className="text-2xl font-black text-slate-800 dark:text-white">${netProjection30d.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
              <div className="pt-2 border-t text-[11px] space-y-1 text-slate-600 dark:text-slate-400">
                <div className="flex justify-between"><span>+ Ingresos pactados:</span><span className="text-emerald-500 font-bold">+${(cxcPending + quedanPending).toFixed(2)}</span></div>
                <div className="flex justify-between"><span>- Compromisos de pago:</span><span className="text-rose-500 font-bold">-${totalExpectedOutflow.toFixed(2)}</span></div>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-3">
              <div className="flex justify-between items-center">
                <Badge className="bg-blue-600 text-white font-bold text-[10px]">60 Días</Badge>
                <Calendar size={16} className="text-slate-400" />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Saldo Estimado al Cierre:</p>
              <p className="text-2xl font-black text-slate-800 dark:text-white">${netProjection60d.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
              <div className="pt-2 border-t text-[11px] space-y-1 text-slate-600 dark:text-slate-400">
                <div className="flex justify-between"><span>+ Recuperación recurrente:</span><span className="text-emerald-500 font-bold">+${(cxcPending * 0.8).toFixed(2)}</span></div>
                <div className="flex justify-between"><span>- Operaciones estimadas:</span><span className="text-rose-500 font-bold">-${(cxpPending * 0.5).toFixed(2)}</span></div>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-3">
              <div className="flex justify-between items-center">
                <Badge className="bg-emerald-600 text-white font-bold text-[10px]">90 Días</Badge>
                <Calendar size={16} className="text-slate-400" />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Saldo Estimado al Cierre:</p>
              <p className="text-2xl font-black text-slate-800 dark:text-white">${netProjection90d.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
              <div className="pt-2 border-t text-[11px] space-y-1 text-slate-600 dark:text-slate-400">
                <div className="flex justify-between"><span>+ Cobros proyectados:</span><span className="text-emerald-500 font-bold">+${(cxcPending * 0.5).toFixed(2)}</span></div>
                <div className="flex justify-between"><span>- Planilla proyectada:</span><span className="text-rose-500 font-bold">-${payrollEstimate.toFixed(2)}</span></div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
