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
  Link2,
  Sparkles,
  Users,
  Check,
  Hash,
  ChevronDown
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { fetchSystemAppUsers, SystemUserOption } from '@/lib/session-operator';
import { postDoubleEntryJournal } from '@/lib/accounting-journal';
import {
  loadPendingCreditNoteAlerts,
  addPendingCreditNoteAlert,
  resolveMatchingCreditNoteAlerts,
  deletePendingCreditNoteAlert,
  type PendingCreditNoteAlert,
} from '@/lib/credit-note-alerts';
import {
  loadSupplierCreditProfiles,
  loadSupplierCxpBalances,
  type SupplierCreditProfile,
} from '@/lib/supplier-credit';
import { useBms } from '@/contexts/BmsContext';
import type { PurchaseOrderRecord } from './OrdersTab';

interface PurchaseItem {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  cost: number;
}

type PaymentMethod = 'Efectivo' | 'Transferencia' | 'Credito';

interface PurchasesTabProps {
  initialImportedDte?: any | null;
  onConsumeImportedDte?: () => void;
  initialPurchaseOrder?: PurchaseOrderRecord | null;
  onConsumePurchaseOrder?: () => void;
}

export default function PurchasesTab({
  initialImportedDte,
  onConsumeImportedDte,
  initialPurchaseOrder,
  onConsumePurchaseOrder
}: PurchasesTabProps = {}) {
  const router = useRouter();
  const { toast } = useToast();
  const { auditSystem } = useBms();
  const [loading, setLoading] = useState(false);
  
  const [activeBranchId, setActiveBranchId] = useState<string | null>(() =>
    typeof window !== 'undefined' ? localStorage.getItem('active_branch_id') : null
  );
  const [activeTab, setActiveTab] = useState('registro');
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const [pedidoId, setPedidoId] = useState('');
  const [docNumber, setDocNumber] = useState('');
  const [generationCode, setGenerationCode] = useState('');
  const [docType, setDocType] = useState<'FACTURA' | 'CCF'>('FACTURA');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Efectivo');
  const [creditDays, setCreditDays] = useState<string | number>('');
  const [enteredBy, setEnteredBy] = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('nexway_session_operator') || '' : ''
  );
  const [systemUsers, setSystemUsers] = useState<SystemUserOption[]>([]);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [creditNotesLoaded, setCreditNotesLoaded] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [isUserPopoverOpen, setIsUserPopoverOpen] = useState(false);
  const [warehouse, setWarehouse] = useState('');
  
  // Proveedor seleccionado
  const [supplierName, setSupplierName] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [supplierCreditMap, setSupplierCreditMap] = useState<Record<string, SupplierCreditProfile>>({});
  const [supplierBalancesMap, setSupplierBalancesMap] = useState<Record<string, number>>({});
  const [showPendingInvoicesList, setShowPendingInvoicesList] = useState(false);
  const [pendingPurchasesList, setPendingPurchasesList] = useState<any[]>([]);

  // Autorización para crear automáticamente proveedor faltante desde JSON DTE
  const [pendingJsonSupplier, setPendingJsonSupplier] = useState<{
    name: string;
    nit: string;
    nrc: string;
    giro: string;
    address: string;
    email: string;
    phone: string;
  } | null>(null);
  const [creatingJsonSupplier, setCreatingJsonSupplier] = useState(false);

  const handleAuthorizeCreateJsonSupplier = async () => {
    if (!pendingJsonSupplier) return;
    setCreatingJsonSupplier(true);
    try {
      const { data: created, error } = await supabase
        .from('suppliers')
        .insert({
          name: pendingJsonSupplier.name,
          nit: pendingJsonSupplier.nit || null,
          nrc: pendingJsonSupplier.nrc || null,
          giro: pendingJsonSupplier.giro || null,
          address: pendingJsonSupplier.address || null,
          email: pendingJsonSupplier.email || null,
          phone: pendingJsonSupplier.phone || null,
          apply_retention: false,
          apply_perception: false,
        })
        .select('*')
        .single();

      if (error) throw error;
      if (created) {
        setSuppliers(prev => [created, ...prev]);
        setSupplierName(created.name);
      }
      toast({
        title: 'Proveedor Registrado con Autorización ✓',
        description: `${pendingJsonSupplier.name} fue creado en el Directorio y vinculado a esta compra.`,
      });
      setPendingJsonSupplier(null);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error creando proveedor', description: err?.message || 'No se pudo registrar el proveedor.' });
    } finally {
      setCreatingJsonSupplier(false);
    }
  };

  const loadPendingInvoicesQuick = async () => {
    try {
      const { data } = await supabase
        .from('purchases')
        .select('id, order_id, document_number, supplier_name, total, payment_method, payment_status, credit_days, created_at, suppliers(name)')
        .or('payment_status.eq.PENDIENTE,status.eq.PENDIENTE')
        .order('created_at', { ascending: false })
        .limit(50);
      setPendingPurchasesList((data || []).filter((p: any) => p.payment_status !== 'PAGADO'));
    } catch {
      setPendingPurchasesList([]);
    }
  };

  useEffect(() => {
    Promise.all([loadSupplierCreditProfiles(), loadSupplierCxpBalances()])
      .then(([profiles, balances]) => {
        setSupplierCreditMap(profiles);
        setSupplierBalancesMap(balances);
      })
      .catch(() => {});
    loadPendingInvoicesQuick();
  }, []);

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
  const [processingAllUncreated, setProcessingAllUncreated] = useState(false);

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

  // Avisos de devoluciones esperando Nota de Crédito (BMS + IA)
  const [pendingNcAlerts, setPendingNcAlerts] = useState<PendingCreditNoteAlert[]>([]);
  const [showNewAlertForm, setShowNewAlertForm] = useState(false);
  const [newAlertSupplier, setNewAlertSupplier] = useState('');
  const [newAlertInvoice, setNewAlertInvoice] = useState('');
  const [newAlertItems, setNewAlertItems] = useState('');
  const [newAlertAmount, setNewAlertAmount] = useState('');

  // Modal / Modo rápido de NC Manual ligada a una Factura de Compra
  const [manualNcPurchaseId, setManualNcPurchaseId] = useState('');
  const [manualNcDocNumber, setManualNcDocNumber] = useState('');
  const [manualNcAmount, setManualNcAmount] = useState('');

  // Historial de compras
  const [purchasesHistory, setPurchasesHistory] = useState<any[]>([]);
  const [selectedPurchase, setSelectedPurchase] = useState<any | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'TODOS' | 'PENDIENTE' | 'CERRADA'>('TODOS');

  // Estados para Catálogo DTE
  const [pendingDtes, setPendingDtes] = useState<any[]>([]);
  const [selectedDteId, setSelectedDteId] = useState<string>('none');

  // Carga ultraligera inicial: SOLO lo necesario para abrir "Registro de Compra" al instante
  const loadPurchasesData = async () => {
    try {
      setLoadingData(true);

      let whQuery = supabase.from('warehouses').select('id, name, branch_id').order('name');
      if (activeBranchId) {
        whQuery = whQuery.eq('branch_id', activeBranchId);
      }

      const [whRes, supRes, invRes, mapRes, gmailDteRes] = await Promise.all([
        whQuery,
        supabase
          .from('suppliers')
          .select('id, name, nit, nrc, giro, email, phone, address, apply_retention, apply_perception')
          .order('name'),
        supabase.from('inventory').select('sku, name, category, price').order('sku'),
        supabase.from('supplier_mappings').select('supplier_code, internal_sku'),
        supabase
          .from('system_config')
          .select('value')
          .eq('key', 'gmail_pending_dtes')
          .maybeSingle()
      ]);

      const whData = whRes.data || [];
      setWarehouses(whData);

      setSuppliers((supRes.data || []).map((s: any) => ({
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

      const mappedInventory = (invRes.data || []).map((item: any) => ({
        id: item.sku,
        sku: item.sku,
        name: item.name,
        category: item.category,
        price: parseFloat(item.price) || 0,
        quantity: 0,
        bodegas: {} as Record<string, number>
      }));
      setInventory(mappedInventory);

      setSavedMappings((mapRes.data || []).map((m: any) => ({
        supplierCode: m.supplier_code,
        internalSku: m.internal_sku
      })));

      const mergedDtes: any[] = [];
      if (Array.isArray(gmailDteRes.data?.value)) {
        gmailDteRes.data.value
          .filter((d: any) => d && d.estado !== 'PROCESADO')
          .forEach((d: any) => mergedDtes.push(d));
      }
      setPendingDtes(mergedDtes);
    } catch (e: any) {
      console.error('Error al cargar datos en compras:', e);
    } finally {
      setLoadingData(false);
    }
  };

  // Carga bajo demanda del historial de compras (solo al abrir "Historial de Ingresos" o "Notas de Crédito")
  const loadPurchasesHistory = async () => {
    setLoadingHistory(true);
    try {
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
        `)
        .order('created_at', { ascending: false })
        .limit(100);
      if (activeBranchId) {
        purchasesQuery = purchasesQuery.eq('branch_id', activeBranchId);
      }
      const { data } = await purchasesQuery;
      setPurchasesHistory(data || []);
      setHistoryLoaded(true);
    } catch (e: any) {
      console.error('Error al cargar historial de compras:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Carga bajo demanda de usuarios del sistema (solo cuando el usuario abre el selector de encargado)
  const loadSystemUsersLazy = async () => {
    if (usersLoaded || loadingUsers) return;
    setLoadingUsers(true);
    try {
      const appUsers = await fetchSystemAppUsers();
      setSystemUsers(appUsers || []);
      setUsersLoaded(true);
      if (!enteredBy && appUsers && appUsers.length > 0) {
        setEnteredBy(appUsers[0].full_name || appUsers[0].email);
      }
    } catch (e) {
      console.error('Error al cargar usuarios:', e);
    } finally {
      setLoadingUsers(false);
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
      setCreditNotesLoaded(true);
      const alerts = await loadPendingCreditNoteAlerts();
      setPendingNcAlerts(alerts.filter(a => a.type === 'COMPRA_PROVEEDOR'));
    } catch (e: any) {
      console.error('Error al cargar notas de crédito:', e);
    } finally {
      setLoadingCreditNotes(false);
    }
  };

  const handleSelectDte = (id: string, explicitDte?: any) => {
    setSelectedDteId(id);
    if (id === 'none') return;
    
    const dte = explicitDte || pendingDtes.find(d => d.id === id);
    if (!dte) return;

    const payload = dte.payload_json || {};
    const sup = suppliers.find(s => s.nit && s.nit.replace(/-/g, '') === (payload.emisor?.nit || '').replace(/-/g, ''));
    if (sup) setSupplierName(sup.name);
    else setSupplierName(payload.emisor?.nombre || dte.proveedor_nombre || '');

    const ctrl = payload.identificacion?.numeroControl || dte.documento_numero || '';
    const gen = payload.identificacion?.codigoGeneracion || dte.codigo_generacion || '';
    setDocNumber(ctrl);
    setGenerationCode(gen);
    setDocType(payload.identificacion?.tipoDte === '03' ? 'CCF' : 'FACTURA');

    if (dte.orden_origen) {
      setPedidoId(dte.orden_origen);
    }
    if (dte.warehouse_destino) {
      setWarehouse(dte.warehouse_destino);
    } else if (!warehouse && warehouses.length > 0) {
      setWarehouse(warehouses[0].name);
    }
    
    const rawItems = payload.cuerpoDocumento || [];
    const mappedItems: any[] = [];
    const uncreated: any[] = [];

    rawItems.forEach((item: any) => {
      const rawCode = (item.codigo || '').trim().toUpperCase();
      const mapping = savedMappings.find(m => m.supplierCode.trim().toUpperCase() === rawCode);
      const resolvedSku = mapping ? mapping.internalSku.trim().toUpperCase() : rawCode;

      const prod = inventory.find(i => 
        i.sku.trim().toUpperCase() === resolvedSku || 
        i.name.trim().toLowerCase() === (item.descripcion || '').trim().toLowerCase()
      );

      if (prod) {
        mappedItems.push({
          id: prod.id,
          sku: prod.sku,
          name: prod.name,
          quantity: parseFloat(item.cantidad) || 0,
          cost: parseFloat(item.precioUni) || 0
        });
      } else {
        uncreated.push({
          sku: resolvedSku || `TEMP-${Date.now().toString().slice(-4)}`,
          originalProviderCode: rawCode,
          name: item.descripcion || 'Producto sin nombre',
          quantity: parseFloat(item.cantidad) || 0,
          cost: parseFloat(item.precioUni) || 0
        });
      }
    });

    setPurchaseItems(mappedItems);
    if (uncreated.length > 0) {
      setUncreatedDteProducts(uncreated);
      setIsUncreatedDialogOpen(true);
      toast({ 
        title: "DTE Aplicado con Productos Pendientes", 
        description: `Se cargaron ${mappedItems.length} ítems y se detectaron ${uncreated.length} productos sin registrar.` 
      });
    } else {
      toast({ title: "Catálogo DTE Aplicado", description: "El formulario se ha rellenado con los datos del DTE. Por favor revise antes de guardar." });
    }
  };

  useEffect(() => {
    if (initialImportedDte && !loadingData) {
      setPendingDtes(prev => {
        if (prev.some(d => d.id === initialImportedDte.id)) return prev;
        return [initialImportedDte, ...prev];
      });
      setActiveTab('registro');
      handleSelectDte(initialImportedDte.id, initialImportedDte);
      onConsumeImportedDte?.();
    }
  }, [initialImportedDte, loadingData]);

  // Auto-abrir DTE generado desde botón "Reabastecer" (BMS / Orden de Compra)
  useEffect(() => {
    if (loadingData || typeof window === 'undefined') return;
    const autoDteId = localStorage.getItem('nexway_auto_open_dte_id');
    if (!autoDteId) return;
    const found = pendingDtes.find(d => d.id === autoDteId);
    if (found) {
      localStorage.removeItem('nexway_auto_open_dte_id');
      setActiveTab('registro');
      handleSelectDte(found.id, found);
    }
  }, [loadingData, pendingDtes]);

  // Recibir una Orden de Compra directamente desde OrdersTab ("Recibir →")
  useEffect(() => {
    if (!initialPurchaseOrder || loadingData) return;

    setActiveTab('registro');
    setEditingPurchaseId(null);
    setPedidoId(initialPurchaseOrder.code || '');

    // Intentar empatar proveedor exacto por nombre
    const matchedSup = suppliers.find(
      s => s.name.trim().toLowerCase() === (initialPurchaseOrder.supplier || '').trim().toLowerCase()
    );
    setSupplierName(matchedSup ? matchedSup.name : initialPurchaseOrder.supplier || '');

    // Intentar empatar bodega destino
    const matchedWh = warehouses.find(
      w => w.name.trim().toLowerCase() === (initialPurchaseOrder.destinationWarehouse || '').trim().toLowerCase()
    );
    if (matchedWh) {
      setWarehouse(matchedWh.name);
    } else if (initialPurchaseOrder.destinationWarehouse) {
      setWarehouse(initialPurchaseOrder.destinationWarehouse);
    }

    const mappedItems: PurchaseItem[] = (initialPurchaseOrder.items || []).map((item, idx) => ({
      id: item.sku || `OC-ITEM-${idx}`,
      sku: item.sku,
      name: item.name,
      quantity: Number(item.quantity) || 1,
      cost: Number(item.cost) || 0
    }));
    setPurchaseItems(mappedItems);

    toast({
      title: `Orden ${initialPurchaseOrder.code} cargada`,
      description: `Se precargaron ${mappedItems.length} producto(s) de ${initialPurchaseOrder.supplier}. Ingrese el número de factura/CCF para confirmar el ingreso.`
    });

    onConsumePurchaseOrder?.();
  }, [initialPurchaseOrder, loadingData]);

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
      toast({
        variant: 'destructive',
        title: 'Error en JSON de vinculaciones',
        description: err.message || 'Verifica la sintaxis JSON antes de importar.'
      });
    } finally {
      setSavingJsonMappings(false);
    }
  };

  const handleCreateUncreatedProduct = async (productIndex: number) => {
    const p = uncreatedDteProducts[productIndex];
    const cleanedSku = p.sku.trim().toUpperCase();
    const category = selectedUncreatedCategory[p.sku] || 'Inventario de Mercadería';
    const priceVal = parseFloat(selectedUncreatedPrice[p.sku] || '0') || (p.cost * 1.3); // default PVP is Cost * 1.3

    try {
      // Check database directly first to prevent unique key violation
      const { data: dbProduct, error: checkError } = await supabase
        .from('inventory')
        .select('*')
        .eq('sku', cleanedSku)
        .maybeSingle();

      const existingProduct = dbProduct || inventory.find(inv => inv.sku.trim().toUpperCase() === cleanedSku);

      if (existingProduct) {
        // If the SKU already exists, we just create the supplier mapping!
        if (p.originalProviderCode) {
          const cleanProvCode = p.originalProviderCode.trim().toUpperCase();
          const { error: mappingError } = await supabase
            .from('supplier_mappings')
            .upsert({
              supplier_code: cleanProvCode,
              internal_sku: existingProduct.sku
            });
          if (mappingError) throw mappingError;

          // Update local saved mappings
          setSavedMappings(prev => {
            const exists = prev.some(m => m.supplierCode === cleanProvCode);
            if (exists) {
              return prev.map(m => m.supplierCode === cleanProvCode ? { ...m, internalSku: existingProduct.sku } : m);
            }
            return [...prev, { supplierCode: cleanProvCode, internalSku: existingProduct.sku }];
          });
        }

        // Add to local inventory state if not present
        if (!inventory.some(inv => inv.sku.trim().toUpperCase() === existingProduct.sku.trim().toUpperCase())) {
          setInventory(prev => [...prev, {
            id: existingProduct.sku,
            sku: existingProduct.sku,
            name: existingProduct.name,
            category: existingProduct.category,
            price: parseFloat(existingProduct.price) || 0,
            quantity: 0,
            bodegas: {}
          }]);
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
            id: existingProduct.sku,
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
            sku: cleanedSku,
            name: p.name,
            category: category,
            price: priceVal
          })
          .select()
          .single();

        if (error) throw error;

        // 2. Insert equivalence in public.supplier_mappings
        if (p.originalProviderCode) {
          const cleanProvCode = p.originalProviderCode.trim().toUpperCase();
          const { error: mappingError } = await supabase
            .from('supplier_mappings')
            .upsert({
              supplier_code: cleanProvCode,
              internal_sku: cleanedSku
            });
          if (mappingError) throw mappingError;

          setSavedMappings(prev => {
            const exists = prev.some(m => m.supplierCode === cleanProvCode);
            if (exists) {
              return prev.map(m => m.supplierCode === cleanProvCode ? { ...m, internalSku: cleanedSku } : m);
            }
            return [...prev, { supplierCode: cleanProvCode, internalSku: cleanedSku }];
          });
        }

        // 3. Add to local inventory state
        const newInventoryItem = {
          id: cleanedSku,
          sku: cleanedSku,
          name: p.name,
          category: category,
          price: priceVal,
          quantity: 0,
          bodegas: {}
        };
        setInventory(prev => [...prev, newInventoryItem]);

        // 3. Add to cart
        setPurchaseItems(prev => {
          const existing = prev.find(item => item.sku === cleanedSku);
          if (existing) {
            return prev.map(item => 
              item.sku === cleanedSku ? { ...item, quantity: item.quantity + p.quantity, cost: p.cost } : item
            );
          }
          return [...prev, {
            id: cleanedSku,
            sku: cleanedSku,
            name: p.name,
            quantity: p.quantity,
            cost: p.cost
          }];
        });

        toast({ 
          title: "Producto Creado", 
          description: `El código ${cleanedSku} se creó y vinculó a la cuenta '${category}'.` 
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

  const handleCreateAllUncreatedProducts = async () => {
    if (uncreatedDteProducts.length === 0) return;
    setProcessingAllUncreated(true);
    try {
      const itemsToAdd: any[] = [];
      const mappingsToAdd: { supplier_code: string; internal_sku: string }[] = [];
      const newInventoryItems: any[] = [];

      for (const p of uncreatedDteProducts) {
        const cleanedSku = p.sku.trim().toUpperCase();
        const category = selectedUncreatedCategory[p.sku] || 'Inventario de Mercadería';
        const priceVal = parseFloat(selectedUncreatedPrice[p.sku] || '0') || (p.cost * 1.3);

        const { data: dbProduct } = await supabase
          .from('inventory')
          .select('*')
          .eq('sku', cleanedSku)
          .maybeSingle();

        const existingProduct = dbProduct || inventory.find(inv => inv.sku.trim().toUpperCase() === cleanedSku);

        if (existingProduct) {
          if (p.originalProviderCode) {
            const cleanProv = p.originalProviderCode.trim().toUpperCase();
            mappingsToAdd.push({ supplier_code: cleanProv, internal_sku: existingProduct.sku });
          }
          itemsToAdd.push({
            id: existingProduct.sku,
            sku: existingProduct.sku,
            name: existingProduct.name,
            quantity: p.quantity,
            cost: p.cost
          });
        } else {
          const { error: insErr } = await supabase
            .from('inventory')
            .insert({
              sku: cleanedSku,
              name: p.name,
              category: category,
              price: priceVal
            });
          if (insErr) throw insErr;

          if (p.originalProviderCode) {
            const cleanProv = p.originalProviderCode.trim().toUpperCase();
            mappingsToAdd.push({ supplier_code: cleanProv, internal_sku: cleanedSku });
          }

          newInventoryItems.push({
            id: cleanedSku,
            sku: cleanedSku,
            name: p.name,
            category: category,
            price: priceVal,
            quantity: 0,
            bodegas: {}
          });

          itemsToAdd.push({
            id: cleanedSku,
            sku: cleanedSku,
            name: p.name,
            quantity: p.quantity,
            cost: p.cost
          });
        }
      }

      // Upsert all mappings
      if (mappingsToAdd.length > 0) {
        await supabase.from('supplier_mappings').upsert(mappingsToAdd);
        setSavedMappings(prev => {
          const next = [...prev];
          mappingsToAdd.forEach(m => {
            const exIdx = next.findIndex(item => item.supplierCode === m.supplier_code);
            if (exIdx > -1) next[exIdx].internalSku = m.internal_sku;
            else next.push({ supplierCode: m.supplier_code, internalSku: m.internal_sku });
          });
          return next;
        });
      }

      // Update local inventory
      if (newInventoryItems.length > 0) {
        setInventory(prev => [...prev, ...newInventoryItems]);
      }

      // Merge into cart
      setPurchaseItems(prev => {
        const next = [...prev];
        itemsToAdd.forEach(newItem => {
          const exIdx = next.findIndex(i => i.sku === newItem.sku);
          if (exIdx > -1) {
            next[exIdx] = { ...next[exIdx], quantity: next[exIdx].quantity + newItem.quantity, cost: newItem.cost };
          } else {
            next.push(newItem);
          }
        });
        return next;
      });

      setUncreatedDteProducts([]);
      setIsUncreatedDialogOpen(false);
      toast({
        title: "¡Productos Procesados con Éxito! ✨",
        description: `Se crearon y vincularon ${itemsToAdd.length} productos y se añadieron a la lista de compra.`
      });
    } catch (err: any) {
      console.error(err);
      toast({ variant: "destructive", title: "Error al procesar lote", description: err.message || "Error al registrar productos." });
    } finally {
      setProcessingAllUncreated(false);
    }
  };

  // Manejar cambios de sucursal activa (sin disparar doble carga en el montaje)
  useEffect(() => {
    const handleBranchChanged = () => {
      if (typeof window !== 'undefined') {
        const nextBranch = localStorage.getItem('active_branch_id');
        setActiveBranchId(prev => (prev === nextBranch ? prev : nextBranch));
      }
    };
    window.addEventListener('branchChanged', handleBranchChanged);
    return () => window.removeEventListener('branchChanged', handleBranchChanged);
  }, []);

  useEffect(() => {
    setHistoryLoaded(false);
    setCreditNotesLoaded(false);
    loadPurchasesData();
  }, [activeBranchId]);

  // Carga bajo demanda según la subpestaña que abra el usuario
  useEffect(() => {
    if (activeTab === 'historial' && !historyLoaded) {
      loadPurchasesHistory();
    }
    if (activeTab === 'credito') {
      if (!creditNotesLoaded) loadCreditNotes();
      if (!historyLoaded) loadPurchasesHistory();
    }
  }, [activeTab, historyLoaded, creditNotesLoaded]);

  const processCreditNoteJsonText = (jsonText: string) => {
    try {
      const json = JSON.parse(jsonText);
      const id = json.identificacion || {};
      const emi = json.emisor || {};
      const res = json.resumen || {};
      const docRel = json.documentoRelacionado || {};
      const rawItems = json.cuerpoDocumento || [];

      // Match supplier
      const matchedSup = suppliers.find(s => 
        (s.nit && s.nit.replace(/-/g, '') === (emi.nit || '').replace(/-/g, '')) ||
        (s.name && s.name.toLowerCase() === (emi.nombre || '').toLowerCase())
      );

      // Match related purchase
      const relDocNum = docRel.numeroDocumento || docRel.codigoGeneracion || '';
      const matchedPurchase = purchasesHistory.find(p => 
        (p.document_number && relDocNum && p.document_number.toLowerCase().includes(relDocNum.toLowerCase())) ||
        (p.order_id && relDocNum && p.order_id.toLowerCase().includes(relDocNum.toLowerCase())) ||
        (matchedSup && p.supplier_id === matchedSup.id)
      );

      const items = rawItems.map((item: any) => ({
        sku: item.codigo || 'S/N',
        name: item.descripcion || 'Sin Descripción',
        quantity: parseFloat(item.cantidad) || 0,
        price: parseFloat(item.precioUni) || 0,
        total: parseFloat(item.ventaGravada || item.compraGravada) || (parseFloat(item.cantidad) * parseFloat(item.precioUni)) || 0,
        selected: true,
        returnQty: parseFloat(item.cantidad) || 0
      }));

      const totalAmount = parseFloat(res.totalPagar || res.montoTotalOperacion || res.subTotal || 0);

      setParsedCreditNote({
        documentNumber: id.numeroControl || id.codigoGeneracion || `CN-${Date.now()}`,
        codigoGeneracion: id.codigoGeneracion || '',
        supplierId: matchedSup ? matchedSup.id : null,
        supplierName: matchedSup ? matchedSup.name : (emi.nombre || 'Proveedor Desconocido'),
        supplierNit: emi.nit || '',
        relatedDocNumber: relDocNum,
        matchedPurchaseId: matchedPurchase ? matchedPurchase.id : '',
        matchedPurchaseDoc: matchedPurchase ? (matchedPurchase.document_number || matchedPurchase.order_id) : relDocNum,
        applicationMode: 'AUTOMATICO_FINANCIERO', // 'AUTOMATICO_FINANCIERO' | 'PRODUCTO_ESPECIFICO'
        targetWarehouseId: warehouses.length > 0 ? warehouses[0].id : '',
        total: totalAmount,
        items: items
      });

      toast({ 
        title: "Nota de Crédito DTE-05 Cargada ✨", 
        description: `DTE ${id.numeroControl || id.codigoGeneracion || ''} de ${emi.nombre || 'Proveedor'}. Verifique la aplicación antes de confirmar.` 
      });
    } catch (err: any) {
      console.error(err);
      toast({ variant: "destructive", title: "Error al procesar JSON", description: err.message || "Formato de DTE nota de crédito inválido." });
    }
  };

  const handleCreditNoteJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      processCreditNoteJsonText(event.target?.result as string);
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

      const totalNc = parsedCreditNote.total || 0;
      const gravada = totalNc / 1.13;
      const iva13 = totalNc - gravada;
      const selectedWh = warehouses.find(w => w.id === parsedCreditNote.targetWarehouseId) || (warehouses.length > 0 ? warehouses[0] : null);

      // 1. Si es Devolución de Productos Físicos, ajustar inventario y Kardex
      if (parsedCreditNote.applicationMode === 'PRODUCTO_ESPECIFICO' && selectedWh) {
        for (const item of parsedCreditNote.items) {
          if (item.selected && item.returnQty > 0) {
            // Buscar stock actual
            const { data: stockRow } = await supabase
              .from('inventory_stock')
              .select('quantity')
              .eq('warehouse_id', selectedWh.id)
              .eq('sku', item.sku)
              .maybeSingle();

            const currentStock = parseFloat(stockRow?.quantity) || 0;
            const newStock = currentStock - item.returnQty;

            await supabase.from('inventory_stock').upsert({
              sku: item.sku,
              warehouse_id: selectedWh.id,
              quantity: Math.max(0, newStock)
            }, { onConflict: 'sku,warehouse_id' });
          }
        }
      }

      // 2. Registrar Partida Contable Automática en Journal (Partida Doble)
      const journalLines = [
        { account_code: '2101', account_name: 'Proveedores Locales C/P', debit: totalNc, credit: 0 },
        { account_code: '1104', account_name: 'IVA Crédito Fiscal (13%)', debit: 0, credit: iva13 },
        { 
          account_code: parsedCreditNote.applicationMode === 'PRODUCTO_ESPECIFICO' ? '1105' : '5101', 
          account_name: parsedCreditNote.applicationMode === 'PRODUCTO_ESPECIFICO' ? 'Inventarios de Mercadería' : 'Descuentos / Rebajas sobre Compras', 
          debit: 0, 
          credit: gravada 
        }
      ];

      try {
        await postDoubleEntryJournal({
          description: `Nota de Crédito Proveedor [${parsedCreditNote.documentNumber}] - ${parsedCreditNote.supplierName} (Ref: ${parsedCreditNote.matchedPurchaseDoc || 'Compra'})`,
          amount: totalNc,
          type: 'Avanzado',
          branchId: activeBranchId || null,
          lines: journalLines
        });
      } catch (jErr) {
        console.warn('Error al registrar partida de NC en journal:', jErr);
      }

      // 2.5 Vincular directamente a CXP de la factura de compra seleccionada (rebajar saldo pendiente)
      if (parsedCreditNote.matchedPurchaseId && parsedCreditNote.matchedPurchaseId !== 'manual') {
        try {
          const { data: cxpCfg } = await supabase
            .from('system_config')
            .select('value')
            .eq('key', 'cxp_payments_registry')
            .maybeSingle();
          const currentPays: any[] = Array.isArray(cxpCfg?.value) ? cxpCfg.value : [];
          const ncPay = {
            id: `NC-COMPRA-${Date.now().toString().slice(-6)}`,
            purchase_id: parsedCreditNote.matchedPurchaseId,
            amount: totalNc,
            method: 'Nota de Crédito Compra',
            reference: parsedCreditNote.documentNumber,
            notes: `Aplicación de NC ${parsedCreditNote.documentNumber} (${parsedCreditNote.supplierName})`,
            created_at: new Date().toISOString(),
          };
          const nextPays = [...currentPays, ncPay];
          await supabase.from('system_config').upsert({ key: 'cxp_payments_registry', value: nextPays });

          const matchedPurch = purchasesHistory.find((p: any) => p.id === parsedCreditNote.matchedPurchaseId);
          if (matchedPurch) {
            const totalPaidNow = nextPays
              .filter(p => p.purchase_id === matchedPurch.id)
              .reduce((s, p) => s + (Number(p.amount) || 0), 0);
            if (Number(matchedPurch.total || 0) - totalPaidNow <= 0.02) {
              await supabase.from('purchases').update({ payment_status: 'PAGADO' }).eq('id', matchedPurch.id);
            }
          }
        } catch (cxpErr) {
          console.warn('Error aplicando rebaja de NC en CXP:', cxpErr);
        }
      }

      // 3. Insertar registro en public.supplier_credit_notes
      const { error } = await supabase
        .from('supplier_credit_notes')
        .insert({
          supplier_id: sId,
          document_number: parsedCreditNote.documentNumber,
          type: parsedCreditNote.applicationMode === 'PRODUCTO_ESPECIFICO' ? 'DEVOLUCION' : 'AJUSTE_PRECIO',
          total: totalNc,
          items: parsedCreditNote.items,
          branch_id: activeBranchId || null
        });

      if (error) throw error;

      // 4. Verificar si había un aviso pendiente en el BMS esperando esta Nota de Crédito
      const resolvedAlerts = await resolveMatchingCreditNoteAlerts({
        type: 'COMPRA_PROVEEDOR',
        entityName: parsedCreditNote.supplierName || '',
        invoiceRef: parsedCreditNote.matchedPurchaseDoc || parsedCreditNote.relatedDocNumber || '',
        resolvedDocNumber: parsedCreditNote.documentNumber,
      });

      toast({ 
        title: resolvedAlerts.length > 0
          ? `🔔 ¡Cayó Nota de Crédito Esperada! (${parsedCreditNote.documentNumber})`
          : '¡Nota de Crédito Aplicada con Éxito! 🧾', 
        description: resolvedAlerts.length > 0
          ? `Se vinculó a la factura, se rebajó CXP por $${totalNc.toFixed(2)} y se cerró automáticamente el aviso pendiente del BMS (${resolvedAlerts[0].itemsSummary}).`
          : `Se aplicó la NC ${parsedCreditNote.documentNumber}, se rebajó el saldo en CXP y se generó el asiento contable.`
      });

      setParsedCreditNote(null);
      if (creditNoteFileInputRef.current) creditNoteFileInputRef.current.value = '';
      await loadCreditNotes();
      await loadPurchasesData();
    } catch (err: any) {
      console.error(err);
      toast({ variant: "destructive", title: "Error al guardar Nota de Crédito", description: err.message });
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

  const filteredUsers = useMemo(() => {
    if (!systemUsers) return [];
    if (!userSearch.trim()) return systemUsers;
    const q = userSearch.toLowerCase();
    return systemUsers.filter(u => 
      (u.full_name && u.full_name.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.role && u.role.toLowerCase().includes(q))
    );
  }, [systemUsers, userSearch]);

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
      
      const rawDoc = p.document_number || '';
      if (rawDoc.includes('|')) {
        const parts = rawDoc.split('|').map((s: string) => s.trim());
        setDocNumber(parts[0] || '');
        setGenerationCode(parts[1] || '');
      } else if (rawDoc.startsWith('DTE-') || rawDoc.startsWith('FAC-') || rawDoc.startsWith('CCF-') || rawDoc.length < 30) {
        setDocNumber(rawDoc);
        setGenerationCode('');
      } else {
        setDocNumber('');
        setGenerationCode(rawDoc);
      }
      
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
      toast({ variant: "destructive", title: "Encargado Requerido", description: "Por favor seleccione o ingrese el encargado de ingreso." });
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

      const fullDocumentNumber = [docNumber.trim(), generationCode.trim()].filter(Boolean).join(' | ');
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
            document_number: fullDocumentNumber,
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
            document_number: fullDocumentNumber,
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

      // 3. Update stock if status === 'CERRADA' (consulta directa solo para los SKUs de esta compra)
      if (status === 'CERRADA') {
        const skusInOrder = Array.from(new Set(purchaseItems.map(i => i.sku)));
        const { data: existingStockRows } = await supabase
          .from('inventory_stock')
          .select('sku, quantity')
          .eq('warehouse_id', selectedWh.id)
          .in('sku', skusInOrder);

        const stockBySkuMap = new Map<string, number>();
        (existingStockRows || []).forEach((r: any) => {
          stockBySkuMap.set(r.sku, parseFloat(r.quantity) || 0);
        });

        const stockUpserts = purchaseItems.map(item => ({
          sku: item.sku,
          warehouse_id: selectedWh.id,
          quantity: (stockBySkuMap.get(item.sku) || 0) + item.quantity
        }));

        const { error: stockErr } = await supabase
          .from('inventory_stock')
          .upsert(stockUpserts, { onConflict: 'sku,warehouse_id' });

        if (stockErr) throw stockErr;

        // Marcar cualquier DTE pendiente coincidente (por ID, N° Control o UUID) como PROCESADO y quitarlo de la bandeja activa
        try {
          const cleanCtrl = docNumber.trim().toUpperCase();
          const cleanUuid = generationCode.trim().toUpperCase();
          const matchesDte = (d: any) =>
            (selectedDteId !== 'none' && d?.id === selectedDteId) ||
            (cleanCtrl && String(d?.documento_numero || d?.payload_json?.identificacion?.numeroControl || '').trim().toUpperCase() === cleanCtrl) ||
            (cleanUuid && String(d?.codigo_generacion || d?.payload_json?.identificacion?.codigoGeneracion || '').trim().toUpperCase() === cleanUuid);

          setPendingDtes(prev => prev.filter(d => !matchesDte(d)));

          const { data: cfg } = await supabase
            .from('system_config')
            .select('value')
            .eq('key', 'gmail_pending_dtes')
            .maybeSingle();
          if (Array.isArray(cfg?.value)) {
            const updated = cfg.value.map((d: any) =>
              matchesDte(d) ? { ...d, estado: 'PROCESADO' } : d
            );
            await supabase
              .from('system_config')
              .upsert({ key: 'gmail_pending_dtes', value: updated }, { onConflict: 'key' });
          }
        } catch (dteErr) {
          console.warn('No se pudo actualizar el estado del DTE en system_config:', dteErr);
        }

        // Cerrar automáticamente la Orden de Compra vinculada (OC-..., NEXBOT-..., etc.) Y cualquier orden pendiente cuyos SKUs ya se ingresaron
        try {
          const purchasedSkuSet = new Set(purchaseItems.map(i => String(i.sku).trim().toUpperCase()));

          if (pedidoId && pedidoId.trim()) {
            await supabase
              .from('supplier_orders')
              .update({ status: 'RECIBIDA' })
              .eq('code', pedidoId.trim());
          }

          const { data: openOrders } = await supabase
            .from('supplier_orders')
            .select('id, code, items, status')
            .in('status', ['PENDIENTE', 'ENVIADA']);

          if (Array.isArray(openOrders) && openOrders.length > 0) {
            const fulfilledIds = openOrders
              .filter((ord: any) => {
                if (pedidoId && ord.code === pedidoId.trim()) return true;
                const ordItems = Array.isArray(ord.items) ? ord.items : [];
                if (ordItems.length === 0) return false;
                return ordItems.every((it: any) =>
                  purchasedSkuSet.has(String(it.sku || '').trim().toUpperCase())
                );
              })
              .map((ord: any) => ord.id);

            if (fulfilledIds.length > 0) {
              await supabase
                .from('supplier_orders')
                .update({ status: 'RECIBIDA' })
                .in('id', fulfilledIds);
            }
          }
        } catch (ocErr) {
          console.warn('No se pudo actualizar estado de la orden de compra:', ocErr);
        }

        // 4. Registro Contable Automático en Journal (Partida Doble Compras El Salvador)
        try {
          const gravadaCompra = totalPurchase / 1.13;
          const ivaCreditoCompra = totalPurchase - gravadaCompra;

          const purchaseJournalLines: any[] = [
            {
              account_code: '1105',
              account_name: 'Inventarios de Mercadería',
              debit: gravadaCompra,
              credit: 0
            },
            {
              account_code: '1104',
              account_name: 'IVA Crédito Fiscal (13%)',
              debit: ivaCreditoCompra,
              credit: 0
            }
          ];

          if (paymentMethod === 'Credito') {
            purchaseJournalLines.push({
              account_code: '2101',
              account_name: 'Proveedores Locales C/P',
              debit: 0,
              credit: totalPurchase
            });
          } else if (paymentMethod === 'Transferencia') {
            purchaseJournalLines.push({
              account_code: '1102',
              account_name: 'Bancos e Instituciones Financieras',
              debit: 0,
              credit: totalPurchase
            });
          } else {
            purchaseJournalLines.push({
              account_code: '1101',
              account_name: 'Efectivo y Equivalentes de Efectivo',
              debit: 0,
              credit: totalPurchase
            });
          }

          await postDoubleEntryJournal({
            description: `Compra Proveedor [${fullDocumentNumber || pedidoId}] - ${supplierName || 'Proveedor Local'} (${paymentMethod})`,
            amount: totalPurchase,
            type: 'Avanzado',
            branchId: activeBranchId || null,
            lines: purchaseJournalLines
          });
        } catch (jErr) {
          console.warn('Error al registrar asiento contable de compra:', jErr);
        }

        toast({ title: "Compra Cerrada", description: `Stock y partida contable registrados en la bodega '${warehouse}'.` });
      } else {
        toast({ title: "Borrador Guardado", description: "La compra está pendiente. El stock NO ha sido afectado." });
      }

      setPurchaseItems([]);
      setDocNumber('');
      setGenerationCode('');
      setEnteredBy('');
      setSupplierName('');
      setSelectedDteId('none');
      setPaymentMethod('Efectivo');
      setCreditDays('');
      setEditingPurchaseId(null);
      const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randPart = Math.floor(1000 + Math.random() * 9000);
      setPedidoId(`ORD-${datePart}-${randPart}`);
      if (historyLoaded) {
        await loadPurchasesHistory();
      }
      // Refrescar el BMS de inmediato para que desaparezcan las alertas de stock / órdenes ya ingresadas
      auditSystem().catch(() => {});

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

  const handleCancelPurchase = async (purchase: any) => {
    if (!window.confirm(`¿Está seguro de que desea anular/eliminar la compra ${purchase.order_id}?`)) {
      return;
    }
    setLoading(true);
    try {
      if (purchase.status === 'CERRADA') {
        // 1. Obtener los items de la compra
        const { data: items, error: itemsErr } = await supabase
          .from('purchase_items')
          .select('*')
          .eq('purchase_id', purchase.id);
        if (itemsErr) throw itemsErr;

        // 2. Descontar las cantidades del inventario en la bodega
        for (const item of items || []) {
          const { data: stockRow } = await supabase
            .from('inventory_stock')
            .select('quantity')
            .eq('sku', item.sku)
            .eq('warehouse_id', purchase.warehouse_id)
            .maybeSingle();

          const currentQty = stockRow?.quantity || 0;
          const newQty = Math.max(0, currentQty - item.quantity);

          const { error: stockErr } = await supabase
            .from('inventory_stock')
            .upsert({
              sku: item.sku,
              warehouse_id: purchase.warehouse_id,
              quantity: newQty
            }, {
              onConflict: 'sku,warehouse_id'
            });
          if (stockErr) throw stockErr;
        }

        // 3. Cambiar estado a 'ANULADA'
        const { error: updateErr } = await supabase
          .from('purchases')
          .update({ status: 'ANULADA' })
          .eq('id', purchase.id);
        if (updateErr) throw updateErr;

        toast({ title: "Compra Anulada", description: "Se revirtió el stock y se marcó la compra como ANULADA." });
      } else {
        // Si es borrador, la eliminamos por completo
        const { error: delItemsErr } = await supabase
          .from('purchase_items')
          .delete()
          .eq('purchase_id', purchase.id);
        if (delItemsErr) throw delItemsErr;

        const { error: delPurchErr } = await supabase
          .from('purchases')
          .delete()
          .eq('id', purchase.id);
        if (delPurchErr) throw delPurchErr;

        toast({ title: "Borrador Eliminado", description: "El borrador de compra fue eliminado del sistema." });
      }
      await loadPurchasesHistory();
    } catch (err: any) {
      console.error(err);
      toast({ variant: "destructive", title: "Error al anular compra", description: err.message });
    } finally {
      setLoading(false);
    }
  };
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        let itemsToLoad: any[] = [];
        let uncreated: any[] = [];
        let detectedCount = 0;

        // 1. Recopilar todos los códigos candidatos del archivo para validar contra la Base de Datos
        const candidateCodes: string[] = [];
        if (json.identificacion && json.emisor && json.cuerpoDocumento) {
          json.cuerpoDocumento?.forEach((item: any) => {
            const rawCode = (item.codigo || '').trim().toUpperCase();
            if (rawCode) {
              candidateCodes.push(rawCode);
              const mapping = savedMappings.find(m => m.supplierCode.trim().toUpperCase() === rawCode);
              if (mapping && mapping.internalSku) {
                candidateCodes.push(mapping.internalSku.trim().toUpperCase());
              }
            }
          });
        } else if (Array.isArray(json)) {
          json.forEach(item => {
            const rawCode = (item.sku || item.codigo || '').trim().toUpperCase();
            if (rawCode) {
              candidateCodes.push(rawCode);
              const mapping = savedMappings.find(m => m.supplierCode.trim().toUpperCase() === rawCode);
              if (mapping && mapping.internalSku) {
                candidateCodes.push(mapping.internalSku.trim().toUpperCase());
              }
            }
          });
        }

        // 2. Consultar directamente a Supabase para rellenar/actualizar el estado de inventario local
        const currentInventory = [...inventory];
        if (candidateCodes.length > 0) {
          const { data: dbProducts } = await supabase
            .from('inventory')
            .select('*')
            .in('sku', Array.from(new Set(candidateCodes)));

          if (dbProducts && dbProducts.length > 0) {
            dbProducts.forEach(dbProd => {
              if (!currentInventory.some(p => p.sku.trim().toUpperCase() === dbProd.sku.trim().toUpperCase())) {
                currentInventory.push({
                  id: dbProd.sku,
                  sku: dbProd.sku,
                  name: dbProd.name,
                  category: dbProd.category,
                  price: parseFloat(dbProd.price) || 0,
                  quantity: 0,
                  bodegas: {}
                });
              }
            });
            setInventory(currentInventory);
          }
        }

        // 3. Procesar los ítems
        if (json.identificacion && json.emisor && json.cuerpoDocumento) {
          const emisorNombre = String(json.emisor.nombre || json.emisor.nombreComercial || '').trim();
          const emisorNitClean = String(json.emisor.nit || '').replace(/-/g, '').trim();
          const existingSup = suppliers.find(
            (s: any) =>
              (emisorNitClean && String(s.nit || '').replace(/-/g, '').trim() === emisorNitClean) ||
              (emisorNombre && String(s.name || '').trim().toLowerCase() === emisorNombre.toLowerCase())
          );
          if (existingSup) {
            setSupplierName(existingSup.name);
          } else {
            setSupplierName(emisorNombre);
            if (emisorNombre) {
              const dirObj = json.emisor.direccion;
              const addrStr =
                typeof dirObj === 'string'
                  ? dirObj
                  : dirObj?.complemento || '';
              setPendingJsonSupplier({
                name: emisorNombre,
                nit: String(json.emisor.nit || ''),
                nrc: String(json.emisor.nrc || ''),
                giro: String(json.emisor.descActividad || ''),
                address: String(addrStr || ''),
                email: String(json.emisor.correo || ''),
                phone: String(json.emisor.telefono || ''),
              });
            }
          }
          const dteGen = json.identificacion.codigoGeneracion || '';
          const dteCtrl = json.identificacion.numeroControl || '';
          setDocNumber(dteCtrl);
          setGenerationCode(dteGen);
          setDocType(json.identificacion.tipoDte === '03' ? 'CCF' : 'FACTURA');
          
          json.cuerpoDocumento?.forEach((item: any) => {
            const rawCode = (item.codigo || '').trim().toUpperCase();
            const mapping = savedMappings.find(m => m.supplierCode.trim().toUpperCase() === rawCode);
            const resolvedSku = mapping ? mapping.internalSku.trim().toUpperCase() : rawCode;

            const product = currentInventory?.find((p: any) => 
              p.sku.trim().toUpperCase() === resolvedSku || 
              p.name.trim().toLowerCase() === (item.descripcion || '').trim().toLowerCase()
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
            const rawCode = (item.sku || item.codigo || '').trim().toUpperCase();
            const mapping = savedMappings.find(m => m.supplierCode.trim().toUpperCase() === rawCode);
            const resolvedSku = mapping ? mapping.internalSku.trim().toUpperCase() : rawCode;

            const product = currentInventory?.find((p: any) => p.sku.trim().toUpperCase() === resolvedSku);
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
    <div className="w-full transition-colors duration-200">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList className="bg-muted/50 dark:bg-white/5 border border-border dark:border-white/10 p-1 h-9 rounded-xl gap-1">
            <TabsTrigger value="registro" className="rounded-lg px-3 py-1 font-bold text-xs data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all">
              <ClipboardList size={13} className="mr-1.5" /> 1. Ingresar Factura / DTE
            </TabsTrigger>
            <TabsTrigger value="historial" className="rounded-lg px-3 py-1 font-bold text-xs data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all">
              <Calendar size={13} className="mr-1.5" /> 2. Historial de Ingresos
            </TabsTrigger>
            <TabsTrigger value="vinculacion" className="rounded-lg px-3 py-1 font-bold text-xs data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all">
              <Link2 size={13} className="mr-1.5" /> 3. Vinculación de Códigos
            </TabsTrigger>
            <TabsTrigger value="credito" className="rounded-lg px-3 py-1 font-bold text-xs data-[state=active]:bg-indigo-600 data-[state=active]:text-white transition-all">
              <FileText size={13} className="mr-1.5" /> 4. Notas de Crédito
            </TabsTrigger>
          </TabsList>

          {activeTab === 'registro' && (
            <div className="flex items-center gap-2 text-[11px]">
              {editingPurchaseId && (
                <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-500/30 font-bold">
                  Editando Borrador
                </Badge>
              )}
              <span className="font-mono text-[11px] px-2.5 py-1 rounded-lg bg-card dark:bg-white/5 border border-border dark:border-white/10 text-muted-foreground">
                Control: <strong className="text-foreground">{pedidoId}</strong>
              </span>
            </div>
          )}
        </div>

        <TabsContent value="registro" className="m-0 outline-none w-full space-y-3">
          {/* AVISO DE AUTORIZACIÓN PARA CREAR PROVEEDOR NUEVO DESDE JSON DTE */}
          {pendingJsonSupplier && (
            <div className="rounded-2xl border-2 border-amber-500/50 bg-amber-50/70 dark:bg-amber-950/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
              <div className="space-y-0.5 text-xs">
                <div className="font-black text-amber-800 dark:text-amber-300 uppercase text-[11px]">
                  ⚠️ Proveedor Nuevo Detectado en JSON DTE — Requiere tu Autorización
                </div>
                <p className="text-foreground font-bold">
                  {pendingJsonSupplier.name}
                  {pendingJsonSupplier.nit ? ` · NIT: ${pendingJsonSupplier.nit}` : ''}
                  {pendingJsonSupplier.nrc ? ` · NRC: ${pendingJsonSupplier.nrc}` : ''}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  No existe en tu Directorio de Proveedores. ¿Autorizas registrarlo automáticamente con los datos del JSON?
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setPendingJsonSupplier(null)}
                  className="h-8 rounded-xl text-xs"
                >
                  Omitir
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={creatingJsonSupplier}
                  onClick={handleAuthorizeCreateJsonSupplier}
                  className="h-8 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-1.5"
                >
                  {creatingJsonSupplier ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  Autorizar y Crear Proveedor
                </Button>
              </div>
            </div>
          )}

          {/* BARRA RÁPIDA DE FACTURAS PENDIENTES EN INGRESO DE COMPRA */}
          <div className="rounded-xl bg-card border border-border/70 px-3.5 py-2 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs">
                <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-bold text-[10px]">
                  {pendingPurchasesList.length} Factura(s) Pendientes
                </Badge>
                <span className="text-[11px] text-muted-foreground">
                  Listado rápido de facturas al crédito o pendientes de liquidar.
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    loadPendingInvoicesQuick();
                    setShowPendingInvoicesList(prev => !prev);
                  }}
                  className="h-7 px-2.5 text-[11px] font-bold rounded-lg"
                >
                  {showPendingInvoicesList ? 'Ocultar Listado' : 'Ver Facturas Pendientes'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => router.push('/finanzas?tab=cxp')}
                  className="h-7 px-2.5 text-[11px] font-bold rounded-lg text-indigo-600 dark:text-indigo-400"
                >
                  Ir a CXP →
                </Button>
              </div>
            </div>

            {showPendingInvoicesList && (
              <div className="mt-2.5 pt-2.5 border-t border-border/60 overflow-x-auto max-h-52">
                {pendingPurchasesList.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-3 text-center">
                    No hay facturas pendientes de pago en este momento.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px] font-black uppercase">Documento</TableHead>
                        <TableHead className="text-[10px] font-black uppercase">Proveedor</TableHead>
                        <TableHead className="text-[10px] font-black uppercase">Fecha</TableHead>
                        <TableHead className="text-[10px] font-black uppercase">Plazo</TableHead>
                        <TableHead className="text-right text-[10px] font-black uppercase">Total ($)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingPurchasesList.map((p: any) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-mono text-xs font-bold">{p.document_number || p.order_id || 'S/N'}</TableCell>
                          <TableCell className="text-xs font-semibold">{p.suppliers?.name || p.supplier_name || 'Proveedor'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {p.created_at ? new Date(p.created_at).toLocaleDateString('es-SV') : '—'}
                          </TableCell>
                          <TableCell className="text-xs">{p.credit_days ? `${p.credit_days} días` : p.payment_method || 'Pendiente'}</TableCell>
                          <TableCell className="text-right font-mono text-xs font-black text-rose-600 dark:text-rose-400">
                            ${Number(p.total || 0).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
            {/* COLUMNA IZQUIERDA (4 cols en desktop, 100% en tablet): PASO 1 — DATOS DEL DOCUMENTO Y PROVEEDOR */}
            <div className="xl:col-span-4 rounded-2xl bg-card dark:bg-white/[0.04] border border-border dark:border-white/10 overflow-hidden shadow-sm">
              <div className="px-4 py-2.5 bg-indigo-500/15 border-b border-indigo-500/25 flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wide text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                  <ClipboardList size={14} /> Paso 1 · Datos de Factura
                </span>
                {warehouse && (
                  <Badge variant="outline" className="text-[9.5px] font-bold border-indigo-500/30 text-indigo-600 dark:text-indigo-300">
                    {warehouse}
                  </Badge>
                )}
              </div>

              <div className="p-3.5 space-y-3">
                {pendingDtes.length > 0 && (
                  <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/25">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase text-indigo-500 dark:text-indigo-300 mb-1">
                      <span className="flex items-center gap-1"><FileJson size={12} /> DTEs Pendientes (Gmail)</span>
                      <Badge variant="outline" className="text-[9px] h-4 font-mono border-indigo-500/40">
                        {pendingDtes.length}
                      </Badge>
                    </div>
                    <Select value={selectedDteId} onValueChange={handleSelectDte}>
                      <SelectTrigger className="h-8 text-xs bg-background dark:bg-black/40 border-indigo-500/30">
                        <SelectValue placeholder="Seleccione un DTE..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        <SelectItem value="none" className="italic text-muted-foreground">Ninguno (Ingreso Manual)</SelectItem>
                        {pendingDtes.map((dte) => (
                          <SelectItem key={dte.id} value={dte.id}>
                            {dte.documento_numero} - {dte.proveedor_nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* PROVEEDOR */}
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 flex items-center justify-between">
                    <span>Proveedor</span>
                    {supplierName && <span className="text-[9.5px] text-emerald-500 font-mono">✓ Seleccionado</span>}
                  </div>
                  <div className="flex gap-1.5">
                    <div className="flex items-center gap-2 bg-background dark:bg-white/5 border border-border dark:border-white/10 rounded-lg px-2.5 h-9 flex-1 focus-within:border-indigo-500/60">
                      <Building2 size={13} className="text-muted-foreground shrink-0" />
                      <Input
                        placeholder="Seleccione o escriba proveedor..."
                        value={supplierName}
                        onChange={e => setSupplierName(e.target.value)}
                        className="h-full bg-transparent border-none text-xs p-0 shadow-none focus-visible:ring-0 font-semibold"
                      />
                    </div>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 rounded-lg">
                          <Search size={13} />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 p-0 shadow-2xl" align="end">
                        <div className="p-2.5 border-b border-border">
                          <Input
                            placeholder="Buscar por nombre o NIT..."
                            value={supplierSearch}
                            onChange={e => setSupplierSearch(e.target.value)}
                            className="h-8 text-xs"
                          />
                        </div>
                        <ScrollArea className="h-60">
                          <div className="p-1.5 space-y-0.5">
                            {filteredSuppliers.length === 0 ? (
                              <div className="p-4 text-center text-muted-foreground text-xs italic">No se encontraron proveedores</div>
                            ) : filteredSuppliers.map((s: any) => (
                              <div
                                key={s.id}
                                onClick={() => selectSupplier(s)}
                                className="p-2 hover:bg-accent cursor-pointer rounded-lg flex items-center justify-between"
                              >
                                <div>
                                  <span className="text-xs font-bold block">{s.name}</span>
                                  <span className="text-[10px] text-muted-foreground font-mono">{s.nit ? `NIT: ${s.nit}` : 'Sin NIT'}</span>
                                </div>
                                {supplierName === s.name && <Check size={14} className="text-emerald-500" />}
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* TIPO DOC + BODEGA DESTINO */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Tipo Documento</div>
                    <Select value={docType} onValueChange={(v: any) => setDocType(v)}>
                      <SelectTrigger className="h-9 text-xs font-semibold bg-background dark:bg-white/5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FACTURA">FACTURA (01)</SelectItem>
                        <SelectItem value="CCF">CCF (03)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Bodega Destino</div>
                    <Select value={warehouse} onValueChange={setWarehouse}>
                      <SelectTrigger className="h-9 text-xs font-semibold bg-background dark:bg-white/5">
                        <SelectValue placeholder="Seleccione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouses?.map((wh: any) => (
                          <SelectItem key={wh.id} value={wh.name}>{wh.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* N° CONTROL DTE + UUID GENERACIÓN */}
                <div className="space-y-2 pt-1 border-t border-border/60 dark:border-white/5">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 flex justify-between">
                      <span>N° Factura / Control DTE</span>
                      <span className="text-[9px] font-mono text-indigo-400">Control</span>
                    </div>
                    <div className="flex items-center gap-2 bg-background dark:bg-white/5 border border-border dark:border-white/10 rounded-lg px-2.5 h-9 focus-within:border-indigo-500/60">
                      <FileText size={13} className="text-muted-foreground shrink-0" />
                      <Input
                        placeholder="DTE-03-M001P001-000000000000123"
                        value={docNumber}
                        onChange={e => setDocNumber(e.target.value)}
                        className="h-full bg-transparent border-none text-xs font-mono p-0 shadow-none focus-visible:ring-0"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 flex justify-between">
                      <span>Código de Generación</span>
                      <span className="text-[9px] font-mono text-muted-foreground">UUID v4</span>
                    </div>
                    <div className="flex items-center gap-2 bg-background dark:bg-white/5 border border-border dark:border-white/10 rounded-lg px-2.5 h-9 focus-within:border-indigo-500/60">
                      <FileCode size={13} className="text-muted-foreground shrink-0" />
                      <Input
                        placeholder="36C4A2D8-724B-4D3C-856E-85F0E9C7BA9A"
                        value={generationCode}
                        onChange={e => setGenerationCode(e.target.value)}
                        className="h-full bg-transparent border-none text-xs font-mono p-0 shadow-none focus-visible:ring-0"
                      />
                    </div>
                  </div>
                </div>

                {/* ENCARGADO DE INGRESO */}
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 flex justify-between">
                    <span>Encargado de Ingreso</span>
                    <span className="text-[9px] font-mono text-indigo-400">Operador</span>
                  </div>
                  <div className="flex gap-1.5">
                    <div className="flex items-center gap-2 bg-background dark:bg-white/5 border border-border dark:border-white/10 rounded-lg px-2.5 h-9 flex-1">
                      <User size={13} className="text-muted-foreground shrink-0" />
                      <Input
                        placeholder="Nombre del encargado..."
                        value={enteredBy}
                        onChange={e => setEnteredBy(e.target.value)}
                        className="h-full bg-transparent border-none text-xs p-0 shadow-none focus-visible:ring-0 font-medium"
                      />
                    </div>
                    <Popover
                      open={isUserPopoverOpen}
                      onOpenChange={(open) => {
                        setIsUserPopoverOpen(open);
                        if (open) loadSystemUsersLazy();
                      }}
                    >
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 rounded-lg" title="Seleccionar usuario del sistema">
                          <Users size={13} />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 p-0 shadow-2xl" align="end">
                        <div className="p-2.5 border-b border-border">
                          <Input
                            placeholder="Buscar usuario..."
                            value={userSearch}
                            onChange={e => setUserSearch(e.target.value)}
                            className="h-8 text-xs"
                          />
                        </div>
                        <ScrollArea className="h-56">
                          <div className="p-1.5 space-y-0.5">
                            {loadingUsers ? (
                              <div className="p-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando usuarios...
                              </div>
                            ) : filteredUsers.length === 0 ? (
                              <div className="p-4 text-center text-muted-foreground text-xs italic">No se encontraron usuarios</div>
                            ) : filteredUsers.map((u) => (
                              <div
                                key={u.id || u.email}
                                onClick={() => {
                                  setEnteredBy(u.full_name || u.email);
                                  setIsUserPopoverOpen(false);
                                }}
                                className="p-2 hover:bg-accent cursor-pointer rounded-lg flex items-center justify-between"
                              >
                                <div className="flex-1 mr-2 truncate">
                                  <span className="text-xs font-bold block truncate">{u.full_name || u.email}</span>
                                  <span className="text-[10px] text-muted-foreground font-mono block truncate">{u.email}</span>
                                </div>
                                {enteredBy === (u.full_name || u.email) && <Check size={14} className="text-emerald-500 shrink-0" />}
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* FORMA DE PAGO */}
                <div className="pt-1 border-t border-border/60 dark:border-white/5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Forma de Pago</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('Efectivo')}
                      className={`flex items-center justify-center gap-1 py-2 px-2 rounded-lg text-xs font-bold transition-all ${
                        paymentMethod === 'Efectivo'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-background dark:bg-white/5 border border-border dark:border-white/10 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Wallet size={12} /> Efectivo
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('Transferencia')}
                      className={`flex items-center justify-center gap-1 py-2 px-2 rounded-lg text-xs font-bold transition-all ${
                        paymentMethod === 'Transferencia'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-background dark:bg-white/5 border border-border dark:border-white/10 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Landmark size={12} /> Transf.
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentMethod('Credito');
                        const matchedSup = suppliers.find(
                          (s: any) => String(s.name || '').toLowerCase() === supplierName.trim().toLowerCase()
                        );
                        const cp = matchedSup ? supplierCreditMap[matchedSup.id] : null;
                        if (cp?.credit_days && !creditDays) {
                          setCreditDays(cp.credit_days);
                        }
                      }}
                      className={`flex items-center justify-center gap-1 py-2 px-2 rounded-lg text-xs font-bold transition-all ${
                        paymentMethod === 'Credito'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-background dark:bg-white/5 border border-border dark:border-white/10 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <CreditCard size={12} /> Crédito
                    </button>
                  </div>

                  {/* NOTIFICACIÓN EN VIVO DE CRÉDITO AUTORIZADO DEL PROVEEDOR */}
                  {supplierName.trim() && (() => {
                    const matchedSup = suppliers.find(
                      (s: any) => String(s.name || '').toLowerCase() === supplierName.trim().toLowerCase()
                    );
                    if (!matchedSup) return null;
                    const cp = supplierCreditMap[matchedSup.id];
                    const isAuth = Boolean(cp?.is_authorized_credit);
                    const lim = Number(cp?.credit_limit || 0);
                    const used = Number(supplierBalancesMap[matchedSup.id] || 0);
                    const avail = Math.max(0, lim - used);
                    const days = Number(cp?.credit_days || matchedSup.credit_days || 30);

                    if (!isAuth) {
                      return (
                        <div className="mt-2 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[10px] text-amber-700 dark:text-amber-300 font-semibold">
                          ℹ️ {matchedSup.name} sin crédito autorizado en Directorio (Contado).
                        </div>
                      );
                    }
                    return (
                      <div className="mt-2 px-2.5 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[10px] space-y-0.5">
                        <div className="font-bold text-emerald-700 dark:text-emerald-300">
                          ✓ Crédito Autorizado · Plazo {days} días
                        </div>
                        <div className="font-mono text-foreground/85">
                          Límite: <strong>${lim.toFixed(2)}</strong> · Saldo CxP: <strong>${used.toFixed(2)}</strong> · Disp.: <strong className="text-emerald-600 dark:text-emerald-400">${avail.toFixed(2)}</strong>
                        </div>
                      </div>
                    );
                  })()}
                  {paymentMethod === 'Credito' && (
                    <div className="mt-2 p-2 rounded-lg bg-background dark:bg-white/5 border border-border dark:border-white/10 flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-indigo-500">Plazo de Crédito:</span>
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          value={creditDays}
                          onFocus={e => e.target.select()}
                          onChange={e => setCreditDays(e.target.value)}
                          className="h-7 w-16 text-xs text-center font-bold"
                          placeholder="30"
                        />
                        <span className="text-[10px] text-muted-foreground font-semibold">días</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* COLUMNA DERECHA (8 cols): PASO 2 Y 3 — BARRA RÁPIDA DTE/PRODUCTOS + TABLA EDITABLE + CIERRE */}
            <div className="lg:col-span-8 flex flex-col gap-3">
              {/* BARRA SUPERIOR INTEGRADA: IMPORTAR DTE JSON + AGREGAR PRODUCTO EN 1 SOLA FILA */}
              <div className="rounded-2xl bg-card dark:bg-white/[0.04] border border-border dark:border-white/10 p-3 shadow-sm">
                <div className="flex flex-col xl:flex-row xl:items-end gap-2.5">
                  {/* Botón Importar JSON DTE */}
                  <div className="shrink-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                      <span>Paso 2 · Carga Rápida DTE</span>
                    </div>
                    <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept=".json" />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-9 px-3.5 rounded-xl border-indigo-500/40 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-bold text-xs gap-2 w-full xl:w-auto"
                    >
                      <FileJson size={15} />
                      Importar DTE JSON (MH)
                    </Button>
                  </div>

                  <div className="hidden xl:block h-9 w-px bg-border dark:bg-white/10 mx-1" />

                  {/* Buscador Manual en Línea */}
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                    <div className="sm:col-span-6 relative">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                        O buscar producto (SKU / Nombre)
                      </div>
                      <Input
                        placeholder="Escribe SKU o nombre del producto..."
                        value={skuSearch}
                        onChange={e => setSkuSearch(e.target.value.toUpperCase())}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddItem();
                          }
                        }}
                        className="h-9 text-xs bg-background dark:bg-white/5"
                      />
                      {skuSearch.trim().length > 0 && !inventory.some(p => p.sku === skuSearch.trim().toUpperCase()) && (
                        <div className="absolute z-40 left-0 right-0 top-[60px] bg-popover dark:bg-[#161430] border border-border dark:border-white/15 rounded-xl shadow-2xl max-h-56 overflow-y-auto p-1 divide-y divide-border/50 dark:divide-white/5">
                          {inventory
                            .filter(p =>
                              p.sku.toLowerCase().includes(skuSearch.trim().toLowerCase()) ||
                              (p.name && p.name.toLowerCase().includes(skuSearch.trim().toLowerCase()))
                            )
                            .slice(0, 10)
                            .map(p => (
                              <button
                                key={p.sku}
                                type="button"
                                onClick={() => {
                                  setSkuSearch(p.sku);
                                  if (!manualPrice && p.price > 0) setManualPrice(p.price.toFixed(2));
                                }}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-accent dark:hover:bg-white/10 rounded-lg flex items-center justify-between gap-2"
                              >
                                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-300 shrink-0">{p.sku}</span>
                                <span className="text-muted-foreground dark:text-white/70 truncate flex-1">{p.name}</span>
                                <span className="font-mono text-[10px] text-emerald-500 shrink-0">${Number(p.price || 0).toFixed(2)}</span>
                              </button>
                            ))}
                        </div>
                      )}
                    </div>

                    <div className="sm:col-span-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Cant.</div>
                      <Input
                        type="number"
                        value={manualQty}
                        onFocus={e => e.target.select()}
                        onChange={e => setManualQty(e.target.value === '' ? '' : (parseInt(e.target.value) || 0))}
                        className="h-9 text-xs text-center font-bold bg-background dark:bg-white/5"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Costo s/IVA</div>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={manualPrice}
                        onFocus={e => e.target.select()}
                        onChange={e => setManualPrice(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddItem();
                          }
                        }}
                        className="h-9 text-xs text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-background dark:bg-white/5"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <Button
                        type="button"
                        onClick={handleAddItem}
                        className="w-full h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1"
                      >
                        <Plus size={14} /> Agregar
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* TABLA DE ÍTEMS A ANCHO COMPLETO CON EDICIÓN EN LÍNEA */}
              <div className="rounded-2xl bg-card dark:bg-white/[0.04] border border-border dark:border-white/10 flex flex-col overflow-hidden shadow-sm">
                <div className="px-4 py-2.5 border-b border-border dark:border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wide">Detalle de Productos a Ingresar</span>
                    <Badge variant="outline" className="text-[10px] font-mono border-indigo-500/30 text-indigo-600 dark:text-indigo-300">
                      {purchaseItems.length} ítem(s)
                    </Badge>
                  </div>
                  {purchaseItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setPurchaseItems([])}
                      className="text-[11px] font-semibold text-rose-500 hover:underline"
                    >
                      Vaciar lista
                    </button>
                  )}
                </div>

                <div className="overflow-auto min-h-[280px] max-h-[calc(100vh-340px)]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-muted/95 dark:bg-[#161430] z-10">
                      <TableRow className="border-b border-border dark:border-white/10 hover:bg-transparent">
                        <TableHead className="text-[10px] font-bold uppercase h-9 px-4 w-[130px]">SKU</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase h-9">Producto</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase h-9 text-center w-[95px]">Cant.</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase h-9 text-right w-[125px]">Costo s/IVA</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase h-9 text-right w-[110px]">c/IVA (13%)</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase h-9 text-right w-[130px]">Subtotal</TableHead>
                        <TableHead className="w-[44px] h-9"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchaseItems.length === 0 ? (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={7} className="text-center py-20 text-muted-foreground text-xs">
                            Importa un archivo <strong>DTE JSON</strong> arriba a la izquierda o busca un producto para comenzar.
                          </TableCell>
                        </TableRow>
                      ) : purchaseItems.map((item) => (
                        <TableRow key={item.sku} className="border-b border-border/60 dark:border-white/5 hover:bg-muted/30 dark:hover:bg-white/5">
                          <TableCell className="px-4 font-mono font-bold text-xs text-indigo-600 dark:text-indigo-300">{item.sku}</TableCell>
                          <TableCell className="font-semibold text-xs text-foreground">{item.name}</TableCell>
                          <TableCell className="text-center">
                            <Input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onFocus={e => e.target.select()}
                              onChange={e => {
                                const val = Math.max(0, Number(e.target.value) || 0);
                                setPurchaseItems(prev =>
                                  prev.map(it => it.sku === item.sku ? { ...it, quantity: val } : it)
                                );
                              }}
                              className="h-7 w-20 mx-auto text-center text-xs font-bold bg-background dark:bg-black/30"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              step="0.01"
                              min={0}
                              value={item.cost}
                              onFocus={e => e.target.select()}
                              onChange={e => {
                                const val = Math.max(0, parseFloat(e.target.value) || 0);
                                setPurchaseItems(prev =>
                                  prev.map(it => it.sku === item.sku ? { ...it, cost: val } : it)
                                );
                              }}
                              className="h-7 w-24 ml-auto text-right font-mono text-xs font-bold bg-background dark:bg-black/30"
                            />
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-muted-foreground">
                            ${(item.cost * 1.13).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-mono font-black text-xs text-foreground">
                            ${(item.cost * item.quantity).toFixed(2)}
                          </TableCell>
                          <TableCell className="pr-3">
                            <button
                              type="button"
                              onClick={() => removeItem(item.sku)}
                              className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* PASO 3 — BARRA INFERIOR UNIFICADA: TOTALES + ACCIONES EN 1 SOLA VISTA */}
                <div className="p-3.5 bg-muted/40 dark:bg-white/[0.03] border-t border-border dark:border-white/10 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-6">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-muted-foreground block">Subtotal Gravado</span>
                      <span className="text-sm font-bold font-mono">${subtotalPurchase.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-muted-foreground block">IVA Crédito (13%)</span>
                      <span className="text-sm font-bold font-mono text-indigo-600 dark:text-indigo-300">${ivaPurchase.toFixed(2)}</span>
                    </div>
                    <div className="pl-4 border-l border-border dark:border-white/10">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground block">Total Factura</span>
                      <span className="text-xl font-black font-mono text-emerald-600 dark:text-[#63e2b7]">${totalPurchase.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 px-4 rounded-xl font-bold text-xs gap-1.5"
                      disabled={loading || purchaseItems.length === 0}
                      onClick={() => savePurchase('PENDIENTE')}
                      title="Registra como borrador sin sumar al stock todavía"
                    >
                      <Save size={15} />
                      Guardar Borrador
                    </Button>
                    <Button
                      type="button"
                      className="h-10 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs gap-1.5 shadow-md shadow-emerald-600/20"
                      disabled={loading || purchaseItems.length === 0}
                      onClick={() => savePurchase('CERRADA')}
                    >
                      {loading ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                      Cerrar e Ingresar a Inventario
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

    <TabsContent value="historial" className="space-y-6 outline-none">
      <div className="rounded-[11px] bg-card dark:bg-white/5 backdrop-blur-md border border-border dark:border-white/10 flex flex-col overflow-hidden">
        <div className="p-[18px_24px] border-b border-border dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-[13px] font-bold text-foreground dark:text-white flex items-center gap-2">
              <Calendar className="text-indigo-400" size={16} />
              Historial de Ingresos de Compra
            </div>
            <div className="text-[11px] text-muted-foreground dark:text-white/50 mt-1">Consulte los ingresos históricos de productos y compras operativas.</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5 bg-muted dark:bg-white/5 border border-border dark:border-white/10 p-1 rounded-[10px]">
              <button onClick={() => setHistoryStatusFilter('TODOS')} className={`text-[10.5px] font-bold rounded-lg px-3 py-1.5 transition-all ${historyStatusFilter === 'TODOS' ? 'bg-indigo-500/20 text-indigo-700 dark:text-[#a5a8ff] shadow-sm' : 'text-muted-foreground dark:text-white/50 hover:text-foreground dark:hover:text-white/80'}`}>TODOS</button>
              <button onClick={() => setHistoryStatusFilter('PENDIENTE')} className={`text-[10.5px] font-bold rounded-lg px-3 py-1.5 transition-all ${historyStatusFilter === 'PENDIENTE' ? 'bg-indigo-500/20 text-indigo-700 dark:text-[#a5a8ff] shadow-sm' : 'text-muted-foreground dark:text-white/50 hover:text-foreground dark:hover:text-white/80'}`}>BORRADOR</button>
              <button onClick={() => setHistoryStatusFilter('CERRADA')} className={`text-[10.5px] font-bold rounded-lg px-3 py-1.5 transition-all ${historyStatusFilter === 'CERRADA' ? 'bg-indigo-500/20 text-indigo-700 dark:text-[#a5a8ff] shadow-sm' : 'text-muted-foreground dark:text-white/50 hover:text-foreground dark:hover:text-white/80'}`}>INGRESADA</button>
            </div>
          </div>
        </div>

        <div className="p-4 border-b border-border/60 dark:border-white/5 flex items-center gap-3 bg-card dark:bg-white/5">
          <div className="flex items-center gap-2 bg-card dark:bg-white/5 border border-border dark:border-white/10 rounded-lg p-[8px_12px] w-full md:max-w-md">
            <Search size={14} className="text-muted-foreground/80 dark:text-white/30" />
            <Input 
              placeholder="Buscar por ID de Pedido, Proveedor o Encargado..." 
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              className="h-auto bg-transparent border-none text-[12px] text-foreground dark:text-white/80 p-0 shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/70 dark:placeholder:text-muted-foreground/80 dark:text-white/25"
            />
          </div>
        </div>

        <div className="overflow-x-auto min-h-[400px]">
          <Table>
            <TableHeader className="bg-muted/90 dark:bg-[#161430]/90 backdrop-blur-sm">
              <TableRow className="border-b border-border dark:border-white/10 hover:bg-transparent">
                <TableHead className="text-[10px] font-semibold text-muted-foreground dark:text-white/40 uppercase px-6 h-[40px]">ID Pedido</TableHead>
                <TableHead className="text-[10px] font-semibold text-muted-foreground dark:text-white/40 uppercase h-[40px]">Proveedor</TableHead>
                <TableHead className="text-[10px] font-semibold text-muted-foreground dark:text-white/40 uppercase h-[40px]">Encargado</TableHead>
                <TableHead className="text-[10px] font-semibold text-muted-foreground dark:text-white/40 uppercase h-[40px]">Bodega</TableHead>
                <TableHead className="text-[10px] font-semibold text-muted-foreground dark:text-white/40 uppercase h-[40px]">Método Pago</TableHead>
                <TableHead className="text-[10px] font-semibold text-muted-foreground dark:text-white/40 uppercase h-[40px]">Monto Total</TableHead>
                <TableHead className="text-[10px] font-semibold text-muted-foreground dark:text-white/40 uppercase text-center h-[40px]">Estado</TableHead>
                <TableHead className="text-[10px] font-semibold text-muted-foreground dark:text-white/40 uppercase text-center h-[40px]">Fecha de Creación</TableHead>
                <TableHead className="w-24 px-6 h-[40px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(() => {
                if (loadingHistory) {
                  return (
                    <TableRow className="border-b border-border/60 dark:border-white/5 hover:bg-transparent">
                      <TableCell colSpan={9} className="text-center py-20 text-muted-foreground dark:text-white/40 text-[11px]">
                        <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin text-indigo-400" /> Cargando historial de ingresos...</span>
                      </TableCell>
                    </TableRow>
                  );
                }
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
                    <TableRow className="border-b border-border/60 dark:border-white/5 hover:bg-transparent">
                      <TableCell colSpan={9} className="text-center py-20 text-muted-foreground/80 dark:text-white/30 italic text-[11px]">
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
                    <TableRow key={p.id} className="border-b border-border/60 dark:border-white/5 hover:bg-card dark:bg-white/5 transition-colors">
                      <TableCell className="px-6 font-mono font-bold text-[11px] text-foreground dark:text-white/80">{p.order_id}</TableCell>
                      <TableCell className="font-bold text-[11.5px] text-foreground dark:text-white/90">{provName}</TableCell>
                      <TableCell className="text-[11px] text-muted-foreground dark:text-white/50">{p.entered_by || 'N/A'}</TableCell>
                      <TableCell className="text-[11px] text-indigo-700 dark:text-indigo-300 font-medium">{whName}</TableCell>
                      <TableCell className="text-[11px] text-muted-foreground dark:text-white/50">{p.payment_method} {p.credit_days ? `(${p.credit_days}d)` : ''}</TableCell>
                      <TableCell className="text-[12.5px] font-black text-emerald-700 dark:text-[#63e2b7]">${parseFloat(p.total).toFixed(2)}</TableCell>
                      <TableCell className="text-center">
                        <span className={`px-[8px] py-[3px] rounded-md text-[9px] font-bold uppercase tracking-[0.5px] ${
                          p.status === 'CERRADA' 
                            ? 'bg-emerald-500/20 text-emerald-700 dark:text-[#63e2b7] border border-emerald-500/30' 
                            : p.status === 'ANULADA'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : 'bg-[#d97706]/20 text-[#fbbf24] border border-[#d97706]/30'
                        }`}>
                          {p.status === 'CERRADA' ? 'INGRESADA' : p.status === 'ANULADA' ? 'ANULADA' : 'BORRADOR'}
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-[10.5px] text-muted-foreground dark:text-white/40">{dateStr}</TableCell>
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
                            className="px-2 py-1.5 text-[9.5px] font-bold rounded-lg bg-muted dark:bg-white/5 border border-border dark:border-white/10 text-foreground/80 dark:text-white/60 hover:bg-accent dark:hover:bg-white/10 hover:text-foreground dark:hover:text-white/90 transition-colors uppercase tracking-[0.5px]"
                          >
                            Detalle
                          </button>
                          {p.status !== 'ANULADA' && (
                            <button 
                              onClick={() => handleCancelPurchase(p)}
                              className="px-2 py-1.5 text-[9.5px] font-bold rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 transition-colors uppercase tracking-[0.5px]"
                            >
                              {p.status === 'PENDIENTE' ? 'Borrar' : 'Anular'}
                            </button>
                          )}
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
          <div className="rounded-[11px] bg-card dark:bg-white/5 backdrop-blur-md border border-border dark:border-white/10 overflow-hidden">
            <div className="p-4 border-b border-border dark:border-white/10 bg-indigo-500/10">
              <div className="text-[13px] font-bold text-foreground dark:text-white flex items-center gap-2">
                <Link2 className="text-indigo-400" size={16} />
                Vincular Código Manualmente
              </div>
              <div className="text-[11px] text-muted-foreground dark:text-white/50 mt-1">
                Asocie un código de proveedor con un SKU interno.
              </div>
            </div>
            <div className="p-4 space-y-4">
              <div className="space-y-1.5">
                <div className="text-[10px] font-medium uppercase tracking-[0.7px] text-muted-foreground/80 dark:text-white/30">Código de Proveedor / DTE</div>
                <div className="flex items-center gap-2 bg-card dark:bg-white/5 border border-border dark:border-white/10 rounded-lg p-[9px_12px]">
                  <Input 
                    placeholder="Ej: COD-PROV-123" 
                    value={supplierCodeInput} 
                    onChange={(e) => setSupplierCodeInput(e.target.value)}
                    className="h-full bg-transparent border-none text-[12.5px] font-bold text-foreground dark:text-white/90 p-0 shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/70 dark:placeholder:text-muted-foreground/80 dark:text-white/25 uppercase"
                  />
                </div>
              </div>

              <div className="space-y-1.5 relative">
                <div className="text-[10px] font-medium uppercase tracking-[0.7px] text-muted-foreground/80 dark:text-white/30">SKU Interno de Destino</div>
                <div className="flex items-center gap-2 bg-card dark:bg-white/5 border border-border dark:border-white/10 rounded-lg p-[9px_12px]">
                  <Input 
                    placeholder="Buscar por SKU o Nombre..." 
                    value={internalSkuInput} 
                    onChange={(e) => setInternalSkuInput(e.target.value)}
                    className="h-full bg-transparent border-none text-[12.5px] font-bold text-foreground dark:text-white/90 p-0 shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/70 dark:placeholder:text-muted-foreground/80 dark:text-white/25 uppercase"
                  />
                </div>
                {internalSkuInput && !inventory.some(p => p.sku === internalSkuInput.trim().toUpperCase()) && (
                  <div className="absolute z-50 left-0 right-0 top-[100%] mt-1 bg-popover dark:bg-[#161430] border border-border dark:border-white/10 rounded-xl shadow-xl max-h-48 overflow-y-auto p-1 divide-y divide-border/60 dark:divide-white/5">
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
                          className="w-full text-left px-3 py-2 text-xs hover:bg-card dark:bg-white/5 rounded-lg flex justify-between font-bold text-foreground dark:text-white"
                        >
                          <span className="text-indigo-700 dark:text-indigo-300">{p.sku}</span>
                          <span className="text-[10px] text-muted-foreground dark:text-white/40 font-normal truncate max-w-[150px]">{p.name}</span>
                        </button>
                      ))}
                    {inventory.filter(p => 
                      p.sku.toLowerCase().includes(internalSkuInput.toLowerCase()) || 
                      p.name.toLowerCase().includes(internalSkuInput.toLowerCase())
                    ).length === 0 && (
                      <div className="p-3 text-center text-[10px] text-muted-foreground/80 dark:text-white/30 italic">No se encontraron productos</div>
                    )}
                  </div>
                )}
                
                {internalSkuInput && inventory.some(p => p.sku === internalSkuInput.trim().toUpperCase()) && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[10px] font-bold text-emerald-700 dark:text-[#63e2b7] animate-in fade-in">
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
          <div className="rounded-[11px] bg-card dark:bg-white/5 backdrop-blur-md border border-border dark:border-white/10 overflow-hidden flex flex-col h-full">
            <Tabs defaultValue="tabla" className="w-full flex flex-col h-full">
              <div className="p-4 border-b border-border dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-transparent">
                <div>
                  <div className="text-[13px] font-bold text-foreground dark:text-white flex items-center gap-2">
                    <Link2 className="text-indigo-400" size={16} />
                    Equivalencias de Catálogo
                  </div>
                  <div className="text-[11px] text-muted-foreground dark:text-white/50 mt-1">Consulte y administre el mapeo masivo de SKU.</div>
                </div>
                <TabsList className="bg-card dark:bg-white/5 p-1 rounded-[10px] border border-border dark:border-white/10 flex">
                  <TabsTrigger value="tabla" className="text-[10px] font-bold px-3 py-1.5 rounded-md data-[state=active]:bg-indigo-500/30 data-[state=active]:text-indigo-700 dark:text-[#a5a8ff] text-muted-foreground dark:text-white/50">Lista de Vínculos</TabsTrigger>
                  <TabsTrigger value="json" className="text-[10px] font-bold px-3 py-1.5 rounded-md data-[state=active]:bg-indigo-500/30 data-[state=active]:text-indigo-700 dark:text-[#a5a8ff] text-muted-foreground dark:text-white/50">Editor JSON</TabsTrigger>
                </TabsList>
              </div>
              
              {/* SUBTAB TABLA DE EQUIVALENCIAS */}
              <TabsContent value="tabla" className="m-0 outline-none flex-1 flex flex-col">
                <div className="p-4 border-b border-border/60 dark:border-white/5 flex items-center gap-3 bg-card dark:bg-white/5">
                  <div className="flex items-center gap-2 bg-card dark:bg-white/5 border border-border dark:border-white/10 rounded-lg p-[8px_12px] w-full md:max-w-md">
                    <Search size={14} className="text-muted-foreground/80 dark:text-white/30" />
                    <Input 
                      placeholder="Buscar por código de proveedor o SKU interno..." 
                      value={mappingSearch}
                      onChange={(e) => setMappingSearch(e.target.value)}
                      className="h-auto bg-transparent border-none text-[12px] text-foreground dark:text-white/80 p-0 shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/70 dark:placeholder:text-muted-foreground/80 dark:text-white/25"
                    />
                  </div>
                </div>
                
                <div className="overflow-x-auto min-h-[300px]">
                  <Table>
                    <TableHeader className="bg-muted/90 dark:bg-[#161430]/90 backdrop-blur-sm">
                      <TableRow className="border-b border-border dark:border-white/10 hover:bg-transparent">
                        <TableHead className="text-[10px] font-semibold text-muted-foreground dark:text-white/40 uppercase px-6 h-[40px]">Código Proveedor</TableHead>
                        <TableHead className="text-[10px] font-semibold text-muted-foreground dark:text-white/40 uppercase h-[40px]">SKU Interno</TableHead>
                        <TableHead className="text-[10px] font-semibold text-muted-foreground dark:text-white/40 uppercase h-[40px]">Producto Maestro</TableHead>
                        <TableHead className="text-right text-[10px] font-semibold text-muted-foreground dark:text-white/40 uppercase px-6 h-[40px]">Acción</TableHead>
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
                            <TableRow className="border-b border-border/60 dark:border-white/5 hover:bg-transparent">
                              <TableCell colSpan={4} className="text-center py-16 text-muted-foreground/80 dark:text-white/30 italic text-[11px]">
                                {s ? 'No se encontraron vinculaciones coincidentes.' : 'No hay equivalencias de proveedores registradas.'}
                              </TableCell>
                            </TableRow>
                          );
                        }
                        return list.map((m: any) => {
                          const prod = inventory.find(p => p.sku === m.internalSku);
                          return (
                            <TableRow key={m.supplierCode} className="border-b border-border/60 dark:border-white/5 hover:bg-card dark:bg-white/5 transition-colors">
                              <TableCell className="px-6 font-mono font-bold text-[11px] text-indigo-400">{m.supplierCode}</TableCell>
                              <TableCell className="font-mono font-bold text-[11px] text-foreground dark:text-white/90">{m.internalSku}</TableCell>
                              <TableCell className="text-[11px] font-medium text-muted-foreground dark:text-white/50 max-w-[200px] truncate">{prod?.name || 'Desconocido'}</TableCell>
                              <TableCell className="text-right px-6">
                                <button 
                                  onClick={() => handleDeleteMapping(m.supplierCode)}
                                  className="h-7 w-7 rounded-md inline-flex items-center justify-center text-muted-foreground/70 dark:text-white/20 hover:text-[#ff5c5c] hover:bg-[#ff5c5c]/10 transition-all"
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
                  <div className="text-[10px] font-medium uppercase tracking-[0.7px] text-muted-foreground/80 dark:text-white/30">Estructura JSON Mappings</div>
                  <p className="text-[10.5px] text-muted-foreground dark:text-white/50 leading-normal mb-2">
                    Edite o cargue masivamente vinculaciones en formato JSON. El formato debe ser un arreglo de objetos con las propiedades <code>"supplier_code"</code> e <code>"internal_sku"</code>.
                  </p>
                  <textarea 
                    rows={12}
                    value={jsonMappingsInput}
                    onChange={(e) => setJsonMappingsInput(e.target.value)}
                    className="w-full font-mono text-[11px] p-4 border rounded-xl bg-background dark:bg-black/40 border-border dark:border-white/10 text-foreground dark:text-white/80 placeholder:text-muted-foreground/70 dark:placeholder:text-muted-foreground/80 dark:text-white/25 outline-none resize-none"
                  />
                </div>

                <button 
                  onClick={handleSaveJsonMappings}
                  disabled={savingJsonMappings || !jsonMappingsInput.trim()}
                  className="h-10 px-6 bg-muted hover:bg-accent dark:bg-white/10 dark:hover:bg-white/20 border border-border dark:border-white/20 text-foreground dark:text-white font-bold rounded-lg shadow-sm active:scale-95 transition-all w-full md:w-auto flex items-center justify-center gap-2 text-[12px] disabled:opacity-50"
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
        
        {/* COLUMNA IZQUIERDA: IMPORTADOR DTE JSON INTELIGENTE */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="bg-card dark:bg-white/5 dark:bg-white/5 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-3xl p-6 shadow-xl">
            <CardHeader className="p-0 pb-4 border-b border-border dark:border-white/10 mb-4">
              <CardTitle className="text-sm font-black flex items-center gap-2 text-foreground dark:text-white">
                <FileJson className="text-indigo-400" size={18} /> Importador DTE-05 (Nota de Crédito)
              </CardTitle>
              <CardDescription className="text-[11px] text-muted-foreground dark:text-white/60">
                Arrastra el archivo JSON del Ministerio de Hacienda para vincularlo a la factura de compra original y generar el asiento contable.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 space-y-4 text-foreground dark:text-white">
              {/* AVISOS DE DEVOLUCIÓN ESPERANDO NOTA DE CRÉDITO (BMS + IA) */}
              <div className="p-3.5 rounded-2xl border border-amber-300/60 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-950/20 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-amber-500 text-white border-0 text-[10px] font-black">
                      {pendingNcAlerts.filter(a => a.status === 'PENDIENTE').length} Pendientes
                    </Badge>
                    <span className="text-xs font-bold text-foreground">
                      Avisos de Devolución esperando Nota de Crédito
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setShowNewAlertForm(prev => !prev)}
                    className="h-7 text-[11px] font-bold rounded-lg"
                  >
                    {showNewAlertForm ? 'Cerrar' : '+ Avisar Devolución al BMS'}
                  </Button>
                </div>

                {showNewAlertForm && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <Input
                      value={newAlertSupplier}
                      onChange={e => setNewAlertSupplier(e.target.value)}
                      placeholder="Proveedor (ej. Sherwin / Distribuidora)"
                      className="h-8 text-xs rounded-lg"
                    />
                    <Input
                      value={newAlertInvoice}
                      onChange={e => setNewAlertInvoice(e.target.value)}
                      placeholder="No. Factura / CCF original"
                      className="h-8 text-xs rounded-lg"
                    />
                    <Input
                      value={newAlertItems}
                      onChange={e => setNewAlertItems(e.target.value)}
                      placeholder="Productos a regresar (ej. 5 galones blancos)"
                      className="h-8 text-xs rounded-lg"
                    />
                    <div className="flex gap-1.5">
                      <Input
                        type="number"
                        step="0.01"
                        value={newAlertAmount}
                        onChange={e => setNewAlertAmount(e.target.value)}
                        placeholder="Monto est. ($)"
                        className="h-8 text-xs rounded-lg"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={async () => {
                          if (!newAlertSupplier.trim() || !newAlertItems.trim()) {
                            toast({ variant: 'destructive', title: 'Faltan datos', description: 'Indica proveedor y producto a devolver.' });
                            return;
                          }
                          await addPendingCreditNoteAlert({
                            type: 'COMPRA_PROVEEDOR',
                            entityName: newAlertSupplier.trim(),
                            invoiceRef: newAlertInvoice.trim() || undefined,
                            itemsSummary: newAlertItems.trim(),
                            estimatedAmount: parseFloat(newAlertAmount) || undefined,
                            createdBy: 'Compras',
                          });
                          setNewAlertSupplier('');
                          setNewAlertInvoice('');
                          setNewAlertItems('');
                          setNewAlertAmount('');
                          setShowNewAlertForm(false);
                          const refreshed = await loadPendingCreditNoteAlerts();
                          setPendingNcAlerts(refreshed.filter(a => a.type === 'COMPRA_PROVEEDOR'));
                          toast({ title: 'Aviso registrado en BMS ✓', description: 'El sistema te avisará cuando caiga esta Nota de Crédito.' });
                        }}
                        className="h-8 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shrink-0"
                      >
                        Guardar
                      </Button>
                    </div>
                  </div>
                )}

                {pendingNcAlerts.filter(a => a.status === 'PENDIENTE').length > 0 && (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {pendingNcAlerts
                      .filter(a => a.status === 'PENDIENTE')
                      .map(al => (
                        <div
                          key={al.id}
                          className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-card border border-border/70 text-[11px]"
                        >
                          <div className="min-w-0">
                            <span className="font-bold text-foreground">{al.entityName}</span>
                            {al.invoiceRef && <span className="ml-1.5 font-mono text-[10px] text-indigo-600">({al.invoiceRef})</span>}
                            <p className="text-[10px] text-muted-foreground truncate">
                              Devolución: {al.itemsSummary}
                              {al.estimatedAmount ? ` · Est. $${Number(al.estimatedAmount).toFixed(2)}` : ''}
                            </p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              await deletePendingCreditNoteAlert(al.id);
                              setPendingNcAlerts(prev => prev.filter(x => x.id !== al.id));
                            }}
                            className="h-6 px-2 text-[10px] text-rose-600"
                          >
                            Quitar
                          </Button>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* OPCIÓN RÁPIDA: NC MANUAL LIGADA DIRECTO A UNA FACTURA DE COMPRA */}
              <div className="p-3.5 rounded-2xl border border-border bg-muted/20 space-y-2.5">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-wider block">
                  O registrar Nota de Crédito Manual ligada a Factura de Compra
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <div className="sm:col-span-5">
                    <Select value={manualNcPurchaseId} onValueChange={setManualNcPurchaseId}>
                      <SelectTrigger className="h-8 text-xs rounded-lg">
                        <SelectValue placeholder="Seleccionar factura de compra..." />
                      </SelectTrigger>
                      <SelectContent>
                        {purchasesHistory.slice(0, 40).map((p: any) => (
                          <SelectItem key={p.id} value={p.id} className="text-xs">
                            {p.document_number || p.order_id} · {p.suppliers?.name || p.supplier_name || 'Proveedor'} (${Number(p.total || 0).toFixed(2)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-3">
                    <Input
                      value={manualNcDocNumber}
                      onChange={e => setManualNcDocNumber(e.target.value)}
                      placeholder="No. NC (ej. NC-001)"
                      className="h-8 text-xs rounded-lg"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Input
                      type="number"
                      step="0.01"
                      value={manualNcAmount}
                      onChange={e => setManualNcAmount(e.target.value)}
                      placeholder="Monto $"
                      className="h-8 text-xs rounded-lg font-mono"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        const purch = purchasesHistory.find((p: any) => p.id === manualNcPurchaseId);
                        const amt = parseFloat(manualNcAmount) || 0;
                        if (!purch || !manualNcDocNumber.trim() || amt <= 0) {
                          toast({ variant: 'destructive', title: 'Completa los campos', description: 'Elige la factura, número de NC y monto.' });
                          return;
                        }
                        const supObj = suppliers.find(s => s.id === purch.supplier_id);
                        setParsedCreditNote({
                          documentNumber: manualNcDocNumber.trim(),
                          supplierId: purch.supplier_id || supObj?.id || null,
                          supplierName: purch.suppliers?.name || purch.supplier_name || supObj?.name || 'Proveedor',
                          supplierNit: supObj?.nit || '',
                          total: amt,
                          matchedPurchaseId: purch.id,
                          matchedPurchaseDoc: purch.document_number || purch.order_id,
                          relatedDocNumber: purch.document_number || purch.order_id,
                          applicationMode: 'AUTOMATICO_FINANCIERO',
                          targetWarehouseId: warehouses[0]?.id || '',
                          items: [],
                        });
                        setManualNcDocNumber('');
                        setManualNcAmount('');
                      }}
                      className="w-full h-8 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold"
                    >
                      Preparar NC
                    </Button>
                  </div>
                </div>
              </div>

              {/* ZONA DE ARRASTRE DRAG & DROP */}
              <div 
                className="space-y-2"
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const file = e.dataTransfer.files?.[0];
                  if (file && file.name.endsWith('.json')) {
                    const reader = new FileReader();
                    reader.onload = (ev) => processCreditNoteJsonText(ev.target?.result as string);
                    reader.readAsText(file);
                  } else {
                    toast({ variant: 'destructive', title: 'Archivo no válido', description: 'Por favor arrastre un archivo .json de Nota de Crédito DTE.' });
                  }
                }}
              >
                <Label className="text-[10px] font-black uppercase text-muted-foreground dark:text-white/40 tracking-wider">Cargar archivo JSON (DTE-05)</Label>
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-2xl cursor-pointer bg-muted/30 dark:bg-black/25 hover:bg-background dark:bg-black/40 border-border dark:border-white/15 hover:border-indigo-400 transition-all group">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                      <FileJson className="w-10 h-10 mb-2 text-indigo-400 group-hover:scale-110 transition-transform" />
                      <p className="text-xs text-foreground dark:text-white/80 font-black">Arrastre su JSON aquí o haga clic</p>
                      <p className="text-[10px] text-muted-foreground dark:text-white/40 mt-0.5">DTE-05 Nota de Crédito de Proveedor (.json)</p>
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

              {/* VISTA PREVIA Y APLICACIÓN DE LA NOTA DE CRÉDITO (LÓGICA FOXPRO) */}
              {parsedCreditNote && (
                <div className="p-4 bg-indigo-950/40 border border-indigo-500/30 rounded-2xl space-y-4 animate-in fade-in slide-in-from-top-3">
                  <div className="flex justify-between items-center border-b border-indigo-500/20 pb-2">
                    <h3 className="text-xs font-black text-indigo-700 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles size={14} className="text-indigo-400" /> Aplicación de Nota de Crédito
                    </h3>
                    <Badge className="bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-mono text-[10px] font-black border-0">
                      ${parsedCreditNote.total.toFixed(2)}
                    </Badge>
                  </div>
                  
                  {/* Info Proveedor y DTE */}
                  <div className="grid grid-cols-2 gap-3 p-3 bg-muted/40 dark:bg-black/30 rounded-xl border border-border/60 dark:border-white/5 text-xs">
                    <div>
                      <span className="text-[9px] font-black uppercase text-muted-foreground dark:text-white/40 block">Proveedor</span>
                      <strong className="text-foreground dark:text-white truncate block">{parsedCreditNote.supplierName}</strong>
                      <span className="text-[9px] text-muted-foreground dark:text-white/50 font-mono">NIT: {parsedCreditNote.supplierNit}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black uppercase text-muted-foreground dark:text-white/40 block">N. Comprobante NC</span>
                      <strong className="text-indigo-700 dark:text-indigo-300 font-mono truncate block">{parsedCreditNote.documentNumber}</strong>
                      <span className="text-[9px] text-muted-foreground dark:text-white/50 block">DTE-05 Hacienda</span>
                    </div>
                  </div>

                  {/* Factura / CCF de Compra Afectada */}
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground dark:text-white/50">Factura de Compra Relacionada (CCF)</Label>
                    <Select 
                      value={parsedCreditNote.matchedPurchaseId || 'manual'} 
                      onValueChange={(val) => {
                        const purch = purchasesHistory.find(p => p.id === val);
                        setParsedCreditNote((prev: any) => ({
                          ...prev,
                          matchedPurchaseId: val,
                          matchedPurchaseDoc: purch ? (purch.document_number || purch.order_id) : prev.relatedDocNumber
                        }));
                      }}
                    >
                      <SelectTrigger className="h-10 bg-background dark:bg-slate-900/60 border-border dark:border-white/10 text-xs font-bold rounded-xl text-foreground dark:text-white">
                        <SelectValue placeholder="Seleccione factura a afectar..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-56">
                        {purchasesHistory
                          .filter(p => !parsedCreditNote.supplierId || p.supplier_id === parsedCreditNote.supplierId)
                          .map(p => (
                            <SelectItem key={p.id} value={p.id} className="text-xs font-bold">
                              CCF: {p.document_number || p.order_id} • Total: ${parseFloat(p.total).toFixed(2)} ({new Date(p.created_at).toLocaleDateString()})
                            </SelectItem>
                          ))}
                        <SelectItem value="manual" className="text-xs font-bold italic text-indigo-700 dark:text-indigo-300">
                          {parsedCreditNote.relatedDocNumber ? `Ref. DTE: ${parsedCreditNote.relatedDocNumber}` : 'Aplicar a Saldo General de Proveedor'}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Selector de Modalidad (Lógica Visual FoxPro) */}
                  <div className="space-y-2 p-3 bg-muted/40 dark:bg-black/30 rounded-xl border border-border/60 dark:border-white/5">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground dark:text-white/40 block">Modalidad de Aplicación</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setParsedCreditNote((prev: any) => ({ ...prev, applicationMode: 'AUTOMATICO_FINANCIERO' }))}
                        className={`p-2.5 rounded-xl text-left border text-xs font-bold transition-all ${
                          parsedCreditNote.applicationMode === 'AUTOMATICO_FINANCIERO'
                            ? 'bg-indigo-600/30 border-indigo-500 text-foreground dark:text-white font-black'
                            : 'bg-card dark:bg-white/5 border-border dark:border-white/10 text-muted-foreground dark:text-white/60 hover:bg-accent dark:hover:bg-white/10'
                        }`}
                      >
                        <p className="text-[11px]">⚡ Abono a Saldo</p>
                        <span className="text-[9px] text-muted-foreground dark:text-white/40 font-normal">Rebaja cuenta por pagar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setParsedCreditNote((prev: any) => ({ ...prev, applicationMode: 'PRODUCTO_ESPECIFICO' }))}
                        className={`p-2.5 rounded-xl text-left border text-xs font-bold transition-all ${
                          parsedCreditNote.applicationMode === 'PRODUCTO_ESPECIFICO'
                            ? 'bg-indigo-600/30 border-indigo-500 text-foreground dark:text-white font-black'
                            : 'bg-card dark:bg-white/5 border-border dark:border-white/10 text-muted-foreground dark:text-white/60 hover:bg-accent dark:hover:bg-white/10'
                        }`}
                      >
                        <p className="text-[11px]">📦 Devolución Física</p>
                        <span className="text-[9px] text-muted-foreground dark:text-white/40 font-normal">Descarga en Kardex</span>
                      </button>
                    </div>
                  </div>

                  {/* Si es Devolución Física: Selector de Bodega e Ítems */}
                  {parsedCreditNote.applicationMode === 'PRODUCTO_ESPECIFICO' && (
                    <div className="space-y-3 p-3 bg-indigo-900/20 rounded-xl border border-indigo-500/20 text-xs">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase text-indigo-700 dark:text-indigo-300">Bodega de Salida (Kardex)</Label>
                        <Select 
                          value={parsedCreditNote.targetWarehouseId} 
                          onValueChange={(val) => setParsedCreditNote((prev: any) => ({ ...prev, targetWarehouseId: val }))}
                        >
                          <SelectTrigger className="h-9 bg-background dark:bg-slate-900/60 border-border dark:border-white/10 text-xs font-bold rounded-xl text-foreground dark:text-white">
                            <SelectValue placeholder="Seleccione bodega..." />
                          </SelectTrigger>
                          <SelectContent>
                            {warehouses.map(w => (
                              <SelectItem key={w.id} value={w.id} className="text-xs font-bold">{w.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[10px] font-black uppercase text-indigo-700 dark:text-indigo-300">Productos del DTE a Devolver</Label>
                        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                          {parsedCreditNote.items.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center bg-background dark:bg-black/40 p-2 rounded-lg border border-border/60 dark:border-white/5 text-[11px]">
                              <div className="truncate pr-2">
                                <strong className="text-foreground dark:text-white block truncate">{item.name}</strong>
                                <span className="text-[9px] text-muted-foreground dark:text-white/40 font-mono">{item.sku}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-indigo-700 dark:text-indigo-300 font-black">{item.quantity} und</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Previsualización de Partida Contable */}
                  <div className="p-3 bg-background dark:bg-black/40 rounded-xl border border-border/60 dark:border-white/5 text-[11px] space-y-1.5 font-mono">
                    <p className="text-[9px] font-black uppercase text-muted-foreground dark:text-white/40 tracking-wider">Asiento Contable Automático (Journal)</p>
                    <div className="flex justify-between text-emerald-400">
                      <span>[2101] Cuentas por Pagar Proveedores</span>
                      <span>+${parsedCreditNote.total.toFixed(2)} (D)</span>
                    </div>
                    <div className="flex justify-between text-amber-400">
                      <span>[1106] IVA Crédito Fiscal (Reversión 13%)</span>
                      <span>-${(parsedCreditNote.total - parsedCreditNote.total / 1.13).toFixed(2)} (H)</span>
                    </div>
                    <div className="flex justify-between text-indigo-400">
                      <span>{parsedCreditNote.applicationMode === 'PRODUCTO_ESPECIFICO' ? '[1105] Inventario' : '[4102] Compras/Descuentos'}</span>
                      <span>-${(parsedCreditNote.total / 1.13).toFixed(2)} (H)</span>
                    </div>
                  </div>

                  {/* Botones de Acción */}
                  <div className="flex gap-2 pt-2">
                    <Button 
                      onClick={handleSaveCreditNote}
                      disabled={loading}
                      className="flex-1 h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs shadow-lg shadow-indigo-600/25"
                    >
                      {loading ? <Loader2 className="animate-spin mr-1.5" size={14} /> : <CheckCircle2 className="mr-1.5" size={14} />}
                      ⚡ APLICAR NOTA DE CRÉDITO
                    </Button>
                    <Button 
                      variant="ghost" 
                      onClick={() => setParsedCreditNote(null)}
                      className="h-11 px-4 border border-border dark:border-white/10 text-foreground dark:text-white hover:bg-card dark:bg-white/5 rounded-xl text-xs font-bold"
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
        <div className="lg:col-span-7">
          <Card className="bg-card dark:bg-white/5 dark:bg-white/5 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden">
            <CardHeader className="p-6 border-b border-border dark:border-white/10 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-foreground dark:text-white">Notas de Crédito Recibidas</CardTitle>
                <CardDescription className="text-xs text-muted-foreground dark:text-white/50">Listado de notas de crédito aplicadas a la sucursal activa.</CardDescription>
              </div>
              <div className="w-64 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground dark:text-white/40" size={14} />
                <Input 
                  placeholder="Buscar por N. Documento..."
                  value={creditNoteSearch}
                  onChange={e => setCreditNoteSearch(e.target.value)}
                  className="pl-8 h-8 bg-background dark:bg-black/20 border-border dark:border-white/10 text-xs text-foreground dark:text-white rounded-lg placeholder:text-muted-foreground/70 dark:placeholder:text-muted-foreground/80 dark:text-white/25"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-card dark:bg-white/5 border-b border-border dark:border-white/10">
                  <TableRow>
                    <TableHead className="text-[10px] font-black uppercase text-muted-foreground dark:text-white/50 tracking-wider pl-6">Fecha</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-muted-foreground dark:text-white/50 tracking-wider">N. Documento</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-muted-foreground dark:text-white/50 tracking-wider">Proveedor</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-muted-foreground dark:text-white/50 tracking-wider">Motivo / Tipo</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-muted-foreground dark:text-white/50 tracking-wider text-right pr-6">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingCreditNotes ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-muted-foreground dark:text-white/50 italic text-xs">
                        Cargando notas de crédito...
                      </TableCell>
                    </TableRow>
                  ) : creditNotes.filter(cn => cn.document_number.toLowerCase().includes(creditNoteSearch.toLowerCase())).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-muted-foreground dark:text-white/50 italic text-xs">
                        No hay notas de crédito registradas para esta sucursal.
                      </TableCell>
                    </TableRow>
                  ) : creditNotes.filter(cn => cn.document_number.toLowerCase().includes(creditNoteSearch.toLowerCase())).map((cn: any) => (
                    <TableRow key={cn.id} className="hover:bg-card dark:bg-white/5 border-b border-border/60 dark:border-white/5">
                      <TableCell className="pl-6 text-xs text-foreground/90 dark:text-white/70">
                        {new Date(cn.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-xs font-mono font-bold text-foreground dark:text-white">
                        {cn.document_number}
                      </TableCell>
                      <TableCell className="text-xs text-foreground dark:text-white font-semibold">
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
                      <TableCell className="text-xs text-right font-mono font-black text-indigo-700 dark:text-indigo-300 pr-6">
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
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col gap-4 overflow-hidden rounded-2xl border shadow-2xl bg-background">
          <DialogHeader className="px-1 pt-1 shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-black tracking-tight text-foreground flex items-center gap-2">
                <AlertTriangle className="text-amber-500" size={20} />
                Productos DTE No Registrados
              </DialogTitle>
              <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30 text-xs font-mono">
                {uncreatedDteProducts.length} pendientes
              </Badge>
            </div>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Hemos detectado códigos en el archivo de compra DTE que no existen en el inventario. Define su vinculación contable y precio de venta pública (PVP) para poder agregarlos.
            </DialogDescription>
          </DialogHeader>

          {uncreatedDteProducts.length > 1 && (
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/25 rounded-xl flex items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-indigo-300">
                <span className="font-bold">¿Deseas procesar todos a la vez?</span> Se registrarán con PVP sugerido (Costo + 30%).
              </div>
              <Button
                size="sm"
                onClick={handleCreateAllUncreatedProducts}
                disabled={processingAllUncreated}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-8 px-3 rounded-lg flex items-center gap-1.5 shrink-0"
              >
                {processingAllUncreated ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                Vincular y Añadir Todos ({uncreatedDteProducts.length})
              </Button>
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto max-h-[55vh] pr-2 space-y-3 py-1">
            {uncreatedDteProducts.map((p, index) => {
              const category = selectedUncreatedCategory[p.sku] || 'Inventario de Mercadería';
              const priceVal = selectedUncreatedPrice[p.sku] || '';
              const suggestedPrice = (p.cost * 1.3).toFixed(2);
              const existingProduct = inventory?.find(inv => inv.sku.trim().toUpperCase() === p.sku.trim().toUpperCase());
              const targetSkuExists = !!existingProduct;
              return (
                <div key={`${p.originalProviderCode || 'prod'}-${index}`} className="p-4 border rounded-2xl bg-muted/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider bg-black/10 dark:bg-white/10 px-2 py-0.5 rounded">
                        Cód. Prov: {p.originalProviderCode || p.sku}
                      </span>
                      <span className="text-xs font-bold text-muted-foreground">
                        Costo: ${p.cost.toFixed(2)}
                      </span>
                      <span className="text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/30 px-2 py-0.5 rounded-md">
                        Cant: {p.quantity}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-foreground leading-snug">{p.name}</h4>
                    
                    <div className="space-y-1 max-w-[220px]">
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
                        className="h-8 text-xs font-bold bg-card rounded-xl border uppercase font-mono"
                      />
                    </div>
                  </div>

                  {targetSkuExists ? (
                    <div className="flex flex-col justify-center gap-1 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-2xl min-w-[280px] md:min-w-[320px]">
                      <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400">✓ SKU Existente Detectado</span>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 line-clamp-1">{existingProduct.name}</span>
                      <span className="text-[9px] text-muted-foreground">Se vinculará el código del proveedor a este SKU existente.</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-[280px] md:min-w-[320px]">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">Vínculo Contable</Label>
                        <Select 
                          value={category} 
                          onValueChange={(val) => setSelectedUncreatedCategory(prev => ({ ...prev, [p.sku]: val }))}
                        >
                          <SelectTrigger className="h-9 text-xs rounded-xl bg-card border">
                            <SelectValue placeholder="Seleccione Categoría" />
                          </SelectTrigger>
                          <SelectContent position="popper" className="rounded-xl border shadow-xl z-50">
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
                  )}

                  <div className="flex items-end pt-2 md:pt-0 shrink-0">
                    <Button 
                      onClick={() => handleCreateUncreatedProduct(index)}
                      className={`w-full md:w-auto h-9 font-bold text-xs rounded-xl px-4 ${
                        targetSkuExists 
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/10' 
                          : 'bg-primary text-primary-foreground'
                      }`}
                    >
                      {targetSkuExists ? 'Vincular y Añadir' : 'Crear y Añadir'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter className="border-t border-white/10 pt-3 flex items-center justify-between sm:justify-between shrink-0">
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

          {selectedPurchase && (() => {
            const rawDoc = selectedPurchase.document_number || '';
            let dtePart = rawDoc;
            let genPart = '';
            if (rawDoc.includes('|')) {
              const parts = rawDoc.split('|').map((s: string) => s.trim());
              dtePart = parts[0] || 'N/A';
              genPart = parts[1] || '';
            }

            return (
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
                    <span className="font-bold text-muted-foreground block uppercase text-[9px] tracking-wider">N° DTE / Control</span>
                    <span className="font-mono text-foreground font-bold">{dtePart || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="font-bold text-muted-foreground block uppercase text-[9px] tracking-wider">Cód. Generación</span>
                    <span className="font-mono text-foreground text-[10px] break-all">{genPart || (rawDoc.length > 20 && !rawDoc.includes('DTE') ? rawDoc : 'N/A')}</span>
                  </div>
                  <div>
                    <span className="font-bold text-muted-foreground block uppercase text-[9px] tracking-wider">Método de Pago</span>
                    <span className="font-bold text-foreground">{selectedPurchase.payment_method} {selectedPurchase.credit_days ? `(${selectedPurchase.credit_days} d)` : ''}</span>
                  </div>
                  <div className="sm:col-span-4 flex justify-between items-center pt-2 border-t border-white/5">
                    <span className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider">Total de la Compra (Con IVA)</span>
                    <span className="font-black text-emerald-600 dark:text-emerald-400 text-base">${parseFloat(selectedPurchase.total).toFixed(2)}</span>
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
          );
        })()}

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