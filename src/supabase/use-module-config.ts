'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/supabase/client';

export function useModuleConfig() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadConfig() {
      try {
        const { data: row, error } = await supabase
          .from('system_config')
          .select('value')
          .eq('key', 'module_config')
          .maybeSingle();

        if (error) throw error;

        if (active) {
          setData(row?.value);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error loading module_config:', err);
        if (active) {
          setLoading(false);
        }
      }
    }

    loadConfig();

    const channel = supabase
      .channel('module_config_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'system_config', filter: 'key=eq.module_config' },
        (payload: any) => {
          if (active && payload.new) {
            setData(payload.new.value);
          }
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return { config: data, loading };
}
