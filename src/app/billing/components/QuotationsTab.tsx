'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Calculator,
  Search,
  Plus,
  Trash2,
  Package,
  FileText,
  Users,
  Send,
  Loader2,
  Hash,
  Printer,
  ShoppingCart,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ShieldCheck
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface QuoteItem {
  id: string;
  name: string;
  sku: string;
  price: number;
  quantity: number;
  availableStock?: number | null;
}

interface QuotationsTabProps {
  onQuotationSaved?: () => void;
}

export default function QuotationsTab({ onQuotationSaved }: QuotationsTabProps = {}) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [savedQuotes, setSavedQuotes] = useState<any[]>([]);
  const [loadingSavedQuotes, setLoadingSavedQuotes] = useState(false);

  // Cliente Receptor (mismo patrón que Facturación)
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerNit, setCustomerNit] = useState('');
  const [customerNrc, setCustomerNrc] = useState('');

  const [taxMode, setTaxMode] = useState<'con-iva' | 'sin-iva'>('con-iva');
  const [showCustomProductForm, setShowCustomProductForm] = useState(false);

  const [printConfig, setPrintConfig] = useState<any>({
    companyName: 'ERP NEXWAY',
    slogan: 'Soluciones de Inventario y Facturación',
    address: 'Avenida Manuel Enrique Araujo, San Salvador, El Salvador',
    phone: '+503 2250-8800 | soporte@nexway-erp.com',
    email: 'soporte@nexway-erp.com',
    nit: '0614-150622-102-1',
    nrc: '288301-4',
    logoUrl: '',
    logoPosition: 'left',
    termsConditions: `1. Los precios indicados en este documento están expresados en USD y {iva_detail}.\n2. Esta cotización/pre-factura representa un presupuesto informativo y no reserva existencias físicas en bodega.\n3. Los pagos pueden ser procesados mediante transferencia bancaria o efectivo en nuestras sucursales.\n4. Tiempo de entrega: Inmediato según stock, o coordinado con su respectivo gestor de cuenta.`,
    extraNotes: '',
    showSignatureFields: true,
    showLogo: false,
    accentColor: '#4f46e5',
    fontSize: 'medium'
  });

  // Catálogo maestro para buscador instantáneo
  const [inventory, setInventory] = useState<any[]>([]);
  const [loadingInv, setLoadingInv] = useState(false);

  // Producto especial / sin existencia
  const [customName, setCustomName] = useState('');
  const [customSku, setCustomSku] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customQty, setCustomQty] = useState('1');

  const [quoteSeq, setQuoteSeq] = useState(() => Math.floor(100000 + Math.random() * 900000));
  const quoteNumber = `PRE-${quoteSeq}`;
  const [isSaving, setIsSaving] = useState(false);

  const fetchSavedQuotes = async () => {
    setLoadingSavedQuotes(true);
    try {
      const { data, error } = await supabase
        .from('quotations')
        .select('*')
        .in('status', ['PENDIENTE', 'EN_ESPERA'])
        .order('created_at', { ascending: false })
        .limit(50);
      if (!error && data) {
        setSavedQuotes(data);
      }
    } catch (err) {
      console.error('Error fetching saved quotations:', err);
    } finally {
      setLoadingSavedQuotes(false);
    }
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [printRes, custRes] = await Promise.all([
          supabase.from('system_config').select('*').eq('key', 'print_config').maybeSingle(),
          supabase.from('customers').select('id, name, email, nit, nrc').order('name').limit(200)
        ]);
        if (printRes.data?.value?.quotations) {
          setPrintConfig(printRes.data.value.quotations);
        }
        if (custRes.data) {
          setCustomers(custRes.data);
        }
      } catch (err) {
        console.error('Error loading quotation defaults:', err);
      }
    };
    fetchInitialData();
    fetchSavedQuotes();
  }, []);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers.slice(0, 30);
    const q = customerSearch.toLowerCase();
    return customers.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.nit || '').toLowerCase().includes(q)
    ).slice(0, 30);
  }, [customers, customerSearch]);

  const handleSearchInventory = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchTerm.trim()) {
      setInventory([]);
      return;
    }
    try {
      setLoadingInv(true);
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .or(`sku.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%`)
        .limit(50);
      if (error) throw error;

      const skus = (data || []).map((p: any) => p.sku).filter(Boolean);
      const stockBySku: Record<string, number> = {};
      if (skus.length > 0) {
        const { data: stockRows } = await supabase
          .from('inventory_stock')
          .select('sku, quantity')
          .in('sku', skus);
        (stockRows || []).forEach((st: any) => {
          stockBySku[st.sku] = (stockBySku[st.sku] || 0) + (Number(st.quantity) || 0);
        });
      }

      setInventory((data || []).map(p => ({
        id: p.sku,
        sku: p.sku,
        name: p.name,
        category: p.category,
        price: parseFloat(p.price) || 0,
        stock: Number((stockBySku[p.sku] ?? 0).toFixed(2))
      })));
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo realizar la búsqueda de productos.' });
    } finally {
      setLoadingInv(false);
    }
  };

  const addToQuote = (product: any) => {
    setQuoteItems(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.id === product.id ? { ...item, quantity: Number(item.quantity || 0) + 1 } : item
        );
      }
      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          sku: product.sku,
          price: product.price || 0,
          quantity: 1,
          availableStock: typeof product.stock === 'number' ? product.stock : null
        }
      ];
    });
    setSearchTerm('');
    setInventory([]);
    toast({ title: 'Agregado', description: `${product.name} añadido a la pre-factura.` });
  };

  const removeFromQuote = (id: string) => {
    setQuoteItems(prev => prev.filter(item => item.id !== id));
  };

  const updateQuantity = (id: string, qty: number) => {
    if (qty < 1) return;
    setQuoteItems(prev => prev.map(item => (item.id === id ? { ...item, quantity: qty } : item)));
  };

  const updatePrice = (id: string, price: number) => {
    if (price < 0) return;
    setQuoteItems(prev => prev.map(item => (item.id === id ? { ...item, price } : item)));
  };

  const addCustomProduct = () => {
    if (!customName.trim()) {
      toast({ variant: 'destructive', title: 'Nombre Requerido', description: 'El nombre del producto es obligatorio.' });
      return;
    }
    const priceNum = parseFloat(customPrice) || 0;
    const qtyNum = parseInt(customQty) || 1;
    const skuString = customSku.trim() || `TEMP-${Date.now().toString().slice(-4)}`;

    const newItem: QuoteItem = {
      id: `custom-${Date.now()}`,
      name: customName.trim(),
      sku: skuString,
      price: priceNum,
      quantity: qtyNum
    };

    setQuoteItems(prev => [...prev, newItem]);
    toast({ title: 'Agregado', description: `Producto especial "${customName}" añadido.` });
    setCustomName('');
    setCustomSku('');
    setCustomPrice('');
    setCustomQty('1');
  };

  const total = quoteItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const subtotal = taxMode === 'con-iva' ? total / 1.13 : total;
  const iva = taxMode === 'con-iva' ? total - subtotal : 0;

  const handleSavePreInvoice = async (shouldPrint: boolean) => {
    if (quoteItems.length === 0) {
      toast({ variant: 'destructive', title: 'Pre-Factura Vacía', description: 'Debe agregar al menos un producto.' });
      return;
    }

    try {
      setIsSaving(true);
      // Guardar únicamente columnas válidas en public.quotations (sin alterar inventario físico)
      const { data: inserted, error } = await supabase
        .from('quotations')
        .insert({
          customer_name: customerName.trim() || 'Cliente de Mostrador',
          items: quoteItems,
          subtotal: Number(subtotal.toFixed(2)),
          iva: Number(iva.toFixed(2)),
          total: Number(total.toFixed(2)),
          status: 'PENDIENTE'
        })
        .select('*')
        .single();

      if (error) throw error;

      const refCode = inserted?.id ? `PRE-${String(inserted.id).slice(0, 6).toUpperCase()}` : quoteNumber;

      if (shouldPrint) {
        toast({ title: `Pre-Factura ${refCode} Guardada`, description: 'Disponible en Caja (Facturación). Abriendo impresión...' });
        setTimeout(() => {
          window.print();
        }, 400);
      } else {
        toast({
          title: `Pre-Factura ${refCode} Enviada a Caja 📋`,
          description: 'Ya aparece en Facturación → botón "Cotizaciones / Pre-Facturas". El inventario no fue alterado.'
        });
        setQuoteItems([]);
        setCustomerName('');
        setCustomerNit('');
        setCustomerNrc('');
        setQuoteSeq(Math.floor(100000 + Math.random() * 900000));
      }

      await fetchSavedQuotes();
      onQuotationSaved?.();
    } catch (err: any) {
      console.error('Error al guardar pre-factura:', err);
      toast({
        variant: 'destructive',
        title: 'Error al Guardar Pre-Factura',
        description: err?.message || 'No se pudo guardar en la base de datos.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSavedQuote = async (id: string) => {
    try {
      const { error } = await supabase.from('quotations').delete().eq('id', id);
      if (error) throw error;
      setSavedQuotes(prev => prev.filter(q => q.id !== id));
      onQuotationSaved?.();
      toast({ title: 'Pre-Factura Eliminada', description: 'Se removió de la cola pendiente de caja.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err?.message || 'No se pudo eliminar.' });
    }
  };

  return (
    <>
      {/* VISTA EN PANTALLA — MISMO DISEÑO POS QUE FACTURACIÓN */}
      <div className="space-y-6 print:hidden animate-in fade-in duration-300">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* COLUMNA IZQUIERDA (5/12): RESUMEN DE PRE-FACTURA / CARRITO (IDÉNTICO A FACTURACIÓN) */}
          <div className="lg:col-span-5 space-y-3.5">
            <div className="bg-white/40 dark:bg-white/5 backdrop-blur-xl border border-white/50 dark:border-white/10 rounded-[13px] p-5 flex flex-col gap-3 shadow-sm dark:shadow-none">
              <div className="flex justify-between items-start gap-2">
                <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-white/30">
                  Resumen de Pre-Factura / Cotización
                </span>
                <span className="bg-blue-500/10 dark:bg-[#5b5ef4]/20 text-blue-700 dark:text-[#7c7fff] border border-blue-200 dark:border-[#5b5ef4]/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                  {quoteNumber}
                </span>
              </div>

              <div className="flex items-end justify-between">
                <div className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                  <span className="text-lg text-slate-400 dark:text-white/50">$</span>
                  {total.toFixed(2)}
                </div>
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <ShieldCheck size={13} /> Sin alterar inventario
                </span>
              </div>

              <div className="h-[1px] bg-slate-200 dark:bg-white/10 my-1" />

              {/* Lista del Carrito */}
              <ScrollArea className="h-[260px]">
                <div className="space-y-2.5 pr-2">
                  {quoteItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2">
                      <ShoppingCart className="text-slate-300 dark:text-white/10" size={32} />
                      <p className="text-[11px] text-slate-400 dark:text-white/20 text-center leading-relaxed">
                        Busque productos en el catálogo<br />para armar la pre-factura
                      </p>
                    </div>
                  ) : (
                    quoteItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-white/5 gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{item.name}</h4>
                          <p className="text-[9.5px] text-muted-foreground font-mono mt-0.5">
                            {item.sku} • ${item.price.toFixed(2)} c/u
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-bold text-slate-800 dark:text-white/70 bg-slate-200 dark:bg-white/10 px-2 py-1 rounded-lg">
                            {item.quantity}x
                          </span>
                          <span className="text-xs font-bold text-blue-600 dark:text-[#7c7fff] min-w-[54px] text-right font-mono">
                            ${(item.price * item.quantity).toFixed(2)}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeFromQuote(item.id)}
                            className="text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl h-7 w-7"
                          >
                            <Trash2 size={12} />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>

              <div className="h-[1px] bg-slate-200 dark:bg-white/10 my-1" />

              {/* Impuesto IVA y Totales */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-medium uppercase text-slate-500 dark:text-white/30 tracking-wider">Impuesto IVA</span>
                  <div className="flex gap-1 bg-slate-100 dark:bg-white/5 p-0.5 rounded-lg border border-slate-200 dark:border-white/10">
                    <button
                      type="button"
                      onClick={() => setTaxMode('con-iva')}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${
                        taxMode === 'con-iva'
                          ? 'bg-blue-500/15 dark:bg-[#5b5ef4]/30 text-blue-700 dark:text-[#7c7fff]'
                          : 'text-slate-400 hover:text-slate-600 dark:hover:text-white/70'
                      }`}
                    >
                      Con IVA (13%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTaxMode('sin-iva')}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${
                        taxMode === 'sin-iva'
                          ? 'bg-blue-500/15 dark:bg-[#5b5ef4]/30 text-blue-700 dark:text-[#7c7fff]'
                          : 'text-slate-400 hover:text-slate-600 dark:hover:text-white/70'
                      }`}
                    >
                      Sin IVA
                    </button>
                  </div>
                </div>

                <div className="flex justify-between text-xs text-slate-500 dark:text-white/50">
                  <span>Subtotal Gravado:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-white">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-500 dark:text-white/50">
                  <span>IVA (13%):</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-white">${iva.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Botones de Acción (mismo estilo que Facturación) */}
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => handleSavePreInvoice(false)}
                disabled={quoteItems.length === 0 || isSaving}
                className="w-full rounded-[11px] p-[15px] text-[13px] font-bold text-white text-center cursor-pointer bg-blue-600/90 hover:bg-blue-600 dark:bg-[#5b5ef4]/35 dark:border dark:border-[#5b5ef4]/50 hover:dark:bg-[#5b5ef4]/50 tracking-[0.3px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                {isSaving ? 'GUARDANDO PRE-FACTURA...' : 'GUARDAR PRE-FACTURA (ENVIAR A CAJA)'}
              </button>

              <button
                type="button"
                onClick={() => handleSavePreInvoice(true)}
                disabled={quoteItems.length === 0 || isSaving}
                className="w-full rounded-[11px] p-[11px] text-[12px] font-bold text-slate-700 dark:text-white/70 bg-white/50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Printer size={14} /> Guardar e Imprimir Cotización
              </button>
            </div>
          </div>

          {/* COLUMNA DERECHA (7/12): CLIENTE, BUSCADOR Y DETALLE (IDÉNTICO A FACTURACIÓN) */}
          <div className="lg:col-span-7 space-y-5">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                Pre-Facturación y Cotizaciones
              </h2>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCustomProductForm(prev => !prev)}
                  className="h-9 text-xs font-bold bg-white/50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl gap-1.5"
                >
                  <Calculator size={14} className="text-indigo-500" />
                  Producto Especial
                  {showCustomProductForm ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </Button>
              </div>
            </div>

            {/* Tarjeta Cliente Receptor (mismo diseño que Facturación) */}
            <div className="bg-white/40 dark:bg-white/5 backdrop-blur-md border border-white/50 dark:border-white/10 p-4 rounded-[13px] flex flex-col sm:flex-row gap-3 shadow-sm dark:shadow-none">
              <div className="flex-1 space-y-1.5">
                <Label className="text-[10px] font-medium uppercase text-slate-500 dark:text-white/30 tracking-wider">
                  Cliente Receptor
                </Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Buscar cliente o ingrese nombre..."
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    className="h-10 bg-white/50 dark:bg-black/20 border-slate-200 dark:border-white/10 rounded-xl text-xs font-medium text-slate-800 dark:text-white/80"
                  />
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 w-10 shrink-0 border-slate-200 dark:border-white/10 bg-white/50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl px-0 flex items-center justify-center"
                        title="Seleccionar cliente registrado"
                      >
                        <Users size={16} className="text-slate-500 dark:text-white/40" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-80 p-0 rounded-2xl overflow-hidden bg-white dark:bg-[#0a0a14] border-slate-200 dark:border-white/10 shadow-lg"
                      align="end"
                    >
                      <div className="p-3 border-b border-slate-100 dark:border-white/5">
                        <Input
                          placeholder="Buscar cliente..."
                          value={customerSearch}
                          onChange={e => setCustomerSearch(e.target.value)}
                          className="h-8 text-xs bg-slate-50 dark:bg-white/5 border-none rounded-lg"
                        />
                      </div>
                      <ScrollArea className="h-48">
                        {filteredCustomers.length === 0 ? (
                          <div className="p-4 text-center text-xs text-muted-foreground">Sin coincidencias</div>
                        ) : (
                          filteredCustomers.map(c => (
                            <div
                              key={c.id}
                              onClick={() => {
                                setCustomerName(c.name || '');
                                setCustomerNit(c.nit || '');
                                setCustomerNrc(c.nrc || '');
                              }}
                              className="p-3 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer border-b border-slate-100 dark:border-white/5 transition-colors"
                            >
                              <p className="text-[11px] font-bold text-slate-800 dark:text-white/80">{c.name}</p>
                              <p className="text-[9px] text-slate-400 mt-0.5">{c.email || c.nit || 'Cliente registrado'}</p>
                            </div>
                          ))
                        )}
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="w-full sm:w-36 space-y-1.5">
                <Label className="text-[10px] font-medium uppercase text-slate-500 dark:text-white/30 tracking-wider">
                  NIT / DUI
                </Label>
                <Input
                  placeholder="Opcional"
                  value={customerNit}
                  onChange={e => setCustomerNit(e.target.value)}
                  className="h-10 bg-white/50 dark:bg-black/20 border-slate-200 dark:border-white/10 rounded-xl text-xs font-mono"
                />
              </div>

              <div className="w-full sm:w-28 space-y-1.5">
                <Label className="text-[10px] font-medium uppercase text-slate-500 dark:text-white/30 tracking-wider">
                  NRC
                </Label>
                <Input
                  placeholder="Opcional"
                  value={customerNrc}
                  onChange={e => setCustomerNrc(e.target.value)}
                  className="h-10 bg-white/50 dark:bg-black/20 border-slate-200 dark:border-white/10 rounded-xl text-xs font-mono"
                />
              </div>
            </div>

            {/* Producto Especial / Sin Existencia (Colapsable para no saturar) */}
            {showCustomProductForm && (
              <div className="bg-white/40 dark:bg-white/5 backdrop-blur-md border border-indigo-500/30 p-4 rounded-[13px] grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-5 space-y-1">
                  <Label className="text-[10px] font-bold uppercase text-slate-500 dark:text-white/40">Nombre del Producto Especial</Label>
                  <Input
                    placeholder="Ej. Pedido especial..."
                    value={customName}
                    onChange={e => setCustomName(e.target.value)}
                    className="h-9 bg-white/50 dark:bg-black/20 border-slate-200 dark:border-white/10 rounded-xl text-xs"
                  />
                </div>
                <div className="sm:col-span-3 space-y-1">
                  <Label className="text-[10px] font-bold uppercase text-slate-500 dark:text-white/40">SKU (Opcional)</Label>
                  <Input
                    placeholder="TEMP-001"
                    value={customSku}
                    onChange={e => setCustomSku(e.target.value)}
                    className="h-9 bg-white/50 dark:bg-black/20 border-slate-200 dark:border-white/10 rounded-xl text-xs font-mono"
                  />
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <Label className="text-[10px] font-bold uppercase text-slate-500 dark:text-white/40">Precio ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={customPrice}
                    onChange={e => setCustomPrice(e.target.value)}
                    className="h-9 bg-white/50 dark:bg-black/20 border-slate-200 dark:border-white/10 rounded-xl text-xs font-bold"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Button
                    type="button"
                    onClick={addCustomProduct}
                    className="w-full h-9 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold gap-1"
                  >
                    <Plus size={14} /> Agregar
                  </Button>
                </div>
              </div>
            )}

            {/* Buscador de Productos (IDÉNTICO A FACTURACIÓN) */}
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

                {/* Dropdown de resultados igual a Facturación */}
                {inventory.length > 0 && searchTerm.trim() !== '' && (
                  <Card className="absolute left-0 right-0 mt-2 bg-white dark:bg-[#0a0a14] border border-slate-200 dark:border-white/10 shadow-2xl z-50 max-h-64 overflow-y-auto no-scrollbar rounded-2xl p-1">
                    {inventory.map(p => (
                      <div
                        key={p.id}
                        onClick={() => addToQuote(p)}
                        className="p-3 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl border-b last:border-none border-slate-100 dark:border-white/5 flex justify-between items-center gap-3 cursor-pointer transition-colors"
                      >
                        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                          <span className="text-xs font-bold text-slate-800 dark:text-white/80 truncate">{p.name}</span>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[9.5px] text-slate-500 dark:text-white/40 font-mono">
                              SKU: {p.sku} {p.category ? `• ${p.category}` : ''}
                            </span>
                            {p.stock > 0 ? (
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                                ✓ En existencia ({p.stock})
                              </span>
                            ) : (
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25">
                                ✕ Sin existencia (0)
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-xs font-bold text-blue-600 dark:text-[#7c7fff] font-mono shrink-0">
                          ${p.price.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </Card>
                )}
              </div>
              <button
                type="submit"
                disabled={loadingInv}
                className="h-[48px] bg-blue-500/10 dark:bg-[#5b5ef4]/35 hover:bg-blue-500/20 dark:hover:bg-[#5b5ef4]/50 border border-blue-500/30 dark:border-[#5b5ef4]/50 text-blue-700 dark:text-[#a5a8ff] font-semibold rounded-[10px] shadow-none px-6 transition-colors flex items-center gap-2 whitespace-nowrap text-[13px]"
              >
                {loadingInv ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                Buscar
              </button>
            </form>

            {/* Tabla Detalle de Productos en Pre-Factura (mismo formato que Facturación) */}
            <div className="bg-white/40 dark:bg-white/5 backdrop-blur-md border border-white/50 dark:border-white/10 rounded-[13px] flex flex-col overflow-hidden shadow-sm dark:shadow-none">
              <div className="overflow-x-auto no-scrollbar">
                <Table>
                  <TableHeader className="bg-slate-50/50 dark:bg-transparent border-b border-slate-200 dark:border-white/5">
                    <TableRow className="hover:bg-transparent border-none">
                      <TableHead className="text-[10px] uppercase font-bold text-slate-500 dark:text-white/40 w-24 text-center">Cant.</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold text-slate-500 dark:text-white/40">Producto / SKU</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold text-slate-500 dark:text-white/40 text-right w-28">Precio Unit.</TableHead>
                      <TableHead className="text-[10px] uppercase font-bold text-slate-500 dark:text-white/40 text-right w-24">Subtotal</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quoteItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-12 text-xs text-slate-400 dark:text-white/30">
                          <Package className="mx-auto mb-2 opacity-40" size={24} />
                          No hay productos en la pre-factura. Busca arriba por SKU o nombre para agregar.
                        </TableCell>
                      </TableRow>
                    ) : (
                      quoteItems.map(item => (
                        <TableRow key={item.id} className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50/60 dark:hover:bg-white/5">
                          <TableCell className="text-center py-2.5">
                            <div className="inline-flex items-center gap-1 bg-slate-100 dark:bg-white/10 rounded-lg px-1 py-0.5">
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                className="w-5 h-5 text-xs font-bold hover:text-blue-500"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                value={item.quantity}
                                onFocus={e => e.target.select()}
                                onChange={e => updateQuantity(item.id, parseInt(e.target.value) || 1)}
                                className="w-9 text-center text-xs font-black bg-transparent focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                className="w-5 h-5 text-xs font-bold hover:text-blue-500"
                              >
                                +
                              </button>
                            </div>
                          </TableCell>
                          <TableCell className="py-2.5">
                            <div className="font-bold text-xs text-slate-800 dark:text-white/90">{item.name}</div>
                            <div className="flex items-center gap-2 flex-wrap mt-0.5">
                              <span className="text-[10px] font-mono text-slate-400">{item.sku}</span>
                              {item.availableStock === null || item.availableStock === undefined ? (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-500 dark:text-slate-400">
                                  Especial
                                </span>
                              ) : item.availableStock <= 0 ? (
                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25">
                                  ✕ Sin existencia (0)
                                </span>
                              ) : item.availableStock < item.quantity ? (
                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                                  ⚠ Hay {item.availableStock} en stock
                                </span>
                              ) : (
                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                                  ✓ En existencia ({item.availableStock})
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right py-2.5">
                            <div className="inline-flex items-center gap-1">
                              <span className="text-[10px] text-slate-400">$</span>
                              <input
                                type="number"
                                step="0.01"
                                value={item.price}
                                onFocus={e => e.target.select()}
                                onChange={e => updatePrice(item.id, parseFloat(e.target.value) || 0)}
                                className="w-20 h-7 px-2 text-right font-mono font-bold text-xs bg-white/60 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-lg focus:outline-none focus:border-blue-500"
                              />
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-xs text-blue-600 dark:text-[#7c7fff] py-2.5">
                            ${(item.price * item.quantity).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-center py-2.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeFromQuote(item.id)}
                              className="h-7 w-7 text-slate-400 hover:text-rose-500 rounded-lg"
                            >
                              <Trash2 size={13} />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </div>

        {/* LISTADO DE PRE-FACTURAS / COTIZACIONES ENVIADAS A CAJA */}
        <div className="bg-white/40 dark:bg-white/5 backdrop-blur-md border border-white/50 dark:border-white/10 rounded-[13px] overflow-hidden shadow-sm dark:shadow-none">
          <div className="px-5 py-3.5 border-b border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-white/80 flex items-center gap-2">
                <FileText size={15} className="text-blue-500 dark:text-[#7c7fff]" />
                Pre-Facturas Pendientes en Caja ({savedQuotes.length})
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-white/40">
                Listas para que el cajero las cargue desde Facturación → botón &quot;Cotizaciones / Pre-Facturas&quot;.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={fetchSavedQuotes}
              disabled={loadingSavedQuotes}
              className="h-8 text-xs font-bold rounded-xl gap-1.5"
            >
              <RefreshCw size={12} className={loadingSavedQuotes ? 'animate-spin' : ''} />
              Actualizar
            </Button>
          </div>

          {savedQuotes.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 dark:text-white/30">
              No hay pre-facturas pendientes enviadas a caja todavía.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-white/5">
              {savedQuotes.map(q => {
                const refCode = `PRE-${String(q.id).slice(0, 6).toUpperCase()}`;
                const itemsArr = Array.isArray(q.items) ? q.items : [];
                return (
                  <div
                    key={q.id}
                    className="px-5 py-3 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50/60 dark:hover:bg-white/5 transition-colors"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-black text-[11px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-[#7c7fff] border border-blue-500/20">
                          {refCode}
                        </span>
                        <span className="font-bold text-xs text-slate-800 dark:text-white/90">
                          {q.customer_name || 'Cliente de Mostrador'}
                        </span>
                        <Badge variant="outline" className="text-[9px] font-bold uppercase text-amber-600 border-amber-500/30">
                          {itemsArr.length} {itemsArr.length === 1 ? 'producto' : 'productos'}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        {new Date(q.created_at).toLocaleString()}
                        {itemsArr.length > 0 ? ` · ${itemsArr.slice(0, 2).map((i: any) => `${i.quantity}x ${i.name}`).join(', ')}${itemsArr.length > 2 ? '...' : ''}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono font-black text-sm text-slate-800 dark:text-white">
                        ${Number(q.total || 0).toFixed(2)}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteSavedQuote(q.id)}
                        className="h-8 w-8 p-0 text-slate-400 hover:text-rose-500 rounded-lg"
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
        </div>
      </div>

      {/* PLANTILLA DE IMPRESIÓN CORPORATIVA PROFESIONAL (VISIBLE SOLO AL IMPRIMIR) */}
      <div
        className={`hidden print:block w-full max-w-4xl mx-auto p-8 bg-white text-black font-sans leading-relaxed ${
          printConfig.fontSize === 'small' ? 'text-[10px]' : printConfig.fontSize === 'large' ? 'text-sm' : 'text-xs'
        }`}
      >
        <div
          className={`flex ${
            printConfig.logoPosition === 'center'
              ? 'flex-col items-center text-center'
              : printConfig.logoPosition === 'right'
              ? 'flex-row-reverse justify-between items-start'
              : 'justify-between items-start'
          } border-b-2 pb-5 mb-6`}
          style={{ borderBottomColor: printConfig.accentColor || '#1e293b' }}
        >
          {printConfig.showLogo && printConfig.logoUrl && (
            <div className="mb-4">
              <img src={printConfig.logoUrl} alt="Logo" className="max-h-16 max-w-[200px] object-contain" />
            </div>
          )}
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">{printConfig.companyName}</h1>
            {printConfig.slogan && (
              <p className="text-[9px] uppercase font-bold tracking-widest text-slate-500 mt-0.5">{printConfig.slogan}</p>
            )}
            <div className="text-[10px] text-slate-600 mt-3 space-y-0.5">
              {printConfig.address && <p>{printConfig.address}</p>}
              {printConfig.phone && <p>Teléfono: {printConfig.phone}</p>}
              {printConfig.email && <p>Correo: {printConfig.email}</p>}
              <p>
                {printConfig.nit ? `NIT: ${printConfig.nit} ` : ''}
                {printConfig.nrc ? `| NRC: ${printConfig.nrc}` : ''}
              </p>
            </div>
          </div>
          <div className={printConfig.logoPosition === 'center' ? 'text-center mt-4' : 'text-right'}>
            <div
              className="text-white px-4 py-2 rounded-lg inline-block"
              style={{ backgroundColor: printConfig.accentColor || '#0f172a' }}
            >
              <p className="text-[8px] uppercase font-bold tracking-widest opacity-80">PRE-FACTURA / COTIZACIÓN</p>
              <p className="text-lg font-mono font-bold">{quoteNumber}</p>
            </div>
            <div className="text-[10px] text-slate-600 mt-3 space-y-0.5">
              <p>
                <span className="font-bold text-slate-800">Fecha de Emisión:</span>{' '}
                {new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              <p>
                <span className="font-bold text-slate-800">Validez:</span> 15 Días Calendario
              </p>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-[9px] uppercase font-black text-slate-400 tracking-wider">Cliente / Solicitante</p>
            <p className="text-sm font-bold text-slate-900">{customerName || 'Consumidor Final / Cliente General'}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <p className="text-[9px] uppercase font-black text-slate-400 tracking-wider">NIT / DUI</p>
              <p className="text-xs font-mono font-semibold text-slate-800">{customerNit || 'N/A'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] uppercase font-black text-slate-400 tracking-wider">NRC</p>
              <p className="text-xs font-mono font-semibold text-slate-800">{customerNrc || 'N/A'}</p>
            </div>
          </div>
        </div>

        <table className="w-full border-collapse mb-8 text-xs">
          <thead>
            <tr className="text-left text-white" style={{ backgroundColor: printConfig.accentColor || '#0f172a' }}>
              <th className="py-2.5 px-3 font-bold w-[60px] text-center rounded-l-lg">CANT.</th>
              <th className="py-2.5 px-3 font-bold w-[120px]">CÓDIGO / SKU</th>
              <th className="py-2.5 px-3 font-bold">DESCRIPCIÓN DEL PRODUCTO</th>
              <th className="py-2.5 px-3 font-bold text-right w-[100px]">P. UNITARIO</th>
              <th className="py-2.5 px-3 font-bold text-right w-[120px] rounded-r-lg">SUBTOTAL</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {quoteItems.map((item, idx) => (
              <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                <td className="py-3 px-3 text-center font-bold text-slate-900">{item.quantity}</td>
                <td className="py-3 px-3 font-mono text-slate-600">{item.sku}</td>
                <td className="py-3 px-3">
                  <span className="font-bold text-slate-900 block">{item.name}</span>
                </td>
                <td className="py-3 px-3 text-right font-semibold text-slate-800">${item.price.toFixed(2)}</td>
                <td className="py-3 px-3 text-right font-bold text-slate-900">${(item.price * item.quantity).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-between items-start gap-8 mt-6">
          <div className="text-[10px] text-slate-500 max-w-md space-y-1.5 whitespace-pre-line">
            <p className="font-bold text-slate-700 uppercase tracking-wider mb-1">Términos y Condiciones Generales</p>
            {printConfig.termsConditions
              ? printConfig.termsConditions.replace(/{iva_detail}/g, taxMode === 'con-iva' ? 'ya incluyen IVA (13%)' : 'no incluyen IVA')
              : '1. Los precios indicados están expresados en USD.\n2. Este documento no descuenta inventario físico.'}
            {printConfig.extraNotes && <p className="mt-2 text-slate-400 italic font-medium">{printConfig.extraNotes}</p>}
          </div>
          <div className="w-[280px] bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
            <div className="flex justify-between text-xs text-slate-600">
              <span>Subtotal Gravado:</span>
              <span className="font-semibold text-slate-800">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-600">
              <span>IVA (13%):</span>
              <span className="font-semibold text-slate-800">${iva.toFixed(2)}</span>
            </div>
            <div
              className="flex justify-between text-sm font-black pt-2 border-t"
              style={{ borderTopColor: printConfig.accentColor || '#e2e8f0' }}
            >
              <span>TOTAL NETO (USD):</span>
              <span className="text-base font-black" style={{ color: printConfig.accentColor || '#0f172a' }}>
                ${total.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {printConfig.showSignatureFields && (
          <div className="grid grid-cols-2 gap-12 mt-20 pt-10 border-t border-slate-100 text-center text-xs">
            <div className="space-y-1.5">
              <div className="w-48 border-b border-slate-400 mx-auto h-8"></div>
              <p className="font-bold text-slate-700">Firma Autorizada y Sello</p>
              <p className="text-[9px] text-slate-400 uppercase tracking-wide">Asesor Comercial</p>
            </div>
            <div className="space-y-1.5">
              <div className="w-48 border-b border-slate-400 mx-auto h-8"></div>
              <p className="font-bold text-slate-700">Aceptado por el Cliente</p>
              <p className="text-[9px] text-slate-400 uppercase tracking-wide">Nombre, Firma y Sello del Solicitante</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
