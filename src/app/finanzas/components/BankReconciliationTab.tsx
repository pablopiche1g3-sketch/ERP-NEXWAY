'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  Scale,
  Building2,
  Loader2,
  Save,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface BankMovement {
  id: string;
  date: string;
  description: string;
  debit: number;
  credit: number;
}

export default function BankReconciliationTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [movements, setMovements] = useState<BankMovement[]>([]);
  const [reconciledIds, setReconciledIds] = useState<Record<string, boolean>>({});
  const [statementBalance, setStatementBalance] = useState<string>('0.00');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [jRes, cfgRes] = await Promise.all([
          supabase
            .from('journal')
            .select('id, created_at, description, amount, type, journal_lines(id, account_code, debit, credit)')
            .order('created_at', { ascending: false })
            .limit(200),
          supabase
            .from('system_config')
            .select('value')
            .eq('key', 'bank_reconciliation_state')
            .maybeSingle(),
        ]);

        const rows: BankMovement[] = [];
        (jRes.data || []).forEach((j: any) => {
          const lines = j.journal_lines || [];
          const bankLines = lines.filter((l: any) => String(l.account_code || '').startsWith('1102'));
          bankLines.forEach((l: any, idx: number) => {
            rows.push({
              id: l.id || `${j.id}_${idx}`,
              date: j.created_at,
              description: j.description || 'Movimiento Bancario',
              debit: Number(l.debit || 0),
              credit: Number(l.credit || 0),
            });
          });
        });

        setMovements(rows);
        const saved = cfgRes.data?.value;
        if (saved && typeof saved === 'object') {
          setReconciledIds(saved.reconciledIds || {});
          if (saved.statementBalance !== undefined) {
            setStatementBalance(String(saved.statementBalance));
          }
        }
      } catch (err) {
        console.error('Error cargando conciliación bancaria:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const toggleReconciled = (id: string) => {
    setReconciledIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSaveReconciliation = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('system_config').upsert({
        key: 'bank_reconciliation_state',
        value: {
          reconciledIds,
          statementBalance: parseFloat(statementBalance) || 0,
          savedAt: new Date().toISOString(),
        },
      });
      if (error) throw error;
      toast({
        title: 'Conciliación Guardada ✓',
        description: 'Se guardaron las marcas de movimientos conciliados contra el banco.',
      });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err?.message || 'No se pudo guardar.' });
    } finally {
      setSaving(false);
    }
  };

  const summary = useMemo(() => {
    const bookBalance = movements.reduce((s, m) => s + m.debit - m.credit, 0);
    const reconciledBalance = movements
      .filter(m => reconciledIds[m.id])
      .reduce((s, m) => s + m.debit - m.credit, 0);
    const inTransit = bookBalance - reconciledBalance;
    const stmt = parseFloat(statementBalance) || 0;
    const difference = stmt - reconciledBalance;
    return {
      bookBalance,
      reconciledBalance,
      inTransit,
      difference,
      isConciliated: Math.abs(difference) < 0.02,
    };
  }, [movements, reconciledIds, statementBalance]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground gap-2 text-xs">
        <Loader2 size={16} className="animate-spin text-indigo-600" />
        Cargando movimientos de cuenta 1102 Bancos...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border rounded-2xl p-4 shadow-sm">
          <Label className="text-[10px] font-black uppercase text-muted-foreground">Saldo según Estado de Cuenta ($)</Label>
          <Input
            type="number"
            step="0.01"
            value={statementBalance}
            onChange={e => setStatementBalance(e.target.value)}
            className="h-9 text-base font-mono font-black mt-1.5"
          />
        </Card>

        <Card className="bg-card border-border rounded-2xl p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase text-muted-foreground">Saldo en Libros (1102)</p>
          <p className="text-2xl font-black font-mono text-foreground mt-1">
            ${summary.bookBalance.toFixed(2)}
          </p>
          <p className="text-[11px] text-muted-foreground">En tránsito: ${summary.inTransit.toFixed(2)}</p>
        </Card>

        <Card className="bg-card border-border rounded-2xl p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase text-muted-foreground">Saldo Conciliado</p>
          <p className="text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400 mt-1">
            ${summary.reconciledBalance.toFixed(2)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {Object.values(reconciledIds).filter(Boolean).length} de {movements.length} marcados
          </p>
        </Card>

        <Card className="bg-card border-border rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase text-muted-foreground">Diferencia</p>
            {summary.isConciliated ? (
              <CheckCircle2 size={15} className="text-emerald-600" />
            ) : (
              <AlertTriangle size={15} className="text-amber-600" />
            )}
          </div>
          <p
            className={`text-2xl font-black font-mono mt-1 ${
              summary.isConciliated ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'
            }`}
          >
            ${summary.difference.toFixed(2)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {summary.isConciliated ? '✓ Conciliación cuadrada' : 'Marca movimientos en tránsito'}
          </p>
        </Card>
      </div>

      <Card className="bg-card border-border rounded-2xl shadow-sm overflow-hidden">
        <CardHeader className="p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-black flex items-center gap-2">
              <Scale size={16} className="text-indigo-600" />
              Conciliación Bancaria (Cuenta 1102 — Bancos)
            </CardTitle>
            <CardDescription className="text-xs">
              Marca cada depósito o transferencia que ya aparece reflejada en tu estado de cuenta bancario.
            </CardDescription>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={saving}
            onClick={handleSaveReconciliation}
            className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold gap-1.5"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Guardar Conciliación
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center text-[10px] font-black uppercase">OK</TableHead>
                <TableHead className="text-[10px] font-black uppercase">Fecha</TableHead>
                <TableHead className="text-[10px] font-black uppercase">Concepto / Partida</TableHead>
                <TableHead className="text-right text-[10px] font-black uppercase">Depósito / Cargo (+)</TableHead>
                <TableHead className="text-right text-[10px] font-black uppercase">Retiro / Abono (-)</TableHead>
                <TableHead className="text-center text-[10px] font-black uppercase">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-xs text-muted-foreground italic">
                    Aún no hay movimientos contabilizados en la cuenta 1102 Bancos. Registra pagos por transferencia en Libro Diario o con el Asistente Contable IA.
                  </TableCell>
                </TableRow>
              ) : (
                movements.map(m => {
                  const checked = Boolean(reconciledIds[m.id]);
                  return (
                    <TableRow key={m.id} className={checked ? 'bg-emerald-50/40 dark:bg-emerald-950/15' : ''}>
                      <TableCell className="text-center">
                        <Checkbox checked={checked} onCheckedChange={() => toggleReconciled(m.id)} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {m.date ? new Date(m.date).toLocaleDateString('es-SV') : '—'}
                      </TableCell>
                      <TableCell className="text-xs font-medium">{m.description}</TableCell>
                      <TableCell className="text-right font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        {m.debit > 0 ? `$${m.debit.toFixed(2)}` : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-bold text-rose-600 dark:text-rose-400">
                        {m.credit > 0 ? `$${m.credit.toFixed(2)}` : '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        {checked ? (
                          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-0 text-[10px]">
                            Conciliado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                            En tránsito
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
