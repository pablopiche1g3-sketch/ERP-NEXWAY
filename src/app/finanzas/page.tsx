'use client';

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CxcTab from './components/CxcTab';
import CxpTab from './components/CxpTab';
import QuedanTab from './components/QuedanTab';
import PayrollTab from './components/PayrollTab';
import CashFlowTab from './components/CashFlowTab';
import BankingTab from './components/BankingTab';
import CreditScoringTab from './components/CreditScoringTab';
import BulkPaymentsTab from './components/BulkPaymentsTab';
import AdvancesTab from './components/AdvancesTab';
import { CalendarClock, TrendingUp, Building2, ShieldCheck, FileText, Coins } from 'lucide-react';

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
          <p className="text-xs text-slate-500 dark:text-white/60 font-medium">
            Suite financiera integral: CXC, CXP, Quedan, Nómina, Flujo de Caja Proyectado, Bancos, Credit Scoring, Pagos Masivos y Anticipos.
          </p>
        </div>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 w-full">
        <TabsList className="bg-slate-100 dark:bg-white/5 p-1 rounded-2xl border border-slate-200 dark:border-white/10 flex flex-wrap gap-1 w-full md:w-auto">
          <TabsTrigger 
            value="cxc" 
            className="rounded-xl px-4 py-2 text-xs font-bold transition-all data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md"
          >
            Cuentas por Cobrar
          </TabsTrigger>
          <TabsTrigger 
            value="cxp" 
            className="rounded-xl px-4 py-2 text-xs font-bold transition-all data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md"
          >
            Cuentas por Pagar
          </TabsTrigger>
          <TabsTrigger 
            value="quedan" 
            className="rounded-xl px-4 py-2 text-xs font-bold transition-all data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md"
          >
            Gestión de Quedan
          </TabsTrigger>
          <TabsTrigger 
            value="payroll" 
            className="rounded-xl px-4 py-2 text-xs font-bold transition-all data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md"
          >
            Nómina & RH
          </TabsTrigger>
          <TabsTrigger 
            value="cashflow" 
            className="rounded-xl px-4 py-2 text-xs font-bold transition-all data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md flex items-center gap-1"
          >
            <TrendingUp size={13} /> Flujo de Caja
          </TabsTrigger>
          <TabsTrigger 
            value="banking" 
            className="rounded-xl px-4 py-2 text-xs font-bold transition-all data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md flex items-center gap-1"
          >
            <Building2 size={13} /> Bancos y Conciliación
          </TabsTrigger>
          <TabsTrigger 
            value="scoring" 
            className="rounded-xl px-4 py-2 text-xs font-bold transition-all data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md flex items-center gap-1"
          >
            <ShieldCheck size={13} /> Credit Scoring
          </TabsTrigger>
          <TabsTrigger 
            value="bulk" 
            className="rounded-xl px-4 py-2 text-xs font-bold transition-all data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md flex items-center gap-1"
          >
            <FileText size={13} /> Pagos Masivos TXT
          </TabsTrigger>
          <TabsTrigger 
            value="advances" 
            className="rounded-xl px-4 py-2 text-xs font-bold transition-all data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md flex items-center gap-1"
          >
            <Coins size={13} /> Anticipos
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="cxc" className="outline-none">
          <CxcTab />
        </TabsContent>
        <TabsContent value="cxp" className="outline-none">
          <CxpTab />
        </TabsContent>
        <TabsContent value="quedan" className="outline-none">
          <QuedanTab />
        </TabsContent>
        <TabsContent value="payroll" className="outline-none">
          <PayrollTab />
        </TabsContent>
        <TabsContent value="cashflow" className="outline-none">
          <CashFlowTab />
        </TabsContent>
        <TabsContent value="banking" className="outline-none">
          <BankingTab />
        </TabsContent>
        <TabsContent value="scoring" className="outline-none">
          <CreditScoringTab />
        </TabsContent>
        <TabsContent value="bulk" className="outline-none">
          <BulkPaymentsTab />
        </TabsContent>
        <TabsContent value="advances" className="outline-none">
          <AdvancesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
