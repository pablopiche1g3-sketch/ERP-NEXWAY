'use client';

import React, { useEffect, useState } from 'react';
import { useBms } from '@/contexts/BmsContext';
import { createPortal } from 'react-dom';

export function TourOverlay() {
  const { isGuideActive, targetElementId } = useBms();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!isGuideActive || !targetElementId) {
      setTargetRect(null);
      return;
    }

    const updateRect = () => {
      const el = document.querySelector(`[data-tour-id="${targetElementId}"]`);
      if (el) {
        setTargetRect(el.getBoundingClientRect());
      }
    };

    updateRect();
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect);
    
    // Check multiple times in case of rendering delays
    const interval = setInterval(updateRect, 300);

    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect);
      clearInterval(interval);
    };
  }, [isGuideActive, targetElementId]);

  // Si no estamos en el navegador aún, no renderizar
  if (typeof document === 'undefined') return null;
  if (!isGuideActive || !targetElementId || !targetRect) return null;

  const padding = 8;
  const top = targetRect.top - padding;
  const left = targetRect.left - padding;
  const width = targetRect.width + (padding * 2);
  const height = targetRect.height + (padding * 2);

  return createPortal(
    <div className="fixed inset-0 z-[90] pointer-events-none transition-all duration-700 ease-in-out overflow-hidden">
      {/* 
        Usamos box-shadow para crear el efecto de spotlight. 
        El elemento en sí es transparente pero proyecta una sombra gigantesca hacia afuera.
      */}
      <div 
        className="absolute rounded-lg border-2 border-indigo-500/80 transition-all duration-700 ease-in-out shadow-[0_0_0_9999px_rgba(15,23,42,0.8)]"
        style={{
          top: `${top}px`,
          left: `${left}px`,
          width: `${width}px`,
          height: `${height}px`,
        }}
      >
        <div className="absolute -inset-1 rounded-lg border border-indigo-400/50 animate-ping opacity-50" />
      </div>
    </div>,
    document.body
  );
}
