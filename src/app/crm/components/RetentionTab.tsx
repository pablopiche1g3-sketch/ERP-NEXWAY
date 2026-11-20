'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertTriangle, Activity, MessageCircle, Mail, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface InactiveCustomerRow {
  id: string;
  name: string;
  nit?: string | null;
  phone?: string | null;
  email?: string | null;
  last_purchase_date: string | null;
  days_inactive: number;
  total_spent: number;
  purchases_count: number;
}

export default function RetentionTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [inactiveCustomers, setInactiveCustomers] = useState<InactiveCustomerRow[]>([]);
  const [thresholdFilter, setThresholdFilter] = useState<string>('30');

  const loadData = async () => {
    setLoading(true);
    try {
      const [custRes, salesRes] = await Promise.all([
        supabase.from('customers').select('id, name, nit, phone, email, created_at').order('name'),
        supabase.from('sales').select('customer_id, customer_name, total, created_at, status').neq('status', 'CANCELADA')
      ]);

      if (custRes.error) throw custRes.error;

      const customers = custRes.data || [];
      const sales = salesRes.data || [];
      const nowMs = Date.now();
      const threshold = parseInt(thresholdFilter, 10) || 30;

      const computed: InactiveCustomerRow[] = customers.map((c: any) => {
        const custSales = sales.filter(
          (s: any) =>
            (s.customer_id && s.customer_id === c.id) ||
            (s.customer_name && s.customer_name.toLowerCase().trim() === (c.name || '').toLowerCase().trim())
        );

        let lastDateStr: string | null = null;
        let totalSpent = 0;

        custSales.forEach((s: any) => {
          totalSpent += parseFloat(s.total) || 0;
          if (!lastDateStr || new Date(s.created_at).getTime() > new Date(lastDateStr).getTime()) {
            lastDateStr = s.created_at;
          }
        });

        const refMs = lastDateStr
          ? new Date(lastDateStr).getTime()
          : (c.created_at ? new Date(c.created_at).getTime() : nowMs - 91 * 86400000);
        const daysInactive = Math.max(0, Math.floor((nowMs - refMs) / (1000 * 60 * 60 * 24)));

        return {
          id: c.id,
          name: c.name,
          nit: c.nit,
          phone: c.phone,
          email: c.email,
          last_purchase_date: lastDateStr,
          days_inactive: daysInactive,
          total_spent: Number(totalSpent.toFixed(2)),
          purchases_count: custSales.length
        };
      });

      const filtered = computed
        .filter(c => thresholdFilter === '0' ? true : c.days_inactive >= threshold)
        .sort((a, b) => b.days_inactive - a.days_inactive);

      setInactiveCustomers(filtered);
    } catch (e: any) {
      console.error('Error cargando retención:', e);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron calcular los datos de retención.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [thresholdFilter]);

  const handleWhatsapp = (phone: string | null | undefined, name: string) => {
    if (!phone) {
      toast({ title: 'Sin teléfono registrado', description: 'Agrega un teléfono al cliente en Directorio Comercial.' });
      return;
    }
    const msg = `Hola ${name}, te saludamos de NexWay. Tenemos nuevas promociones y disponibilidad inmediata para tu próximo pedido. ¡Será un gusto atenderte!`;
    window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleEmail = (email: string | null | undefined, name: string) => {
    if (!email) {
      toast({ title: 'Sin correo registrado', description: 'Agrega un correo al cliente en Directorio Comercial.' });
      return;
    }
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(`Seguimiento Comercial — ${name}`)}`;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Card className="border shadow-sm rounded-2xl bg-card overflow-hidden">
        <CardHeader className="bg-muted/30 p-5 border-b border-border flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-black uppercase tracking-tight text-foreground">
              <Activity className="text-orange-500" size={20} />
              Retención y Recuperación de Clientes Reales
            </CardTitle>
            <CardDescription className="text-muted-foreground text-xs mt-0.5">
              Cálculo directo desde tu cartera real y facturas emitidas para reactivar clientes sin compras recientes.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold whitespace-nowrap text-muted-foreground">Inactivos hace:</span>
            <Select value={thresholdFilter} onValueChange={setThresholdFilter}>
              <SelectTrigger className="w-40 h-9 text-xs bg-background border-border rounded-xl font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Todos los clientes</SelectItem>
                <SelectItem value="30">Más de 30 días</SelectItem>
                <SelectItem value="60">Más de 60 días</SelectItem>
                <SelectItem value="90">Más de 90 días</SelectItem>
                <SelectItem value="180">Más de 6 meses</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={loadData} disabled={loading} className="h-9 w-9 rounded-xl">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center p-12"><Loader2 className="animate-spin text-orange-500" size={28} /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr className="text-left text-muted-foreground">
                    <th className="p-4 font-bold text-[10px] uppercase">Cliente</th>
                    <th className="p-4 font-bold text-[10px] uppercase">Contacto</th>
                    <th className="p-4 font-bold text-[10px] uppercase">Última Compra</th>
                    <th className="p-4 font-bold text-[10px] uppercase text-right">Histórico ($)</th>
                    <th className="p-4 font-bold text-[10px] uppercase text-center">Inactividad</th>
                    <th className="p-4 font-bold text-[10px] uppercase text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {inactiveCustomers.map(c => (
                    <tr key={c.id} className="border-b border-border/60 hover:bg-muted/30 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-foreground text-xs">{c.name}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{c.nit || 'Sin NIT'}</div>
                      </td>
                      <td className="p-4 text-xs">
                        <div className="text-foreground">{c.phone || '—'}</div>
                        <div className="text-[10px] text-muted-foreground">{c.email || '—'}</div>
                      </td>
                      <td className="p-4 text-xs">
                        <div className="font-medium text-foreground">
                          {c.last_purchase_date ? new Date(c.last_purchase_date).toLocaleDateString('es-SV') : 'Sin compras aún'}
                        </div>
                        <div className="text-[10px] text-muted-foreground">{c.purchases_count} compra(s)</div>
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                        ${c.total_spent.toFixed(2)}
                      </td>
                      <td className="p-4 text-center">
                        <Badge className={`font-black uppercase text-[10px] tracking-wider ${
                          c.days_inactive > 90
                            ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                            : c.days_inactive > 60
                            ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30'
                            : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                        }`}>
                          {c.days_inactive} DÍAS
                        </Badge>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            size="sm"
                            onClick={() => handleWhatsapp(c.phone, c.name)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 rounded-xl text-[10px] font-bold"
                          >
                            <MessageCircle size={13} className="mr-1" /> WhatsApp
                          </Button>
                          {c.email && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEmail(c.email, c.name)}
                              className="h-8 rounded-xl text-[10px] font-bold"
                            >
                              <Mail size={13} className="mr-1" /> Correo
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {inactiveCustomers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-muted-foreground text-xs">
                        <AlertTriangle size={28} className="mx-auto mb-3 opacity-40" />
                        No hay clientes que superen el umbral de inactividad seleccionado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
