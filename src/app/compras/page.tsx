'use client';

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PurchasesTab from './components/PurchasesTab';
import OrdersTab from './components/OrdersTab';
import GmailClient from '@/components/shared/GmailClient';
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
          <PurchasesTab />
        </TabsContent>
        <TabsContent value="ordenes" className="outline-none">
          <OrdersTab />
        </TabsContent>
        <TabsContent value="gmail" className="m-0 p-0 outline-none">
          <GmailClient context="compras" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
