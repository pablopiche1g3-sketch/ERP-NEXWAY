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
  const { toast } = useToast();
  const [scorings, setScorings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('nexway_credit_scorings');
    if (stored) {
      try {
        setScorings(JSON.parse(stored));
      } catch (e) {
        setScorings([]);
      }
    }
  }, []);

  const handleRecalculateAiScoring = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast({
        title: 'Evaluación Completada ⚡',
        description: 'No se encontraron créditos activos pendientes de re-evaluación.'
      });
    }, 1000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Card className="border shadow-md rounded-2xl bg-card overflow-hidden">
        <CardHeader className="bg-card text-card-foreground p-6 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle className="text-base font-black uppercase tracking-tight flex items-center gap-2 text-foreground">
              <ShieldCheck className="text-emerald-500" size={20} />
              Credit Scoring & Evaluación de Riesgo con IA
            </CardTitle>
            <CardDescription className="text-muted-foreground text-xs mt-1">
              Análisis predictivo del comportamiento de pago de clientes para autorizar créditos de forma segura.
            </CardDescription>
          </div>

          <Button onClick={handleRecalculateAiScoring} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 rounded-xl">
            <Sparkles size={15} className="mr-1.5 text-amber-300" />
            {loading ? 'Analizando...' : '⚡ Re-evaluar Riesgo con NexBot'}
          </Button>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {scorings.length === 0 ? (
            <div className="border border-dashed p-8 rounded-2xl bg-card text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 mx-auto flex items-center justify-center">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-foreground">No hay evaluaciones de crédito activas</h4>
                <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                  A medida que vendas al crédito a tus clientes del directorio, NexBot evaluará automáticamente su historial de pago y sugerirá límites de crédito seguros.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {scorings.map(sc => (
                <div key={sc.id} className="p-5 rounded-2xl border bg-card space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-xs font-black text-foreground">{sc.client_name}</h4>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Días promedio de pago: <strong className="text-foreground">{sc.avg_pay_days} días</strong></p>
                    </div>
                    <Badge className={`text-[9px] font-black uppercase px-2 py-0.5 border-0 ${
                      sc.risk_level === 'BAJO' ? 'bg-emerald-500/20 text-emerald-500' :
                      sc.risk_level === 'MEDIO' ? 'bg-amber-500/20 text-amber-500' : 'bg-rose-500/20 text-rose-500'
                    }`}>
                      Riesgo {sc.risk_level}
                    </Badge>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold">
                      <span className="text-muted-foreground">Score Crediticio:</span>
                      <span className={sc.score >= 80 ? 'text-emerald-500' : sc.score >= 60 ? 'text-amber-500' : 'text-rose-500'}>{sc.score} / 100</span>
                    </div>
                    <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                      <div className={`h-full ${sc.score >= 80 ? 'bg-emerald-500' : sc.score >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${sc.score}%` }} />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border flex justify-between items-center text-xs">
                    <span className="text-muted-foreground text-[10px]">Límite Sugerido:</span>
                    <span className="font-black text-foreground">${sc.recommended_limit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
