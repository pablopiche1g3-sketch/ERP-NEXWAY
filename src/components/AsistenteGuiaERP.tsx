'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/supabase/client';
import { 
  CheckCircle, 
  AlertCircle, 
  Sparkles, 
  Play, 
  RotateCcw, 
  HelpCircle, 
  TrendingUp,
  Package,
  Building2,
  CalendarCheck,
  ChevronDown,
  ChevronUp,
  Award
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import { useBms } from '@/contexts/BmsContext';
import { useRouter } from 'next/navigation';

export function AsistenteGuiaERP() {
  const [isOpen, setIsOpen] = useState(true);
  const { tasks, loading, auditSystem } = useBms();
  const router = useRouter();

  // Contadores para el badge de tareas pendientes
  const pendingTasksCount = useMemo(() => {
    return tasks.filter(t => t.status === 'pending').length;
  }, [tasks]);

  if (loading) {
    return null; // Oculto durante la carga para una transición limpia
  }

  return (
    <Card className="bg-card rounded-2xl mb-8 overflow-hidden relative z-10 border-border shadow-sm">
      <CardHeader 
        className="p-5 bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border-b border-white/10 flex flex-row items-center justify-between cursor-pointer select-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/5">
            <Award size={18} className="animate-pulse" />
          </div>
          <div>
            <CardTitle className="text-xs md:text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              Asistente de Control y Puesta en Marcha
              {pendingTasksCount > 0 && (
                <Badge className="bg-amber-500 text-slate-950 text-[9px] font-black h-4 px-1.5 rounded-full animate-bounce">
                  {pendingTasksCount} PENDIENTES
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-[10px] text-slate-400 mt-0.5">
              Auditoría interna de procesos comerciales y salud del sistema.
            </CardDescription>
          </div>
        </div>
        <div className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg">
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </CardHeader>

      {isOpen && (
        <CardContent className="p-6 bg-slate-950/20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Columna 1: Configuración Maestro */}
            <div>
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                <Building2 size={12} className="text-indigo-400" /> 1. Configuración de Base
              </h4>
              <div className="space-y-3.5">
                {tasks.filter(t => t.category === 'setup').map(task => (
                  <div key={task.id} className={`p-4 rounded-xl border transition-all ${
                    task.status === 'completed' 
                      ? 'bg-emerald-500/5 border-emerald-500/10' 
                      : 'bg-rose-500/5 border-rose-500/10 shadow-[0_0_15px_rgba(239,68,68,0.05)]'
                  }`}>
                    <div className="flex gap-2.5 items-start">
                      {task.status === 'completed' ? (
                        <CheckCircle size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle size={14} className="text-rose-500 shrink-0 mt-0.5 animate-pulse" />
                      )}
                      <div>
                        <p className="text-xs font-bold text-white leading-snug">{task.title}</p>
                        <p className="text-[9.5px] text-slate-400 leading-relaxed mt-1">{task.description}</p>
                        {task.status === 'pending' && task.actionLabel && (
                          <Button 
                            variant="link" 
                            className="text-indigo-400 hover:text-indigo-300 p-0 h-auto text-[9.5px] font-black uppercase tracking-wider mt-2 flex items-center gap-1"
                            onClick={() => window.location.href = task.actionPath || '#'}
                          >
                            <Play size={8} /> {task.actionLabel}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Columna 2: Operaciones Diarias */}
            <div>
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                <CalendarCheck size={12} className="text-blue-400" /> 2. Operación Diaria
              </h4>
              <div className="space-y-3.5">
                {tasks.filter(t => t.category === 'operations').map(task => (
                  <div key={task.id} className={`p-4 rounded-xl border transition-all ${
                    task.status === 'completed' 
                      ? 'bg-emerald-500/5 border-emerald-500/10' 
                      : task.status === 'pending'
                        ? 'bg-rose-500/5 border-rose-500/10'
                        : 'bg-blue-500/5 border-blue-500/10'
                  }`}>
                    <div className="flex gap-2.5 items-start">
                      {task.status === 'completed' ? (
                        <CheckCircle size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                      ) : task.status === 'pending' ? (
                        <AlertCircle size={14} className="text-rose-500 shrink-0 mt-0.5 animate-pulse" />
                      ) : (
                        <HelpCircle size={14} className="text-blue-400 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <p className="text-xs font-bold text-white leading-snug">{task.title}</p>
                        <p className="text-[9.5px] text-slate-400 leading-relaxed mt-1">{task.description}</p>
                        {task.status === 'pending' && task.actionLabel && (
                          <Button 
                            variant="link" 
                            className="text-indigo-400 hover:text-indigo-300 p-0 h-auto text-[9.5px] font-black uppercase tracking-wider mt-2 flex items-center gap-1"
                            onClick={() => window.location.href = task.actionPath || '#'}
                          >
                            <Play size={8} /> {task.actionLabel}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {tasks.filter(t => t.category === 'operations').length === 0 && (
                  <p className="text-[10px] text-muted-foreground italic text-center py-4">Felicidades, todas las tareas operacionales de hoy están al día.</p>
                )}
              </div>
            </div>

            {/* Columna 3: Oportunidades y KPIs */}
            <div>
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                <Sparkles size={12} className="text-amber-400" /> 3. Oportunidades Comerciales
              </h4>
              <div className="space-y-3.5">
                {tasks.filter(t => t.category === 'opportunities').map(task => (
                  <div key={task.id} className="p-4 rounded-xl border bg-amber-500/5 border-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.02)] transition-all">
                    <div className="flex gap-2.5 items-start">
                      <TrendingUp size={14} className="text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-white leading-snug">{task.title}</p>
                        <p className="text-[9.5px] text-slate-400 leading-relaxed mt-1">{task.description}</p>
                        {task.actionLabel && (
                          <Button 
                            variant="link" 
                            className="text-amber-400 hover:text-amber-300 p-0 h-auto text-[9.5px] font-black uppercase tracking-wider mt-2 flex items-center gap-1"
                            onClick={() => window.location.href = task.actionPath || '#'}
                          >
                            <Play size={8} /> {task.actionLabel}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {tasks.filter(t => t.category === 'opportunities').length === 0 && (
                  <div className="p-4 rounded-xl border bg-slate-900/40 border-border text-center">
                    <p className="text-[10px] text-emerald-400 font-bold">🎯 Rotación de Stock Óptima</p>
                    <p className="text-[9px] text-muted-foreground mt-1 leading-relaxed">No se detectan inventarios estancados significativos en bodega en los últimos 30 días.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Botón de re-auditoría manual */}
          <div className="flex justify-end mt-5 pt-4 border-t border-white/5">
            <Button 
              onClick={auditSystem} 
              variant="ghost" 
              size="sm" 
              className="text-[9px] font-bold text-slate-400 hover:text-white hover:bg-white/5 h-7 rounded-lg flex items-center gap-1"
            >
              <RotateCcw size={10} /> Re-auditar Sistema
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
