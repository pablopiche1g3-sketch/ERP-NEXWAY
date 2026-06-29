'use client';

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import QuedanTab from './components/QuedanTab';
import { CalendarClock } from 'lucide-react';

export default function FinanzasPage() {
  const [activeTab, setActiveTab] = useState('cxc');

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center space-x-2">
        <CalendarClock className="h-6 w-6 text-indigo-500" />
        <h2 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-white">Finanzas y Créditos</h2>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 w-full">
        <TabsList className="bg-transparent p-0 h-auto flex flex-wrap w-full justify-start border-b border-slate-200 dark:border-white/10 gap-4">
          <TabsTrigger 
            value="cxc" 
            className="rounded-none px-4 py-3 font-medium text-sm text-slate-500 dark:text-white/40 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 data-[state=active]:bg-transparent transition-colors"
          >
            Cuentas por Cobrar
          </TabsTrigger>
          <TabsTrigger 
            value="cxp" 
            className="rounded-none px-4 py-3 font-medium text-sm text-slate-500 dark:text-white/40 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 data-[state=active]:bg-transparent transition-colors"
          >
            Cuentas por Pagar
          </TabsTrigger>
          <TabsTrigger 
            value="quedan" 
            className="rounded-none px-4 py-3 font-medium text-sm text-slate-500 dark:text-white/40 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 data-[state=active]:bg-transparent transition-colors"
          >
            Gestión de Quedan
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="cxc" className="outline-none">
          <div className="p-6 bg-white/5 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-center">
            <h3 className="text-lg font-medium text-slate-800 dark:text-white">Cuentas por Cobrar</h3>
            <p className="text-slate-500 dark:text-white/60 mt-2">Módulo en proceso de migración desde Facturación.</p>
          </div>
        </TabsContent>
        <TabsContent value="cxp" className="outline-none">
          <div className="p-6 bg-white/5 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-center">
            <h3 className="text-lg font-medium text-slate-800 dark:text-white">Cuentas por Pagar</h3>
            <p className="text-slate-500 dark:text-white/60 mt-2">Módulo en proceso de integración.</p>
          </div>
        </TabsContent>
        <TabsContent value="quedan" className="outline-none">
          <QuedanTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
