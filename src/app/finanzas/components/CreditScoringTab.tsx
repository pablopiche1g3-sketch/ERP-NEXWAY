'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/supabase/client';
import { ShieldCheck, ShieldAlert, Sparkles, UserCheck, AlertTriangle, RefreshCw } from 'lucide-react';

const MOCK_CLIENT_SCORINGS = [
  { id: 'sc_1', client_name: 'COMERCIALIZADORA EL SALVADOR S.A.', score: 96, risk_level: 'BAJO', avg_pay_days: 12, recommended_limit: 15000.00, status: 'EXCELENTE' },
  { id: 'sc_2', client_name: 'DISTRIBUIDORA BETA LTDA', score: 74, risk_level: 'MEDIO', avg_pay_days: 28, recommended_limit: 5000.00, status: 'ACEPTABLE' },
  { id: 'sc_3', client_name: 'CONSTRUCTORA CENTROAMÉRICA', score: 45, risk_level: 'ALTO', avg_pay_days: 58, recommended_limit: 1000.00, status: 'EN MORA' }
];

export default function CreditScoringTab() {
  const [scorings, setScorings] = useState<any[]>(MOCK_CLIENT_SCORINGS);
  const [loading, setLoading] = useState(false);

  const handleRecalculateAiScoring = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
    }, 1200);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Card className="border shadow-md rounded-2xl bg-card overflow-hidden">
        <CardHeader className="bg-slate-900 text-white p-6 dark:bg-slate-950 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle className="text-base font-black uppercase tracking-tight flex items-center gap-2">
              <ShieldCheck className="text-emerald-400" size={20} />
              Credit Scoring & Evaluación de Riesgo con IA
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs mt-1">
              Análisis predictivo del comportamiento de pago de clientes para autorizar créditos de forma segura.
            </CardDescription>
          </div>

          <Button onClick={handleRecalculateAiScoring} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 rounded-xl">
            <Sparkles size={15} className="mr-1.5 text-amber-300" />
            {loading ? 'Analizando...' : '⚡ Re-evaluar Riesgo con NexBot'}
          </Button>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {scorings.map(sc => (
              <div key={sc.id} className="p-5 rounded-2xl border bg-slate-50 dark:bg-white/5 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-xs font-black text-slate-800 dark:text-white">{sc.client_name}</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">Días promedio de pago: <strong className="text-slate-200">{sc.avg_pay_days} días</strong></p>
                  </div>
                  <Badge className={`text-[9px] font-black uppercase px-2 py-0.5 border-0 ${
                    sc.risk_level === 'BAJO' ? 'bg-emerald-500/20 text-emerald-400' :
                    sc.risk_level === 'MEDIO' ? 'bg-amber-500/20 text-amber-400' : 'bg-rose-500/20 text-rose-400'
                  }`}>
                    Riesgo {sc.risk_level}
                  </Badge>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-bold">
                    <span className="text-slate-400">Score Crediticio:</span>
                    <span className={sc.score >= 80 ? 'text-emerald-500' : sc.score >= 60 ? 'text-amber-500' : 'text-rose-500'}>{sc.score} / 100</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className={`h-full ${sc.score >= 80 ? 'bg-emerald-500' : sc.score >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${sc.score}%` }} />
                  </div>
                </div>

                <div className="pt-3 border-t flex justify-between items-center text-xs">
                  <span className="text-slate-400 text-[10px]">Límite Sugerido:</span>
                  <span className="font-black text-slate-800 dark:text-white">${sc.recommended_limit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
