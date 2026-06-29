'use client';

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CustomersTab from './components/CustomersTab';
import SuppliersTab from './components/SuppliersTab';
import { Building2 } from 'lucide-react';

export default function DirectorioPage() {
  const [activeTab, setActiveTab] = useState('clientes');

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center space-x-2">
        <Building2 className="h-6 w-6 text-indigo-500" />
        <h2 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-white">Directorio Comercial</h2>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 w-full">
        <TabsList className="bg-transparent p-0 h-auto flex w-full justify-start border-b border-slate-200 dark:border-white/10 gap-4">
          <TabsTrigger 
            value="clientes" 
            className="rounded-none px-4 py-3 font-medium text-sm text-slate-500 dark:text-white/40 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 data-[state=active]:bg-transparent transition-colors"
          >
            Registro de Cliente
          </TabsTrigger>
          <TabsTrigger 
            value="proveedores" 
            className="rounded-none px-4 py-3 font-medium text-sm text-slate-500 dark:text-white/40 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 data-[state=active]:bg-transparent transition-colors"
          >
            Proveedores
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="clientes" className="outline-none">
          <CustomersTab />
        </TabsContent>
        <TabsContent value="proveedores" className="outline-none">
          <SuppliersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
