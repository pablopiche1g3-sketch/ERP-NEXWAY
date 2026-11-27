import { supabase } from '@/supabase/client';

export type PromotionBenefitType = 'PERCENT_DISCOUNT' | 'FIXED_DISCOUNT' | 'FREE_GIFT_NOTE';

export interface CrmPromotion {
  id: string;
  title: string;
  description: string;
  active: boolean;
  sourceFileName?: string;
  validFrom?: string; // YYYY-MM-DD
  validUntil?: string; // YYYY-MM-DD
  keywordOrSku?: string; // Palabra clave o SKU(s) separados por coma; vacío = aplica a toda la venta
  minQty?: number;
  minAmount?: number;
  benefitType: PromotionBenefitType;
  discountPercent?: number;
  discountAmount?: number;
  giftDescription?: string;
  createdAt: string;
}

export interface MatchedPromotion {
  promotion: CrmPromotion;
  estimatedSavings: number;
  matchReason: string;
  matchedItemIds: string[];
}

const PROMOS_CONFIG_KEY = 'crm_promotions_catalog';

function norm(s?: string): string {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export async function loadCrmPromotions(): Promise<CrmPromotion[]> {
  try {
    const { data, error } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', PROMOS_CONFIG_KEY)
      .maybeSingle();

    if (error || !data?.value || !Array.isArray(data.value)) return [];
    return data.value as CrmPromotion[];
  } catch {
    return [];
  }
}

export async function saveCrmPromotions(promos: CrmPromotion[]): Promise<boolean> {
  const { error } = await supabase
    .from('system_config')
    .upsert({ key: PROMOS_CONFIG_KEY, value: promos });
  return !error;
}

export function evaluateCartPromotions(
  cartItems: Array<{ id: string; sku: string; name: string; price: number; quantity: number }>,
  cartTotal: number,
  promotions: CrmPromotion[]
): MatchedPromotion[] {
  if (!cartItems || cartItems.length === 0 || !promotions || promotions.length === 0) {
    return [];
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const matched: MatchedPromotion[] = [];

  for (const promo of promotions) {
    if (!promo.active) continue;
    if (promo.validFrom && todayStr < promo.validFrom) continue;
    if (promo.validUntil && todayStr > promo.validUntil) continue;

    // Filtrar ítems que coinciden con las palabras clave / SKUs de la promoción
    const tokens = norm(promo.keywordOrSku)
      .split(/[,;|]+/)
      .map(t => t.trim())
      .filter(Boolean);

    const matchingItems =
      tokens.length === 0
        ? cartItems
        : cartItems.filter(it => {
            const hay = `${norm(it.sku)} ${norm(it.name)}`;
            return tokens.some(tok => hay.includes(tok));
          });

    if (matchingItems.length === 0) continue;

    const matchedQty = matchingItems.reduce((s, it) => s + Number(it.quantity || 0), 0);
    const matchedSubtotal = matchingItems.reduce(
      (s, it) => s + Number(it.price || 0) * Number(it.quantity || 0),
      0
    );

    const minQty = Number(promo.minQty || 0);
    const minAmount = Number(promo.minAmount || 0);

    if (minQty > 0 && matchedQty < minQty) continue;
    if (minAmount > 0 && (tokens.length === 0 ? cartTotal : matchedSubtotal) < minAmount) continue;

    let estimatedSavings = 0;
    if (promo.benefitType === 'PERCENT_DISCOUNT') {
      const pct = Math.min(100, Math.max(0, Number(promo.discountPercent || 0)));
      const base = tokens.length === 0 ? cartTotal : matchedSubtotal;
      estimatedSavings = Number(((base * pct) / 100).toFixed(2));
    } else if (promo.benefitType === 'FIXED_DISCOUNT') {
      estimatedSavings = Math.min(cartTotal, Math.max(0, Number(promo.discountAmount || 0)));
    }

    const reasonParts: string[] = [];
    if (tokens.length > 0) reasonParts.push(`Coincide con "${promo.keywordOrSku}"`);
    if (minQty > 0) reasonParts.push(`${matchedQty} uds (mín. ${minQty})`);
    if (minAmount > 0) reasonParts.push(`Monto califica (mín. $${minAmount.toFixed(2)})`);

    matched.push({
      promotion: promo,
      estimatedSavings,
      matchReason: reasonParts.join(' · ') || 'Aplica a esta venta',
      matchedItemIds: matchingItems.map(i => i.id),
    });
  }

  return matched.sort((a, b) => b.estimatedSavings - a.estimatedSavings);
}
