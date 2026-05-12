
'use client';

import React, { useMemo, useState } from 'react';
import { 
  BarChart3, 
  ArrowLeft, 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  Scale, 
  Calendar, 
  Download,
  FileText,
  Search,
  PieChart,
  Calculator,
  ArrowRightLeft,
  PlusCircle,
  Loader2,
  Trash2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFirestore, useCollection } from '@/firebase';
import { collection, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRouter } from 'next/navigation';

export default function AccountingPage() {
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  
  // Data Fetching
  const salesRef = useMemo(() => collection(db, 'sales'), [db]);
  const expensesRef = useMemo(() => collection(db, 'expenses'), [db]);
  const journalRef = useMemo(() => collection(db, 'journal'), [db]);
  const purchasesRef = useMemo(() => collection(db, 'purchases'), [db]);

  const { data: sales, loading: loadingSales } = useCollection<any>(salesRef);
  const { data: expenses, loading: loadingExpenses } = useCollection<any>(expensesRef);
  const { data: journal, loading: loadingJournal } = useCollection<any>(journalRef);
  const { data: purchases, loading: loadingPurchases } = useCollection<any>(purchasesRef);

  // States
  const [isJournalModalOpen, setIsJournalModalOpen] = useState(false);
  const [newEntry, setNewEntry] = useState({
    description: '',
    amount: '',
    type: 'Egreso',
    account: 'Gastos Administrativos'
  });

  // Calculations
  const totalSales = useMemo(() => 
    sales?.filter(s => s.status !== 'CANCELADA').reduce((acc, s) => acc + (s.total || 0), 0) || 0, [sales]
  );

  const totalExpenses = useMemo(() => {
    const cashExpenses = expenses?.reduce((acc, e) => acc + (e.amount || 0), 0) || 0;
    const purchaseExpenses = purchases?.filter(p => p.status === 'CERRADA').reduce((acc, p) => acc + (p.total || 0), 0) || 0;
    const manualExpenses = journal?.filter(j => j.type === 'Egreso').reduce((acc, j) => acc + (j.amount || 0), 0) || 0;
    return cashExpenses + purchaseExpenses + manualExpenses;
  }, [expenses, purchases, journal]);

  const totalManualIncome = useMemo(() => 
    journal?.filter(j => j.type === 'Ingreso').reduce((acc, j) => acc + (j.amount || 0), 0) || 0, [journal]
  );

  const grossProfit = (totalSales + totalManualIncome) - totalExpenses;

  const handleAddJournalEntry = async () => {
    if (!newEntry.description || !newEntry.amount) return;
    try {
      await addDoc(journalRef, {
        ...newEntry,
        amount: parseFloat(newEntry.amount),
        timestamp: new Date().toISOString()
      });
      toast({ title: "Asiento Contable Registrado", description: "Se ha guardado el movimiento en el libro diario." });
      setNewEntry({ description: '', amount: '', type: 'Egreso', account: 'Gastos Administrativos' });
      setIsJournalModalOpen(false);
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo registrar el movimiento." });
    }
  };

  const handleDeleteEntry = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'journal', id));
      toast({ title: "Registro Eliminado", description: "El asiento contable ha sido removido." });
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar el registro." });
    }
  };

  // Tax Summary (IVA 13%)
  const debitFiscal = totalSales * 0.13; // IVA de ventas
  const creditFiscal = totalExpenses * 0.13; // IVA de compras (estimado)
  const taxBalance = debitFiscal - creditFiscal;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="rounded-full bg-white shadow-sm" onClick={() => router.push('/')}>
            <ArrowLeft className="text-slate-600" size={20} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 font-headline">Contabilidad y Finanzas</h1>
            <p className="text-slate-500 text-sm">Estado de resultados, libro diario y balance fiscal</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="rounded-xl border-slate-200 bg-white">
            <Download size={16} className="mr-2" /> Reporte Anual
          </Button>
          <Button className="bg-blue-600 rounded-xl" onClick={() => setIsJournalModalOpen(true)}>
            <Plus size={16} className="mr-2" /> Nuevo Asiento
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-6">
        {/* KPI Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-none shadow-sm rounded-3xl bg-white p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><TrendingUp size={20} /></div>
              <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-100">+12% vs mes ant.</Badge>
            </div>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Ingresos Totales</p>
            <p className="text-2xl font-black text-slate-900">${(totalSales + totalManualIncome).toLocaleString()}</p>
          </Card>

          <Card className="border-none shadow-sm rounded-3xl bg-white p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-rose-50 text-rose-600 rounded-xl"><TrendingDown size={20} /></div>
              <Badge variant="outline" className="text-[10px] text-rose-600 border-rose-100">Costos Operativos</Badge>
            </div>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Egresos Consolidados</p>
            <p className="text-2xl font-black text-slate-900">${totalExpenses.toLocaleString()}</p>
          </Card>

          <Card className={`border-none shadow-sm rounded-3xl p-6 ${grossProfit >= 0 ? 'bg-blue-600 text-white' : 'bg-rose-600 text-white'}`}>
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-white/10 rounded-xl"><Scale size={20} /></div>
              <Badge variant="outline" className="text-[10px] text-white border-white/20">Utilidad Bruta</Badge>
            </div>
            <p className="text-[10px] font-black uppercase opacity-60 tracking-widest">Resultado de Ejercicio</p>
            <p className="text-2xl font-black">${grossProfit.toLocaleString()}</p>
          </Card>

          <Card className="border-none shadow-sm rounded-3xl bg-slate-900 p-6 text-white">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-white/10 rounded-xl"><Calculator size={20} /></div>
              <Badge variant="outline" className="text-[10px] text-blue-400 border-blue-400">IVA 13%</Badge>
            </div>
            <p className="text-[10px] font-black uppercase opacity-60 tracking-widest">Balance Fiscal Estimado</p>
            <p className="text-2xl font-black">${taxBalance.toLocaleString()}</p>
          </Card>
        </div>

        <Tabs defaultValue="diario" className="space-y-6">
          <TabsList className="bg-white p-1 rounded-2xl shadow-sm border border-slate-100 flex-wrap h-auto">
            <TabsTrigger value="diario" className="rounded-xl px-8 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <FileText size={14} className="mr-2"/> Libro Diario
            </TabsTrigger>
            <TabsTrigger value="pnl" className="rounded-xl px-8 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <BarChart3 size={14} className="mr-2"/> Estado de Resultados
            </TabsTrigger>
            <TabsTrigger value="tax" className="rounded-xl px-8 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Scale size={14} className="mr-2"/> Resumen Fiscal
            </TabsTrigger>
          </TabsList>

          <TabsContent value="diario" className="space-y-4 outline-none">
            <div className="flex justify-between items-center">
               <h3 className="text-lg font-bold">Movimientos Contables</h3>
               <div className="relative w-64">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                 <Input placeholder="Filtrar movimientos..." className="pl-9 h-9 text-xs bg-white rounded-xl" />
               </div>
            </div>
            <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="px-6">Fecha</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Cuenta / Origen</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right px-6">Monto</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {journal?.map((entry: any) => (
                    <TableRow key={entry.id}>
                      <TableCell className="px-6 text-xs text-slate-500">{new Date(entry.timestamp).toLocaleDateString()}</TableCell>
                      <TableCell className="font-bold text-xs">{entry.description}</TableCell>
                      <TableCell className="text-[10px] uppercase font-bold text-slate-400">{entry.account}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[9px] font-black ${entry.type === 'Ingreso' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                          {entry.type}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right px-6 font-black ${entry.type === 'Ingreso' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {entry.type === 'Ingreso' ? '+' : '-'}${entry.amount.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-300 hover:text-rose-500" onClick={() => handleDeleteEntry(entry.id)}>
                          <Trash2 size={14} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Automatic Sync from Sales */}
                  {sales?.slice(0, 5).map((sale: any) => (
                    <TableRow key={sale.id} className="opacity-70 bg-slate-50/30">
                      <TableCell className="px-6 text-xs">{new Date(sale.timestamp).toLocaleDateString()}</TableCell>
                      <TableCell className="text-xs italic">Venta: {sale.customer}</TableCell>
                      <TableCell className="text-[10px] uppercase font-bold text-slate-400">Ventas (Auto)</TableCell>
                      <TableCell><Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-600 border-blue-100">INGRESO</Badge></TableCell>
                      <TableCell className="text-right px-6 font-black text-emerald-600">+${sale.total.toFixed(2)}</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="pnl" className="space-y-6 outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden p-8 space-y-8">
                <h3 className="text-xl font-bold border-b pb-4">Estructura de Resultados</h3>
                <div className="space-y-6">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-bold uppercase text-[10px]">Ingresos Operativos (Ventas)</span>
                    <span className="font-black text-emerald-600">${totalSales.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-bold uppercase text-[10px]">Otros Ingresos</span>
                    <span className="font-black text-emerald-600">${totalManualIncome.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-t pt-4">
                    <span className="text-slate-900 font-black uppercase text-xs">Total Ingresos Brutos</span>
                    <span className="font-black text-emerald-700 text-lg">${(totalSales + totalManualIncome).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm pt-4">
                    <span className="text-slate-500 font-bold uppercase text-[10px]">Costos de Venta (Compras stock)</span>
                    <span className="font-black text-rose-500">-${purchases?.filter(p => p.status === 'CERRADA').reduce((acc, p) => acc + p.total, 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-bold uppercase text-[10px]">Gastos Administrativos / Caja</span>
                    <span className="font-black text-rose-500">-${(expenses?.reduce((acc, e) => acc + e.amount, 0) + journal?.filter(j => j.type === 'Egreso').reduce((acc, j) => acc + j.amount, 0)).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-xl font-black border-t border-slate-900 pt-6 mt-6">
                    <span className="uppercase text-sm tracking-tighter">UTILIDAD NETA DEL EJERCICIO</span>
                    <span className={grossProfit >= 0 ? 'text-blue-600' : 'text-rose-600'}>${grossProfit.toLocaleString()}</span>
                  </div>
                </div>
              </Card>

              <div className="space-y-6">
                <Card className="border-none shadow-sm rounded-3xl bg-slate-900 text-white p-8">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 bg-white/10 rounded-2xl"><PieChart size={24} /></div>
                    <div>
                      <h4 className="font-bold">Análisis de Margen</h4>
                      <p className="text-white/60 text-xs">Rendimiento porcentual sobre ventas</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs mb-1">
                      <span>Margen Bruto</span>
                      <span className="font-bold">{((grossProfit / (totalSales || 1)) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-400 transition-all duration-1000" 
                        style={{ width: `${Math.min(100, Math.max(0, (grossProfit / (totalSales || 1)) * 100))}%` }} 
                      />
                    </div>
                  </div>
                </Card>

                <div className="bg-blue-50 border border-blue-100 p-6 rounded-3xl flex items-start gap-4">
                  <div className="p-2 bg-blue-600 text-white rounded-xl"><TrendingUp size={20} /></div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-blue-900">NexWay Insights</h4>
                    <p className="text-xs text-blue-700 leading-relaxed">
                      Tus ventas institucionales representan el 45% de tus ingresos totales este mes. Considera optimizar los costos de logística local para aumentar el margen neto en un 3%.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="tax" className="space-y-6 outline-none">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card className="border-none shadow-sm rounded-3xl bg-white p-8 space-y-6">
                   <h3 className="text-lg font-bold flex items-center gap-2">
                     <TrendingUp className="text-emerald-500" /> Débito Fiscal (IVA Ventas)
                   </h3>
                   <div className="space-y-4">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500">Monto Gravado Ventas</span>
                        <span className="font-black">${totalSales.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm border-t pt-4">
                        <span className="text-slate-900 font-bold">IVA DEBITO (13%)</span>
                        <span className="font-black text-emerald-600 text-lg">${debitFiscal.toLocaleString()}</span>
                      </div>
                   </div>
                </Card>

                <Card className="border-none shadow-sm rounded-3xl bg-white p-8 space-y-6">
                   <h3 className="text-lg font-bold flex items-center gap-2">
                     <TrendingDown className="text-rose-500" /> Crédito Fiscal (IVA Compras)
                   </h3>
                   <div className="space-y-4">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500">Monto Gravado Compras/Gastos</span>
                        <span className="font-black">${totalExpenses.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm border-t pt-4">
                        <span className="text-slate-900 font-bold">IVA CREDITO (13%)</span>
                        <span className="font-black text-rose-600 text-lg">${creditFiscal.toLocaleString()}</span>
                      </div>
                   </div>
                </Card>
             </div>

             <Card className="border-none shadow-xl rounded-3xl bg-slate-900 text-white p-10 overflow-hidden relative">
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase text-blue-400 tracking-widest">Balance Tributario Sugerido</p>
                    <h2 className="text-3xl font-black">
                      {taxBalance >= 0 ? `Total a Pagar: $${taxBalance.toLocaleString()}` : `Remanente: $${Math.abs(taxBalance).toLocaleString()}`}
                    </h2>
                    <p className="text-sm opacity-60 max-w-md">
                      Este cálculo es una estimación basada en el IVA del 13%. Recuerde conciliar sus retenciones y percepciones del 1% antes de declarar.
                    </p>
                  </div>
                  <div className="flex gap-4">
                    <Button variant="outline" className="rounded-xl border-white/20 bg-white/10 text-white hover:bg-white hover:text-slate-900 h-12 px-8 font-bold">
                       EXPORTAR F910
                    </Button>
                  </div>
                </div>
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
             </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Manual Entry Modal */}
      <Dialog open={isJournalModalOpen} onOpenChange={setIsJournalModalOpen}>
        <DialogContent className="rounded-3xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
               <PlusCircle className="text-blue-600" /> Nuevo Asiento Manual
            </DialogTitle>
            <DialogDescription>Use esto para ajustes de planilla, alquiler o servicios.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
               <Label className="text-[10px] font-bold uppercase text-slate-400">Descripción del Movimiento</Label>
               <Input 
                 placeholder="Ej. Pago de Alquiler Local..." 
                 value={newEntry.description} 
                 onChange={e => setNewEntry({...newEntry, description: e.target.value})}
                 className="rounded-xl"
               />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                 <Label className="text-[10px] font-bold uppercase text-slate-400">Monto ($)</Label>
                 <Input 
                   type="number" 
                   placeholder="0.00" 
                   value={newEntry.amount} 
                   onChange={e => setNewEntry({...newEntry, amount: e.target.value})}
                   className="rounded-xl font-bold"
                 />
              </div>
              <div className="space-y-2">
                 <Label className="text-[10px] font-bold uppercase text-slate-400">Tipo</Label>
                 <Select value={newEntry.type} onValueChange={(v) => setNewEntry({...newEntry, type: v})}>
                    <SelectTrigger className="h-10 rounded-xl">
                       <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                       <SelectItem value="Ingreso">Ingreso</SelectItem>
                       <SelectItem value="Egreso">Egreso</SelectItem>
                    </SelectContent>
                 </Select>
              </div>
            </div>
            <div className="space-y-2">
               <Label className="text-[10px] font-bold uppercase text-slate-400">Cuenta Contable</Label>
               <Select value={newEntry.account} onValueChange={(v) => setNewEntry({...newEntry, account: v})}>
                  <SelectTrigger className="h-10 rounded-xl">
                     <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                     <SelectItem value="Gastos Administrativos">Gastos Administrativos</SelectItem>
                     <SelectItem value="Planilla / Sueldos">Planilla / Sueldos</SelectItem>
                     <SelectItem value="Mantenimiento">Mantenimiento</SelectItem>
                     <SelectItem value="Servicios Básicos">Servicios Básicos</SelectItem>
                     <SelectItem value="Ajuste de Inventario">Ajuste de Inventario</SelectItem>
                  </SelectContent>
               </Select>
            </div>
          </div>
          <DialogFooter>
            <Button className="w-full bg-blue-600 text-white font-bold h-12 rounded-xl shadow-lg" onClick={handleAddJournalEntry}>
               REGISTRAR MOVIMIENTO
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
