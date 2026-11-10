'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Scissors, 
  ArrowDownCircle, 
  History, 
  Boxes, 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  Warehouse, 
  FileText, 
  Sparkles, 
  UserCheck,
  Calendar,
  Layers,
  Search,
  Filter,
  Percent,
  DollarSign,
  TrendingUp,
  Tag,
  Factory,
  ShieldCheck,
  Info,
  RefreshCw,
  FlaskConical,
  PackageOpen,
  Plus,
  Trash2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/supabase/use-user';
import { fetchSystemAppUsers } from '@/lib/session-operator';

export interface SpecialDischargeRecord {
  id: string;
  type: 'FRACCIONAMIENTO' | 'MERMA' | 'USO_INTERNO' | 'MUESTRA' | 'AJUSTE' | 'CONSUMO_PRODUCCION';
  sku: string;
  name: string;
  quantity: number;
  resultingSku?: string;
  resultingName?: string;
  resultingQuantity?: number;
  warehouseId: string;
  warehouseName: string;
  reason: string;
  responsibleEmail: string;
  flowType?: 'VENTA' | 'PRODUCCION';
  wasteQuantity?: number;
  unitCostResulting?: number;
  batchNumber?: string;
  expiryDate?: string;
  created_at: string;
}

interface ProductionRecipe {
  id: string;
  name: string;
  targetSku: string;
  targetName: string;
  yieldQuantity: number;
}

interface ProductItem {
  id?: string;
  sku: string;
  name: string;
  cost: number;
  price: number;
  unit?: string;
  quantity: number;
  stock?: number;
  bodegas?: Record<string, number>;
}

const COMMON_UNITS = [
  'Barril',
  'Tambor',
  'Saco',
  'Galón',
  'Litro',
  'Cuarto (1/4 Gal)',
  'Botella',
  'Kilogramo (Kg)',
  'Libra (Lb)',
  'Onza (Oz)',
  'Unidad',
  'Caja',
  'Paca'
];


export interface PackagingItem {
  id: string;
  sku: string;
  name: string;
  quantityPerUnit: number;
}

export interface QuickFraction {
  label: string;
  fractionText: string;
  factor: number;
  ounces: number;
  unitName: string;
  suggestedSuffix: string;
}

export const PRESET_FRACTIONS: QuickFraction[] = [
  { label: '1/2 Galón', fractionText: '1/2', factor: 0.5, ounces: 64, unitName: 'Medio Galón', suggestedSuffix: '1/2 Gal' },
  { label: '1/4 Galón', fractionText: '1/4', factor: 0.25, ounces: 32, unitName: 'Cuarto de Galón', suggestedSuffix: '1/4 Gal' },
  { label: '3/8 Galón', fractionText: '3/8', factor: 0.375, ounces: 48, unitName: '3/8 Galón (48 oz)', suggestedSuffix: '3/8 Gal' },
  { label: '1/8 Galón', fractionText: '1/8', factor: 0.125, ounces: 16, unitName: 'Octavo de Galón (Pinta)', suggestedSuffix: '1/8 Gal' },
  { label: '3/16 Galón', fractionText: '3/16', factor: 0.1875, ounces: 24, unitName: '3/16 Galón (24 oz)', suggestedSuffix: '3/16 Gal' },
  { label: '1/16 Galón', fractionText: '1/16', factor: 0.0625, ounces: 8, unitName: 'Dieciseisavo (8 oz)', suggestedSuffix: '1/16 Gal' },
  { label: '1/32 Galón', fractionText: '1/32', factor: 0.03125, ounces: 4, unitName: 'Treintaidosavo (4 oz)', suggestedSuffix: '1/32 Gal' },
  { label: 'Caneca (5 Gal)', fractionText: '5', factor: 5.0, ounces: 640, unitName: 'Caneca / Cubeta', suggestedSuffix: 'Caneca 5G' }
];

export function parseCustomFraction(text: string): { factor: number; ounces: number; isValid: boolean; label: string } {
  const clean = (text || '').trim();
  if (!clean) return { factor: 0.25, ounces: 32, isValid: false, label: 'Inválido' };

  if (clean.includes('/')) {
    const parts = clean.split('/');
    if (parts.length === 2) {
      const num = parseFloat(parts[0]);
      const den = parseFloat(parts[1]);
      if (!isNaN(num) && !isNaN(den) && den > 0 && num > 0) {
        const factor = num / den;
        const ounces = factor * 128;
        return { factor, ounces, isValid: true, label: `${clean} Gal (${ounces.toFixed(1)} oz)` };
      }
    }
  }

  const num = parseFloat(clean);
  if (!isNaN(num) && num > 0) {
    const ounces = num * 128;
    return { factor: num, ounces, isValid: true, label: `${clean} Gal (${ounces.toFixed(1)} oz)` };
  }

  return { factor: 0.25, ounces: 32, isValid: false, label: 'Inválido' };
}

function detectUnitFromName(name: string): string {
  const lower = (name || '').toLowerCase();
  if (lower.includes('barril')) return 'Barril';
  if (lower.includes('tambor')) return 'Tambor';
  if (lower.includes('saco')) return 'Saco';
  if (lower.includes('galon') || lower.includes('galón') || lower.includes('gl')) return 'Galón';
  if (lower.includes('litro') || lower.includes(' lt') || lower.includes('1l')) return 'Litro';
  if (lower.includes('cuarto') || lower.includes('1/4') || lower.includes('qt')) return 'Cuarto (1/4 Gal)';
  if (lower.includes('botella')) return 'Botella';
  if (lower.includes('kg') || lower.includes('kilo')) return 'Kilogramo (Kg)';
  if (lower.includes('lb') || lower.includes('libra')) return 'Libra (Lb)';
  if (lower.includes('oz') || lower.includes('onza')) return 'Onza (Oz)';
  if (lower.includes('caja') || lower.includes('cj')) return 'Caja';
  if (lower.includes('paca')) return 'Paca';
  return 'Unidad';
}

