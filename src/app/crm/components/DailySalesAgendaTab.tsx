'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarCheck,
  PhoneCall,
  MessageCircle,
  FileText,
  Plus,
  CheckCircle2,
  Trash2,
  ArrowUpRight,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DailyFollowup {
  id: string;
  customerName: string;
  channel: 'WhatsApp' | 'Llamada' | 'Visita';
  note: string;
  done: boolean;
  createdAt: string;
}

export default function DailySalesAgendaTab() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [openQuotes, setOpenQuotes] = useState<any[]>([]);
  const [followups, setFollowups] = useState<DailyFollowup[]>([]);

  const [newCustomer, setNewCustomer] = useState('');
  const [newChannel, setNewChannel] = useState<'WhatsApp' | 'Llamada' | 'Visita'>('WhatsApp');
  const [newNote, setNewNote] = useState('');

  const loadAgenda = async () => {
    setLoading(true);
    try {
      const [qRes, cfgRes] = await Promise.all([
        supabase
          .from('quotations')
          .select('*')
          .eq('status', 'PENDIENTE')
          .order('created_at', { ascending: false })
          .limit(25),
        supabase
          .from('system_config')
          .select('value')
          .eq('key', 'crm_daily_followups')
          .maybeSingle(),
      ]);

      setOpenQuotes(qRes.data || []);
      setFollowups(Array.isArray(cfgRes.data?.value) ? cfgRes.data.value : []);
    } catch {
      setOpenQuotes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgenda();
  }, []);

  const persistFollowups = async (next: DailyFollowup[]) => {
    setFollowups(next);
    await supabase.from('system_config').upsert({ key: 'crm_daily_followups', value: next.slice(0, 100) });
  };

  const handleAddFollowup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomer.trim() || !newNote.trim()) {
      toast({ variant: 'destructive', title: 'Completa cliente y nota', description: 'Escribe a quién contactas y qué seguimiento harás.' });
      return;
    }
    const item: DailyFollowup = {
      id: `CRM-${Date.now().toString().slice(-6)}`,
      customerName: newCustomer.trim(),
      channel: newChannel,
      note: newNote.trim(),
      done: false,
      createdAt: new Date().toISOString(),
    };
    await persistFollowups([item, ...followups]);
    setNewCustomer('');
    setNewNote('');
    toast({ title: 'Seguimiento registrado ✓', description: `Agregado a la agenda comercial de hoy.` });
  };

  const handleToggleDone = async (id: string) => {
    await persistFollowups(followups.map(f => (f.id === id ? { ...f, done: !f.done } : f)));
  };

  const handleDelete = async (id: string) => {
    await persistFollowups(followups.filter(f => f.id !== id));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-xs text-muted-foreground gap-2">
        <Loader2 size={16} className="animate-spin text-indigo-500" /> Cargando agenda comercial del día...
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* Izquierda: Cotizaciones Abiertas por Cerrar */}
      <Card className="lg:col-span-6 bg-card border-border rounded-2xl shadow-sm overflow-hidden">
        <CardHeader className="p-5 border-b border-border flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-black flex items-center gap-2">
              <FileText size={16} className="text-indigo-500" />
              Cotizaciones Abiertas por Cerrar ({openQuotes.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Cotizaciones pendientes de aprobación. Haz seguimiento por WhatsApp o pásalas a Facturación.
            </CardDescription>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => router.push('/billing?tab=cotizacion')}
            className="h-8 rounded-xl text-xs font-bold gap-1"
          >
            Cotizaciones <ArrowUpRight size={12} />
          </Button>
        </CardHeader>
        <CardContent className="p-4 space-y-2.5 max-h-[460px] overflow-y-auto">
          {openQuotes.length === 0 ? (
            <p className="text-xs text-muted-foreground italic text-center py-10">
              No hay cotizaciones pendientes por cerrar hoy.
            </p>
          ) : (
            openQuotes.map(q => {
              const waText = encodeURIComponent(
                `Hola ${q.customer_name || ''}, le saludamos para dar seguimiento a su cotización por $${Number(q.total || 0).toFixed(2)}. ¿Desea que procedamos con su pedido?`
              );
              return (
                <div key={q.id} className="p-3 rounded-xl border border-border bg-background/60 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-black text-foreground truncate">{q.customer_name || 'Cliente General'}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {q.created_at ? new Date(q.created_at).toLocaleDateString('es-SV') : ''} ·{' '}
                      <strong className="font-mono text-emerald-600 dark:text-emerald-400">
                        ${Number(q.total || 0).toFixed(2)}
                      </strong>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <a
                      href={`https://wa.me/?text=${waText}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold"
                    >
                      <MessageCircle size={12} /> WhatsApp
                    </a>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => router.push('/billing?tab=cotizacion')}
                      className="h-7 px-2 text-[10px] font-bold rounded-lg"
                    >
                      Facturar
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Derecha: Bitácora Diaria de Llamadas y Visitas */}
      <Card className="lg:col-span-6 bg-card border-border rounded-2xl shadow-sm overflow-hidden">
        <CardHeader className="p-5 border-b border-border">
          <CardTitle className="text-sm font-black flex items-center gap-2">
            <CalendarCheck size={16} className="text-emerald-500" />
            Agenda de Seguimientos del Vendedor ({followups.filter(f => !f.done).length} pendientes)
          </CardTitle>
          <CardDescription className="text-xs">
            Registra llamadas, visitas o promesas de pedido en 5 segundos para dar seguimiento diario.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <form onSubmit={handleAddFollowup} className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            <Input
              value={newCustomer}
              onChange={e => setNewCustomer(e.target.value)}
              placeholder="Cliente..."
              className="sm:col-span-4 h-8 text-xs rounded-lg"
            />
            <Select value={newChannel} onValueChange={v => setNewChannel(v as any)}>
              <SelectTrigger className="sm:col-span-3 h-8 text-xs rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WhatsApp" className="text-xs">WhatsApp</SelectItem>
                <SelectItem value="Llamada" className="text-xs">Llamada</SelectItem>
                <SelectItem value="Visita" className="text-xs">Visita</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              placeholder="Ej. Confirmar pedido de 10 galones..."
              className="sm:col-span-5 h-8 text-xs rounded-lg"
            />
            <Button
              type="submit"
              size="sm"
              className="sm:col-span-12 h-8 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold gap-1"
            >
              <Plus size={13} /> Agregar Seguimiento de Hoy
            </Button>
          </form>

          <div className="space-y-2 max-h-[340px] overflow-y-auto">
            {followups.length === 0 ? (
              <p className="text-xs text-muted-foreground italic text-center py-8">
                Aún no hay seguimientos registrados hoy.
              </p>
            ) : (
              followups.map(f => (
                <div
                  key={f.id}
                  className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs ${
                    f.done ? 'bg-muted/30 border-border/50 opacity-60' : 'bg-background border-border'
                  }`}
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <button
                      type="button"
                      onClick={() => handleToggleDone(f.id)}
                      className={`mt-0.5 shrink-0 ${f.done ? 'text-emerald-600' : 'text-muted-foreground hover:text-indigo-600'}`}
                      title="Marcar completado"
                    >
                      <CheckCircle2 size={15} />
                    </button>
                    <div className="min-w-0">
                      <div className={`font-bold ${f.done ? 'line-through' : ''}`}>
                        {f.customerName}{' '}
                        <Badge variant="outline" className="text-[9px] ml-1 h-4 px-1.5">
                          {f.channel}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{f.note}</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDelete(f.id)}
                    className="h-7 w-7 text-rose-600 shrink-0"
                  >
                    <Trash2 size={12} />
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
