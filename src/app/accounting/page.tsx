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
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 transition-colors duration-300">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="rounded-full bg-white shadow-sm" onClick={() => router.push('/')}>
            <ArrowLeft className="text-slate-600" size={20} />
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 font-headline">Contabilidad y Finanzas</h1>
            <p className="text-slate-500 text-xs md:text-sm">Estado de resultados, libro diario y balance fiscal</p>
          </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Button variant="outline" className="flex-1 md:flex-none rounded-xl border-slate-200 bg-white text-xs h-10">
            <Download size={14} className="mr-1 md:mr-2" /> Reporte
          </Button>
          <Button className="flex-1 md:flex-none bg-blue-600 rounded-xl text-xs h-10" onClick={() => setIsJournalModalOpen(true)}>
            <Plus size={14} className="mr-1 md:mr-2" /> Nuevo Asiento
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-6">
        {/* KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <Card className="border-none shadow-sm rounded-3xl bg-white p-5 md:p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><TrendingUp size={18} /></div>
              <Badge variant="outline" className="text-[8px] md:text-[10px] text-emerald-600 border-emerald-100">+12%</Badge>
            </div>
            <p className="text-[8px] md:text-[10px] font-black uppercase text-slate-400 tracking-widest">Ingresos Totales</p>
            <p className="text-xl md:text-2xl font-black text-slate-900">${(totalSales + totalManualIncome).toLocaleString()}</p>
          </Card>

          <Card className="border-none shadow-sm rounded-3xl bg-white p-5 md:p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-rose-50 text-rose-600 rounded-xl"><TrendingDown size={18} /></div>
              <Badge variant="outline" className="text-[8px] md:text-[10px] text-rose-600 border-rose-100">Egresos</Badge>
            </div>
            <p className="text-[8px] md:text-[10px] font-black uppercase text-slate-400 tracking-widest">Costos Consolidados</p>
            <p className="text-xl md:text-2xl font-black text-slate-900">${totalExpenses.toLocaleString()}</p>
          </Card>

          <Card className={`border-none shadow-sm rounded-3xl p-5 md:p-6 ${grossProfit >= 0 ? 'bg-blue-600 text-white' : 'bg-rose-600 text-white'}`}>
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-white/10 rounded-xl"><Scale size={18} /></div>
              <Badge variant="outline" className="text-[8px] md:text-[10px] text-white border-white/20">Bruta</Badge>
            </div>
            <p className="text-[8px] md:text-[10px] font-black uppercase opacity-60 tracking-widest">Utilidad Estimada</p>
            <p className="text-xl md:text-2xl font-black">${grossProfit.toLocaleString()}</p>
          </Card>

          <Card className="border-none shadow-sm rounded-3xl bg-slate-900 p-5 md:p-6 text-white">
            <div className="flex justify-between items-start mb-4">
              <div className="p-2 bg-white/10 rounded-xl"><Calculator size={18} /></div>
              <Badge variant="outline" className="text-[8px] md:text-[10px] text-blue-400 border-blue-400">13%</Badge>
            </div>
            <p className="text-[8px] md:text-[10px] font-black uppercase opacity-60 tracking-widest">Balance IVA</p>
            <p className="text-xl md:text-2xl font-black">${taxBalance.toLocaleString()}</p>
          </Card>
        </div>

        <Tabs defaultValue="diario" className="space-y-6">
          <TabsList className="bg-white p-1 rounded-2xl shadow-sm border border-slate-100 flex-wrap h-auto w-full justify-start overflow-x-auto no-scrollbar">
            <TabsTrigger value="diario" className="rounded-xl px-4 md:px-8 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs md:text-sm whitespace-nowrap">
              <FileText size={14} className="mr-2"/> Libro Diario
            </TabsTrigger>
            <TabsTrigger value="pnl" className="rounded-xl px-4 md:px-8 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs md:text-sm whitespace-nowrap">
              <BarChart3 size={14} className="mr-2"/> Resultados
            </TabsTrigger>
            <TabsTrigger value="tax" className="rounded-xl px-4 md:px-8 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs md:text-sm whitespace-nowrap">
              <Scale size={14} className="mr-2"/> Fiscal
            </TabsTrigger>
          </TabsList>

          <TabsContent value="diario" className="space-y-4 outline-none">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
               <h3 className="text-base md:text-lg font-bold">Movimientos Contables</h3>
               <div className="relative w-full sm:w-64">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                 <Input placeholder="Filtrar movimientos..." className="pl-9 h-9 text-xs bg-white rounded-xl" />
               </div>
            </div>
            <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="px-4 md:px-6 text-[10px]">Fecha</TableHead>
                      <TableHead className="text-[10px]">Descripción</TableHead>
                      <TableHead className="text-[10px]">Origen</TableHead>
                      <TableHead className="text-[10px]">Tipo</TableHead>
                      <TableHead className="text-right px-4 md:px-6 text-[10px]">Monto</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {journal?.length === 0 && sales?.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center py-12 text-slate-400 text-xs italic">No hay registros hoy</TableCell></TableRow>
                    )}
                    {journal?.map((entry: any) => (
                      <TableRow key={entry.id}>
                        <TableCell className="px-4 md:px-6 text-[10px] text-slate-500 whitespace-nowrap">{new Date(entry.timestamp).toLocaleDateString()}</TableCell>
                        <TableCell className="font-bold text-[10px] max-w-[150px] truncate">{entry.description}</TableCell>
                        <TableCell className="text-[9px] uppercase font-bold text-slate-400">{entry.account}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[8px] font-black h-5 ${entry.type === 'Ingreso' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                            {entry.type}
                          </Badge>
                        </TableCell>
                        <TableCell className={`text-right px-4 md:px-6 font-black text-[10px] whitespace-nowrap ${entry.type === 'Ingreso' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {entry.type === 'Ingreso' ? '+' : '-'}${entry.amount.toFixed(2)}
                        </TableCell>
                        <TableCell className="px-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-300 hover:text-rose-500" onClick={() => handleDeleteEntry(entry.id)}>
                            <Trash2 size={12} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Automatic Sync from Sales (Sample) */}
                    {sales?.slice(0, 3).map((sale: any) => (
                      <TableRow key={sale.id} className="opacity-70 bg-slate-50/30">
                        <TableCell className="px-4 md:px-6 text-[10px] whitespace-nowrap">{new Date(sale.timestamp).toLocaleDateString()}</TableCell>
                        <TableCell className="text-[10px] italic max-w-[150px] truncate">Venta: {sale.customer}</TableCell>
                        <TableCell className="text-[9px] uppercase font-bold text-slate-400">Ventas (Auto)</TableCell>
                        <TableCell><Badge variant="outline" className="text-[8px] bg-blue-50 text-blue-600 border-blue-100 h-5">INGRESO</Badge></TableCell>
                        <TableCell className="text-right px-4 md:px-6 font-black text-emerald-600 text-[10px] whitespace-nowrap">+${sale.total.toFixed(2)}</TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="pnl" className="space-y-6 outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
              <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden p-6 md:p-8 space-y-6 md:space-y-8">
                <h3 className="text-lg md:text-xl font-bold border-b pb-4">Estructura de Resultados</h3>
                <div className="space-y-4 md:space-y-6">
                  <div className="flex justify-between items-center text-xs md:text-sm">
                    <span className="text-slate-500 font-bold uppercase text-[9px] md:text-[10px]">Ingresos Operativos</span>
                    <span className="font-black text-emerald-600">${totalSales.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs md:text-sm">
                    <span className="text-slate-500 font-bold uppercase text-[9px] md:text-[10px]">Otros Ingresos</span>
                    <span className="font-black text-emerald-600">${totalManualIncome.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs md:text-sm border-t pt-4">
                    <span className="text-slate-900 font-black uppercase text-[10px] md:text-xs">Bruto Total</span>
                    <span className="font-black text-emerald-700 text-base md:text-lg">${(totalSales + totalManualIncome).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs md:text-sm pt-2">
                    <span className="text-slate-500 font-bold uppercase text-[9px] md:text-[10px]">Egresos / Gastos</span>
                    <span className="font-black text-rose-500">-${totalExpenses.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-lg md:text-xl font-black border-t border-slate-900 pt-4 md:pt-6 mt-4 md:mt-6">
                    <span className="uppercase text-[10px] md:text-sm tracking-tighter">UTILIDAD NETA</span>
                    <span className={grossProfit >= 0 ? 'text-blue-600' : 'text-rose-600'}>${grossProfit.toLocaleString()}</span>
                  </div>
                </div>
              </Card>

              <div className="space-y-4 md:space-y-6">
                <Card className="border-none shadow-sm rounded-3xl bg-slate-900 text-white p-6 md:p-8">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 bg-white/10 rounded-2xl"><PieChart size={20} md-size={24} /></div>
                    <div>
                      <h4 className="font-bold text-sm md:text-base">Análisis de Margen</h4>
                      <p className="text-white/60 text-[10px] md:text-xs">Rentabilidad sobre ventas</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] md:text-xs mb-1">
                      <span>Margen Bruto</span>
                      <span className="font-bold">{((grossProfit / (totalSales || 1)) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="h-2 md:h-3 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-400 transition-all duration-1000" 
                        style={{ width: `${Math.min(100, Math.max(0, (grossProfit / (totalSales || 1)) * 100))}%` }} 
                      />
                    </div>
                  </div>
                </Card>

                <div className="bg-blue-50 border border-blue-100 p-4 md:p-6 rounded-3xl flex items-start gap-3 md:gap-4">
                  <div className="p-2 bg-blue-600 text-white rounded-xl flex-shrink-0"><TrendingUp size={18} md-size={20} /></div>
                  <div className="space-y-1">
                    <h4 className="text-xs md:text-sm font-bold text-blue-900">NexWay Insights</h4>
                    <p className="text-[10px] md:text-xs text-blue-700 leading-relaxed">
                      Considera optimizar los costos de logística local para aumentar el margen neto en un 3% el próximo trimestre.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="tax" className="space-y-6 outline-none">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                <Card className="border-none shadow-sm rounded-3xl bg-white p-6 md:p-8 space-y-4 md:space-y-6">
                   <h3 className="text-base md:text-lg font-bold flex items-center gap-2">
                     <TrendingUp className="text-emerald-500" size={18} /> Débito Fiscal
                   </h3>
                   <div className="space-y-4">
                      <div className="flex justify-between items-center text-xs md:text-sm">
                        <span className="text-slate-500">Monto Gravado Ventas</span>
                        <span className="font-black">${totalSales.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs md:text-sm border-t pt-4">
                        <span className="text-slate-900 font-bold">IVA DEBITO (13%)</span>
                        <span className="font-black text-emerald-600 text-base md:text-lg">${debitFiscal.toLocaleString()}</span>
                      </div>
                   </div>
                </Card>

                <Card className="border-none shadow-sm rounded-3xl bg-white p-6 md:p-8 space-y-4 md:space-y-6">
                   <h3 className="text-base md:text-lg font-bold flex items-center gap-2">
                     <TrendingDown className="text-rose-500" size={18} /> Crédito Fiscal
                   </h3>
                   <div className="space-y-4">
                      <div className="flex justify-between items-center text-xs md:text-sm">
                        <span className="text-slate-500">Gravado Compras/Gastos</span>
                        <span className="font-black">${totalExpenses.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs md:text-sm border-t pt-4">
                        <span className="text-slate-900 font-bold">IVA CREDITO (13%)</span>
                        <span className="font-black text-rose-600 text-base md:text-lg">${creditFiscal.toLocaleString()}</span>
                      </div>
                   </div>
                </Card>
             </div>

             <Card className="border-none shadow-xl rounded-3xl bg-slate-900 text-white p-6 md:p-10 overflow-hidden relative">
                <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 md:gap-8">
                  <div className="space-y-2">
                    <p className="text-[8px] md:text-[10px] font-black uppercase text-blue-400 tracking-widest">Balance Tributario Sugerido</p>
                    <h2 className="text-2xl md:text-3xl font-black">
                      {taxBalance >= 0 ? `A Pagar: $${taxBalance.toLocaleString()}` : `Remanente: $${Math.abs(taxBalance).toLocaleString()}`}
                    </h2>
                    <p className="text-[10px] md:text-sm opacity-60 max-w-md">
                      Cálculo estimativo basado en IVA del 13%. Concilie retenciones y percepciones antes de declarar.
                    </p>
                  </div>
                  <Button variant="outline" className="w-full lg:w-auto rounded-xl border-white/20 bg-white/10 text-white hover:bg-white hover:text-slate-900 h-12 px-8 font-bold text-xs">
                     EXPORTAR F910
                  </Button>
                </div>
                <div className="absolute top-0 right-0 w-48 md:w-64 h-48 md:h-64 bg-blue-600/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
             </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Manual Entry Modal - Responsive */}
      <Dialog open={isJournalModalOpen} onOpenChange={setIsJournalModalOpen}>
        <DialogContent className="rounded-2xl md:rounded-3xl max-w-[90vw] md:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base md:text-lg font-bold flex items-center gap-2">
               <PlusCircle className="text-blue-600" /> Nuevo Asiento Manual
            </DialogTitle>
            <DialogDescription className="text-xs">Use esto para ajustes de planilla, alquiler o servicios.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 md:py-4">
            <div className="space-y-2">
               <Label className="text-[9px] md:text-[10px] font-bold uppercase text-slate-400">Descripción</Label>
               <Input 
                 placeholder="Ej. Pago de Alquiler..." 
                 value={newEntry.description} 
                 onChange={e => setNewEntry({...newEntry, description: e.target.value})}
                 className="rounded-xl text-xs"
               />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                 <Label className="text-[9px] md:text-[10px] font-bold uppercase text-slate-400">Monto ($)</Label>
                 <Input 
                   type="number" 
                   placeholder="0.00" 
                   value={newEntry.amount} 
                   onChange={e => setNewEntry({...newEntry, amount: e.target.value})}
                   className="rounded-xl font-bold text-xs"
                 />
              </div>
              <div className="space-y-2">
                 <Label className="text-[9px] md:text-[10px] font-bold uppercase text-slate-400">Tipo</Label>
                 <Select value={newEntry.type} onValueChange={(v) => setNewEntry({...newEntry, type: v})}>
                    <SelectTrigger className="h-10 rounded-xl text-xs">
                       <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                       <SelectItem value="Ingreso" className="text-xs">Ingreso</SelectItem>
                       <SelectItem value="Egreso" className="text-xs">Egreso</SelectItem>
                    </SelectContent>
                 </Select>
              </div>
            </div>
            <div className="space-y-2">
               <Label className="text-[9px] md:text-[10px] font-bold uppercase text-slate-400">Cuenta</Label>
               <Select value={newEntry.account} onValueChange={(v) => setNewEntry({...newEntry, account: v})}>
                  <SelectTrigger className="h-10 rounded-xl text-xs">
                     <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                     <SelectItem value="Gastos Administrativos" className="text-xs">Gastos Administrativos</SelectItem>
                     <SelectItem value="Planilla / Sueldos" className="text-xs">Planilla / Sueldos</SelectItem>
                     <SelectItem value="Mantenimiento" className="text-xs">Mantenimiento</SelectItem>
                     <SelectItem value="Servicios Básicos" className="text-xs">Servicios Básicos</SelectItem>
                  </SelectContent>
               </Select>
            </div>
          </div>
          <DialogFooter>
            <Button className="w-full bg-blue-600 text-white font-bold h-11 md:h-12 rounded-xl shadow-lg text-xs" onClick={handleAddJournalEntry}>
               REGISTRAR MOVIMIENTO
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}