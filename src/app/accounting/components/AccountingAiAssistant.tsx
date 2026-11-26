'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Loader2,
  Bot,
  User,
  Scale,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { postDoubleEntryJournal } from '@/lib/accounting-journal';
import {
  addPendingCreditNoteAlert,
  loadPendingCreditNoteAlerts,
} from '@/lib/credit-note-alerts';
import type {
  AccountingJournalProposal,
  AccountingNcAlertProposal,
} from '@/app/api/accounting/ai-assistant/route';

export interface AccountingLiveContext {
  activeTab: string;
  filterMonth: string;
  filterYear: string;
  activeIncome: number;
  activeExpenses: number;
  grossProfit: number;
  totalDebitFiscal: number;
  totalCreditFiscal: number;
  f07TaxBalance: number;
  f14PagoCuenta: number;
  f14Total: number;
  trialTotalDebit: number;
  trialTotalCredit: number;
  trialBalanced: boolean;
  journalCount: number;
  pettyCashCount: number;
  ivaRate: number;
  pagoCuentaRate: number;
  recentEntries: Array<{ description: string; amount: number; type?: string; date?: string }>;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  proposal?: AccountingJournalProposal | null;
  proposalStatus?: 'pending' | 'posted' | 'discarded';
  ncAlertProposal?: AccountingNcAlertProposal | null;
  ncAlertStatus?: 'pending' | 'saved' | 'discarded';
}

interface AccountingAiAssistantProps {
  context: AccountingLiveContext;
  branchId?: string | null;
  onJournalPosted: () => Promise<void> | void;
}

const QUICK_PROMPTS = [
  { label: '¿Qué reviso hoy?', prompt: '¿Qué debo revisar hoy paso a paso como auxiliar contable?' },
  { label: 'Resumen F-07 / F-14', prompt: 'Resúmeme F-07 (IVA) y F-14 de este mes.' },
  { label: '¿NC pendientes?', prompt: '¿Qué notas de crédito tenemos pendientes en el BMS?' },
  { label: 'Avisar devolución al BMS', prompt: 'Avisa al BMS que vamos a regresar 5 galones a Proveedor de la factura 001-234 por $120 y queda pendiente la nota de crédito.' },
  { label: 'Partida Luz $120', prompt: 'Prepara partida de recibo de luz $120 por transferencia bancaria.' },
];

function renderFormattedText(text: string) {
  return text.split('\n').map((line, lineIdx) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <p key={lineIdx} className={line.trim() === '' ? 'h-2' : 'leading-relaxed'}>
        {parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <strong key={i} className="font-bold text-foreground">
                {part.slice(2, -2)}
              </strong>
            );
          }
          return <React.Fragment key={i}>{part}</React.Fragment>;
        })}
      </p>
    );
  });
}

