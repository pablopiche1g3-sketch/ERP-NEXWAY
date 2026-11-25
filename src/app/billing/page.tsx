
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Trash2, 
  ArrowLeft, 
  ShoppingCart,
  History,
  Calculator,
  Receipt,
  Wallet,
  Landmark,
  CreditCard as CardIcon,
  Users,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Printer,
  Mail,
  PlusCircle,
  Coins,
  DollarSign,
  TrendingDown,
  TrendingUp,
  ArrowDownCircle,
  FileText,
  Ban,
  RotateCcw,
  AlertCircle,
  SlidersHorizontal,
  Filter,
  Package,
  Store,
  Warehouse,
  Clock,
  Save,
  Sparkles,
  Eye,
  Lock,
  KeyRound,
  UserCheck,
  BookOpen,
  X,
  ShieldCheck,
  Layers,
  Split,
  Copy,
  RefreshCw,
  Wifi,
  WifiOff,
  CloudOff
} from 'lucide-react';
import { fetchSystemAppUsers } from '@/lib/session-operator';
import {
  loadProductFractionRules,
  ProductFractionRule,
  MEASURE_UNITS_CATALOG,
  computeSuppliesCost,
} from '@/lib/product-fraction-rules';
import { postDoubleEntryJournal } from '@/lib/accounting-journal';
import {
  validateContribuyenteMH,
  calculateIvaRetention1Percent
} from '@/lib/hacienda-sv-catalogs';
import {
  buildCashClosingDocumentHtml,
  buildInvoiceDocumentHtml,
  loadPrintBranding,
  printHtmlDocument
} from '@/lib/print-engine';
import {
  cacheOfflineCatalog,
  getOfflineCatalog,
  getOfflineSalesQueue,
  enqueueOfflineSale,
  syncOfflineSalesQueue,
  OfflineSaleRecord
} from '@/lib/offline-pos';
import { FocoVentaKPI } from '@/components/FocoVentaKPI';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { useUser } from '@/supabase/compat';
import { supabase } from '@/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ModeToggle } from '@/components/mode-toggle';
import { sendDteEmail } from '@/ai/flows/send-dte-email-flow';
import { CustomerHistoryDialog } from './components/CustomerHistoryDialog';
import { DteEmailSimulationModal, type DteEmailSalePayload } from '@/components/DteEmailSimulationModal';
import {
  appendDteTransmission,
  buildOfficialDteJson,
  loadHaciendaSandboxConfig,
  transmitDteViaSandbox,
} from '@/lib/hacienda-sandbox';
import {
  CreditOverrideAuthorization,
  evaluateCustomerCreditStatus,
  loadManagerCreditPin,
  logCreditOverrideAudit,
  saveManagerCreditPin,
} from '@/lib/credit-authorization';
import { Textarea } from '@/components/ui/textarea';
import { useStation } from './components/use-station';
import { useTabs } from '@/hooks/use-tabs';
import { useModuleConfig } from '@/supabase/use-module-config';
import { useBms, logNexbotEvent } from '@/contexts/BmsContext';
import type { CartItem, PaymentMethod } from './components/types';
import QuotationsTab from './components/QuotationsTab';

