import { supabase } from '@/supabase/client';
import { postDoubleEntryJournal } from './accounting-journal';

export interface OfflineSaleItem {
  id: string;
  sku: string;
  name: string;
  price: number;
  originalPrice?: number;
  quantity: number;
}

export interface OfflineSaleRecord {
  localId: string;
  correlative: string;
  docType: string;
  customerName: string;
  customerId: string | null;
  customerEmail: string;
  total: number;
  paymentMethod: string;
  paymentDetails: any;
  splitAmounts?: any;
  items: OfflineSaleItem[];
  sellerEmail: string | null;
  stationName: string | null;
  branchId: string | null;
  warehouseId: string | null;
  warehouseName: string | null;
  createdAt: string;
  status: 'PENDING_SYNC' | 'SYNCED' | 'FAILED_SYNC';
  syncError?: string;
}

const OFFLINE_QUEUE_KEY = 'nexway_offline_sales_queue';
const OFFLINE_CATALOG_KEY = 'nexway_offline_catalog_cache';

/**
 * Guarda el catálogo de productos localmente en localStorage para que el cajero
 * pueda buscar y agregar al carrito aun si se corta la conexión a internet.
 */
export function cacheOfflineCatalog(products: any[], stockMap: Record<string, number>): void {
  if (typeof window === 'undefined') return;
  try {
    const payload = {
      timestamp: Date.now(),
      products: (products || []).map(p => ({
        id: p.id || p.sku,
        sku: p.sku,
        name: p.name,
        price: Number(p.price || 0),
        category: p.category,
        brand: p.brand
      })),
      stockMap: stockMap || {}
    };
    localStorage.setItem(OFFLINE_CATALOG_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('No se pudo guardar la caché de productos para modo offline:', err);
  }
}

/**
 * Recupera el catálogo offline guardado localmente
 */
export function getOfflineCatalog(): { products: any[]; stockMap: Record<string, number> } {
  if (typeof window === 'undefined') return { products: [], stockMap: {} };
  try {
    const raw = localStorage.getItem(OFFLINE_CATALOG_KEY);
    if (!raw) return { products: [], stockMap: {} };
    const parsed = JSON.parse(raw);
    return {
      products: parsed.products || [],
      stockMap: parsed.stockMap || {}
    };
  } catch {
    return { products: [], stockMap: {} };
  }
}

/**
 * Obtiene la cola de ventas pendientes de sincronización
 */
export function getOfflineSalesQueue(): OfflineSaleRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as OfflineSaleRecord[];
  } catch {
    return [];
  }
}

/**
 * Guarda una venta generada en contingencia / offline en la cola local
 */
