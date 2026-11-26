import { supabase } from '@/supabase/client';

export type CreditNoteAlertType = 'COMPRA_PROVEEDOR' | 'VENTA_CLIENTE';

export interface PendingCreditNoteAlert {
  id: string;
  type: CreditNoteAlertType;
  entityName: string; // Proveedor o Cliente
  invoiceRef?: string; // Factura / CCF original vinculada
  itemsSummary: string; // Ej. "5 galones Pintura Blanca dañados"
  estimatedAmount?: number;
  status: 'PENDIENTE' | 'RECIBIDA';
  createdAt: string;
  resolvedAt?: string;
  resolvedDocNumber?: string;
  createdBy?: string;
}

const CONFIG_KEY = 'pending_credit_note_alerts';

export async function loadPendingCreditNoteAlerts(): Promise<PendingCreditNoteAlert[]> {
  try {
    const { data, error } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', CONFIG_KEY)
      .maybeSingle();

    if (error || !data?.value || !Array.isArray(data.value)) return [];
    return data.value as PendingCreditNoteAlert[];
  } catch {
    return [];
  }
}

export async function savePendingCreditNoteAlerts(alerts: PendingCreditNoteAlert[]): Promise<boolean> {
  const { error } = await supabase
    .from('system_config')
    .upsert({ key: CONFIG_KEY, value: alerts.slice(0, 100) });
  return !error;
}

export async function addPendingCreditNoteAlert(
  input: Omit<PendingCreditNoteAlert, 'id' | 'status' | 'createdAt'>
): Promise<{ success: boolean; alert?: PendingCreditNoteAlert }> {
  const existing = await loadPendingCreditNoteAlerts();
  const alert: PendingCreditNoteAlert = {
    ...input,
    id: `NC-ALERT-${Date.now().toString().slice(-6)}`,
    status: 'PENDIENTE',
    createdAt: new Date().toISOString(),
  };
  const ok = await savePendingCreditNoteAlerts([alert, ...existing]);
  return { success: ok, alert: ok ? alert : undefined };
}

export async function deletePendingCreditNoteAlert(alertId: string): Promise<boolean> {
  const existing = await loadPendingCreditNoteAlerts();
  return savePendingCreditNoteAlerts(existing.filter(a => a.id !== alertId));
}

function normalize(val?: string): string {
  return String(val || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Cuando cae una Nota de Crédito (de compra o de cliente), busca avisos PENDIENTES
 * que coincidan por número de factura o nombre de proveedor/cliente y los marca RECIBIDA.
 */
export async function resolveMatchingCreditNoteAlerts(params: {
  type: CreditNoteAlertType;
  entityName: string;
  invoiceRef?: string;
  resolvedDocNumber: string;
}): Promise<PendingCreditNoteAlert[]> {
  const existing = await loadPendingCreditNoteAlerts();
  const normEntity = normalize(params.entityName);
  const normInv = normalize(params.invoiceRef);
  const resolved: PendingCreditNoteAlert[] = [];

  const updated = existing.map(alert => {
    if (alert.status !== 'PENDIENTE' || alert.type !== params.type) return alert;

    const aEntity = normalize(alert.entityName);
    const aInv = normalize(alert.invoiceRef);

    const matchByInvoice = Boolean(normInv && aInv && (aInv.includes(normInv) || normInv.includes(aInv)));
    const matchByEntity = Boolean(
      normEntity &&
        aEntity &&
        (aEntity.includes(normEntity) || normEntity.includes(aEntity) || aEntity.split(' ')[0] === normEntity.split(' ')[0])
    );

    if (matchByInvoice || matchByEntity) {
      const next: PendingCreditNoteAlert = {
        ...alert,
        status: 'RECIBIDA',
        resolvedAt: new Date().toISOString(),
        resolvedDocNumber: params.resolvedDocNumber,
      };
      resolved.push(next);
      return next;
    }
    return alert;
  });

  if (resolved.length > 0) {
    await savePendingCreditNoteAlerts(updated);
  }
  return resolved;
}
