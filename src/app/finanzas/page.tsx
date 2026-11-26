'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import CxcTab from './components/CxcTab';
import CxpTab from './components/CxpTab';
import QuedanTab from './components/QuedanTab';
import PayrollTab from './components/PayrollTab';
import CashFlowTab from './components/CashFlowTab';
import BankingTab from './components/BankingTab';
import CreditScoringTab from './components/CreditScoringTab';
import BulkPaymentsTab from './components/BulkPaymentsTab';
import InvoiceCrossTab from './components/InvoiceCrossTab';
import BankReconciliationTab from './components/BankReconciliationTab';
import {
  CalendarClock,
  TrendingUp,
  Building2,
  ShieldCheck,
  FileText,
  Users,
  DollarSign,
  Receipt,
  Loader2,
  ArrowLeftRight,
  Scale,
} from 'lucide-react';
import { ModeToggle } from '@/components/mode-toggle';

function FinanzasContent() {
  const searchParams = useSearchParams();
  const queryTab = searchParams?.get('tab');
  const [activeTab, setActiveTab] = useState(queryTab || 'cxc');
  const [cxcSubView, setCxcSubView] = useState<'cartera' | 'scoring'>('cartera');
  const [cxpSubView, setCxpSubView] = useState<'facturas' | 'autorizar' | 'cruce'>('facturas');
  const [bankingSubView, setBankingSubView] = useState<'cuentas' | 'conciliacion' | 'txt'>('cuentas');

  useEffect(() => {
    const paramTab = searchParams?.get('tab');
    if (!paramTab) return;
    if (paramTab === 'scoring') {
      setActiveTab('cxc');
      setCxcSubView('scoring');
    } else if (paramTab === 'bulk') {
      setActiveTab('banking');
      setBankingSubView('txt');
    } else if (paramTab === 'advances') {
      setActiveTab('payroll');
    } else {
      setActiveTab(paramTab);
    }
  }, [searchParams]);

  return (
    <div className="flex-1 space-y-5 p-4 md:p-8 pt-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-600 dark:text-indigo-400 shadow-sm">
            <CalendarClock className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-foreground">Finanzas y Créditos</h2>
            <p className="text-xs text-muted-foreground font-medium">
              Control de Cuentas por Cobrar (CXC), Cuentas por Pagar (CXP), Quedan, Tesorería Bancaria, Flujo de Caja y Planilla RH.
            </p>
          </div>
        </div>
        <ModeToggle />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5 w-full">
        <TabsList className="bg-transparent p-0 h-auto flex flex-wrap w-full justify-start border-b border-slate-200 dark:border-white/10 gap-2 sm:gap-4">
          <TabsTrigger
            value="cxc"
            className="rounded-none px-4 py-3 font-bold text-xs sm:text-sm text-slate-500 dark:text-white/50 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 data-[state=active]:bg-transparent transition-colors flex items-center gap-1.5"
          >
            <DollarSign size={15} /> 1. Cuentas por Cobrar (CXC)
          </TabsTrigger>
          <TabsTrigger
            value="cxp"
            className="rounded-none px-4 py-3 font-bold text-xs sm:text-sm text-slate-500 dark:text-white/50 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 data-[state=active]:bg-transparent transition-colors flex items-center gap-1.5"
          >
            <Receipt size={15} /> 2. Cuentas por Pagar (CXP)
          </TabsTrigger>
          <TabsTrigger
            value="quedan"
            className="rounded-none px-4 py-3 font-bold text-xs sm:text-sm text-slate-500 dark:text-white/50 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 data-[state=active]:bg-transparent transition-colors flex items-center gap-1.5"
          >
            <FileText size={15} /> 3. Gestión de Quedan
          </TabsTrigger>
          <TabsTrigger
            value="banking"
            className="rounded-none px-4 py-3 font-bold text-xs sm:text-sm text-slate-500 dark:text-white/50 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 data-[state=active]:bg-transparent transition-colors flex items-center gap-1.5"
          >
            <Building2 size={15} /> 4. Bancos & Pagos TXT
          </TabsTrigger>
          <TabsTrigger
            value="cashflow"
            className="rounded-none px-4 py-3 font-bold text-xs sm:text-sm text-slate-500 dark:text-white/50 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 data-[state=active]:bg-transparent transition-colors flex items-center gap-1.5"
          >
            <TrendingUp size={15} /> 5. Flujo de Caja (Cash Flow)
          </TabsTrigger>
          <TabsTrigger
            value="payroll"
            className="rounded-none px-4 py-3 font-bold text-xs sm:text-sm text-slate-500 dark:text-white/50 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 data-[state=active]:bg-transparent transition-colors flex items-center gap-1.5"
          >
            <Users size={15} /> 6. Nómina, Bonos & Anticipos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cxc" className="space-y-4 outline-none">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-card border border-border/70 p-1.5 rounded-2xl w-fit shadow-sm">
            <Button
              size="sm"
              variant={cxcSubView === 'cartera' ? 'default' : 'ghost'}
              onClick={() => setCxcSubView('cartera')}
              className="rounded-xl text-xs h-8 font-bold gap-1.5"
            >
              <DollarSign size={14} /> Cartera de Créditos y Abonos
            </Button>
            <Button
              size="sm"
              variant={cxcSubView === 'scoring' ? 'default' : 'ghost'}
              onClick={() => setCxcSubView('scoring')}
              className="rounded-xl text-xs h-8 font-bold gap-1.5"
            >
              <ShieldCheck size={14} /> Evaluador Credit Scoring (Riesgo)
            </Button>
          </div>
          {cxcSubView === 'cartera' ? <CxcTab /> : <CreditScoringTab />}
        </TabsContent>

        <TabsContent value="cxp" className="space-y-4 outline-none">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-card border border-border/70 p-1.5 rounded-2xl w-fit shadow-sm">
            <Button
              size="sm"
              variant={cxpSubView === 'facturas' ? 'default' : 'ghost'}
              onClick={() => setCxpSubView('facturas')}
              className="rounded-xl text-xs h-8 font-bold gap-1.5"
            >
              <Receipt size={14} /> Facturas por Pagar
            </Button>
            <Button
              size="sm"
              variant={cxpSubView === 'autorizar' ? 'default' : 'ghost'}
              onClick={() => setCxpSubView('autorizar')}
              className="rounded-xl text-xs h-8 font-bold gap-1.5"
            >
              <ShieldCheck size={14} /> Autorizar Pagos y Disponibilidad
            </Button>
            <Button
              size="sm"
              variant={cxpSubView === 'cruce' ? 'default' : 'ghost'}
              onClick={() => setCxpSubView('cruce')}
              className="rounded-xl text-xs h-8 font-bold gap-1.5"
            >
              <ArrowLeftRight size={14} /> Cruce Cliente ↔ Proveedor
            </Button>
          </div>
          {cxpSubView === 'facturas' ? (
            <CxpTab />
          ) : cxpSubView === 'autorizar' ? (
            <InvoiceCrossTab mode="autorizar" />
          ) : (
            <InvoiceCrossTab mode="cruce" />
          )}
        </TabsContent>

        <TabsContent value="quedan" className="outline-none">
          <QuedanTab />
        </TabsContent>

        <TabsContent value="banking" className="space-y-4 outline-none">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-card border border-border/70 p-1.5 rounded-2xl w-fit shadow-sm">
            <Button
              size="sm"
              variant={bankingSubView === 'cuentas' ? 'default' : 'ghost'}
              onClick={() => setBankingSubView('cuentas')}
              className="rounded-xl text-xs h-8 font-bold gap-1.5"
            >
              <Building2 size={14} /> Cuentas Bancarias
            </Button>
            <Button
              size="sm"
              variant={bankingSubView === 'conciliacion' ? 'default' : 'ghost'}
              onClick={() => setBankingSubView('conciliacion')}
              className="rounded-xl text-xs h-8 font-bold gap-1.5"
            >
              <Scale size={14} /> Conciliación Bancaria (1102)
            </Button>
            <Button
              size="sm"
              variant={bankingSubView === 'txt' ? 'default' : 'ghost'}
              onClick={() => setBankingSubView('txt')}
              className="rounded-xl text-xs h-8 font-bold gap-1.5"
            >
              <FileText size={14} /> Pagos Masivos TXT (Planilla / Proveedores)
            </Button>
          </div>
          {bankingSubView === 'cuentas' ? (
            <BankingTab />
          ) : bankingSubView === 'conciliacion' ? (
            <BankReconciliationTab />
          ) : (
            <BulkPaymentsTab />
          )}
        </TabsContent>

        <TabsContent value="cashflow" className="outline-none">
          <CashFlowTab />
        </TabsContent>

        <TabsContent value="payroll" className="outline-none">
          <PayrollTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function FinanzasPage() {
  return (
    <Suspense fallback={<div className="p-8 flex justify-center"><Loader2 className="animate-spin text-indigo-500" /></div>}>
      <FinanzasContent />
    </Suspense>
  );
}
