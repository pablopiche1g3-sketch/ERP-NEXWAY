'use client';

import React, { useEffect } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AppErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    const msg = String(error?.message || error?.name || '');
    const isChunkError =
      msg.includes('ChunkLoadError') ||
      msg.includes('Loading chunk') ||
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('Importing a module script failed');

    if (isChunkError && typeof window !== 'undefined') {
      const key = 'nexway_chunk_reload_at';
      const last = Number(sessionStorage.getItem(key) || 0);
      if (Date.now() - last > 15000) {
        sessionStorage.setItem(key, String(Date.now()));
        window.location.reload();
      }
    }
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-6 shadow-lg text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-600 flex items-center justify-center mx-auto">
          <AlertTriangle size={24} />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-black text-foreground">Actualización del sistema detectada</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Ocurrió un error temporal al cargar una versión reciente de ERP NEXWAY. Recarga la página para continuar normalmente.
          </p>
          {error?.message && (
            <p className="text-[10px] font-mono text-muted-foreground/70 bg-muted/40 rounded-lg px-2 py-1 mt-2 break-words">
              {error.message}
            </p>
          )}
        </div>
        <div className="flex items-center justify-center gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            onClick={() => reset()}
            className="h-9 rounded-xl text-xs font-bold"
          >
            Reintentar
          </Button>
          <Button
            type="button"
            onClick={() => window.location.reload()}
            className="h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold gap-1.5"
          >
            <RefreshCw size={13} /> Recargar Página
          </Button>
        </div>
      </div>
    </div>
  );
}
