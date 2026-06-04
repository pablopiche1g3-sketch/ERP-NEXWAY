
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
import {  useFirestore, useCollection, useUser, useDoc, doc, collection  } from '@/supabase/compat';
import { supabase } from '@/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ModeToggle } from '@/components/mode-toggle';
import { sendDteEmail } from '@/ai/flows/send-dte-email-flow';
import { Textarea } from '@/components/ui/textarea';

interface CartItem {
  id: string;
  name: string;
  sku: string;
  price: number;
  quantity: number;
}

type PaymentMethod = 'Efectivo' | 'Tarjeta' | 'Transferencia' | 'Credito' | 'Cheque';


export default function BillingPage() {
  const db = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  // Caja/Bodega activa del usuario logueado
  const [activeStation, setActiveStation] = useState<any | null>(null);
  const [activeWarehouse, setActiveWarehouse] = useState<any | null>(null);

  // Cargar la caja asignada al usuario desde system_config + profiles
  useEffect(() => {
    const loadUserStation = async () => {
      if (!user?.email) return;
      // Buscar el perfil del usuario para obtener station_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('station_id')
        .eq('email', user.email)
        .maybeSingle();
      if (!profile?.station_id) return;

      // Buscar la estación en system_config
      const { data: stConf } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'pos_stations')
        .maybeSingle();
      const stations: any[] = stConf?.value || [];
      const station = stations.find((s: any) => s.id === profile.station_id);
      if (station) {
        setActiveStation(station);
        // Cargar info de la bodega
        const { data: wh } = await supabase
          .from('warehouses')
          .select('*')
          .eq('id', station.warehouse_id)
          .maybeSingle();
        setActiveWarehouse(wh || null);
      }
    };
    loadUserStation();
  }, [user]);
  const configRef = useMemo(() => doc(db, 'system', 'module_config'), [db]);
  const { data: config } = useDoc<any>(configRef);

  // Tab States
  const [activeTab, setActiveTab] = useState('facturacion');

  const tabsList = useMemo(() => [
    { id: 'facturacion', key: 'billing_facturacion' },
    { id: 'historial', key: 'billing_historial' },
    { id: 'nota_credito', key: 'billing_nota_credito' },
    { id: 'nota_debito', key: 'billing_nota_debito' },
    { id: 'arqueo', key: 'billing_arqueo' },
    { id: 'creditos', key: 'billing_creditos' },
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
        .like('description', 'Abono a Crédito [%');
      setJournalPayments(jData || []);

      // Cargar catálogo de inventario maestro y stock
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

    } catch (e: any) {
      console.error('Error al cargar datos en facturación:', e);
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

  // Filters
  const filteredProducts = useMemo(() => {
    if (!inventory || !searchTerm.trim()) return [];
    return inventory.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [searchTerm, inventory]);

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
    const correlative = `${docType}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    try {
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
      const deductWh = activeWarehouse || (warehouses.length > 0 ? warehouses[0] : null);
      if (deductWh) {
        for (const item of cart) {
          const product = inventory.find(p => p.sku === item.sku);
          const currentStock = product ? (product.bodegas[deductWh.name] || 0) : 0;
          const newQty = Math.max(0, currentStock - item.quantity);

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
    <div className="min-h-screen bg-background p-4 md:p-6 transition-colors duration-300 print:bg-white print:p-0">
      {/* Header Print Hidden */}
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="rounded-full bg-card shadow-sm border" onClick={() => router.push('/')}>
            <ArrowLeft className="text-foreground" size={20} />
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground font-headline">Terminal de Ventas NexWay</h1>
            <p className="text-muted-foreground text-xs md:text-sm">Gestión de caja y facturación con DTE</p>
            {activeStation ? (
              <div className="flex items-center gap-1.5 mt-1">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  <Store size={10} /> {activeStation.name}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <Warehouse size={10} /> {activeStation.warehouse_name}
                </span>
              </div>
            ) : (
              <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                ⚠ Sin caja asignada — stock global visible
              </span>
            )}
          </div>
        </div>
        <ModeToggle />
      </div>

      <div className="max-w-7xl mx-auto print:hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-card p-1 rounded-2xl shadow-sm border h-auto flex-wrap w-full justify-start overflow-x-auto no-scrollbar">
            {config?.['billing_facturacion'] !== false && (
              <TabsTrigger value="facturacion" className="rounded-xl px-4 py-2 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs md:text-sm whitespace-nowrap">
                <ShoppingCart size={14} className="mr-2" /> Venta
              </TabsTrigger>
            )}
            {config?.['billing_historial'] !== false && (
              <TabsTrigger value="historial" className="rounded-xl px-4 py-2 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs md:text-sm whitespace-nowrap">
                <History size={14} className="mr-2" /> Historial
              </TabsTrigger>
            )}
            {config?.['billing_nota_credito'] !== false && (
              <TabsTrigger value="nota_credito" className="rounded-xl px-4 py-2 font-bold data-[state=active]:bg-rose-600 data-[state=active]:text-white text-xs md:text-sm whitespace-nowrap">
                <RotateCcw size={14} className="mr-2" /> Nota Crédito
              </TabsTrigger>
            )}
            {config?.['billing_nota_debito'] !== false && (
              <TabsTrigger value="nota_debito" className="rounded-xl px-4 py-2 font-bold data-[state=active]:bg-amber-600 data-[state=active]:text-white text-xs md:text-sm whitespace-nowrap">
                <TrendingUp size={14} className="mr-2" /> Nota Débito
              </TabsTrigger>
            )}
            {config?.['billing_arqueo'] !== false && (
              <TabsTrigger value="arqueo" className="rounded-xl px-4 py-2 font-bold data-[state=active]:bg-blue-600 data-[state=active]:text-white text-xs md:text-sm whitespace-nowrap">
                <Calculator size={14} className="mr-2" /> Arqueo / Cierre
              </TabsTrigger>
            )}
            {config?.['billing_creditos'] !== false && (
              <TabsTrigger value="creditos" className="rounded-xl px-4 py-2 font-bold data-[state=active]:bg-indigo-600 data-[state=active]:text-white text-xs md:text-sm whitespace-nowrap">
                <Wallet size={14} className="mr-2" /> Créditos / Abonos
              </TabsTrigger>
            )}
          </TabsList>

          {/* TAB VENTA */}
          <TabsContent value="facturacion" className="grid grid-cols-1 lg:grid-cols-12 gap-8 outline-none animate-in fade-in duration-300">
            {/* Columna Izquierda: POS Carrito (Ancho: 5/12) */}
            <div className="lg:col-span-5 space-y-6">
              <Card className="border border-slate-200/60 dark:border-zinc-800/60 rounded-[28px] overflow-hidden bg-white dark:bg-zinc-900/60 shadow-sm">
                <CardHeader className="bg-[#0F172A] text-white p-6 dark:bg-zinc-950/40">
                  <div className="flex justify-between items-center mb-1">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-400">Resumen de Venta</CardTitle>
                    <Badge variant="outline" className="text-[9px] text-indigo-400 border-indigo-500/20 bg-indigo-500/5 font-black px-2.5 py-0.5 rounded-full tracking-wide uppercase">{docType}</Badge>
                  </div>
                  <p className="text-3xl font-black text-indigo-400 font-headline tracking-tight">${totalCart.toFixed(2)}</p>
                </CardHeader>
                <CardContent className="p-4 space-y-6">
                  {/* Listado de carrito simplificado */}
                  <ScrollArea className="h-[250px]">
                    <div className="space-y-2.5 pr-2">
                      {cart.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                          <ShoppingCart className="text-slate-300 dark:text-slate-700 animate-pulse mb-3" size={32} />
                          <p className="text-[10px] text-slate-400 dark:text-muted-foreground font-bold uppercase tracking-wider">Escanee productos o búsquelos en el catálogo</p>
                        </div>
                      ) : cart.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-zinc-950/40 border border-slate-100 dark:border-zinc-850 flex-wrap sm:flex-nowrap gap-2">
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{item.name}</h4>
                            <p className="text-[9px] text-muted-foreground font-mono mt-0.5">{item.sku} • ${item.price.toFixed(2)} c/u</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-black text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-zinc-800 px-2 py-1 rounded-lg">
                              {item.quantity}x
                            </span>
                            <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 min-w-[50px] text-right">
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

                  {/* Métodos de Pago */}
                  <div className="space-y-2 border-t pt-4 border-slate-100 dark:border-zinc-800/80">
                    <Label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Método de Pago</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                      <Button variant={paymentMethod === 'Efectivo' ? 'default' : 'outline'} size="sm" onClick={() => setPaymentMethod('Efectivo')} className="h-9 text-[9px] font-bold rounded-xl px-1">
                        <Wallet size={12} className="mr-1" /> Efectivo
                      </Button>
                      <Button variant={paymentMethod === 'Tarjeta' ? 'default' : 'outline'} size="sm" onClick={() => setPaymentMethod('Tarjeta')} className="h-9 text-[9px] font-bold rounded-xl px-1">
                        <CardIcon size={12} className="mr-1" /> Tarjeta
                      </Button>
                      <Button variant={paymentMethod === 'Cheque' ? 'default' : 'outline'} size="sm" onClick={() => setPaymentMethod('Cheque')} className="h-9 text-[9px] font-bold rounded-xl px-1">
                        <FileText size={12} className="mr-1" /> Cheque
                      </Button>
                      <Button variant={paymentMethod === 'Transferencia' ? 'default' : 'outline'} size="sm" onClick={() => setPaymentMethod('Transferencia')} className="h-9 text-[9px] font-bold rounded-xl px-1">
                        <Landmark size={12} className="mr-1" /> Transf.
                      </Button>
                      <Button 
                        variant={paymentMethod === 'Credito' ? 'default' : 'outline'} 
                        size="sm" 
                        onClick={() => setPaymentMethod('Credito')} 
                        disabled={creditValidation.disabled}
                        className="h-9 text-[9px] font-bold rounded-xl px-1"
                      >
                        <Receipt size={12} className="mr-1" /> Crédito
                      </Button>
                    </div>

                    {/* Banner Informativo de Crédito */}
                    <div className={`p-3 rounded-2xl border flex items-start gap-2.5 transition-all text-[9.5px] leading-relaxed font-semibold shadow-sm mt-3 ${
                      !selectedCustomer 
                        ? 'bg-slate-50 dark:bg-zinc-950/20 border-slate-100 dark:border-zinc-800/40 text-slate-500' 
                        : creditValidation.disabled 
                        ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-400' 
                        : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-400'
                    }`}>
                      <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                      <div>
                        {creditValidation.reason}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Button 
                onClick={handleOpenCheckout} 
                disabled={cart.length === 0}
                className="w-full h-16 rounded-[22px] bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-750 hover:to-indigo-750 text-white font-black text-sm tracking-widest shadow-xl shadow-indigo-600/10 hover:shadow-indigo-600/20 active:scale-98 transition-all uppercase font-headline"
              >
                FINALIZAR Y NOTIFICAR
              </Button>
            </div>

            {/* Columna Derecha: Catálogo POS (Ancho: 7/12) */}
            <div className="lg:col-span-7 space-y-6">
              
              <div className="flex justify-between items-center">
                 <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">Facturación Rápida</h2>
                 <Button 
                   variant="outline" 
                   onClick={() => { fetchQuotations(); setShowQuotationsDialog(true); }}
                   className="h-9 text-xs font-bold bg-white dark:bg-zinc-900 border-indigo-200 dark:border-indigo-900 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 rounded-xl"
                 >
                   <FileText size={14} className="mr-2" />
                   Importar Cotización
                 </Button>
              </div>

              {/* Cliente y DTE */}
              <Card className="p-4 bg-white dark:bg-zinc-900/60 rounded-[24px] border border-slate-200/60 dark:border-zinc-800/60 flex flex-col sm:flex-row gap-4">
                <div className="flex-1 space-y-1.5">
                  <Label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Cliente Receptor</Label>
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
                      className="h-10 bg-slate-50 dark:bg-zinc-950/60 border-slate-100 dark:border-zinc-800/60 rounded-xl text-xs font-bold" 
                    />
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="h-10 w-10 shrink-0 border-slate-200 dark:border-zinc-850 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl px-0 flex items-center justify-center">
                          <Users size={16} className="text-slate-500" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 p-0 rounded-2xl overflow-hidden bg-popover border shadow-lg" align="end">
                        <div className="p-3 border-b border-muted-foreground/10">
                          <Input placeholder="Buscar cliente..." value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} className="h-8 text-xs bg-muted/50 border-none rounded-lg" />
                        </div>
                        <ScrollArea className="h-48">
                          {filteredCustomers.map(c => (
                            <div key={c.id} onClick={() => { setSelectedCustomer(c); setCustomerName(c.name); setCustomerEmail(c.email || ''); setDocType(c.category === 'Crédito Fiscal' ? 'CCF' : 'CF'); }} className="p-3 hover:bg-slate-100 dark:hover:bg-zinc-900 cursor-pointer border-b border-muted-foreground/5 transition-colors">
                              <p className="text-[11px] font-bold text-foreground">{c.name}</p>
                              <p className="text-[9px] text-slate-400 dark:text-muted-foreground mt-0.5">{c.email || 'Sin correo registrado'}</p>
                            </div>
                          ))}
                        </ScrollArea>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div className="w-full sm:w-48 space-y-1.5">
                  <Label className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Tipo de DTE</Label>
                  <Select value={docType} onValueChange={(v: any) => setDocType(v)}>
                    <SelectTrigger className="h-10 rounded-xl bg-slate-50 dark:bg-zinc-950/60 border-slate-100 dark:border-zinc-800/60 text-xs font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CF">Factura CF</SelectItem>
                      <SelectItem value="CCF">Crédito Fiscal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </Card>

              {/* Input Buscador con Filtros */}
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={15} />
                  <Input 
                    placeholder="Buscar por SKU, código o nombre de producto..." 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                    className="pl-10 h-12 bg-white dark:bg-zinc-900/60 border-slate-200/60 dark:border-zinc-800/60 shadow-sm rounded-2xl text-xs md:text-sm font-semibold focus-visible:ring-indigo-500" 
                  />
                </div>
                <Button variant="outline" className="h-12 border-slate-200 dark:border-zinc-800/60 hover:bg-slate-100 dark:hover:bg-zinc-800 bg-white dark:bg-zinc-900/60 rounded-2xl px-4 flex items-center gap-2 text-xs font-bold shrink-0">
                  <SlidersHorizontal size={14} className="text-slate-500" />
                  Filtros
                </Button>
              </div>

              {/* Detalle de Productos en Tabla */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-400 tracking-wider uppercase">Detalle de productos</h3>
                
                <Card className="border border-slate-200/60 dark:border-zinc-800/60 rounded-[24px] overflow-hidden bg-white dark:bg-zinc-900/60 shadow-sm">
                  <div className="overflow-x-auto no-scrollbar">
                    <Table>
                      <TableHeader className="bg-slate-50 dark:bg-zinc-950/20 border-b border-slate-100 dark:border-zinc-800">
                        <TableRow>
                          <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-wide w-12 text-center">#</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-wide">Producto</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-wide">SKU</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-wide text-right">Precio unit.</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-wide text-center w-24">Cantidad</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-wide text-right">Descuento</TableHead>
                          <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-wide text-right pr-6">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cart.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-20 bg-transparent">
                              <div className="flex flex-col items-center justify-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-zinc-950/40 border flex items-center justify-center text-slate-400 dark:text-slate-600">
                                  <Package size={20} />
                                </div>
                                <p className="text-xs font-bold text-slate-400 dark:text-slate-500">No hay productos agregados</p>
                                <p className="text-[10px] text-slate-450 dark:text-slate-550 mt-[-4px]">Agrega productos para comenzar la venta.</p>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : cart.map((item, idx) => (
                          <TableRow key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-950/20 border-b border-slate-100 dark:border-zinc-850">
                            <TableCell className="text-center text-xs font-mono text-slate-400 pr-0">{idx + 1}</TableCell>
                            <TableCell className="font-bold text-xs text-foreground py-4">{item.name}</TableCell>
                            <TableCell className="text-xs font-mono text-slate-400">{item.sku}</TableCell>
                            <TableCell className="text-right text-xs font-semibold">${item.price.toFixed(2)}</TableCell>
                            <TableCell className="text-center">
                              <span className="text-xs font-black text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-zinc-800 px-2.5 py-1 rounded-lg font-headline">
                                {item.quantity}
                              </span>
                            </TableCell>
                            <TableCell className="text-right text-xs font-semibold text-slate-400">$0.00</TableCell>
                            <TableCell className="text-right text-xs font-black text-indigo-600 dark:text-indigo-400 pr-6 font-headline">${(item.price * item.quantity).toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </div>

              {/* Fila de Totales en el Pie */}
              <div className="grid grid-cols-3 gap-6 p-5 rounded-[24px] bg-slate-100/50 dark:bg-zinc-950/40 border border-slate-200/50 dark:border-zinc-800/40">
                <div className="space-y-0.5">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Subtotal</span>
                  <p className="text-sm font-black text-foreground font-headline">${totalCart.toFixed(2)}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Descuento</span>
                  <p className="text-sm font-black text-foreground font-headline">$0.00</p>
                </div>
                <div className="space-y-0.5 text-right">
                  <span className="text-[9px] font-black uppercase text-indigo-500 tracking-wider">Total a pagar</span>
                  <p className="text-lg font-black text-indigo-600 dark:text-indigo-400 font-headline">${totalCart.toFixed(2)}</p>
                </div>
              </div>

            </div>
          </TabsContent>

          {/* TAB NOTA CREDITO */}
          <TabsContent value="nota_credito" className="grid grid-cols-1 lg:grid-cols-12 gap-6 outline-none">
             <div className="lg:col-span-5 space-y-4">
                <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-card border">
                   <CardHeader className="bg-rose-700 text-white p-5">
                      <CardTitle className="text-sm font-bold">Nota de Crédito (Ajuste)</CardTitle>
                      <p className="text-4xl font-black">${adjustmentForm.items.reduce((acc, i) => acc + (i.price * i.quantity), 0).toFixed(2)}</p>
                   </CardHeader>
                   <CardContent className="p-0">
                      <ScrollArea className="h-[300px]">
                         <Table>
                            <TableBody>
                               {adjustmentForm.items.length === 0 ? (
                                  <TableRow><TableCell colSpan={3} className="text-center py-20 text-muted-foreground text-xs italic">Agregue ítems a descontar</TableCell></TableRow>
                               ) : adjustmentForm.items.map((item, idx) => (
                                  <TableRow key={idx}>
                                     <TableCell className="font-bold text-xs">{item.quantity}x {item.name}</TableCell>
                                     <TableCell className="text-right font-black text-rose-600">-${(item.price * item.quantity).toFixed(2)}</TableCell>
                                     <TableCell><Button variant="ghost" size="icon" onClick={() => setAdjustmentForm({...adjustmentForm, items: adjustmentForm.items.filter(i => i.id !== item.id)})}><Trash2 size={12}/></Button></TableCell>
                                  </TableRow>
                               ))}
                            </TableBody>
                         </Table>
                      </ScrollArea>
                   </CardContent>
                </Card>
                <Button 
                  className="w-full h-16 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-lg shadow-xl"
                  onClick={() => handleProcessAdjustment('CREDITO')}
                  disabled={isProcessing || adjustmentForm.items.length === 0}
                >
                  {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <RotateCcw className="mr-2" />}
                  EMITIR NOTA DE CRÉDITO
                </Button>
             </div>
             <div className="lg:col-span-7 space-y-4">
                <Card className="p-5 bg-card rounded-2xl border space-y-4">
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                         <Label className="text-[10px] font-black uppercase text-muted-foreground">Documento Referencia</Label>
                         <Input placeholder="FACT-001 / CCF-001" value={adjustmentForm.refDoc} onChange={e => setAdjustmentForm({...adjustmentForm, refDoc: e.target.value})} className="h-10 bg-muted border-none rounded-xl text-xs font-bold" />
                      </div>
                      <div className="space-y-1.5">
                         <Label className="text-[10px] font-black uppercase text-muted-foreground">Cliente</Label>
                         <Input placeholder="Nombre del cliente..." value={adjustmentForm.customerName} onChange={e => setAdjustmentForm({...adjustmentForm, customerName: e.target.value})} className="h-10 bg-muted border-none rounded-xl text-xs font-bold" />
                      </div>
                   </div>
                   <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground">Motivo del Ajuste / Devolución</Label>
                      <Textarea placeholder="Ej: Mercadería dañada, error en precio..." value={adjustmentForm.reason} onChange={e => setAdjustmentForm({...adjustmentForm, reason: e.target.value})} className="bg-muted border-none rounded-xl text-xs" />
                   </div>
                </Card>
                <div className="relative">
                   <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                   <Input placeholder="Buscar productos para devolución..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 h-12 bg-card border shadow-sm rounded-2xl text-xs" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                   {filteredProducts.slice(0, 8).map(p => (
                      <div key={p.id} onClick={() => addAdjustmentItem(p)} className="bg-card p-3 rounded-2xl border hover:border-rose-500 cursor-pointer transition-all flex flex-col justify-between aspect-square group">
                         <h3 className="text-[10px] font-bold leading-tight line-clamp-2">{p.name}</h3>
                         <div className="mt-2 pt-2 border-t flex justify-between items-center">
                            <span className="font-black text-rose-600">${p.price}</span>
                            <PlusCircle size={14} className="text-rose-500" />
                         </div>
                      </div>
                   ))}
                </div>
             </div>
          </TabsContent>

          {/* TAB NOTA DEBITO */}
          <TabsContent value="nota_debito" className="grid grid-cols-1 lg:grid-cols-12 gap-6 outline-none">
             <div className="lg:col-span-5 space-y-4">
                <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-card border">
                   <CardHeader className="bg-amber-600 text-white p-5">
                      <CardTitle className="text-sm font-bold">Nota de Débito (Cargo Extra)</CardTitle>
                      <p className="text-4xl font-black">${adjustmentForm.items.reduce((acc, i) => acc + (i.price * i.quantity), 0).toFixed(2)}</p>
                   </CardHeader>
                   <CardContent className="p-0">
                      <ScrollArea className="h-[300px]">
                         <Table>
                            <TableBody>
                               {adjustmentForm.items.length === 0 ? (
                                  <TableRow><TableCell colSpan={3} className="text-center py-20 text-muted-foreground text-xs italic">Agregue conceptos de cargo</TableCell></TableRow>
                               ) : adjustmentForm.items.map((item, idx) => (
                                  <TableRow key={idx}>
                                     <TableCell className="font-bold text-xs">{item.quantity}x {item.name}</TableCell>
                                     <TableCell className="text-right font-black text-amber-600">+${(item.price * item.quantity).toFixed(2)}</TableCell>
                                     <TableCell><Button variant="ghost" size="icon" onClick={() => setAdjustmentForm({...adjustmentForm, items: adjustmentForm.items.filter(i => i.id !== item.id)})}><Trash2 size={12}/></Button></TableCell>
                                  </TableRow>
                               ))}
                            </TableBody>
                         </Table>
                      </ScrollArea>
                   </CardContent>
                </Card>
                <Button 
                  className="w-full h-16 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-black text-lg shadow-xl"
                  onClick={() => handleProcessAdjustment('DEBITO')}
                  disabled={isProcessing || adjustmentForm.items.length === 0}
                >
                  {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <TrendingUp className="mr-2" />}
                  EMITIR NOTA DE DÉBITO
                </Button>
             </div>
             <div className="lg:col-span-7 space-y-4">
                <Card className="p-5 bg-card rounded-2xl border space-y-4">
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                         <Label className="text-[10px] font-black uppercase text-muted-foreground">Documento Referencia</Label>
                         <Input placeholder="FACT-001 / CCF-001" value={adjustmentForm.refDoc} onChange={e => setAdjustmentForm({...adjustmentForm, refDoc: e.target.value})} className="h-10 bg-muted border-none rounded-xl text-xs font-bold" />
                      </div>
                      <div className="space-y-1.5">
                         <Label className="text-[10px] font-black uppercase text-muted-foreground">Cliente</Label>
                         <Input placeholder="Nombre del cliente..." value={adjustmentForm.customerName} onChange={e => setAdjustmentForm({...adjustmentForm, customerName: e.target.value})} className="h-10 bg-muted border-none rounded-xl text-xs font-bold" />
                      </div>
                   </div>
                   <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground">Razón del Cargo Adicional</Label>
                      <Textarea placeholder="Ej: Intereses por mora, flete no cobrado, ajuste de precio..." value={adjustmentForm.reason} onChange={e => setAdjustmentForm({...adjustmentForm, reason: e.target.value})} className="bg-muted border-none rounded-xl text-xs" />
                   </div>
                </Card>
                <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-3">
                   <AlertCircle className="text-amber-600 mt-0.5" size={16} />
                   <p className="text-[10px] text-amber-700">Las notas de débito incrementan el valor del documento original. Asegúrese de que el concepto sea legalmente válido.</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                   {filteredProducts.slice(0, 4).map(p => (
                      <div key={p.id} onClick={() => addAdjustmentItem(p)} className="bg-card p-3 rounded-2xl border hover:border-amber-500 cursor-pointer transition-all flex flex-col justify-between aspect-square group">
                         <h3 className="text-[10px] font-bold leading-tight line-clamp-2">{p.name}</h3>
                         <div className="mt-2 pt-2 border-t flex justify-between items-center">
                            <span className="font-black text-amber-600">${p.price}</span>
                            <PlusCircle size={14} className="text-amber-500" />
                         </div>
                      </div>
                   ))}
                </div>
             </div>
          </TabsContent>

          {/* TAB HISTORIAL */}
          <TabsContent value="historial" className="outline-none">
            <Card className="border shadow-sm rounded-3xl bg-card overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="px-6 text-[10px] uppercase">Hora</TableHead>
                    <TableHead className="text-[10px] uppercase">Tipo</TableHead>
                    <TableHead className="text-[10px] uppercase">Cliente</TableHead>
                    <TableHead className="text-right text-[10px] uppercase">Total</TableHead>
                    <TableHead className="text-center text-[10px] uppercase">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesAll?.map((sale: any) => (
                    <TableRow key={sale.id}>
                      <TableCell className="px-6 text-[10px] md:text-xs text-muted-foreground">{new Date(sale.timestamp).toLocaleTimeString()}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[8px]">{sale.docType}</Badge></TableCell>
                      <TableCell className="font-bold text-[10px] md:text-xs">{sale.customer}</TableCell>
                      <TableCell className="text-right font-black text-[10px] md:text-xs">${sale.total.toFixed(2)}</TableCell>
                      <TableCell className="text-center"><Badge className="bg-emerald-100 text-emerald-600 text-[8px]">{sale.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* TAB ARQUEO */}
          <TabsContent value="arqueo" className="space-y-6 outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Conteo de Billetes/Monedas */}
              <div className="lg:col-span-5 space-y-6">
                <Card className="border shadow-sm rounded-3xl overflow-hidden bg-card border-slate-100 dark:border-border">
                  <CardHeader className="bg-slate-900 dark:bg-slate-950 text-white p-5 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-black flex items-center gap-2">
                        <Coins size={18} className="text-amber-400 animate-pulse" /> Conteo de Efectivo
                      </CardTitle>
                      <CardDescription className="text-[10px] text-slate-300 dark:text-muted-foreground mt-1">Registre la cantidad de billetes y monedas físicas en caja.</CardDescription>
                    </div>
                    <Badge variant="outline" className="border-emerald-500 text-emerald-400 bg-emerald-950/20 font-black text-xs px-3 py-1">
                      Total: ${totalPhysicalCash.toFixed(2)}
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-5 space-y-6">
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
                  </CardContent>
                </Card>
              </div>

              {/* Conciliación y Gastos */}
              <div className="lg:col-span-7 space-y-6">
                
                {/* Modern KPI summary cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="p-4 border shadow-sm rounded-3xl bg-white dark:bg-card border-slate-100 dark:border-border">
                    <p className="text-[9px] font-black uppercase text-slate-400 dark:text-muted-foreground tracking-wider">Fondo Base</p>
                    <p className="text-lg font-black text-blue-600 mt-1">${(cashConfig?.cashFloat || 0).toFixed(2)}</p>
                    <span className="text-[9px] text-slate-400 block mt-0.5">Fondo inicial asignado</span>
                  </Card>
                  
                  <Card className="p-4 border shadow-sm rounded-3xl bg-white dark:bg-card border-slate-100 dark:border-border">
                    <p className="text-[9px] font-black uppercase text-slate-400 dark:text-muted-foreground tracking-wider">Ventas Sistema</p>
                    <p className="text-lg font-black text-emerald-600 mt-1">${systemCashSales.toFixed(2)}</p>
                    <span className="text-[9px] text-slate-400 block mt-0.5">En caja (Efectivo)</span>
                  </Card>

                  <Card className="p-4 border shadow-sm rounded-3xl bg-white dark:bg-card border-slate-100 dark:border-border">
                    <p className="text-[9px] font-black uppercase text-slate-400 dark:text-muted-foreground tracking-wider">Egresos Caja</p>
                    <p className="text-lg font-black text-rose-500 mt-1">-${totalExpenses.toFixed(2)}</p>
                    <span className="text-[9px] text-slate-400 block mt-0.5">Gastos menores liquidados</span>
                  </Card>

                  <Card className={`p-4 border shadow-md rounded-3xl transition-all duration-300 ${
                    cashDifference === 0 
                      ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-400' 
                      : cashDifference < 0 
                      ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50 text-rose-900 dark:text-rose-400' 
                      : 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50 text-blue-900 dark:text-blue-400'
                  }`}>
                    <p className="text-[9px] font-black uppercase tracking-wider opacity-70">Diferencia</p>
                    <p className="text-lg font-black mt-1">
                      {cashDifference > 0 ? '+' : ''}${cashDifference.toFixed(2)}
                    </p>
                    <span className="text-[9px] font-bold block mt-0.5">
                      {cashDifference === 0 ? '✓ Caja Cuadrada' : cashDifference < 0 ? '⚠ Faltante en Caja' : '💡 Sobrante en Caja'}
                    </span>
                  </Card>
                </div>

                {/* Conciliación de Otros Medios de Pago */}
                <Card className="border shadow-sm rounded-3xl overflow-hidden bg-card border-slate-100 dark:border-border">
                  <CardHeader className="bg-slate-900 dark:bg-slate-950 text-white p-4 border-b dark:border-border">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <CardIcon size={18} className="text-blue-400" /> Conciliación de Medios Electrónicos y Crédito
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
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
                  </CardContent>
                </Card>

                {/* Gastos de caja chica y acciones finales */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                  {/* Gastos de Caja */}
                  <Card className="border shadow-sm rounded-3xl bg-card border-slate-100 dark:border-border">
                    <CardHeader className="p-5 border-b dark:border-border flex flex-row items-center gap-2">
                      <TrendingDown size={18} className="text-rose-500" /> 
                      <div>
                        <CardTitle className="text-sm font-bold text-slate-900 dark:text-foreground">Gastos Menores / Egresos</CardTitle>
                        <CardDescription className="text-[10px]">Egresos rápidos del día autorizados por caja.</CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent className="p-5 space-y-4">
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
                    </CardContent>
                  </Card>

                  {/* Acciones de Arqueo */}
                  <Card className="border shadow-sm rounded-3xl bg-card border-slate-100 dark:border-border p-5 flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <h4 className="text-xs font-black text-slate-800 dark:text-foreground uppercase tracking-wider">Finalizar Turno</h4>
                      <p className="text-[10px] text-slate-400 leading-normal">
                        Asegúrese de contar billete por billete. Una vez formalizado el cierre de día, la sesión quedará bloqueada y los montos quedarán registrados en el historial de arqueo oficial para gerencia y auditoría.
                      </p>
                    </div>
                    
                    <div className="space-y-2.5 pt-2">
                      <Button className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black shadow-lg shadow-blue-500/20 transition-all text-xs" onClick={handleDayClosing} disabled={isProcessing}>
                        {isProcessing ? <Loader2 className="animate-spin mr-2" size={14} /> : <CheckCircle2 className="mr-2" size={14} />}
                        GUARDAR CIERRE DE JORNADA
                      </Button>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" className="h-10 rounded-xl border border-slate-200 dark:border-border font-bold text-foreground text-[10px]" onClick={handlePrintReport}>
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
                <Card className="border shadow-sm rounded-3xl overflow-hidden bg-card border-slate-100 dark:border-border">
                  <CardHeader className="bg-slate-900 dark:bg-slate-950 text-white p-5 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-black flex items-center gap-2">
                        <Wallet size={18} className="text-indigo-400" /> Cuentas por Cobrar (Créditos Activos)
                      </CardTitle>
                      <CardDescription className="text-[10px] text-slate-300 dark:text-muted-foreground mt-1">
                        Consulte las ventas otorgadas al crédito y registre los abonos parciales de sus clientes.
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="border-indigo-500 text-indigo-400 bg-indigo-950/20 font-black text-xs px-3 py-1">
                      Pendientes: {salesAll?.filter(s => s.paymentMethod === 'Credito' && s.status === 'PENDIENTE').length || 0}
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-0">
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
                  </CardContent>
                </Card>
              </div>

              {/* Historial de Abonos Recientes */}
              <div className="lg:col-span-4 space-y-4">
                <Card className="border shadow-sm rounded-3xl overflow-hidden bg-card border-slate-100 dark:border-border">
                  <CardHeader className="bg-slate-900 dark:bg-slate-950 text-white p-4 border-b dark:border-border flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <History size={16} className="text-emerald-400" /> Abonos Recientes
                      </CardTitle>
                      <CardDescription className="text-[10px] text-slate-300 dark:text-muted-foreground mt-1">Historial de abonos registrados el día de hoy.</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
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
                  </CardContent>
                </Card>
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
        <DialogContent className="rounded-3xl max-w-md p-6 bg-card border shadow-2xl">
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
            <DialogContent className="rounded-3xl max-w-md p-6 bg-card border shadow-2xl border-slate-100 dark:border-border">
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
        <DialogContent className="max-w-2xl bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 rounded-3xl p-6">
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

function MockFrecuenteCard({ name, sku, stock, price, onClick }: {
  name: string;
  sku: string;
  stock: number;
  price: number;
  onClick: () => void;
}) {
  return (
    <div 
      onClick={onClick}
      className="bg-white dark:bg-zinc-900/60 p-4 rounded-[22px] shadow-sm border border-slate-200/60 dark:border-zinc-800/60 hover:border-indigo-500/30 dark:hover:border-indigo-500/30 hover:shadow-md cursor-pointer transition-all duration-300 flex flex-col justify-between aspect-square group relative"
    >
      <div className="space-y-1">
        <span className="text-[9px] font-bold text-indigo-400 bg-indigo-500/5 px-2 py-0.5 rounded-full border border-indigo-500/10 font-mono">{sku}</span>
        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight line-clamp-2 mt-1.5">{name}</h4>
        <p className="text-[9px] text-slate-400 dark:text-muted-foreground font-bold">Stock: {stock}</p>
      </div>

      <div className="mt-4 pt-2.5 border-t border-slate-100 dark:border-zinc-800/80 flex justify-between items-center">
        <span className="text-xs font-black text-slate-900 dark:text-white font-headline">${price.toFixed(2)}</span>
        <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 opacity-0 group-hover:opacity-100 active:scale-90 transition-all shadow-md shadow-indigo-600/20">
          <Plus className="text-white" size={12} />
        </div>
      </div>
    </div>
  );
}

