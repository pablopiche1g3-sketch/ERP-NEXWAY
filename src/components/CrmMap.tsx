'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MapLocation, MapRoute } from '@/contexts/BmsContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { MapPin, Navigation, ExternalLink, Car, Plus, Trash2, Check, X, ShieldCheck } from 'lucide-react';

interface CrmMapProps {
  locations: MapLocation[];
  routes: MapRoute[];
  onSelectLocation?: (location: MapLocation) => void;
  onAddLocation?: (newLoc: MapLocation) => void;
  onDeleteLocation?: (id: string) => void;
}

export function CrmMap({ locations, routes, onSelectLocation, onAddLocation, onDeleteLocation }: CrmMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  const [selectedLocation, setSelectedLocation] = useState<MapLocation | null>(null);
  const [isAddingMode, setIsAddingMode] = useState<boolean>(false);
  const [pendingCoords, setPendingCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [newLocationName, setNewLocationName] = useState<string>('');

  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current) return;

    const loadLeaflet = async () => {
      if (!(window as any).L) {
        if (!document.getElementById('leaflet-css')) {
          const link = document.createElement('link');
          link.id = 'leaflet-css';
          link.rel = 'stylesheet';
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          document.head.appendChild(link);
        }

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

      if (!mapInstanceRef.current && mapContainerRef.current) {
        const map = L.map(mapContainerRef.current, {
          center: [13.6929, -89.2182],
          zoom: 13,
          zoomControl: true
        });

        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap | ERP NexWay El Salvador'
        }).addTo(map);

        mapInstanceRef.current = map;
      }

      const map = mapInstanceRef.current;
      if (!map) return;

      // Evento Click en el Mapa para Agregar Dirección si el modo está activo
      map.off('click');
      map.on('click', (e: any) => {
        if (isAddingMode) {
          setPendingCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
        }
      });

      // Limpiar marcadores anteriores
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];

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
  }, [locations, isAddingMode, onSelectLocation]);

  const handleSaveNewLocation = () => {
    if (!pendingCoords || !newLocationName.trim()) return;

    const newLoc: MapLocation = {
      id: `loc-${Date.now()}`,
      name: newLocationName.trim(),
      lat: pendingCoords.lat,
      lng: pendingCoords.lng,
      type: 'DELIVERY',
      balance: 0,
      address: `Coordenadas: ${pendingCoords.lat.toFixed(4)}, ${pendingCoords.lng.toFixed(4)}`
    };

    if (onAddLocation) {
      onAddLocation(newLoc);
    }

    setPendingCoords(null);
    setNewLocationName('');
    setIsAddingMode(false);
  };

  const handleDeleteCurrentLocation = (locId: string) => {
    if (onDeleteLocation) {
      onDeleteLocation(locId);
    }
    setSelectedLocation(null);
  };

  return (
    <div className="w-full h-full relative border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-xl bg-slate-950 flex flex-col">
      
      {/* Barra de Herramientas Superior del Mapa */}
      <div className="absolute top-3 left-14 z-20 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-xl border border-white/10 shadow-lg">
        <Button
          type="button"
          size="sm"
          variant={isAddingMode ? "default" : "outline"}
          onClick={() => {
            setIsAddingMode(!isAddingMode);
            setPendingCoords(null);
          }}
          className={`h-8 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 ${
            isAddingMode ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-black' : 'bg-slate-950/80 text-white border-white/10 hover:bg-white/10'
          }`}
        >
          <Plus size={14} />
          {isAddingMode ? 'Haga Clic en el Mapa...' : 'Agregar Dirección'}
        </Button>
      </div>

      {/* Formulario Emergente para Confirmar Nueva Dirección al Hacer Clic */}
      {pendingCoords && (
        <div className="absolute top-16 left-4 right-4 sm:left-14 sm:w-80 bg-slate-900/95 border border-amber-500/40 p-3.5 rounded-2xl shadow-2xl z-30 space-y-3 animate-in fade-in">
          <div className="flex justify-between items-center">
            <span className="text-xs font-black text-amber-400 flex items-center gap-1">
              <MapPin size={14} /> Confirmar Nueva Dirección
            </span>
            <button onClick={() => setPendingCoords(null)} className="text-xs text-slate-400 hover:text-white">✕</button>
          </div>
          <Input
            placeholder="Nombre de la Dirección o Cliente..."
            value={newLocationName}
            onChange={e => setNewLocationName(e.target.value)}
            className="h-9 bg-slate-950 border-white/10 text-xs font-medium text-white rounded-xl"
            autoFocus
          />
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={handleSaveNewLocation}
              disabled={!newLocationName.trim()}
              className="flex-1 h-8 text-[11px] font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl flex items-center justify-center gap-1"
            >
              <Check size={14} /> Guardar Punto
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setPendingCoords(null)}
              className="h-8 text-[11px] text-slate-400 hover:text-white"
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Contenedor del Mapa Leaflet */}
      <div ref={mapContainerRef} className="w-full flex-1 z-10 min-h-[350px]" />

      {/* Ficha Flotante del Cliente o Punto Seleccionado */}
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

          {/* Botón de Borrar Dirección */}
          <div className="pt-1">
            <Button
              type="button"
              onClick={() => handleDeleteCurrentLocation(selectedLocation.id)}
              className="w-full h-8 text-[11px] font-bold bg-rose-500/10 hover:bg-rose-500 text-rose-600 hover:text-white border border-rose-500/20 rounded-xl flex items-center justify-center gap-1.5 transition-colors"
            >
              <Trash2 size={13} /> Borrar Dirección
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