export default function FractionAndDischargesTab() {
  const { toast } = useToast();
  const { user } = useUser();

  const [activeSubTab, setActiveSubTab] = useState<'fraccionar' | 'salidas' | 'historial'>('fraccionar');
  const [loading, setLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Datos del Sistema
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [stockMap, setStockMap] = useState<Record<string, number>>({}); // sku:warehouse_id -> qty
  const [history, setHistory] = useState<SpecialDischargeRecord[]>([]);
  const [recipes, setRecipes] = useState<ProductionRecipe[]>([]);
  const [operatorName, setOperatorName] = useState<string>('');

  // Formulario Fraccionamiento

  const [fractionFlow, setFractionFlow] = useState<'VENTA' | 'PRODUCCION'>('VENTA');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [sourceSku, setSourceSku] = useState<string>('');
  const [sourceUnit, setSourceUnit] = useState<string>('Galón');
  const [sourceQuantity, setSourceQuantity] = useState<string>('1');
  const [conversionFactor, setConversionFactor] = useState<string>('4');

  // Modo Fracciones Rápidas & Libres (1/4, 1/2, 3/8, 1/32, etc.)
  const [selectedFractionText, setSelectedFractionText] = useState<string>('1/4');
  const [customFractionInput, setCustomFractionInput] = useState<string>('1/4');
  const [unitsToProduce, setUnitsToProduce] = useState<string>('4');

  const [destinationSku, setDestinationSku] = useState<string>('');
  const [targetUnit, setTargetUnit] = useState<string>('Cuarto de Galón');

  // BOM de Envasado & Insumos Complementarios
  const [selectedPackageSku, setSelectedPackageSku] = useState<string>('');
  const [selectedCapSku, setSelectedCapSku] = useState<string>('');
  const [selectedExtraSku, setSelectedExtraSku] = useState<string>('');

  // Producción vinculada
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>('');

  // Manejo de Merma
  const [applyWaste, setApplyWaste] = useState<boolean>(false);
  const [wasteType, setWasteType] = useState<'PERCENT' | 'FIXED'>('PERCENT');
  const [wasteValue, setWasteValue] = useState<string>('0');

  // Trazabilidad
  const [batchNumber, setBatchNumber] = useState<string>('');
  const [expiryDate, setExpiryDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Formulario Salidas Especiales
  const [dischargeType, setDischargeType] = useState<'MERMA' | 'USO_INTERNO' | 'MUESTRA' | 'AJUSTE'>('MERMA');
  const [dischargeSku, setDischargeSku] = useState<string>('');
  const [dischargeQuantity, setDischargeQuantity] = useState<string>('1');
  const [dischargeReason, setDischargeReason] = useState<string>('');

  // Filtros Historial
  const [historyFilterType, setHistoryFilterType] = useState<string>('ALL');
  const [historySearch, setHistorySearch] = useState<string>('');

  // Carga inicial
  useEffect(() => {
    loadData();
    resolveActiveOperator();
  }, []);

  const resolveActiveOperator = async () => {
    try {
      const storedOperator = typeof window !== 'undefined' ? localStorage.getItem('nexway_session_operator') : null;
      if (storedOperator) {
        const parsed = JSON.parse(storedOperator);
        if (parsed?.full_name || parsed?.name || parsed?.email) {
          setOperatorName(parsed.full_name || parsed.name || parsed.email);
          return;
        }
      }
      const appUsers = await fetchSystemAppUsers();
      if (user?.email) {
        const matched = appUsers.find(u => u.email?.toLowerCase() === user.email?.toLowerCase());
        if (matched?.full_name) {
          setOperatorName(matched.full_name);
          return;
        }
        setOperatorName(user.email);
      }
    } catch (e) {
      if (user?.email) setOperatorName(user.email);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Cargar Bodegas (con fallback seguro)
      let whList: any[] = [];
      try {
        const { data: whs } = await supabase
          .from('warehouses')
          .select('*')
          .order('name');
        if (whs && whs.length > 0) {
          whList = whs;
        }
      } catch (errWh) {
        console.warn('Fallback bodegas:', errWh);
      }

      if (whList.length === 0) {
        whList = [
          { id: 'wh-central', name: 'Bodega Principal' },
          { id: 'wh-tienda', name: 'Sala de Ventas' }
        ];
      }
      setWarehouses(whList);
      if (!selectedWarehouseId && whList.length > 0) {
        setSelectedWarehouseId(whList[0].id);
      }

      // 2. Cargar Catálogo de Inventario (tabla `inventory`)
      let invList: any[] = [];
      try {
        const { data: invData, error: invErr } = await supabase
          .from('inventory')
          .select('*')
          .order('name');
        
        if (!invErr && invData && invData.length > 0) {
          invList = invData;
        }
      } catch (errInv) {
        console.warn('Error leyendo tabla inventory en Supabase:', errInv);
      }

      // Fallback a localStorage si la base está vacía o offline
      if (invList.length === 0 && typeof window !== 'undefined') {
        const local = localStorage.getItem('nexway_inventory');
        if (local) {
          try {
            invList = JSON.parse(local);
          } catch (e) {}
        }
      }

      // 3. Cargar existencias por bodega (tabla `inventory_stock`)
      const stockByWhMap: Record<string, number> = {};
      try {
        const { data: stockData } = await supabase
          .from('inventory_stock')
          .select('sku, warehouse_id, quantity');

        if (stockData && stockData.length > 0) {
          stockData.forEach(s => {
            const key = `${s.sku}::${s.warehouse_id}`;
            stockByWhMap[key] = parseFloat(s.quantity) || 0;
          });
          setStockMap(stockByWhMap);
        }
      } catch (errStock) {
        console.warn('Error leyendo inventory_stock:', errStock);
      }

      // Mapear productos con stock normalizado
      const mappedProducts: ProductItem[] = invList.map(item => {
        const costVal = Number(item.cost ?? (item.price ? item.price * 0.7 : 0));
        const priceVal = Number(item.price ?? item.sale_price ?? 0);
        const qtyVal = Number(item.quantity ?? item.stock ?? 0);

        return {
          id: item.id || item.sku,
          sku: item.sku,
          name: item.name || item.description || item.sku,
          cost: costVal,
          price: priceVal,
          unit: item.unit || detectUnitFromName(item.name || ''),
          quantity: qtyVal,
          stock: qtyVal
        };
      });

      setProducts(mappedProducts);

      // 4. Cargar Recetas de Producción
      try {
        const { data: recipeConf } = await supabase
          .from('system_config')
          .select('value')
          .eq('key', 'production_recipes')
          .maybeSingle();

        if (recipeConf?.value && Array.isArray(recipeConf.value)) {
          setRecipes(recipeConf.value);
        }
      } catch (errR) {
        console.warn('Error cargando recetas:', errR);
      }

      // 5. Cargar Historial de Descargos Especiales y Fraccionamiento
      try {
        const { data: histConf } = await supabase
          .from('system_config')
          .select('value')
          .eq('key', 'special_discharges_history')
          .maybeSingle();

        if (histConf?.value && Array.isArray(histConf.value)) {
          setHistory(histConf.value);
        } else if (typeof window !== 'undefined') {
          const localHist = localStorage.getItem('special_discharges_history');
          if (localHist) {
            setHistory(JSON.parse(localHist));
          }
        }
      } catch (errH) {
        console.warn('Error cargando historial descargos:', errH);
      }

    } catch (err: any) {
      console.error('Error general cargando datos de logística:', err);
    } finally {
      setLoading(false);
    }
  };

  // Función para obtener stock de un producto en la bodega activa
  const getProductStockInWarehouse = (sku: string, whId: string): number => {
    if (!sku) return 0;
    const key = `${sku}::${whId}`;
    if (stockMap[key] !== undefined) {
      return stockMap[key];
    }
    const prod = products.find(p => p.sku === sku);
    return prod ? Number(prod.quantity ?? prod.stock ?? 0) : 0;
  };

  // Autodetectar unidades al cambiar producto origen

  // Autodetectar y sugerir producto hijo al cambiar fracción o producto padre
  const findMatchingChildProduct = (parentName: string, parentSku: string, fracText: string) => {
    if (!parentName || !products || products.length === 0) return null;
    const baseClean = parentName
      .toLowerCase()
      .replace(/gal[oó]n|gal\.?|barril|tambor|cubeta|caneca/gi, '')
      .trim();

    const preset = PRESET_FRACTIONS.find(p => p.fractionText === fracText);
    const searchTokens = [fracText];
    if (preset) {
      searchTokens.push(preset.suggestedSuffix.toLowerCase());
      if (preset.ounces) searchTokens.push(`${preset.ounces} oz`, `${preset.ounces}oz`);
    }

    const match = products.find(p => {
      if (p.sku === parentSku) return false;
      const pName = (p.name || '').toLowerCase();
      const pSku = (p.sku || '').toLowerCase();
      
      const containsBase = baseClean.length > 3 && pName.includes(baseClean.slice(0, 15));
      const containsToken = searchTokens.some(tok => pName.includes(tok) || pSku.includes(tok));
      return containsBase && containsToken;
    });

    return match || null;
  };

  // Autodetectar envase y tapa adecuados para la fracción
  const autoDetectPackagingForFraction = (fracText: string) => {
    const preset = PRESET_FRACTIONS.find(p => p.fractionText === fracText);
    const labelTok = preset ? preset.suggestedSuffix.toLowerCase() : fracText.toLowerCase();

    const foundPkg = products.find(p => {
      const nm = (p.name || '').toLowerCase();
      const isPkg = nm.includes('bote') || nm.includes('envase') || nm.includes('frasco') || nm.includes('galon vacio') || nm.includes('cubeta');
      const matchesFrac = nm.includes(labelTok) || (preset?.ounces && (nm.includes(`${preset.ounces} oz`) || nm.includes(`${preset.ounces}oz`)));
      return isPkg && matchesFrac;
    });

    const foundCap = products.find(p => {
      const nm = (p.name || '').toLowerCase();
      const isCap = nm.includes('tapa') || nm.includes('tapón') || nm.includes('tapon');
      const matchesFrac = nm.includes(labelTok) || (preset?.ounces && nm.includes(`${preset.ounces}`));
      return isCap && matchesFrac;
    });

    if (foundPkg) setSelectedPackageSku(foundPkg.sku);
    if (foundCap) setSelectedCapSku(foundCap.sku);
  };

  const handleSourceProductChange = (sku: string) => {
    setSourceSku(sku);
    const prod = products.find(p => p.sku === sku);
    if (prod) {
      const detected = prod.unit || detectUnitFromName(prod.name);
      setSourceUnit(detected);
      const child = findMatchingChildProduct(prod.name, prod.sku, selectedFractionText);
      if (child) {
        setDestinationSku(child.sku);
        setTargetUnit(child.unit || 'Unidad');
      }
    }
  };

  const handleSelectFraction = (fracText: string) => {
    setSelectedFractionText(fracText);
    setCustomFractionInput(fracText);
    const preset = PRESET_FRACTIONS.find(p => p.fractionText === fracText);
    if (preset) {
      setTargetUnit(preset.unitName);
    }
    if (selectedSourceProduct) {
      const child = findMatchingChildProduct(selectedSourceProduct.name, selectedSourceProduct.sku, fracText);
      if (child) {
        setDestinationSku(child.sku);
        setTargetUnit(child.unit || preset?.unitName || 'Unidad');
      }
    }
    autoDetectPackagingForFraction(fracText);
  };

  const handleCustomFractionChange = (text: string) => {
    setCustomFractionInput(text);
    const parsed = parseCustomFraction(text);
    if (parsed.isValid) {
      setSelectedFractionText(text);
      setTargetUnit(parsed.label);
      if (selectedSourceProduct) {
        const child = findMatchingChildProduct(selectedSourceProduct.name, selectedSourceProduct.sku, text);
        if (child) {
          setDestinationSku(child.sku);
        }
      }
      autoDetectPackagingForFraction(text);
    }
  };

  const handleDestinationProductChange = (sku: string) => {
    setDestinationSku(sku);
    const prod = products.find(p => p.sku === sku);
    if (prod) {
      const detected = prod.unit || detectUnitFromName(prod.name);
      setTargetUnit(detected);
    }
  };

  // Cálculos reactivos de fraccionamiento
  const selectedSourceProduct = useMemo(() => {
    return products.find(p => p.sku === sourceSku);
  }, [products, sourceSku]);

  const selectedDestinationProduct = useMemo(() => {
    return products.find(p => p.sku === destinationSku);
  }, [products, destinationSku]);

  const selectedPackageProduct = useMemo(() => {
    if (!selectedPackageSku || selectedPackageSku === 'none') return undefined;
    return products.find(p => p.sku === selectedPackageSku);
  }, [products, selectedPackageSku]);

  const selectedCapProduct = useMemo(() => {
    if (!selectedCapSku || selectedCapSku === 'none') return undefined;
    return products.find(p => p.sku === selectedCapSku);
  }, [products, selectedCapSku]);

  const selectedExtraProduct = useMemo(() => {
    if (!selectedExtraSku || selectedExtraSku === 'none') return undefined;
    return products.find(p => p.sku === selectedExtraSku);
  }, [products, selectedExtraSku]);

  const currentSourceStock = useMemo(() => {
    if (!sourceSku || !selectedWarehouseId) return 0;
    return getProductStockInWarehouse(sourceSku, selectedWarehouseId);
  }, [sourceSku, selectedWarehouseId, stockMap, products]);

  // Factor de fracción evaluado (porción de galón: 0.25, 0.5, 0.375, etc.)
  const parsedFractionInfo = useMemo(() => {
    return parseCustomFraction(customFractionInput || selectedFractionText);
  }, [customFractionInput, selectedFractionText]);

  // Cantidad de envases/botes resultantes a envasar
  const parsedUnitsToProduce = useMemo(() => {
    const val = parseFloat(unitsToProduce);
    return isNaN(val) || val <= 0 ? 0 : val;
  }, [unitsToProduce]);

  // Consumo total de líquido matriz (en galones u origen)
  const parsedSourceQty = useMemo(() => {
    return parsedUnitsToProduce * parsedFractionInfo.factor;
  }, [parsedUnitsToProduce, parsedFractionInfo]);

  const parsedWasteVal = useMemo(() => {
    if (!applyWaste) return 0;
    const val = parseFloat(wasteValue);
    return isNaN(val) || val <= 0 ? 0 : val;
  }, [applyWaste, wasteValue]);

  // Cálculos de unidades brutas y netas
  const grossResultingUnits = useMemo(() => {
    return parsedUnitsToProduce;
  }, [parsedUnitsToProduce]);

  const calculatedWasteUnits = useMemo(() => {
    if (!applyWaste || parsedWasteVal <= 0 || grossResultingUnits <= 0) return 0;
    if (wasteType === 'PERCENT') {
      return (grossResultingUnits * parsedWasteVal) / 100;
    }
    return Math.min(grossResultingUnits, parsedWasteVal);
  }, [applyWaste, wasteType, parsedWasteVal, grossResultingUnits]);

  const netResultingUnits = useMemo(() => {
    return Math.max(0, grossResultingUnits - calculatedWasteUnits);
  }, [grossResultingUnits, calculatedWasteUnits]);

  // Cálculos de costos y BOM de envases
  const sourceUnitCost = useMemo(() => {
    return Number(selectedSourceProduct?.cost || 0);
  }, [selectedSourceProduct]);

  const totalSourceCost = useMemo(() => {
    return parsedSourceQty * sourceUnitCost;
  }, [parsedSourceQty, sourceUnitCost]);

  // Costo de envases y tapas por unidad producida
  const unitPackagingCost = useMemo(() => {
    let cost = 0;
    if (selectedPackageProduct) cost += Number(selectedPackageProduct.cost || 0);
    if (selectedCapProduct) cost += Number(selectedCapProduct.cost || 0);
    if (selectedExtraProduct) cost += Number(selectedExtraProduct.cost || 0);
    return cost;
  }, [selectedPackageProduct, selectedCapProduct, selectedExtraProduct]);

  const totalPackagingCost = useMemo(() => {
    return unitPackagingCost * netResultingUnits;
  }, [unitPackagingCost, netResultingUnits]);

  const totalOperationCost = useMemo(() => {
    return totalSourceCost + totalPackagingCost;
  }, [totalSourceCost, totalPackagingCost]);

  // Costo unitario resultante final (Líquido + Envase + Tapa + Extras)
  const unitCostResulting = useMemo(() => {
    if (netResultingUnits <= 0) return 0;
    return totalOperationCost / netResultingUnits;
  }, [totalOperationCost, netResultingUnits]);

  const destinationPrice = useMemo(() => {
    return Number(selectedDestinationProduct?.price || 0);
  }, [selectedDestinationProduct]);

  const projectedGrossMargin = useMemo(() => {
    if (destinationPrice <= 0 || unitCostResulting <= 0) return 0;
    return ((destinationPrice - unitCostResulting) / destinationPrice) * 100;
  }, [destinationPrice, unitCostResulting]);

  // Validaciones de stock (origen y envases)
  const isStockInsufficient = parsedSourceQty > currentSourceStock;
  
  const packageStockInWh = useMemo(() => {
    if (!selectedPackageSku || selectedPackageSku === 'none' || !selectedWarehouseId) return 9999;
    return getProductStockInWarehouse(selectedPackageSku, selectedWarehouseId);
  }, [selectedPackageSku, selectedWarehouseId, stockMap, products]);

  const capStockInWh = useMemo(() => {
    if (!selectedCapSku || selectedCapSku === 'none' || !selectedWarehouseId) return 9999;
    return getProductStockInWarehouse(selectedCapSku, selectedWarehouseId);
  }, [selectedCapSku, selectedWarehouseId, stockMap, products]);

  const isPackageStockInsufficient = (selectedPackageSku && selectedPackageSku !== 'none') ? (netResultingUnits > packageStockInWh) : false;
  const isCapStockInsufficient = (selectedCapSku && selectedCapSku !== 'none') ? (netResultingUnits > capStockInWh) : false;

  const canCalculate = useMemo(() => {
    if (!selectedSourceProduct) return false;
    if (fractionFlow === 'VENTA' && !selectedDestinationProduct) return false;
    if (fractionFlow === 'PRODUCCION' && !selectedRecipeId && !destinationSku) return false;
    if (parsedSourceQty <= 0) return false;
    if (parsedUnitsToProduce <= 0) return false;
    return true;
  }, [selectedSourceProduct, fractionFlow, selectedDestinationProduct, selectedRecipeId, destinationSku, parsedSourceQty, parsedUnitsToProduce]);

  const isFormValid = useMemo(() => {
    if (!canCalculate) return false;
    if (isStockInsufficient) return false;
    if (isPackageStockInsufficient) return false;
    if (isCapStockInsufficient) return false;
    if (!selectedWarehouseId) return false;
    if (netResultingUnits <= 0) return false;
    return true;
  }, [canCalculate, isStockInsufficient, isPackageStockInsufficient, isCapStockInsufficient, selectedWarehouseId, netResultingUnits]);

  // Procesar Fraccionamiento Completo con Envases
  const handleExecuteFraction = async () => {
    if (!isFormValid || !selectedSourceProduct) return;

    setIsProcessing(true);
    const docRef = `FRAC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    try {
      const warehouse = warehouses.find(w => w.id === selectedWarehouseId);
      const warehouseName = warehouse?.name || 'Bodega Principal';

      // 1. Descontar producto origen (Matriz) en inventory_stock y en inventory
      const currentWhSourceStock = getProductStockInWarehouse(selectedSourceProduct.sku, selectedWarehouseId);
      const newWhSourceStock = Math.max(0, currentWhSourceStock - parsedSourceQty);
      const newGlobalSourceStock = Math.max(0, (selectedSourceProduct.quantity || 0) - parsedSourceQty);

      try {
        await supabase.from('inventory_stock').upsert({
          sku: selectedSourceProduct.sku,
          warehouse_id: selectedWarehouseId,
          quantity: newWhSourceStock
        }, { onConflict: 'sku,warehouse_id' });
      } catch (errUpsert) {
        console.warn('Upsert inventory_stock source warning:', errUpsert);
      }

      try {
        await supabase
          .from('inventory')
          .update({ quantity: newGlobalSourceStock })
          .eq('sku', selectedSourceProduct.sku);
      } catch (errUpd) {
        console.warn('Update inventory source warning:', errUpd);
      }

      // Kardex Origen Líquido
      try {
        await supabase.from('kardex').insert({
          sku: selectedSourceProduct.sku,
          movement_type: fractionFlow === 'VENTA' ? 'FRACCIONAMIENTO_SALIDA' : 'PRODUCCION_CONSUMO',
          location: warehouseName,
          document_ref: docRef,
          qty_in: 0,
          qty_out: parsedSourceQty,
          balance: newWhSourceStock,
          unit_cost: sourceUnitCost
        });
      } catch (kErr) {
        console.warn('Kardex insert source warning:', kErr);
      }

      // 2. Descontar envases, tapas y complementos si fueron seleccionados
      const packagingItemsToDeduct = [
        { prod: selectedPackageProduct, name: 'Envase' },
        { prod: selectedCapProduct, name: 'Tapa' },
        { prod: selectedExtraProduct, name: 'Complemento' }
      ].filter(item => item.prod !== undefined && item.prod !== null);

      for (const item of packagingItemsToDeduct) {
        const p = item.prod!;
        const whStock = getProductStockInWarehouse(p.sku, selectedWarehouseId);
        const newStock = Math.max(0, whStock - netResultingUnits);
        const newGlobalStock = Math.max(0, (p.quantity || 0) - netResultingUnits);

        try {
          await supabase.from('inventory_stock').upsert({
            sku: p.sku,
            warehouse_id: selectedWarehouseId,
            quantity: newStock
          }, { onConflict: 'sku,warehouse_id' });
        } catch (ePkgUpsert) {}

        try {
          await supabase.from('inventory').update({ quantity: newGlobalStock }).eq('sku', p.sku);
        } catch (ePkgUpd) {}

        try {
          await supabase.from('kardex').insert({
            sku: p.sku,
            movement_type: 'FRACCIONAMIENTO_INSUMO_SALIDA',
            location: warehouseName,
            document_ref: docRef,
            qty_in: 0,
            qty_out: netResultingUnits,
            balance: newStock,
            unit_cost: p.cost || 0
          });
        } catch (ePkgKardex) {}
      }

      // 3. Manejar Destino según el Flujo (Producto Fraccionado)
      if (fractionFlow === 'VENTA' && selectedDestinationProduct) {
        const currentWhDestStock = getProductStockInWarehouse(selectedDestinationProduct.sku, selectedWarehouseId);
        const newWhDestStock = currentWhDestStock + netResultingUnits;
        const newGlobalDestStock = (selectedDestinationProduct.quantity || 0) + netResultingUnits;

        try {
          await supabase.from('inventory_stock').upsert({
            sku: selectedDestinationProduct.sku,
            warehouse_id: selectedWarehouseId,
            quantity: newWhDestStock
          }, { onConflict: 'sku,warehouse_id' });
        } catch (errDstUpsert) {
          console.warn('Upsert inventory_stock destination warning:', errDstUpsert);
        }

        try {
          await supabase
            .from('inventory')
            .update({ 
              quantity: newGlobalDestStock,
              cost: unitCostResulting > 0 ? unitCostResulting : selectedDestinationProduct.cost
            })
            .eq('sku', selectedDestinationProduct.sku);
        } catch (errDstUpd) {
          console.warn('Update inventory destination warning:', errDstUpd);
        }

        // Registrar entrada Kardex
        try {
          await supabase.from('kardex').insert({
            sku: selectedDestinationProduct.sku,
            movement_type: 'FRACCIONAMIENTO_ENTRADA',
            location: warehouseName,
            document_ref: docRef,
            qty_in: netResultingUnits,
            qty_out: 0,
            balance: newWhDestStock,
            unit_cost: unitCostResulting
          });
        } catch (kDstErr) {
          console.warn('Kardex insert destination warning:', kDstErr);
        }
      }

      // 4. Si hubo merma, registrar asiento en Kardex
      if (calculatedWasteUnits > 0) {
        try {
          await supabase.from('kardex').insert({
            sku: selectedSourceProduct.sku,
            movement_type: 'MERMA_FRACCIONAMIENTO',
            location: warehouseName,
            document_ref: docRef,
            qty_in: 0,
            qty_out: calculatedWasteUnits,
            balance: newWhSourceStock,
            unit_cost: unitCostResulting
          });
        } catch (kMermaErr) {
          console.warn('Kardex insert merma warning:', kMermaErr);
        }
      }

      // 5. Guardar registro en historial con detalle de envases
      const pkgSummary = packagingItemsToDeduct.map(i => `${i.name}: ${i.prod?.name}`).join(', ');
      const newRecord: SpecialDischargeRecord = {
        id: docRef,
        type: fractionFlow === 'VENTA' ? 'FRACCIONAMIENTO' : 'CONSUMO_PRODUCCION',
        sku: selectedSourceProduct.sku,
        name: selectedSourceProduct.name,
        quantity: parsedSourceQty,
        resultingSku: fractionFlow === 'VENTA' ? destinationSku : selectedRecipeId,
        resultingName: fractionFlow === 'VENTA' ? (selectedDestinationProduct?.name || destinationSku) : `Receta / Fórmula: ${selectedRecipeId}`,
        resultingQuantity: netResultingUnits,
        warehouseId: selectedWarehouseId,
        warehouseName: warehouseName,
        flowType: fractionFlow,
        wasteQuantity: calculatedWasteUnits,
        unitCostResulting: unitCostResulting,
        batchNumber: batchNumber || undefined,
        expiryDate: expiryDate || undefined,
        reason: notes || (fractionFlow === 'VENTA' 
          ? `Fraccionamiento: ${(Number(parsedSourceQty) || 0).toFixed(2)} ${sourceUnit}(s) -> ${netResultingUnits} envases de ${selectedFractionText}. ${pkgSummary ? `[${pkgSummary}]` : ''}`
          : `Consumo directo en orden/receta de producción`),
        responsibleEmail: operatorName || user?.email || 'Desconocido',
        created_at: new Date().toISOString()
      };

      const updatedHistory = [newRecord, ...history];
      setHistory(updatedHistory);

      if (typeof window !== 'undefined') {
        localStorage.setItem('special_discharges_history', JSON.stringify(updatedHistory));
      }

      try {
        await supabase
          .from('system_config')
          .upsert({
            key: 'special_discharges_history',
            value: updatedHistory,
            updated_at: new Date().toISOString()
          }, { onConflict: 'key' });
      } catch (scErr) {
        console.warn('System config history sync warning:', scErr);
      }

      toast({
        title: 'Fraccionamiento Exitoso',
        description: fractionFlow === 'VENTA' 
          ? `Se envasaron ${netResultingUnits} botes de ${selectedFractionText} de ${selectedSourceProduct.name} con costo unitario de $${unitCostResulting.toFixed(2)}.`
          : `Se descargaron ${parsedSourceQty.toFixed(2)} ${sourceUnit}(s) directamente para consumo en producción.`,
      });

      // Resetear campos parciales
      setUnitsToProduce('4');
      setBatchNumber('');
      setExpiryDate('');
      setNotes('');
      setWasteValue('0');
      setApplyWaste(false);
      loadData();

    } catch (err: any) {
      console.error('Error al procesar fraccionamiento:', err);
      toast({
        title: 'Error al Procesar',
        description: err.message || 'No se pudo completar el movimiento de fraccionamiento.',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Procesar Salida Especial (Merma, Muestra, etc.)
  const handleExecuteDischarge = async () => {
    const selectedProd = products.find(p => p.sku === dischargeSku);
    const qty = parseFloat(dischargeQuantity);

    if (!selectedProd) {
      toast({ title: 'Atención', description: 'Selecciona un producto válido.', variant: 'destructive' });
      return;
    }
    if (isNaN(qty) || qty <= 0) {
      toast({ title: 'Atención', description: 'La cantidad debe ser mayor a 0.', variant: 'destructive' });
      return;
    }
    const currentWhStock = getProductStockInWarehouse(dischargeSku, selectedWarehouseId);
    if (qty > currentWhStock) {
      toast({ title: 'Stock Insuficiente', description: `La cantidad (${qty}) excede el stock disponible (${currentWhStock}) en la bodega seleccionada.`, variant: 'destructive' });
      return;
    }
    if (!dischargeReason.trim()) {
      toast({ title: 'Motivo Requerido', description: 'Ingresa la justificación de la salida.', variant: 'destructive' });
      return;
    }

    setIsProcessing(true);
    const docRef = `SAL-${Date.now()}`;
    try {
      const warehouse = warehouses.find(w => w.id === selectedWarehouseId);
      const warehouseName = warehouse?.name || 'Bodega Principal';

      // Descontar inventario por bodega y global
      const newWhStock = Math.max(0, currentWhStock - qty);
      const newGlobalStock = Math.max(0, (selectedProd.quantity || 0) - qty);

      try {
        await supabase.from('inventory_stock').upsert({
          sku: selectedProd.sku,
          warehouse_id: selectedWarehouseId,
          quantity: newWhStock
        }, { onConflict: 'sku,warehouse_id' });
      } catch (e1) {}

      try {
        await supabase.from('inventory').update({ quantity: newGlobalStock }).eq('sku', selectedProd.sku);
      } catch (e2) {}

      // Kardex
      try {
        await supabase.from('kardex').insert({
          sku: selectedProd.sku,
          movement_type: `SALIDA_${dischargeType}`,
          location: warehouseName,
          document_ref: docRef,
          qty_in: 0,
          qty_out: qty,
          balance: newWhStock,
          unit_cost: selectedProd.cost || 0
        });
      } catch (e3) {}

      // Historial
      const newRecord: SpecialDischargeRecord = {
        id: docRef,
        type: dischargeType,
        sku: selectedProd.sku,
        name: selectedProd.name,
        quantity: qty,
        warehouseId: selectedWarehouseId,
        warehouseName: warehouseName,
        reason: dischargeReason,
        responsibleEmail: operatorName || user?.email || 'Desconocido',
        created_at: new Date().toISOString()
      };

      const updatedHistory = [newRecord, ...history];
      setHistory(updatedHistory);

      if (typeof window !== 'undefined') {
        localStorage.setItem('special_discharges_history', JSON.stringify(updatedHistory));
      }

      try {
        await supabase
          .from('system_config')
          .upsert({
            key: 'special_discharges_history',
            value: updatedHistory,
            updated_at: new Date().toISOString()
          }, { onConflict: 'key' });
      } catch (e4) {}

      toast({
        title: 'Salida Registrada',
        description: `Se descargaron ${qty} unidades de ${selectedProd.name} por concepto de ${dischargeType}.`
      });

      setDischargeQuantity('1');
      setDischargeReason('');
      setDischargeSku('');
      loadData();

    } catch (err: any) {
      console.error('Error al registrar salida:', err);
      toast({
        title: 'Error',
        description: err.message || 'No se pudo procesar la salida especial.',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Filtrado de Historial
  const filteredHistory = useMemo(() => {
    return history.filter(item => {
      const matchType = historyFilterType === 'ALL' || item.type === historyFilterType;
      const searchLower = historySearch.toLowerCase();
      const matchSearch = !historySearch || 
        item.sku.toLowerCase().includes(searchLower) ||
        item.name.toLowerCase().includes(searchLower) ||
        (item.resultingName && item.resultingName.toLowerCase().includes(searchLower)) ||
        item.responsibleEmail.toLowerCase().includes(searchLower) ||
        item.reason.toLowerCase().includes(searchLower);
      return matchType && matchSearch;
    });
  }, [history, historyFilterType, historySearch]);

  return (
    <div className="space-y-6">
      {/* Subnavegación */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Scissors className="h-5 w-5 text-indigo-500" />
            Fraccionamiento y Salidas Especiales
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            División de productos a granel en unidades menores para venta o recetas de producción.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={loadData} 
            disabled={loading}
            className="h-8 text-xs gap-1.5"
            title="Recargar inventarios"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Cargando...' : 'Actualizar'}
          </Button>

          <Tabs value={activeSubTab} onValueChange={(v: any) => setActiveSubTab(v)} className="w-full sm:w-auto">
            <TabsList className="grid grid-cols-3 w-full sm:w-auto">
              <TabsTrigger value="fraccionar" className="text-xs gap-1.5">
                <Scissors className="h-3.5 w-3.5" /> Fraccionar
              </TabsTrigger>
              <TabsTrigger value="salidas" className="text-xs gap-1.5">
                <ArrowDownCircle className="h-3.5 w-3.5" /> Salidas Especiales
              </TabsTrigger>
              <TabsTrigger value="historial" className="text-xs gap-1.5">
                <History className="h-3.5 w-3.5" /> Historial
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* 1. SUB-TAB: FRACCIONAMIENTO */}
      {activeSubTab === 'fraccionar' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Panel Izquierdo: Configuración del Fraccionamiento */}
          <div className="lg:col-span-7 space-y-5">
            
            {/* Selector de Flujo y Modo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div 
                onClick={() => setFractionFlow('VENTA')}
                className={`cursor-pointer rounded-xl p-3.5 border transition-all ${
                  fractionFlow === 'VENTA' 
                    ? 'border-indigo-500 bg-indigo-500/10 shadow-sm ring-1 ring-indigo-500/50' 
                    : 'border-border/60 bg-card hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-lg ${fractionFlow === 'VENTA' ? 'bg-indigo-600 text-white' : 'bg-muted text-muted-foreground'}`}>
                    <Boxes className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-foreground uppercase tracking-wider">Fraccionar para Venta</div>
                    <div className="text-[11px] text-muted-foreground">Genera botes al inventario comercial</div>
                  </div>
                </div>
              </div>

              <div 
                onClick={() => setFractionFlow('PRODUCCION')}
                className={`cursor-pointer rounded-xl p-3.5 border transition-all ${
                  fractionFlow === 'PRODUCCION' 
                    ? 'border-amber-500 bg-amber-500/10 shadow-sm ring-1 ring-amber-500/50' 
                    : 'border-border/60 bg-card hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-lg ${fractionFlow === 'PRODUCCION' ? 'bg-amber-600 text-white' : 'bg-muted text-muted-foreground'}`}>
                    <Factory className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-foreground uppercase tracking-wider">Consumo en Producción</div>
                    <div className="text-[11px] text-muted-foreground">Descargo directo a orden o fórmula</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Formulario Principal de Fraccionamiento */}
            <Card className="border-border/60 shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="h-4 w-4 text-indigo-500" />
                    <div>
                      <CardTitle className="text-sm font-bold">Configuración de Fraccionamiento & Envasado</CardTitle>
                      <CardDescription className="text-xs">
                        Selecciona el galón matriz, la fracción deseada y los envases a descontar.
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono border-indigo-500/30 text-indigo-400 bg-indigo-500/10">
                    Base: 1 Galón = 128 oz
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="p-5 space-y-5">
                
                {/* Bodega y Responsable */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">Bodega de Operación *</Label>
                    <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
                      <SelectTrigger className="h-9 text-xs rounded-xl">
                        <SelectValue placeholder="Seleccionar bodega..." />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouses.map(w => (
                          <SelectItem key={w.id} value={w.id} className="text-xs">
                            {w.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                      <span>Operador Responsable</span>
                      <span className="text-[10px] text-emerald-500 flex items-center gap-0.5">
                        <ShieldCheck className="h-3 w-3" /> Verificado
                      </span>
                    </Label>
                    <div className="h-9 px-3 rounded-xl border border-input bg-muted/40 flex items-center text-xs font-semibold text-foreground truncate">
                      {operatorName || user?.email || 'Operador en sesión'}
                    </div>
                  </div>
                </div>

                {/* PASO 1: Producto Matriz (Galón / Barril / Tanque) */}
                <div className="p-4 rounded-xl border border-border/70 bg-muted/15 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> 1. Producto Matriz a Fraccionar
                    </span>
                    {selectedSourceProduct && (
                      <Badge variant="outline" className={`text-[10px] font-mono ${isStockInsufficient ? 'border-rose-500 text-rose-500 bg-rose-500/10 font-bold' : 'text-muted-foreground'}`}>
                        Stock Disponible: {(Number(currentSourceStock) || 0).toFixed(2)} {sourceUnit}s
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Seleccionar Producto Matriz *</Label>
                    <Select value={sourceSku} onValueChange={handleSourceProductChange}>
                      <SelectTrigger className="h-9 text-xs rounded-xl">
                        <SelectValue placeholder="Buscar producto líquido (galón, tambor, solvente)..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-56">
                        {products.map(p => {
                          const stockInWh = getProductStockInWarehouse(p.sku, selectedWarehouseId);
                          return (
                            <SelectItem key={p.sku} value={p.sku} className="text-xs">
                              [{p.sku}] {p.name} (Stock: {(Number(stockInWh) || 0).toFixed(2)} {p.unit || 'uds'}) - ${Number(p.cost || 0).toFixed(2)}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedSourceProduct && (
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-card border border-border/50 text-xs">
                      <div>
                        <span className="text-[10px] text-muted-foreground block uppercase font-semibold">Costo por {sourceUnit}:</span>
                        <span className="font-bold text-foreground font-mono">${sourceUnitCost.toFixed(2)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-muted-foreground block uppercase font-semibold">Unidad de Medida:</span>
                        <Badge variant="secondary" className="text-[10px] font-bold">{sourceUnit}</Badge>
                      </div>
                    </div>
                  )}

                  {isStockInsufficient && (
                    <div className="text-xs text-rose-500 flex items-center gap-1.5 bg-rose-500/10 p-2.5 rounded-lg font-medium border border-rose-500/30">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>Stock insuficiente: Se requieren {parsedSourceQty.toFixed(2)} {sourceUnit}s pero solo hay {currentSourceStock.toFixed(2)} en bodega.</span>
                    </div>
                  )}
                </div>

                {/* PASO 2: Selección Inteligente de Fracción (0.50, 0.25, 3/8, 1/32...) */}
                <div className="p-4 rounded-xl border border-indigo-500/30 bg-indigo-500/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span> 2. Fracción Comercial a Obtener
                    </span>
                    <Badge className="bg-indigo-600 text-white text-[10px] font-mono">
                      {parsedFractionInfo.label}
                    </Badge>
                  </div>

                  {/* Chips Rápidos de Fracciones Habituales */}
                  <div>
                    <Label className="text-[11px] text-muted-foreground mb-1.5 block">
                      Selecciona una fracción predefinida o escribe una personalizada (ej. 3/8, 1/32, 5/16):
                    </Label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {PRESET_FRACTIONS.map(preset => {
                        const isSelected = selectedFractionText === preset.fractionText;
                        return (
                          <button
                            key={preset.fractionText}
                            type="button"
                            onClick={() => handleSelectFraction(preset.fractionText)}
                            className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                              isSelected
                                ? 'border-indigo-500 bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-500/30 font-bold'
                                : 'border-border/70 bg-card hover:bg-muted/70 text-foreground'
                            }`}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className="text-xs font-black">{preset.fractionText}</span>
                              <span className={`text-[9px] font-mono ${isSelected ? 'text-indigo-200' : 'text-muted-foreground'}`}>
                                {preset.factor < 0.1 ? preset.factor.toFixed(4) : preset.factor.toFixed(2)}
                              </span>
                            </div>
                            <div className={`text-[10px] truncate mt-1 ${isSelected ? 'text-white' : 'text-muted-foreground'}`}>
                              {preset.label}
                            </div>
                            <div className={`text-[9px] font-mono mt-0.5 ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                              {preset.ounces} oz
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Entrada libre de fracciones (3/8, 1/32, 5/16, etc.) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Escribir Fracción Manual (ej. 1/32, 3/8, 0.25):
                      </Label>
                      <div className="relative">
                        <Input
                          value={customFractionInput}
                          onChange={e => handleCustomFractionChange(e.target.value)}
                          placeholder="Ej: 3/8 o 1/32"
                          className="h-9 text-xs font-mono font-bold pl-3"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        ¿Cuántos envases / botes vas a sacar? *
                      </Label>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={unitsToProduce}
                        onChange={e => setUnitsToProduce(e.target.value)}
                        placeholder="Ej: 4"
                        className="h-9 text-xs font-black text-indigo-600 dark:text-indigo-400"
                      />
                    </div>
                  </div>

                  {/* Resumen Visual Inmediato del Consumo */}
                  <div className="p-2.5 rounded-lg bg-background/80 border border-indigo-500/20 text-xs flex items-center justify-between">
                    <span className="text-muted-foreground">Consumo de líquido calculado:</span>
                    <span className="font-mono font-bold text-foreground">
                      {unitsToProduce || 0} envases × {parsedFractionInfo.factor < 0.1 ? parsedFractionInfo.factor.toFixed(4) : parsedFractionInfo.factor.toFixed(3)} = <strong className="text-indigo-600 dark:text-indigo-400">{parsedSourceQty.toFixed(2)} Galones</strong> ({(parsedSourceQty * 128).toFixed(1)} oz)
                    </span>
                  </div>
                </div>

                {/* PASO 3: Producto Destino y Envasado */}
                {fractionFlow === 'VENTA' ? (
                  <div className="p-4 rounded-xl border border-border/70 bg-muted/15 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> 3. Producto Resultante (Presentación en Tienda)
                      </span>
                      {selectedDestinationProduct && (
                        <Badge variant="outline" className="text-[10px] font-mono text-emerald-500 border-emerald-500/30">
                          Stock Actual: {getProductStockInWarehouse(selectedDestinationProduct.sku, selectedWarehouseId)} uds
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Producto Hijo a Cargar en Inventario *</Label>
                      <Select value={destinationSku} onValueChange={handleDestinationProductChange}>
                        <SelectTrigger className="h-9 text-xs rounded-xl">
                          <SelectValue placeholder="Seleccionar producto hijo fraccionado..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-56">
                          {products.filter(p => p.sku !== sourceSku).map(p => {
                            const stockInWh = getProductStockInWarehouse(p.sku, selectedWarehouseId);
                            return (
                              <SelectItem key={p.sku} value={p.sku} className="text-xs">
                                [{p.sku}] {p.name} (Stock: {stockInWh} {p.unit || 'uds'}) - PVP: ${Number(p.price || 0).toFixed(2)}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] text-muted-foreground">
                        {selectedDestinationProduct ? `Vinculado a: ${selectedDestinationProduct.name}` : 'Tip: Al elegir la fracción, el sistema intenta autodetectar el producto correspondiente.'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-border/70 bg-muted/15 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> 3. Vincular a Fórmula o Receta Industrial
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Receta / Orden de Producción *</Label>
                      {recipes.length > 0 ? (
                        <Select value={selectedRecipeId} onValueChange={setSelectedRecipeId}>
                          <SelectTrigger className="h-9 text-xs rounded-xl">
                            <SelectValue placeholder="Seleccionar receta industrial..." />
                          </SelectTrigger>
                          <SelectContent>
                            {recipes.map(r => (
                              <SelectItem key={r.id} value={r.id} className="text-xs">
                                {r.name} (Produce: {r.targetName})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input 
                          value={selectedRecipeId} 
                          onChange={e => setSelectedRecipeId(e.target.value)}
                          placeholder="Escribe el nombre o código de la orden/fórmula..."
                          className="h-9 text-xs rounded-xl"
                        />
                      )}
                    </div>
                  </div>
                )}

                {/* PASO 4: BOM de Envasado & Insumos Complementarios (Botes, Tapas, Extras) */}
                <div className="p-4 rounded-xl border border-border/70 bg-muted/15 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                      <PackageOpen className="h-4 w-4 text-primary" /> 4. Insumos & Envases Utilizados (Opcional)
                    </span>
                    <Badge variant="secondary" className="text-[10px]">
                      BOM de Envasado
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Selecciona los botes vacíos, tapas o aditivos que se consumirán. El sistema descontará <strong>{netResultingUnits} unidades</strong> de cada insumo y sumará su costo al producto final.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Envase / Bote */}
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground flex justify-between">
                        <span>Bote / Envase Vacío</span>
                        {selectedPackageProduct && (
                          <span className={`text-[10px] font-mono ${isPackageStockInsufficient ? 'text-rose-500 font-bold' : 'text-muted-foreground'}`}>
                            Stock: {packageStockInWh}
                          </span>
                        )}
                      </Label>
                      <Select value={selectedPackageSku} onValueChange={setSelectedPackageSku}>
                        <SelectTrigger className="h-8 text-xs rounded-lg">
                          <SelectValue placeholder="Sin envase..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-48">
                          <SelectItem value="none" className="text-xs">Ninguno / Ya incluido</SelectItem>
                          {products.filter(p => p.sku !== sourceSku && p.sku !== destinationSku).map(p => (
                            <SelectItem key={p.sku} value={p.sku} className="text-xs">
                              [{p.sku}] {p.name} (+${Number(p.cost || 0).toFixed(2)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {isPackageStockInsufficient && (
                        <span className="text-[10px] text-rose-500 block font-semibold">Stock insuficiente de botes</span>
                      )}
                    </div>

                    {/* Tapa / Cierre */}
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground flex justify-between">
                        <span>Tapa / Cierre</span>
                        {selectedCapProduct && (
                          <span className={`text-[10px] font-mono ${isCapStockInsufficient ? 'text-rose-500 font-bold' : 'text-muted-foreground'}`}>
                            Stock: {capStockInWh}
                          </span>
                        )}
                      </Label>
                      <Select value={selectedCapSku} onValueChange={setSelectedCapSku}>
                        <SelectTrigger className="h-8 text-xs rounded-lg">
                          <SelectValue placeholder="Sin tapa..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-48">
                          <SelectItem value="none" className="text-xs">Ninguna / Ya incluida</SelectItem>
                          {products.filter(p => p.sku !== sourceSku && p.sku !== destinationSku).map(p => (
                            <SelectItem key={p.sku} value={p.sku} className="text-xs">
                              [{p.sku}] {p.name} (+${Number(p.cost || 0).toFixed(2)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {isCapStockInsufficient && (
                        <span className="text-[10px] text-rose-500 block font-semibold">Stock insuficiente de tapas</span>
                      )}
                    </div>

                    {/* Complemento / Tinte / Solvente */}
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">
                        Complemento / Tinte (Extra)
                      </Label>
                      <Select value={selectedExtraSku} onValueChange={setSelectedExtraSku}>
                        <SelectTrigger className="h-8 text-xs rounded-lg">
                          <SelectValue placeholder="Sin complemento..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-48">
                          <SelectItem value="none" className="text-xs">Ninguno</SelectItem>
                          {products.filter(p => p.sku !== sourceSku && p.sku !== destinationSku).map(p => (
                            <SelectItem key={p.sku} value={p.sku} className="text-xs">
                              [{p.sku}] {p.name} (+${Number(p.cost || 0).toFixed(2)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {unitPackagingCost > 0 && (
                    <div className="p-2 rounded-lg bg-card border border-border/50 text-[11px] text-muted-foreground flex justify-between">
                      <span>Costo de empaque por unidad:</span>
                      <span className="font-mono font-bold text-foreground">+${unitPackagingCost.toFixed(2)} por cada bote</span>
                    </div>
                  )}
                </div>

                {/* PASO 5: Merma y Trazabilidad */}
                <div className="p-4 rounded-xl border border-border/70 bg-muted/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        id="waste-check"
                        checked={applyWaste} 
                        onChange={e => setApplyWaste(e.target.checked)}
                        className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                      />
                      <label htmlFor="waste-check" className="text-xs font-semibold text-foreground cursor-pointer">
                        ¿Aplica merma o desperdicio durante el envasado?
                      </label>
                    </div>
                    {applyWaste && (
                      <Badge variant="secondary" className="text-[10px] text-amber-500 bg-amber-500/10 border-amber-500/30">
                        {calculatedWasteUnits.toFixed(2)} envases perdidos
                      </Badge>
                    )}
                  </div>

                  {applyWaste && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Tipo de Merma</Label>
                        <Select value={wasteType} onValueChange={(v: any) => setWasteType(v)}>
                          <SelectTrigger className="h-9 text-xs rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PERCENT" className="text-xs">Porcentaje (%)</SelectItem>
                            <SelectItem value="FIXED" className="text-xs">Cantidad Fija (Envases)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">
                          {wasteType === 'PERCENT' ? 'Porcentaje de Merma (%)' : 'Merma Fija (Botes)'}
                        </Label>
                        <Input 
                          type="number"
                          min="0"
                          step="any"
                          value={wasteValue}
                          onChange={e => setWasteValue(e.target.value)}
                          placeholder={wasteType === 'PERCENT' ? 'Ej: 2%' : 'Ej: 1'}
                          className="h-9 text-xs rounded-xl"
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Tag className="h-3 w-3" /> N° de Lote (Opcional)
                      </Label>
                      <Input 
                        value={batchNumber}
                        onChange={e => setBatchNumber(e.target.value)}
                        placeholder="Ej: LOTE-ENV-001"
                        className="h-9 text-xs rounded-xl"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Fecha de Vencimiento (Opcional)
                      </Label>
                      <Input 
                        type="date"
                        value={expiryDate}
                        onChange={e => setExpiryDate(e.target.value)}
                        className="h-9 text-xs rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Notas / Observaciones</Label>
                    <Input 
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Ej: Fraccionado de 1 galón en 4 cuartos metálicos..."
                      className="h-9 text-xs rounded-xl"
                    />
                  </div>
                </div>

              </CardContent>
            </Card>
          </div>

          {/* Panel Derecho: Resumen Financiero y Ejecución */}
          <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-4">
            <Card className="border-border/60 shadow-md overflow-hidden rounded-2xl">
              <CardHeader className="bg-gradient-to-r from-muted/50 to-muted/20 border-b border-border/40 pb-3">
                <CardTitle className="text-sm font-bold flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-indigo-500" /> Resumen de Envasado & Costeo
                  </span>
                  {canCalculate && (
                    <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/30 font-mono">
                      Calculado en Vivo
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-xs">
                  Proyección física de inventario, consumo de envases y costo unitario real.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-5 space-y-5">
                {!canCalculate ? (
                  <div className="py-12 text-center space-y-3 text-muted-foreground">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground/60">
                      <Scissors className="h-6 w-6" />
                    </div>
                    <div className="text-xs max-w-xs mx-auto">
                      Selecciona el <strong className="text-foreground">producto matriz</strong>, la <strong className="text-foreground">fracción</strong> y los <strong className="text-foreground">botes a envasar</strong> para proyectar la operación.
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Tarjeta de Movimiento Físico */}
                    <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-card border border-border/60 text-xs">
                      <div className="space-y-1">
                        <span className="text-[10px] text-muted-foreground uppercase font-semibold">Descarga Líquido</span>
                        <div className="text-base font-black text-rose-500 font-mono">
                          - {parsedSourceQty.toFixed(2)} <span className="text-xs font-normal">{sourceUnit}(s)</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate" title={selectedSourceProduct?.name}>
                          {selectedSourceProduct?.name}
                        </div>
                      </div>

                      <div className="space-y-1 border-l border-border/40 pl-3">
                        <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                          {fractionFlow === 'VENTA' ? 'Ingreso Envasado' : 'Consumo Receta'}
                        </span>
                        <div className="text-base font-black text-emerald-500 font-mono">
                          + {netResultingUnits.toFixed(0)} <span className="text-xs font-normal">botes ({selectedFractionText})</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate" title={selectedDestinationProduct?.name}>
                          {fractionFlow === 'VENTA' ? selectedDestinationProduct?.name : (selectedRecipeId || 'Fórmula')}
                        </div>
                      </div>
                    </div>

                    {/* Desglose de Envases a Descontar */}
                    {(selectedPackageProduct || selectedCapProduct || selectedExtraProduct) && (
                      <div className="p-3 rounded-xl bg-muted/20 border border-border/60 text-xs space-y-1.5">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                          Envases & Materiales a Descontar de Bodega:
                        </span>
                        {selectedPackageProduct && (
                          <div className="flex justify-between items-center text-muted-foreground">
                            <span>• Bote ({selectedPackageProduct.name}):</span>
                            <span className="font-mono font-bold text-foreground">-{netResultingUnits} uds</span>
                          </div>
                        )}
                        {selectedCapProduct && (
                          <div className="flex justify-between items-center text-muted-foreground">
                            <span>• Tapa ({selectedCapProduct.name}):</span>
                            <span className="font-mono font-bold text-foreground">-{netResultingUnits} uds</span>
                          </div>
                        )}
                        {selectedExtraProduct && (
                          <div className="flex justify-between items-center text-muted-foreground">
                            <span>• Complemento ({selectedExtraProduct.name}):</span>
                            <span className="font-mono font-bold text-foreground">-{netResultingUnits} uds</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Merma si aplica */}
                    {applyWaste && calculatedWasteUnits > 0 && (
                      <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs space-y-1">
                        <div className="flex justify-between text-amber-500 font-medium">
                          <span>Botes brutos producidos:</span>
                          <span>{grossResultingUnits.toFixed(2)} uds</span>
                        </div>
                        <div className="flex justify-between text-amber-600 dark:text-amber-400">
                          <span>Merma / Desperdicio ({wasteType === 'PERCENT' ? `${wasteValue}%` : 'Fija'}):</span>
                          <span>- {calculatedWasteUnits.toFixed(2)} uds</span>
                        </div>
                        <div className="flex justify-between font-bold text-foreground pt-1 border-t border-amber-500/20">
                          <span>Botes netos disponibles:</span>
                          <span>{netResultingUnits.toFixed(0)} uds</span>
                        </div>
                      </div>
                    )}

                    {/* Panel Financiero & Costeo Real */}
                    <div className="space-y-2.5 pt-2 border-t border-border/40">
                      <div className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <DollarSign className="h-3.5 w-3.5 text-primary" /> Costeo Unitario Real & Rentabilidad
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="p-2.5 rounded-xl border border-border/60 bg-muted/20">
                          <div className="text-[10px] text-muted-foreground">Costo Líquido Matriz</div>
                          <div className="text-sm font-bold text-foreground mt-0.5 font-mono">
                            ${totalSourceCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="text-[9px] text-muted-foreground">
                            (${sourceUnitCost.toFixed(2)} / {sourceUnit})
                          </div>
                        </div>

                        <div className="p-2.5 rounded-xl border border-indigo-500/30 bg-indigo-500/5">
                          <div className="text-[10px] text-indigo-400 font-semibold">Costo Real por Bote</div>
                          <div className="text-sm font-black text-indigo-400 mt-0.5 font-mono">
                            ${unitCostResulting.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="text-[9px] text-muted-foreground">
                            (Pintura: ${(parsedFractionInfo.factor * sourceUnitCost).toFixed(2)} + Envase: ${unitPackagingCost.toFixed(2)})
                          </div>
                        </div>
                      </div>

                      {fractionFlow === 'VENTA' && selectedDestinationProduct && (
                        <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-1">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-muted-foreground">Precio de Venta (PVP):</span>
                            <span className="font-bold text-foreground font-mono">${destinationPrice.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs font-semibold">
                            <span className="text-emerald-500 flex items-center gap-1">
                              <TrendingUp className="h-3.5 w-3.5" /> Margen Bruto Proyectado:
                            </span>
                            <span className={`text-xs font-mono font-bold ${projectedGrossMargin > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {projectedGrossMargin.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Botón de Ejecución */}
                    <div className="pt-2">
                      <Button
                        onClick={handleExecuteFraction}
                        disabled={!isFormValid || isProcessing}
                        className="w-full h-11 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all gap-2"
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" /> Procesando Envasado...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            {fractionFlow === 'VENTA' ? '⚡ Confirmar y Envasar para Venta' : 'Confirmar Consumo en Producción'}
                          </>
                        )}
                      </Button>
                      {!isFormValid && (
                        <div className="text-[11px] text-rose-500 text-center mt-2 font-medium">
                          {isStockInsufficient ? '❌ Stock insuficiente del producto líquido.' : 
                           isPackageStockInsufficient ? '❌ Stock insuficiente de los botes seleccionados.' :
                           isCapStockInsufficient ? '❌ Stock insuficiente de las tapas seleccionadas.' :
                           'Completa los campos obligatorios para habilitar el registro.'}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

        </div>
      )}

      {/* 2. SUB-TAB: SALIDAS ESPECIALES */}
      {activeSubTab === 'salidas' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 space-y-4">
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-3 border-b border-border/40">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ArrowDownCircle className="h-4 w-4 text-rose-500" /> Registro de Salida Especial
                </CardTitle>
                <CardDescription className="text-xs">
                  Descarga física por conceptos de mermas, productos dañados, muestras o consumo interno.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Tipo de Salida *</Label>
                  <Select value={dischargeType} onValueChange={(v: any) => setDischargeType(v)}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MERMA" className="text-xs">Merma / Desecho / Vencido</SelectItem>
                      <SelectItem value="USO_INTERNO" className="text-xs">Uso Interno de la Empresa</SelectItem>
                      <SelectItem value="MUESTRA" className="text-xs">Muestra Comercial / Regalo</SelectItem>
                      <SelectItem value="AJUSTE" className="text-xs">Ajuste de Auditoría</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Bodega de Origen *</Label>
                  <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Seleccionar bodega..." />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses.map(w => (
                        <SelectItem key={w.id} value={w.id} className="text-xs">{w.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Producto a Descargar *</Label>
                  <Select value={dischargeSku} onValueChange={setDischargeSku}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Buscar producto..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {products.map(p => {
                        const stockInWh = getProductStockInWarehouse(p.sku, selectedWarehouseId);
                        return (
                          <SelectItem key={p.sku} value={p.sku} className="text-xs">
                            [{p.sku}] {p.name} (Stock: {stockInWh} {p.unit || 'uds'})
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Cantidad *</Label>
                  <Input 
                    type="number"
                    min="0.01"
                    step="any"
                    value={dischargeQuantity}
                    onChange={e => setDischargeQuantity(e.target.value)}
                    className="h-9 text-xs font-semibold"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Motivo / Justificación *</Label>
                  <Textarea 
                    value={dischargeReason}
                    onChange={e => setDischargeReason(e.target.value)}
                    placeholder="Explica detalladamente por qué se da de baja este inventario..."
                    className="text-xs resize-none h-20"
                  />
                </div>

                <Button
                  onClick={handleExecuteDischarge}
                  disabled={isProcessing || !dischargeSku || !dischargeReason.trim()}
                  className="w-full h-10 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-md gap-2"
                >
                  {isProcessing ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Procesando Salida...</>
                  ) : (
                    <><CheckCircle2 className="h-4 w-4" /> Registrar Salida en Kardex</>
                  )}
                </Button>

              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-6 space-y-4">
            <Card className="border-border/60 bg-muted/10 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Info className="h-4 w-4 text-primary" /> Política de Descargos Especiales
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 text-xs text-muted-foreground space-y-3">
                <p>
                  Toda salida registrada en esta pestaña afecta inmediatamente el balance de inventario físico en Kardex bajo tipo <strong className="text-foreground">OUT</strong>.
                </p>
                <ul className="list-disc list-inside space-y-1.5 pl-1">
                  <li><strong className="text-foreground">Merma:</strong> Utilizado para producto dañado, evaporado o vencido.</li>
                  <li><strong className="text-foreground">Uso Interno:</strong> Suministros consumidos por operaciones de la empresa.</li>
                  <li><strong className="text-foreground">Muestras:</strong> Ensayos a clientes o demostraciones comerciales.</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* 3. SUB-TAB: HISTORIAL */}
      {activeSubTab === 'historial' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-lg border border-border/60">
            <div className="relative flex-1">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input 
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                placeholder="Buscar por SKU, producto, responsable o motivo..."
                className="h-8 pl-8 text-xs"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <Select value={historyFilterType} onValueChange={setHistoryFilterType}>
                <SelectTrigger className="h-8 text-xs w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL" className="text-xs">Todos los tipos</SelectItem>
                  <SelectItem value="FRACCIONAMIENTO" className="text-xs">Fraccionamientos</SelectItem>
                  <SelectItem value="CONSUMO_PRODUCCION" className="text-xs">Consumo en Producción</SelectItem>
                  <SelectItem value="MERMA" className="text-xs">Mermas</SelectItem>
                  <SelectItem value="USO_INTERNO" className="text-xs">Uso Interno</SelectItem>
                  <SelectItem value="MUESTRA" className="text-xs">Muestras</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card className="border-border/60 shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 text-[11px]">
                  <TableHead className="w-[140px]">Fecha / Hora</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Origen (Descargado)</TableHead>
                  <TableHead>Destino / Consumo</TableHead>
                  <TableHead>Costo Resultante</TableHead>
                  <TableHead>Bodega</TableHead>
                  <TableHead>Responsable</TableHead>
                  <TableHead className="w-[200px]">Detalle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHistory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-xs text-muted-foreground">
                      No se encontraron registros de fraccionamientos ni salidas.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredHistory.map(record => (
                    <TableRow key={record.id} className="text-xs hover:bg-muted/30">
                      <TableCell className="font-mono text-[11px] text-muted-foreground">
                        {new Date(record.created_at).toLocaleString('es-SV', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={`text-[10px] font-semibold ${
                            record.type === 'FRACCIONAMIENTO' 
                              ? 'border-indigo-500/40 text-indigo-400 bg-indigo-500/10' 
                              : record.type === 'CONSUMO_PRODUCCION'
                              ? 'border-amber-500/40 text-amber-500 bg-amber-500/10'
                              : 'border-rose-500/40 text-rose-500 bg-rose-500/10'
                          }`}
                        >
                          {record.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">{record.name}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          [{record.sku}] - Qty: {record.quantity}
                        </div>
                      </TableCell>
                      <TableCell>
                        {record.resultingName ? (
                          <div>
                            <div className="font-medium text-foreground">{record.resultingName}</div>
                            <div className="text-[10px] text-emerald-500 font-semibold font-mono">
                              +{record.resultingQuantity} uds {record.wasteQuantity ? `(Merma: ${record.wasteQuantity.toFixed(2)})` : ''}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic text-[11px]">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {record.unitCostResulting ? (
                          <div className="font-semibold text-foreground font-mono text-[11px]">
                            ${record.unitCostResulting.toFixed(4)}
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic text-[11px]">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {record.warehouseName}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-[11px]">
                          <UserCheck className="h-3 w-3 text-emerald-500 shrink-0" />
                          <span className="truncate max-w-[120px]">{record.responsibleEmail}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-[11px]">
                        <div className="truncate max-w-[200px]" title={record.reason}>
                          {record.reason}
                        </div>
                        {record.batchNumber && (
                          <div className="text-[10px] text-primary">Lote: {record.batchNumber}</div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}
    </div>
  );
}
