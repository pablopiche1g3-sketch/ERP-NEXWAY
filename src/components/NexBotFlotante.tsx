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
  BookOpen
} from 'lucide-react';
import { supabase } from '@/supabase/client';
import { CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Message {
  role: 'user' | 'assistant';
  content: string;
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
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { 
      role: 'assistant', 
      content: '¡Hola! Soy **NexBot**, tu asistente y capacitador operativo. 🤖✨\n\nPuedo enseñarte a usar cualquier módulo de NexWay ERP, explicarte paso a paso las operaciones o guiarte por la pantalla.\n\n¿Qué deseas aprender o consultar hoy?' 
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Posicionamiento arrastrable de la ventana
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number }>({ startX: 0, startY: 0, initialX: 0, initialY: 0 });

  // Consumimos el BMS
  const { tasks: bmsTasks, isGuideActive, guideMessage, startGuide, stopGuide } = useBms();

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

      const response = await fetch('/api/chat-asistente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages,
          currentModule: currentModule,
          bmsData: {
            tasks: bmsTasks,
            recent_events: recentEvents
          }
        })
      });

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      const responseText = data.response || 'No obtuve respuesta.';
      
      // Interceptar comandos de TOUR
      const tourMatch = responseText.match(/\[TOUR:\s*([^|\]]+)(?:\|\s*([^\]]+))?\]/);
      if (tourMatch) {
        const targetId = tourMatch[1].trim();
        const message = tourMatch[2]?.trim() || '¡Aquí tienes!';
        startGuide(targetId, message);
        
        const cleanResponse = responseText.replace(/\[TOUR:[^\]]+\]/, '').trim();
        if (cleanResponse) {
          setMessages(prev => [...prev, { role: 'assistant', content: cleanResponse }]);
        }
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: responseText }]);
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

  return (
    <>
      {/* Botón superior derecho para desplegar/abrir NexBot */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed top-4 right-4 md:right-8 z-[90] h-10 px-4 rounded-xl shadow-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2 transition-all active:scale-95 ${
          isGuideActive ? 'animate-pulse ring-4 ring-indigo-500/50' : ''
        }`}
      >
        <Bot size={18} />
        <span className="text-xs font-bold uppercase tracking-wider hidden md:inline">NexBot</span>
      </button>

      {/* VENTANA FLOTANTE Y ARRASTRABLE (SIN OVERLAY NI DESENFOQUE DE PANTALLA) */}
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
                    <div
                      className={`rounded-2xl p-3 text-xs leading-relaxed whitespace-pre-line shadow-sm ${
                        msg.role === 'user'
                          ? 'bg-indigo-600 text-white rounded-tr-none shadow-indigo-600/20 font-medium'
                          : 'bg-white/5 border border-white/10 text-slate-200 rounded-tl-none'
                      }`}
                    >
                      {msg.content}
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
                onClick={() => suggestQuestion('¿Cómo se usa este módulo paso a paso?')} 
                className="text-[10px] bg-indigo-500/10 border border-indigo-500/20 hover:border-indigo-400/50 text-indigo-300 hover:text-white px-2.5 py-1 rounded-full whitespace-nowrap transition-all shadow-sm flex items-center gap-1"
              >
                <BookOpen size={10} /> Capacitarme en este módulo
              </button>
              <button 
                onClick={() => suggestQuestion('¿Cómo registro una venta o factura al crédito?')} 
                className="text-[10px] bg-white/5 border border-white/10 hover:border-indigo-400/40 text-slate-300 hover:text-white px-2.5 py-1 rounded-full whitespace-nowrap transition-all shadow-sm"
              >
                💳 Facturas Crédito
              </button>
              <button 
                onClick={() => suggestQuestion('¿Cómo controlo préstamos y nómina de empleados?')} 
                className="text-[10px] bg-white/5 border border-white/10 hover:border-indigo-400/40 text-slate-300 hover:text-white px-2.5 py-1 rounded-full whitespace-nowrap transition-all shadow-sm"
              >
                👥 Nómina y Préstamos
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
