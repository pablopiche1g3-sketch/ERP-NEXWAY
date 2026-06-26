'use client';

import React, { useState, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow, Polyline } from '@react-google-maps/api';
import { MapLocation, MapRoute } from '@/contexts/BmsContext';
import { Button } from '@/components/ui/button';
import { Loader2, Navigation } from 'lucide-react';

const mapContainerStyle = {
  width: '100%',
  height: '100%',
  borderRadius: '0.75rem',
};

const center = {
  lat: 13.6929,
  lng: -89.2182
};

const options = {
  styles: [
    { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
    {
      featureType: "administrative.locality",
      elementType: "labels.text.fill",
      stylers: [{ color: "#d59563" }]
    },
    {
      featureType: "poi",
      elementType: "labels.text.fill",
      stylers: [{ color: "#d59563" }]
    },
    {
      featureType: "poi.park",
      elementType: "geometry",
      stylers: [{ color: "#263c3f" }]
    },
    {
      featureType: "poi.park",
      elementType: "labels.text.fill",
      stylers: [{ color: "#6b9a76" }]
    },
    {
      featureType: "road",
      elementType: "geometry",
      stylers: [{ color: "#38414e" }]
    },
    {
      featureType: "road",
      elementType: "geometry.stroke",
      stylers: [{ color: "#212a37" }]
    },
    {
      featureType: "road",
      elementType: "labels.text.fill",
      stylers: [{ color: "#9ca5b3" }]
    },
    {
      featureType: "road.highway",
      elementType: "geometry",
      stylers: [{ color: "#746855" }]
    },
    {
      featureType: "road.highway",
      elementType: "geometry.stroke",
      stylers: [{ color: "#1f2835" }]
    },
    {
      featureType: "road.highway",
      elementType: "labels.text.fill",
      stylers: [{ color: "#f3d19c" }]
    },
    {
      featureType: "transit",
      elementType: "geometry",
      stylers: [{ color: "#2f3948" }]
    },
    {
      featureType: "transit.station",
      elementType: "labels.text.fill",
      stylers: [{ color: "#d59563" }]
    },
    {
      featureType: "water",
      elementType: "geometry",
      stylers: [{ color: "#17263c" }]
    },
    {
      featureType: "water",
      elementType: "labels.text.fill",
      stylers: [{ color: "#515c6d" }]
    },
    {
      featureType: "water",
      elementType: "labels.text.stroke",
      stylers: [{ color: "#17263c" }]
    }
  ],
  disableDefaultUI: true,
  zoomControl: true,
};

interface CrmMapProps {
  locations: MapLocation[];
  routes: MapRoute[];
}

export function CrmMap({ locations, routes }: CrmMapProps) {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<MapLocation | null>(null);

  const onLoad = useCallback(function callback(mapInstance: google.maps.Map) {
    setMap(mapInstance);
  }, []);

  const onUnmount = useCallback(function callback() {
    setMap(null);
  }, []);

  const getMarkerIcon = (type: MapLocation['type']) => {
    switch (type) {
      case 'BRANCH':
        return 'http://maps.google.com/mapfiles/ms/icons/green-dot.png';
      case 'VIP':
        return 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png';
      case 'DELIVERY':
        return 'http://maps.google.com/mapfiles/ms/icons/red-dot.png';
      default:
        return 'http://maps.google.com/mapfiles/ms/icons/red-dot.png';
    }
  };

  if (!isLoaded) return (
    <div className="w-full h-full flex items-center justify-center bg-slate-900/50 rounded-xl border border-white/5">
      <Loader2 className="animate-spin text-slate-500" size={32} />
    </div>
  );

  return (
    <div className="w-full h-full relative border border-white/10 rounded-xl overflow-hidden shadow-xl shadow-black/50 bg-slate-950">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={13}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={options}
      >
        {locations.map((loc) => (
          <Marker
            key={loc.id}
            position={{ lat: loc.lat, lng: loc.lng }}
            icon={getMarkerIcon(loc.type)}
            onClick={() => setSelectedLocation(loc)}
          />
        ))}

        {routes.map((route) => (
          <Polyline
            key={route.id}
            path={route.path}
            options={{
              strokeColor: '#3b82f6', // blue-500
              strokeOpacity: 0.8,
              strokeWeight: 4,
            }}
          />
        ))}

        {selectedLocation && (
          <InfoWindow
            position={{ lat: selectedLocation.lat, lng: selectedLocation.lng }}
            onCloseClick={() => setSelectedLocation(null)}
          >
            <div className="p-3 text-slate-900 max-w-[200px] font-sans">
              <h3 className="font-bold text-sm mb-1">{selectedLocation.name}</h3>
              <p className="text-[10px] text-slate-600 mb-3 uppercase tracking-wider font-bold">
                Capa: {selectedLocation.type}
              </p>
              
              {selectedLocation.balance !== undefined && (
                <div className="bg-slate-100 p-2 rounded mb-3 border border-slate-200">
                  <p className="text-[9px] text-slate-500 uppercase font-black">Saldo Total</p>
                  <p className="font-mono font-black text-emerald-600 text-sm">
                    ${selectedLocation.balance.toLocaleString()}
                  </p>
                </div>
              )}
              
              <Button size="sm" className="w-full h-8 text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1.5 rounded uppercase tracking-wider">
                <Navigation size={12} /> Planificar
              </Button>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
}
