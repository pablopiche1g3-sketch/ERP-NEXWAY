import { supabase } from '@/supabase/client';

export const CREDIT_OVERRIDE_SETTINGS_KEY = 'credit_override_settings';
export const CREDIT_OVERRIDE_AUDIT_KEY = 'credit_override_audit_log';
export const DEFAULT_MANAGER_CREDIT_PIN = '2026';

export interface CreditOverrideAuthorization {
  authorizedByName: string;
  authorizedByEmail: string;
  reason: string;
  authorizedAt: string;
  customerId?: string;
  customerName: string;
  exceededAmount: number;
  limitAmount: number;
  debtBefore: number;
  newSaleAmount: number;
}

export interface CreditOverrideAuditEntry extends CreditOverrideAuthorization {
  id: string;
  correlative?: string;
}

export interface CustomerCreditCheckResult {
  hasCustomer: boolean;
  isAuthorizedCredit: boolean;
  limit: number;
  outstandingDebt: number;
  pendingInvoicesCount: number;
  availableCredit: number;
  projectedDebt: number;
  exceededAmount: number;
  isExceeded: boolean;
  hasOverdueOrPending: boolean;
  needsManagerOverride: boolean;
  canOverride: boolean;
  statusLevel: 'ok' | 'warning' | 'blocked';
  message: string;
}

export function evaluateCustomerCreditStatus(params: {
  customer: any | null;
  outstandingDebt: number;
  pendingInvoicesCount: number;
  saleAmount: number;
}): CustomerCreditCheckResult {
  const { customer, outstandingDebt, pendingInvoicesCount, saleAmount } = params;

  if (!customer) {
    return {
      hasCustomer: false,
      isAuthorizedCredit: false,
      limit: 0,
      outstandingDebt: 0,
      pendingInvoicesCount: 0,
      availableCredit: 0,
      projectedDebt: saleAmount,
      exceededAmount: saleAmount,
      isExceeded: false,
      hasOverdueOrPending: false,
      needsManagerOverride: false,
      canOverride: false,
      statusLevel: 'blocked',
      message: 'Seleccione un cliente registrado para evaluar su línea de crédito.',
    };
  }

  const isAuth = Boolean(customer.is_authorized_credit);
  const limit = Number(parseFloat(customer.credit_limit) || 0);
  const debt = Number(outstandingDebt || 0);
  const projectedDebt = Number((debt + (Number(saleAmount) || 0)).toFixed(2));
  const availableCredit = Number(Math.max(0, limit - debt).toFixed(2));
  const exceededAmount = Number(Math.max(0, projectedDebt - limit).toFixed(2));
  const isExceeded = projectedDebt > limit + 0.005;
  const hasOverdueOrPending = pendingInvoicesCount > 0;

  if (!isAuth) {
    return {
      hasCustomer: true,
      isAuthorizedCredit: false,
      limit,
      outstandingDebt: debt,
      pendingInvoicesCount,
      availableCredit: 0,
      projectedDebt,
      exceededAmount: projectedDebt,
      isExceeded: true,
      hasOverdueOrPending,
      needsManagerOverride: true,
      canOverride: true,
      statusLevel: 'blocked',
      message: `El cliente "${customer.name}" no tiene crédito habilitado en cartera. Requiere autorización de Encargado/Admin para despachar al crédito.`,
    };
  }

  if (isExceeded || hasOverdueOrPending) {
    const reasons: string[] = [];
    if (isExceeded) {
      reasons.push(
        `Excede límite de $${limit.toFixed(2)} por $${exceededAmount.toFixed(2)} (Deuda: $${debt.toFixed(2)} + Nueva: $${Number(saleAmount || 0).toFixed(2)})`
      );
    }
    if (hasOverdueOrPending) {
      reasons.push(`Tiene ${pendingInvoicesCount} factura(s) al crédito pendiente(s) de pago`);
    }
    return {
      hasCustomer: true,
      isAuthorizedCredit: true,
      limit,
      outstandingDebt: debt,
      pendingInvoicesCount,
      availableCredit,
      projectedDebt,
      exceededAmount,
      isExceeded,
      hasOverdueOrPending,
      needsManagerOverride: true,
      canOverride: true,
      statusLevel: 'warning',
      message: `${reasons.join(' · ')}. Requiere autorización de Encargado o Administrador para despachar.`,
    };
  }

  return {
    hasCustomer: true,
    isAuthorizedCredit: true,
    limit,
    outstandingDebt: debt,
    pendingInvoicesCount: 0,
    availableCredit,
    projectedDebt,
    exceededAmount: 0,
    isExceeded: false,
    hasOverdueOrPending: false,
    needsManagerOverride: false,
    canOverride: false,
    statusLevel: 'ok',
    message: `Crédito disponible: $${availableCredit.toFixed(2)} de $${limit.toFixed(2)} (Deuda actual: $${debt.toFixed(2)}).`,
  };
}

