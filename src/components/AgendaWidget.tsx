'use client';

import React, { useState } from 'react';
import { useBms } from '@/contexts/BmsContext';
import { useRouter, usePathname } from 'next/navigation';
import { CheckSquare, ChevronRight, X, Loader2, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function AgendaWidget() {
  const { tasks, loading, auditSystem, requestChange, confirmChange } = useBms();
  const router = useRouter();
  const pathname = usePathname();
  const [isMinimized, setIsMinimized] = useState(true);

  // If we are on the homepage (Dashboard), we hide the widget because the full AsistenteGuiaERP is already there.
  if (pathname === '/') return null;

  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const taskCount = pendingTasks.length;

  if (loading && taskCount === 0) return null;

  return (
    <div className="fixed top-24 right-6 z-40 select-none print:hidden">
      {isMinimized ? (
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2 bg-[#16162a]/90 backdrop-blur-md border border-white/10 shadow-lg px-4 py-2 rounded-full hover:bg-[#1a1a32] transition-all hover:scale-105 group"
        >
          <div className="relative">
            <CheckSquare size={16} className="text-emerald-400" />
            {taskCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full animate-pulse border border-[#16162a]"></span>
            )}
          </div>
          <span className="text-xs font-bold text-slate-200 uppercase tracking-widest">
            BMS Agenda
          </span>
          <span className="bg-white/10 text-[10px] font-black px-1.5 py-0.5 rounded-full text-slate-300">
            {taskCount}
          </span>
        </button>
      ) : (
        <Card className="w-80 bg-[#11111e]/95 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
          <CardHeader className="py-3 px-4 border-b border-white/5 bg-white/5 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-indigo-400" />
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-200">
                BMS Core
              </CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => auditSystem()} className="text-slate-400 hover:text-white transition-colors" title="Actualizar">
                {loading ? <Loader2 size={14} className="animate-spin" /> : <span className="text-[10px] font-bold uppercase tracking-widest">Sync</span>}
              </button>
              <button onClick={() => setIsMinimized(true)} className="text-slate-400 hover:text-rose-400 transition-colors">
                <X size={16} />
              </button>
            </div>
          </CardHeader>
          <CardContent className="p-0 max-h-80 overflow-y-auto no-scrollbar">
            {pendingTasks.length === 0 ? (
              <div className="p-6 text-center text-slate-400">
                <CheckSquare size={32} className="mx-auto mb-2 text-emerald-500/50" />
                <p className="text-xs font-medium">¡Todo en orden!</p>
                <p className="text-[10px] text-slate-500">No hay tareas pendientes en el BMS.</p>
              </div>
            ) : (
              <div className="flex flex-col">
                {pendingTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex flex-col text-left p-4 border-b border-white/5 hover:bg-white/5 transition-colors group cursor-default"
                  >
                    <div className="flex items-start justify-between w-full">
                      <h4 className="text-sm font-semibold text-rose-400">{task.title}</h4>
                      {task.actionPath && (
                        <button 
                          onClick={() => {
                            router.push(task.actionPath!);
                            setIsMinimized(true);
                          }}
                          className="text-slate-500 hover:text-white transition-colors"
                        >
                          <ChevronRight size={14} className="mt-0.5" />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {task.description}
                    </p>
                    {task.actionLabel && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (task.id === 'alert_smart_change') {
                            if (task.actionLabel === 'Solicitar Cambio') requestChange();
                            else if (task.actionLabel === 'Confirmar Ingreso') confirmChange();
                          } else if (task.actionPath) {
                            router.push(task.actionPath);
                            setIsMinimized(true);
                          }
                        }}
                        className="text-[10px] w-max font-bold text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 px-2 py-1 -ml-2 rounded transition-colors uppercase tracking-widest mt-3 flex items-center gap-1 cursor-pointer"
                      >
                        {task.actionLabel}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