export function enqueueOfflineSale(sale: Omit<OfflineSaleRecord, 'localId' | 'status' | 'createdAt'>): OfflineSaleRecord {
  const queue = getOfflineSalesQueue();
  const localRecord: OfflineSaleRecord = {
    ...sale,
    localId: `offline-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    status: 'PENDING_SYNC',
    createdAt: new Date().toISOString()
  };

  queue.push(localRecord);
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('Error al persistir venta offline en localStorage:', e);
  }

  return localRecord;
}

/**
 * Procesa la cola offline e intenta subir cada venta a Supabase.
 * Devuelve el número de ventas sincronizadas y fallidas.
 */
export async function syncOfflineSalesQueue(): Promise<{ synced: number; remaining: number; errors: string[] }> {
  const queue = getOfflineSalesQueue();
  const pending = queue.filter(s => s.status === 'PENDING_SYNC' || s.status === 'FAILED_SYNC');
  if (pending.length === 0) {
    return { synced: 0, remaining: 0, errors: [] };
  }

  let syncedCount = 0;
  const errors: string[] = [];
  const updatedQueue = [...queue];

  for (const sale of pending) {
    try {
      // 1. Insertar en public.sales
      const insertPayload: any = {
        correlative: sale.correlative,
        doc_type: sale.docType,
        customer_id: sale.customerId,
        total: sale.total,
        status: sale.paymentMethod === 'Credito' ? 'PENDIENTE' : 'ACTIVA',
        payment_method: sale.paymentMethod,
        payment_details: sale.paymentDetails,
        customer_name: sale.customerName,
        seller_email: sale.sellerEmail,
        station_name: sale.stationName,
        branch_id: sale.branchId,
        created_at: sale.createdAt
      };

      let { data: newSale, error: saleErr } = await supabase
        .from('sales')
        .insert(insertPayload)
        .select()
        .single();

      if (saleErr && (saleErr.message?.includes('payment_details') || saleErr.code === 'PGRST204')) {
        delete insertPayload.payment_details;
        const retry = await supabase.from('sales').insert(insertPayload).select().single();
        newSale = retry.data;
        saleErr = retry.error;
      }

      if (saleErr) throw saleErr;

      // 2. Insertar items en public.sales_items
      if (newSale && sale.items && sale.items.length > 0) {
        const itemsToInsert = sale.items.map(item => ({
          sale_id: newSale.id,
          sku: item.sku,
          quantity: Number(item.quantity) || 0,
          price: item.price,
          subtotal: (Number(item.quantity) || 0) * item.price
        }));

        const { error: itemsErr } = await supabase
          .from('sales_items')
          .insert(itemsToInsert);

        if (itemsErr) console.warn('Advertencia al sincronizar items offline:', itemsErr);
      }

      // 3. Descontar Inventario y Kardex si hay bodega
      if (sale.warehouseId) {
        for (const item of sale.items) {
          try {
            const qty = Number(item.quantity) || 0;
            // Consultar stock actual
            const { data: stockRow } = await supabase
              .from('inventory_stock')
              .select('quantity')
              .eq('sku', item.sku)
              .eq('warehouse_id', sale.warehouseId)
              .maybeSingle();

            const currentStock = stockRow ? Number(stockRow.quantity || 0) : 0;
            const newStock = currentStock - qty;

            await supabase
              .from('inventory_stock')
              .upsert({
                sku: item.sku,
                warehouse_id: sale.warehouseId,
                quantity: newStock
              }, { onConflict: 'sku,warehouse_id' });

            await supabase.from('kardex').insert({
              sku: item.sku,
              movement_type: 'FACTURA_OFFLINE',
              location: sale.warehouseName || 'Bodega',
              document_ref: `${sale.docType}-${sale.correlative}`,
              qty_in: 0,
              qty_out: qty,
              balance: newStock,
              unit_cost: item.price
            });
          } catch (kErr) {
            console.warn('Error en kardex de venta sincronizada:', kErr);
          }
        }
      }

      // 4. Registrar partida contable de partida doble
      try {
        const gravada = sale.total / 1.13;
        const ivaDebito = sale.total - gravada;
        const journalLines: any[] = [];

        if (sale.paymentMethod === 'Efectivo') {
          journalLines.push({ account_code: '1101', account_name: 'Efectivo y Equivalentes de Efectivo', debit: sale.total, credit: 0 });
        } else if (sale.paymentMethod === 'Tarjeta' || sale.paymentMethod === 'Transferencia') {
          journalLines.push({ account_code: '1102', account_name: 'Bancos e Instituciones Financieras', debit: sale.total, credit: 0 });
        } else if (sale.paymentMethod === 'Credito') {
          journalLines.push({ account_code: '1103', account_name: 'Cuentas por Cobrar Clientes', debit: sale.total, credit: 0 });
        } else {
          journalLines.push({ account_code: '1101', account_name: 'Efectivo y Equivalentes de Efectivo', debit: sale.total, credit: 0 });
        }

        journalLines.push({ account_code: '2102', account_name: 'IVA Débito Fiscal (13%)', debit: 0, credit: ivaDebito });
        journalLines.push({ account_code: '4101', account_name: 'Ventas de Mercadería Gravadas', debit: 0, credit: gravada });

        await postDoubleEntryJournal({
          description: `Venta POS Offline [${sale.correlative}] - ${sale.customerName} (${sale.paymentMethod})`,
          amount: sale.total,
          type: 'Avanzado',
          branchId: sale.branchId,
          lines: journalLines,
          createdAt: sale.createdAt
        });
      } catch (jErr) {
        console.warn('Error al registrar journal de venta offline sincronizada:', jErr);
      }

      // Marcar como SYNCED
      const idx = updatedQueue.findIndex(q => q.localId === sale.localId);
      if (idx !== -1) {
        updatedQueue[idx].status = 'SYNCED';
      }
      syncedCount++;

    } catch (err: any) {
      console.error(`Error sincronizando venta ${sale.correlative}:`, err);
      errors.push(`${sale.correlative}: ${err?.message || 'Error de red o servidor'}`);
      const idx = updatedQueue.findIndex(q => q.localId === sale.localId);
      if (idx !== -1) {
        updatedQueue[idx].status = 'FAILED_SYNC';
        updatedQueue[idx].syncError = err?.message || 'Error desconocido';
      }
    }
  }

  // Filtrar las sincronizadas para no acumular basura (o mantener las últimas 50 si se requiere)
  const finalQueue = updatedQueue.filter(s => s.status !== 'SYNCED');
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(finalQueue));
  } catch (e) {
    console.error('Error al actualizar cola offline en localStorage:', e);
  }

  return {
    synced: syncedCount,
    remaining: finalQueue.length,
    errors
  };
}
