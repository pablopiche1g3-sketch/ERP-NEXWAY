'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { BookOpen, Download, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface AccountItem {
  code: string;
  name: string;
  group: string;
}

interface AccountLedgerPanelProps {
  journal: any[];
  catalog: AccountItem[];
  initialAccountCode?: string;
}

export default function AccountLedgerPanel({
  journal,
  catalog,
  initialAccountCode = '1101',
}: AccountLedgerPanelProps) {
  const [selectedCode, setSelectedCode] = useState<string>(initialAccountCode || '1101');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [search, setSearch] = useState<string>('');

  useEffect(() => {
    if (initialAccountCode) setSelectedCode(initialAccountCode);
  }, [initialAccountCode]);

  const selectedAccount = useMemo(
    () => catalog.find(c => c.code === selectedCode) || catalog[0],
    [catalog, selectedCode]
  );

  const isDebitNature = useMemo(() => {
    const g = selectedAccount?.group || '';
    return g === 'Activo' || g === 'Costos' || g === 'Gastos';
  }, [selectedAccount]);

  const movements = useMemo(() => {
    const raw: Array<{ id: string; date: Date; description: string; debit: number; credit: number }> = [];

    (journal || []).forEach((j: any) => {
      const dt = new Date(j.created_at || j.timestamp || Date.now());
      if (j.lines && j.lines.length > 0) {
        j.lines.forEach((l: any, idx: number) => {
          const code = String(l.accountCode || l.account_code || '');
          if (code === selectedCode) {
            raw.push({
              id: `${j.id}_${idx}`,
              date: dt,
              description: j.description || 'Partida contable',
              debit: Number(l.debit || 0),
              credit: Number(l.credit || 0),
            });
          }
        });
      } else if (j.type === 'Ingreso') {
        if (selectedCode === '1101') {
          raw.push({ id: `${j.id}_d`, date: dt, description: j.description || 'Ingreso', debit: Number(j.amount || 0), credit: 0 });
        } else if (selectedCode === '4101') {
          raw.push({ id: `${j.id}_c`, date: dt, description: j.description || 'Ingreso', debit: 0, credit: Number(j.amount || 0) });
        }
      } else if (j.type === 'Egreso') {
        if (selectedCode === '6101') {
          raw.push({ id: `${j.id}_d`, date: dt, description: j.description || 'Egreso', debit: Number(j.amount || 0), credit: 0 });
        } else if (selectedCode === '1101') {
          raw.push({ id: `${j.id}_c`, date: dt, description: j.description || 'Egreso', debit: 0, credit: Number(j.amount || 0) });
        }
      }
    });

    // Orden cronológico ascendente para saldo corrido real
    raw.sort((a, b) => a.date.getTime() - b.date.getTime());

    const filtered = raw.filter(r => {
      if (dateFrom && r.date < new Date(`${dateFrom}T00:00:00`)) return false;
      if (dateTo && r.date > new Date(`${dateTo}T23:59:59`)) return false;
      if (search && !r.description.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });

    let running = 0;
    return filtered.map(r => {
      running += isDebitNature ? r.debit - r.credit : r.credit - r.debit;
      return { ...r, runningBalance: running };
    });
  }, [journal, selectedCode, dateFrom, dateTo, search, isDebitNature]);

  const totalDebit = movements.reduce((s, m) => s + m.debit, 0);
  const totalCredit = movements.reduce((s, m) => s + m.credit, 0);
  const finalBalance = movements.length > 0 ? movements[movements.length - 1].runningBalance : 0;

  const handleExportCsv = () => {
    const headers = ['Fecha', 'Cuenta', 'Concepto', 'Debe ($)', 'Haber ($)', 'Saldo Corrido ($)'];
    const rows = movements.map(m => [
      m.date.toLocaleDateString('es-SV'),
      `${selectedAccount?.code} - ${selectedAccount?.name}`,
      m.description,
      m.debit.toFixed(2),
      m.credit.toFixed(2),
      m.runningBalance.toFixed(2),
    ]);
    const csv = '\uFEFF' + [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Libro_Mayor_${selectedCode}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="bg-card border-border shadow-sm rounded-2xl overflow-hidden">
      <CardHeader className="p-5 border-b border-border space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-black flex items-center gap-2 text-foreground">
              <BookOpen size={16} className="text-blue-600" />
              Libro Mayor — Movimiento por Cuenta
            </CardTitle>
            <CardDescription className="text-xs">
              Consulta todos los cargos, abonos y el saldo corrido de cualquier cuenta contable.
            </CardDescription>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleExportCsv}
            disabled={movements.length === 0}
            className="h-9 rounded-xl text-xs font-bold gap-1.5"
          >
            <Download size={14} /> Exportar Mayor CSV
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center">
          <div className="md:col-span-5">
            <Select value={selectedCode} onValueChange={setSelectedCode}>
              <SelectTrigger className="h-9 text-xs font-bold rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {catalog.map(c => (
                  <SelectItem key={c.code} value={c.code} className="text-xs">
                    {c.code} — {c.name} ({c.group})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="h-9 text-xs rounded-xl"
              title="Desde"
            />
          </div>
          <div className="md:col-span-2">
            <Input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="h-9 text-xs rounded-xl"
              title="Hasta"
            />
          </div>
          <div className="md:col-span-3 relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filtrar concepto..."
              className="pl-8 h-9 text-xs rounded-xl"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Badge variant="outline" className="text-[11px] font-mono">
            Total Debe: <strong className="ml-1 text-emerald-600">${totalDebit.toFixed(2)}</strong>
          </Badge>
          <Badge variant="outline" className="text-[11px] font-mono">
            Total Haber: <strong className="ml-1 text-rose-600">${totalCredit.toFixed(2)}</strong>
          </Badge>
          <Badge className="bg-blue-600 text-white text-[11px] font-mono">
            Saldo Final: ${finalBalance.toFixed(2)}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[10px] font-black uppercase">Fecha</TableHead>
              <TableHead className="text-[10px] font-black uppercase">Concepto / Partida</TableHead>
              <TableHead className="text-right text-[10px] font-black uppercase">Debe ($)</TableHead>
              <TableHead className="text-right text-[10px] font-black uppercase">Haber ($)</TableHead>
              <TableHead className="text-right text-[10px] font-black uppercase">Saldo Corrido ($)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-xs text-muted-foreground italic">
                  Sin movimientos registrados para la cuenta {selectedCode} en este rango.
                </TableCell>
              </TableRow>
            ) : (
              movements.map(m => (
                <TableRow key={m.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {m.date.toLocaleDateString('es-SV')}
                  </TableCell>
                  <TableCell className="text-xs font-medium">{m.description}</TableCell>
                  <TableCell className="text-right font-mono text-xs text-emerald-600 dark:text-emerald-400">
                    {m.debit > 0 ? `$${m.debit.toFixed(2)}` : '—'}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-rose-600 dark:text-rose-400">
                    {m.credit > 0 ? `$${m.credit.toFixed(2)}` : '—'}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs font-black text-foreground">
                    ${m.runningBalance.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
