'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapLocation, MapRoute, MapWaypoint } from '@/contexts/BmsContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  MapPin, 
  Navigation, 
  ExternalLink, 
  Car, 
  Plus, 
  Trash2, 
  Check, 
  X, 
  ShieldCheck,
  Play,
  Pause,
  RotateCcw,
  Bike,
  Receipt,
  DollarSign,
  Clock,
  Route
} from 'lucide-react';

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
  const polylinesRef = useRef<any[]>([]);
  const simMarkerRef = useRef<any>(null);

  const [selectedLocation, setSelectedLocation] = useState<MapLocation | null>(null);
  const [selectedWaypoint, setSelectedWaypoint] = useState<MapWaypoint | null>(null);
  const [isAddingMode, setIsAddingMode] = useState<boolean>(false);
  const [pendingCoords, setPendingCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [newLocationName, setNewLocationName] = useState<string>('');

  // Estados de Simulación / Replay de Motocicleta 🏍️
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simIndex, setSimIndex] = useState<number>(0);
  const simIntervalRef = useRef<any>(null);

  // Extraer todos los puntos concatenados de las rutas para la animación
  const allPathPoints = useMemo(() => {
    if (!routes || routes.length === 0) return [];
    return routes.flatMap(r => r.path);
  }, [routes]);

  // Resumen total de la ruta activa
  const routeSummary = useMemo(() => {
    if (!routes || routes.length === 0) return { totalStops: 0, totalDistKm: 0, totalBilled: 0 };
    
    let totalStops = 0;
    let totalDistKm = 0;
    let totalBilled = 0;

    routes.forEach(r => {
      totalStops += (r.waypoints ? Math.max(0, r.waypoints.length - 1) : 0);
      totalDistKm += (r.totalDistanceKm || 0);
      totalBilled += (r.totalBilled || 0);
    });

    return { totalStops, totalDistKm, totalBilled };
  }, [routes]);

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

      // Limpiar marcadores y polilíneas anteriores
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      polylinesRef.current.forEach(p => p.remove());
      polylinesRef.current = [];
      if (simMarkerRef.current) simMarkerRef.current.remove();

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

      const createWaypointIcon = (order: number, isOrigin: boolean) => {
        return L.divIcon({
          className: 'custom-waypoint-marker',
          html: `<div style="background: ${isOrigin ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, #6366f1, #4f46e5)'}; width: 32px; height: 32px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; color: white; font-weight: 900; font-size: 13px; font-family: sans-serif;">
                  ${isOrigin ? '🏁' : order}
                </div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });
      };

      const greenIcon = createCustomIcon('#10b981');
      const blueIcon = createCustomIcon('#3b82f6');
      const redIcon = createCustomIcon('#ef4444');

      // 1. Dibujar marcadores generales de clientes
      locations.forEach(loc => {
        let icon = redIcon;
        if (loc.type === 'BRANCH') icon = greenIcon;
        else if (loc.type === 'VIP') icon = blueIcon;

        const marker = L.marker([loc.lat, loc.lng], { icon }).addTo(map);

        marker.on('click', () => {
          setSelectedWaypoint(null);
          setSelectedLocation(loc);
          if (onSelectLocation) onSelectLocation(loc);
        });

        markersRef.current.push(marker);
      });

      // 2. Trazar Polilíneas y Waypoints Numerados de las Rutas de la Motocicleta
      if (routes && routes.length > 0) {
        routes.forEach(route => {
          if (route.path && route.path.length >= 2) {
            const polylinePoints = route.path.map(p => [p.lat, p.lng]);
            const polyline = L.polyline(polylinePoints, {
              color: '#6366f1',
              weight: 5,
              opacity: 0.85,
              dashArray: '10, 10'
            }).addTo(map);

            polylinesRef.current.push(polyline);
          }

          // Dibujar Marcadores Numerados de Paradas (Waypoints)
          if (route.waypoints && route.waypoints.length > 0) {
            route.waypoints.forEach(wp => {
              const isOrigin = wp.order === 0;
              const wpIcon = createWaypointIcon(wp.order, isOrigin);
              const wpMarker = L.marker([wp.lat, wp.lng], { icon: wpIcon }).addTo(map);

              const popupContent = `
                <div style="font-family: sans-serif; padding: 4px;">
                  <div style="font-size: 11px; font-weight: 800; color: #6366f1; text-transform: uppercase;">
                    ${isOrigin ? '🏁 Punto de Origen' : `Parada #${wp.order}`}
                  </div>
                  <div style="font-size: 13px; font-weight: 900; color: #1e293b; margin-top: 2px;">
                    ${wp.customerName || wp.name}
                  </div>
                  ${wp.invoiceCorrelative ? `
                    <div style="font-size: 11px; font-weight: 700; color: #059669; margin-top: 4px;">
                      📄 Factura: ${wp.invoiceCorrelative}
                    </div>
                  ` : ''}
                  ${wp.amount !== undefined ? `
                    <div style="font-size: 12px; font-weight: 900; color: #0f172a; margin-top: 2px;">
                      Monto: $${wp.amount.toFixed(2)} (${wp.paymentMethod || 'Efectivo'})
                    </div>
                  ` : ''}
                  ${wp.timestamp ? `
                    <div style="font-size: 10px; color: #64748b; margin-top: 2px;">
                      🕒 Hora: ${new Date(wp.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  ` : ''}
                </div>
              `;

              wpMarker.bindPopup(popupContent);
              wpMarker.on('click', () => {
                setSelectedLocation(null);
                setSelectedWaypoint(wp);
              });

              markersRef.current.push(wpMarker);
            });
          }
        });

        // Ajustar la vista del mapa para encuadrar toda la ruta
        if (polylinesRef.current.length > 0) {
          const group = L.featureGroup(polylinesRef.current);
          map.fitBounds(group.getBounds(), { padding: [40, 40] });
        }
      }
    };

    loadLeaflet();
  }, [locations, routes, isAddingMode, onSelectLocation]);

  // Manejar Animación Replay de Motocicleta 🏍️
  useEffect(() => {
    if (isSimulating && allPathPoints.length >= 2) {
      simIntervalRef.current = setInterval(() => {
        setSimIndex(prevIndex => {
          const nextIndex = prevIndex + 1;
          if (nextIndex >= allPathPoints.length) {
            setIsSimulating(false);
            return 0;
          }

          const currentPt = allPathPoints[nextIndex];
          const L = (window as any).L;
          if (L && mapInstanceRef.current && currentPt) {
            if (!simMarkerRef.current) {
              const motoIcon = L.divIcon({
                className: 'custom-moto-marker',
                html: `<div style="background: #f59e0b; width: 36px; height: 36px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 15px rgba(245,158,11,0.6); display: flex; align-items: center; justify-content: center; font-size: 18px; transform: scale(1.1);">
                        🏍️
                      </div>`,
                iconSize: [36, 36],
                iconAnchor: [18, 18]
              });
              simMarkerRef.current = L.marker([currentPt.lat, currentPt.lng], { icon: motoIcon }).addTo(mapInstanceRef.current);
            } else {
              simMarkerRef.current.setLatLng([currentPt.lat, currentPt.lng]);
            }
            mapInstanceRef.current.panTo([currentPt.lat, currentPt.lng]);
          }

          return nextIndex;
        });
      }, 700);
    } else {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    }

    return () => {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    };
  }, [isSimulating, allPathPoints]);

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
      <div className="absolute top-3 left-14 z-20 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-xl border border-white/10 shadow-lg flex-wrap">
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

        {/* Botón de Animación / Replay de Motocicleta 🏍️ */}
        {allPathPoints.length >= 2 && (
          <div className="flex items-center gap-1 border-l border-white/10 pl-2">
            <Button
              type="button"
              size="sm"
              onClick={() => setIsSimulating(!isSimulating)}
              className={`h-8 text-[11px] font-black rounded-lg transition-all flex items-center gap-1.5 ${
                isSimulating 
                  ? 'bg-amber-500 hover:bg-amber-600 text-slate-950' 
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              {isSimulating ? <Pause size={14} /> : <Play size={14} />}
              {isSimulating ? 'Pausar Replay' : 'Simular Ruta 🏍️'}
            </Button>

            {simIndex > 0 && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => {
                  setIsSimulating(false);
                  setSimIndex(0);
                }}
                className="h-8 w-8 text-slate-400 hover:text-white rounded-lg p-0"
                title="Reiniciar Simulación"
              >
                <RotateCcw size={14} />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Panel Superior Derecho con Métricas de Entrega en Ruta */}
      {routes && routes.length > 0 && (
        <div className="absolute top-3 right-3 z-20 bg-slate-900/90 backdrop-blur-md p-2 rounded-xl border border-white/10 shadow-lg flex items-center gap-3 text-white text-xs flex-wrap">
          <div className="flex items-center gap-1.5">
            <Route size={15} className="text-indigo-400" />
            <div>
              <p className="text-[9px] text-slate-400 font-bold uppercase">Entregas</p>
              <p className="text-xs font-black text-white">{routeSummary.totalStops} Paradas</p>
            </div>
          </div>
          <div className="h-6 w-px bg-white/10" />
          <div className="flex items-center gap-1.5">
            <Bike size={15} className="text-amber-400" />
            <div>
              <p className="text-[9px] text-slate-400 font-bold uppercase">Distancia</p>
              <p className="text-xs font-black text-amber-400">{routeSummary.totalDistKm.toFixed(1)} km</p>
            </div>
          </div>
          <div className="h-6 w-px bg-white/10" />
          <div className="flex items-center gap-1.5">
            <DollarSign size={15} className="text-emerald-400" />
            <div>
              <p className="text-[9px] text-slate-400 font-bold uppercase">Recaudado</p>
              <p className="text-xs font-black text-emerald-400">${routeSummary.totalBilled.toFixed(2)}</p>
            </div>
          </div>
        </div>
      )}

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

      {/* Ficha Flotante del Waypoint / Parada de Factura Seleccionada */}
      {selectedWaypoint && (
        <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 bg-slate-900/95 border border-indigo-500/40 p-4 rounded-2xl shadow-2xl z-20 space-y-3 animate-in slide-in-from-bottom-3 duration-200 text-white">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-black text-amber-400 flex items-center gap-1.5">
                <Receipt size={14} />
                Parada #{selectedWaypoint.order}: {selectedWaypoint.customerName || selectedWaypoint.name}
              </span>
              {selectedWaypoint.invoiceCorrelative && (
                <Badge className="bg-emerald-500/20 text-emerald-300 border-0 text-[10px] font-bold mt-1">
                  Documento {selectedWaypoint.invoiceCorrelative}
                </Badge>
              )}
            </div>
            <button
              onClick={() => setSelectedWaypoint(null)}
              className="text-xs text-slate-400 hover:text-white font-bold p-1"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 bg-slate-950/80 p-2.5 rounded-xl border border-white/10 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 block font-bold uppercase">Monto Cobrado</span>
              <span className="font-mono font-black text-emerald-400 text-sm">
                ${(selectedWaypoint.amount || 0).toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-bold uppercase">Forma de Pago</span>
              <span className="font-bold text-slate-200 text-xs">
                {selectedWaypoint.paymentMethod || 'Efectivo'}
              </span>
            </div>
          </div>

          {selectedWaypoint.timestamp && (
            <p className="text-[10px] text-slate-400 flex items-center gap-1">
              <Clock size={12} className="text-indigo-400" /> Hora de emisión: {new Date(selectedWaypoint.timestamp).toLocaleTimeString()}
            </p>
          )}
        </div>
      )}

      {/* Ficha Flotante del Cliente o Punto Seleccionado */}
      {selectedLocation && !selectedWaypoint && (
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
