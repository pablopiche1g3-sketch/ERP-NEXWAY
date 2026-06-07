
'use client';

import React, { useState, useMemo } from 'react';
import { 
  Calculator, 
  Search, 
  Plus, 
  Trash2, 
  ArrowLeft, 
  Package, 
  FileText, 
  Users, 
  Send,
  Loader2,
  Hash,
  User,
  BadgeInfo,
  Printer,
  ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface QuoteItem {
  id: string;
  name: string;
  sku: string;
  price: number;
  quantity: number;
}

export default function QuotationsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  
  const [customerName, setCustomerName] = useState('');
  const [customerNit, setCustomerNit] = useState('');
  const [customerNrc, setCustomerNrc] = useState('');

  // Sincronización de catálogo maestro desde Supabase  
  const [inventory, setInventory] = useState<any[]>([]);
  const [loadingInv, setLoadingInv] = useState(false);

  // Estados para productos personalizados / sin existencia
  const [customName, setCustomName] = useState('');
  const [customSku, setCustomSku] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customQty, setCustomQty] = useState('1');

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
      setInventory((data || []).map(p => ({
        id: p.sku,
        sku: p.sku,
        name: p.name,
        category: p.category,
        price: parseFloat(p.price) || 0
      })));
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Error", description: "No se pudo realizar la búsqueda de productos." });
    } finally {
      setLoadingInv(false);
    }
  };

  const filteredProducts = inventory;

  const addToQuote = (product: any) => {
    setQuoteItems(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { 
        id: product.id, 
        name: product.name, 
        sku: product.sku, 
        price: product.price || 0, 
        quantity: 1 
      }];
    });
    toast({ title: "Agregado", description: `${product.name} listo en cotización.` });
  };

  const removeFromQuote = (id: string) => {
    setQuoteItems(prev => prev.filter(item => item.id !== id));
  };

  const updateQuantity = (id: string, qty: number) => {
    if (qty < 1) return;
    setQuoteItems(prev => prev.map(item => 
      item.id === id ? { ...item, quantity: qty } : item
    ));
  };

  const updatePrice = (id: string, price: number) => {
    if (price < 0) return;
    setQuoteItems(prev => prev.map(item => 
      item.id === id ? { ...item, price: price } : item
    ));
  };

  const addCustomProduct = () => {
    if (!customName.trim()) {
      toast({ variant: "destructive", title: "Nombre Requerido", description: "El nombre del producto es obligatorio." });
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
    toast({ title: "Agregado", description: `Producto temporal "${customName}" agregado.` });

    // Limpiar campos
    setCustomName('');
    setCustomSku('');
    setCustomPrice('');
    setCustomQty('1');
  };

  const subtotal = quoteItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const iva = subtotal * 0.13;
  const total = subtotal + iva;

  // Generamos un número de cotización estático para la sesión/impresión
  const quoteNumber = useMemo(() => `COT-${Math.floor(100000 + Math.random() * 900000)}`, []);

  const [isSaving, setIsSaving] = useState(false);

  const handleGenerateQuote = async () => {
    if (quoteItems.length === 0) {
      toast({ variant: "destructive", title: "Cotización Vacía", description: "Debe agregar al menos un producto." });
      return;
    }

    try {
      setIsSaving(true);
      const { error } = await supabase
        .from('quotations')
        .insert({
          quote_number: quoteNumber,
          customer_name: customerName || 'Cliente de Mostrador',
          items: quoteItems,
          total: total,
          status: 'PENDIENTE'
        });
        
      if (error) {
        console.error(error);
        toast({ variant: "destructive", title: "Error al Guardar", description: "No se guardó la cotización en la base de datos." });
        // Seguimos con la impresión aunque falle la BD, para no bloquear al usuario
      }

      toast({ title: "Documento Guardado", description: "Preparando impresión..." });
      setTimeout(() => {
        window.print();
      }, 500);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: "Error inesperado al guardar la cotización." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      {/* VISTA EN PANTALLA (OCULTA AL IMPRIMIR) */}
      <div className="min-h-screen bg-slate-50 p-4 sm:p-6 print:hidden">
        <div className="max-w-7xl mx-auto flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              className="rounded-full bg-white shadow-sm hover:bg-slate-100" 
              onClick={() => router.push('/')}
            >
              <ArrowLeft className="text-slate-600" size={20} />
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 font-headline">Presupuestos y Cotizaciones</h1>
              <p className="text-slate-500 text-xs sm:text-sm">Generación de precios sin afectar inventario físico</p>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Panel Izquierdo: Resumen y Totales */}
          <div className="lg:col-span-4 space-y-4">
            <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white">
              <CardHeader className="bg-orange-600 text-white p-5">
                <div className="flex justify-between items-center mb-2">
                  <CardTitle className="text-base font-bold">Resumen del Cliente</CardTitle>
                  <Badge variant="outline" className="text-[10px] text-orange-100 border-orange-400 uppercase">
                    Cotización No Válida como Factura
                  </Badge>
                </div>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[9px] uppercase font-bold text-orange-200">Total Presupuestado</p>
                    <p className="text-3xl font-black text-white">${total.toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{quoteItems.length} Líneas</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="w-[40px] text-[10px] font-bold px-3 text-center">CANT</TableHead>
                        <TableHead className="text-[10px] font-bold">DESCRIPCIÓN</TableHead>
                        <TableHead className="text-right text-[10px] font-bold">SUBTOTAL</TableHead>
                        <TableHead className="w-[30px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {quoteItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-12 text-slate-400 italic text-xs">
                            Agregue códigos del catálogo maestro o agregue uno manual
                          </TableCell>
                        </TableRow>
                      ) : quoteItems.map((item) => (
                        <TableRow key={item.id} className="hover:bg-slate-50 border-b border-slate-50">
                          <TableCell className="px-3">
                            <Input 
                              type="number" 
                              value={item.quantity} 
                              onFocus={e => e.target.select()}
                              onChange={e => updateQuantity(item.id, parseInt(e.target.value) || 1)}
                              className="w-12 h-7 text-center font-black text-orange-600 p-0 text-xs bg-transparent border-none shadow-none focus-visible:ring-0"
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <span className="font-bold text-slate-900 text-[11px] leading-tight">{item.name}</span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[9px] font-mono text-slate-400">{item.sku}</span>
                                <span className="text-[9px] text-slate-500 font-medium">P. Unit: $</span>
                                <input 
                                  type="number" 
                                  step="0.01"
                                  value={item.price} 
                                  onFocus={e => e.target.select()}
                                  onChange={e => updatePrice(item.id, parseFloat(e.target.value) || 0)}
                                  className="w-16 h-5 px-1 py-0 text-center font-bold text-slate-900 text-[10px] bg-slate-50 border border-slate-200 rounded focus:border-orange-500 focus:outline-none"
                                />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-bold text-slate-900 text-[11px]">${(item.price * item.quantity).toFixed(2)}</TableCell>
                          <TableCell className="px-2 text-center">
                            <Button variant="ghost" size="icon" onClick={() => removeFromQuote(item.id)} className="h-6 w-6 text-slate-300 hover:text-rose-500">
                              <Trash2 size={12} />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>

                <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-2">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Subtotal Gravado:</span>
                    <span className="font-bold text-slate-900">${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>IVA (13%):</span>
                    <span className="font-bold text-slate-900">${iva.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-100">
                    <span>VALIDEZ: 15 DÍAS</span>
                    <span className="text-orange-600">${total.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Button 
              className="w-full h-14 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-lg shadow-lg"
              disabled={quoteItems.length === 0 || isSaving}
              onClick={handleGenerateQuote}
            >
              {isSaving ? <Loader2 className="mr-2 animate-spin" size={20} /> : <Printer className="mr-2" size={20} />}
              {isSaving ? "Guardando..." : "Guardar e Imprimir"}
            </Button>
          </div>

          {/* Panel Derecho: Información, Producto Sin Existencia y Catálogo Maestro */}
          <div className="lg:col-span-8 space-y-4">
            <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
              <div className="bg-slate-50 border-b border-slate-100 px-4 py-2 flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Información del Solicitante</span>
                <FileText size={14} className="text-slate-300" />
              </div>
              <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
                    <User size={10} /> Nombre del Cliente
                  </Label>
                  <Input 
                    placeholder="Ej. Comercial Los Robles..." 
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    className="h-10 bg-slate-50 border-slate-100 rounded-xl text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
                    <Hash size={10} /> NIT / DUI
                  </Label>
                  <Input 
                    placeholder="0000-000000-000-0" 
                    value={customerNit}
                    onChange={e => setCustomerNit(e.target.value)}
                    className="h-10 bg-slate-50 border-slate-100 rounded-xl text-xs font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
                    <BadgeInfo size={10} /> NRC
                  </Label>
                  <Input 
                    placeholder="Registro Contribuyente" 
                    value={customerNrc}
                    onChange={e => setCustomerNrc(e.target.value)}
                    className="h-10 bg-slate-50 border-slate-100 rounded-xl text-xs font-mono"
                  />
                </div>
              </CardContent>
            </Card>

            {/* SECCIÓN: PRODUCTO SIN EXISTENCIA / PERSONALIZADO */}
            <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden border-l-4 border-orange-500">
              <div className="bg-slate-50/50 border-b border-slate-100 px-4 py-2.5 flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Calculator size={12} className="text-orange-500" />
                  Agregar Producto Sin Existencia / Especial
                </span>
                <span className="text-[9px] text-slate-400 font-bold">Ideal para cotizar pedidos especiales</span>
              </div>
              <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
                <div className="sm:col-span-5 space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase text-slate-400">Nombre del Producto</Label>
                  <Input 
                    placeholder="Ej. Abrazadera especial 1/2 pulgada..." 
                    value={customName}
                    onChange={e => setCustomName(e.target.value)}
                    className="h-10 bg-slate-50 border-slate-100 rounded-xl text-xs"
                  />
                </div>
                <div className="sm:col-span-3 space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase text-slate-400">SKU / Código Temporal</Label>
                  <Input 
                    placeholder="Ej. TEMP-8839 (Opcional)" 
                    value={customSku}
                    onChange={e => setCustomSku(e.target.value)}
                    className="h-10 bg-slate-50 border-slate-100 rounded-xl text-xs font-mono"
                  />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase text-slate-400">Precio Unitario ($)</Label>
                  <Input 
                    type="number"
                    step="0.01"
                    placeholder="0.00" 
                    value={customPrice}
                    onChange={e => setCustomPrice(e.target.value)}
                    className="h-10 bg-slate-50 border-slate-100 rounded-xl text-xs font-bold"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Button 
                    onClick={addCustomProduct}
                    className="w-full h-10 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1"
                  >
                    <Plus size={14} /> Agregar
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-2">
              <h2 className="text-sm font-bold text-slate-700 uppercase tracking-tight flex items-center gap-2">
                <Package size={16} className="text-blue-500" />
                Catálogo de Códigos Autorizados
              </h2>
              <form onSubmit={handleSearchInventory} className="relative w-full md:w-80 flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <Input 
                    placeholder="Buscar por SKU o nombre (Presiona Enter)..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-10 bg-white border-none shadow-sm rounded-xl text-sm font-medium"
                  />
                </div>
                <Button type="submit" className="h-10 bg-orange-600 hover:bg-orange-700 text-white rounded-xl px-4 font-bold shrink-0">
                  Buscar
                </Button>
              </form>
            </div>

            <ScrollArea className="h-[400px]">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {loadingInv ? (
                  <div className="col-span-full py-12 text-center text-slate-400 flex flex-col items-center gap-2">
                    <Loader2 className="animate-spin text-blue-500" />
                    Sincronizando maestro...
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-slate-400">
                     No se encontraron códigos con ese nombre.
                  </div>
                ) : filteredProducts.map((product: any) => (
                  <div 
                    key={product.id}
                    onClick={() => addToQuote(product)}
                    className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 hover:border-orange-400 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between min-h-[145px] h-auto gap-2"
                  >
                    <div className="flex justify-between items-start">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-50 text-blue-500 group-hover:bg-orange-50 group-hover:text-orange-500 transition-colors">
                        <Hash size={16} />
                      </div>
                      <Badge className="text-[8px] font-black px-1.5 h-4 bg-slate-50 text-slate-400 border-slate-200" variant="outline">
                        SKU: {product.sku}
                      </Badge>
                    </div>
                    
                    <div className="mt-2 flex-1">
                      <h3 className="text-[11px] font-bold text-slate-900 leading-tight line-clamp-2">{product.name}</h3>
                      <p className="text-[9px] font-bold text-blue-500 mt-1 uppercase">Código Maestro</p>
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50">
                      <span className="text-sm font-black text-slate-900">${(product.price || 0).toFixed(2)}</span>
                      <div className="w-6 h-6 bg-slate-100 text-slate-400 rounded-lg flex items-center justify-center group-hover:bg-orange-600 group-hover:text-white transition-all">
                        <Plus size={12} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      </div>

      {/* PLANTILLA DE IMPRESIÓN CORPORATIVA PROFESIONAL (VISIBLE SOLO AL IMPRIMIR) */}
      <div className="hidden print:block w-full max-w-4xl mx-auto p-8 bg-white text-black font-sans leading-relaxed text-xs">
        {/* ENCABEZADO CORPORATIVO */}
        <div className="flex justify-between items-start border-b-2 border-slate-800 pb-5 mb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">ERP NEXWAY</h1>
            <p className="text-[9px] uppercase font-bold tracking-widest text-slate-500 mt-0.5">Soluciones de Inventario y Facturación</p>
            <div className="text-[10px] text-slate-600 mt-3 space-y-0.5">
              <p>Avenida Manuel Enrique Araujo, San Salvador, El Salvador</p>
              <p>Teléfono: +503 2250-8800 | soporte@nexway-erp.com</p>
              <p>NIT: 0614-150622-102-1 | NRC: 288301-4</p>
            </div>
          </div>
          <div className="text-right">
            <div className="bg-slate-900 text-white px-4 py-2 rounded-lg inline-block">
              <p className="text-[8px] uppercase font-bold tracking-widest text-slate-300">COTIZACIÓN DE PRECIOS</p>
              <p className="text-lg font-mono font-bold">{quoteNumber}</p>
            </div>
            <div className="text-[10px] text-slate-600 mt-3 space-y-0.5">
              <p><span className="font-bold text-slate-800">Fecha de Emisión:</span> {new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <p><span className="font-bold text-slate-800">Fecha de Vencimiento:</span> {new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <p><span className="font-bold text-slate-800">Validez del Presupuesto:</span> 15 Días Calendario</p>
            </div>
          </div>
        </div>

        {/* INFORMACIÓN DEL CLIENTE */}
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

        {/* TABLA DE PRODUCTOS COTIZADOS */}
        <table className="w-full border-collapse mb-8 text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-left bg-slate-900 text-white">
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

        {/* RESUMEN DE TOTALES Y TÉRMINOS */}
        <div className="flex justify-between items-start gap-8 mt-6">
          <div className="text-[10px] text-slate-500 max-w-md space-y-1.5">
            <p className="font-bold text-slate-700 uppercase tracking-wider mb-1">Términos y Condiciones Generales</p>
            <p>1. Los precios indicados en este documento están expresados en USD y ya incluyen IVA (13%).</p>
            <p>2. Esta cotización representa un presupuesto informativo y no reserva existencias físicas en bodega.</p>
            <p>3. Los pagos pueden ser procesados mediante transferencia bancaria o efectivo en nuestras sucursales.</p>
            <p>4. Tiempo de entrega: Inmediato según stock, o coordinado con su respectivo gestor de cuenta.</p>
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
            <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-200">
              <span>TOTAL NETO (USD):</span>
              <span className="text-base font-black text-slate-900">${total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* SECCIÓN DE FIRMAS */}
        <div className="grid grid-cols-2 gap-12 mt-20 pt-10 border-t border-slate-100 text-center text-xs">
          <div className="space-y-1.5">
            <div className="w-48 border-b border-slate-400 mx-auto h-8"></div>
            <p className="font-bold text-slate-700">Firma Autorizada y Sello</p>
            <p className="text-[9px] text-slate-400 uppercase tracking-wide">Asesor Comercial NEXWAY</p>
          </div>
          <div className="space-y-1.5">
            <div className="w-48 border-b border-slate-400 mx-auto h-8"></div>
            <p className="font-bold text-slate-700">Aceptado por el Cliente</p>
            <p className="text-[9px] text-slate-400 uppercase tracking-wide">Nombre, Firma y Sello del Solicitante</p>
          </div>
        </div>
      </div>
    </>
  );
}
