'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Paperclip, Clock, Star, Inbox, Send, File, 
  Tag, MoreVertical, Plus, ChevronRight, ChevronLeft, Settings, 
  HelpCircle, Grid, Image as ImageIcon, FileText,
  AlertCircle, SlidersHorizontal, RotateCcw, Database, X, Reply, Check,
  Trash2, ShieldCheck
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from "@/components/ui/button";
import { logNexbotEvent } from '@/contexts/BmsContext';
import { supabase } from '@/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';

interface Attachment {
  name: string;
  type: 'pdf' | 'image' | 'xml';
}

interface EmailMessage {
  id: string;
  sender: string;
  body: string;
  date: string;
}

interface EmailThread {
  id: string;
  sender: string;
  subject: string;
  date: string;
  isRead: boolean;
  isStarred: boolean;
  snippet: string;
  folder?: 'recibidos' | 'enviados';
  attachments?: Attachment[];
  messages: EmailMessage[];
}

const mockThreads: EmailThread[] = [
  {
    id: '1',
    sender: 'Proveedor de Materiales <ventas@materiales.com>',
    subject: 'Cotización solicitada para proyecto norte',
    date: '10:30',
    isRead: false,
    isStarred: true,
    folder: 'recibidos',
    snippet: 'Adjunto la cotización para los insumos solicitados el día de ayer. Quedo atento a comentarios...',
    attachments: [
      { name: 'Cotizacion_01.pdf', type: 'pdf' }
    ],
    messages: [
      {
        id: 'm1',
        sender: 'Proveedor de Materiales <ventas@materiales.com>',
        body: 'Buenos días,\n\nAdjunto la cotización para los insumos solicitados el día de ayer. Quedo atento a sus comentarios para proceder con el despacho.\n\nSaludos.',
        date: '10:30 AM'
      }
    ]
  },
  {
    id: '2',
    sender: 'Facturación Electrónica <facturas@proveedor.com>',
    subject: 'Nueva Factura DTE-001923',
    date: 'Ayer',
    isRead: false,
    isStarred: false,
    folder: 'recibidos',
    snippet: 'Se ha emitido un nuevo Comprobante de Crédito Fiscal a su nombre. Puede revisar los documentos adjuntos...',
    attachments: [
      { name: 'DTE-001923.pdf', type: 'pdf' },
      { name: 'DTE-001923.xml', type: 'xml' }
    ],
    messages: [
      {
        id: 'm2',
        sender: 'Facturación Electrónica <facturas@proveedor.com>',
        body: 'Estimado cliente,\n\nSe ha emitido un nuevo Comprobante de Crédito Fiscal a su nombre. Puede revisar los documentos adjuntos (PDF y XML).\n\nAtentamente,\nDepartamento de Facturación',
        date: 'Ayer 15:45'
      }
    ]
  }
];

