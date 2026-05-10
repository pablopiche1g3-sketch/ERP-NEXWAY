
'use client';

import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Plus, 
  Trash2, 
  ArrowLeft, 
  ShoppingCart,
  Package,
  CreditCard,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useFirestore, useCollection } from '@/firebase';
import { collection, doc, updateDoc, addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

interface CartItem {
  id: string;
  name: string;
  sku: string;
  price: number;
  quantity: number;
}

export default function BillingPage() {
  const db = useFirestore();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: inventory, loading } = useCollection<any>(collection(db, 'inventory'));

  const filteredProducts = useMemo(() => {
    if (!inventory) return [];
    return inventory.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.sku.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, inventory]);

  const addToCart = (product: any) => {
    if (product.quantity <= 0) {
      toast({ variant: "destructive", title: "Sin Existencias", description: "No hay stock disponible para este código." });
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.quantity) {
          toast({ variant: "destructive", title: "Límite alcanzado", description: "No puedes vender más de la existencia actual." });
          return prev;
        }
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
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const total = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  const handleFinalizeSale = async () => {
    if (cart.length === 0) return;
    setIsProcessing(true);

    try {
      await addDoc(collection(db, 'sales'), {
        items: cart,
        total,
        timestamp: new Date().toISOString()
      });

      for (const item of cart) {
        const product = inventory.find(p => p.id === item.id);
        if (product) {
          const productRef = doc(db, 'inventory', item.id);
          await updateDoc(productRef, {
            quantity: Math.max(0, product.quantity - item.quantity)
          });
        }
      }

      toast({ title: "Facturación Completada", description: "Venta registrada y stock actualizado." });
      setCart([]);
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo procesar la venta." });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" className="rounded-full bg-white shadow-sm hover:bg-slate-100">
              <ArrowLeft className="text-slate-600" size={20} />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 font-headline">Facturación</h1>
            <p className="text-slate-500 text-sm">Emisión de venta y descarga de stock</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-2xl shadow-lg font-bold">
          <ShoppingCart size={18} />
          <span>Venta Activa</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Lado Izquierdo: Detalle Venta */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-900 text-white p-6">
              <div className="flex justify-between items-center mb-4">
                <CardTitle className="text-lg font-bold">Listado de Artículos</CardTitle>
                <div className="text-[10px] font-bold uppercase text-slate-400">NexWay POS</div>
              </div>
              <div className="flex justify-between items-end border-t border-slate-800 pt-4">
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-500">Subtotal de Venta</p>
                  <p className="text-4xl font-black text-blue-400">${total.toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase font-bold text-slate-500">Ítems</p>
                  <p className="text-xl font-bold">{cart.length}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[500px] overflow-y-auto">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="w-[50px] text-[10px] font-bold">CANT</TableHead>
                      <TableHead className="text-[10px] font-bold">PRODUCTO</TableHead>
                      <TableHead className="text-right text-[10px] font-bold">UNIT</TableHead>
                      <TableHead className="text-right text-[10px] font-bold">TOTAL</TableHead>
                      <TableHead className="w-[40px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cart.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-black text-blue-600">{item.quantity}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900">{item.name}</span>
                            <span className="text-[9px] font-mono text-slate-400">{item.sku}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-slate-500">${item.price.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-bold text-slate-900">${(item.price * item.quantity).toFixed(2)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => removeFromCart(item.id)} className="h-8 w-8 text-slate-300 hover:text-rose-500">
                            <Trash2 size={14} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
          
          <Button 
            className="w-full h-16 rounded-3xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xl shadow-lg"
            disabled={cart.length === 0 || isProcessing}
            onClick={handleFinalizeSale}
          >
            {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <CreditCard className="mr-2" />}
            Procesar Facturación
          </Button>
        </div>

        {/* Lado Derecho: Catálogo */}
        <div className="lg:col-span-7 space-y-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input 
              placeholder="Buscar por código o descripción..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 h-14 bg-white border-none shadow-sm rounded-2xl"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {inventory?.map((product) => {
              const isOutOfStock = product.quantity <= 0;
              return (
                <Card 
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className={`border-none shadow-sm rounded-3xl bg-white hover:shadow-md transition-all cursor-pointer group ${isOutOfStock ? 'bg-slate-50 opacity-60' : ''}`}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isOutOfStock ? 'bg-rose-100 text-rose-500' : 'bg-blue-50 text-blue-500'}`}>
                        <Package size={24} />
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Existencias</p>
                        <p className={`text-lg font-black ${isOutOfStock ? 'text-rose-600' : 'text-slate-900'}`}>
                          {product.quantity} un.
                        </p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-bold text-slate-900">{product.name}</h3>
                      <p className="text-xs font-mono font-bold text-slate-400">{product.sku}</p>
                    </div>
                    <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-50">
                      <div className="text-2xl font-black text-slate-900">${(product.price || 0).toFixed(2)}</div>
                      {isOutOfStock ? (
                        <div className="text-[10px] font-black text-rose-500 uppercase flex items-center gap-1">
                          <AlertCircle size={14} /> Agotado
                        </div>
                      ) : (
                        <div className="w-10 h-10 bg-slate-900 text-white rounded-full flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                          <Plus size={18} />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
