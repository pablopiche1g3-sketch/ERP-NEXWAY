
'use client';

import React, { useState } from 'react';
import { 
  Calculator, 
  History, 
  Users, 
  Package, 
  Plus, 
  Send, 
  Trash2,
  CircleCheck
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Link from 'next/link';

interface QuoteItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export default function QuotationsPage() {
  const [items, setItems] = useState<QuoteItem[]>([
    { id: '1', description: '', quantity: 0, unitPrice: 0 }
  ]);

  const addItem = () => {
    setItems([...items, { id: Math.random().toString(), description: '', quantity: 0, unitPrice: 0 }]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof QuoteItem, value: string | number) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const subtotal = items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
  const iva = subtotal * 0.13;
  const total = subtotal + iva;

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* Sidebar - NexWay Admin */}
      <aside className="w-64 bg-[#111827] text-white flex flex-col">
        <div className="p-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            NexWay <span className="text-blue-400">Admin</span>
          </h2>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          <Link href="/quotations" className="flex items-center gap-3 px-4 py-3 bg-blue-600 rounded-xl text-white font-medium">
            <Calculator size={20} />
            Nueva Cotización
          </Link>
          <Link href="#" className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800 rounded-xl transition-colors">
            <History size={20} />
            Historial DTE
          </Link>
          <Link href="#" className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800 rounded-xl transition-colors">
            <Users size={20} />
            Clientes (Receptores)
          </Link>
          <Link href="#" className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:bg-slate-800 rounded-xl transition-colors">
            <Package size={20} />
            Inventario / Servicios
          </Link>
        </nav>
        <div className="p-6 border-t border-slate-800">
          <p className="text-[10px] text-slate-500 font-medium">v1.0 Prototipo DTE El Salvador</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center sticky top-0 z-10">
          <h1 className="text-sm font-bold text-slate-600 uppercase tracking-widest">
            Generador de Cotización Electrónica
          </h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1 bg-green-50 text-green-600 rounded-full text-xs font-bold border border-green-100">
              <CircleCheck size={14} />
              Conectado a Hacienda
            </div>
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
              PA
            </div>
          </div>
        </header>

        <div className="p-8 max-w-5xl mx-auto space-y-6">
          {/* Receptor Info */}
          <Card className="border-none shadow-sm rounded-2xl">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2 text-slate-400">
                <Users size={18} />
                <CardTitle className="text-xs font-bold uppercase tracking-wider">Información del Receptor</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-slate-400">Nombre o Razón Social</Label>
                <Input placeholder="Ej. Juan Pérez" className="bg-slate-50 border-slate-200" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-slate-400">NIT / DUI</Label>
                <Input placeholder="0000-000000-000-0" className="bg-slate-50 border-slate-200" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-slate-400">NRC</Label>
                <Input placeholder="Registro de Contribuyente" className="bg-slate-50 border-slate-200" />
              </div>
            </CardContent>
          </Card>

          {/* Items Section */}
          <Card className="border-none shadow-sm rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div className="flex items-center gap-2 text-slate-400">
                <Package size={18} />
                <CardTitle className="text-xs font-bold uppercase tracking-wider">Ítems de la Cotización</CardTitle>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={addItem}
                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-bold"
              >
                <Plus size={16} className="mr-1" />
                Agregar Fila
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead className="text-[10px] font-bold uppercase">Descripción del Producto/Servicio</TableHead>
                    <TableHead className="w-[100px] text-center text-[10px] font-bold uppercase">Cant.</TableHead>
                    <TableHead className="w-[150px] text-center text-[10px] font-bold uppercase">Precio Unit.</TableHead>
                    <TableHead className="w-[150px] text-right text-[10px] font-bold uppercase">Subtotal</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Input 
                          placeholder="Escriba aquí..." 
                          variant="ghost" 
                          className="border-none bg-transparent shadow-none"
                          value={item.description}
                          onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Input 
                          type="number" 
                          variant="ghost" 
                          className="border-none bg-transparent shadow-none text-center"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-slate-400 text-sm">$</span>
                          <Input 
                            type="number" 
                            variant="ghost" 
                            className="border-none bg-transparent shadow-none w-24 text-center"
                            value={item.unitPrice}
                            onChange={(e) => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold text-slate-900">
                        ${(item.quantity * item.unitPrice).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => removeItem(item.id)}
                          className="text-slate-300 hover:text-red-500"
                          disabled={items.length === 1}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Totals & Submit */}
          <div className="flex flex-col items-end gap-6">
            <Card className="w-80 border-none shadow-sm rounded-2xl bg-white overflow-hidden">
              <CardContent className="p-6 space-y-4">
                <div className="flex justify-between items-center text-slate-500">
                  <span className="text-sm">Subtotal:</span>
                  <span className="font-bold">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-500">
                  <span className="text-sm">IVA (13%):</span>
                  <span className="font-bold">${iva.toFixed(2)}</span>
                </div>
                <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-lg font-black text-blue-900 uppercase">Total:</span>
                  <span className="text-2xl font-black text-blue-600">${total.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>

            <Button className="w-80 h-16 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-lg shadow-xl shadow-blue-500/20 group">
              <Send className="mr-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" size={20} />
              GENERAR DTE
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
