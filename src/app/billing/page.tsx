
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
  RotateCcw,
  AlertCircle,
  SlidersHorizontal,
  Filter,
  Package,
  Store,
  Warehouse
} from 'lucide-react';
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
import { ModeToggle } from '@/components/mode-toggle';
import { sendDteEmail } from '@/ai/flows/send-dte-email-flow';
import { Textarea } from '@/components/ui/textarea';
import { useStation } from './components/use-station';
import { useTabs } from '@/hooks/use-tabs';
import { useModuleConfig } from '@/supabase/use-module-config';
import type { CartItem, PaymentMethod } from './components/types';

export default function BillingPage() {
  const { user, role } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const isUserAdmin = role === 'admin' || role === 'gerencia';
  const { config } = useModuleConfig();

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

  const billingTabs = useMemo(() => [
    { id: 'facturacion', key: 'billing_facturacion' },
    { id: 'historial', key: 'billing_historial' },
    { id: 'nota_credito', key: 'billing_nota_credito' },
    { id: 'nota_debito', key: 'billing_nota_debito' },
    { id: 'arqueo', key: 'billing_arqueo' },
    { id: 'creditos', key: 'billing_creditos' },
  ], []);

  const { activeTab, setActiveTab } = useTabs(config, billingTabs, 'facturacion');

  const [searchTerm, setSearchTerm] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Customer & Payment States
  const [docType, setDocType] = useState<'CF' | 'CCF'>('CF');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Efectivo');
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);

  // --- QUOTATIONS IMPORT ---
  const [showQuotationsDialog, setShowQuotationsDialog] = useState(false);
  const [quotationsList, setQuotationsList] = useState<any[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);

  const fetchQuotations = async () => {
    setLoadingQuotes(true);
    try {
      const { data, error } = await supabase
        .from('quotations')
        .select('*')
        .eq('status', 'PENDIENTE')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setQuotationsList(data || []);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar las cotizaciones' });
    } finally {
      setLoadingQuotes(false);
    }
  };

  const loadQuotationToCart = (quote: any) => {
    setCart(quote.items || []);
    setCustomerName(quote.customer_name);
    setSelectedQuoteId(quote.id);
    setShowQuotationsDialog(false);
    toast({ title: 'Cotización Cargada', description: `Se cargó el presupuesto ${quote.quote_number}` });
  };
  // -------------------------
  // Adjustment States (Notas Crédito/Débito)
  const [adjustmentForm, setAdjustmentForm] = useState({
    refDoc: '',
    customerName: '',
    reason: '',
    items: [] as CartItem[],
    total: 0
  });

  // Arqueo States
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

  const handleResetArqueo = () => {
    setCashDenominations({
      '100.00': 0, '50.00': 0, '20.00': 0, '10.00': 0, '5.00': 0, '1.00': 0,
      '0.25': 0, '0.10': 0, '0.05': 0, '0.01': 0
    });
    setExpenses([]);
    setPhysicalCard(0);
    setPhysicalTransfer(0);
    setPhysicalCredit(0);
    setPhysicalCheck(0);
    toast({ title: "Arqueo Reiniciado", description: "Los valores de conteo han sido restaurados a cero." });
  };
  const [expenses, setExpenses] = useState<{description: string, amount: number}[]>([]);
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');

  // Physical counts for other payment methods
  const [physicalCard, setPhysicalCard] = useState<number>(0);
  const [physicalTransfer, setPhysicalTransfer] = useState<number>(0);
  const [physicalCredit, setPhysicalCredit] = useState<number>(0);
  const [physicalCheck, setPhysicalCheck] = useState<number>(0);


  // Checkout Modal States
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentReference, setPaymentReference] = useState('');
  const [cashReceived, setCashReceived] = useState<string>('');

  // Estados para datos cargados desde Supabase
  const [cashConfig, setCashConfig] = useState<any>({ cashFloat: 100 });
  const [inventory, setInventory] = useState<any[]>([]);
  const [pendingIncomingQty, setPendingIncomingQty] = useState<Record<string, number>>({});

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

  const handleFetchSaleDetails = async (sale: any) => {
    setLoadingDetails(true);
    setIsDetailsDialogOpen(true);
    try {
      const { data: items, error } = await supabase
        .from('sales_items')
        .select('*, inventory:inventory(name)')
        .eq('sale_id', sale.id);

      if (error) throw error;

      const mappedItems = (items || []).map((item: any) => ({
        ...item,
        name: item.inventory?.name || 'Producto General'
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


  // Función para cargar todos los datos requeridos de forma reactiva
  const loadBillingData = async () => {
    try {
      setLoadingData(true);

      // Cargar clientes
      const { data: custData } = await supabase.from('customers').select('*').order('name');
      setCustomers(custData || []);

      // Cargar bodegas
      const { data: whData } = await supabase.from('warehouses').select('*').order('name');
      setWarehouses(whData || []);

      // Cargar ventas realizadas
      const { data: salesData } = await supabase
        .from('sales')
        .select('*')
        .order('created_at', { ascending: false });
      
      setSalesAll((salesData || []).map(s => ({
        id: s.id,
        correlative: s.correlative,
        docType: s.doc_type,
        customerId: s.customer_id,
        total: parseFloat(s.total) || 0,
        status: s.status,
        timestamp: s.created_at,
        paymentMethod: s.payment_method || 'Efectivo',
        customer: s.customer_name || 'Consumidor Final'
      })));

      // Cargar abonos realizados registrados en el diario contable
      const { data: jData } = await supabase
        .from('journal')
        .select('*')
        .eq('type', 'Ingreso')
      setJournalPayments(jData || []);

      // Cargar cash_config desde system_config
      const { data: cashConfData } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'cash_config')
        .maybeSingle();
      if (cashConfData?.value) {
        setCashConfig(cashConfData.value);
      }

      // Cargar pre-traslados / traslados en tránsito
      const { data: pendingTransfers } = await supabase
        .from('transfers')
        .select('*')
        .in('status', ['PETICION', 'ENVIADO']);
      
      const incomingMap: Record<string, number> = {};
      const activeWhName = activeWarehouse?.name || activeStation?.warehouse_name;
      if (activeWhName) {
        (pendingTransfers || []).forEach((t: any) => {
          if (t.destination === activeWhName) {
            (t.items || []).forEach((item: any) => {
              incomingMap[item.sku] = (incomingMap[item.sku] || 0) + (parseFloat(item.quantity) || 0);
            });
          }
        });
      }
      setPendingIncomingQty(incomingMap);

    } catch (e: any) {
      console.error('Error al cargar datos en facturación:', e);
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
    setLoadingData(true);
    try {
      const { data: whData } = await supabase.from('warehouses').select('*');
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
  }, []);

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

  // Arqueo Calculations
  const systemCashSales = useMemo(() => 
    salesAll?.filter(s => s.paymentMethod === 'Efectivo' && s.status !== 'CANCELADA')
      .reduce((acc, s) => acc + (s.total || 0), 0) || 0
  , [salesAll]);

  // Cart Functions
  const totalCart = useMemo(() => cart.reduce((acc, item) => acc + (item.price * item.quantity), 0), [cart]);

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

  const creditValidation = useMemo(() => {
    if (!selectedCustomer) {
      return {
        disabled: true,
        reason: 'Registre o seleccione un cliente de la cartera para evaluar la viabilidad del crédito.'
      };
    }

    if (!selectedCustomer.is_authorized_credit) {
      return {
        disabled: true,
        reason: `Bloqueado por Gerencia: El cliente "${selectedCustomer.name}" no está autorizado para realizar compras al crédito.`
      };
    }

    if (pendingCreditInvoices.length > 0) {
      return {
        disabled: true,
        reason: `Bloqueado por Mora: El cliente posee ${pendingCreditInvoices.length} factura(s) al crédito pendiente(s) de pago.`
      };
    }

    const limit = parseFloat(selectedCustomer.credit_limit) || 0;
    const nextTotalDebt = outstandingDebt + totalCart;
    if (nextTotalDebt > limit) {
      return {
        disabled: true,
        reason: `Bloqueado por Límite: Deuda actual ($${outstandingDebt.toFixed(2)}) + compra actual ($${totalCart.toFixed(2)}) superan el límite de $${limit.toFixed(2)}.`
      };
    }

    return {
      disabled: false,
      reason: `Crédito Autorizado: Límite de $${limit.toFixed(2)} disponible. Deuda pendiente actual: $${outstandingDebt.toFixed(2)}.`
    };
  }, [selectedCustomer, pendingCreditInvoices, outstandingDebt, totalCart]);

  // Revertir forma de pago a Efectivo si el crédito queda invalidado dinámicamente
  useEffect(() => {
    if (paymentMethod === 'Credito' && creditValidation.disabled) {
      setPaymentMethod('Efectivo');
      toast({
        variant: "destructive",
        title: "Pago Revertido a Efectivo",
        description: "El crédito del cliente seleccionado no cumple con las reglas vigentes en este momento."
      });
    }
  }, [creditValidation.disabled, paymentMethod, toast]);

  const systemCardSales = useMemo(() => 
    salesAll?.filter(s => s.paymentMethod === 'Tarjeta' && s.status !== 'CANCELADA')
      .reduce((acc, s) => acc + (s.total || 0), 0) || 0
  , [salesAll]);

  const systemTransferSales = useMemo(() => 
    salesAll?.filter(s => s.paymentMethod === 'Transferencia' && s.status !== 'CANCELADA')
      .reduce((acc, s) => acc + (s.total || 0), 0) || 0
  , [salesAll]);

  const systemCreditSales = useMemo(() => 
    salesAll?.filter(s => s.paymentMethod === 'Credito' && s.status !== 'CANCELADA')
      .reduce((acc, s) => acc + (s.total || 0), 0) || 0
  , [salesAll]);

  const systemCheckSales = useMemo(() => 
    salesAll?.filter(s => s.paymentMethod === 'Cheque' && s.status !== 'CANCELADA')
      .reduce((acc, s) => acc + (s.total || 0), 0) || 0
  , [salesAll]);

  const totalPhysicalCash = useMemo(() => 
    Object.entries(cashDenominations).reduce((acc, [den, qty]) => acc + (parseFloat(den) * qty), 0)
  , [cashDenominations]);

  const totalExpenses = useMemo(() => 
    expenses.reduce((acc, e) => acc + e.amount, 0)
  , [expenses]);

  const cashDifference = useMemo(() => 
    totalPhysicalCash - (systemCashSales + (cashConfig?.cashFloat || 0) - totalExpenses)
  , [totalPhysicalCash, systemCashSales, cashConfig, totalExpenses]);

  const cardDifference = useMemo(() => physicalCard - systemCardSales, [physicalCard, systemCardSales]);
  const transferDifference = useMemo(() => physicalTransfer - systemTransferSales, [physicalTransfer, systemTransferSales]);
  const creditDifference = useMemo(() => physicalCredit - systemCreditSales, [physicalCredit, systemCreditSales]);
  const checkDifference = useMemo(() => physicalCheck - systemCheckSales, [physicalCheck, systemCheckSales]);


  // Cart Functions

  const changeDue = useMemo(() => {
    const received = parseFloat(cashReceived) || 0;
    return Math.max(0, received - totalCart);
  }, [cashReceived, totalCart]);

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { id: product.id, name: product.name, sku: product.sku || 'N/A', price: product.price || 0, quantity: 1 }];
    });
  };

  const handleOpenCheckout = () => {
    if (cart.length === 0) {
      toast({ variant: "destructive", title: "Carrito vacío" });
      return;
    }

    const deductWh = activeWarehouse || (warehouses.length > 0 ? warehouses[0] : null);
    if (deductWh) {
      for (const item of cart) {
        const product = inventory.find(p => p.sku === item.sku);
        const physical = product ? (product.bodegas?.[deductWh.name] || 0) : 0;
        const pendingIncoming = pendingIncomingQty[item.sku] || 0;
        const available = physical + pendingIncoming;
        if (available < item.quantity) {
          toast({ 
            variant: "destructive", 
            title: "Stock Insuficiente Detectado", 
            description: `El producto "${item.name}" no tiene existencias físicas ni en pre-traslados suficientes en "${deductWh.name}". Disponible: ${physical} (Físico) + ${pendingIncoming} (En Tránsito), Solicitado: ${item.quantity}.` 
          });
          return;
        }
      }
    }

    setCashReceived('');
    setPaymentReference('');
    setIsCheckoutOpen(true);
  };

  const handleFinalizeSale = async () => {
    if (paymentMethod === 'Efectivo' && (parseFloat(cashReceived) || 0) < totalCart) {
      toast({ variant: "destructive", title: "Monto Insuficiente" });
      return;
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
        if (available < item.quantity) {
          toast({
            variant: "destructive",
            title: "Stock Insuficiente",
            description: `El producto "${item.name}" (${item.sku}) no tiene suficiente stock físico ni pre-traslados en la bodega "${deductWh.name}". Disponible: ${physical} (Físico) + ${pendingIncoming} (En Tránsito), Requerido: ${item.quantity}.`
          });
          setIsProcessing(false);
          return;
        }
      }

      const correlative = `${docType}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
      const selectedCust = customers.find(c => c.name === customerName);

      // 1. Insert into public.sales
      const { data: insertedSale, error: saleErr } = await supabase
        .from('sales')
        .insert({
          correlative,
          doc_type: docType,
          customer_id: selectedCust ? selectedCust.id : null,
          total: totalCart,
          status: paymentMethod === 'Credito' ? 'PENDIENTE' : 'ACTIVA',
          payment_method: paymentMethod,
          customer_name: customerName || (docType === 'CF' ? 'Consumidor Final' : 'Cliente CCF'),
          seller_email: user?.email || null,
          station_name: activeStation?.name || null
        })
        .select()
        .single();

      if (saleErr) throw saleErr;

      // 2. Insert items into public.sales_items
      const itemsToInsert = cart.map(item => ({
        sale_id: insertedSale.id,
        sku: item.sku,
        quantity: item.quantity,
        price: item.price,
        subtotal: item.quantity * item.price
      }));

      const { error: itemsErr } = await supabase
        .from('sales_items')
        .insert(itemsToInsert);

      if (itemsErr) throw itemsErr;

      // 3. Update Inventory Stock (subtract purchased quantity from assigned warehouse)
      if (deductWh) {
        for (const item of cart) {
          const currentStock = stockMap[item.sku] || 0;
          const newQty = currentStock - item.quantity; // Allow negative stock for pending pre-transfers

          await supabase
            .from('inventory_stock')
            .upsert({
              sku: item.sku,
              warehouse_id: deductWh.id,
              quantity: newQty
            }, {
              onConflict: 'sku,warehouse_id'
            });
        }
      }

      // Marcar cotización como FACTURADA si se usó una
      if (selectedQuoteId) {
        await supabase
          .from('quotations')
          .update({ status: 'FACTURADA' })
          .eq('id', selectedQuoteId);
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
          items: cart.map(i => ({ name: i.name, quantity: i.quantity, price: i.price }))
        });
      }

      toast({ title: "Venta Exitosa", description: "DTE enviado por correo." });
      setCart([]);
      setCustomerName('');
      setCustomerEmail('');
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

    try {
      const { error } = await supabase
        .from(table_name)
        .insert({
          ref_doc: adjustmentForm.refDoc,
          customer_name: adjustmentForm.customerName || 'Cliente General',
          reason: adjustmentForm.reason,
          items: adjustmentForm.items,
          total: totalAdjustment,
          status: 'EMITIDA'
        });

      if (error) throw error;
      
      // Si es nota de crédito (devolución), reintegrar stock en la primera bodega
      if (type === 'CREDITO' && warehouses.length > 0) {
        const defaultWh = warehouses[0];
        for (const item of adjustmentForm.items) {
          const product = inventory?.find((p: any) => p.sku === item.sku);
          if (product) {
            const currentStock = product.bodegas[defaultWh.name] || 0;
            const newQty = currentStock + item.quantity;

            await supabase
              .from('inventory_stock')
              .upsert({
                sku: item.sku,
                warehouse_id: defaultWh.id,
                quantity: newQty
              }, {
                onConflict: 'sku,warehouse_id'
              });
          }
        }
      }

      toast({ 
        title: `Nota de ${type === 'CREDITO' ? 'Crédito' : 'Débito'} Emitida`, 
        description: `Se procesó el ajuste por $${totalAdjustment.toFixed(2)}.` 
      });
      setAdjustmentForm({ refDoc: '', customerName: '', reason: '', items: [], total: 0 });
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
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('daily_closings')
        .insert({
          date: new Date().toISOString().split('T')[0],
          cash_float: cashConfig?.cashFloat || 0,
          system_cash_sales: systemCashSales,
          physical_cash_found: totalPhysicalCash,
          expenses: totalExpenses,
          difference: cashDifference,
          denominations: cashDenominations,
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
          closed_by: user?.email || 'Admin'
        });

      if (error) throw error;
      toast({ title: "Cierre de Día Guardado", description: "El arqueo ha sido formalizado." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error al guardar cierre", description: e.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-gradient-to-tr from-slate-50 via-white to-slate-100 dark:from-[#0a0a14] dark:via-[#12103a] dark:to-[#0a1a14] p-4 md:p-6 transition-colors duration-300 print:bg-white print:p-0 relative overflow-x-hidden text-slate-900 dark:text-white">
      {/* Orbes decorativos */}
      <div className="pointer-events-none fixed top-[-100px] left-[300px] w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(91,94,244,0.18)_0%,transparent_70%)] hidden dark:block" />
      <div className="pointer-events-none fixed bottom-[0] right-[100px] w-[350px] h-[350px] rounded-full bg-[radial-gradient(circle,rgba(16,185,129,0.12)_0%,transparent_70%)] hidden dark:block" />
      <div className="pointer-events-none fixed top-[50%] left-[40%] w-[18vw] h-[18vw] rounded-full bg-violet-500/3 dark:bg-violet-500/5 blur-[90px] dark:hidden" />
      
      {/* Header Estilo Terminal */}
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4 print:hidden relative z-10 bg-white/40 dark:bg-white/5 backdrop-blur-md border border-white/50 dark:border-white/10 p-4 px-6 rounded-2xl">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10" onClick={() => router.push('/')}>
            <ArrowLeft className="text-slate-600 dark:text-white/50" size={16} />
          </Button>
          <div>
            <h1 className="text-sm md:text-base font-bold font-headline">Terminal de Ventas NexWay</h1>
            <p className="text-[11px] text-slate-500 dark:text-white/40 mt-0.5">Gestión de caja y facturación con DTE</p>
            {activeStation ? (
              <div className="flex items-center gap-1.5 mt-1">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 dark:bg-[#5b5ef4]/20 text-blue-700 dark:text-[#7c7fff] border border-blue-200 dark:border-[#5b5ef4]/30">
                  <Store size={10} /> {activeStation.name}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/25">
                  <Warehouse size={10} /> {activeStation.warehouse_name}
                </span>
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
              disabled={!isUserAdmin || !!establishedStationId}
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
                isUserAdmin && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleEstablishStation}
                    className="h-8 px-3 border-indigo-500/30 text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 dark:bg-indigo-500/15 hover:bg-indigo-500/20 rounded-lg text-[11px] font-medium"
                  >
                    Establecer Caja
                  </Button>
                )
              )
            )}
          </div>
          <ModeToggle />
        </div>
      </div>

      <div className="max-w-7xl mx-auto print:hidden relative z-10">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 w-full">
          <TabsList className="bg-transparent p-0 h-auto flex flex-wrap w-full justify-start overflow-x-auto no-scrollbar border-b border-slate-200 dark:border-white/10 gap-1 px-4 sm:px-6">
            {config?.['billing_facturacion'] !== false && (
              <TabsTrigger value="facturacion" className="rounded-none px-4 py-3 font-medium text-[12.5px] text-slate-500 dark:text-white/40 data-[state=active]:text-blue-600 dark:data-[state=active]:text-[#7c7fff] data-[state=active]:border-b-2 data-[state=active]:border-blue-600 dark:data-[state=active]:border-[#5b5ef4] data-[state=active]:bg-transparent hover:text-slate-800 dark:hover:text-white/70 data-[state=active]:shadow-none transition-colors">
                <ShoppingCart size={14} className="mr-1.5" /> Venta
              </TabsTrigger>
            )}
            {config?.['billing_historial'] !== false && (
              <TabsTrigger value="historial" className="rounded-none px-4 py-3 font-medium text-[12.5px] text-slate-500 dark:text-white/40 data-[state=active]:text-blue-600 dark:data-[state=active]:text-[#7c7fff] data-[state=active]:border-b-2 data-[state=active]:border-blue-600 dark:data-[state=active]:border-[#5b5ef4] data-[state=active]:bg-transparent hover:text-slate-800 dark:hover:text-white/70 data-[state=active]:shadow-none transition-colors">
                <History size={14} className="mr-1.5" /> Historial
              </TabsTrigger>
            )}
            {config?.['billing_nota_credito'] !== false && (
              <TabsTrigger value="nota_credito" className="rounded-none px-4 py-3 font-medium text-[12.5px] text-slate-500 dark:text-white/40 data-[state=active]:text-blue-600 dark:data-[state=active]:text-[#7c7fff] data-[state=active]:border-b-2 data-[state=active]:border-blue-600 dark:data-[state=active]:border-[#5b5ef4] data-[state=active]:bg-transparent hover:text-slate-800 dark:hover:text-white/70 data-[state=active]:shadow-none transition-colors">
                <RotateCcw size={14} className="mr-1.5" /> Nota Crédito
              </TabsTrigger>
            )}
            {config?.['billing_nota_debito'] !== false && (
              <TabsTrigger value="nota_debito" className="rounded-none px-4 py-3 font-medium text-[12.5px] text-slate-500 dark:text-white/40 data-[state=active]:text-blue-600 dark:data-[state=active]:text-[#7c7fff] data-[state=active]:border-b-2 data-[state=active]:border-blue-600 dark:data-[state=active]:border-[#5b5ef4] data-[state=active]:bg-transparent hover:text-slate-800 dark:hover:text-white/70 data-[state=active]:shadow-none transition-colors">
                <TrendingUp size={14} className="mr-1.5" /> Nota Débito
              </TabsTrigger>
            )}
            {config?.['billing_arqueo'] !== false && (
              <TabsTrigger value="arqueo" className="rounded-none px-4 py-3 font-medium text-[12.5px] text-slate-500 dark:text-white/40 data-[state=active]:text-blue-600 dark:data-[state=active]:text-[#7c7fff] data-[state=active]:border-b-2 data-[state=active]:border-blue-600 dark:data-[state=active]:border-[#5b5ef4] data-[state=active]:bg-transparent hover:text-slate-800 dark:hover:text-white/70 data-[state=active]:shadow-none transition-colors">
                <Calculator size={14} className="mr-1.5" /> Arqueo / Cierre
              </TabsTrigger>
            )}
            {config?.['billing_creditos'] !== false && (
              <TabsTrigger value="creditos" className="rounded-none px-4 py-3 font-medium text-[12.5px] text-slate-500 dark:text-white/40 data-[state=active]:text-blue-600 dark:data-[state=active]:text-[#7c7fff] data-[state=active]:border-b-2 data-[state=active]:border-blue-600 dark:data-[state=active]:border-[#5b5ef4] data-[state=active]:bg-transparent hover:text-slate-800 dark:hover:text-white/70 data-[state=active]:shadow-none transition-colors">
                <Wallet size={14} className="mr-1.5" /> Créditos / Abonos
              </TabsTrigger>
            )}
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
                    {['Efectivo', 'Tarjeta', 'Cheque', 'Transferencia'].map(method => (
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
                        {method}
                      </button>
                    ))}
                    <button 
                      onClick={() => setPaymentMethod('Credito')}
                      disabled={creditValidation.disabled}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-medium transition-colors border ${
                        paymentMethod === 'Credito'
                          ? 'bg-blue-500/10 dark:bg-[#5b5ef4]/25 border-blue-500/30 dark:border-[#5b5ef4]/50 text-blue-700 dark:text-[#7c7fff]' 
                          : 'bg-white/50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/50 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white/80'
                      } ${creditValidation.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <Receipt size={13} /> Crédito
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10.5px] text-slate-500 dark:text-white/30 mt-2">
                    <AlertCircle size={13} className="text-slate-400 dark:text-white/20" /> Registre o seleccione un cliente para evaluar la viabilidad del crédito.
                  </div>
                </div>
              </div>

              <button 
                onClick={handleOpenCheckout} 
                disabled={cart.length === 0}
                className="w-full rounded-[11px] p-[15px] text-[14px] font-bold text-white text-center cursor-pointer bg-blue-600/90 hover:bg-blue-600 dark:bg-[#5b5ef4]/35 dark:border dark:border-[#5b5ef4]/50 hover:dark:bg-[#5b5ef4]/50 tracking-[0.3px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={16} /> FINALIZAR Y NOTIFICAR
              </button>
            </div>

            {/* Columna Derecha: Catálogo POS (Ancho: 7/12) */}
            <div className="lg:col-span-7 space-y-6">
              
              <div className="flex justify-between items-center">
                 <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">Facturación Rápida</h2>
                 <div className="flex gap-2">
                   <Button 
                     variant="outline" 
                     onClick={() => { fetchQuotations(); setShowQuotationsDialog(true); }}
                     className="h-9 text-xs font-bold bg-white/50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/50 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors"
                   >
                     <FileText size={14} className="mr-2" />
                     Cotización
                   </Button>
                   <Button 
                     variant="outline" 
                     className="h-9 text-xs font-bold bg-amber-500/10 dark:bg-amber-500/20 border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 dark:hover:bg-amber-500/30 rounded-xl transition-colors"
                   >
                     <Clock size={14} className="mr-2" />
                     Pendientes
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
                  </div>
                </div>
                <div className="w-full sm:w-48 space-y-1.5">
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
                          onClick={() => {
                            addToCart(p);
                            setSearchTerm('');
                            setInventory([]);
                          }}
                          className="p-3 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer rounded-xl border-b last:border-none border-slate-100 dark:border-white/5 flex justify-between items-center transition-colors"
                        >
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-bold text-slate-800 dark:text-white/80">{p.name}</span>
                            <span className="text-[9px] text-slate-500 dark:text-white/40 font-mono">SKU: {p.sku} • Stock: {p.quantity}</span>
                          </div>
                          <span className="text-xs font-bold text-blue-600 dark:text-[#7c7fff]">${p.price.toFixed(2)}</span>
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
                        <TableHead className="text-[10px] font-medium uppercase text-slate-400 dark:text-white/30 tracking-wide w-12 text-center h-10">#</TableHead>
                        <TableHead className="text-[10px] font-medium uppercase text-slate-400 dark:text-white/30 tracking-wide h-10">Producto</TableHead>
                        <TableHead className="text-[10px] font-medium uppercase text-slate-400 dark:text-white/30 tracking-wide h-10">SKU</TableHead>
                        <TableHead className="text-[10px] font-medium uppercase text-slate-400 dark:text-white/30 tracking-wide text-right h-10">Precio unit.</TableHead>
                        <TableHead className="text-[10px] font-medium uppercase text-slate-400 dark:text-white/30 tracking-wide text-center w-24 h-10">Cantidad</TableHead>
                        <TableHead className="text-[10px] font-medium uppercase text-slate-400 dark:text-white/30 tracking-wide text-right h-10">Descuento</TableHead>
                        <TableHead className="text-[10px] font-medium uppercase text-slate-400 dark:text-white/30 tracking-wide text-right pr-6 h-10">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cart.length === 0 ? (
                        <TableRow className="hover:bg-transparent border-none">
                          <TableCell colSpan={7} className="text-center py-10 bg-transparent">
                            <div className="flex flex-col items-center justify-center gap-2">
                              <Package size={28} className="text-slate-300 dark:text-white/10 mb-1" />
                              <p className="text-[12px] text-slate-500 dark:text-white/20 text-center leading-relaxed">No hay productos agregados<br/>Agrega productos para comenzar la venta.</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : cart.map((item, idx) => (
                        <TableRow key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 border-b border-slate-100 dark:border-white/5 transition-colors">
                          <TableCell className="text-center text-xs font-mono text-slate-400 dark:text-white/40 pr-0">{idx + 1}</TableCell>
                          <TableCell className="font-medium text-xs text-slate-800 dark:text-white/80 py-4">{item.name}</TableCell>
                          <TableCell className="text-xs font-mono text-slate-400 dark:text-white/40">{item.sku}</TableCell>
                          <TableCell className="text-right text-xs font-medium text-slate-600 dark:text-white/60">${item.price.toFixed(2)}</TableCell>
                          <TableCell className="text-center">
                            <span className="text-xs font-bold text-slate-800 dark:text-white/80 bg-slate-100 dark:bg-white/10 px-2.5 py-1 rounded-lg">
                              {item.quantity}
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-xs font-medium text-slate-400 dark:text-white/40">$0.00</TableCell>
                          <TableCell className="text-right text-xs font-bold text-blue-600 dark:text-[#7c7fff] pr-6">${(item.price * item.quantity).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                
                {/* Fila de Totales en el Pie de la Tabla */}
                <div className="flex items-center justify-between p-[14px_16px] border-t border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-transparent">
                  <div className="flex flex-col gap-[3px]">
                    <span className="text-[10px] text-slate-400 dark:text-white/30 uppercase tracking-[.5px] font-medium">Subtotal</span>
                    <span className="text-[14px] font-semibold text-slate-700 dark:text-white/70">${totalCart.toFixed(2)}</span>
                  </div>
                  <div className="flex flex-col gap-[3px]">
                    <span className="text-[10px] text-slate-400 dark:text-white/30 uppercase tracking-[.5px] font-medium">Descuento</span>
                    <span className="text-[14px] font-semibold text-slate-700 dark:text-white/70">$0.00</span>
                  </div>
                  <div className="flex flex-col gap-[3px] text-right">
                    <span className="text-[10px] text-slate-400 dark:text-white/30 uppercase tracking-[.5px] font-medium">Total a pagar</span>
                    <span className="text-[18px] font-bold text-blue-600 dark:text-[#7c7fff]">${totalCart.toFixed(2)}</span>
                  </div>
                </div>
              </div>

            </div>

            </div>
          </TabsContent>

          {/* TAB NOTA CREDITO */}
          <TabsContent value="nota_credito" className="grid grid-cols-1 lg:grid-cols-12 gap-6 outline-none">
             <div className="lg:col-span-5 space-y-4">
                <div className="bg-white/40 dark:bg-white/5 backdrop-blur-md border border-white/50 dark:border-white/10 rounded-[13px] overflow-hidden shadow-sm dark:shadow-none flex flex-col">
                   <div className="bg-rose-500/10 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 p-5 border-b border-rose-500/20">
                      <h3 className="text-sm font-bold">Nota de Crédito (Ajuste)</h3>
                      <p className="text-4xl font-black mt-2">${adjustmentForm.items.reduce((acc, i) => acc + (i.price * i.quantity), 0).toFixed(2)}</p>
                   </div>
                   <div className="p-0">
                      <ScrollArea className="h-[300px]">
                         <Table>
                            <TableBody>
                               {adjustmentForm.items.length === 0 ? (
                                  <TableRow className="hover:bg-transparent border-none">
                                    <TableCell colSpan={3} className="text-center py-20 text-slate-500 dark:text-white/30 text-xs italic border-none">
                                      Agregue ítems a descontar
                                    </TableCell>
                                  </TableRow>
                               ) : adjustmentForm.items.map((item, idx) => (
                                <TableRow key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 border-b border-slate-100 dark:border-white/5 transition-colors">
                                      <TableCell className="font-medium text-xs text-slate-800 dark:text-white/80">{item.quantity}x {item.name}</TableCell>
                                      <TableCell className="text-right font-bold text-rose-600 dark:text-rose-400">-${(item.price * item.quantity).toFixed(2)}</TableCell>
                                      <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" className="hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 h-8 w-8" onClick={() => setAdjustmentForm({...adjustmentForm, items: adjustmentForm.items.filter(i => i.id !== item.id)})}>
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
                  className="w-full h-[56px] rounded-[13px] bg-rose-500/10 dark:bg-rose-500/20 hover:bg-rose-500/20 dark:hover:bg-rose-500/30 text-rose-700 dark:text-rose-400 border border-rose-500/30 font-bold text-[14px] transition-colors shadow-none flex items-center justify-center disabled:opacity-50"
                  onClick={() => handleProcessAdjustment('CREDITO')}
                  disabled={isProcessing || adjustmentForm.items.length === 0}
                >
                  {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <RotateCcw className="mr-2" size={18} />}
                  EMITIR NOTA DE CRÉDITO
                </button>
             </div>
             <div className="lg:col-span-7 space-y-4">
                <div className="p-5 bg-white/40 dark:bg-white/5 backdrop-blur-md border border-white/50 dark:border-white/10 rounded-[13px] shadow-sm dark:shadow-none space-y-4">
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                         <Label className="text-[10px] font-medium uppercase text-slate-500 dark:text-white/30 tracking-wider">Documento Referencia</Label>
                         <Input placeholder="FACT-001 / CCF-001" value={adjustmentForm.refDoc} onChange={e => setAdjustmentForm({...adjustmentForm, refDoc: e.target.value})} className="h-10 bg-white/50 dark:bg-black/20 border-slate-200 dark:border-white/10 rounded-[10px] text-xs font-medium text-slate-800 dark:text-white/70" />
                      </div>
                      <div className="space-y-1.5">
                         <Label className="text-[10px] font-medium uppercase text-slate-500 dark:text-white/30 tracking-wider">Cliente</Label>
                          <Input placeholder="Nombre del cliente..." value={adjustmentForm.customerName} onChange={e => setAdjustmentForm({...adjustmentForm, customerName: e.target.value})} className="h-10 bg-white/50 dark:bg-black/20 border-slate-200 dark:border-white/10 rounded-[10px] text-xs font-medium text-slate-800 dark:text-white/70" />
                      </div>
                   </div>
                   <div className="space-y-1.5">
                      <Label className="text-[10px] font-medium uppercase text-slate-500 dark:text-white/30 tracking-wider">Motivo del Ajuste / Devolución</Label>
                      <Select 
                        value={adjustmentForm.reason} 
                        onValueChange={(val) => setAdjustmentForm({...adjustmentForm, reason: val})}
                      >
                        <SelectTrigger className="h-10 rounded-[10px] bg-white/50 dark:bg-black/20 border-slate-200 dark:border-white/10 text-xs font-medium text-slate-800 dark:text-white/70">
                          <SelectValue placeholder="Seleccione el motivo de la Nota de Crédito" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl dark:bg-[#0a0a14] dark:border-white/10">
                          <SelectItem value="Devoluciones de mercancías (Cliente retorna producto)">Devoluciones de mercancías</SelectItem>
                          <SelectItem value="Anulación o Invalidación fuera de tiempo legal">Anulaciones o Invalidadas fuera de tiempo</SelectItem>
                          <SelectItem value="Descuentos o bonificaciones post-venta concedidos">Descuentos o bonificaciones post-venta</SelectItem>
                          <SelectItem value="Corrección de errores a la baja (Precio o cantidad menor)">Corrección de errores (A la baja)</SelectItem>
                        </SelectContent>
                      </Select>
                   </div>
                </div>
                <form onSubmit={handleSearchInventory} className="relative flex gap-3">
                    <div className="relative flex-1">
                       <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/30" size={16} />
                       <Input 
                         placeholder="Buscar productos para devolución (Presione Enter)..." 
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
                                 <span className="text-[9px] text-slate-500 dark:text-white/40 font-mono">SKU: {p.sku}</span>
                               </div>
                               <span className="text-xs font-bold text-rose-600 dark:text-rose-400">${p.price.toFixed(2)}</span>
                             </div>
                           ))}
                         </div>
                       )}
                    </div>
                    <button type="submit" className="h-[48px] bg-rose-500/10 dark:bg-rose-500/20 hover:bg-rose-500/20 dark:hover:bg-rose-500/30 border border-rose-500/30 text-rose-700 dark:text-rose-400 font-semibold rounded-[10px] shadow-none px-6 transition-colors flex items-center gap-2 whitespace-nowrap text-[13px] shrink-0">
                       <Search size={15} /> Buscar
                    </button>
                </form>
             </div>
          </TabsContent>

          {/* TAB NOTA DEBITO */}
          <TabsContent value="nota_debito" className="grid grid-cols-1 lg:grid-cols-12 gap-6 outline-none">
             <div className="lg:col-span-5 space-y-4">
                <div className="bg-white/40 dark:bg-white/5 backdrop-blur-md border border-white/50 dark:border-white/10 rounded-[13px] overflow-hidden shadow-sm dark:shadow-none flex flex-col">
                   <div className="bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 p-5 border-b border-amber-500/20">
                      <h3 className="text-sm font-bold">Nota de Débito (Cargo Extra)</h3>
                      <p className="text-4xl font-black mt-2">${adjustmentForm.items.reduce((acc, i) => acc + (i.price * i.quantity), 0).toFixed(2)}</p>
                   </div>
                   <div className="p-0">
                      <ScrollArea className="h-[300px]">
                         <Table>
                            <TableBody>
                               {adjustmentForm.items.length === 0 ? (
                                  <TableRow className="hover:bg-transparent border-none">
                                    <TableCell colSpan={3} className="text-center py-20 text-slate-500 dark:text-white/30 text-xs italic border-none">
                                      Agregue conceptos de cargo
                                    </TableCell>
                                  </TableRow>
                               ) : adjustmentForm.items.map((item, idx) => (
                                <TableRow key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 border-b border-slate-100 dark:border-white/5 transition-colors">
                                      <TableCell className="font-medium text-xs text-slate-800 dark:text-white/80">{item.quantity}x {item.name}</TableCell>
                                      <TableCell className="text-right font-bold text-amber-600 dark:text-amber-400">+${(item.price * item.quantity).toFixed(2)}</TableCell>
                                      <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" className="hover:bg-amber-100 dark:hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 h-8 w-8" onClick={() => setAdjustmentForm({...adjustmentForm, items: adjustmentForm.items.filter(i => i.id !== item.id)})}>
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
                  className="w-full h-[56px] rounded-[13px] bg-amber-500/10 dark:bg-amber-500/20 hover:bg-amber-500/20 dark:hover:bg-amber-500/30 text-amber-700 dark:text-amber-400 border border-amber-500/30 font-bold text-[14px] transition-colors shadow-none flex items-center justify-center disabled:opacity-50"
                  onClick={() => handleProcessAdjustment('DEBITO')}
                  disabled={isProcessing || adjustmentForm.items.length === 0}
                >
                  {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <TrendingUp className="mr-2" size={18} />}
                  EMITIR NOTA DE DÉBITO
                </button>
             </div>
             <div className="lg:col-span-7 space-y-4">
                <div className="p-5 bg-white/40 dark:bg-white/5 backdrop-blur-md border border-white/50 dark:border-white/10 rounded-[13px] shadow-sm dark:shadow-none space-y-4">
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                         <Label className="text-[10px] font-medium uppercase text-slate-500 dark:text-white/30 tracking-wider">Documento Referencia</Label>
                         <Input placeholder="FACT-001 / CCF-001" value={adjustmentForm.refDoc} onChange={e => setAdjustmentForm({...adjustmentForm, refDoc: e.target.value})} className="h-10 bg-white/50 dark:bg-black/20 border-slate-200 dark:border-white/10 rounded-[10px] text-xs font-medium text-slate-800 dark:text-white/70" />
                      </div>
                      <div className="space-y-1.5">
                         <Label className="text-[10px] font-medium uppercase text-slate-500 dark:text-white/30 tracking-wider">Cliente</Label>
                         <Input placeholder="Nombre del cliente..." value={adjustmentForm.customerName} onChange={e => setAdjustmentForm({...adjustmentForm, customerName: e.target.value})} className="h-10 bg-white/50 dark:bg-black/20 border-slate-200 dark:border-white/10 rounded-[10px] text-xs font-medium text-slate-800 dark:text-white/70" />
                      </div>
                   </div>
                   <div className="space-y-1.5">
                      <Label className="text-[10px] font-medium uppercase text-slate-500 dark:text-white/30 tracking-wider">Razón del Cargo Adicional</Label>
                      <Select 
                        value={adjustmentForm.reason} 
                        onValueChange={(val) => setAdjustmentForm({...adjustmentForm, reason: val})}
                      >
                        <SelectTrigger className="h-10 rounded-[10px] bg-white/50 dark:bg-black/20 border-slate-200 dark:border-white/10 text-xs font-medium text-slate-800 dark:text-white/70">
                          <SelectValue placeholder="Seleccione el motivo de la Nota de Débito" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl dark:bg-[#0a0a14] dark:border-white/10">
                          <SelectItem value="Intereses por mora (Cargos financieros por atraso)">Intereses por mora</SelectItem>
                          <SelectItem value="Gastos de transporte o fletes adicionales cobrados a posteriori">Gastos de transporte o fletes adicionales</SelectItem>
                          <SelectItem value="Diferencias de precio al alza (Precio cobrado fue menor al real)">Diferencias de precio (Al alza)</SelectItem>
                        </SelectContent>
                      </Select>
                   </div>
                </div>
                <div className="p-4 bg-amber-50/50 dark:bg-amber-500/10 border border-amber-200/50 dark:border-amber-500/20 rounded-[13px] flex items-start gap-3">
                   <AlertCircle className="text-amber-600 dark:text-amber-400 mt-0.5" size={16} />
                   <p className="text-[11px] text-amber-800 dark:text-amber-200 leading-relaxed font-medium">Las notas de débito incrementan el valor del documento original. Asegúrese de que el concepto sea legalmente válido.</p>
                </div>
                <form onSubmit={handleSearchInventory} className="relative flex gap-3">
                    <div className="relative flex-1">
                       <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/30" size={16} />
                       <Input 
                         placeholder="Buscar conceptos de cargo (Presione Enter)..." 
                         value={searchTerm} 
                         onChange={e => {
                           setSearchTerm(e.target.value);
                           if (!e.target.value) setInventory([]);
                         }} 
                         className="pl-11 h-[48px] bg-white/40 dark:bg-white/5 backdrop-blur-md border-slate-200 dark:border-white/10 shadow-sm dark:shadow-none rounded-[10px] text-xs font-medium text-slate-800 dark:text-white/70 focus-visible:ring-amber-500" 
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
                                 <span className="text-[9px] text-slate-500 dark:text-white/40 font-mono">SKU: {p.sku}</span>
                               </div>
                               <span className="text-xs font-bold text-amber-600 dark:text-amber-400">${p.price.toFixed(2)}</span>
                             </div>
                           ))}
                         </div>
                       )}
                    </div>
                    <button type="submit" className="h-[48px] bg-amber-500/10 dark:bg-amber-500/20 hover:bg-amber-500/20 dark:hover:bg-amber-500/30 border border-amber-500/30 text-amber-700 dark:text-amber-400 font-semibold rounded-[10px] shadow-none px-6 transition-colors flex items-center gap-2 whitespace-nowrap text-[13px] shrink-0">
                       <Search size={15} /> Buscar
                    </button>
                </form>
             </div>
          </TabsContent>

           {/* TAB HISTORIAL */}
          <TabsContent value="historial" className="outline-none">
            <div className="bg-white/40 dark:bg-white/5 backdrop-blur-md border border-white/50 dark:border-white/10 rounded-[13px] overflow-hidden shadow-sm dark:shadow-none">
              <div className="p-4 border-b border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-black/20">
                <p className="text-[10px] font-bold text-slate-500 dark:text-white/30 uppercase tracking-wider mb-1">Consejo de uso</p>
                <p className="text-[11px] text-slate-600 dark:text-white/50">Haz <strong>doble clic</strong> sobre cualquier venta en la lista para ver el detalle de los productos facturados e imprimir el comprobante en PDF.</p>
              </div>
              <Table>
                <TableHeader className="bg-slate-100/50 dark:bg-transparent">
                  <TableRow className="border-b border-slate-200 dark:border-white/5 hover:bg-transparent">
                    <TableHead className="px-6 text-[10px] font-medium uppercase text-slate-500 dark:text-white/40 tracking-wide">Hora</TableHead>
                    <TableHead className="text-[10px] font-medium uppercase text-slate-500 dark:text-white/40 tracking-wide">Tipo</TableHead>
                    <TableHead className="text-[10px] font-medium uppercase text-slate-500 dark:text-white/40 tracking-wide">Cliente</TableHead>
                    <TableHead className="text-right text-[10px] font-medium uppercase text-slate-500 dark:text-white/40 tracking-wide">Total</TableHead>
                    <TableHead className="text-center text-[10px] font-medium uppercase text-slate-500 dark:text-white/40 tracking-wide">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesAll?.map((sale: any) => (
                    <TableRow 
                      key={sale.id} 
                      className="cursor-pointer hover:bg-slate-50/50 dark:hover:bg-white/5 select-none transition-colors border-b border-slate-100 dark:border-white/5"
                      onDoubleClick={() => handleFetchSaleDetails(sale)}
                    >
                      <TableCell className="px-6 text-[11px] text-slate-600 dark:text-white/60 font-mono">{new Date(sale.timestamp).toLocaleTimeString()}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[9px] border-slate-200 dark:border-white/10 dark:text-white/70">{sale.docType}</Badge></TableCell>
                      <TableCell className="font-medium text-[12px] text-slate-800 dark:text-white/80">{sale.customer}</TableCell>
                      <TableCell className="text-right font-bold text-[12px] text-slate-800 dark:text-white/90">${sale.total.toFixed(2)}</TableCell>
                      <TableCell className="text-center"><Badge className="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20 text-[9px] uppercase tracking-wider">{sale.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

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

                <DialogFooter className="border-t pt-3 flex items-center justify-between sm:justify-between gap-3">
                  <Button 
                    variant="outline" 
                    className="rounded-xl h-10 text-xs font-bold" 
                    onClick={() => setIsDetailsDialogOpen(false)}
                  >
                    Cerrar
                  </Button>
                  {selectedSaleDetails && (
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
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* TAB ARQUEO */}
          <TabsContent value="arqueo" className="space-y-6 outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Conteo de Billetes/Monedas */}
              <div className="lg:col-span-5 space-y-6">
                <div className="bg-white/40 dark:bg-white/5 backdrop-blur-md border border-white/50 dark:border-white/10 rounded-[13px] overflow-hidden shadow-sm dark:shadow-none">
                  <div className="bg-slate-900/80 dark:bg-black/40 text-white p-5 flex flex-row items-center justify-between border-b border-white/10">
                    <div>
                      <h3 className="text-sm font-bold flex items-center gap-2">
                        <Coins size={18} className="text-amber-400 animate-pulse" /> Conteo de Efectivo
                      </h3>
                      <p className="text-[10px] text-slate-300 dark:text-white/50 mt-1">Registre la cantidad de billetes y monedas físicas en caja.</p>
                    </div>
                    <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10 font-bold text-xs px-3 py-1">
                      Total: ${totalPhysicalCash.toFixed(2)}
                    </Badge>
                  </div>
                  <div className="p-5 space-y-6">
                    {/* Billetes */}
                    <div className="space-y-3">
                      <h4 className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span> Billetes Registrados
                      </h4>
                      <div className="grid grid-cols-1 gap-2.5">
                        {['100.00', '50.00', '20.00', '10.00', '5.00'].map(den => {
                          const qty = cashDenominations[den] || 0;
                          const subtotal = parseFloat(den) * qty;
                          return (
                            <div key={den} className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50/50 dark:bg-muted/10 border border-slate-100 dark:border-border/60 hover:border-emerald-100 dark:hover:border-emerald-900/30 transition-all">
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-14 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/30 flex items-center justify-center text-[11px] font-black text-emerald-600 dark:text-emerald-400">
                                  ${parseInt(den)}
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 dark:text-muted-foreground">Billetes</span>
                              </div>
                              
                              <div className="flex items-center gap-4">
                                <div className="flex items-center bg-white dark:bg-muted/60 rounded-xl p-0.5 border dark:border-border/40 shadow-sm">
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-muted font-bold"
                                    onClick={() => adjustDenomination(den, -1)}
                                  >
                                    -
                                  </Button>
                                  <Input 
                                    type="number" 
                                    className="h-6 w-10 text-center font-black text-xs p-0 border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-slate-800 dark:text-foreground" 
                                    value={qty || ''} 
                                    placeholder="0"
                                    onFocus={e => e.target.select()}
                                    onChange={e => setCashDenominations({...cashDenominations, [den]: parseInt(e.target.value) || 0})}
                                  />
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-muted font-bold"
                                    onClick={() => adjustDenomination(den, 1)}
                                  >
                                    +
                                  </Button>
                                </div>
                                <div className="text-right w-20">
                                  <span className="text-xs font-black text-slate-700 dark:text-slate-200">${subtotal.toFixed(2)}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Monedas */}
                    <div className="space-y-3 pt-2">
                      <h4 className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-wider flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span> Monedas Registradas
                      </h4>
                      <div className="grid grid-cols-1 gap-2.5">
                        {['1.00', '0.25', '0.10', '0.05', '0.01'].map(den => {
                          const qty = cashDenominations[den] || 0;
                          const subtotal = parseFloat(den) * qty;
                          return (
                            <div key={den} className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50/50 dark:bg-muted/10 border border-slate-100 dark:border-border/60 hover:border-amber-100 dark:hover:border-amber-900/30 transition-all">
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/30 flex items-center justify-center text-[10px] font-black text-amber-600 dark:text-amber-400">
                                  ¢{parseFloat(den) < 1 ? parseInt(String(parseFloat(den) * 100)) : '1.00'}
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 dark:text-muted-foreground">Moneda {parseFloat(den) >= 1 ? '$1.00' : `¢${parseInt(String(parseFloat(den) * 100))}`}</span>
                              </div>
                              
                              <div className="flex items-center gap-4">
                                <div className="flex items-center bg-white dark:bg-muted/60 rounded-xl p-0.5 border dark:border-border/40 shadow-sm">
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-muted font-bold"
                                    onClick={() => adjustDenomination(den, -1)}
                                  >
                                    -
                                  </Button>
                                  <Input 
                                    type="number" 
                                    className="h-6 w-10 text-center font-black text-xs p-0 border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-slate-800 dark:text-foreground" 
                                    value={qty || ''} 
                                    placeholder="0"
                                    onFocus={e => e.target.select()}
                                    onChange={e => setCashDenominations({...cashDenominations, [den]: parseInt(e.target.value) || 0})}
                                  />
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-muted font-bold"
                                    onClick={() => adjustDenomination(den, 1)}
                                  >
                                    +
                                  </Button>
                                </div>
                                <div className="text-right w-20">
                                  <span className="text-xs font-black text-slate-700 dark:text-slate-200">${subtotal.toFixed(2)}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Conciliación y Gastos */}
              <div className="lg:col-span-7 space-y-6">
                
                {/* Modern KPI summary cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-white/40 dark:bg-white/5 backdrop-blur-md border border-white/50 dark:border-white/10 rounded-[13px] shadow-sm dark:shadow-none">
                    <p className="text-[9px] font-medium uppercase text-slate-500 dark:text-white/40 tracking-wider">Fondo Base</p>
                    <p className="text-lg font-bold text-blue-600 dark:text-[#7c7fff] mt-1">${(cashConfig?.cashFloat || 0).toFixed(2)}</p>
                    <span className="text-[9px] text-slate-400 dark:text-white/30 block mt-0.5">Fondo inicial asignado</span>
                  </div>
                  
                  <div className="p-4 bg-white/40 dark:bg-white/5 backdrop-blur-md border border-white/50 dark:border-white/10 rounded-[13px] shadow-sm dark:shadow-none">
                    <p className="text-[9px] font-medium uppercase text-slate-500 dark:text-white/40 tracking-wider">Ventas Sistema</p>
                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1">${systemCashSales.toFixed(2)}</p>
                    <span className="text-[9px] text-slate-400 dark:text-white/30 block mt-0.5">En caja (Efectivo)</span>
                  </div>

                  <div className="p-4 bg-white/40 dark:bg-white/5 backdrop-blur-md border border-white/50 dark:border-white/10 rounded-[13px] shadow-sm dark:shadow-none">
                    <p className="text-[9px] font-medium uppercase text-slate-500 dark:text-white/40 tracking-wider">Egresos Caja</p>
                    <p className="text-lg font-bold text-rose-500 dark:text-rose-400 mt-1">-${totalExpenses.toFixed(2)}</p>
                    <span className="text-[9px] text-slate-400 dark:text-white/30 block mt-0.5">Gastos menores liquidados</span>
                  </div>

                  <div className={`p-4 bg-white/40 dark:bg-white/5 backdrop-blur-md border rounded-[13px] transition-all duration-300 ${
                    cashDifference === 0 
                      ? 'border-emerald-500/30 text-emerald-900 dark:text-emerald-400' 
                      : cashDifference < 0 
                      ? 'border-rose-500/30 text-rose-900 dark:text-rose-400' 
                      : 'border-blue-500/30 text-blue-900 dark:text-blue-400'
                  }`}>
                    <p className="text-[9px] font-medium uppercase tracking-wider opacity-70">Diferencia</p>
                    <p className="text-lg font-bold mt-1">
                      {cashDifference > 0 ? '+' : ''}${cashDifference.toFixed(2)}
                    </p>
                    <span className="text-[9px] font-medium block mt-0.5">
                      {cashDifference === 0 ? '✓ Caja Cuadrada' : cashDifference < 0 ? '⚠ Faltante en Caja' : '💡 Sobrante en Caja'}
                    </span>
                  </div>
                </div>

                {/* Conciliación de Otros Medios de Pago */}
                <div className="bg-white/40 dark:bg-white/5 backdrop-blur-md border border-white/50 dark:border-white/10 rounded-[13px] overflow-hidden shadow-sm dark:shadow-none">
                  <div className="bg-slate-900/80 dark:bg-black/40 text-white p-4 border-b border-white/10">
                    <h3 className="text-sm font-bold flex items-center gap-2">
                      <CardIcon size={18} className="text-blue-400" /> Conciliación de Medios Electrónicos y Crédito
                    </h3>
                  </div>
                  <div className="p-0">
                    <Table>
                      <TableHeader className="bg-slate-50 dark:bg-muted/40">
                        <TableRow className="border-b dark:border-border">
                          <TableHead className="text-[10px] uppercase font-black px-6 py-3 text-slate-500 dark:text-muted-foreground">Medio de Pago</TableHead>
                          <TableHead className="text-right text-[10px] uppercase font-black py-3 text-slate-500 dark:text-muted-foreground">Ventas Sistema</TableHead>
                          <TableHead className="text-right text-[10px] uppercase font-black w-36 py-3 text-slate-500 dark:text-muted-foreground">Físico / Vales</TableHead>
                          <TableHead className="text-right text-[10px] uppercase font-black px-6 py-3 text-slate-500 dark:text-muted-foreground">Diferencia</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow className="hover:bg-slate-50/50 dark:hover:bg-muted/10 border-b dark:border-border">
                          <TableCell className="font-bold text-xs px-6 py-3 flex items-center gap-2.5 text-slate-900 dark:text-foreground">
                            <CardIcon size={14} className="text-blue-500" /> Tarjeta
                          </TableCell>
                          <TableCell className="text-right font-black text-xs text-slate-800 dark:text-foreground">${systemCardSales.toFixed(2)}</TableCell>
                          <TableCell className="text-right py-2">
                            <Input 
                              type="number" 
                              className="h-8 w-24 text-right font-bold text-xs ml-auto rounded-xl bg-slate-50 dark:bg-muted border-slate-200 dark:border-border" 
                              value={physicalCard || ''} 
                              placeholder="0.00"
                              onFocus={e => e.target.select()}
                              onChange={e => setPhysicalCard(parseFloat(e.target.value) || 0)} 
                            />
                          </TableCell>
                          <TableCell className={`text-right font-black text-xs px-6 ${cardDifference === 0 ? 'text-emerald-600' : cardDifference < 0 ? 'text-rose-600' : 'text-blue-600'}`}>
                            {cardDifference > 0 ? '+' : ''}${cardDifference.toFixed(2)}
                          </TableCell>
                        </TableRow>
                        
                        <TableRow className="hover:bg-slate-50/50 dark:hover:bg-muted/10 border-b dark:border-border">
                          <TableCell className="font-bold text-xs px-6 py-3 flex items-center gap-2.5 text-slate-900 dark:text-foreground">
                            <FileText size={14} className="text-purple-500" /> Cheque
                          </TableCell>
                          <TableCell className="text-right font-black text-xs text-slate-800 dark:text-foreground">${systemCheckSales.toFixed(2)}</TableCell>
                          <TableCell className="text-right py-2">
                            <Input 
                              type="number" 
                              className="h-8 w-24 text-right font-bold text-xs ml-auto rounded-xl bg-slate-50 dark:bg-muted border-slate-200 dark:border-border" 
                              value={physicalCheck || ''} 
                              placeholder="0.00"
                              onFocus={e => e.target.select()}
                              onChange={e => setPhysicalCheck(parseFloat(e.target.value) || 0)} 
                            />
                          </TableCell>
                          <TableCell className={`text-right font-black text-xs px-6 ${checkDifference === 0 ? 'text-emerald-600' : checkDifference < 0 ? 'text-rose-600' : 'text-blue-600'}`}>
                            {checkDifference > 0 ? '+' : ''}${checkDifference.toFixed(2)}
                          </TableCell>
                        </TableRow>

                        <TableRow className="hover:bg-slate-50/50 dark:hover:bg-muted/10 border-b dark:border-border">
                          <TableCell className="font-bold text-xs px-6 py-3 flex items-center gap-2.5 text-slate-900 dark:text-foreground">
                            <Landmark size={14} className="text-amber-500" /> Transferencia
                          </TableCell>
                          <TableCell className="text-right font-black text-xs text-slate-800 dark:text-foreground">${systemTransferSales.toFixed(2)}</TableCell>
                          <TableCell className="text-right py-2">
                            <Input 
                              type="number" 
                              className="h-8 w-24 text-right font-bold text-xs ml-auto rounded-xl bg-slate-50 dark:bg-muted border-slate-200 dark:border-border" 
                              value={physicalTransfer || ''} 
                              placeholder="0.00"
                              onFocus={e => e.target.select()}
                              onChange={e => setPhysicalTransfer(parseFloat(e.target.value) || 0)} 
                            />
                          </TableCell>
                          <TableCell className={`text-right font-black text-xs px-6 ${transferDifference === 0 ? 'text-emerald-600' : transferDifference < 0 ? 'text-rose-600' : 'text-blue-600'}`}>
                            {transferDifference > 0 ? '+' : ''}${transferDifference.toFixed(2)}
                          </TableCell>
                        </TableRow>

                        <TableRow className="hover:bg-slate-50/50 dark:hover:bg-muted/10 border-0">
                          <TableCell className="font-bold text-xs px-6 py-3 flex items-center gap-2.5 text-slate-900 dark:text-foreground">
                            <Receipt size={14} className="text-teal-500" /> Crédito
                          </TableCell>
                          <TableCell className="text-right font-black text-xs text-slate-800 dark:text-foreground">${systemCreditSales.toFixed(2)}</TableCell>
                          <TableCell className="text-right py-2">
                            <Input 
                              type="number" 
                              className="h-8 w-24 text-right font-bold text-xs ml-auto rounded-xl bg-slate-50 dark:bg-muted border-slate-200 dark:border-border" 
                              value={physicalCredit || ''} 
                              placeholder="0.00"
                              onFocus={e => e.target.select()}
                              onChange={e => setPhysicalCredit(parseFloat(e.target.value) || 0)} 
                            />
                          </TableCell>
                          <TableCell className={`text-right font-black text-xs px-6 ${creditDifference === 0 ? 'text-emerald-600' : creditDifference < 0 ? 'text-rose-600' : 'text-blue-600'}`}>
                            {creditDifference > 0 ? '+' : ''}${creditDifference.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Gastos de caja chica y acciones finales */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                  {/* Gastos de Caja */}
                  <div className="bg-white/40 dark:bg-white/5 backdrop-blur-md border border-white/50 dark:border-white/10 rounded-[13px] overflow-hidden shadow-sm dark:shadow-none">
                    <div className="p-5 border-b border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-transparent flex flex-row items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-rose-500/10 flex items-center justify-center">
                        <TrendingDown size={16} className="text-rose-500" /> 
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-white/80">Gastos Menores / Egresos</h3>
                        <p className="text-[10px] text-slate-500 dark:text-white/40">Egresos rápidos del día autorizados por caja.</p>
                      </div>
                    </div>
                    <div className="p-5 space-y-4">
                      <div className="flex gap-2">
                        <Input placeholder="Descripción..." value={expenseDesc} onChange={e => setExpenseDesc(e.target.value)} className="h-10 text-xs bg-slate-50 dark:bg-muted border-slate-100 dark:border-border rounded-xl text-foreground" />
                        <Input type="number" placeholder="0.00" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} className="h-10 w-20 text-xs bg-slate-50 dark:bg-muted border-slate-100 dark:border-border rounded-xl font-black text-rose-500" />
                        <Button onClick={addExpense} variant="secondary" size="icon" className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-muted dark:text-foreground hover:bg-slate-200 border-none flex-shrink-0"><Plus size={16}/></Button>
                      </div>
                      <ScrollArea className="h-40 pr-1">
                        {expenses.length === 0 ? (
                          <div className="text-center py-10 text-[11px] text-slate-400 italic">No hay egresos registrados.</div>
                        ) : expenses.map((exp, idx) => (
                          <div key={idx} className="flex justify-between items-center p-2 hover:bg-slate-50 dark:hover:bg-muted/30 border-b border-slate-50 dark:border-border/30 last:border-0 rounded-lg">
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{exp.description}</span>
                            <span className="text-xs font-black text-rose-500">-${exp.amount.toFixed(2)}</span>
                          </div>
                        ))}
                      </ScrollArea>
                    </div>
                  </div>

                  {/* Acciones de Arqueo */}
                  <div className="bg-white/40 dark:bg-white/5 backdrop-blur-md border border-white/50 dark:border-white/10 rounded-[13px] shadow-sm dark:shadow-none p-5 flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-slate-800 dark:text-white/80 uppercase tracking-wider">Finalizar Turno</h4>
                      <p className="text-[10px] text-slate-500 dark:text-white/40 leading-normal font-medium">
                        Asegúrese de contar billete por billete. Una vez formalizado el cierre de día, la sesión quedará bloqueada y los montos quedarán registrados en el historial de arqueo oficial para gerencia y auditoría.
                      </p>
                    </div>
                    
                    <div className="space-y-2.5 pt-2">
                      <Button className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black shadow-lg shadow-blue-500/20 transition-all text-xs" onClick={handleDayClosing} disabled={isProcessing}>
                        {isProcessing ? <Loader2 className="animate-spin mr-2" size={14} /> : <CheckCircle2 className="mr-2" size={14} />}
                        GUARDAR CIERRE DE JORNADA
                      </Button>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" className="h-10 rounded-xl bg-white/50 dark:bg-white/5 border-slate-200 dark:border-white/10 font-bold text-slate-700 dark:text-white/70 text-[10px] hover:bg-slate-100 dark:hover:bg-white/10" onClick={handlePrintReport}>
                          <Printer size={12} className="mr-1.5" />
                          IMPRIMIR REPORTES
                        </Button>
                        <Button variant="outline" className="h-10 rounded-xl border border-rose-200 dark:border-rose-950/60 hover:bg-rose-50 dark:hover:bg-rose-950/20 font-bold text-rose-600 dark:text-rose-400 text-[10px]" onClick={handleResetArqueo}>
                          <RotateCcw size={12} className="mr-1.5" />
                          LIMPIAR CONTEO
                        </Button>
                      </div>
                    </div>
                  </Card>
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
                  <div className="bg-slate-900/80 dark:bg-black/40 text-white p-5 flex flex-row items-center justify-between border-b border-white/10">
                    <div>
                      <h3 className="text-sm font-bold flex items-center gap-2">
                        <Wallet size={18} className="text-indigo-400" /> Cuentas por Cobrar (Créditos Activos)
                      </h3>
                      <p className="text-[10px] text-slate-300 dark:text-white/50 mt-1">
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
                        <TableHeader className="bg-slate-50 dark:bg-muted/40">
                          <TableRow className="border-b dark:border-border">
                            <TableHead className="text-[10px] uppercase font-black px-6 py-3 text-slate-500 dark:text-muted-foreground">Factura / Correlativo</TableHead>
                            <TableHead className="text-[10px] uppercase font-black py-3 text-slate-500 dark:text-muted-foreground">Cliente</TableHead>
                            <TableHead className="text-[10px] uppercase font-black py-3 text-slate-500 dark:text-muted-foreground">Fecha Venta</TableHead>
                            <TableHead className="text-right text-[10px] uppercase font-black py-3 text-slate-500 dark:text-muted-foreground">Total Venta</TableHead>
                            <TableHead className="text-right text-[10px] uppercase font-black py-3 text-slate-500 dark:text-muted-foreground">Total Abonado</TableHead>
                            <TableHead className="text-right text-[10px] uppercase font-black py-3 text-slate-500 dark:text-muted-foreground">Saldo Pendiente</TableHead>
                            <TableHead className="w-24 py-3 px-6"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {salesAll?.filter(s => s.paymentMethod === 'Credito' && s.status === 'PENDIENTE').length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center py-16 text-slate-400 italic text-xs">
                                🎉 No hay créditos pendientes de pago. ¡Todas las cuentas están al día!
                              </TableCell>
                            </TableRow>
                          ) : salesAll?.filter(s => s.paymentMethod === 'Credito' && s.status === 'PENDIENTE').map(s => {
                            const totalAbonado = journalPayments
                              ?.filter(j => j.description.includes(`[${s.correlative}]`))
                              .reduce((sum, j) => sum + (parseFloat(j.amount) || 0), 0) || 0;
                            
                            const saldoPendiente = s.total - totalAbonado;

                            return (
                              <TableRow key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-muted/10 border-b dark:border-border">
                                <TableCell className="font-mono font-bold text-xs px-6 py-4 text-slate-900 dark:text-foreground">
                                  {s.correlative}
                                </TableCell>
                                <TableCell className="font-bold text-xs text-slate-800 dark:text-slate-200">
                                  {s.customer}
                                </TableCell>
                                <TableCell className="text-xs text-slate-500 dark:text-muted-foreground">
                                  {new Date(s.timestamp).toLocaleDateString()}
                                </TableCell>
                                <TableCell className="text-right font-bold text-xs text-slate-900 dark:text-foreground">
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
              </div>

              {/* Historial de Abonos Recientes */}
              <div className="lg:col-span-4 space-y-4">
                <div className="bg-white/40 dark:bg-white/5 backdrop-blur-md border border-white/50 dark:border-white/10 rounded-[13px] overflow-hidden shadow-sm dark:shadow-none">
                  <div className="bg-slate-900/80 dark:bg-black/40 text-white p-4 border-b border-white/10 flex flex-row items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold flex items-center gap-2">
                        <History size={16} className="text-emerald-400" /> Abonos Recientes
                      </h3>
                      <p className="text-[10px] text-slate-300 dark:text-white/50 mt-1">Historial de abonos registrados el día de hoy.</p>
                    </div>
                  </div>
                  <div className="p-0">
                    <ScrollArea className="h-[400px]">
                      {journalPayments.length === 0 ? (
                        <div className="text-center py-20 text-xs text-slate-400 italic">No hay abonos registrados recientemente.</div>
                      ) : journalPayments.map(j => (
                        <div key={j.id} className="p-4 border-b border-slate-50 dark:border-border/30 last:border-0 hover:bg-slate-50/50 dark:hover:bg-muted/10 transition-all flex flex-col gap-1.5">
                          <div className="flex justify-between items-start">
                            <span className="text-[10px] font-black text-slate-900 dark:text-foreground line-clamp-2 pr-2">
                              {j.description}
                            </span>
                            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                              +${parseFloat(j.amount).toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-[9px] text-slate-400 dark:text-muted-foreground">
                            <span>{new Date(j.created_at).toLocaleDateString()} a las {new Date(j.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            <Badge variant="outline" className="text-[8px] h-4 py-0 font-bold bg-slate-50 dark:bg-muted text-slate-500">Ingreso Caja</Badge>
                          </div>
                        </div>
                      ))}
                    </ScrollArea>
                  </div>
                </div>
              </div>

            </div>
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
                 <div className="flex justify-between border-t pt-2 text-lg font-black">
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

        <div className="space-y-4">
           <h2 className="text-lg font-black border-b pb-2 uppercase text-blue-800">Historial de Ventas del Día</h2>
           <Table className="border text-[10px]">
              <TableHeader>
                 <TableRow className="bg-gray-100">
                    <TableHead>Hora</TableHead>
                    <TableHead>DTE/Doc</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                 </TableRow>
              </TableHeader>
              <TableBody>
                 {salesAll?.map((sale: any) => (
                    <TableRow key={sale.id}>
                       <TableCell>{new Date(sale.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</TableCell>
                       <TableCell>{sale.docType}</TableCell>
                       <TableCell className="font-bold">{sale.customer}</TableCell>
                       <TableCell>{sale.paymentMethod}</TableCell>
                       <TableCell className="text-right font-black">${sale.total.toFixed(2)}</TableCell>
                    </TableRow>
                 ))}
              </TableBody>
           </Table>
        </div>

        <div className="grid grid-cols-2 gap-20 pt-20">
           <div className="border-t border-black text-center pt-4">
              <p className="text-sm font-black">Firma Cajero</p>
              <p className="text-[10px] text-gray-500 uppercase">{user?.email || 'Admin'}</p>
           </div>
           <div className="border-t border-black text-center pt-4">
              <p className="text-sm font-black">Firma Auditoría / Gerencia</p>
              <p className="text-[10px] text-gray-500 uppercase">NexWay Solutions</p>
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
            ) : (
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground">Referencia ({paymentMethod})</Label>
                <Input placeholder="ID Transacción..." value={paymentReference} onChange={e => setPaymentReference(e.target.value)} className="h-12 rounded-xl" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-lg shadow-xl" onClick={handleFinalizeSale} disabled={isProcessing}>
              {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2" />}
              COMPLETAR OPERACIÓN
            </Button>
          </DialogFooter>
        </DialogContent>
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
                <DialogTitle className="text-xl font-black flex items-center gap-2 text-slate-900 dark:text-foreground">
                  <Coins size={20} className="text-indigo-600 dark:text-indigo-400" /> Registrar Abono a Crédito
                </DialogTitle>
                <DialogDescription className="text-xs dark:text-muted-foreground">
                  Factura: <strong>{selectedSaleForAbono.correlative}</strong> | Cliente: <strong>{selectedSaleForAbono.customer}</strong>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-slate-50 dark:bg-muted/40 border dark:border-border rounded-xl">
                    <span className="text-[9px] font-black uppercase text-slate-400 block">Total de Venta</span>
                    <span className="text-sm font-black text-slate-950 dark:text-foreground">${selectedSaleForAbono.total.toFixed(2)}</span>
                  </div>
                  <div className="p-3 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/50 rounded-xl">
                    <span className="text-[9px] font-black uppercase text-rose-500 block">Saldo Pendiente</span>
                    <span className="text-sm font-black text-rose-600 dark:text-rose-400">${saldoPendiente.toFixed(2)}</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-500 dark:text-muted-foreground">Monto del Abono ($)</Label>
                  <Input 
                    type="number" 
                    placeholder="0.00" 
                    value={abonoAmount}
                    onChange={e => setAbonoAmount(e.target.value)}
                    className="h-11 bg-slate-50 dark:bg-muted border-slate-100 dark:border-border rounded-xl font-black text-emerald-600 dark:text-emerald-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-slate-500 dark:text-muted-foreground">Método de Pago</Label>
                  <Select value={abonoPaymentMethod} onValueChange={setAbonoPaymentMethod}>
                    <SelectTrigger className="h-11 bg-slate-50 dark:bg-muted border-slate-100 dark:border-border rounded-xl text-xs font-bold text-foreground">
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
                  <Label className="text-[10px] font-black uppercase text-slate-500 dark:text-muted-foreground">Notas del Abono</Label>
                  <Textarea 
                    placeholder="Referencia de pago, detalles..." 
                    value={abonoNotes}
                    onChange={e => setAbonoNotes(e.target.value)}
                    className="bg-slate-50 dark:bg-muted border-slate-100 dark:border-border rounded-xl text-xs text-foreground"
                    rows={2}
                  />
                </div>
              </div>
              <DialogFooter>
                <div className="flex gap-3 w-full">
                  <Button 
                    variant="outline"
                    className="flex-1 h-11 rounded-xl text-xs font-bold border-slate-200 dark:border-border text-foreground bg-white dark:bg-card" 
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

      {/* Diálogo de Importar Cotización */}
      <Dialog open={showQuotationsDialog} onOpenChange={setShowQuotationsDialog}>
        <DialogContent className="max-w-2xl bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-800 dark:text-slate-200 font-headline flex items-center gap-2">
              <FileText size={20} className="text-indigo-500" />
              Importar Cotización
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-muted-foreground">
              Seleccione un presupuesto pendiente para convertirlo en factura inmediatamente.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[300px] mt-4">
            {loadingQuotes ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                <Loader2 className="animate-spin" />
                <p className="text-xs font-bold">Cargando cotizaciones...</p>
              </div>
            ) : quotationsList.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                <FileText size={32} className="opacity-50" />
                <p className="text-xs font-bold">No hay cotizaciones pendientes</p>
              </div>
            ) : (
              <div className="space-y-3 pr-4">
                {quotationsList.map(q => (
                  <div key={q.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-2xl hover:border-indigo-300 dark:hover:border-indigo-700 cursor-pointer transition-colors" onClick={() => loadQuotationToCart(q)}>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">{q.quote_number}</h4>
                      <p className="text-xs text-slate-500 dark:text-muted-foreground mt-0.5"><Users size={12} className="inline mr-1"/>{q.customer_name}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{new Date(q.created_at).toLocaleString()}</p>
                    </div>
                    <div className="mt-3 sm:mt-0 text-right">
                      <p className="text-lg font-black text-indigo-600 dark:text-indigo-400">${Number(q.total).toFixed(2)}</p>
                      <Badge variant="outline" className="text-[9px] uppercase mt-1 bg-amber-500/10 text-amber-600 border-amber-500/20">{q.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}



