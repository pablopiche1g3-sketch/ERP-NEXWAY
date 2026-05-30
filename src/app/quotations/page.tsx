
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
  const [loadingInv, setLoadingInv] = useState(true);

  const loadInventory = async () => {
    try {
      setLoadingInv(true);
      const { data, error } = await supabase.from('inventory').select('*').order('sku');
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
      toast({ variant: "destructive", title: "Error", description: "No se pudo sincronizar el catálogo de inventario." });
    } finally {
      setLoadingInv(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, []);

  const filteredProducts = useMemo(() => {
    if (!inventory) return [];
    return inventory.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.sku.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, inventory]);

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

  const subtotal = quoteItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const iva = subtotal * 0.13;
  const total = subtotal + iva;

  const handleGenerateQuote = () => {
    if (quoteItems.length === 0) {
      toast({ variant: "destructive", title: "Cotización Vacía", description: "Debe agregar al menos un producto." });
      return;
    }
    toast({ title: "Documento Preparado", description: "Imprimiendo cotización..." });
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 print:bg-white print:p-0">
      <div className="max-w-7xl mx-auto flex items-center justify-between mb-6 print:hidden">
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
            <h1 className="text-2xl font-bold text-slate-900 font-headline">Presupuestos y Cotizaciones</h1>
            <p className="text-slate-500 text-sm">Generación de precios sin afectar inventario físico</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Panel Izquierdo: Resumen y Totales */}
        <div className="lg:col-span-4 space-y-4 print:col-span-12">
          <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white print:shadow-none print:border">
            <CardHeader className="bg-orange-600 text-white p-5 print:bg-white print:text-black print:border-b">
              <div className="flex justify-between items-center mb-2">
                <CardTitle className="text-base font-bold">Resumen del Cliente</CardTitle>
                <Badge variant="outline" className="text-[10px] text-orange-100 border-orange-400 uppercase print:hidden">
                  Cotización No Válida como Factura
                </Badge>
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-[9px] uppercase font-bold text-orange-200">Total Presupuestado</p>
                  <p className="text-3xl font-black text-white print:text-black">${total.toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">{quoteItems.length} Líneas</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[350px] print:h-auto">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="w-[40px] text-[10px] font-bold px-3 text-center">CANT</TableHead>
                      <TableHead className="text-[10px] font-bold">DESCRIPCIÓN</TableHead>
                      <TableHead className="text-right text-[10px] font-bold">SUBTOTAL</TableHead>
                      <TableHead className="w-[30px] print:hidden"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quoteItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-12 text-slate-400 italic text-xs">
                          Agregue códigos del catálogo maestro
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
                            className="w-12 h-7 text-center font-black text-orange-600 p-0 text-xs bg-transparent border-none print:text-black shadow-none focus-visible:ring-0"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900 text-[11px] leading-tight">{item.name}</span>
                            <span className="text-[9px] font-mono text-slate-400">{item.sku} • ${item.price.toFixed(2)} unit.</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-bold text-slate-900 text-[11px]">${(item.price * item.quantity).toFixed(2)}</TableCell>
                        <TableCell className="px-2 text-center print:hidden">
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
                  <span className="text-orange-600 print:text-black">${total.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Button 
            className="w-full h-14 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-lg shadow-lg print:hidden"
            disabled={quoteItems.length === 0}
            onClick={handleGenerateQuote}
          >
            <Printer className="mr-2" size={20} />
            Imprimir Presupuesto
          </Button>
        </div>

        {/* Panel Derecho: Catálogo Maestro */}
        <div className="lg:col-span-8 space-y-4 print:hidden">
          <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-100 px-4 py-2 flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Información del Solicitante</span>
              <FileText size={14} className="text-slate-300" />
            </div>
            <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
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

          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-tight flex items-center gap-2">
              <Package size={16} className="text-blue-500" />
              Catálogo de Códigos Autorizados
            </h2>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <Input 
                placeholder="Filtrar por SKU o nombre..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-10 bg-white border-none shadow-sm rounded-xl text-sm font-medium"
              />
            </div>
          </div>

          <ScrollArea className="h-[450px]">
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
                  className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 hover:border-orange-400 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between aspect-square"
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
  );
}
