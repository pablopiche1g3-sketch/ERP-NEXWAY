'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeftRight,
  CheckCircle2,
  ShieldCheck,
  Wallet,
  AlertTriangle,
  Loader2,
  Search,
  History,
  Receipt,
  DollarSign,
  XCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { postDoubleEntryJournal } from '@/lib/accounting-journal';

interface InvoiceCrossTabProps {
  mode: 'autorizar' | 'cruce';
}

interface CrossingRecord {
  id: string;
  date: string;
  cxcId: string;
  cxcLabel: string;
  cxcCustomer: string;
  cxpId: string;
  cxpLabel: string;
  cxpSupplier: string;
  amount: number;
  notes: string;
}

interface PaymentAuthEntry {
  authorized: boolean;
  authorizedAt: string;
  authorizedBy: string;
  notes?: string;
}

export default function InvoiceCrossTab({ mode }: InvoiceCrossTabProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [salesCredit, setSalesCredit] = useState<any[]>([]);
  const [purchasesCredit, setPurchasesCredit] = useState<any[]>([]);
  const [cxcPayments, setCxcPayments] = useState<any[]>([]);
  const [cxpPayments, setCxpPayments] = useState<any[]>([]);
  const [crossingsLog, setCrossingsLog] = useState<CrossingRecord[]>([]);
  const [authMap, setAuthMap] = useState<Record<string, PaymentAuthEntry>>({});
  const [bankBalance, setBankBalance] = useState<number>(0);

  // Selección para Cruce
  const [selectedCxcId, setSelectedCxcId] = useState<string>('');
  const [selectedCxpId, setSelectedCxpId] = useState<string>('');
  const [crossAmount, setCrossAmount] = useState<string>('');
  const [crossNotes, setCrossNotes] = useState<string>('');
  const [searchCxc, setSearchCxc] = useState('');
  const [searchCxp, setSearchCxp] = useState('');

  // Filtro Autorizar Pagos
  const [authFilter, setAuthFilter] = useState<'TODOS' | 'PENDIENTES' | 'AUTORIZADOS'>('TODOS');

  const loadData = async () => {
    setLoading(true);
    try {
      const [salesRes, purchRes, bankRes, cfgRes] = await Promise.all([
        supabase
          .from('sales')
          .select('*, customers(name, nit)')
          .order('created_at', { ascending: false }),
        supabase
          .from('purchases')
          .select('*, suppliers(name, nit)')
          .order('created_at', { ascending: false }),
        supabase.from('bank_accounts').select('balance').then(r => r, () => ({ data: [] as any[] })),
        supabase
          .from('system_config')
          .select('key, value')
          .in('key', [
            'cxc_payments_registry',
            'cxc_manual_records',
            'cxp_payments_registry',
            'cxp_manual_records',
            'invoice_crossings_log',
            'cxp_payment_authorizations',
          ]),
      ]);

      const cfgRows = cfgRes.data || [];
      const getCfg = (k: string, fallback: any) => cfgRows.find((r: any) => r.key === k)?.value ?? fallback;

      const cxcManual: any[] = getCfg('cxc_manual_records', []);
      const cxpManual: any[] = getCfg('cxp_manual_records', []);
      const cxcRegs: any[] = getCfg('cxc_payments_registry', []);
      const cxpRegs: any[] = getCfg('cxp_payments_registry', []);
      const log: CrossingRecord[] = getCfg('invoice_crossings_log', []);
      const auths: Record<string, PaymentAuthEntry> = getCfg('cxp_payment_authorizations', {});

      const creditSales = (salesRes.data || []).filter((s: any) => {
        if (s.status === 'CANCELADA') return false;
        const pm = String(s.payment_method || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const tp = String(s.type || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return pm.includes('credito') || tp.includes('credito') || s.status === 'PENDIENTE';
      });
      const combinedCxc = [...creditSales];
      cxcManual.forEach(m => {
        if (!combinedCxc.some(s => s.id === m.id)) combinedCxc.push(m);
      });

      const creditPurchases = (purchRes.data || []).filter((p: any) => {
        const pm = String(p.payment_method || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return pm.includes('credito') || p.payment_status === 'PENDIENTE';
      });
      const combinedCxp = [...creditPurchases];
      cxpManual.forEach(m => {
        if (!combinedCxp.some(p => p.id === m.id)) combinedCxp.push(m);
      });

      const totalBank = (bankRes?.data || []).reduce((acc: number, b: any) => acc + (Number(b.balance) || 0), 0);

      setSalesCredit(combinedCxc);
      setPurchasesCredit(combinedCxp);
      setCxcPayments(cxcRegs);
      setCxpPayments(cxpRegs);
      setCrossingsLog(Array.isArray(log) ? log : []);
      setAuthMap(auths && typeof auths === 'object' ? auths : {});
      setBankBalance(totalBank);
    } catch (err) {
      console.error('Error cargando datos de Cruce / Autorización:', err);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar las facturas pendientes.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Saldos pendientes CXC
  const openCxc = useMemo(() => {
    return salesCredit
      .map(s => {
        const total = Number(s.total || 0);
        const paid = cxcPayments
          .filter(p => p.sale_id === s.id)
          .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const balance = Math.max(0, Number((total - paid).toFixed(2)));
        const customer = s.customers?.name || s.customer_name || 'Cliente';
        const docLabel = s.correlative || s.id?.slice(0, 8) || 'S/N';
        return { ...s, total, paid, balance, customer, docLabel };
      })
      .filter(s => s.balance > 0.01);
  }, [salesCredit, cxcPayments]);

  // Saldos pendientes CXP
  const openCxp = useMemo(() => {
    return purchasesCredit
      .map(p => {
        const total = Number(p.total || 0);
        const paid = cxpPayments
          .filter(pay => pay.purchase_id === p.id)
          .reduce((sum, pay) => sum + (Number(pay.amount) || 0), 0);
        const balance = Math.max(0, Number((total - paid).toFixed(2)));
        const supplier = p.suppliers?.name || p.supplier_name || 'Proveedor';
        const docLabel = p.document_number || p.order_id || p.id?.slice(0, 8) || 'S/N';
        const created = p.created_at ? new Date(p.created_at) : new Date();
        const dueDate = new Date(created);
        dueDate.setDate(dueDate.getDate() + (Number(p.credit_days) || 30));
        const isOverdue = dueDate < new Date();
        return { ...p, total, paid, balance, supplier, docLabel, dueDate, isOverdue };
      })
      .filter(p => p.balance > 0.01 && p.payment_status !== 'PAGADO');
  }, [purchasesCredit, cxpPayments]);

  const selectedCxc = useMemo(() => openCxc.find(c => c.id === selectedCxcId) || null, [openCxc, selectedCxcId]);
  const selectedCxp = useMemo(() => openCxp.find(p => p.id === selectedCxpId) || null, [openCxp, selectedCxpId]);

  // Sugerir monto máximo cruzable automáticamente al elegir ambas facturas
  useEffect(() => {
    if (selectedCxc && selectedCxp) {
      const maxCross = Math.min(selectedCxc.balance, selectedCxp.balance);
      setCrossAmount(maxCross.toFixed(2));
    }
  }, [selectedCxc?.id, selectedCxp?.id]);

  // Ejecutar Cruce de Facturas (Cliente ↔ Proveedor)
  const handleExecuteCrossing = async () => {
    if (!selectedCxc || !selectedCxp) {
      toast({ variant: 'destructive', title: 'Selecciona ambas facturas', description: 'Elige una factura de Cliente (CxC) y una de Proveedor (CxP).' });
      return;
    }
    const maxCross = Math.min(selectedCxc.balance, selectedCxp.balance);
    const amount = Number(parseFloat(crossAmount) || 0);
    if (amount <= 0 || amount > maxCross + 0.01) {
      toast({
        variant: 'destructive',
        title: 'Monto inválido',
        description: `El monto a cruzar debe estar entre $0.01 y $${maxCross.toFixed(2)}.`,
      });
      return;
    }

    setSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      const crossId = `CRUCE-${Date.now().toString().slice(-6)}`;
      const noteText = crossNotes.trim() || `Cruce ${selectedCxc.docLabel} ↔ ${selectedCxp.docLabel}`;

      const newCxcPay = {
        id: `${crossId}-CXC`,
        sale_id: selectedCxc.id,
        amount,
        method: 'Cruce CxC/CxP',
        reference: crossId,
        notes: `Compensado con CxP ${selectedCxp.docLabel} (${selectedCxp.supplier}). ${noteText}`,
        created_at: nowIso,
      };

      const newCxpPay = {
        id: `${crossId}-CXP`,
        purchase_id: selectedCxp.id,
        amount,
        method: 'Cruce CxC/CxP',
        reference: crossId,
        notes: `Compensado con CxC ${selectedCxc.docLabel} (${selectedCxc.customer}). ${noteText}`,
        created_at: nowIso,
      };

      const newLogEntry: CrossingRecord = {
        id: crossId,
        date: nowIso,
        cxcId: selectedCxc.id,
        cxcLabel: selectedCxc.docLabel,
        cxcCustomer: selectedCxc.customer,
        cxpId: selectedCxp.id,
        cxpLabel: selectedCxp.docLabel,
        cxpSupplier: selectedCxp.supplier,
        amount,
        notes: noteText,
      };

      const nextCxcPays = [...cxcPayments, newCxcPay];
      const nextCxpPays = [...cxpPayments, newCxpPay];
      const nextLog = [newLogEntry, ...crossingsLog].slice(0, 100);

      // 1. Guardar abonos cruzados y bitácora en system_config (sin updated_at)
      await Promise.all([
        supabase.from('system_config').upsert({ key: 'cxc_payments_registry', value: nextCxcPays }),
        supabase.from('system_config').upsert({ key: 'cxp_payments_registry', value: nextCxpPays }),
        supabase.from('system_config').upsert({ key: 'invoice_crossings_log', value: nextLog }),
      ]);

      // 2. Si la CxP quedó cubierta totalmente, marcar payment_status = PAGADO en purchases
      if (selectedCxp.balance - amount <= 0.02 && !String(selectedCxp.id).startsWith('CXP-MAN')) {
        await supabase.from('purchases').update({ payment_status: 'PAGADO' }).eq('id', selectedCxp.id);
      }

      // 3. Asiento contable automático de compensación (Debe 2101 Proveedores / Haber 1103 Clientes)
      await postDoubleEntryJournal({
        description: `[Cruce CxC/CxP] ${selectedCxc.customer} (${selectedCxc.docLabel}) ↔ ${selectedCxp.supplier} (${selectedCxp.docLabel})`,
        amount,
        type: 'Avanzado',
        lines: [
          { account_code: '2101', account_name: 'Proveedores Locales C/P', debit: amount, credit: 0 },
          { account_code: '1103', account_name: 'Cuentas por Cobrar Clientes', debit: 0, credit: amount },
        ],
      });

      toast({
        title: 'Cruce de Facturas Aplicado ✓',
        description: `Se compensaron $${amount.toFixed(2)} entre ${selectedCxc.docLabel} y ${selectedCxp.docLabel} y se generó la partida contable.`,
      });

      setSelectedCxcId('');
      setSelectedCxpId('');
      setCrossAmount('');
      setCrossNotes('');
      await loadData();
    } catch (err: any) {
      console.error('Error aplicando cruce de facturas:', err);
      toast({ variant: 'destructive', title: 'Error', description: err?.message || 'No se pudo completar el cruce.' });
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle Autorizar Pago a Proveedor
  const handleToggleAuthorize = async (purchaseId: string) => {
    const current = authMap[purchaseId];
    const nextAuthMap: Record<string, PaymentAuthEntry> = { ...authMap };
    if (current?.authorized) {
      delete nextAuthMap[purchaseId];
    } else {
      nextAuthMap[purchaseId] = {
        authorized: true,
        authorizedAt: new Date().toISOString(),
        authorizedBy: 'Gerencia / Finanzas',
      };
    }

    setAuthMap(nextAuthMap);
    const { error } = await supabase
      .from('system_config')
      .upsert({ key: 'cxp_payment_authorizations', value: nextAuthMap });

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar la autorización.' });
      return;
    }
    toast({
      title: current?.authorized ? 'Autorización revocada' : 'Pago Autorizado ✓',
      description: current?.authorized
        ? 'La factura volvió a estado pendiente de autorización.'
        : 'La factura quedó aprobada para desembolso.',
    });
  };

  const totalPendingCxp = openCxp.reduce((s, p) => s + p.balance, 0);
  const totalOverdueCxp = openCxp.filter(p => p.isOverdue).reduce((s, p) => s + p.balance, 0);
  const totalAuthorizedCxp = openCxp.filter(p => authMap[p.id]?.authorized).reduce((s, p) => s + p.balance, 0);
  const netAfterAuthorized = bankBalance - totalAuthorizedCxp;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground gap-2 text-xs">
        <Loader2 size={16} className="animate-spin text-indigo-600" />
        Cargando saldos de clientes, proveedores y disponibilidad...
      </div>
    );
  }

  /* =========================================================================
   * MODO 1: AUTORIZAR PAGOS Y DISPONIBILIDAD
   * ========================================================================= */
  if (mode === 'autorizar') {
    const filteredAuthList = openCxp.filter(p => {
      const isAuth = Boolean(authMap[p.id]?.authorized);
      if (authFilter === 'PENDIENTES') return !isAuth;
      if (authFilter === 'AUTORIZADOS') return isAuth;
      return true;
    });

    return (
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card border-border rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span className="font-bold uppercase text-[10px]">Disponibilidad Bancos</span>
              <Wallet size={15} className="text-emerald-600" />
            </div>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              ${bankBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Saldo actual en cuentas bancarias</p>
          </Card>

          <Card className="bg-card border-border rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span className="font-bold uppercase text-[10px]">Total CXP Pendiente</span>
              <Receipt size={15} className="text-amber-600" />
            </div>
            <p className="text-2xl font-black text-foreground">
              ${totalPendingCxp.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-rose-600 font-semibold mt-0.5">
              Vencido: ${totalOverdueCxp.toFixed(2)}
            </p>
          </Card>

          <Card className="bg-card border-border rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span className="font-bold uppercase text-[10px]">Pagos Autorizados</span>
              <ShieldCheck size={15} className="text-indigo-600" />
            </div>
            <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
              ${totalAuthorizedCxp.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {openCxp.filter(p => authMap[p.id]?.authorized).length} factura(s) listas para pagar
            </p>
          </Card>

          <Card className="bg-card border-border rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span className="font-bold uppercase text-[10px]">Remanente Tras Pagos</span>
              <AlertTriangle size={15} className={netAfterAuthorized >= 0 ? 'text-emerald-600' : 'text-rose-600'} />
            </div>
            <p className={`text-2xl font-black ${netAfterAuthorized >= 0 ? 'text-foreground' : 'text-rose-600'}`}>
              ${netAfterAuthorized.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {netAfterAuthorized >= 0 ? 'Liquidez suficiente' : 'Supera disponibilidad bancaria'}
            </p>
          </Card>
        </div>

        <Card className="bg-card border-border rounded-2xl shadow-sm overflow-hidden">
          <CardHeader className="p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-black flex items-center gap-2">
                <ShieldCheck size={17} className="text-indigo-600" />
                Autorización de Pagos a Proveedores
              </CardTitle>
              <CardDescription className="text-xs">
                Revisa vencimientos frente a tu disponibilidad y aprueba qué facturas se pagan esta semana.
              </CardDescription>
            </div>
            <div className="flex gap-1.5 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
              {(['TODOS', 'PENDIENTES', 'AUTORIZADOS'] as const).map(f => (
                <Button
                  key={f}
                  type="button"
                  size="sm"
                  variant={authFilter === f ? 'default' : 'ghost'}
                  onClick={() => setAuthFilter(f)}
                  className="h-7 text-[11px] font-bold rounded-lg px-3"
                >
                  {f}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px] font-black uppercase">Documento</TableHead>
                  <TableHead className="text-[10px] font-black uppercase">Proveedor</TableHead>
                  <TableHead className="text-[10px] font-black uppercase">Vencimiento</TableHead>
                  <TableHead className="text-right text-[10px] font-black uppercase">Saldo ($)</TableHead>
                  <TableHead className="text-center text-[10px] font-black uppercase">Estado</TableHead>
                  <TableHead className="text-right text-[10px] font-black uppercase">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAuthList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-xs text-muted-foreground italic">
                      No hay facturas en esta vista.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAuthList.map(p => {
                    const isAuth = Boolean(authMap[p.id]?.authorized);
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-xs font-bold">{p.docLabel}</TableCell>
                        <TableCell className="text-xs font-semibold">{p.supplier}</TableCell>
                        <TableCell className="text-xs">
                          <span className={p.isOverdue ? 'text-rose-600 font-bold' : 'text-muted-foreground'}>
                            {p.dueDate.toLocaleDateString('es-SV')}
                          </span>
                          {p.isOverdue && (
                            <Badge variant="destructive" className="ml-1.5 text-[9px] h-4 px-1">
                              Vencida
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-black">
                          ${p.balance.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-center">
                          {isAuth ? (
                            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-0 text-[10px]">
                              ✓ Autorizado
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                              Por autorizar
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant={isAuth ? 'outline' : 'default'}
                            onClick={() => handleToggleAuthorize(p.id)}
                            className={`h-8 text-xs font-bold rounded-xl gap-1 ${
                              !isAuth ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : ''
                            }`}
                          >
                            {isAuth ? (
                              <>
                                <XCircle size={13} /> Revocar
                              </>
                            ) : (
                              <>
                                <CheckCircle2 size={13} /> Autorizar Pago
                              </>
                            )}
                          </Button>
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

  /* =========================================================================
   * MODO 2: CRUCE DE FACTURAS (CLIENTE ↔ PROVEEDOR)
   * ========================================================================= */
  const filteredCxc = openCxc.filter(
    c =>
      c.customer.toLowerCase().includes(searchCxc.toLowerCase()) ||
      c.docLabel.toLowerCase().includes(searchCxc.toLowerCase())
  );
  const filteredCxp = openCxp.filter(
    p =>
      p.supplier.toLowerCase().includes(searchCxp.toLowerCase()) ||
      p.docLabel.toLowerCase().includes(searchCxp.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <Card className="bg-card border-border rounded-2xl shadow-sm p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
          <div>
            <h3 className="text-sm font-black flex items-center gap-2 text-foreground">
              <ArrowLeftRight size={17} className="text-indigo-600" />
              Cruce de Facturas (Compensación Cliente ↔ Proveedor)
            </h3>
            <p className="text-xs text-muted-foreground">
              Selecciona una factura por cobrar (CxC) y una factura por pagar (CxP) para cruzarlas sin mover efectivo. Se contabiliza automáticamente (`2101` vs `1103`).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Izquierda: CxC */}
          <div className="rounded-xl border border-border p-3.5 space-y-2.5 bg-background/50">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs font-black text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <DollarSign size={14} /> 1. Factura por Cobrar (Cliente · CxC)
              </Label>
              <Badge variant="outline" className="text-[10px]">{filteredCxc.length} pendientes</Badge>
            </div>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchCxc}
                onChange={e => setSearchCxc(e.target.value)}
                placeholder="Buscar cliente o correlativo..."
                className="pl-8 h-8 text-xs rounded-lg"
              />
            </div>
            <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
              {filteredCxc.length === 0 ? (
                <p className="text-xs text-muted-foreground italic text-center py-6">Sin facturas CxC pendientes.</p>
              ) : (
                filteredCxc.map(c => {
                  const sel = c.id === selectedCxcId;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedCxcId(c.id)}
                      className={`w-full text-left p-2.5 rounded-xl border text-xs transition-all flex items-center justify-between gap-2 ${
                        sel
                          ? 'bg-emerald-50 border-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-700 ring-1 ring-emerald-400'
                          : 'bg-card border-border/70 hover:bg-slate-50 dark:hover:bg-slate-900/50'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-foreground truncate">{c.customer}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">Doc: {c.docLabel}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                          ${c.balance.toFixed(2)}
                        </div>
                        <div className="text-[9px] text-muted-foreground">Saldo CxC</div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Derecha: CxP */}
          <div className="rounded-xl border border-border p-3.5 space-y-2.5 bg-background/50">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs font-black text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                <Receipt size={14} /> 2. Factura por Pagar (Proveedor · CxP)
              </Label>
              <Badge variant="outline" className="text-[10px]">{filteredCxp.length} pendientes</Badge>
            </div>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchCxp}
                onChange={e => setSearchCxp(e.target.value)}
                placeholder="Buscar proveedor o documento..."
                className="pl-8 h-8 text-xs rounded-lg"
              />
            </div>
            <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
              {filteredCxp.length === 0 ? (
                <p className="text-xs text-muted-foreground italic text-center py-6">Sin facturas CxP pendientes.</p>
              ) : (
                filteredCxp.map(p => {
                  const sel = p.id === selectedCxpId;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedCxpId(p.id)}
                      className={`w-full text-left p-2.5 rounded-xl border text-xs transition-all flex items-center justify-between gap-2 ${
                        sel
                          ? 'bg-rose-50 border-rose-400 dark:bg-rose-950/40 dark:border-rose-700 ring-1 ring-rose-400'
                          : 'bg-card border-border/70 hover:bg-slate-50 dark:hover:bg-slate-900/50'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-foreground truncate">{p.supplier}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">Doc: {p.docLabel}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono font-black text-rose-600 dark:text-rose-400">
                          ${p.balance.toFixed(2)}
                        </div>
                        <div className="text-[9px] text-muted-foreground">Saldo CxP</div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Barra de confirmación de cruce */}
        <div className="rounded-xl bg-indigo-50/60 dark:bg-indigo-950/25 border border-indigo-200 dark:border-indigo-900 p-4 flex flex-col md:flex-row items-stretch md:items-end justify-between gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
            <div>
              <Label className="text-[10px] font-black uppercase text-muted-foreground">Monto a Cruzar ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={crossAmount}
                onChange={e => setCrossAmount(e.target.value)}
                placeholder="0.00"
                className="h-9 text-sm font-mono font-black mt-1 bg-card"
              />
            </div>
            <div>
              <Label className="text-[10px] font-black uppercase text-muted-foreground">Referencia / Acuerdo</Label>
              <Input
                value={crossNotes}
                onChange={e => setCrossNotes(e.target.value)}
                placeholder="Ej. Cruce acordado por gerencia..."
                className="h-9 text-xs mt-1 bg-card"
              />
            </div>
          </div>
          <Button
            type="button"
            disabled={submitting || !selectedCxc || !selectedCxp || !crossAmount}
            onClick={handleExecuteCrossing}
            className="h-9 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1.5"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <ArrowLeftRight size={14} />}
            Aplicar Cruce y Contabilizar
          </Button>
        </div>
      </Card>

      {/* Historial de Cruces */}
      <Card className="bg-card border-border rounded-2xl shadow-sm overflow-hidden">
        <CardHeader className="p-4 border-b border-border">
          <CardTitle className="text-xs font-black uppercase tracking-wider flex items-center gap-2 text-muted-foreground">
            <History size={14} /> Historial de Cruces Aplicados ({crossingsLog.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px] uppercase font-black">Ref</TableHead>
                <TableHead className="text-[10px] uppercase font-black">Fecha</TableHead>
                <TableHead className="text-[10px] uppercase font-black">Cliente (CxC)</TableHead>
                <TableHead className="text-[10px] uppercase font-black">Proveedor (CxP)</TableHead>
                <TableHead className="text-right text-[10px] uppercase font-black">Monto Cruzado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {crossingsLog.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-xs text-muted-foreground italic">
                    Aún no se han registrado cruces de facturas.
                  </TableCell>
                </TableRow>
              ) : (
                crossingsLog.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                      {item.id}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(item.date).toLocaleDateString('es-SV')}
                    </TableCell>
                    <TableCell className="text-xs">
                      <span className="font-semibold">{item.cxcCustomer}</span>{' '}
                      <span className="font-mono text-[10px] text-muted-foreground">({item.cxcLabel})</span>
                    </TableCell>
                    <TableCell className="text-xs">
                      <span className="font-semibold">{item.cxpSupplier}</span>{' '}
                      <span className="font-mono text-[10px] text-muted-foreground">({item.cxpLabel})</span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-black text-emerald-600 dark:text-emerald-400">
                      ${Number(item.amount || 0).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
