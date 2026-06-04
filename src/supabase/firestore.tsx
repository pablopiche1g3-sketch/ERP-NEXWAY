'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/supabase/client';

export function useFirestore() {
  return {}; // Dummy db
}

export function doc(dbOrCollection: any, ...pathSegments: string[]) {
  return {}; // Dummy docRef
}

export function collection(db: any, ...pathSegments: string[]) {
  return {}; // Dummy collectionRef
}

export function useCollection<T>(query: any) {
  // Stub for useCollection as it's not actually used anywhere
  return { data: [], loading: false, error: null };
}

export function useDoc<T>(docRef: any) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;

    async function loadConfig() {
      try {
        const { data: row, error: err } = await supabase
          .from('system_config')
          .select('value')
          .eq('key', 'module_config')
          .maybeSingle();

        if (err) throw err;

        if (active) {
          setData(row?.value as unknown as T);
          setLoading(false);
        }
      } catch (err: any) {
        console.error("Error loading system_config from Supabase in useDoc:", err);
        if (active) {
          setError(err);
          setLoading(false);
        }
      }
    }

    loadConfig();

    const channel = supabase
      .channel('system_config_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'system_config', filter: "key=eq.module_config" },
        (payload: any) => {
          if (active && payload.new) {
            setData(payload.new.value as unknown as T);
          }
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [docRef]);

  return { data, loading, error };
}