export function AccountingAiAssistant({
  context,
  branchId = null,
  onJournalPosted,
}: AccountingAiAssistantProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [postingId, setPostingId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Hola 👋 Soy tu **Asistente Contable IA** (exclusivo de Contabilidad).\n\n- **Nivel 1:** Puedo explicarte tu rutina paso a paso, resumir F-07 (IVA), F-14 y verificar si tu Balance cuadra.\n- **Nivel 2:** Puedo prepararte borradores de **partidas dobles cuadradas** (recibos, alquiler, planilla, gasolina) para que tú las revises y las confirmes con un clic.',
      proposal: null,
    },
  ]);

  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
    }
  }, [messages, open]);

  const sendMessage = async (textToSend?: string) => {
    const trimmed = (textToSend ?? input).trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed,
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setLoading(true);

    try {
      const historyPayload = messages
        .slice(-6)
        .map(m => ({ role: m.role, text: m.text }));

      const liveNcAlerts = await loadPendingCreditNoteAlerts().catch(() => []);

      const res = await fetch('/api/accounting/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history: historyPayload,
          context: {
            ...context,
            pendingNcAlerts: liveNcAlerts,
          },
        }),
      });

      const data = await res.json();
      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: data?.reply || 'Listo. ¿En qué más puedo apoyarte en Contabilidad?',
        proposal: data?.proposal || null,
        proposalStatus: data?.proposal ? 'pending' : undefined,
        ncAlertProposal: data?.ncAlertProposal || null,
        ncAlertStatus: data?.ncAlertProposal ? 'pending' : undefined,
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      console.error('Error consultando Asistente Contable IA:', err);
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          text: 'No pude conectar con el servicio de IA en este momento. Intenta nuevamente.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmProposal = async (msgId: string, proposal: AccountingJournalProposal) => {
    setPostingId(msgId);
    try {
      const result = await postDoubleEntryJournal({
        description: `[IA Contable] ${proposal.description}`,
        amount: proposal.amount,
        type: 'Avanzado',
        branchId: branchId || null,
        lines: proposal.lines,
      });

      if (!result.success) {
        toast({
          variant: 'destructive',
          title: 'Error al contabilizar',
          description: 'No se pudo guardar la partida en Libro Diario. Intenta de nuevo.',
        });
        return;
      }

      setMessages(prev =>
        prev.map(m => (m.id === msgId ? { ...m, proposalStatus: 'posted' } : m))
      );

      toast({
        title: 'Partida Contabilizada ✓',
        description: `Se registró "${proposal.description}" por $${proposal.amount.toFixed(2)} en Libro Diario.`,
      });

      await onJournalPosted();
    } finally {
      setPostingId(null);
    }
  };

  const handleDiscardProposal = (msgId: string) => {
    setMessages(prev =>
      prev.map(m => (m.id === msgId ? { ...m, proposalStatus: 'discarded' } : m))
    );
  };

  const handleConfirmNcAlert = async (msgId: string, alertProp: AccountingNcAlertProposal) => {
    setPostingId(msgId);
    try {
      const res = await addPendingCreditNoteAlert({
        type: alertProp.type,
        entityName: alertProp.entityName,
        invoiceRef: alertProp.invoiceRef,
        itemsSummary: alertProp.itemsSummary,
        estimatedAmount: alertProp.estimatedAmount,
        createdBy: 'Asistente IA',
      });
      if (!res.success) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar el aviso en el BMS.' });
        return;
      }
      setMessages(prev =>
        prev.map(m => (m.id === msgId ? { ...m, ncAlertStatus: 'saved' } : m))
      );
      toast({
        title: '🔔 Aviso Guardado en BMS ✓',
        description: `El BMS vigilará la Nota de Crédito de ${alertProp.entityName} y te avisará cuando caiga.`,
      });
    } finally {
      setPostingId(null);
    }
  };

  const handleDiscardNcAlert = (msgId: string) => {
    setMessages(prev =>
      prev.map(m => (m.id === msgId ? { ...m, ncAlertStatus: 'discarded' } : m))
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl text-xs h-10 font-bold shadow-md gap-1.5 px-3.5"
        >
          <Sparkles size={14} />
          <span>Asistente Contable IA</span>
          <Badge className="bg-white/20 text-white border-0 text-[9px] px-1.5 py-0 h-4 font-black ml-0.5">
            Nivel 2
          </Badge>
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden rounded-2xl border-border bg-card flex flex-col max-h-[85vh]">
        <DialogHeader className="px-5 py-4 border-b border-border bg-slate-50/70 dark:bg-slate-900/60">
          <div className="flex items-center justify-between gap-2 pr-6">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-sm">
                <Sparkles size={16} />
              </div>
              <div>
                <DialogTitle className="text-base font-black text-foreground flex items-center gap-2">
                  Asistente Contable IA
                  <Badge variant="outline" className="text-[10px] font-bold border-indigo-300 text-indigo-600 dark:text-indigo-400">
                    Solo Contabilidad
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Consulta fiscal en vivo (Nivel 1) y borradores de partidas dobles con aprobación (Nivel 2).
                </DialogDescription>
              </div>
            </div>
            <Badge
              variant="secondary"
              className="hidden sm:inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900"
            >
              <ShieldCheck size={12} /> Confirmación obligatoria
            </Badge>
          </div>
        </DialogHeader>

        {/* Chips de consultas rápidas */}
        <div className="px-5 py-2.5 border-b border-border flex flex-wrap gap-1.5 bg-background/50">
          {QUICK_PROMPTS.map((item, idx) => (
            <button
              key={idx}
              type="button"
              disabled={loading}
              onClick={() => sendMessage(item.prompt)}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 hover:bg-indigo-100 hover:text-indigo-700 dark:bg-slate-800 dark:hover:bg-indigo-950/60 dark:hover:text-indigo-300 text-slate-700 dark:text-slate-300 transition-colors disabled:opacity-50"
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Conversación */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-[280px]">
          {messages.map(msg => {
            const isUser = msg.role === 'user';
            const totalDebit = msg.proposal?.lines.reduce((s, l) => s + l.debit, 0) || 0;
            const totalCredit = msg.proposal?.lines.reduce((s, l) => s + l.credit, 0) || 0;

            return (
              <div key={msg.id} className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
                {!isUser && (
                  <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot size={14} />
                  </div>
                )}

                <div className={`max-w-[88%] space-y-2 ${isUser ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`rounded-2xl px-3.5 py-2.5 text-xs ${
                      isUser
                        ? 'bg-blue-600 text-white rounded-tr-sm'
                        : 'bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 rounded-tl-sm border border-border/60'
                    }`}
                  >
                    {isUser ? msg.text : renderFormattedText(msg.text)}
                  </div>

                  {/* Tarjeta Nivel 2: Borrador de Partida Doble */}
                  {msg.proposal && (
                    <div className="rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/40 dark:bg-indigo-950/20 p-3.5 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                            <Scale size={12} /> Borrador de Partida Doble (Nivel 2)
                          </div>
                          <p className="text-xs font-bold text-foreground mt-0.5">
                            {msg.proposal.description}
                          </p>
                        </div>
                        <Badge className="bg-emerald-600 text-white text-[10px] font-bold shrink-0">
                          ✓ Cuadrada ${msg.proposal.amount.toFixed(2)}
                        </Badge>
                      </div>

                      <div className="overflow-x-auto rounded-lg border border-border bg-card">
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr className="bg-slate-100/80 dark:bg-slate-900/60 text-muted-foreground border-b border-border">
                              <th className="text-left px-2.5 py-1.5 font-bold">Código</th>
                              <th className="text-left px-2.5 py-1.5 font-bold">Cuenta</th>
                              <th className="text-right px-2.5 py-1.5 font-bold">Debe</th>
                              <th className="text-right px-2.5 py-1.5 font-bold">Haber</th>
                            </tr>
                          </thead>
                          <tbody>
                            {msg.proposal.lines.map((line, idx) => (
                              <tr key={idx} className="border-b border-border/50 last:border-0">
                                <td className="px-2.5 py-1.5 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                  {line.account_code}
                                </td>
                                <td className="px-2.5 py-1.5 text-foreground">{line.account_name}</td>
                                <td className="px-2.5 py-1.5 text-right font-mono">
                                  {line.debit > 0 ? `$${line.debit.toFixed(2)}` : '—'}
                                </td>
                                <td className="px-2.5 py-1.5 text-right font-mono">
                                  {line.credit > 0 ? `$${line.credit.toFixed(2)}` : '—'}
                                </td>
                              </tr>
                            ))}
                            <tr className="bg-slate-50 dark:bg-slate-900/40 font-black">
                              <td colSpan={2} className="px-2.5 py-1.5 text-right text-[10px] uppercase text-muted-foreground">
                                Totales
                              </td>
                              <td className="px-2.5 py-1.5 text-right font-mono text-emerald-600 dark:text-emerald-400">
                                ${totalDebit.toFixed(2)}
                              </td>
                              <td className="px-2.5 py-1.5 text-right font-mono text-emerald-600 dark:text-emerald-400">
                                ${totalCredit.toFixed(2)}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {msg.proposal.notes && (
                        <p className="text-[11px] text-muted-foreground italic">
                          ℹ️ {msg.proposal.notes}
                        </p>
                      )}

                      {msg.proposalStatus === 'pending' && (
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={postingId === msg.id}
                            onClick={() => handleDiscardProposal(msg.id)}
                            className="h-8 text-xs rounded-lg gap-1"
                          >
                            <XCircle size={13} /> Descartar
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={postingId === msg.id}
                            onClick={() => handleConfirmProposal(msg.id, msg.proposal!)}
                            className="h-8 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1"
                          >
                            {postingId === msg.id ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <CheckCircle2 size={13} />
                            )}
                            Confirmar y Contabilizar
                          </Button>
                        </div>
                      )}

                      {msg.proposalStatus === 'posted' && (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 size={14} /> Contabilizada en Libro Diario ✓
                        </div>
                      )}

                      {msg.proposalStatus === 'discarded' && (
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                          <XCircle size={14} /> Borrador descartado (no se guardó)
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tarjeta Nivel 2B: Aviso de Devolución / Nota de Crédito al BMS */}
                  {msg.ncAlertProposal && (
                    <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/25 p-3.5 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
                            🔔 Aviso de Devolución / NC Pendiente (BMS)
                          </div>
                          <p className="text-xs font-bold text-foreground mt-0.5">
                            {msg.ncAlertProposal.entityName}
                            {msg.ncAlertProposal.invoiceRef ? ` · Fact. ${msg.ncAlertProposal.invoiceRef}` : ''}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {msg.ncAlertProposal.itemsSummary}
                          </p>
                        </div>
                        {msg.ncAlertProposal.estimatedAmount ? (
                          <Badge className="bg-amber-600 text-white text-[10px] font-bold shrink-0">
                            Est. ${msg.ncAlertProposal.estimatedAmount.toFixed(2)}
                          </Badge>
                        ) : null}
                      </div>

                      {msg.ncAlertStatus === 'pending' && (
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={postingId === msg.id}
                            onClick={() => handleDiscardNcAlert(msg.id)}
                            className="h-8 text-xs rounded-lg gap-1"
                          >
                            <XCircle size={13} /> Descartar
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={postingId === msg.id}
                            onClick={() => handleConfirmNcAlert(msg.id, msg.ncAlertProposal!)}
                            className="h-8 text-xs rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold gap-1"
                          >
                            {postingId === msg.id ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <CheckCircle2 size={13} />
                            )}
                            Guardar Aviso en BMS
                          </Button>
                        </div>
                      )}

                      {msg.ncAlertStatus === 'saved' && (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 size={14} /> Aviso activo en BMS y Compras ✓
                        </div>
                      )}

                      {msg.ncAlertStatus === 'discarded' && (
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                          <XCircle size={14} /> Aviso descartado
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <User size={14} />
                  </div>
                )}
              </div>
            );
          })}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 size={14} className="animate-spin text-indigo-600" />
              Analizando datos contables...
            </div>
          )}
          <div ref={scrollEndRef} />
        </div>

        {/* Input */}
        <form
          onSubmit={e => {
            e.preventDefault();
            sendMessage();
          }}
          className="px-4 py-3 border-t border-border bg-background flex items-center gap-2"
        >
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ej: Prepara partida de alquiler $450 por transferencia bancaria..."
            className="text-xs h-10 rounded-xl"
            disabled={loading}
          />
          <Button
            type="submit"
            size="sm"
            disabled={loading || !input.trim()}
            className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1.5"
          >
            <Send size={14} /> Enviar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
