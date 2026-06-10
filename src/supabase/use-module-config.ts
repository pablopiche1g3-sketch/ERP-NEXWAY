'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/supabase/client';
import { useUser, ROLE_PERMISSIONS } from '@/supabase/use-user';

export function useModuleConfig() {
  const { role, isAdmin, permissions, loading: loadingUser } = useUser();
  const [globalConfig, setGlobalConfig] = useState<any>(null);
  const [loadingGlobal, setLoadingGlobal] = useState(true);

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
          setGlobalConfig(row?.value || {});
          setLoadingGlobal(false);
        }
      } catch (err) {
        console.error('Error loading module_config:', err);
        if (active) {
          setLoadingGlobal(false);
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
            setGlobalConfig(payload.new.value || {});
          }
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const mergedConfig = useMemo(() => {
    if (!globalConfig) return null;
    
    // Si es admin o gerencia, heredan todo el config global
    if (isAdmin || role === 'gerencia') {
      return globalConfig;
    }

    const merged = { ...globalConfig };
    const safeRole = role ? role.toLowerCase().trim() : 'pedidos';
    const roleModules = ROLE_PERMISSIONS[safeRole] || ROLE_PERMISSIONS['pedidos'];

    // Lista de todos los módulos del sistema
    const allModules = [
      'billing', 'accounting', 'orders', 'inventory', 
      'purchases', 'suppliers', 'quedan', 'quotations', 
      'transfers', 'customers', 'institutional'
    ];

    // Lista de todas las pestañas por módulo (para inicializar permisos)
    const allTabs: Record<string, string[]> = {
      billing: ['facturacion', 'historial', 'nota_credito', 'nota_debito', 'arqueo', 'creditos'],
      accounting: ['diario', 'balance-comprobacion', 'rentabilidad', 'libros_iva', 'mh_forms', 'tributario', 'caja-chica', 'pnl', 'settings'],
      orders: ['interno', 'externo', 'cargar-codigos'],
      inventory: ['existencia', 'maestro', 'kardex', 'toma-fisica', 'carga-masiva', 'entradas', 'config']
    };

    if (permissions) {
      // 1. Validar módulos por permisos individuales
      allModules.forEach(modId => {
        const hasAccess = Array.isArray(permissions.modules) && permissions.modules.includes(modId);
        if (!hasAccess) {
          merged[modId] = false;
        }
      });

      // 2. Validar pestañas individuales
      Object.entries(allTabs).forEach(([modId, tabs]) => {
        tabs.forEach(tabId => {
          const tabKey = `${modId}_${tabId}`;
          const hasAccess = Array.isArray(permissions.tabs) && permissions.tabs.includes(tabKey);
          if (!hasAccess) {
            merged[tabKey] = false;
          }
        });
      });
    } else {
      // Si no tiene permisos personalizados configurados, validar según el ROL por defecto
      allModules.forEach(modId => {
        const hasAccess = roleModules.includes(modId);
        if (!hasAccess) {
          merged[modId] = false;
        }
      });
      
      // Si el rol por defecto tiene acceso al módulo, tiene acceso a todas sus pestañas por defecto
    }

    return merged;
  }, [globalConfig, role, isAdmin, permissions]);

  return { config: mergedConfig, loading: loadingGlobal || loadingUser };
}
