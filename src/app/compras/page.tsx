'use client';

import React, { useState, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PurchasesTab from './components/PurchasesTab';
import type { PurchaseOrderRecord } from './components/OrdersTab';
import { Truck, Loader2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { ModeToggle } from '@/components/mode-toggle';

const OrdersTab = dynamic(() => import('./components/OrdersTab'), {
  ssr: false,
  loading: () => (
    <div className="py-16 flex items-center justify-center gap-2 text-xs text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin text-indigo-500" /> Cargando Órdenes de Compra...
    </div>
  ),
});

const GmailClient = dynamic(() => import('@/components/shared/GmailClient'), {
  ssr: false,
  loading: () => (
    <div className="py-16 flex items-center justify-center gap-2 text-xs text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin text-red-500" /> Cargando Bandeja Gmail...
    </div>
  ),
});

function ComprasContent() {
  const searchParams = useSearchParams();
  const queryTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(queryTab || 'registro');
  const [pendingImportedDte, setPendingImportedDte] = useState<any | null>(null);
  const [pendingPurchaseOrder, setPendingPurchaseOrder] = useState<PurchaseOrderRecord | null>(null);

  useEffect(() => {
    if (queryTab) setActiveTab(queryTab);
  }, [queryTab]);

  const handleImportDteFromGmail = (dte: any) => {
    setPendingImportedDte(dte);
    setActiveTab('registro');
  };

  const handleReceiveOrderToPurchase = (order: PurchaseOrderRecord) => {
    setPendingPurchaseOrder(order);
    setActiveTab('registro');
  };

  return (
    <div className="flex-1 w-full space-y-3 p-3 md:p-5 animate-in fade-in duration-200">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-3 w-full">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2.5 border-b border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-600 dark:text-indigo-400 shadow-sm">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-black tracking-tight text-foreground leading-none">Abastecimiento</h2>
              <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
                Ingreso de facturas DTE, órdenes a proveedores y recepción electrónica.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <TabsList className="bg-muted/50 dark:bg-white/5 border border-border dark:border-white/10 p-1 h-9 rounded-xl gap-1">
              <TabsTrigger
                value="registro"
                className="rounded-lg px-3.5 py-1.5 font-bold text-xs data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all"
              >
                Registro de Compra
              </TabsTrigger>
              <TabsTrigger
                value="ordenes"
                className="rounded-lg px-3.5 py-1.5 font-bold text-xs data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all"
              >
                Orden de Compra
              </TabsTrigger>
              <TabsTrigger
                value="gmail"
                className="rounded-lg px-3.5 py-1.5 font-bold text-xs data-[state=active]:bg-red-600 data-[state=active]:text-white transition-all"
              >
                Bandeja Gmail
              </TabsTrigger>
            </TabsList>
            <ModeToggle />
          </div>
        </div>

        <TabsContent value="registro" className="m-0 outline-none w-full">
          <PurchasesTab
            initialImportedDte={pendingImportedDte}
            onConsumeImportedDte={() => setPendingImportedDte(null)}
            initialPurchaseOrder={pendingPurchaseOrder}
            onConsumePurchaseOrder={() => setPendingPurchaseOrder(null)}
          />
        </TabsContent>
        <TabsContent value="ordenes" className="m-0 outline-none w-full">
          <OrdersTab onReceiveToPurchase={handleReceiveOrderToPurchase} />
        </TabsContent>
        <TabsContent value="gmail" className="m-0 p-0 outline-none w-full">
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