export default function GmailClient({ context = 'compras' }: { context?: 'compras' | 'crm' | 'gerencia' }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFolder, setActiveFolder] = useState<'recibidos' | 'destacados' | 'enviados'>('recibidos');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [threads, setThreads] = useState<EmailThread[]>(mockThreads);
  
  // Compose State
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [sending, setSending] = useState(false);

  // View State
  const [selectedThread, setSelectedThread] = useState<EmailThread | null>(null);

  const { toast } = useToast();

  // Cargar correos DTE enviados desde la simulación
  const loadSentDteEmails = () => {
    if (typeof window === 'undefined') return;
    try {
      const sentLogs = JSON.parse(localStorage.getItem('nexway_sent_dte_emails') || '[]');
      if (Array.isArray(sentLogs) && sentLogs.length > 0) {
        const mappedSent: EmailThread[] = sentLogs.map((entry: any) => {
          const dt = entry.sentAt ? new Date(entry.sentAt) : new Date();
          return {
            id: entry.id || `sent-${entry.correlative}`,
            sender: `Para: ${entry.customerName} <${entry.recipientEmail}>`,
            subject: `Factura Electrónica ${entry.correlative} (${entry.docType}) - $${Number(entry.total || 0).toFixed(2)}`,
            date: dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isRead: true,
            isStarred: false,
            folder: 'enviados',
            snippet: `DTE emitido y firmado electrónicamente. Cód. Generación: ${entry.codigoGeneracion || 'N/A'}`,
            attachments: [
              { name: `${entry.correlative}.pdf`, type: 'pdf' },
              { name: `${entry.correlative}.json`, type: 'xml' }
            ],
            messages: [
              {
                id: `msg-${entry.id}`,
                sender: `Facturación Electrónica NexWay <facturacion.dte@nexway.com.sv> -> ${entry.recipientEmail}`,
                body: `Estimado(a) ${entry.customerName},\n\nSe ha emitido exitosamente su Documento Tributario Electrónico (${entry.docType}).\n\n• Número de Control: ${entry.correlative}\n• Código de Generación: ${entry.codigoGeneracion || 'N/A'}\n• Sello de Recepción MH: ${entry.selloRecepcion || 'N/A'}\n• Monto Total Facturado: $${Number(entry.total || 0).toFixed(2)} USD\n\nAdjunto encontrará la representación gráfica (PDF) y el archivo estructurado (JSON) verificados ante el Ministerio de Hacienda.\n\nAtentamente,\nNEXWAY ERP S.A. DE C.V.`,
                date: dt.toLocaleString('es-SV')
              }
            ]
          };
        });

        setThreads(prev => {
          const inboxOnly = prev.filter(t => t.folder !== 'enviados');
          return [...inboxOnly, ...mappedSent];
        });
      }
    } catch (e) {
      console.warn('Error leyendo nexway_sent_dte_emails:', e);
    }
  };

  useEffect(() => {
    loadSentDteEmails();
  }, [activeFolder]);

  const filteredThreads = useMemo(() => {
    return threads.filter(thread => {
      const folderMatch =
        activeFolder === 'destacados'
          ? thread.isStarred
          : activeFolder === 'enviados'
          ? thread.folder === 'enviados'
          : thread.folder !== 'enviados';

      if (!folderMatch) return false;

      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      return (
        thread.subject.toLowerCase().includes(q) ||
        thread.sender.toLowerCase().includes(q) ||
        thread.snippet.toLowerCase().includes(q)
      );
    });
  }, [threads, activeFolder, searchTerm]);

  const handleDeleteThread = (threadId: string, event?: React.MouseEvent) => {
    if (event) event.stopPropagation();
    setThreads(prev => prev.filter(t => t.id !== threadId));
    if (selectedThread?.id === threadId) {
      setSelectedThread(null);
    }
    toast({ title: 'Correo eliminado', description: 'El correo ha sido eliminado.' });
  };

  const handleStoreInCatalog = async (thread: EmailThread, event: React.MouseEvent) => {
    event.stopPropagation();
    setProcessingId(thread.id);
    
    try {
      const mockPayload = {
        identificacion: { numeroControl: `DTE-${Math.floor(Math.random() * 10000)}` },
        emisor: { nombre: thread.sender.split('<')[0].trim(), nit: '0614-010101-101-1' },
        cuerpoDocumento: [
          { codigo: 'PROD-01', descripcion: 'Producto Simulado 1', cantidad: 10, precioUni: 25.50 },
          { codigo: 'PROD-02', descripcion: 'Producto Simulado 2', cantidad: 5, precioUni: 12.00 }
        ],
        resumen: { totalPagar: 315.00 }
      };

      const { error } = await supabase.from('facturas_proveedores_json').insert({
        proveedor_nit: mockPayload.emisor.nit,
        proveedor_nombre: mockPayload.emisor.nombre,
        documento_numero: mockPayload.identificacion.numeroControl,
        payload_json: mockPayload,
        estado: 'PENDIENTE_PROCESAR'
      });

      if (error) throw error;

      await logNexbotEvent(
        'compras',
        'DTE_CATALOGO',
        { nit: mockPayload.emisor.nit, dte: mockPayload.identificacion.numeroControl },
        `Se pre-cargó exitosamente el DTE ${mockPayload.identificacion.numeroControl} del proveedor ${mockPayload.emisor.nombre} desde la bandeja de Gmail hacia el Catálogo de Compras.`
      );

      toast({
        title: "DTE Almacenado",
        description: `El documento ${mockPayload.identificacion.numeroControl} se ha enviado al Catálogo de Compras.`
      });
    } catch (err: any) {
      console.error(err);
      toast({
        variant: "destructive",
        title: "Error al almacenar",
        description: err.message || "No se pudo guardar el DTE en el catálogo."
      });
    } finally {
      setProcessingId(null);
    }
  };

  const toggleReadStatus = async (threadId: string, currentStatus: boolean, event?: React.MouseEvent) => {
    if (event) event.stopPropagation();
    
    setThreads(prev => prev.map(t => t.id === threadId ? { ...t, isRead: !currentStatus } : t));
    
    try {
      const token = localStorage.getItem('google_access_token');
      if (token) {
        await fetch('/api/gmail/labels', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            messageId: threadId,
            addLabelIds: !currentStatus ? [] : ['UNREAD'],
            removeLabelIds: !currentStatus ? ['UNREAD'] : []
          })
        });
      }
    } catch (e) {
      console.error("Error updating labels", e);
      setThreads(prev => prev.map(t => t.id === threadId ? { ...t, isRead: currentStatus } : t));
    }
  };

  const toggleStarStatus = (threadId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setThreads(prev => prev.map(t => t.id === threadId ? { ...t, isStarred: !t.isStarred } : t));
  };

  const handleSendEmail = async () => {
    if (!composeTo || !composeSubject || !composeBody) {
      toast({ variant: 'destructive', title: 'Error', description: 'Complete todos los campos.' });
      return;
    }

    setSending(true);
    try {
      const token = localStorage.getItem('google_access_token');
      if (token) {
        const res = await fetch('/api/gmail/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            to: composeTo,
            subject: composeSubject,
            message: composeBody
          })
        });
        if (!res.ok) throw new Error('Error al enviar correo.');
      }

      // Agregar a la carpeta de enviados local
      const newSentThread: EmailThread = {
        id: `sent-${Date.now()}`,
        sender: `Para: ${composeTo}`,
        subject: composeSubject,
        date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isRead: true,
        isStarred: false,
        folder: 'enviados',
        snippet: composeBody.slice(0, 90),
        messages: [
          {
            id: `m-${Date.now()}`,
            sender: `Yo -> ${composeTo}`,
            body: composeBody,
            date: new Date().toLocaleString('es-SV')
          }
        ]
      };
      setThreads(prev => [newSentThread, ...prev]);
      
      toast({ title: 'Enviado', description: 'El mensaje ha sido enviado exitosamente.' });
      setIsComposeOpen(false);
      setComposeTo('');
      setComposeSubject('');
      setComposeBody('');
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setSending(false);
    }
  };

  const openReply = (thread: EmailThread) => {
    const emailMatch = thread.sender.match(/<(.+)>/);
    const replyTo = emailMatch ? emailMatch[1] : thread.sender;
    
    setComposeTo(replyTo);
    setComposeSubject(thread.subject.startsWith('Re:') ? thread.subject : `Re: ${thread.subject}`);
    setComposeBody('');
    setIsComposeOpen(true);
  };

  const renderComposeModal = () => {
    if (!isComposeOpen) return null;
    return (
      <div className="absolute bottom-0 right-10 w-[400px] bg-white dark:bg-[#202124] rounded-t-xl shadow-2xl border border-slate-200 dark:border-white/10 z-50 flex flex-col overflow-hidden">
        <div className="bg-[#f2f6fc] dark:bg-[#404040] p-3 flex justify-between items-center text-sm font-semibold">
          <span>Mensaje Nuevo</span>
          <X size={18} className="cursor-pointer hover:bg-black/10 rounded-full p-0.5" onClick={() => setIsComposeOpen(false)} />
        </div>
        <div className="p-3 flex flex-col gap-2">
          <Input 
            placeholder="Para" 
            value={composeTo} 
            onChange={e => setComposeTo(e.target.value)} 
            className="border-0 border-b border-slate-200 dark:border-white/10 rounded-none px-0 focus-visible:ring-0 shadow-none text-sm"
          />
          <Input 
            placeholder="Asunto" 
            value={composeSubject} 
            onChange={e => setComposeSubject(e.target.value)} 
            className="border-0 border-b border-slate-200 dark:border-white/10 rounded-none px-0 focus-visible:ring-0 shadow-none text-sm"
          />
          <Textarea 
            placeholder="Escribe tu mensaje aquí..." 
            value={composeBody} 
            onChange={e => setComposeBody(e.target.value)} 
            className="border-0 rounded-none px-0 focus-visible:ring-0 shadow-none text-sm min-h-[200px] resize-none"
          />
        </div>
        <div className="p-3 border-t border-slate-100 dark:border-white/5 flex justify-between items-center">
          <Button onClick={handleSendEmail} disabled={sending} className="bg-[#0b57d0] hover:bg-[#0b57d0]/90 text-white rounded-full px-6">
            {sending ? 'Enviando...' : 'Enviar'}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setIsComposeOpen(false)}>
            <Trash2 size={18} className="text-slate-500" />
          </Button>
        </div>
      </div>
    );
  };

  const renderThreadView = () => {
    if (!selectedThread) return null;
    return (
      <div className="flex-1 flex flex-col bg-white dark:bg-[#1a1a24] m-2 rounded-2xl shadow-sm border border-slate-100 dark:border-transparent overflow-hidden">
        {/* Top bar for thread view */}
        <div className="h-[64px] min-h-[64px] flex items-center px-6 gap-4 border-b border-slate-100 dark:border-white/5">
          <Button variant="ghost" size="icon" onClick={() => setSelectedThread(null)} className="rounded-full">
            <ChevronLeft size={20} />
          </Button>
          <div className="flex flex-col">
            <h2 className="text-base font-bold text-slate-800 dark:text-white truncate">{selectedThread.subject}</h2>
            <div className="flex items-center gap-2 text-xs">
              <span className="bg-slate-100 dark:bg-white/10 px-2 py-0.5 rounded-sm uppercase text-[10px] font-bold">{selectedThread.folder || activeFolder}</span>
            </div>
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" size="icon" onClick={() => toggleReadStatus(selectedThread.id, selectedThread.isRead)} title="Marcar como no leído">
              <Inbox size={18} />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => handleDeleteThread(selectedThread.id)} title="Eliminar correo" className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
              <Trash2 size={18} />
            </Button>
          </div>
        </div>

        {/* Thread Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {selectedThread.messages.map((msg, idx) => (
            <div key={msg.id} className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 font-bold shrink-0">
                {msg.sender.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <div className="font-semibold text-sm">
                    {msg.sender} <span className="text-xs text-slate-500 font-normal ml-2">{msg.date}</span>
                  </div>
                  {idx === selectedThread.messages.length - 1 && (
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => openReply(selectedThread)}>
                        <Reply size={16} />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="text-sm text-slate-800 dark:text-white/90 whitespace-pre-wrap leading-relaxed bg-slate-50 dark:bg-white/5 p-4 rounded-xl border border-slate-100 dark:border-white/5">
                  {msg.body}
                </div>
                
                {/* Attachments for the last message */}
                {idx === selectedThread.messages.length - 1 && selectedThread.attachments && selectedThread.attachments.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5">
                    <p className="text-xs text-slate-500 mb-2">{selectedThread.attachments.length} archivos adjuntos verificados</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedThread.attachments.map((att, aIdx) => (
                        <div key={aIdx} className="flex items-center gap-2 border border-slate-200 dark:border-white/10 rounded-lg p-2 w-[210px] hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer">
                          <div className={`w-8 h-8 rounded flex items-center justify-center shrink-0 ${att.type === 'pdf' ? 'bg-red-100 text-red-600' : att.type === 'xml' ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>
                            {att.type === 'pdf' ? <FileText size={16}/> : att.type === 'xml' ? <File size={16}/> : <ImageIcon size={16}/>}
                          </div>
                          <span className="text-xs font-medium truncate">{att.name}</span>
                        </div>
                      ))}
                      
                      {context === 'compras' && selectedThread.folder !== 'enviados' && selectedThread.attachments.some(a => a.type === 'xml' || a.type === 'pdf') && (
                        <Button 
                          variant="outline" 
                          onClick={(e) => handleStoreInCatalog(selectedThread, e)}
                          disabled={processingId === selectedThread.id}
                          className="h-[50px] ml-2 text-xs font-semibold text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100 dark:text-blue-400 dark:border-blue-900/50 dark:bg-blue-900/20 dark:hover:bg-blue-900/40"
                        >
                          {processingId === selectedThread.id ? <RotateCcw className="animate-spin mr-2 h-4 w-4" /> : <Database className="mr-2 h-4 w-4" />}
                          Almacenar DTE en Catálogo
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Quick Reply Box */}
        <div className="p-4 border-t border-slate-100 dark:border-white/5 mx-6 mb-6 rounded-full border bg-slate-50 dark:bg-white/5 cursor-text flex items-center gap-4 text-slate-500" onClick={() => openReply(selectedThread)}>
          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 font-bold shrink-0">
            Yo
          </div>
          <span className="text-sm">Responde o reenvía este correo...</span>
        </div>
      </div>
    );
  };

  const sentCount = threads.filter(t => t.folder === 'enviados').length;
  const unreadInboxCount = threads.filter(t => t.folder !== 'enviados' && !t.isRead).length;

  return (
    <div className="h-[calc(100vh-120px)] w-full flex bg-[#f6f8fc] dark:bg-[#1a1a24] overflow-hidden rounded-xl border border-slate-200 dark:border-white/10 font-sans shadow-inner relative">
      
      {/* LEFT SIDEBAR */}
      <div className="w-[250px] min-w-[250px] hidden md:flex flex-col bg-[#f6f8fc] dark:bg-[#1a1a24] h-full p-3 overflow-y-auto custom-scrollbar border-r border-slate-200 dark:border-white/5">
        <Button onClick={() => { setComposeTo(''); setComposeSubject(''); setComposeBody(''); setIsComposeOpen(true); }} className="w-[150px] h-12 bg-[#c2e7ff] hover:bg-[#b0d8f3] dark:bg-[#c2e7ff]/20 dark:hover:bg-[#c2e7ff]/30 text-[#001d35] dark:text-[#c2e7ff] rounded-2xl shadow-sm mb-4 justify-start px-4 font-bold">
          <Plus size={20} className="mr-3" /> Redactar
        </Button>
        <div className="flex flex-col gap-1">
          <div 
            className={`flex items-center gap-4 px-4 py-2 rounded-r-full cursor-pointer transition-colors ${activeFolder === 'recibidos' ? 'bg-[#d3e3fd] dark:bg-[#d3e3fd]/15 font-bold text-[#001d35] dark:text-[#d3e3fd]' : 'text-[#444746] dark:text-white/70 hover:bg-slate-200/50 dark:hover:bg-white/5'}`} 
            onClick={() => { setSelectedThread(null); setActiveFolder('recibidos'); }}
          >
            <Inbox size={18} />
            <span className="text-sm">Recibidos</span>
            {unreadInboxCount > 0 && <span className="ml-auto text-xs font-bold">{unreadInboxCount}</span>}
          </div>

          <div 
            className={`flex items-center gap-4 px-4 py-2 rounded-r-full cursor-pointer transition-colors ${activeFolder === 'destacados' ? 'bg-[#d3e3fd] dark:bg-[#d3e3fd]/15 font-bold text-[#001d35] dark:text-[#d3e3fd]' : 'text-[#444746] dark:text-white/70 hover:bg-slate-200/50 dark:hover:bg-white/5'}`}
            onClick={() => { setSelectedThread(null); setActiveFolder('destacados'); }}
          >
            <Star size={18} />
            <span className="text-sm">Destacados</span>
          </div>

          <div 
            className={`flex items-center gap-4 px-4 py-2 rounded-r-full cursor-pointer transition-colors ${activeFolder === 'enviados' ? 'bg-[#d3e3fd] dark:bg-[#d3e3fd]/15 font-bold text-[#001d35] dark:text-[#d3e3fd]' : 'text-[#444746] dark:text-white/70 hover:bg-slate-200/50 dark:hover:bg-white/5'}`}
            onClick={() => { setSelectedThread(null); setActiveFolder('enviados'); }}
          >
            <Send size={18} />
            <span className="text-sm">Enviados (DTE)</span>
            {sentCount > 0 && (
              <span className="ml-auto text-[10px] font-bold bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 px-2 py-0.5 rounded-full">
                {sentCount}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      {selectedThread ? (
        renderThreadView()
      ) : (
        <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#1a1a24] m-2 rounded-2xl shadow-sm border border-slate-100 dark:border-transparent overflow-hidden">
          {/* Top Bar */}
          <div className="h-[64px] min-h-[64px] flex items-center justify-between px-4 gap-4 bg-white dark:bg-[#1a1a24] border-b border-slate-100 dark:border-white/5">
            <div className="flex-1 max-w-[620px] relative flex items-center">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-slate-500" />
              </div>
              <Input 
                placeholder={`Buscar en ${activeFolder}...`} 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-10 bg-[#eaf1fb] dark:bg-white/5 border-transparent focus-visible:bg-white dark:focus-visible:bg-white/10 focus-visible:shadow-md focus-visible:ring-0 rounded-full w-full text-xs"
              />
            </div>

            <div className="flex md:hidden items-center gap-1">
              <Button size="sm" variant={activeFolder === 'recibidos' ? 'default' : 'ghost'} onClick={() => setActiveFolder('recibidos')} className="text-xs h-8">Recibidos</Button>
              <Button size="sm" variant={activeFolder === 'enviados' ? 'default' : 'ghost'} onClick={() => setActiveFolder('enviados')} className="text-xs h-8">Enviados ({sentCount})</Button>
            </div>
          </div>

          {/* Email List Dense */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {filteredThreads.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400 text-xs gap-2">
                <Send className="h-8 w-8 opacity-30" />
                <p>No hay correos en la bandeja de <strong>{activeFolder}</strong>.</p>
              </div>
            ) : (
              filteredThreads.map((thread) => (
                <div 
                  key={thread.id} 
                  onClick={() => {
                    setSelectedThread(thread);
                    if (!thread.isRead) toggleReadStatus(thread.id, false);
                  }}
                  className={`group flex flex-col border-b border-slate-100 dark:border-white/5 cursor-pointer hover:shadow-md z-0 hover:z-10 relative
                    ${!thread.isRead ? 'bg-white dark:bg-[#1a1a24]' : 'bg-[#f2f6fc] dark:bg-[#0a0a14]/60'}
                  `}
                >
                  <div className="flex items-center px-4 py-2 gap-3 h-10">
                    <div 
                      className="flex items-center gap-2 shrink-0 text-slate-300 dark:text-white/30"
                      onClick={(e) => toggleStarStatus(thread.id, e)}
                    >
                      <Star size={18} className={thread.isStarred ? 'text-yellow-400 fill-yellow-400' : 'hover:text-slate-500'} />
                    </div>
                    
                    <div className={`w-[210px] shrink-0 truncate text-xs ${!thread.isRead ? 'font-bold text-slate-800 dark:text-white' : 'text-slate-700 dark:text-white/80'}`}>
                      {thread.sender.split('<')[0].trim()}
                    </div>

                    <div className="flex-1 truncate text-xs min-w-0 flex items-center">
                      <span className={`${!thread.isRead ? 'font-bold text-slate-800 dark:text-white' : 'text-slate-700 dark:text-white/80'} mr-2 truncate shrink-0`}>
                        {thread.subject}
                      </span>
                      <span className="text-slate-500 dark:text-white/50 truncate">- {thread.snippet}</span>
                    </div>

                    <div className={`w-[70px] text-right shrink-0 text-xs ${!thread.isRead ? 'font-bold text-slate-800 dark:text-white' : 'text-slate-600 dark:text-white/60'}`}>
                      {thread.date}
                    </div>
                    <div className="shrink-0 flex items-center ml-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => handleDeleteThread(thread.id, e)}
                        title="Eliminar correo"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>

                  {thread.attachments && thread.attachments.length > 0 && (
                    <div className="flex items-center px-12 md:px-[260px] pb-2 gap-2 overflow-x-auto custom-scrollbar">
                      {thread.attachments.map((att, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-slate-200 dark:border-white/10 text-xs font-medium bg-white dark:bg-[#1a1a24] text-slate-600 dark:text-white/70 hover:bg-slate-50 dark:hover:bg-white/5 shrink-0">
                          {att.type === 'pdf' ? <FileText size={14} className="text-red-600"/> : att.type === 'xml' ? <File size={14} className="text-amber-500"/> : <ImageIcon size={14} className="text-green-500"/>}
                          <span className="truncate max-w-[140px]">{att.name}</span>
                        </div>
                      ))}
                      
                      {context === 'compras' && thread.folder !== 'enviados' && thread.attachments.some(a => a.type === 'xml' || a.type === 'pdf') && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={(e) => handleStoreInCatalog(thread, e)}
                          disabled={processingId === thread.id}
                          className="ml-2 h-7 px-3 text-[11px] font-semibold text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-full"
                        >
                          {processingId === thread.id ? <RotateCcw className="animate-spin mr-1.5 h-3 w-3" /> : <Database className="mr-1.5 h-3 w-3" />}
                          Almacenar DTE
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Floating Compose Window */}
      {renderComposeModal()}

    </div>
  );
}
