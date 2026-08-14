'use client';

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import InventoryTab from './components/InventoryTab';
import TransfersTab from './components/TransfersTab';
import KardexValuedTab from './components/KardexValuedTab';
import { Package } from 'lucide-react';

export default function LogisticaPage() {
  const [activeTab, setActiveTab] = useState('inventario');

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center space-x-2">
        <Package className="h-6 w-6 text-indigo-500" />
        <h2 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-white">Logística de Stock</h2>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 w-full">
        <TabsList className="bg-transparent p-0 h-auto flex w-full justify-start border-b border-slate-200 dark:border-white/10 gap-4">
          <TabsTrigger 
            value="inventario" 
            className="rounded-none px-4 py-3 font-medium text-sm text-slate-500 dark:text-white/40 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 data-[state=active]:bg-transparent transition-colors"
          >
            Inventario
          </TabsTrigger>
          <TabsTrigger 
            value="kardex-valued" 
            className="rounded-none px-4 py-3 font-medium text-sm text-slate-500 dark:text-white/40 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 data-[state=active]:bg-transparent transition-colors"
          >
            Kardex Valorizado FIFO
          </TabsTrigger>
          <TabsTrigger 
            value="traslados" 
            className="rounded-none px-4 py-3 font-medium text-sm text-slate-500 dark:text-white/40 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 data-[state=active]:bg-transparent transition-colors"
          >
            Traslados y Requisiciones
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="inventario" className="outline-none">
          <InventoryTab />
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
