'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PurchasesTab from './components/PurchasesTab';
import OrdersTab from './components/OrdersTab';
import GmailClient from '@/components/shared/GmailClient';
import { Truck, Loader2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { ModeToggle } from '@/components/mode-toggle';

function ComprasContent() {
  const searchParams = useSearchParams();
  const queryTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(queryTab || 'registro');
  const [pendingImportedDte, setPendingImportedDte] = useState<any | null>(null);

  useEffect(() => {
    if (queryTab) setActiveTab(queryTab);
  }, [queryTab]);

  const handleImportDteFromGmail = (dte: any) => {
    setPendingImportedDte(dte);
    setActiveTab('registro');
  };

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-600 dark:text-indigo-400 shadow-sm">
            <Truck className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-foreground">Abastecimiento</h2>
            <p className="text-xs text-muted-foreground font-medium">
              Registro de compras DTE, órdenes de compra a proveedores y recepción electrónica vía correo.
            </p>
          </div>
        </div>
        <ModeToggle />
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 w-full">
        <TabsList className="bg-transparent p-0 h-auto flex w-full justify-start border-b border-slate-200 dark:border-white/10 gap-4 overflow-x-auto pb-px">
          <TabsTrigger 
            value="registro" 
            className="rounded-none px-4 py-3 font-medium text-sm text-slate-500 dark:text-white/40 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 data-[state=active]:bg-transparent transition-colors whitespace-nowrap"
          >
            Registro de Compra
          </TabsTrigger>
          <TabsTrigger 
            value="ordenes" 
            className="rounded-none px-4 py-3 font-medium text-sm text-slate-500 dark:text-white/40 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 data-[state=active]:bg-transparent transition-colors whitespace-nowrap"
          >
            Orden de Compra
          </TabsTrigger>
          <TabsTrigger 
            value="gmail" 
            className="rounded-none px-4 py-3 font-medium text-sm text-slate-500 dark:text-white/40 data-[state=active]:text-red-600 dark:data-[state=active]:text-red-400 data-[state=active]:border-b-2 data-[state=active]:border-red-500 data-[state=active]:bg-transparent transition-colors whitespace-nowrap"
          >
            Bandeja Gmail
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="registro" className="outline-none">
          <PurchasesTab
            initialImportedDte={pendingImportedDte}
            onConsumeImportedDte={() => setPendingImportedDte(null)}
          />
        </TabsContent>
        <TabsContent value="ordenes" className="outline-none">
          <OrdersTab />
        </TabsContent>
        <TabsContent value="gmail" className="m-0 p-0 outline-none">
          <GmailClient context="compras" onImportDteToPurchase={handleImportDteFromGmail} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function ComprasPage() {
  return (
    <Suspense fallback={<div className="p-8 flex justify-center"><Loader2 className="animate-spin text-indigo-500" /></div>}>
      <ComprasContent />
    </Suspense>
  );
}
