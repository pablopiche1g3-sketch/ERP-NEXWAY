'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { PosStation } from './types';

interface StationState {
  activeStation: PosStation | null;
  activeWarehouse: any | null;
  availableStations: PosStation[];
  establishedStationId: string | null;
  loading: boolean;
}

export function useStation(userEmail: string | undefined) {
  const { toast } = useToast();
  const [state, setState] = useState<StationState>({
    activeStation: null,
    activeWarehouse: null,
    availableStations: [],
    establishedStationId: null,
    loading: true,
  });

  const loadStation = useCallback(async () => {
    if (!userEmail) {
      setState(prev => ({ ...prev, loading: false }));
      return;
    }

    const { data: stConf } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'pos_stations')
      .maybeSingle();
    const stations: PosStation[] = stConf?.value || [];

    const localEstId = typeof window !== 'undefined'
      ? localStorage.getItem('established_station_id')
      : null;

    if (localEstId) {
      const station = stations.find(s => s.id === localEstId);
      if (station) {
        const { data: wh } = await supabase
          .from('warehouses')
          .select('*')
          .eq('id', station.warehouse_id)
          .maybeSingle();
        setState({
          activeStation: station,
          activeWarehouse: wh || null,
          availableStations: stations,
          establishedStationId: localEstId,
          loading: false,
        });
        return;
      } else {
        localStorage.removeItem('established_station_id');
      }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('station_id')
      .eq('email', userEmail)
      .maybeSingle();

    if (profile?.station_id) {
      const station = stations.find(s => s.id === profile.station_id);
      if (station) {
        const { data: wh } = await supabase
          .from('warehouses')
          .select('*')
          .eq('id', station.warehouse_id)
          .maybeSingle();
        setState({
          activeStation: station,
          activeWarehouse: wh || null,
          availableStations: stations,
          establishedStationId: null,
          loading: false,
        });
        return;
      }
    }

    setState(prev => ({ ...prev, availableStations: stations, loading: false }));
  }, [userEmail]);

  useEffect(() => {
    loadStation();
  }, [loadStation]);

  const assignStation = async (stationId: string) => {
    if (!userEmail) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ station_id: stationId })
        .eq('email', userEmail);

      if (error) throw error;

      const station = state.availableStations.find(s => s.id === stationId);
      if (station) {
        const { data: wh } = await supabase
          .from('warehouses')
          .select('*')
          .eq('id', station.warehouse_id)
          .maybeSingle();
        setState(prev => ({ ...prev, activeStation: station, activeWarehouse: wh || null }));
        toast({
          title: "Caja Asignada",
          description: `Se asignó la caja '${station.name}' (Bodega: ${station.warehouse_name || wh?.name || 'Asociada'}).`
        });
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error al asignar caja",
        description: err.message || "No se pudo actualizar la caja asignada."
      });
    }
  };

  const establishStation = () => {
    const station = state.activeStation;
    if (!station) return;
    localStorage.setItem('established_station_id', station.id);
    setState(prev => ({ ...prev, establishedStationId: station.id }));
    toast({
      title: "Caja Establecida Fija",
      description: `Esta terminal quedó asignada permanentemente a '${station.name}'.`
    });
  };

  const clearEstablishedStation = () => {
    localStorage.removeItem('established_station_id');
    setState(prev => ({ ...prev, establishedStationId: null }));
    toast({
      title: "Caja Liberada",
      description: "Se removió el bloqueo fijo de la caja en este dispositivo."
    });
  };

  return { ...state, assignStation, establishStation, clearEstablishedStation };
}