export async function fetchCustomerCurrentDebt(customerId: string, customerName?: string): Promise<{
  outstandingDebt: number;
  pendingInvoicesCount: number;
}> {
  try {
    const [{ data: pendingSales }, { data: abonos }] = await Promise.all([
      supabase
        .from('sales')
        .select('id, correlative, total, customer_id, customer_name, payment_method, status')
        .eq('status', 'PENDIENTE')
        .eq('payment_method', 'Credito'),
      supabase
        .from('journal')
        .select('description, amount')
        .eq('type', 'Ingreso')
        .ilike('description', 'Abono a Crédito%'),
    ]);

    const nameLower = (customerName || '').trim().toLowerCase();
    const matched = (pendingSales || []).filter(
      (s: any) =>
        (customerId && s.customer_id === customerId) ||
        (nameLower && (s.customer_name || '').trim().toLowerCase() === nameLower)
    );

    let debt = 0;
    matched.forEach((s: any) => {
      const paid = (abonos || [])
        .filter((j: any) => j.description && s.correlative && j.description.includes(`[${s.correlative}]`))
        .reduce((acc: number, j: any) => acc + (parseFloat(j.amount) || 0), 0);
      debt += Math.max(0, (parseFloat(s.total) || 0) - paid);
    });

    return {
      outstandingDebt: Number(debt.toFixed(2)),
      pendingInvoicesCount: matched.length,
    };
  } catch {
    return { outstandingDebt: 0, pendingInvoicesCount: 0 };
  }
}

export async function loadManagerCreditPin(): Promise<string> {
  try {
    const { data } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', CREDIT_OVERRIDE_SETTINGS_KEY)
      .maybeSingle();
    if (data?.value?.managerPin && String(data.value.managerPin).trim().length >= 4) {
      return String(data.value.managerPin).trim();
    }
  } catch {}
  return DEFAULT_MANAGER_CREDIT_PIN;
}

export async function saveManagerCreditPin(newPin: string): Promise<void> {
  const clean = newPin.trim();
  if (clean.length < 4) throw new Error('El PIN debe tener al menos 4 dígitos.');
  const { error } = await supabase.from('system_config').upsert(
    {
      key: CREDIT_OVERRIDE_SETTINGS_KEY,
      value: { managerPin: clean },
    },
    { onConflict: 'key' }
  );
  if (error) throw error;
}

export async function logCreditOverrideAudit(entry: CreditOverrideAuditEntry): Promise<void> {
  try {
    const { data } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', CREDIT_OVERRIDE_AUDIT_KEY)
      .maybeSingle();
    const prev = Array.isArray(data?.value) ? data.value : [];
    const next = [entry, ...prev].slice(0, 200);
    await supabase.from('system_config').upsert(
      {
        key: CREDIT_OVERRIDE_AUDIT_KEY,
        value: next,
      },
      { onConflict: 'key' }
    );
  } catch (e) {
    console.warn('No se pudo guardar bitácora de autorización de crédito:', e);
  }
}
