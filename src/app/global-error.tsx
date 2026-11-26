'use client';

import React, { useEffect } from 'react';

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    const msg = String(error?.message || error?.name || '');
    const isChunkError =
      msg.includes('ChunkLoadError') ||
      msg.includes('Loading chunk') ||
      msg.includes('Failed to fetch dynamically imported module');

    if (isChunkError && typeof window !== 'undefined') {
      const key = 'nexway_global_chunk_reload_at';
      const last = Number(sessionStorage.getItem(key) || 0);
      if (Date.now() - last > 15000) {
        sessionStorage.setItem(key, String(Date.now()));
        window.location.reload();
      }
    }
  }, [error]);

  return (
    <html lang="es">
      <body style={{ fontFamily: 'Inter, system-ui, sans-serif', background: '#0f172a', color: '#f8fafc', display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', margin: 0, padding: 24 }}>
        <div style={{ maxWidth: 420, background: '#1e293b', border: '1px solid #334155', borderRadius: 16, padding: 24, textAlign: 'center' }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 8px' }}>Actualización de ERP NEXWAY</h2>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 16px', lineHeight: 1.5 }}>
            Se detectó una nueva versión del sistema. Pulsa el botón para recargar con los archivos actualizados.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            Recargar ERP NEXWAY
          </button>
        </div>
      </body>
    </html>
  );
}
