'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Building2,
  DollarSign,
  AlertCircle,
  PlusCircle,
  Search,
  Loader2,
  Clock,
  History,
  FileCheck,
  Calendar,
  Plus
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export default function CxpTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [purchasesCredit, setPurchasesCredit] = useState<any[]>([]);
  const [suppliersList, setSuppliersList] = useState<any[]>([]);
  const [paymentsMap, setPaymentsMap] = useState<Record<string, any[]>>({});

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'TODOS' | 'PENDIENTE' | 'VENCIDO' | 'PAGADO'>('TODOS');

  // Modal para abonar/pagar a proveedor
  const [selectedPurchase, setSelectedPurchase] = useState<any | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Transferencia');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isSavingPayment, setIsSavingPayment] = useState(false);

  // Modal para registrar nueva Cuenta por Pagar manual
  const [isNewCxpOpen, setIsNewCxpOpen] = useState(false);
  const [newCxpSupplierId, setNewCxpSupplierId] = useState('none');
  const [newCxpSupplierName, setNewCxpSupplierName] = useState('');
  const [newCxpDocNumber, setNewCxpDocNumber] = useState('');
  const [newCxpTotal, setNewCxpTotal] = useState('');
  const [newCxpDays, setNewCxpDays] = useState('30');
  const [isSavingNewCxp, setIsSavingNewCxp] = useState(false);

  // Modal de Historial
  const [historyPurchase, setHistoryPurchase] = useState<any | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [purchasesRes, supRes, cfgRes] = await Promise.all([
        supabase
          .from('purchases')
          .select('*, suppliers(name, phone, email)')
          .order('created_at', { ascending: false }),
        supabase.from('suppliers').select('id, name, phone, email').order('name'),
        supabase
          .from('system_config')
          .select('key, value')
          .in('key', ['cxp_payments_registry', 'cxp_manual_records'])
      ]);

      if (supRes.data) setSuppliersList(supRes.data);

      const allPurchases = purchasesRes.data || [];
      const creditPurchasesFromDb = allPurchases.filter((p: any) => {
        const pm = (p.payment_method || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return pm.includes('credito') || p.status === 'PENDIENTE' || p.payment_status === 'PENDIENTE';
      });

      const cfgRows = cfgRes.data || [];
      const manualRecords: any[] =
        cfgRows.find((r: any) => r.key === 'cxp_manual_records')?.value || [];
      const registryPayments: any[] =
        cfgRows.find((r: any) => r.key === 'cxp_payments_registry')?.value || [];

      const combinedPurchases = [...creditPurchasesFromDb];
      manualRecords.forEach((m: any) => {
        if (!combinedPurchases.some((p: any) => p.id === m.id)) {
          combinedPurchases.push(m);
        }
      });

      const pMap: Record<string, any[]> = {};
      registryPayments.forEach((p: any) => {
        if (!p?.purchase_id) return;
        if (!pMap[p.purchase_id]) pMap[p.purchase_id] = [];
        pMap[p.purchase_id].push(p);
      });

      setPaymentsMap(pMap);
      setPurchasesCredit(combinedPurchases);
    } catch (e: any) {
      console.error('Error cargando CXP:', e);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar las Cuentas por Pagar.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Procesar cálculos
  const processedPurchases = purchasesCredit.map(p => {
    const pagos = paymentsMap[p.id] || [];
    const totalPagado = pagos.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const totalCompra = parseFloat(p.total) || 0;
    const saldoPendiente = p.payment_status === 'PAGADO' ? 0 : Math.max(0, totalCompra - totalPagado);

    const createdAt = new Date(p.created_at || new Date());
    const days = Number(p.credit_days) || 30;
    const dueDate = new Date(createdAt.getTime() + days * 24 * 60 * 60 * 1000);
    const isOverdue = saldoPendiente > 0.01 && new Date() > dueDate;
    const isPaid = saldoPendiente <= 0.01 || p.payment_status === 'PAGADO';

    let computedStatus: 'PAGADO' | 'VENCIDO' | 'PENDIENTE' = 'PENDIENTE';
    if (isPaid) computedStatus = 'PAGADO';
    else if (isOverdue) computedStatus = 'VENCIDO';

    const docLabel = p.document_number || p.dte_control || p.order_id || `CXP-${String(p.id).slice(0, 6)}`;
    const supplierLabel = p.supplier_name || p.suppliers?.name || 'Proveedor General';

    return {
      ...p,
      docLabel,
      supplierLabel,
      totalPagado: isPaid ? totalCompra : totalPagado,
      saldoPendiente,
      dueDate,
      computedStatus
    };
  });

  const filteredPurchases = processedPurchases.filter(p => {
    const matchesSearch =
      p.docLabel.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.supplierLabel.toLowerCase().includes(searchTerm.toLowerCase());

    if (statusFilter === 'TODOS') return matchesSearch;
    return matchesSearch && p.computedStatus === statusFilter;
  });

  // Métricas
  const totalCxp = processedPurchases.reduce((acc, p) => acc + p.saldoPendiente, 0);
  const totalVencido = processedPurchases.filter(p => p.computedStatus === 'VENCIDO').reduce((acc, p) => acc + p.saldoPendiente, 0);
  const totalAlDia = processedPurchases.filter(p => p.computedStatus === 'PENDIENTE').reduce((acc, p) => acc + p.saldoPendiente, 0);
  const totalPagadoAcumulado = processedPurchases.reduce((acc, p) => acc + p.totalPagado, 0);

  const handleOpenPaymentModal = (purchase: any) => {
    setSelectedPurchase(purchase);
    setPaymentAmount(purchase.saldoPendiente.toFixed(2));
    setPaymentRef('');
    setPaymentNotes('');
    setPaymentMethod('Transferencia');
    setIsPaymentModalOpen(true);
  };

  const handleSavePayment = async () => {
    if (!selectedPurchase || !paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast({ variant: 'destructive', title: 'Monto Inválido', description: 'Ingresa un monto válido a pagar.' });
      return;
    }

    const val = parseFloat(paymentAmount);
    if (val > selectedPurchase.saldoPendiente + 0.01) {
      toast({
        variant: 'destructive',
        title: 'Exceso de Pago',
        description: `El pago ($${val.toFixed(2)}) supera el saldo pendiente ($${selectedPurchase.saldoPendiente.toFixed(2)}).`
      });
      return;
    }

    setIsSavingPayment(true);
    try {
      // 1. Registrar egreso en public.journal
      await supabase.from('journal').insert({
        description: `Pago a Proveedor CXP [${selectedPurchase.docLabel}] - ${selectedPurchase.supplierLabel} (${paymentMethod})`,
        type: 'Egreso',
        amount: val
      });

      // 2. Guardar pago en system_config (cxp_payments_registry)
      const { data: regRow } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'cxp_payments_registry')
        .maybeSingle();

      const existingPayments: any[] = Array.isArray(regRow?.value) ? regRow.value : [];
      const newPayment = {
        id: 'cxp_pay_' + Date.now(),
        purchase_id: selectedPurchase.id,
        amount: val,
        payment_method: paymentMethod,
        reference: paymentRef || `PAGO-${Date.now().toString().slice(-5)}`,
        notes: paymentNotes,
        created_at: new Date().toISOString()
      };

      await supabase.from('system_config').upsert(
        {
          key: 'cxp_payments_registry',
          value: [newPayment, ...existingPayments]},
        { onConflict: 'key' }
      );

      // 3. Si cubre el total y es una compra en public.purchases, marcar PAGADO
      if (val >= selectedPurchase.saldoPendiente - 0.01 && !String(selectedPurchase.id).startsWith('cxp_man_')) {
        await supabase
          .from('purchases')
          .update({ payment_status: 'PAGADO', status: 'COMPLETADO' })
          .eq('id', selectedPurchase.id);
      }

      toast({ title: 'Pago a Proveedor Registrado', description: `Se procesaron $${val.toFixed(2)} correctamente.` });
      setIsPaymentModalOpen(false);
      await loadData();
    } catch (e: any) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar el pago.' });
    } finally {
      setIsSavingPayment(false);
    }
  };

  const handleCreateManualCxp = async (e: React.FormEvent) => {
    e.preventDefault();
    const totalNum = parseFloat(newCxpTotal);
    const chosenSup = suppliersList.find(s => s.id === newCxpSupplierId);
    const finalSupName = chosenSup?.name || newCxpSupplierName.trim();

    if (!finalSupName || isNaN(totalNum) || totalNum <= 0) {
      toast({
        variant: 'destructive',
        title: 'Datos Incompletos',
        description: 'Selecciona o escribe el proveedor y un monto mayor a $0.00.'
      });
      return;
    }

    setIsSavingNewCxp(true);
    try {
      const docNum =
        newCxpDocNumber.trim() ||
        `CCF-PROV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;

      const { data: manualRow } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'cxp_manual_records')
        .maybeSingle();

      const currManual: any[] = Array.isArray(manualRow?.value) ? manualRow.value : [];
      const newManualCxp = {
        id: 'cxp_man_' + Date.now(),
        order_id: docNum,
        document_number: docNum,
        supplier_id: chosenSup ? chosenSup.id : null,
        supplier_name: finalSupName,
        total: totalNum,
        credit_days: parseInt(newCxpDays) || 30,
        payment_method: 'Crédito',
        status: 'PENDIENTE',
        payment_status: 'PENDIENTE',
        created_at: new Date().toISOString()
      };

      await supabase.from('system_config').upsert(
        {
          key: 'cxp_manual_records',
          value: [newManualCxp, ...currManual]},
        { onConflict: 'key' }
      );

      toast({
        title: 'Cuenta por Pagar Registrada',
        description: `Se registró ${docNum} de ${finalSupName} por $${totalNum.toFixed(2)}.`
      });

      setIsNewCxpOpen(false);
      setNewCxpSupplierId('none');
      setNewCxpSupplierName('');
      setNewCxpDocNumber('');
      setNewCxpTotal('');
      await loadData();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setIsSavingNewCxp(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tarjetas de Métricas Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border border-border rounded-2xl p-4 relative overflow-hidden shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total CXP por Pagar</p>
              <h3 className="text-2xl font-black mt-1 text-amber-600 dark:text-amber-400">
                ${totalCxp.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </h3>
              <p className="text-[10px] text-muted-foreground mt-1">{processedPurchases.filter(p => p.saldoPendiente > 0).length} facturas pendientes</p>
            </div>
            <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-600 dark:text-amber-400">
              <Building2 size={20} />
            </div>
          </div>
          <div className="h-1 bg-amber-500 w-full absolute bottom-0 left-0" />
        </Card>

        <Card className="bg-card border border-border rounded-2xl p-4 relative overflow-hidden shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Facturas Vencidas</p>
              <h3 className="text-2xl font-black mt-1 text-rose-600 dark:text-rose-400">
                ${totalVencido.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </h3>
              <p className="text-[10px] text-muted-foreground mt-1">Prioridad de pago inmediata</p>
            </div>
            <div className="p-2.5 bg-rose-500/10 rounded-xl text-rose-600 dark:text-rose-400">
              <AlertCircle size={20} />
            </div>
          </div>
          <div className="h-1 bg-rose-500 w-full absolute bottom-0 left-0" />
        </Card>

        <Card className="bg-card border border-border rounded-2xl p-4 relative overflow-hidden shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Compras Al Día</p>
              <h3 className="text-2xl font-black mt-1 text-blue-600 dark:text-blue-400">
                ${totalAlDia.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </h3>
              <p className="text-[10px] text-muted-foreground mt-1">En plazo con proveedor</p>
            </div>
            <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-600 dark:text-blue-400">
              <Clock size={20} />
            </div>
          </div>
          <div className="h-1 bg-blue-500 w-full absolute bottom-0 left-0" />
        </Card>

        <Card className="bg-card border border-border rounded-2xl p-4 relative overflow-hidden shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Liquidado</p>
              <h3 className="text-2xl font-black mt-1 text-emerald-600 dark:text-emerald-400">
                ${totalPagadoAcumulado.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </h3>
              <p className="text-[10px] text-muted-foreground mt-1">Pagos aplicados a proveedores</p>
            </div>
            <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-600 dark:text-emerald-400">
              <FileCheck size={20} />
            </div>
          </div>
          <div className="h-1 bg-emerald-500 w-full absolute bottom-0 left-0" />
        </Card>
      </div>

      {/* Tabla CXP */}
      <Card className="border border-border shadow-sm rounded-2xl bg-card overflow-hidden">
        <CardHeader className="bg-muted/30 border-b border-border p-5 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <CardTitle className="text-base font-black uppercase tracking-tight flex items-center gap-2 text-foreground">
              <Building2 className="text-amber-500" size={18} />
              Cuentas por Pagar a Proveedores (CXP)
            </CardTitle>
            <CardDescription className="text-muted-foreground text-xs">
              Control de obligaciones comerciales con proveedores, vencimientos y aplicación de pagos.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            <div className="relative flex-1 sm:w-60">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar proveedor o documento..."
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
                <SelectItem value="VENCIDO">Vencidas</SelectItem>
                <SelectItem value="PAGADO">Pagadas</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={() => setIsNewCxpOpen(true)}
              className="h-9 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl gap-1.5 shadow-sm"
            >
              <Plus size={14} /> Nueva Cuenta CXP
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center p-12"><Loader2 className="animate-spin text-amber-500" size={32} /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr className="text-left text-muted-foreground">
                    <th className="p-4 font-bold text-[10px] uppercase">Comprobante / Orden</th>
                    <th className="p-4 font-bold text-[10px] uppercase">Proveedor</th>
                    <th className="p-4 font-bold text-[10px] uppercase">Emisión / Vencimiento</th>
                    <th className="p-4 font-bold text-[10px] uppercase text-right">Total ($)</th>
                    <th className="p-4 font-bold text-[10px] uppercase text-right">Pagado ($)</th>
                    <th className="p-4 font-bold text-[10px] uppercase text-right">Saldo por Pagar</th>
                    <th className="p-4 font-bold text-[10px] uppercase text-center">Estado</th>
                    <th className="p-4 font-bold text-[10px] uppercase text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPurchases.map(p => (
                    <tr key={p.id} className="border-b border-border/60 hover:bg-muted/30 transition-colors">
                      <td className="p-4 font-bold text-amber-600 dark:text-amber-400 font-mono text-xs">
                        {p.docLabel}
                      </td>
                      <td className="p-4 font-semibold text-foreground text-xs">
                        {p.supplierLabel}
                      </td>
                      <td className="p-4 text-xs">
                        <div className="text-muted-foreground flex items-center gap-1">
                          <Calendar size={12} /> {new Date(p.created_at).toLocaleDateString('es-SV')}
                        </div>
                        <div className={`font-bold flex items-center gap-1 mt-0.5 ${p.computedStatus === 'VENCIDO' ? 'text-rose-500' : 'text-muted-foreground'}`}>
                          <Clock size={12} /> Vence: {p.dueDate.toLocaleDateString('es-SV')}
                        </div>
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-foreground text-xs">
                        ${(parseFloat(p.total) || 0).toFixed(2)}
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                        ${p.totalPagado.toFixed(2)}
                      </td>
                      <td className="p-4 text-right font-mono font-black text-rose-600 dark:text-rose-400 text-xs">
                        ${p.saldoPendiente.toFixed(2)}
                      </td>
                      <td className="p-4 text-center">
                        <Badge
                          className={`text-[10px] font-bold ${
                            p.computedStatus === 'PAGADO'
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                              : p.computedStatus === 'VENCIDO'
                              ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                              : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                          }`}
                        >
                          {p.computedStatus}
                        </Badge>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-1.5">
                          {p.saldoPendiente > 0.01 && (
                            <Button
                              size="sm"
                              onClick={() => handleOpenPaymentModal(p)}
                              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs h-8 rounded-xl"
                            >
                              <PlusCircle size={13} className="mr-1" /> Pagar
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setHistoryPurchase(p); setIsHistoryModalOpen(true); }}
                            className="h-8 text-xs font-bold rounded-xl"
                            title="Historial de Pagos"
                          >
                            <History size={13} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredPurchases.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center p-12 text-muted-foreground">
                        <div className="max-w-md mx-auto space-y-3">
                          <Building2 className="mx-auto text-muted-foreground/40" size={32} />
                          <p className="text-xs font-semibold">
                            No hay cuentas por pagar registradas en esta categoría.
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Las compras registradas al crédito en Abastecimiento aparecen aquí automáticamente, o puedes registrar una factura de proveedor manualmente.
                          </p>
                          <Button
                            size="sm"
                            onClick={() => setIsNewCxpOpen(true)}
                            className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl"
                          >
                            <Plus size={14} className="mr-1" /> Registrar Factura por Pagar
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

      {/* Modal para Registrar Nueva Cuenta por Pagar */}
      <Dialog open={isNewCxpOpen} onOpenChange={setIsNewCxpOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Building2 className="text-amber-500" size={18} />
              Registrar Cuenta por Pagar a Proveedor
            </DialogTitle>
            <DialogDescription className="text-xs">
              Registra una factura o compromiso de pago al crédito con un proveedor.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateManualCxp} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Seleccionar Proveedor del Directorio</Label>
              <Select
                value={newCxpSupplierId}
                onValueChange={(val) => {
                  setNewCxpSupplierId(val);
                  const found = suppliersList.find(s => s.id === val);
                  if (found) setNewCxpSupplierName(found.name);
                }}
              >
                <SelectTrigger className="rounded-xl text-xs h-9">
                  <SelectValue placeholder="Seleccionar proveedor..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Escribir Proveedor Manualmente --</SelectItem>
                  {suppliersList.map(s => (
                    <SelectItem key={s.id} value={s.id} className="text-xs">
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {newCxpSupplierId === 'none' && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Nombre / Razón Social del Proveedor *</Label>
                <Input
                  value={newCxpSupplierName}
                  onChange={e => setNewCxpSupplierName(e.target.value)}
                  placeholder="Ej. Distribuidora Industrial S.A. de C.V."
                  className="rounded-xl text-xs h-9"
                  required
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">N° Comprobante / CCF / Factura</Label>
              <Input
                value={newCxpDocNumber}
                onChange={e => setNewCxpDocNumber(e.target.value)}
                placeholder="Ej. DTE-03-0001425 (Auto si se deja vacío)"
                className="rounded-xl text-xs h-9 font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Monto Total a Pagar ($) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newCxpTotal}
                  onChange={e => setNewCxpTotal(e.target.value)}
                  placeholder="0.00"
                  className="rounded-xl text-xs h-9 font-bold"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Plazo de Crédito (Días)</Label>
                <Input
                  type="number"
                  value={newCxpDays}
                  onChange={e => setNewCxpDays(e.target.value)}
                  placeholder="30"
                  className="rounded-xl text-xs h-9"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsNewCxpOpen(false)} className="rounded-xl text-xs">
                Cancelar
              </Button>
              <Button type="submit" disabled={isSavingNewCxp} className="bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs">
                {isSavingNewCxp ? <Loader2 className="animate-spin mr-1.5" size={14} /> : null}
                Guardar Cuenta CXP
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal para Registrar Pago */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <DollarSign className="text-amber-500" size={18} />
              Registrar Pago a Proveedor
            </DialogTitle>
            <DialogDescription className="text-xs">
              Comprobante: <strong className="text-foreground">{selectedPurchase?.docLabel}</strong> — Saldo Pendiente:{' '}
              <strong className="text-rose-500">${selectedPurchase?.saldoPendiente.toFixed(2)}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Monto a Pagar ($)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={paymentAmount}
                onChange={e => setPaymentAmount(e.target.value)}
                className="font-mono font-bold text-base h-11 rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Método de Pago</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="rounded-xl text-xs h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Transferencia">Transferencia Bancaria</SelectItem>
                    <SelectItem value="Cheque">Cheque</SelectItem>
                    <SelectItem value="Efectivo">Efectivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">N° Referencia / Voucher</Label>
                <Input
                  placeholder="Ej. CHQ-1042"
                  value={paymentRef}
                  onChange={e => setPaymentRef(e.target.value)}
                  className="text-xs h-10 rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Observaciones</Label>
              <Input
                placeholder="Nota opcional del pago..."
                value={paymentNotes}
                onChange={e => setPaymentNotes(e.target.value)}
                className="text-xs h-10 rounded-xl"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPaymentModalOpen(false)} className="rounded-xl text-xs">
              Cancelar
            </Button>
            <Button onClick={handleSavePayment} disabled={isSavingPayment} className="bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs">
              {isSavingPayment ? <Loader2 className="animate-spin mr-1.5" size={14} /> : null}
              Confirmar Pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Historial de Pagos */}
      <Dialog open={isHistoryModalOpen} onOpenChange={setIsHistoryModalOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <History className="text-amber-500" size={18} />
              Historial de Pagos — {historyPurchase?.docLabel}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Pagos efectuados al proveedor para este documento.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            {(paymentsMap[historyPurchase?.id] || []).length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-6">
                No se han registrado pagos para este documento todavía.
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {(paymentsMap[historyPurchase?.id] || []).map((ab: any) => (
                  <div key={ab.id} className="p-3 rounded-xl border border-border flex justify-between items-center bg-muted/30">
                    <div>
                      <div className="font-bold text-xs text-emerald-600 dark:text-emerald-400">
                        -${parseFloat(ab.amount).toFixed(2)} ({ab.payment_method})
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
