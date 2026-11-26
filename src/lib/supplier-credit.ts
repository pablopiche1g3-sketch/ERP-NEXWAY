import { supabase } from '@/supabase/client';

export interface SupplierCreditProfile {
  is_authorized_credit: boolean;
  credit_limit: number;
  credit_days: number;
}

export interface CreditDueAlert {
  id: string;
  side: 'CLIENTE' | 'PROVEEDOR';
  entityName: string;
  docLabel: string;
  balance: number;
  dueDate: string;
  daysDiff: number; // < 0 vencida, 0..5 por vencer
  isOverdue: boolean;
}

const SUPPLIER_CREDIT_KEY = 'supplier_credit_profiles';

export async function loadSupplierCreditProfiles(): Promise<Record<string, SupplierCreditProfile>> {
  try {
    const { data, error } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', SUPPLIER_CREDIT_KEY)
      .maybeSingle();

    if (error || !data?.value || typeof data.value !== 'object') return {};
    return data.value as Record<string, SupplierCreditProfile>;
  } catch {
    return {};
  }
}

export async function saveSupplierCreditProfile(
  supplierId: string,
  profile: SupplierCreditProfile
): Promise<boolean> {
  const existing = await loadSupplierCreditProfiles();
  const next = {
    ...existing,
    [supplierId]: {
      is_authorized_credit: Boolean(profile.is_authorized_credit),
      credit_limit: Math.max(0, Number(profile.credit_limit) || 0),
      credit_days: Math.max(0, Math.round(Number(profile.credit_days) || 0)),
    },
  };
  const { error } = await supabase
    .from('system_config')
    .upsert({ key: SUPPLIER_CREDIT_KEY, value: next });
  return !error;
}

/**
 * Calcula en vivo el saldo pendiente (CxP) agrupado por supplier_id.
 */
export async function loadSupplierCxpBalances(): Promise<Record<string, number>> {
  try {
    const [purchRes, cfgRes] = await Promise.all([
      supabase
        .from('purchases')
        .select('id, supplier_id, total, payment_method, payment_status'),
      supabase
        .from('system_config')
        .select('key, value')
        .in('key', ['cxp_payments_registry', 'cxp_manual_records']),
    ]);

    const cfgRows = cfgRes.data || [];
    const payments: any[] = cfgRows.find((r: any) => r.key === 'cxp_payments_registry')?.value || [];
    const manual: any[] = cfgRows.find((r: any) => r.key === 'cxp_manual_records')?.value || [];

    const allPurchases = [...(purchRes.data || []), ...manual];
    const balances: Record<string, number> = {};

    allPurchases.forEach((p: any) => {
      if (!p.supplier_id || p.payment_status === 'PAGADO') return;
      const pm = String(p.payment_method || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (!pm.includes('credito') && p.payment_status !== 'PENDIENTE') return;

      const total = Number(p.total || 0);
      const paid = payments
        .filter(pay => pay.purchase_id === p.id)
        .reduce((s, pay) => s + (Number(pay.amount) || 0), 0);
      const remaining = Math.max(0, total - paid);
      if (remaining > 0.01) {
        balances[p.supplier_id] = Number(((balances[p.supplier_id] || 0) + remaining).toFixed(2));
      }
    });

    return balances;
  } catch {
    return {};
  }
}

/**
 * Obtiene alertas consolidadas de facturas al crédito vencidas o por vencer (≤ 5 días)
 * tanto de Clientes (CxC) como de Proveedores (CxP) para el BMS del Inicio.
 */
export async function loadBmsCreditDueAlerts(): Promise<{
  clientAlerts: CreditDueAlert[];
  supplierAlerts: CreditDueAlert[];
}> {
  try {
    const [salesRes, purchRes, cfgRes] = await Promise.all([
      supabase
        .from('sales')
        .select('id, correlative, customer_name, total, payment_method, type, status, created_at, customers(name, credit_days)')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('purchases')
        .select('id, document_number, order_id, supplier_name, total, payment_method, payment_status, credit_days, created_at, suppliers(name, credit_days)')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('system_config')
        .select('key, value')
        .in('key', ['cxc_payments_registry', 'cxc_manual_records', 'cxp_payments_registry', 'cxp_manual_records']),
    ]);

    const cfgRows = cfgRes.data || [];
    const getCfg = (k: string): any[] => {
      const v = cfgRows.find((r: any) => r.key === k)?.value;
      return Array.isArray(v) ? v : [];
    };

    const cxcPays = getCfg('cxc_payments_registry');
    const cxcManual = getCfg('cxc_manual_records');
    const cxpPays = getCfg('cxp_payments_registry');
    const cxpManual = getCfg('cxp_manual_records');

    const now = new Date();
    const clientAlerts: CreditDueAlert[] = [];
    const supplierAlerts: CreditDueAlert[] = [];

    // 1. Clientes (CxC)
    const allSales = [...(salesRes.data || []), ...cxcManual];
    allSales.forEach((s: any) => {
      if (s.status === 'CANCELADA') return;
      const pm = String(s.payment_method || s.type || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (!pm.includes('credito') && s.status !== 'PENDIENTE') return;

      const total = Number(s.total || 0);
      const paid = cxcPays
        .filter(p => p.sale_id === s.id)
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const balance = Number((total - paid).toFixed(2));
      if (balance <= 0.01) return;

      const days = Number(s.credit_days || s.customers?.credit_days) || 30;
      const baseDate = s.created_at ? new Date(s.created_at) : new Date();
      const due = new Date(baseDate);
      due.setDate(due.getDate() + days);
      const daysDiff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 3600 * 24));

      if (daysDiff <= 5) {
        clientAlerts.push({
          id: s.id,
          side: 'CLIENTE',
          entityName: s.customers?.name || s.customer_name || 'Cliente',
          docLabel: s.correlative || String(s.id).slice(0, 8),
          balance,
          dueDate: due.toLocaleDateString('es-SV'),
          daysDiff,
          isOverdue: daysDiff < 0,
        });
      }
    });

    // 2. Proveedores (CxP)
    const allPurch = [...(purchRes.data || []), ...cxpManual];
    allPurch.forEach((p: any) => {
      if (p.payment_status === 'PAGADO') return;
      const pm = String(p.payment_method || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (!pm.includes('credito') && p.payment_status !== 'PENDIENTE') return;

      const total = Number(p.total || 0);
      const paid = cxpPays
        .filter(pay => pay.purchase_id === p.id)
        .reduce((sum, pay) => sum + (Number(pay.amount) || 0), 0);
      const balance = Number((total - paid).toFixed(2));
      if (balance <= 0.01) return;

      const days = Number(p.credit_days || p.suppliers?.credit_days) || 30;
      const baseDate = p.created_at ? new Date(p.created_at) : new Date();
      const due = new Date(baseDate);
      due.setDate(due.getDate() + days);
      const daysDiff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 3600 * 24));

      if (daysDiff <= 5) {
        supplierAlerts.push({
          id: p.id,
          side: 'PROVEEDOR',
          entityName: p.suppliers?.name || p.supplier_name || 'Proveedor',
          docLabel: p.document_number || p.order_id || String(p.id).slice(0, 8),
          balance,
          dueDate: due.toLocaleDateString('es-SV'),
          daysDiff,
          isOverdue: daysDiff < 0,
        });
      }
    });

    clientAlerts.sort((a, b) => a.daysDiff - b.daysDiff);
    supplierAlerts.sort((a, b) => a.daysDiff - b.daysDiff);

    return { clientAlerts, supplierAlerts };
  } catch {
    return { clientAlerts: [], supplierAlerts: [] };
  }
}
