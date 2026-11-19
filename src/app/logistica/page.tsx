'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import InventoryTab from './components/InventoryTab';
import TransfersTab from './components/TransfersTab';
import KardexValuedTab from './components/KardexValuedTab';
import ProductionTab from './components/ProductionTab';
import FractionAndDischargesTab from './components/FractionAndDischargesTab';
import { Package, Factory, Scissors, ArrowLeftRight, BarChart3 } from 'lucide-react';
import { ModeToggle } from '@/components/mode-toggle';

function LogisticaContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams?.get('tab') || 'inventario';
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    const paramTab = searchParams?.get('tab');
    if (paramTab) {
      setActiveTab(paramTab === 'kardex' ? 'kardex-valued' : paramTab);
    }
  }, [searchParams]);

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-600 dark:text-indigo-400 shadow-sm">
            <Package className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-foreground">Logística & Producción</h2>
            <p className="text-xs text-muted-foreground font-medium">
              Control de inventario por bodega, fórmulas BOM, fraccionamiento de galones, Kardex FIFO y traslados.
            </p>
          </div>
        </div>
        <ModeToggle />
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 w-full">
        <TabsList className="bg-transparent p-0 h-auto flex flex-wrap w-full justify-start border-b border-slate-200 dark:border-white/10 gap-2 sm:gap-4">
          <TabsTrigger 
            value="inventario" 
            className="rounded-none px-4 py-3 font-medium text-sm text-slate-500 dark:text-white/40 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 data-[state=active]:bg-transparent transition-colors flex items-center gap-1.5"
          >
            <Package size={15} /> Inventario General
          </TabsTrigger>
          <TabsTrigger 
            value="produccion" 
            className="rounded-none px-4 py-3 font-medium text-sm text-slate-500 dark:text-white/40 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 data-[state=active]:bg-transparent transition-colors flex items-center gap-1.5"
          >
            <Factory size={15} /> Producción & Fórmulas
          </TabsTrigger>
          <TabsTrigger 
            value="fraccionamiento" 
            className="rounded-none px-4 py-3 font-medium text-sm text-slate-500 dark:text-white/40 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 data-[state=active]:bg-transparent transition-colors flex items-center gap-1.5"
          >
            <Scissors size={15} /> Fraccionamiento & Salidas
          </TabsTrigger>
          <TabsTrigger 
            value="kardex-valued" 
            className="rounded-none px-4 py-3 font-medium text-sm text-slate-500 dark:text-white/40 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 data-[state=active]:bg-transparent transition-colors flex items-center gap-1.5"
          >
            <BarChart3 size={15} /> Kardex Valorizado FIFO
          </TabsTrigger>
          <TabsTrigger 
            value="traslados" 
            className="rounded-none px-4 py-3 font-medium text-sm text-slate-500 dark:text-white/40 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 data-[state=active]:bg-transparent transition-colors flex items-center gap-1.5"
          >
            <ArrowLeftRight size={15} /> Traslados y Requisiciones
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="inventario" className="outline-none">
          <InventoryTab />
        </TabsContent>
        <TabsContent value="produccion" className="outline-none">
          <ProductionTab />
        </TabsContent>
        <TabsContent value="fraccionamiento" className="outline-none">
          <FractionAndDischargesTab />
        </TabsContent>
        <TabsContent value="kardex-valued" className="outline-none">
          <KardexValuedTab />
        </TabsContent>
        <TabsContent value="traslados" className="outline-none">
          <TransfersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function LogisticaPage() {
  return (
    <Suspense fallback={<div className="p-8 text-xs text-muted-foreground">Cargando Logística...</div>}>
      <LogisticaContent />
    </Suspense>
  );
}
