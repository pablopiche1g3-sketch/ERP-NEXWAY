'use client';

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import InventoryTab from './components/InventoryTab';
import TransfersTab from './components/TransfersTab';
import KardexValuedTab from './components/KardexValuedTab';
import ProductionTab from './components/ProductionTab';
import FractionAndDischargesTab from './components/FractionAndDischargesTab';
import { Package, Factory, Scissors, ArrowLeftRight, BarChart3 } from 'lucide-react';

export default function LogisticaPage() {
  const [activeTab, setActiveTab] = useState('inventario');

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center space-x-2">
        <Package className="h-6 w-6 text-indigo-500" />
        <h2 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-white">Logística & Producción</h2>
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
