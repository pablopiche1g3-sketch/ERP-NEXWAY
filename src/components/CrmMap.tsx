'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MapLocation, MapRoute } from '@/contexts/BmsContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Navigation, Car, Plus, Trash2, Check, CheckCircle2, UserCheck, Phone } from 'lucide-react';

export interface SellerRouteStop extends MapLocation {
  sellerEmail?: string;
  sellerName?: string;
  phone?: string;
  notes?: string;
  visited?: boolean;
  visitedAt?: string;
  customerId?: string;
}

interface CrmMapProps {
  locations: SellerRouteStop[];
  routes: MapRoute[];
  customers?: { id: string; name: string; phone?: string; address?: string; credit_limit?: number }[];
  sellers?: { id: string; full_name: string; email: string }[];
  focusedLocationId?: string | null;
  onSelectLocation?: (location: SellerRouteStop) => void;
  onAddLocation?: (newLoc: SellerRouteStop) => void;
  onDeleteLocation?: (id: string) => void;
  onToggleVisited?: (id: string) => void;
}

export function CrmMap({
  locations,
  customers = [],
  sellers = [],
  focusedLocationId,
  onSelectLocation,
  onAddLocation,
  onDeleteLocation,
  onToggleVisited
}: CrmMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);

  const [selectedLocation, setSelectedLocation] = useState<SellerRouteStop | null>(null);
  const [isAddingMode, setIsAddingMode] = useState<boolean>(false);
  const [pendingCoords, setPendingCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('custom');
  const [newLocationName, setNewLocationName] = useState<string>('');
  const [newLocationAddress, setNewLocationAddress] = useState<string>('');
  const [newLocationPhone, setNewLocationPhone] = useState<string>('');
  const [newLocationSeller, setNewLocationSeller] = useState<string>('all');
  const [newLocationNotes, setNewLocationNotes] = useState<string>('');

  // Centrar mapa cuando el usuario hace clic en una tarjeta del panel lateral
  useEffect(() => {
    if (!focusedLocationId || !mapInstanceRef.current) return;
    const found = locations.find(l => l.id === focusedLocationId);
    if (found) {
      mapInstanceRef.current.flyTo([found.lat, found.lng], 15, { duration: 0.7 });
      setSelectedLocation(found);
    }
  }, [focusedLocationId, locations]);

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

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          subdomains: ['a', 'b', 'c'],
          attribution: '© OpenStreetMap | NexWay ERP Rutas'
        }).addTo(map);

        mapInstanceRef.current = map;
      }

      const map = mapInstanceRef.current;
      if (!map) return;

      map.off('click');
      map.on('click', (e: any) => {
        if (isAddingMode) {
          setPendingCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
        }
      });

      // Limpiar marcadores y línea de ruta anteriores
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      if (polylineRef.current) {
        polylineRef.current.remove();
        polylineRef.current = null;
      }

      const createNumberedIcon = (color: string, label: string) => {
        return L.divIcon({
          className: 'custom-leaflet-marker',
          html: `<div style="background-color: ${color}; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; color: white; font-weight: 900; font-size: 11px; font-family: sans-serif;">
                  ${label}
                </div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 30]
        });
      };

      const latLngs: [number, number][] = [];

      locations.forEach((loc, idx) => {
        let color = '#4f46e5'; // indigo (pendiente)
        let label = String(idx + 1);
        if (loc.visited) {
          color = '#10b981'; // emerald (visitado)
          label = '✓';
        } else if (loc.type === 'BRANCH') {
          color = '#059669';
          label = 'S';
        } else if (loc.type === 'VIP') {
          color = '#2563eb';
        } else if (loc.type === 'DELIVERY') {
          color = '#e11d48';
        }

        const marker = L.marker([loc.lat, loc.lng], { icon: createNumberedIcon(color, label) }).addTo(map);
        marker.bindTooltip(`${idx + 1}. ${loc.name}${loc.visited ? ' (Visitado ✓)' : ''}`, { direction: 'top', offset: [0, -24] });

        marker.on('click', () => {
          setSelectedLocation(loc);
          if (onSelectLocation) onSelectLocation(loc);
        });

        markersRef.current.push(marker);
        latLngs.push([loc.lat, loc.lng]);
      });

      // Dibujar línea punteada conectando la ruta de visitas en orden
      if (latLngs.length >= 2) {
        polylineRef.current = L.polyline(latLngs, {
          color: '#6366f1',
          weight: 3.5,
          opacity: 0.85,
          dashArray: '8, 8'
        }).addTo(map);
      }
    };

    loadLeaflet();
  }, [locations, isAddingMode, onSelectLocation]);

  const handleSaveNewLocation = () => {
    if (!pendingCoords || !newLocationName.trim()) return;

    const matchedCust = customers.find(c => c.id === selectedCustomerId);
    const matchedSeller = sellers.find(s => s.email === newLocationSeller);

    const newLoc: SellerRouteStop = {
      id: `stop-${Date.now()}`,
      name: newLocationName.trim(),
      lat: pendingCoords.lat,
      lng: pendingCoords.lng,
      type: matchedCust ? 'VIP' : 'DELIVERY',
      balance: matchedCust?.credit_limit || 0,
      address: newLocationAddress.trim() || `GPS: ${pendingCoords.lat.toFixed(4)}, ${pendingCoords.lng.toFixed(4)}`,
      phone: newLocationPhone.trim() || matchedCust?.phone || '',
      customerId: matchedCust?.id,
      sellerEmail: matchedSeller?.email || '',
      sellerName: matchedSeller?.full_name || 'Sin asignar',
      notes: newLocationNotes.trim() || '',
      visited: false
    };

    if (onAddLocation) {
      onAddLocation(newLoc);
    }

    setPendingCoords(null);
    setSelectedCustomerId('custom');
    setNewLocationName('');
    setNewLocationAddress('');
    setNewLocationPhone('');
    setNewLocationNotes('');
    setIsAddingMode(false);
  };

  return (
    <div className="w-full h-full relative rounded-2xl overflow-hidden bg-slate-950 flex flex-col">
      {/* Barra Superior de Herramientas del Mapa */}
      <div className="absolute top-3 left-14 z-20 flex flex-wrap items-center gap-2 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-xl border border-white/10 shadow-lg">
        <Button
          type="button"
          size="sm"
          variant={isAddingMode ? 'default' : 'outline'}
          onClick={() => {
            setIsAddingMode(!isAddingMode);
            setPendingCoords(null);
          }}
          className={`h-8 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 ${
            isAddingMode
              ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-black'
              : 'bg-slate-950/80 text-white border-white/15 hover:bg-white/10'
          }`}
        >
          <Plus size={14} />
          {isAddingMode ? 'Haz Clic en el Mapa para Fijar Cliente...' : 'Agregar Parada de Cliente'}
        </Button>

        <div className="hidden sm:flex items-center gap-2 px-2 text-[10px] text-slate-300 font-semibold">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span> Pendiente</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> Visitado ✓</span>
        </div>
      </div>

      {/* Formulario Emergente para Vincular Cliente Real al Hacer Clic */}
      {pendingCoords && (
        <div className="absolute top-16 left-4 right-4 sm:left-14 sm:w-96 bg-card border border-indigo-500/40 p-4 rounded-2xl shadow-2xl z-30 space-y-3 animate-in fade-in">
          <div className="flex justify-between items-center">
            <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
              <MapPin size={14} /> Registrar Parada en Ruta de Vendedores
            </span>
            <button onClick={() => setPendingCoords(null)} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
          </div>

          {customers.length > 0 && (
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Cliente del Directorio (Opcional)</label>
              <Select
                value={selectedCustomerId}
                onValueChange={(val) => {
                  setSelectedCustomerId(val);
                  const found = customers.find(c => c.id === val);
                  if (found) {
                    setNewLocationName(found.name);
                    setNewLocationAddress(found.address || '');
                    setNewLocationPhone(found.phone || '');
                  }
                }}
              >
                <SelectTrigger className="h-8 text-xs rounded-xl">
                  <SelectValue placeholder="Elegir cliente existente..." />
                </SelectTrigger>
                <SelectContent className="max-h-48">
                  <SelectItem value="custom">-- Escribir Nombre Manualmente --</SelectItem>
                  {customers.map(c => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Input
            placeholder="Nombre del Cliente o Punto de Visita *"
            value={newLocationName}
            onChange={e => setNewLocationName(e.target.value)}
            className="h-8 text-xs rounded-xl"
            autoFocus
          />

          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Dirección / Referencia"
              value={newLocationAddress}
              onChange={e => setNewLocationAddress(e.target.value)}
              className="h-8 text-xs rounded-xl"
            />
            <Input
              placeholder="Teléfono / WhatsApp"
              value={newLocationPhone}
              onChange={e => setNewLocationPhone(e.target.value)}
              className="h-8 text-xs rounded-xl"
            />
          </div>

          {sellers.length > 0 && (
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">Asignar a Vendedor</label>
              <Select value={newLocationSeller} onValueChange={setNewLocationSeller}>
                <SelectTrigger className="h-8 text-xs rounded-xl">
                  <SelectValue placeholder="Seleccionar vendedor..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Cualquier Vendedor (Ruta General)</SelectItem>
                  {sellers.map(s => (
                    <SelectItem key={s.id} value={s.email} className="text-xs">{s.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Input
            placeholder="Objetivo de visita (Ej. Cotizar pintura, cobrar CCF...)"
            value={newLocationNotes}
            onChange={e => setNewLocationNotes(e.target.value)}
            className="h-8 text-xs rounded-xl"
          />

          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              onClick={handleSaveNewLocation}
              disabled={!newLocationName.trim()}
              className="flex-1 h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl gap-1"
            >
              <Check size={14} /> Guardar en Ruta
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setPendingCoords(null)}
              className="h-8 text-xs"
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Contenedor del Mapa Leaflet */}
      <div ref={mapContainerRef} className="w-full flex-1 z-10 min-h-[380px]" />

      {/* Ficha Flotante del Cliente Seleccionado en el Mapa */}
      {selectedLocation && (
        <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 bg-card border border-border p-4 rounded-2xl shadow-2xl z-20 space-y-3 animate-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-xs font-black text-foreground flex items-center gap-1.5">
                <MapPin size={14} className="text-indigo-500 shrink-0" />
                {selectedLocation.name}
              </span>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {selectedLocation.address || 'Ubicación GPS'}
              </p>
              {selectedLocation.sellerName && (
                <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1 mt-1">
                  <UserCheck size={11} /> Vendedor: {selectedLocation.sellerName}
                </p>
              )}
              {selectedLocation.notes && (
                <p className="text-[10px] text-foreground/80 italic mt-1">“{selectedLocation.notes}”</p>
              )}
            </div>
            <button
              onClick={() => setSelectedLocation(null)}
              className="text-xs text-muted-foreground hover:text-foreground font-bold p-1"
            >
              ✕
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {onToggleVisited && (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  onToggleVisited(selectedLocation.id);
                  setSelectedLocation(prev => prev ? { ...prev, visited: !prev.visited } : null);
                }}
                className={`flex-1 h-7 text-[10px] font-bold rounded-lg gap-1 ${
                  selectedLocation.visited
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
              >
                <CheckCircle2 size={12} />
                {selectedLocation.visited ? 'Visitado ✓' : 'Marcar Visitado'}
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${selectedLocation.lat},${selectedLocation.lng}`, '_blank')}
              className="h-7 px-2 text-[10px] font-bold rounded-lg gap-1"
            >
              <Navigation size={11} /> Maps
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => window.open(`https://waze.com/ul?ll=${selectedLocation.lat},${selectedLocation.lng}&navigate=yes`, '_blank')}
              className="h-7 px-2 text-[10px] font-bold rounded-lg gap-1"
            >
              <Car size={11} /> Waze
            </Button>
            {selectedLocation.phone && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => window.open(`https://wa.me/${selectedLocation.phone!.replace(/[^0-9]/g, '')}`, '_blank')}
                className="h-7 px-2 text-[10px] font-bold text-emerald-600 rounded-lg"
                title="WhatsApp"
              >
                <Phone size={11} />
              </Button>
            )}
            {onDeleteLocation && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  onDeleteLocation(selectedLocation.id);
                  setSelectedLocation(null);
                }}
                className="h-7 w-7 p-0 text-rose-500 hover:bg-rose-500/10 rounded-lg"
                title="Quitar parada"
              >
                <Trash2 size={12} />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
