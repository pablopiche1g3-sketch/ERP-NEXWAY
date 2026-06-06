'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
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
import * as XLSX from 'xlsx';

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
    <div className="bg-slate-50 dark:bg-muted/30 p-4 rounded-2xl border shadow-inner flex flex-col items-center gap-2 mt-4 animate-in fade-in slide-in-from-top-2 border-slate-200 dark:border-slate-800">
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
import {  useFirestore, useCollection, useDoc, doc, collection, writeBatch  } from '@/supabase/compat';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useRouter } from 'next/navigation';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/supabase/client';

interface SupplierItem {
  code: string;
  name: string;
  mappedInternalSku?: string;
}

export default function InventoryMasterPage() {
  const db = useFirestore();
  const configRef = useMemo(() => doc(db, 'system', 'module_config'), [db]);
  const { data: config } = useDoc<any>(configRef);
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [companySearchTerm, setCompanySearchTerm] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('Todas');
  const [maestroSubTab, setMaestroSubTab] = useState<'catalogo' | 'empresas'>('catalogo');
  
  const [activeTab, setActiveTab] = useState('existencia');

  const tabsList = useMemo(() => [
    { id: 'existencia', key: 'inventory_existencia' },
    { id: 'maestro', key: 'inventory_maestro' },
    { id: 'kardex', key: 'inventory_kardex' },
    { id: 'precios', key: 'inventory_precios' },
    { id: 'toma-fisica', key: 'inventory_toma_fisica' },
    { id: 'carga-masiva', key: 'inventory_carga_masiva' },
    { id: 'entradas', key: 'inventory_entradas' },
    { id: 'config', key: 'inventory_config' },
  ], []);

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
    category: 'General'
  });

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

  const [warehouseName, setWarehouseName] = useState('');

  // Estados para datos cargados desde Supabase
  const [inventory, setInventory] = useState<any[]>([]);

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

      // 2. Obtener productos maestro
      const { data: invData, error: invErr } = await supabase
        .from('inventory')
        .select('*')
        .order('sku');

      if (invErr) throw invErr;
      const invList = invData || [];

      // 3. Obtener existencias por bodega
      const { data: stockData, error: stockErr } = await supabase
        .from('inventory_stock')
        .select('*');

      if (stockErr) throw stockErr;
      const stockList = stockData || [];

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
          createdAt: item.created_at
        };
      });

      setInventory(mappedInventory);

      // 4. Obtener vinculaciones de proveedores
      const { data: supMapData, error: supMapErr } = await supabase
        .from('supplier_mappings')
        .select('*');
      
      if (!supMapErr) {
        setSavedMappings((supMapData || []).map(m => ({
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
      toast({
        variant: 'destructive',
        title: 'Error de Conexión',
        description: 'No se pudieron cargar los datos desde la nube de Supabase.'
      });
    } finally {
      setLoadingInv(false);
      setLoadingCompMappings(false);
    }
  };

  // Cargar datos en el montaje
  useEffect(() => {
    loadSupabaseData();
  }, []);

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
  const handleDownloadTemplate = () => {
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
    reader.onload = (e) => {
      try {
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

      const { error } = await supabase
        .from('inventory')
        .insert({
          sku: productForm.sku.toUpperCase(),
          name: productForm.name,
          category: productForm.category,
          price: 0.00
        });

      if (error) throw error;

      toast({ title: "Código Autorizado", description: "El producto ha sido registrado en el maestro." });
      setProductForm({ sku: '', name: '', category: 'General' });
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
      if (selectedWarehouse !== 'Todas') {
        const wh = warehouses.find(w => w.name === selectedWarehouse);
        if (!wh) {
          toast({ variant: "destructive", title: "Error", description: "La bodega seleccionada no existe." });
          return;
        }
        
        const currentQty = product.bodegas[selectedWarehouse] || 0;
        const newQty = currentQty + addedQty;

        const { error } = await supabase
          .from('inventory_stock')
          .upsert({
            sku: product.sku,
            warehouse_id: wh.id,
            quantity: newQty
          }, {
            onConflict: 'sku,warehouse_id'
          });

        if (error) throw error;
      } else {
        if (warehouses.length === 0) {
          toast({ variant: 'destructive', title: 'Error', description: 'Debe crear al menos una bodega primero.' });
          return;
        }
        // Si no hay una bodega seleccionada, se aplica a la primera bodega por defecto
        const defaultWh = warehouses[0];
        const currentQty = product.bodegas[defaultWh.name] || 0;
        const newQty = currentQty + addedQty;

        const { error } = await supabase
          .from('inventory_stock')
          .upsert({
            sku: product.sku,
            warehouse_id: defaultWh.id,
            quantity: newQty
          }, {
            onConflict: 'sku,warehouse_id'
          });

        if (error) throw error;
      }

      toast({ title: "Stock Actualizado", description: `Se agregaron ${quickEntry.quantity} unidades.` });
      setQuickEntry({ sku: '', quantity: '' });
      await loadSupabaseData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error al actualizar stock", description: err.message });
    }
  };

  const handleCreateWarehouse = async () => {
    if (!warehouseName) return;
    try {
      const { error } = await supabase
        .from('warehouses')
        .insert({ name: warehouseName });

      if (error) throw error;
      toast({ title: "Bodega Configurada", description: "La bodega ya está disponible." });
      setWarehouseName('');
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
    if (!inventory || !searchTerm.trim()) return [];
    
    // Si se selecciona una bodega, filtrar los productos que están vinculados a ella
    const whFiltered = selectedWarehouse === 'Todas' 
      ? inventory 
      : inventory.filter(item => item.bodegas && selectedWarehouse in item.bodegas);

    return whFiltered.filter(item => 
      item.sku.toLowerCase().includes(searchTerm.toLowerCase()) || 
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
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
    <div className="min-h-screen bg-slate-50 dark:bg-background p-4 md:p-6 transition-colors duration-300">
      <div className="max-w-7xl mx-auto mb-6 md:mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-full bg-white dark:bg-card shadow-sm hover:bg-slate-100 border border-slate-150" 
            onClick={() => router.push('/')}
          >
            <ArrowLeft className="text-slate-600 dark:text-foreground" size={20} />
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-foreground tracking-tight">Centro Logístico & Catálogo</h1>
            <p className="text-slate-500 dark:text-muted-foreground text-xs md:text-sm">Administración de stock por bodega, códigos maestros de empresas y almacenes</p>
          </div>
        </div>
      </div>
 
      <div className="max-w-7xl mx-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white dark:bg-card p-1 rounded-2xl shadow-sm border h-auto w-full justify-start overflow-x-auto no-scrollbar">
            {config?.['inventory_existencia'] !== false && (
              <TabsTrigger value="existencia" className="rounded-xl px-4 md:px-6 py-2 text-xs md:text-sm font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white whitespace-nowrap">
                <Package size={14} className="mr-2" /> Existencias
              </TabsTrigger>
            )}
            {config?.['inventory_maestro'] !== false && (
              <TabsTrigger value="maestro" className="rounded-xl px-4 md:px-6 py-2 text-xs md:text-sm font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white whitespace-nowrap">
                <Tag size={14} className="mr-2" /> Maestro
              </TabsTrigger>
            )}
            {config?.['inventory_precios'] !== false && (
              <TabsTrigger value="precios" className="rounded-xl px-4 md:px-6 py-2 text-xs md:text-sm font-bold data-[state=active]:bg-emerald-600 data-[state=active]:text-white whitespace-nowrap">
                <Tag size={14} className="mr-2" /> Producto
              </TabsTrigger>
            )}
            {config?.['inventory_kardex'] !== false && (
              <TabsTrigger value="kardex" className="rounded-xl px-4 md:px-6 py-2 text-xs md:text-sm font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white whitespace-nowrap">
                <History size={14} className="mr-2" /> Kardex de Almacén
              </TabsTrigger>
            )}
            {config?.['inventory_toma_fisica'] !== false && (
              <TabsTrigger value="toma-fisica" className="rounded-xl px-4 md:px-6 py-2 text-xs md:text-sm font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white whitespace-nowrap">
                <ClipboardList size={14} className="mr-2" /> Toma Física
              </TabsTrigger>
            )}
            {config?.['inventory_carga_masiva'] !== false && (
              <TabsTrigger value="carga-masiva" className="rounded-xl px-4 md:px-6 py-2 text-xs md:text-sm font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white whitespace-nowrap">
                <FileSpreadsheet size={14} className="mr-2" /> Carga Masiva (Excel)
              </TabsTrigger>
            )}
            {config?.['inventory_entradas'] !== false && (
              <TabsTrigger value="entradas" className="rounded-xl px-4 md:px-6 py-2 text-xs md:text-sm font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white whitespace-nowrap">
                <Zap size={14} className="mr-2" /> Entrada Rápida
              </TabsTrigger>
            )}
            {config?.['inventory_config'] !== false && (
              <TabsTrigger value="config" className="rounded-xl px-4 md:px-6 py-2 text-xs md:text-sm font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white whitespace-nowrap">
                <Settings2 size={14} className="mr-2" /> Bodegas
              </TabsTrigger>
            )}
          </TabsList>
 
          {/* TAB EXISTENCIAS CON FILTRO DE STOCK POR BODEGA */}
          <TabsContent value="existencia" className="space-y-4 outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-1 space-y-4">
                <Card className="border-none shadow-sm rounded-3xl bg-white dark:bg-card border h-fit hidden lg:block">
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
                    <SelectTrigger className="w-full rounded-xl bg-white dark:bg-card h-11 border-none shadow-sm text-xs font-bold">
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
                    className="pl-12 h-12 bg-white dark:bg-card border-none shadow-sm rounded-2xl text-xs md:text-sm"
                  />
                </div>
 
                <Card className="border-none shadow-sm rounded-3xl bg-white dark:bg-card border overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50 dark:bg-muted/50">
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
                            <TableRow key={item.id} className="hover:bg-slate-50 dark:hover:bg-muted/30 transition-colors">
                              <TableCell className="px-4 md:px-6 font-mono font-bold text-slate-600 dark:text-muted-foreground text-[10px] md:text-[11px] whitespace-nowrap">{item.sku}</TableCell>
                              <TableCell className="font-bold text-slate-900 dark:text-foreground text-xs min-w-[120px]">{item.name}</TableCell>
                              <TableCell className="text-center">
                                <Badge className={`font-black text-[9px] h-5 ${stockToShow <= 0 ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`} variant="outline">
                                  {stockToShow} un.
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right px-4 md:px-6 font-bold text-slate-900 dark:text-foreground text-xs whitespace-nowrap">
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
 
          {/* TAB MAESTRO CON INTEGRACIÓN DE CÓDIGOS DE EMPRESAS */}
          <TabsContent value="maestro" className="space-y-4 outline-none">
            <div className="flex gap-2 bg-slate-100 dark:bg-muted p-1 rounded-xl w-fit">
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
                  <Card className="border shadow-sm rounded-3xl bg-white dark:bg-card overflow-hidden">
                    <CardHeader className="bg-slate-900 dark:bg-slate-950 text-white p-5">
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
                                className="pl-9 h-11 bg-slate-50 dark:bg-muted border-none rounded-xl font-bold text-xs"
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
                            className="h-11 bg-slate-50 dark:bg-muted border-none rounded-xl text-xs"
                          />
                        </div>
 
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Categoría</Label>
                          <Select 
                            value={productForm.category} 
                            onValueChange={(val) => setProductForm({...productForm, category: val})}
                          >
                            <SelectTrigger className="h-11 bg-slate-50 dark:bg-muted border-none rounded-xl text-xs">
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
 
                  <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20 p-5 rounded-3xl space-y-2">
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
                      className="pl-12 h-12 bg-white dark:bg-card border-none shadow-sm rounded-2xl text-xs"
                    />
                  </div>
 
                  <Card className="border shadow-sm rounded-3xl bg-white dark:bg-card overflow-hidden">
                    <ScrollArea className="h-[500px]">
                      <Table>
                        <TableHeader className="bg-slate-50 dark:bg-muted/50 sticky top-0 z-10 shadow-sm">
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
                            <TableRow key={item.id} className="hover:bg-slate-50 dark:hover:bg-muted/30">
                              <TableCell className="px-6 py-4">
                                <Badge variant="outline" className="font-mono font-black text-[10px] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-muted-foreground">
                                  {item.sku}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-bold text-slate-900 dark:text-foreground text-xs">{item.name}</TableCell>
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
                  <Card className="border shadow-sm rounded-3xl bg-white dark:bg-card overflow-hidden">
                    <CardHeader className="bg-slate-900 dark:bg-slate-950 text-white p-5">
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
                            <SelectTrigger className="h-11 bg-slate-50 dark:bg-muted border-none rounded-xl text-xs font-bold">
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
                            className="h-11 bg-slate-50 dark:bg-muted border-none rounded-xl text-xs font-bold"
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
                              className="pl-9 h-11 bg-slate-50 dark:bg-muted border-none rounded-xl text-xs font-mono font-bold"
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

                  <div className="bg-slate-900 text-white p-5 rounded-3xl space-y-2">
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
                      className="pl-12 h-12 bg-white dark:bg-card border-none shadow-sm rounded-2xl text-xs"
                    />
                  </div>

                  <Card className="border shadow-sm rounded-3xl bg-white dark:bg-card overflow-hidden">
                    <ScrollArea className="h-[500px]">
                      <Table>
                        <TableHeader className="bg-slate-50 dark:bg-muted/50 sticky top-0 z-10 shadow-sm">
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
                            <TableRow key={map.id} className="hover:bg-slate-50 dark:hover:bg-muted/30">
                              <TableCell className="px-6 py-4 font-mono font-bold text-xs text-slate-600 dark:text-muted-foreground">
                                {map.masterSku}
                              </TableCell>
                              <TableCell className="font-bold text-slate-900 dark:text-foreground text-xs">{map.productName}</TableCell>
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

          {/* TAB PRECIOS / PRODUCTO */}
          <TabsContent value="precios" className="space-y-4 outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Formulario Izquierdo: Editor de Producto */}
              <div className="lg:col-span-7 space-y-6">
                <Card className="border shadow-sm rounded-3xl bg-white dark:bg-card overflow-hidden">
                  <CardHeader className="bg-emerald-900 dark:bg-emerald-950 text-white p-5">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Tag className="text-emerald-400" size={18} /> Editor de Producto
                    </CardTitle>
                    <CardDescription className="text-emerald-100/70 text-xs">
                      Selecciona un producto de la lista para modificar su nombre, precio, categoría y vinculación con el proveedor.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    {selectedPriceProduct ? (
                      <div className="space-y-6">
                        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 space-y-2 flex justify-between items-center">
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
                            <Label className="text-[10px] font-black uppercase text-slate-450 tracking-wider">Nombre del Producto</Label>
                            <Input value={productNameValue} onChange={e => setProductNameValue(e.target.value)} className="h-11 bg-slate-50 dark:bg-muted border-none rounded-xl text-xs font-bold" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-450 tracking-wider">Marca</Label>
                            <Input value={productBrand} onChange={e => setProductBrand(e.target.value)} placeholder="Ej. Sony, Samsung..." className="h-11 bg-slate-50 dark:bg-muted border-none rounded-xl text-xs font-bold" />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-450 tracking-wider">Tipo</Label>
                            <Select value={productType} onValueChange={setProductType}>
                              <SelectTrigger className="h-11 bg-slate-50 dark:bg-muted border-none rounded-xl text-xs font-bold"><SelectValue /></SelectTrigger>
                              <SelectContent className="rounded-xl">
                                <SelectItem value="Terminado">Terminado</SelectItem>
                                <SelectItem value="Materia Prima">Materia Prima</SelectItem>
                                <SelectItem value="Servicio">Servicio</SelectItem>
                                <SelectItem value="Insumo">Insumo</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-450 tracking-wider">Categoría / Área Contable</Label>
                            <Select value={selectedPriceCategory} onValueChange={setSelectedPriceCategory}>
                              <SelectTrigger className="h-11 bg-slate-50 dark:bg-muted border-none rounded-xl text-xs font-bold"><SelectValue /></SelectTrigger>
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
                            <Label className="text-[10px] font-black uppercase text-slate-450 tracking-wider">Unidad</Label>
                            <Select value={productUnit} onValueChange={setProductUnit}>
                              <SelectTrigger className="h-11 bg-slate-50 dark:bg-muted border-none rounded-xl text-xs font-bold"><SelectValue /></SelectTrigger>
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
                            <Label className="text-[10px] font-black uppercase text-slate-450 tracking-wider">Costo (Sin Impuesto)</Label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-xs text-muted-foreground">$</span>
                              <Input type="number" placeholder="0.00" value={productCost} onChange={e => setProductCost(e.target.value)} className="pl-7 h-11 bg-slate-50 dark:bg-muted border-none rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300" />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-450 tracking-wider">Precio Venta (PVP)</Label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-xs text-emerald-600 dark:text-emerald-400">$</span>
                              <Input type="number" placeholder="0.00" value={priceValue} onChange={e => setPriceValue(e.target.value)} className="pl-7 h-11 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-black text-emerald-700 dark:text-emerald-400" />
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-slate-100 dark:border-zinc-800 pt-4 mt-2">
                          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2"><Warehouse size={14}/> Control de Inventario</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label className="text-[10px] font-black uppercase text-slate-450">Min. Stock</Label>
                              <Input type="number" value={minStock} onChange={e => setMinStock(e.target.value)} className="h-10 bg-slate-50 dark:bg-muted border-none rounded-xl text-xs font-bold" />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[10px] font-black uppercase text-slate-450">Max. Stock</Label>
                              <Input type="number" value={maxStock} onChange={e => setMaxStock(e.target.value)} className="h-10 bg-slate-50 dark:bg-muted border-none rounded-xl text-xs font-bold" />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[10px] font-black uppercase text-slate-450">Punto Pedido</Label>
                              <Input type="number" value={reorderPoint} onChange={e => setReorderPoint(e.target.value)} className="h-10 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 rounded-xl text-xs font-bold" />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <div className="space-y-2">
                              <Label className="text-[10px] font-black uppercase text-slate-450 tracking-wider">Ubicación Física</Label>
                              <Input value={productLocation} onChange={e => setProductLocation(e.target.value)} placeholder="Ej. Estante A, Pasillo 3" className="h-10 bg-slate-50 dark:bg-muted border-none rounded-xl text-xs font-bold" />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-[10px] font-black uppercase text-slate-450 tracking-wider">Código del Proveedor</Label>
                              <Input value={selectedPriceSupplierSku} onChange={e => setSelectedPriceSupplierSku(e.target.value)} placeholder="Código externo..." className="h-10 bg-slate-50 dark:bg-muted border-none rounded-xl text-xs font-mono font-bold" />
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-slate-100 dark:border-zinc-800 pt-4 mt-2">
                          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2"><Tag size={14}/> Propiedades</h4>
                          <div className="flex flex-wrap gap-4">
                            <label className="flex items-center gap-2 cursor-pointer bg-slate-50 dark:bg-muted px-3 py-2 rounded-xl">
                              <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="rounded text-emerald-500 focus:ring-emerald-500 bg-slate-200 dark:bg-zinc-800 border-none w-4 h-4" />
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Activo</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer bg-slate-50 dark:bg-muted px-3 py-2 rounded-xl">
                              <input type="checkbox" checked={isService} onChange={e => setIsService(e.target.checked)} className="rounded text-emerald-500 focus:ring-emerald-500 bg-slate-200 dark:bg-zinc-800 border-none w-4 h-4" />
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Servicio</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer bg-slate-50 dark:bg-muted px-3 py-2 rounded-xl">
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
                    className="pl-12 h-12 bg-white dark:bg-card border-none shadow-sm rounded-2xl text-xs"
                  />
                </div>

                <Card className="border shadow-sm rounded-3xl bg-white dark:bg-card overflow-hidden">
                  <ScrollArea className="h-[500px]">
                    <Table>
                      <TableHeader className="bg-slate-50 dark:bg-muted/50 sticky top-0 z-10 shadow-sm">
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
                            className="hover:bg-slate-50 dark:hover:bg-muted/30 cursor-pointer transition-colors"
                          >
                            <TableCell className="px-6 py-4 font-mono font-bold text-xs text-slate-600 dark:text-muted-foreground">
                              {item.sku}
                            </TableCell>
                            <TableCell className="font-bold text-slate-900 dark:text-foreground text-xs">
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
 
           {/* TAB ENTRADAS */}
           <TabsContent value="entradas" className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 outline-none">
             <Card className="border shadow-sm rounded-3xl bg-white dark:bg-card h-fit">
               <CardHeader className="p-5 md:p-6">
                 <CardTitle className="text-base md:text-lg font-bold flex items-center gap-2">
                   <Zap size={18} className="text-amber-500" /> Entrada Rápida de Stock
                 </CardTitle>
                 <CardDescription className="text-xs">Ingreso inmediato al inventario maestro. Si seleccionas una bodega arriba, afectará a esa bodega.</CardDescription>
               </CardHeader>
               <CardContent className="px-5 md:px-6 pb-6">
                 <form onSubmit={handleQuickStockEntry} className="space-y-4 md:space-y-6">
                   <div className="space-y-2">
                     <Label className="text-[9px] md:text-[10px] font-bold uppercase text-slate-400">SKU del Producto</Label>
                     <Input 
                       placeholder="SKU..." 
                       value={quickEntry.sku}
                       onChange={e => setQuickEntry({...quickEntry, sku: e.target.value.toUpperCase()})}
                       className="bg-slate-50 dark:bg-muted border-none h-10 md:h-12 text-base md:text-lg font-bold text-xs"
                     />
                   </div>
                   <div className="space-y-2">
                     <Label className="text-[9px] md:text-[10px] font-bold uppercase text-slate-400">Cantidad a Agregar</Label>
                     <Input 
                       type="number"
                       placeholder="0"
                       value={quickEntry.quantity}
                       onFocus={e => e.target.select()}
                       onChange={e => setQuickEntry({...quickEntry, quantity: e.target.value})}
                       className="bg-slate-50 dark:bg-muted border-none h-10 md:h-12 text-lg font-black text-blue-600 dark:text-blue-400"
                     />
                   </div>
                   {selectedWarehouse !== 'Todas' && (
                     <div className="p-3 bg-blue-50 dark:bg-blue-950/20 text-blue-800 dark:text-blue-300 text-xs rounded-xl flex items-center gap-2">
                       <Warehouse size={14} />
                       <span>El stock se agregará a la bodega: <strong>{selectedWarehouse}</strong></span>
                     </div>
                   )}
                   <Button className="w-full bg-slate-900 dark:bg-blue-600 h-12 md:h-14 rounded-2xl font-bold shadow-lg text-white text-xs md:text-sm">
                     CARGAR STOCK
                   </Button>
                 </form>
               </CardContent>
             </Card>
 
             <div className="bg-blue-600 dark:bg-blue-900/30 rounded-3xl p-6 md:p-8 text-white flex flex-col justify-center border border-blue-500/20">
               <History size={40} className="mb-4 text-blue-200" />
               <h3 className="text-lg md:text-xl font-bold mb-2">¿Emergencia de Stock?</h3>
               <p className="text-blue-100 dark:text-blue-300 text-xs md:text-sm leading-relaxed mb-6">
                 Utiliza la entrada rápida para habilitar productos recién llegados que necesitan ser vendidos de inmediato antes de procesar la factura legal en Compras.
               </p>
               <div className="bg-blue-500/30 p-3 md:p-4 rounded-2xl border border-blue-400/30">
                 <p className="text-[9px] md:text-[11px] italic">"Formaliza este ingreso más tarde registrando la factura oficial en el módulo de Registro de Compra."</p>
               </div>
             </div>
           </TabsContent>
 
           {/* TAB BODEGAS CON GESTIÓN, ASOCIACIÓN Y VISTA DE STOCK */}
           <TabsContent value="config" className="space-y-6 outline-none">
             <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
               
               {/* Columna Izquierda: Crear Bodega y Vincular Producto */}
               <div className="lg:col-span-4 space-y-6">
                 {/* Tarjeta 1: Crear Bodega */}
                 <Card className="border shadow-sm rounded-3xl bg-white dark:bg-card h-fit">
                   <CardHeader className="p-5">
                     <CardTitle className="text-sm font-bold flex items-center gap-2">
                       <Warehouse size={16} className="text-blue-600" /> Crear Almacén / Bodega
                     </CardTitle>
                     <CardDescription className="text-xs">Configure puntos de almacenamiento físico.</CardDescription>
                   </CardHeader>
                   <CardContent className="p-5 pt-0 space-y-4">
                     <div className="space-y-2">
                       <Label className="text-[10px] font-bold uppercase text-slate-400">Nombre de la Bodega</Label>
                       <div className="flex gap-2">
                         <Input 
                           placeholder="Ej. Sucursal Santa Tecla..." 
                           value={warehouseName}
                           onChange={e => setWarehouseName(e.target.value)}
                           className="bg-slate-50 dark:bg-muted border-none h-10 text-xs font-bold"
                         />
                         <Button onClick={handleCreateWarehouse} className="bg-blue-600 font-bold rounded-xl text-xs text-white">
                           CREAR
                         </Button>
                       </div>
                     </div>
 
                     <div className="pt-2">
                       <Label className="text-[9px] font-black uppercase text-slate-400 block mb-2">Bodegas Activas</Label>
                       <div className="space-y-1">
                         {warehouses?.length === 0 ? (
                           <p className="text-[9px] text-slate-400 italic">No hay bodegas configuradas.</p>
                         ) : warehouses?.map((wh: any) => (
                           <div key={wh.id} className="flex justify-between items-center bg-slate-50 dark:bg-muted/30 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                             <span className="text-[11px] font-bold text-slate-700 dark:text-foreground">{wh.name}</span>
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
                 <Card className="border shadow-sm rounded-3xl bg-white dark:bg-card h-fit">
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
                           <SelectTrigger className="h-10 bg-slate-50 dark:bg-muted border-none rounded-xl text-xs font-bold">
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
                           <SelectTrigger className="h-10 bg-slate-50 dark:bg-muted border-none rounded-xl text-xs font-bold">
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
                           className="bg-slate-50 dark:bg-muted border-none h-10 text-xs font-black text-blue-600 dark:text-blue-400"
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
                 <Card className="p-4 bg-white dark:bg-card border shadow-sm rounded-3xl flex justify-between items-center">
                   <div className="space-y-1">
                     <Label className="text-[9px] font-black uppercase text-slate-400">Ver Productos en Bodega</Label>
                     <Select value={selectedWhView} onValueChange={setSelectedWhView}>
                       <SelectTrigger className="w-52 h-9 text-xs rounded-xl bg-slate-50 dark:bg-muted border-none font-bold">
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

                 <Card className="border shadow-sm rounded-3xl bg-white dark:bg-card overflow-hidden">
                   <ScrollArea className="h-[480px]">
                     <Table>
                       <TableHeader className="bg-slate-50 dark:bg-muted/50 sticky top-0 z-10 shadow-sm">
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
                             <TableRow key={item.id} className="hover:bg-slate-50 dark:hover:bg-muted/30">
                               <TableCell className="px-6 py-4 font-mono font-bold text-xs text-slate-600 dark:text-muted-foreground">
                                 {item.sku}
                               </TableCell>
                               <TableCell className="font-bold text-slate-900 dark:text-foreground text-xs">{item.name}</TableCell>
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

            {/* TAB CARGA MASIVA DE EXCEL/CSV */}
            <TabsContent value="carga-masiva" className="space-y-6 outline-none animate-in fade-in duration-300">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Panel Izquierdo: Carga y Progreso */}
                <div className="lg:col-span-5 space-y-6">
                  <Card className="border shadow-sm rounded-3xl bg-white dark:bg-card overflow-hidden">
                    <CardHeader className="bg-slate-900 dark:bg-slate-950 text-white p-5">
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
                        <div className="space-y-4 border-t pt-4 border-slate-100 dark:border-slate-800">
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
                                  <li key={idx}>Fila {inv.row}: {inv.reason}</li>
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
                              <div className="w-full bg-slate-100 dark:bg-muted rounded-full h-2 overflow-hidden">
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
                  <Card className="border shadow-sm rounded-3xl bg-white dark:bg-card overflow-hidden">
                    <CardHeader className="bg-slate-900 dark:bg-slate-950 text-white p-5">
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
                  <Card className="border shadow-sm rounded-3xl bg-white dark:bg-card overflow-hidden">
                    <Tabs defaultValue="excel" className="w-full">
                      
                      {/* Header Integrado de Sub-pestañas */}
                      <div className="p-4 bg-slate-50 dark:bg-muted/50 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
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
                            <TableHeader className="bg-slate-50 dark:bg-muted/50 sticky top-0 z-10 shadow-sm">
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
                                <TableRow key={idx} className="hover:bg-slate-50 dark:hover:bg-muted/30">
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
                                <TableRow key={item.sku} className="hover:bg-slate-50 dark:hover:bg-muted/30">
                                  <TableCell className="px-4 md:px-6 py-3 font-mono font-black text-xs text-slate-700 dark:text-foreground">
                                    {item.sku}
                                  </TableCell>
                                  <TableCell className="text-xs font-bold text-slate-500 dark:text-muted-foreground">
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

            {/* TAB KARDEX DE ALMACEN */}
            <TabsContent value="kardex" className="space-y-6 outline-none animate-in fade-in duration-300">
              <Card className="border shadow-sm rounded-3xl bg-white dark:bg-card">
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
                    <TableHeader className="bg-slate-50 dark:bg-muted/50">
                      <TableRow>
                        <TableHead className="text-[10px] font-black uppercase px-6">Fecha</TableHead>
                        <TableHead className="text-[10px] font-black uppercase">Código SKU</TableHead>
                        <TableHead className="text-[10px] font-black uppercase">Descripción del Producto</TableHead>
                        <TableHead className="text-[10px] font-black uppercase">Tipo Movimiento</TableHead>
                        <TableHead className="text-center text-[10px] font-black uppercase">Cantidad</TableHead>
                        <TableHead className="text-right text-[10px] font-black uppercase">Stock Consolidado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {!searchTerm.trim() ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-16 text-slate-450 italic text-xs font-medium">
                            Digite un código de SKU o nombre en la barra de búsqueda para ver sus movimientos en el Kardex.
                          </TableCell>
                        </TableRow>
                      ) : filteredItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-16 text-slate-400 italic text-xs">
                            No se encontraron registros de inventario para este filtro.
                          </TableCell>
                        </TableRow>
                      ) : filteredItems.map((item: any) => (
                        <TableRow key={item.id} className="hover:bg-slate-50 dark:hover:bg-muted/30">
                          <TableCell className="px-6 text-[11px] font-mono text-slate-400">
                            {item.createdAt ? new Date(item.createdAt).toLocaleString('es-SV') : new Date().toLocaleString('es-SV')}
                          </TableCell>
                          <TableCell className="font-mono font-bold text-xs text-slate-700 dark:text-foreground">{item.sku}</TableCell>
                          <TableCell className="font-bold text-xs">{item.name}</TableCell>
                          <TableCell>
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 text-[9px] font-bold">
                              CARGA INICIAL / INGRESO
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center font-bold text-emerald-600 text-xs">+{item.quantity || 0}</TableCell>
                          <TableCell className="text-right font-black text-xs px-6">${(item.price || 0).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB TOMA FISICA */}
            <TabsContent value="toma-fisica" className="space-y-6 outline-none animate-in fade-in duration-300">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-5 space-y-4">
                  <Card className="border shadow-sm rounded-3xl bg-white dark:bg-card">
                    <CardHeader className="p-6 border-b">
                      <CardTitle className="text-base font-bold flex items-center gap-2">
                        <ClipboardList className="text-blue-600" size={18} />
                        Registro de Toma Física
                      </CardTitle>
                      <CardDescription className="text-xs">Realice ajustes y corrección de stock tras inventarios físicos.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Bodega de Ajuste</Label>
                        <Select 
                          value={linkForm.warehouseName}
                          onValueChange={(val) => setLinkForm({ ...linkForm, warehouseName: val })}
                        >
                          <SelectTrigger className="h-11 bg-slate-50 border-slate-100 rounded-xl text-xs font-bold">
                            <SelectValue placeholder="Seleccione bodega..." />
                          </SelectTrigger>
                          <SelectContent>
                            {warehouses?.map((wh: any) => (
                              <SelectItem key={wh.id} value={wh.name}>{wh.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Seleccionar Producto (SKU)</Label>
                        <Select 
                          value={linkForm.productSku}
                          onValueChange={(val) => {
                            const prod = inventory?.find((p: any) => p.sku === val);
                            const systemStock = prod?.quantity || 0;
                            setLinkForm({ 
                              ...linkForm, 
                              productSku: val,
                              initialStock: systemStock.toString()
                            });
                          }}
                        >
                          <SelectTrigger className="h-11 bg-slate-50 border-slate-100 rounded-xl text-xs font-bold">
                            <SelectValue placeholder="Seleccione producto..." />
                          </SelectTrigger>
                          <SelectContent>
                            {inventory?.map((p: any) => (
                              <SelectItem key={p.id} value={p.sku}>{p.sku} - {p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Stock Sistema</Label>
                          <Input 
                            type="number" 
                            disabled 
                            value={linkForm.productSku ? (inventory?.find((p: any) => p.sku === linkForm.productSku)?.quantity || 0) : 0}
                            className="h-11 bg-slate-100 rounded-xl font-bold border-none"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Conteo Físico</Label>
                          <Input 
                            type="number" 
                            placeholder="0" 
                            value={linkForm.initialStock}
                            onChange={(e) => setLinkForm({ ...linkForm, initialStock: e.target.value })}
                            className="h-11 bg-slate-50 border-slate-100 rounded-xl font-black text-blue-600 text-lg"
                          />
                        </div>
                      </div>

                      {linkForm.productSku && (
                        <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-2xl text-xs space-y-2 animate-in fade-in slide-in-from-top-2">
                          <div className="flex justify-between font-bold">
                            <span className="text-slate-500">Diferencia de Ajuste:</span>
                            {(() => {
                              const sys = inventory?.find((p: any) => p.sku === linkForm.productSku)?.quantity || 0;
                              const count = parseFloat(linkForm.initialStock) || 0;
                              const diff = count - sys;
                              return (
                                <span className={diff === 0 ? 'text-slate-700' : diff > 0 ? 'text-emerald-600' : 'text-rose-600'}>
                                  {diff > 0 ? `+${diff}` : diff} unidades
                                </span>
                              );
                            })()}
                          </div>
                          <p className="text-[10px] text-slate-400 italic">El stock consolidado del producto y su bodega seleccionada se ajustarán automáticamente al valor del conteo físico al guardar.</p>
                        </div>
                      )}

                      <Button 
                        onClick={handleLinkProductToWarehouse}
                        disabled={loading || !linkForm.warehouseName || !linkForm.productSku}
                        className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 active:scale-95 transition-all mt-2"
                      >
                        {loading ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" size={16} />}
                        APLICAR TOMA FÍSICA
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                <div className="lg:col-span-7">
                  <Card className="border shadow-sm rounded-3xl bg-white dark:bg-card overflow-hidden">
                    <CardHeader className="p-6 border-b">
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Warehouse className="text-blue-600" size={18} />
                        Consulta General de Bodegas
                      </CardTitle>
                      <CardDescription className="text-xs">Vea la distribución de existencias físicas en sus diferentes almacenes.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="p-4 border-b flex items-center gap-4 bg-slate-50 dark:bg-muted/10">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Filtrar por Bodega:</span>
                        <Select value={selectedWhView} onValueChange={setSelectedWhView}>
                          <SelectTrigger className="w-[180px] h-9 bg-white dark:bg-slate-900 border-slate-200 text-xs font-bold rounded-lg shadow-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Todas">Todas las Bodegas</SelectItem>
                            {warehouses?.map((w: any) => (
                              <SelectItem key={w.id} value={w.name}>{w.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-[10px] font-black uppercase px-6">Código SKU</TableHead>
                            <TableHead className="text-[10px] font-black uppercase">Nombre</TableHead>
                            <TableHead className="text-center text-[10px] font-black uppercase">Stock Bodega</TableHead>
                            <TableHead className="text-right text-[10px] font-black uppercase px-6">Acción</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {productsInSelectedWarehouse.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center py-16 text-slate-400 italic text-xs">
                                No hay productos asignados a esta bodega.
                              </TableCell>
                            </TableRow>
                          ) : productsInSelectedWarehouse.map((p: any) => {
                            const whQty = selectedWhView === 'Todas' ? (p.quantity || 0) : (p.bodegas?.[selectedWhView] || 0);
                            return (
                              <TableRow key={p.id} className="hover:bg-slate-50 dark:hover:bg-muted/30">
                                <TableCell className="px-6 font-mono font-bold text-xs">{p.sku}</TableCell>
                                <TableCell className="font-bold text-xs">{p.name}</TableCell>
                                <TableCell className="text-center">
                                  <Badge className={whQty > 0 ? 'bg-blue-50 text-blue-700' : 'bg-rose-50 text-rose-700'}>
                                    {whQty} unidades
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right px-6">
                                  {selectedWhView !== 'Todas' && (
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="h-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-[10px]"
                                      onClick={() => handleUnlinkProductFromWarehouse(p.id, selectedWhView)}
                                    >
                                      Remover de Bodega
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

          </Tabs>
        </div>
      </div>
    );
}
