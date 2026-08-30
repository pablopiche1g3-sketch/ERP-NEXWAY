'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { DEMO_INVENTORY, forceSeedDemoData, seedDemoDataIfEmpty } from '@/services/demoDataSeeder';
import { RealDataImporterModal } from '@/components/RealDataImporterModal';
import { 
  Truck,
  Package, 
  Plus, 
  ArrowLeft, 
  Search, 
  Trash2,
  Warehouse,
  History,
  ArrowDownCircle,
  Settings2,
  Loader2,
  Zap,
  Tag,
  FileJson,
  ArrowRightLeft,
  CheckCircle2,
  Link2,
  Info,
  Hash,
  ArrowRight,
  Upload,
  FileSpreadsheet,
  ClipboardList,
  Save
} from 'lucide-react';

function BarcodePreview({ sku }: { sku: string }) {
  if (!sku) return null;
  const code = sku.toUpperCase();
  const bars = Array.from(code).flatMap((char) => {
    const val = char.charCodeAt(0);
    return [
      (val % 3) + 1,
      ((val >> 1) % 2) === 0 ? 0 : 1,
      ((val >> 2) % 3) + 1,
      0
    ];
  });

  return (
    <div className="bg-white/5 border-b border-white/10 p-4 rounded-2xl border shadow-inner flex flex-col items-center gap-2 mt-4 animate-in fade-in slide-in-from-top-2 border-slate-200 dark:border-slate-800">
      <div className="flex h-12 items-end justify-center gap-[1.5px] w-full px-4 bg-white p-2 rounded-lg">
        {bars.map((bar, idx) => (
          bar === 0 ? (
            <div key={idx} className="w-[1.5px] h-full bg-transparent" />
          ) : (
            <div 
              key={idx} 
              className="h-full bg-slate-900" 
              style={{ width: `${bar * 1.5}px` }} 
            />
          )
        ))}
      </div>
      <span className="font-mono text-[10px] font-black tracking-[4px] text-slate-700 dark:text-muted-foreground">{code}</span>
    </div>
  );
}
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useModuleConfig } from '@/supabase/use-module-config';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/supabase/client';

interface SupplierItem {
  code: string;
  name: string;
  mappedInternalSku?: string;
}