export default function BillingPage() {
  const { user, role } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const isUserAdmin = role === 'admin' || role === 'gerencia';
  const { config } = useModuleConfig();
  const { processChange, triggerArqueoAlert } = useBms();

  const station = useStation(user?.email);
  const { activeStation, activeWarehouse, availableStations, establishedStationId, clearEstablishedStation, establishStation } = station;

  const handleAssignStation = async (stationId: string) => {
    await station.assignStation(stationId);
    setSearchTerm('');
    setInventory([]);
    setCart([]);
  };

  const handleClearEstablishedStation = clearEstablishedStation;
  const handleEstablishStation = establishStation;

  const billingTabs = useMemo(() => {
    const tabs = [
      { id: 'facturacion', key: 'billing_facturacion' },
      { id: 'historial', key: 'billing_historial' },
      { id: 'ajustes_devoluciones', key: 'billing_ajustes' },
      { id: 'arqueo', key: 'billing_arqueo' },
      { id: 'creditos', key: 'billing_creditos' },
      { id: 'cotizacion', key: 'billing_cotizacion' },
    ];
    return tabs;
  }, [isUserAdmin]);

  const { activeTab, setActiveTab } = useTabs(config, billingTabs, 'facturacion');

  const [searchTerm, setSearchTerm] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [productFractionRules, setProductFractionRules] = useState<Record<string, ProductFractionRule>>({});

  useEffect(() => {
    loadProductFractionRules().then(rules => setProductFractionRules(rules));
  }, []);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Customer & Payment States
  const [docType, setDocType] = useState<'CF' | 'CCF'>('CF');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Efectivo');
  const [splitAmounts, setSplitAmounts] = useState<{
    cash: string;
    card: string;
    transfer: string;
    credit: string;
    cheque: string;
  }>({
    cash: '',
    card: '',
    transfer: '',
    credit: '',
    cheque: ''
  });
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [clientPricesMap, setClientPricesMap] = useState<Record<string, number>>({});
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);

  // Vendedor / Colaborador para Metas y Comisiones
  const [appUsersList, setAppUsersList] = useState<any[]>([]);
  const [selectedSellerEmail, setSelectedSellerEmail] = useState<string>('');

  useEffect(() => {
    fetchSystemAppUsers().then(users => {
      setAppUsersList(users);
      if (users.length > 0) {
        const loggedUser = users.find(u => u.email?.toLowerCase() === user?.email?.toLowerCase());
        if (loggedUser) {
          setSelectedSellerEmail(loggedUser.email);
        } else if (user?.email) {
          setSelectedSellerEmail(user.email);
        } else {
          setSelectedSellerEmail(users[0].email);
        }
      } else if (user?.email) {
        setSelectedSellerEmail(user.email);
      }
    });
  }, [user]);

  // --- PERSISTENCIA Y DESCUENTOS ---
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedCart = localStorage.getItem('billing_draft_cart');
        const savedCustomer = localStorage.getItem('billing_draft_customer');
        if (savedCart) setCart(JSON.parse(savedCart));
        if (savedCustomer) {
          const c = JSON.parse(savedCustomer);
          if (c.name) setCustomerName(c.name);
          if (c.email) setCustomerEmail(c.email);
          if (c.selected) setSelectedCustomer(c.selected);
        }
      } catch (e) {
        console.error('Error loading draft', e);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('billing_draft_cart', JSON.stringify(cart));
      localStorage.setItem('billing_draft_customer', JSON.stringify({
        name: customerName,
        email: customerEmail,
        selected: selectedCustomer
      }));
    }
  }, [cart, customerName, customerEmail, selectedCustomer]);

  useEffect(() => {
    setCart(prev => prev.map(item => {
      let discount = 0;
      const profile = selectedCustomer?.benefit_profile?.toLowerCase() || '';
      if (profile.includes('constructor')) discount = 0.15;
      else if (profile.includes('distribuidor')) discount = 0.20;
      else if (profile.includes('vip')) discount = 0.10;
      
      const base = (item as any).originalPrice || item.price;
      return { ...item, price: base * (1 - discount) };
    }));
  }, [selectedCustomer]);
  // --------------------------------

  // --- QUOTATIONS & PENDING DRAFTS ---
  const [showQuotationsDialog, setShowQuotationsDialog] = useState(false);
  const [showPendingDraftsDialog, setShowPendingDraftsDialog] = useState(false);
  const [quotationsList, setQuotationsList] = useState<any[]>([]);
  const [pendingDraftsList, setPendingDraftsList] = useState<any[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [selectedPendingSaleId, setSelectedPendingSaleId] = useState<string | null>(null);

  const [quoteSearchTerm, setQuoteSearchTerm] = useState('');

  const fetchQuotations = async () => {
    setLoadingQuotes(true);
    try {
      const [{ data: quotesData, error }, { data: sellerMetaRow }] = await Promise.all([
        supabase
          .from('quotations')
          .select('*')
          .in('status', ['PENDIENTE', 'EN_ESPERA'])
          .order('created_at', { ascending: false }),
        supabase
          .from('system_config')
          .select('value')
          .eq('key', 'quotations_seller_metadata')
          .maybeSingle()
      ]);
      if (error) throw error;

      let localSellerMeta: Record<string, { sellerEmail?: string; sellerName?: string; paymentMethod?: string; creditDays?: number }> = {};
      if (typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem('nexway_quotations_seller_meta');
          if (raw) localSellerMeta = JSON.parse(raw);
        } catch {}
      }
      const remoteSellerMeta: Record<string, { sellerEmail?: string; sellerName?: string; paymentMethod?: string; creditDays?: number }> =
        sellerMetaRow?.value && typeof sellerMetaRow.value === 'object' ? sellerMetaRow.value : {};
      const combinedSellerMeta = { ...localSellerMeta, ...remoteSellerMeta };

      const normalizedQuotes = (quotesData || []).map((q: any) => ({
        ...q,
        quote_number: q.quote_number || `PRE-${String(q.id).slice(0, 6).toUpperCase()}`,
        sellerEmail: combinedSellerMeta[q.id]?.sellerEmail || '',
        sellerName: combinedSellerMeta[q.id]?.sellerName || '',
        paymentMethod: combinedSellerMeta[q.id]?.paymentMethod || 'Efectivo',
        creditDays: combinedSellerMeta[q.id]?.creditDays || 30,
        isPreFacturaSale: false
      }));

      // También incluir cualquier pre-factura legacy que hubiera quedado en sales (PENDIENTE_COBRO)
      let legacyPreFacturas: any[] = [];
      try {
        const { data: preSales } = await supabase
          .from('sales')
          .select('*')
          .eq('status', 'PENDIENTE_COBRO')
          .order('created_at', { ascending: false });
        if (preSales && preSales.length > 0) {
          const saleIds = preSales.map((s: any) => s.id);
          const { data: dbItems } = await supabase
            .from('sales_items')
            .select('*')
            .in('sale_id', saleIds);
          const itemsBySale: Record<string, any[]> = {};
          (dbItems || []).forEach((it: any) => {
            if (!itemsBySale[it.sale_id]) itemsBySale[it.sale_id] = [];
            itemsBySale[it.sale_id].push({
              id: it.id,
              sku: it.sku,
              name: it.sku,
              price: Number(it.price) || 0,
              quantity: Number(it.quantity) || 0
            });
          });
          legacyPreFacturas = preSales.map((pf: any) => ({
            id: pf.id,
            quote_number: pf.correlative || `PRE-${String(pf.id).slice(0, 6).toUpperCase()}`,
            customer_name: pf.customer_name || 'Consumidor Final',
            total: Number(pf.total) || 0,
            status: 'PENDIENTE',
            created_at: pf.created_at,
            items: itemsBySale[pf.id] || [],
            isPreFacturaSale: true
          }));
        }
      } catch {}

      setQuotationsList([...normalizedQuotes, ...legacyPreFacturas]);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar las cotizaciones / pre-facturas' });
    } finally {
      setLoadingQuotes(false);
    }
  };

  useEffect(() => {
    fetchQuotations();
  }, []);

  const fetchPendingDrafts = async () => {
    setLoadingQuotes(true);
    let remoteDrafts: any[] = [];
    try {
      // 1. Cargar Pre-Facturas pendientes desde public.sales
      const { data: preFacturas, error: preErr } = await supabase
        .from('sales')
        .select('*')
        .eq('status', 'PENDIENTE_COBRO')
        .order('created_at', { ascending: false });

      if (!preErr && preFacturas) {
        const saleIds = preFacturas.map(s => s.id);
        let itemsBySale: Record<string, any[]> = {};
        if (saleIds.length > 0) {
          const { data: dbItems } = await supabase
            .from('sales_items')
            .select('*')
            .in('sale_id', saleIds);
          
          (dbItems || []).forEach(it => {
            if (!itemsBySale[it.sale_id]) itemsBySale[it.sale_id] = [];
            itemsBySale[it.sale_id].push({
              id: it.id,
              sku: it.sku,
              name: it.sku,
              price: Number(it.price) || 0,
              quantity: Number(it.quantity) || 0
            });
          });
        }

        remoteDrafts = preFacturas.map(pf => ({
          id: pf.id,
          quote_number: pf.correlative,
          customer_name: pf.customer_name || 'Consumidor Final',
          total: Number(pf.total) || 0,
          created_at: pf.created_at,
          seller_email: pf.seller_email,
          station_name: pf.station_name,
          items: itemsBySale[pf.id] || [],
          isPreFactura: true
        }));
      }
    } catch (e) {
      console.error('Error fetching remote prefacturas:', e);
    }

    let localDrafts: any[] = [];
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('nexway_draft_sales_list');
      if (stored) {
        try {
          localDrafts = JSON.parse(stored);
        } catch (err) {
          console.error(err);
        }
      }
    }

    const combined = [...remoteDrafts, ...localDrafts];
    const seen = new Set<string>();
    const cleanList = combined.filter(item => {
      const num = item.quote_number || item.id;
      if (seen.has(num)) return false;
      seen.add(num);
      return true;
    });

    setPendingDraftsList(cleanList);
    setLoadingQuotes(false);
  };

  const loadQuotationToCart = (quote: any) => {
    const normalizedItems = (quote.items || []).map((it: any) => ({
      id: it.id || it.sku || `item-${Date.now()}`,
      sku: it.sku || it.id || 'ITEM',
      name: it.name || it.sku || 'Producto',
      price: Number(it.price) || 0,
      quantity: Number(it.quantity) || 1
    }));
    setCart(normalizedItems);
    const qCustName = (quote.customer_name || '').trim();
    setCustomerName(qCustName);
    if (qCustName && customers?.length > 0) {
      const matchedCust = customers.find(
        (c: any) => (c.name || '').trim().toLowerCase() === qCustName.toLowerCase()
      );
      if (matchedCust) setSelectedCustomer(matchedCust);
    }
    if (quote.sellerEmail) {
      setSelectedSellerEmail(quote.sellerEmail);
    }
    const validMethods = ['Efectivo', 'Tarjeta', 'Transferencia', 'Cheque', 'Credito', 'Mixto'];
    const qMethod = validMethods.includes(quote.paymentMethod) ? quote.paymentMethod : 'Efectivo';
    setPaymentMethod(qMethod as any);
    if (quote.creditDays) {
      setPosCreditDays(String(quote.creditDays));
    }
    if (quote.isPreFacturaSale) {
      setSelectedPendingSaleId(quote.id);
      setSelectedQuoteId(null);
    } else {
      setSelectedQuoteId(quote.id);
      setSelectedPendingSaleId(null);
    }
    setShowQuotationsDialog(false);
    toast({
      title: qMethod === 'Credito' ? '⚠️ Pre-Factura AL CRÉDITO Cargada' : 'Pre-Factura Cargada en Caja 📋',
      description:
        qMethod === 'Credito'
          ? `${quote.quote_number || 'Cotización'} configurada a CRÉDITO (${quote.creditDays || 30} días). Recuerde solicitar firma al imprimir.`
          : `Se cargó ${quote.quote_number || 'la cotización'} (${qMethod}) lista para facturar.`
    });
  };

  const deleteQuotationFromModal = async (quote: any, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (quote.isPreFacturaSale) {
        await supabase.from('sales').update({ status: 'CANCELADA' }).eq('id', quote.id);
      } else {
        await supabase.from('quotations').delete().eq('id', quote.id);
      }
      setQuotationsList(prev => prev.filter(q => q.id !== quote.id));
      toast({ title: 'Pre-Factura Eliminada', description: `Se removió ${quote.quote_number}.` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err?.message || 'No se pudo eliminar.' });
    }
  };

  const loadDraftToCart = (draft: any) => {
    setCart(draft.items || []);
    if (draft.customer_name && draft.customer_name !== 'Borrador Guardado' && draft.customer_name !== 'Cliente Consumidor Final') {
      setCustomerName(draft.customer_name);
    }
    if (draft.isPreFactura) {
      setSelectedPendingSaleId(draft.id);
    } else {
      setSelectedPendingSaleId(null);
    }
    setShowPendingDraftsDialog(false);
    setShowQuotationsDialog(false);
    toast({
      title: draft.isPreFactura ? 'Pre-Factura Cargada 📋' : 'Factura Restaurada 🛒',
      description: `Se cargó el vale ${draft.quote_number} en el carrito para su cobro.`
    });
  };

  const deleteDraft = async (draft: any) => {
    if (typeof window !== 'undefined') {
      const existing = localStorage.getItem('nexway_draft_sales_list');
      if (existing) {
        const list = JSON.parse(existing).filter((d: any) => d.quote_number !== draft.quote_number && d.id !== draft.id);
        localStorage.setItem('nexway_draft_sales_list', JSON.stringify(list));
      }
    }
    try {
      if (draft.isPreFactura) {
        await supabase.from('sales').update({ status: 'CANCELADA' }).eq('id', draft.id);
      } else {
        await supabase.from('quotations').delete().or(`quote_number.eq.${draft.quote_number},id.eq.${draft.id}`);
      }
    } catch (e) {
      console.error(e);
    }

    setPendingDraftsList(prev => prev.filter(d => d.quote_number !== draft.quote_number && d.id !== draft.id));
    toast({ title: 'Borrador Eliminado', description: `Se removió ${draft.quote_number}.` });
  };
  // -------------------------
  // Adjustment States (Notas Crédito/Débito)
  const [adjustmentType, setAdjustmentType] = useState<'CREDITO' | 'DEBITO'>('CREDITO');
  const [adjustmentForm, setAdjustmentForm] = useState({
    refDoc: '',
    customerId: null as string | null,
    customerName: '',
    reason: '',
    items: [] as any[],
    total: 0
  });
  
  const [invoiceSearchTerm, setInvoiceSearchTerm] = useState('');
  const [invoiceSearchResults, setInvoiceSearchResults] = useState<any[]>([]);
  const [selectedSaleInfo, setSelectedSaleInfo] = useState<any | null>(null);

  // --- ESC KEYBOARD LISTENER SYSTEM-WIDE ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setInvoiceSearchResults([]);
        setInvoiceSearchTerm('');
        setSearchTerm('');
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearchInvoices = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setInvoiceSearchTerm(term);
    
    if (term.trim().length === 0) {
      try {
        const { data } = await supabase
          .from('sales')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10);
        if (data) setInvoiceSearchResults(data);
      } catch (err) {
        console.error(err);
      }
      return;
    }

    try {
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .or(`customer_name.ilike.%${term}%,correlative.ilike.%${term}%`)
        .order('created_at', { ascending: false })
        .limit(12);
      
      if (!error && data) {
        setInvoiceSearchResults(data);
      }
    } catch (err) {
      console.error('Error buscando facturas:', err);
    }
  };

  const handleSelectInvoice = async (sale: any) => {
    try {
      const { data: dbItems } = await supabase
        .from('sales_items')
        .select('*')
        .eq('sale_id', sale.id);

      const itemsList = dbItems || [];
      const skus = Array.from(new Set(itemsList.map(i => i.sku).filter(Boolean)));
      let inventoryMap: Record<string, string> = {};

      if (skus.length > 0) {
        const { data: products } = await supabase
          .from('inventory')
          .select('sku, name')
          .in('sku', skus);

        if (products) {
          products.forEach(p => {
            inventoryMap[p.sku] = p.name;
          });
        }
      }

      const loadedItems = itemsList.map((item: any, idx: number) => ({
        id: item.id || `item-${idx}`,
        sku: item.sku,
        name: inventoryMap[item.sku] || item.product_name || item.sku || 'Producto',
        price: Number(item.price) || 0,
        quantity: Number(item.quantity) || 1,
        originalQuantity: Number(item.quantity) || 1
      }));

      setSelectedSaleInfo({
        id: sale.id,
        correlative: sale.correlative,
        customerName: sale.customer_name || 'Consumidor Final',
        docType: sale.doc_type || 'CF',
        total: Number(sale.total) || 0,
        createdAt: sale.created_at,
        items: loadedItems
      });

      setAdjustmentForm({
        refDoc: sale.correlative || sale.id.substring(0, 8),
        customerId: sale.customer_id || null,
        customerName: sale.customer_name || 'Cliente Consumidor Final',
        reason: adjustmentForm.reason || (adjustmentType === 'CREDITO' ? 'Devoluciones de mercancías (Cliente retorna producto)' : 'Intereses por mora (Cargos financieros por atraso)'),
        items: loadedItems,
        total: Number(sale.total) || 0
      });

      setInvoiceSearchTerm('');
      setInvoiceSearchResults([]);

      toast({
        title: "Factura DTE cargada",
        description: `Se cargó ${sale.correlative || 'comprobante'} con ${loadedItems.length} producto(s).`
      });
    } catch (err) {
      console.error('Error al cargar factura:', err);
    }
  };

  // Arqueo States (Flujo simplificado en 4 pasos: 1. Fondo Base, 2. Tarjetas/Otros, 3. Entrega Efectivo, 4. Validar y Cerrar)
  const [cashierVistoBueno, setCashierVistoBueno] = useState(false);
  const [baseFloatDenominations, setBaseFloatDenominations] = useState<Record<string, number>>({
    '100.00': 0, '50.00': 0, '20.00': 0, '10.00': 0, '5.00': 0, '1.00': 0,
    '0.25': 0, '0.10': 0, '0.05': 0, '0.01': 0
  });
  const [baseFloatDirectAmount, setBaseFloatDirectAmount] = useState<string>('');
  const [showBaseDenoms, setShowBaseDenoms] = useState(false);
  const [showExpensesBox, setShowExpensesBox] = useState(false);
  const [closingDifferenceNote, setClosingDifferenceNote] = useState<string>('');
  const [cashDenominations, setCashDenominations] = useState<Record<string, number>>({
    '100.00': 0, '50.00': 0, '20.00': 0, '10.00': 0, '5.00': 0, '1.00': 0,
    '0.25': 0, '0.10': 0, '0.05': 0, '0.01': 0
  });

  const adjustDenomination = (den: string, amount: number) => {
    setCashDenominations(prev => ({
      ...prev,
      [den]: Math.max(0, (prev[den] || 0) + amount)
    }));
  };

  const adjustBaseDenomination = (den: string, amount: number) => {
    setBaseFloatDirectAmount('');
    setBaseFloatDenominations(prev => ({
      ...prev,
      [den]: Math.max(0, (prev[den] || 0) + amount)
    }));
  };

  // Physical counts for other payment methods
  const [expenses, setExpenses] = useState<{description: string, amount: number}[]>([]);
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');

  const [physicalCard, setPhysicalCard] = useState<number>(0);
  const [physicalTransfer, setPhysicalTransfer] = useState<number>(0);
  const [physicalCredit, setPhysicalCredit] = useState<number>(0);
  const [physicalCheck, setPhysicalCheck] = useState<number>(0);
  const [reportedSalesAmount, setReportedSalesAmount] = useState<number | ''>('');
  const [lastClosingTimestamp, setLastClosingTimestamp] = useState<string | null>(null);

  // Filtros de Historial y Consulta de Arqueos Pasados
  const [historialFilter, setHistorialFilter] = useState<'active_shift' | 'all' | 'custom'>('active_shift');
  const [historialCustomDate, setHistorialCustomDate] = useState<string>('');
  const [pastDailyClosings, setPastDailyClosings] = useState<any[]>([]);
  const [selectedPastClosure, setSelectedPastClosure] = useState<any | null>(null);

  // Relevo de Cajeros (Entrega y Recepción de Turno)
  const [outgoingCashierEmail, setOutgoingCashierEmail] = useState<string>('');
  const [incomingCashierEmail, setIncomingCashierEmail] = useState<string>('SIN_RELEVO');

  // Persistencia de borrador de conteo de arqueo
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedArqueo = localStorage.getItem('nexway_saved_arqueo_draft');
        if (savedArqueo) {
          const parsed = JSON.parse(savedArqueo);
          if (parsed.cashDenominations) setCashDenominations(parsed.cashDenominations);
          if (parsed.baseFloatDenominations) setBaseFloatDenominations(parsed.baseFloatDenominations);
          if (parsed.baseFloatDirectAmount !== undefined) setBaseFloatDirectAmount(parsed.baseFloatDirectAmount);
          if (parsed.closingDifferenceNote !== undefined) setClosingDifferenceNote(parsed.closingDifferenceNote);
          if (parsed.expenses) setExpenses(parsed.expenses);
          if (parsed.physicalCard !== undefined) setPhysicalCard(parsed.physicalCard);
          if (parsed.physicalTransfer !== undefined) setPhysicalTransfer(parsed.physicalTransfer);
          if (parsed.physicalCredit !== undefined) setPhysicalCredit(parsed.physicalCredit);
          if (parsed.physicalCheck !== undefined) setPhysicalCheck(parsed.physicalCheck);
          if (parsed.cashierVistoBueno !== undefined) setCashierVistoBueno(parsed.cashierVistoBueno);
          if (parsed.reportedSalesAmount !== undefined) setReportedSalesAmount(parsed.reportedSalesAmount);
        }
      } catch (e) {
        console.error('Error reading nexway_saved_arqueo_draft:', e);
      }
    }
  }, []);

  const handleSaveArqueoDraft = async () => {
    const floatAmount = cashConfig?.cashFloat || 100.00;
    const arqueoDraft = {
      cashFloat: floatAmount,
      totalPhysicalCash,
      netPhysicalCash,
      reportedSalesAmount,
      cashDenominations,
      baseFloatDenominations,
      baseFloatDirectAmount,
      closingDifferenceNote,
      expenses,
      physicalCard,
      physicalTransfer,
      physicalCredit,
      physicalCheck,
      cashierVistoBueno,
      savedBy: user?.email || selectedSellerEmail || 'Cajero POS',
      stationName: activeStation?.name || 'Caja Principal',
      savedAt: new Date().toISOString()
    };

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('nexway_saved_arqueo_draft', JSON.stringify(arqueoDraft));
      } catch (e) {
        console.error('Error saving local arqueo draft:', e);
      }
    }

    try {
      await supabase
        .from('system_config')
        .upsert({
          key: 'active_cash_draft',
          value: arqueoDraft
        }, { onConflict: 'key' });

      toast({
        title: "Conteo y Fondo Sincronizados ☁️",
        description: "El conteo y fondo base de caja se enviaron a Supabase para consulta remota en Gerencia."
      });
    } catch (e: any) {
      toast({
        title: "Conteo Guardado Localmente 💾",
        description: "Se guardó el avance en este equipo."
      });
    }
  };

  const handleResetArqueo = () => {
    setCashDenominations({
      '100.00': 0, '50.00': 0, '20.00': 0, '10.00': 0, '5.00': 0, '1.00': 0,
      '0.25': 0, '0.10': 0, '0.05': 0, '0.01': 0
    });
    setBaseFloatDenominations({
      '100.00': 0, '50.00': 0, '20.00': 0, '10.00': 0, '5.00': 0, '1.00': 0,
      '0.25': 0, '0.10': 0, '0.05': 0, '0.01': 0
    });
    setBaseFloatDirectAmount('');
    setClosingDifferenceNote('');
    setExpenses([]);
    setPhysicalCard(0);
    setPhysicalTransfer(0);
    setPhysicalCredit(0);
    setPhysicalCheck(0);
    setReportedSalesAmount('');
    setCashierVistoBueno(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('nexway_saved_arqueo_draft');
    }
    toast({ title: "Arqueo Reiniciado", description: "Los valores de conteo han sido restaurados a cero." });
  };


  // Checkout Modal States
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentReference, setPaymentReference] = useState('');
  const [posCreditDays, setPosCreditDays] = useState<string>('30');
  const [creditOverrideAuth, setCreditOverrideAuth] = useState<CreditOverrideAuthorization | null>(null);
  const [isCreditAuthModalOpen, setIsCreditAuthModalOpen] = useState(false);
  const [authManagerEmail, setAuthManagerEmail] = useState('');
  const [authManagerPin, setAuthManagerPin] = useState('');
  const [authReason, setAuthReason] = useState('');
  const [authorizingCredit, setAuthorizingCredit] = useState(false);
  const [showChangePin, setShowChangePin] = useState(false);
  const [newManagerPinInput, setNewManagerPinInput] = useState('');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [completedSaleData, setCompletedSaleData] = useState<{
    correlative: string;
    docType: string;
    total: number;
    cashReceived: number;
    change: number;
    paymentMethod?: string;
    creditDays?: number;
    creditAmount?: number;
    creditAuthorizedBy?: string;
    creditAuthReason?: string;
    customerName: string;
    customerEmail?: string;
    customerNit?: string;
    customerNrc?: string;
    customerGiro?: string;
    customerAddress?: string;
    items: any[];
    dteEstado?: 'PROCESADO' | 'RECHAZADO' | 'ERROR';
    selloRecibido?: string | null;
    codigoGeneracion?: string | null;
    numeroControl?: string | null;
    dteObservaciones?: string[];
  } | null>(null);

  // Estado para Simulación de Envío de Correo DTE
  const [isEmailSimOpen, setIsEmailSimOpen] = useState(false);
  const [emailSimSaleData, setEmailSimSaleData] = useState<DteEmailSalePayload | null>(null);

  // Estados para datos cargados desde Supabase
  const [cashConfig, setCashConfig] = useState<any>({ cashFloat: 100 });
  const [inventory, setInventory] = useState<any[]>([]);
  const [pendingIncomingQty, setPendingIncomingQty] = useState<Record<string, number>>({});

  // Estados para Resiliencia y Modo Offline
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [offlineQueue, setOfflineQueue] = useState<OfflineSaleRecord[]>([]);
  const [isSyncingOffline, setIsSyncingOffline] = useState<boolean>(false);

  useEffect(() => {
    // 1. Detectar conectividad inicial
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
      setOfflineQueue(getOfflineSalesQueue());

      const handleOnline = () => {
        setIsOnline(true);
        toast({
          title: "Conexión Restablecida 🌐",
          description: "La red está activa. Sincronizando ventas pendientes..."
        });
        triggerOfflineSync();
      };

      const handleOffline = () => {
        setIsOnline(false);
        toast({
          variant: "destructive",
          title: "Modo Offline Activado ⚠️",
          description: "Sin conexión a internet. Las ventas se guardarán localmente para no detener la caja."
        });
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  const triggerOfflineSync = async () => {
    if (isSyncingOffline) return;
    setIsSyncingOffline(true);
    try {
      const result = await syncOfflineSalesQueue();
      setOfflineQueue(getOfflineSalesQueue());
      if (result.synced > 0) {
        toast({
          title: "Sincronización Exitosa ✅",
          description: `Se sincronizaron ${result.synced} venta(s) guardadas en contingencia.`
        });
        await loadBillingData();
      }
      if (result.errors.length > 0) {
        toast({
          variant: "destructive",
          title: "Ventas pendientes de sync",
          description: `Quedan ${result.remaining} venta(s) por sincronizar.`
        });
      }
    } catch (e: any) {
      console.warn('Error durante sincronización offline:', e);
    } finally {
      setIsSyncingOffline(false);
    }
  };

  useEffect(() => {
    if (activeWarehouse) {
      loadBillingData();
    }
  }, [activeWarehouse]);

  const [salesAll, setSalesAll] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [journalPayments, setJournalPayments] = useState<any[]>([]);

  // Estados para nuevo abono
  const [selectedSaleForAbono, setSelectedSaleForAbono] = useState<any | null>(null);
  const [abonoAmount, setAbonoAmount] = useState<string>('');
  const [abonoPaymentMethod, setAbonoPaymentMethod] = useState<string>('Efectivo');
  const [abonoNotes, setAbonoNotes] = useState<string>('');
  const [isRegisteringAbono, setIsRegisteringAbono] = useState<boolean>(false);

  // Estados para ver detalle e imprimir PDF de venta (Historial)
  const [selectedSaleDetails, setSelectedSaleDetails] = useState<any | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Estados para corrección de método de pago
  const [editingPaymentSale, setEditingPaymentSale] = useState<any | null>(null);
  const [isPaymentCorrectionOpen, setIsPaymentCorrectionOpen] = useState(false);
  const [newPaymentMethod, setNewPaymentMethod] = useState<string>('');

  // Shift Lock States
  const [isShiftOpen, setIsShiftOpen] = useState(false);
  const [shiftPassword, setShiftPassword] = useState('');
  const [shiftError, setShiftError] = useState('');

  // Close Shift States
  const [isCloseShiftOpen, setIsCloseShiftOpen] = useState(false);
  const [reportedCash, setReportedCash] = useState('');
  const [isDayClosingConfirmOpen, setIsDayClosingConfirmOpen] = useState(false);

  // Inicializar cajero saliente al abrir diálogo de cierre
  useEffect(() => {
    if (isDayClosingConfirmOpen) {
      if (user?.email) {
        setOutgoingCashierEmail(user.email);
      } else if (appUsersList.length > 0) {
        setOutgoingCashierEmail(appUsersList[0].email);
      }
    }
  }, [isDayClosingConfirmOpen, user, appUsersList]);

  const handleOpenShift = async () => {
    setShiftError('');
    if (!shiftPassword) {
      setShiftError('Ingresa tu contraseña.');
      return;
    }
    
    // Simplificación de validación para entorno local / demostrativo
    if (shiftPassword.length < 4) {
      setShiftError('Contraseña incorrecta (Usa al menos 4 caracteres).');
      return;
    }

    setIsShiftOpen(true);
    setShiftPassword('');
    toast({ title: 'Turno Abierto', description: 'Jornada iniciada con éxito.' });
  };

  const handleCloseShift = async () => {
    if (!reportedCash || isNaN(Number(reportedCash))) return;
    
    try {
      const expected = (cashConfig?.cashFloat || 0) + systemCashSales - totalExpenses; // Calculado de ventas - gastos
      const reported = parseFloat(reportedCash);
      const diff = reported - expected;
      const status = diff === 0 ? 'CERRADO' : 'DESCUADRE';

      const { data: { user } } = await supabase.auth.getUser();

      await supabase.from('cierre_turnos_log').insert({
        user_id: user?.id,
        opened_at: new Date(new Date().setHours(8,0,0,0)).toISOString(), // mock open time
        closed_at: new Date().toISOString(),
        expected_cash: expected,
        reported_cash: reported,
        difference: diff,
        status: status
      });

      toast({ 
        title: 'Turno Cerrado', 
        description: `Se reportó $${reported.toFixed(2)}. Diferencia: $${diff.toFixed(2)}`,
        variant: diff !== 0 ? 'destructive' : 'default'
      });
      
      setIsCloseShiftOpen(false);
      setIsShiftOpen(false);
      setReportedCash('');
    } catch (err: any) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error al cerrar turno', description: err.message });
    }
  };

  const handleCorrectPaymentMethod = async () => {
    if (!editingPaymentSale || !newPaymentMethod || editingPaymentSale.paymentMethod === newPaymentMethod) return;

    try {
      const { error: saleErr } = await supabase
        .from('sales')
        .update({ payment_method: newPaymentMethod })
        .eq('id', editingPaymentSale.id);
      
      if (saleErr) throw saleErr;

      await supabase.from('audit_logs').insert({
        user_id: user?.id,
        action: 'CORRECTION_PAYMENT_METHOD',
        entity_id: editingPaymentSale.id,
        old_value: { payment_method: editingPaymentSale.paymentMethod },
        new_value: { payment_method: newPaymentMethod }
      });

      await supabase.from('journal').insert({
        description: `Reversión por Corrección de Pago [${editingPaymentSale.correlative}] - Método anterior: ${editingPaymentSale.paymentMethod}`,
        type: 'Egreso',
        amount: editingPaymentSale.total
      });
      await supabase.from('journal').insert({
        description: `Ajuste por Corrección de Pago [${editingPaymentSale.correlative}] - Nuevo método: ${newPaymentMethod}`,
        type: 'Ingreso',
        amount: editingPaymentSale.total
      });

      await logNexbotEvent(
        'billing', 
        'CORRECCION_PAGO', 
        { correlative: editingPaymentSale.correlative, old: editingPaymentSale.paymentMethod, new: newPaymentMethod, amount: editingPaymentSale.total }, 
        `El usuario corrigió el método de pago de la venta ${editingPaymentSale.correlative} de ${editingPaymentSale.paymentMethod} a ${newPaymentMethod}. El sistema registró el cambio en auditoría y generó un asiento dual contable.`
      );

      toast({ title: "Método de Pago Actualizado", description: "El cambio ha sido registrado correctamente." });
      await loadBillingData();
      setIsPaymentCorrectionOpen(false);
      setEditingPaymentSale(null);
    } catch (err: any) {
      console.error(err);
      toast({ variant: "destructive", title: "Error", description: err.message || "No se pudo actualizar el método de pago." });
    }
  };

  const handleInvalidateSale = async (sale: any) => {
    if (sale.status === 'CANCELADA') return;
    if (!confirm(`¿Estás seguro de invalidar la venta ${sale.correlative}? Esta acción no se puede deshacer.`)) return;
    
    try {
      const { error } = await supabase
        .from('sales')
        .update({ status: 'CANCELADA' })
        .eq('id', sale.id);
      
      if (error) throw error;
      
      toast({
        title: "Venta Invalidada",
        description: `El documento ${sale.correlative} ha sido marcado como CANCELADA.`
      });
      await loadBillingData();
    } catch (err: any) {
      console.error('Error al invalidar:', err);
      toast({
        variant: "destructive",
        title: "Error al invalidar",
        description: err.message || "No se pudo invalidar la venta."
      });
    }
  };

  const handleFetchSaleDetails = async (sale: any) => {
    setLoadingDetails(true);
    setIsDetailsDialogOpen(true);
    try {
      const { data: itemsData, error } = await supabase
        .from('sales_items')
        .select('*')
        .eq('sale_id', sale.id);

      if (error) throw error;

      const items = itemsData || [];

      const mappedItems = items.map((item: any, idx: number) => ({
        ...item,
        id: item.id || item.sku || `item-${idx}`,
        name: item.name || 'Producto General'
      }));

      setSelectedSaleDetails({
        ...sale,
        total: parseFloat(sale.total) || 0,
        items: mappedItems
      });
    } catch (err: any) {
      console.error(err);
      toast({ 
        variant: "destructive", 
        title: "Error al cargar detalles", 
        description: err.message || "No se pudo obtener el detalle de los productos vendidos." 
      });
      setIsDetailsDialogOpen(false);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleOpenEmailSimulatorForSale = async (sale: any) => {
    try {
      let saleItems = sale.items || [];
      if (!saleItems || saleItems.length === 0) {
        const { data: itemsData } = await supabase
          .from('sales_items')
          .select('*')
          .eq('sale_id', sale.id);
        saleItems = (itemsData || []).map((item: any) => ({
          sku: item.sku || 'ITEM',
          name: item.name || 'Producto Facturado',
          quantity: Number(item.quantity) || 1,
          price: parseFloat(item.price) || 0
        }));
      }
      if (saleItems.length === 0) {
        saleItems = [{ sku: 'GEN-01', name: 'Productos Varios según Factura', quantity: 1, price: parseFloat(sale.total) || 0 }];
      }

      const matchedCustomer = customers?.find((c: any) => c.name?.toLowerCase() === (sale.customer || sale.customerName || '').toLowerCase());

      setEmailSimSaleData({
        correlative: sale.correlative || 'DTE-01-0001',
        docType: sale.docType || 'CF',
        customerName: sale.customer || sale.customerName || 'Consumidor Final',
        customerEmail: sale.customerEmail || matchedCustomer?.email || cashConfig?.catchAllEmail || 'cliente@empresa.com.sv',
        customerNit: matchedCustomer?.nit || sale.nit,
        customerNrc: matchedCustomer?.nrc || sale.nrc,
        total: parseFloat(sale.total) || 0,
        paymentMethod: sale.paymentMethod || 'Efectivo',
        timestamp: sale.timestamp || new Date().toISOString(),
        items: saleItems
      });
      setIsEmailSimOpen(true);
    } catch (e) {
      console.error('Error preparando correo DTE:', e);
    }
  };

  const handleDuplicateSale = async (sale: any) => {
    try {
      setLoadingDetails(true);
      const { data: itemsData, error } = await supabase
        .from('sales_items')
        .select('*')
        .eq('sale_id', sale.id);

      if (error) throw error;
      if (!itemsData || itemsData.length === 0) {
        toast({ variant: 'destructive', title: 'Sin ítems', description: 'Esta venta no contiene productos detallados.' });
        return;
      }

      const newCart = itemsData.map((it: any, idx: number) => ({
        id: it.id || it.sku || `dup-${Date.now()}-${idx}`,
        sku: it.sku || 'S/N',
        name: it.name || 'Producto',
        price: parseFloat(it.price) || 0,
        quantity: parseFloat(it.quantity) || 1,
        taxType: it.taxType || 'gravado'
      }));

      setCart(newCart);
      setActiveTab('facturacion');
      toast({
        title: "Venta Duplicada en Carrito 📋",
        description: `Se cargaron ${newCart.length} productos listos para una nueva emisión.`
      });
    } catch (err: any) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error al duplicar venta', description: err.message });
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleCorrectAndReissueSale = async (sale: any) => {
    try {
      setLoadingDetails(true);
      const { data: itemsData, error } = await supabase
        .from('sales_items')
        .select('*')
        .eq('sale_id', sale.id);

      if (error) throw error;
      if (!itemsData || itemsData.length === 0) {
        toast({ variant: 'destructive', title: 'Sin ítems', description: 'Esta venta no contiene productos detallados.' });
        return;
      }

      const newCart = itemsData.map((it: any, idx: number) => ({
        id: it.id || it.sku || `reissue-${Date.now()}-${idx}`,
        sku: it.sku || 'S/N',
        name: it.name || 'Producto',
        price: parseFloat(it.price) || 0,
        quantity: parseFloat(it.quantity) || 1,
        taxType: it.taxType || 'gravado'
      }));

      setCart(newCart);
      if (sale.docType) setDocType(sale.docType);
      setActiveTab('facturacion');
      toast({
        title: "Modo Corrección / Re-emisión ⚡",
        description: `Productos del DTE ${sale.docNumber || (sale.id && sale.id.slice(0, 8))} cargados. Ajuste los datos y emita el nuevo comprobante.`
      });
    } catch (err: any) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error al re-emitir venta', description: err.message });
    } finally {
      setLoadingDetails(false);
    }
  };


  // Función para cargar todos los datos requeridos en paralelo (rápida inicialización POS)
  const loadBillingData = async () => {
    try {
      setLoadingData(true);

      let whQuery = supabase.from('warehouses').select('*');
      if (activeBranchId) {
        whQuery = whQuery.eq('branch_id', activeBranchId);
      }

      let salesQuery = supabase.from('sales').select('*');
      if (activeBranchId) {
        salesQuery = salesQuery.eq('branch_id', activeBranchId);
      }

      const [
        custRes,
        custMetaRes,
        whRes,
        salesRes,
        closingsRes,
        journalRes,
        cashConfRes,
        pendingTrRes,
        initInvRes
      ] = await Promise.all([
        supabase.from('customers').select('*').order('name').limit(300),
        supabase.from('system_config').select('value').eq('key', 'customers_extended_metadata').maybeSingle(),
        whQuery.order('name'),
        salesQuery.order('created_at', { ascending: false }).limit(300),
        supabase.from('daily_closings').select('*').order('created_at', { ascending: false }).limit(60),
        supabase.from('journal').select('*').eq('type', 'Ingreso').order('created_at', { ascending: false }).limit(200),
        supabase.from('system_config').select('value').eq('key', 'cash_config').maybeSingle(),
        supabase.from('transfers').select('*').in('status', ['PETICION', 'ENVIADO']).limit(50),
        supabase.from('inventory').select('*').limit(50)
      ]);

      let localCustMeta: Record<string, any> = {};
      if (typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem('nexway_customers_extended_meta');
          if (raw) localCustMeta = JSON.parse(raw);
        } catch {
          // ignore
        }
      }
      const remoteCustMeta: Record<string, any> =
        custMetaRes.data?.value && typeof custMetaRes.data.value === 'object' ? custMetaRes.data.value : {};
      const combinedCustMeta = { ...localCustMeta, ...remoteCustMeta };

      const enrichedCustomers = (custRes.data || []).map((c: any) => ({
        ...c,
        ...(combinedCustMeta[c.id] || {})
      }));
      setCustomers(enrichedCustomers);

      const whData = whRes.data || [];
      setWarehouses(whData);

      const salesData = salesRes.data || [];
      setSalesAll(salesData.map(s => ({
        id: s.id,
        correlative: s.correlative,
        docType: s.doc_type,
        customerId: s.customer_id,
        total: parseFloat(s.total) || 0,
        status: s.status,
        timestamp: s.created_at,
        paymentMethod: s.payment_method || 'Efectivo',
        paymentDetails: s.payment_details || null,
        customer: s.customer_name || 'Consumidor Final'
      })));

      const closingsData = closingsRes.data || [];
      setPastDailyClosings(closingsData);
      if (closingsData.length > 0) {
        setLastClosingTimestamp(closingsData[0].created_at || closingsData[0].date);
      } else {
        setLastClosingTimestamp(null);
      }

      setJournalPayments(journalRes.data || []);

      if (cashConfRes.data?.value) {
        setCashConfig(cashConfRes.data.value);
      }

      const pendingTransfers = pendingTrRes.data || [];
      const incomingMap: Record<string, number> = {};
      const activeWhName = activeWarehouse?.name || activeStation?.warehouse_name;
      if (activeWhName) {
        pendingTransfers.forEach((t: any) => {
          if (t.destination === activeWhName) {
            (t.items || []).forEach((item: any) => {
              incomingMap[item.sku] = (incomingMap[item.sku] || 0) + (parseFloat(item.quantity) || 0);
            });
          }
        });
      }

      const initInvData = initInvRes.data || [];
      if (initInvData.length > 0) {
        const initSkus = initInvData.map(item => item.sku);
        const { data: initStData } = await supabase
          .from('inventory_stock')
          .select('sku, warehouse_id, quantity')
          .in('sku', initSkus);

        const whMap: Record<string, string> = {};
        whData.forEach((w: any) => { whMap[w.id] = w.name; });

        const mappedInit = initInvData.map(item => {
          const itemStocks = (initStData || []).filter(s => s.sku === item.sku);
          const bodegasMap: Record<string, number> = {};
          itemStocks.forEach(s => {
            const whName = whMap[s.warehouse_id];
            if (whName) bodegasMap[whName] = parseFloat(s.quantity) || 0;
          });
          const stationWhName = activeWarehouse?.name || null;
          const filteredQty = stationWhName ? (bodegasMap[stationWhName] || 0) : Object.values(bodegasMap).reduce((sum, val) => sum + val, 0);

          return {
            id: item.sku,
            sku: item.sku,
            name: item.name,
            category: item.category,
            price: parseFloat(item.price) || 0,
            quantity: filteredQty,
            bodegas: bodegasMap
          };
        });
        setInventory(mappedInit);
        try {
          const sMap: Record<string, number> = {};
          mappedInit.forEach(p => { sMap[p.sku] = p.quantity; });
          cacheOfflineCatalog(mappedInit, sMap);
        } catch {}
      }

    } catch (e: any) {
      console.error('Error al cargar datos en facturación:', e);
      // Fallback a catálogo local offline si falla la conexión
      const offlineCat = getOfflineCatalog();
      if (offlineCat.products.length > 0) {
        setInventory(offlineCat.products);
      }
    } finally {
      setLoadingData(false);
    }
  };

  const handleSearchInventory = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchTerm.trim()) {
      setInventory([]);
      return;
    }

    // Si estamos offline, buscar directamente en la caché local
    if (typeof window !== 'undefined' && !navigator.onLine) {
      const offlineCat = getOfflineCatalog();
      const term = searchTerm.toLowerCase().trim();
      const matched = offlineCat.products.filter(p => 
        (p.sku && p.sku.toLowerCase().includes(term)) ||
        (p.name && p.name.toLowerCase().includes(term))
      );
      setInventory(matched);
      return;
    }

    setLoadingData(true);
    try {
      let whQuery = supabase.from('warehouses').select('*');
      if (activeBranchId) {
        whQuery = whQuery.eq('branch_id', activeBranchId);
      }
      const { data: whData } = await whQuery;
      const { data: invData } = await supabase
        .from('inventory')
        .select('*')
        .or(`sku.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%`)
        .limit(50);
      
      const foundSkus = (invData || []).map(item => item.sku);
      let stockData: any[] = [];
      if (foundSkus.length > 0) {
        const { data: stData } = await supabase
          .from('inventory_stock')
          .select('*')
          .in('sku', foundSkus);
        stockData = stData || [];
      }

      const whMap: Record<string, string> = {};
      (whData || []).forEach(w => {
        whMap[w.id] = w.name;
      });

      const mappedInventory = (invData || []).map(item => {
        const itemStocks = stockData.filter(s => s.sku === item.sku);
        const bodegasMap: Record<string, number> = {};
        itemStocks.forEach(s => {
          const whName = whMap[s.warehouse_id];
          if (whName) {
            bodegasMap[whName] = parseFloat(s.quantity) || 0;
          }
        });

        // Si hay bodega activa por caja asignada, mostrar solo ese stock
        const stationWhName = activeWarehouse?.name || null;
        const filteredQty = stationWhName
          ? (bodegasMap[stationWhName] || 0)
          : Object.values(bodegasMap).reduce((sum, val) => sum + val, 0);

        return {
          id: item.sku,
          sku: item.sku,
          name: item.name,
          category: item.category,
          price: parseFloat(item.price) || 0,
          quantity: filteredQty,
          bodegas: bodegasMap
        };
      });

      if (mappedInventory.length === 1 && mappedInventory[0].sku.toLowerCase() === searchTerm.trim().toLowerCase()) {
        addToCart(mappedInventory[0]);
        setSearchTerm('');
        setInventory([]);
        return;
      }

      setInventory(mappedInventory);
    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "Error", description: "No se pudo realizar la búsqueda." });
    } finally {
      setLoadingData(false);
    }
  };

  // Cargar datos al montar el componente
  useEffect(() => {
    loadBillingData();

    // Restaurar estados desde sessionStorage
    if (typeof window !== 'undefined') {
      const storedCart = sessionStorage.getItem('bill_cart');
      if (storedCart) {
        try { setCart(JSON.parse(storedCart)); } catch (e) {}
      }
      const storedCustName = sessionStorage.getItem('bill_customerName');
      if (storedCustName) setCustomerName(storedCustName);

      const storedCustEmail = sessionStorage.getItem('bill_customerEmail');
      if (storedCustEmail) setCustomerEmail(storedCustEmail);

      const storedSelCust = sessionStorage.getItem('bill_selectedCustomer');
      if (storedSelCust) {
        try { setSelectedCustomer(JSON.parse(storedSelCust)); } catch (e) {}
      }

      const storedDocType = sessionStorage.getItem('bill_docType');
      if (storedDocType) setDocType(storedDocType as any);

      const storedPaymentMethod = sessionStorage.getItem('bill_paymentMethod');
      if (storedPaymentMethod) setPaymentMethod(storedPaymentMethod as any);
    }
  }, []);

  // Sincronizar estados a sessionStorage
  useEffect(() => {
    sessionStorage.setItem('bill_cart', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    sessionStorage.setItem('bill_customerName', customerName);
  }, [customerName]);

  useEffect(() => {
    sessionStorage.setItem('bill_customerEmail', customerEmail);
  }, [customerEmail]);

  useEffect(() => {
    if (selectedCustomer) {
      sessionStorage.setItem('bill_selectedCustomer', JSON.stringify(selectedCustomer));
    } else {
      sessionStorage.removeItem('bill_selectedCustomer');
    }
  }, [selectedCustomer]);

  useEffect(() => {
    sessionStorage.setItem('bill_docType', docType);
  }, [docType]);

  useEffect(() => {
    sessionStorage.setItem('bill_paymentMethod', paymentMethod);
  }, [paymentMethod]);

  // Cargar precios especiales del cliente seleccionado
  useEffect(() => {
    const fetchClientPrices = async () => {
      if (selectedCustomer?.price_list_id) {
        try {
          const { data, error } = await supabase
            .from('price_list_items')
            .select('sku, price')
            .eq('price_list_id', selectedCustomer.price_list_id);
          if (error) throw error;
          if (data) {
            const map: Record<string, number> = {};
            data.forEach((item: any) => {
              map[item.sku] = parseFloat(item.price) || 0;
            });
            setClientPricesMap(map);
            
            // Re-evaluar precios de ítems actuales en el carrito
            setCart(prev => prev.map(item => {
              if (map[item.sku] !== undefined) {
                return { ...item, price: map[item.sku] };
              }
              return item;
            }));
          }
        } catch (err) {
          console.error('Error fetching custom prices:', err);
        }
      } else {
        setClientPricesMap({});
      }
    };
    fetchClientPrices();
  }, [selectedCustomer]);

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
    loadBillingData();
  }, [activeBranchId]);

  const handleRegisterAbono = async () => {
    if (!selectedSaleForAbono || !abonoAmount || parseFloat(abonoAmount) <= 0) {
      toast({ variant: "destructive", title: "Datos inválidos", description: "Ingrese un monto válido." });
      return;
    }

    const amt = parseFloat(abonoAmount);
    const saleTotal = selectedSaleForAbono.total;
    
    const prevPaid = journalPayments
      ?.filter(j => j.description.includes(`[${selectedSaleForAbono.correlative}]`))
      .reduce((sum, j) => sum + (parseFloat(j.amount) || 0), 0) || 0;
      
    const currentBalance = saleTotal - prevPaid;

    if (amt > currentBalance + 0.01) {
      toast({ 
        variant: "destructive", 
        title: "Monto Excedido", 
        description: `El abono de $${amt.toFixed(2)} supera el saldo pendiente de $${currentBalance.toFixed(2)}.` 
      });
      return;
    }

    setIsRegisteringAbono(true);
    try {
      const { error: journalErr } = await supabase
        .from('journal')
        .insert({
          description: `Abono a Crédito [${selectedSaleForAbono.correlative}] - Cliente: ${selectedSaleForAbono.customer}`,
          type: 'Ingreso',
          amount: amt
        });

      if (journalErr) throw journalErr;

      const newBalance = currentBalance - amt;
      if (newBalance <= 0.01) {
        const { error: saleUpdateErr } = await supabase
          .from('sales')
          .update({ status: 'ACTIVA' })
          .eq('id', selectedSaleForAbono.id);

        if (saleUpdateErr) throw saleUpdateErr;
        
        toast({ title: "¡Crédito Cancelado!", description: `La factura ${selectedSaleForAbono.correlative} ha sido pagada en su totalidad.` });
      } else {
        toast({ title: "Abono Registrado", description: `Se abonó $${amt.toFixed(2)} a la factura ${selectedSaleForAbono.correlative}. Saldo restante: $${newBalance.toFixed(2)}.` });
      }

      setSelectedSaleForAbono(null);
      setAbonoAmount('');
      setAbonoNotes('');
      await loadBillingData();
    } catch (err: any) {
      console.error('Error al registrar abono:', err);
      toast({ variant: "destructive", title: "Error al registrar", description: err.message || "Ocurrió un error inesperado." });
    } finally {
      setIsRegisteringAbono(false);
    }
  };

  const filteredProducts = inventory;

  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    return customers.filter(c => 
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      (c.nit && c.nit.toLowerCase().includes(customerSearch.toLowerCase()))
    );
  }, [customerSearch, customers]);

  // Ventas asociadas únicamente a la Jornada / Turno Activo (posteriores al último cierre)
  const activeShiftSales = useMemo(() => {
    if (!salesAll || salesAll.length === 0) return [];

    if (lastClosingTimestamp) {
      const closingTime = new Date(lastClosingTimestamp).getTime();
      return salesAll.filter(s => {
        if (!s.timestamp) return false;
        const saleTime = new Date(s.timestamp).getTime();
        return saleTime > closingTime;
      });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    return salesAll.filter(s => {
      if (!s.timestamp) return false;
      const saleDateStr = new Date(s.timestamp).toISOString().split('T')[0];
      return saleDateStr === todayStr;
    });
  }, [salesAll, lastClosingTimestamp]);

  const systemCashSales = useMemo(() => 
    activeShiftSales?.filter(s => s.status !== 'CANCELADA' && s.status !== 'PENDIENTE DE IMPRESION' && s.status !== 'PENDIENTE')
      .reduce((acc, s) => {
        if (s.paymentMethod === 'Efectivo') return acc + (s.total || 0);
        if (s.paymentMethod === 'Mixto' && s.paymentDetails?.cash) return acc + (Number(s.paymentDetails.cash) || 0);
        return acc;
      }, 0) || 0
  , [activeShiftSales]);

  // Cart Functions
  const totalCart = useMemo(() => cart.reduce((acc, item) => acc + (item.price * (Number(item.quantity) || 0)), 0), [cart]);

  // Validación Ministerio de Hacienda (CCF) y Retención 1% IVA (Gran Contribuyente)
  const ccfMhValidation = useMemo(() => {
    if (docType !== 'CCF' || !selectedCustomer) return null;
    return validateContribuyenteMH({ ...selectedCustomer, category: 'Crédito Fiscal' });
  }, [docType, selectedCustomer]);

  const ivaRetention1 = useMemo(() => {
    if (docType !== 'CCF' || !selectedCustomer?.is_gran_contribuyente) return 0;
    const subtotalGravado = totalCart / 1.13;
    return calculateIvaRetention1Percent(subtotalGravado, true, 'CCF');
  }, [docType, selectedCustomer, totalCart]);

  const netPayableTotal = Math.max(0, totalCart - ivaRetention1);

  // Split Payment Calculations
  const splitCashVal = parseFloat(splitAmounts.cash) || 0;
  const splitCardVal = parseFloat(splitAmounts.card) || 0;
  const splitTransferVal = parseFloat(splitAmounts.transfer) || 0;
  const splitCreditVal = parseFloat(splitAmounts.credit) || 0;
  const splitChequeVal = parseFloat(splitAmounts.cheque) || 0;
  const splitTotal = splitCashVal + splitCardVal + splitTransferVal + splitCreditVal + splitChequeVal;
  const splitRemaining = Math.max(0, totalCart - splitTotal);

  // Cálculos de Deuda Financiera y Límites de Crédito
  const { pendingCreditInvoices, outstandingDebt } = useMemo(() => {
    if (!selectedCustomer) return { pendingCreditInvoices: [], outstandingDebt: 0 };
    
    const invoices = salesAll?.filter(
      s => s.customerId === selectedCustomer.id && 
           s.paymentMethod === 'Credito' && 
           s.status === 'PENDIENTE'
    ) || [];

    const debt = invoices.reduce((sum, s) => {
      const totalAbonado = journalPayments
        ?.filter(j => j.description.includes(`[${s.correlative}]`))
        .reduce((sAcc, j) => sAcc + (parseFloat(j.amount) || 0), 0) || 0;
      return sum + Math.max(0, s.total - totalAbonado);
    }, 0);

    return { pendingCreditInvoices: invoices, outstandingDebt: debt };
  }, [selectedCustomer, salesAll, journalPayments]);

  // Limpiar autorización excepcional de crédito si cambia de cliente
  useEffect(() => {
    setCreditOverrideAuth(null);
  }, [selectedCustomer?.id]);

  const creditStatusDetail = useMemo(() => {
    return evaluateCustomerCreditStatus({
      customer: selectedCustomer,
      outstandingDebt,
      pendingInvoicesCount: pendingCreditInvoices.length,
      saleAmount: totalCart,
    });
  }, [selectedCustomer, pendingCreditInvoices, outstandingDebt, totalCart]);

  const creditValidation = useMemo(() => {
    if (!selectedCustomer) {
      return {
        disabled: true,
        needsOverride: false,
        reason: creditStatusDetail.message,
      };
    }

    if (creditStatusDetail.needsManagerOverride && !creditOverrideAuth) {
      return {
        disabled: true,
        needsOverride: true,
        reason: creditStatusDetail.message,
      };
    }

    if (creditOverrideAuth) {
      return {
        disabled: false,
        needsOverride: false,
        reason: `Exceso autorizado por ${creditOverrideAuth.authorizedByName} (${creditOverrideAuth.reason}).`,
      };
    }

    return {
      disabled: false,
      needsOverride: false,
      reason: creditStatusDetail.message,
    };
  }, [selectedCustomer, creditStatusDetail, creditOverrideAuth]);

  const handleConfirmCreditOverride = async () => {
    if (!selectedCustomer) return;
    if (!authReason.trim()) {
      toast({
        variant: 'destructive',
        title: 'Motivo requerido',
        description: 'Ingrese el motivo de la autorización excepcional de crédito.',
      });
      return;
    }

    setAuthorizingCredit(true);
    try {
      let approverName = '';
      let approverEmail = '';

      if (isUserAdmin) {
        const me = appUsersList.find((u) => u.email?.toLowerCase() === user?.email?.toLowerCase());
        approverName = me?.full_name || user?.email || 'Administrador';
        approverEmail = user?.email || 'admin@nexway.sv';
      } else {
        const expectedPin = await loadManagerCreditPin();
        if (authManagerPin.trim() !== expectedPin) {
          toast({
            variant: 'destructive',
            title: 'PIN de Gerencia Incorrecto',
            description: 'Solicite el PIN correcto al Encargado o Administrador.',
          });
          setAuthorizingCredit(false);
          return;
        }
        const selectedMgr = appUsersList.find((u) => u.email === authManagerEmail);
        approverName = selectedMgr?.full_name || authManagerEmail || 'Encargado / Gerencia';
        approverEmail = selectedMgr?.email || authManagerEmail || 'gerencia@nexway.sv';
      }

      const authRecord: CreditOverrideAuthorization = {
        authorizedByName: approverName,
        authorizedByEmail: approverEmail,
        reason: authReason.trim(),
        authorizedAt: new Date().toISOString(),
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        exceededAmount: creditStatusDetail.exceededAmount,
        limitAmount: creditStatusDetail.limit,
        debtBefore: creditStatusDetail.outstandingDebt,
        newSaleAmount: totalCart,
      };

      setCreditOverrideAuth(authRecord);
      setPaymentMethod('Credito');
      setIsCreditAuthModalOpen(false);
      setAuthManagerPin('');
      toast({
        title: 'Despacho al Crédito Autorizado ✓',
        description: `Autorizado por ${approverName}. Ya puede emitir la factura al crédito.`,
      });
    } finally {
      setAuthorizingCredit(false);
    }
  };

  // Revertir forma de pago a Efectivo si el crédito queda invalidado y no hay autorización de encargado
  useEffect(() => {
    if (paymentMethod === 'Credito' && creditValidation.disabled && !creditValidation.needsOverride) {
      setPaymentMethod('Efectivo');
    }
  }, [creditValidation.disabled, creditValidation.needsOverride, paymentMethod]);

  const systemCardSales = useMemo(() => 
    activeShiftSales?.filter(s => s.status !== 'CANCELADA' && s.status !== 'PENDIENTE DE IMPRESION' && s.status !== 'PENDIENTE')
      .reduce((acc, s) => {
        if (s.paymentMethod === 'Tarjeta') return acc + (s.total || 0);
        if (s.paymentMethod === 'Mixto' && s.paymentDetails?.card) return acc + (Number(s.paymentDetails.card) || 0);
        return acc;
      }, 0) || 0
  , [activeShiftSales]);

  const systemTransferSales = useMemo(() => 
    activeShiftSales?.filter(s => s.status !== 'CANCELADA' && s.status !== 'PENDIENTE DE IMPRESION' && s.status !== 'PENDIENTE')
      .reduce((acc, s) => {
        if (s.paymentMethod === 'Transferencia') return acc + (s.total || 0);
        if (s.paymentMethod === 'Mixto' && s.paymentDetails?.transfer) return acc + (Number(s.paymentDetails.transfer) || 0);
        return acc;
      }, 0) || 0
  , [activeShiftSales]);

  const systemCreditSales = useMemo(() => 
    activeShiftSales?.filter(s => s.status !== 'CANCELADA')
      .reduce((acc, s) => {
        if (s.paymentMethod === 'Credito') return acc + (s.total || 0);
        if (s.paymentMethod === 'Mixto' && s.paymentDetails?.credit) return acc + (Number(s.paymentDetails.credit) || 0);
        return acc;
      }, 0) || 0
  , [activeShiftSales]);

  const systemCheckSales = useMemo(() => 
    activeShiftSales?.filter(s => s.status !== 'CANCELADA' && s.status !== 'PENDIENTE DE IMPRESION' && s.status !== 'PENDIENTE')
      .reduce((acc, s) => {
        if (s.paymentMethod === 'Cheque') return acc + (s.total || 0);
        if (s.paymentMethod === 'Mixto' && s.paymentDetails?.cheque) return acc + (Number(s.paymentDetails.cheque) || 0);
        return acc;
      }, 0) || 0
  , [activeShiftSales]);

  const baseFloatFromDenoms = useMemo(() =>
    Object.entries(baseFloatDenominations).reduce((acc, [den, qty]) => acc + (parseFloat(den) * qty), 0)
  , [baseFloatDenominations]);

  const countedBaseFloat = useMemo(() => {
    if (baseFloatDirectAmount !== '') return Math.max(0, parseFloat(baseFloatDirectAmount) || 0);
    return baseFloatFromDenoms;
  }, [baseFloatDirectAmount, baseFloatFromDenoms]);

  const countedDeliveryCash = useMemo(() =>
    Object.entries(cashDenominations).reduce((acc, [den, qty]) => acc + (parseFloat(den) * qty), 0)
  , [cashDenominations]);

  const totalPhysicalCash = useMemo(() =>
    Number((countedBaseFloat + countedDeliveryCash).toFixed(2))
  , [countedBaseFloat, countedDeliveryCash]);

  const netPhysicalCash = useMemo(() =>
    Number(countedDeliveryCash.toFixed(2))
  , [countedDeliveryCash]);

  const handleAiBmsAutoSync = () => {
    setPhysicalCard(systemCardSales);
    setPhysicalTransfer(systemTransferSales);
    setPhysicalCheck(systemCheckSales);
    setPhysicalCredit(systemCreditSales);
    toast({
      title: "✓ Formas de Pago Verificadas",
      description: "Se confirmaron los montos de Tarjetas, Transferencias, Cheques y Crédito contra el sistema."
    });
  };

  const totalExpenses = useMemo(() => 
    expenses.reduce((acc, e) => acc + e.amount, 0)
  , [expenses]);

  const expectedDeliveryCash = useMemo(() =>
    Number(Math.max(0, systemCashSales - totalExpenses).toFixed(2))
  , [systemCashSales, totalExpenses]);

  const baseFloatDifference = useMemo(() =>
    Number((countedBaseFloat - (cashConfig?.cashFloat || 0)).toFixed(2))
  , [countedBaseFloat, cashConfig]);

  const deliveryCashDifference = useMemo(() =>
    Number((countedDeliveryCash - expectedDeliveryCash).toFixed(2))
  , [countedDeliveryCash, expectedDeliveryCash]);

  const cashDifference = useMemo(() => 
    Number((totalPhysicalCash - (systemCashSales + (cashConfig?.cashFloat || 0) - totalExpenses)).toFixed(2))
  , [totalPhysicalCash, systemCashSales, cashConfig, totalExpenses]);

  const cardDifference = useMemo(() => physicalCard - systemCardSales, [physicalCard, systemCardSales]);
  const transferDifference = useMemo(() => physicalTransfer - systemTransferSales, [physicalTransfer, systemTransferSales]);
  const creditDifference = useMemo(() => physicalCredit - systemCreditSales, [physicalCredit, systemCreditSales]);
  const checkDifference = useMemo(() => physicalCheck - systemCheckSales, [physicalCheck, systemCheckSales]);

  const activeShiftDateObj = useMemo(() => {
    const today = new Date();
    if (!lastClosingTimestamp) return today;

    const lastClosing = new Date(lastClosingTimestamp);
    const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const lastClosingDateOnly = new Date(lastClosing.getFullYear(), lastClosing.getMonth(), lastClosing.getDate()).getTime();

    // Si el último cierre registrado fue hoy (o después), la jornada activa en curso avanza al siguiente día
    if (lastClosingDateOnly >= todayDateOnly) {
      return new Date(todayDateOnly + 86400000);
    }
    return today;
  }, [lastClosingTimestamp]);

  const formattedTodayDate = useMemo(() => {
    return activeShiftDateObj.toLocaleDateString('es-SV', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }, [activeShiftDateObj]);

  const displayedSalesHistory = useMemo(() => {
    if (!salesAll) return [];

    if (historialFilter === 'active_shift') {
      return activeShiftSales;
    }

    if (historialFilter === 'custom' && historialCustomDate) {
      return salesAll.filter(s => {
        if (!s.timestamp) return false;
        const sDate = new Date(s.timestamp).toISOString().split('T')[0];
        return sDate === historialCustomDate;
      });
    }

    return salesAll;
  }, [salesAll, activeShiftSales, historialFilter, historialCustomDate]);

  // --- BMS & AI AUTOMATED CASH RECONCILIATION ---
  const bmsReconciliationStatus = useMemo(() => {
    const totalDiff = Math.abs(cashDifference) + Math.abs(cardDifference) + Math.abs(transferDifference) + Math.abs(checkDifference);
    const isZeroSalesDay = systemCashSales === 0 && systemCardSales === 0 && systemTransferSales === 0 && systemCheckSales === 0;

    if (totalDiff === 0) {
      return {
        isApproved: true,
        statusLabel: isZeroSalesDay ? '🤖 BMS AUTORIZADO - CAJA SIN VENTAS OK' : '🤖 BMS AUTORIZADO - CUADRE OK',
        badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
        suggestion: isZeroSalesDay 
          ? `Sugerencia IA: Jornada sin ventas registradas. El saldo concuerda 100% con el Fondo Base ($${(cashConfig?.cashFloat || 0).toFixed(2)}). Cierre autorizado.`
          : 'Sugerencia IA: El conteo físico coincide al 100% con los registros del sistema. Proceda a otorgar el Visto Bueno del Cajero e imprimir el reporte de cierre de jornada.'
      };
    } else if (Math.abs(cashDifference) > 0 && Math.abs(cardDifference) === 0 && Math.abs(transferDifference) === 0) {
      return {
        isApproved: false,
        statusLabel: '⚠️ BMS ALERTA - DIFERENCIA EN EFECTIVO',
        badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
        suggestion: `Sugerencia IA: Se detectó un ${cashDifference < 0 ? 'faltante' : 'sobrante'} de $${Math.abs(cashDifference).toFixed(2)} en efectivo. Verifique si existe algún comprobante de gasto no registrado o cambio entregado de más.`
      };
    } else {
      return {
        isApproved: false,
        statusLabel: '⚠️ BMS AUDITORÍA REQUERIDA - DESCUADRE MULTIMEDIO',
        badgeColor: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
        suggestion: 'Sugerencia IA: Existen descuadres en múltiples medios de pago. Por favor revise vouchers de tarjeta, cheques y bancas en línea antes de otorgar la conformidad.'
      };
    }
  }, [cashDifference, cardDifference, transferDifference, checkDifference, systemCashSales, systemCardSales, systemTransferSales, systemCheckSales, cashConfig]);

  // CLASIFICACIÓN DE FACTURAS (CF), CRÉDITOS FISCALES (CCF) Y ABONOS DEL DÍA
  const salesCF = useMemo(() => 
    salesAll?.filter(s => (s.docType === 'CF' || s.correlative?.startsWith('CF')) && s.status !== 'CANCELADA') || []
  , [salesAll]);

  const salesCCF = useMemo(() => 
    salesAll?.filter(s => (s.docType === 'CCF' || s.correlative?.startsWith('CCF')) && s.status !== 'CANCELADA') || []
  , [salesAll]);

  const todaysAbonos = useMemo(() => 
    journalPayments?.filter(j => j.description?.toLowerCase().includes('abono') || j.description?.toLowerCase().includes('cobro') || j.description?.toLowerCase().includes('crédito') || j.amount > 0) || []
  , [journalPayments]);


  // Cart Functions

  const changeDue = useMemo(() => {
    const received = parseFloat(cashReceived) || 0;
    return Math.max(0, received - totalCart);
  }, [cashReceived, totalCart]);

  const getFractionOptionsForSku = (sku: string) => {
    const rule = productFractionRules[sku];
    const baseMeasureDef = rule ? (MEASURE_UNITS_CATALOG[rule.baseMeasure] || MEASURE_UNITS_CATALOG.GALON) : null;
    const baseOpt = {
      value: '1/1',
      label: baseMeasureDef ? `1/1 ${baseMeasureDef.shortLabel} (Entero)` : '1/1 Entero',
      shortLabel: baseMeasureDef ? `1/1 ${baseMeasureDef.shortLabel}` : '1/1 Entero',
      factor: 1,
      suppliesCost: 0,
      customSalePrice: undefined as number | undefined,
      fixedSupplies: undefined as any,
      measureShort: baseMeasureDef?.shortLabel || 'Ud',
    };

    if (!rule || !Array.isArray(rule.enabledFractions) || rule.enabledFractions.length === 0) {
      return [baseOpt];
    }

    const enabledOpts = rule.enabledFractions.map(f => {
      const sup = f.fixedSupplies || rule.defaultSupplies;
      const supCost = f.suppliesTotalCost !== undefined ? f.suppliesTotalCost : computeSuppliesCost(sup);
      return {
        value: f.fractionText,
        label: f.label,
        shortLabel: `${f.fractionText} ${baseMeasureDef?.shortLabel || ''}`.trim(),
        factor: f.factor,
        suppliesCost: supCost,
        customSalePrice: f.customSalePrice,
        fixedSupplies: sup,
        measureShort: baseMeasureDef?.shortLabel || 'Ud',
      };
    });

    return [baseOpt, ...enabledOpts];
  };

  const addToCart = (product: any, initialFractionValue: string = '1/1') => {
    const opts = getFractionOptionsForSku(product.sku || '');
    const fracOpt = opts.find(f => f.value === initialFractionValue) || opts[0];
    setCart(prev => {
      const cartItemId = fracOpt.value === '1/1' ? product.id : `${product.id}__frac_${fracOpt.value}`;
      const existing = prev.find(item => item.id === cartItemId);
      let basePrice = product.price;
      if (clientPricesMap[product.sku] !== undefined) {
        basePrice = clientPricesMap[product.sku];
      }

      let discount = 0;
      const profile = selectedCustomer?.benefit_profile?.toLowerCase() || '';
      if (profile.includes('constructor')) discount = 0.15;
      else if (profile.includes('distribuidor')) discount = 0.20;
      else if (profile.includes('vip')) discount = 0.10;

      const discountedBasePrice = basePrice * (1 - discount);
      const effectivePrice =
        fracOpt.value === '1/1'
          ? discountedBasePrice
          : fracOpt.customSalePrice !== undefined && fracOpt.customSalePrice > 0
          ? fracOpt.customSalePrice
          : Number(((discountedBasePrice * fracOpt.factor) + (fracOpt.suppliesCost || 0)).toFixed(2));

      const cleanBaseName = (product.name || '').replace(/\s*\[Fracción[^\]]*\]$/i, '').trim();
      const effectiveName =
        fracOpt.value === '1/1'
          ? cleanBaseName
          : `${cleanBaseName} [Fracción ${fracOpt.label}]`;

      if (existing) {
        return prev.map(item => item.id === cartItemId ? {
          ...item,
          quantity: Number(item.quantity || 0) + 1,
          price: effectivePrice,
          originalPrice: basePrice,
          baseUnitPrice: discountedBasePrice,
          baseName: cleanBaseName,
          fractionText: fracOpt.value,
          fractionFactor: fracOpt.factor,
          fixedSupplies: fracOpt.fixedSupplies,
          suppliesCost: fracOpt.suppliesCost || 0
        } as any : item);
      }
      return [...prev, {
        id: cartItemId,
        name: effectiveName,
        baseName: cleanBaseName,
        sku: product.sku || 'N/A',
        price: effectivePrice || 0,
        originalPrice: basePrice,
        baseUnitPrice: discountedBasePrice,
        quantity: 1,
        fractionText: fracOpt.value,
        fractionFactor: fracOpt.factor,
        fixedSupplies: fracOpt.fixedSupplies,
        suppliesCost: fracOpt.suppliesCost || 0
      } as any];
    });
  };

  const updateCartFraction = (id: string, fractionValue: string) => {
    setCart(prev => prev.map(item => {
      if (item.id !== id) return item;
      const opts = getFractionOptionsForSku(item.sku || '');
      const fracOpt = opts.find(f => f.value === fractionValue) || opts[0];
      const baseName = ((item as any).baseName || item.name || '').replace(/\s*\[Fracción[^\]]*\]$/i, '').trim();
      const baseUnitPrice = Number((item as any).baseUnitPrice ?? (item as any).originalPrice ?? item.price) || 0;
      const newPrice =
        fracOpt.value === '1/1'
          ? baseUnitPrice
          : fracOpt.customSalePrice !== undefined && fracOpt.customSalePrice > 0
          ? fracOpt.customSalePrice
          : Number(((baseUnitPrice * fracOpt.factor) + (fracOpt.suppliesCost || 0)).toFixed(2));
      const newName =
        fracOpt.value === '1/1'
          ? baseName
          : `${baseName} [Fracción ${fracOpt.label}]`;
      return {
        ...item,
        name: newName,
        baseName,
        baseUnitPrice,
        price: newPrice,
        fractionText: fracOpt.value,
        fractionFactor: fracOpt.factor,
        fixedSupplies: fracOpt.fixedSupplies,
        suppliesCost: fracOpt.suppliesCost || 0
      } as any;
    }));
  };

  const updateCartPrice = (id: string, priceVal: string) => {
    const numPrice = parseFloat(priceVal);
    setCart(prev => prev.map(item => item.id === id ? { ...item, price: isNaN(numPrice) ? 0 : Math.max(0, numPrice) } : item));
  };

  const handleAddToCartFromHistory = (itemToAdd: { sku: string; name: string; price: number; quantity?: number }) => {
    setCart(prev => {
      const existing = prev.find(item => item.sku === itemToAdd.sku || item.id === itemToAdd.sku);
      const qtyToAdd = itemToAdd.quantity || 1;
      if (existing) {
        return prev.map(item => (item.sku === itemToAdd.sku || item.id === itemToAdd.sku)
          ? { ...item, quantity: Number(item.quantity || 0) + qtyToAdd }
          : item
        );
      }
      return [
        ...prev,
        {
          id: itemToAdd.sku,
          sku: itemToAdd.sku,
          name: itemToAdd.name || itemToAdd.sku,
          price: itemToAdd.price || 0,
          originalPrice: itemToAdd.price || 0,
          quantity: qtyToAdd
        } as any
      ];
    });
    toast({
      title: "Producto agregado",
      description: `${itemToAdd.name} se añadió a la factura actual.`
    });
  };

  const handleAddMultipleToCartFromHistory = (itemsToAdd: Array<{ sku: string; name: string; price: number; quantity?: number }>) => {
    if (!itemsToAdd || itemsToAdd.length === 0) return;
    setCart(prev => {
      let currentCart = [...prev];
      itemsToAdd.forEach(itemToAdd => {
        const existingIndex = currentCart.findIndex(item => item.sku === itemToAdd.sku || item.id === itemToAdd.sku);
        const qtyToAdd = itemToAdd.quantity || 1;
        if (existingIndex > -1) {
          currentCart[existingIndex] = {
            ...currentCart[existingIndex],
            quantity: Number(currentCart[existingIndex].quantity || 0) + qtyToAdd
          };
        } else {
          currentCart.push({
            id: itemToAdd.sku,
            sku: itemToAdd.sku,
            name: itemToAdd.name || itemToAdd.sku,
            price: itemToAdd.price || 0,
            originalPrice: itemToAdd.price || 0,
            quantity: qtyToAdd
          } as any);
        }
      });
      return currentCart;
    });
    toast({
      title: "Compra cargada",
      description: `Se añadieron ${itemsToAdd.length} producto(s) a la factura actual.`
    });
  };

  const updateCartQuantity = (id: string, qty: number | string) => {
    const numQty = typeof qty === 'string' ? (qty === '' ? '' : parseFloat(qty)) : qty;
    setCart(prev => prev.map(item => item.id === id ? { ...item, quantity: (numQty === '' ? '' : (numQty || 0)) as any } : item));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const handleOpenCheckout = async () => {
    if (cart.length === 0) {
      toast({ variant: "destructive", title: "Carrito vacío" });
      return;
    }

    const deductWh = activeWarehouse || (warehouses.length > 0 ? warehouses[0] : null);
    if (deductWh) {
      try {
        const skusInCart = cart.map(i => i.sku);
        const { data: dbStocks, error: stockCheckErr } = await supabase
          .from('inventory_stock')
          .select('*')
          .eq('warehouse_id', deductWh.id)
          .in('sku', skusInCart);

        if (stockCheckErr) throw stockCheckErr;

        const stockMap: Record<string, number> = {};
        (dbStocks || []).forEach(s => {
          stockMap[s.sku] = parseFloat(s.quantity) || 0;
        });

        for (const item of cart) {
          const physical = stockMap[item.sku] || 0;
          const pendingIncoming = pendingIncomingQty[item.sku] || 0;
          const available = physical + pendingIncoming;
          const fracFactor = Number((item as any).fractionFactor) || 1;
          const requiredStock = Number(((Number(item.quantity) || 0) * fracFactor).toFixed(4));
          if (available < requiredStock) {
            toast({ 
              variant: "destructive",
              title: "Stock Insuficiente", 
              description: `El producto "${item.name}" no tiene existencias suficientes en "${deductWh.name}". Disponible: ${physical}, Requerido: ${requiredStock} (${item.quantity} × ${(item as any).fractionText || '1/1'}). No se puede facturar.` 
            });
            return;
          }
        }
      } catch (err) {
        console.error(err);
        toast({ variant: "destructive", title: "Error de Validación", description: "No se pudo verificar el stock." });
        return;
      }
    }

    setCashReceived('');
    setPaymentReference('');
    setIsCheckoutOpen(true);
  };

  const handleSaveDraft = async () => {
    if (cart.length === 0) return;
    setIsProcessing(true);
    const draftNumber = `BORR-${Math.floor(100000 + Math.random() * 900000)}`;
    const draftObject = {
      id: `draft-${Date.now()}`,
      quote_number: draftNumber,
      customer_name: customerName || 'Consumidor Final',
      seller_email: selectedSellerEmail || user?.email || 'admin@nexway.sv',
      items: cart,
      total: totalCart,
      status: 'EN_ESPERA',
      created_at: new Date().toISOString()
    };

    try {
      const { error } = await supabase
        .from('quotations')
        .insert({
          quote_number: draftNumber,
          customer_name: draftObject.customer_name,
          items: cart,
          total: totalCart,
          status: 'EN_ESPERA'
        });

      if (error) {
        console.warn('Supabase quotation insert failed, using localStorage fallback:', error.message);
      }
    } catch (err: any) {
      console.warn('Supabase quotation insert exception, saving to localStorage:', err);
    }

    // Siempre respaldar en localStorage para garantizar disponibilidad 100% libre de fallos
    if (typeof window !== 'undefined') {
      try {
        const existing = localStorage.getItem('nexway_draft_sales_list');
        const list = existing ? JSON.parse(existing) : [];
        list.unshift(draftObject);
        localStorage.setItem('nexway_draft_sales_list', JSON.stringify(list));
      } catch (e) {
        console.error('Error writing draft to localStorage:', e);
      }
    }

    toast({
      title: "Factura en Espera Guardada ⏸️",
      description: `Se guardó el borrador ${draftNumber}. Puedes recuperarlo en cualquier momento desde el botón 'Pendientes'.`
    });

    setCart([]);
    setCustomerName('');
    setCustomerEmail('');
    setIsProcessing(false);
  };

  const handleFinalizeSale = async () => {
    if (paymentMethod === 'Efectivo' && (parseFloat(cashReceived) || 0) < totalCart) {
      toast({ variant: "destructive", title: "Monto Insuficiente", description: "El efectivo recibido es menor al total a cobrar." });
      return;
    }

    if (paymentMethod === 'Mixto') {
      const sCash = parseFloat(splitAmounts.cash) || 0;
      const sCard = parseFloat(splitAmounts.card) || 0;
      const sTransfer = parseFloat(splitAmounts.transfer) || 0;
      const sCredit = parseFloat(splitAmounts.credit) || 0;
      const sCheque = parseFloat(splitAmounts.cheque) || 0;
      const sTotal = sCash + sCard + sTransfer + sCredit + sCheque;

      if (Math.abs(sTotal - totalCart) > 0.01) {
        toast({
          variant: "destructive",
          title: "Pago Mixto Descuadrado",
          description: `El total asignado ($${sTotal.toFixed(2)}) debe ser igual al total de la venta ($${totalCart.toFixed(2)}).`
        });
        return;
      }

      if (sCredit > 0 && creditValidation.disabled) {
        toast({
          variant: "destructive",
          title: "Crédito No Permitido",
          description: creditValidation.reason
        });
        return;
      }
    }

    setIsProcessing(true);

    // 0. Validar stock real en base de datos al momento de guardar
    const deductWh = activeWarehouse || (warehouses.length > 0 ? warehouses[0] : null);
    if (!deductWh) {
      toast({ variant: "destructive", title: "Error de Bodega", description: "No hay una bodega activa o configurada." });
      setIsProcessing(false);
      return;
    }

    try {
      const skusInCart = cart.map(i => i.sku);
      const { data: dbStocks, error: stockCheckErr } = await supabase
        .from('inventory_stock')
        .select('*')
        .eq('warehouse_id', deductWh.id)
        .in('sku', skusInCart);

      if (stockCheckErr) throw stockCheckErr;

      const stockMap: Record<string, number> = {};
      (dbStocks || []).forEach(s => {
        stockMap[s.sku] = parseFloat(s.quantity) || 0;
      });

      for (const item of cart) {
        const physical = stockMap[item.sku] || 0;
        const pendingIncoming = pendingIncomingQty[item.sku] || 0;
        const available = physical + pendingIncoming;
        const fracFactor = Number((item as any).fractionFactor) || 1;
        const requiredStock = Number(((Number(item.quantity) || 0) * fracFactor).toFixed(4));
        if (available < requiredStock) {
          logNexbotEvent(
            'inventory',
            'BLOQUEO_STOCK',
            { sku: item.sku, name: item.name, available, requested: item.quantity },
            `El sistema bloqueó una venta porque intentaron facturar ${item.quantity} unidades del producto "${item.name}" (SKU: ${item.sku}), pero solo hay ${available} disponibles en stock físico de bodega.`
          );

          toast({
            variant: "destructive",
            title: "Stock Insuficiente (Bloqueado)",
            description: `No hay existencias para "${item.name}". Disponible: ${physical}, Requerido: ${item.quantity}.`
          });
          setIsProcessing(false);
          return;
        }
      }

      const isPreFacturaOnly = activeStation?.station_role === 'PREFACTURACION_ONLY';

      const correlative = isPreFacturaOnly 
        ? `PRE-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`
        : `${docType}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

      const selectedCust = customers.find(c => c.name === customerName);

      const paymentDetails = paymentMethod === 'Mixto' ? {
        cash: parseFloat(splitAmounts.cash) || 0,
        card: parseFloat(splitAmounts.card) || 0,
        transfer: parseFloat(splitAmounts.transfer) || 0,
        credit: parseFloat(splitAmounts.credit) || 0,
        cheque: parseFloat(splitAmounts.cheque) || 0,
      } : null;

      // --- RUTA DE CONTINGENCIA OFFLINE SI NO HAY RED ---
      if (typeof window !== 'undefined' && !navigator.onLine) {
        enqueueOfflineSale({
          correlative,
          docType: isPreFacturaOnly ? 'PRE_FACTURA' : docType,
          customerName: customerName || (docType === 'CF' ? 'Consumidor Final' : 'Cliente CCF'),
          customerId: selectedCust ? selectedCust.id : null,
          customerEmail: customerEmail || '',
          total: totalCart,
          paymentMethod,
          paymentDetails,
          splitAmounts: paymentMethod === 'Mixto' ? splitAmounts : undefined,
          items: cart.map(i => ({
            id: i.id,
            sku: i.sku,
            name: i.name,
            price: i.price,
            originalPrice: (i as any).originalPrice || i.price,
            quantity: Number(i.quantity) || 1
          })),
          sellerEmail: selectedSellerEmail || user?.email || null,
          stationName: activeStation?.name || null,
          branchId: activeBranchId || null,
          warehouseId: deductWh?.id || null,
          warehouseName: deductWh?.name || null
        });

        setOfflineQueue(getOfflineSalesQueue());

        const cashVal = parseFloat(cashReceived) || totalCart;
        const changeVal = Math.max(0, cashVal - totalCart);

        setCompletedSaleData({
          correlative,
          docType,
          total: totalCart,
          cashReceived: paymentMethod === 'Credito' ? 0 : cashVal,
          change: paymentMethod === 'Credito' ? 0 : changeVal,
          paymentMethod,
          creditDays: paymentMethod === 'Credito' || splitCreditVal > 0 ? (parseInt(posCreditDays) || 30) : undefined,
          creditAmount: paymentMethod === 'Credito' ? totalCart : (paymentMethod === 'Mixto' ? splitCreditVal : 0),
          customerName: customerName || (docType === 'CF' ? 'Consumidor Final' : 'Cliente CCF'),
          customerEmail: customerEmail || selectedCustomer?.email || cashConfig?.catchAllEmail || '',
          customerNit: selectedCustomer?.nit,
          customerNrc: selectedCustomer?.nrc,
          customerGiro: selectedCustomer?.giro,
          customerAddress: selectedCustomer?.address,
          items: [...cart]
        });

        toast({
          title: "Venta Guardada Localmente (Modo Offline) ⚡",
          description: `Comprobante ${correlative} emitido. Se sincronizará automáticamente al regresar la conexión.`
        });

        setCart([]);
        setCustomerName('');
        setCustomerEmail('');
        setSelectedCustomer(null);
        setSelectedPendingSaleId(null);
        setCashReceived('');
        setIsCheckoutOpen(false);
        setIsProcessing(false);
        return;
      }

      let insertedSale: any = null;

      if (selectedPendingSaleId && !isPreFacturaOnly) {
        // Actualizar la Pre-Factura existente a Factura DTE formal
        const updatePayload: any = {
          correlative,
          doc_type: docType,
          customer_id: selectedCust ? selectedCust.id : null,
          total: totalCart,
          status: paymentMethod === 'Credito' ? 'PENDIENTE' : 'ACTIVA',
          payment_method: paymentMethod,
          payment_details: paymentDetails,
          customer_name: customerName || (docType === 'CF' ? 'Consumidor Final' : 'Cliente CCF'),
          seller_email: selectedSellerEmail || user?.email || null,
          station_name: activeStation?.name || null,
          branch_id: activeBranchId || null
        };

        let { data: updatedSale, error: updateErr } = await supabase
          .from('sales')
          .update(updatePayload)
          .eq('id', selectedPendingSaleId)
          .select()
          .single();

        if (updateErr && (updateErr.message?.includes('payment_details') || updateErr.code === 'PGRST204')) {
          delete updatePayload.payment_details;
          const retry = await supabase.from('sales').update(updatePayload).eq('id', selectedPendingSaleId).select().single();
          updatedSale = retry.data;
          updateErr = retry.error;
        }

        if (updateErr) throw updateErr;
        insertedSale = updatedSale;

        // Limpiar ítems anteriores y reinsertar los confirmados
        await supabase.from('sales_items').delete().eq('sale_id', selectedPendingSaleId);
      } else {
        // 1. Insert into public.sales
        const insertPayload: any = {
          correlative,
          doc_type: isPreFacturaOnly ? 'PRE_FACTURA' : docType,
          customer_id: selectedCust ? selectedCust.id : null,
          total: totalCart,
          status: isPreFacturaOnly ? 'PENDIENTE_COBRO' : (paymentMethod === 'Credito' ? 'PENDIENTE' : 'ACTIVA'),
          payment_method: paymentMethod,
          payment_details: paymentDetails,
          customer_name: customerName || (docType === 'CF' ? 'Consumidor Final' : 'Cliente CCF'),
          seller_email: selectedSellerEmail || user?.email || null,
          station_name: activeStation?.name || null,
          branch_id: activeBranchId || null
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
        insertedSale = newSale;
      }

      // 2. Insert items into public.sales_items
      const itemsToInsert = cart.map(item => ({
        sale_id: insertedSale.id,
        sku: item.sku,
        quantity: Number(item.quantity) || 0,
        price: item.price,
        subtotal: (Number(item.quantity) || 0) * item.price,
        price_list_id: (selectedCustomer && clientPricesMap[item.sku] !== undefined) ? selectedCustomer.price_list_id : null
      }));

      const { error: itemsErr } = await supabase
        .from('sales_items')
        .insert(itemsToInsert);

      if (itemsErr) throw itemsErr;

      if (isPreFacturaOnly) {
        toast({
          title: "Pre-Factura Creada 📋",
          description: `El vale ${correlative} fue guardado en la cola para ser cobrado en la Caja Principal.`
        });
        setCart([]);
        setCustomerName('');
        setCustomerEmail('');
        setSelectedCustomer(null);
        setCashReceived('');
        setIsCheckoutOpen(false);
        await loadBillingData();
        setIsProcessing(false);
        return;
      }

      // 3. Update Inventory Stock and Kardex Atomically
      if (deductWh) {
        const stockUpdates = [];
        const kardexInserts = [];
        
        for (const item of cart) {
          const currentStock = stockMap[item.sku] || 0;
          const fracFactor = Number((item as any).fractionFactor) || 1;
          const qty = Number(((Number(item.quantity) || 0) * fracFactor).toFixed(4));
          const newQty = Number((currentStock - qty).toFixed(4)); // Descuento proporcional automático en fracciones

          stockUpdates.push({
            action: 'UPSERT',
            sku: item.sku,
            warehouse_id: deductWh.id,
            quantity: newQty
          });
          
          kardexInserts.push({
            sku: item.sku,
            movement_type: 'FACTURA',
            location: deductWh.name,
            document_ref: `${docType}-${correlative}`,
            qty_in: 0,
            qty_out: qty,
            balance: newQty,
            unit_cost: item.price
          });
        }
        
        try {
          const { error: rpcErr } = await supabase.rpc('process_inventory_transaction', {
            p_stock_updates: stockUpdates,
            p_kardex_inserts: kardexInserts
          });
          if (rpcErr) throw rpcErr;
        } catch (rpcFallbackErr) {
          console.warn('RPC process_inventory_transaction fallback execution:', rpcFallbackErr);
          for (const update of stockUpdates) {
            await supabase.from('inventory_stock').upsert({
              sku: update.sku,
              warehouse_id: update.warehouse_id,
              quantity: update.quantity
            }, { onConflict: 'sku,warehouse_id' });
          }
          for (const kItem of kardexInserts) {
            await supabase.from('kardex').insert(kItem);
          }
        }
      }

      // Marcar cotización / pre-factura como FACTURADA si se usó una
      if (selectedQuoteId) {
        await supabase
          .from('quotations')
          .update({ status: 'FACTURADA' })
          .eq('id', selectedQuoteId);
        setSelectedQuoteId(null);
        fetchQuotations();
      }

      // Send DTE Email
      const targetEmail = customerEmail || cashConfig?.catchAllEmail;
      if (targetEmail) {
        sendDteEmail({
          recipientEmail: targetEmail,
          customerName: customerName || (docType === 'CF' ? 'Consumidor Final' : 'Cliente CCF'),
          docType: docType,
          docNumber: correlative,
          total: totalCart,
          items: cart.map(i => ({ name: i.name, quantity: Number(i.quantity) || 0, price: i.price }))
        });
      }

      const cashVal = parseFloat(cashReceived) || totalCart;
      const changeVal = Math.max(0, cashVal - totalCart);

      if (paymentMethod === 'Efectivo') {
        processChange(totalCart, cashVal);
      }

      // 4. Registro Contable Automático en Journal (Partida Doble Balanceada)
      const gravada = totalCart / 1.13;
      const ivaDebito = totalCart - gravada;

      const journalLines: any[] = [];
      if (paymentMethod === 'Efectivo') {
        journalLines.push({ account_code: '1101', account_name: 'Efectivo y Equivalentes de Efectivo', debit: totalCart, credit: 0 });
      } else if (paymentMethod === 'Tarjeta' || paymentMethod === 'Transferencia') {
        journalLines.push({ account_code: '1102', account_name: 'Bancos e Instituciones Financieras', debit: totalCart, credit: 0 });
      } else if (paymentMethod === 'Credito') {
        journalLines.push({ account_code: '1103', account_name: 'Cuentas por Cobrar Clientes', debit: totalCart, credit: 0 });
      } else if (paymentMethod === 'Cheque') {
        journalLines.push({ account_code: '1101', account_name: 'Efectivo y Equivalentes (Cheques)', debit: totalCart, credit: 0 });
      } else if (paymentMethod === 'Mixto') {
        const sCash = parseFloat(splitAmounts.cash) || 0;
        const sCard = parseFloat(splitAmounts.card) || 0;
        const sTransfer = parseFloat(splitAmounts.transfer) || 0;
        const sCredit = parseFloat(splitAmounts.credit) || 0;
        const sCheque = parseFloat(splitAmounts.cheque) || 0;

        if (sCash > 0) journalLines.push({ account_code: '1101', account_name: 'Efectivo y Equivalentes (Caja)', debit: sCash, credit: 0 });
        if (sCard + sTransfer > 0) journalLines.push({ account_code: '1102', account_name: 'Bancos (POS / Transferencia)', debit: sCard + sTransfer, credit: 0 });
        if (sCredit > 0) journalLines.push({ account_code: '1103', account_name: 'Cuentas por Cobrar Clientes', debit: sCredit, credit: 0 });
        if (sCheque > 0) journalLines.push({ account_code: '1101', account_name: 'Efectivo y Equivalentes (Cheques)', debit: sCheque, credit: 0 });
      }

      // Créditos Fiscales / Ingresos
      journalLines.push({ account_code: '2102', account_name: 'IVA Débito Fiscal (13%)', debit: 0, credit: ivaDebito });
      journalLines.push({ account_code: '4101', account_name: 'Ventas de Mercadería Gravadas', debit: 0, credit: gravada });

      try {
        await postDoubleEntryJournal({
          description: `Venta POS [${correlative}] - ${customerName || 'Consumidor Final'} (${paymentMethod})`,
          amount: totalCart,
          type: 'Avanzado',
          branchId: activeBranchId || null,
          lines: journalLines
        });
      } catch (jErr) {
        console.warn('Error al registrar partida contable en journal:', jErr);
      }

      // 5. Transmisión automática a Sandbox MH (DTE Studio) si está habilitada
      let dteTransmitSummary: {
        dteEstado?: 'PROCESADO' | 'RECHAZADO' | 'ERROR';
        selloRecibido?: string | null;
        codigoGeneracion?: string | null;
        numeroControl?: string | null;
        dteObservaciones?: string[];
      } = {};

      try {
        const [mhConfig, companyCfgRes] = await Promise.all([
          loadHaciendaSandboxConfig(),
          supabase.from('system_config').select('value').eq('key', 'company_profile').maybeSingle(),
        ]);

        if (mhConfig.enabled && mhConfig.autoTransmit) {
          const dteJson = buildOfficialDteJson({
            saleId: insertedSale?.id || null,
            correlative,
            docType: docType === 'CCF' ? 'CCF' : 'FACTURA',
            total: totalCart,
            ivaRete1: ivaRetention1 || 0,
            paymentMethod,
            items: cart.map((i) => ({
              sku: i.sku,
              name: i.name,
              quantity: Number(i.quantity) || 1,
              unitPrice: Number(i.price) || 0,
            })),
            customer: selectedCust
              ? {
                  name: selectedCust.name,
                  nit: selectedCust.nit,
                  nrc: selectedCust.nrc,
                  dui: selectedCust.dui,
                  giro: selectedCust.giro,
                  codActividad: selectedCust.cod_actividad || selectedCust.codActividad,
                  descActividad: selectedCust.desc_actividad || selectedCust.giro,
                  departamento: selectedCust.departamento,
                  municipio: selectedCust.municipio,
                  address: selectedCust.address,
                  phone: selectedCust.phone,
                  email: customerEmail || selectedCust.email,
                }
              : {
                  name: customerName || 'Consumidor Final',
                  email: customerEmail || cashConfig?.catchAllEmail || 'cliente@correo.sv',
                },
            company: companyCfgRes?.data?.value || null,
            ambiente: mhConfig.ambiente,
            codEstableMH: mhConfig.codEstableMH,
            codPuntoVentaMH: mhConfig.codPuntoVentaMH,
          });

          const txRes = await transmitDteViaSandbox({
            dteJson,
            baseUrl: mhConfig.baseUrl,
            ambiente: mhConfig.ambiente,
          });

          const estado: 'PROCESADO' | 'RECHAZADO' | 'ERROR' =
            txRes?.estado === 'PROCESADO'
              ? 'PROCESADO'
              : txRes?.estado === 'RECHAZADO'
              ? 'RECHAZADO'
              : 'ERROR';

          await appendDteTransmission({
            id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            saleId: insertedSale?.id || null,
            correlative,
            tipoDte: docType === 'CCF' ? '03' : '01',
            docTypeLabel: docType === 'CCF' ? 'CCF (03)' : 'Factura (01)',
            numeroControl: txRes?.numeroControl || dteJson.identificacion.numeroControl,
            codigoGeneracion: txRes?.codigoGeneracion || dteJson.identificacion.codigoGeneracion,
            estado,
            selloRecibido: txRes?.selloRecibido || null,
            fhaRecibido: txRes?.fhaRecibido || null,
            codigoMsg: txRes?.codigoMsg || null,
            descripcionMsg: txRes?.descripcionMsg || null,
            observaciones: Array.isArray(txRes?.observaciones) ? txRes.observaciones : [],
            customerName: customerName || (docType === 'CF' ? 'Consumidor Final' : 'Cliente CCF'),
            total: totalCart,
            ambiente: mhConfig.ambiente,
            signedJws: txRes?.signedJws || null,
            dteJson,
            createdAt: new Date().toISOString(),
          });

          dteTransmitSummary = {
            dteEstado: estado,
            selloRecibido: txRes?.selloRecibido || null,
            codigoGeneracion: txRes?.codigoGeneracion || dteJson.identificacion.codigoGeneracion,
            numeroControl: txRes?.numeroControl || dteJson.identificacion.numeroControl,
            dteObservaciones: Array.isArray(txRes?.observaciones) ? txRes.observaciones : [],
          };

          if (estado === 'PROCESADO') {
            toast({
              title: 'Sello MH Recibido (Sandbox)',
              description: `Sello: ${txRes.selloRecibido}`,
            });
          } else {
            toast({
              variant: 'destructive',
              title: 'DTE Rechazado por Sandbox MH',
              description:
                (txRes?.observaciones && txRes.observaciones[0]) ||
                txRes?.descripcionMsg ||
                'Revisa el historial en Contabilidad → Hacienda e IVA (MH).',
            });
          }
        }
      } catch (mhErr) {
        console.warn('Error en transmisión Sandbox MH (venta guardada correctamente):', mhErr);
      }

      // Registrar auditoría si hubo autorización excepcional de exceso de crédito
      if (creditOverrideAuth && (paymentMethod === 'Credito' || splitCreditVal > 0)) {
        logCreditOverrideAudit({
          ...creditOverrideAuth,
          id: `ov-${Date.now()}`,
          correlative,
        }).catch(() => {});
      }

      // Desplegar Modal de Venta Completada
      setCompletedSaleData({
        correlative,
        docType,
        total: totalCart,
        cashReceived: paymentMethod === 'Credito' ? 0 : cashVal,
        change: paymentMethod === 'Credito' ? 0 : changeVal,
        paymentMethod,
        creditDays: paymentMethod === 'Credito' || splitCreditVal > 0 ? (parseInt(posCreditDays) || 30) : undefined,
        creditAmount: paymentMethod === 'Credito' ? totalCart : (paymentMethod === 'Mixto' ? splitCreditVal : 0),
        creditAuthorizedBy: creditOverrideAuth?.authorizedByName,
        creditAuthReason: creditOverrideAuth?.reason,
        customerName: customerName || (docType === 'CF' ? 'Consumidor Final' : 'Cliente CCF'),
        customerEmail: customerEmail || selectedCustomer?.email || cashConfig?.catchAllEmail || '',
        customerNit: selectedCustomer?.nit,
        customerNrc: selectedCustomer?.nrc,
        customerGiro: selectedCustomer?.giro,
        customerAddress: selectedCustomer?.address,
        items: [...cart],
        ...dteTransmitSummary
      });

      toast({ title: "Venta Registrada Exitosamente", description: `DTE: ${correlative}` });
      setCart([]);
      setCustomerName('');
      setCustomerEmail('');
      setSelectedCustomer(null);
      setCreditOverrideAuth(null);
      setSelectedPendingSaleId(null);
      setCashReceived('');
      setSplitAmounts({
        cash: '',
        card: '',
        transfer: '',
        credit: '',
        cheque: ''
      });
      setIsCheckoutOpen(false);
      await loadBillingData();

    } catch (err: any) {
      console.error(err);
      toast({ variant: "destructive", title: "Error al procesar venta", description: err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProcessAdjustment = async (type: 'CREDITO' | 'DEBITO') => {
    if (!adjustmentForm.refDoc || !adjustmentForm.reason || adjustmentForm.items.length === 0) {
      toast({ variant: "destructive", title: "Faltan Datos", description: "Complete documento de referencia, motivo y productos." });
      return;
    }

    setIsProcessing(true);
    const table_name = type === 'CREDITO' ? 'credit_notes' : 'debit_notes';
    const totalAdjustment = adjustmentForm.items.reduce((acc, i) => acc + (i.price * i.quantity), 0);

    const defaultWh = warehouses.length > 0 ? warehouses[0] : null;

    try {
      // Si es nota de débito (salida de más mercancía), validar y deducir stock estricto
      if (type === 'DEBITO' && defaultWh) {
        const skus = adjustmentForm.items.map(i => i.sku);
        const { data: dbStocks } = await supabase
          .from('inventory_stock')
          .select('sku, quantity')
          .eq('warehouse_id', defaultWh.id)
          .in('sku', skus);
        
        const stockMap: Record<string, number> = {};
        (dbStocks || []).forEach(s => stockMap[s.sku] = parseFloat(s.quantity) || 0);

        for (const item of adjustmentForm.items) {
          const current = stockMap[item.sku] || 0;
          if (current < item.quantity) {
            toast({ variant: "destructive", title: "Stock Insuficiente", description: `No hay existencias de ${item.sku} para la Nota de Débito.` });
            setIsProcessing(false);
            return;
          }
        }
      }
      const { data: insertedAdjustment, error } = await supabase
        .from(table_name)
        .insert({
          ref_doc: adjustmentForm.refDoc,
          customer_name: adjustmentForm.customerName || 'Cliente General',
          reason: adjustmentForm.reason,
          items: adjustmentForm.items,
          total: totalAdjustment,
          status: 'EMITIDA'
        })
        .select()
        .single();

      if (error) throw error;
      
      // Si es nota de crédito (devolución), reintegrar stock en la primera bodega
      // Si es nota de débito (salida adicional), deducir stock de la primera bodega
      if ((type === 'CREDITO' || type === 'DEBITO') && warehouses.length > 0) {
        const defaultWh = warehouses[0];
        const stockUpdates = [];
        const kardexInserts = [];
        
        for (const item of adjustmentForm.items) {
          const { data: stRecord } = await supabase
            .from('inventory_stock')
            .select('quantity')
            .eq('sku', item.sku)
            .eq('warehouse_id', defaultWh.id)
            .maybeSingle();

          const currentStock = stRecord ? (parseFloat(stRecord.quantity) || 0) : 0;
          const newQty = type === 'CREDITO' ? currentStock + item.quantity : currentStock - item.quantity;
          
          stockUpdates.push({
            action: 'UPSERT',
            sku: item.sku,
            warehouse_id: defaultWh.id,
            quantity: newQty
          });
          
          kardexInserts.push({
            sku: item.sku,
            movement_type: 'FACTURA',
            location: defaultWh.name,
            document_ref: `${type}-${insertedAdjustment.id.split('-')[0]}`,
            qty_in: type === 'CREDITO' ? item.quantity : 0,
            qty_out: type === 'DEBITO' ? item.quantity : 0,
            balance: newQty,
            unit_cost: 0
          });
        }
        
        const { error: rpcErr } = await supabase.rpc('process_inventory_transaction', {
          p_stock_updates: stockUpdates,
          p_kardex_inserts: kardexInserts
        });
        
        if (rpcErr) throw rpcErr;
      }

      toast({ 
        title: `Nota de ${type === 'CREDITO' ? 'Crédito' : 'Débito'} Emitida`, 
        description: `Se procesó el ajuste por $${totalAdjustment.toFixed(2)}.` 
      });
      setAdjustmentForm({ refDoc: '', customerId: null, customerName: '', reason: '', items: [], total: 0 });
      await loadBillingData();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message || "No se pudo registrar la nota." });
    } finally {
      setIsProcessing(false);
    }
  };

  const addAdjustmentItem = (product: any) => {
    setAdjustmentForm(prev => {
      const existing = prev.items.find(i => i.id === product.id);
      if (existing) {
        return {
          ...prev,
          items: prev.items.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
        };
      }
      return {
        ...prev,
        items: [...prev.items, { id: product.id, name: product.name, sku: product.sku, price: product.price, quantity: 1 }]
      };
    });
  };

  const addExpense = () => {
    const amt = parseFloat(expenseAmount);
    if (!expenseDesc || isNaN(amt)) return;
    setExpenses([...expenses, { description: expenseDesc, amount: amt }]);
    setExpenseDesc('');
    setExpenseAmount('');
  };

  const handleDayClosing = async () => {
    const hasDifference =
      Math.abs(cashDifference) > 0.009 ||
      Math.abs(cardDifference) > 0.009 ||
      Math.abs(checkDifference) > 0.009 ||
      Math.abs(transferDifference) > 0.009 ||
      Math.abs(creditDifference) > 0.009;

    if (hasDifference) {
      const diff =
        Math.abs(cashDifference) > 0.009 ? cashDifference :
        Math.abs(cardDifference) > 0.009 ? cardDifference :
        Math.abs(checkDifference) > 0.009 ? checkDifference :
        Math.abs(transferDifference) > 0.009 ? transferDifference : creditDifference;
      triggerArqueoAlert(diff);
    }

    setIsProcessing(true);
    try {
      const closingDateStr = new Date().toISOString().split('T')[0];
      const salesReportedAmt = Number(reportedSalesAmount) || (systemCashSales + systemCardSales + systemTransferSales + systemCheckSales + systemCreditSales);

      const outgoingUser = outgoingCashierEmail || user?.email || 'Admin';
      const incomingUser = !incomingCashierEmail || incomingCashierEmail === 'SIN_RELEVO' ? 'Cierre de Día' : incomingCashierEmail;
      const diffLabel =
        Math.abs(cashDifference) < 0.01
          ? 'Cuadrado ($0.00)'
          : cashDifference > 0
          ? `Sobrante (+$${cashDifference.toFixed(2)})`
          : `Faltante (-$${Math.abs(cashDifference).toFixed(2)})`;

      // Guardar únicamente columnas válidas en daily_closings (sin 'incoming_cashier' que no existe en la tabla)
      const denominationsPayload: Record<string, any> = {
        ...cashDenominations,
        _meta: {
          base_float_counted: countedBaseFloat,
          base_float_expected: cashConfig?.cashFloat || 0,
          base_float_denominations: baseFloatDenominations,
          delivery_cash_counted: countedDeliveryCash,
          delivery_cash_expected: expectedDeliveryCash,
          closing_note: closingDifferenceNote.trim() || diffLabel,
          incoming_cashier: incomingUser
        }
      };

      const { error } = await supabase
        .from('daily_closings')
        .upsert({
          date: closingDateStr,
          cash_float: countedBaseFloat || cashConfig?.cashFloat || 0,
          system_cash_sales: systemCashSales,
          physical_cash_found: totalPhysicalCash,
          expenses: totalExpenses,
          difference: cashDifference,
          denominations: denominationsPayload,
          system_card_sales: systemCardSales,
          physical_card_found: physicalCard,
          card_difference: cardDifference,
          system_check_sales: systemCheckSales,
          physical_check_found: physicalCheck,
          check_difference: checkDifference,
          system_transfer_sales: systemTransferSales,
          physical_transfer_found: physicalTransfer,
          transfer_difference: transferDifference,
          system_credit_sales: systemCreditSales,
          physical_credit_found: physicalCredit,
          credit_difference: creditDifference,
          closed_by: outgoingUser
        }, { onConflict: 'date' });

      if (error) throw error;

      // 1. Asiento Contable Automático de Cierre de Caja en General Ledger (journal)
      const noteText = closingDifferenceNote.trim() ? ` | Nota: ${closingDifferenceNote.trim()}` : '';
      await supabase.from('journal').insert({
        description: `CIERRE DIARIO DE CAJA [${closingDateStr}] - Fondo Base: $${countedBaseFloat.toFixed(2)} | Entrega Efectivo: $${countedDeliveryCash.toFixed(2)} | ${diffLabel}${noteText} | Por: ${outgoingUser}`,
        type: 'Ingreso',
        amount: countedDeliveryCash > 0 ? countedDeliveryCash : salesReportedAmt
      });

      if (totalExpenses > 0) {
        await supabase.from('journal').insert({
          description: `EGRESOS Y GASTOS LIQUIDADOS DE CAJA CHICA [${closingDateStr}]`,
          type: 'Egreso',
          amount: totalExpenses
        });
      }

      logNexbotEvent(
        'billing',
        'AUDITORIA_JORNADA',
        {
          difference: cashDifference,
          closed_by: outgoingUser,
          base_float_counted: countedBaseFloat,
          delivery_cash_counted: countedDeliveryCash,
          closing_note: closingDifferenceNote.trim() || diffLabel
        },
        `El cajero ${outgoingUser} cerró la jornada. Fondo Base: $${countedBaseFloat.toFixed(2)} | Entrega Efectivo: $${countedDeliveryCash.toFixed(2)} | Estado: ${diffLabel}.`
      );

      // 2. Reiniciar todos los conteos y montos a CERO ($0.00) para el nuevo día
      setCashDenominations({
        '100.00': 0, '50.00': 0, '20.00': 0, '10.00': 0, '5.00': 0, '1.00': 0,
        '0.25': 0, '0.10': 0, '0.05': 0, '0.01': 0
      });
      setBaseFloatDenominations({
        '100.00': 0, '50.00': 0, '20.00': 0, '10.00': 0, '5.00': 0, '1.00': 0,
        '0.25': 0, '0.10': 0, '0.05': 0, '0.01': 0
      });
      setBaseFloatDirectAmount('');
      setClosingDifferenceNote('');
      setExpenses([]);
      setPhysicalCard(0);
      setPhysicalTransfer(0);
      setPhysicalCredit(0);
      setPhysicalCheck(0);
      setReportedSalesAmount('');
      setCashierVistoBueno(false);

      if (typeof window !== 'undefined') {
        localStorage.removeItem('nexway_saved_arqueo_draft');
      }

      await supabase.from('system_config').delete().eq('key', 'active_cash_draft');
      setLastClosingTimestamp(new Date().toISOString());
      setIsDayClosingConfirmOpen(false);
      await loadBillingData();

      toast({ 
        title: "¡Día Cerrado Exitosamente! ✓", 
        description: `Fondo Base: $${countedBaseFloat.toFixed(2)} · Entrega Efectivo: $${countedDeliveryCash.toFixed(2)} · ${diffLabel}.` 
      });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error al guardar cierre", description: e.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrintReport = async () => {
    const branding = await loadPrintBranding('billing');
    const html = buildCashClosingDocumentHtml({
      branding,
      stationName: activeStation?.name || 'Caja Principal',
      dateStr: new Date().toLocaleString('es-SV'),
      outgoingCashier: outgoingCashierEmail || user?.email || 'Cajero POS',
      incomingCashier: incomingCashierEmail && incomingCashierEmail !== 'SIN_RELEVO' ? incomingCashierEmail : undefined,
      salesCash: systemCashSales || 0,
      salesCard: systemCardSales || 0,
      salesTransfer: systemTransferSales || 0,
      salesCredit: systemCreditSales || 0,
      salesCheck: systemCheckSales || 0,
      totalSales: (systemCashSales || 0) + (systemCardSales || 0) + (systemTransferSales || 0) + (systemCreditSales || 0) + (systemCheckSales || 0),
      baseFloat: countedBaseFloat || 0,
      physicalCash: countedDeliveryCash || 0,
      expensesTotal: totalExpenses || 0,
      difference: cashDifference || 0,
      notes: closingDifferenceNote || undefined
    });
    printHtmlDocument(html, `Arqueo ${activeStation?.name || 'Caja'}`);
  };

  return (
    <div className="min-h-screen bg-transparent">
      {/* Header Estilo Terminal */}
      <div className="w-full max-w-[1920px] mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4 print:hidden relative z-10 bg-white/40 dark:bg-white/5 backdrop-blur-md border border-white/50 dark:border-white/10 p-4 px-6 rounded-2xl">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10" onClick={() => router.push('/')}>
            <ArrowLeft className="text-slate-600 dark:text-white/50" size={16} />
          </Button>
          <div>
            <h1 className="text-sm md:text-base font-bold font-headline">Terminal de Ventas NexWay</h1>
            <p className="text-[11px] text-slate-500 dark:text-white/40 mt-0.5">Gestión de caja y facturación con DTE</p>
            {activeStation ? (
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 dark:bg-[#5b5ef4]/20 text-blue-700 dark:text-[#7c7fff] border border-blue-200 dark:border-[#5b5ef4]/30">
                  <Store size={10} /> {activeStation.name}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/25">
                  <Warehouse size={10} /> {activeStation.warehouse_name}
                </span>
                {activeStation.station_role === 'PREFACTURACION_ONLY' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 animate-pulse">
                    📋 ESTACIÓN DE PRE-FACTURACIÓN (SOLO VALES)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
                    👑 CAJA EMISORA PRINCIPAL (DTE)
                  </span>
                )}
              </div>
            ) : (
              <span className="inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                ⚠ Sin caja asignada — stock global visible
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium uppercase text-slate-500 dark:text-white/30 tracking-wider hidden sm:inline whitespace-nowrap">Estación/Caja</span>
            <Select 
              value={activeStation?.id || ''} 
              onValueChange={handleAssignStation}
              disabled={!!establishedStationId}
            >
              <SelectTrigger className="h-8 w-[160px] text-xs rounded-lg bg-white/50 dark:bg-white/5 border-slate-200 dark:border-white/10 font-medium text-slate-700 dark:text-white/70">
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl dark:bg-[#0a0a14] dark:border-white/10">
                {availableStations.map((station: any) => (
                  <SelectItem key={station.id} value={station.id} className="text-xs">
                    {station.name} ({station.warehouse_name})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Acciones para establecer/liberar caja fija */}
            {activeStation && (
              establishedStationId === activeStation.id ? (
                <>
                  <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-[11px] font-bold bg-blue-500/10 dark:bg-[#5b5ef4]/25 text-blue-700 dark:text-[#7c7fff] border border-blue-200 dark:border-[#5b5ef4]/50">
                    FIJA
                  </span>
                  {isUserAdmin && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleClearEstablishedStation}
                      className="h-8 px-3 border-rose-500/30 text-rose-600 dark:text-rose-400 bg-rose-500/10 dark:bg-rose-500/15 hover:bg-rose-500/20 rounded-lg text-[11px] font-medium"
                    >
                      Liberar
                    </Button>
                  )}
                </>
              ) : (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleEstablishStation}
                  className="h-8 px-3 border-indigo-500/30 text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 dark:bg-indigo-500/15 hover:bg-indigo-500/20 rounded-lg text-[11px] font-medium"
                >
                  Establecer Caja
                </Button>
              )
            )}
          </div>

          {/* Indicador de Conectividad y Cola Offline */}
          <div className="flex items-center gap-2">
            {!isOnline ? (
              <Badge variant="destructive" className="h-8 px-2.5 flex items-center gap-1.5 text-[11px] font-black uppercase rounded-lg shadow-sm animate-pulse">
                <WifiOff size={14} />
                <span>OFFLINE (CONTINGENCIA)</span>
              </Badge>
            ) : offlineQueue.length > 0 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={triggerOfflineSync}
                disabled={isSyncingOffline}
                className="h-8 px-3 border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg text-[11px] font-bold flex items-center gap-1.5"
                title="Haga clic para sincronizar las ventas guardadas localmente"
              >
                {isSyncingOffline ? (
                  <>
                    <RefreshCw size={13} className="animate-spin text-amber-500" />
                    <span>Sincronizando {offlineQueue.length}...</span>
                  </>
                ) : (
                  <>
                    <CloudOff size={13} className="text-amber-500" />
                    <span>Sincronizar {offlineQueue.length} Venta(s)</span>
                  </>
                )}
              </Button>
            ) : (
              <span className="hidden md:inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                <Wifi size={13} />
                <span>Online</span>
              </span>
            )}
          </div>

          <ModeToggle />
        </div>
      </div>

      <div className="w-full max-w-[1920px] mx-auto px-2 sm:px-4 md:px-6 print:hidden relative z-10">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 w-full">
          <TabsList className="bg-transparent p-0 h-auto flex flex-wrap w-full justify-start overflow-x-auto no-scrollbar border-b border-slate-200 dark:border-white/10 gap-1 px-4 sm:px-6">
            {config?.['billing_facturacion'] !== false && (
              <TabsTrigger data-tour-id="tab-pos" value="facturacion" className="rounded-none px-4 py-3 font-medium text-[12.5px] text-slate-500 dark:text-white/40 data-[state=active]:text-blue-600 dark:data-[state=active]:text-[#7c7fff] data-[state=active]:border-b-2 data-[state=active]:border-blue-600 dark:data-[state=active]:border-[#5b5ef4] data-[state=active]:bg-transparent hover:text-slate-800 dark:hover:text-white/70 data-[state=active]:shadow-none transition-colors">
                <ShoppingCart size={14} className="mr-1.5" /> Venta
              </TabsTrigger>
            )}
            {config?.['billing_historial'] !== false && (
              <TabsTrigger data-tour-id="tab-history" value="historial" className="rounded-none px-4 py-3 font-medium text-[12.5px] text-slate-500 dark:text-white/40 data-[state=active]:text-blue-600 dark:data-[state=active]:text-[#7c7fff] data-[state=active]:border-b-2 data-[state=active]:border-blue-600 dark:data-[state=active]:border-[#5b5ef4] data-[state=active]:bg-transparent hover:text-slate-800 dark:hover:text-white/70 data-[state=active]:shadow-none transition-colors">
                <History size={14} className="mr-1.5" /> Historial
              </TabsTrigger>
            )}
            {config?.['billing_ajustes'] !== false && (
              <TabsTrigger value="ajustes_devoluciones" className="rounded-none px-4 py-3 font-medium text-[12.5px] text-slate-500 dark:text-white/40 data-[state=active]:text-blue-600 dark:data-[state=active]:text-[#7c7fff] data-[state=active]:border-b-2 data-[state=active]:border-blue-600 dark:data-[state=active]:border-[#5b5ef4] data-[state=active]:bg-transparent hover:text-slate-800 dark:hover:text-white/70 data-[state=active]:shadow-none transition-colors">
                <ArrowDownCircle size={14} className="mr-1.5" /> Ajustes y Devoluciones
              </TabsTrigger>
            )}
            {config?.['billing_arqueo'] !== false && (
              <TabsTrigger data-tour-id="tab-arqueo" value="arqueo" className="rounded-none px-4 py-3 font-medium text-[12.5px] text-slate-500 dark:text-white/40 data-[state=active]:text-blue-600 dark:data-[state=active]:text-[#7c7fff] data-[state=active]:border-b-2 data-[state=active]:border-blue-600 dark:data-[state=active]:border-[#5b5ef4] data-[state=active]:bg-transparent hover:text-slate-800 dark:hover:text-white/70 data-[state=active]:shadow-none transition-colors">
                <Calculator size={14} className="mr-1.5" /> Arqueo / Cierre
              </TabsTrigger>
            )}
            {config?.['billing_creditos'] !== false && (
              <TabsTrigger data-tour-id="tab-creditos" value="creditos" className="rounded-none px-4 py-3 font-medium text-[12.5px] text-slate-500 dark:text-white/40 data-[state=active]:text-blue-600 dark:data-[state=active]:text-[#7c7fff] data-[state=active]:border-b-2 data-[state=active]:border-blue-600 dark:data-[state=active]:border-[#5b5ef4] data-[state=active]:bg-transparent hover:text-slate-800 dark:hover:text-white/70 data-[state=active]:shadow-none transition-colors">
                <Wallet size={14} className="mr-1.5" /> Créditos / Abonos
              </TabsTrigger>
            )}
            <TabsTrigger value="cotizacion" className="rounded-none px-4 py-3 font-medium text-[12.5px] text-slate-500 dark:text-white/40 data-[state=active]:text-blue-600 dark:data-[state=active]:text-[#7c7fff] data-[state=active]:border-b-2 data-[state=active]:border-blue-600 dark:data-[state=active]:border-[#5b5ef4] data-[state=active]:bg-transparent hover:text-slate-800 dark:hover:text-white/70 data-[state=active]:shadow-none transition-colors">
              <FileText size={14} className="mr-1.5" /> Cotización
            </TabsTrigger>
          </TabsList>

          {/* TAB VENTA */}
          <TabsContent value="facturacion" className="grid grid-cols-1 lg:grid-cols-12 gap-8 outline-none animate-in fade-in duration-300">
            {/* Columna Izquierda: POS Carrito (Ancho: 5/12) */}
            <div className="lg:col-span-5 space-y-3.5">
              <div className="bg-white/40 dark:bg-white/5 backdrop-blur-xl border border-white/50 dark:border-white/10 rounded-[13px] p-5 flex flex-col gap-3 shadow-sm dark:shadow-none">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-white/30">Resumen de venta</span>
                  <span className="bg-blue-500/10 dark:bg-[#5b5ef4]/20 text-blue-700 dark:text-[#7c7fff] border border-blue-200 dark:border-[#5b5ef4]/30 text-[11px] font-bold px-2.5 py-0.5 rounded-full">{docType}</span>
                </div>
                <div className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight"><span className="text-lg text-slate-400 dark:text-white/50">$</span>{totalCart.toFixed(2)}</div>
                
                <div className="h-[1px] bg-slate-200 dark:bg-white/10 my-1" />
                
                {/* Carrito */}
                <ScrollArea className="h-[250px]">
                  <div className="space-y-2.5 pr-2">
                    {cart.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-7 gap-2">
                        <ShoppingCart className="text-slate-300 dark:text-white/10" size={32} />
                        <p className="text-[11px] text-slate-400 dark:text-white/20 text-center leading-relaxed">Escanee productos<br/>o búsquelos en el catálogo</p>
                      </div>
                    ) : cart.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-white/5 flex-wrap sm:flex-nowrap gap-2">
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{item.name}</h4>
                          <p className="text-[9px] text-muted-foreground font-mono mt-0.5">{item.sku} • ${item.price.toFixed(2)} c/u</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-slate-800 dark:text-white/70 bg-slate-200 dark:bg-white/10 px-2 py-1 rounded-lg">
                            {item.quantity}x
                          </span>
                          <span className="text-xs font-bold text-blue-600 dark:text-[#7c7fff] min-w-[50px] text-right">
                            ${(item.price * item.quantity).toFixed(2)}
                          </span>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => setCart(cart.filter(i => i.id !== item.id))}
                            className="text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl h-7 w-7"
                          >
                            <Trash2 size={12}/>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                <div className="h-[1px] bg-slate-200 dark:bg-white/10 my-1" />

                {/* Métodos de Pago */}
                <div>
                  <Label className="text-[10px] font-medium uppercase text-slate-500 dark:text-white/30 tracking-wider mb-2.5 block">Método de pago</Label>
                  <div className="flex gap-1.5 flex-wrap">
                    {['Efectivo', 'Tarjeta', 'Transferencia', 'Cheque', 'Mixto'].map(method => (
                      <button 
                        key={method}
                        onClick={() => setPaymentMethod(method as PaymentMethod)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-medium transition-colors border ${
                          paymentMethod === method 
                            ? 'bg-blue-500/10 dark:bg-[#5b5ef4]/25 border-blue-500/30 dark:border-[#5b5ef4]/50 text-blue-700 dark:text-[#7c7fff]' 
                            : 'bg-white/50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/50 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white/80'
                        }`}
                      >
                        {method === 'Efectivo' && <Wallet size={13} />}
                        {method === 'Tarjeta' && <CardIcon size={13} />}
                        {method === 'Cheque' && <FileText size={13} />}
                        {method === 'Transferencia' && <Landmark size={13} />}
                        {method === 'Mixto' && <Layers size={13} />}
                        {method}
                      </button>
                    ))}
                    <button 
                      onClick={() => {
                        if (creditValidation.needsOverride) {
                          setIsCreditAuthModalOpen(true);
                          return;
                        }
                        if (!creditValidation.disabled) {
                          setPaymentMethod('Credito');
                        }
                      }}
                      disabled={!selectedCustomer}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-medium transition-colors border ${
                        paymentMethod === 'Credito'
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-700 dark:text-amber-300 font-bold' 
                          : creditValidation.needsOverride
                          ? 'bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20'
                          : 'bg-white/50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/50 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white/80'
                      } ${!selectedCustomer ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <Receipt size={13} /> Crédito {creditValidation.needsOverride ? '🔒' : ''}
                    </button>
                  </div>

                  {/* SEMÁFORO DE CRÉDITO + BOTÓN DE AUTORIZACIÓN DE ENCARGADO */}
                  <div
                    className={`mt-2 p-2.5 rounded-xl border text-[11px] flex flex-wrap items-center justify-between gap-2 ${
                      !selectedCustomer
                        ? 'bg-muted/30 border-border text-muted-foreground'
                        : creditOverrideAuth
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                        : creditValidation.needsOverride
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-800 dark:text-amber-200'
                        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                    }`}
                  >
                    <div className="flex items-start gap-1.5 flex-1 min-w-[200px]">
                      <AlertCircle size={13} className="shrink-0 mt-0.5" />
                      <span className="leading-snug">{creditValidation.reason}</span>
                    </div>
                    {creditValidation.needsOverride && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setIsCreditAuthModalOpen(true)}
                        className="h-7 px-2.5 text-[10px] font-black bg-amber-600 hover:bg-amber-700 text-white rounded-lg shrink-0"
                      >
                        🔐 Autorizar Exceso
                      </Button>
                    )}
                    {creditOverrideAuth && (
                      <button
                        type="button"
                        onClick={() => setCreditOverrideAuth(null)}
                        className="text-[10px] font-bold underline opacity-80 hover:opacity-100"
                      >
                        Revocar
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={handleOpenCheckout} 
                  disabled={cart.length === 0 || isProcessing}
                  className="w-full rounded-[11px] p-[15px] text-[13px] font-bold text-white text-center cursor-pointer bg-blue-600/90 hover:bg-blue-600 dark:bg-[#5b5ef4]/35 dark:border dark:border-[#5b5ef4]/50 hover:dark:bg-[#5b5ef4]/50 tracking-[0.3px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={16} /> FINALIZAR COBRO Y FACTURAR
                </button>
              </div>
            </div>

            {/* Columna Derecha: Catálogo POS (Ancho: 7/12) */}
            <div className="lg:col-span-7 space-y-6">
              
              <div className="flex justify-between items-center flex-wrap gap-2">
                 <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">Facturación Rápida (Caja)</h2>
                 <div className="flex gap-2">
                   <Button 
                     variant="outline" 
                     onClick={() => { fetchQuotations(); setShowQuotationsDialog(true); }}
                     className="h-9 text-xs font-bold bg-indigo-500/10 dark:bg-indigo-500/20 border-indigo-500/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/20 dark:hover:bg-indigo-500/30 rounded-xl transition-colors gap-2"
                   >
                     <FileText size={14} />
                     Cotizaciones / Pre-Facturas
                     {quotationsList.length > 0 && (
                       <Badge className="bg-indigo-600 text-white text-[10px] font-black px-1.5 py-0 h-5 rounded-full">
                         {quotationsList.length}
                       </Badge>
                     )}
                   </Button>
                 </div>
              </div>

              {/* Cliente y DTE */}
              <div className="bg-white/40 dark:bg-white/5 backdrop-blur-md border border-white/50 dark:border-white/10 p-4 rounded-[13px] flex flex-col sm:flex-row gap-4 shadow-sm dark:shadow-none">
                <div className="flex-1 space-y-1.5">
                  <Label className="text-[10px] font-medium uppercase text-slate-500 dark:text-white/30 tracking-wider">Cliente Receptor</Label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Buscar cliente o ingrese nombre..." 
                      value={customerName} 
                      onChange={e => {
                        setCustomerName(e.target.value);
                        if (selectedCustomer && e.target.value !== selectedCustomer.name) {
                          setSelectedCustomer(null);
                        }
                      }} 
                      className="h-10 bg-white/50 dark:bg-black/20 border-slate-200 dark:border-white/10 rounded-xl text-xs font-medium text-slate-800 dark:text-white/70" 
                    />
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="h-10 w-10 shrink-0 border-slate-200 dark:border-white/10 bg-white/50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl px-0 flex items-center justify-center transition-colors">
                          <Users size={16} className="text-slate-500 dark:text-white/40" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 p-0 rounded-2xl overflow-hidden bg-white dark:bg-[#0a0a14] border-slate-200 dark:border-white/10 shadow-lg" align="end">
                        <div className="p-3 border-b border-slate-100 dark:border-white/5">
                          <Input placeholder="Buscar cliente..." value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} className="h-8 text-xs bg-slate-50 dark:bg-white/5 border-none rounded-lg text-slate-800 dark:text-white" />
                        </div>
                        <ScrollArea className="h-48">
                          {filteredCustomers.map(c => (
                            <div key={c.id} onClick={() => { setSelectedCustomer(c); setCustomerName(c.name); setCustomerEmail(c.email || ''); setDocType(c.category === 'Crédito Fiscal' ? 'CCF' : 'CF'); }} className="p-3 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer border-b border-slate-100 dark:border-white/5 transition-colors">
                              <p className="text-[11px] font-bold text-slate-800 dark:text-white/80">{c.name}</p>
                              <p className="text-[9px] text-slate-400 dark:text-white/40 mt-0.5">{c.email || 'Sin correo registrado'}</p>
                            </div>
                          ))}
                        </ScrollArea>
                      </PopoverContent>
                    </Popover>
                    <CustomerHistoryDialog 
                      customerId={selectedCustomer?.id || null} 
                      customerName={selectedCustomer?.name || customerName || ''} 
                      onAddToCart={handleAddToCartFromHistory}
                      onAddMultipleToCart={handleAddMultipleToCartFromHistory}
                    />
                  </div>
                </div>
                {/* Vendedor / Colaborador (Para Metas y Comisiones) */}
                <div className="w-full sm:w-52 space-y-1.5">
                  <Label className="text-[10px] font-medium uppercase text-indigo-600 dark:text-indigo-400 tracking-wider flex items-center gap-1 font-bold">
                    <UserCheck size={12} /> Vendedor / Asesor
                  </Label>
                  <Select value={selectedSellerEmail} onValueChange={setSelectedSellerEmail}>
                    <SelectTrigger className="h-10 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800 text-xs font-bold text-slate-800 dark:text-white">
                      <SelectValue placeholder="Seleccionar Vendedor" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl dark:bg-[#0a0a14] dark:border-white/10">
                      {appUsersList.map(u => (
                        <SelectItem key={u.id} value={u.email}>
                          {u.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full sm:w-40 space-y-1.5">
                  <Label className="text-[10px] font-medium uppercase text-slate-500 dark:text-white/30 tracking-wider">Tipo de DTE</Label>
                  <Select value={docType} onValueChange={(v: any) => setDocType(v)}>
                    <SelectTrigger className="h-10 rounded-xl bg-white/50 dark:bg-black/20 border-slate-200 dark:border-white/10 text-xs font-medium text-slate-800 dark:text-white/70">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="dark:bg-[#0a0a14] dark:border-white/10">
                      <SelectItem value="CF">Factura CF</SelectItem>
                      <SelectItem value="CCF">Crédito Fiscal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Ficha Fiscal Hacienda (MH — CCF 03) */}
              {docType === 'CCF' && selectedCustomer && (
                <div className={`p-3 rounded-[13px] border text-xs space-y-1.5 ${
                  ccfMhValidation && !ccfMhValidation.isReady
                    ? 'bg-amber-500/10 border-amber-500/40'
                    : 'bg-indigo-500/5 border-indigo-500/25'
                }`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                        <ShieldCheck size={13} /> Ficha Fiscal MH (CCF)
                      </span>
                      <span className="font-mono text-[11px] font-semibold text-foreground">
                        NIT: {selectedCustomer.nit || '—'}
                      </span>
                      <span className="font-mono text-[11px] font-semibold text-foreground">
                        NRC: {selectedCustomer.nrc || '—'}
                      </span>
                      {selectedCustomer.is_gran_contribuyente && (
                        <Badge className="bg-amber-500 text-white text-[9px] h-4 px-1.5 font-bold">
                          Gran Contribuyente · Retención 1% IVA
                        </Badge>
                      )}
                    </div>
                    {ccfMhValidation?.isReady ? (
                      <Badge variant="outline" className="text-[9px] h-5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-semibold">
                        ✓ Listo para Hacienda
                      </Badge>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => router.push('/directorio')}
                        className="h-6 text-[10px] px-2 border-amber-500/50 text-amber-800 dark:text-amber-300 hover:bg-amber-500/20"
                      >
                        Completar en Directorio
                      </Button>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground">
                    <span>
                      <strong className="text-foreground">Giro (CAT-019):</strong>{' '}
                      {selectedCustomer.cod_actividad && (
                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 mr-1">
                          [{selectedCustomer.cod_actividad}]
                        </span>
                      )}
                      {selectedCustomer.giro || 'No asignado'}
                    </span>
                    {(selectedCustomer.department || selectedCustomer.municipality) && (
                      <span>
                        <strong className="text-foreground">Ubicación:</strong>{' '}
                        {[selectedCustomer.department, selectedCustomer.municipality].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </div>
                  {ccfMhValidation && !ccfMhValidation.isReady && (
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300 pt-0.5">
                      <AlertTriangle size={13} className="shrink-0" />
                      Faltan datos obligatorios para CCF Hacienda: {ccfMhValidation.missing.join(', ')}.
                    </div>
                  )}
                </div>
              )}

              {/* Input Buscador con Filtros */}
              <form onSubmit={handleSearchInventory} className="flex gap-3 relative">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/30" size={16} />
                  <Input 
                    placeholder="Buscar por SKU, código o nombre (Presione Enter)..." 
                    value={searchTerm} 
                    onChange={e => {
                      setSearchTerm(e.target.value);
                      if (!e.target.value) setInventory([]);
                    }} 
                    className="pl-11 h-[48px] bg-white/40 dark:bg-white/5 backdrop-blur-md border-slate-200 dark:border-white/10 shadow-sm dark:shadow-none rounded-[10px] text-xs md:text-sm font-medium focus-visible:ring-blue-500 text-slate-800 dark:text-white/70" 
                  />
                  {/* Absolute search results dropdown */}
                  {inventory.length > 0 && searchTerm.trim() !== "" && (
                    <Card className="absolute left-0 right-0 mt-2 bg-white dark:bg-[#0a0a14] border border-slate-200 dark:border-white/10 shadow-2xl z-50 max-h-64 overflow-y-auto no-scrollbar rounded-2xl p-1">
                      {inventory.map((p) => (
                        <div 
                          key={p.id} 
                          className="p-3 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl border-b last:border-none border-slate-100 dark:border-white/5 flex justify-between items-center gap-3 transition-colors"
                        >
                          <div 
                            onClick={() => {
                              addToCart(p, '1/1');
                              setSearchTerm('');
                              setInventory([]);
                            }}
                            className="flex flex-col gap-0.5 flex-1 cursor-pointer"
                          >
                            <span className="text-xs font-bold text-slate-800 dark:text-white/80">{p.name}</span>
                            <span className="text-[9px] text-slate-500 dark:text-white/40 font-mono">SKU: {p.sku} {p.category ? `• Ref: ${p.category}` : ''} • Stock: {p.quantity}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                            {getFractionOptionsForSku(p.sku || '').length > 1 && (
                              <Select
                                value="1/1"
                                onValueChange={(fracVal) => {
                                  addToCart(p, fracVal);
                                  setSearchTerm('');
                                  setInventory([]);
                                }}
                              >
                                <SelectTrigger className="h-7 px-2.5 text-[10px] font-bold rounded-lg bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-300 w-[125px]">
                                  <SelectValue placeholder="Fracción" />
                                </SelectTrigger>
                                <SelectContent className="dark:bg-[#0a0a14] dark:border-white/10">
                                  {getFractionOptionsForSku(p.sku || '').map(fOpt => (
                                    <SelectItem key={fOpt.value} value={fOpt.value} className="text-xs">
                                      {fOpt.shortLabel}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                addToCart(p, '1/1');
                                setSearchTerm('');
                                setInventory([]);
                              }}
                              className="text-xs font-bold text-blue-600 dark:text-[#7c7fff] hover:underline px-1"
                            >
                              ${p.price.toFixed(2)}
                            </button>
                          </div>
                        </div>
                      ))}
                    </Card>
                  )}
                </div>
                <button type="submit" className="h-[48px] bg-blue-500/10 dark:bg-[#5b5ef4]/35 hover:bg-blue-500/20 dark:hover:bg-[#5b5ef4]/50 border border-blue-500/30 dark:border-[#5b5ef4]/50 text-blue-700 dark:text-[#a5a8ff] font-semibold rounded-[10px] shadow-none px-6 transition-colors flex items-center gap-2 whitespace-nowrap text-[13px]">
                  <Search size={15} /> Buscar
                </button>
              </form>

              {/* Detalle de Productos en Tabla */}
              <div className="bg-white/40 dark:bg-white/5 backdrop-blur-md border border-white/50 dark:border-white/10 rounded-[13px] flex flex-col overflow-hidden shadow-sm dark:shadow-none">
                <div className="overflow-x-auto no-scrollbar flex-1">
                  <Table>
                    <TableHeader className="bg-slate-50/50 dark:bg-transparent border-b border-slate-200 dark:border-white/5">
                      <TableRow className="hover:bg-transparent border-none">
                        <TableHead className="text-[10px] font-medium uppercase text-slate-400 dark:text-white/30 tracking-wide w-10 text-center h-10">#</TableHead>
                        <TableHead className="text-[10px] font-medium uppercase text-slate-400 dark:text-white/30 tracking-wide h-10">Producto</TableHead>
                        <TableHead className="text-[10px] font-medium uppercase text-slate-400 dark:text-white/30 tracking-wide h-10">SKU</TableHead>
                        <TableHead className="text-[10px] font-medium uppercase text-indigo-500 dark:text-indigo-400 tracking-wide text-center h-10">Fracción Auto</TableHead>
                        <TableHead className="text-[10px] font-medium uppercase text-slate-400 dark:text-white/30 tracking-wide text-right h-10">Precio unit.</TableHead>
                        <TableHead className="text-[10px] font-medium uppercase text-slate-400 dark:text-white/30 tracking-wide text-center w-24 h-10">Cantidad</TableHead>
                        <TableHead className="text-[10px] font-medium uppercase text-slate-400 dark:text-white/30 tracking-wide text-right h-10">Descuento</TableHead>
                        <TableHead className="text-[10px] font-medium uppercase text-slate-400 dark:text-white/30 tracking-wide text-right pr-6 h-10">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cart.length === 0 ? (
                        <TableRow className="hover:bg-transparent border-none">
                          <TableCell colSpan={8} className="text-center py-10 bg-transparent">
                            <div className="flex flex-col items-center justify-center gap-2">
                              <Package size={28} className="text-slate-300 dark:text-white/10 mb-1" />
                              <p className="text-[12px] text-slate-500 dark:text-white/20 text-center leading-relaxed">No hay productos agregados<br/>Agrega productos para comenzar la venta.</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : cart.map((item, idx) => (
                        <TableRow key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 border-b border-slate-100 dark:border-white/5 transition-colors">
                          <TableCell className="text-center text-xs font-mono text-slate-400 dark:text-white/40 pr-0">{idx + 1}</TableCell>
                          <TableCell className="font-medium text-xs text-slate-800 dark:text-white/80 py-3">{item.name}</TableCell>
                          <TableCell className="text-xs font-mono text-slate-400 dark:text-white/40">{item.sku}</TableCell>
                          <TableCell className="text-center">
                            {getFractionOptionsForSku(item.sku || '').length > 1 ? (
                              <Select
                                value={(item as any).fractionText || '1/1'}
                                onValueChange={(val) => updateCartFraction(item.id, val)}
                              >
                                <SelectTrigger className="h-7 px-2 text-[11px] font-bold rounded-lg bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-300 w-[130px] mx-auto">
                                  <SelectValue placeholder="1/1 Entero" />
                                </SelectTrigger>
                                <SelectContent className="dark:bg-[#0a0a14] dark:border-white/10">
                                  {getFractionOptionsForSku(item.sku || '').map(fOpt => (
                                    <SelectItem key={fOpt.value} value={fOpt.value} className="text-xs">
                                      {fOpt.shortLabel}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="text-[10px] font-semibold text-muted-foreground">Entero</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              className="w-20 h-7 text-xs text-right ml-auto bg-slate-100 dark:bg-white/10 border-transparent focus:border-blue-500 rounded-lg text-slate-800 dark:text-white/90 font-mono font-bold"
                              value={item.price}
                              onChange={(e) => updateCartPrice(item.id, e.target.value)}
                              title={(item as any).suppliesCost > 0 ? `Incluye +${Number((item as any).suppliesCost).toFixed(2)} de insumos fijos (Editable)` : 'Precio unitario editable'}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Input
                              type="number"
                              min="1"
                              className="w-16 h-7 text-xs text-center mx-auto bg-slate-100 dark:bg-white/10 border-transparent focus:border-blue-500 rounded-lg text-slate-800 dark:text-white/80 font-bold"
                              value={item.quantity === 0 ? '' : item.quantity}
                              onChange={(e) => updateCartQuantity(item.id, e.target.value)}
                            />
                          </TableCell>
                          <TableCell className="text-right text-xs font-medium text-slate-400 dark:text-white/40">$0.00</TableCell>
                          <TableCell className="text-right pr-2">
                            <div className="flex items-center justify-end gap-3">
                              <span className="text-xs font-bold text-blue-600 dark:text-[#7c7fff]">${(item.price * (Number(item.quantity) || 0)).toFixed(2)}</span>
                              <button onClick={() => removeFromCart(item.id)} className="text-slate-400 hover:text-rose-500 transition-colors p-1">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                
                {/* Fila de Totales en el Pie de la Tabla */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-[14px_16px] border-t border-white/10 border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-transparent">
                  <div className="flex flex-col gap-[3px]">
                    <span className="text-[10px] text-slate-400 dark:text-white/30 uppercase tracking-[.5px] font-medium">
                      {docType === 'CCF' ? 'Gravado + IVA (13%)' : 'Subtotal'}
                    </span>
                    <span className="text-[14px] font-semibold text-slate-700 dark:text-white/70">${totalCart.toFixed(2)}</span>
                  </div>
                  {ivaRetention1 > 0 ? (
                    <div className="flex flex-col gap-[3px]">
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 uppercase tracking-[.5px] font-bold">
                        Retención 1% IVA (MH)
                      </span>
                      <span className="text-[14px] font-bold text-amber-600 dark:text-amber-400">-${ivaRetention1.toFixed(2)}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-[3px]">
                      <span className="text-[10px] text-slate-400 dark:text-white/30 uppercase tracking-[.5px] font-medium">Descuento</span>
                      <span className="text-[14px] font-semibold text-slate-700 dark:text-white/70">$0.00</span>
                    </div>
                  )}
                  <div className="flex flex-col gap-[3px] text-right">
                    <span className="text-[10px] text-slate-400 dark:text-white/30 uppercase tracking-[.5px] font-medium">Total a pagar</span>
                    <span className="text-[18px] font-bold text-blue-600 dark:text-[#7c7fff]">${netPayableTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>

            </div>
          </TabsContent>

          {/* TAB AJUSTES Y DEVOLUCIONES */}
          <TabsContent value="ajustes_devoluciones" className="grid grid-cols-1 lg:grid-cols-12 gap-6 outline-none">
             <div className="lg:col-span-5 space-y-4">
                <div className="flex gap-2">
                  <Button 
                    variant={adjustmentType === 'CREDITO' ? 'default' : 'outline'}
                    className={`flex-1 rounded-xl ${adjustmentType === 'CREDITO' ? 'bg-rose-500 hover:bg-rose-600 text-white' : ''}`}
                    onClick={() => setAdjustmentType('CREDITO')}
                  >
                    Nota de Crédito (Devolución)
                  </Button>
                  <Button 
                    variant={adjustmentType === 'DEBITO' ? 'default' : 'outline'}
                    className={`flex-1 rounded-xl ${adjustmentType === 'DEBITO' ? 'bg-amber-500 hover:bg-amber-600 text-white' : ''}`}
                    onClick={() => setAdjustmentType('DEBITO')}
                  >
                    Nota de Débito (Cargo Extra)
                  </Button>
                </div>
                <div className="bg-white/40 dark:bg-white/5 backdrop-blur-md border border-white/50 dark:border-white/10 rounded-[13px] overflow-hidden shadow-sm dark:shadow-none flex flex-col">
                   <div className={`p-5 border-b ${adjustmentType === 'CREDITO' ? 'bg-rose-500/10 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 border-rose-500/20' : 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/20'}`}>
                      <h3 className="text-sm font-bold">Documento a Emitir: Nota de {adjustmentType === 'CREDITO' ? 'Crédito' : 'Débito'}</h3>
                      <p className="text-4xl font-black mt-2">${adjustmentForm.items.reduce((acc, i) => acc + (i.price * i.quantity), 0).toFixed(2)}</p>
                   </div>
                   <div className="p-0">
                      <ScrollArea className="h-[300px]">
                         <Table>
                            <TableBody>
                               {adjustmentForm.items.length === 0 ? (
                                  <TableRow className="hover:bg-transparent border-none">
                                    <TableCell colSpan={3} className="text-center py-20 text-slate-500 dark:text-white/30 text-xs italic border-none">
                                      Agregue conceptos
                                    </TableCell>
                                  </TableRow>
                               ) : adjustmentForm.items.map((item, idx) => (
                                <TableRow key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 border-b border-slate-100 dark:border-white/5 transition-colors">
                                      <TableCell className="font-medium text-xs text-slate-800 dark:text-white/80">{item.quantity}x {item.name}</TableCell>
                                      <TableCell className={`text-right font-bold ${adjustmentType === 'CREDITO' ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                        {adjustmentType === 'CREDITO' ? '-' : '+'}${(item.price * item.quantity).toFixed(2)}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" className={`hover:bg-slate-100 h-8 w-8 ${adjustmentType === 'CREDITO' ? 'text-rose-600 dark:hover:bg-rose-500/20' : 'text-amber-600 dark:hover:bg-amber-500/20'}`} onClick={() => setAdjustmentForm({...adjustmentForm, items: adjustmentForm.items.filter(i => i.id !== item.id)})}>
                                          <Trash2 size={14}/>
                                        </Button>
                                      </TableCell>
                                   </TableRow>
                                ))}
                            </TableBody>
                         </Table>
                      </ScrollArea>
                   </div>
                </div>
                <button 
                  className={`w-full h-[56px] rounded-[13px] border font-bold text-[14px] transition-colors shadow-none flex items-center justify-center disabled:opacity-50 ${adjustmentType === 'CREDITO' ? 'bg-rose-500/10 dark:bg-rose-500/20 hover:bg-rose-500/20 dark:hover:bg-rose-500/30 text-rose-700 dark:text-rose-400 border-rose-500/30' : 'bg-amber-500/10 dark:bg-amber-500/20 hover:bg-amber-500/20 dark:hover:bg-amber-500/30 text-amber-700 dark:text-amber-400 border-amber-500/30'}`}
                  onClick={() => handleProcessAdjustment(adjustmentType)}
                  disabled={isProcessing || adjustmentForm.items.length === 0}
                >
                  {isProcessing ? <Loader2 className="animate-spin mr-2" /> : (adjustmentType === 'CREDITO' ? <RotateCcw className="mr-2" size={18} /> : <TrendingUp className="mr-2" size={18} />)}
                  EMITIR NOTA DE {adjustmentType === 'CREDITO' ? 'CRÉDITO' : 'DÉBITO'}
                </button>
             </div>
             <div className="lg:col-span-7 space-y-4">
                <div className="p-5 bg-white dark:bg-[#0a0a14] border border-slate-200 dark:border-white/10 rounded-[13px] shadow-md space-y-4 relative z-40">
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5 relative z-50">
                         <Label className="text-[10px] font-medium uppercase text-slate-500 dark:text-white/30 tracking-wider">Buscar Factura / Cliente</Label>
                          <div className="relative">
                             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                             <Input 
                               placeholder="Nombre del cliente o N° Factura..." 
                               value={invoiceSearchTerm} 
                               onFocus={() => handleSearchInvoices({ target: { value: invoiceSearchTerm } } as any)}
                               onChange={handleSearchInvoices}
                               className="pl-9 h-10 bg-white/50 dark:bg-black/20 border-slate-200 dark:border-white/10 rounded-[10px] text-xs font-medium text-slate-800 dark:text-white/70"
                             />
                             {invoiceSearchTerm && (
                               <button
                                 type="button"
                                 onClick={() => { setInvoiceSearchTerm(''); setInvoiceSearchResults([]); }}
                                 className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600"
                               >
                                 ✕
                               </button>
                             )}
                          </div>
                          {invoiceSearchResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#0d0f18] border border-slate-200 dark:border-white/10 shadow-2xl z-[9999] max-h-64 overflow-y-auto rounded-xl p-1">
                              {invoiceSearchResults.map((sale) => (
                                <div 
                                  key={sale.id}
                                  onClick={() => handleSelectInvoice(sale)}
                                  className="p-3 hover:bg-indigo-50/50 dark:hover:bg-white/10 cursor-pointer rounded-lg border-b last:border-none border-slate-100 dark:border-white/5 flex flex-col gap-1 transition-colors"
                                >
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-slate-800 dark:text-white">{sale.customer_name || 'Consumidor Final'}</span>
                                    <span className="text-[10px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                                      {sale.correlative || sale.id.substring(0,8)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-[10px] text-slate-500 dark:text-white/40">
                                      {sale.doc_type || 'CF'} • {sale.created_at ? format(new Date(sale.created_at), "dd MMM yyyy, h:mm a", { locale: es }) : 'Reciente'}
                                    </span>
                                    <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">${Number(sale.total || 0).toFixed(2)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                      </div>
                      <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <Label className="text-[10px] font-medium uppercase text-slate-500 dark:text-white/30 tracking-wider">Documento Seleccionado</Label>
                            {adjustmentForm.refDoc && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setAdjustmentForm(prev => ({
                                    ...prev,
                                    refDoc: '',
                                    customerName: '',
                                    customerId: null,
                                    items: []
                                  }));
                                  setSelectedSaleInfo(null);
                                  toast({ title: "Factura deseleccionada", description: "Se limpiaron los datos del comprobante." });
                                }}
                                className="h-5 px-1.5 text-[9px] font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded flex items-center gap-1"
                              >
                                <Trash2 size={11} /> Borrar Factura
                              </Button>
                            )}
                          </div>
                          <div className="flex flex-col gap-1">
                             <div className="relative flex items-center">
                               <Input disabled placeholder="FACT-001" value={adjustmentForm.refDoc} className="h-10 bg-slate-50/50 dark:bg-black/40 border-slate-200 dark:border-white/10 rounded-[10px] text-xs font-bold text-slate-800 dark:text-white/80 pr-9 w-full" />
                               {adjustmentForm.refDoc && (
                                 <button
                                   type="button"
                                   title="Borrar Factura Seleccionada"
                                   onClick={() => {
                                     setAdjustmentForm(prev => ({
                                       ...prev,
                                       refDoc: '',
                                       customerName: '',
                                       customerId: null,
                                       items: []
                                     }));
                                     setSelectedSaleInfo(null);
                                     toast({ title: "Factura deseleccionada", description: "Se limpiaron los datos del comprobante." });
                                   }}
                                   className="absolute right-2.5 p-1 rounded-md text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                 >
                                   <Trash2 size={15} />
                                 </button>
                               )}
                             </div>
                             {adjustmentForm.customerName && (
                               <div className="flex items-center">
                                 <span className="text-[10px] text-slate-500 font-medium px-1">Cliente: {adjustmentForm.customerName}</span>
                                 <CustomerHistoryDialog 
                                   customerId={adjustmentForm.customerId} 
                                   customerName={adjustmentForm.customerName} 
                                   onAddToCart={handleAddToCartFromHistory}
                                   onAddMultipleToCart={handleAddMultipleToCartFromHistory}
                                 />
                               </div>
                             )}
                          </div>
                       </div>
                   </div>

                   {/* Ficha Interactiva de Productos de la Factura de Origen */}
                   {selectedSaleInfo && selectedSaleInfo.items && selectedSaleInfo.items.length > 0 && (
                     <div className="p-3.5 bg-indigo-500/5 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/40 rounded-xl space-y-2.5 animate-in fade-in">
                       <div className="flex items-center justify-between">
                         <div className="flex items-center gap-2">
                           <Receipt className="text-indigo-600 dark:text-indigo-400" size={15} />
                           <span className="text-xs font-bold text-slate-800 dark:text-white">
                             Productos Vendidos en {selectedSaleInfo.correlative}
                           </span>
                         </div>
                         <Button
                           size="sm"
                           type="button"
                           variant="outline"
                           onClick={() => {
                             setAdjustmentForm(prev => ({
                               ...prev,
                               items: [...selectedSaleInfo.items]
                             }));
                             toast({ title: 'Productos cargados', description: 'Se agregaron todos los productos de la factura.' });
                           }}
                           className="h-7 text-[10px] font-bold text-indigo-600 border-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg"
                         >
                           + Cargar Todos
                         </Button>
                       </div>

                       <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                         {selectedSaleInfo.items.map((prod: any, idx: number) => {
                           const isAdded = adjustmentForm.items.some(i => i.sku === prod.sku || i.id === prod.id);
                           return (
                             <div key={idx} className="p-2 bg-white/70 dark:bg-black/40 border border-slate-200/80 dark:border-white/5 rounded-lg flex items-center justify-between text-xs">
                               <div className="flex flex-col">
                                 <span className="font-bold text-slate-800 dark:text-white/90">{prod.name}</span>
                                 <span className="text-[10px] text-slate-500 dark:text-white/40 font-mono">SKU: {prod.sku} • {prod.quantity}x a ${Number(prod.price).toFixed(2)}</span>
                               </div>
                               <Button
                                 size="sm"
                                 type="button"
                                 variant={isAdded ? "secondary" : "default"}
                                 onClick={() => {
                                   if (isAdded) {
                                     setAdjustmentForm(prev => ({
                                       ...prev,
                                       items: prev.items.filter(i => i.sku !== prod.sku && i.id !== prod.id)
                                     }));
                                   } else {
                                     setAdjustmentForm(prev => ({
                                       ...prev,
                                       items: [...prev.items, prod]
                                     }));
                                   }
                                 }}
                                 className={`h-7 px-2.5 text-[10px] font-bold rounded-lg ${isAdded ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
                               >
                                 {isAdded ? '✓ Agregado' : '+ Devolver'}
                               </Button>
                             </div>
                           );
                         })}
                       </div>
                     </div>
                   )}

                   <div className="space-y-1.5">
                      <Label className="text-[10px] font-medium uppercase text-slate-500 dark:text-white/30 tracking-wider">Motivo del Ajuste / Devolución</Label>
                      <Select 
                        value={adjustmentForm.reason} 
                        onValueChange={(val) => setAdjustmentForm({...adjustmentForm, reason: val})}
                      >
                        <SelectTrigger className="h-10 rounded-[10px] bg-white/50 dark:bg-black/20 border-slate-200 dark:border-white/10 text-xs font-medium text-slate-800 dark:text-white/70">
                          <SelectValue placeholder="Seleccione el motivo de la Nota de Crédito/Débito" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl dark:bg-[#0a0a14] dark:border-white/10">
                          {adjustmentType === 'CREDITO' ? (
                            <>
                              <SelectItem value="Devoluciones de mercancías (Cliente retorna producto)">Devoluciones de mercancías</SelectItem>
                              <SelectItem value="Anulación o Invalidación fuera de tiempo legal">Anulaciones o Invalidadas fuera de tiempo</SelectItem>
                              <SelectItem value="Descuentos o bonificaciones post-venta concedidos">Descuentos o bonificaciones post-venta</SelectItem>
                              <SelectItem value="Corrección de errores a la baja (Precio o cantidad menor)">Corrección de errores (A la baja)</SelectItem>
                            </>
                          ) : (
                            <>
                              <SelectItem value="Intereses por mora (Cargos financieros por atraso)">Intereses por mora</SelectItem>
                              <SelectItem value="Gastos de transporte o fletes adicionales cobrados a posteriori">Gastos de transporte o fletes adicionales</SelectItem>
                              <SelectItem value="Diferencias de precio al alza (Precio cobrado fue menor al real)">Diferencias de precio (Al alza)</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                   </div>
                </div>
                <form onSubmit={handleSearchInventory} className="relative z-10 flex gap-3">
                    <div className="relative flex-1">
                       <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/30" size={16} />
                       <Input 
                         placeholder={`Buscar conceptos para ${adjustmentType === 'CREDITO' ? 'devolución' : 'cargo'} (Presione Enter)...`} 
                         value={searchTerm} 
                         onChange={e => {
                           setSearchTerm(e.target.value);
                           if (!e.target.value) setInventory([]);
                         }} 
                         className="pl-11 h-[48px] bg-white/40 dark:bg-white/5 backdrop-blur-md border-slate-200 dark:border-white/10 shadow-sm dark:shadow-none rounded-[10px] text-xs font-medium text-slate-800 dark:text-white/70 focus-visible:ring-rose-500" 
                       />
                       {inventory.length > 0 && searchTerm.trim() !== "" && (
                         <div className="absolute left-0 right-0 mt-2 bg-white dark:bg-[#0a0a14] border border-slate-200 dark:border-white/10 shadow-2xl z-50 max-h-64 overflow-y-auto no-scrollbar rounded-2xl p-1">
                           {inventory.map((p) => (
                             <div 
                               key={p.id} 
                               onClick={() => {
                                 addAdjustmentItem(p);
                                 setSearchTerm('');
                                 setInventory([]);
                               }}
                               className="p-3 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer rounded-xl border-b last:border-none border-slate-100 dark:border-white/5 flex justify-between items-center transition-colors"
                             >
                               <div className="flex flex-col gap-0.5">
                                 <span className="text-xs font-bold text-slate-800 dark:text-white/80">{p.name}</span>
                                 <span className="text-[9px] text-slate-500 dark:text-white/40 font-mono">SKU: {p.sku} {p.category ? `• Ref: ${p.category}` : ''} • Stock: {p.quantity}</span>
                               </div>
                               <span className="text-xs font-bold text-rose-600 dark:text-rose-400">${p.price.toFixed(2)}</span>
                             </div>
                           ))}
                         </div>
                       )}
                    </div>
                    <button type="submit" className={`h-[48px] border font-semibold rounded-[10px] shadow-none px-6 transition-colors flex items-center gap-2 whitespace-nowrap text-[13px] shrink-0 ${adjustmentType === 'CREDITO' ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 border-rose-500/30' : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 border-amber-500/30'}`}>
                       <Search size={15} /> Buscar
                    </button>
                </form>
             </div>
          </TabsContent>

           {/* TAB HISTORIAL */}
          <TabsContent value="historial" className="outline-none">
            <div className="bg-white/40 dark:bg-white/5 backdrop-blur-md border border-white/50 dark:border-white/10 rounded-[13px] overflow-hidden shadow-sm dark:shadow-none">
              
              {/* Barra de Filtros de Historial */}
              <div className="p-4 border-b border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-black/20 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold text-slate-500 dark:text-white/30 uppercase tracking-wider mb-0.5">Historial de Ventas por Jornada</p>
                  <p className="text-[11px] text-slate-600 dark:text-white/60">
                    {historialFilter === 'active_shift' 
                      ? '⚡ Mostrando únicamente ventas de la jornada activa en curso (Limpia a $0.00 tras cierre)' 
                      : historialFilter === 'all' 
                      ? '📚 Mostrando el historial completo de ventas registradas' 
                      : `📅 Mostrando ventas registradas el fecha: ${historialCustomDate}`}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant={historialFilter === 'active_shift' ? 'default' : 'outline'}
                    onClick={() => setHistorialFilter('active_shift')}
                    className="h-8 text-xs font-bold gap-1 rounded-xl"
                  >
                    <Clock size={13} /> Jornada Activa ({activeShiftSales.length})
                  </Button>

                  <Button
                    size="sm"
                    variant={historialFilter === 'all' ? 'default' : 'outline'}
                    onClick={() => setHistorialFilter('all')}
                    className="h-8 text-xs font-bold gap-1 rounded-xl"
                  >
                    <BookOpen size={13} /> Histórico Completo ({salesAll?.length || 0})
                  </Button>

                  <div className="flex items-center gap-1.5 border border-slate-200 dark:border-white/10 px-2 py-1 rounded-xl bg-background shadow-sm">
                    <span className="text-[10px] font-bold text-slate-400">Filtrar Día:</span>
                    <Input
                      type="date"
                      value={historialCustomDate}
                      onChange={e => {
                        setHistorialCustomDate(e.target.value);
                        if (e.target.value) setHistorialFilter('custom');
                      }}
                      className="h-6 text-xs w-36 border-none focus-visible:ring-0 p-0"
                    />
                    {historialFilter === 'custom' && (
                      <Button size="icon" variant="ghost" className="h-5 w-5 text-slate-400 hover:text-white" onClick={() => { setHistorialFilter('active_shift'); setHistorialCustomDate(''); }}>
                        <X size={12} />
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <Table>
                <TableHeader className="bg-slate-100/50 dark:bg-transparent">
                  <TableRow className="border-b border-slate-200 dark:border-white/5 hover:bg-transparent">
                    <TableHead className="px-6 text-[10px] font-medium uppercase text-slate-500 dark:text-white/40 tracking-wide">Hora</TableHead>
                    <TableHead className="text-[10px] font-medium uppercase text-slate-500 dark:text-white/40 tracking-wide">Tipo</TableHead>
                    <TableHead className="text-[10px] font-medium uppercase text-slate-500 dark:text-white/40 tracking-wide">Cliente</TableHead>
                    <TableHead className="text-[10px] font-medium uppercase text-slate-500 dark:text-white/40 tracking-wide">Forma Pago</TableHead>
                    <TableHead className="text-right text-[10px] font-medium uppercase text-slate-500 dark:text-white/40 tracking-wide">Total</TableHead>
                    <TableHead className="text-center text-[10px] font-medium uppercase text-slate-500 dark:text-white/40 tracking-wide">Estado</TableHead>
                    <TableHead className="text-center text-[10px] font-medium uppercase text-slate-500 dark:text-white/40 tracking-wide">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedSalesHistory?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10 text-slate-400 text-xs font-bold">
                        No hay ventas registradas para el filtro seleccionado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayedSalesHistory?.map((sale: any) => (
                    <TableRow 
                      key={sale.id} 
                      className="cursor-pointer hover:bg-slate-50/50 dark:hover:bg-white/5 select-none transition-colors border-b border-slate-100 dark:border-white/5"
                      onDoubleClick={() => handleFetchSaleDetails(sale)}
                    >
                      <TableCell className="px-6 text-[11px] text-slate-600 dark:text-white/60 font-mono">{new Date(sale.timestamp).toLocaleTimeString()}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[9px] border-slate-200 dark:border-white/10 dark:text-white/70">{sale.docType}</Badge></TableCell>
                      <TableCell className="font-medium text-[12px] text-slate-800 dark:text-white/80">{sale.customer}</TableCell>
                      <TableCell className="font-medium text-[11px] text-slate-600 dark:text-white/60">{sale.paymentMethod || 'Efectivo'}</TableCell>
                      <TableCell className="text-right font-bold text-[12px] text-slate-800 dark:text-white/90">${sale.total.toFixed(2)}</TableCell>
                      <TableCell className="text-center"><Badge className={`text-[9px] uppercase tracking-wider ${sale.status === 'CANCELADA' ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 border-rose-200 dark:border-rose-500/20' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'}`}>{sale.status}</Badge></TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            title="Corregir y Re-emitir DTE"
                            className="h-8 w-8 text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCorrectAndReissueSale(sale);
                            }}
                          >
                            <RefreshCw size={13} />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            title="Duplicar Venta en Carrito"
                            className="h-8 w-8 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDuplicateSale(sale);
                            }}
                          >
                            <Copy size={13} />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            title="Ver Detalles"
                            className="h-8 w-8 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleFetchSaleDetails(sale);
                            }}
                          >
                            <Eye size={14} />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            title="Enviar DTE por Correo (Simulación)"
                            className="h-8 w-8 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEmailSimulatorForSale(sale);
                            }}
                          >
                            <Mail size={14} />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            title="Invalidar / Anular DTE"
                            disabled={sale.status === 'CANCELADA'}
                            className="h-8 w-8 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950 disabled:opacity-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleInvalidateSale(sale);
                            }}
                          >
                            <Ban size={14} />
                          </Button>
                          {isUserAdmin && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              title="Corregir Método de Pago"
                              disabled={sale.status === 'CANCELADA'}
                              className="h-8 w-8 text-amber-500 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950 disabled:opacity-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingPaymentSale(sale);
                                setNewPaymentMethod(sale.paymentMethod);
                                setIsPaymentCorrectionOpen(true);
                              }}
                            >
                              <CardIcon size={14} />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )))}
                </TableBody>
              </Table>
            </div>

            <Dialog open={isPaymentCorrectionOpen} onOpenChange={setIsPaymentCorrectionOpen}>
              <DialogContent className="max-w-md rounded-2xl border shadow-xl">
                <DialogHeader>
                  <DialogTitle className="text-lg font-black tracking-tight text-foreground">
                    Corregir Método de Pago
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Se registrará una reversión y un ajuste contable en el libro diario para {editingPaymentSale?.correlative}.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Método de Pago Actual</Label>
                    <p className="font-semibold">{editingPaymentSale?.paymentMethod}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Nuevo Método de Pago</Label>
                    <Select value={newPaymentMethod} onValueChange={setNewPaymentMethod}>
                      <SelectTrigger className="w-full h-12 rounded-xl bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-sm">
                        <SelectValue placeholder="Seleccione método de pago" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-slate-200 dark:border-white/10 shadow-xl">
                        <SelectItem value="Efectivo" className="text-sm rounded-lg my-1">💵 Efectivo</SelectItem>
                        <SelectItem value="Tarjeta" className="text-sm rounded-lg my-1">💳 Tarjeta (POS)</SelectItem>
                        <SelectItem value="Transferencia" className="text-sm rounded-lg my-1">🏦 Transferencia / Bitcoin</SelectItem>
                        <SelectItem value="Credito" className="text-sm rounded-lg my-1">📝 Crédito / Cuenta por Cobrar</SelectItem>
                        <SelectItem value="Cheque" className="text-sm rounded-lg my-1">🧾 Cheque</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter className="border-t border-slate-100 dark:border-white/10 pt-4 flex gap-2">
                  <Button variant="outline" className="rounded-xl flex-1" onClick={() => setIsPaymentCorrectionOpen(false)}>Cancelar</Button>
                  <Button className="rounded-xl flex-1 bg-amber-500 hover:bg-amber-600 text-white" onClick={handleCorrectPaymentMethod}>Aplicar Corrección</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
              <DialogContent className="max-w-2xl rounded-2xl border shadow-xl flex flex-col gap-4 overflow-hidden max-h-[90vh]">
                <DialogHeader>
                  <DialogTitle className="text-lg font-black tracking-tight text-foreground flex items-center justify-between">
                    <span>Detalle de Facturación</span>
                    {selectedSaleDetails && (
                      <Badge className="font-mono bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 text-[10px] font-bold">
                        {selectedSaleDetails.correlative}
                      </Badge>
                    )}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Detalles completos del documento emitido.
                  </DialogDescription>
                </DialogHeader>

                {loadingDetails ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <Loader2 className="animate-spin text-primary" size={24} />
                    <p className="text-xs text-muted-foreground">Obteniendo productos de la venta...</p>
                  </div>
                ) : selectedSaleDetails ? (
                  <div className="flex-1 overflow-y-auto pr-2 space-y-5" id="printable-sale-area">
                    {/* Header info */}
                    <div className="grid grid-cols-2 gap-4 p-4 border rounded-2xl bg-muted/30">
                      <div className="space-y-1">
                        <span className="text-[9px] font-black uppercase text-muted-foreground tracking-wider">Cliente</span>
                        <p className="text-xs font-black text-foreground">{selectedSaleDetails.customer}</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] font-black uppercase text-muted-foreground tracking-wider">Fecha / Hora</span>
                        <p className="text-xs font-semibold text-foreground">{new Date(selectedSaleDetails.timestamp).toLocaleString()}</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] font-black uppercase text-muted-foreground tracking-wider">Forma de Pago</span>
                        <p className="text-xs font-semibold text-foreground">{selectedSaleDetails.paymentMethod}</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] font-black uppercase text-muted-foreground tracking-wider">Tipo Documento</span>
                        <p className="text-xs font-semibold text-foreground">{selectedSaleDetails.docType === 'CF' ? 'Factura de Consumo Final' : 'Comprobante de Crédito Fiscal'}</p>
                      </div>
                    </div>

                    {/* Products list */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider px-1">Productos Facturados</span>
                      <Card className="rounded-2xl border overflow-hidden">
                        <Table>
                          <TableHeader className="bg-muted/40">
                            <TableRow>
                              <TableHead className="text-[10px] font-bold">Producto / SKU</TableHead>
                              <TableHead className="text-center text-[10px] font-bold">Cant.</TableHead>
                              <TableHead className="text-right text-[10px] font-bold">P. Unitario</TableHead>
                              <TableHead className="text-right text-[10px] font-bold pr-4">Subtotal</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                             {selectedSaleDetails.items?.map((item: any) => (
                               <TableRow key={item.id}>
                                <TableCell className="py-2.5">
                                  <p className="text-xs font-bold text-foreground">{item.name || 'Producto General'}</p>
                                  <p className="text-[9px] font-mono text-muted-foreground">{item.sku}</p>
                                </TableCell>
                                <TableCell className="text-center text-xs font-black py-2.5">{item.quantity}</TableCell>
                                <TableCell className="text-right text-xs font-semibold py-2.5">${(parseFloat(item.price) || 0).toFixed(2)}</TableCell>
                                <TableCell className="text-right text-xs font-black text-indigo-600 dark:text-indigo-400 py-2.5 pr-4">
                                  ${((parseFloat(item.price) || 0) * item.quantity).toFixed(2)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </Card>
                    </div>

                    {/* Total balance info */}
                    <div className="flex justify-between items-center p-4 rounded-2xl bg-indigo-550/5 border border-indigo-500/10">
                      <div>
                        <span className="text-[9px] font-black uppercase text-indigo-500 dark:text-indigo-400 tracking-wider">Total Transacción</span>
                        <p className="text-xs text-muted-foreground">Impuestos incluidos</p>
                      </div>
                      <p className="text-xl font-black text-indigo-600 dark:text-indigo-400">
                        ${selectedSaleDetails.total.toFixed(2)}
                      </p>
                    </div>
                  </div>
                ) : null}

                <DialogFooter className="border-t border-white/10 pt-3 flex items-center justify-between sm:justify-between gap-3">
                  <Button 
                    variant="outline" 
                    className="rounded-xl h-10 text-xs font-bold" 
                    onClick={() => setIsDetailsDialogOpen(false)}
                  >
                    Cerrar
                  </Button>
                  {selectedSaleDetails && (
                    <div className="flex items-center gap-2">
                    <Button 
                      className="rounded-xl h-10 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
                      onClick={() => {
                        const printWindow = window.open('', '_blank');
                        if (printWindow && selectedSaleDetails) {
                          const correlative = selectedSaleDetails.correlative || 'N/A';
                          const customer = selectedSaleDetails.customer || 'Consumidor Final';
                          const docType = selectedSaleDetails.docType === 'CF' ? 'Factura CF' : 'Crédito Fiscal';
                          const paymentMethod = selectedSaleDetails.paymentMethod || 'Efectivo';
                          const totalAmt = (selectedSaleDetails.total || 0).toFixed(2);
                          
                          let timestampStr = 'N/A';
                          try {
                            if (selectedSaleDetails.timestamp) {
                              timestampStr = new Date(selectedSaleDetails.timestamp).toLocaleString();
                            } else {
                              timestampStr = new Date().toLocaleString();
                            }
                          } catch (e) {
                            timestampStr = new Date().toLocaleString();
                          }

                          printWindow.document.write(`
                            <html>
                              <head>
                                <title>NexWay - Factura ${correlative}</title>
                                <style>
                                  body { font-family: system-ui, sans-serif; padding: 40px; color: #333; }
                                  .header { border-bottom: 2px solid #3f51b5; padding-bottom: 20px; margin-bottom: 20px; }
                                  .title { font-size: 24px; font-weight: bold; margin: 0; }
                                  .meta { display: grid; grid-template-cols: 1fr 1fr; gap: 15px; margin-bottom: 30px; background: #f5f5f5; padding: 15px; border-radius: 10px; }
                                  table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                                  th, td { text-align: left; padding: 10px; border-bottom: 1px solid #ddd; }
                                  th { background: #f0f0f0; font-size: 12px; text-transform: uppercase; }
                                  .total { text-align: right; font-size: 20px; font-weight: bold; color: #3f51b5; padding: 15px; background: #e8eaf6; border-radius: 10px; }
                                </style>
                              </head>
                              <body>
                                <div class="header">
                                  <p class="title">NexWay ERP - Comprobante de Venta</p>
                                  <p style="font-family:monospace; margin:5px 0 0 0;">Correlativo: ${correlative}</p>
                                </div>
                                <div class="meta">
                                  <div><strong>Cliente:</strong> ${customer}</div>
                                  <div><strong>Fecha:</strong> ${timestampStr}</div>
                                  <div><strong>Forma de Pago:</strong> ${paymentMethod}</div>
                                  <div><strong>Documento:</strong> ${docType}</div>
                                </div>
                                <table>
                                  <thead>
                                    <tr>
                                      <th>Producto</th>
                                      <th>Cant.</th>
                                      <th>P. Unitario</th>
                                      <th style="text-align: right;">Subtotal</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    ${(selectedSaleDetails.items || []).map((item: any) => `
                                      <tr>
                                        <td>${item.name || 'Producto General'}<br><small style="font-family:monospace; color:#666">${item.sku}</small></td>
                                        <td>${item.quantity || 0}</td>
                                        <td>$${(parseFloat(item.price) || 0).toFixed(2)}</td>
                                        <td style="text-align: right; font-weight:bold;">$${((parseFloat(item.price) || 0) * (item.quantity || 0)).toFixed(2)}</td>
                                      </tr>
                                    `).join('')}
                                  </tbody>
                                </table>
                                <div class="total">
                                  Total a Pagar: $${totalAmt}
                                </div>
                                <script>
                                  window.onload = function() {
                                    window.print();
                                    setTimeout(function() { window.close(); }, 500);
                                  }
                                </script>
                              </body>
                            </html>
                          `);
                          printWindow.document.close();
                        }
                      }}
                    >
                      <Printer size={14} className="mr-2" />
                      Imprimir / PDF
                    </Button>
                    <Button 
                      className="rounded-xl h-10 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => {
                        setIsDetailsDialogOpen(false);
                        handleOpenEmailSimulatorForSale(selectedSaleDetails);
                      }}
                    >
                      <Mail size={14} className="mr-2" />
                      Enviar por Correo (DTE)
                    </Button>
                    </div>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* TAB ARQUEO — Flujo Simple en 4 Pasos */}
          <TabsContent value="arqueo" className="space-y-5 outline-none">
            {/* Barra Superior: Fecha, Cierres Anteriores y Herramientas */}
            <div className="p-4 bg-card border border-border rounded-2xl flex flex-wrap justify-between items-center gap-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-500/15 rounded-xl text-indigo-500">
                  <Clock size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-foreground uppercase tracking-tight">
                    {selectedPastClosure ? `Cierre Histórico: ${selectedPastClosure.date}` : 'Cierre de Caja del Día'}
                  </h3>
                  <p className="text-xs text-muted-foreground capitalize">
                    {selectedPastClosure
                      ? `Cerrado por: ${selectedPastClosure.closed_by || 'Cajero'} · Recaudación: $${((selectedPastClosure.physical_cash_found || 0) - (selectedPastClosure.cash_float || 0)).toFixed(2)}`
                      : formattedTodayDate}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {pastDailyClosings.length > 0 && (
                  <Select
                    value={selectedPastClosure ? selectedPastClosure.id : 'active'}
                    onValueChange={(val) => {
                      if (val === 'active') {
                        setSelectedPastClosure(null);
                      } else {
                        const found = pastDailyClosings.find(c => c.id === val);
                        setSelectedPastClosure(found || null);
                      }
                    }}
                  >
                    <SelectTrigger className="w-52 h-9 text-xs font-bold rounded-xl">
                      <SelectValue placeholder="Ver Cierre Anterior" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active" className="text-xs font-bold text-emerald-500">
                        ⚡ Jornada Activa (Hoy)
                      </SelectItem>
                      {pastDailyClosings.map(c => (
                        <SelectItem key={c.id} value={c.id} className="text-xs">
                          📜 Cierre {c.date} ($${((c.physical_cash_found || 0) - (c.cash_float || 0)).toFixed(2)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <Button variant="outline" size="sm" className="h-9 rounded-xl text-xs font-bold gap-1.5" onClick={handleSaveArqueoDraft}>
                  <Save size={13} /> Guardar Borrador
                </Button>
                <Button variant="outline" size="sm" className="h-9 rounded-xl text-xs font-bold gap-1.5" onClick={handlePrintReport}>
                  <Printer size={13} /> Imprimir
                </Button>
                <Button variant="outline" size="sm" className="h-9 rounded-xl text-xs font-bold text-rose-500 hover:text-rose-600 gap-1.5" onClick={handleResetArqueo}>
                  <RotateCcw size={13} /> Limpiar
                </Button>
              </div>
            </div>

            {selectedPastClosure && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex justify-between items-center text-amber-600 dark:text-amber-300 text-xs font-bold">
                <span>📜 Estás viendo el cierre guardado del {selectedPastClosure.date}.</span>
                <Button size="sm" variant="outline" onClick={() => setSelectedPastClosure(null)} className="h-7 text-[11px] rounded-xl">
                  <X size={12} className="mr-1" /> Volver a Hoy
                </Button>
              </div>
            )}

            {/* FLUJO LÓGICO EN 4 PASOS CLAROS */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">

              {/* COLUMNA IZQUIERDA (PASOS 1 Y 2) */}
              <div className="lg:col-span-6 space-y-5">

                {/* PASO 1: CONTAR DINERO EN CAJA PARA EL FONDO BASE */}
                <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                  <div className="p-4 border-b border-border bg-muted/30 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center shrink-0">1</span>
                      <div>
                        <h4 className="text-sm font-black text-foreground">Fondo Base en Caja</h4>
                        <p className="text-[11px] text-muted-foreground">Dinero que se queda en caja para abrir mañana.</p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-xs font-mono font-black px-2.5 py-1 ${
                        countedBaseFloat > 0 && Math.abs(baseFloatDifference) < 0.01
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                      }`}
                    >
                      Contado: ${countedBaseFloat.toFixed(2)}
                    </Badge>
                  </div>

                  <div className="p-4 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-muted/40 border border-border">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-muted-foreground block">Fondo Base Configurado</span>
                        <span className="text-lg font-black font-mono text-indigo-600 dark:text-indigo-400">
                          ${(cashConfig?.cashFloat || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="relative w-32">
                          <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={baseFloatDirectAmount !== '' ? baseFloatDirectAmount : (baseFloatFromDenoms > 0 ? baseFloatFromDenoms.toFixed(2) : '')}
                            onFocus={e => e.target.select()}
                            onChange={e => setBaseFloatDirectAmount(e.target.value)}
                            className="h-9 pl-7 pr-2 text-right font-mono font-black text-sm rounded-xl"
                          />
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            const target = cashConfig?.cashFloat || 0;
                            setBaseFloatDenominations({
                              '100.00': 0, '50.00': 0, '20.00': 0, '10.00': 0, '5.00': 0, '1.00': 0,
                              '0.25': 0, '0.10': 0, '0.05': 0, '0.01': 0
                            });
                            setBaseFloatDirectAmount(target.toFixed(2));
                            setShowBaseDenoms(false);
                          }}
                          className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl"
                        >
                          ✓ Fondo Completo (${(cashConfig?.cashFloat || 0).toFixed(2)})
                        </Button>
                      </div>
                    </div>

                    {/* Progreso en vivo hacia el Fondo Base configurado */}
                    {(() => {
                      const targetBase = cashConfig?.cashFloat || 0;
                      const pct = targetBase > 0 ? Math.min(100, Math.round((countedBaseFloat / targetBase) * 100)) : 0;
                      const remaining = Number((targetBase - countedBaseFloat).toFixed(2));
                      return (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-muted-foreground">
                              Acumulado: <span className="font-mono text-foreground">${countedBaseFloat.toFixed(2)}</span> / <span className="font-mono">${targetBase.toFixed(2)}</span>
                            </span>
                            {targetBase > 0 && (
                              Math.abs(remaining) < 0.01 ? (
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">✓ Fondo Base completo</span>
                              ) : remaining > 0 ? (
                                <span className="font-bold text-amber-600 dark:text-amber-400">Faltan ${remaining.toFixed(2)} para completar base</span>
                              ) : (
                                <span className="font-bold text-blue-600 dark:text-blue-400">+${Math.abs(remaining).toFixed(2)} sobre el fondo base</span>
                              )
                            )}
                          </div>
                          {targetBase > 0 && (
                            <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                              <div
                                className={`h-full transition-all duration-300 ${
                                  Math.abs(remaining) < 0.01
                                    ? 'bg-emerald-500'
                                    : remaining < 0
                                    ? 'bg-blue-500'
                                    : 'bg-indigo-500'
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setShowBaseDenoms(prev => !prev)}
                        className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                      >
                        <Coins size={13} />
                        {showBaseDenoms ? 'Ocultar detalle por billetes/monedas' : 'Contar Fondo Base por billetes y monedas'}
                      </button>
                    </div>

                    {showBaseDenoms && (
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                        {['100.00', '50.00', '20.00', '10.00', '5.00', '1.00', '0.25', '0.10', '0.05', '0.01'].map(den => {
                          const qty = baseFloatDenominations[den] || 0;
                          const denSubtotal = parseFloat(den) * qty;
                          return (
                            <div key={`base-${den}`} className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-colors ${qty > 0 ? 'bg-indigo-500/10 border-indigo-500/35' : 'bg-muted/40 border-border'}`}>
                              <span className="text-[10px] font-black text-foreground">
                                {parseFloat(den) >= 1 ? `$${parseInt(den)}` : `¢${Math.round(parseFloat(den) * 100)}`}
                              </span>
                              <div className="flex items-center gap-1">
                                <button type="button" onClick={() => adjustBaseDenomination(den, -1)} className="w-5 h-5 rounded bg-background border text-xs font-bold">-</button>
                                <Input
                                  type="number"
                                  value={qty || ''}
                                  placeholder="0"
                                  onFocus={e => e.target.select()}
                                  onChange={e => {
                                    setBaseFloatDirectAmount('');
                                    setBaseFloatDenominations({ ...baseFloatDenominations, [den]: Math.max(0, parseInt(e.target.value) || 0) });
                                  }}
                                  className="h-6 w-10 text-center font-bold text-xs p-0 rounded-md"
                                />
                                <button type="button" onClick={() => adjustBaseDenomination(den, 1)} className="w-5 h-5 rounded bg-background border text-xs font-bold">+</button>
                              </div>
                              <span className={`text-[10px] font-mono font-bold ${qty > 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-muted-foreground'}`}>
                                ${denSubtotal.toFixed(2)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* PASO 3: VERIFICAR TARJETAS Y DEMÁS FORMAS DE PAGO */}
                <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                  <div className="p-4 border-b border-border bg-muted/30 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-black flex items-center justify-center shrink-0">3</span>
                      <div>
                        <h4 className="text-sm font-black text-foreground">Tarjetas y Demás Formas de Pago</h4>
                        <p className="text-[11px] text-muted-foreground">Verifica tus vouchers de POS, transferencias, cheques y créditos.</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAiBmsAutoSync}
                      className="h-8 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl gap-1"
                    >
                      <CheckCircle2 size={13} /> Verificar Todo Exacto
                    </Button>
                  </div>

                  <div className="p-0">
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow>
                          <TableHead className="text-[10px] uppercase font-black px-4 py-2.5">Forma de Pago</TableHead>
                          <TableHead className="text-right text-[10px] uppercase font-black py-2.5">Sistema</TableHead>
                          <TableHead className="text-right text-[10px] uppercase font-black w-32 py-2.5">Verificado ($)</TableHead>
                          <TableHead className="text-right text-[10px] uppercase font-black px-4 py-2.5">Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[
                          { label: 'Tarjeta (POS)', icon: <CardIcon size={14} className="text-blue-500" />, sys: systemCardSales, val: physicalCard, set: setPhysicalCard, diff: cardDifference },
                          { label: 'Transferencia', icon: <Landmark size={14} className="text-amber-500" />, sys: systemTransferSales, val: physicalTransfer, set: setPhysicalTransfer, diff: transferDifference },
                          { label: 'Cheque', icon: <FileText size={14} className="text-purple-500" />, sys: systemCheckSales, val: physicalCheck, set: setPhysicalCheck, diff: checkDifference },
                          { label: 'Crédito', icon: <Receipt size={14} className="text-teal-500" />, sys: systemCreditSales, val: physicalCredit, set: setPhysicalCredit, diff: creditDifference },
                        ].map((row) => (
                          <TableRow key={row.label} className="border-b border-border/60">
                            <TableCell className="font-bold text-xs px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                {row.icon}
                                <span>{row.label}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold text-xs text-muted-foreground">
                              ${row.sys.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right py-2">
                              <div className="flex items-center justify-end gap-1">
                                <Input
                                  type="number"
                                  step="0.01"
                                  className="h-8 w-24 text-right font-mono font-bold text-xs rounded-lg"
                                  value={row.val || ''}
                                  placeholder="0.00"
                                  onFocus={e => e.target.select()}
                                  onChange={e => row.set(parseFloat(e.target.value) || 0)}
                                />
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  title="Confirmar igual al sistema"
                                  onClick={() => row.set(row.sys)}
                                  className="h-8 px-1.5 text-[10px] font-black text-emerald-600 hover:bg-emerald-500/10 rounded-lg"
                                >
                                  ✓
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell className="text-right px-4">
                              <span className={`font-mono font-black text-xs ${Math.abs(row.diff) < 0.01 ? 'text-emerald-600 dark:text-emerald-400' : row.diff < 0 ? 'text-rose-500' : 'text-blue-500'}`}>
                                {Math.abs(row.diff) < 0.01 ? '✓ OK' : `${row.diff > 0 ? '+' : ''}$${row.diff.toFixed(2)}`}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Gastos Menores Opcional (Colapsable) */}
                  <div className="p-3 border-t border-border bg-muted/20">
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setShowExpensesBox(prev => !prev)}
                        className="text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-1.5"
                      >
                        <TrendingDown size={14} className="text-rose-500" />
                        Gastos Menores de Caja ({expenses.length}){totalExpenses > 0 ? ` · -$${totalExpenses.toFixed(2)}` : ' · Opcional'}
                      </button>
                      <span className="text-[10px] text-muted-foreground">{showExpensesBox ? 'Ocultar ▲' : 'Agregar ▼'}</span>
                    </div>

                    {showExpensesBox && (
                      <div className="mt-3 space-y-2.5">
                        <div className="flex gap-2">
                          <Input
                            placeholder="Ej: Compra de agua, combustible..."
                            value={expenseDesc}
                            onChange={e => setExpenseDesc(e.target.value)}
                            className="h-9 text-xs rounded-xl"
                          />
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={expenseAmount}
                            onChange={e => setExpenseAmount(e.target.value)}
                            className="h-9 w-24 text-xs font-mono font-bold text-rose-500 rounded-xl"
                          />
                          <Button type="button" onClick={addExpense} size="sm" className="h-9 rounded-xl font-bold text-xs">
                            <Plus size={14} />
                          </Button>
                        </div>
                        {expenses.length > 0 && (
                          <div className="space-y-1">
                            {expenses.map((exp, idx) => (
                              <div key={idx} className="flex justify-between items-center text-xs px-2.5 py-1.5 rounded-lg bg-background border border-border">
                                <span className="font-semibold">{exp.description}</span>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-black text-rose-500">-${exp.amount.toFixed(2)}</span>
                                  <button
                                    type="button"
                                    onClick={() => setExpenses(prev => prev.filter((_, i) => i !== idx))}
                                    className="text-muted-foreground hover:text-rose-500"
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* COLUMNA DERECHA (PASOS 3 Y 4) */}
              <div className="lg:col-span-6 space-y-5">

                {/* PASO 2: CONTAR DINERO PARA LA ENTREGA DE EFECTIVO */}
                <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                  <div className="p-4 border-b border-border bg-muted/30 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-full bg-emerald-600 text-white text-xs font-black flex items-center justify-center shrink-0">2</span>
                      <div>
                        <h4 className="text-sm font-black text-foreground">Dinero para Entrega de Efectivo</h4>
                        <p className="text-[11px] text-muted-foreground">Cuenta los billetes y monedas que vas a entregar (aparte del fondo base).</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono font-black text-xs px-2.5 py-1">
                      Entrega: ${countedDeliveryCash.toFixed(2)}
                    </Badge>
                  </div>

                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Billetes */}
                    <div className="space-y-2">
                      <h5 className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider">Billetes</h5>
                      {['100.00', '50.00', '20.00', '10.00', '5.00'].map(den => {
                        const qty = cashDenominations[den] || 0;
                        const subtotal = parseFloat(den) * qty;
                        return (
                          <div key={den} className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-muted/30 border border-border">
                            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 w-10">${parseInt(den)}</span>
                            <div className="flex items-center gap-1">
                              <Button type="button" variant="ghost" size="icon" className="h-6 w-6 rounded-md font-bold" onClick={() => adjustDenomination(den, -1)}>-</Button>
                              <Input
                                type="number"
                                className="h-7 w-12 text-center font-mono font-black text-xs p-0 rounded-lg"
                                value={qty || ''}
                                placeholder="0"
                                onFocus={e => e.target.select()}
                                onChange={e => setCashDenominations({ ...cashDenominations, [den]: Math.max(0, parseInt(e.target.value) || 0) })}
                              />
                              <Button type="button" variant="ghost" size="icon" className="h-6 w-6 rounded-md font-bold" onClick={() => adjustDenomination(den, 1)}>+</Button>
                            </div>
                            <span className="text-xs font-mono font-bold text-right w-16">${subtotal.toFixed(2)}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Monedas */}
                    <div className="space-y-2">
                      <h5 className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-wider">Monedas</h5>
                      {['1.00', '0.25', '0.10', '0.05', '0.01'].map(den => {
                        const qty = cashDenominations[den] || 0;
                        const subtotal = parseFloat(den) * qty;
                        return (
                          <div key={den} className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-muted/30 border border-border">
                            <span className="text-xs font-black text-amber-600 dark:text-amber-400 w-10">
                              {parseFloat(den) >= 1 ? '$1' : `¢${Math.round(parseFloat(den) * 100)}`}
                            </span>
                            <div className="flex items-center gap-1">
                              <Button type="button" variant="ghost" size="icon" className="h-6 w-6 rounded-md font-bold" onClick={() => adjustDenomination(den, -1)}>-</Button>
                              <Input
                                type="number"
                                className="h-7 w-12 text-center font-mono font-black text-xs p-0 rounded-lg"
                                value={qty || ''}
                                placeholder="0"
                                onFocus={e => e.target.select()}
                                onChange={e => setCashDenominations({ ...cashDenominations, [den]: Math.max(0, parseInt(e.target.value) || 0) })}
                              />
                              <Button type="button" variant="ghost" size="icon" className="h-6 w-6 rounded-md font-bold" onClick={() => adjustDenomination(den, 1)}>+</Button>
                            </div>
                            <span className="text-xs font-mono font-bold text-right w-16">${subtotal.toFixed(2)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Resumen de Entrega */}
                  <div className="px-4 py-3 border-t border-border bg-muted/30 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">Esperado Sistema</span>
                      <span className="text-sm font-mono font-black text-foreground">${expectedDeliveryCash.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">Contado Entrega</span>
                      <span className="text-sm font-mono font-black text-emerald-600 dark:text-emerald-400">${countedDeliveryCash.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">Diferencia</span>
                      <span className={`text-sm font-mono font-black ${
                        Math.abs(deliveryCashDifference) < 0.01
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : deliveryCashDifference > 0
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-rose-500'
                      }`}>
                        {Math.abs(deliveryCashDifference) < 0.01
                          ? '✓ $0.00'
                          : `${deliveryCashDifference > 0 ? '+' : '-'}$${Math.abs(deliveryCashDifference).toFixed(2)}`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* PASO 4: VALIDAR CUADRE Y CERRAR EL DÍA */}
                <div className="bg-card border-2 border-indigo-500/30 rounded-2xl overflow-hidden shadow-md">
                  <div className="p-4 border-b border-border bg-indigo-500/5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-full bg-amber-500 text-slate-950 text-xs font-black flex items-center justify-center shrink-0">4</span>
                      <div>
                        <h4 className="text-sm font-black text-foreground">Validar Cuadre y Cerrar el Día</h4>
                        <p className="text-[11px] text-muted-foreground">Revisa el resultado final, anota si hay sobrante/faltante y cierra.</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 space-y-4">
                    {/* Resumen Consolidado */}
                    <div className="grid grid-cols-3 gap-2.5 text-xs">
                      <div className="p-2.5 rounded-xl bg-muted/40 border border-border">
                        <span className="text-[10px] text-muted-foreground block">1. Fondo Base</span>
                        <span className="font-mono font-black text-sm">${countedBaseFloat.toFixed(2)}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                        <span className="text-[10px] text-emerald-700 dark:text-emerald-300 block">2. Entrega Efectivo</span>
                        <span className="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400">${countedDeliveryCash.toFixed(2)}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-muted/40 border border-border">
                        <span className="text-[10px] text-muted-foreground block">3. Tarjetas / Otros</span>
                        <span className="font-mono font-black text-sm">${(physicalCard + physicalTransfer + physicalCheck + physicalCredit).toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Estado del Cuadre (Bueno / Sobrante / Faltante) */}
                    <div className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                      Math.abs(cashDifference) < 0.01 && Math.abs(cardDifference) < 0.01 && Math.abs(transferDifference) < 0.01 && Math.abs(checkDifference) < 0.01
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                        : cashDifference > 0
                        ? 'bg-blue-500/10 border-blue-500/40 text-blue-700 dark:text-blue-300'
                        : 'bg-rose-500/10 border-rose-500/40 text-rose-700 dark:text-rose-300'
                    }`}>
                      <div className="flex items-center gap-2.5">
                        {Math.abs(cashDifference) < 0.01 ? (
                          <CheckCircle2 size={20} className="shrink-0" />
                        ) : (
                          <AlertTriangle size={20} className="shrink-0" />
                        )}
                        <div>
                          <div className="text-xs font-black uppercase">
                            {Math.abs(cashDifference) < 0.01
                              ? 'Cuadre Bueno — Caja Exacta'
                              : cashDifference > 0
                              ? `Sobrante de Efectivo: +$${cashDifference.toFixed(2)}`
                              : `Faltante de Efectivo: -$${Math.abs(cashDifference).toFixed(2)}`}
                          </div>
                          <div className="text-[11px] opacity-85">
                            Total Físico en Caja + Entrega: ${totalPhysicalCash.toFixed(2)} vs Esperado: ${((cashConfig?.cashFloat || 0) + systemCashSales - totalExpenses).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Campo directo para registrar sobrante / faltante / nota */}
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold text-muted-foreground">
                        {Math.abs(cashDifference) < 0.01
                          ? 'Observación de Cierre (Opcional)'
                          : cashDifference > 0
                          ? `Detalle del Sobrante (+$${cashDifference.toFixed(2)})`
                          : `Motivo del Faltante (-$${Math.abs(cashDifference).toFixed(2)})`}
                      </Label>
                      <Input
                        placeholder={
                          Math.abs(cashDifference) < 0.01
                            ? 'Ej: Caja cuadrada sin novedades...'
                            : cashDifference > 0
                            ? 'Ej: Sobrante registrado en caja por cambio...'
                            : 'Ej: Faltante pendiente de verificar...'
                        }
                        value={closingDifferenceNote}
                        onChange={e => setClosingDifferenceNote(e.target.value)}
                        className="h-10 text-xs rounded-xl"
                      />
                    </div>

                    {/* Botón Único de Cierre del Día */}
                    <Button
                      type="button"
                      onClick={handleDayClosing}
                      disabled={isProcessing}
                      className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-black text-sm shadow-lg shadow-emerald-600/20 gap-2"
                    >
                      {isProcessing ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={18} />}
                      {Math.abs(cashDifference) < 0.01
                        ? 'Validar de Bueno y Cerrar el Día'
                        : cashDifference > 0
                        ? `Registrar Sobrante (+$${cashDifference.toFixed(2)}) y Cerrar el Día`
                        : `Registrar Faltante (-$${Math.abs(cashDifference).toFixed(2)}) y Cerrar el Día`}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TAB CRÉDITOS / ABONOS */}
          <TabsContent value="creditos" className="space-y-6 outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Cuentas por Cobrar / Ventas al Crédito */}
              <div className="lg:col-span-8 space-y-4">
                <div className="bg-white/40 dark:bg-white/5 backdrop-blur-md border border-white/50 dark:border-white/10 rounded-[13px] overflow-hidden shadow-sm dark:shadow-none">
                  <div className="bg-card text-foreground p-5 flex flex-row items-center justify-between border-b border-border">
                    <div>
                      <h3 className="text-sm font-bold flex items-center gap-2">
                        <Wallet size={18} className="text-indigo-400" /> Cuentas por Cobrar (Créditos Activos)
                      </h3>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Consulte las ventas otorgadas al crédito y registre los abonos parciales de sus clientes.
                      </p>
                    </div>
                    <Badge variant="outline" className="border-indigo-500/30 text-indigo-400 bg-indigo-500/10 font-bold text-xs px-3 py-1">
                      Pendientes: {salesAll?.filter(s => s.paymentMethod === 'Credito' && s.status === 'PENDIENTE').length || 0}
                    </Badge>
                  </div>
                  <div className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-background border-input/40">
                          <TableRow className="border-b dark:border-border">
                            <TableHead className="text-[10px] uppercase font-black px-6 py-3 text-muted-foreground">Factura / Correlativo</TableHead>
                            <TableHead className="text-[10px] uppercase font-black py-3 text-muted-foreground">Cliente</TableHead>
                            <TableHead className="text-[10px] uppercase font-black py-3 text-muted-foreground">Fecha Venta</TableHead>
                            <TableHead className="text-right text-[10px] uppercase font-black py-3 text-muted-foreground">Total Venta</TableHead>
                            <TableHead className="text-right text-[10px] uppercase font-black py-3 text-muted-foreground">Total Abonado</TableHead>
                            <TableHead className="text-right text-[10px] uppercase font-black py-3 text-muted-foreground">Saldo Pendiente</TableHead>
                            <TableHead className="w-24 py-3 px-6"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {salesAll?.filter(s => s.paymentMethod === 'Credito' && s.status === 'PENDIENTE').length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center py-16 text-muted-foreground italic text-xs">
                                🎉 No hay créditos pendientes de pago. ¡Todas las cuentas están al día!
                              </TableCell>
                            </TableRow>
                          ) : salesAll?.filter(s => s.paymentMethod === 'Credito' && s.status === 'PENDIENTE').map(s => {
                            const totalAbonado = journalPayments
                              ?.filter(j => j.description.includes(`[${s.correlative}]`))
                              .reduce((sum, j) => sum + (parseFloat(j.amount) || 0), 0) || 0;
                            
                            const saldoPendiente = s.total - totalAbonado;

                            return (
                              <TableRow key={s.id} className="hover:bg-accent border-b border-border">
                                <TableCell className="font-mono font-bold text-xs px-6 py-4 text-foreground">
                                  {s.correlative}
                                </TableCell>
                                <TableCell className="font-bold text-xs text-foreground">
                                  {s.customer}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {new Date(s.timestamp).toLocaleDateString()}
                                </TableCell>
                                <TableCell className="text-right font-bold text-xs text-foreground">
                                  ${s.total.toFixed(2)}
                                </TableCell>
                                <TableCell className="text-right font-black text-xs text-emerald-600 dark:text-emerald-400">
                                  ${totalAbonado.toFixed(2)}
                                </TableCell>
                                <TableCell className="text-right font-black text-xs text-rose-600 dark:text-rose-400">
                                  ${saldoPendiente.toFixed(2)}
                                </TableCell>
                                <TableCell className="px-6 text-right py-3">
                                  <Button 
                                    onClick={() => {
                                      setSelectedSaleForAbono(s);
                                      setAbonoAmount('');
                                    }} 
                                    className="h-8 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] px-3 flex items-center gap-1 active:scale-95 transition-all shadow-sm shadow-indigo-500/10 border-none"
                                  >
                                    <Coins size={12} />
                                    Abonar
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              </div>

              {/* Historial de Abonos Recientes */}
              <div className="lg:col-span-4 space-y-4">
                <div className="bg-white/40 dark:bg-white/5 backdrop-blur-md border border-white/50 dark:border-white/10 rounded-[13px] overflow-hidden shadow-sm dark:shadow-none">
                  <div className="bg-card text-foreground p-4 border-b border-border flex flex-row items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold flex items-center gap-2">
                        <History size={16} className="text-emerald-400" /> Abonos Recientes
                      </h3>
                      <p className="text-[10px] text-muted-foreground mt-1">Historial de abonos registrados el día de hoy.</p>
                    </div>
                  </div>
                  <div className="p-0">
                    <ScrollArea className="h-[400px]">
                      {journalPayments.length === 0 ? (
                        <div className="text-center py-20 text-xs text-muted-foreground italic">No hay abonos registrados recientemente.</div>
                      ) : journalPayments.map(j => (
                        <div key={j.id} className="p-4 border-b border-border last:border-0 hover:bg-accent transition-all flex flex-col gap-1.5">
                          <div className="flex justify-between items-start">
                            <span className="text-[10px] font-black text-foreground line-clamp-2 pr-2">
                              {j.description}
                            </span>
                            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                              +${parseFloat(j.amount).toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-[9px] text-slate-400 dark:text-muted-foreground">
                            <span>{new Date(j.created_at).toLocaleDateString()} a las {new Date(j.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            <Badge variant="outline" className="text-[8px] h-4 py-0 font-bold bg-background border-input text-slate-500">Ingreso Caja</Badge>
                          </div>
                        </div>
                      ))}
                    </ScrollArea>
                  </div>
                </div>
              </div>

            </div>
          </TabsContent>

          {isUserAdmin && (
            <TabsContent value="foco_venta" className="space-y-6 outline-none">
              <Card className="bg-card border-border rounded-2xl p-6 shadow-sm">
                <div className="mb-4">
                  <h3 className="text-sm font-black text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="text-[#a5a8ff] drop-shadow-[0_0_6px_rgba(165,168,255,0.8)]" size={16} />
                    Foco de Venta (Alerta de Stock)
                  </h3>
                  <p className="text-xs text-muted-foreground">KPIs de analítica comercial y prioridad de ventas diaria.</p>
                </div>
                <FocoVentaKPI />
              </Card>
            </TabsContent>
          )}

          <TabsContent value="cotizacion" className="space-y-6 outline-none">
            <QuotationsTab
              onQuotationSaved={fetchQuotations}
              onLoadQuoteToCart={(quote) => {
                loadQuotationToCart(quote);
                setActiveTab('facturacion');
              }}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* REPORT PRINT VIEW */}
      <div className="hidden print:block w-full max-w-4xl mx-auto p-8 space-y-8 text-black">
        <div className="text-center space-y-2 border-b pb-8">
           <h1 className="text-3xl font-black uppercase tracking-tighter">NexWay ERP - Reporte de Arqueo</h1>
           <p className="text-sm font-bold">Fecha de Cierre: {new Date().toLocaleDateString()} - {new Date().toLocaleTimeString()}</p>
           <p className="text-xs italic">Cajero Responsable: {user?.email || 'Admin'}</p>
        </div>

        <div className="grid grid-cols-2 gap-8">
           <div className="space-y-4">
              <h2 className="text-lg font-black border-b pb-2 uppercase text-blue-800">Resumen de Caja</h2>
              <div className="space-y-2 text-sm">
                 <div className="flex justify-between"><span>Fondo Inicial:</span> <span className="font-bold">${(cashConfig?.cashFloat || 0).toFixed(2)}</span></div>
                 <div className="flex justify-between"><span>Ventas Efectivo:</span> <span className="font-bold">${systemCashSales.toFixed(2)}</span></div>
                 <div className="flex justify-between"><span>Total Gastos:</span> <span className="font-bold text-red-600">-${totalExpenses.toFixed(2)}</span></div>
                 <div className="flex justify-between border-t border-white/10 pt-2 text-lg font-black">
                    <span>Esperado en Caja:</span> 
                    <span>${((cashConfig?.cashFloat || 0) + systemCashSales - totalExpenses).toFixed(2)}</span>
                 </div>
                 <div className="flex justify-between text-lg font-black text-blue-600">
                    <span>Físico Encontrado:</span> 
                    <span>${totalPhysicalCash.toFixed(2)}</span>
                 </div>
              </div>
           </div>

           <div className="space-y-4">
              <h2 className="text-lg font-black border-b pb-2 uppercase text-blue-800">Detalle Denominaciones</h2>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
                 {Object.entries(cashDenominations).map(([den, qty]) => (
                   <div key={den} className="flex justify-between">
                      <span>${den}:</span>
                      <span className="font-bold">{qty} un.</span>
                   </div>
                 ))}
              </div>
           </div>
        </div>

        <div className="space-y-4">
            <h2 className="text-lg font-black border-b pb-2 uppercase text-blue-800">Otros Medios de Pago</h2>
            <Table className="border text-xs">
               <TableHeader>
                  <TableRow className="bg-gray-100">
                     <TableHead className="font-bold text-black">Medio de Pago</TableHead>
                     <TableHead className="text-right font-bold text-black">Ventas Sistema</TableHead>
                     <TableHead className="text-right font-bold text-black">Físico / Comprobantes</TableHead>
                     <TableHead className="text-right font-bold text-black">Diferencia</TableHead>
                  </TableRow>
               </TableHeader>
               <TableBody>
                  <TableRow>
                     <TableCell className="font-bold">Tarjeta</TableCell>
                     <TableCell className="text-right font-mono">${systemCardSales.toFixed(2)}</TableCell>
                     <TableCell className="text-right font-mono">${physicalCard.toFixed(2)}</TableCell>
                     <TableCell className={`text-right font-black font-mono ${cardDifference < 0 ? 'text-red-600' : 'text-green-600'}`}>${cardDifference.toFixed(2)}</TableCell>
                  </TableRow>
                  <TableRow>
                     <TableCell className="font-bold">Cheque</TableCell>
                     <TableCell className="text-right font-mono">${systemCheckSales.toFixed(2)}</TableCell>
                     <TableCell className="text-right font-mono">${physicalCheck.toFixed(2)}</TableCell>
                     <TableCell className={`text-right font-black font-mono ${checkDifference < 0 ? 'text-red-600' : 'text-green-600'}`}>${checkDifference.toFixed(2)}</TableCell>
                  </TableRow>
                  <TableRow>
                     <TableCell className="font-bold">Transferencia</TableCell>
                     <TableCell className="text-right font-mono">${systemTransferSales.toFixed(2)}</TableCell>
                     <TableCell className="text-right font-mono">${physicalTransfer.toFixed(2)}</TableCell>
                     <TableCell className={`text-right font-black font-mono ${transferDifference < 0 ? 'text-red-600' : 'text-green-600'}`}>${transferDifference.toFixed(2)}</TableCell>
                  </TableRow>
                  <TableRow>
                     <TableCell className="font-bold">Crédito</TableCell>
                     <TableCell className="text-right font-mono">${systemCreditSales.toFixed(2)}</TableCell>
                     <TableCell className="text-right font-mono">${physicalCredit.toFixed(2)}</TableCell>
                     <TableCell className={`text-right font-black font-mono ${creditDifference < 0 ? 'text-red-600' : 'text-green-600'}`}>${creditDifference.toFixed(2)}</TableCell>
                  </TableRow>
               </TableBody>
            </Table>
         </div>

        {/* FACTURAS CONSUMIDOR FINAL (CF) */}
        <div className="space-y-3">
           <div className="flex justify-between items-center border-b pb-1">
              <h2 className="text-base font-black uppercase text-blue-900">1. Facturas Consumidor Final (CF) ({salesCF.length})</h2>
              <span className="text-xs font-black text-slate-700">Total CF: ${salesCF.reduce((acc, s) => acc + (s.total || 0), 0).toFixed(2)}</span>
           </div>
           <Table className="border text-[10px]">
              <TableHeader>
                 <TableRow className="bg-gray-100">
                    <TableHead className="font-bold text-black">Correlativo</TableHead>
                    <TableHead className="font-bold text-black">Hora</TableHead>
                    <TableHead className="font-bold text-black">Cliente</TableHead>
                    <TableHead className="font-bold text-black">Método Pago</TableHead>
                    <TableHead className="text-right font-bold text-black">Monto Total</TableHead>
                 </TableRow>
              </TableHeader>
              <TableBody>
                 {salesCF.length === 0 ? (
                   <TableRow><TableCell colSpan={5} className="text-center py-2 text-gray-400 italic">No se emitieron Facturas CF en la jornada.</TableCell></TableRow>
                 ) : salesCF.map((sale: any) => (
                    <TableRow key={sale.id}>
                       <TableCell className="font-mono font-bold">{sale.correlative || sale.docType}</TableCell>
                       <TableCell>{new Date(sale.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</TableCell>
                       <TableCell className="font-semibold">{sale.customer}</TableCell>
                       <TableCell>{sale.paymentMethod}</TableCell>
                       <TableCell className="text-right font-black font-mono">${(sale.total || 0).toFixed(2)}</TableCell>
                    </TableRow>
                 ))}
              </TableBody>
           </Table>
        </div>

        {/* CRÉDITOS FISCALES (CCF) */}
        <div className="space-y-3">
           <div className="flex justify-between items-center border-b pb-1">
              <h2 className="text-base font-black uppercase text-blue-900">2. Comprobantes de Crédito Fiscal (CCF) ({salesCCF.length})</h2>
              <span className="text-xs font-black text-slate-700">Total CCF: ${salesCCF.reduce((acc, s) => acc + (s.total || 0), 0).toFixed(2)}</span>
           </div>
           <Table className="border text-[10px]">
              <TableHeader>
                 <TableRow className="bg-gray-100">
                    <TableHead className="font-bold text-black">Correlativo / Control DTE</TableHead>
                    <TableHead className="font-bold text-black">Hora</TableHead>
                    <TableHead className="font-bold text-black">Cliente / Empresa</TableHead>
                    <TableHead className="font-bold text-black">Método Pago</TableHead>
                    <TableHead className="text-right font-bold text-black">Monto Total</TableHead>
                 </TableRow>
              </TableHeader>
              <TableBody>
                 {salesCCF.length === 0 ? (
                   <TableRow><TableCell colSpan={5} className="text-center py-2 text-gray-400 italic">No se emitieron Créditos Fiscales CCF en la jornada.</TableCell></TableRow>
                 ) : salesCCF.map((sale: any) => (
                    <TableRow key={sale.id}>
                       <TableCell className="font-mono font-bold">{sale.correlative || sale.docType}</TableCell>
                       <TableCell>{new Date(sale.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</TableCell>
                       <TableCell className="font-semibold">{sale.customer}</TableCell>
                       <TableCell>{sale.paymentMethod}</TableCell>
                       <TableCell className="text-right font-black font-mono">${(sale.total || 0).toFixed(2)}</TableCell>
                    </TableRow>
                 ))}
              </TableBody>
           </Table>
        </div>

        {/* ABONOS Y COBROS DE CRÉDITO */}
        <div className="space-y-3">
           <div className="flex justify-between items-center border-b pb-1">
              <h2 className="text-base font-black uppercase text-blue-900">3. Abonos y Cobros de Crédito ({todaysAbonos.length})</h2>
              <span className="text-xs font-black text-slate-700">Total Abonos: ${todaysAbonos.reduce((acc, a) => acc + (parseFloat(a.amount) || 0), 0).toFixed(2)}</span>
           </div>
           <Table className="border text-[10px]">
              <TableHeader>
                 <TableRow className="bg-gray-100">
                    <TableHead className="font-bold text-black">Fecha / Hora</TableHead>
                    <TableHead className="font-bold text-black">Concepto / Referencia</TableHead>
                    <TableHead className="text-right font-bold text-black">Monto Ingresado</TableHead>
                 </TableRow>
              </TableHeader>
              <TableBody>
                 {todaysAbonos.length === 0 ? (
                   <TableRow><TableCell colSpan={3} className="text-center py-2 text-gray-400 italic">No hay abonos a crédito procesados en esta jornada.</TableCell></TableRow>
                 ) : todaysAbonos.map((abono: any) => (
                    <TableRow key={abono.id}>
                       <TableCell>{new Date(abono.created_at).toLocaleString()}</TableCell>
                       <TableCell className="font-medium">{abono.description}</TableCell>
                       <TableCell className="text-right font-black font-mono">${(parseFloat(abono.amount) || 0).toFixed(2)}</TableCell>
                    </TableRow>
                 ))}
              </TableBody>
           </Table>
        </div>

        {/* FIRMAS DE CONFORMIDAD Y AUDITORÍA BMS */}
        <div className="grid grid-cols-2 gap-16 pt-16 border-t border-gray-300">
           <div className="border-t border-black text-center pt-3">
              <p className="text-sm font-black uppercase">Visto Bueno del Cajero</p>
              <p className="text-xs font-bold text-gray-700">{user?.email || selectedSellerEmail || 'Cajero POS'}</p>
              <p className="text-[10px] text-gray-500 italic mt-0.5">{cashierVistoBueno ? '✓ Conformidad Otorgada Digitalmente' : 'Pendiente de firma'}</p>
           </div>
           <div className="border-t border-black text-center pt-3">
              <p className="text-sm font-black uppercase">Autorización BMS / Gerencia</p>
              <p className="text-xs font-bold text-blue-900">{bmsReconciliationStatus.statusLabel}</p>
              <p className="text-[10px] text-gray-500 italic mt-0.5">Sistema Integrado BMS NexWay ERP</p>
           </div>
        </div>
      </div>

      {/* CHECKOUT DIALOG */}
      <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
        <DialogContent className="rounded-2xl max-w-md p-6 bg-card border shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">Confirmar Venta</DialogTitle>
            <DialogDescription>El DTE será notificado al cliente vía correo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="bg-slate-900 rounded-2xl p-6 text-white flex justify-between items-center">
               <div><p className="text-[10px] font-black uppercase opacity-60">Monto Total</p><p className="text-3xl font-black text-blue-400">${totalCart.toFixed(2)}</p></div>
               <div className="h-12 w-12 bg-white/10 rounded-2xl flex items-center justify-center"><Calculator size={24} /></div>
            </div>

            {paymentMethod === 'Efectivo' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-1.5">
                  <Button type="button" variant="outline" size="sm" onClick={() => setCashReceived(totalCart.toFixed(2))} className="text-[11px] font-black bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                    Exacto (${totalCart.toFixed(2)})
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setCashReceived('5.00')} className="text-[11px] font-bold">$5.00</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setCashReceived('10.00')} className="text-[11px] font-bold">$10.00</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setCashReceived('20.00')} className="text-[11px] font-bold">$20.00</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setCashReceived('50.00')} className="text-[11px] font-bold">$50.00</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setCashReceived('100.00')} className="text-[11px] font-bold">$100.00</Button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Efectivo Recibido</Label>
                    <Input type="number" placeholder="0.00" value={cashReceived} onChange={e => setCashReceived(e.target.value)} className="h-12 text-lg font-bold rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Cambio</Label>
                    <div className="h-12 flex items-center px-4 bg-emerald-500/10 text-emerald-600 rounded-xl font-black text-lg">${changeDue.toFixed(2)}</div>
                  </div>
                </div>
              </div>
            ) : paymentMethod === 'Mixto' ? (
              <div className="space-y-3">
                <div className="p-3 bg-muted/50 dark:bg-muted/20 rounded-2xl border flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase font-black text-muted-foreground">Total Asignado</p>
                    <p className="text-lg font-black text-foreground font-mono">${splitTotal.toFixed(2)} <span className="text-xs text-muted-foreground font-normal">/ ${totalCart.toFixed(2)}</span></p>
                  </div>
                  {Math.abs(splitTotal - totalCart) < 0.01 ? (
                    <Badge className="bg-emerald-500/20 text-emerald-500 border-0 text-[10px] font-black py-1 px-2.5 rounded-full">
                      <CheckCircle2 size={12} className="mr-1 inline" /> Cuadre Exacto
                    </Badge>
                  ) : splitTotal < totalCart ? (
                    <Badge className="bg-amber-500/20 text-amber-500 border-0 text-[10px] font-black py-1 px-2.5 rounded-full">
                      Faltan ${(totalCart - splitTotal).toFixed(2)}
                    </Badge>
                  ) : (
                    <Badge className="bg-rose-500/20 text-rose-500 border-0 text-[10px] font-black py-1 px-2.5 rounded-full">
                      Excede ${(splitTotal - totalCart).toFixed(2)}
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <Label className="text-[10px] font-black uppercase flex items-center gap-1">
                        <Wallet size={11} className="text-emerald-500" /> Efectivo ($)
                      </Label>
                      {splitRemaining > 0 && (
                        <button
                          type="button"
                          onClick={() => setSplitAmounts(prev => ({ ...prev, cash: (splitCashVal + splitRemaining).toFixed(2) }))}
                          className="text-[9px] font-bold text-indigo-500 hover:underline cursor-pointer"
                        >
                          Restante
                        </button>
                      )}
                    </div>
                    <Input 
                      type="number" 
                      placeholder="0.00" 
                      value={splitAmounts.cash} 
                      onChange={e => setSplitAmounts(prev => ({ ...prev, cash: e.target.value }))}
                      className="h-10 text-sm font-bold rounded-xl"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <Label className="text-[10px] font-black uppercase flex items-center gap-1">
                        <CardIcon size={11} className="text-blue-500" /> Tarjeta ($)
                      </Label>
                      {splitRemaining > 0 && (
                        <button
                          type="button"
                          onClick={() => setSplitAmounts(prev => ({ ...prev, card: (splitCardVal + splitRemaining).toFixed(2) }))}
                          className="text-[9px] font-bold text-indigo-500 hover:underline cursor-pointer"
                        >
                          Restante
                        </button>
                      )}
                    </div>
                    <Input 
                      type="number" 
                      placeholder="0.00" 
                      value={splitAmounts.card} 
                      onChange={e => setSplitAmounts(prev => ({ ...prev, card: e.target.value }))}
                      className="h-10 text-sm font-bold rounded-xl"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <Label className="text-[10px] font-black uppercase flex items-center gap-1">
                        <Landmark size={11} className="text-indigo-500" /> Transferencia ($)
                      </Label>
                      {splitRemaining > 0 && (
                        <button
                          type="button"
                          onClick={() => setSplitAmounts(prev => ({ ...prev, transfer: (splitTransferVal + splitRemaining).toFixed(2) }))}
                          className="text-[9px] font-bold text-indigo-500 hover:underline cursor-pointer"
                        >
                          Restante
                        </button>
                      )}
                    </div>
                    <Input 
                      type="number" 
                      placeholder="0.00" 
                      value={splitAmounts.transfer} 
                      onChange={e => setSplitAmounts(prev => ({ ...prev, transfer: e.target.value }))}
                      className="h-10 text-sm font-bold rounded-xl"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <Label className="text-[10px] font-black uppercase flex items-center gap-1">
                        <Receipt size={11} className="text-purple-500" /> Crédito ($)
                      </Label>
                      {splitRemaining > 0 && !creditValidation.disabled && (
                        <button
                          type="button"
                          onClick={() => setSplitAmounts(prev => ({ ...prev, credit: (splitCreditVal + splitRemaining).toFixed(2) }))}
                          className="text-[9px] font-bold text-indigo-500 hover:underline cursor-pointer"
                        >
                          Restante
                        </button>
                      )}
                    </div>
                    <Input 
                      type="number" 
                      placeholder="0.00" 
                      value={splitAmounts.credit} 
                      disabled={creditValidation.disabled}
                      onChange={e => setSplitAmounts(prev => ({ ...prev, credit: e.target.value }))}
                      className="h-10 text-sm font-bold rounded-xl disabled:opacity-50"
                    />
                  </div>

                  <div className="col-span-2 space-y-1">
                    <div className="flex justify-between items-center">
                      <Label className="text-[10px] font-black uppercase flex items-center gap-1">
                        <FileText size={11} className="text-amber-500" /> Cheque ($)
                      </Label>
                      {splitRemaining > 0 && (
                        <button
                          type="button"
                          onClick={() => setSplitAmounts(prev => ({ ...prev, cheque: (splitChequeVal + splitRemaining).toFixed(2) }))}
                          className="text-[9px] font-bold text-indigo-500 hover:underline cursor-pointer"
                        >
                          Restante
                        </button>
                      )}
                    </div>
                    <Input 
                      type="number" 
                      placeholder="0.00" 
                      value={splitAmounts.cheque} 
                      onChange={e => setSplitAmounts(prev => ({ ...prev, cheque: e.target.value }))}
                      className="h-10 text-sm font-bold rounded-xl"
                    />
                  </div>
                </div>
              </div>
            ) : paymentMethod === 'Credito' ? (
              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-800 dark:text-amber-200 space-y-1.5">
                  <div className="text-xs font-black uppercase flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
                    <Receipt size={14} /> Aviso a Cajero · Factura al Crédito (CXC)
                  </div>
                  <p className="text-[11px] leading-snug">
                    <strong>No cobrar efectivo en ventanilla.</strong> El saldo de <strong>${totalCart.toFixed(2)}</strong> pasará a Cuentas por Cobrar de <strong>{customerName || selectedCustomer?.name || 'Cliente'}</strong>. Al imprimir, solicite firma y sello en la copia de caja.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Plazo Autorizado (Días)</Label>
                    <Select value={posCreditDays} onValueChange={setPosCreditDays}>
                      <SelectTrigger className="h-11 rounded-xl font-bold text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">15 días</SelectItem>
                        <SelectItem value="30">30 días</SelectItem>
                        <SelectItem value="45">45 días</SelectItem>
                        <SelectItem value="60">60 días</SelectItem>
                        <SelectItem value="90">90 días</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Orden / Autorización (Opc.)</Label>
                    <Input
                      placeholder="Ej. OC-Cliente..."
                      value={paymentReference}
                      onChange={e => setPaymentReference(e.target.value)}
                      className="h-11 rounded-xl text-xs"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground">Referencia ({paymentMethod})</Label>
                <Input placeholder="ID Transacción..." value={paymentReference} onChange={e => setPaymentReference(e.target.value)} className="h-12 rounded-xl" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button 
              className={`w-full h-14 rounded-2xl font-black text-base sm:text-lg shadow-xl ${
                activeStation?.station_role === 'PREFACTURACION_ONLY'
                  ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-500/20'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20'
              }`} 
              onClick={handleFinalizeSale} 
              disabled={isProcessing}
            >
              {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2" />}
              {activeStation?.station_role === 'PREFACTURACION_ONLY' 
                ? '📝 GENERAR PRE-FACTURA / VALE DE CAJA' 
                : 'COMPLETAR OPERACIÓN Y EMITIR DTE'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DE AUTORIZACIÓN EXCEPCIONAL DE LÍMITE DE CRÉDITO */}
      <Dialog open={isCreditAuthModalOpen} onOpenChange={setIsCreditAuthModalOpen}>
        <DialogContent className="rounded-2xl max-w-md p-6 bg-card border shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-amber-600 dark:text-amber-400 flex items-center gap-2">
              🔐 Autorización de Despacho al Crédito
            </DialogTitle>
            <DialogDescription className="text-xs">
              El cliente supera su límite autorizado o tiene saldo pendiente. Se requiere aprobación de Encargado o Administrador.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-1.5">
              <div className="flex justify-between"><span>Cliente:</span><strong className="text-foreground">{selectedCustomer?.name || 'N/A'}</strong></div>
              <div className="flex justify-between"><span>Límite Autorizado:</span><span className="font-mono font-bold">${creditStatusDetail.limit.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>Deuda Pendiente Actual:</span><span className="font-mono font-bold text-amber-600 dark:text-amber-400">${creditStatusDetail.outstandingDebt.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>Nueva Factura:</span><span className="font-mono font-bold">${totalCart.toFixed(2)}</span></div>
              <div className="flex justify-between border-t border-amber-500/30 pt-1.5 text-rose-600 dark:text-rose-400 font-black">
                <span>Monto Excedido:</span>
                <span className="font-mono">${creditStatusDetail.exceededAmount.toFixed(2)}</span>
              </div>
            </div>

            {!isUserAdmin && (
              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">Encargado / Administrador que Autoriza</Label>
                  <Select value={authManagerEmail} onValueChange={setAuthManagerEmail}>
                    <SelectTrigger className="h-9 text-xs font-bold">
                      <SelectValue placeholder="Seleccione encargado..." />
                    </SelectTrigger>
                    <SelectContent>
                      {appUsersList.map((u) => (
                        <SelectItem key={u.id} value={u.email} className="text-xs">
                          {u.full_name} ({u.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase text-muted-foreground">PIN de Autorización (Gerencia)</Label>
                  <Input
                    type="password"
                    placeholder="Ingrese PIN de encargado..."
                    value={authManagerPin}
                    onChange={(e) => setAuthManagerPin(e.target.value)}
                    className="h-10 text-sm font-mono tracking-widest"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Motivo / Observación de Autorización *</Label>
              <Input
                placeholder="Ej. Cliente habitual, cancela el viernes con cheque..."
                value={authReason}
                onChange={(e) => setAuthReason(e.target.value)}
                className="h-10 text-xs"
              />
            </div>

            {isUserAdmin && (
              <div className="pt-1 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setShowChangePin(!showChangePin)}
                  className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  {showChangePin ? 'Ocultar configuración de PIN' : 'Configurar PIN de autorización para cajeros'}
                </button>
                {showChangePin && (
                  <div className="mt-2 flex gap-2">
                    <Input
                      type="password"
                      placeholder="Nuevo PIN (mín. 4 dígitos)"
                      value={newManagerPinInput}
                      onChange={(e) => setNewManagerPinInput(e.target.value)}
                      className="h-8 text-xs font-mono"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs font-bold"
                      onClick={async () => {
                        try {
                          await saveManagerCreditPin(newManagerPinInput);
                          setNewManagerPinInput('');
                          setShowChangePin(false);
                          toast({ title: 'PIN de Gerencia Actualizado ✓' });
                        } catch (e: any) {
                          toast({ variant: 'destructive', title: 'Error', description: e?.message });
                        }
                      }}
                    >
                      Guardar PIN
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setIsCreditAuthModalOpen(false)} className="text-xs font-bold">
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmCreditOverride}
              disabled={authorizingCredit}
              className="bg-amber-600 hover:bg-amber-700 text-white font-black text-xs rounded-xl"
            >
              {authorizingCredit ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              ✓ Autorizar Despacho al Crédito
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DE VENTA COMPLETADA E IMPRESIÓN DE DTE */}
      <Dialog open={completedSaleData !== null} onOpenChange={(open) => !open && setCompletedSaleData(null)}>
        {completedSaleData && (
          <DialogContent className="rounded-2xl max-w-md p-6 bg-card border shadow-2xl">
            <DialogHeader className="text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 size={36} />
              </div>
              <DialogTitle className="text-xl font-black text-emerald-500 text-center">¡Venta Registrada Exitosamente!</DialogTitle>
              <DialogDescription className="text-xs text-center">
                DTE Emitido: <strong className="font-mono text-slate-800 dark:text-white">{completedSaleData.correlative}</strong>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 my-2">
              {(completedSaleData.paymentMethod === 'Credito' || (completedSaleData.creditAmount || 0) > 0) && (
                <div className="p-3.5 rounded-xl bg-amber-500/20 border-2 border-amber-500 text-amber-900 dark:text-amber-200 space-y-1">
                  <div className="text-xs font-black uppercase tracking-wide flex items-center justify-between">
                    <span>⚠️ VENTA AL CRÉDITO — AVISO CAJERO</span>
                    <Badge className="bg-amber-600 text-white border-0 text-[9px] font-black">
                      {completedSaleData.creditDays || 30} DÍAS
                    </Badge>
                  </div>
                  <p className="text-[11px] font-medium leading-snug">
                    <strong>NO COBRAR EN EFECTIVO</strong> (${(completedSaleData.creditAmount || completedSaleData.total).toFixed(2)} registrado en CXC). Imprima el comprobante y <strong>solicite FIRMA Y SELLO del cliente</strong> para archivo de caja.
                  </p>
                </div>
              )}

              <div className="bg-slate-900 text-white p-4 rounded-xl space-y-2 text-xs">
                <div className="flex justify-between"><span>Cliente:</span><span className="font-bold">{completedSaleData.customerName}</span></div>
                <div className="flex justify-between"><span>Tipo Doc:</span><span className="font-bold uppercase text-amber-400">{completedSaleData.docType}</span></div>
                <div className="flex justify-between"><span>Condición / Pago:</span><span className="font-bold text-indigo-300">{completedSaleData.paymentMethod || 'Efectivo'}</span></div>
                <div className="flex justify-between"><span>Monto Total:</span><span className="font-black text-blue-400 text-sm">${completedSaleData.total.toFixed(2)}</span></div>
                {completedSaleData.paymentMethod === 'Credito' || (completedSaleData.creditAmount || 0) > 0 ? (
                  <div className="flex justify-between border-t border-white/10 pt-2 text-amber-400 font-bold">
                    <span>Saldo a Crédito (CXC):</span>
                    <span className="font-black text-base">${(completedSaleData.creditAmount || completedSaleData.total).toFixed(2)}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between"><span>Efectivo Recibido:</span><span className="font-bold">${completedSaleData.cashReceived.toFixed(2)}</span></div>
                    <div className="flex justify-between border-t border-white/10 pt-2 text-emerald-400 font-bold">
                      <span>Vuelto a Entregar:</span>
                      <span className="font-black text-base">${completedSaleData.change.toFixed(2)}</span>
                    </div>
                  </>
                )}
              </div>

              {completedSaleData.dteEstado && (
                <div
                  className={`p-3 rounded-xl border text-[11px] space-y-1 ${
                    completedSaleData.dteEstado === 'PROCESADO'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                  }`}
                >
                  <div className="flex items-center justify-between font-black uppercase text-[10px]">
                    <span>Hacienda SV (Sandbox)</span>
                    <Badge
                      variant="outline"
                      className={`text-[9px] font-black ${
                        completedSaleData.dteEstado === 'PROCESADO'
                          ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-300'
                          : 'border-amber-500/40 text-amber-600 dark:text-amber-300'
                      }`}
                    >
                      {completedSaleData.dteEstado}
                    </Badge>
                  </div>
                  {completedSaleData.selloRecibido && (
                    <div className="font-mono text-[10px] break-all">
                      <span className="font-bold opacity-75">Sello:</span> {completedSaleData.selloRecibido}
                    </div>
                  )}
                  {completedSaleData.codigoGeneracion && (
                    <div className="font-mono text-[10px] break-all opacity-80">
                      <span className="font-bold">UUID:</span> {completedSaleData.codigoGeneracion}
                    </div>
                  )}
                  {completedSaleData.dteEstado !== 'PROCESADO' &&
                    completedSaleData.dteObservaciones &&
                    completedSaleData.dteObservaciones.length > 0 && (
                      <div className="text-[10px] pt-1">
                        {completedSaleData.dteObservaciones[0]}
                      </div>
                    )}
                </div>
              )}
            </div>

            <DialogFooter className="flex flex-col gap-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                <Button
                  onClick={async () => {
                    const branding = await loadPrintBranding('billing');
                    const html = buildInvoiceDocumentHtml({
                      branding,
                      paperSize: '80mm',
                      correlative: completedSaleData.correlative,
                      docType: completedSaleData.docType,
                      customerName: completedSaleData.customerName,
                      customerNit: completedSaleData.customerNit,
                      customerNrc: completedSaleData.customerNrc,
                      customerGiro: completedSaleData.customerGiro,
                      customerAddress: completedSaleData.customerAddress,
                      sellerName: appUsersList.find((u) => u.email === selectedSellerEmail)?.full_name || selectedSellerEmail,
                      paymentMethod: completedSaleData.paymentMethod || paymentMethod,
                      creditDays: completedSaleData.creditDays,
                      creditAmount: completedSaleData.creditAmount,
                      creditAuthorizedBy: completedSaleData.creditAuthorizedBy,
                      creditAuthReason: completedSaleData.creditAuthReason,
                      items: completedSaleData.items,
                      total: completedSaleData.total,
                      ivaRetention1,
                      cashReceived: completedSaleData.cashReceived,
                      change: completedSaleData.change
                    });
                    printHtmlDocument(html, `Ticket ${completedSaleData.correlative}`);
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700 font-bold text-xs h-11 rounded-xl text-white"
                >
                  <Printer size={15} className="mr-1.5" /> TICKET (80mm)
                </Button>
                <Button
                  variant="outline"
                  onClick={async () => {
                    const branding = await loadPrintBranding('billing');
                    const html = buildInvoiceDocumentHtml({
                      branding,
                      paperSize: 'letter',
                      correlative: completedSaleData.correlative,
                      docType: completedSaleData.docType,
                      customerName: completedSaleData.customerName,
                      customerNit: completedSaleData.customerNit,
                      customerNrc: completedSaleData.customerNrc,
                      customerGiro: completedSaleData.customerGiro,
                      customerAddress: completedSaleData.customerAddress,
                      sellerName: appUsersList.find((u) => u.email === selectedSellerEmail)?.full_name || selectedSellerEmail,
                      paymentMethod: completedSaleData.paymentMethod || paymentMethod,
                      creditDays: completedSaleData.creditDays,
                      creditAmount: completedSaleData.creditAmount,
                      creditAuthorizedBy: completedSaleData.creditAuthorizedBy,
                      creditAuthReason: completedSaleData.creditAuthReason,
                      items: completedSaleData.items,
                      total: completedSaleData.total,
                      ivaRetention1,
                      cashReceived: completedSaleData.cashReceived,
                      change: completedSaleData.change
                    });
                    printHtmlDocument(html, `Factura ${completedSaleData.correlative}`);
                  }}
                  className="w-full font-bold text-xs h-11 rounded-xl"
                >
                  <FileText size={15} className="mr-1.5" /> HOJA CARTA / PDF
                </Button>
              </div>

              <Button
                onClick={() => {
                  setEmailSimSaleData({
                    correlative: completedSaleData.correlative,
                    docType: completedSaleData.docType,
                    customerName: completedSaleData.customerName,
                    customerEmail: completedSaleData.customerEmail || 'cliente@empresa.com.sv',
                    total: completedSaleData.total,
                    paymentMethod: paymentMethod,
                    timestamp: new Date().toISOString(),
                    items: completedSaleData.items.map((i: any) => ({
                      sku: i.sku || 'ITEM',
                      name: i.name,
                      quantity: Number(i.quantity) || 1,
                      price: Number(i.price) || 0
                    }))
                  });
                  setIsEmailSimOpen(true);
                }}
                className="w-full bg-indigo-600 hover:bg-indigo-700 font-bold text-xs h-11 rounded-xl text-white"
              >
                <Mail size={16} className="mr-1.5" /> ENVIAR DTE POR CORREO (PDF + JSON)
              </Button>

              <Button
                variant="outline"
                onClick={() => setCompletedSaleData(null)}
                className="w-full font-bold text-xs h-10 rounded-xl border-slate-700"
              >
                ⚡ NUEVA VENTA
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* DIALOG DE REGISTRO DE ABONO */}
      <Dialog open={selectedSaleForAbono !== null} onOpenChange={(open) => !open && setSelectedSaleForAbono(null)}>
        {selectedSaleForAbono && (() => {
          const totalAbonado = journalPayments
            ?.filter(j => j.description.includes(`[${selectedSaleForAbono.correlative}]`))
            .reduce((sum, j) => sum + (parseFloat(j.amount) || 0), 0) || 0;
          
          const saldoPendiente = selectedSaleForAbono.total - totalAbonado;

          return (
            <DialogContent className="rounded-2xl max-w-md p-6 bg-card border shadow-2xl border-slate-100 dark:border-border">
              <DialogHeader>
                <DialogTitle className="text-xl font-black flex items-center gap-2 text-foreground">
                  <Coins size={20} className="text-indigo-600 dark:text-indigo-400" /> Registrar Abono a Crédito
                </DialogTitle>
                <DialogDescription className="text-xs dark:text-muted-foreground">
                  Factura: <strong>{selectedSaleForAbono.correlative}</strong> | Cliente: <strong>{selectedSaleForAbono.customer}</strong>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-background border-input/40 border dark:border-border rounded-xl">
                    <span className="text-[9px] font-black uppercase text-slate-400 block">Total de Venta</span>
                    <span className="text-sm font-black text-slate-950 dark:text-foreground">${selectedSaleForAbono.total.toFixed(2)}</span>
                  </div>
                  <div className="p-3 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/50 rounded-xl">
                    <span className="text-[9px] font-black uppercase text-rose-500 block">Saldo Pendiente</span>
                    <span className="text-sm font-black text-rose-600 dark:text-rose-400">${saldoPendiente.toFixed(2)}</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Monto del Abono ($)</Label>
                  <Input 
                    type="number" 
                    placeholder="0.00" 
                    value={abonoAmount}
                    onChange={e => setAbonoAmount(e.target.value)}
                    className="h-11 bg-background border-input border-slate-100 dark:border-border rounded-xl font-black text-emerald-600 dark:text-emerald-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Método de Pago</Label>
                  <Select value={abonoPaymentMethod} onValueChange={setAbonoPaymentMethod}>
                    <SelectTrigger className="h-11 bg-background border-input border-slate-100 dark:border-border rounded-xl text-xs font-bold text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Efectivo">Efectivo</SelectItem>
                      <SelectItem value="Tarjeta">Tarjeta de Crédito / Débito</SelectItem>
                      <SelectItem value="Transferencia">Transferencia Bancaria</SelectItem>
                      <SelectItem value="Cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Notas del Abono</Label>
                  <Textarea 
                    placeholder="Referencia de pago, detalles..." 
                    value={abonoNotes}
                    onChange={e => setAbonoNotes(e.target.value)}
                    className="bg-background border-input border-slate-100 dark:border-border rounded-xl text-xs text-foreground"
                    rows={2}
                  />
                </div>
              </div>
              <DialogFooter>
                <div className="flex gap-3 w-full">
                  <Button 
                    variant="outline"
                    className="flex-1 h-11 rounded-xl text-xs font-bold border-slate-200 dark:border-border text-foreground bg-card border-border shadow-sm" 
                    onClick={() => setSelectedSaleForAbono(null)}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    className="flex-1 h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-lg shadow-indigo-500/20 active:scale-95 transition-all border-none" 
                    onClick={handleRegisterAbono}
                    disabled={isRegisteringAbono || !abonoAmount}
                  >
                    {isRegisteringAbono ? <Loader2 className="animate-spin mr-1.5" size={12} /> : null}
                    Registrar Abono
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          );
        })()}
      </Dialog>

      {/* Diálogo de Importar Cotización / Pre-Factura */}
      <Dialog open={showQuotationsDialog} onOpenChange={setShowQuotationsDialog}>
        <DialogContent className="max-w-2xl bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-800 dark:text-slate-200 font-headline flex items-center gap-2">
              <FileText size={20} className="text-indigo-500" />
              Pre-Facturas y Cotizaciones Pendientes ({quotationsList.length})
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Selecciona una pre-factura creada desde Cotización para cargarla a caja y emitir la factura. El inventario solo se descuenta al cobrar.
            </DialogDescription>
          </DialogHeader>

          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <Input
              placeholder="Buscar por cliente o código PRE-..."
              value={quoteSearchTerm}
              onChange={(e) => setQuoteSearchTerm(e.target.value)}
              className="pl-9 h-9 text-xs rounded-xl"
            />
          </div>

          <ScrollArea className="h-[340px] mt-3">
            {loadingQuotes ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2 py-12">
                <Loader2 className="animate-spin" />
                <p className="text-xs font-bold">Cargando pre-facturas...</p>
              </div>
            ) : quotationsList.filter(q =>
                !quoteSearchTerm.trim() ||
                (q.customer_name || '').toLowerCase().includes(quoteSearchTerm.toLowerCase()) ||
                (q.quote_number || '').toLowerCase().includes(quoteSearchTerm.toLowerCase())
              ).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2 py-12">
                <FileText size={32} className="opacity-50" />
                <p className="text-xs font-bold">No hay pre-facturas / cotizaciones pendientes</p>
                <p className="text-[11px] text-slate-500">Crea una desde la pestaña &quot;Cotización&quot; para enviarla a caja.</p>
              </div>
            ) : (
              <div className="space-y-3 pr-4">
                {quotationsList
                  .filter(q =>
                    !quoteSearchTerm.trim() ||
                    (q.customer_name || '').toLowerCase().includes(quoteSearchTerm.toLowerCase()) ||
                    (q.quote_number || '').toLowerCase().includes(quoteSearchTerm.toLowerCase())
                  )
                  .map(q => {
                    const itemsArr = Array.isArray(q.items) ? q.items : [];
                    return (
                      <div
                        key={q.id}
                        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl hover:border-indigo-400 dark:hover:border-indigo-600 transition-colors"
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                              {q.quote_number}
                            </span>
                            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                              {q.customer_name || 'Cliente de Mostrador'}
                            </h4>
                            {q.sellerName && (
                              <Badge variant="outline" className="text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border-indigo-500/30 gap-1">
                                <UserCheck size={10} /> {q.sellerName}
                              </Badge>
                            )}
                            {q.paymentMethod && (
                              <Badge
                                variant="outline"
                                className={`text-[10px] font-black uppercase ${
                                  q.paymentMethod === 'Credito'
                                    ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40'
                                    : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                                }`}
                              >
                                {q.paymentMethod === 'Credito' ? `⚠️ CRÉDITO (${q.creditDays || 30}d)` : q.paymentMethod}
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {itemsArr.length} {itemsArr.length === 1 ? 'producto' : 'productos'}
                            {itemsArr.length > 0 ? `: ${itemsArr.slice(0, 2).map((i: any) => `${i.quantity}x ${i.name}`).join(', ')}${itemsArr.length > 2 ? '...' : ''}` : ''}
                          </p>
                          <p className="text-[10px] text-slate-400">{new Date(q.created_at).toLocaleString()}</p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-between sm:justify-end">
                          <div className="text-right mr-1">
                            <p className="text-base font-mono font-black text-indigo-600 dark:text-indigo-400">${Number(q.total || 0).toFixed(2)}</p>
                            <Badge variant="outline" className="text-[9px] uppercase bg-amber-500/10 text-amber-600 border-amber-500/20">
                              Pre-Factura
                            </Badge>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => loadQuotationToCart(q)}
                            className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl gap-1.5"
                          >
                            <ShoppingCart size={13} /> Cargar a Caja
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={(e) => deleteQuotationFromModal(q, e)}
                            className="h-9 w-9 text-slate-400 hover:text-rose-500 rounded-xl"
                            title="Eliminar pre-factura"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO: FACTURAS EN ESPERA Y BORRADORES PENDIENTES */}
      <Dialog open={showPendingDraftsDialog} onOpenChange={setShowPendingDraftsDialog}>
        <DialogContent className="max-w-xl rounded-2xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 p-6">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2 text-slate-800 dark:text-white">
              <Clock className="text-amber-500" size={18} />
              Facturas en Espera y Borradores Pendientes
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Selecciona cualquier factura pausada o borrador guardado para reanudar la venta en el carrito.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-80 my-2 pr-2">
            {loadingQuotes ? (
              <div className="flex flex-col items-center justify-center p-8 text-slate-400 gap-2">
                <Loader2 className="animate-spin text-amber-500" size={20} />
                <span className="text-xs font-bold">Cargando borradores...</span>
              </div>
            ) : pendingDraftsList.length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-400 italic border border-dashed rounded-xl border-slate-200 dark:border-zinc-800">
                No hay facturas en espera guardadas actualmente.
              </div>
            ) : (
              <div className="space-y-2.5">
                {pendingDraftsList.map((draft) => (
                  <div key={draft.id || draft.quote_number} className="p-3.5 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl flex items-center justify-between gap-3 hover:border-amber-500/50 transition-all">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded border border-amber-500/20">
                          {draft.quote_number || '#BORR-001'}
                        </span>
                        <span className="text-xs font-bold text-slate-800 dark:text-white">
                          {draft.customer_name || 'Consumidor Final'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        {draft.items?.length || 0} productos • Total: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">${(Number(draft.total) || 0).toFixed(2)}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => loadDraftToCart(draft)}
                        className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex items-center gap-1.5 shadow-sm"
                      >
                        <ShoppingCart size={13} /> Cargar en Carrito
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteDraft(draft)}
                        className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl"
                        title="Eliminar borrador"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Modal de Simulación y Despacho de Correo Electrónico DTE */}
      <DteEmailSimulationModal
        open={isEmailSimOpen}
        onOpenChange={setIsEmailSimOpen}
        saleData={emailSimSaleData}
      />
    </div>
  );
}



