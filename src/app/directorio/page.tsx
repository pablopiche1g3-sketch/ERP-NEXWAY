'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CustomersTab from './components/CustomersTab';
import SuppliersTab from './components/SuppliersTab';
import { Building2, Loader2 } from 'lucide-react';
import { ModeToggle } from '@/components/mode-toggle';

function DirectorioContent() {
  const searchParams = useSearchParams();
  const queryTab = searchParams?.get('tab');
  const [activeTab, setActiveTab] = useState(queryTab || 'clientes');

  useEffect(() => {
    const paramTab = searchParams?.get('tab');
    if (paramTab) {
      setActiveTab(paramTab);
    }
  }, [searchParams]);

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-600 dark:text-indigo-400 shadow-sm">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-foreground">Directorio Comercial</h2>
            <p className="text-xs text-muted-foreground font-medium">
              Cartera de clientes contribuyentes/consumidores y catálogo de proveedores autorizados.
            </p>
          </div>
        </div>
        <ModeToggle />
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

export default function DirectorioPage() {
  return (
    <Suspense fallback={<div className="p-8 flex justify-center"><Loader2 className="animate-spin text-indigo-500" /></div>}>
      <DirectorioContent />
    </Suspense>
  );
}
