'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
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
  ArrowUpRight,
  PackageSearch,
  ShoppingCart,
  Flame,
  DollarSign,
  Layers,
  Filter,
  Loader2,
  Send
} from 'lucide-react';
import { executeRestockOrderAndReceiveDte } from '@/lib/hacienda-sandbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useBms, GuideTask } from '@/contexts/BmsContext';
import { useToast } from '@/hooks/use-toast';

export interface AgendaTask {
  id: string;
  title: string;
  description: string;
  category: 'manual' | 'ai_suggested';
  status: 'pending' | 'completed';
  priority?: 'URGENTE' | 'ALTA' | 'NORMAL';
  actionLabel?: string;
  actionPath?: string;
  itemsList?: string[];
  due_date: string;
  created_at?: string;
}

const AREA_SHORTCUTS: Record<string, { label: string; path: string; buttonText: string }> = {
  ordenes: {
    label: 'Abastecimiento — Órdenes a Proveedor',
    path: '/compras?tab=ordenes',
    buttonText: 'Ir a Órdenes de Compra'
  },
  compras: {
    label: 'Abastecimiento — Registro de Compra DTE',
    path: '/compras?tab=registro',
    buttonText: 'Ir a Registro de Compras'
  },
  inventario: {
    label: 'Logística — Inventario y Catálogo',
    path: '/logistica?tab=inventario',
    buttonText: 'Ir a Inventario'
  },
  fraccionamiento: {
    label: 'Logística — Fraccionamiento y Envasado',
    path: '/logistica?tab=fraccionamiento',
    buttonText: 'Ir a Fraccionamiento'
  },
  traslados: {
    label: 'Logística — Traslados entre Bodegas',
    path: '/logistica?tab=traslados',
    buttonText: 'Ir a Traslados'
  },
  crm: {
    label: 'CRM — Foco de Venta y Prioridad Comercial',
    path: '/crm',
    buttonText: 'Priorizar en CRM'
  },
  billing: {
    label: 'Facturación POS y Arqueo de Caja',
    path: '/billing',
    buttonText: 'Abrir Facturación POS'
  },
  finanzas: {
    label: 'Finanzas — Cuentas por Cobrar / Pagar',
    path: '/finanzas',
    buttonText: 'Ir a Finanzas'
  },
  accounting: {
    label: 'Contabilidad y Auditoría Manual',
    path: '/accounting',
    buttonText: 'Ir a Contabilidad'
  }
};

const PRIORITY_WEIGHT: Record<string, number> = {
  URGENTE: 3,
  ALTA: 2,
  NORMAL: 1
};

