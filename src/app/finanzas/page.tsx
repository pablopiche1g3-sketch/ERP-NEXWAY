'use client';

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import QuedanTab from './components/QuedanTab';
import { CalendarClock } from 'lucide-react';

export default function FinanzasPage() {
  const [activeTab, setActiveTab] = useState('cxc');

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-white/10">
        <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-indigo-500 shadow-sm">
          <CalendarClock className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-slate-800 dark:text-white">Finanzas y Créditos</h2>
          <p className="text-xs text-slate-500 dark:text-white/60 font-medium">Control de cuentas por cobrar, cuentas por pagar y gestión integral de quedan.</p>
        </div>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 w-full">
        <TabsList className="bg-slate-100 dark:bg-white/5 p-1 rounded-2xl border border-slate-200 dark:border-white/10 inline-flex gap-1">
          <TabsTrigger 
            value="cxc" 
            className="rounded-xl px-5 py-2 text-xs font-bold transition-all data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md"
          >
            Cuentas por Cobrar
          </TabsTrigger>
          <TabsTrigger 
            value="cxp" 
            className="rounded-xl px-5 py-2 text-xs font-bold transition-all data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md"
          >
            Cuentas por Pagar
          </TabsTrigger>
          <TabsTrigger 
            value="quedan" 
            className="rounded-xl px-5 py-2 text-xs font-bold transition-all data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md"
          >
            Gestión de Quedan
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="cxc" className="outline-none">
          <div className="p-8 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-center shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Cuentas por Cobrar (CXC)</h3>
            <p className="text-slate-500 dark:text-white/60 text-xs mt-2">Monitoreo de facturas al crédito emitidas, vencimientos y abonos de clientes.</p>
          </div>
        </TabsContent>
        <TabsContent value="cxp" className="outline-none">
          <div className="p-8 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-center shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Cuentas por Pagar (CXP)</h3>
            <p className="text-slate-500 dark:text-white/60 text-xs mt-2">Gestión de obligaciones fiscales, compras a crédito y programación de pagos a proveedores.</p>
          </div>
        </TabsContent>
        <TabsContent value="quedan" className="outline-none">
          <QuedanTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
