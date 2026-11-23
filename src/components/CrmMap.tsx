'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MapLocation, MapRoute } from '@/contexts/BmsContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Navigation, Car, Plus, Trash2, Check, CheckCircle2, UserCheck, Phone, Crosshair, Loader2, Store, LocateFixed } from 'lucide-react';

export function parseCoordsFromText(input: string): { lat: number; lng: number } | null {
  const clean = (input || '').trim();
  if (!clean) return null;

  // Formato !3dLAT!4dLNG de Google Maps
  const bangMatch = clean.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (bangMatch) {
    const lat = parseFloat(bangMatch[1]);
    const lng = parseFloat(bangMatch[2]);
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) return { lat, lng };
  }

  // Formato @LAT,LNG o q=LAT,LNG o texto plano "13.6929, -89.2182"
  const pairMatch = clean.match(/(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})/);
  if (pairMatch) {
    const lat = parseFloat(pairMatch[1]);
    const lng = parseFloat(pairMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }
  return null;
}

export interface SellerRouteStop extends MapLocation {
  sellerEmail?: string;
  sellerName?: string;
  phone?: string;
  notes?: string;
  visited?: boolean;
  visitedAt?: string;
  customerId?: string;
}

export function calculateDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

interface CrmMapProps {
  locations: SellerRouteStop[];
  routes: MapRoute[];
  customers?: { id: string; name: string; phone?: string; address?: string; credit_limit?: number }[];
  branches?: { id: string; name: string }[];
  sellers?: { id: string; full_name: string; email: string }[];
  userLocation?: { lat: number; lng: number } | null;
  originLabel?: string;
  gpsLoading?: boolean;
  onRequestGps?: () => void;
  onSetManualOrigin?: (coords: { lat: number; lng: number }, label?: string) => void;
  focusedLocationId?: string | null;
  onSelectLocation?: (location: SellerRouteStop) => void;
  onAddLocation?: (newLoc: SellerRouteStop) => void;
  onDeleteLocation?: (id: string) => void;
  onToggleVisited?: (id: string) => void;
}

