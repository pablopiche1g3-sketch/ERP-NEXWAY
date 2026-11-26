'use client';

import { useBms } from '@/contexts/BmsContext';
import React, { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { 
  X, 
  Send, 
  Sparkles, 
  Loader2, 
  Bot,
  GripHorizontal,
  Minimize2,
  BookOpen,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { supabase } from '@/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  addPendingCreditNoteAlert,
  loadPendingCreditNoteAlerts,
} from '@/lib/credit-note-alerts';
import { loadBmsCreditDueAlerts } from '@/lib/supplier-credit';
import { executeRestockOrderAndReceiveDte } from '@/lib/hacienda-sandbox';
import { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

interface NcAlertDraft {
  type: 'COMPRA_PROVEEDOR' | 'VENTA_CLIENTE';
  entityName: string;
  invoiceRef?: string;
  itemsSummary: string;
  estimatedAmount?: number;
}

interface OrderProposalDraft {
  supplierName: string;
  supplierNit?: string;
  items: Array<{ sku: string; name: string; quantity: number; cost: number }>;
  notes: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  ncAlertProposal?: NcAlertDraft | null;
  ncAlertStatus?: 'pending' | 'saved' | 'discarded';
  orderProposal?: OrderProposalDraft | null;
  orderStatus?: 'pending' | 'sent' | 'discarded';
  orderControlNum?: string;
}

const MODULE_NAMES: Record<string, string> = {
  '/': 'Inicio / Dashboard General',
  '/billing': 'Facturación y Ventas',
  '/purchases': 'Registro de Compras',
  '/customers': 'Registro de Clientes',
  '/accounting': 'Contabilidad y Finanzas',
  '/suppliers': 'Proveedores',
  '/quedan': 'Gestión de Quedan',
  '/quotations': 'Cotizaciones',
  '/transfers': 'Traslados de Bodega',
  '/orders': 'Pedidos',
  '/inventory': 'Inventario y Logística',
  '/crm': 'CRM Comercial',
  '/institutional': 'Módulo Institucional',
  '/documents': 'Centro Documental',
  '/management': 'Gerencia y Reportes',
  '/finanzas': 'Finanzas y Créditos',
};

export function NexBotFlotante() {
  const pathname = usePathname();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { 
      role: 'assistant', 
      content: '¡Hola! Soy **NexBot**, conectado en vivo con tu **BMS**.\n\nPuedes preguntarme por alertas del día, créditos vencidos, Notas de Crédito pendientes o decirme **"Avisa al BMS que vamos a devolver..."** para registrar un recordatorio.' 
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [savingAlertIdx, setSavingAlertIdx] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Posicionamiento arrastrable de la ventana
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number }>({ startX: 0, startY: 0, initialX: 0, initialY: 0 });

  // Consumimos el BMS completo (tareas + estadísticas en vivo)
  const { tasks: bmsTasks, stats: bmsStats, auditSystem, isGuideActive, guideMessage, startGuide, stopGuide } = useBms();

  const currentModule = MODULE_NAMES[pathname] || 'Módulo Desconocido';

  // Inicializar posición por defecto (esquina inferior derecha)
  useEffect(() => {
    if (typeof window !== 'undefined' && !position) {
      const defaultX = Math.max(16, window.innerWidth - 410);
      const defaultY = Math.max(16, window.innerHeight - 560);
      setPosition({ x: defaultX, y: defaultY });
    }
  }, [isOpen]);

  // Manejo de Arrastre (Drag)
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setIsDragging(true);
    const initialX = position?.x ?? (window.innerWidth - 410);
    const initialY = position?.y ?? (window.innerHeight - 560);
    dragRef.current = { startX: e.clientX, startY: e.clientY, initialX, initialY };
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    const touch = e.touches[0];
    if (!touch) return;
    setIsDragging(true);
    const initialX = position?.x ?? (window.innerWidth - 410);
    const initialY = position?.y ?? (window.innerHeight - 560);
    dragRef.current = { startX: touch.clientX, startY: touch.clientY, initialX, initialY };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      const newX = Math.min(Math.max(10, dragRef.current.initialX + dx), window.innerWidth - 360);
      const newY = Math.min(Math.max(10, dragRef.current.initialY + dy), window.innerHeight - 150);
      setPosition({ x: newX, y: newY });
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging) return;
      const touch = e.touches[0];
      if (!touch) return;
      const dx = touch.clientX - dragRef.current.startX;
      const dy = touch.clientY - dragRef.current.startY;
      const newX = Math.min(Math.max(10, dragRef.current.initialX + dx), window.innerWidth - 360);
      const newY = Math.min(Math.max(10, dragRef.current.initialY + dy), window.innerHeight - 150);
      setPosition({ x: newX, y: newY });
    };

    const handleDragEnd = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleDragEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDragging]);

  // Si se activa una guía, auto-abrimos el panel
  useEffect(() => {
    if (isGuideActive) {
      setIsOpen(true);
      setMessages(prev => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg && lastMsg.content === guideMessage) return prev;
        return [...prev, { role: 'assistant', content: `[Guía] ${guideMessage}` }];
      });
    }
  }, [isGuideActive, guideMessage]);

  useEffect(() => {
    if (scrollRef.current && isOpen) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || loading) return;

    const userMsg = inputValue.trim();
    setInputValue('');
    
    const updatedMessages = [...messages, { role: 'user', content: userMsg } as Message];
    setMessages(updatedMessages);
    setLoading(true);

    try {
      let recentEvents: any[] = [];
      const moduleKeyMap: Record<string, string> = {
        'Registro de Compras': 'compras',
        'Facturación y Ventas': 'billing',
        'Inventario y Logística': 'inventory',
        'Gerencia y Reportes': 'management',
        'CRM Comercial': 'crm',
      };
      const modKey = moduleKeyMap[currentModule];
      if (modKey) {
        const { data } = await supabase
          .from('nexbot_context_feed')
          .select('*')
          .eq('modulo', modKey)
          .order('created_at', { ascending: false })
          .limit(5);
        if (data) {
          recentEvents = data;
        }
      }

      const [pendingNcAlerts, creditDueAlerts, invRes, supRes] = await Promise.all([
        loadPendingCreditNoteAlerts().catch(() => []),
        loadBmsCreditDueAlerts().catch(() => ({ clientAlerts: [], supplierAlerts: [] })),
        supabase.from('inventory').select('sku, name, price, cost').limit(300).then(r => r.data || [], () => []),
        supabase.from('suppliers').select('name, nit').limit(100).then(r => r.data || [], () => []),
      ]);

      const response = await fetch('/api/chat-asistente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages,
          currentModule: currentModule,
          bmsData: {
            stats: bmsStats,
            tasks: bmsTasks,
            recent_events: recentEvents,
            pendingNcAlerts,
            creditDueAlerts,
            catalog: invRes,
            suppliers: supRes,
          }
        })
      });

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      const responseText = data.response || 'No obtuve respuesta.';
      const ncAlertProposal: NcAlertDraft | null = data.ncAlertProposal || null;
      const orderProposal: OrderProposalDraft | null = data.orderProposal || null;
      
      // Interceptar comandos de TOUR
      const tourMatch = responseText.match(/\[TOUR:\s*([^|\]]+)(?:\|\s*([^\]]+))?\]/);
      if (tourMatch) {
        const targetId = tourMatch[1].trim();
        const message = tourMatch[2]?.trim() || '¡Aquí tienes!';
        startGuide(targetId, message);
        
        const cleanResponse = responseText.replace(/\[TOUR:[^\]]+\]/, '').trim();
        if (cleanResponse) {
          setMessages(prev => [
            ...prev,
            {
              role: 'assistant',
              content: cleanResponse,
              ncAlertProposal,
              ncAlertStatus: ncAlertProposal ? 'pending' : undefined,
              orderProposal,
              orderStatus: orderProposal ? 'pending' : undefined,
            },
          ]);
        }
      } else {
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: responseText,
            ncAlertProposal,
            ncAlertStatus: ncAlertProposal ? 'pending' : undefined,
            orderProposal,
            orderStatus: orderProposal ? 'pending' : undefined,
          },
        ]);
      }
    } catch (err: any) {
      console.error(err);
      setMessages(prev => [
        ...prev, 
        { 
          role: 'assistant', 
          content: 'Lo siento, tuve un problema de conexión para procesar tu consulta. Por favor verifica que la API Key de Gemini esté activa.' 
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const suggestQuestion = (question: string) => {
    setInputValue(question);
  };

  useEffect(() => {
    const handleToggleNexbot = () => setIsOpen(prev => !prev);
    window.addEventListener('nexway:open-nexbot', handleToggleNexbot);
    return () => window.removeEventListener('nexway:open-nexbot', handleToggleNexbot);
  }, []);

  if (pathname === '/login') return null;

  return (
    <>
      {/* VENTANA FLOTANTE Y ARRASTRABLE (SE ABRE DESDE EL BOTÓN NEXBOT EN LA BARRA SUPERIOR) */}
      {isOpen && (
        <div 
          className="fixed z-[100] w-[360px] md:w-[390px] h-[520px] max-h-[85vh] flex flex-col bg-card shadow-2xl rounded-3xl border border-indigo-500/30 overflow-hidden transition-shadow duration-200"
          style={{ 
            left: position ? `${position.x}px` : undefined,
            top: position ? `${position.y}px` : undefined,
            right: !position ? '24px' : undefined,
            bottom: !position ? '24px' : undefined,
            background: 'linear-gradient(135deg, rgba(11,13,25,0.96) 0%, rgba(15,17,40,0.96) 100%)',
            backdropFilter: 'blur(16px)'
          }}
        >
          {/* Header Arrastrable */}
          <CardHeader 
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            className="p-3.5 border-b border-white/10 flex flex-row items-center justify-between bg-white/5 shrink-0 cursor-grab active:cursor-grabbing select-none"
          >
            <div className="flex items-center gap-2.5">
              <div className="text-slate-500 hover:text-white transition-colors">
                <GripHorizontal size={18} />
              </div>
              <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.3)]">
                <Bot size={18} className="animate-pulse" />
              </div>
              <div>
                <CardTitle className="text-xs font-black text-white tracking-wide flex items-center gap-1.5">
                  NexBot Trainer
                  <Sparkles size={12} className="text-amber-400 animate-pulse" />
                </CardTitle>
                <CardDescription className="text-[10px] text-indigo-400/90 font-semibold tracking-wider uppercase">
                  {currentModule}
                </CardDescription>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="h-7 w-7 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg"
                title="Minimizar"
              >
                <Minimize2 size={14} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setIsOpen(false);
                  if (isGuideActive) stopGuide();
                }}
                className="h-7 w-7 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg"
                title="Cerrar"
              >
                <X size={14} />
              </Button>
            </div>
          </CardHeader>

          {/* Cuerpo del Chat */}
          <CardContent className="flex-1 overflow-hidden p-0 flex flex-col bg-transparent relative">
            <ScrollArea className="flex-1 p-3.5">
              <div className="space-y-3.5">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex gap-2.5 max-w-[90%] ${
                      msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''
                    }`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="w-6 h-6 rounded-lg bg-indigo-950 border border-indigo-700/50 flex items-center justify-center text-indigo-400 shrink-0 text-xs shadow-md">
                        🤖
                      </div>
                    )}
                    <div className="space-y-2">
                      <div
                        className={`rounded-2xl p-3 text-xs leading-relaxed whitespace-pre-line shadow-sm ${
                          msg.role === 'user'
                            ? 'bg-indigo-600 text-white rounded-tr-none shadow-indigo-600/20 font-medium'
                            : 'bg-white/5 border border-white/10 text-slate-200 rounded-tl-none'
                        }`}
                      >
                        {msg.content}
                      </div>

                      {msg.ncAlertProposal && (
                        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-2.5 space-y-2 text-[11px]">
                          <div className="font-black text-amber-300 uppercase text-[10px]">
                            🔔 Aviso al BMS · Nota de Crédito Pendiente
                          </div>
                          <div className="text-white font-bold">
                            {msg.ncAlertProposal.entityName}
                            {msg.ncAlertProposal.invoiceRef ? ` · Fact. ${msg.ncAlertProposal.invoiceRef}` : ''}
                            {msg.ncAlertProposal.estimatedAmount ? ` · $${msg.ncAlertProposal.estimatedAmount.toFixed(2)}` : ''}
                          </div>
                          <div className="text-slate-300 text-[10px]">{msg.ncAlertProposal.itemsSummary}</div>

                          {msg.ncAlertStatus === 'pending' && (
                            <div className="flex justify-end gap-1.5 pt-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  setMessages(prev =>
                                    prev.map((m, i) => (i === idx ? { ...m, ncAlertStatus: 'discarded' } : m))
                                  )
                                }
                                className="h-7 px-2 text-[10px] text-slate-300 hover:text-white"
                              >
                                <XCircle size={12} className="mr-1" /> Descartar
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                disabled={savingAlertIdx === idx}
                                onClick={async () => {
                                  setSavingAlertIdx(idx);
                                  try {
                                    const res = await addPendingCreditNoteAlert({
                                      type: msg.ncAlertProposal!.type,
                                      entityName: msg.ncAlertProposal!.entityName,
                                      invoiceRef: msg.ncAlertProposal!.invoiceRef,
                                      itemsSummary: msg.ncAlertProposal!.itemsSummary,
                                      estimatedAmount: msg.ncAlertProposal!.estimatedAmount,
                                      createdBy: 'NexBot IA',
                                    });
                                    if (res.success) {
                                      setMessages(prev =>
                                        prev.map((m, i) => (i === idx ? { ...m, ncAlertStatus: 'saved' } : m))
                                      );
                                      window.dispatchEvent(new CustomEvent('nexway:bms-refresh'));
                                      toast({
                                        title: '🔔 Aviso Guardado en BMS ✓',
                                        description: `El BMS vigilará la Nota de Crédito de ${msg.ncAlertProposal!.entityName}.`,
                                      });
                                    }
                                  } finally {
                                    setSavingAlertIdx(null);
                                  }
                                }}
                                className="h-7 px-2.5 text-[10px] bg-amber-600 hover:bg-amber-700 text-white font-bold"
                              >
                                {savingAlertIdx === idx ? (
                                  <Loader2 size={11} className="animate-spin mr-1" />
                                ) : (
                                  <CheckCircle2 size={12} className="mr-1" />
                                )}
                                Guardar Aviso en BMS
                              </Button>
                            </div>
                          )}

                          {msg.ncAlertStatus === 'saved' && (
                            <div className="text-emerald-400 font-bold text-[10px] flex items-center gap-1">
                              <CheckCircle2 size={12} /> Guardado en BMS y Compras ✓
                            </div>
                          )}
                          {msg.ncAlertStatus === 'discarded' && (
                            <div className="text-slate-400 text-[10px]">Descartado</div>
                          )}
                        </div>
                      )}

                      {msg.orderProposal && (
                        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-2.5 space-y-2 text-[11px]">
                          <div className="font-black text-emerald-300 uppercase text-[10px]">
                            📦 Borrador de Pedido a Proveedor (Sandbox MH)
                          </div>
                          <div className="text-white font-bold">
                            Proveedor: {msg.orderProposal.supplierName}
                          </div>
                          <div className="space-y-1 bg-black/25 rounded-lg p-2">
                            {msg.orderProposal.items.map((it, i) => (
                              <div key={i} className="flex justify-between gap-2 text-[10px]">
                                <span className="text-slate-200 truncate">
                                  <strong>{it.quantity}x</strong> {it.name} <span className="font-mono text-indigo-300">({it.sku})</span>
                                </span>
                                <span className="font-mono font-bold text-emerald-300 shrink-0">
                                  ${(it.quantity * it.cost).toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>

                          {msg.orderStatus === 'pending' && (
                            <div className="flex justify-end gap-1.5 pt-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  setMessages(prev =>
                                    prev.map((m, i) => (i === idx ? { ...m, orderStatus: 'discarded' } : m))
                                  )
                                }
                                className="h-7 px-2 text-[10px] text-slate-300 hover:text-white"
                              >
                                <XCircle size={12} className="mr-1" /> Descartar
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                disabled={savingAlertIdx === idx}
                                onClick={async () => {
                                  setSavingAlertIdx(idx);
                                  try {
                                    const prop = msg.orderProposal!;
                                    const orderCode = `NEXBOT-${Date.now().toString().slice(-6)}`;
                                    const totalEst = prop.items.reduce((s, it) => s + it.quantity * it.cost, 0);

                                    // 1. Registrar Orden en supplier_orders
                                    await supabase.from('supplier_orders').insert({
                                      order_number: orderCode,
                                      supplier_name: prop.supplierName,
                                      items: prop.items,
                                      total_estimated: Number(totalEst.toFixed(2)),
                                      status: 'PENDIENTE',
                                      notes: prop.notes,
                                    });

                                    // 2. Enviar pedido al Sandbox MH para recibir DTE en Compras
                                    const res = await executeRestockOrderAndReceiveDte({
                                      orderCode,
                                      supplierName: prop.supplierName,
                                      supplierNit: prop.supplierNit,
                                      items: prop.items,
                                    });

                                    setMessages(prev =>
                                      prev.map((m, i) =>
                                        i === idx
                                          ? {
                                              ...m,
                                              orderStatus: 'sent',
                                              orderControlNum: res.numeroControl || orderCode,
                                            }
                                          : m
                                      )
                                    );
                                    auditSystem?.();
                                    window.dispatchEvent(new CustomEvent('nexway:bms-refresh'));
                                    toast({
                                      title: res.ok ? '📦 Pedido Enviado y DTE Recibido ✓' : '📦 Orden de Compra Creada ✓',
                                      description: res.ok
                                        ? `Orden ${orderCode} procesada vía Sandbox (${res.numeroControl || 'DTE listo en Compras'}).`
                                        : `Se creó la orden ${orderCode} en Compras → Órdenes de Compra.`,
                                    });
                                  } finally {
                                    setSavingAlertIdx(null);
                                  }
                                }}
                                className="h-7 px-2.5 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                              >
                                {savingAlertIdx === idx ? (
                                  <Loader2 size={11} className="animate-spin mr-1" />
                                ) : (
                                  <CheckCircle2 size={12} className="mr-1" />
                                )}
                                Confirmar y Enviar Pedido
                              </Button>
                            </div>
                          )}

                          {msg.orderStatus === 'sent' && (
                            <div className="text-emerald-400 font-bold text-[10px] flex items-center gap-1">
                              <CheckCircle2 size={12} /> Pedido enviado · Ref: {msg.orderControlNum || 'OK'} (listo en Compras) ✓
                            </div>
                          )}
                          {msg.orderStatus === 'discarded' && (
                            <div className="text-slate-400 text-[10px]">Pedido descartado</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex gap-2.5 max-w-[90%]">
                    <div className="w-6 h-6 rounded-lg bg-indigo-950 border border-indigo-700/50 flex items-center justify-center text-indigo-400 shrink-0 shadow-md">
                      <Loader2 size={12} className="animate-spin" />
                    </div>
                    <div className="bg-white/5 border border-white/10 text-slate-400 rounded-2xl rounded-tl-none p-3 text-xs italic flex items-center gap-2">
                      Consultando manuales del sistema...
                    </div>
                  </div>
                )}
                <div ref={scrollRef} />
              </div>
            </ScrollArea>

            {/* Sugerencias Rápidas */}
            <div className="p-2.5 border-t border-white/5 bg-black/30 flex gap-1.5 overflow-x-auto no-scrollbar scroll-smooth shrink-0">
              <button 
                onClick={() => suggestQuestion('Pide 10 unidades de ACEITE 1 al proveedor')} 
                className="text-[10px] bg-emerald-500/15 border border-emerald-500/30 hover:border-emerald-400/60 text-emerald-300 hover:text-white px-2.5 py-1 rounded-full whitespace-nowrap transition-all shadow-sm"
              >
                📦 Pedir a Proveedor
              </button>
              <button 
                onClick={() => suggestQuestion('¿Qué alertas tiene el BMS hoy?')} 
                className="text-[10px] bg-indigo-500/15 border border-indigo-500/30 hover:border-indigo-400/60 text-indigo-300 hover:text-white px-2.5 py-1 rounded-full whitespace-nowrap transition-all shadow-sm flex items-center gap-1"
              >
                ⚡ Alertas BMS hoy
              </button>
              <button 
                onClick={() => suggestQuestion('¿Qué notas de crédito tenemos pendientes?')} 
                className="text-[10px] bg-amber-500/15 border border-amber-500/30 hover:border-amber-400/60 text-amber-300 hover:text-white px-2.5 py-1 rounded-full whitespace-nowrap transition-all shadow-sm"
              >
                🔔 NC Pendientes
              </button>
              <button 
                onClick={() => suggestQuestion('Avisa al BMS que vamos a devolver 5 unidades a Proveedor de la factura 001-123 por $100 y queda pendiente la nota de crédito')} 
                className="text-[10px] bg-white/5 border border-white/10 hover:border-indigo-400/40 text-slate-300 hover:text-white px-2.5 py-1 rounded-full whitespace-nowrap transition-all shadow-sm"
              >
                📦 Avisar Devolución
              </button>
              <button 
                onClick={() => suggestQuestion('¿Cómo se usa este módulo paso a paso?')} 
                className="text-[10px] bg-white/5 border border-white/10 hover:border-indigo-400/40 text-slate-300 hover:text-white px-2.5 py-1 rounded-full whitespace-nowrap transition-all shadow-sm flex items-center gap-1"
              >
                <BookOpen size={10} /> Guía módulo
              </button>
            </div>

            {/* Input de Chat */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-white/10 bg-white/5 flex gap-2 shrink-0">
              <Input
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder="Pregúntale a NexBot cómo usar el sistema..."
                disabled={loading}
                className="h-9 text-xs bg-black/50 border-white/10 text-white placeholder:text-white/40 rounded-xl focus-visible:ring-indigo-500 shadow-inner"
              />
              <Button
                type="submit"
                size="icon"
                disabled={loading || !inputValue.trim()}
                className="h-9 w-9 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shrink-0 transition-all active:scale-95 shadow-md shadow-indigo-600/20"
              >
                <Send size={14} />
              </Button>
            </form>
          </CardContent>
        </div>
      )}
    </>
  );
}
