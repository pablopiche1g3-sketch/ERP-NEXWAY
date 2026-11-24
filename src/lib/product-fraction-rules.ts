import { supabase } from '@/supabase/client';

export type BaseMeasureType =
  | 'GALON'
  | 'YARDA'
  | 'PIE'
  | 'METRO'
  | 'LIBRA'
  | 'KILOGRAMO'
  | 'ROLLO'
  | 'CAJA'
  | 'UNIDAD';

export interface MeasureUnitDef {
  id: BaseMeasureType;
  label: string;
  shortLabel: string;
  subUnitLabel: string;
  subUnitsPerBase: number;
  defaultFractions: { fractionText: string; label: string; factor: number }[];
}

export const MEASURE_UNITS_CATALOG: Record<BaseMeasureType, MeasureUnitDef> = {
  GALON: {
    id: 'GALON',
    label: 'Galón (128 oz)',
    shortLabel: 'Gal',
    subUnitLabel: 'oz',
    subUnitsPerBase: 128,
    defaultFractions: [
      { fractionText: '1/2', label: '1/2 Galón (64 oz)', factor: 0.5 },
      { fractionText: '1/4', label: '1/4 Galón (32 oz)', factor: 0.25 },
      { fractionText: '1/8', label: '1/8 Galón (16 oz)', factor: 0.125 },
    ],
  },
  YARDA: {
    id: 'YARDA',
    label: 'Yarda (36 pulg / 3 pies)',
    shortLabel: 'Yd',
    subUnitLabel: 'pulg',
    subUnitsPerBase: 36,
    defaultFractions: [
      { fractionText: '1/2', label: '1/2 Yarda (18 pulg)', factor: 0.5 },
      { fractionText: '1/4', label: '1/4 Yarda (9 pulg)', factor: 0.25 },
      { fractionText: '3/4', label: '3/4 Yarda (27 pulg)', factor: 0.75 },
    ],
  },
  PIE: {
    id: 'PIE',
    label: 'Pie (12 pulg)',
    shortLabel: 'Pie',
    subUnitLabel: 'pulg',
    subUnitsPerBase: 12,
    defaultFractions: [
      { fractionText: '1/2', label: '1/2 Pie (6 pulg)', factor: 0.5 },
      { fractionText: '1/4', label: '1/4 Pie (3 pulg)', factor: 0.25 },
    ],
  },
  METRO: {
    id: 'METRO',
    label: 'Metro (100 cm)',
    shortLabel: 'm',
    subUnitLabel: 'cm',
    subUnitsPerBase: 100,
    defaultFractions: [
      { fractionText: '1/2', label: '1/2 Metro (50 cm)', factor: 0.5 },
      { fractionText: '1/4', label: '1/4 Metro (25 cm)', factor: 0.25 },
      { fractionText: '3/4', label: '3/4 Metro (75 cm)', factor: 0.75 },
    ],
  },
  LIBRA: {
    id: 'LIBRA',
    label: 'Libra (16 oz)',
    shortLabel: 'Lb',
    subUnitLabel: 'oz',
    subUnitsPerBase: 16,
    defaultFractions: [
      { fractionText: '1/2', label: '1/2 Libra (8 oz)', factor: 0.5 },
      { fractionText: '1/4', label: '1/4 Libra (4 oz)', factor: 0.25 },
    ],
  },
  KILOGRAMO: {
    id: 'KILOGRAMO',
    label: 'Kilogramo (1000 g)',
    shortLabel: 'Kg',
    subUnitLabel: 'g',
    subUnitsPerBase: 1000,
    defaultFractions: [
      { fractionText: '1/2', label: '1/2 Kg (500 g)', factor: 0.5 },
      { fractionText: '1/4', label: '1/4 Kg (250 g)', factor: 0.25 },
    ],
  },
  ROLLO: {
    id: 'ROLLO',
    label: 'Rollo / Bobina',
    shortLabel: 'Rollo',
    subUnitLabel: 'uds',
    subUnitsPerBase: 100,
    defaultFractions: [
      { fractionText: '1/2', label: '1/2 Rollo', factor: 0.5 },
      { fractionText: '1/4', label: '1/4 Rollo', factor: 0.25 },
    ],
  },
  CAJA: {
    id: 'CAJA',
    label: 'Caja / Fardo',
    shortLabel: 'Caja',
    subUnitLabel: 'uds',
    subUnitsPerBase: 12,
    defaultFractions: [
      { fractionText: '1/2', label: '1/2 Caja', factor: 0.5 },
      { fractionText: '1/4', label: '1/4 Caja', factor: 0.25 },
    ],
  },
  UNIDAD: {
    id: 'UNIDAD',
    label: 'Unidad Genérica',
    shortLabel: 'Ud',
    subUnitLabel: 'partes',
    subUnitsPerBase: 1,
    defaultFractions: [
      { fractionText: '1/2', label: '1/2 Unidad', factor: 0.5 },
    ],
  },
};

export interface FixedSupplyConfig {
  packageSku?: string;
  packageName?: string;
  packageCost?: number;
  capSku?: string;
  capName?: string;
  capCost?: number;
  extraSku?: string;
  extraName?: string;
  extraCost?: number;
}

export interface ProductFractionOption {
  fractionText: string;
  label: string;
  factor: number;
  subUnitValue?: number;
  fixedSupplies?: FixedSupplyConfig;
  suppliesTotalCost?: number;
  customSalePrice?: number; // Precio de venta editable que incluye costo de insumos
}

