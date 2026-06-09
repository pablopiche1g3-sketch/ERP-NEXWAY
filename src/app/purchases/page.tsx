'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Truck, 
  ArrowLeft, 
  Search, 
  Save,
  AlertTriangle,
  FileJson,
  Loader2,
  CheckCircle2,
  FileCode,
  FileText,
  User,
  CreditCard,
  Calendar,
  ClipboardList,
  Plus,
  Trash2,
  Wallet,
  Landmark,
  Building2,
  DollarSign,
  Info,
  Link2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DteReader } from '@/components/DteReader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { ModeToggle } from '@/components/mode-toggle';

interface PurchaseItem {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  cost: number;
}

type PaymentMethod = 'Efectivo' | 'Transferencia' | 'Credito';

export default function PurchasesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('registro');
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const [pedidoId, setPedidoId] = useState('');
  const [generationCode, setGenerationCode] = useState('');
  const [docType, setDocType] = useState<'FACTURA' | 'CCF'>('FACTURA');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Efectivo');
  const [creditDays, setCreditDays] = useState<string | number>('');
  const [enteredBy, setEnteredBy] = useState('');
  const [warehouse, setWarehouse] = useState('');
  
  // Proveedor seleccionado
  const [supplierName, setSupplierName] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');

  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [skuSearch, setSkuSearch] = useState('');
  const [manualQty, setManualQty] = useState<number | string>(1);
  const [manualPrice, setManualPrice] = useState<number | string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados para datos cargados desde Supabase
  const [inventory, setInventory] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Estados para productos DTE no creados
  const [uncreatedDteProducts, setUncreatedDteProducts] = useState<any[]>([]);
  const [isUncreatedDialogOpen, setIsUncreatedDialogOpen] = useState(false);
  const [selectedUncreatedCategory, setSelectedUncreatedCategory] = useState<Record<string, string>>({});
  const [selectedUncreatedPrice, setSelectedUncreatedPrice] = useState<Record<string, string>>({});

  // Estados para vinculación de códigos de proveedor
  const [savedMappings, setSavedMappings] = useState<any[]>([]);
  const [mappingSearch, setMappingSearch] = useState('');
  const [supplierCodeInput, setSupplierCodeInput] = useState('');
  const [internalSkuInput, setInternalSkuInput] = useState('');
  const [jsonMappingsInput, setJsonMappingsInput] = useState('');
  const [savingMapping, setSavingMapping] = useState(false);
  const [savingJsonMappings, setSavingJsonMappings] = useState(false);

  // Estados para Notas de Crédito de Proveedores
  const [creditNotes, setCreditNotes] = useState<any[]>([]);
  const [loadingCreditNotes, setLoadingCreditNotes] = useState(false);
  const [parsedCreditNote, setParsedCreditNote] = useState<any | null>(null);
  const [selectedCreditNoteType, setSelectedCreditNoteType] = useState<'DEVOLUCION' | 'AJUSTE_PRECIO'>('DEVOLUCION');
  const [creditNoteSearch, setCreditNoteSearch] = useState('');
  const creditNoteFileInputRef = useRef<HTMLInputElement>(null);

  // Historial de compras
  const [purchasesHistory, setPurchasesHistory] = useState<any[]>([]);
  const [selectedPurchase, setSelectedPurchase] = useState<any | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'TODOS' | 'PENDIENTE' | 'CERRADA'>('TODOS');

  // Función para cargar los datos relacionados de forma segura
  const loadPurchasesData = async () => {
    try {
      setLoadingData(true);

      // Cargar bodegas
      let whQuery = supabase.from('warehouses').select('*');
      if (activeBranchId) {
        whQuery = whQuery.eq('branch_id', activeBranchId);
      }
      const { data: whData } = await whQuery.order('name');
      setWarehouses(whData || []);

      // Cargar proveedores
      const { data: supData } = await supabase.from('suppliers').select('*').order('name');
      setSuppliers((supData || []).map(s => ({
        id: s.id,
        name: s.name,
        nit: s.nit,
        nrc: s.nrc,
        giro: s.giro,
        email: s.email,
        phone: s.phone,
        address: s.address,
        applyRetention: s.apply_retention,
        applyPerception: s.apply_perception
      })));

      // Cargar inventario maestro y stock consolidado
      const { data: invData } = await supabase.from('inventory').select('*').order('sku');
      const { data: stockData } = await supabase.from('inventory_stock').select('*');

      const whMap: Record<string, string> = {};
      (whData || []).forEach(w => {
        whMap[w.id] = w.name;
      });

      const mappedInventory = (invData || []).map(item => {
        const itemStocks = (stockData || []).filter(s => s.sku === item.sku);
        const bodegasMap: Record<string, number> = {};
        itemStocks.forEach(s => {
          const whName = whMap[s.warehouse_id];
          if (whName) {
            bodegasMap[whName] = parseFloat(s.quantity) || 0;
          }
        });

        const totalQty = Object.values(bodegasMap).reduce((sum, val) => sum + val, 0);

        return {
          id: item.sku,
          sku: item.sku,
          name: item.name,
          category: item.category,
          price: parseFloat(item.price) || 0,
          quantity: totalQty,
          bodegas: bodegasMap
        };
      });

      setInventory(mappedInventory);

      // Cargar vinculaciones de proveedor
      const { data: mapData } = await supabase.from('supplier_mappings').select('*');
      setSavedMappings((mapData || []).map(m => ({
        supplierCode: m.supplier_code,
        internalSku: m.internal_sku
      })));

      // Cargar historial de compras
      let purchasesQuery = supabase
        .from('purchases')
        .select(`
          *,
          suppliers ( name ),
          purchase_items (
            *,
            inventory (
              name
            )
          )
        `);
      if (activeBranchId) {
        purchasesQuery = purchasesQuery.eq('branch_id', activeBranchId);
      }
      const { data: purchHistoryData } = await purchasesQuery
        .order('created_at', { ascending: false });
      setPurchasesHistory(purchHistoryData || []);

    } catch (e: any) {
      console.error('Error al cargar datos en compras:', e);
    } finally {
      setLoadingData(false);
    }
  };

  const loadCreditNotes = async () => {
    setLoadingCreditNotes(true);
    try {
      let query = supabase.from('supplier_credit_notes').select('*, suppliers(*)');
      if (activeBranchId) {
        query = query.eq('branch_id', activeBranchId);
      }
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      setCreditNotes(data || []);
    } catch (e: any) {
      console.error('Error al cargar notas de crédito:', e);
    } finally {
      setLoadingCreditNotes(false);
    }
  };

  const handleSaveManualMapping = async () => {
    if (!supplierCodeInput.trim() || !internalSkuInput.trim()) return;
    setSavingMapping(true);
    try {
      const code = supplierCodeInput.trim().toUpperCase();
      const sku = internalSkuInput.trim().toUpperCase();
      const { error } = await supabase.from('supplier_mappings').upsert({
        supplier_code: code,
        internal_sku: sku
      });
      if (error) throw error;
      toast({ title: 'Vínculo guardado', description: `Se vinculó ${code} con ${sku}` });
      setSupplierCodeInput('');
      setInternalSkuInput('');
      
      const { data } = await supabase.from('supplier_mappings').select('*');
      setSavedMappings((data || []).map(m => ({
        supplierCode: m.supplier_code,
        internalSku: m.internal_sku
      })));
    } catch (err: any) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: err.message || 'No se pudo guardar la vinculación' });
    } finally {
      setSavingMapping(false);
    }
  };

  const handleDeleteMapping = async (supplierCode: string) => {
    try {
      const { error } = await supabase.from('supplier_mappings').delete().eq('supplier_code', supplierCode);
      if (error) throw error;
      toast({ title: 'Vínculo eliminado', description: `Se eliminó el vínculo del código ${supplierCode}` });
      setSavedMappings(prev => prev.filter(m => m.supplierCode !== supplierCode));
    } catch (err: any) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: err.message || 'No se pudo eliminar la vinculación' });
    }
  };

  const handleSaveJsonMappings = async () => {
    if (!jsonMappingsInput.trim()) return;
    setSavingJsonMappings(true);
    try {
      const parsed = JSON.parse(jsonMappingsInput);
      if (!Array.isArray(parsed)) throw new Error('El JSON debe ser un arreglo de objetos');
      const rows = parsed.map(item => {
        if (!item.supplier_code || !item.internal_sku) {
          throw new Error('Cada objeto debe tener supplier_code e internal_sku');
        }
        return {
          supplier_code: item.supplier_code.toString().trim().toUpperCase(),
          internal_sku: item.internal_sku.toString().trim().toUpperCase()
        };
      });
      const { error } = await supabase.from('supplier_mappings').upsert(rows);
      if (error) throw error;
      toast({ title: 'Vínculos importados', description: `Se importaron ${rows.length} equivalencias` });
      setJsonMappingsInput('');
      const { data } = await supabase.from('supplier_mappings').select('*');
      setSavedMappings((data || []).map(m => ({
        supplierCode: m.supplier_code,
        internalSku: m.internal_sku
      })));
    } catch (err: any) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: err.message || 'Error al importar JSON' });
    } finally {
      setSavingJsonMappings(false);
    }
  };

  const handleCreateUncreatedProduct = async (productIndex: number) => {
    const p = uncreatedDteProducts[productIndex];
    const category = selectedUncreatedCategory[p.sku] || 'Inventario de Mercadería';
    const priceVal = parseFloat(selectedUncreatedPrice[p.sku] || '0') || (p.cost * 1.3); // default PVP is Cost * 1.3

    try {
      const existingProduct = inventory.find(inv => inv.sku === p.sku.trim().toUpperCase());

      if (existingProduct) {
        // If the SKU already exists, we just create the supplier mapping!
        if (p.originalProviderCode) {
          const { error: mappingError } = await supabase
            .from('supplier_mappings')
            .upsert({
              supplier_code: p.originalProviderCode,
              internal_sku: existingProduct.sku
            });
          if (mappingError) throw mappingError;

          // Update local saved mappings
          setSavedMappings(prev => {
            const exists = prev.some(m => m.supplierCode === p.originalProviderCode);
            if (exists) {
              return prev.map(m => m.supplierCode === p.originalProviderCode ? { ...m, internalSku: existingProduct.sku } : m);
            }
            return [...prev, { supplierCode: p.originalProviderCode, internalSku: existingProduct.sku }];
          });
        }

        // Add to cart using the existing product details
        setPurchaseItems(prev => {
          const existing = prev.find(item => item.sku === existingProduct.sku);
          if (existing) {
            return prev.map(item => 
              item.sku === existingProduct.sku ? { ...item, quantity: item.quantity + p.quantity, cost: p.cost } : item
            );
          }
          return [...prev, {
            id: existingProduct.id,
            sku: existingProduct.sku,
            name: existingProduct.name,
            quantity: p.quantity,
            cost: p.cost
          }];
        });

        toast({ 
          title: "Vínculo Sincronizado", 
          description: `Se vinculó el código del proveedor ${p.originalProviderCode} al SKU existente ${existingProduct.sku}.` 
        });
      } else {
        // If it doesn't exist, proceed with inserting the new product in inventory
        const { data, error } = await supabase
          .from('inventory')
          .insert({
            sku: p.sku,
            name: p.name,
            category: category,
            price: priceVal
          })
          .select()
          .single();

        if (error) throw error;

        // 2. Insert equivalence in public.supplier_mappings
        if (p.originalProviderCode) {
          const { error: mappingError } = await supabase
            .from('supplier_mappings')
            .upsert({
              supplier_code: p.originalProviderCode,
              internal_sku: p.sku
            });
          if (mappingError) throw mappingError;

          setSavedMappings(prev => {
            const exists = prev.some(m => m.supplierCode === p.originalProviderCode);
            if (exists) {
              return prev.map(m => m.supplierCode === p.originalProviderCode ? { ...m, internalSku: p.sku } : m);
            }
            return [...prev, { supplierCode: p.originalProviderCode, internalSku: p.sku }];
          });
        }

        // 3. Add to local inventory state
        const newInventoryItem = {
          id: p.sku,
          sku: p.sku,
          name: p.name,
          category: category,
          price: priceVal,
          quantity: 0,
          bodegas: {}
        };
        setInventory(prev => [...prev, newInventoryItem]);

        // 3. Add to cart
        setPurchaseItems(prev => {
          const existing = prev.find(item => item.sku === p.sku);
          if (existing) {
            return prev.map(item => 
              item.sku === p.sku ? { ...item, quantity: item.quantity + p.quantity, cost: p.cost } : item
            );
          }
          return [...prev, {
            id: p.sku,
            sku: p.sku,
            name: p.name,
            quantity: p.quantity,
            cost: p.cost
          }];
        });

        toast({ 
          title: "Producto Creado", 
          description: `El código ${p.sku} se creó y vinculó a la cuenta '${category}'.` 
        });
      }

      // Remove from queue
      const updatedQueue = uncreatedDteProducts.filter((_, idx) => idx !== productIndex);
      setUncreatedDteProducts(updatedQueue);

      if (updatedQueue.length === 0) {
        setIsUncreatedDialogOpen(false);
      }
    } catch (err: any) {
      console.error(err);
      toast({ 
        variant: "destructive", 
        title: "Error al registrar", 
        description: err.message || "No se pudo vincular el producto." 
      });
    }
  };

  // Cargar datos en el montaje
  useEffect(() => {
    // Carga inicial manejada por activeBranchId useEffect
  }, []);

  // Manejar cambios de sucursal activa
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

  useEffect(() => {
    loadPurchasesData();
    loadCreditNotes();
  }, [activeBranchId]);

  const handleCreditNoteJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const id = json.identificacion || {};
        const emi = json.emisor || {};
        const res = json.resumen || {};
        const rawItems = json.cuerpoDocumento || [];

        // Match supplier
        const matchedSup = suppliers.find(s => 
          (s.nit && s.nit.replace(/-/g, '') === (emi.nit || '').replace(/-/g, '')) ||
          (s.name && s.name.toLowerCase() === (emi.nombre || '').toLowerCase())
        );

        const items = rawItems.map((item: any) => ({
          sku: item.codigo || 'S/N',
          name: item.descripcion || 'Sin Descripción',
          quantity: parseFloat(item.cantidad) || 0,
          price: parseFloat(item.precioUni) || 0,
          total: parseFloat(item.ventaGravada || item.compraGravada) || (parseFloat(item.cantidad) * parseFloat(item.precioUni)) || 0
        }));

        setParsedCreditNote({
          documentNumber: id.numeroControl || id.codigoGeneracion || `CN-${Date.now()}`,
          supplierId: matchedSup ? matchedSup.id : null,
          supplierName: matchedSup ? matchedSup.name : (emi.nombre || 'Proveedor Desconocido'),
          supplierNit: emi.nit || '',
          total: parseFloat(res.totalPagar || res.montoTotalOperacion || res.subTotal || 0),
          items: items
        });

        toast({ title: "JSON Cargado", description: "La Nota de Crédito se importó correctamente. Por favor revise el desglose antes de guardar." });
      } catch (err: any) {
        console.error(err);
        toast({ variant: "destructive", title: "Error al leer JSON", description: err.message || "Formato de DTE nota de crédito inválido." });
      }
    };
    reader.readAsText(file);
  };

  const handleSaveCreditNote = async () => {
    if (!parsedCreditNote) return;
    setLoading(true);
    try {
      let sId = parsedCreditNote.supplierId;
      if (!sId) {
        const sup = suppliers.find(s => s.nit === parsedCreditNote.supplierNit);
        if (sup) {
          sId = sup.id;
        } else {
          toast({ variant: "destructive", title: "Proveedor no registrado", description: "Debe registrar el proveedor con el NIT del DTE." });
          setLoading(false);
          return;
        }
      }

      const { error } = await supabase
        .from('supplier_credit_notes')
        .insert({
          supplier_id: sId,
          document_number: parsedCreditNote.documentNumber,
          type: selectedCreditNoteType,
          total: parsedCreditNote.total,
          items: parsedCreditNote.items,
          branch_id: activeBranchId || null
        });

      if (error) throw error;
      toast({ title: "Nota de Crédito Registrada", description: "Se aplicó con éxito la nota de crédito." });
      setParsedCreditNote(null);
      if (creditNoteFileInputRef.current) creditNoteFileInputRef.current.value = '';
      await loadCreditNotes();
    } catch (err: any) {
      console.error(err);
      toast({ variant: "destructive", title: "Error al guardar", description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const filteredSuppliers = useMemo(() => {
    if (!suppliers) return [];
    return suppliers.filter(s => 
      s.name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
      (s.nit && s.nit.toLowerCase().includes(supplierSearch.toLowerCase()))
    );
  }, [supplierSearch, suppliers]);

  useEffect(() => {
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randPart = Math.floor(1000 + Math.random() * 9000);
    setPedidoId(`ORD-${datePart}-${randPart}`);
  }, []);

  const subtotalPurchase = useMemo(() => 
    purchaseItems.reduce((acc, item) => acc + (item.cost * item.quantity), 0), [purchaseItems]
  );

  const ivaPurchase = useMemo(() => subtotalPurchase * 0.13, [subtotalPurchase]);

  const totalPurchase = useMemo(() => subtotalPurchase * 1.13, [subtotalPurchase]);

  const handleAddItem = async () => {
    if (!skuSearch) return;
    
    const product = inventory?.find((p: any) => p.sku === skuSearch.toUpperCase());
    const qty = parseInt(manualQty.toString()) || 0;
    const price = parseFloat(manualPrice.toString()) || 0;
    
    if (!product) {
      toast({ 
        variant: "destructive", 
        title: "Código no autorizado", 
        description: "El SKU no existe en el inventario maestro." 
      });
      return;
    }

    if (qty <= 0) {
      toast({ variant: "destructive", title: "Error", description: "La cantidad debe ser mayor a 0." });
      return;
    }

    if (price <= 0) {
      toast({ variant: "destructive", title: "Error", description: "El precio de compra debe ser mayor a 0." });
      return;
    }

    const existing = purchaseItems.find(item => item.sku === product.sku);
    if (existing) {
      setPurchaseItems(prev => prev.map(item => 
        item.sku === product.sku ? { ...item, quantity: item.quantity + qty, cost: price } : item
      ));
    } else {
      setPurchaseItems(prev => [...prev, {
        id: product.id,
        sku: product.sku,
        name: product.name,
        quantity: qty,
        cost: price
      }]);
    }

    setSkuSearch('');
    setManualQty(1);
    setManualPrice('');
    toast({ title: "Producto Añadido", description: `${product.name} agregado a la lista.` });
  };

  const removeItem = (sku: string) => {
    setPurchaseItems(prev => prev.filter(item => item.sku !== sku));
  };

  const loadDraftPurchase = async (p: any) => {
    try {
      setLoading(true);
      const whName = warehouses.find(w => w.id === p.warehouse_id)?.name || '';
      const provName = p.suppliers?.name || p.supplier_name || '';

      setEditingPurchaseId(p.id);
      setPedidoId(p.order_id || '');
      setSupplierName(provName);
      setEnteredBy(p.entered_by || '');
      setWarehouse(whName);
      setPaymentMethod(p.payment_method || 'Efectivo');
      setCreditDays(p.credit_days || '');
      setDocType(p.document_type || 'FACTURA');
      setGenerationCode(p.document_number || '');
      
      const mappedItems = (p.purchase_items || []).map((item: any) => {
        const prod = inventory.find(i => i.sku === item.sku);
        return {
          id: prod ? prod.id : item.sku,
          sku: item.sku,
          name: prod ? prod.name : 'Desconocido',
          quantity: item.quantity,
          cost: item.cost
        };
      });
      setPurchaseItems(mappedItems);
      setActiveTab('registro');
      toast({ title: 'Borrador cargado', description: 'El borrador se cargó para editar.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cargar el borrador.' });
    } finally {
      setLoading(false);
      setIsDetailsDialogOpen(false);
    }
  };

  const savePurchase = async (status: 'PENDIENTE' | 'CERRADA') => {
    if (purchaseItems.length === 0) {
      toast({ variant: "destructive", title: "Error", description: "No hay productos en la compra." });
      return;
    }
    if (!enteredBy) {
      toast({ variant: "destructive", title: "Encargado Requerido", description: "Por favor ingrese su nombre." });
      return;
    }
    if (!warehouse) {
      toast({ variant: "destructive", title: "Bodega Requerida", description: "Seleccione una bodega de destino." });
      return;
    }
    if (!supplierName) {
      toast({ variant: "destructive", title: "Proveedor Requerido", description: "Debe seleccionar un proveedor." });
      return;
    }

    setLoading(true);
    try {
      const selectedSup = suppliers.find(s => s.name === supplierName);
      const selectedWh = warehouses.find(w => w.name === warehouse);

      if (!selectedWh) {
        toast({ variant: 'destructive', title: 'Error', description: 'Bodega de destino no encontrada.' });
        setLoading(false);
        return;
      }

      let purchaseIdToUse = editingPurchaseId;

      if (editingPurchaseId) {
        // ACTUALIZAR BORRADOR EXISTENTE
        const { data: updatedPurch, error: purchErr } = await supabase
          .from('purchases')
          .update({
            supplier_id: selectedSup ? selectedSup.id : null,
            entered_by: enteredBy,
            warehouse_id: selectedWh.id,
            total: totalPurchase,
            status: status,
            payment_method: paymentMethod,
            credit_days: paymentMethod === 'Credito' ? (parseInt(creditDays.toString()) || 0) : null,
            payment_status: paymentMethod === 'Credito' && status === 'CERRADA' ? 'PENDIENTE' : (paymentMethod === 'Credito' ? null : 'PAGADO'),
            document_type: docType,
            document_number: generationCode,
            branch_id: activeBranchId || null
          })
          .eq('id', editingPurchaseId)
          .select()
          .single();

        if (purchErr) throw purchErr;
        
        // Eliminar items anteriores
        await supabase.from('purchase_items').delete().eq('purchase_id', editingPurchaseId);
        
      } else {
        // CREAR NUEVO
        const { data: insertedPurch, error: purchErr } = await supabase
          .from('purchases')
          .insert({
            order_id: pedidoId,
            supplier_id: selectedSup ? selectedSup.id : null,
            entered_by: enteredBy,
            warehouse_id: selectedWh.id,
            total: totalPurchase,
            status: status,
            payment_method: paymentMethod,
            credit_days: paymentMethod === 'Credito' ? (parseInt(creditDays.toString()) || 0) : null,
            payment_status: paymentMethod === 'Credito' && status === 'CERRADA' ? 'PENDIENTE' : (paymentMethod === 'Credito' ? null : 'PAGADO'),
            document_type: docType,
            document_number: generationCode,
            branch_id: activeBranchId || null
          })
          .select()
          .single();

        if (purchErr) throw purchErr;
        purchaseIdToUse = insertedPurch.id;
      }

      // 2. Insert items into public.purchase_items
      const itemsToInsert = purchaseItems.map(item => ({
        purchase_id: purchaseIdToUse,
        sku: item.sku,
        quantity: item.quantity,
        cost: item.cost,
        subtotal: item.quantity * item.cost
      }));

      const { error: itemsErr } = await supabase
        .from('purchase_items')
        .insert(itemsToInsert);

      if (itemsErr) throw itemsErr;

      // 3. Update stock if status === 'CERRADA'
      if (status === 'CERRADA') {
        for (const item of purchaseItems) {
          const currentProduct = inventory.find(p => p.sku === item.sku);
          const currentWhStock = currentProduct ? (currentProduct.bodegas[warehouse] || 0) : 0;
          const newQty = currentWhStock + item.quantity;

          const { error: stockErr } = await supabase
            .from('inventory_stock')
            .upsert({
              sku: item.sku,
              warehouse_id: selectedWh.id,
              quantity: newQty
            }, {
              onConflict: 'sku,warehouse_id'
            });

          if (stockErr) throw stockErr;
        }
        toast({ title: "Compra Cerrada", description: `Stock actualizado en la bodega '${warehouse}' de forma exitosa.` });
      } else {
        toast({ title: "Borrador Guardado", description: "La compra está pendiente. El stock NO ha sido afectado." });
      }

      setPurchaseItems([]);
      setGenerationCode('');
      setEnteredBy('');
      setSupplierName('');
      setPaymentMethod('Efectivo');
      setCreditDays('');
      setEditingPurchaseId(null);
      const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randPart = Math.floor(1000 + Math.random() * 9000);
      setPedidoId(`ORD-${datePart}-${randPart}`);
      await loadPurchasesData();

    } catch (error: any) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: error.message || "No se pudo procesar la compra." });
    } finally {
      setLoading(false);
    }
  };

  const selectSupplier = (supplier: any) => {
    setSupplierName(supplier.name);
    toast({ title: "Proveedor Seleccionado", description: `${supplier.name} cargado correctamente.` });
  };
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        let itemsToLoad: any[] = [];
        let uncreated: any[] = [];
        let detectedCount = 0;

        if (json.identificacion && json.emisor && json.cuerpoDocumento) {
          setSupplierName(json.emisor.nombre || '');
          const dteGen = json.identificacion.codigoGeneracion || '';
          const dteCtrl = json.identificacion.numeroControl || '';
          setGenerationCode(dteCtrl ? `${dteCtrl} | ${dteGen}` : dteGen);
          setDocType(json.identificacion.tipoDte === '03' ? 'CCF' : 'FACTURA');
          
          json.cuerpoDocumento?.forEach((item: any) => {
            const rawCode = (item.codigo || '').toUpperCase();
            const mapping = savedMappings.find(m => m.supplierCode === rawCode);
            const resolvedSku = mapping ? mapping.internalSku : rawCode;

            const product = inventory?.find((p: any) => 
              p.sku === resolvedSku || 
              p.name.toLowerCase() === (item.descripcion || '').toLowerCase()
            );

            if (product) {
              itemsToLoad.push({
                id: product.id,
                sku: product.sku,
                name: product.name,
                quantity: parseFloat(item.cantidad || item.quantity) || 0,
                cost: parseFloat(item.precioUni || item.precioUnitario) || 0
              });
              detectedCount++;
            } else {
              uncreated.push({
                sku: resolvedSku || `TEMP-${Date.now().toString().slice(-4)}`,
                originalProviderCode: rawCode,
                name: item.descripcion || 'Producto sin nombre',
                quantity: parseFloat(item.cantidad || item.quantity) || 0,
                cost: parseFloat(item.precioUni || item.precioUnitario) || 0
              });
            }
          });
          
          if (uncreated.length > 0) {
            setUncreatedDteProducts(uncreated);
            setIsUncreatedDialogOpen(true);
            toast({
              title: "DTE V3 con Códigos Pendientes",
              description: `Se encontraron ${uncreated.length} productos sin registrar en el inventario maestro.`
            });
          } else {
            toast({ title: "DTE V3 Detectado", description: `Se identificó proveedor y ${detectedCount} productos compatibles.` });
          }
        } 
        else if (Array.isArray(json)) {
          json.forEach(item => {
            const rawCode = (item.sku || item.codigo || '').toUpperCase();
            const mapping = savedMappings.find(m => m.supplierCode === rawCode);
            const resolvedSku = mapping ? mapping.internalSku : rawCode;

            const product = inventory?.find((p: any) => p.sku === resolvedSku);
            if (product) {
              itemsToLoad.push({
                id: product.id,
                sku: product.sku,
                name: product.name,
                quantity: parseFloat(item.cantidad || item.quantity) || 0,
                cost: parseFloat(item.precioUni || item.precioUnitario || item.price || item.cost) || 0
              });
              detectedCount++;
            } else {
              uncreated.push({
                sku: resolvedSku || `TEMP-${Date.now().toString().slice(-4)}`,
                originalProviderCode: rawCode,
                name: item.name || item.descripcion || 'Producto sin nombre',
                quantity: parseFloat(item.cantidad || item.quantity) || 0,
                cost: parseFloat(item.precioUni || item.precioUnitario || item.price || item.cost) || 0
              });
            }
          });
          
          if (uncreated.length > 0) {
            setUncreatedDteProducts(uncreated);
            setIsUncreatedDialogOpen(true);
          } else {
            toast({ title: "JSON Cargado", description: `Se añadieron ${detectedCount} productos compatibles.` });
          }
        } else {
          toast({ variant: "destructive", title: "Formato Desconocido", description: "El archivo no coincide con el estándar DTE V3 de El Salvador." });
          return;
        }

        if (itemsToLoad.length > 0) {
          setPurchaseItems(prev => {
            const newList = [...prev];
            itemsToLoad.forEach(newItem => {
              const idx = newList.findIndex(i => i.sku === newItem.sku);
              if (idx > -1) {
                newList[idx].quantity += newItem.quantity;
                newList[idx].cost = newItem.cost;
              } else {
                newList.push(newItem);
              }
            });
            return newList;
          });
        }
      } catch (err) {
        toast({ variant: "destructive", title: "Error", description: "No se pudo leer el archivo JSON." });
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-transparent p-4 md:p-6 transition-colors duration-300 relative overflow-hidden">
<div className="relative z-10 max-w-7xl mx-auto mb-6 bg-white/5 dark:bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 md:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="w-10 h-10 rounded-xl bg-white/5 dark:bg-white/5 border border-white/10 hover:bg-white/10 dark:hover:bg-white/10" onClick={() => router.push('/')}>
            <ArrowLeft className="text-slate-800 dark:text-slate-300" size={18} />
          </Button>
          <div>
            <h1 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white font-headline leading-tight">Módulo de Compras</h1>
            <p className="text-slate-500 dark:text-white/40 text-[11px] md:text-xs">Registro de compra operativa con soporte Hacienda DTE V3</p>
          </div>
        </div>
        <ModeToggle />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="max-w-7xl mx-auto space-y-6 relative z-10">
        <TabsList className="bg-transparent p-0 border-b border-white/10 w-full justify-start h-auto rounded-none gap-2">
          <TabsTrigger value="registro" className="rounded-none px-4 py-3 font-medium text-[12.5px] text-slate-500 dark:text-white/40 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-[#7c7fff] data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 dark:data-[state=active]:border-[#5b5ef4] data-[state=active]:bg-indigo-500/10 dark:data-[state=active]:bg-indigo-500/10 hover:text-slate-800 dark:hover:text-white/70 transition-colors shadow-none data-[state=active]:shadow-none border-b-2 border-t border-white/10ransparent">
            <ClipboardList size={14} className="mr-2" /> Registro de Compra
          </TabsTrigger>
          <TabsTrigger value="historial" className="rounded-none px-4 py-3 font-medium text-[12.5px] text-slate-500 dark:text-white/40 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-[#7c7fff] data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 dark:data-[state=active]:border-[#5b5ef4] data-[state=active]:bg-indigo-500/10 dark:data-[state=active]:bg-indigo-500/10 hover:text-slate-800 dark:hover:text-white/70 transition-colors shadow-none data-[state=active]:shadow-none border-b-2 border-t border-white/10ransparent">
            <Calendar size={14} className="mr-2" /> Historial de Ingresos
          </TabsTrigger>
          <TabsTrigger value="vinculacion" className="rounded-none px-4 py-3 font-medium text-[12.5px] text-slate-500 dark:text-white/40 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-[#7c7fff] data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 dark:data-[state=active]:border-[#5b5ef4] data-[state=active]:bg-indigo-500/10 dark:data-[state=active]:bg-indigo-500/10 hover:text-slate-800 dark:hover:text-white/70 transition-colors shadow-none data-[state=active]:shadow-none border-b-2 border-t border-white/10ransparent">
            <Link2 size={14} className="mr-2" /> Vinculación de Códigos
          </TabsTrigger>
          <TabsTrigger value="credito" className="rounded-none px-4 py-3 font-medium text-[12.5px] text-slate-500 dark:text-white/40 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-[#7c7fff] data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 dark:data-[state=active]:border-[#5b5ef4] data-[state=active]:bg-indigo-500/10 dark:data-[state=active]:bg-indigo-500/10 hover:text-slate-800 dark:hover:text-white/70 transition-colors shadow-none data-[state=active]:shadow-none border-b-2 border-t border-white/10ransparent">
            <FileText size={14} className="mr-2" /> Notas de Crédito
          </TabsTrigger>
        </TabsList>

        <TabsContent value="registro" className="space-y-6 outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            <div className="lg:col-span-4 space-y-6">
              <div className="flex flex-col gap-2.5">
                <div className="rounded-t-[11px] p-[13px_16px] flex items-center justify-between bg-indigo-500/25 border border-indigo-500/35 border-b-0">
                  <div className="flex items-center gap-2 text-[13px] font-semibold text-[#a5a8ff]">
                    <ClipboardList size={15} /> Control de Pedido
                  </div>
                  <span className="text-[10px] text-white/35 font-mono tracking-[0.5px]">{pedidoId}</span>
                </div>
                
                <div className="rounded-b-[11px] p-4 flex flex-col gap-3.5 bg-white/5 backdrop-blur-md border border-white/10 mt-[-10px]">
                  <div>
                    <div className="text-[10px] font-medium uppercase tracking-[0.7px] text-white/30 mb-1.5">Proveedor</div>
                    <div className="flex gap-2">
                      <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg p-[9px_12px] flex-1 relative">
                        <Building2 size={14} className="text-white/20" />
                        <Input 
                          placeholder="Seleccione proveedor..." 
                          value={supplierName}
                          onChange={e => setSupplierName(e.target.value)}
                          className="h-full bg-transparent border-none text-[12.5px] text-white/70 p-0 shadow-none focus-visible:ring-0 placeholder:text-white/20"
                        />
                      </div>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-[40px] w-[40px] rounded-lg bg-white/5 border border-white/10 text-white/20 hover:bg-white/10 hover:text-white/40">
                            <Search size={14} />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-0 border-white/10 bg-[#0a0a14]" align="end">
                          <div className="p-3 border-b border-white/10"><Input placeholder="Buscar proveedor..." value={supplierSearch} onChange={e => setSupplierSearch(e.target.value)} className="h-8 text-xs bg-white/5 border-none text-white placeholder:text-white/30" /></div>
                          <ScrollArea className="h-60">
                            <div className="p-1">
                              {filteredSuppliers.length === 0 ? (
                                <div className="p-4 text-center text-white/30 text-[10px] italic">No se encontraron proveedores</div>
                              ) : filteredSuppliers.map((s: any) => (
                                <div key={s.id} onClick={() => selectSupplier(s)} className="p-3 hover:bg-white/5 cursor-pointer rounded-lg transition-colors group">
                                  <span className="text-[11px] font-bold text-white group-hover:text-indigo-400 block">{s.name}</span>
                                  <span className="text-[9px] text-white/30 font-mono">NIT: {s.nit}</span>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-medium uppercase tracking-[0.7px] text-white/30 mb-1.5">Encargado de ingreso</div>
                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg p-[9px_12px]">
                      <User size={14} className="text-white/20" />
                      <Input 
                        placeholder="Nombre completo..." 
                        value={enteredBy}
                        onChange={e => setEnteredBy(e.target.value)}
                        className="h-full bg-transparent border-none text-[12.5px] text-white/70 p-0 shadow-none focus-visible:ring-0 placeholder:text-white/20"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-[10px] font-medium uppercase tracking-[0.7px] text-white/30 mb-1.5">Tipo documento</div>
                      <Select value={docType} onValueChange={(v: any) => setDocType(v)}>
                        <SelectTrigger className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg p-[9px_12px] h-[40px] text-[12.5px] text-white/60 shadow-none">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-white/10 bg-[#0a0a14] text-white">
                          <SelectItem value="FACTURA">FACTURA</SelectItem>
                          <SelectItem value="CCF">CCF</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <div className="text-[10px] font-medium uppercase tracking-[0.7px] text-white/30 mb-1.5">Bodega destino</div>
                      <Select value={warehouse} onValueChange={setWarehouse}>
                        <SelectTrigger className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg p-[9px_12px] h-[40px] text-[12.5px] text-white/60 shadow-none">
                          <SelectValue placeholder="Seleccione..." />
                        </SelectTrigger>
                        <SelectContent className="border-white/10 bg-[#0a0a14] text-white">
                          {warehouses?.map((wh: any) => (
                            <SelectItem key={wh.id} value={wh.name}>{wh.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-medium uppercase tracking-[0.7px] text-white/30 mb-1.5">DTE / Cód. Generación</div>
                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg p-[9px_12px]">
                      <FileCode size={14} className="text-white/20" />
                      <Input 
                        placeholder="GEN-123456..." 
                        value={generationCode}
                        onChange={e => setGenerationCode(e.target.value)}
                        className="h-full bg-transparent border-none text-[12.5px] font-mono text-white/70 p-0 shadow-none focus-visible:ring-0 placeholder:text-white/20"
                      />
                    </div>
                  </div>

                  <div className="h-[1px] bg-white/5" />

                  <div>
                    <div className="text-[10px] font-medium uppercase tracking-[0.7px] text-white/30 mb-1.5">Forma de pago</div>
                    <div className="flex gap-1.5">
                      <button onClick={() => setPaymentMethod('Efectivo')} className={`flex items-center gap-1.5 p-[7px_12px] rounded-lg text-[11.5px] font-medium transition-all ${paymentMethod === 'Efectivo' ? 'bg-indigo-500/25 border border-indigo-500/50 text-[#7c7fff]' : 'bg-white/5 border border-white/10 text-white/45 hover:bg-white/10'}`}>
                        <Wallet size={13} /> Efectivo
                      </button>
                      <button onClick={() => setPaymentMethod('Transferencia')} className={`flex items-center gap-1.5 p-[7px_12px] rounded-lg text-[11.5px] font-medium transition-all ${paymentMethod === 'Transferencia' ? 'bg-indigo-500/25 border border-indigo-500/50 text-[#7c7fff]' : 'bg-white/5 border border-white/10 text-white/45 hover:bg-white/10'}`}>
                        <Landmark size={13} /> Transf.
                      </button>
                      <button onClick={() => setPaymentMethod('Credito')} className={`flex items-center gap-1.5 p-[7px_12px] rounded-lg text-[11.5px] font-medium transition-all ${paymentMethod === 'Credito' ? 'bg-indigo-500/25 border border-indigo-500/50 text-[#7c7fff]' : 'bg-white/5 border border-white/10 text-white/45 hover:bg-white/10'}`}>
                        <CreditCard size={13} /> Crédito
                      </button>
                    </div>
                    {paymentMethod === 'Credito' && (
                       <div className="mt-3 flex items-center gap-2 animate-in fade-in">
                         <div className="text-[10px] font-medium uppercase tracking-[0.7px] text-indigo-400">Plazo:</div>
                         <Input type="number" value={creditDays} onFocus={e => e.target.select()} onChange={e => setCreditDays(e.target.value)} className="h-[30px] w-20 bg-white/5 border-white/10 text-[11.5px] text-white placeholder:text-white/30" placeholder="0" />
                         <div className="text-[10px] font-medium uppercase tracking-[0.7px] text-white/30">Días</div>
                       </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-[11px] p-[14px_16px] bg-white/5 backdrop-blur-md border border-white/10">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="text-[10px] font-medium uppercase tracking-[0.7px] text-white/30">Cargar DTE V3</div>
                  <Popover>
                    <PopoverTrigger asChild><Info size={14} className="text-white/20 hover:text-white/40 cursor-pointer" /></PopoverTrigger>
                    <PopoverContent className="w-64 text-[10px] space-y-2 border-white/10 bg-[#0a0a14] text-white">
                       <p className="font-bold text-indigo-400">Hacienda El Salvador V3:</p>
                       <p className="text-white/60">Extrae automáticamente proveedor, códigos de productos, cantidades y precios directamente desde el archivo oficial del Ministerio.</p>
                    </PopoverContent>
                  </Popover>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept=".json" />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full p-[11px] rounded-xl bg-white/5 border border-white/10 text-white/65 hover:bg-white/10 text-[12.5px] font-semibold flex items-center justify-center gap-2 tracking-[0.3px] transition-all"
                >
                  <FileJson size={15} className="text-[#7c7fff]" />
                  <div className="text-center">
                    <div>IMPORTAR DTE V3 (JSON)</div>
                    <span className="block text-[10px] font-normal text-white/30 mt-0.5">Soporta Ministerio de Hacienda SV</span>
                  </div>
                </button>
                
                <div className="h-[1px] bg-white/5 my-3" />
                
                <div className="text-[10px] font-medium uppercase tracking-[0.7px] text-white/30 mb-2.5">Agregar manualmente</div>
                <div className="grid grid-cols-[1fr_60px_80px] gap-1.5 mb-2">
                  <Input placeholder="SKU..." value={skuSearch} onChange={e => setSkuSearch(e.target.value.toUpperCase())} className="bg-white/5 border-white/10 rounded-lg p-[8px_10px] text-[12px] text-white/70 h-[36px]" />
                  <Input type="number" value={manualQty} onFocus={e => e.target.select()} onChange={e => setManualQty(e.target.value === '' ? '' : (parseInt(e.target.value) || 0))} className="bg-white/5 border-white/10 rounded-lg p-[8px_10px] text-[12px] text-white/70 text-center h-[36px]" />
                  <Input type="number" placeholder="0.00" value={manualPrice} onFocus={e => e.target.select()} onChange={e => setManualPrice(e.target.value)} className="bg-white/5 border-white/10 rounded-lg p-[8px_10px] text-[12px] text-emerald-400 text-right h-[36px]" />
                </div>
                <div className="grid grid-cols-[60px_60px_1fr] gap-1.5 mb-2.5 px-1">
                  <div className="text-[9px] text-white/25 uppercase tracking-[0.5px]">SKU</div>
                  <div className="text-[9px] text-white/25 uppercase tracking-[0.5px]">Cant.</div>
                  <div className="text-[9px] text-white/25 uppercase tracking-[0.5px]">Costo</div>
                </div>
                <button onClick={handleAddItem} className="w-full p-[9px] rounded-lg bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 hover:text-white/70 text-[12px] font-medium flex items-center justify-center gap-1.5 transition-all">
                  <Plus size={14} className="text-white/30" /> Añadir a la Lista
                </button>
              </div>
        </div>

        <div className="lg:col-span-8 flex flex-col gap-2.5">
          <div className="rounded-[11px] bg-white/5 backdrop-blur-md border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between p-[12px_18px] gap-4">
            <div className="flex items-center gap-3 text-white">
              <div className="text-[13px] font-semibold">Ítems del Pedido</div>
              <span className="bg-indigo-500/20 text-[#a5a8ff] text-[10px] font-mono p-[2px_8px] rounded-full border border-indigo-500/30">{purchaseItems.length} ítems</span>
            </div>
            
            <div className="flex gap-6 text-right">
              <div>
                <div className="text-[9px] font-medium uppercase tracking-[0.5px] text-white/40 mb-0.5">Subtotal</div>
                <div className="text-[12.5px] font-bold text-white/90">${subtotalPurchase.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-[9px] font-medium uppercase tracking-[0.5px] text-white/40 mb-0.5">IVA (13%)</div>
                <div className="text-[12.5px] font-bold text-white/90">${ivaPurchase.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-[9px] font-medium uppercase tracking-[0.5px] text-white/40 mb-0.5">Total Neto</div>
                <div className="text-[16px] font-black text-[#63e2b7] tracking-[0.5px]">${totalPurchase.toFixed(2)}</div>
              </div>
            </div>
          </div>

          <div className="rounded-[11px] bg-white/5 backdrop-blur-md border border-white/10 h-[450px] flex flex-col overflow-hidden">
            <ScrollArea className="flex-1">
              <Table>
                <TableHeader className="sticky top-0 bg-[#161430]/90 backdrop-blur-sm z-10">
                  <TableRow className="border-b border-white/10 hover:bg-transparent">
                    <TableHead className="text-[10px] font-semibold text-white/40 uppercase tracking-[0.5px] h-[36px] px-4">SKU</TableHead>
                    <TableHead className="text-[10px] font-semibold text-white/40 uppercase tracking-[0.5px] h-[36px]">Producto</TableHead>
                    <TableHead className="text-[10px] font-semibold text-white/40 uppercase tracking-[0.5px] h-[36px] text-center">Cant.</TableHead>
                    <TableHead className="text-[10px] font-semibold text-white/40 uppercase tracking-[0.5px] h-[36px] text-right">Costo (S/C)</TableHead>
                    <TableHead className="text-[10px] font-semibold text-white/40 uppercase tracking-[0.5px] h-[36px] text-right">Subtotal</TableHead>
                    <TableHead className="w-[40px] h-[36px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchaseItems.length === 0 ? (
                    <TableRow className="border-b border-white/5 hover:bg-transparent">
                      <TableCell colSpan={6} className="text-center py-24 text-white/30 italic text-[11px]">
                        No hay productos seleccionados. Importe un DTE V3 o agréguelos manualmente.
                      </TableCell>
                    </TableRow>
                  ) : purchaseItems.map((item) => (
                    <TableRow key={item.sku} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <TableCell className="px-4 font-mono font-bold text-white/40 text-[11px]">{item.sku}</TableCell>
                      <TableCell className="font-bold text-white/80 text-[12px]">{item.name}</TableCell>
                      <TableCell className="text-center font-bold text-white/80 text-[12px]">{item.quantity}</TableCell>
                      <TableCell className="text-right font-medium text-white/60 text-[11.5px]">
                        <span className="text-white/90">${item.cost.toFixed(2)}</span>
                        <span className="text-[9.5px] text-white/30 ml-1">/ ${(item.cost * 1.13).toFixed(2)}</span>
                      </TableCell>
                      <TableCell className="text-right font-black text-white/90 text-[12.5px]">
                        <span>${(item.cost * item.quantity).toFixed(2)}</span>
                        <span className="text-[9.5px] text-white/30 font-medium ml-1">/ ${((item.cost * item.quantity) * 1.13).toFixed(2)}</span>
                      </TableCell>
                      <TableCell>
                        <button onClick={() => removeItem(item.sku)} className="h-7 w-7 rounded-md flex items-center justify-center text-white/20 hover:text-[#ff5c5c] hover:bg-[#ff5c5c]/10 transition-all">
                          <Trash2 size={13} />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
            <button 
              className="h-[46px] rounded-xl flex items-center justify-center gap-2 bg-white/5 border border-white/10 text-[13px] font-bold text-white/50 hover:bg-white/10 hover:text-white/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading || purchaseItems.length === 0}
              onClick={() => savePurchase('PENDIENTE')}
            >
              <Save size={16} />
              Borrador Pendiente
            </button>
            <button 
              className="h-[46px] rounded-xl flex items-center justify-center gap-2 bg-emerald-500/30 border border-emerald-500/40 text-[13px] font-bold text-[#63e2b7] hover:bg-emerald-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
              disabled={loading || purchaseItems.length === 0}
              onClick={() => savePurchase('CERRADA')}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} className="group-hover:scale-110 transition-transform" />}
              Cerrar e Ingresar
            </button>
          </div>

          <div className="rounded-[11px] p-[12px_16px] bg-[#d97706]/10 border border-[#d97706]/20 flex gap-3 mt-1">
            <AlertTriangle className="text-[#fbbf24] mt-0.5 shrink-0" size={16} />
            <div>
              <div className="text-[10px] font-bold text-[#fbbf24] uppercase tracking-[0.5px] mb-1">Aviso de Operación</div>
              <div className="text-[11px] text-[#fbbf24]/70 leading-[1.6]">Al "Borrador Pendiente", la compra queda registrada pero el stock no cambia. Al "Cerrar e Ingresar", el stock se carga inmediatamente al inventario maestro y queda disponible para venta.</div>
            </div>
          </div>
        </div>
      </div>
    </TabsContent>

    <TabsContent value="historial" className="space-y-6 outline-none">
      <div className="rounded-[11px] bg-white/5 backdrop-blur-md border border-white/10 flex flex-col overflow-hidden">
        <div className="p-[18px_24px] border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-[13px] font-bold text-white flex items-center gap-2">
              <Calendar className="text-indigo-400" size={16} />
              Historial de Ingresos de Compra
            </div>
            <div className="text-[11px] text-white/50 mt-1">Consulte los ingresos históricos de productos y compras operativas.</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 p-1 rounded-[10px]">
              <button onClick={() => setHistoryStatusFilter('TODOS')} className={`text-[10.5px] font-bold rounded-lg px-3 py-1.5 transition-all ${historyStatusFilter === 'TODOS' ? 'bg-indigo-500/30 text-[#a5a8ff] shadow-sm' : 'text-white/50 hover:text-white/80'}`}>TODOS</button>
              <button onClick={() => setHistoryStatusFilter('PENDIENTE')} className={`text-[10.5px] font-bold rounded-lg px-3 py-1.5 transition-all ${historyStatusFilter === 'PENDIENTE' ? 'bg-indigo-500/30 text-[#a5a8ff] shadow-sm' : 'text-white/50 hover:text-white/80'}`}>BORRADOR</button>
              <button onClick={() => setHistoryStatusFilter('CERRADA')} className={`text-[10.5px] font-bold rounded-lg px-3 py-1.5 transition-all ${historyStatusFilter === 'CERRADA' ? 'bg-indigo-500/30 text-[#a5a8ff] shadow-sm' : 'text-white/50 hover:text-white/80'}`}>INGRESADA</button>
            </div>
          </div>
        </div>

        <div className="p-4 border-b border-white/5 flex items-center gap-3 bg-white/5">
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg p-[8px_12px] w-full md:max-w-md">
            <Search size={14} className="text-white/30" />
            <Input 
              placeholder="Buscar por ID de Pedido, Proveedor o Encargado..." 
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              className="h-auto bg-transparent border-none text-[12px] text-white/80 p-0 shadow-none focus-visible:ring-0 placeholder:text-white/30"
            />
          </div>
        </div>

        <div className="overflow-x-auto min-h-[400px]">
          <Table>
            <TableHeader className="bg-[#161430]/90 backdrop-blur-sm">
              <TableRow className="border-b border-white/10 hover:bg-transparent">
                <TableHead className="text-[10px] font-semibold text-white/40 uppercase px-6 h-[40px]">ID Pedido</TableHead>
                <TableHead className="text-[10px] font-semibold text-white/40 uppercase h-[40px]">Proveedor</TableHead>
                <TableHead className="text-[10px] font-semibold text-white/40 uppercase h-[40px]">Encargado</TableHead>
                <TableHead className="text-[10px] font-semibold text-white/40 uppercase h-[40px]">Bodega</TableHead>
                <TableHead className="text-[10px] font-semibold text-white/40 uppercase h-[40px]">Método Pago</TableHead>
                <TableHead className="text-[10px] font-semibold text-white/40 uppercase h-[40px]">Monto Total</TableHead>
                <TableHead className="text-[10px] font-semibold text-white/40 uppercase text-center h-[40px]">Estado</TableHead>
                <TableHead className="text-[10px] font-semibold text-white/40 uppercase text-center h-[40px]">Fecha de Creación</TableHead>
                <TableHead className="w-24 px-6 h-[40px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(() => {
                const s = historySearch.toLowerCase().trim();
                let list = purchasesHistory || [];
                if (historyStatusFilter !== 'TODOS') {
                  list = list.filter(p => p.status === historyStatusFilter);
                }
                if (s) {
                  list = list.filter(p => 
                    (p.order_id && p.order_id.toLowerCase().includes(s)) ||
                    (p.entered_by && p.entered_by.toLowerCase().includes(s)) ||
                    (p.suppliers && p.suppliers.name && p.suppliers.name.toLowerCase().includes(s)) ||
                    (p.supplier_name && p.supplier_name.toLowerCase().includes(s))
                  );
                }
                if (list.length === 0) {
                  return (
                    <TableRow className="border-b border-white/5 hover:bg-transparent">
                      <TableCell colSpan={9} className="text-center py-20 text-white/30 italic text-[11px]">
                        No se encontraron registros de compra.
                      </TableCell>
                    </TableRow>
                  );
                }
                return list.map((p: any) => {
                  const whName = warehouses.find(w => w.id === p.warehouse_id)?.name || 'N/A';
                  const provName = p.suppliers?.name || p.supplier_name || 'Sin Proveedor';
                  const dateStr = p.created_at ? new Date(p.created_at).toLocaleString('es-SV', { timeZone: 'America/El_Salvador' }) : 'N/A';
                  return (
                    <TableRow key={p.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <TableCell className="px-6 font-mono font-bold text-[11px] text-white/80">{p.order_id}</TableCell>
                      <TableCell className="font-bold text-[11.5px] text-white/90">{provName}</TableCell>
                      <TableCell className="text-[11px] text-white/50">{p.entered_by || 'N/A'}</TableCell>
                      <TableCell className="text-[11px] text-indigo-300 font-medium">{whName}</TableCell>
                      <TableCell className="text-[11px] text-white/50">{p.payment_method} {p.credit_days ? `(${p.credit_days}d)` : ''}</TableCell>
                      <TableCell className="text-[12.5px] font-black text-[#63e2b7]">${parseFloat(p.total).toFixed(2)}</TableCell>
                      <TableCell className="text-center">
                        <span className={`px-[8px] py-[3px] rounded-md text-[9px] font-bold uppercase tracking-[0.5px] ${p.status === 'CERRADA' ? 'bg-emerald-500/20 text-[#63e2b7] border border-emerald-500/30' : 'bg-[#d97706]/20 text-[#fbbf24] border border-[#d97706]/30'}`}>
                          {p.status === 'CERRADA' ? 'INGRESADA' : 'BORRADOR'}
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-[10.5px] text-white/40">{dateStr}</TableCell>
                      <TableCell className="text-right px-6">
                        <div className="flex justify-end gap-1.5">
                          {p.status === 'PENDIENTE' && (
                            <button 
                              onClick={() => loadDraftPurchase(p)}
                              className="px-2 py-1.5 text-[9.5px] font-bold rounded-lg border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20 transition-colors uppercase tracking-[0.5px]"
                            >
                              Editar
                            </button>
                          )}
                          <button 
                            onClick={() => {
                              setSelectedPurchase(p);
                              setIsDetailsDialogOpen(true);
                            }}
                            className="px-2 py-1.5 text-[9.5px] font-bold rounded-lg bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white/90 transition-colors uppercase tracking-[0.5px]"
                          >
                            Detalle
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                });
              })()}
            </TableBody>
          </Table>
        </div>
      </div>
    </TabsContent>

    <TabsContent value="vinculacion" className="space-y-6 outline-none">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* FORMULARIO MANUAL (IZQUIERDA) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-[11px] bg-white/5 backdrop-blur-md border border-white/10 overflow-hidden">
            <div className="p-4 border-b border-white/10 bg-indigo-500/10">
              <div className="text-[13px] font-bold text-white flex items-center gap-2">
                <Link2 className="text-indigo-400" size={16} />
                Vincular Código Manualmente
              </div>
              <div className="text-[11px] text-white/50 mt-1">
                Asocie un código de proveedor con un SKU interno.
              </div>
            </div>
            <div className="p-4 space-y-4">
              <div className="space-y-1.5">
                <div className="text-[10px] font-medium uppercase tracking-[0.7px] text-white/30">Código de Proveedor / DTE</div>
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg p-[9px_12px]">
                  <Input 
                    placeholder="Ej: COD-PROV-123" 
                    value={supplierCodeInput} 
                    onChange={(e) => setSupplierCodeInput(e.target.value)}
                    className="h-full bg-transparent border-none text-[12.5px] font-bold text-white/90 p-0 shadow-none focus-visible:ring-0 placeholder:text-white/20 uppercase"
                  />
                </div>
              </div>

              <div className="space-y-1.5 relative">
                <div className="text-[10px] font-medium uppercase tracking-[0.7px] text-white/30">SKU Interno de Destino</div>
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg p-[9px_12px]">
                  <Input 
                    placeholder="Buscar por SKU o Nombre..." 
                    value={internalSkuInput} 
                    onChange={(e) => setInternalSkuInput(e.target.value)}
                    className="h-full bg-transparent border-none text-[12.5px] font-bold text-white/90 p-0 shadow-none focus-visible:ring-0 placeholder:text-white/20 uppercase"
                  />
                </div>
                {internalSkuInput && !inventory.some(p => p.sku === internalSkuInput.trim().toUpperCase()) && (
                  <div className="absolute z-50 left-0 right-0 top-[100%] mt-1 bg-[#161430] border border-white/10 rounded-xl shadow-xl max-h-48 overflow-y-auto p-1 divide-y divide-white/5">
                    {inventory
                      .filter(p => 
                        p.sku.toLowerCase().includes(internalSkuInput.toLowerCase()) || 
                        p.name.toLowerCase().includes(internalSkuInput.toLowerCase())
                      )
                      .slice(0, 10)
                      .map(p => (
                        <button
                          key={p.sku}
                          type="button"
                          onClick={() => setInternalSkuInput(p.sku)}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 rounded-lg flex justify-between font-bold text-white"
                        >
                          <span className="text-indigo-300">{p.sku}</span>
                          <span className="text-[10px] text-white/40 font-normal truncate max-w-[150px]">{p.name}</span>
                        </button>
                      ))}
                    {inventory.filter(p => 
                      p.sku.toLowerCase().includes(internalSkuInput.toLowerCase()) || 
                      p.name.toLowerCase().includes(internalSkuInput.toLowerCase())
                    ).length === 0 && (
                      <div className="p-3 text-center text-[10px] text-white/30 italic">No se encontraron productos</div>
                    )}
                  </div>
                )}
                
                {internalSkuInput && inventory.some(p => p.sku === internalSkuInput.trim().toUpperCase()) && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[10px] font-bold text-[#63e2b7] animate-in fade-in">
                    Producto Seleccionado: {inventory.find(p => p.sku === internalSkuInput.trim().toUpperCase())?.name}
                  </div>
                )}
              </div>

              <button 
                onClick={handleSaveManualMapping}
                disabled={savingMapping || !supplierCodeInput.trim() || !internalSkuInput.trim()}
                className="w-full h-10 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-lg transition-all active:scale-95 border-none disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingMapping ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                GUARDAR VINCULACIÓN
              </button>
            </div>
          </div>
        </div>

        {/* LISTA & JSON EDITOR (DERECHA) */}
        <div className="lg:col-span-8">
          <div className="rounded-[11px] bg-white/5 backdrop-blur-md border border-white/10 overflow-hidden flex flex-col h-full">
            <Tabs defaultValue="tabla" className="w-full flex flex-col h-full">
              <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-transparent">
                <div>
                  <div className="text-[13px] font-bold text-white flex items-center gap-2">
                    <Link2 className="text-indigo-400" size={16} />
                    Equivalencias de Catálogo
                  </div>
                  <div className="text-[11px] text-white/50 mt-1">Consulte y administre el mapeo masivo de SKU.</div>
                </div>
                <TabsList className="bg-white/5 p-1 rounded-[10px] border border-white/10 flex">
                  <TabsTrigger value="tabla" className="text-[10px] font-bold px-3 py-1.5 rounded-md data-[state=active]:bg-indigo-500/30 data-[state=active]:text-[#a5a8ff] text-white/50">Lista de Vínculos</TabsTrigger>
                  <TabsTrigger value="json" className="text-[10px] font-bold px-3 py-1.5 rounded-md data-[state=active]:bg-indigo-500/30 data-[state=active]:text-[#a5a8ff] text-white/50">Editor JSON</TabsTrigger>
                </TabsList>
              </div>
              
              {/* SUBTAB TABLA DE EQUIVALENCIAS */}
              <TabsContent value="tabla" className="m-0 outline-none flex-1 flex flex-col">
                <div className="p-4 border-b border-white/5 flex items-center gap-3 bg-white/5">
                  <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg p-[8px_12px] w-full md:max-w-md">
                    <Search size={14} className="text-white/30" />
                    <Input 
                      placeholder="Buscar por código de proveedor o SKU interno..." 
                      value={mappingSearch}
                      onChange={(e) => setMappingSearch(e.target.value)}
                      className="h-auto bg-transparent border-none text-[12px] text-white/80 p-0 shadow-none focus-visible:ring-0 placeholder:text-white/30"
                    />
                  </div>
                </div>
                
                <div className="overflow-x-auto min-h-[300px]">
                  <Table>
                    <TableHeader className="bg-[#161430]/90 backdrop-blur-sm">
                      <TableRow className="border-b border-white/10 hover:bg-transparent">
                        <TableHead className="text-[10px] font-semibold text-white/40 uppercase px-6 h-[40px]">Código Proveedor</TableHead>
                        <TableHead className="text-[10px] font-semibold text-white/40 uppercase h-[40px]">SKU Interno</TableHead>
                        <TableHead className="text-[10px] font-semibold text-white/40 uppercase h-[40px]">Producto Maestro</TableHead>
                        <TableHead className="text-right text-[10px] font-semibold text-white/40 uppercase px-6 h-[40px]">Acción</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const s = mappingSearch.toLowerCase().trim();
                        const list = (savedMappings || []).filter(m => 
                          m.supplierCode.toLowerCase().includes(s) || 
                          m.internalSku.toLowerCase().includes(s)
                        );
                        if (list.length === 0) {
                          return (
                            <TableRow className="border-b border-white/5 hover:bg-transparent">
                              <TableCell colSpan={4} className="text-center py-16 text-white/30 italic text-[11px]">
                                {s ? 'No se encontraron vinculaciones coincidentes.' : 'No hay equivalencias de proveedores registradas.'}
                              </TableCell>
                            </TableRow>
                          );
                        }
                        return list.map((m: any) => {
                          const prod = inventory.find(p => p.sku === m.internalSku);
                          return (
                            <TableRow key={m.supplierCode} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                              <TableCell className="px-6 font-mono font-bold text-[11px] text-indigo-400">{m.supplierCode}</TableCell>
                              <TableCell className="font-mono font-bold text-[11px] text-white/90">{m.internalSku}</TableCell>
                              <TableCell className="text-[11px] font-medium text-white/50 max-w-[200px] truncate">{prod?.name || 'Desconocido'}</TableCell>
                              <TableCell className="text-right px-6">
                                <button 
                                  onClick={() => handleDeleteMapping(m.supplierCode)}
                                  className="h-7 w-7 rounded-md inline-flex items-center justify-center text-white/20 hover:text-[#ff5c5c] hover:bg-[#ff5c5c]/10 transition-all"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </TableCell>
                            </TableRow>
                          );
                        });
                      })()}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* SUBTAB EDITOR JSON */}
              <TabsContent value="json" className="m-0 outline-none p-6 space-y-4">
                <div className="space-y-1.5">
                  <div className="text-[10px] font-medium uppercase tracking-[0.7px] text-white/30">Estructura JSON Mappings</div>
                  <p className="text-[10.5px] text-white/50 leading-normal mb-2">
                    Edite o cargue masivamente vinculaciones en formato JSON. El formato debe ser un arreglo de objetos con las propiedades <code>"supplier_code"</code> e <code>"internal_sku"</code>.
                  </p>
                  <textarea 
                    rows={12}
                    value={jsonMappingsInput}
                    onChange={(e) => setJsonMappingsInput(e.target.value)}
                    className="w-full font-mono text-[11px] p-4 border rounded-xl bg-black/40 border-white/10 text-white/80 placeholder:text-white/20 outline-none resize-none"
                  />
                </div>

                <button 
                  onClick={handleSaveJsonMappings}
                  disabled={savingJsonMappings || !jsonMappingsInput.trim()}
                  className="h-10 px-6 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold rounded-lg shadow-lg active:scale-95 transition-all w-full md:w-auto flex items-center justify-center gap-2 text-[12px] disabled:opacity-50"
                >
                  {savingJsonMappings ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                  IMPORTAR & GUARDAR JSON
                </button>
              </TabsContent>
            </Tabs>
          </div>
        </div>

      </div>
    </TabsContent>

    <TabsContent value="credito" className="space-y-6 outline-none animate-in fade-in duration-300">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* COLUMNA IZQUIERDA: IMPORTADOR DTE JSON */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="bg-white/5 dark:bg-white/5 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-2xl p-6">
            <CardHeader className="p-0 pb-4 border-b border-white/10 mb-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-white">
                <FileJson className="text-indigo-400" size={16} /> Importador Nota de Crédito
              </CardTitle>
              <CardDescription className="text-[11px] text-white/50">Cargue el DTE en formato JSON para procesar la nota de crédito rápidamente.</CardDescription>
            </CardHeader>
            <CardContent className="p-0 space-y-4 text-white">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-white/40 tracking-wider">Cargar archivo JSON</Label>
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer bg-[#000000]/15 dark:bg-black/35 border-white/10 hover:border-indigo-400 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <FileJson className="w-8 h-8 mb-2 text-indigo-400" />
                      <p className="text-xs text-white/70 font-semibold">Haga clic o arrastre su JSON aquí</p>
                      <p className="text-[10px] text-white/40">Soporta DTE Nota de Crédito (.json)</p>
                    </div>
                    <input 
                      type="file" 
                      accept=".json"
                      ref={creditNoteFileInputRef}
                      onChange={handleCreditNoteJsonUpload}
                      className="hidden" 
                    />
                  </label>
                </div>
              </div>

              {parsedCreditNote && (
                <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl space-y-4 animate-in fade-in slide-in-from-top-3">
                  <h3 className="text-xs font-black text-indigo-300 uppercase tracking-widest border-b border-indigo-500/20 pb-1.5">Vista Previa Nota de Crédito</h3>
                  
                  <div className="space-y-1">
                    <span className="text-[9px] font-black uppercase text-white/30 block">N. Comprobante DTE</span>
                    <span className="text-xs font-bold text-white font-mono">{parsedCreditNote.documentNumber}</span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[9px] font-black uppercase text-white/30 block">Proveedor</span>
                    <span className="text-xs font-bold text-white">{parsedCreditNote.supplierName}</span>
                    <span className="text-[9px] text-white/50 block font-mono">NIT: {parsedCreditNote.supplierNit}</span>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase text-white/30 tracking-wider">Motivo de Nota de Crédito</Label>
                    <Select 
                      value={selectedCreditNoteType}
                      onValueChange={(val: any) => setSelectedCreditNoteType(val)}
                    >
                      <SelectTrigger className="h-10 bg-slate-900/50 border-white/10 text-xs font-bold rounded-xl text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DEVOLUCION" className="text-xs">Devolución de Producto</SelectItem>
                        <SelectItem value="AJUSTE_PRECIO" className="text-xs">Ajuste de Precio</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5 border-t border-indigo-500/20 pt-3">
                    <div className="flex justify-between items-center text-xs font-black text-white">
                      <span>Total Neto:</span>
                      <span className="text-indigo-400 font-mono text-sm">${parsedCreditNote.total.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button 
                      onClick={handleSaveCreditNote}
                      disabled={loading}
                      className="flex-1 h-10 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs"
                    >
                      {loading ? <Loader2 className="animate-spin mr-1" /> : null}
                      APLICAR NOTA
                    </Button>
                    <Button 
                      variant="ghost" 
                      onClick={() => setParsedCreditNote(null)}
                      className="flex-1 h-10 border border-white/10 text-white hover:bg-white/5 rounded-xl text-xs"
                    >
                      CANCELAR
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* COLUMNA DERECHA: HISTORIAL DE NOTAS DE CRÉDITO */}
        <div className="lg:col-span-8">
          <Card className="bg-white/5 dark:bg-white/5 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden">
            <CardHeader className="p-6 border-b border-white/10 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-white">Notas de Crédito Recibidas</CardTitle>
                <CardDescription className="text-xs text-white/50">Listado de notas de crédito aplicadas a la sucursal activa.</CardDescription>
              </div>
              <div className="w-64 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={14} />
                <Input 
                  placeholder="Buscar por N. Documento..."
                  value={creditNoteSearch}
                  onChange={e => setCreditNoteSearch(e.target.value)}
                  className="pl-8 h-8 bg-black/20 border-white/10 text-xs text-white rounded-lg placeholder:text-white/30"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-white/5 border-b border-white/10">
                  <TableRow>
                    <TableHead className="text-[10px] font-black uppercase text-white/50 tracking-wider pl-6">Fecha</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-white/50 tracking-wider">N. Documento</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-white/50 tracking-wider">Proveedor</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-white/50 tracking-wider">Motivo / Tipo</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-white/50 tracking-wider text-right pr-6">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingCreditNotes ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-white/50 italic text-xs">
                        Cargando notas de crédito...
                      </TableCell>
                    </TableRow>
                  ) : creditNotes.filter(cn => cn.document_number.toLowerCase().includes(creditNoteSearch.toLowerCase())).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-white/50 italic text-xs">
                        No hay notas de crédito registradas para esta sucursal.
                      </TableCell>
                    </TableRow>
                  ) : creditNotes.filter(cn => cn.document_number.toLowerCase().includes(creditNoteSearch.toLowerCase())).map((cn: any) => (
                    <TableRow key={cn.id} className="hover:bg-white/5 border-b border-white/5">
                      <TableCell className="pl-6 text-xs text-white/70">
                        {new Date(cn.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-xs font-mono font-bold text-white">
                        {cn.document_number}
                      </TableCell>
                      <TableCell className="text-xs text-white font-semibold">
                        {cn.suppliers?.name || 'Proveedor Desconocido'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[9px] font-black uppercase ${
                          cn.type === 'DEVOLUCION' 
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/25' 
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                        }`}>
                          {cn.type === 'DEVOLUCION' ? 'Devolución de Producto' : 'Ajuste de Precio'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-right font-mono font-black text-indigo-300 pr-6">
                        ${parseFloat(cn.total).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

      </div>
    </TabsContent>
  </Tabs>

      <Dialog open={isUncreatedDialogOpen} onOpenChange={setIsUncreatedDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col gap-4 overflow-hidden rounded-2xl border shadow-xl">
          <DialogHeader className="px-1 pt-1">
            <DialogTitle className="text-lg font-black tracking-tight text-foreground flex items-center gap-2">
              <AlertTriangle className="text-amber-500" size={20} />
              Productos DTE No Registrados
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Hemos detectado códigos en el archivo de compra DTE que no existen en el inventario. Define su vinculación contable y precio de venta pública (PVP) para poder agregarlos.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-2">
            <div className="space-y-4 py-2">
              {uncreatedDteProducts.map((p, index) => {
                const category = selectedUncreatedCategory[p.sku] || 'Inventario de Mercadería';
                const priceVal = selectedUncreatedPrice[p.sku] || '';
                const suggestedPrice = (p.cost * 1.3).toFixed(2);
                return (
                  <div key={p.sku} className="p-4 border rounded-2xl bg-muted/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Cód. Prov: {p.originalProviderCode || p.sku}</span>
                        <span className="text-xs font-bold text-muted-foreground">
                          Costo: ${p.cost.toFixed(2)}
                        </span>
                        <span className="text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/30 px-2 py-0.5 rounded-md">
                          Cant: {p.quantity}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-foreground leading-snug">{p.name}</h4>
                      
                      <div className="space-y-1 max-w-[200px]">
                        <Label className="text-[9px] font-bold uppercase text-muted-foreground">SKU Nexway Destino</Label>
                        <Input 
                          placeholder="SKU Destino"
                          value={p.sku} 
                          onChange={(e) => {
                            const newSku = e.target.value.toUpperCase();
                            setUncreatedDteProducts(prev => prev.map((item, idx) => 
                              idx === index ? { ...item, sku: newSku } : item
                            ));
                          }}
                          className="h-8 text-xs font-bold bg-card rounded-xl border uppercase"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-[280px] md:min-w-[340px]">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">Vínculo Contable</Label>
                        <Select 
                          value={category} 
                          onValueChange={(val) => setSelectedUncreatedCategory(prev => ({ ...prev, [p.sku]: val }))}
                        >
                          <SelectTrigger className="h-9 text-xs rounded-xl bg-card border">
                            <SelectValue placeholder="Seleccione Categoría" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="Inventario de Mercadería">Inventario de Mercadería</SelectItem>
                            <SelectItem value="Gastos de Administración">Gastos de Administración</SelectItem>
                            <SelectItem value="Gastos de Venta">Gastos de Venta</SelectItem>
                            <SelectItem value="Propiedad, Planta y Equipo">Propiedad, Planta y Equipo</SelectItem>
                            <SelectItem value="General">General</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold uppercase text-muted-foreground flex justify-between">
                          <span>Precio Venta (PVP)</span>
                          <span className="text-[9px] text-muted-foreground lowercase">sug. ${suggestedPrice}</span>
                        </Label>
                        <Input 
                          type="number" 
                          placeholder={suggestedPrice}
                          value={priceVal} 
                          onChange={(e) => setSelectedUncreatedPrice(prev => ({ ...prev, [p.sku]: e.target.value }))}
                          className="h-9 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-card rounded-xl border"
                        />
                      </div>
                    </div>

                    <div className="flex items-end pt-2 md:pt-0">
                      <Button 
                        onClick={() => handleCreateUncreatedProduct(index)}
                        className="w-full md:w-auto h-9 bg-primary text-primary-foreground font-bold text-xs rounded-xl px-4"
                      >
                        Crear y Añadir
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          <DialogFooter className="border-t border-white/10 pt-3 flex items-center justify-between sm:justify-between">
            <span className="text-[10px] text-muted-foreground font-medium">
              * El precio de venta por defecto si se deja en blanco es Costo + 30% de margen.
            </span>
            <Button 
              variant="outline" 
              onClick={() => setIsUncreatedDialogOpen(false)}
              className="rounded-xl h-9 text-xs font-bold"
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col gap-4 overflow-hidden rounded-2xl border shadow-xl">
          <DialogHeader className="px-1 pt-1">
            <DialogTitle className="text-lg font-black tracking-tight text-foreground flex items-center gap-2">
              <ClipboardList size={20} className="text-blue-600" />
              Detalles de Compra: {selectedPurchase?.order_id}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Comprobante de ingreso registrado en Nexway ERP.
            </DialogDescription>
          </DialogHeader>

          {selectedPurchase && (
            <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-muted/20 rounded-2xl border text-xs">
                <div>
                  <span className="font-bold text-muted-foreground block uppercase text-[9px] tracking-wider">Proveedor</span>
                  <span className="font-black text-foreground text-sm">{selectedPurchase.suppliers?.name || selectedPurchase.supplier_name || 'Sin Proveedor'}</span>
                </div>
                <div>
                  <span className="font-bold text-muted-foreground block uppercase text-[9px] tracking-wider">Encargado</span>
                  <span className="font-bold text-foreground">{selectedPurchase.entered_by || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-bold text-muted-foreground block uppercase text-[9px] tracking-wider">Bodega Destino</span>
                  <span className="font-bold text-foreground">
                    {warehouses.find(w => w.id === selectedPurchase.warehouse_id)?.name || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="font-bold text-muted-foreground block uppercase text-[9px] tracking-wider">Fecha</span>
                  <span className="font-bold text-foreground">
                    {new Date(selectedPurchase.created_at).toLocaleString('es-SV', { timeZone: 'America/El_Salvador' })}
                  </span>
                </div>
                <div>
                  <span className="font-bold text-muted-foreground block uppercase text-[9px] tracking-wider">Tipo Documento</span>
                  <span className="font-bold text-foreground">{selectedPurchase.document_type || 'FACTURA'}</span>
                </div>
                <div>
                  <span className="font-bold text-muted-foreground block uppercase text-[9px] tracking-wider">DTE / Cód. Gen.</span>
                  <span className="font-mono text-foreground">{selectedPurchase.document_number || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-bold text-muted-foreground block uppercase text-[9px] tracking-wider">Método de Pago</span>
                  <span className="font-bold text-foreground">{selectedPurchase.payment_method} {selectedPurchase.credit_days ? `(${selectedPurchase.credit_days} d)` : ''}</span>
                </div>
                <div>
                  <span className="font-bold text-muted-foreground block uppercase text-[9px] tracking-wider">Total (Con IVA)</span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">${parseFloat(selectedPurchase.total).toFixed(2)}</span>
                </div>
              </div>

              <div className="flex-1 overflow-hidden flex flex-col min-h-[150px]">
                <span className="font-bold text-xs text-foreground uppercase tracking-widest block mb-2">Artículos Ingresados</span>
                <ScrollArea className="flex-1 border rounded-2xl bg-card">
                  <Table>
                    <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
                      <TableRow>
                        <TableHead className="text-[10px] font-black uppercase px-6">SKU</TableHead>
                        <TableHead className="text-[10px] font-black uppercase">Producto</TableHead>
                        <TableHead className="text-center text-[10px] font-black uppercase">Cant.</TableHead>
                        <TableHead className="text-right text-[10px] font-black uppercase">Costo Un.</TableHead>
                        <TableHead className="text-right text-[10px] font-black uppercase px-6">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedPurchase.purchase_items?.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell className="px-6 font-mono font-bold text-xs text-muted-foreground">{item.sku}</TableCell>
                          <TableCell className="font-bold text-xs text-foreground">{item.inventory?.name || 'Desconocido'}</TableCell>
                          <TableCell className="text-center font-bold text-xs text-foreground">{item.quantity}</TableCell>
                          <TableCell className="text-right font-bold text-foreground text-xs">${parseFloat(item.cost).toFixed(2)}</TableCell>
                          <TableCell className="text-right font-black text-foreground text-xs px-6">${parseFloat(item.subtotal).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            </div>
          )}

          <DialogFooter className="border-t border-white/10 pt-3 flex items-center justify-between">
            <div>
              {selectedPurchase?.status === 'PENDIENTE' && (
                <Button 
                  variant="default"
                  onClick={() => loadDraftPurchase(selectedPurchase)}
                  className="rounded-xl h-9 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Continuar Editando Borrador
                </Button>
              )}
            </div>
            <Button 
              variant="outline" 
              onClick={() => setIsDetailsDialogOpen(false)}
              className="rounded-xl h-9 text-xs font-bold"
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}