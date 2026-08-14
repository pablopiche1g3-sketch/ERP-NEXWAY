'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Laptop, Download, Sparkles, CheckCircle2, HelpCircle, Monitor, ExternalLink } from 'lucide-react';

export function PwaInstallButton() {
  const { toast } = useToast();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  useEffect(() => {
    // Detectar si ya se está ejecutando como PWA de escritorio
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      toast({
        title: '¡App de Escritorio Instalada!',
        description: 'NexWay ERP ya está disponible en tu Escritorio y Barra de Tareas de Windows.'
      });
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        toast({ title: 'Instalando NexWay ERP', description: 'Se está añadiendo el acceso a tu Escritorio.' });
      }
      setDeferredPrompt(null);
    } else {
      // Abrir modal con la guía ilustrada de 2 clics
      setIsGuideOpen(true);
    }
  };

  if (isInstalled) {
    return (
      <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold py-1 px-2.5 rounded-xl flex items-center gap-1">
        <CheckCircle2 size={13} /> App de Escritorio Activa
      </Badge>
    );
  }

  return (
    <>
      <Button
        onClick={handleInstallClick}
        variant="outline"
        size="sm"
        className="h-9 px-3 bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-400 font-bold text-xs rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/50 shadow-sm flex items-center gap-1.5 transition-all"
      >
        <Laptop size={15} className="text-indigo-500 animate-pulse" />
        <span>Instalar App en PC</span>
        <Download size={13} className="ml-0.5" />
      </Button>

      {/* Modal Guía Ilustrada de Instalación */}
      <Dialog open={isGuideOpen} onOpenChange={setIsGuideOpen}>
        <DialogContent className="rounded-2xl max-w-md p-6 bg-card border shadow-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl">
                <Laptop size={20} />
              </div>
              <div>
                <DialogTitle className="text-base font-black text-slate-800 dark:text-white">
                  Instalar NexWay ERP en tu PC de Escritorio
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Crea un acceso directo independiente en tu Escritorio de Windows sin barra de direcciones.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3.5 my-3 text-xs">
            <div className="p-3 bg-slate-900 text-slate-100 rounded-xl space-y-2 border border-white/10">
              <h5 className="font-bold text-indigo-400 flex items-center gap-1.5 text-xs">
                <Monitor size={14} /> Opción 1: Barra de Direcciones del Navegador
              </h5>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                1. Busca el ícono de <strong>Pantalla con Flecha hacia abajo</strong> (🖥️ ⬇️) en la parte superior derecha de tu navegador Chrome o Edge (a la par de las extensiones/favoritos).
              </p>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                2. Haz clic en <strong>"Instalar NexWay ERP"</strong> y confirma.
              </p>
            </div>

            <div className="p-3 bg-muted/40 rounded-xl space-y-2 border">
              <h5 className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5 text-xs">
                <ExternalLink size={14} className="text-indigo-500" /> Opción 2: Menú 3 Puntos (...)
              </h5>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                Haz clic en el menú <strong>`...`</strong> de tu navegador → selecciona <strong>`Guardar y Compartir`</strong> o <strong>`Más Herramientas`</strong> → Elige <strong>`Instalar NexWay ERP como Aplicación`</strong>.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setIsGuideOpen(false)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 rounded-xl">
              Entendido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
