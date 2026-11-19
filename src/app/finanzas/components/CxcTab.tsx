'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  PlusCircle,
  Search,
  Loader2,
  MessageCircle,
  FileText,
  Clock,
  Calendar,
  History,
  Plus
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export default function CxcTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [salesCredit, setSalesCredit] = useState<any[]>([]);
  const [customersList, setCustomersList] = useState<any[]>([]);
  const [paymentsMap, setPaymentsMap] = useState<Record<string, any[]>>({});

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'TODOS' | 'PENDIENTE' | 'VENCIDO' | 'PAGADO'>('TODOS');

  // Modal para abonar
  const [selectedSale, setSelectedSale] = useState<any | null>(null);
  const [isAbonoModalOpen, setIsAbonoModalOpen] = useState(false);
  const [abonoAmount, setAbonoAmount] = useState('');
  const [abonoMethod, setAbonoMethod] = useState('Efectivo');
  const [abonoRef, setAbonoRef] = useState('');
  const [abonoNotes, setAbonoNotes] = useState('');
  const [isSavingAbono, setIsSavingAbono] = useState(false);

  // Modal para registrar nueva Cuenta por Cobrar manual
  const [isNewCxcOpen, setIsNewCxcOpen] = useState(false);
  const [newCxcCustomerId, setNewCxcCustomerId] = useState('none');
  const [newCxcCustomerName, setNewCxcCustomerName] = useState('');
  const [newCxcDocType, setNewCxcDocType] = useState('CCF');
  const [newCxcCorrelative, setNewCxcCorrelative] = useState('');
  const [newCxcTotal, setNewCxcTotal] = useState('');
  const [newCxcDays, setNewCxcDays] = useState('30');
  const [isSavingNewCxc, setIsSavingNewCxc] = useState(false);

  // Modal de Historial
  const [historySale, setHistorySale] = useState<any | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [salesRes, custRes, journalRes, cfgRes] = await Promise.all([
        supabase
          .from('sales')
          .select('*, customers(name, phone, email, credit_limit, credit_days)')
          .order('created_at', { ascending: false }),
        supabase.from('customers').select('id, name, phone, email, credit_limit, credit_days').order('name'),
        supabase.from('journal').select('*').order('created_at', { ascending: false }),
        supabase
          .from('system_config')
          .select('key, value')
          .in('key', ['cxc_payments_registry', 'cxc_manual_records'])
      ]);

      if (custRes.data) setCustomersList(custRes.data);

      const allSales = salesRes.data || [];
      // Filtrar ventas al crédito o pendientes (soportando acentos "Crédito", "Credito", "Mixto" o status "PENDIENTE")
      const creditSalesFromDb = allSales.filter((s: any) => {
        if (s.status === 'CANCELADA') return false;
        const pm = (s.payment_method || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const tp = (s.type || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return pm.includes('credito') || tp.includes('credito') || s.status === 'PENDIENTE';
      });

      const cfgRows = cfgRes.data || [];
      const manualRecords: any[] =
        cfgRows.find((r: any) => r.key === 'cxc_manual_records')?.value || [];
      const registryPayments: any[] =
        cfgRows.find((r: any) => r.key === 'cxc_payments_registry')?.value || [];

      const combinedSales = [...creditSalesFromDb];
      manualRecords.forEach((m: any) => {
        if (!combinedSales.some((s: any) => s.id === m.id || s.correlative === m.correlative)) {
          combinedSales.push(m);
        }
      });

      // Mapear abonos desde system_config (cxc_payments_registry) y desde journal (Abono a Crédito [CORRELATIVO])
      const pMap: Record<string, any[]> = {};
      const seenPaymentKeys = new Set<string>();

      registryPayments.forEach((p: any) => {
        if (!p?.sale_id) return;
        const key = `${p.sale_id}_${p.amount}_${p.created_at || ''}`;
        seenPaymentKeys.add(key);
        if (!pMap[p.sale_id]) pMap[p.sale_id] = [];
        pMap[p.sale_id].push(p);
      });

      // Sincronizar también abonos registrados desde Facturación POS en public.journal
      const journalEntries = journalRes.data || [];
      combinedSales.forEach((sale: any) => {
        if (!sale.correlative) return;
        const matchingJournals = journalEntries.filter(
          (j: any) =>
            j.description &&
            j.description.includes(`[${sale.correlative}]`) &&
            j.description.toLowerCase().includes('abono')
        );
        matchingJournals.forEach((j: any) => {
          const alreadyListed = (pMap[sale.id] || []).some(
            (existing: any) =>
              existing.journal_id === j.id ||
              (Math.abs(Number(existing.amount) - Number(j.amount)) < 0.01 &&
                existing.reference === `JOURNAL-${j.id}`)
          );
          if (!alreadyListed) {
            if (!pMap[sale.id]) pMap[sale.id] = [];
            pMap[sale.id].push({
              id: `jrnl-${j.id}`,
              journal_id: j.id,
              sale_id: sale.id,
              amount: parseFloat(j.amount) || 0,
              payment_method: 'Caja POS',
              reference: `POS-${String(j.id).slice(0, 6)}`,
              notes: j.description,
              created_at: j.created_at || new Date().toISOString()
            });
          }
        });
      });

      setPaymentsMap(pMap);
      setSalesCredit(combinedSales);
    } catch (e: any) {
      console.error('Error cargando CXC:', e);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar las Cuentas por Cobrar.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Procesar cálculos
  const processedSales = salesCredit.map(s => {
    const abonos = paymentsMap[s.id] || [];
    const totalAbonado = abonos.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);
    const totalVenta = parseFloat(s.total) || 0;
    const saldoPendiente = Math.max(0, totalVenta - totalAbonado);

    const createdAt = new Date(s.created_at || new Date());
    const creditDays = Number(s.credit_days || s.customers?.credit_days) || 30;
    const dueDate = new Date(createdAt.getTime() + creditDays * 24 * 60 * 60 * 1000);
    const isOverdue = saldoPendiente > 0.01 && new Date() > dueDate;
    const isPaid = saldoPendiente <= 0.01;

    let computedStatus: 'PAGADO' | 'VENCIDO' | 'PENDIENTE' = 'PENDIENTE';
    if (isPaid) computedStatus = 'PAGADO';
    else if (isOverdue) computedStatus = 'VENCIDO';

    return {
      ...s,
      creditDays,
      totalAbonado,
      saldoPendiente,
      dueDate,
      computedStatus
    };
  });

  const filteredSales = processedSales.filter(s => {
    const matchesSearch =
      (s.correlative || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.customer_name || s.customers?.name || '').toLowerCase().includes(searchTerm.toLowerCase());

    if (statusFilter === 'TODOS') return matchesSearch;
    return matchesSearch && s.computedStatus === statusFilter;
  });

  // Métricas
  const totalCartera = processedSales.reduce((acc, s) => acc + s.saldoPendiente, 0);
  const totalVencido = processedSales.filter(s => s.computedStatus === 'VENCIDO').reduce((acc, s) => acc + s.saldoPendiente, 0);
  const totalAlDia = processedSales.filter(s => s.computedStatus === 'PENDIENTE').reduce((acc, s) => acc + s.saldoPendiente, 0);
  const totalRecaudado = processedSales.reduce((acc, s) => acc + s.totalAbonado, 0);

  const handleOpenAbonoModal = (sale: any) => {
    setSelectedSale(sale);
    setAbonoAmount(sale.saldoPendiente.toFixed(2));
    setAbonoRef('');
    setAbonoNotes('');
    setAbonoMethod('Efectivo');
    setIsAbonoModalOpen(true);
  };

  const handleSaveAbono = async () => {
    if (!selectedSale || !abonoAmount || parseFloat(abonoAmount) <= 0) {
      toast({ variant: 'destructive', title: 'Monto Inválido', description: 'Por favor ingresa un monto válido a abonar.' });
      return;
    }

    const val = parseFloat(abonoAmount);
    if (val > selectedSale.saldoPendiente + 0.01) {
      toast({
        variant: 'destructive',
        title: 'Exceso de Abono',
        description: `El abono ($${val.toFixed(2)}) supera el saldo pendiente ($${selectedSale.saldoPendiente.toFixed(2)}).`
      });
      return;
    }

    setIsSavingAbono(true);
    try {
      const custName = selectedSale.customer_name || selectedSale.customers?.name || 'Cliente';
      // 1. Registrar en public.journal para sincronización contable y con Facturación POS
      const { data: insertedJournal } = await supabase
        .from('journal')
        .insert({
          description: `Abono a Crédito [${selectedSale.correlative}] - Cliente: ${custName} (${abonoMethod}${abonoRef ? ` Ref: ${abonoRef}` : ''})`,
          type: 'Ingreso',
          amount: val
        })
        .select('id')
        .maybeSingle();

      // 2. Guardar detalle completo en system_config (cxc_payments_registry)
      const { data: regRow } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'cxc_payments_registry')
        .maybeSingle();

      const existingPayments: any[] = Array.isArray(regRow?.value) ? regRow.value : [];
      const newPaymentRecord = {
        id: 'cxc_pay_' + Date.now(),
        journal_id: insertedJournal?.id || null,
        sale_id: selectedSale.id,
        correlative: selectedSale.correlative,
        amount: val,
        payment_method: abonoMethod,
        reference: abonoRef || `ABONO-${Date.now().toString().slice(-5)}`,
        notes: abonoNotes,
        created_at: new Date().toISOString()
      };

      await supabase.from('system_config').upsert(
        {
          key: 'cxc_payments_registry',
          value: [newPaymentRecord, ...existingPayments],
          updated_at: new Date().toISOString()
        },
        { onConflict: 'key' }
      );

      // 3. Si el saldo queda cubierto, actualizar estado de la venta a ACTIVA
      if (selectedSale.saldoPendiente - val <= 0.01) {
        await supabase.from('sales').update({ status: 'ACTIVA' }).eq('id', selectedSale.id);
      }

      toast({
        title: 'Abono Registrado con Éxito',
        description: `Se abonaron $${val.toFixed(2)} al comprobante ${selectedSale.correlative}.`
      });
      setIsAbonoModalOpen(false);
      await loadData();
    } catch (e: any) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error al registrar abono', description: e.message || 'No se pudo guardar el abono.' });
    } finally {
      setIsSavingAbono(false);
    }
  };

  const handleCreateManualCxc = async (e: React.FormEvent) => {
    e.preventDefault();
    const totalNum = parseFloat(newCxcTotal);
    const chosenCust = customersList.find(c => c.id === newCxcCustomerId);
    const finalCustomerName = chosenCust?.name || newCxcCustomerName.trim();

    if (!finalCustomerName || isNaN(totalNum) || totalNum <= 0) {
      toast({
        variant: 'destructive',
        title: 'Datos Incompletos',
        description: 'Selecciona o escribe el nombre del cliente y un monto mayor a $0.00.'
      });
      return;
    }

    setIsSavingNewCxc(true);
    try {
      const correlative =
        newCxcCorrelative.trim() ||
        `${newCxcDocType}-CXC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;

      // Intentar insertar como venta al crédito en public.sales
      const { data: insertedSale, error: saleErr } = await supabase
        .from('sales')
        .insert({
          correlative,
          doc_type: newCxcDocType,
          customer_id: chosenCust ? chosenCust.id : null,
          customer_name: finalCustomerName,
          total: totalNum,
          status: 'PENDIENTE',
          payment_method: 'Credito'
        })
        .select('*')
        .maybeSingle();

      if (saleErr || !insertedSale) {
        // Respaldo en system_config (cxc_manual_records)
        const { data: manualRow } = await supabase
          .from('system_config')
          .select('value')
          .eq('key', 'cxc_manual_records')
          .maybeSingle();
        const currManual: any[] = Array.isArray(manualRow?.value) ? manualRow.value : [];
        const manualItem = {
          id: 'cxc_man_' + Date.now(),
          correlative,
          doc_type: newCxcDocType,
          customer_id: chosenCust ? chosenCust.id : null,
          customer_name: finalCustomerName,
          total: totalNum,
          credit_days: parseInt(newCxcDays) || 30,
          status: 'PENDIENTE',
          payment_method: 'Credito',
          created_at: new Date().toISOString()
        };
        await supabase.from('system_config').upsert(
          {
            key: 'cxc_manual_records',
            value: [manualItem, ...currManual],
            updated_at: new Date().toISOString()
          },
          { onConflict: 'key' }
        );
      }

      toast({
        title: 'Cuenta por Cobrar Registrada',
        description: `Se registró ${correlative} para ${finalCustomerName} por $${totalNum.toFixed(2)}.`
      });

      setIsNewCxcOpen(false);
      setNewCxcCustomerId('none');
      setNewCxcCustomerName('');
      setNewCxcCorrelative('');
      setNewCxcTotal('');
      await loadData();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setIsSavingNewCxc(false);
    }
  };

  const sendWhatsappReminder = (sale: any) => {
    const phone = sale.customers?.phone || '';
    const name = sale.customer_name || sale.customers?.name || 'Estimado cliente';
    const text = `Hola ${name}, te saludamos de NexWay. Le recordamos amablemente su comprobante al crédito ${sale.correlative} con un saldo pendiente de $${sale.saldoPendiente.toFixed(2)}. ¡Agradecemos su preferencia!`;
    window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Tarjetas de Métricas Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border border-border rounded-2xl p-4 relative overflow-hidden shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Cartera Total CXC</p>
              <h3 className="text-2xl font-black mt-1 text-indigo-600 dark:text-indigo-400">
                ${totalCartera.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </h3>
              <p className="text-[10px] text-muted-foreground mt-1">{processedSales.filter(s => s.saldoPendiente > 0).length} cuentas activas</p>
            </div>
            <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-600 dark:text-indigo-400">
              <DollarSign size={20} />
            </div>
          </div>
          <div className="h-1 bg-indigo-500 w-full absolute bottom-0 left-0" />
        </Card>

        <Card className="bg-card border border-border rounded-2xl p-4 relative overflow-hidden shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Saldos Vencidos</p>
              <h3 className="text-2xl font-black mt-1 text-rose-600 dark:text-rose-400">
                ${totalVencido.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </h3>
              <p className="text-[10px] text-muted-foreground mt-1">{processedSales.filter(s => s.computedStatus === 'VENCIDO').length} en mora</p>
            </div>
            <div className="p-2.5 bg-rose-500/10 rounded-xl text-rose-600 dark:text-rose-400">
              <AlertTriangle size={20} />
            </div>
          </div>
          <div className="h-1 bg-rose-500 w-full absolute bottom-0 left-0" />
        </Card>

        <Card className="bg-card border border-border rounded-2xl p-4 relative overflow-hidden shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Por Vencer (Al Día)</p>
              <h3 className="text-2xl font-black mt-1 text-emerald-600 dark:text-emerald-400">
                ${totalAlDia.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </h3>
              <p className="text-[10px] text-muted-foreground mt-1">Dentro del plazo de crédito</p>
            </div>
            <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-600 dark:text-emerald-400">
              <Clock size={20} />
            </div>
          </div>
          <div className="h-1 bg-emerald-500 w-full absolute bottom-0 left-0" />
        </Card>

        <Card className="bg-card border border-border rounded-2xl p-4 relative overflow-hidden shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Recaudado</p>
              <h3 className="text-2xl font-black mt-1 text-blue-600 dark:text-blue-400">
                ${totalRecaudado.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </h3>
              <p className="text-[10px] text-muted-foreground mt-1">Abonos y liquidaciones</p>
            </div>
            <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-600 dark:text-blue-400">
              <TrendingUp size={20} />
            </div>
          </div>
          <div className="h-1 bg-blue-500 w-full absolute bottom-0 left-0" />
        </Card>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <Card className="border border-border shadow-sm rounded-2xl bg-card overflow-hidden">
        <CardHeader className="bg-muted/30 border-b border-border p-5 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <CardTitle className="text-base font-black uppercase tracking-tight flex items-center gap-2 text-foreground">
              <FileText className="text-indigo-500" size={18} />
              Cuentas por Cobrar a Clientes (CXC)
            </CardTitle>
            <CardDescription className="text-muted-foreground text-xs">
              Sincronizado con Facturación POS al crédito y Libro Diario. Registra abonos o nuevas cuentas por cobrar.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            <div className="relative flex-1 sm:w-60">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente o DTE..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs bg-background border-border rounded-xl"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger className="w-40 h-9 text-xs bg-background border-border rounded-xl font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todos los Estados</SelectItem>
                <SelectItem value="PENDIENTE">Por Vencer (Al Día)</SelectItem>
                <SelectItem value="VENCIDO">Vencidas (En Mora)</SelectItem>
                <SelectItem value="PAGADO">Pagadas Completas</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={() => setIsNewCxcOpen(true)}
              className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl gap-1.5 shadow-sm"
            >
              <Plus size={14} /> Nueva Cuenta CXC
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center p-12"><Loader2 className="animate-spin text-indigo-500" size={32} /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr className="text-left text-muted-foreground">
                    <th className="p-4 font-bold text-[10px] uppercase">DTE / Comprobante</th>
                    <th className="p-4 font-bold text-[10px] uppercase">Cliente</th>
                    <th className="p-4 font-bold text-[10px] uppercase">Emisión / Vencimiento</th>
                    <th className="p-4 font-bold text-[10px] uppercase text-right">Total ($)</th>
                    <th className="p-4 font-bold text-[10px] uppercase text-right">Abonos ($)</th>
                    <th className="p-4 font-bold text-[10px] uppercase text-right">Saldo Pendiente</th>
                    <th className="p-4 font-bold text-[10px] uppercase text-center">Estado</th>
                    <th className="p-4 font-bold text-[10px] uppercase text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.map(s => (
                    <tr key={s.id} className="border-b border-border/60 hover:bg-muted/30 transition-colors">
                      <td className="p-4 font-bold text-indigo-600 dark:text-indigo-400 font-mono text-xs">
                        {s.correlative || 'SIN-NÚMERO'}
                        <div className="text-[10px] text-muted-foreground font-sans font-normal">{s.doc_type || 'Crédito'}</div>
                      </td>
                      <td className="p-4 font-semibold text-foreground text-xs">
                        {s.customer_name || s.customers?.name || 'Cliente Comercial'}
                        {s.customers?.phone && (
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            📱 {s.customers.phone}
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-xs">
                        <div className="text-muted-foreground flex items-center gap-1">
                          <Calendar size={12} /> {new Date(s.created_at).toLocaleDateString('es-SV')}
                        </div>
                        <div className={`font-bold flex items-center gap-1 mt-0.5 ${s.computedStatus === 'VENCIDO' ? 'text-rose-500' : 'text-muted-foreground'}`}>
                          <Clock size={12} /> Vence: {s.dueDate.toLocaleDateString('es-SV')} ({s.creditDays}d)
                        </div>
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-foreground text-xs">
                        ${(parseFloat(s.total) || 0).toFixed(2)}
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                        ${s.totalAbonado.toFixed(2)}
                      </td>
                      <td className="p-4 text-right font-mono font-black text-rose-600 dark:text-rose-400 text-xs">
                        ${s.saldoPendiente.toFixed(2)}
                      </td>
                      <td className="p-4 text-center">
                        {s.computedStatus === 'PAGADO' && (
                          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-bold text-[10px]">
                            <CheckCircle2 size={11} className="mr-1" /> PAGADO
                          </Badge>
                        )}
                        {s.computedStatus === 'VENCIDO' && (
                          <Badge className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 font-bold text-[10px]">
                            <AlertTriangle size={11} className="mr-1" /> VENCIDO
                          </Badge>
                        )}
                        {s.computedStatus === 'PENDIENTE' && (
                          <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 font-bold text-[10px]">
                            <Clock size={11} className="mr-1" /> PENDIENTE
                          </Badge>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-1.5">
                          {s.saldoPendiente > 0.01 && (
                            <Button
                              size="sm"
                              onClick={() => handleOpenAbonoModal(s)}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-8 rounded-xl"
                            >
                              <PlusCircle size={13} className="mr-1" /> Abonar
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setHistorySale(s); setIsHistoryModalOpen(true); }}
                            className="h-8 text-xs font-bold rounded-xl"
                            title="Historial de Abonos"
                          >
                            <History size={13} />
                          </Button>
                          {s.saldoPendiente > 0.01 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => sendWhatsappReminder(s)}
                              className="h-8 text-xs font-bold text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10 rounded-xl"
                              title="Recordatorio por WhatsApp"
                            >
                              <MessageCircle size={13} />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredSales.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center p-12 text-muted-foreground">
                        <div className="max-w-md mx-auto space-y-3">
                          <FileText className="mx-auto text-muted-foreground/40" size={32} />
                          <p className="text-xs font-semibold">
                            No hay cuentas por cobrar registradas en la categoría seleccionada.
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Las facturas emitidas con forma de pago <strong>Crédito</strong> en Facturación POS aparecen aquí automáticamente, o puedes registrar un saldo por cobrar manualmente.
                          </p>
                          <Button
                            size="sm"
                            onClick={() => setIsNewCxcOpen(true)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl"
                          >
                            <Plus size={14} className="mr-1" /> Registrar Primera Cuenta por Cobrar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal para Registrar Nueva Cuenta por Cobrar */}
      <Dialog open={isNewCxcOpen} onOpenChange={setIsNewCxcOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <PlusCircle className="text-indigo-500" size={18} />
              Registrar Cuenta por Cobrar (CXC)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Registra una factura al crédito o saldo inicial pendiente de cobro de un cliente.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateManualCxc} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Seleccionar Cliente del Directorio</Label>
              <Select
                value={newCxcCustomerId}
                onValueChange={(val) => {
                  setNewCxcCustomerId(val);
                  const found = customersList.find(c => c.id === val);
                  if (found) {
                    setNewCxcCustomerName(found.name);
                    if (found.credit_days) setNewCxcDays(String(found.credit_days));
                  }
                }}
              >
                <SelectTrigger className="rounded-xl text-xs h-9">
                  <SelectValue placeholder="Seleccionar cliente..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Escribir Nombre Manualmente --</SelectItem>
                  {customersList.map(c => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {newCxcCustomerId === 'none' && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Nombre / Razón Social del Cliente *</Label>
                <Input
                  value={newCxcCustomerName}
                  onChange={e => setNewCxcCustomerName(e.target.value)}
                  placeholder="Ej. Constructora del Valle S.A. de C.V."
                  className="rounded-xl text-xs h-9"
                  required
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Tipo Documento</Label>
                <Select value={newCxcDocType} onValueChange={setNewCxcDocType}>
                  <SelectTrigger className="rounded-xl text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CCF">Crédito Fiscal (CCF)</SelectItem>
                    <SelectItem value="CF">Factura Consumidor (CF)</SelectItem>
                    <SelectItem value="PAGARE">Pagaré / Saldo Inicial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">N° DTE / Comprobante</Label>
                <Input
                  value={newCxcCorrelative}
                  onChange={e => setNewCxcCorrelative(e.target.value)}
                  placeholder="Auto si se deja vacío"
                  className="rounded-xl text-xs h-9 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Monto Total a Cobrar ($) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newCxcTotal}
                  onChange={e => setNewCxcTotal(e.target.value)}
                  placeholder="0.00"
                  className="rounded-xl text-xs h-9 font-bold"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Plazo de Crédito (Días)</Label>
                <Input
                  type="number"
                  value={newCxcDays}
                  onChange={e => setNewCxcDays(e.target.value)}
                  placeholder="30"
                  className="rounded-xl text-xs h-9"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsNewCxcOpen(false)} className="rounded-xl text-xs">
                Cancelar
              </Button>
              <Button type="submit" disabled={isSavingNewCxc} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs">
                {isSavingNewCxc ? <Loader2 className="animate-spin mr-1.5" size={14} /> : null}
                Guardar Cuenta CXC
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal para Registrar Abono */}
      <Dialog open={isAbonoModalOpen} onOpenChange={setIsAbonoModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <DollarSign className="text-indigo-500" size={18} />
              Registrar Abono a Cuenta por Cobrar
            </DialogTitle>
            <DialogDescription className="text-xs">
              Comprobante: <strong className="text-foreground">{selectedSale?.correlative}</strong> — Saldo Pendiente:{' '}
              <strong className="text-rose-500">${selectedSale?.saldoPendiente.toFixed(2)}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Monto a Abonar ($)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={abonoAmount}
                onChange={e => setAbonoAmount(e.target.value)}
                className="font-mono font-bold text-base h-11 rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Método de Pago</Label>
                <Select value={abonoMethod} onValueChange={setAbonoMethod}>
                  <SelectTrigger className="rounded-xl text-xs h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Efectivo">Efectivo</SelectItem>
                    <SelectItem value="Transferencia">Transferencia Bancaria</SelectItem>
                    <SelectItem value="Cheque">Cheque</SelectItem>
                    <SelectItem value="Tarjeta">Tarjeta POS</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">N° Referencia /Recibo</Label>
                <Input
                  placeholder="Ej. TRF-99412"
                  value={abonoRef}
                  onChange={e => setAbonoRef(e.target.value)}
                  className="text-xs h-10 rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Observaciones</Label>
              <Input
                placeholder="Nota opcional del abono..."
                value={abonoNotes}
                onChange={e => setAbonoNotes(e.target.value)}
                className="text-xs h-10 rounded-xl"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAbonoModalOpen(false)} className="rounded-xl text-xs">
              Cancelar
            </Button>
            <Button onClick={handleSaveAbono} disabled={isSavingAbono} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs">
              {isSavingAbono ? <Loader2 className="animate-spin mr-1.5" size={14} /> : null}
              Confirmar Abono
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Historial de Abonos */}
      <Dialog open={isHistoryModalOpen} onOpenChange={setIsHistoryModalOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <History className="text-indigo-500" size={18} />
              Historial de Abonos — {historySale?.correlative}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Desglose de pagos aplicados a esta cuenta por cobrar.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            {(paymentsMap[historySale?.id] || []).length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-6">
                No se han registrado abonos para este documento todavía.
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {(paymentsMap[historySale?.id] || []).map((ab: any) => (
                  <div key={ab.id} className="p-3 rounded-xl border border-border flex justify-between items-center bg-muted/30">
                    <div>
                      <div className="font-bold text-xs text-emerald-600 dark:text-emerald-400">
                        +${parseFloat(ab.amount).toFixed(2)} ({ab.payment_method})
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Ref: {ab.reference || 'N/A'} {ab.notes ? `— ${ab.notes}` : ''}
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono">
                      {new Date(ab.created_at).toLocaleDateString('es-SV')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
