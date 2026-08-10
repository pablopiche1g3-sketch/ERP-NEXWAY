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
  MessageSquare
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
};

export function NexBotFlotante() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { 
      role: 'assistant', 
      content: '¡Hola! Soy **NexBot**, tu asistente operativo. 🤖✨\n\n¿En qué puedo ayudarte hoy? Analizo los datos del sistema por ti y te explico qué pasos seguir.' 
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Consumimos el BMS
  const { tasks: bmsTasks, isGuideActive, guideMessage, startGuide, stopGuide } = useBms();

  const currentModule = MODULE_NAMES[pathname] || 'Módulo Desconocido';

  // Si se activa una guía, auto-abrimos el panel
  useEffect(() => {
    if (isGuideActive) {
      setIsOpen(true);
      // Opcional: añadir el mensaje de la guía como un mensaje en el chat
      setMessages(prev => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg && lastMsg.content === guideMessage) return prev; // Evita duplicados seguidos
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
          content: 'Lo siento, tuve un problema de conexión para procesar tu consulta. Por favor verifica que la API Key de Gemini esté activa. *bip-error*' 
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
      {/* Botón superior derecho */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed top-4 right-4 md:right-8 z-[90] h-10 px-4 rounded-xl shadow-md bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2 transition-all ${
          isGuideActive ? 'animate-pulse ring-4 ring-indigo-500/50' : ''
        }`}
      >
        <Bot size={18} />
        <span className="text-xs font-bold uppercase tracking-wider hidden md:inline">NexBot</span>
      </button>

      {/* OVERLAY OSCURO (Opcional, para destacar el panel) */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[95] transition-opacity" 
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* PANEL LATERAL (TIPO DRAWER) */}
      <div 
        className={`fixed top-0 right-0 h-full w-[360px] md:w-[400px] z-[100] flex flex-col bg-card shadow-2xl transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ background: 'linear-gradient(135deg, rgba(11,13,25,0.98) 0%, rgba(15,17,40,0.98) 100%)' }}
      >
        {/* Header del Asistente */}
        <CardHeader className="p-4 border-b border-white/10 flex flex-row items-center justify-between bg-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-400/30 flex items-center justify-center text-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.3)]">
              <Bot size={20} className="animate-pulse" />
            </div>
            <div>
              <CardTitle className="text-sm font-black text-white tracking-wide flex items-center gap-1.5">
                NexBot
                <Sparkles size={13} className="text-amber-400 animate-pulse" />
              </CardTitle>
              <CardDescription className="text-[10px] text-indigo-400/80 font-semibold tracking-wider uppercase mt-0.5">
                {currentModule}
              </CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setIsOpen(false);
              if (isGuideActive) stopGuide();
            }}
            className="h-8 w-8 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl"
          >
            <X size={16} />
          </Button>
        </CardHeader>

        {/* Cuerpo del Chat */}
        <CardContent className="flex-1 overflow-hidden p-0 flex flex-col bg-transparent relative">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex gap-3 max-w-[85%] ${
                    msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''
                  }`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-blue-400 shrink-0 text-xs shadow-md">
                      🤖
                    </div>
                  )}
                  <div
                    className={`rounded-2xl p-3.5 text-sm leading-relaxed whitespace-pre-line shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white rounded-tr-none shadow-blue-600/20'
                        : 'bg-white/5 border border-white/10 text-slate-200 rounded-tl-none'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex gap-3 max-w-[85%]">
                  <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-blue-400 shrink-0 shadow-md">
                    <Loader2 size={14} className="animate-spin" />
                  </div>
                  <div className="bg-white/5 border border-white/10 text-slate-400 rounded-2xl rounded-tl-none p-3.5 text-sm italic flex items-center gap-2">
                    Pensando...
                  </div>
                </div>
              )}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>

          {/* Sugerencias Rápidas */}
          <div className="p-3 border-t border-white/5 bg-black/20 flex gap-2 overflow-x-auto no-scrollbar scroll-smooth shrink-0">
            {pathname === '/inventory' ? (
              <>
                <button onClick={() => suggestQuestion('¿Cómo vinculo el código de un proveedor a mi SKU?')} className="text-[11px] bg-white/5 border border-white/10 hover:border-blue-400/40 hover:bg-white/10 text-slate-300 hover:text-white px-3 py-1.5 rounded-full whitespace-nowrap transition-all shadow-sm">
                  🔗 Mapear Proveedor
                </button>
                <button onClick={() => suggestQuestion('¿Cómo hago una Toma Física de inventario?')} className="text-[11px] bg-white/5 border border-white/10 hover:border-blue-400/40 hover:bg-white/10 text-slate-300 hover:text-white px-3 py-1.5 rounded-full whitespace-nowrap transition-all shadow-sm">
                  ✏ Toma Física
                </button>
              </>
            ) : pathname === '/crm' ? (
              <>
                <button onClick={() => suggestQuestion('¿Cómo funciona el embudo Kanban de oportunidades?')} className="text-[11px] bg-white/5 border border-white/10 hover:border-blue-400/40 hover:bg-white/10 text-slate-300 hover:text-white px-3 py-1.5 rounded-full whitespace-nowrap transition-all shadow-sm">
                  💼 Kanban CRM
                </button>
                <button onClick={() => suggestQuestion('Ayúdame a redactar un correo para reactivar un cliente estancado.')} className="text-[11px] bg-white/5 border border-white/10 hover:border-blue-400/40 hover:bg-white/10 text-slate-300 hover:text-white px-3 py-1.5 rounded-full whitespace-nowrap transition-all shadow-sm">
                  ✉ Redactar Correo
                </button>
              </>
            ) : (
              <>
                <button onClick={() => suggestQuestion('¿Qué módulos tengo autorizados en mi perfil?')} className="text-[11px] bg-white/5 border border-white/10 hover:border-blue-400/40 hover:bg-white/10 text-slate-300 hover:text-white px-3 py-1.5 rounded-full whitespace-nowrap transition-all shadow-sm">
                  🔑 Mis Permisos
                </button>
                <button onClick={() => suggestQuestion('Ayúdame a redactar una minuta para el Centro Documental.')} className="text-[11px] bg-white/5 border border-white/10 hover:border-blue-400/40 hover:bg-white/10 text-slate-300 hover:text-white px-3 py-1.5 rounded-full whitespace-nowrap transition-all shadow-sm">
                  📝 Crear Minuta
                </button>
              </>
            )}
          </div>

          {/* Input de Chat */}
          <form onSubmit={handleSendMessage} className="p-4 border-t border-white/10 bg-white/5 flex gap-2 shrink-0">
            <Input
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              placeholder="Escribe tu consulta..."
              disabled={loading}
              className="h-10 text-sm bg-black/40 border-white/10 text-white placeholder:text-white/40 rounded-xl focus-visible:ring-blue-500 shadow-inner"
            />
            <Button
              type="submit"
              size="icon"
              disabled={loading || !inputValue.trim()}
              className="h-10 w-10 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shrink-0 transition-all active:scale-95 shadow-md shadow-blue-600/20"
            >
              <Send size={16} />
            </Button>
          </form>
        </CardContent>
      </div>
    </>
  );
}
