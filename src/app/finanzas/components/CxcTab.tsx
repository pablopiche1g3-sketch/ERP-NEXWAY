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
  History
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export default function CxcTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [salesCredit, setSalesCredit] = useState<any[]>([]);
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

  // Modal de Historial
  const [historySale, setHistorySale] = useState<any | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Obtener ventas cuyo pago fue Crédito o estado es Crédito
      const { data: sales, error } = await supabase
        .from('sales')
        .select('*, customers(name, phone, email, credit_limit)')
        .or('payment_method.ilike.%credito%,type.ilike.%credito%')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const creditSalesList = sales || [];

      // 2. Obtener abonos
      const { data: cxcPayments } = await supabase.from('cxc_payments').select('*');
      
      const pMap: Record<string, any[]> = {};
      (cxcPayments || []).forEach((p: any) => {
        if (!pMap[p.sale_id]) pMap[p.sale_id] = [];
        pMap[p.sale_id].push(p);
      });

      setPaymentsMap(pMap);
      setSalesCredit(creditSalesList);
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

    const createdAt = new Date(s.created_at);
    // Asumimos 30 días de crédito por defecto si no especificado
    const dueDate = new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000);
    const isOverdue = saldoPendiente > 0 && new Date() > dueDate;
    const isPaid = saldoPendiente <= 0.01;

    let computedStatus: 'PAGADO' | 'VENCIDO' | 'PENDIENTE' = 'PENDIENTE';
    if (isPaid) computedStatus = 'PAGADO';
    else if (isOverdue) computedStatus = 'VENCIDO';

    return {
      ...s,
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
    setAbonoAmount('');
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
      toast({ variant: 'destructive', title: 'Exceso de Abono', description: `El abono ($${val}) supera el saldo pendiente ($${selectedSale.saldoPendiente.toFixed(2)}).` });
      return;
    }

    setIsSavingAbono(true);
    try {
      const { error } = await supabase.from('cxc_payments').insert({
        sale_id: selectedSale.id,
        amount: val,
        payment_method: abonoMethod,
        reference: abonoRef,
        notes: abonoNotes
      });

      if (error) throw error;

      toast({ title: 'Abono Registrado', description: `Se registraron $${val.toFixed(2)} correctamente.` });
      setIsAbonoModalOpen(false);
      await loadData();
    } catch (e: any) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar el abono en la base de datos.' });
    } finally {
      setIsSavingAbono(false);
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-900 border border-slate-800 text-white rounded-2xl p-4 relative overflow-hidden shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cartera Total CXC</p>
              <h3 className="text-2xl font-black mt-1 text-indigo-400">${totalCartera.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
            </div>
            <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-400">
              <DollarSign size={20} />
            </div>
          </div>
          <div className="h-1 bg-indigo-500 w-full absolute bottom-0 left-0" />
        </Card>

        <Card className="bg-slate-900 border border-slate-800 text-white rounded-2xl p-4 relative overflow-hidden shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Saldos Vencidos</p>
              <h3 className="text-2xl font-black mt-1 text-rose-400">${totalVencido.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
            </div>
            <div className="p-2.5 bg-rose-500/10 rounded-xl text-rose-400">
              <AlertTriangle size={20} />
            </div>
          </div>
          <div className="h-1 bg-rose-500 w-full absolute bottom-0 left-0" />
        </Card>

        <Card className="bg-slate-900 border border-slate-800 text-white rounded-2xl p-4 relative overflow-hidden shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Por Vencer (Al Día)</p>
              <h3 className="text-2xl font-black mt-1 text-emerald-400">${totalAlDia.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
            </div>
            <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400">
              <Clock size={20} />
            </div>
          </div>
          <div className="h-1 bg-emerald-500 w-full absolute bottom-0 left-0" />
        </Card>

        <Card className="bg-slate-900 border border-slate-800 text-white rounded-2xl p-4 relative overflow-hidden shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Recaudado</p>
              <h3 className="text-2xl font-black mt-1 text-blue-400">${totalRecaudado.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
            </div>
            <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-400">
              <TrendingUp size={20} />
            </div>
          </div>
          <div className="h-1 bg-blue-500 w-full absolute bottom-0 left-0" />
        </Card>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <Card className="border shadow-md rounded-2xl bg-card">
        <CardHeader className="bg-slate-900 text-white p-5 rounded-t-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <CardTitle className="text-base font-black uppercase tracking-tight flex items-center gap-2">
              <FileText className="text-indigo-400" size={18} />
              Cuentas por Cobrar a Clientes
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs">Gestión y registro de abonos para créditos otorgados.</CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por cliente o DTE..."
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
                <SelectItem value="PENDIENTE">Por Vencer (Al Día)</SelectItem>
                <SelectItem value="VENCIDO">Vencidas</SelectItem>
                <SelectItem value="PAGADO">Pagadas Completas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center p-12"><Loader2 className="animate-spin text-indigo-500" size={32} /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 dark:bg-white/5 border-b border-slate-200 dark:border-white/10">
                  <tr className="text-left text-slate-500 dark:text-slate-400">
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
                    <tr key={s.id} className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                      <td className="p-4 font-bold text-indigo-600 dark:text-indigo-400">
                        {s.correlative || 'SIN-NÚMERO'}
                        <div className="text-[10px] text-slate-400 font-normal">{s.doc_type || 'Crédito'}</div>
                      </td>
                      <td className="p-4 font-semibold text-slate-800 dark:text-slate-200">
                        {s.customer_name || s.customers?.name || 'Cliente Ocasional'}
                        {s.customers?.phone && (
                          <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                            📞 {s.customers.phone}
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-xs">
                        <div className="font-medium text-slate-700 dark:text-slate-300">
                          {new Date(s.created_at).toLocaleDateString()}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Vence: {s.dueDate.toLocaleDateString()}
                        </div>
                      </td>
                      <td className="p-4 text-right font-semibold">${parseFloat(s.total).toFixed(2)}</td>
                      <td className="p-4 text-right font-medium text-emerald-600 dark:text-emerald-400">${s.totalAbonado.toFixed(2)}</td>
                      <td className="p-4 text-right font-black text-slate-900 dark:text-white text-base">
                        ${s.saldoPendiente.toFixed(2)}
                      </td>
                      <td className="p-4 text-center">
                        <Badge className={`font-black text-[10px] uppercase ${
                          s.computedStatus === 'PAGADO' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' :
                          s.computedStatus === 'VENCIDO' ? 'bg-rose-500/10 text-rose-500 border-rose-500/30' :
                          'bg-amber-500/10 text-amber-500 border-amber-500/30'
                        }`}>
                          {s.computedStatus}
                        </Badge>
                      </td>
                      <td className="p-4 text-right space-x-1 whitespace-nowrap">
                        {s.saldoPendiente > 0 && (
                          <Button 
                            size="sm" 
                            onClick={() => handleOpenAbonoModal(s)} 
                            className="bg-indigo-600 hover:bg-indigo-700 h-8 text-[11px] font-bold rounded-lg shadow-sm"
                          >
                            <PlusCircle size={13} className="mr-1" /> Registrar Abono
                          </Button>
                        )}
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => { setHistorySale(s); setIsHistoryModalOpen(true); }}
                          className="h-8 text-[11px] font-bold rounded-lg"
                        >
                          <History size={13} className="mr-1" /> Historial
                        </Button>
                        {s.saldoPendiente > 0 && (
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => sendWhatsappReminder(s)}
                            className="h-8 text-emerald-600 hover:bg-emerald-500/10 rounded-lg px-2"
                            title="Enviar Recordatorio por WhatsApp"
                          >
                            <MessageCircle size={15} />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredSales.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-slate-400 font-medium">
                        No hay cuentas por cobrar registradas en la categoría seleccionada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL REGISTRAR ABONO */}
      <Dialog open={isAbonoModalOpen} onOpenChange={setIsAbonoModalOpen}>
        <DialogContent className="sm:max-w-md bg-card rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-black uppercase text-base">
              <PlusCircle className="text-indigo-500" size={18} />
              Registrar Abono a Crédito
            </DialogTitle>
            <DialogDescription className="text-xs">
              Comprobante: <span className="font-bold text-foreground">{selectedSale?.correlative}</span> | Cliente: <span className="font-bold text-foreground">{selectedSale?.customer_name || selectedSale?.customers?.name}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex justify-between items-center">
              <span className="text-xs font-bold text-indigo-400 uppercase">Saldo Pendiente Actual:</span>
              <span className="text-lg font-black text-indigo-400">${selectedSale?.saldoPendiente.toFixed(2)}</span>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase">Monto a Abonar ($)</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={abonoAmount}
                onChange={e => setAbonoAmount(e.target.value)}
                className="h-10 text-base font-bold bg-background rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase">Método de Pago</Label>
                <Select value={abonoMethod} onValueChange={setAbonoMethod}>
                  <SelectTrigger className="h-10 rounded-xl text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Efectivo">Efectivo</SelectItem>
                    <SelectItem value="Transferencia">Transferencia Bancaria</SelectItem>
                    <SelectItem value="Cheque">Cheque</SelectItem>
                    <SelectItem value="Tarjeta">Tarjeta</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase">N° Referencia / Voche</Label>
                <Input
                  placeholder="Ej. TRANS-90412"
                  value={abonoRef}
                  onChange={e => setAbonoRef(e.target.value)}
                  className="h-10 text-xs rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase">Notas u Observaciones</Label>
              <Input
                placeholder="Opcional..."
                value={abonoNotes}
                onChange={e => setAbonoNotes(e.target.value)}
                className="h-10 text-xs rounded-xl"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setIsAbonoModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveAbono} disabled={isSavingAbono} className="bg-indigo-600 hover:bg-indigo-700 font-bold rounded-xl">
              {isSavingAbono ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
              GUARDAR ABONO
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL HISTORIAL DE ABONOS */}
      <Dialog open={isHistoryModalOpen} onOpenChange={setIsHistoryModalOpen}>
        <DialogContent className="sm:max-w-lg bg-card rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-black uppercase text-base">
              <History className="text-indigo-500" size={18} />
              Historial de Abonos Recibidos
            </DialogTitle>
            <DialogDescription className="text-xs">
              Venta {historySale?.correlative} | Saldo: ${historySale?.saldoPendiente.toFixed(2)}
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-3">
            {paymentsMap[historySale?.id || '']?.length > 0 ? (
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
                    {paymentsMap[historySale?.id || ''].map((p: any) => (
                      <tr key={p.id} className="border-b last:border-0">
                        <td className="p-2.5 font-medium">{new Date(p.created_at).toLocaleDateString()}</td>
                        <td className="p-2.5">{p.payment_method}</td>
                        <td className="p-2.5 text-slate-400">{p.reference || '-'}</td>
                        <td className="p-2.5 text-right font-black text-emerald-500">${parseFloat(p.amount).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs font-medium">
                No hay abonos registrados para esta venta.
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