export interface ProductFractionRule {
  parentSku: string;
  parentName: string;
  baseMeasure: BaseMeasureType;
  enabledFractions: ProductFractionOption[];
  defaultSupplies?: FixedSupplyConfig;
  updatedAt: string;
}

export function parseFractionExpression(
  input: string,
  baseMeasure: BaseMeasureType = 'GALON'
): { factor: number; subUnits: number; label: string; isValid: boolean } {
  const clean = (input || '').trim().replace(',', '.');
  const unitDef = MEASURE_UNITS_CATALOG[baseMeasure] || MEASURE_UNITS_CATALOG.GALON;

  if (!clean) {
    return { factor: 0, subUnits: 0, label: 'Inválida', isValid: false };
  }

  let factor = 0;
  if (clean.includes('/')) {
    const parts = clean.split('/');
    if (parts.length === 2) {
      const num = parseFloat(parts[0].trim());
      const den = parseFloat(parts[1].trim());
      if (!isNaN(num) && !isNaN(den) && den > 0 && num > 0) {
        factor = num / den;
      }
    }
  } else {
    const num = parseFloat(clean);
    if (!isNaN(num) && num > 0) {
      factor = num;
    }
  }

  if (factor <= 0 || !isFinite(factor)) {
    return { factor: 0, subUnits: 0, label: 'Inválida', isValid: false };
  }

  const subUnits = Number((factor * unitDef.subUnitsPerBase).toFixed(2));
  const subTxt = unitDef.subUnitsPerBase > 1 ? ` (${subUnits} ${unitDef.subUnitLabel})` : '';
  return {
    factor,
    subUnits,
    label: `${clean} ${unitDef.shortLabel}${subTxt}`,
    isValid: true,
  };
}

export function computeSuppliesCost(supplies?: FixedSupplyConfig): number {
  if (!supplies) return 0;
  return Number(
    (
      (Number(supplies.packageCost) || 0) +
      (Number(supplies.capCost) || 0) +
      (Number(supplies.extraCost) || 0)
    ).toFixed(2)
  );
}

const LOCAL_KEY = 'nexway_product_fraction_rules';
const CONFIG_KEY = 'product_fraction_rules';

export async function loadProductFractionRules(): Promise<Record<string, ProductFractionRule>> {
  let localMap: Record<string, ProductFractionRule> = {};
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (raw) localMap = JSON.parse(raw);
    } catch {
      // ignore
    }
  }

  try {
    const { data } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', CONFIG_KEY)
      .maybeSingle();

    if (data?.value && typeof data.value === 'object') {
      const merged = { ...localMap, ...(data.value as Record<string, ProductFractionRule>) };
      if (typeof window !== 'undefined') {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(merged));
      }
      return merged;
    }
  } catch (e) {
    console.warn('Error cargando reglas de fraccionamiento:', e);
  }

  return localMap;
}

export async function saveProductFractionRule(
  rule: ProductFractionRule
): Promise<Record<string, ProductFractionRule>> {
  const current = await loadProductFractionRules();
  const updated: Record<string, ProductFractionRule> = {
    ...current,
    [rule.parentSku]: {
      ...rule,
      updatedAt: new Date().toISOString(),
    },
  };

  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(updated));
  }

  try {
    await supabase.from('system_config').upsert(
      {
        key: CONFIG_KEY,
        value: updated,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );
  } catch (e) {
    console.warn('Error guardando regla de fraccionamiento en Supabase:', e);
  }

  return updated;
}

export async function deleteProductFractionRule(
  parentSku: string
): Promise<Record<string, ProductFractionRule>> {
  const current = await loadProductFractionRules();
  const updated = { ...current };
  delete updated[parentSku];

  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(updated));
  }

  try {
    await supabase.from('system_config').upsert(
      {
        key: CONFIG_KEY,
        value: updated,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );
  } catch (e) {
    console.warn('Error eliminando regla de fraccionamiento en Supabase:', e);
  }

  return updated;
}


export interface PackagingBomPreset {
  id: string;
  name: string;
  packageSku: string;
  capSku: string;
  extraSku: string;
  updatedAt?: string;
}

const PACKAGING_PRESETS_LOCAL_KEY = 'nexway_packaging_bom_presets';
const PACKAGING_PRESETS_CONFIG_KEY = 'packaging_bom_presets';

export async function loadPackagingPresets(): Promise<PackagingBomPreset[]> {
  let localList: PackagingBomPreset[] = [];
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(PACKAGING_PRESETS_LOCAL_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) localList = parsed;
      }
    } catch {
      // ignore
    }
  }

  try {
    const { data } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', PACKAGING_PRESETS_CONFIG_KEY)
      .maybeSingle();

    if (Array.isArray(data?.value)) {
      const remoteList = data.value as PackagingBomPreset[];
      if (typeof window !== 'undefined') {
        localStorage.setItem(PACKAGING_PRESETS_LOCAL_KEY, JSON.stringify(remoteList));
      }
      return remoteList;
    }
  } catch (e) {
    console.warn('Error cargando presets de envasado:', e);
  }

  return localList;
}

export async function savePackagingPresets(presets: PackagingBomPreset[]): Promise<PackagingBomPreset[]> {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(PACKAGING_PRESETS_LOCAL_KEY, JSON.stringify(presets));
    } catch {
      // ignore
    }
  }

  try {
    await supabase.from('system_config').upsert(
      {
        key: PACKAGING_PRESETS_CONFIG_KEY,
        value: presets,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );
  } catch (e) {
    console.warn('Error guardando presets de envasado en Supabase:', e);
  }

  return presets;
}
