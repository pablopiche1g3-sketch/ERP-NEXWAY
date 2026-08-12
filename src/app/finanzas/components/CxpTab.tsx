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
  TrendingDown, 
  AlertCircle, 
  PlusCircle, 
  Search, 
  Loader2, 
  Receipt, 
  Clock, 
  History,
  FileCheck
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export default function CxpTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [purchasesCredit, setPurchasesCredit] = useState<any[]>([]);
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

  // Modal de Historial
  const [historyPurchase, setHistoryPurchase] = useState<any | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Cargar compras a crédito o pendientes
      const { data: purchases, error } = await supabase
        .from('purchases')
        .select('*, suppliers(name, phone, email)')
        .or('payment_method.ilike.%credito%,status.eq.PENDIENTE')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const creditPurchasesList = purchases || [];

      // 2. Obtener pagos CXP
      const { data: cxpPayments } = await supabase.from('cxp_payments').select('*');
      
      const pMap: Record<string, any[]> = {};
      (cxpPayments || []).forEach((p: any) => {
        if (!pMap[p.purchase_id]) pMap[p.purchase_id] = [];
        pMap[p.purchase_id].push(p);
      });

      setPaymentsMap(pMap);
      setPurchasesCredit(creditPurchasesList);
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
    const saldoPendiente = Math.max(0, totalCompra - totalPagado);

    const createdAt = new Date(p.created_at);
    const days = p.credit_days || 30;
    const dueDate = new Date(createdAt.getTime() + days * 24 * 60 * 60 * 1000);
    const isOverdue = saldoPendiente > 0 && new Date() > dueDate;
    const isPaid = saldoPendiente <= 0.01;

    let computedStatus: 'PAGADO' | 'VENCIDO' | 'PENDIENTE' = 'PENDIENTE';
    if (isPaid) computedStatus = 'PAGADO';
    else if (isOverdue) computedStatus = 'VENCIDO';

    return {
      ...p,
      totalPagado,
      saldoPendiente,
      dueDate,
      computedStatus
    };
  });

  const filteredPurchases = processedPurchases.filter(p => {
    const matchesSearch = 
      (p.order_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.suppliers?.name || '').toLowerCase().includes(searchTerm.toLowerCase());

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
    setPaymentAmount('');
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
      toast({ variant: 'destructive', title: 'Exceso de Pago', description: `El pago ($${val}) supera el saldo pendiente ($${selectedPurchase.saldoPendiente.toFixed(2)}).` });
      return;
    }

    setIsSavingPayment(true);
    try {
      const { error } = await supabase.from('cxp_payments').insert({
        purchase_id: selectedPurchase.id,
        amount: val,
        payment_method: paymentMethod,
        reference: paymentRef,
        notes: paymentNotes
      });

      if (error) throw error;

      // Si se completa el pago total, actualizamos estado de la compra
      if (val >= selectedPurchase.saldoPendiente - 0.01) {
        await supabase.from('purchases').update({ payment_status: 'PAGADO', status: 'COMPLETADO' }).eq('id', selectedPurchase.id);
      }

      toast({ title: 'Pago Registrado', description: `Se procesaron $${val.toFixed(2)} correctamente.` });
      setIsPaymentModalOpen(false);
      await loadData();
    } catch (e: any) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar el pago.' });
    } finally {
      setIsSavingPayment(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tarjetas de Métricas Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-900 border border-slate-800 text-white rounded-2xl p-4 relative overflow-hidden shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total CXP por Pagar</p>
              <h3 className="text-2xl font-black mt-1 text-amber-400">${totalCxp.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
            </div>
            <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-400">
              <Building2 size={20} />
            </div>
          </div>
          <div className="h-1 bg-amber-500 w-full absolute bottom-0 left-0" />
        </Card>

        <Card className="bg-slate-900 border border-slate-800 text-white rounded-2xl p-4 relative overflow-hidden shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Facturas Vencidas</p>
              <h3 className="text-2xl font-black mt-1 text-rose-400">${totalVencido.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
            </div>
            <div className="p-2.5 bg-rose-500/10 rounded-xl text-rose-400">
              <AlertCircle size={20} />
            </div>
          </div>
          <div className="h-1 bg-rose-500 w-full absolute bottom-0 left-0" />
        </Card>

        <Card className="bg-slate-900 border border-slate-800 text-white rounded-2xl p-4 relative overflow-hidden shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Compras Al Día</p>
              <h3 className="text-2xl font-black mt-1 text-blue-400">${totalAlDia.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
            </div>
            <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-400">
              <Clock size={20} />
            </div>
          </div>
          <div className="h-1 bg-blue-500 w-full absolute bottom-0 left-0" />
        </Card>

        <Card className="bg-slate-900 border border-slate-800 text-white rounded-2xl p-4 relative overflow-hidden shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Pagado a Proveedores</p>
              <h3 className="text-2xl font-black mt-1 text-emerald-400">${totalPagadoAcumulado.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
            </div>
            <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400">
              <TrendingDown size={20} />
            </div>
          </div>
          <div className="h-1 bg-emerald-500 w-full absolute bottom-0 left-0" />
        </Card>
      </div>

      {/* Barra de Filtros y Tabla */}
      <Card className="border shadow-md rounded-2xl bg-card">
        <CardHeader className="bg-slate-900 text-white p-5 rounded-t-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <CardTitle className="text-base font-black uppercase tracking-tight flex items-center gap-2">
              <Receipt className="text-amber-400" size={18} />
              Cuentas por Pagar a Proveedores
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs">Programación de pagos y control de abonos a compras.</CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar proveedor u orden..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs bg-slate-800 border-0 text-white placeholder:text-slate-400 rounded-xl"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger className="w-36 h-9 text-xs bg-slate-800 border-0 text-white rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todos los Estados</SelectItem>
                <SelectItem value="PENDIENTE">Al Día</SelectItem>
                <SelectItem value="VENCIDO">Vencidas</SelectItem>
                <SelectItem value="PAGADO">Pagadas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center p-12"><Loader2 className="animate-spin text-amber-500" size={32} /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 dark:bg-white/5 border-b border-slate-200 dark:border-white/10">
                  <tr className="text-left text-slate-500 dark:text-slate-400">
                    <th className="p-4 font-bold text-[10px] uppercase">N° Orden / Compra</th>
                    <th className="p-4 font-bold text-[10px] uppercase">Proveedor</th>
                    <th className="p-4 font-bold text-[10px] uppercase">Emisión / Vencimiento</th>
                    <th className="p-4 font-bold text-[10px] uppercase text-right">Total ($)</th>
                    <th className="p-4 font-bold text-[10px] uppercase text-right">Pagado ($)</th>
                    <th className="p-4 font-bold text-[10px] uppercase text-right">Saldo Pendiente</th>
                    <th className="p-4 font-bold text-[10px] uppercase text-center">Estado</th>
                    <th className="p-4 font-bold text-[10px] uppercase text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPurchases.map(p => (
                    <tr key={p.id} className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                      <td className="p-4 font-bold text-amber-600 dark:text-amber-400">
                        {p.order_id || 'ORD-COMPRA'}
                        <div className="text-[10px] text-slate-400 font-normal">{p.payment_method || 'Crédito'}</div>
                      </td>
                      <td className="p-4 font-semibold text-slate-800 dark:text-slate-200">
                        {p.suppliers?.name || 'Proveedor Registrado'}
                        {p.suppliers?.phone && (
                          <div className="text-[10px] text-slate-400">
                            📞 {p.suppliers.phone}
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-xs">
                        <div className="font-medium text-slate-700 dark:text-slate-300">
                          {new Date(p.created_at).toLocaleDateString()}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Vence: {p.dueDate.toLocaleDateString()} ({p.credit_days || 30}d)
                        </div>
                      </td>
                      <td className="p-4 text-right font-semibold">${parseFloat(p.total).toFixed(2)}</td>
                      <td className="p-4 text-right font-medium text-emerald-600 dark:text-emerald-400">${p.totalPagado.toFixed(2)}</td>
                      <td className="p-4 text-right font-black text-slate-900 dark:text-white text-base">
                        ${p.saldoPendiente.toFixed(2)}
                      </td>
                      <td className="p-4 text-center">
                        <Badge className={`font-black text-[10px] uppercase ${
                          p.computedStatus === 'PAGADO' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' :
                          p.computedStatus === 'VENCIDO' ? 'bg-rose-500/10 text-rose-500 border-rose-500/30' :
                          'bg-amber-500/10 text-amber-500 border-amber-500/30'
                        }`}>
                          {p.computedStatus}
                        </Badge>
                      </td>
                      <td className="p-4 text-right space-x-1 whitespace-nowrap">
                        {p.saldoPendiente > 0 && (
                          <Button 
                            size="sm" 
                            onClick={() => handleOpenPaymentModal(p)} 
                            className="bg-amber-600 hover:bg-amber-700 text-white h-8 text-[11px] font-bold rounded-lg shadow-sm"
                          >
                            <PlusCircle size={13} className="mr-1" /> Registrar Pago
                          </Button>
                        )}
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => { setHistoryPurchase(p); setIsHistoryModalOpen(true); }}
                          className="h-8 text-[11px] font-bold rounded-lg"
                        >
                          <History size={13} className="mr-1" /> Historial
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {filteredPurchases.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-slate-400 font-medium">
                        No hay cuentas por pagar registradas en la categoría seleccionada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL REGISTRAR PAGO A PROVEEDOR */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="sm:max-w-md bg-card rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-black uppercase text-base">
              <PlusCircle className="text-amber-500" size={18} />
              Registrar Pago a Proveedor
            </DialogTitle>
            <DialogDescription className="text-xs">
              Compra N°: <span className="font-bold text-foreground">{selectedPurchase?.order_id}</span> | Proveedor: <span className="font-bold text-foreground">{selectedPurchase?.suppliers?.name}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex justify-between items-center">
              <span className="text-xs font-bold text-amber-400 uppercase">Saldo Pendiente a Pagar:</span>
              <span className="text-lg font-black text-amber-400">${selectedPurchase?.saldoPendiente.toFixed(2)}</span>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase">Monto del Pago ($)</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={paymentAmount}
                onChange={e => setPaymentAmount(e.target.value)}
                className="h-10 text-base font-bold bg-background rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase">Forma de Pago</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="h-10 rounded-xl text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Transferencia">Transferencia bancaria</SelectItem>
                    <SelectItem value="Cheque">Cheque</SelectItem>
                    <SelectItem value="Efectivo">Efectivo</SelectItem>
                    <SelectItem value="Quedan">Vincular a Quedan</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase">N° Referencia / Voche</Label>
                <Input
                  placeholder="Ej. TRF-88192"
                  value={paymentRef}
                  onChange={e => setPaymentRef(e.target.value)}
                  className="h-10 text-xs rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase">Observaciones</Label>
              <Input
                placeholder="Notas adicionales..."
                value={paymentNotes}
                onChange={e => setPaymentNotes(e.target.value)}
                className="h-10 text-xs rounded-xl"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setIsPaymentModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSavePayment} disabled={isSavingPayment} className="bg-amber-600 hover:bg-amber-700 font-bold rounded-xl text-white">
              {isSavingPayment ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
              GUARDAR PAGO
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL HISTORIAL DE PAGOS DE COMPRAS */}
      <Dialog open={isHistoryModalOpen} onOpenChange={setIsHistoryModalOpen}>
        <DialogContent className="sm:max-w-lg bg-card rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-black uppercase text-base">
              <History className="text-amber-500" size={18} />
              Historial de Pagos Emitidos
            </DialogTitle>
            <DialogDescription className="text-xs">
              Compra {historyPurchase?.order_id} | Saldo: ${historyPurchase?.saldoPendiente.toFixed(2)}
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-3">
            {paymentsMap[historyPurchase?.id || '']?.length > 0 ? (
              <div className="border rounded-xl overflow-hidden text-xs">
                <table className="w-full">
                  <thead className="bg-slate-100 dark:bg-white/5 border-b">
                    <tr className="text-left font-bold text-slate-500">
                      <th className="p-2.5">Fecha</th>
                      <th className="p-2.5">Método</th>
                      <th className="p-2.5">Referencia</th>
                      <th className="p-2.5 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentsMap[historyPurchase?.id || ''].map((p: any) => (
                      <tr key={p.id} className="border-b last:border-0">
                        <td className="p-2.5 font-medium">{new Date(p.created_at).toLocaleDateString()}</td>
                        <td className="p-2.5">{p.payment_method}</td>
                        <td className="p-2.5 text-slate-400">{p.reference || '-'}</td>
                        <td className="p-2.5 text-right font-black text-amber-500">${parseFloat(p.amount).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs font-medium">
                No hay pagos registrados para esta compra.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setIsHistoryModalOpen(false)} className="rounded-xl font-bold">Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
