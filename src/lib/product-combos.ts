import { supabase } from '@/supabase/client';

export interface ProductComboItem {
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number; // Precio unitario dentro del combo (permite facturar parcial con total exacto)
  optional?: boolean;
}

export interface ProductCombo {
  id: string;
  code: string;
  name: string;
  description?: string;
  comboPrice: number;
  active: boolean;
  items: ProductComboItem[];
  createdAt: string;
}

const COMBOS_KEY = 'product_combos_catalog';

export async function loadProductCombos(): Promise<ProductCombo[]> {
  try {
    const { data, error } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', COMBOS_KEY)
      .maybeSingle();

    if (error || !data?.value || !Array.isArray(data.value)) return [];
    return data.value as ProductCombo[];
  } catch {
    return [];
  }
}

export async function saveProductCombos(combos: ProductCombo[]): Promise<boolean> {
  const { error } = await supabase
    .from('system_config')
    .upsert({ key: COMBOS_KEY, value: combos });
  return !error;
}
