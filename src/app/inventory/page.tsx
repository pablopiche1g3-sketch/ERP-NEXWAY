'use client';

import React, { useState, useMemo, useRef } from 'react';
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
  FileSpreadsheet
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
import { useFirestore, useCollection } from '@/firebase';
import { collection, addDoc, deleteDoc, doc, query, where, getDocs, updateDoc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useRouter } from 'next/navigation';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface SupplierItem {
  code: string;
  name: string;
  mappedInternalSku?: string;
}

export default function InventoryMasterPage() {
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [companySearchTerm, setCompanySearchTerm] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('Todas');
  const [maestroSubTab, setMaestroSubTab] = useState<'catalogo' | 'empresas'>('catalogo');
  
  // Vinculación States
  const [supplierItems, setSupplierItems] = useState<SupplierItem[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Excel/CSV Bulk Import states
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkHeaders, setBulkHeaders] = useState<string[]>([]);
  const [bulkRows, setBulkRows] = useState<any[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({
    sku: '',
    name: '',
    category: '',
    price: '',
    stock: ''
  });
  const [bulkImportProgress, setBulkImportProgress] = useState(0);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [selectedImportWarehouse, setSelectedImportWarehouse] = useState('Ninguna');
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

  // Estabilizar consultas
  const inventoryQuery = useMemo(() => collection(db, 'inventory'), [db]);
  const warehousesQuery = useMemo(() => collection(db, 'warehouses'), [db]);
  const mappingsQuery = useMemo(() => collection(db, 'supplier_mappings'), [db]);
  const companyMappingsQuery = useMemo(() => collection(db, 'company_mappings'), [db]); 

  const { data: inventory, loading: loadingInv } = useCollection<any>(inventoryQuery);
  const { data: warehouses } = useCollection<any>(warehousesQuery);
  const { data: savedMappings } = useCollection<any>(mappingsQuery);
  const { data: companyMappings, loading: loadingCompMappings } = useCollection<any>(companyMappingsQuery);

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

  // Manejo de carga de archivos (CSV y Excel)
  const handleBulkFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setBulkFile(file);
    const reader = new FileReader();
    
    if (file.name.endsWith('.csv')) {
      reader.onload = (event) => {
        try {
          const text = event.target?.result as string;
          const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
          if (lines.length === 0) {
            toast({ variant: "destructive", title: "Archivo vacío", description: "El archivo CSV no contiene datos." });
            return;
          }
          
          const firstLine = lines[0];
          const delimiter = firstLine.includes(';') ? ';' : ',';
          const headers = firstLine.split(delimiter).map(h => h.replace(/^["']|["']$/g, '').trim());
          setBulkHeaders(headers);
          
          const rows = lines.slice(1).map((line) => {
            const values = line.split(delimiter).map(v => v.replace(/^["']|["']$/g, '').trim());
            const rowObj: Record<string, string> = {};
            headers.forEach((header, index) => {
              rowObj[header] = values[index] || '';
            });
            return rowObj;
          });
          
          setBulkRows(rows);
          
          const newMapping = { ...columnMapping };
          headers.forEach(h => {
            const lower = h.toLowerCase();
            if (lower.includes('sku') || lower.includes('código') || lower.includes('codigo')) newMapping.sku = h;
            if (lower.includes('nombre') || lower.includes('producto') || lower.includes('descrip')) newMapping.name = h;
            if (lower.includes('categor') || lower.includes('cat')) newMapping.category = h;
            if (lower.includes('precio') || lower.includes('price') || lower.includes('costo')) newMapping.price = h;
            if (lower.includes('stock') || lower.includes('cant') || lower.includes('exist')) newMapping.stock = h;
          });
          setColumnMapping(newMapping);
          
          toast({ title: "CSV Cargado", description: `Se detectaron ${rows.length} filas.` });
        } catch (err) {
          toast({ variant: "destructive", title: "Error", description: "No se pudo procesar el archivo CSV." });
        }
      };
      reader.readAsText(file);
    } else {
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1 });
          
          if (json.length === 0) {
            toast({ variant: "destructive", title: "Archivo vacío", description: "El archivo Excel no contiene datos." });
            return;
          }
          
          const headers = (json[0] as any[]).map(h => String(h || '').trim());
          setBulkHeaders(headers);
          
          const rows = json.slice(1).map((row: any) => {
            const rowObj: Record<string, any> = {};
            headers.forEach((header, index) => {
              rowObj[header] = row[index] !== undefined ? row[index] : '';
            });
            return rowObj;
          });
          
          setBulkRows(rows);
          
          const newMapping = { ...columnMapping };
          headers.forEach(h => {
            const lower = h.toLowerCase();
            if (lower.includes('sku') || lower.includes('código') || lower.includes('codigo')) newMapping.sku = h;
            if (lower.includes('nombre') || lower.includes('producto') || lower.includes('descrip')) newMapping.name = h;
            if (lower.includes('categor') || lower.includes('cat')) newMapping.category = h;
            if (lower.includes('precio') || lower.includes('price') || lower.includes('costo')) newMapping.price = h;
            if (lower.includes('stock') || lower.includes('cant') || lower.includes('exist')) newMapping.stock = h;
          });
          setColumnMapping(newMapping);
          
          toast({ title: "Excel Cargado", description: `Se detectaron ${rows.length} filas.` });
        } catch (err) {
          toast({ variant: "destructive", title: "Error", description: "No se pudo procesar el archivo Excel." });
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  // Procesar importación masiva en Firestore
  const handleBulkImport = async () => {
    if (!bulkRows.length) return;
    if (!columnMapping.sku || !columnMapping.name) {
      toast({ variant: "destructive", title: "Mapeo Incompleto", description: "Es obligatorio mapear al menos SKU y Nombre." });
      return;
    }
    
    setBulkImporting(true);
    setBulkImportProgress(0);
    let importedCount = 0;
    let errorCount = 0;
    
    try {
      for (let i = 0; i < bulkRows.length; i++) {
        const row = bulkRows[i];
        const rawSku = String(row[columnMapping.sku] || '').trim().toUpperCase();
        const rawName = String(row[columnMapping.name] || '').trim();
        
        if (!rawSku || !rawName) {
          errorCount++;
          continue;
        }
        
        const rawCategory = columnMapping.category ? String(row[columnMapping.category] || '').trim() : 'General';
        const rawPrice = columnMapping.price ? parseFloat(row[columnMapping.price]) || 0 : 0;
        const rawStock = columnMapping.stock ? parseFloat(row[columnMapping.stock]) || 0 : 0;
        
        const existing = inventory?.find((p: any) => p.sku === rawSku);
        
        const bodegasData: Record<string, number> = {};
        if (selectedImportWarehouse !== 'Ninguna' && rawStock > 0) {
          bodegasData[selectedImportWarehouse] = rawStock;
        }
        
        if (existing) {
          const existingBodegas = existing.bodegas || {};
          let updatedBodegas = { ...existingBodegas };
          
          if (selectedImportWarehouse !== 'Ninguna') {
            updatedBodegas[selectedImportWarehouse] = (updatedBodegas[selectedImportWarehouse] || 0) + rawStock;
          }
          
          const consolidatedQty = Object.values(updatedBodegas).reduce((acc: number, val: any) => acc + (parseFloat(val) || 0), 0) as number;
          
          const productRef = doc(db, 'inventory', existing.id);
          await updateDoc(productRef, {
            bodegas: updatedBodegas,
            quantity: consolidatedQty,
            price: rawPrice > 0 ? rawPrice : (existing.price || 0)
          });
        } else {
          const data = {
            sku: rawSku,
            name: rawName,
            category: rawCategory || 'General',
            price: rawPrice,
            quantity: rawStock,
            bodegas: bodegasData,
            createdAt: new Date().toISOString()
          };
          await addDoc(inventoryQuery, data);
        }
        
        importedCount++;
        setBulkImportProgress(Math.round(((i + 1) / bulkRows.length) * 100));
      }
      
      toast({
        title: "Carga Masiva Completada",
        description: `Se procesaron exitosamente ${importedCount} productos.`
      });
      
      setBulkFile(null);
      setBulkHeaders([]);
      setBulkRows([]);
      if (bulkFileInputRef.current) bulkFileInputRef.current.value = '';
    } catch (err) {
      toast({ variant: "destructive", title: "Error en la importación", description: "Ocurrió un error al procesar el lote." });
    } finally {
      setBulkImporting(false);
      setBulkImportProgress(0);
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
      const q = query(inventoryQuery, where("sku", "==", productForm.sku.toUpperCase()));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        toast({ variant: "destructive", title: "Error", description: "Este código SKU ya existe en el sistema." });
        setLoading(false);
        return;
      }

      const data = {
        sku: productForm.sku.toUpperCase(),
        name: productForm.name,
        category: productForm.category,
        price: 0,
        quantity: 0,
        bodegas: {}, // Inicializa el mapa de existencias por bodega
        createdAt: new Date().toISOString()
      };

      await addDoc(inventoryQuery, data);
      toast({ title: "Código Autorizado", description: "El producto ha sido registrado en el maestro." });
      setProductForm({ sku: '', name: '', category: 'General' });
    } catch (err: any) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'inventory', operation: 'create', requestResourceData: productForm }));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'inventory', id));
      toast({ title: "Producto Eliminado" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al eliminar" });
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
      const data = {
        masterSku: companyForm.masterSku,
        productName: selectedProduct ? selectedProduct.name : 'Producto',
        companyName: companyForm.companyName,
        companySku: companyForm.companySku.toUpperCase(),
        createdAt: new Date().toISOString()
      };

      await addDoc(companyMappingsQuery, data);
      toast({ title: "Código de Empresa Asociado", description: "Se vinculó el código interno con éxito." });
      setCompanyForm({ masterSku: '', companyName: '', companySku: '' });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo crear la vinculación." });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCompanyMapping = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'company_mappings', id));
      toast({ title: "Asociación Removida" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al eliminar la asociación" });
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

      const productRef = doc(db, 'inventory', product.id);
      const currentBodegas = product.bodegas || {};
      const newStock = parseFloat(linkForm.initialStock) || 0;
      
      const updatedBodegas = {
        ...currentBodegas,
        [linkForm.warehouseName]: newStock
      };

      // Suma total de stock consolidado
      const consolidatedQty = Object.values(updatedBodegas).reduce((acc: number, val: any) => acc + (parseFloat(val) || 0), 0) as number;

      await updateDoc(productRef, {
        bodegas: updatedBodegas,
        quantity: consolidatedQty
      });

      toast({ 
        title: "Producto Vinculado a Bodega", 
        description: `Se asignó el SKU ${linkForm.productSku} a la bodega '${linkForm.warehouseName}' con stock inicial de ${newStock} un.` 
      });
      setLinkForm({ ...linkForm, productSku: '', initialStock: '0' });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al vincular", description: "No se pudo actualizar el inventario." });
    } finally {
      setLoading(false);
    }
  };

  const handleUnlinkProductFromWarehouse = async (productId: string, whName: string) => {
    try {
      const product = inventory?.find((p: any) => p.id === productId);
      if (!product) return;

      const productRef = doc(db, 'inventory', product.id);
      const currentBodegas = { ...product.bodegas };
      delete currentBodegas[whName]; // Remover la asociación de esa bodega

      // Re-calcular total consolidado
      const consolidatedQty = Object.values(currentBodegas).reduce((acc: number, val: any) => acc + (parseFloat(val) || 0), 0) as number;

      await updateDoc(productRef, {
        bodegas: currentBodegas,
        quantity: consolidatedQty
      });

      toast({ title: "Asociación Removida", description: `Se desvinculó el producto de la bodega ${whName}.` });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al desvincular" });
    }
  };

  const handleQuickStockEntry = (e: React.FormEvent) => {
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

    const productRef = doc(db, 'inventory', product.id);
    
    // Si hay una bodega seleccionada que no es "Todas", sumarlo ahí, si no al stock general
    const currentQty = product.quantity || 0;
    const addedQty = parseInt(quickEntry.quantity.toString()) || 0;

    let updateData: any = {};
    if (selectedWarehouse !== 'Todas') {
      const currentBodegas = product.bodegas || {};
      const updatedBodegas = {
        ...currentBodegas,
        [selectedWarehouse]: (currentBodegas[selectedWarehouse] || 0) + addedQty
      };
      updateData = {
        bodegas: updatedBodegas,
        quantity: currentQty + addedQty
      };
    } else {
      updateData = {
        quantity: currentQty + addedQty
      };
    }

    updateDoc(productRef, updateData)
      .catch(async (err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: productRef.path, operation: 'update', requestResourceData: updateData }));
      });

    toast({ title: "Stock Actualizado", description: `Se agregaron ${quickEntry.quantity} unidades.` });
    setQuickEntry({ sku: '', quantity: '' });
  };

  const handleCreateWarehouse = () => {
    if (!warehouseName) return;
    const data = { name: warehouseName };
    addDoc(warehousesQuery, data)
      .catch(async (err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'warehouses', operation: 'create', requestResourceData: data }));
      });
    toast({ title: "Bodega Configurada", description: "La bodega ya está disponible." });
    setWarehouseName('');
  };

  const handleDeleteWarehouse = (id: string) => {
    const whRef = doc(db, 'warehouses', id);
    deleteDoc(whRef)
      .catch(async (err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: whRef.path, operation: 'delete' }));
      });
    toast({ title: "Bodega Eliminada", description: "Se ha removido la bodega del sistema." });
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
        await setDoc(doc(db, 'supplier_mappings', supCode), {
          supplierCode: supCode,
          internalSku: intSku,
          updatedAt: new Date().toISOString()
        });
      }
      toast({ title: "Vinculaciones Guardadas", description: "Los códigos han sido asociados correctamente." });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al guardar vinculaciones" });
    } finally {
      setLoading(false);
    }
  };

  // Filtrado de existencias considerando la Bodega Seleccionada
  const filteredItems = useMemo(() => {
    if (!inventory) return [];
    
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
    if (!companyMappings) return [];
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
        <Tabs defaultValue="existencia" className="space-y-6">
          <TabsList className="bg-white dark:bg-card p-1 rounded-2xl shadow-sm border h-auto w-full justify-start overflow-x-auto no-scrollbar">
            <TabsTrigger value="existencia" className="rounded-xl px-4 md:px-6 py-2 text-xs md:text-sm font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white whitespace-nowrap">
              <Package size={14} className="mr-2" /> Existencias
            </TabsTrigger>
            <TabsTrigger value="maestro" className="rounded-xl px-4 md:px-6 py-2 text-xs md:text-sm font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white whitespace-nowrap">
              <Tag size={14} className="mr-2" /> Maestro
            </TabsTrigger>
            <TabsTrigger value="carga-masiva" className="rounded-xl px-4 md:px-6 py-2 text-xs md:text-sm font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white whitespace-nowrap">
              <FileSpreadsheet size={14} className="mr-2" /> Carga Masiva (Excel)
            </TabsTrigger>
            <TabsTrigger value="vinculacion" className="rounded-xl px-4 md:px-6 py-2 text-xs md:text-sm font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white whitespace-nowrap">
              <ArrowRightLeft size={14} className="mr-2" /> Vincular DTE
            </TabsTrigger>
            <TabsTrigger value="entradas" className="rounded-xl px-4 md:px-6 py-2 text-xs md:text-sm font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white whitespace-nowrap">
              <Zap size={14} className="mr-2" /> Entrada Rápida
            </TabsTrigger>
            <TabsTrigger value="config" className="rounded-xl px-4 md:px-6 py-2 text-xs md:text-sm font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white whitespace-nowrap">
              <Settings2 size={14} className="mr-2" /> Bodegas
            </TabsTrigger>
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
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </Card>
                </div>
              </div>
            )}
          </TabsContent>
 
          {/* TAB VINCULAR DTE V3 */}
          <TabsContent value="vinculacion" className="space-y-6 outline-none">
             <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
                <div className="lg:col-span-4 space-y-6">
                   <Card className="border-none shadow-sm rounded-3xl bg-white dark:bg-card border overflow-hidden">
                      <CardHeader className="bg-slate-900 dark:bg-slate-950 text-white p-5 md:p-6">
                         <CardTitle className="text-base md:text-lg font-bold flex items-center gap-2">
                            <FileJson size={20} className="text-blue-400" /> Mapeo DTE V3
                         </CardTitle>
                         <CardDescription className="text-slate-400 text-xs">Vincule códigos del proveedor de Hacienda</CardDescription>
                      </CardHeader>
                      <CardContent className="p-4 md:p-6 space-y-4 md:space-y-6">
                         <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20 p-4 rounded-2xl space-y-2">
                            <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300 font-bold">
                               <Info size={14} />
                               <span className="text-[10px] uppercase tracking-tight">Instrucciones</span>
                            </div>
                            <p className="text-[9px] md:text-[10px] text-blue-700 dark:text-blue-400 leading-relaxed">
                               Cargue el JSON DTE (Factura o CCF) del proveedor. Asocie sus códigos para automatizar futuras compras.
                            </p>
                         </div>
                         
                         <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleJsonUpload} />
                         <Button 
                            className="w-full h-12 md:h-14 bg-blue-600 hover:bg-blue-700 rounded-2xl font-bold text-xs text-white"
                            onClick={() => fileInputRef.current?.click()}
                         >
                            <FileJson className="mr-2" size={16} /> CARGAR DTE V3
                         </Button>
 
                         {supplierItems.length > 0 && (
                            <Button 
                               className="w-full h-12 md:h-14 bg-emerald-600 hover:bg-emerald-700 rounded-2xl font-bold text-xs text-white mt-2"
                               onClick={saveMappings}
                               disabled={loading}
                            >
                               {loading ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2" size={16} />}
                               GUARDAR VINCULACIONES
                            </Button>
                         )}
                      </CardContent>
                   </Card>
                </div>
 
                <div className="lg:col-span-8">
                   <Card className="border-none shadow-sm rounded-3xl bg-white dark:bg-card border overflow-hidden">
                      <div className="overflow-x-auto">
                        <Table>
                           <TableHeader className="bg-slate-50 dark:bg-muted/50">
                              <TableRow>
                                 <TableHead className="px-4 md:px-6 text-[10px] font-black uppercase whitespace-nowrap">Código Prov.</TableHead>
                                 <TableHead className="text-[10px] font-black uppercase whitespace-nowrap">Descripción</TableHead>
                                 <TableHead className="text-[10px] font-black uppercase pr-4 md:pr-6 min-w-[150px]">SKU Interno</TableHead>
                              </TableRow>
                           </TableHeader>
                           <TableBody>
                              {supplierItems.length === 0 ? (
                                 <TableRow>
                                    <TableCell colSpan={3} className="text-center py-20 md:py-24 text-slate-400 text-xs italic">
                                       Cargue un archivo DTE para comenzar
                                    </TableCell>
                                 </TableRow>
                              ) : supplierItems.map((item, idx) => (
                                 <TableRow key={idx}>
                                    <TableCell className="px-4 md:px-6 font-mono text-[10px] md:text-[11px] font-bold text-slate-600 dark:text-muted-foreground whitespace-nowrap">{item.code}</TableCell>
                                    <TableCell className="text-[10px] md:text-xs text-slate-500 dark:text-muted-foreground font-medium max-w-[120px] truncate">{item.name}</TableCell>
                                    <TableCell className="pr-4 md:pr-6">
                                       <Select 
                                          value={mappings[item.code] || ""} 
                                          onValueChange={(val) => setMappings(prev => ({...prev, [item.code]: val}))}
                                       >
                                          <SelectTrigger className="h-8 md:h-9 rounded-xl text-[9px] md:text-[10px] font-bold bg-slate-50 dark:bg-muted border-none">
                                             <SelectValue placeholder="Vincular a..." />
                                          </SelectTrigger>
                                          <SelectContent>
                                             {inventory?.map((inv: any) => (
                                                <SelectItem key={inv.id} value={inv.sku} className="text-[10px]">
                                                   {inv.sku} - {inv.name}
                                                 </SelectItem>
                                              ))}
                                           </SelectContent>
                                        </Select>
                                     </TableCell>
                                  </TableRow>
                               ))}
                            </TableBody>
                         </Table>
                       </div>
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
                
                {/* Panel Izquierdo: Carga y Mapeo */}
                <div className="lg:col-span-5 space-y-6">
                  <Card className="border shadow-sm rounded-3xl bg-white dark:bg-card overflow-hidden">
                    <CardHeader className="bg-slate-900 dark:bg-slate-950 text-white p-5">
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Upload className="text-blue-400 animate-bounce" size={18} /> Importación por Excel/CSV
                      </CardTitle>
                      <CardDescription className="text-slate-400 text-xs">
                        Cargue inventario de forma masiva mapeando las columnas de su archivo.
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
                          onChange={handleBulkFileChange} 
                        />
                        <FileSpreadsheet className="mx-auto text-blue-500 mb-2" size={32} />
                        <span className="text-xs font-bold text-slate-700 dark:text-foreground block">
                          {bulkFile ? bulkFile.name : "Seleccione su archivo Excel (.xlsx, .xls) o CSV"}
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-1">
                          {bulkFile ? `${(bulkFile.size / 1024).toFixed(1)} KB` : "Arrastre y suelte el archivo aquí"}
                        </span>
                      </div>

                      {bulkHeaders.length > 0 && (
                        <div className="space-y-4 border-t pt-4 border-slate-100 dark:border-slate-800">
                          <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">
                            Mapear Columnas del Archivo
                          </Label>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-[9px] font-bold text-slate-500">SKU (Obligatorio)</Label>
                              <Select 
                                value={columnMapping.sku} 
                                onValueChange={(val) => setColumnMapping({...columnMapping, sku: val})}
                              >
                                <SelectTrigger className="h-9 bg-slate-50 dark:bg-muted border-none text-[10px] rounded-lg font-semibold">
                                  <SelectValue placeholder="Seleccionar..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {bulkHeaders.map(h => (
                                    <SelectItem key={h} value={h} className="text-xs">{h}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-1">
                              <Label className="text-[9px] font-bold text-slate-500">Nombre (Obligatorio)</Label>
                              <Select 
                                value={columnMapping.name} 
                                onValueChange={(val) => setColumnMapping({...columnMapping, name: val})}
                              >
                                <SelectTrigger className="h-9 bg-slate-50 dark:bg-muted border-none text-[10px] rounded-lg font-semibold">
                                  <SelectValue placeholder="Seleccionar..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {bulkHeaders.map(h => (
                                    <SelectItem key={h} value={h} className="text-xs">{h}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-1">
                              <Label className="text-[9px] font-bold text-slate-500">Categoría</Label>
                              <Select 
                                value={columnMapping.category} 
                                onValueChange={(val) => setColumnMapping({...columnMapping, category: val})}
                              >
                                <SelectTrigger className="h-9 bg-slate-50 dark:bg-muted border-none text-[10px] rounded-lg font-semibold">
                                  <SelectValue placeholder="Ninguna (Defecto: General)" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="" className="text-xs">General</SelectItem>
                                  {bulkHeaders.map(h => (
                                    <SelectItem key={h} value={h} className="text-xs">{h}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-1">
                              <Label className="text-[9px] font-bold text-slate-500">Precio</Label>
                              <Select 
                                value={columnMapping.price} 
                                onValueChange={(val) => setColumnMapping({...columnMapping, price: val})}
                              >
                                <SelectTrigger className="h-9 bg-slate-50 dark:bg-muted border-none text-[10px] rounded-lg font-semibold">
                                  <SelectValue placeholder="Ninguno (Defecto: $0.00)" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="" className="text-xs">$0.00</SelectItem>
                                  {bulkHeaders.map(h => (
                                    <SelectItem key={h} value={h} className="text-xs">{h}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-1">
                              <Label className="text-[9px] font-bold text-slate-500">Stock Inicial</Label>
                              <Select 
                                value={columnMapping.stock} 
                                onValueChange={(val) => setColumnMapping({...columnMapping, stock: val})}
                              >
                                <SelectTrigger className="h-9 bg-slate-50 dark:bg-muted border-none text-[10px] rounded-lg font-semibold">
                                  <SelectValue placeholder="Ninguno (Defecto: 0)" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="" className="text-xs">0 unidades</SelectItem>
                                  {bulkHeaders.map(h => (
                                    <SelectItem key={h} value={h} className="text-xs">{h}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {columnMapping.stock && (
                            <div className="space-y-1.5 border-t pt-3 border-slate-100 dark:border-slate-800">
                              <Label className="text-[9px] font-black uppercase text-slate-400 block">
                                Bodega Destino para Stock Inicial
                              </Label>
                              <Select 
                                value={selectedImportWarehouse} 
                                onValueChange={setSelectedImportWarehouse}
                              >
                                <SelectTrigger className="h-10 bg-slate-50 dark:bg-muted border-none rounded-xl text-xs font-bold">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Ninguna" className="text-xs">No asignar a Bodega (Solo registrar SKU)</SelectItem>
                                  {warehouses?.map(w => (
                                    <SelectItem key={w.id} value={w.name} className="text-xs">{w.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          {bulkImporting ? (
                            <div className="space-y-2 pt-2 animate-in fade-in">
                              <div className="flex justify-between items-center text-xs font-bold text-slate-700 dark:text-foreground">
                                <span>Cargando productos en Firestore...</span>
                                <span>{bulkImportProgress}%</span>
                              </div>
                              <div className="w-full bg-slate-100 dark:bg-muted rounded-full h-2 overflow-hidden">
                                <div 
                                  className="bg-blue-600 h-full transition-all duration-150 rounded-full" 
                                  style={{ width: `${bulkImportProgress}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <Button 
                              onClick={handleBulkImport} 
                              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold mt-2"
                              disabled={!columnMapping.sku || !columnMapping.name}
                            >
                              <CheckCircle2 size={16} className="mr-2" />
                              INICIAR IMPORTACIÓN ({bulkRows.length} ÍTEMS)
                            </Button>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Panel Derecho: Previsualización de Datos */}
                <div className="lg:col-span-7 space-y-4">
                  <Card className="border shadow-sm rounded-3xl bg-white dark:bg-card overflow-hidden">
                    <CardHeader className="p-5 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex justify-between items-center">
                        <div>
                          <CardTitle className="text-sm font-bold flex items-center gap-2">
                            <Info size={16} className="text-blue-500" /> Previsualización (Primeras 50 Filas)
                          </CardTitle>
                          <CardDescription className="text-xs">Valide la estructura antes de procesar.</CardDescription>
                        </div>
                        {bulkRows.length > 0 && (
                          <Badge className="bg-emerald-50 text-emerald-600 border border-emerald-100 font-bold">
                            {bulkRows.length} productos detectados
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <ScrollArea className="h-[550px]">
                      <Table>
                        <TableHeader className="bg-slate-50 dark:bg-muted/50 sticky top-0 z-10 shadow-sm">
                          <TableRow>
                            {bulkHeaders.map(h => (
                              <TableHead key={h} className="text-[10px] font-black uppercase whitespace-nowrap px-4 py-3">{h}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bulkRows.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={bulkHeaders.length || 1} className="text-center py-32 text-slate-400 italic text-xs">
                                Cargue un archivo CSV o Excel para ver la previsualización aquí.
                              </TableCell>
                            </TableRow>
                          ) : bulkRows.slice(0, 50).map((row, idx) => (
                            <TableRow key={idx} className="hover:bg-slate-50 dark:hover:bg-muted/30">
                              {bulkHeaders.map(h => (
                                <TableCell key={h} className="text-[11px] font-medium text-slate-700 dark:text-muted-foreground whitespace-nowrap px-4 py-2.5">
                                  {String(row[h] !== undefined ? row[h] : '')}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </Card>
                </div>
              </div>
            </TabsContent>

          </Tabs>
        </div>
      </div>
    );
}
