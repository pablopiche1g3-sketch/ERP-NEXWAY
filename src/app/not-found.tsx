'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  ShieldCheck, 
  Search, 
  Home, 
  ClipboardList, 
  HelpCircle, 
  LogIn, 
  AlertTriangle 
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearched, setIsSearched] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setIsSearched(true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-between p-6 transition-all duration-300">
      {/* Header - Identificación de la Marca */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between py-4 border-b border-slate-100 dark:border-slate-900">
        <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white font-headline">
            NexWay ERP
          </span>
        </Link>
        <ModeIndicator />
      </header>

      {/* Main Content Area */}
      <main className="max-w-3xl w-full mx-auto my-auto flex flex-col items-center text-center py-12">
        {/* Error Indicator & Icon */}
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-blue-500/10 dark:bg-blue-500/5 blur-3xl rounded-full scale-150"></div>
          <div className="w-24 h-24 bg-amber-500/10 dark:bg-amber-500/5 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mx-auto border border-amber-500/20 mb-6 shadow-xl relative animate-bounce">
            <AlertTriangle size={48} />
          </div>
          <h1 className="text-8xl font-black tracking-tighter text-slate-200 dark:text-slate-800 leading-none select-none">
            404
          </h1>
        </div>

        {/* Title and Short Description (< 2 lines as specified in manual) */}
        <div className="space-y-3 mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-950 dark:text-slate-50 font-headline">
            Página No Encontrada
          </h2>
          <p className="text-muted-foreground text-sm md:text-base max-w-md mx-auto leading-relaxed">
            Lo sentimos, el recurso que buscas no existe o ha sido movido a otra sección del sistema.
          </p>
        </div>

        {/* Interactive Search Bar */}
        <form onSubmit={handleSearch} className="w-full max-w-md mb-10 space-y-3">
          <div className="relative flex items-center">
            <Search className="absolute left-3 w-4 h-4 text-slate-400" />
            <Input 
              type="text"
              placeholder="Buscar en el ERP..." 
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearched(false);
              }}
              className="pl-10 pr-24 h-12 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-blue-500/20 rounded-xl transition-all"
            />
            <Button 
              type="submit"
              className="absolute right-1.5 h-9 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold px-4"
            >
              Buscar
            </Button>
          </div>

          {isSearched && (
            <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 py-2 px-3 rounded-lg text-left">
              Búsqueda de <strong>"{searchQuery}"</strong> completada. No se encontraron recursos exactos. Por favor usa el mapa de sitio a continuación.
            </p>
          )}
        </form>

        {/* Site Map (Mapa del Sitio - Navigation) */}
        <div className="w-full max-w-2xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-6 md:p-8 shadow-xl">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400/80 mb-6 text-left border-b border-slate-100 dark:border-slate-800/80 pb-2">
            Mapa del Sitio
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link href="/" className="group text-left p-3.5 rounded-2xl hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-colors border border-t border-white/10ransparent hover:border-slate-200/50 dark:hover:border-slate-800/50 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Home size={18} />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Panel Principal</h4>
                <p className="text-xs text-muted-foreground mt-0.5">Control y módulos de NexWay</p>
              </div>
            </Link>

            <Link href="/orders" className="group text-left p-3.5 rounded-2xl hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-colors border border-t border-white/10ransparent hover:border-slate-200/50 dark:hover:border-slate-800/50 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <ClipboardList size={18} />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Pedidos</h4>
                <p className="text-xs text-muted-foreground mt-0.5">Gestión de órdenes de venta</p>
              </div>
            </Link>

            <Link href="/login" className="group text-left p-3.5 rounded-2xl hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-colors border border-t border-white/10ransparent hover:border-slate-200/50 dark:hover:border-slate-800/50 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <LogIn size={18} />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Acceso</h4>
                <p className="text-xs text-muted-foreground mt-0.5">Iniciar sesión en el sistema</p>
              </div>
            </Link>

            <a href="mailto:soporte@nexway.com" className="group text-left p-3.5 rounded-2xl hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-colors border border-t border-white/10ransparent hover:border-slate-200/50 dark:hover:border-slate-800/50 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <HelpCircle size={18} />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Soporte Técnico</h4>
                <p className="text-xs text-muted-foreground mt-0.5">Reportar problemas del sitio</p>
              </div>
            </a>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl w-full mx-auto flex flex-col sm:flex-row justify-between items-center py-6 border-t border-white/10 border-slate-100 dark:border-slate-900 text-xs text-slate-400 gap-3">
        <p>© 2026 NexWay ERP. Todos los derechos reservados.</p>
        <div className="flex gap-4">
          <Link href="/" className="hover:text-slate-600 dark:hover:text-slate-200 transition-colors">Inicio</Link>
          <a href="mailto:soporte@nexway.com" className="hover:text-slate-600 dark:hover:text-slate-200 transition-colors">Contacto</a>
        </div>
      </footer>
    </div>
  );
}

function ModeIndicator() {
  return (
    <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 border border-slate-200/60 dark:border-slate-800 px-3 py-1.5 rounded-full select-none">
      Servicio en Línea
    </div>
  );
}