export function CrmMap({
  locations,
  customers = [],
  branches = [],
  sellers = [],
  userLocation = null,
  originLabel,
  gpsLoading = false,
  onRequestGps,
  onSetManualOrigin,
  focusedLocationId,
  onSelectLocation,
  onAddLocation,
  onDeleteLocation,
  onToggleVisited
}: CrmMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const userMarkerRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);

  const [selectedLocation, setSelectedLocation] = useState<SellerRouteStop | null>(null);
  const [mapMode, setMapMode] = useState<'idle' | 'add_client' | 'add_branch' | 'set_origin'>('idle');
  const [pendingCoords, setPendingCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [pendingPinType, setPendingPinType] = useState<'client' | 'branch'>('client');
  const [coordsPasteInput, setCoordsPasteInput] = useState<string>('');

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('custom');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('custom');
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

  // Centrar suavemente cuando se obtiene la ubicación GPS del usuario por primera vez
  const hasCenteredOnGpsRef = useRef(false);
  useEffect(() => {
    if (userLocation && mapInstanceRef.current && !hasCenteredOnGpsRef.current) {
      hasCenteredOnGpsRef.current = true;
      mapInstanceRef.current.flyTo([userLocation.lat, userLocation.lng], 14, { duration: 0.8 });
    }
  }, [userLocation]);

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
        const initialCenter: [number, number] = userLocation
          ? [userLocation.lat, userLocation.lng]
          : [13.6929, -89.2182];
        const map = L.map(mapContainerRef.current, {
          center: initialCenter,
          zoom: 13,
          zoomControl: true
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          subdomains: ['a', 'b', 'c'],
          attribution: '© OpenStreetMap | NexWay ERP Rutas GPS'
        }).addTo(map);

        mapInstanceRef.current = map;
      }

      const map = mapInstanceRef.current;
      if (!map) return;

      map.off('click');
      map.on('click', (e: any) => {
        if (mapMode === 'add_client') {
          setPendingPinType('client');
          setPendingCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
          setCoordsPasteInput(`${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`);
        } else if (mapMode === 'add_branch') {
          setPendingPinType('branch');
          setPendingCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
          setCoordsPasteInput(`${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`);
        } else if (mapMode === 'set_origin' && onSetManualOrigin) {
          onSetManualOrigin({ lat: e.latlng.lat, lng: e.latlng.lng }, 'Ubicación Fijada en Mapa');
          setMapMode('idle');
        }
      });

      // Limpiar marcadores y línea de ruta anteriores
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
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

      // Dibujar marcador de Ubicación Actual del Vendedor (GPS en vivo)
      if (userLocation) {
        const gpsIcon = L.divIcon({
          className: 'user-gps-marker',
          html: `<div style="position: relative; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center;">
                  <span style="position: absolute; width: 34px; height: 34px; border-radius: 50%; background: rgba(14, 165, 233, 0.35); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
                  <span style="position: relative; width: 16px; height: 16px; border-radius: 50%; background: #0284c7; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.5);"></span>
                </div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        });

        userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], { icon: gpsIcon })
          .addTo(map)
          .bindTooltip(originLabel ? `📍 Origen: ${originLabel}` : '📍 Tu Ubicación Actual', { direction: 'top', offset: [0, -10] });

        latLngs.push([userLocation.lat, userLocation.lng]);
      }

      locations.forEach((loc, idx) => {
        let color = '#4f46e5';
        let label = String(idx + 1);
        if (loc.type === 'BRANCH') {
          color = '#059669';
          label = '🏪';
        } else if (loc.visited) {
          color = '#10b981';
          label = '✓';
        } else if (loc.type === 'VIP') {
          color = '#2563eb';
        } else if (loc.type === 'DELIVERY') {
          color = '#e11d48';
        }

        const distTxt = userLocation
          ? ` — ${calculateDistanceKm(userLocation.lat, userLocation.lng, loc.lat, loc.lng)} km`
          : '';

        const marker = L.marker([loc.lat, loc.lng], { icon: createNumberedIcon(color, label) }).addTo(map);
        marker.bindTooltip(
          loc.type === 'BRANCH'
            ? `🏪 Sucursal / Tienda: ${loc.name}`
            : `${idx + 1}. ${loc.name}${distTxt}${loc.visited ? ' (Visitado ✓)' : ''}`,
          { direction: 'top', offset: [0, -24] }
        );

        marker.on('click', () => {
          setSelectedLocation(loc);
          if (onSelectLocation) onSelectLocation(loc);
        });

        markersRef.current.push(marker);
        if (!loc.visited && loc.type !== 'BRANCH') {
          latLngs.push([loc.lat, loc.lng]);
        }
      });

      // Dibujar línea punteada conectando desde el origen actual hacia las paradas pendientes
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
  }, [locations, userLocation, originLabel, mapMode, onSelectLocation, onSetManualOrigin]);

  const handleSaveNewLocation = () => {
    if (!pendingCoords || !newLocationName.trim()) return;

    const isBranch = pendingPinType === 'branch';
    const matchedCust = !isBranch ? customers.find(c => c.id === selectedCustomerId) : undefined;
    const matchedSeller = !isBranch ? sellers.find(s => s.email === newLocationSeller) : undefined;

    const newLoc: SellerRouteStop = {
      id: isBranch ? `branch-${Date.now()}` : `stop-${Date.now()}`,
      name: newLocationName.trim(),
      lat: pendingCoords.lat,
      lng: pendingCoords.lng,
      type: isBranch ? 'BRANCH' : matchedCust ? 'VIP' : 'DELIVERY',
      balance: matchedCust?.credit_limit || 0,
      address: newLocationAddress.trim() || `GPS: ${pendingCoords.lat.toFixed(5)}, ${pendingCoords.lng.toFixed(5)}`,
      phone: newLocationPhone.trim() || matchedCust?.phone || '',
      customerId: matchedCust?.id,
      sellerEmail: isBranch ? '' : matchedSeller?.email || '',
      sellerName: isBranch ? 'Sucursal / Tienda' : matchedSeller?.full_name || 'Sin asignar',
      notes: newLocationNotes.trim() || '',
      visited: false
    };

    if (onAddLocation) {
      onAddLocation(newLoc);
    }

    if (isBranch && onSetManualOrigin) {
      onSetManualOrigin({ lat: pendingCoords.lat, lng: pendingCoords.lng }, newLoc.name);
    }

    setPendingCoords(null);
    setCoordsPasteInput('');
    setSelectedCustomerId('custom');
    setSelectedBranchId('custom');
    setNewLocationName('');
    setNewLocationAddress('');
    setNewLocationPhone('');
    setNewLocationNotes('');
    setMapMode('idle');
  };

  const buildGoogleMapsUrl = (destLat: number, destLng: number) => {
    const originParam = userLocation ? `&origin=${userLocation.lat},${userLocation.lng}` : '';
    return `https://www.google.com/maps/dir/?api=1${originParam}&destination=${destLat},${destLng}&travelmode=driving`;
  };

  return (
    <div className="w-full h-full relative rounded-2xl overflow-hidden bg-slate-950 flex flex-col">
      {/* Barra Superior de Herramientas del Mapa */}
      <div className="absolute top-3 left-14 right-3 z-20 flex flex-wrap items-center gap-1.5 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-xl border border-white/10 shadow-lg w-fit">
        <Button
          type="button"
          size="sm"
          variant={mapMode === 'add_client' ? 'default' : 'outline'}
          onClick={() => {
            setMapMode(mapMode === 'add_client' ? 'idle' : 'add_client');
            setPendingCoords(null);
          }}
          className={`h-8 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 ${
            mapMode === 'add_client'
              ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-black'
              : 'bg-slate-950/80 text-white border-white/15 hover:bg-white/10'
          }`}
        >
          <Plus size={14} />
          {mapMode === 'add_client' ? 'Clic en Mapa (Cliente)...' : 'Agregar Cliente'}
        </Button>

        <Button
          type="button"
          size="sm"
          variant={mapMode === 'add_branch' ? 'default' : 'outline'}
          onClick={() => {
            setMapMode(mapMode === 'add_branch' ? 'idle' : 'add_branch');
            setPendingCoords(null);
          }}
          className={`h-8 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 ${
            mapMode === 'add_branch'
              ? 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black'
              : 'bg-slate-950/80 text-emerald-300 border-emerald-500/35 hover:bg-emerald-500/20'
          }`}
        >
          <Store size={13} />
          {mapMode === 'add_branch' ? 'Clic en Mapa (Sucursal)...' : 'Fijar Sucursal / Tienda'}
        </Button>

        {onSetManualOrigin && (
          <Button
            type="button"
            size="sm"
            variant={mapMode === 'set_origin' ? 'default' : 'outline'}
            onClick={() => {
              setMapMode(mapMode === 'set_origin' ? 'idle' : 'set_origin');
              setPendingCoords(null);
            }}
            className={`h-8 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              mapMode === 'set_origin'
                ? 'bg-sky-400 hover:bg-sky-500 text-slate-950 font-black'
                : 'bg-slate-950/80 text-sky-300 border-sky-500/35 hover:bg-sky-500/20'
            }`}
            title="Si el GPS de tu PC da otra ubicación, haz clic en el mapa para fijar dónde estás realmente"
          >
            <LocateFixed size={13} />
            {mapMode === 'set_origin' ? 'Clic donde estás...' : 'Corregir Mi Ubicación'}
          </Button>
        )}

        {onRequestGps && (
          <Button
            type="button"
            size="sm"
            onClick={() => {
              onRequestGps();
              if (userLocation && mapInstanceRef.current) {
                mapInstanceRef.current.flyTo([userLocation.lat, userLocation.lng], 15, { duration: 0.7 });
              }
            }}
            disabled={gpsLoading}
            className="h-8 text-[11px] font-bold rounded-lg flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white"
          >
            {gpsLoading ? <Loader2 size={13} className="animate-spin" /> : <Crosshair size={13} />}
            GPS
          </Button>
        )}
      </div>

      {/* Formulario Emergente para Vincular Cliente o Sucursal / Tienda */}
      {pendingCoords && (
        <div className="absolute top-16 left-4 right-4 sm:left-14 sm:w-96 bg-card border border-indigo-500/40 p-4 rounded-2xl shadow-2xl z-30 space-y-3 animate-in fade-in">
          <div className="flex justify-between items-center">
            <span className={`text-xs font-black flex items-center gap-1.5 ${pendingPinType === 'branch' ? 'text-emerald-600 dark:text-emerald-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
              {pendingPinType === 'branch' ? <Store size={14} /> : <MapPin size={14} />}
              {pendingPinType === 'branch' ? 'Fijar Sucursal / Tienda' : 'Registrar Parada de Cliente'}
            </span>
            <button onClick={() => setPendingCoords(null)} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
          </div>

          {/* Pegar enlace de Google Maps o Coordenadas exactas */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-muted-foreground">
              Coordenadas o Enlace de Google Maps (Opcional para precisión exacta)
            </label>
            <Input
              placeholder="Ej. 13.7012, -89.2244 o pega link de Google Maps"
              value={coordsPasteInput}
              onChange={(e) => {
                const v = e.target.value;
                setCoordsPasteInput(v);
                const parsed = parseCoordsFromText(v);
                if (parsed) {
                  setPendingCoords(parsed);
                  if (mapInstanceRef.current) {
                    mapInstanceRef.current.flyTo([parsed.lat, parsed.lng], 16, { duration: 0.6 });
                  }
                }
              }}
              className="h-8 text-[11px] font-mono rounded-xl"
            />
          </div>

          {pendingPinType === 'branch' ? (
            <>
              {branches.length > 0 && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground">Sucursal del ERP</label>
                  <Select
                    value={selectedBranchId}
                    onValueChange={(val) => {
                      setSelectedBranchId(val);
                      const found = branches.find((b) => b.id === val);
                      if (found) setNewLocationName(found.name);
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs rounded-xl">
                      <SelectValue placeholder="Elegir sucursal..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-48">
                      <SelectItem value="custom">-- Escribir Nombre de Tienda --</SelectItem>
                      {branches.map((b) => (
                        <SelectItem key={b.id} value={b.id} className="text-xs">{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Input
                placeholder="Nombre de la Sucursal o Tienda *"
                value={newLocationName}
                onChange={e => setNewLocationName(e.target.value)}
                className="h-8 text-xs rounded-xl"
                autoFocus
              />

              <Input
                placeholder="Dirección exacta de la tienda..."
                value={newLocationAddress}
                onChange={e => setNewLocationAddress(e.target.value)}
                className="h-8 text-xs rounded-xl"
              />
            </>
          ) : (
            <>
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
            </>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              onClick={handleSaveNewLocation}
              disabled={!newLocationName.trim()}
              className={`flex-1 h-8 text-xs font-bold text-white rounded-xl gap-1 ${
                pendingPinType === 'branch' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              <Check size={14} /> {pendingPinType === 'branch' ? 'Guardar Sucursal y Usar de Origen' : 'Guardar en Ruta'}
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
              {userLocation && (
                <p className="text-[10px] text-sky-600 dark:text-sky-400 font-bold mt-1">
                  📏 A {calculateDistanceKm(userLocation.lat, userLocation.lng, selectedLocation.lat, selectedLocation.lng)} km de tu ubicación GPS
                </p>
              )}
              {selectedLocation.sellerName && (
                <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1 mt-0.5">
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
              onClick={() => window.open(buildGoogleMapsUrl(selectedLocation.lat, selectedLocation.lng), '_blank')}
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
