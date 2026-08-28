'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type AuditCategory = 
  | 'limpieza' 
  | 'contabilidad' 
  | 'facturacion' 
  | 'inventario' 
  | 'compras' 
  | 'finanzas' 
  | 'crm' 
  | 'logistica' 
  | 'gerencia';

export interface AuditIssue {
  id: string;
  category: AuditCategory;
  severity: 'critico' | 'advertencia' | 'optimizacion';
  title: string;
  description: string;
  recommendation: string;
  entityId?: string;
  canAutoFix: boolean;
  fixType?: 'clear_orphans' | 'balance_journal' | 'cancel_stale_prefactura' | 'clean_localstorage';
}

export function useNexbotAuditor() {
  const { toast } = useToast();
  const [issues, setIssues] = useState<AuditIssue[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);

  const runAudit = useCallback(async () => {
    setIsScanning(true);
    const discoveredIssues: AuditIssue[] = [];

    try {
      // ─── 1. AUDITORÍA DE LIMPIEZA & OPTIMIZACIÓN RESIDUAL ─────────
      if (typeof window !== 'undefined') {
        const legacyKeys = ['nexway_draft_sales_list', 'established_station_mode', 'pos_station_mode'];
        let hasLegacyKeys = false;
        legacyKeys.forEach(k => {
          if (localStorage.getItem(k)) hasLegacyKeys = true;
        });

        if (hasLegacyKeys) {
          discoveredIssues.push({
            id: 'legacy-storage-cleanup',
            category: 'limpieza',
            severity: 'optimizacion',
            title: 'Claves residuales en almacenamiento local',
            description: 'Se detectaron configuraciones temporales que ya no son necesarias tras la centralización en Supabase.',
            recommendation: 'Limpiar el almacenamiento local para optimizar el rendimiento y memoria del navegador.',
            canAutoFix: true,
            fixType: 'clean_localstorage'
          });
        }
      }

      // ─── 2. AUDITORÍA DE FACTURACIÓN & PRE-FACTURAS (/billing) ────
      const { data: stalePreFacturas } = await supabase
        .from('sales')
        .select('*')
        .eq('status', 'PENDIENTE_COBRO')
        .order('created_at', { ascending: true });

      if (stalePreFacturas && stalePreFacturas.length > 0) {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const overdue = stalePreFacturas.filter(s => s.created_at < oneHourAgo);

        if (overdue.length > 0) {
          discoveredIssues.push({
            id: 'stale-prefacturas',
            category: 'facturacion',
            severity: 'advertencia',
            title: `${overdue.length} Pre-Facturas pendientes sin cobrar (+1 hora)`,
            description: `Existen ${overdue.length} vales tomados por vendedores que no han sido formalizados en Caja Principal: ${overdue.map(s => s.correlative).slice(0, 3).join(', ')}.`,
            recommendation: 'Cobrarlas en la Caja Principal o anular los vales caducados para liberar las órdenes.',
            canAutoFix: true,
            fixType: 'cancel_stale_prefactura'
          });
        }
      }

      // ─── 3. AUDITORÍA CONTABLE (/accounting) ──────────────────────
      const { data: journalEntries } = await supabase
        .from('journal')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(40);

      if (journalEntries && journalEntries.length > 0) {
        let unbalancedCount = 0;
        journalEntries.forEach(entry => {
          if (Array.isArray(entry.lines)) {
            const debits = entry.lines.reduce((acc: number, l: any) => acc + (Number(l.debit) || 0), 0);
            const credits = entry.lines.reduce((acc: number, l: any) => acc + (Number(l.credit) || 0), 0);
            if (Math.abs(debits - credits) > 0.01) {
              unbalancedCount++;
            }
          }
        });

        if (unbalancedCount > 0) {
          discoveredIssues.push({
            id: 'unbalanced-journal-entries',
            category: 'contabilidad',
            severity: 'critico',
            title: `${unbalancedCount} Asientos contables con descuadre en diario`,
            description: `Se detectaron ${unbalancedCount} partidas contables recientes donde el Total Débito no coincide exactamente con el Total Crédito.`,
            recommendation: 'Revisar y cuadrar los asientos en el módulo de Contabilidad para mantener balance fiscal exacto.',
            canAutoFix: false
          });
        }
      }

      // ─── 4. AUDITORÍA DE INVENTARIO & KARDEX (/inventory) ─────────
      const { data: negativeStocks } = await supabase
        .from('inventory_stock')
        .select('*')
        .lt('quantity', 0)
        .limit(10);

      if (negativeStocks && negativeStocks.length > 0) {
        discoveredIssues.push({
          id: 'negative-inventory-stock',
          category: 'inventario',
          severity: 'advertencia',
          title: `${negativeStocks.length} Productos con stock negativo`,
          description: `Los productos con SKU (${negativeStocks.map(s => s.sku).join(', ')}) registran existencias por debajo de 0.`,
          recommendation: 'Realizar un ajuste de inventario o registrar la compra/ingreso pendiente en bodega.',
          canAutoFix: false
        });
      }

      // ─── 5. AUDITORÍA DE COMPRAS & PROVEEDORES (/compras) ─────────
      const { data: pendingPurchases } = await supabase
        .from('purchase_orders')
        .select('*')
        .eq('status', 'PENDIENTE')
        .limit(10);

      if (pendingPurchases && pendingPurchases.length > 0) {
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
        const oldPurchases = pendingPurchases.filter(p => p.created_at < threeDaysAgo);

        if (oldPurchases.length > 0) {
          discoveredIssues.push({
            id: 'stale-purchase-orders',
            category: 'compras',
            severity: 'advertencia',
            title: `${oldPurchases.length} Órdenes de compra pendientes (+3 días)`,
            description: `Existen órdenes de compra sin recepción confirmada en bodega: ${oldPurchases.map(p => p.correlative || p.id?.slice(0, 6)).join(', ')}.`,
            recommendation: 'Confirmar la recepción de mercadería o cancelar las órdenes no despachadas por el proveedor.',
            canAutoFix: false
          });
        }
      }

      // ─── 6. AUDITORÍA DE FINANZAS & CRÉDITOS (/finanzas) ──────────
      const { data: creditSales } = await supabase
        .from('sales')
        .select('*')
        .eq('payment_method', 'Credito')
        .eq('status', 'PENDIENTE')
        .limit(20);

      if (creditSales && creditSales.length > 0) {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const overdueCredits = creditSales.filter(c => c.created_at < thirtyDaysAgo);

        if (overdueCredits.length > 0) {
          discoveredIssues.push({
            id: 'overdue-credit-sales',
            category: 'finanzas',
            severity: 'advertencia',
            title: `${overdueCredits.length} Facturas al crédito con saldo vencido (+30 días)`,
            description: `Se registran cuentas por cobrar vencidas de clientes: ${overdueCredits.map(c => c.customer_name).slice(0, 3).join(', ')}.`,
            recommendation: 'Gestionar la cobranza o registrar los abonos pendientes en el módulo de Cuentas por Cobrar.',
            canAutoFix: false
          });
        }
      }

      // ─── 7. AUDITORÍA DE TRASLADOS Y LOGÍSTICA (/logistica) ───────
      const { data: pendingTransfers } = await supabase
        .from('transfers')
        .select('*')
        .eq('status', 'PENDIENTE')
        .limit(10);

      if (pendingTransfers && pendingTransfers.length > 0) {
        discoveredIssues.push({
          id: 'pending-stock-transfers',
          category: 'logistica',
          severity: 'optimizacion',
          title: `${pendingTransfers.length} Traslados entre bodegas en tránsito`,
          description: `Hay traslados pendientes de confirmación de recepción en la bodega destino.`,
          recommendation: 'Verificar la recepción física de la mercadería para actualizar el stock de destino.',
          canAutoFix: false
        });
      }

      // ─── 8. AUDITORÍA DE CONFIGURACIÓN FISCAL (/management) ───────
      const { data: companyConfig } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'company_profile')
        .maybeSingle();

      const profile = companyConfig?.value || {};
      if (!profile.nit || !profile.nrc || !profile.razonSocial) {
        discoveredIssues.push({
          id: 'missing-tax-profile',
          category: 'gerencia',
          severity: 'advertencia',
          title: 'Perfil fiscal de empresa incompleto',
          description: 'Faltan datos obligatorios para facturación electrónica DTE (NIT, NRC o Razón Social).',
          recommendation: 'Completar los datos en Gerencia > Perfil de Empresa para evitar rechazos en el Ministerio de Hacienda.',
          canAutoFix: false
        });
      }

    } catch (err) {
      console.error('Error durante auditoría Nexbot:', err);
    } finally {
      setIssues(discoveredIssues);
      setIsScanning(false);
      setLastScanTime(new Date());
    }
  }, []);

  useEffect(() => {
    runAudit();
    const interval = setInterval(runAudit, 45000);
    return () => clearInterval(interval);
  }, [runAudit]);

  const executeAutoFix = async (issue: AuditIssue) => {
    try {
      if (issue.fixType === 'clean_localstorage') {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('nexway_draft_sales_list');
          localStorage.removeItem('established_station_mode');
          localStorage.removeItem('pos_station_mode');
        }
        toast({
          title: "Limpieza Completada ✨",
          description: "Se eliminaron las claves residuales del navegador."
        });
      } else if (issue.fixType === 'cancel_stale_prefactura') {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        await supabase
          .from('sales')
          .update({ status: 'CANCELADA' })
          .eq('status', 'PENDIENTE_COBRO')
          .lt('created_at', oneHourAgo);

        toast({
          title: "Pre-Facturas Limpiadas 📋",
          description: "Se anularon los vales caducados que no fueron cobrados."
        });
      }

      await runAudit();
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Error al aplicar corrección",
        description: e.message || "No se pudo completar la auto-corrección."
      });
    }
  };

  const healthScore = Math.max(0, 100 - issues.reduce((acc, curr) => {
    if (curr.severity === 'critico') return acc + 25;
    if (curr.severity === 'advertencia') return acc + 10;
    return acc + 5;
  }, 0));

  return {
    issues,
    healthScore,
    isScanning,
    lastScanTime,
    runAudit,
    executeAutoFix
  };
}
