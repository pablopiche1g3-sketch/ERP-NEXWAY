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
  Building2,
  CalendarCheck,
  ChevronDown,
  ChevronUp,
  Award,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  BrainCircuit,
  CheckSquare,
  Square,
  Clock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useBms, GuideTask } from '@/contexts/BmsContext';
import { useToast } from '@/hooks/use-toast';

export interface AgendaTask {
  id: string;
  title: string;
  description: string;
  category: 'manual' | 'ai_suggested';
  status: 'pending' | 'completed';
  due_date: string;
  created_at?: string;
}

export function AsistenteGuiaERP() {
  const [isOpen, setIsOpen] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);
  const { tasks, loading, auditSystem, stats } = useBms();
  const { toast } = useToast();

  // Estado local para la Agenda Táctica
  const [agendaTasks, setAgendaTasks] = useState<AgendaTask[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  // Cargar agenda desde Supabase o localStorage
  const loadAgenda = async () => {
    try {
      const { data, error } = await supabase
        .from('agenda_tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        // Fallback a localStorage si la tabla aún se está sincronizando
        const local = localStorage.getItem('nexway_agenda_tasks');
        if (local) setAgendaTasks(JSON.parse(local));
      } else if (data) {
        setAgendaTasks(data);
      }
    } catch {
      const local = localStorage.getItem('nexway_agenda_tasks');
      if (local) setAgendaTasks(JSON.parse(local));
    }
  };

  useEffect(() => {
    loadAgenda();
  }, []);

  const saveAgendaTask = async (task: AgendaTask) => {
    const updated = [task, ...agendaTasks];
    setAgendaTasks(updated);
    localStorage.setItem('nexway_agenda_tasks', JSON.stringify(updated));

    try {
      await supabase.from('agenda_tasks').insert({
        title: task.title,
        description: task.description,
        category: task.category,
        status: task.status,
        due_date: task.due_date
      });
    } catch (e) {
      console.error('Error insert agenda task:', e);
    }
  };

  const toggleAgendaStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    const updated = agendaTasks.map(t => t.id === id ? { ...t, status: nextStatus as any } : t);
    setAgendaTasks(updated);
    localStorage.setItem('nexway_agenda_tasks', JSON.stringify(updated));

    try {
      await supabase.from('agenda_tasks').update({ status: nextStatus }).eq('id', id);
    } catch (e) {
      console.error('Error update agenda task:', e);
    }
  };

  const deleteAgendaTask = async (id: string) => {
    const updated = agendaTasks.filter(t => t.id !== id);
    setAgendaTasks(updated);
    localStorage.setItem('nexway_agenda_tasks', JSON.stringify(updated));

    try {
      await supabase.from('agenda_tasks').delete().eq('id', id);
    } catch (e) {
      console.error('Error delete agenda task:', e);
    }
  };

  const handleAddManualTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newTask: AgendaTask = {
      id: 'ag_' + Date.now(),
      title: newTitle.trim(),
      description: newDesc.trim() || 'Tarea agregada manualmente por el usuario.',
      category: 'manual',
      status: 'pending',
      due_date: new Date().toISOString().split('T')[0]
    };

    saveAgendaTask(newTask);
    setNewTitle('');
    setNewDesc('');
    setIsAddingTask(false);
    toast({ title: 'Tarea Agregada', description: 'Se añadió la nueva tarea a la agenda del día.' });
  };

  const handleGenerateAiSuggestions = async () => {
    setIsGeneratingAi(true);
    const newAiTasks: AgendaTask[] = [];

    // Reglas inteligentes basadas en auditoría del sistema
    if (stats.zeroStockProductsCount > 0) {
      newAiTasks.push({
        id: 'ai_' + Date.now() + '_1',
        title: '🤖 Reordenar Productos en Cero',
        description: `NexBot sugiere generar orden de compra para los ${stats.zeroStockProductsCount} productos con stock crítico.`,
        category: 'ai_suggested',
        status: 'pending',
        due_date: new Date().toISOString().split('T')[0]
      });
    }

    if (!stats.hasClosingToday && stats.hasSalesToday) {
      newAiTasks.push({
        id: 'ai_' + Date.now() + '_2',
        title: '🤖 Preparar Cierre de Caja Diario',
        description: 'Revisar reporte de ventas del turno y realizar arqueo ciego antes del fin del día.',
        category: 'ai_suggested',
        status: 'pending',
        due_date: new Date().toISOString().split('T')[0]
      });
    }

    if (stats.stagnantProductsCount > 0) {
      newAiTasks.push({
        id: 'ai_' + Date.now() + '_3',
        title: '🤖 Promoción de Stock Estancado',
        description: `Se detectaron ${stats.stagnantProductsCount} productos sin rotación en 30 días. Sugerido: Crear oferta combo.`,
        category: 'ai_suggested',
        status: 'pending',
        due_date: new Date().toISOString().split('T')[0]
      });
    }

    if (newAiTasks.length === 0) {
      newAiTasks.push({
        id: 'ai_' + Date.now() + '_def',
        title: '🤖 Recomendar Conciliación IVA y Bancos',
        description: 'Todo el inventario está óptimo. Sugerido: Revisar registro de abonos CXC e IVA mensual.',
        category: 'ai_suggested',
        status: 'pending',
        due_date: new Date().toISOString().split('T')[0]
      });
    }

    for (const t of newAiTasks) {
      await saveAgendaTask(t);
    }

    setIsGeneratingAi(false);
    toast({ title: 'IA Generó Tácticas', description: `NexBot agregó ${newAiTasks.length} sugerencia(s) a tu agenda.` });
  };

  // Filtrado de tareas completadas en verde
  const visibleTasks = useMemo(() => {
    if (showCompleted) return tasks;
    return tasks.filter(t => t.status !== 'completed');
  }, [tasks, showCompleted]);

  const pendingTasksCount = useMemo(() => {
    return tasks.filter(t => t.status === 'pending').length;
  }, [tasks]);

  const activeAgendaTasks = useMemo(() => {
    if (showCompleted) return agendaTasks;
    return agendaTasks.filter(a => a.status !== 'completed');
  }, [agendaTasks, showCompleted]);

  if (loading) return null;

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
              Asistente de Control y Agenda Táctica ERP
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
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); setShowCompleted(!showCompleted); }}
            className="text-[10px] text-slate-400 hover:text-white h-7 px-2 flex items-center gap-1 rounded-lg border border-white/10 bg-white/5"
          >
            {showCompleted ? <EyeOff size={12} /> : <Eye size={12} />}
            {showCompleted ? 'Ocultar Listas' : 'Ver Completadas'}
          </Button>

          <div className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg">
            {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>
      </CardHeader>

      {isOpen && (
        <CardContent className="p-6 bg-slate-950/20 space-y-6">
          
          {/* PANEL DE 3 COLUMNAS DEL BMS (FILTRADO AUTOMÁTICO DE VERDES) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Columna 1: Configuración Maestro */}
            <div>
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                <Building2 size={12} className="text-indigo-400" /> 1. Configuración de Base
              </h4>
              <div className="space-y-3.5">
                {visibleTasks.filter(t => t.category === 'setup').map(task => (
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
                {visibleTasks.filter(t => t.category === 'setup').length === 0 && (
                  <div className="p-4 rounded-xl border bg-emerald-500/5 border-emerald-500/10 text-center">
                    <CheckCircle size={16} className="text-emerald-500 mx-auto mb-1" />
                    <p className="text-[10px] text-emerald-400 font-bold">Configuración de Base Completa</p>
                    <p className="text-[9px] text-slate-400 mt-0.5">Todas las sucursales y catálogos iniciales están al día.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Columna 2: Operaciones Diarias */}
            <div>
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                <CalendarCheck size={12} className="text-blue-400" /> 2. Operación Diaria
              </h4>
              <div className="space-y-3.5">
                {visibleTasks.filter(t => t.category === 'operations').map(task => (
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
                {visibleTasks.filter(t => t.category === 'operations').length === 0 && (
                  <div className="p-4 rounded-xl border bg-emerald-500/5 border-emerald-500/10 text-center">
                    <CheckCircle size={16} className="text-emerald-500 mx-auto mb-1" />
                    <p className="text-[10px] text-emerald-400 font-bold">Operaciones al Día</p>
                    <p className="text-[9px] text-slate-400 mt-0.5">No hay alertas ni descuadres pendientes de resolución.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Columna 3: Oportunidades Comerciales */}
            <div>
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                <Sparkles size={12} className="text-amber-400" /> 3. Oportunidades Comerciales
              </h4>
              <div className="space-y-3.5">
                {visibleTasks.filter(t => t.category === 'opportunities').map(task => (
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
                {visibleTasks.filter(t => t.category === 'opportunities').length === 0 && (
                  <div className="p-4 rounded-xl border bg-slate-900/40 border-border text-center">
                    <p className="text-[10px] text-emerald-400 font-bold">🎯 Stock Óptimo</p>
                    <p className="text-[9px] text-muted-foreground mt-1 leading-relaxed">No se detectan inventarios estancados en los últimos 30 días.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SECCIÓN DE AGENDA TÁCTICA DIARIA CON IA */}
          <div className="pt-6 border-t border-white/10 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h4 className="text-xs font-black uppercase text-white flex items-center gap-2">
                  <BrainCircuit size={16} className="text-emerald-400" />
                  Agenda Táctica del Día y Asistencia IA
                </h4>
                <p className="text-[10px] text-slate-400">
                  Agrega pendientes personales o solicita a NexBot que genere recomendaciones inteligentes.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={handleGenerateAiSuggestions}
                  disabled={isGeneratingAi}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 rounded-xl shadow-md"
                >
                  <Sparkles size={14} className="mr-1.5 text-amber-300" />
                  {isGeneratingAi ? 'Analizando...' : '⚡ NexBot: Generar Sugerencias'}
                </Button>

                <Button
                  onClick={() => setIsAddingTask(!isAddingTask)}
                  variant="outline"
                  className="h-8 text-xs font-bold rounded-xl border-white/10 hover:bg-white/5"
                >
                  <Plus size={14} className="mr-1" /> Nueva Tarea
                </Button>
              </div>
            </div>

            {/* FORMULARIO AGREGAR TAREA MANUAL */}
            {isAddingTask && (
              <form onSubmit={handleAddManualTask} className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3 animate-in fade-in duration-200">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-300 uppercase">Título de la Tarea</label>
                  <Input
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    placeholder="Ej. Revisar cotización con Proveedor X"
                    className="h-8 text-xs bg-slate-950 border-slate-800"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-300 uppercase">Detalle / Notas</label>
                  <Input
                    value={newDesc}
                    onChange={e => setNewDesc(e.target.value)}
                    placeholder="Ej. Confirmar plazo de entrega y descuento por volumen"
                    className="h-8 text-xs bg-slate-950 border-slate-800"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setIsAddingTask(false)} className="h-7 text-xs">
                    Cancelar
                  </Button>
                  <Button type="submit" size="sm" className="bg-indigo-600 hover:bg-indigo-700 h-7 text-xs font-bold">
                    Guardar Tarea
                  </Button>
                </div>
              </form>
            )}

            {/* LISTADO DE AGENDA TÁCTICA */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {activeAgendaTasks.map(item => (
                <div
                  key={item.id}
                  className={`p-3 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                    item.status === 'completed'
                      ? 'bg-slate-900/40 border-slate-800 opacity-60 line-through'
                      : item.category === 'ai_suggested'
                        ? 'bg-emerald-500/5 border-emerald-500/20'
                        : 'bg-slate-900/80 border-slate-800'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <button
                      onClick={() => toggleAgendaStatus(item.id, item.status)}
                      className="mt-0.5 text-slate-400 hover:text-emerald-400 transition-colors"
                    >
                      {item.status === 'completed' ? (
                        <CheckSquare size={16} className="text-emerald-500" />
                      ) : (
                        <Square size={16} />
                      )}
                    </button>

                    <div>
                      <p className="text-xs font-bold text-white leading-snug flex items-center gap-1.5">
                        {item.title}
                        {item.category === 'ai_suggested' && (
                          <Badge className="bg-emerald-500/20 text-emerald-300 text-[8px] font-black h-3.5 px-1 border-0">
                            IA
                          </Badge>
                        )}
                      </p>
                      <p className="text-[9.5px] text-slate-400 leading-relaxed mt-0.5">{item.description}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => deleteAgendaTask(item.id)}
                    className="text-slate-500 hover:text-rose-400 transition-colors"
                    title="Eliminar tarea"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}

              {activeAgendaTasks.length === 0 && (
                <div className="col-span-full p-4 rounded-xl border border-dashed border-slate-800 text-center text-slate-500 text-xs">
                  No hay tareas pendientes en tu agenda táctica de hoy. Haz clic en "⚡ NexBot: Generar Sugerencias" para que la IA agregue recomendaciones automáticas.
                </div>
              )}
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
