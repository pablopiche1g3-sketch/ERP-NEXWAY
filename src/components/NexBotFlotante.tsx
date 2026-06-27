'use client';

import { useBms } from '@/contexts/BmsContext';
import React, { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { 
  MessageSquare, 
  X, 
  Send, 
  Sparkles, 
  Loader2, 
  Bot, 
  ArrowRight,
  HelpCircle,
  Maximize2,
  Minimize2,
  Pointer
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { 
      role: 'assistant', 
      content: '¡Hola! Soy **NexBot**, la interfaz de traducción de tu BMS. 🤖✨\n\n¿En qué puedo ayudarte hoy? Analizo los datos del sistema por ti y te explico qué pasos seguir. *bip-boop*' 
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Consumimos el BMS
  const { tasks: bmsTasks, isGuideActive, targetElementId, guideMessage, stopGuide } = useBms();

  // Estado para la posición dinámica del bot
  const [botPosition, setBotPosition] = useState({ bottom: 24, right: 24, left: 'auto', top: 'auto' });
  const [isPointing, setIsPointing] = useState(false);

  // Lógica para rastrear el elemento objetivo
  useEffect(() => {
    if (isGuideActive && targetElementId) {
      setIsOpen(false); // Cierra el chat si está abierto
      
      const updatePosition = () => {
        const el = document.querySelector(`[data-tour-id="${targetElementId}"]`);
        if (el) {
          const rect = el.getBoundingClientRect();
          // Colocar el bot a la derecha del elemento, o abajo si no hay espacio
          const isMobile = window.innerWidth < 768;
          let newLeft = rect.right + 20;
          let newTop = rect.top + (rect.height / 2) - 40;

          if (isMobile || newLeft + 100 > window.innerWidth) {
            newLeft = rect.left + (rect.width / 2) - 30;
            newTop = rect.bottom + 20;
          }

          setBotPosition({
            left: `${newLeft}px`,
            top: `${newTop}px`,
            bottom: 'auto',
            right: 'auto'
          });
          setIsPointing(true);
        }
      };

      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition);
      
      return () => {
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition);
      };
    } else {
      // Regresa a su esquina
      setBotPosition({ bottom: 24, right: 24, left: 'auto', top: 'auto' });
      setIsPointing(false);
    }
  }, [isGuideActive, targetElementId]);

  // Detect current module name based on path
  const currentModule = MODULE_NAMES[pathname] || 'Módulo Desconocido';

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isMinimized]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || loading) return;

    const userMsg = inputValue.trim();
    setInputValue('');
    
    const updatedMessages = [...messages, { role: 'user', content: userMsg } as Message];
    setMessages(updatedMessages);
    setLoading(true);

    try {
      const response = await fetch('/api/chat-asistente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages,
          currentModule: currentModule,
          bmsData: {
            tasks: bmsTasks
          }
        })
      });

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      const responseText = data.response || 'No obtuve respuesta.';
      
      // Interceptar comandos de TOUR
      const tourMatch = responseText.match(/\[TOUR:([^|]+)\|\s*(.+?)\]/);
      if (tourMatch) {
        const targetId = tourMatch[1].trim();
        const message = tourMatch[2].trim();
        startGuide(targetId, message);
        // Eliminar el comando de la respuesta mostrada en el chat
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
    <div 
      className="fixed z-[100] select-none font-body print:hidden transition-all duration-700 ease-in-out"
      style={{
        bottom: typeof botPosition.bottom === 'number' ? `${botPosition.bottom}px` : botPosition.bottom,
        right: typeof botPosition.right === 'number' ? `${botPosition.right}px` : botPosition.right,
        left: botPosition.left,
        top: botPosition.top,
      }}
    >
      {/* ROBOT FLOTANTE ANIMADO ("MUÑECO") */}
      {!isOpen && (
        <button
          onClick={() => {
            if (isGuideActive) {
              stopGuide();
            } else {
              setIsOpen(true);
            }
          }}
          className="group relative flex flex-col items-center justify-center focus:outline-none transition-all duration-300 active:scale-95"
          style={{ filter: 'drop-shadow(0 0 15px rgba(59, 130, 246, 0.4))' }}
        >
          {/* Globo de ayuda o mensaje del guía */}
          <div className={`absolute py-2 px-4 rounded-xl whitespace-nowrap bg-indigo-600/95 text-white text-[11px] font-bold tracking-wide border border-indigo-400/40 shadow-lg origin-bottom transition-all duration-300 ${isGuideActive ? 'scale-100 -top-[60px] animate-pulse shadow-[0_0_20px_rgba(79,70,229,0.5)]' : 'scale-0 group-hover:scale-100 -top-[45px]'}`}>
            <span className="uppercase text-[9px] font-black tracking-widest block mb-1 opacity-80">
              {isGuideActive ? 'NexBot Guía 🤖' : '¿Necesitas ayuda? 🤖'}
            </span>
            {isGuideActive ? guideMessage : null}
            {/* Triángulo del tooltip */}
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-indigo-600/95 rotate-45 border-r border-b border-indigo-400/40"></div>
          </div>

          {/* CUERPO DEL ROBOT SVG ANIMADO */}
          <div className="w-16 h-20 flex flex-col items-center justify-center animate-bounce duration-2000 ease-in-out relative">
            
            {/* Antena con luz neon verde parpadeante */}
            <div className="w-1 h-3 bg-slate-400 rounded-t-full relative">
              <div className="absolute top-[-5px] left-[-2px] w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <div className="absolute top-[-5px] left-[-2px] w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981]" />
            </div>

            {/* Cabeza del Robot */}
            <div className="w-14 h-10 bg-slate-800 border-2 border-slate-600 rounded-2xl flex flex-col items-center justify-center relative p-1 shadow-inner">
              
              {/* Pantalla de Pixeles (Ojos) */}
              <div className="w-11 h-6 bg-slate-950 rounded-lg flex items-center justify-around px-1">
                {/* Ojo Izquierdo Pixel */}
                <div className="w-2 h-2 bg-cyan-400 rounded-sm animate-pulse shadow-[0_0_6px_#22d3ee]" />
                {/* Sonrisa Pixel */}
                <div className="flex gap-[1px] items-end h-3 mt-1.5">
                  <div className="w-[2px] h-1 bg-cyan-400 shadow-[0_0_4px_#22d3ee]" />
                  <div className="w-[2px] h-[2px] bg-cyan-400 shadow-[0_0_4px_#22d3ee]" />
                  <div className="w-[2px] h-[2px] bg-cyan-400 shadow-[0_0_4px_#22d3ee]" />
                  <div className="w-[2px] h-1 bg-cyan-400 shadow-[0_0_4px_#22d3ee]" />
                </div>
                {/* Ojo Derecho Pixel */}
                <div className="w-2 h-2 bg-cyan-400 rounded-sm animate-pulse shadow-[0_0_6px_#22d3ee]" />
              </div>
              
              {/* Orejas */}
              <div className="absolute left-[-4px] w-1 h-4 bg-slate-600 rounded-l-full" />
              <div className="absolute right-[-4px] w-1 h-4 bg-slate-600 rounded-r-full" />
            </div>

            {/* Cuello */}
            <div className="w-3 h-1 bg-emerald-400 shadow-[0_0_6px_#10b981]" />

            {/* Cuerpo */}
            <div className="w-12 h-10 bg-slate-800 border-2 border-slate-600 rounded-b-xl rounded-t-sm flex items-center justify-center relative">
              {/* Botón Central de Energía */}
              <div className="w-4 h-4 rounded-full bg-blue-500/20 border border-blue-400 flex items-center justify-center animate-pulse">
                <div className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_#3b82f6]" />
              </div>

              {/* Brazos Flotantes Izquierda / Derecha */}
              <div className={`absolute left-[-8px] w-2 h-6 bg-blue-500 rounded-full border border-blue-400/50 transform transition-transform duration-300 ${isPointing ? '-rotate-90 -translate-x-3 -translate-y-2' : '-rotate-12 group-hover:rotate-12'}`}>
                {isPointing && (
                  <div className="absolute -top-3 -left-2 text-white animate-pulse transform rotate-90">
                    <Pointer size={18} className="fill-white" />
                  </div>
                )}
              </div>
              <div className="absolute right-[-8px] w-2 h-6 bg-blue-500 rounded-full border border-blue-400/50 transform rotate-12 group-hover:-rotate-12 transition-transform duration-200" />
            </div>

          </div>
        </button>
      )}

      {/* VENTANA DE CHAT INTEGRADA (GLASSMORPHISM) */}
      {isOpen && (
        <Card 
          className={`glass-card border-white/15 shadow-[0_0_40px_rgba(59,130,246,0.15)] rounded-2xl overflow-hidden backdrop-blur-xl flex flex-col transition-all duration-300 ${
            isMinimized ? 'w-80 h-14' : 'w-[360px] h-[520px] md:w-[380px] md:h-[550px]'
          }`}
          style={{ background: 'linear-gradient(135deg, rgba(11,13,25,0.95) 0%, rgba(15,17,40,0.95) 100%)' }}
        >
          {/* Header del Asistente */}
          <CardHeader className="p-3.5 border-b border-white/10 flex flex-row items-center justify-between bg-white/5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-400/30 flex items-center justify-center text-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.3)]">
                <Bot size={18} className="animate-pulse" />
              </div>
              <div>
                <CardTitle className="text-xs font-black text-white tracking-wide flex items-center gap-1.5">
                  NexBot
                  <Sparkles size={11} className="text-amber-400 animate-pulse" />
                </CardTitle>
                <CardDescription className="text-[9px] text-indigo-400/80 font-semibold tracking-wider uppercase mt-0.5">
                  {currentModule}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMinimized(!isMinimized)}
                className="h-7 w-7 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg"
              >
                {isMinimized ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="h-7 w-7 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg"
              >
                <X size={14} />
              </Button>
            </div>
          </CardHeader>

          {/* Cuerpo del Chat (Mensajes) */}
          {!isMinimized && (
            <>
              <CardContent className="flex-1 overflow-hidden p-0 flex flex-col bg-transparent">
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {messages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex gap-2.5 max-w-[85%] ${
                          msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''
                        }`}
                      >
                        {msg.role === 'assistant' && (
                          <div className="w-6 h-6 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-blue-400 shrink-0 text-[10px]">
                            🤖
                          </div>
                        )}
                        <div
                          className={`rounded-2xl p-3 text-xs leading-relaxed whitespace-pre-line ${
                            msg.role === 'user'
                              ? 'bg-blue-600 text-white rounded-tr-none shadow-md shadow-blue-600/10'
                              : 'bg-white/5 border border-white/10 text-slate-200 rounded-tl-none'
                          }`}
                        >
                          {msg.content}
                        </div>
                      </div>
                    ))}
                    {loading && (
                      <div className="flex gap-2.5 max-w-[85%]">
                        <div className="w-6 h-6 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-blue-400 shrink-0">
                          <Loader2 size={12} className="animate-spin" />
                        </div>
                        <div className="bg-white/5 border border-white/10 text-slate-400 rounded-2xl rounded-tl-none p-3 text-xs italic flex items-center gap-1.5">
                          NexBot está procesando...
                        </div>
                      </div>
                    )}
                    <div ref={scrollRef} />
                  </div>
                </ScrollArea>

                {/* Preguntas Sugeridas Contextuales */}
                <div className="p-2 border-t border-white/5 bg-black/10 flex gap-1.5 overflow-x-auto no-scrollbar scroll-smooth">
                  {pathname === '/inventory' ? (
                    <>
                      <button 
                        onClick={() => suggestQuestion('¿Cómo vinculo el código de un proveedor a mi SKU?')}
                        className="text-[10px] bg-white/5 border border-white/10 hover:border-blue-400/40 text-slate-300 hover:text-white px-2.5 py-1 rounded-full whitespace-nowrap transition-all"
                      >
                        🔗 Mapear Proveedor
                      </button>
                      <button 
                        onClick={() => suggestQuestion('¿Cómo hago una Toma Física de inventario?')}
                        className="text-[10px] bg-white/5 border border-white/10 hover:border-blue-400/40 text-slate-300 hover:text-white px-2.5 py-1 rounded-full whitespace-nowrap transition-all"
                      >
                        ✏ Toma Física
                      </button>
                    </>
                  ) : pathname === '/crm' ? (
                    <>
                      <button 
                        onClick={() => suggestQuestion('¿Cómo funciona el embudo Kanban de oportunidades?')}
                        className="text-[10px] bg-white/5 border border-white/10 hover:border-blue-400/40 text-slate-300 hover:text-white px-2.5 py-1 rounded-full whitespace-nowrap transition-all"
                      >
                        💼 Kanban CRM
                      </button>
                      <button 
                        onClick={() => suggestQuestion('Ayúdame a redactar un correo para reactivar un cliente estancado.')}
                        className="text-[10px] bg-white/5 border border-white/10 hover:border-blue-400/40 text-slate-300 hover:text-white px-2.5 py-1 rounded-full whitespace-nowrap transition-all"
                      >
                        ✉ Redactar Correo
                      </button>
                    </>
                  ) : (
                    <>
                      <button 
                        onClick={() => suggestQuestion('¿Qué módulos tengo autorizados en mi perfil?')}
                        className="text-[10px] bg-white/5 border border-white/10 hover:border-blue-400/40 text-slate-300 hover:text-white px-2.5 py-1 rounded-full whitespace-nowrap transition-all"
                      >
                        🔑 Mis Permisos
                      </button>
                      <button 
                        onClick={() => suggestQuestion('Ayúdame a redactar una minuta para el Centro Documental.')}
                        className="text-[10px] bg-white/5 border border-white/10 hover:border-blue-400/40 text-slate-300 hover:text-white px-2.5 py-1 rounded-full whitespace-nowrap transition-all"
                      >
                        📝 Crear Minuta
                      </button>
                    </>
                  )}
                </div>

                {/* Formulario de Entrada de Texto */}
                <form onSubmit={handleSendMessage} className="p-3 border-t border-white/10 bg-white/5 flex gap-2">
                  <Input
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    placeholder="Escribe tu consulta operativa..."
                    disabled={loading}
                    className="h-9 text-xs bg-black/30 border-white/10 text-white placeholder:text-white/30 rounded-xl focus-visible:ring-blue-500"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={loading || !inputValue.trim()}
                    className="h-9 w-9 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shrink-0 transition-all active:scale-95"
                  >
                    <Send size={14} />
                  </Button>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      )}
    </div>
  );
}