export default function InventoryTab() {
  const { config } = useModuleConfig();
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [companySearchTerm, setCompanySearchTerm] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('Todas');
  const [maestroSubTab, setMaestroSubTab] = useState<'catalogo' | 'empresas'>('catalogo');
  
  const [activeTab, setActiveTab] = useState('existencias');

  const tabsList = useMemo(() => [
    { id: 'existencias', key: 'inventory_existencia' },
    { id: 'catalogo', key: 'inventory_maestro' },
    { id: 'auditoria', key: 'inventory_toma_fisica' },
  ], []);

  const [kardexItems, setKardexItems] = useState<any[]>([]);
  const [loadingKardex, setLoadingKardex] = useState(false);

  useEffect(() => {
    const fetchKardex = async () => {
      if (!searchTerm.trim()) {
        setKardexItems([]);
        return;
      }
      setLoadingKardex(true);
      const { data } = await supabase
        .from('inventario_kardex')
        .select('*')
        .ilike('sku', `%${searchTerm}%`)
        .order('created_at', { ascending: false })
        .limit(100);
      setKardexItems(data || []);
      setLoadingKardex(false);
    };
    
    const delayDebounceFn = setTimeout(() => {
      fetchKardex();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  useEffect(() => {
    if (!config) return;
    const currentTabObj = tabsList.find(t => t.id === activeTab);
    if (currentTabObj && config[currentTabObj.key] === false) {
      const firstEnabled = tabsList.find(t => config[t.key] !== false);
      if (firstEnabled) {
        setActiveTab(firstEnabled.id);
      }
    }
  }, [config, activeTab, tabsList]);

  // Pricing edit states
  const [selectedPriceProduct, setSelectedPriceProduct] = useState<any | null>(null);
  const [productNameValue, setProductNameValue] = useState<string>('');
  const [priceValue, setPriceValue] = useState<string>('');
  const [selectedPriceCategory, setSelectedPriceCategory] = useState<string>('General');
  const [selectedPriceSupplierSku, setSelectedPriceSupplierSku] = useState<string>('');
  const [savingPrice, setSavingPrice] = useState(false);

  // Advanced Product Edit States
  const [productBrand, setProductBrand] = useState<string>('');
  const [productType, setProductType] = useState<string>('Terminado');
  const [productUnit, setProductUnit] = useState<string>('Unidad');
  const [productLocation, setProductLocation] = useState<string>('');
  const [minStock, setMinStock] = useState<string>('0');
  const [maxStock, setMaxStock] = useState<string>('0');
  const [reorderPoint, setReorderPoint] = useState<string>('0');
  const [productCost, setProductCost] = useState<string>('0');
  const [isActive, setIsActive] = useState<boolean>(true);
  const [isService, setIsService] = useState<boolean>(false);
  const [isExempt, setIsExempt] = useState<boolean>(false);

  const handleSelectPriceProduct = async (sku: string) => {
    const prod = inventory.find(p => p.sku === sku);
    if (!prod) return;
    setSelectedPriceProduct(prod);
    setProductNameValue(prod.name || '');
    setPriceValue(prod.price?.toString() || '0');
    setSelectedPriceCategory(prod.category || 'General');
    
    setProductBrand(prod.brand || '');
    setProductType(prod.product_type || 'Terminado');
    setProductUnit(prod.unit || 'Unidad');
    setProductLocation(prod.location || '');
    setMinStock(prod.min_stock?.toString() || '0');
    setMaxStock(prod.max_stock?.toString() || '0');
    setReorderPoint(prod.reorder_point?.toString() || '0');
    setProductCost(prod.cost?.toString() || '0');
    setIsActive(prod.is_active ?? true);
    setIsService(prod.is_service ?? false);
    setIsExempt(prod.is_exempt ?? false);

    // Cargar vinculación de proveedor si existe
    const { data: mapping } = await supabase
      .from('supplier_mappings')
      .select('supplier_code')
      .eq('internal_sku', sku)
      .maybeSingle();
    
    setSelectedPriceSupplierSku(mapping?.supplier_code || '');
  };

  const handleSavePrice = async () => {
    if (!selectedPriceProduct) return;
    setSavingPrice(true);    try {
      // 1. Actualizar campos en public.inventory
      const { error: invErr } = await supabase
        .from('inventory')
        .update({ 
          name: productNameValue,
          price: parseFloat(priceValue) || 0,
          category: selectedPriceCategory,
          brand: productBrand,
          product_type: productType,
          unit: productUnit,
          location: productLocation,
          min_stock: parseFloat(minStock) || 0,
          max_stock: parseFloat(maxStock) || 0,
          reorder_point: parseFloat(reorderPoint) || 0,
          cost: parseFloat(productCost) || 0,
          is_active: isActive,
          is_service: isService,
          is_exempt: isExempt
        })
        .eq('sku', selectedPriceProduct.sku);

      if (invErr) throw invErr;

      // 2. Registrar/actualizar SKU del proveedor en public.supplier_mappings si no está en blanco
      if (selectedPriceSupplierSku.trim()) {
        const { error: mapErr } = await supabase
          .from('supplier_mappings')
          .upsert({
            supplier_code: selectedPriceSupplierSku.trim().toUpperCase(),
            internal_sku: selectedPriceProduct.sku,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'supplier_code'
          });
        
        if (mapErr) throw mapErr;
      }

      toast({ 
        title: "Cambios Guardados", 
        description: `Se actualizó el producto ${selectedPriceProduct.sku} con éxito.` 
      });
      setSelectedPriceProduct(null);
      setPriceValue('');
      setSelectedPriceSupplierSku('');
      await loadSupabaseData();
    } catch (err: any) {
      console.error(err);
      toast({ 
        variant: "destructive", 
        title: "Error al actualizar", 
        description: err.message || "No se pudieron registrar las modificaciones del producto." 
      });
    } finally {
      setSavingPrice(false);
    }
  };

  // Vinculación States
  const [supplierItems, setSupplierItems] = useState<SupplierItem[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- CARGA MASIVA STATES (NUEVO) ---
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkValidProducts, setBulkValidProducts] = useState<any[]>([]);
  const [bulkInvalidRows, setBulkInvalidRows] = useState<any[]>([]);
  const [bulkProgressPercent, setBulkProgressPercent] = useState(0);
  const [bulkProgressText, setBulkProgressText] = useState('');
  const [isSendingBulk, setIsSendingBulk] = useState(false);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  const [productForm, setProductForm] = useState({
    sku: '',
    name: '',
    category: 'General',
    cost: '0',
    margin: '0',
    price: '0'
  });

  // BMS Lógica
  const handleBmsChange = (field: string, value: string) => {
    let newForm = { ...productForm, [field]: value } as any;
    const cost = parseFloat(newForm.cost) || 0;
    
    if (field === 'cost' || field === 'margin') {
      const margin = parseFloat(newForm.margin) || 0;
      newForm.price = (cost * (1 + margin / 100)).toFixed(2);
    } else if (field === 'price') {
      const price = parseFloat(value) || 0;
      if (cost > 0) {
        newForm.margin = (((price / cost) - 1) * 100).toFixed(2);
      }
    }
    setProductForm(newForm);
  };

  // Estado para el Mapeo de Códigos de Empresas
  const [companyForm, setCompanyForm] = useState({
    masterSku: '',
    companyName: '',
    companySku: ''
  });

  // Estado para Vincular Producto a Bodega
  const [linkForm, setLinkForm] = useState({
    warehouseName: '',
    productSku: '',
    initialStock: '0'
  });

  // Estado para filtrar productos de Bodega en la pestaña Bodegas
  const [selectedWhView, setSelectedWhView] = useState('Todas');

  const [quickEntry, setQuickEntry] = useState({
    sku: '',
    quantity: '' as string | number
  });

  const [transitPurchases, setTransitPurchases] = useState<any[]>([]);

  const [warehouseName, setWarehouseName] = useState('');
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [warehouseBranchId, setWarehouseBranchId] = useState<string>('');

  useEffect(() => {
    const handleBranchChanged = () => {
      if (typeof window !== 'undefined') {
        setActiveBranchId(localStorage.getItem('active_branch_id'));
      }
    };
    handleBranchChanged();
    window.addEventListener('branchChanged', handleBranchChanged);
    return () => window.removeEventListener('branchChanged', handleBranchChanged);
  }, []);

  // Estados para datos cargados desde Supabase
  const [inventory, setInventory] = useState<any[]>([]);

  // ================================================================
  // ESTADOS: TOMA FÍSICA (Hoja de Cálculo Reactiva)
  // ================================================================
  interface TomaFisicaRow {
    id: string;
    sku: string;
    name: string;
    sistemaStock: number;
    conteoReal: number | string;
    diferencia: number;
  }
  const [tomaFisicaGrid, setTomaFisicaGrid] = useState<TomaFisicaRow[]>([]);
  const [loadingTomaFisica, setLoadingTomaFisica] = useState(false);
  const [tomaFisicaSaving, setTomaFisicaSaving] = useState(false);
  const [tomaFisicaSearch, setTomaFisicaSearch] = useState('');
  const [tomaFisicaFechaCorte, setTomaFisicaFechaCorte] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [catalogSearchTerm, setCatalogSearchTerm] = useState('');

  const filteredSystemInventory = useMemo(() => {
    const s = catalogSearchTerm.toLowerCase().trim();
    if (!s) return [];
    return (inventory || []).filter(item => {
      return (
        item.sku.toLowerCase().includes(s) ||
        item.name.toLowerCase().includes(s)
      );
    });
  }, [inventory, catalogSearchTerm]);

  const handleClearAllInventoryProducts = async () => {
    if (!confirm("⚠️ ADVERTENCIA: ¿Estás absolutamente seguro de eliminar TODOS los códigos del catálogo? Esta acción es irreversible y borrará el inventario completo.")) {
      return;
    }
    const pin = prompt("Por favor, digite 'ELIMINAR' para confirmar esta acción destructiva:");
    if (pin !== 'ELIMINAR') {
      toast({ variant: "destructive", title: "Acción Cancelada", description: "La confirmación no coincide." });
      return;
    }

    try {
      const { error } = await supabase.from('inventory').delete().neq('sku', '');
      if (error) throw error;
      toast({ title: "Catálogo Limpiado", description: "Se han eliminado todos los códigos del catálogo." });
      await loadSupabaseData();
    } catch (err: any) {
      console.error(err);
      toast({ variant: "destructive", title: "Error al limpiar catálogo", description: err.message || "No se pudo limpiar el catálogo." });
    }
  };
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [savedMappings, setSavedMappings] = useState<any[]>([]);
  const [companyMappings, setCompanyMappings] = useState<any[]>([]);
  const [loadingInv, setLoadingInv] = useState(true);
  const [loadingCompMappings, setLoadingCompMappings] = useState(true);
  const [isRealDataModalOpen, setIsRealDataModalOpen] = useState(false);

  // Estados para la pestaña de Vinculación de Proveedor
  const [mappingInternalSku, setMappingInternalSku] = useState('');
  const [mappingSupplierCode, setMappingSupplierCode] = useState('');
  const [isSavingMapping, setIsSavingMapping] = useState(false);

  // Función para cargar los datos reactivamente desde Supabase
  const loadSupabaseData = async () => {
    try {
      setLoadingInv(true);
      setLoadingCompMappings(true);

      // 1. Obtener bodegas
      const { data: whData, error: whErr } = await supabase
        .from('warehouses')
        .select('*')
        .order('name');
      
      if (whErr) throw whErr;
      const whList = whData || [];
      setWarehouses(whList);

      // Obtener sucursales
      const { data: branchesData } = await supabase
        .from('branches')
        .select('*')
        .order('name');
      setBranches(branchesData || []);

      // Helper function to bypass Supabase 1000-row limit with JWT error handling
      const fetchAllRows = async (table: string, orderByCol?: string) => {
        let allData: any[] = [];
        let start = 0;
        const limit = 1000;
        while (true) {
          let query = supabase.from(table).select('*').range(start, start + limit - 1);
          if (orderByCol) query = query.order(orderByCol);
          
          let { data, error } = await query;
          if (error && error.message?.includes('JWT expired')) {
            await supabase.auth.signOut();
            const retry = await supabase.from(table).select('*').range(start, start + limit - 1);
            data = retry.data;
            error = retry.error;
          }
          if (error) {
            console.warn(`InventoryTab fetchAllRows error on ${table}:`, error.message);
            break;
          }
          if (data && data.length > 0) {
            allData = [...allData, ...data];
          }
          if (!data || data.length < limit) break;
          start += limit;
        }
        return allData;
      };

      // 2. Obtener productos maestro
      let invList = await fetchAllRows('inventory', 'sku');

      // Si no hay acceso a la nube de pruebas o el inventario está vacío, usar datos demo locales
      if (!invList || invList.length === 0) {
        const localInvStr = localStorage.getItem('nexway_inventory');
        if (localInvStr) {
          try { invList = JSON.parse(localInvStr); } catch (e) {}
        }
        if (!invList || invList.length === 0) {
          invList = DEMO_INVENTORY;
          localStorage.setItem('nexway_inventory', JSON.stringify(DEMO_INVENTORY));
        }
      }

      // 3. Obtener existencias por bodega
      const stockList = await fetchAllRows('inventory_stock');

      // Mapear existencias al formato que espera el componente
      const whMap: Record<string, string> = {};
      whList.forEach(w => {
        whMap[w.id] = w.name;
      });

      const mappedInventory = invList.map(item => {
        const itemStocks = stockList.filter(s => s.sku === item.sku);
        const bodegasMap: Record<string, number> = {};
        
        itemStocks.forEach(s => {
          const whName = whMap[s.warehouse_id];
          if (whName) {
            bodegasMap[whName] = parseFloat(s.quantity) || 0;
          }
        });

        // Sumar total consolidado
        const totalQty = Object.values(bodegasMap).reduce((sum, val) => sum + val, 0);

        return {
          id: item.sku, // Mantenemos compatibilidad con el resto del código
          sku: item.sku,
          name: item.name,
          category: item.category,
          price: parseFloat(item.price) || 0,
          quantity: totalQty,
          bodegas: bodegasMap,
          createdAt: item.created_at,
          default_warehouse_id: item.default_warehouse_id
        };
      });

      setInventory(mappedInventory);

      // 4. Obtener vinculaciones de proveedores
      const { data: supMapData, error: supMapErr } = await supabase
        .from('supplier_mappings')
        .select('*');
      
      if (!supMapErr) {
        const mappingsList = supMapData || [];
        setSavedMappings(mappingsList.map(m => ({
          id: m.supplier_code,
          supplierCode: m.supplier_code,
          internalSku: m.internal_sku,
          updatedAt: m.updated_at
        })));
      }

      // 5. Obtener vinculaciones de empresas
      const { data: compMapData, error: compMapErr } = await supabase
        .from('company_mappings')
        .select('*');
      
      if (!compMapErr) {
        setCompanyMappings((compMapData || []).map(m => ({
          id: m.id,
          masterSku: m.master_sku,
          productName: m.product_name,
          companyName: m.company_name,
          companySku: m.company_sku,
          createdAt: m.created_at
        })));
      }

    } catch (err: any) {
      console.error('Error al cargar datos desde Supabase:', err);
      if (!err?.message?.includes('JWT expired')) {
        toast({
          variant: 'destructive',
          title: 'Error de Conexión',
          description: 'No se pudieron cargar los datos desde la nube de Supabase.'
        });
      }
    } finally {
      // 5. Obtener compras en tránsito (BMS)
      const { data: transitData, error: transitErr } = await supabase
        .from('purchases')
        .select('*, purchase_items(*)')
        .eq('status', 'PRE-PAGADO_EN_TRANSITO');
      
      if (!transitErr && transitData) {
        setTransitPurchases(transitData);
      }
      
      setLoadingInv(false);
      setLoadingCompMappings(false);
    }
  };

  const handleLoadDemoData = () => {
    forceSeedDemoData();
    toast({
      title: "¡Datos Demo Cargados! ⚡",
      description: "Se han cargado productos, bodegas, clientes y usuarios de prueba."
    });
    loadSupabaseData();
  };

  // Cargar datos en el montaje
  useEffect(() => {
    seedDemoDataIfEmpty();
    loadSupabaseData();
  }, []);

  // ================================================================
  // FUNCIONES: VINCULACIÓN DE PROVEEDOR (NUEVO)
  // ================================================================
  const handleLinkSupplierSku = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mappingInternalSku || !mappingSupplierCode.trim()) {
      toast({
        variant: "destructive",
        title: "Campos vacíos",
        description: "Debe seleccionar un producto interno e ingresar el código del proveedor."
      });
      return;
    }
    
    setIsSavingMapping(true);
    try {
      const { error } = await supabase
        .from('supplier_mappings')
        .upsert({
          supplier_code: mappingSupplierCode.trim().toUpperCase(),
          internal_sku: mappingInternalSku,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'supplier_code'
        });

      if (error) throw error;

      toast({
        title: "Vinculación Exitosa 🎉",
        description: `Se vinculó el código "${mappingSupplierCode.toUpperCase()}" con el SKU interno "${mappingInternalSku}".`
      });

      setMappingSupplierCode('');
      setMappingInternalSku('');
      await loadSupabaseData();
    } catch (err: any) {
      console.error(err);
      toast({
        variant: "destructive",
        title: "Error al vincular",
        description: err.message || "No se pudo guardar la vinculación."
      });
    } finally {
      setIsSavingMapping(false);
    }
  };

  const handleDeleteSupplierMapping = async (supplierCode: string) => {
    if (!confirm(`¿Eliminar la vinculación del código de proveedor "${supplierCode}"?`)) return;
    try {
      const { error } = await supabase
        .from('supplier_mappings')
        .delete()
        .eq('supplier_code', supplierCode);

      if (error) throw error;
      toast({ title: "Vinculación eliminada" });
      await loadSupabaseData();
    } catch (err: any) {
      console.error(err);
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  // ================================================================
  // FUNCIONES: TOMA FÍSICA
  // ================================================================

  /** Carga el catálogo maestro + stocks consolidados y construye la cuadrícula */
  const fetchTomaFisicaItems = async () => {
    setLoadingTomaFisica(true);
    try {
      // Traer catálogo maestro
      const { data: invItems, error: invErr } = await supabase
        .from('inventory')
        .select('sku, name')
        .order('sku');
      if (invErr) throw invErr;

      // Traer existencias por bodega
      const { data: stockItems } = await supabase
        .from('inventory_stock')
        .select('sku, quantity');

      // Construir mapa de stocks consolidados
      const stockMap: Record<string, number> = {};
      (stockItems || []).forEach((s: any) => {
        const qty = parseFloat(s.quantity) || 0;
        stockMap[s.sku] = (stockMap[s.sku] || 0) + qty;
      });

      const rows: TomaFisicaRow[] = (invItems || []).map((item: any) => {
        const sistemaStock = stockMap[item.sku] ?? 0;
        return {
          id: item.sku,
          sku: item.sku,
          name: item.name,
          sistemaStock,
          conteoReal: '',
          diferencia: 0,
        };
      });

      setTomaFisicaGrid(rows);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error al cargar Toma Física',
        description: err.message || 'No se pudo cargar el catálogo de productos.',
      });
    } finally {
      setLoadingTomaFisica(false);
    }
  };

  /** Actualiza el conteo real de una fila y recalcula la diferencia en tiempo real */
  const handleConteoRealChange = (sku: string, valor: string) => {
    setTomaFisicaGrid(prev =>
      prev.map(row => {
        if (row.sku !== sku) return row;
        const conteoReal = valor === '' ? '' : parseFloat(valor) || 0;
        const diferencia = typeof conteoReal === 'number'
          ? conteoReal - row.sistemaStock
          : 0;
        return { ...row, conteoReal, diferencia };
      })
    );
  };

  /** Guarda la cuadrícula completa en la tabla modulos_personalizados de Supabase */
  const handleFinalizarConteo = async () => {
    const rowsConConteo = tomaFisicaGrid.filter(r => r.conteoReal !== '');
    if (rowsConConteo.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Sin datos',
        description: 'Ingrese al menos un conteo antes de finalizar.',
      });
      return;
    }

    setTomaFisicaSaving(true);
    try {
      const payload = {
        nombre_modulo: 'toma_fisica',
        datos: {
          fecha_corte: tomaFisicaFechaCorte,
          total_items: tomaFisicaGrid.length,
          items_contados: rowsConConteo.length,
          cuadricula: tomaFisicaGrid.map(r => ({
            sku: r.sku,
            nombre_producto: r.name,
            stock_sistema: r.sistemaStock,
            conteo_real: r.conteoReal === '' ? null : Number(r.conteoReal),
            diferencia: r.diferencia,
          })),
        },
        producto_id: null,
      };

      const { error } = await supabase
        .from('modulos_personalizados')
        .insert(payload);

      if (error) throw error;

      toast({
        title: '✅ Toma Física Guardada',
        description: `${rowsConConteo.length} ítems registrados correctamente en la nube.`,
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error al guardar',
        description: err.message || 'No se pudo guardar la toma física.',
      });
    } finally {
      setTomaFisicaSaving(false);
    }
  };

  // Cargar toma física cuando se activa la pestaña
  useEffect(() => {
    if (activeTab === 'toma-fisica') {
      fetchTomaFisicaItems();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Filtrado reactivo de filas en la hoja de cálculo
  const tomaFisicaFiltered = useMemo(() => {
    const s = tomaFisicaSearch.toLowerCase().trim();
    if (!s) return tomaFisicaGrid;
    return tomaFisicaGrid.filter(r =>
      r.sku.toLowerCase().includes(s) ||
      r.name.toLowerCase().includes(s)
    );
  }, [tomaFisicaGrid, tomaFisicaSearch]);

  // Estadísticas en tiempo real para el resumen
  const tomaFisicaStats = useMemo(() => {
    const contados = tomaFisicaGrid.filter(r => r.conteoReal !== '').length;
    const sobrantes = tomaFisicaGrid.filter(r => typeof r.conteoReal === 'number' && r.diferencia > 0).length;
    const faltantes = tomaFisicaGrid.filter(r => typeof r.conteoReal === 'number' && r.diferencia < 0).length;
    const exactos = tomaFisicaGrid.filter(r => typeof r.conteoReal === 'number' && r.diferencia === 0).length;
    return { contados, sobrantes, faltantes, exactos };
  }, [tomaFisicaGrid]);

  // Generar SKU Automático según categoría
  const generateAutoSku = () => {
    const prefixMap: Record<string, string> = {
      'General': 'GEN',
      'Ferretería': 'FER',
      'Fontanería': 'FON',
      'Electricidad': 'ELE',
      'Herramientas': 'HER',
      'Mantenimiento': 'MAN',
      'Automotriz': 'AUT',
      'Repuestos de Vehículos': 'REP',
      'Accesorios': 'ACC',
      'Lubricantes': 'LUB'
    };
    const prefix = prefixMap[productForm.category] || 'PROD';
    
    let maxSeq = 0;
    if (inventory) {
      inventory.forEach((item: any) => {
        if (item.sku && item.sku.startsWith(`${prefix}-`)) {
          const part = item.sku.split('-')[1];
          const num = parseInt(part, 10);
          if (!isNaN(num) && num > maxSeq) {
            maxSeq = num;
          }
        }
      });
    }
    
    const nextSeq = String(maxSeq + 1).padStart(4, '0');
    const newSku = `${prefix}-${nextSeq}`;
    
    setProductForm({
      ...productForm,
      sku: newSku
    });
    
    toast({
      title: "SKU Generado",
      description: `Código sugerido: ${newSku} para la categoría ${productForm.category}`
    });
  };

  // --- LÓGICA DE CARGA MASIVA ---
  const handleDownloadTemplate = async () => {
    const XLSX = await import('xlsx');
    const plantillaData = [['SKU', 'Descripción'],['PROD-001', 'Laptop Gamer 15 pulgadas'],['PROD-002', 'Mouse inalámbrico ergonómico']];
    const ws = XLSX.utils.aoa_to_sheet(plantillaData);
    ws['!cols'] = [{wch:18},{wch:40}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Productos');
    XLSX.writeFile(wb, 'plantilla_nexway_masiva.xlsx');
    toast({ title: "Plantilla descargada", description: "Revisa tu carpeta de descargas." });
  };

  const processBulkFile = async (file: File) => {
    setBulkFile(file);
    setBulkValidProducts([]);
    setBulkInvalidRows([]);
    setBulkProgressPercent(0);
    setBulkProgressText('');
    
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv', 'xlsm'].includes(extension || '')) {
      toast({ variant: "destructive", title: "Formato no soportado", description: "Use .xlsx, .xls o .csv" });
      return;
    }

    toast({ title: "Procesando archivo...", description: "Leyendo datos del Excel." });
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const XLSX = await import('xlsx');
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: false });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" }) as any[][];
        
        if (!rows || rows.length < 2) throw new Error("El archivo debe tener al menos una fila de encabezados y datos.");
        
        const headersRaw = rows[0].map(c => String(c).trim().toLowerCase());
        let skuCol = headersRaw.findIndex(h => h.includes('sku') || h.includes('codigo') || h.includes('código') || h.includes('referencia') || h.includes('ref'));
        let descCol = headersRaw.findIndex(h => h.includes('descripción') || h.includes('descripcion') || h.includes('nombre') || h.includes('detalle'));
        
        if (skuCol === -1) skuCol = 0;
        if (descCol === -1 && headersRaw.length >= 2 && skuCol !== 1) descCol = 1;

        const validTempMap = new Map();
        const invalidTemp: any[] = [];
        
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;
          
          const skuRaw = row[skuCol] !== undefined ? String(row[skuCol]).trim() : '';
          if (skuRaw === "") {
            invalidTemp.push({ row: i+1, reason: "SKU vacío" });
            continue;
          }
          
          let descripcion = "Sin descripción";
          if (descCol !== -1 && row[descCol] !== undefined && row[descCol] !== null) {
            const d = String(row[descCol]).trim();
            if (d !== "") descripcion = d;
          }
          
          validTempMap.set(skuRaw.toUpperCase(), { sku: skuRaw.toUpperCase(), descripcion });
        }
        
        const validTemp = Array.from(validTempMap.values());
        setBulkValidProducts(validTemp);
        setBulkInvalidRows(invalidTemp);
        
        if (invalidTemp.length > 0) {
          toast({ variant: "destructive", title: "Filas omitidas", description: `Se omitieron ${invalidTemp.length} filas por SKU vacío o inválido.`});
        }
        toast({ title: "Carga exitosa", description: `${validTemp.length} productos listos para enviar.` });
        
      } catch (err: any) {
        toast({ variant: "destructive", title: "Error al leer", description: err.message });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleBulkUploadSubmit = async () => {
    if (bulkValidProducts.length === 0) return;
    setIsSendingBulk(true);
    setBulkProgressPercent(0);
    
    const CHUNK_SIZE = 500;
    const totalChunks = Math.ceil(bulkValidProducts.length / CHUNK_SIZE);
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < totalChunks; i++) {
      const chunk = bulkValidProducts.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      const percent = Math.round(((i + 1) / totalChunks) * 100);
      setBulkProgressPercent(percent);
      setBulkProgressText(`Enviando lote ${i+1} de ${totalChunks}...`);
      
      const payload = chunk.map(p => ({
        sku: p.sku.toUpperCase(),
        name: p.descripcion,
        category: 'General',
        price: 0
      }));

      const { error } = await supabase.from('inventory').upsert(payload, { onConflict: 'sku' });
        
      if (error) {
        errorCount += chunk.length;
        console.error("Bulk upload error on chunk", i, error);
      } else {
        successCount += chunk.length;
      }
    }
    
    setIsSendingBulk(false);
    if (errorCount === 0) {
      toast({ title: "Éxito masivo", description: `${successCount} productos guardados en Supabase correctamente.` });
      setBulkValidProducts([]);
      setBulkInvalidRows([]);
      setBulkFile(null);
      if (bulkFileInputRef.current) bulkFileInputRef.current.value = '';
      await loadSupabaseData();
    } else {
      toast({ variant: "destructive", title: "Carga parcial", description: `${successCount} enviados, ${errorCount} con error.` });
    }
  };

  // Crear Producto Maestro
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.sku || !productForm.name) {
      toast({ variant: "destructive", title: "Campos incompletos", description: "SKU y Nombre son obligatorios." });
      return;
    }

    setLoading(true);
    try {
      const existing = inventory.find(p => p.sku === productForm.sku.toUpperCase());
      if (existing) {
        toast({ variant: "destructive", title: "Error", description: "Este código SKU ya existe en el sistema." });
        setLoading(false);
        return;
      }

      const productPayload: any = {
        sku: productForm.sku.toUpperCase(),
        name: productForm.name,
        category: productForm.category,
        cost: parseFloat((productForm as any).cost) || 0,
        margin: parseFloat((productForm as any).margin) || 0,
        price: parseFloat((productForm as any).price) || 0
      };

      let { error } = await supabase
        .from('inventory')
        .insert(productPayload);

      if (error && (error.message?.includes('margin') || error.message?.includes('cost') || error.code === 'PGRST204')) {
        delete productPayload.margin;
        delete productPayload.cost;
        const retry = await supabase.from('inventory').insert(productPayload);
        error = retry.error;
      }

      if (error) throw error;

      toast({ title: "Código Autorizado", description: "El producto ha sido registrado en el maestro." });
      setProductForm({ sku: '', name: '', category: 'General', cost: '0', margin: '0', price: '0' } as any);
      await loadSupabaseData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error al crear producto", description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      const { error } = await supabase
        .from('inventory')
        .delete()
        .eq('sku', id);

      if (error) throw error;
      toast({ title: "Producto Eliminado" });
      await loadSupabaseData();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error al eliminar", description: e.message });
    }
  };

  // Crear Mapeo de Código Interno de Empresa Externa
  const handleCreateCompanyMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyForm.masterSku || !companyForm.companyName || !companyForm.companySku) {
      toast({ variant: "destructive", title: "Campos Incompletos", description: "Todos los campos son requeridos." });
      return;
    }

    setLoading(true);
    try {
      const selectedProduct = inventory?.find((p: any) => p.sku === companyForm.masterSku);
      const { error } = await supabase
        .from('company_mappings')
        .insert({
          master_sku: companyForm.masterSku,
          product_name: selectedProduct ? selectedProduct.name : 'Producto',
          company_name: companyForm.companyName,
          company_sku: companyForm.companySku.toUpperCase()
        });

      if (error) throw error;
      toast({ title: "Código de Empresa Asociado", description: "Se vinculó el código interno con éxito." });
      setCompanyForm({ masterSku: '', companyName: '', companySku: '' });
      await loadSupabaseData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message || "No se pudo crear la vinculación." });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCompanyMapping = async (id: string) => {
    try {
      const { error } = await supabase
        .from('company_mappings')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast({ title: "Asociación Removida" });
      await loadSupabaseData();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error al eliminar la asociación", description: e.message });
    }
  };

  // Asignar y vincular un producto a una bodega con stock
  const handleLinkProductToWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkForm.warehouseName || !linkForm.productSku) {
      toast({ variant: "destructive", title: "Datos Incompletos", description: "Seleccione bodega y producto." });
      return;
    }

    setLoading(true);
    try {
      const product = inventory?.find((p: any) => p.sku === linkForm.productSku);
      if (!product) {
        toast({ variant: "destructive", title: "No encontrado", description: "El producto no existe." });
        setLoading(false);
        return;
      }

      const wh = warehouses.find(w => w.name === linkForm.warehouseName);
      if (!wh) {
        toast({ variant: "destructive", title: "No encontrado", description: "La bodega no existe." });
        setLoading(false);
        return;
      }

      const newStock = parseFloat(linkForm.initialStock) || 0;

      const { error } = await supabase
        .from('inventory_stock')
        .upsert({
          sku: linkForm.productSku.toUpperCase(),
          warehouse_id: wh.id,
          quantity: newStock
        }, {
          onConflict: 'sku,warehouse_id'
        });

      if (error) throw error;

      toast({ 
        title: "Producto Vinculado a Bodega", 
        description: `Se asignó el SKU ${linkForm.productSku} a la bodega '${linkForm.warehouseName}' con stock inicial de ${newStock} un.` 
      });
      setLinkForm({ ...linkForm, productSku: '', initialStock: '0' });
      await loadSupabaseData();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error al vincular", description: e.message || "No se pudo actualizar el inventario." });
    } finally {
      setLoading(false);
    }
  };

  const handleUnlinkProductFromWarehouse = async (productId: string, whName: string) => {
    try {
      const wh = warehouses.find(w => w.name === whName);
      if (!wh) {
        toast({ variant: "destructive", title: "Error", description: "Bodega no encontrada." });
        return;
      }

      const { error } = await supabase
        .from('inventory_stock')
        .delete()
        .eq('sku', productId)
        .eq('warehouse_id', wh.id);

      if (error) throw error;

      toast({ title: "Asociación Removida", description: `Se desvinculó el producto de la bodega ${whName}.` });
      await loadSupabaseData();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error al desvincular", description: e.message });
    }
  };

  const handleQuickStockEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickEntry.sku || !quickEntry.quantity) {
      toast({ variant: "destructive", title: "Datos Faltantes", description: "Debe ingresar SKU y Cantidad." });
      return;
    }

    const product = inventory?.find((p: any) => p.sku === quickEntry.sku.toUpperCase());
    if (!product) {
      toast({ variant: "destructive", title: "No Encontrado", description: "El SKU no existe en el maestro." });
      return;
    }

    const addedQty = parseFloat(String(quickEntry.quantity)) || 0;

    try {
      let targetWarehouseId = '';
      let targetWarehouseName = '';
      
      if (product.default_warehouse_id) {
        targetWarehouseId = product.default_warehouse_id;
        const whObj = warehouses.find(w => w.id === targetWarehouseId);
        targetWarehouseName = whObj ? whObj.name : 'Desconocida';
        toast({ title: "BMS Enrutamiento", description: `Enrutado auto a: ${targetWarehouseName}` });
      } else if (selectedWarehouse !== 'Todas') {
        const wh = warehouses.find(w => w.name === selectedWarehouse);
        if (!wh) {
          toast({ variant: "destructive", title: "Error", description: "La bodega seleccionada no existe." });
          return;
        }
        targetWarehouseId = wh.id;
        targetWarehouseName = wh.name;
      } else {
        if (warehouses.length === 0) {
          toast({ variant: 'destructive', title: 'Error', description: 'Debe crear al menos una bodega primero.' });
          return;
        }
        targetWarehouseId = warehouses[0].id;
        targetWarehouseName = warehouses[0].name;
      }

      const currentQty = product.bodegas[targetWarehouseName] || 0;
      const newQty = currentQty + addedQty;

      const stockUpdates = [{
        action: 'UPSERT',
        sku: product.sku,
        warehouse_id: targetWarehouseId,
        quantity: newQty
      }];

      const kardexInserts = [{
        sku: product.sku,
        movement_type: 'INGRESO RÁPIDO',
        location: targetWarehouseName,
        document_ref: `INGRESO-MANUAL`,
        qty_in: addedQty,
        qty_out: 0,
        balance: newQty,
        unit_cost: product.price || 0
      }];

      const { error } = await supabase.rpc('process_inventory_transaction', {
        p_stock_updates: stockUpdates,
        p_kardex_inserts: kardexInserts
      });

      if (error) throw error;
      
      console.log(`[NEXBOT EVENT] Recibidos ${quickEntry.quantity} de ${product.sku} en ${targetWarehouseName}`);

      toast({ title: "Stock Actualizado", description: `Se agregaron ${quickEntry.quantity} unidades.` });
      setQuickEntry({ sku: '', quantity: '' });
      await loadSupabaseData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error al actualizar stock", description: err.message });
    }
  };

  const handleReceiveTransit = async (purchaseId: string, items: any[]) => {
    try {
      const { error: updErr } = await supabase
        .from('purchases')
        .update({ status: 'COMPLETADO' })
        .eq('id', purchaseId);
        
      if (updErr) throw updErr;
      
      for (const item of items) {
        const product = inventory?.find((p: any) => p.sku === item.product_sku);
        if (!product) continue;
        
        let targetWhId = product.default_warehouse_id || (warehouses[0]?.id);
        if (!targetWhId) continue;
        
        const { data: currentStock } = await supabase
          .from('inventory_stock')
          .select('quantity')
          .eq('sku', product.sku)
          .eq('warehouse_id', targetWhId)
          .single();
          
        const currentQty = currentStock ? parseFloat(currentStock.quantity) : 0;
        const stockUpdates = [{
          action: 'UPSERT',
          sku: product.sku,
          warehouse_id: targetWhId,
          quantity: currentQty + parseFloat(item.quantity)
        }];

        const kardexInserts = [{
          sku: product.sku,
          movement_type: 'INGRESO RÁPIDO',
          location: warehouses.find(w => w.id === targetWhId)?.name || 'N/A',
          document_ref: `COMPRA-${purchaseId.split('-')[0]}`,
          qty_in: parseFloat(item.quantity),
          qty_out: 0,
          balance: currentQty + parseFloat(item.quantity),
          unit_cost: item.price || product.price || 0
        }];

        await supabase.rpc('process_inventory_transaction', {
          p_stock_updates: stockUpdates,
          p_kardex_inserts: kardexInserts
        });
          
        console.log(`[NEXBOT EVENT] Compra Pre-pagada Recibida: ${item.quantity} de ${product.sku}`);
      }
      
      toast({ title: "Recepción Completada", description: "La compra en tránsito ha ingresado al inventario." });
      await loadSupabaseData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleCreateWarehouse = async () => {
    if (!warehouseName) return;
    try {
      const { error } = await supabase
        .from('warehouses')
        .insert({ 
          name: warehouseName,
          branch_id: warehouseBranchId || activeBranchId || null
        });

      if (error) throw error;
      toast({ title: "Bodega Configurada", description: "La bodega ya está disponible." });
      setWarehouseName('');
      setWarehouseBranchId('');
      await loadSupabaseData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error al crear bodega", description: err.message });
    }
  };

  const handleDeleteWarehouse = async (id: string) => {
    try {
      const { error } = await supabase
        .from('warehouses')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: "Bodega Eliminada", description: "Se ha removido la bodega del sistema." });
      await loadSupabaseData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error al eliminar bodega", description: err.message });
    }
  };

  const handleJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        let items: SupplierItem[] = [];

        // Lógica DTE SV V3
        if (json.cuerpoDocumento && Array.isArray(json.cuerpoDocumento)) {
          items = json.cuerpoDocumento.map((item: any) => ({
            code: item.codigo || item.sku || 'S/C',
            name: item.descripcion || item.nombre || 'Sin descripción'
          }));
        } 
        else if (Array.isArray(json)) {
          items = json.map((item: any) => ({
            code: item.codigo || item.code || item.sku || 'S/C',
            name: item.descripcion || item.name || 'Sin descripción'
          }));
        } else {
          toast({ variant: "destructive", title: "Formato Inválido", description: "El JSON no tiene una estructura compatible con DTE V3." });
          return;
        }

        setSupplierItems(items);
        
        const initialMappings: Record<string, string> = {};
        items.forEach(item => {
          const existing = savedMappings?.find((m: any) => m.supplierCode === item.code);
          if (existing) {
            initialMappings[item.code] = existing.internalSku;
          }
        });
        setMappings(initialMappings);

        toast({ title: "DTE V3 Cargado", description: `Se encontraron ${items.length} productos del proveedor.` });
      } catch (error) {
        toast({ variant: "destructive", title: "Error al leer archivo" });
      }
    };
    reader.readAsText(file);
  };

  const saveMappings = async () => {
    setLoading(true);
    try {
      for (const [supCode, intSku] of Object.entries(mappings)) {
        const { error } = await supabase
          .from('supplier_mappings')
          .upsert({
            supplier_code: supCode,
            internal_sku: intSku,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'supplier_code'
          });
        if (error) throw error;
      }
      toast({ title: "Vinculaciones Guardadas", description: "Los códigos han sido asociados correctamente." });
      await loadSupabaseData();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error al guardar vinculaciones", description: e.message });
    } finally {
      setLoading(false);
    }
  };

  // Filtrado de existencias considerando la Bodega Seleccionada
  const filteredItems = useMemo(() => {
    if (!inventory) return [];
    
    if (selectedWarehouse === 'Todas') {
      // Consolidado requiere escribir para buscar
      if (!searchTerm.trim()) return [];
      return inventory.filter(item => 
        item.sku.toLowerCase().includes(searchTerm.toLowerCase()) || 
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    } else {
      // Bodega específica: mostrar todo si no hay búsqueda
      const whFiltered = inventory.filter(item => item.bodegas && selectedWarehouse in item.bodegas);
      if (!searchTerm.trim()) return whFiltered;
      
      return whFiltered.filter(item => 
        item.sku.toLowerCase().includes(searchTerm.toLowerCase()) || 
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
  }, [searchTerm, inventory, selectedWarehouse]);

  // Filtrar Códigos de Empresas Asociados
  const filteredCompanyMappings = useMemo(() => {
    if (!companyMappings || !companySearchTerm.trim()) return [];
    return companyMappings.filter(m => 
      m.masterSku.toLowerCase().includes(companySearchTerm.toLowerCase()) || 
      m.companyName.toLowerCase().includes(companySearchTerm.toLowerCase()) ||
      m.companySku.toLowerCase().includes(companySearchTerm.toLowerCase())
    );
  }, [companySearchTerm, companyMappings]);
  // Filtrar productos vinculados a la Bodega en la sección de consulta de la pestaña Bodegas
  const productsInSelectedWarehouse = useMemo(() => {
    if (!inventory) return [];
    if (selectedWhView === 'Todas') return inventory;
    return inventory.filter(item => item.bodegas && selectedWhView in item.bodegas);
  }, [inventory, selectedWhView]);

  return (
    <div className="min-h-screen bg-transparent">
      <div className="w-full max-w-[1920px] mx-auto mb-6 md:mb-8 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-full bg-card border-border shadow-sm hover:bg-white/10 border-white/10 text-white" 
            onClick={() => router.push('/')}
          >
            <ArrowLeft className="text-white" size={20} />
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">Centro Logístico & Catálogo</h1>
            <p className="text-slate-400 text-xs md:text-sm">Administración de stock por bodega, códigos maestros de empresas y almacenes</p>
          </div>
        </div>

        <Button
          onClick={() => setIsRealDataModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 rounded-xl shadow-md flex items-center gap-1.5"
        >
          <Upload size={15} /> Cargar / Importar Datos Reales
        </Button>

        <RealDataImporterModal
          isOpen={isRealDataModalOpen}
          onClose={() => setIsRealDataModalOpen(false)}
          onSuccess={() => loadSupabaseData()}
        />
      </div>
 
      <div className="w-full max-w-[1920px] mx-auto relative z-10">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-card border-border shadow-sm p-1 rounded-2xl h-auto w-full justify-start overflow-x-auto no-scrollbar">
            {config?.['inventory_existencia'] !== false && (
              <TabsTrigger data-tour-id="tab-existencias" value="existencias" className="rounded-xl px-4 md:px-6 py-2 text-xs md:text-sm font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white whitespace-nowrap">
                <Package size={14} className="mr-2" /> Existencias y Kárdex
              </TabsTrigger>
            )}
            {config?.['inventory_maestro'] !== false && (
              <TabsTrigger data-tour-id="tab-catalogo" value="catalogo" className="rounded-xl px-4 md:px-6 py-2 text-xs md:text-sm font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white whitespace-nowrap">
                <Tag size={14} className="mr-2" /> Catálogo Maestro
              </TabsTrigger>
            )}
            {config?.['inventory_toma_fisica'] !== false && (
              <TabsTrigger data-tour-id="tab-auditoria" value="auditoria" className="rounded-xl px-4 md:px-6 py-2 text-xs md:text-sm font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white whitespace-nowrap">
                <ClipboardList size={14} className="mr-2" /> Auditoría de Bodegas
              </TabsTrigger>
            )}
          </TabsList>
 
          {/* TAB EXISTENCIAS CON FILTRO DE STOCK POR BODEGA */}
          
 
 
          <TabsContent value="existencias" className="space-y-4 outline-none">
            <Tabs defaultValue="existencia" className="w-full space-y-4">
              <TabsList className="bg-white/5 border border-white/10 rounded-xl p-1 mb-4 flex w-fit overflow-x-auto">
                <TabsTrigger value="existencia" className="rounded-lg text-xs font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white">Inventario Actual</TabsTrigger>
                <TabsTrigger value="kardex" className="rounded-lg text-xs font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white">Kárdex de Movimientos</TabsTrigger>
              </TabsList>
              <TabsContent value="existencia" className="space-y-4 outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-1 space-y-4">
                <Card className="bg-card border-border shadow-sm rounded-2xl h-fit hidden lg:block">
                  <CardHeader>
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Warehouse size={18} className="text-blue-600" /> Bodega de Consulta
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 pb-4">
                    <div className="px-4 space-y-1">
                      <Button 
                        variant={selectedWarehouse === 'Todas' ? 'default' : 'ghost'} 
                        className="w-full justify-start rounded-xl h-10 text-xs font-bold animate-in fade-in"
                        onClick={() => setSelectedWarehouse('Todas')}
                      >
                        Consolidado (Todas)
                      </Button>
                      {warehouses?.map((wh: any) => (
                        <Button 
                          key={wh.id}
                          variant={selectedWarehouse === wh.name ? 'default' : 'ghost'} 
                          className="w-full justify-start rounded-xl h-10 text-xs font-bold truncate"
                          onClick={() => setSelectedWarehouse(wh.name)}
                        >
                          {wh.name}
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                <div className="lg:hidden">
                  <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
                    <SelectTrigger className="w-full rounded-xl bg-card border-border shadow-sm h-11 border-none shadow-sm text-xs font-bold">
                      <SelectValue placeholder="Filtrar por bodega" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Todas">Consolidado (Todas)</SelectItem>
                      {warehouses?.map((wh: any) => (
                        <SelectItem key={wh.id} value={wh.name}>{wh.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
 
              <div className="lg:col-span-3 space-y-4">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <Input 
                    placeholder={selectedWarehouse === 'Todas' ? "Buscar en stock consolidado..." : `Buscar existencias en '${selectedWarehouse}'...`} 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-12 h-12 bg-background border-input border-none shadow-sm rounded-2xl text-xs md:text-sm"
                  />
                </div>
 
                <Card className="bg-card border-border shadow-sm rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-white/10 border-b border-white/10">
                        <TableRow>
                          <TableHead className="text-[10px] font-bold uppercase px-4 md:px-6">SKU</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase">Producto</TableHead>
                          <TableHead className="text-center text-[10px] font-bold uppercase">Stock en Bodega</TableHead>
                          <TableHead className="text-right text-[10px] font-bold uppercase px-4 md:px-6">Precio</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loadingInv ? (
                          <TableRow><TableCell colSpan={4} className="text-center py-12 text-xs">Cargando...</TableCell></TableRow>
                        ) : filteredItems.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-16 text-slate-400 italic text-xs">
                              {selectedWarehouse === 'Todas' 
                                ? 'No se encontraron productos en el inventario.' 
                                : `No hay productos asignados a la bodega '${selectedWarehouse}' todavía.`}
                            </TableCell>
                          </TableRow>
                        ) : filteredItems?.map((item) => {
                          const stockToShow = selectedWarehouse === 'Todas' 
                            ? item.quantity 
                            : (item.bodegas?.[selectedWarehouse] || 0);
                          return (
                            <TableRow key={item.id} className="hover:bg-white/10 border-b border-white/5 transition-colors">
                              <TableCell className="px-4 md:px-6 font-mono font-bold text-slate-600 dark:text-muted-foreground text-[10px] md:text-[11px] whitespace-nowrap">{item.sku}</TableCell>
                              <TableCell className="font-bold text-white text-xs min-w-[120px]">{item.name}</TableCell>
                              <TableCell className="text-center">
                                <Badge className={`font-black text-[9px] h-5 ${stockToShow <= 0 ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`} variant="outline">
                                  {stockToShow} un.
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right px-4 md:px-6 font-bold text-white text-xs whitespace-nowrap">
                                ${(item.price || 0).toFixed(2)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </div>
            </div>
          </TabsContent>
              <TabsContent value="kardex" className="space-y-6 outline-none animate-in fade-in duration-300">
              <Card className="bg-card border-border shadow-sm rounded-2xl">
                <CardHeader className="p-6 border-b">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <History className="text-blue-600" size={18} />
                    Kardex del Inventario (Historial de Movimientos)
                  </CardTitle>
                  <CardDescription className="text-xs">Consulte las transacciones de entrada, salida y ajustes de stock en tiempo real.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="p-6 flex gap-4 border-b">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <Input 
                        placeholder="Buscar por SKU o descripción..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 h-11 bg-slate-50 border-slate-100 rounded-xl"
                      />
                    </div>
                  </div>
                  <Table>
                    <TableHeader className="bg-white/10 border-b border-white/10">
                      <TableRow>
                        <TableHead className="text-[10px] font-black uppercase px-6">Fecha</TableHead>
                        <TableHead className="text-[10px] font-black uppercase">Código</TableHead>
                        <TableHead className="text-[10px] font-black uppercase">Movimiento</TableHead>
                        <TableHead className="text-[10px] font-black uppercase">Ubicación</TableHead>
                        <TableHead className="text-[10px] font-black uppercase">Documento</TableHead>
                        <TableHead className="text-center text-[10px] font-black uppercase text-emerald-600">Ingreso</TableHead>
                        <TableHead className="text-center text-[10px] font-black uppercase text-rose-600">Salida</TableHead>
                        <TableHead className="text-center text-[10px] font-black uppercase">Saldo</TableHead>
                        <TableHead className="text-right text-[10px] font-black uppercase px-6">Costo Unit.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {!searchTerm.trim() ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-16 text-slate-400 italic text-xs font-medium">
                            Digite un código de SKU en la barra de búsqueda para ver sus movimientos en el Kardex.
                          </TableCell>
                        </TableRow>
                      ) : loadingKardex ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-16 text-slate-400 italic text-xs">
                            Cargando kardex...
                          </TableCell>
                        </TableRow>
                      ) : kardexItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-16 text-slate-400 italic text-xs">
                            No se encontraron registros de inventario para este filtro.
                          </TableCell>
                        </TableRow>
                      ) : kardexItems.map((item: any) => (
                        <TableRow key={item.id} className="hover:bg-white/10 border-b border-white/5">
                          <TableCell className="px-6 text-[11px] font-mono text-slate-400 whitespace-nowrap">
                            {new Date(item.created_at).toLocaleString('es-SV', { dateStyle: 'short', timeStyle: 'short' })}
                          </TableCell>
                          <TableCell className="font-mono font-bold text-xs text-slate-700 dark:text-foreground">{item.sku}</TableCell>
                          <TableCell>
                            <Badge className={
                              item.movement_type === 'INGRESO RÁPIDO' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                              item.movement_type === 'TRASLADO' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                              item.movement_type === 'FACTURA' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                              'bg-amber-50 text-amber-700 border-amber-100'
                            } style={{ fontSize: '9px', fontWeight: 'bold' }}>
                              {item.movement_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-[11px] text-slate-500">{item.location}</TableCell>
                          <TableCell className="text-[11px] font-mono text-blue-600 underline cursor-pointer">{item.document_ref}</TableCell>
                          <TableCell className="text-center font-bold text-emerald-600 text-xs">
                            {Number(item.qty_in) > 0 ? `+${item.qty_in}` : '-'}
                          </TableCell>
                          <TableCell className="text-center font-bold text-rose-600 text-xs">
                            {Number(item.qty_out) > 0 ? `-${item.qty_out}` : '-'}
                          </TableCell>
                          <TableCell className="text-center font-black text-xs">{item.balance}</TableCell>
                          <TableCell className="text-right font-black text-xs px-6 text-slate-600">${Number(item.unit_cost).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="catalogo" className="space-y-4 outline-none">
            <Tabs defaultValue="maestro" className="w-full space-y-4">
              <TabsList className="bg-white/5 border border-white/10 rounded-xl p-1 mb-4 flex w-fit overflow-x-auto">
                <TabsTrigger value="maestro" className="rounded-lg text-xs font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white">Listado Maestro</TabsTrigger>
                <TabsTrigger value="precios" className="rounded-lg text-xs font-bold data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Precios y BMS</TabsTrigger>
                <TabsTrigger value="carga-masiva" className="rounded-lg text-xs font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white">Carga Masiva</TabsTrigger>
                <TabsTrigger value="vinculacion" className="rounded-lg text-xs font-bold data-[state=active]:bg-amber-600 data-[state=active]:text-white">Vincular Proveedores</TabsTrigger>
              </TabsList>
              <TabsContent value="maestro" className="space-y-4 outline-none">
            <div className="flex gap-2 bg-card border-border shadow-sm p-1 rounded-xl w-fit">
              <Button 
                variant={maestroSubTab === 'catalogo' ? 'default' : 'ghost'} 
                size="sm" 
                className="rounded-lg text-xs h-8 font-bold"
                onClick={() => setMaestroSubTab('catalogo')}
              >
                Catálogo Maestro de Productos
              </Button>
              <Button 
                variant={maestroSubTab === 'empresas' ? 'default' : 'ghost'} 
                size="sm" 
                className="rounded-lg text-xs h-8 font-bold"
                onClick={() => setMaestroSubTab('empresas')}
              >
                Códigos Internos de Empresas (Mapeo)
              </Button>
            </div>

            {maestroSubTab === 'catalogo' ? (
              // CATÁLOGO MAESTRO
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-4 space-y-6">
                  <Card className="bg-card border-border shadow-sm rounded-2xl overflow-hidden">
                    <CardHeader className="border-b border-white/10 text-white bg-white/5 p-5">
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Plus className="text-blue-400" size={18} /> Registro de Códigos Autorizados
                      </CardTitle>
                      <CardDescription className="text-slate-400 text-xs">Añada productos al catálogo maestro del sistema.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                      <form onSubmit={handleCreateProduct} className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Código Interno (SKU)</Label>
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                              <Input 
                                placeholder="EJ: ACC-001" 
                                value={productForm.sku}
                                onChange={e => setProductForm({...productForm, sku: e.target.value.toUpperCase()})}
                                className="pl-9 h-11 bg-background border-input rounded-xl font-bold text-xs"
                              />
                            </div>
                            <Button 
                              type="button"
                              onClick={generateAutoSku}
                              className="h-11 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold px-3 shrink-0 flex items-center gap-1.5"
                            >
                              <Zap size={13} className="text-amber-400 animate-pulse" />
                              Generar
                            </Button>
                          </div>
                          {productForm.sku && (
                            <BarcodePreview sku={productForm.sku} />
                          )}
                        </div>
 
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Nombre del Producto</Label>
                          <Input 
                            placeholder="Descripción completa..." 
                            value={productForm.name}
                            onChange={e => setProductForm({...productForm, name: e.target.value})}
                            className="h-11 bg-background border-input rounded-xl text-xs"
                          />
                        </div>
 
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Categoría</Label>
                          <Select 
                            value={productForm.category} 
                            onValueChange={(val) => setProductForm({...productForm, category: val})}
                          >
                            <SelectTrigger className="h-11 bg-background border-input rounded-xl text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="General" className="text-xs">General</SelectItem>
                              <SelectItem value="Ferretería" className="text-xs">Ferretería</SelectItem>
                              <SelectItem value="Fontanería" className="text-xs">Fontanería</SelectItem>
                              <SelectItem value="Electricidad" className="text-xs">Electricidad</SelectItem>
                              <SelectItem value="Herramientas" className="text-xs">Herramientas</SelectItem>
                              <SelectItem value="Mantenimiento" className="text-xs">Mantenimiento</SelectItem>
                              <SelectItem value="Automotriz" className="text-xs">Automotriz</SelectItem>
                              <SelectItem value="Repuestos de Vehículos" className="text-xs">Repuestos de Vehículos</SelectItem>
                              <SelectItem value="Accesorios" className="text-xs">Accesorios</SelectItem>
                              <SelectItem value="Lubricantes" className="text-xs">Lubricantes</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Costo Base</Label>
                            <Input 
                              type="number" step="0.01"
                              placeholder="0.00" 
                              value={(productForm as any).cost}
                              onChange={e => handleBmsChange('cost', e.target.value)}
                              className="h-11 bg-background border-input rounded-xl text-xs"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-amber-500 tracking-widest">% Ganancia</Label>
                            <Input 
                              type="number" step="0.01"
                              placeholder="0.00" 
                              value={(productForm as any).margin}
                              onChange={e => handleBmsChange('margin', e.target.value)}
                              className="h-11 bg-background border-input rounded-xl text-xs border-amber-500/30"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-emerald-400 tracking-widest">Precio Final</Label>
                            <Input 
                              type="number" step="0.01"
                              placeholder="0.00" 
                              value={(productForm as any).price}
                              onChange={e => handleBmsChange('price', e.target.value)}
                              className="h-11 bg-background border-input rounded-xl text-xs border-emerald-500/30 font-bold"
                            />
                          </div>
                        </div>
 
                        <Button 
                          type="submit" 
                          className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg text-xs"
                          disabled={loading}
                        >
                          {loading ? <Loader2 className="animate-spin mr-2" /> : <Tag className="mr-2" size={16} />}
                          AUTORIZAR CÓDIGO
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
 
                  <div className="bg-blue-500/15 border border-blue-500/20 text-blue-300 p-5 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300 font-bold">
                      <Info size={16} />
                      <span className="text-xs uppercase tracking-tight">Catálogo Único</span>
                    </div>
                    <p className="text-[10px] md:text-xs text-blue-700 dark:text-blue-400 leading-relaxed font-medium">
                      Todos los productos deben ser creados aquí primero. Los módulos de **Ventas**, **Compras** e **Institucional** solo reconocen códigos que ya existen en este Maestro.
                    </p>
                  </div>
                </div>
 
                <div className="lg:col-span-8 space-y-4">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <Input 
                      placeholder="Buscar en el catálogo maestro..." 
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="pl-12 h-12 bg-card border-border shadow-sm border-none shadow-sm rounded-2xl text-xs"
                    />
                  </div>
 
                  <Card className="bg-card border-border shadow-sm rounded-2xl overflow-hidden">
                    <ScrollArea className="h-[500px]">
                      <Table>
                        <TableHeader className="bg-white/10 border-b border-white/10 sticky top-0 z-10 shadow-sm">
                          <TableRow>
                            <TableHead className="px-6 text-[10px] font-black uppercase">SKU Autorizado</TableHead>
                            <TableHead className="text-[10px] font-black uppercase">Descripción</TableHead>
                            <TableHead className="text-[10px] font-black uppercase">Categoría</TableHead>
                            <TableHead className="w-10"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loadingInv ? (
                            <TableRow><TableCell colSpan={4} className="text-center py-20 text-slate-400"><Loader2 className="animate-spin mx-auto mb-2" /> Sincronizando catálogo...</TableCell></TableRow>
                          ) : filteredItems.length === 0 ? (
                            <TableRow><TableCell colSpan={4} className="text-center py-20 text-slate-400 italic text-xs">No hay productos en el maestro.</TableCell></TableRow>
                          ) : filteredItems.map((item) => (
                            <TableRow key={item.id} className="hover:bg-white/10 border-b border-white/5">
                              <TableCell className="px-6 py-4">
                                <Badge variant="outline" className="font-mono font-black text-[10px] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-muted-foreground">
                                  {item.sku}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-bold text-white text-xs">{item.name}</TableCell>
                              <TableCell><Badge variant="secondary" className="text-[8px] font-bold uppercase">{item.category}</Badge></TableCell>
                              <TableCell className="px-4">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-300 hover:text-rose-500" onClick={() => handleDeleteProduct(item.id)}>
                                  <Trash2 size={14} />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </Card>
                </div>
              </div>
            ) : (
              // CÓDIGOS INTERNOS DE EMPRESAS
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-4 space-y-6">
                  <Card className="bg-card border-border shadow-sm rounded-2xl overflow-hidden">
                    <CardHeader className="border-b border-white/10 text-white bg-white/5 p-5">
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Link2 className="text-blue-400" size={18} /> Mapeo de Código por Empresa
                      </CardTitle>
                      <CardDescription className="text-slate-400 text-xs">Asocie códigos internos específicos de tus clientes o proveedores a tu SKU maestro.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                      <form onSubmit={handleCreateCompanyMapping} className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Seleccionar Producto Maestro</Label>
                          <Select 
                            value={companyForm.masterSku} 
                            onValueChange={(val) => setCompanyForm({...companyForm, masterSku: val})}
                          >
                            <SelectTrigger className="h-11 bg-background border-input rounded-xl text-xs font-bold">
                              <SelectValue placeholder="Seleccione SKU..." />
                            </SelectTrigger>
                            <SelectContent>
                              {inventory?.map(p => (
                                <SelectItem key={p.id} value={p.sku} className="text-xs">
                                  {p.sku} - {p.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Nombre de la Empresa Externa</Label>
                          <Input 
                            placeholder="Ej. Cemento del Norte S.A..." 
                            value={companyForm.companyName}
                            onChange={e => setCompanyForm({...companyForm, companyName: e.target.value})}
                            className="h-11 bg-background border-input rounded-xl text-xs font-bold"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Código Interno de esa Empresa</Label>
                          <div className="relative">
                            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <Input 
                              placeholder="Ej: COD-CEM-409" 
                              value={companyForm.companySku}
                              onChange={e => setCompanyForm({...companyForm, companySku: e.target.value})}
                              className="pl-9 h-11 bg-background border-input rounded-xl text-xs font-mono font-bold"
                            />
                          </div>
                        </div>

                        <Button 
                          type="submit" 
                          className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg text-xs"
                          disabled={loading}
                        >
                          {loading ? <Loader2 className="animate-spin mr-2" /> : <Link2 className="mr-2" size={16} />}
                          VINCULAR CÓDIGO INTERNO
                        </Button>
                      </form>
                    </CardContent>
                  </Card>

                  <div className="bg-slate-900 text-white p-5 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2 text-blue-400 font-bold">
                      <Info size={16} />
                      <span className="text-xs uppercase tracking-tight">Utilidad Comercial</span>
                    </div>
                    <p className="text-[10px] md:text-xs text-slate-300 leading-relaxed font-medium">
                      Esta herramienta facilita que el ERP sea multi-cliente. Si un cliente corporativo maneja un código diferente para tu producto, puedes mapearlo aquí para automatizar cotizaciones y créditos fiscales.
                    </p>
                  </div>
                </div>

                <div className="lg:col-span-8 space-y-4">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <Input 
                      placeholder="Buscar por Empresa, SKU Maestro o Código Interno..." 
                      value={companySearchTerm}
                      onChange={e => setCompanySearchTerm(e.target.value)}
                      className="pl-12 h-12 bg-card border-border shadow-sm border-none shadow-sm rounded-2xl text-xs"
                    />
                  </div>

                  <Card className="bg-card border-border shadow-sm rounded-2xl overflow-hidden">
                    <ScrollArea className="h-[500px]">
                      <Table>
                        <TableHeader className="bg-white/10 border-b border-white/10 sticky top-0 z-10 shadow-sm">
                          <TableRow>
                            <TableHead className="px-6 text-[10px] font-black uppercase">SKU Maestro</TableHead>
                            <TableHead className="text-[10px] font-black uppercase">Descripción del Producto</TableHead>
                            <TableHead className="text-[10px] font-black uppercase">Empresa Externa</TableHead>
                            <TableHead className="text-[10px] font-black uppercase">Código Empresa</TableHead>
                            <TableHead className="w-10"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loadingCompMappings ? (
                            <TableRow><TableCell colSpan={5} className="text-center py-20 text-slate-400"><Loader2 className="animate-spin mx-auto mb-2" /> Leyendo vinculaciones...</TableCell></TableRow>
                          ) : filteredCompanyMappings.length === 0 ? (
                            <TableRow><TableCell colSpan={5} className="text-center py-20 text-slate-400 italic text-xs">No hay vinculaciones de empresas registradas.</TableCell></TableRow>
                          ) : filteredCompanyMappings.map((map) => (
                            <TableRow key={map.id} className="hover:bg-white/10 border-b border-white/5">
                              <TableCell className="px-6 py-4 font-mono font-bold text-xs text-slate-600 dark:text-muted-foreground">
                                {map.masterSku}
                              </TableCell>
                              <TableCell className="font-bold text-white text-xs">{map.productName}</TableCell>
                              <TableCell className="font-semibold text-xs text-slate-700 dark:text-foreground">{map.companyName}</TableCell>
                              <TableCell>
                                <Badge className="bg-blue-50 text-blue-700 border border-blue-150 font-mono font-black text-[10px]">
                                  {map.companySku}
                                </Badge>
                              </TableCell>
                              <TableCell className="px-4">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-300 hover:text-rose-500" onClick={() => handleDeleteCompanyMapping(map.id)}>
                                  <Trash2 size={14} />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}`
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </Card>
                </div>
              </div>
            )}
          </TabsContent>
              <TabsContent value="precios" className="space-y-4 outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Formulario Izquierdo: Editor de Producto */}
              <div className="lg:col-span-7 space-y-6">
                <Card className="bg-card border-border shadow-sm rounded-2xl overflow-hidden">
                  <CardHeader className="border-b border-white/10 text-white bg-white/5 p-5">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Tag className="text-emerald-400" size={18} /> Editor de Producto
                    </CardTitle>
                    <CardDescription className="text-slate-450 text-xs">
                      Selecciona un producto de la lista para modificar su nombre, precio, categoría y vinculación con el proveedor.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    {selectedPriceProduct ? (
                      <div className="space-y-6">
                        <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/20 text-emerald-300 space-y-2 flex justify-between items-center">
                          <div>
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Editando</span>
                            <p className="text-[10px] font-mono font-bold text-emerald-800 dark:text-emerald-200 mt-1">SKU Interno: {selectedPriceProduct.sku}</p>
                          </div>
                          <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800/60 font-bold uppercase text-[9px]">
                            {productType}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Nombre del Producto</Label>
                            <Input value={productNameValue} onChange={e => setProductNameValue(e.target.value)} className="h-11 bg-background border-input rounded-xl text-xs font-bold" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Marca</Label>
                            <Input value={productBrand} onChange={e => setProductBrand(e.target.value)} placeholder="Ej. Sony, Samsung..." className="h-11 bg-background border-input rounded-xl text-xs font-bold" />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Tipo</Label>
                            <Select value={productType} onValueChange={setProductType}>
                              <SelectTrigger className="h-11 bg-background border-input rounded-xl text-xs font-bold"><SelectValue /></SelectTrigger>
                              <SelectContent className="rounded-xl">
                                <SelectItem value="Terminado">Terminado</SelectItem>
                                <SelectItem value="Materia Prima">Materia Prima</SelectItem>
                                <SelectItem value="Servicio">Servicio</SelectItem>
                                <SelectItem value="Insumo">Insumo</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Categoría / Área Contable</Label>
                            <Select value={selectedPriceCategory} onValueChange={setSelectedPriceCategory}>
                              <SelectTrigger className="h-11 bg-background border-input rounded-xl text-xs font-bold"><SelectValue /></SelectTrigger>
                              <SelectContent className="rounded-xl">
                                <SelectItem value="Inventario de Mercadería">Inventario</SelectItem>
                                <SelectItem value="Gastos de Administración">Gtos. Admin</SelectItem>
                                <SelectItem value="Gastos de Venta">Gtos. Venta</SelectItem>
                                <SelectItem value="Propiedad, Planta y Equipo">Propiedad y Equipo</SelectItem>
                                <SelectItem value="General">General</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Unidad</Label>
                            <Select value={productUnit} onValueChange={setProductUnit}>
                              <SelectTrigger className="h-11 bg-background border-input rounded-xl text-xs font-bold"><SelectValue /></SelectTrigger>
                              <SelectContent className="rounded-xl">
                                <SelectItem value="Unidad">Unidad</SelectItem>
                                <SelectItem value="Kilogramo">Kilogramo</SelectItem>
                                <SelectItem value="Litro">Litro</SelectItem>
                                <SelectItem value="Caja">Caja</SelectItem>
                                <SelectItem value="Metro">Metro</SelectItem>
                                <SelectItem value="Galon">Galón</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Costo (Sin Impuesto)</Label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-xs text-muted-foreground">$</span>
                              <Input type="number" placeholder="0.00" value={productCost} onChange={e => setProductCost(e.target.value)} className="pl-7 h-11 bg-background border-input rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300" />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Precio Venta (PVP)</Label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-xs text-emerald-600 dark:text-emerald-400">$</span>
                              <Input type="number" placeholder="0.00" value={priceValue} onChange={e => setPriceValue(e.target.value)} className="pl-7 h-11 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-black text-emerald-700 dark:text-emerald-400" />
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-white/10 border-slate-100 dark:border-zinc-800 pt-4 mt-2">
                          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2"><Warehouse size={14}/> Control de Inventario</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label className="text-[10px] font-black uppercase text-slate-400">Min. Stock</Label>
                              <Input type="number" value={minStock} onChange={e => setMinStock(e.target.value)} className="h-10 bg-background border-input rounded-xl text-xs font-bold" />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[10px] font-black uppercase text-slate-400">Max. Stock</Label>
                              <Input type="number" value={maxStock} onChange={e => setMaxStock(e.target.value)} className="h-10 bg-background border-input rounded-xl text-xs font-bold" />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[10px] font-black uppercase text-slate-400">Punto Pedido</Label>
                              <Input type="number" value={reorderPoint} onChange={e => setReorderPoint(e.target.value)} className="h-10 bg-amber-500/15 border border-amber-500/20 text-amber-700 dark:text-amber-400 rounded-xl text-xs font-bold" />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <div className="space-y-2">
                              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Ubicación Física</Label>
                              <Input value={productLocation} onChange={e => setProductLocation(e.target.value)} placeholder="Ej. Estante A, Pasillo 3" className="h-10 bg-background border-input rounded-xl text-xs font-bold" />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Código del Proveedor</Label>
                              <Input value={selectedPriceSupplierSku} onChange={e => setSelectedPriceSupplierSku(e.target.value)} placeholder="Código externo..." className="h-10 bg-background border-input rounded-xl text-xs font-mono font-bold" />
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-white/10 border-slate-100 dark:border-zinc-800 pt-4 mt-2">
                          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2"><Tag size={14}/> Propiedades</h4>
                          <div className="flex flex-wrap gap-4">
                            <label className="flex items-center gap-2 cursor-pointer bg-background border-input px-3 py-2 rounded-xl">
                              <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="rounded text-emerald-500 focus:ring-emerald-500 bg-slate-200 dark:bg-zinc-800 border-none w-4 h-4" />
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Activo</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer bg-background border-input px-3 py-2 rounded-xl">
                              <input type="checkbox" checked={isService} onChange={e => setIsService(e.target.checked)} className="rounded text-emerald-500 focus:ring-emerald-500 bg-slate-200 dark:bg-zinc-800 border-none w-4 h-4" />
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Servicio</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer bg-background border-input px-3 py-2 rounded-xl">
                              <input type="checkbox" checked={isExempt} onChange={e => setIsExempt(e.target.checked)} className="rounded text-emerald-500 focus:ring-emerald-500 bg-slate-200 dark:bg-zinc-800 border-none w-4 h-4" />
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Exento (Sin IVA)</span>
                            </label>
                          </div>
                        </div>

                        <div className="flex gap-2 pt-4">
                          <Button variant="outline" onClick={() => setSelectedPriceProduct(null)} className="w-1/3 h-11 rounded-xl text-xs font-bold">Cancelar</Button>
                          <Button onClick={handleSavePrice} disabled={savingPrice} className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs">
                            {savingPrice ? <Loader2 className="animate-spin" size={16} /> : "Guardar Cambios"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12 text-slate-400 dark:text-muted-foreground italic text-xs">
                        Selecciona un producto del catálogo para gestionar su precio y vinculación.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Lado Derecho: Catálogo Maestro */}
              <div className="lg:col-span-5 space-y-6">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <Input 
                    placeholder="Buscar por SKU o descripción..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-12 h-12 bg-card border-border shadow-sm border-none shadow-sm rounded-2xl text-xs"
                  />
                </div>

                <Card className="bg-card border-border shadow-sm rounded-2xl overflow-hidden">
                  <ScrollArea className="h-[500px]">
                    <Table>
                      <TableHeader className="bg-white/10 border-b border-white/10 sticky top-0 z-10 shadow-sm">
                        <TableRow>
                          <TableHead className="px-6 text-[10px] font-black uppercase">SKU</TableHead>
                          <TableHead className="text-[10px] font-black uppercase">Descripción del Producto</TableHead>
                          <TableHead className="text-[10px] font-black uppercase">Área Contable</TableHead>
                          <TableHead className="text-right text-[10px] font-black uppercase pr-8">Precio Público</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredItems.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-20 text-slate-400 italic text-xs">
                              No se encontraron productos.
                            </TableCell>
                          </TableRow>
                        ) : filteredItems.map((item) => (
                          <TableRow 
                            key={item.id} 
                            onClick={() => handleSelectPriceProduct(item.sku)}
                            className="hover:bg-white/10 border-b border-white/5 cursor-pointer transition-colors"
                          >
                            <TableCell className="px-6 py-4 font-mono font-bold text-xs text-slate-600 dark:text-muted-foreground">
                              {item.sku}
                            </TableCell>
                            <TableCell className="font-bold text-white text-xs">
                              {item.name}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-[9px] font-bold">
                                {item.category || 'General'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right pr-8 font-black text-xs text-emerald-600 dark:text-emerald-400">
                              ${(item.price || 0).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </Card>
              </div>

            </div>
          </TabsContent>
              <TabsContent value="carga-masiva" className="space-y-6 outline-none animate-in fade-in duration-300">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Panel Izquierdo: Carga y Progreso */}
                <div className="lg:col-span-5 space-y-6">
                  <Card className="bg-card border-border shadow-sm rounded-2xl overflow-hidden">
                    <CardHeader className="border-b border-white/10 text-white bg-white/5 p-5">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                          <Upload className="text-blue-400" size={18} /> Carga Masiva (SKU + Desc)
                        </CardTitle>
                        <Button variant="ghost" size="sm" onClick={handleDownloadTemplate} className="h-7 text-xs bg-slate-800 hover:bg-slate-700 text-white border-0">
                          Descargar Plantilla
                        </Button>
                      </div>
                      <CardDescription className="text-slate-400 text-xs">
                        Sube hasta +3000 códigos rápidamente en formato Excel o CSV.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                      
                      {/* Zona de Drop / Selección de Archivo */}
                      <div 
                        className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center hover:bg-slate-50 dark:hover:bg-muted/10 transition-colors cursor-pointer"
                        onClick={() => bulkFileInputRef.current?.click()}
                      >
                        <input 
                          type="file" 
                          ref={bulkFileInputRef} 
                          className="hidden" 
                          accept=".xlsx,.xls,.csv" 
                          onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0) {
                              processBulkFile(e.target.files[0]);
                            }
                          }}
                        />
                        <FileSpreadsheet className="mx-auto text-blue-500 mb-2" size={32} />
                        <span className="text-xs font-bold text-slate-700 dark:text-foreground block">
                          {bulkFile ? bulkFile.name : "Seleccione su archivo Excel (.xlsx, .xls) o CSV"}
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-1">
                          {bulkFile ? `${(bulkFile.size / 1024).toFixed(1)} KB` : "Arrastre y suelte el archivo aquí"}
                        </span>
                      </div>

                      {bulkValidProducts.length > 0 && (
                        <div className="space-y-4 border-t border-white/10 pt-4 border-slate-100 dark:border-slate-800">
                          <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-950/20 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="text-emerald-500" size={18} />
                              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                                {bulkValidProducts.length} Códigos Listos
                              </span>
                            </div>
                          </div>

                          {bulkInvalidRows.length > 0 && (
                            <div className="p-3 bg-rose-50 dark:bg-rose-950/20 rounded-xl border border-rose-100 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-400">
                              <span className="font-bold block mb-1">Se omitieron {bulkInvalidRows.length} filas:</span>
                              <ul className="list-disc pl-4 opacity-80 text-[10px]">
                                {bulkInvalidRows.slice(0, 3).map((inv, idx) => (
                                  <li key={inv.row}>Fila {inv.row}: {inv.reason}</li>
                                ))}
                                {bulkInvalidRows.length > 3 && <li>...y {bulkInvalidRows.length - 3} más.</li>}
                              </ul>
                            </div>
                          )}

                          {isSendingBulk ? (
                            <div className="space-y-2 pt-2 animate-in fade-in">
                              <div className="flex justify-between items-center text-xs font-bold text-slate-700 dark:text-foreground">
                                <span>{bulkProgressText}</span>
                                <span>{bulkProgressPercent}%</span>
                              </div>
                              <div className="w-full bg-card border-border shadow-sm rounded-full h-2 overflow-hidden">
                                <div 
                                  className="bg-blue-600 h-full transition-all duration-150 rounded-full" 
                                  style={{ width: `${bulkProgressPercent}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <Button 
                              onClick={handleBulkUploadSubmit} 
                              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold mt-2"
                            >
                              <Upload size={16} className="mr-2" />
                              SUBIR {bulkValidProducts.length} PRODUCTOS
                            </Button>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* NUEVO CARD: LIMPIEZA DE CATÁLOGO EXISTENTE */}
                  <Card className="bg-card border-border shadow-sm rounded-2xl overflow-hidden">
                    <CardHeader className="border-b border-white/10 text-white bg-white/5 p-5">
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Trash2 size={18} className="text-rose-455 dark:text-rose-400" /> Limpieza de Catálogo
                      </CardTitle>
                      <CardDescription className="text-slate-350 text-xs">Administre la base de códigos existente en el sistema.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Si cometió un error en la carga de Excel o desea depurar todos los registros del inventario consolidado para iniciar una carga limpia, puede realizarlo desde aquí de manera directa.
                      </p>
                      <Button 
                        type="button" 
                        onClick={handleClearAllInventoryProducts} 
                        className="w-full h-12 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-lg text-xs flex items-center justify-center gap-2 shadow-rose-600/10 active:scale-95 transition-all"
                      >
                        <Trash2 size={16} />
                        LIMPIAR TODOS LOS CÓDIGOS DEL SISTEMA
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                {/* Panel Derecho: Previsualización / Catálogo en Sistema */}
                <div className="lg:col-span-7 space-y-4">
                  <Card className="bg-card border-border shadow-sm rounded-2xl overflow-hidden">
                    <Tabs defaultValue="excel" className="w-full">
                      
                      {/* Header Integrado de Sub-pestañas */}
                      <div className="p-4 bg-white/10 border-b border-white/10 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <TabsList className="bg-muted/80 p-0.5 rounded-xl border flex w-fit">
                          <TabsTrigger value="excel" className="rounded-lg text-[10px] font-bold px-3 py-1 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                            Por Importar ({bulkValidProducts.length})
                          </TabsTrigger>
                          <TabsTrigger value="sistema" className="rounded-lg text-[10px] font-bold px-3 py-1 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                            En Sistema ({inventory.length})
                          </TabsTrigger>
                        </TabsList>
                        
                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                          <TabsContent value="excel" className="m-0 outline-none">
                            {bulkValidProducts.length > 0 && (
                              <Button 
                                type="button" 
                                variant="ghost" 
                                size="sm" 
                                className="h-7 text-[10px] font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 px-2 rounded-lg"
                                onClick={() => {
                                  setBulkFile(null);
                                  setBulkValidProducts([]);
                                  setBulkInvalidRows([]);
                                  if (bulkFileInputRef.current) bulkFileInputRef.current.value = '';
                                }}
                              >
                                <Trash2 size={12} className="mr-1" /> Limpiar Todo
                              </Button>
                            )}
                          </TabsContent>
                          
                          <TabsContent value="sistema" className="m-0 outline-none">
                            <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-600 dark:text-emerald-400 border-emerald-100 font-bold">
                              Activos en base de datos
                            </Badge>
                          </TabsContent>
                        </div>
                      </div>

                      {/* Sub-tab 1: Vista Previa Excel */}
                      <TabsContent value="excel" className="outline-none m-0">
                        <ScrollArea className="h-[550px]">
                          <Table>
                            <TableHeader className="bg-white/10 border-b border-white/10 sticky top-0 z-10 shadow-sm">
                              <TableRow>
                                <TableHead className="text-[10px] font-black uppercase whitespace-nowrap px-4 py-3">CÓDIGO (SKU)</TableHead>
                                <TableHead className="text-[10px] font-black uppercase whitespace-nowrap px-4 py-3">DESCRIPCIÓN</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {bulkValidProducts.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={2} className="text-center py-32 text-slate-400 italic text-xs">
                                    Cargue un archivo CSV o Excel para ver la previsualización aquí.
                                  </TableCell>
                                </TableRow>
                              ) : bulkValidProducts.slice(0, 50).map((row, idx) => (
                                <TableRow key={row.sku} className="hover:bg-white/10 border-b border-white/5">
                                  <TableCell className="text-[11px] font-bold text-slate-700 dark:text-muted-foreground whitespace-nowrap px-4 py-2.5 font-mono">
                                    {row.sku}
                                  </TableCell>
                                  <TableCell className="text-[11px] font-medium text-slate-700 dark:text-muted-foreground px-4 py-2.5">
                                    {row.descripcion}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      </TabsContent>

                      {/* Sub-tab 2: Catálogo en Sistema (Con búsqueda e individual delete) */}
                      <TabsContent value="sistema" className="outline-none m-0">
                        <div className="p-3 border-b bg-slate-50/30 dark:bg-card/50 flex items-center">
                          <Input 
                            placeholder="Buscar código o descripción en el catálogo..."
                            value={catalogSearchTerm}
                            onChange={(e) => setCatalogSearchTerm(e.target.value)}
                            className="h-9 text-xs rounded-xl border bg-background"
                          />
                        </div>
                        <ScrollArea className="h-[500px]">
                          <Table>
                            <TableHeader className="bg-slate-50/50 dark:bg-muted/30">
                              <TableRow>
                                <TableHead className="w-1/3 px-4 md:px-6 text-[10px] font-bold uppercase">Código / SKU</TableHead>
                                <TableHead className="text-[10px] font-bold uppercase">Descripción / Nombre</TableHead>
                                <TableHead className="w-20 text-[10px] font-bold uppercase text-center">Acción</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredSystemInventory.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={3} className="text-center py-24 text-slate-400 italic text-xs">
                                    {catalogSearchTerm ? "No se encontraron coincidencias para la búsqueda." : "No hay códigos registrados en la base de datos."}
                                  </TableCell>
                                </TableRow>
                              ) : filteredSystemInventory.map((item) => (
                                <TableRow key={item.sku} className="hover:bg-white/10 border-b border-white/5">
                                  <TableCell className="px-4 md:px-6 py-3 font-mono font-black text-xs text-slate-700 dark:text-foreground">
                                    {item.sku}
                                  </TableCell>
                                  <TableCell className="text-xs font-bold text-slate-400">
                                    {item.name}
                                  </TableCell>
                                  <TableCell className="text-center py-1.5 px-2">
                                    <Button 
                                      type="button" 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-7 w-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                                      onClick={() => handleDeleteProduct(item.sku)}
                                      title="Eliminar producto permanentemente"
                                    >
                                      <Trash2 size={12} />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      </TabsContent>

                    </Tabs>
                  </Card>
                </div>
              </div>
            </TabsContent>
              <TabsContent value="vinculacion" className="space-y-6 outline-none animate-in fade-in duration-300">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Panel Izquierdo: Formulario de Vinculación */}
                <div className="lg:col-span-4 space-y-6">
                  <Card className="bg-card border-border shadow-sm rounded-2xl overflow-hidden">
                    <CardHeader className="border-b border-white/10 text-white bg-white/5 p-5">
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Link2 className="text-amber-400 drop-shadow-[0_0_4px_rgba(245,158,11,0.8)]" size={18} /> Vinculación de Catálogo
                      </CardTitle>
                      <CardDescription className="text-slate-400 text-xs">
                        Asocie códigos de proveedor a sus SKU maestros internos.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                      <form onSubmit={handleLinkSupplierSku} className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Seleccionar Producto Maestro</Label>
                          <Select 
                            value={mappingInternalSku} 
                            onValueChange={setMappingInternalSku}
                          >
                            <SelectTrigger className="h-11 bg-background border-input rounded-xl text-xs font-bold">
                              <SelectValue placeholder="Seleccione SKU..." />
                            </SelectTrigger>
                            <SelectContent>
                              {inventory?.map(p => (
                                <SelectItem key={p.id} value={p.sku} className="text-xs">
                                  {p.sku} - {p.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Código del Proveedor</Label>
                          <div className="relative">
                            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <Input 
                              placeholder="Ej: PRV-90812-A" 
                              value={mappingSupplierCode}
                              onChange={e => setMappingSupplierCode(e.target.value)}
                              className="pl-9 h-11 bg-background border-input rounded-xl text-xs font-mono font-bold"
                            />
                          </div>
                        </div>

                        <Button 
                          type="submit" 
                          className="w-full h-12 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-lg text-xs"
                          disabled={isSavingMapping}
                        >
                          {isSavingMapping ? <Loader2 className="animate-spin mr-2" /> : <Link2 className="mr-2" size={16} />}
                          VINCULAR CÓDIGO
                        </Button>
                      </form>
                    </CardContent>
                  </Card>

                  <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 p-5 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2 text-amber-500 font-bold">
                      <Info size={16} />
                      <span className="text-xs uppercase tracking-tight">Utilidad del Mapeo</span>
                    </div>
                    <p className="text-[10px] md:text-xs text-slate-300 leading-relaxed font-medium">
                      Mapear códigos de proveedores le permite importar DTEs o XMLs de compras y convertirlos instantáneamente a sus SKUs internos, automatizando el ingreso a bodega.
                    </p>
                  </div>
                </div>

                {/* Panel Derecho: Tabla de Códigos Mapeados */}
                <div className="lg:col-span-8 space-y-4">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <Input 
                      placeholder="Buscar por SKU Interno, Código Proveedor o Producto..." 
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="pl-12 h-12 bg-card border-border shadow-sm border-none shadow-sm rounded-2xl text-xs"
                    />
                  </div>

                  <Card className="bg-card border-border shadow-sm rounded-2xl overflow-hidden">
                    <ScrollArea className="h-[500px]">
                      <Table>
                        <TableHeader className="bg-white/10 border-b border-white/10 sticky top-0 z-10 shadow-sm">
                          <TableRow>
                            <TableHead className="px-6 text-[10px] font-black uppercase">Código Interno</TableHead>
                            <TableHead className="text-[10px] font-black uppercase">Nombre Producto</TableHead>
                            <TableHead className="text-[10px] font-black uppercase">Código Proveedor</TableHead>
                            <TableHead className="w-10 text-center"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loadingInv ? (
                            <TableRow><TableCell colSpan={4} className="text-center py-20 text-slate-400"><Loader2 className="animate-spin mx-auto mb-2" /> Leyendo vinculaciones...</TableCell></TableRow>
                          ) : savedMappings.length === 0 ? (
                            <TableRow><TableCell colSpan={4} className="text-center py-20 text-slate-400 italic text-xs">No hay vinculaciones de proveedores registradas.</TableCell></TableRow>
                          ) : savedMappings
                              .filter(m => {
                                const query = searchTerm.toLowerCase().trim();
                                if (!query) return true;
                                const productName = inventory.find(p => p.sku === m.internalSku)?.name || '';
                                return (
                                  m.internalSku.toLowerCase().includes(query) ||
                                  m.supplierCode.toLowerCase().includes(query) ||
                                  productName.toLowerCase().includes(query)
                                );
                              })
                              .map((map) => {
                                const productName = inventory.find(p => p.sku === map.internalSku)?.name || 'Desconocido';
                                return (
                                  <TableRow key={map.id} className="hover:bg-white/10 border-b border-white/5">
                                    <TableCell className="px-6 py-4 font-mono font-bold text-xs text-slate-400">
                                      {map.internalSku}
                                    </TableCell>
                                    <TableCell className="font-bold text-white text-xs">{productName}</TableCell>
                                    <TableCell>
                                      <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono font-black text-[10px]">
                                        {map.supplierCode}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="px-4 text-center">
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-300 hover:text-rose-500" onClick={() => handleDeleteSupplierMapping(map.supplierCode)}>
                                        <Trash2 size={14} />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </Card>
                </div>
              </div>
            </TabsContent>
            </Tabs>
          </TabsContent>



          <TabsContent value="auditoria" className="space-y-4 outline-none">
            <Tabs defaultValue="toma-fisica" className="w-full space-y-4">
              <TabsList className="bg-white/5 border border-white/10 rounded-xl p-1 mb-4 flex w-fit overflow-x-auto">
                <TabsTrigger value="toma-fisica" className="rounded-lg text-xs font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white">Toma Física</TabsTrigger>
                <TabsTrigger value="config" className="rounded-lg text-xs font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white">Mapeo de Bodegas</TabsTrigger>
              </TabsList>
              <TabsContent value="toma-fisica" className="space-y-0 outline-none animate-in fade-in duration-300">
              {/* Container estilo hoja de cálculo neón oscuro */}
              <div
                style={{ background: 'linear-gradient(135deg, #0b0d19 0%, #0f1128 60%, #0b0f24 100%)' }}
                className="rounded-2xl border border-slate-800/60 overflow-hidden shadow-2xl shadow-black/60"
              >
                {/* ── Barra de herramientas superior ── */}
                <div
                  style={{ background: 'rgba(15,17,40,0.95)', borderBottom: '1px solid rgba(99,102,241,0.20)' }}
                  className="px-5 py-4 flex flex-wrap items-center gap-3"
                >
                  {/* Título */}
                  <div className="flex items-center gap-2 mr-2">
                    <div style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow: '0 0 12px rgba(99,102,241,0.5)' }}
                      className="p-1.5 rounded-lg">
                      <ClipboardList size={15} className="text-white" />
                    </div>
                    <div>
                      <p className="text-[11px] font-black text-white tracking-wide leading-none">TOMA FÍSICA</p>
                      <p className="text-[9px] text-indigo-400/70 font-medium mt-0.5">Hoja de Conteo de Inventario</p>
                    </div>
                  </div>

                  {/* Fecha de corte */}
                  <div className="flex items-center gap-2 border border-slate-700/60 rounded-xl px-3 py-1.5 bg-slate-900/60">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Fecha Corte</span>
                    <input
                      type="date"
                      value={tomaFisicaFechaCorte}
                      onChange={e => setTomaFisicaFechaCorte(e.target.value)}
                      className="bg-transparent text-[11px] font-bold text-cyan-400 border-none outline-none cursor-pointer"
                    />
                  </div>

                  {/* Buscador */}
                  <div className="flex-1 min-w-[180px] max-w-xs flex items-center gap-2 border border-slate-700/60 rounded-xl px-3 py-1.5 bg-slate-900/60">
                    <Search size={12} className="text-slate-500 shrink-0" />
                    <input
                      type="text"
                      placeholder="Buscar SKU o producto..."
                      value={tomaFisicaSearch}
                      onChange={e => setTomaFisicaSearch(e.target.value)}
                      className="bg-transparent text-[11px] text-white placeholder:text-slate-600 border-none outline-none w-full"
                    />
                  </div>

                  {/* Botón recargar */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={fetchTomaFisicaItems}
                    disabled={loadingTomaFisica}
                    className="h-8 px-3 text-slate-400 hover:text-cyan-400 hover:bg-cyan-400/10 rounded-xl border border-slate-700/50 text-[10px] font-bold gap-1.5 transition-all"
                  >
                    {loadingTomaFisica
                      ? <Loader2 size={12} className="animate-spin" />
                      : <ArrowRight size={12} className="rotate-[-90deg]" />}
                    Recargar
                  </Button>

                  {/* Spacer */}
                  <div className="flex-1" />

                  {/* Contador de ítems */}
                  <div className="text-[10px] font-bold text-slate-500">
                    {tomaFisicaFiltered.length} de {tomaFisicaGrid.length} ítems
                  </div>

                  {/* Botón Finalizar Conteo */}
                  <Button
                    onClick={handleFinalizarConteo}
                    disabled={tomaFisicaSaving || loadingTomaFisica}
                    className="h-9 px-5 font-black text-[11px] rounded-xl gap-2 transition-all active:scale-95"
                    style={{
                      background: tomaFisicaSaving
                        ? 'rgba(99,102,241,0.3)'
                        : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                      boxShadow: '0 0 20px rgba(99,102,241,0.45)',
                      color: 'white'
                    }}
                  >
                    {tomaFisicaSaving
                      ? <><Loader2 size={13} className="animate-spin" /> Guardando...</>
                      : <><Save size={13} /> FINALIZAR CONTEO</>
                    }
                  </Button>
                </div>

                {/* ── Banda de estadísticas en tiempo real ── */}
                <div
                  style={{ background: 'rgba(11,13,25,0.8)', borderBottom: '1px solid rgba(30,41,59,0.8)' }}
                  className="px-5 py-2 flex items-center gap-6 overflow-x-auto"
                >
                  {[
                    {
                      label: 'Contados',
                      value: tomaFisicaStats.contados,
                      color: '#6366f1',
                      bg: 'rgba(99,102,241,0.12)',
                      glow: 'rgba(99,102,241,0.35)'
                    },
                    {
                      label: 'Sobrantes ▲',
                      value: tomaFisicaStats.sobrantes,
                      color: '#10b981',
                      bg: 'rgba(16,185,129,0.10)',
                      glow: 'rgba(16,185,129,0.30)'
                    },
                    {
                      label: 'Faltantes ▼',
                      value: tomaFisicaStats.faltantes,
                      color: '#f43f5e',
                      bg: 'rgba(244,63,94,0.10)',
                      glow: 'rgba(244,63,94,0.30)'
                    },
                    {
                      label: 'Sin Diferencia ●',
                      value: tomaFisicaStats.exactos,
                      color: '#94a3b8',
                      bg: 'rgba(148,163,184,0.08)',
                      glow: 'transparent'
                    },
                    {
                      label: 'Total Catálogo',
                      value: tomaFisicaGrid.length,
                      color: '#38bdf8',
                      bg: 'rgba(56,189,248,0.08)',
                      glow: 'transparent'
                    }
                  ].map(stat => (
                    <div key={stat.label} className="flex items-center gap-2 shrink-0">
                      <div
                        style={{ background: stat.bg, border: `1px solid ${stat.color}30`, boxShadow: `0 0 8px ${stat.glow}` }}
                        className="px-2.5 py-0.5 rounded-lg"
                      >
                        <span style={{ color: stat.color }} className="text-base font-black tabular-nums">
                          {stat.value}
                        </span>
                      </div>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-slate-600">{stat.label}</span>
                    </div>
                  ))}
                </div>

                {/* ── Cabecera de columnas tipo Excel ── */}
                <div
                  style={{
                    gridTemplateColumns: '48px 120px 1fr 110px 150px 110px',
                    background: 'rgba(15,17,40,0.98)',
                    borderBottom: '1px solid rgba(30,41,59,1)',
                    display: 'grid',
                    gap: 0,
                  }}
                  className="sticky top-0 z-10"
                >
                  {/* Número de fila */}
                  <div className="px-3 py-2.5 text-center border-r border-slate-800/80">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">#</span>
                  </div>
                  {/* SKU */}
                  <div className="px-3 py-2.5 border-r border-slate-800/80">
                    <span
                      style={{ color: '#38bdf8', textShadow: '0 0 10px rgba(56,189,248,0.6)' }}
                      className="text-[9px] font-black uppercase tracking-widest"
                    >
                      SKU
                    </span>
                  </div>
                  {/* Descripción */}
                  <div className="px-4 py-2.5 border-r border-slate-800/80">
                    <span
                      style={{ color: '#38bdf8', textShadow: '0 0 10px rgba(56,189,248,0.6)' }}
                      className="text-[9px] font-black uppercase tracking-widest"
                    >
                      Descripción del Producto
                    </span>
                  </div>
                  {/* Sistema */}
                  <div className="px-3 py-2.5 text-right border-r border-slate-800/80">
                    <span
                      style={{ color: '#818cf8', textShadow: '0 0 8px rgba(129,140,248,0.5)' }}
                      className="text-[9px] font-black uppercase tracking-widest"
                    >
                      Sistema
                    </span>
                  </div>
                  {/* Conteo Real */}
                  <div className="px-3 py-2.5 text-center border-r border-slate-800/80">
                    <span
                      style={{ color: '#34d399', textShadow: '0 0 10px rgba(52,211,153,0.6)' }}
                      className="text-[9px] font-black uppercase tracking-widest"
                    >
                      ✏ Conteo Real
                    </span>
                  </div>
                  {/* Diferencia */}
                  <div className="px-3 py-2.5 text-right">
                    <span
                      style={{ color: '#f59e0b', textShadow: '0 0 8px rgba(245,158,11,0.5)' }}
                      className="text-[9px] font-black uppercase tracking-widest"
                    >
                      Δ Diferencia
                    </span>
                  </div>
                </div>

                {/* ── Cuerpo de la hoja de cálculo ── */}
                <div className="overflow-y-auto" style={{ maxHeight: '58vh' }}>
                  {loadingTomaFisica ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-4">
                      <Loader2 size={36} className="animate-spin text-indigo-500" style={{ filter: 'drop-shadow(0 0 12px rgba(99,102,241,0.7))' }} />
                      <p className="text-[11px] text-slate-500 font-bold tracking-wider">Cargando catálogo desde Supabase...</p>
                    </div>
                  ) : tomaFisicaFiltered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-3">
                      <Package size={40} className="text-slate-700" />
                      <p className="text-[12px] text-slate-600 font-bold">
                        {tomaFisicaSearch ? 'Sin resultados para tu búsqueda.' : 'No hay productos en el catálogo.'}
                      </p>
                    </div>
                  ) : (
                    tomaFisicaFiltered.map((row, idx) => {
                      const tieneConteo = row.conteoReal !== '';
                      const difNumerica = tieneConteo ? row.diferencia : null;
                      const esSobrante = difNumerica !== null && difNumerica > 0;
                      const esFaltante = difNumerica !== null && difNumerica < 0;
                      const esExacto   = difNumerica !== null && difNumerica === 0;

                      const colorDif = esSobrante ? '#10b981' : esFaltante ? '#f43f5e' : esExacto ? '#94a3b8' : '#334155';
                      const glowDif  = esSobrante ? 'rgba(16,185,129,0.5)' : esFaltante ? 'rgba(244,63,94,0.5)' : 'transparent';

                      return (
                        <div
                          key={row.sku}
                          className="grid gap-0 border-b transition-colors duration-100 group"
                          style={{
                            gridTemplateColumns: '48px 120px 1fr 110px 150px 110px',
                            borderColor: 'rgba(30,41,59,0.6)',
                            background: tieneConteo
                              ? `rgba(15,17,40,0.9)`
                              : idx % 2 === 0 ? 'rgba(11,13,25,0.6)' : 'rgba(15,17,40,0.4)'
                          }}
                          onMouseEnter={e => {
                            (e.currentTarget as HTMLDivElement).style.background = 'rgba(99,102,241,0.06)';
                          }}
                          onMouseLeave={e => {
                            (e.currentTarget as HTMLDivElement).style.background = tieneConteo
                              ? 'rgba(15,17,40,0.9)'
                              : idx % 2 === 0 ? 'rgba(11,13,25,0.6)' : 'rgba(15,17,40,0.4)';
                          }}
                        >
                          {/* Número de fila */}
                          <div className="flex items-center justify-center px-2 py-2.5 border-r border-slate-800/40">
                            <span className="text-[9px] font-mono text-slate-700 tabular-nums">
                              {(idx + 1).toString().padStart(3, '0')}
                            </span>
                          </div>

                          {/* SKU */}
                          <div className="flex items-center px-3 py-2.5 border-r border-slate-800/40">
                            <span
                              className="text-[10px] font-mono font-black truncate"
                              style={{ color: '#38bdf8', textShadow: tieneConteo ? '0 0 8px rgba(56,189,248,0.4)' : 'none' }}
                            >
                              {row.sku}
                            </span>
                          </div>

                          {/* Descripción */}
                          <div className="flex items-center px-4 py-2.5 border-r border-slate-800/40">
                            <span className="text-[11px] text-slate-300 font-medium truncate group-hover:text-white transition-colors">
                              {row.name}
                            </span>
                          </div>

                          {/* Sistema (Stock Teórico) */}
                          <div className="flex items-center justify-end px-3 py-2.5 border-r border-slate-800/40">
                            <span className="text-[11px] font-bold tabular-nums text-slate-400">
                              {row.sistemaStock}
                            </span>
                          </div>

                          {/* Conteo Real (Editable) */}
                          <div className="flex items-center justify-center px-2 py-1.5 border-r border-slate-800/40">
                            <input
                              id={`conteo-${row.sku}`}
                              type="number"
                              min="0"
                              step="1"
                              placeholder="—"
                              value={row.conteoReal}
                              onChange={e => handleConteoRealChange(row.sku, e.target.value)}
                              className="w-full h-7 text-center text-[12px] font-black rounded-lg border outline-none tabular-nums transition-all"
                              style={{
                                background: tieneConteo
                                  ? 'rgba(52,211,153,0.08)'
                                  : 'rgba(30,41,59,0.5)',
                                border: tieneConteo
                                  ? '1px solid rgba(52,211,153,0.35)'
                                  : '1px solid rgba(30,41,59,0.8)',
                                color: tieneConteo ? '#34d399' : '#64748b',
                                boxShadow: tieneConteo ? '0 0 8px rgba(52,211,153,0.2)' : 'none',
                              }}
                              onFocus={e => {
                                (e.target as HTMLInputElement).style.border = '1px solid rgba(52,211,153,0.7)';
                                (e.target as HTMLInputElement).style.boxShadow = '0 0 12px rgba(52,211,153,0.35)';
                              }}
                              onBlur={e => {
                                const hasVal = (e.target as HTMLInputElement).value !== '';
                                (e.target as HTMLInputElement).style.border = hasVal
                                  ? '1px solid rgba(52,211,153,0.35)'
                                  : '1px solid rgba(30,41,59,0.8)';
                                (e.target as HTMLInputElement).style.boxShadow = hasVal ? '0 0 8px rgba(52,211,153,0.2)' : 'none';
                              }}
                            />
                          </div>

                          {/* Diferencia (Calculada) */}
                          <div className="flex items-center justify-end px-3 py-2.5">
                            {tieneConteo ? (
                              <span
                                className="text-[12px] font-black tabular-nums"
                                style={{
                                  color: colorDif,
                                  textShadow: `0 0 10px ${glowDif}`,
                                }}
                              >
                                {esSobrante ? '+' : ''}{row.diferencia}
                              </span>
                            ) : (
                              <span className="text-[11px] font-bold text-slate-800">—</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* ── Barra de pie / resumen ── */}
                <div
                  style={{ background: 'rgba(10,12,22,0.95)', borderTop: '1px solid rgba(30,41,59,0.8)' }}
                  className="px-5 py-3 flex flex-wrap items-center gap-4"
                >
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">Leyenda:</span>
                  {[
                    { color: '#34d399', glow: 'rgba(52,211,153,0.5)', label: 'Conteo ingresado' },
                    { color: '#10b981', glow: 'rgba(16,185,129,0.4)', label: 'Sobrante (+)' },
                    { color: '#f43f5e', glow: 'rgba(244,63,94,0.4)',  label: 'Faltante (−)' },
                    { color: '#94a3b8', glow: 'transparent',           label: 'Sin diferencia' },
                  ].map(l => (
                    <div key={l.label} className="flex items-center gap-1.5">
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: l.color, boxShadow: `0 0 6px ${l.glow}` }}
                      />
                      <span className="text-[9px] text-slate-600 font-medium">{l.label}</span>
                    </div>
                  ))}
                  <div className="flex-1" />
                  <span className="text-[9px] text-slate-700 font-mono">
                    Fórmula: <span className="text-indigo-500">Δ = Conteo Real − Sistema</span>
                  </span>
                </div>
              </div>
            </TabsContent>
              <TabsContent value="config" className="space-y-6 outline-none">
             <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
               
               {/* Columna Izquierda: Crear Bodega y Vincular Producto */}
               <div className="lg:col-span-4 space-y-6">
                 {/* Tarjeta 1: Crear Bodega */}
                 <Card className="bg-card border-border shadow-sm rounded-2xl h-fit">
                   <CardHeader className="p-5">
                     <CardTitle className="text-sm font-bold flex items-center gap-2">
                       <Warehouse size={16} className="text-blue-600" /> Crear Almacén / Bodega
                     </CardTitle>
                     <CardDescription className="text-xs">Configure puntos de almacenamiento físico.</CardDescription>
                   </CardHeader>
                   <CardContent className="p-5 pt-0 space-y-4">
                     <div className="space-y-2">
                       <Label className="text-[10px] font-bold uppercase text-slate-400">Nombre de la Bodega</Label>
                       <Input 
                         placeholder="Ej. Sucursal Santa Tecla..." 
                         value={warehouseName}
                         onChange={e => setWarehouseName(e.target.value)}
                         className="bg-background border-input h-10 text-xs font-bold"
                       />
                     </div>
                     
                     <div className="space-y-2">
                       <Label className="text-[10px] font-bold uppercase text-slate-400">Sucursal Asociada</Label>
                       <Select 
                         value={warehouseBranchId}
                         onValueChange={setWarehouseBranchId}
                       >
                         <SelectTrigger className="h-10 bg-background border-input rounded-xl text-xs font-bold">
                           <SelectValue placeholder="Seleccione sucursal..." />
                         </SelectTrigger>
                         <SelectContent>
                           {branches?.map((b: any) => (
                             <SelectItem key={b.id} value={b.id} className="text-xs">{b.name}</SelectItem>
                           ))}
                         </SelectContent>
                       </Select>
                     </div>

                     <Button onClick={handleCreateWarehouse} className="w-full bg-blue-600 font-bold rounded-xl text-xs text-white h-10">
                       CREAR BODEGA
                     </Button>

                     <div className="pt-2">
                       <Label className="text-[9px] font-black uppercase text-slate-400 block mb-2">Bodegas Activas</Label>
                       <div className="space-y-1">
                         {warehouses?.length === 0 ? (
                           <p className="text-[9px] text-slate-400 italic">No hay bodegas configuradas.</p>
                         ) : warehouses?.map((wh: any) => (
                           <div key={wh.id} className="flex justify-between items-center bg-white/5 border-b border-white/10 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                             <div className="flex flex-col">
                               <span className="text-[11px] font-bold text-slate-700 dark:text-foreground">{wh.name}</span>
                               <span className="text-[9px] text-slate-400">
                                 {branches.find((b: any) => b.id === wh.branch_id)?.name || 'Sin Sucursal'}
                               </span>
                             </div>
                             <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-300 hover:text-rose-500 rounded-md" onClick={() => handleDeleteWarehouse(wh.id)}>
                               <Trash2 size={12} />
                             </Button>
                           </div>
                         ))}
                       </div>
                     </div>
                   </CardContent>
                 </Card>

                 {/* Tarjeta 2: Vincular Producto a Bodega */}
                 <Card className="bg-card border-border shadow-sm rounded-2xl h-fit">
                   <CardHeader className="p-5">
                     <CardTitle className="text-sm font-bold flex items-center gap-2">
                       <Link2 size={16} className="text-blue-600" /> Vincular Producto a Bodega
                     </CardTitle>
                     <CardDescription className="text-xs">Establezca que un producto de tu catálogo pertenece a una bodega.</CardDescription>
                   </CardHeader>
                   <CardContent className="p-5 pt-0">
                     <form onSubmit={handleLinkProductToWarehouse} className="space-y-4">
                       <div className="space-y-1.5">
                         <Label className="text-[9px] font-bold uppercase text-slate-400">Seleccionar Bodega</Label>
                         <Select 
                           value={linkForm.warehouseName}
                           onValueChange={(val) => setLinkForm({ ...linkForm, warehouseName: val })}
                         >
                           <SelectTrigger className="h-10 bg-background border-input rounded-xl text-xs font-bold">
                             <SelectValue placeholder="Seleccione..." />
                           </SelectTrigger>
                           <SelectContent>
                             {warehouses?.map(w => (
                               <SelectItem key={w.id} value={w.name} className="text-xs">{w.name}</SelectItem>
                             ))}
                           </SelectContent>
                         </Select>
                       </div>

                       <div className="space-y-1.5">
                         <Label className="text-[9px] font-bold uppercase text-slate-400">Seleccionar Producto</Label>
                         <Select 
                           value={linkForm.productSku}
                           onValueChange={(val) => setLinkForm({ ...linkForm, productSku: val })}
                         >
                           <SelectTrigger className="h-10 bg-background border-input rounded-xl text-xs font-bold">
                             <SelectValue placeholder="Seleccione SKU..." />
                           </SelectTrigger>
                           <SelectContent>
                             {inventory?.map(p => (
                               <SelectItem key={p.id} value={p.sku} className="text-xs">{p.sku} - {p.name}</SelectItem>
                             ))}
                           </SelectContent>
                         </Select>
                       </div>

                       <div className="space-y-1.5">
                         <Label className="text-[9px] font-bold uppercase text-slate-400">Stock Inicial en esta Bodega</Label>
                         <Input 
                           type="number"
                           value={linkForm.initialStock}
                           onChange={e => setLinkForm({ ...linkForm, initialStock: e.target.value })}
                           className="bg-background border-input h-10 text-xs font-black text-blue-600 dark:text-blue-400"
                         />
                       </div>

                       <Button 
                         type="submit" 
                         className="w-full h-10 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs"
                         disabled={loading}
                       >
                         {loading ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2" size={14} />}
                         ASIGNAR A BODEGA
                       </Button>
                     </form>
                   </CardContent>
                 </Card>
               </div>

               {/* Columna Derecha: Vista de Productos por Bodega */}
               <div className="lg:col-span-8 space-y-4">
                 <Card className="p-4 bg-card border-border shadow-sm border shadow-sm rounded-2xl flex justify-between items-center">
                   <div className="space-y-1">
                     <Label className="text-[9px] font-black uppercase text-slate-400">Ver Productos en Bodega</Label>
                     <Select value={selectedWhView} onValueChange={setSelectedWhView}>
                       <SelectTrigger className="w-52 h-9 text-xs rounded-xl bg-background border-input font-bold">
                         <SelectValue />
                       </SelectTrigger>
                       <SelectContent>
                         <SelectItem value="Todas" className="text-xs">Consolidado (Todas)</SelectItem>
                         {warehouses?.map(w => (
                           <SelectItem key={w.id} value={w.name} className="text-xs">{w.name}</SelectItem>
                         ))}
                       </SelectContent>
                     </Select>
                   </div>
                   <div className="text-right">
                     <span className="text-[10px] font-black uppercase text-slate-400 block">Total Ítems en esta Vista</span>
                     <Badge className="bg-blue-600 text-white font-bold h-6 text-xs">{productsInSelectedWarehouse.length} productos</Badge>
                   </div>
                 </Card>

                 <Card className="bg-card border-border shadow-sm rounded-2xl overflow-hidden">
                   <ScrollArea className="h-[480px]">
                     <Table>
                       <TableHeader className="bg-white/10 border-b border-white/10 sticky top-0 z-10 shadow-sm">
                         <TableRow>
                           <TableHead className="px-6 text-[10px] font-black uppercase">SKU</TableHead>
                           <TableHead className="text-[10px] font-black uppercase">Descripción del Producto</TableHead>
                           <TableHead className="text-center text-[10px] font-black uppercase">Stock Bodega</TableHead>
                           <TableHead className="w-10"></TableHead>
                         </TableRow>
                       </TableHeader>
                       <TableBody>
                         {productsInSelectedWarehouse.length === 0 ? (
                           <TableRow>
                             <TableCell colSpan={4} className="text-center py-24 text-slate-400 italic text-xs">
                               No hay productos asignados a la bodega '{selectedWhView}'.
                             </TableCell>
                           </TableRow>
                         ) : productsInSelectedWarehouse.map((item) => {
                           const qtyInWh = selectedWhView === 'Todas' ? item.quantity : (item.bodegas?.[selectedWhView] || 0);
                           return (
                             <TableRow key={item.id} className="hover:bg-white/10 border-b border-white/5">
                               <TableCell className="px-6 py-4 font-mono font-bold text-xs text-slate-600 dark:text-muted-foreground">
                                 {item.sku}
                               </TableCell>
                               <TableCell className="font-bold text-white text-xs">{item.name}</TableCell>
                               <TableCell className="text-center">
                                 <Badge className={`font-black text-[10px] h-6 ${qtyInWh <= 0 ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`} variant="outline">
                                   {qtyInWh} un.
                                 </Badge>
                               </TableCell>
                               <TableCell className="px-4">
                                 {selectedWhView !== 'Todas' && (
                                   <Button 
                                     variant="ghost" 
                                     size="icon" 
                                     className="h-8 w-8 text-slate-300 hover:text-rose-500 rounded-md" 
                                     onClick={() => handleUnlinkProductFromWarehouse(item.id, selectedWhView)}
                                   >
                                     <Trash2 size={13} />
                                   </Button>
                                 )}
                               </TableCell>
                             </TableRow>
                           );
                         })}
                       </TableBody>
                     </Table>
               </ScrollArea>
                 </Card>
               </div>

             </div>
            </TabsContent>
            </Tabs>
          </TabsContent>
         {/* TAB MAESTRO CON INTEGRACIÓN DE CÓDIGOS DE EMPRESAS */}
          

          {/* TAB PRECIOS / PRODUCTO */}
          
 
           {/* TAB ENTRADAS */}
           
 
           {/* TAB BODEGAS CON GESTIÓN, ASOCIACIÓN Y VISTA DE STOCK */}
           

            {/* TAB CARGA MASIVA DE EXCEL/CSV */}
            

            {/* TAB KARDEX DE ALMACEN */}
            

            {/* TAB VINCULAR PROVEEDOR */}
            

            {/* TAB TOMA FISICA - HOJA DE CÁLCULO REACTIVA */}
            
          </Tabs>
        </div>
      </div>
    );
}

