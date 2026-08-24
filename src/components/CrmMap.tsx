'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MapLocation, MapRoute } from '@/contexts/BmsContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Navigation, ExternalLink, Car, ShieldCheck, Phone, Mail } from 'lucide-react';

interface CrmMapProps {
  locations: MapLocation[];
  routes: MapRoute[];
  onSelectLocation?: (location: MapLocation) => void;
}

export function CrmMap({ locations, routes, onSelectLocation }: CrmMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  const [selectedLocation, setSelectedLocation] = useState<MapLocation | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current) return;

    // Cargar Leaflet CSS y JS de forma dinámica
    const loadLeaflet = async () => {
      if (!(window as any).L) {
        // Cargar CSS
        if (!document.getElementById('leaflet-css')) {
          const link = document.createElement('link');
          link.id = 'leaflet-css';
          link.rel = 'stylesheet';
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          document.head.appendChild(link);
        }

        // Cargar JS
        await new Promise<void>((resolve) => {
          if (document.getElementById('leaflet-js')) {
            resolve();
            return;
          }
          const script = document.createElement('script');
          script.id = 'leaflet-js';
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          script.onload = () => resolve();
          document.head.appendChild(script);
        });
      }

      const L = (window as any).L;
      if (!L) return;

      // Inicializar Mapa centrado en San Salvador, El Salvador
      if (!mapInstanceRef.current && mapContainerRef.current) {
        const map = L.map(mapContainerRef.current, {
          center: [13.6929, -89.2182],
          zoom: 13,
          zoomControl: true
        });

        // Layer de Mapa Oscuro Voyager / OpenStreetMap (sin API Key)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap | ERP NexWay El Salvador'
        }).addTo(map);

        mapInstanceRef.current = map;
      }

      const map = mapInstanceRef.current;
      if (!map) return;

      // Limpiar marcadores anteriores
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];

      // Iconos personalizados SVG sin depender de servidores externos
      const createCustomIcon = (color: string) => {
        return L.divIcon({
          className: 'custom-leaflet-marker',
          html: `<div style="background-color: ${color}; width: 28px; height: 28px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; color: white;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                </div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 28]
        });
      };

      const greenIcon = createCustomIcon('#10b981');
      const blueIcon = createCustomIcon('#3b82f6');
      const redIcon = createCustomIcon('#ef4444');

      // Dibujar marcadores de clientes
      locations.forEach(loc => {
        let icon = redIcon;
        if (loc.type === 'BRANCH') icon = greenIcon;
        else if (loc.type === 'VIP') icon = blueIcon;

        const marker = L.marker([loc.lat, loc.lng], { icon }).addTo(map);

        marker.on('click', () => {
          setSelectedLocation(loc);
          if (onSelectLocation) onSelectLocation(loc);
        });

        markersRef.current.push(marker);
      });
    };

    loadLeaflet();
  }, [locations, onSelectLocation]);

  const openGoogleMapsRoute = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
  };

  const openWazeRoute = (lat: number, lng: number) => {
    window.open(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`, '_blank');
  };

  return (
    <div className="w-full h-full relative border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-xl bg-slate-950 flex flex-col">
      {/* Contenedor del Mapa Leaflet */}
      <div ref={mapContainerRef} className="w-full flex-1 z-10 min-h-[350px]" />

      {/* Ficha Flotante del Cliente Seleccionado en el Mapa */}
      {selectedLocation && (
        <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 bg-white dark:bg-[#0c0d18] border border-slate-200 dark:border-white/15 p-4 rounded-2xl shadow-2xl z-20 space-y-3 animate-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                <MapPin size={14} className="text-indigo-500 shrink-0" />
                {selectedLocation.name}
              </span>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                {selectedLocation.address || 'San Salvador, El Salvador'}
              </p>
            </div>
            <button
              onClick={() => setSelectedLocation(null)}
              className="text-xs text-slate-400 hover:text-slate-600 font-bold p-1"
            >
              ✕
            </button>
          </div>

          <div className="flex items-center justify-between bg-slate-50 dark:bg-white/5 p-2 rounded-xl border border-slate-100 dark:border-white/5 text-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Categoría / Saldo</span>
            <div className="flex items-center gap-2">
              <Badge className={`text-[9px] font-black uppercase ${
                selectedLocation.type === 'VIP' ? 'bg-blue-500/20 text-blue-600' : 'bg-emerald-500/20 text-emerald-600'
              }`}>
                {selectedLocation.type}
              </Badge>
              {selectedLocation.balance !== undefined && (
                <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                  ${selectedLocation.balance.toFixed(2)}
                </span>
              )}
            </div>
          </div>

          {/* Botones de Navegación GPS Directa */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Instrucción de Ruta GPS</span>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                onClick={() => openGoogleMapsRoute(selectedLocation.lat, selectedLocation.lng)}
                className="h-8 text-[10px] font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Navigation size={13} /> Google Maps
              </Button>

              <Button
                type="button"
                onClick={() => openWazeRoute(selectedLocation.lat, selectedLocation.lng)}
                className="h-8 text-[10px] font-bold bg-sky-500 hover:bg-sky-600 text-white rounded-xl flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Car size={13} /> Waze GPS
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
