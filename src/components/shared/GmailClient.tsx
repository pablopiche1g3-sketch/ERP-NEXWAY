'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Paperclip,
  Star,
  Inbox,
  Send,
  FileJson,
  FileText,
  RefreshCw,
  LogOut,
  CheckCircle2,
  Zap,
  Mail,
  X,
  Reply,
  Loader2,
  Download,
  ShieldCheck,
  AlertTriangle,
  Copy
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface GmailAttachment {
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
  isDteJson: boolean;
}

export interface GmailMessageItem {
  id: string;
  threadId: string;
  sender: string;
  to: string;
  subject: string;
  date: string;
  internalDate: number;
  snippet: string;
  body: string;
  isRead: boolean;
  isStarred: boolean;
  labelIds: string[];
  attachments: GmailAttachment[];
  hasDteJson: boolean;
}

interface GmailClientProps {
  context?: 'compras' | 'crm' | 'gerencia';
  onImportDteToPurchase?: (dte: any) => void;
}

export default function GmailClient({ context = 'compras', onImportDteToPurchase }: GmailClientProps) {
  const { toast } = useToast();

  // Estado de conexión OAuth
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [connected, setConnected] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);

  // Bandeja y navegación
  const [activeFolder, setActiveFolder] = useState<'dte' | 'recibidos' | 'destacados' | 'enviados'>(
    context === 'compras' ? 'dte' : 'recibidos'
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [messages, setMessages] = useState<GmailMessageItem[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState<GmailMessageItem | null>(null);

  // DTEs ya importados a Compras
  const [processedMessageIds, setProcessedMessageIds] = useState<Set<string>>(new Set());
  const [importingId, setImportingId] = useState<string | null>(null);
  const [syncingBatch, setSyncingBatch] = useState(false);

  // Redactar / Responder
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeThreadId, setComposeThreadId] = useState<string | undefined>(undefined);
  const [sending, setSending] = useState(false);

  const loadProcessedDteIds = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'gmail_pending_dtes')
        .maybeSingle();
      if (Array.isArray(data?.value)) {
        const ids = new Set<string>(
          data.value.map((d: any) => d.gmail_message_id).filter(Boolean)
        );
        setProcessedMessageIds(ids);
      }
    } catch {}
  }, []);

  const fetchMessages = useCallback(
    async (folder = activeFolder, q = searchTerm) => {
      setLoadingMessages(true);
      try {
        const params = new URLSearchParams({
          folder,
          maxResults: '25'
        });
        if (q.trim()) params.set('q', q.trim());

        const res = await fetch(`/api/gmail/messages?${params.toString()}`);
        if (res.status === 401) {
          setConnected(false);
          setMessages([]);
          return;
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error cargando correos');
        setMessages(data.messages || []);
        if (data.email) setConnectedEmail(data.email);
      } catch (err: any) {
        toast({
          variant: 'destructive',
          title: 'Error de Gmail',
          description: err?.message || 'No se pudieron obtener los correos.'
        });
      } finally {
        setLoadingMessages(false);
      }
    },
    [activeFolder, searchTerm, toast]
  );

  const checkStatus = useCallback(async () => {
    setCheckingStatus(true);
    try {
      const res = await fetch('/api/gmail/status');
      const data = await res.json();
      setConfigured(Boolean(data.configured));
      setConnected(Boolean(data.connected));
      setConnectedEmail(data.email || null);
      if (data.connected) {
        await Promise.all([fetchMessages(activeFolder, ''), loadProcessedDteIds()]);
      }
    } catch {
      setConnected(false);
    } finally {
      setCheckingStatus(false);
    }
  }, [activeFolder, fetchMessages, loadProcessedDteIds]);

  useEffect(() => {
    checkStatus();
  }, []);

  // Notificar resultado tras regresar de Google OAuth
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('gmail_connected') === '1') {
      toast({
        title: 'Gmail Conectado Exitosamente ✓',
        description: 'Tu correo corporativo ya está listo para importar facturas DTE en 1 clic.'
      });
    } else if (params.get('gmail_error') === 'missing_config') {
      toast({
        variant: 'destructive',
        title: 'Faltan credenciales de Google OAuth',
        description: 'Agrega GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en tu archivo de entorno.'
      });
    }
  }, [toast]);

  const handleConnectGoogle = () => {
    const returnPath = context === 'compras' ? '/compras?tab=gmail' : window.location.pathname;
    window.location.href = `/api/gmail/auth?returnTo=${encodeURIComponent(returnPath)}`;
  };

  const handleDisconnect = async () => {
    await fetch('/api/gmail/status', { method: 'DELETE' });
    setConnected(false);
    setConnectedEmail(null);
    setMessages([]);
    setSelectedMsg(null);
    toast({ title: 'Cuenta Desconectada', description: 'Se cerró la sesión de Gmail en el ERP.' });
  };

  const saveDteToQueue = async (dte: any) => {
    const { data: existingCfg } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'gmail_pending_dtes')
      .maybeSingle();

    const currentList: any[] = Array.isArray(existingCfg?.value) ? existingCfg.value : [];
    const alreadyExists = currentList.some(
      (item) =>
        (dte.codigo_generacion && item.codigo_generacion === dte.codigo_generacion) ||
        (dte.gmail_message_id && item.gmail_message_id === dte.gmail_message_id)
    );

    const nextList = alreadyExists ? currentList : [dte, ...currentList].slice(0, 100);

    await supabase.from('system_config').upsert(
      {
        key: 'gmail_pending_dtes',
        value: nextList,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'key' }
    );

    setProcessedMessageIds((prev) => new Set(prev).add(dte.gmail_message_id));
    return { alreadyExists, dte };
  };

  const handleImportDteFromMessage = async (msg: GmailMessageItem, att: GmailAttachment, openInPurchases = true) => {
    setImportingId(msg.id);
    try {
      const params = new URLSearchParams({
        messageId: msg.id,
        attachmentId: att.attachmentId,
        filename: att.filename,
        parseDte: '1'
      });
      const res = await fetch(`/api/gmail/attachments?${params.toString()}`);
      const data = await res.json();
      if (!res.ok || !data.dte) {
        throw new Error(data.error || 'El archivo JSON no tiene un formato DTE válido.');
      }

      const { alreadyExists, dte } = await saveDteToQueue(data.dte);

      // Marcar correo como leído en Gmail
      fetch('/api/gmail/labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: msg.id, removeLabelIds: ['UNREAD'] })
      }).catch(() => {});

      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, isRead: true } : m)));

      toast({
        title: alreadyExists ? 'DTE Ya Estaba en Cola — Cargando...' : '⚡ Factura DTE Importada a Compras',
        description: `${dte.proveedor_nombre} · ${dte.documento_numero} ($${Number(dte.total || 0).toFixed(2)})`
      });

      if (openInPurchases) {
        if (onImportDteToPurchase) {
          onImportDteToPurchase(dte);
        } else if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('nexway:import-gmail-dte', { detail: dte }));
        }
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'No se pudo leer el DTE',
        description: err?.message || 'Verifica que el adjunto JSON corresponda a una factura DTE.'
      });
    } finally {
      setImportingId(null);
    }
  };

  const handleSyncAllDtes = async () => {
    setSyncingBatch(true);
    try {
      const res = await fetch('/api/gmail/messages?folder=dte&maxResults=20');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error escaneando correos DTE');

      const dteMessages: GmailMessageItem[] = (data.messages || []).filter((m: GmailMessageItem) => m.hasDteJson);
      let importedCount = 0;

      for (const msg of dteMessages) {
        if (processedMessageIds.has(msg.id)) continue;
        const jsonAtt = msg.attachments.find((a) => a.isDteJson);
        if (!jsonAtt) continue;
        try {
          const attRes = await fetch(
            `/api/gmail/attachments?messageId=${encodeURIComponent(msg.id)}&attachmentId=${encodeURIComponent(jsonAtt.attachmentId)}&filename=${encodeURIComponent(jsonAtt.filename)}&parseDte=1`
          );
          const attData = await attRes.json();
          if (attRes.ok && attData.dte) {
            const { alreadyExists } = await saveDteToQueue(attData.dte);
            if (!alreadyExists) importedCount++;
          }
        } catch {}
      }

      await fetchMessages(activeFolder, searchTerm);
      toast({
        title: importedCount > 0 ? `⚡ ${importedCount} Factura(s) DTE Sincronizadas` : 'Bandeja DTE al Día ✓',
        description:
          importedCount > 0
            ? 'Ya están disponibles en Compras → Registro de Compra → "Importar Catálogo DTE".'
            : 'No se encontraron nuevas facturas DTE sin procesar.'
      });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error al sincronizar', description: err?.message });
    } finally {
      setSyncingBatch(false);
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeTo.trim() || !composeSubject.trim()) return;
    setSending(true);
    try {
      const res = await fetch('/api/gmail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: composeTo.trim(),
          subject: composeSubject.trim(),
          message: composeBody.replace(/\n/g, '<br/>'),
          threadId: composeThreadId
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo enviar el correo');

      toast({ title: 'Correo Enviado ✓', description: `Mensaje enviado a ${composeTo}.` });
      setIsComposeOpen(false);
      setComposeTo('');
      setComposeSubject('');
      setComposeBody('');
      setComposeThreadId(undefined);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error al enviar', description: err?.message });
    } finally {
      setSending(false);
    }
  };

  const formatShortDate = (internalDate: number, fallback: string) => {
    if (!internalDate) return fallback?.slice(0, 16) || '';
    const d = new Date(internalDate);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    return isToday
      ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString('es-SV', { day: '2-digit', month: 'short' });
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://tu-dominio.vercel.app';
  const callbackUrl = `${origin}/api/gmail/callback`;

  if (checkingStatus) {
    return (
      <div className="bg-card border border-border rounded-2xl p-16 flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-indigo-500" size={28} />
        <p className="text-xs font-bold text-muted-foreground">Verificando conexión con Google Gmail...</p>
      </div>
    );
  }

  // PANTALLA DE INICIO DE SESIÓN CON GOOGLE (CUANDO NO ESTÁ CONECTADO)
  if (!connected) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 md:p-10 shadow-sm max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center mx-auto">
            <Mail size={32} />
          </div>
          <h3 className="text-xl font-black text-foreground">
            Correo Interno ERP — Conectar con Google (Gmail)
          </h3>
          <p className="text-xs text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Inicia sesión con tu cuenta de Google para recibir facturas electrónicas (DTE JSON / PDF) de tus proveedores directamente en el ERP y pasarlas a <strong>Ingreso de Compra con 1 clic</strong>, sin descargar archivos manualmente.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-1">
            <div className="font-black text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
              <FileJson size={14} /> 1. Detecta DTE Automático
            </div>
            <p className="text-[11px] text-muted-foreground">Identifica al instante correos con archivos .json de Hacienda El Salvador.</p>
          </div>
          <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-1">
            <div className="font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <Zap size={14} /> 2. Ingreso en 1 Clic
            </div>
            <p className="text-[11px] text-muted-foreground">Autocompleta proveedor, N° DTE, productos y costos en Compras sin errores.</p>
          </div>
          <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-1">
            <div className="font-black text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
              <Send size={14} /> 3. Responde y Envía
            </div>
            <p className="text-[11px] text-muted-foreground">Responde a proveedores y envía documentos desde tu correo real sin salir del ERP.</p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 pt-2">
          <Button
            type="button"
            onClick={handleConnectGoogle}
            className="h-12 px-7 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm shadow-lg shadow-indigo-600/20 gap-2.5"
          >
            <ShieldCheck size={18} />
            Iniciar Sesión con Google (Gmail)
          </Button>
          {!configured && (
            <div className="w-full mt-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-left space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-black text-amber-700 dark:text-amber-300">
                <AlertTriangle size={15} />
                Configuración única requerida (Google Cloud Console)
              </div>
              <p className="text-[11px] text-muted-foreground">
                Para habilitar el inicio de sesión con Google en este servidor, agrega estas variables en <code>.env.local</code> (local) y en <strong>Vercel → Settings → Environment Variables</strong>:
              </p>
              <div className="p-3 rounded-lg bg-background border border-border font-mono text-[10.5px] text-foreground space-y-1 overflow-x-auto">
                <div>GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com</div>
                <div>GOOGLE_CLIENT_SECRET=tu-client-secret</div>
                <div>GOOGLE_REDIRECT_URI={callbackUrl}</div>
              </div>
              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-[10.5px] text-muted-foreground">
                  URI de redirección autorizada para pegar en Google Cloud:
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px] font-bold rounded-lg gap-1"
                  onClick={() => {
                    navigator.clipboard?.writeText(callbackUrl);
                    toast({ title: 'URL Copiada', description: callbackUrl });
                  }}
                >
                  <Copy size={11} /> Copiar Callback URL
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // BANDEJA REAL CONECTADA A GMAIL
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm flex flex-col min-h-[640px]">
      {/* Barra Superior */}
      <div className="p-3.5 border-b border-border bg-muted/30 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-[11px] font-bold px-2.5 py-1 gap-1.5">
            <CheckCircle2 size={13} />
            {connectedEmail || 'Gmail Conectado'}
          </Badge>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              fetchMessages(activeFolder, searchTerm);
            }}
            className="relative w-64 sm:w-80"
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
            <Input
              placeholder="Buscar correos, proveedores o DTE..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-xs rounded-xl bg-background border-input"
            />
          </form>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={handleSyncAllDtes}
            disabled={syncingBatch}
            className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl gap-1.5"
          >
            {syncingBatch ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
            Sincronizar DTEs del Día
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => fetchMessages(activeFolder, searchTerm)}
            disabled={loadingMessages}
            className="h-9 text-xs font-bold rounded-xl gap-1.5"
          >
            <RefreshCw size={13} className={loadingMessages ? 'animate-spin' : ''} />
            Actualizar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setComposeTo('');
              setComposeSubject('');
              setComposeBody('');
              setComposeThreadId(undefined);
              setIsComposeOpen(true);
            }}
            className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl gap-1.5"
          >
            <Send size={13} /> Redactar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleDisconnect}
            className="h-9 text-xs font-bold text-muted-foreground hover:text-rose-500 rounded-xl gap-1"
            title="Desconectar cuenta de Google"
          >
            <LogOut size={13} />
          </Button>
        </div>
      </div>

      {/* Cuerpo Dividido: Carpetas | Lista de Correos | Lector + Acción 1 Clic */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-[560px]">
        {/* Carpetas */}
        <div className="lg:col-span-2 border-b lg:border-b-0 lg:border-r border-border p-3 flex lg:flex-col gap-1.5 overflow-x-auto bg-muted/15">
          {[
            { id: 'dte', label: 'Facturas / DTE', icon: <FileJson size={15} className="text-emerald-500" /> },
            { id: 'recibidos', label: 'Recibidos', icon: <Inbox size={15} className="text-indigo-500" /> },
            { id: 'destacados', label: 'Destacados', icon: <Star size={15} className="text-amber-500" /> },
            { id: 'enviados', label: 'Enviados', icon: <Send size={15} className="text-blue-500" /> }
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setActiveFolder(f.id as any);
                setSelectedMsg(null);
                fetchMessages(f.id as any, searchTerm);
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                activeFolder === f.id
                  ? 'bg-indigo-600/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
              }`}
            >
              {f.icon}
              <span>{f.label}</span>
            </button>
          ))}
        </div>

        {/* Lista de Correos */}
        <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-border flex flex-col">
          <ScrollArea className="h-[300px] lg:h-[560px]">
            {loadingMessages ? (
              <div className="py-16 flex flex-col items-center gap-2 text-muted-foreground">
                <Loader2 className="animate-spin text-indigo-500" size={22} />
                <span className="text-xs font-medium">Cargando bandeja de Gmail...</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="py-16 px-4 text-center text-xs text-muted-foreground space-y-1">
                <Mail className="mx-auto opacity-40 mb-2" size={26} />
                <p className="font-bold">No se encontraron correos en esta carpeta.</p>
                <p className="text-[11px]">Prueba cambiar de carpeta o presionar Actualizar.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {messages.map((msg) => {
                  const isProcessed = processedMessageIds.has(msg.id);
                  const isSelected = selectedMsg?.id === msg.id;
                  return (
                    <div
                      key={msg.id}
                      onClick={() => setSelectedMsg(msg)}
                      className={`p-3.5 cursor-pointer transition-colors space-y-1.5 ${
                        isSelected
                          ? 'bg-indigo-500/10 border-l-4 border-l-indigo-600'
                          : !msg.isRead
                          ? 'bg-muted/30 hover:bg-muted/50'
                          : 'hover:bg-muted/30'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-xs truncate ${!msg.isRead ? 'font-black text-foreground' : 'font-semibold text-foreground/85'}`}>
                          {msg.sender.replace(/<.*>/, '').trim() || msg.sender}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {formatShortDate(msg.internalDate, msg.date)}
                        </span>
                      </div>

                      <div className={`text-xs truncate ${!msg.isRead ? 'font-bold text-foreground' : 'text-foreground/80'}`}>
                        {msg.subject}
                      </div>

                      <p className="text-[11px] text-muted-foreground line-clamp-1">{msg.snippet}</p>

                      {(msg.hasDteJson || msg.attachments.length > 0 || isProcessed) && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          {msg.hasDteJson && (
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-[9px] font-black px-1.5 py-0">
                              📄 DTE JSON
                            </Badge>
                          )}
                          {isProcessed && (
                            <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30 text-[9px] font-black px-1.5 py-0">
                              ✓ En Compras
                            </Badge>
                          )}
                          {msg.attachments.length > 0 && !msg.hasDteJson && (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 gap-1">
                              <Paperclip size={9} /> {msg.attachments.length}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Panel Lector + Botón 1 Clic a Ingreso de Compra */}
        <div className="lg:col-span-6 flex flex-col bg-background/40">
          {!selectedMsg ? (
            <div className="flex-1 flex flex-col items-center justify-center p-10 text-center text-muted-foreground gap-2">
              <Mail size={36} className="opacity-30" />
              <p className="text-sm font-bold text-foreground/70">Selecciona un correo para leerlo</p>
              <p className="text-xs max-w-sm">
                Si el correo contiene un archivo <strong>.json (DTE)</strong> de un proveedor, verás el botón para enviarlo directo a <strong>Ingreso de Compra en 1 clic</strong>.
              </p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col h-full">
              {/* Encabezado del Correo */}
              <div className="p-4 border-b border-border space-y-2.5 bg-card">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-black text-foreground leading-snug">{selectedMsg.subject}</h3>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const matchEmail = selectedMsg.sender.match(/<([^>]+)>/)?.[1] || selectedMsg.sender;
                      setComposeTo(matchEmail);
                      setComposeSubject(
                        selectedMsg.subject.startsWith('Re:') ? selectedMsg.subject : `Re: ${selectedMsg.subject}`
                      );
                      setComposeBody('');
                      setComposeThreadId(selectedMsg.threadId);
                      setIsComposeOpen(true);
                    }}
                    className="h-8 text-xs font-bold rounded-xl gap-1 shrink-0"
                  >
                    <Reply size={13} /> Responder
                  </Button>
                </div>
                <div className="text-[11px] text-muted-foreground flex flex-wrap justify-between gap-2">
                  <span>
                    <strong>De:</strong> {selectedMsg.sender}
                  </span>
                  <span>{selectedMsg.date}</span>
                </div>

                {/* Banner de Acción Rápida para Adjuntos DTE JSON */}
                {selectedMsg.attachments.filter((a) => a.isDteJson).length > 0 && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="text-xs font-black text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                        <FileJson size={15} /> Factura Electrónica DTE Detectada
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Carga automáticamente proveedor, número de control y productos en Compras.
                      </p>
                    </div>
                    {selectedMsg.attachments
                      .filter((a) => a.isDteJson)
                      .map((att) => (
                        <Button
                          key={att.attachmentId}
                          type="button"
                          size="sm"
                          disabled={importingId === selectedMsg.id}
                          onClick={() => handleImportDteFromMessage(selectedMsg, att, true)}
                          className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl gap-1.5 shadow-sm"
                        >
                          {importingId === selectedMsg.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Zap size={14} />
                          )}
                          Pasar a Ingreso de Compra (1 Clic)
                        </Button>
                      ))}
                  </div>
                )}
              </div>

              {/* Cuerpo y Adjuntos */}
              <ScrollArea className="flex-1 p-5 h-[360px]">
                <div className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                  {selectedMsg.body}
                </div>

                {selectedMsg.attachments.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-border space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block">
                      Archivos Adjuntos ({selectedMsg.attachments.length})
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {selectedMsg.attachments.map((att) => (
                        <div
                          key={att.attachmentId}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border text-xs"
                        >
                          {att.isDteJson ? (
                            <FileJson size={15} className="text-emerald-500 shrink-0" />
                          ) : (
                            <FileText size={15} className="text-indigo-500 shrink-0" />
                          )}
                          <span className="font-bold text-foreground truncate max-w-[180px]">{att.filename}</span>
                          <a
                            href={`/api/gmail/attachments?messageId=${encodeURIComponent(selectedMsg.id)}&attachmentId=${encodeURIComponent(att.attachmentId)}&filename=${encodeURIComponent(att.filename)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 text-[11px] font-bold"
                          >
                            <Download size={12} /> Descargar
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </ScrollArea>
            </div>
          )}
        </div>
      </div>

      {/* Modal Redactar / Responder */}
      <Dialog open={isComposeOpen} onOpenChange={setIsComposeOpen}>
        <DialogContent className="max-w-lg bg-card border-border text-foreground rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-black flex items-center gap-2">
              <Send size={16} className="text-indigo-500" />
              {composeThreadId ? 'Responder Correo' : 'Nuevo Correo desde Gmail'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSendEmail} className="space-y-3 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-muted-foreground">Para *</label>
              <Input
                type="email"
                required
                placeholder="proveedor@empresa.com"
                value={composeTo}
                onChange={(e) => setComposeTo(e.target.value)}
                className="h-9 rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-muted-foreground">Asunto *</label>
              <Input
                required
                placeholder="Solicitud de pedido / Consulta de factura..."
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
                className="h-9 rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-muted-foreground">Mensaje</label>
              <Textarea
                rows={6}
                placeholder="Escribe tu mensaje..."
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                className="rounded-xl text-xs"
              />
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setIsComposeOpen(false)} className="rounded-xl">
                Cancelar
              </Button>
              <Button type="submit" disabled={sending} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl gap-1.5">
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Enviar Correo
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