export function AsistenteGuiaERP() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);
  const [priorityModalTab, setPriorityModalTab] = useState<'criticos' | 'estancados' | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | 'URGENTE' | 'ALTA' | 'NORMAL'>('ALL');

  const { tasks, loading, auditSystem, stats } = useBms();
  const { toast } = useToast();

  // Estado local para la Agenda Táctica
  const [agendaTasks, setAgendaTasks] = useState<AgendaTask[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState<'URGENTE' | 'ALTA' | 'NORMAL'>('ALTA');
  const [newAreaKey, setNewAreaKey] = useState<string>('ordenes');
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [restockingKey, setRestockingKey] = useState<string | null>(null);

  const handleDirectRestock = async (
    rawItems: Array<{ sku: string; name: string; suggestedOrderQty: number; unitCost: number; price: number; supplierName?: string }>,
    keyId = 'all'
  ) => {
    if (!rawItems || rawItems.length === 0) return;
    setRestockingKey(keyId);
    try {
      const batch = rawItems.slice(0, 30);
      const { data: whRows } = await supabase.from('warehouses').select('name').limit(1);
      const defaultWhName = whRows?.[0]?.name || 'Bodega Principal';
      const orderCode = `OC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

      const normalizedItems = batch.map((it) => ({
        sku: it.sku,
        name: it.name,
        quantity: Math.max(1, Number(it.suggestedOrderQty) || 10),
        cost: Number((Number(it.unitCost) > 0 ? Number(it.unitCost) : Math.max(1, (Number(it.price) || 10) * 0.7)).toFixed(2)),
      }));

      const preferredSupplier =
        batch.find((i) => i.supplierName && i.supplierName !== 'Proveedor General')?.supplierName || '';

      const res = await executeRestockOrderAndReceiveDte({
        orderCode,
        supplierName: preferredSupplier,
        destinationWarehouse: defaultWhName,
        items: normalizedItems,
      });

      if (!res.ok) {
        throw new Error(res.error || 'No se pudo solicitar el reabastecimiento.');
      }

      const subtotal = normalizedItems.reduce((s, i) => s + i.quantity * i.cost, 0);
      await supabase.from('supplier_orders').insert({
        code: orderCode,
        supplier_name: res.supplierName || preferredSupplier || 'Proveedor Mayorista',
        destination_warehouse: defaultWhName,
        requested_by: 'BMS Reabastecimiento',
        items: normalizedItems,
        total: Number((subtotal * 1.13).toFixed(2)),
        status: 'ENVIADA',
      });

      toast({
        title: 'Reabastecimiento procesado',
        description: `Factura CCF ${res.numeroControl} recibida y lista para ingreso a inventario.`,
      });

      auditSystem().catch(() => {});
      setPriorityModalTab(null);
      router.push('/compras?tab=registro');
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error al reabastecer',
        description: err?.message || 'No se pudo completar la solicitud.',
      });
    } finally {
      setRestockingKey(null);
    }
  };

  // Enriquecer tareas antiguas que no tenían ruta o listado detallado
  const enrichAgendaTask = (raw: AgendaTask): AgendaTask => {
    const titleLower = (raw.title || '').toLowerCase();
    const descLower = (raw.description || '').toLowerCase();

    if (titleLower.includes('reordenar') || titleLower.includes('cero') || descLower.includes('stock crítico')) {
      const critItems = (stats.criticalProductsList || []).slice(0, 4).map(
        c => `[${c.sku}] ${c.name} (Stock: ${c.currentStock} ➔ Pedir: +${c.suggestedOrderQty} uds • $${c.estimatedTotal.toFixed(2)})`
      );
      return {
        ...raw,
        priority: raw.priority || 'URGENTE',
        actionLabel: raw.actionLabel || 'Ir a Pedidos / Ordenar',
        actionPath: raw.actionPath || '/compras?tab=ordenes',
        itemsList: raw.itemsList && raw.itemsList.length > 0 ? raw.itemsList : critItems,
        description:
          critItems.length > 0
            ? `Prioridad de reposición para ${stats.zeroStockProductsCount} SKUs críticos (Inversión est.: $${(stats.estimatedRestockCost || 0).toFixed(2)}).`
            : raw.description
      };
    }

    if (titleLower.includes('estancado') || titleLower.includes('promoción') || descLower.includes('sin rotación')) {
      const stagItems = (stats.stagnantProductsList || []).slice(0, 4).map(
        s => `[${s.sku}] ${s.name} (${s.stock} uds • $${s.tiedCapital.toFixed(2)} retenido)`
      );
      return {
        ...raw,
        priority: raw.priority || 'ALTA',
        actionLabel: raw.actionLabel || 'Dar Prioridad en CRM',
        actionPath: raw.actionPath || '/crm',
        itemsList: raw.itemsList && raw.itemsList.length > 0 ? raw.itemsList : stagItems,
        description:
          stagItems.length > 0
            ? `${stats.stagnantProductsCount} productos sin rotación en 30 días ($${(stats.stagnantCapitalTotal || 0).toFixed(2)} en inventario inmovilizado).`
            : raw.description
      };
    }

    if (titleLower.includes('cierre') || titleLower.includes('caja') || titleLower.includes('arqueo')) {
      return {
        ...raw,
        priority: raw.priority || 'ALTA',
        actionLabel: raw.actionLabel || 'Ir a Arqueo POS',
        actionPath: raw.actionPath || '/billing'
      };
    }

    if (titleLower.includes('iva') || titleLower.includes('conciliación') || titleLower.includes('contab')) {
      return {
        ...raw,
        priority: raw.priority || 'NORMAL',
        actionLabel: raw.actionLabel || 'Ir a Auditoría Contable',
        actionPath: raw.actionPath || '/accounting'
      };
    }

    return {
      ...raw,
      priority: raw.priority || 'NORMAL'
    };
  };

  // Cargar agenda desde Supabase o localStorage
  const loadAgenda = async () => {
    let localMetaMap: Record<string, Partial<AgendaTask>> = {};
    if (typeof window !== 'undefined') {
      try {
        const rawMeta = localStorage.getItem('nexway_agenda_tasks_meta');
        if (rawMeta) localMetaMap = JSON.parse(rawMeta);
      } catch {
        // ignore
      }
    }

    try {
      const { data, error } = await supabase
        .from('agenda_tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        const local = localStorage.getItem('nexway_agenda_tasks');
        if (local) {
          const parsed: AgendaTask[] = JSON.parse(local);
          setAgendaTasks(parsed.map(t => ({ ...t, ...(localMetaMap[t.id] || {}) })));
        }
      } else if (data) {
        const merged = data.map((t: any) => ({
          ...t,
          ...(localMetaMap[t.id] || {})
        }));
        setAgendaTasks(merged);
      }
    } catch {
      const local = localStorage.getItem('nexway_agenda_tasks');
      if (local) {
        const parsed: AgendaTask[] = JSON.parse(local);
        setAgendaTasks(parsed.map(t => ({ ...t, ...(localMetaMap[t.id] || {}) })));
      }
    }
  };

  useEffect(() => {
    loadAgenda();
  }, []);

  const persistTaskMeta = (task: AgendaTask) => {
    if (typeof window === 'undefined') return;
    try {
      const rawMeta = localStorage.getItem('nexway_agenda_tasks_meta');
      const map = rawMeta ? JSON.parse(rawMeta) : {};
      map[task.id] = {
        priority: task.priority,
        actionLabel: task.actionLabel,
        actionPath: task.actionPath,
        itemsList: task.itemsList
      };
      localStorage.setItem('nexway_agenda_tasks_meta', JSON.stringify(map));
    } catch {
      // ignore
    }
  };

  const saveAgendaTask = async (task: AgendaTask) => {
    persistTaskMeta(task);
    const updated = [task, ...agendaTasks.filter(t => t.title !== task.title)];
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

  const cycleTaskPriority = (task: AgendaTask) => {
    const current = task.priority || 'NORMAL';
    const next: 'URGENTE' | 'ALTA' | 'NORMAL' =
      current === 'NORMAL' ? 'ALTA' : current === 'ALTA' ? 'URGENTE' : 'NORMAL';
    const updatedTask = { ...task, priority: next };
    persistTaskMeta(updatedTask);
    const updatedList = agendaTasks.map(t => t.id === task.id ? updatedTask : t);
    setAgendaTasks(updatedList);
    localStorage.setItem('nexway_agenda_tasks', JSON.stringify(updatedList));
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

    const area = AREA_SHORTCUTS[newAreaKey] || AREA_SHORTCUTS.ordenes;

    const newTask: AgendaTask = {
      id: 'ag_' + Date.now(),
      title: newTitle.trim(),
      description: newDesc.trim() || `Acción operativa asignada al área: ${area.label}.`,
      category: 'manual',
      status: 'pending',
      priority: newPriority,
      actionLabel: area.buttonText,
      actionPath: area.path,
      due_date: new Date().toISOString().split('T')[0]
    };

    saveAgendaTask(newTask);
    setNewTitle('');
    setNewDesc('');
    setIsAddingTask(false);
    toast({ title: 'Tarea Táctica Creada', description: `Asignada con prioridad ${newPriority} y enlace a ${area.buttonText}.` });
  };

  const handleGenerateAiSuggestions = async () => {
    setIsGeneratingAi(true);
    const newAiTasks: AgendaTask[] = [];
    const todayStr = new Date().toISOString().split('T')[0];

    const critList = stats.criticalProductsList || [];
    const stagList = stats.stagnantProductsList || [];
    const ordersList = stats.pendingOrdersDetails || [];

    // 1. Productos críticos a pedir con SKUs y costos exactos
    if (critList.length > 0) {
      const topCrit = critList.slice(0, 4);
      newAiTasks.push({
        id: 'ai_' + Date.now() + '_restock',
        title: `🤖 Reordenar ${critList.length} Productos con Stock Crítico`,
        description: `Se requieren $${(stats.estimatedRestockCost || 0).toFixed(2)} para reabastecer SKUs agotados o en mínimo: ${topCrit.map(c => `${c.name} (+${c.suggestedOrderQty})`).join(', ')}.`,
        category: 'ai_suggested',
        status: 'pending',
        priority: 'URGENTE',
        actionLabel: 'Generar Orden de Compra',
        actionPath: '/compras?tab=ordenes',
        itemsList: topCrit.map(
          c => `[${c.sku}] ${c.name} • Stock: ${c.currentStock} ➔ Pedir: +${c.suggestedOrderQty} uds ($${c.estimatedTotal.toFixed(2)})`
        ),
        due_date: todayStr
      });
    }

    // 2. Autorizar pedidos automáticos preparados por NexBot
    if (ordersList.length > 0) {
      const totalOrd = ordersList.reduce((acc, o) => acc + o.total, 0);
      newAiTasks.push({
        id: 'ai_' + Date.now() + '_orders',
        title: `🤖 Autorizar ${ordersList.length} Pedido(s) a Proveedor`,
        description: `Órdenes listas para despacho con proveedor por $${totalOrd.toFixed(2)} (${ordersList.map(o => o.code).join(', ')}).`,
        category: 'ai_suggested',
        status: 'pending',
        priority: 'ALTA',
        actionLabel: 'Autorizar en Abastecimiento',
        actionPath: '/compras?tab=ordenes',
        itemsList: ordersList.slice(0, 3).map(
          o => `${o.code} • ${o.supplierName} (${o.itemsCount} SKUs — $${o.total.toFixed(2)})`
        ),
        due_date: todayStr
      });
    }

    // 3. Priorizar rotación de stock estancado
    if (stagList.length > 0) {
      const topStag = stagList.slice(0, 4);
      newAiTasks.push({
        id: 'ai_' + Date.now() + '_stagnant',
        title: `🤖 Dar Prioridad Comercial a ${stagList.length} SKUs Estancados`,
        description: `Capital retenido sin ventas en 30 días: $${(stats.stagnantCapitalTotal || 0).toFixed(2)}. Impulsar en Foco de Venta CRM o crear combo promocional.`,
        category: 'ai_suggested',
        status: 'pending',
        priority: 'ALTA',
        actionLabel: 'Priorizar en Foco de Venta CRM',
        actionPath: '/crm',
        itemsList: topStag.map(
          s => `[${s.sku}] ${s.name} • ${s.stock} uds estancadas (Valor: $${s.tiedCapital.toFixed(2)})`
        ),
        due_date: todayStr
      });
    }

    // 4. Cierre de caja o revisión contable
    if (!stats.hasClosingToday && stats.hasSalesToday) {
      newAiTasks.push({
        id: 'ai_' + Date.now() + '_closing',
        title: '🤖 Ejecutar Arqueo Ciego y Cierre de Turno',
        description: `Se registran ${stats.todaySalesCount} ventas hoy por $${(stats.todaySalesTotal || 0).toFixed(2)}. Verificar efectivo, vouchers y emitir reporte DTE.`,
        category: 'ai_suggested',
        status: 'pending',
        priority: 'ALTA',
        actionLabel: 'Ir a Arqueo de Caja',
        actionPath: '/billing',
        due_date: todayStr
      });
    }

    if (newAiTasks.length === 0) {
      newAiTasks.push({
        id: 'ai_' + Date.now() + '_audit',
        title: '🤖 Revisión de Libros IVA y Cuentas por Cobrar',
        description: 'Inventario en niveles óptimos. Se sugiere auditar partidas del Libro Diario y cobros pendientes.',
        category: 'ai_suggested',
        status: 'pending',
        priority: 'NORMAL',
        actionLabel: 'Abrir Auditoría Contable',
        actionPath: '/accounting',
        due_date: todayStr
      });
    }

    for (const t of newAiTasks) {
      await saveAgendaTask(t);
    }

    setIsGeneratingAi(false);
    toast({
      title: 'Plan Táctico Generado por NexBot ⚡',
      description: `Se actualizaron ${newAiTasks.length} acciones priorizadas con desglose de productos y accesos directos.`
    });
  };

  // Filtrado de tareas del panel de 3 columnas
  const visibleTasks = useMemo(() => {
    if (showCompleted) return tasks;
    return tasks.filter(t => t.status !== 'completed');
  }, [tasks, showCompleted]);

  const pendingTasksCount = useMemo(() => {
    return tasks.filter(t => t.status === 'pending').length;
  }, [tasks]);

  // Enriquecer y ordenar tareas de la agenda por prioridad (URGENTE > ALTA > NORMAL)
  const activeAgendaTasks = useMemo(() => {
    const base = showCompleted ? agendaTasks : agendaTasks.filter(a => a.status !== 'completed');
    const enriched = base.map(t => enrichAgendaTask(t));
    const filtered = priorityFilter === 'ALL'
      ? enriched
      : enriched.filter(t => (t.priority || 'NORMAL') === priorityFilter);

    return filtered.sort((a, b) => {
      const weightDiff = (PRIORITY_WEIGHT[b.priority || 'NORMAL'] || 1) - (PRIORITY_WEIGHT[a.priority || 'NORMAL'] || 1);
      return weightDiff;
    });
  }, [agendaTasks, showCompleted, priorityFilter, stats]);

  const renderPriorityBadge = (priority?: 'URGENTE' | 'ALTA' | 'NORMAL' | 'MEDIA') => {
    if (priority === 'URGENTE') {
      return (
        <Badge className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-[9px] font-black h-4 px-1.5 rounded-md">
          🔴 URGENTE
        </Badge>
      );
    }
    if (priority === 'ALTA') {
      return (
        <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[9px] font-black h-4 px-1.5 rounded-md">
          🟠 PRIORIDAD ALTA
        </Badge>
      );
    }
    return (
      <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 text-[9px] font-black h-4 px-1.5 rounded-md">
        🔵 NORMAL
      </Badge>
    );
  };

  const renderGuideTaskCard = (task: GuideTask) => {
    const isCompleted = task.status === 'completed';
    const isPending = task.status === 'pending';

    return (
      <div
        key={task.id}
        className={`p-4 rounded-xl border transition-all ${
          isCompleted
            ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40'
            : task.priority === 'URGENTE'
            ? 'bg-rose-50/80 dark:bg-rose-950/25 border-rose-300 dark:border-rose-800/50 shadow-sm'
            : isPending
            ? 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40 shadow-sm'
            : 'bg-blue-50/60 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/40'
        }`}
      >
        <div className="flex gap-2.5 items-start">
          {isCompleted ? (
            <CheckCircle size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          ) : isPending ? (
            <AlertCircle
              size={15}
              className={`${
                task.priority === 'URGENTE'
                  ? 'text-rose-600 dark:text-rose-400 animate-pulse'
                  : 'text-amber-600 dark:text-amber-400'
              } shrink-0 mt-0.5`}
            />
          ) : (
            <HelpCircle size={15} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          )}

          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <p className="text-xs font-black text-foreground leading-snug">{task.title}</p>
              <div className="flex items-center gap-1">
                {task.badgeText && (
                  <Badge variant="outline" className="text-[9px] font-mono font-bold h-4 px-1.5 border-border bg-background/80">
                    {task.badgeText}
                  </Badge>
                )}
                {!isCompleted && renderPriorityBadge(task.priority)}
              </div>
            </div>

            <p className="text-[10.5px] text-muted-foreground leading-relaxed">{task.description}</p>

            {/* Desglose real de productos / órdenes directamente en la tarjeta */}
            {task.itemsPreview && task.itemsPreview.length > 0 && (
              <div className="p-2.5 rounded-lg bg-background/90 border border-border/70 space-y-1">
                <div className="flex items-center justify-between text-[9.5px] font-bold uppercase tracking-wider text-muted-foreground pb-1 border-b border-border/50">
                  <span>Detalle de Ítems Prioritarios</span>
                  {(task.id === 'setup_critical_restock' || task.id === 'opp_stagnant') && (
                    <button
                      type="button"
                      onClick={() => setPriorityModalTab(task.id === 'setup_critical_restock' ? 'criticos' : 'estancados')}
                      className="text-indigo-600 dark:text-indigo-400 hover:underline font-black"
                    >
                      Ver Tabla Completa ({task.id === 'setup_critical_restock' ? stats.zeroStockProductsCount : stats.stagnantProductsCount})
                    </button>
                  )}
                </div>
                <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                  {task.itemsPreview.map((line, idx) => (
                    <div key={idx} className="text-[10px] font-mono text-foreground/90 truncate flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"></span>
                      <span className="truncate">{line}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Botones de Acción y Redirección Directa */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {task.id === 'setup_critical_restock' && (stats.criticalProductsList || []).length > 0 && (
                <Button
                  size="sm"
                  disabled={restockingKey !== null}
                  onClick={() => handleDirectRestock(stats.criticalProductsList || [], 'card-all')}
                  className="h-7 px-2.5 text-[10px] font-black uppercase tracking-wider rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1"
                >
                  {restockingKey === 'card-all' ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <>
                      <Send size={11} /> Reabastecer
                    </>
                  )}
                </Button>
              )}
              {task.actionLabel && task.actionPath && (
                <Button
                  size="sm"
                  onClick={() => router.push(task.actionPath!)}
                  className="h-7 px-2.5 text-[10px] font-black uppercase tracking-wider rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-1"
                >
                  {task.actionLabel}
                  <ArrowUpRight size={12} />
                </Button>
              )}
              {task.secondaryActionLabel && task.secondaryActionPath && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push(task.secondaryActionPath!)}
                  className="h-7 px-2.5 text-[10px] font-bold rounded-lg border-border bg-background/80 hover:bg-accent text-foreground flex items-center gap-1"
                >
                  {task.secondaryActionLabel}
                  <ArrowUpRight size={11} />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) return null;

  const criticalCount = stats.zeroStockProductsCount || 0;
  const stagnantCount = stats.stagnantProductsCount || 0;

  return (
    <>
      <Card className="bg-card rounded-2xl mb-8 overflow-hidden relative z-10 border-border shadow-sm">
        <CardHeader
          className="p-5 bg-card dark:bg-slate-950 border-b border-border flex flex-col lg:flex-row lg:items-center justify-between gap-4 cursor-pointer select-none"
          onClick={() => setIsOpen(!isOpen)}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 shadow-sm">
              <Award size={20} className="animate-pulse" />
            </div>
            <div>
              <CardTitle className="text-xs md:text-sm font-black text-foreground uppercase tracking-wider flex flex-wrap items-center gap-2 font-headline">
                Asistente de Control y Agenda Táctica ERP
                {pendingTasksCount > 0 && (
                  <Badge className="bg-amber-500 text-slate-950 text-[9px] font-black h-4 px-1.5 rounded-full">
                    {pendingTasksCount} ACCIONES PRIORITARIAS
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-[11px] text-muted-foreground mt-0.5">
                Centro ejecutivo de abastecimiento inteligente, priorización de stock, control de caja y agenda operativa IA.
              </CardDescription>
            </div>
          </div>

          {/* PÍLDORAS EJECUTIVAS CON REDIRECCIÓN EN 1 CLIC */}
          <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setPriorityModalTab('criticos')}
              className={`px-3 py-1.5 rounded-xl border text-left transition-all flex items-center gap-2 ${
                criticalCount > 0
                  ? 'bg-rose-500/10 border-rose-500/30 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400'
                  : 'bg-muted/40 border-border text-muted-foreground'
              }`}
              title="Ver detalle de productos por pedir"
            >
              <ShoppingCart size={14} />
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider opacity-80">Productos a Pedir</div>
                <div className="text-xs font-black font-mono">
                  {criticalCount} SKUs • ${(stats.estimatedRestockCost || 0).toFixed(2)}
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => router.push('/compras?tab=ordenes')}
              className={`px-3 py-1.5 rounded-xl border text-left transition-all flex items-center gap-2 ${
                stats.pendingOrdersCount > 0
                  ? 'bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400'
                  : 'bg-muted/40 border-border text-muted-foreground'
              }`}
              title="Ir a Órdenes de Compra Pendientes"
            >
              <Layers size={14} />
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider opacity-80">Pedidos Proveedor</div>
                <div className="text-xs font-black font-mono">{stats.pendingOrdersCount} Pendientes</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setPriorityModalTab('estancados')}
              className={`px-3 py-1.5 rounded-xl border text-left transition-all flex items-center gap-2 ${
                stagnantCount > 0
                  ? 'bg-indigo-500/10 border-indigo-500/30 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400'
                  : 'bg-muted/40 border-border text-muted-foreground'
              }`}
              title="Ver productos con stock estancado para priorizar venta"
            >
              <Flame size={14} />
              <div>
                <div className="text-[9px] font-bold uppercase tracking-wider opacity-80">Stock Estancado</div>
                <div className="text-xs font-black font-mono">
                  {stagnantCount} SKUs • ${(stats.stagnantCapitalTotal || 0).toFixed(2)}
                </div>
              </div>
            </button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCompleted(!showCompleted)}
              className="text-[10px] text-muted-foreground hover:text-foreground h-8 px-2.5 flex items-center gap-1 rounded-xl border border-border bg-background"
            >
              {showCompleted ? <EyeOff size={12} /> : <Eye size={12} />}
              {showCompleted ? 'Ocultar Completadas' : 'Ver Completadas'}
            </Button>

            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg border border-border bg-background"
            >
              {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
          </div>
        </CardHeader>

        {isOpen && (
          <CardContent className="p-6 bg-background/50 space-y-6">
            {/* PANEL DE 3 COLUMNAS EJECUTIVAS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Columna 1: Abastecimiento & Productos por Pedir */}
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10.5px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                    <Building2 size={13} className="text-indigo-600 dark:text-indigo-400" />
                    1. Abastecimiento y Productos por Pedir
                  </h4>
                  {criticalCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setPriorityModalTab('criticos')}
                      className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5"
                    >
                      Priorizar ({criticalCount}) <ArrowUpRight size={11} />
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {visibleTasks.filter(t => t.category === 'setup').map(task => renderGuideTaskCard(task))}
                  {visibleTasks.filter(t => t.category === 'setup').length === 0 && (
                    <div className="p-4 rounded-xl border bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/30 space-y-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <div>
                          <p className="text-xs text-emerald-700 dark:text-emerald-400 font-black">Abastecimiento y Base al Día</p>
                          <p className="text-[10px] text-muted-foreground">
                            {stats.productsCount} productos activos en catálogo y sucursales configuradas sin quiebres de stock.
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push('/logistica?tab=inventario')}
                          className="h-7 text-[10px] font-bold rounded-lg"
                        >
                          Ver Inventario <ArrowUpRight size={11} className="ml-1" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push('/compras?tab=ordenes')}
                          className="h-7 text-[10px] font-bold rounded-lg"
                        >
                          Órdenes de Compra <ArrowUpRight size={11} className="ml-1" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Columna 2: Operaciones Diarias, Pedidos y Caja */}
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10.5px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                    <CalendarCheck size={13} className="text-blue-600 dark:text-blue-400" />
                    2. Operación Diaria, Pedidos y Caja
                  </h4>
                  <button
                    type="button"
                    onClick={() => router.push('/billing')}
                    className="text-[10px] font-black text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
                  >
                    Terminal POS <ArrowUpRight size={11} />
                  </button>
                </div>

                <div className="space-y-3">
                  {visibleTasks.filter(t => t.category === 'operations').map(task => renderGuideTaskCard(task))}
                  {visibleTasks.filter(t => t.category === 'operations').length === 0 && (
                    <div className="p-4 rounded-xl border bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/30 text-center space-y-2">
                      <CheckCircle size={16} className="text-emerald-600 dark:text-emerald-400 mx-auto" />
                      <p className="text-xs text-emerald-700 dark:text-emerald-400 font-black">Operaciones Diarias al Día</p>
                      <p className="text-[10px] text-muted-foreground">No hay pedidos ni cierres pendientes de autorización.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Columna 3: Oportunidades Comerciales & Rotación */}
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10.5px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                    <Sparkles size={13} className="text-amber-600 dark:text-amber-400" />
                    3. Oportunidades y Prioridad de Venta
                  </h4>
                  {stagnantCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setPriorityModalTab('estancados')}
                      className="text-[10px] font-black text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-0.5"
                    >
                      Ver Estancados ({stagnantCount}) <ArrowUpRight size={11} />
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {visibleTasks.filter(t => t.category === 'opportunities').map(task => renderGuideTaskCard(task))}
                  {visibleTasks.filter(t => t.category === 'opportunities').length === 0 && (
                    <div className="p-4 rounded-xl border bg-card border-border text-center space-y-2">
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-black">🎯 Rotación de Stock Óptima</p>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        No se detectan productos estancados sin ventas en los últimos 30 días.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* SECCIÓN DE AGENDA TÁCTICA DIARIA CON PRIORIZACIÓN Y REDIRECCIÓN */}
            <div className="pt-6 border-t border-border space-y-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div>
                  <h4 className="text-xs font-black uppercase text-foreground flex items-center gap-2">
                    <BrainCircuit size={16} className="text-emerald-600 dark:text-emerald-400" />
                    Agenda Táctica del Día y Plan de Prioridades IA
                  </h4>
                  <p className="text-[10.5px] text-muted-foreground">
                    Haz clic en el nivel de prioridad (🔴/🟠/🔵) para reordenar o pulsa el botón de acción en cada tarjeta para ir directo al módulo.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Filtro rápido por prioridad */}
                  <div className="flex items-center bg-muted/50 border border-border rounded-xl p-0.5 text-[10px] font-bold">
                    {(['ALL', 'URGENTE', 'ALTA', 'NORMAL'] as const).map(pKey => (
                      <button
                        key={pKey}
                        type="button"
                        onClick={() => setPriorityFilter(pKey)}
                        className={`px-2.5 py-1 rounded-lg transition-colors ${
                          priorityFilter === pKey
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {pKey === 'ALL' ? 'Todas' : pKey}
                      </button>
                    ))}
                  </div>

                  <Button
                    onClick={handleGenerateAiSuggestions}
                    disabled={isGeneratingAi}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 rounded-xl shadow-sm"
                  >
                    <Sparkles size={14} className="mr-1.5 text-amber-300" />
                    {isGeneratingAi ? 'Auditando SKUs...' : '⚡ NexBot: Actualizar Plan IA'}
                  </Button>

                  <Button
                    onClick={() => setIsAddingTask(!isAddingTask)}
                    variant="outline"
                    className="h-8 text-xs font-bold rounded-xl border-border hover:bg-accent text-foreground"
                  >
                    <Plus size={14} className="mr-1" /> Nueva Tarea Priorizada
                  </Button>
                </div>
              </div>

              {/* FORMULARIO AGREGAR TAREA CON PRIORIDAD Y ÁREA DE REDIRECCIÓN */}
              {isAddingTask && (
                <form onSubmit={handleAddManualTask} className="p-4 rounded-xl bg-card border border-border space-y-3 animate-in fade-in duration-200">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    <div className="md:col-span-5 space-y-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase">Título de la Acción / Producto</label>
                      <Input
                        value={newTitle}
                        onChange={e => setNewTitle(e.target.value)}
                        placeholder="Ej. Pedir 20 galones de Solvente Mineral a proveedor"
                        className="h-9 text-xs bg-background border-border text-foreground"
                        required
                      />
                    </div>
                    <div className="md:col-span-3 space-y-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase">Nivel de Prioridad</label>
                      <Select value={newPriority} onValueChange={(v: any) => setNewPriority(v)}>
                        <SelectTrigger className="h-9 text-xs font-bold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="URGENTE" className="text-xs font-bold">🔴 URGENTE (Inmediato)</SelectItem>
                          <SelectItem value="ALTA" className="text-xs font-bold">🟠 PRIORIDAD ALTA (Hoy)</SelectItem>
                          <SelectItem value="NORMAL" className="text-xs font-bold">🔵 NORMAL (Programado)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-4 space-y-1">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase">Módulo / Área de Destino</label>
                      <Select value={newAreaKey} onValueChange={setNewAreaKey}>
                        <SelectTrigger className="h-9 text-xs font-bold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(AREA_SHORTCUTS).map(([key, cfg]) => (
                            <SelectItem key={key} value={key} className="text-xs">
                              {cfg.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Detalle Operativo / SKUs / Notas</label>
                    <Input
                      value={newDesc}
                      onChange={e => setNewDesc(e.target.value)}
                      placeholder="Ej. Confirmar descuento por volumen y autorizar orden antes de las 3:00 PM"
                      className="h-9 text-xs bg-background border-border text-foreground"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setIsAddingTask(false)} className="h-8 text-xs">
                      Cancelar
                    </Button>
                    <Button type="submit" size="sm" className="bg-indigo-600 hover:bg-indigo-700 h-8 text-xs font-bold text-white">
                      Guardar en Agenda Táctica
                    </Button>
                  </div>
                </form>
              )}

              {/* LISTADO DE AGENDA TÁCTICA PRIORIZADA */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {activeAgendaTasks.map(item => (
                  <div
                    key={item.id}
                    className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                      item.status === 'completed'
                        ? 'bg-muted/40 border-border opacity-60 line-through'
                        : item.priority === 'URGENTE'
                        ? 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800/50 shadow-sm'
                        : item.category === 'ai_suggested'
                        ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 shadow-sm'
                        : 'bg-card border-border shadow-sm'
                    }`}
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <button
                            type="button"
                            onClick={() => toggleAgendaStatus(item.id, item.status)}
                            className="mt-0.5 text-muted-foreground hover:text-emerald-600 transition-colors shrink-0"
                            title="Marcar como completada"
                          >
                            {item.status === 'completed' ? (
                              <CheckSquare size={16} className="text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <Square size={16} />
                            )}
                          </button>

                          <div className="min-w-0">
                            <p className="text-xs font-black text-foreground leading-snug flex flex-wrap items-center gap-1.5">
                              <span>{item.title}</span>
                              {item.category === 'ai_suggested' && (
                                <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[8px] font-black h-3.5 px-1 border-0">
                                  IA
                                </Badge>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => cycleTaskPriority(item)}
                            title="Clic para cambiar prioridad (Normal ➔ Alta ➔ Urgente)"
                            className="cursor-pointer transition-transform hover:scale-105"
                          >
                            {renderPriorityBadge(item.priority)}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteAgendaTask(item.id)}
                            className="text-muted-foreground hover:text-rose-600 transition-colors p-1"
                            title="Eliminar tarea"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      <p className="text-[10.5px] text-muted-foreground leading-relaxed pl-6">
                        {item.description}
                      </p>

                      {/* Lista específica de productos si la tarea los incluye */}
                      {item.itemsList && item.itemsList.length > 0 && (
                        <div className="ml-6 p-2 rounded-lg bg-background/90 border border-border/70 space-y-1">
                          {item.itemsList.map((prodLine, idx) => (
                            <div key={idx} className="text-[9.5px] font-mono text-foreground/90 truncate flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                              <span className="truncate">{prodLine}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Pie de Tarjeta con Botón de Redirección al Área */}
                    {item.actionPath && item.actionLabel && (
                      <div className="pl-6 pt-2 border-t border-border/50 flex items-center justify-between gap-2">
                        <span className="text-[9px] font-mono text-muted-foreground uppercase">
                          Fecha: {item.due_date}
                        </span>
                        <Button
                          size="sm"
                          onClick={() => router.push(item.actionPath!)}
                          className="h-7 px-2.5 text-[10px] font-black rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1"
                        >
                          {item.actionLabel}
                          <ArrowUpRight size={11} />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}

                {activeAgendaTasks.length === 0 && (
                  <div className="col-span-full p-5 rounded-xl border border-dashed border-border text-center text-muted-foreground text-xs">
                    No hay tareas pendientes con este filtro. Haz clic en <strong>&quot;⚡ NexBot: Actualizar Plan IA&quot;</strong> para generar acciones con desglose de productos a pedir y prioridades de venta.
                  </div>
                )}
              </div>
            </div>

            {/* Barra Inferior de Auditoría y Accesos Rápidos */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border/60">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPriorityModalTab('criticos')}
                  className="h-7 text-[10px] font-bold rounded-lg gap-1"
                >
                  <PackageSearch size={12} className="text-rose-500" />
                  Ver Tabla de Productos a Pedir ({criticalCount})
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPriorityModalTab('estancados')}
                  className="h-7 text-[10px] font-bold rounded-lg gap-1"
                >
                  <Flame size={12} className="text-amber-500" />
                  Ver Tabla de Stock Estancado ({stagnantCount})
                </Button>
              </div>

              <Button
                onClick={auditSystem}
                variant="ghost"
                size="sm"
                className="text-[10px] font-bold text-muted-foreground hover:text-foreground h-7 rounded-lg flex items-center gap-1"
              >
                <RotateCcw size={11} /> Re-auditar Sistema Ahora
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* MODAL EJECUTIVO DE PRIORIZACIÓN DE PRODUCTOS (POR PEDIR Y ESTANCADOS) */}
      <Dialog open={priorityModalTab !== null} onOpenChange={(open) => !open && setPriorityModalTab(null)}>
        <DialogContent className="max-w-4xl rounded-2xl border-border bg-card p-0 overflow-hidden">
          <DialogHeader className="p-5 bg-slate-900 text-white border-b border-white/10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <DialogTitle className="text-base font-black flex items-center gap-2">
                  <PackageSearch className="text-indigo-400" size={20} />
                  Centro de Priorización de Inventario y Abastecimiento
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-300 mt-0.5">
                  Listado detallado de SKUs auditados en tiempo real para compra inmediata o impulso comercial.
                </DialogDescription>
              </div>
              <div className="flex gap-1.5 bg-white/10 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setPriorityModalTab('criticos')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    priorityModalTab === 'criticos' ? 'bg-rose-600 text-white' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Productos por Pedir ({criticalCount})
                </button>
                <button
                  type="button"
                  onClick={() => setPriorityModalTab('estancados')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    priorityModalTab === 'estancados' ? 'bg-amber-600 text-white' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Stock Estancado ({stagnantCount})
                </button>
              </div>
            </div>
          </DialogHeader>

          <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
            {priorityModalTab === 'criticos' ? (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                  <div>
                    <div className="text-xs font-black text-rose-600 dark:text-rose-400">
                      Inversión Estimada de Reposición: ${(stats.estimatedRestockCost || 0).toFixed(2)}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Productos con existencias en cero o iguales/inferiores al punto de reorden.
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(stats.criticalProductsList || []).length > 0 && (
                      <Button
                        size="sm"
                        disabled={restockingKey !== null}
                        onClick={() => handleDirectRestock(stats.criticalProductsList || [], 'modal-all')}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold h-8 rounded-xl gap-1.5"
                      >
                        {restockingKey === 'modal-all' ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Send size={12} />
                        )}
                        Reabastecer
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => {
                        setPriorityModalTab(null);
                        router.push('/compras?tab=ordenes');
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold h-8 rounded-xl"
                    >
                      Ir a Órdenes de Compra <ArrowUpRight size={13} className="ml-1" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setPriorityModalTab(null);
                        router.push('/logistica?tab=traslados');
                      }}
                      className="text-xs font-bold h-8 rounded-xl"
                    >
                      Solicitar Traslado <ArrowUpRight size={13} className="ml-1" />
                    </Button>
                  </div>
                </div>

                <div className="border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/60 border-b border-border text-[10px] uppercase font-black text-muted-foreground">
                      <tr>
                        <th className="py-2.5 px-3 text-left">Prioridad</th>
                        <th className="py-2.5 px-3 text-left">SKU</th>
                        <th className="py-2.5 px-3 text-left">Producto</th>
                        <th className="py-2.5 px-3 text-center">Stock Actual</th>
                        <th className="py-2.5 px-3 text-center">Cant. a Pedir</th>
                        <th className="py-2.5 px-3 text-right">Costo Est.</th>
                        <th className="py-2.5 px-3 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(stats.criticalProductsList || []).map((item) => (
                        <tr key={item.sku} className="hover:bg-muted/30">
                          <td className="py-2.5 px-3">{renderPriorityBadge(item.priority)}</td>
                          <td className="py-2.5 px-3 font-mono font-bold">{item.sku}</td>
                          <td className="py-2.5 px-3 font-bold text-foreground">{item.name}</td>
                          <td className="py-2.5 px-3 text-center">
                            <Badge variant="outline" className={item.currentStock <= 0 ? 'border-rose-500 text-rose-500 font-black' : 'font-bold'}>
                              {item.currentStock} uds
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-black text-indigo-600 dark:text-indigo-400">
                            +{item.suggestedOrderQty} uds
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold">
                            ${item.estimatedTotal.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="inline-flex items-center gap-1">
                              <Button
                                size="sm"
                                disabled={restockingKey !== null}
                                onClick={() => handleDirectRestock([item], item.sku)}
                                className="h-7 px-2.5 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg gap-1"
                              >
                                {restockingKey === item.sku ? (
                                  <Loader2 size={11} className="animate-spin" />
                                ) : (
                                  <>
                                    <Send size={10} /> Reabastecer
                                  </>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setPriorityModalTab(null);
                                  router.push('/compras?tab=ordenes');
                                }}
                                className="h-7 px-2 text-[10px] font-bold text-indigo-600 dark:text-indigo-400"
                              >
                                Orden <ArrowUpRight size={11} className="ml-0.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {(stats.criticalProductsList || []).length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-muted-foreground">
                            No hay productos con stock crítico en este momento.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <div>
                    <div className="text-xs font-black text-amber-600 dark:text-amber-400">
                      Capital Retenido sin Movimiento (30 días): ${(stats.stagnantCapitalTotal || 0).toFixed(2)}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Productos con existencias disponibles pero sin rotación reciente. Priorízalos en CRM o sala de ventas.
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        setPriorityModalTab(null);
                        router.push('/crm');
                      }}
                      className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold h-8 rounded-xl"
                    >
                      Priorizar en Foco de Venta CRM <ArrowUpRight size={13} className="ml-1" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setPriorityModalTab(null);
                        router.push('/logistica?tab=inventario');
                      }}
                      className="text-xs font-bold h-8 rounded-xl"
                    >
                      Ajustar Precio en Catálogo <ArrowUpRight size={13} className="ml-1" />
                    </Button>
                  </div>
                </div>

                <div className="border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/60 border-b border-border text-[10px] uppercase font-black text-muted-foreground">
                      <tr>
                        <th className="py-2.5 px-3 text-left">SKU</th>
                        <th className="py-2.5 px-3 text-left">Producto</th>
                        <th className="py-2.5 px-3 text-center">Stock Estancado</th>
                        <th className="py-2.5 px-3 text-right">Precio Venta</th>
                        <th className="py-2.5 px-3 text-right">Valor Retenido</th>
                        <th className="py-2.5 px-3 text-right">Acción Comercial</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(stats.stagnantProductsList || []).map((item) => (
                        <tr key={item.sku} className="hover:bg-muted/30">
                          <td className="py-2.5 px-3 font-mono font-bold">{item.sku}</td>
                          <td className="py-2.5 px-3 font-bold text-foreground">{item.name}</td>
                          <td className="py-2.5 px-3 text-center">
                            <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400 font-bold">
                              {item.stock} uds
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">${item.price.toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-black text-amber-600 dark:text-amber-400">
                            ${item.tiedCapital.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setPriorityModalTab(null);
                                router.push('/crm');
                              }}
                              className="h-7 px-2 text-[10px] font-bold text-amber-600 dark:text-amber-400"
                            >
                              Impulsar en CRM <ArrowUpRight size={11} className="ml-0.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {(stats.stagnantProductsList || []).length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-muted-foreground">
                            No hay productos estancados.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
