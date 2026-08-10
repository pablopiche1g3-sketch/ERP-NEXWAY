'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { supabase } from '@/supabase/client';
import { Loader2, Briefcase, BarChart3, Receipt, FileText } from 'lucide-react';

export default function ProjectDetailsModal({ project, open, onOpenChange, allSales, allPurchases }: any) {
  const [journal, setJournal] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && project?.id) {
      loadProjectJournal(project.id);
    }
  }, [open, project]);

  const loadProjectJournal = async (projectId: string) => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('journal')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      setJournal(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!project) return null;

  const projectSales = (allSales || []).filter((s: any) => s.projectId === project.id && s.status !== 'CANCELADA');
  const projectPurchases = (allPurchases || []).filter((p: any) => p.projectId === project.id);
  
  const totalSales = projectSales.reduce((sum: number, s: any) => sum + (s.total || 0), 0);
  const totalCosts = projectPurchases.reduce((sum: number, p: any) => sum + (p.total || 0), 0);
  
  const operatingExpenses = journal
    .filter(j => j.type === 'Egreso' || j.amount > 0)
    .reduce((sum, j) => sum + (parseFloat(j.amount) || 0), 0);

  const netProfit = totalSales - totalCosts - operatingExpenses;
  const margin = totalSales > 0 ? (netProfit / totalSales) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0 rounded-3xl overflow-hidden bg-slate-50 dark:bg-[#0a0a0a] border-slate-200 dark:border-white/10">
        <DialogHeader className="p-6 bg-slate-900 dark:bg-black text-white border-b border-white/10 shrink-0">
          <DialogTitle className="text-xl md:text-2xl font-black flex items-center gap-2">
            <Briefcase className="text-blue-500" /> {project.name}
          </DialogTitle>
          <DialogDescription className="text-slate-400 font-medium">
            Cliente: {project.customerName} | OC: {project.purchaseOrder || 'S/N'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden p-6">
          <Tabs defaultValue="pnl" className="w-full h-full flex flex-col">
            <TabsList className="bg-slate-200 dark:bg-white/5 h-12 w-full md:w-auto self-start rounded-xl px-2">
              <TabsTrigger value="pnl" className="rounded-lg font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <BarChart3 size={16} className="mr-2"/> Rentabilidad (P&L)
              </TabsTrigger>
              <TabsTrigger value="sales" className="rounded-lg font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">
                <Receipt size={16} className="mr-2"/> Ventas y Facturas
              </TabsTrigger>
              <TabsTrigger value="expenses" className="rounded-lg font-bold data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800">
                <FileText size={16} className="mr-2"/> Viáticos y Gastos
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto mt-6 pr-2">
              <TabsContent value="pnl" className="m-0 outline-none animate-in fade-in zoom-in-95 duration-300">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <Card className="p-4 bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 rounded-2xl shadow-sm">
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Presupuesto Adjudicado</p>
                    <p className="text-2xl font-black text-slate-800 dark:text-white mt-1">${project.totalBudget.toLocaleString()}</p>
                  </Card>
                  <Card className="p-4 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 rounded-2xl shadow-sm">
                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase">Ingresos Facturados</p>
                    <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-1">${totalSales.toLocaleString()}</p>
                  </Card>
                  <Card className="p-4 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 rounded-2xl shadow-sm">
                    <p className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase">Costos Directos y Op.</p>
                    <p className="text-2xl font-black text-rose-700 dark:text-rose-400 mt-1">${(totalCosts + operatingExpenses).toLocaleString()}</p>
                  </Card>
                  <Card className={`p-4 rounded-2xl shadow-sm ${margin > 0 ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20' : 'bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20'}`}>
                    <p className={`text-xs font-bold uppercase ${margin > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>Utilidad Neta</p>
                    <p className={`text-2xl font-black mt-1 ${margin > 0 ? 'text-blue-700 dark:text-blue-400' : 'text-orange-700 dark:text-orange-400'}`}>${netProfit.toLocaleString()} <span className="text-sm font-bold opacity-70">({margin.toFixed(1)}%)</span></p>
                  </Card>
                </div>

                <Card className="bg-white dark:bg-[#111] border-slate-200 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 dark:border-white/10">
                    <h3 className="font-black text-lg">Estado de Resultados Específico</h3>
                  </div>
                  <div className="p-6 space-y-4">
                     <div className="flex justify-between items-center py-2">
                        <span className="font-bold text-sm text-slate-600 dark:text-slate-300">Ventas (Ingresos)</span>
                        <span className="font-black text-emerald-600">${totalSales.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                     </div>
                     <div className="flex justify-between items-center py-2 border-t border-slate-100 dark:border-white/5">
                        <span className="font-bold text-sm text-slate-600 dark:text-slate-300">Costo de Suministros (Directos)</span>
                        <span className="font-black text-rose-500">-${totalCosts.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                     </div>
                     <div className="flex justify-between items-center py-2 border-t border-slate-100 dark:border-white/5">
                        <span className="font-bold text-sm text-slate-600 dark:text-slate-300">Gastos Operativos (Viáticos, Legal, etc.)</span>
                        <span className="font-black text-orange-500">-${operatingExpenses.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                     </div>
                     <div className="flex justify-between items-center py-4 border-t-2 border-slate-200 dark:border-white/10 mt-4">
                        <span className="font-black text-lg">UTILIDAD DEL PROYECTO</span>
                        <span className={`font-black text-xl ${netProfit >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>${netProfit.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                     </div>
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="sales" className="m-0 outline-none">
                <Card className="bg-white dark:bg-[#111] border-slate-200 dark:border-white/10 rounded-2xl shadow-sm p-4">
                   {projectSales.length > 0 ? (
                      <table className="w-full text-sm">
                         <thead className="bg-slate-50 dark:bg-white/5 border-b border-slate-100 dark:border-white/10">
                            <tr>
                               <th className="p-3 text-left font-bold text-xs uppercase text-slate-500">Fecha</th>
                               <th className="p-3 text-left font-bold text-xs uppercase text-slate-500">Documento</th>
                               <th className="p-3 text-left font-bold text-xs uppercase text-slate-500">Concepto</th>
                               <th className="p-3 text-right font-bold text-xs uppercase text-slate-500">Total</th>
                            </tr>
                         </thead>
                         <tbody>
                            {projectSales.map((s: any) => (
                               <tr key={s.id} className="border-b border-slate-50 dark:border-white/5 last:border-0">
                                  <td className="p-3">{new Date(s.createdAt).toLocaleDateString()}</td>
                                  <td className="p-3 font-mono text-xs">{s.docNumber}</td>
                                  <td className="p-3">{s.concept}</td>
                                  <td className="p-3 text-right font-black text-emerald-600">${s.total.toLocaleString()}</td>
                               </tr>
                            ))}
                         </tbody>
                      </table>
                   ) : (
                      <div className="p-8 text-center text-slate-500">No hay ventas registradas para este proyecto.</div>
                   )}
                </Card>
              </TabsContent>

              <TabsContent value="expenses" className="m-0 outline-none">
                 <Card className="bg-white dark:bg-[#111] border-slate-200 dark:border-white/10 rounded-2xl shadow-sm p-4">
                   {loading ? (
                      <div className="flex justify-center p-8"><Loader2 className="animate-spin text-blue-500" /></div>
                   ) : journal.length > 0 ? (
                      <table className="w-full text-sm">
                         <thead className="bg-slate-50 dark:bg-white/5 border-b border-slate-100 dark:border-white/10">
                            <tr>
                               <th className="p-3 text-left font-bold text-xs uppercase text-slate-500">Fecha</th>
                               <th className="p-3 text-left font-bold text-xs uppercase text-slate-500">Descripción</th>
                               <th className="p-3 text-right font-bold text-xs uppercase text-slate-500">Monto</th>
                            </tr>
                         </thead>
                         <tbody>
                            {journal.map((j: any) => (
                               <tr key={j.id} className="border-b border-slate-50 dark:border-white/5 last:border-0">
                                  <td className="p-3">{new Date(j.created_at).toLocaleDateString()}</td>
                                  <td className="p-3 font-medium">{j.description}</td>
                                  <td className="p-3 text-right font-black text-rose-500">${parseFloat(j.amount).toLocaleString()}</td>
                               </tr>
                            ))}
                         </tbody>
                      </table>
                   ) : (
                      <div className="p-8 text-center text-slate-500">No hay gastos ni viáticos registrados para este proyecto.</div>
                   )}
                </Card>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
