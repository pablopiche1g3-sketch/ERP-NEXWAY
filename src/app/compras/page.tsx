'use client';

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PurchasesTab from './components/PurchasesTab';
import OrdersTab from './components/OrdersTab';
import { Truck } from 'lucide-react';

export default function ComprasPage() {
  const [activeTab, setActiveTab] = useState('registro');

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center space-x-2">
        <Truck className="h-6 w-6 text-indigo-500" />
        <h2 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-white">Abastecimiento</h2>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 w-full">
        <TabsList className="bg-transparent p-0 h-auto flex w-full justify-start border-b border-slate-200 dark:border-white/10 gap-4">
          <TabsTrigger 
            value="registro" 
            className="rounded-none px-4 py-3 font-medium text-sm text-slate-500 dark:text-white/40 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 data-[state=active]:bg-transparent transition-colors"
          >
            Registro de Compra
          </TabsTrigger>
          <TabsTrigger 
            value="ordenes" 
            className="rounded-none px-4 py-3 font-medium text-sm text-slate-500 dark:text-white/40 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 data-[state=active]:bg-transparent transition-colors"
          >
            Orden de Compra
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="registro" className="outline-none">
          <PurchasesTab />
        </TabsContent>
        <TabsContent value="ordenes" className="outline-none">
          <OrdersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
