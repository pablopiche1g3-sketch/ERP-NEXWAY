
'use client';

import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Plus, 
  Trash2, 
  ArrowLeft, 
  ShoppingCart,
  Package,
  CreditCard
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Link from 'next/link';

// Mock data for products
const MOCK_PRODUCTS = [
  { id: '1', code: 'PROD-001', name: 'Aceite de Motor 10W40', price: 45.00, stock: 24 },
  { id: '2', code: 'PROD-002', name: 'Filtro de Aire Universal', price: 12.50, stock: 50 },
  { id: '3', code: 'PROD-003', name: 'Pastillas de Freno Delanteras', price: 35.00, stock: 12 },
  { id: '4', code: 'PROD-004', name: 'Bujía de Iridio', price: 8.75, stock: 100 },
  { id: '5', code: 'PROD-005', name: 'Líquido de Frenos 500ml', price: 9.90, stock: 30 },
  { id: '6', code: 'PROD-006', name: 'Batería 12V 75Ah', price: 110.00, stock: 8 },
];

interface CartItem {
  id: string;
  name: string;
  code: string;
  price: number;
  quantity: number;
}

export default function BillingPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);

  // Filter products based on search
  const filteredProducts = useMemo(() => {
    return MOCK_PRODUCTS.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.code.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm]);

  const addToCart = (product: typeof MOCK_PRODUCTS[0]) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { 
        id: product.id, 
        name: product.name, 
        code: product.code, 
        price: product.price, 
        quantity: 1 
      }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const total = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" className="rounded-full bg-white shadow-sm hover:bg-slate-100">
              <ArrowLeft className="text-slate-600" size={20} />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 font-headline">Facturación</h1>
            <p className="text-slate-500 text-sm">Punto de Venta / Emisión de DTE</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-500/20 font-bold">
          <ShoppingCart size={18} />
          <span>Venta Activa</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: Cart / Current Invoice */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-900 text-white p-6">
              <div className="flex justify-between items-center mb-4">
                <CardTitle className="text-lg font-bold">Detalle de Venta</CardTitle>
                <div className="text-xs font-medium uppercase tracking-wider text-slate-400">NexWay POS v1.0</div>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800">
                <div className="text-center">
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Items</p>
                  <p className="text-lg font-bold">{cart.length}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Subtotal</p>
                  <p className="text-lg font-bold">${total.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-slate-500 uppercase font-bold text-blue-400">Total</p>
                  <p className="text-lg font-bold text-blue-400">${total.toFixed(2)}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[500px] overflow-y-auto">
                <Table>
                  <TableHeader className="bg-slate-50 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="w-[50px] text-[10px] font-bold uppercase">Cant</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase">Producto</TableHead>
                      <TableHead className="text-right text-[10px] font-bold uppercase">Precio</TableHead>
                      <TableHead className="text-right text-[10px] font-bold uppercase">Total</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cart.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-40 text-center text-slate-400 italic">
                          No hay productos en la lista
                        </TableCell>
                      </TableRow>
                    ) : (
                      cart.map((item) => (
                        <TableRow key={item.id} className="hover:bg-slate-50 transition-colors">
                          <TableCell className="font-bold text-slate-900">{item.quantity}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium text-slate-900">{item.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono">{item.code}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-slate-600">${item.price.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-bold text-slate-900">
                            ${(item.price * item.quantity).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => removeFromCart(item.id)}
                              className="text-slate-300 hover:text-red-500"
                            >
                              <Trash2 size={16} />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
          
          <Button 
            className="w-full h-16 rounded-3xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xl shadow-lg shadow-blue-500/20"
            disabled={cart.length === 0}
          >
            <CreditCard className="mr-2" />
            Finalizar Facturación
          </Button>
        </div>

        {/* Right Side: Product Search and Selection */}
        <div className="lg:col-span-7 space-y-6">
          {/* Search Area */}
          <div className="flex justify-end">
            <div className="relative w-full md:w-80 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-blue-500 transition-colors" />
              <Input 
                placeholder="Buscar por código o nombre..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 h-14 bg-white border-none shadow-sm rounded-2xl focus:ring-2 focus:ring-blue-500/20 text-slate-900"
              />
            </div>
          </div>

          {/* Product Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-fit">
            {filteredProducts.map((product) => (
              <Card 
                key={product.id}
                onClick={() => addToCart(product)}
                className="border-none shadow-sm rounded-3xl bg-white hover:shadow-md transition-all cursor-pointer group active:scale-[0.98]"
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                      <Package size={24} />
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Código</p>
                      <p className="text-xs font-mono font-bold text-slate-900">{product.code}</p>
                    </div>
                  </div>
                  <div className="space-y-1 mb-4">
                    <h3 className="font-bold text-slate-900 leading-tight">{product.name}</h3>
                    <p className="text-xs text-slate-400">Stock disponible: {product.stock} un.</p>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                    <div className="text-2xl font-black text-slate-900">${product.price.toFixed(2)}</div>
                    <div className="w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center text-white shadow-lg group-hover:bg-blue-600 transition-colors">
                      <Plus size={18} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredProducts.length === 0 && (
              <div className="col-span-full py-20 text-center">
                <p className="text-slate-400">No se encontraron productos con ese criterio.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
