
'use client';

import React, { useState } from 'react';
import { 
  Package, 
  Plus, 
  ArrowLeft, 
  Search, 
  Trash2,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useFirestore, useCollection } from '@/firebase';
import { collection, addDoc, deleteDoc, doc, query, where, getDocs } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

export default function InventoryMasterPage() {
  const db = useFirestore();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [form, setForm] = useState({
    sku: '',
    name: '',
    category: 'General',
    price: 0
  });

  const { data: inventory, loading: loadingInv } = useCollection<any>(collection(db, 'inventory'));

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.sku || !form.name) {
      toast({ variant: "destructive", title: "Campos incompletos", description: "SKU y Nombre son obligatorios." });
      return;
    }

    setLoading(true);
    try {
      const q = query(collection(db, 'inventory'), where("sku", "==", form.sku));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        toast({ variant: "destructive", title: "Error", description: "Este código SKU ya existe en el sistema." });
        setLoading(false);
        return;
      }

      await addDoc(collection(db, 'inventory'), {
        ...form,
        quantity: 0, // Inicia sin existencia
        createdAt: new Date().toISOString()
      });

      toast({ title: "Código Autorizado", description: "El producto ha sido registrado en el maestro." });
      setForm({ sku: '', name: '', category: 'General', price: 0 });
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo crear el producto." });
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = inventory?.filter(item => 
    item.sku.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" className="rounded-full bg-white shadow-sm hover:bg-slate-100">
              <ArrowLeft className="text-slate-600" size={20} />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Maestro de Productos</h1>
            <p className="text-slate-500 text-sm">Administración de códigos autorizados</p>
          </div>
        </div>
        <div className="px-4 py-2 bg-rose-500 text-white rounded-2xl shadow-lg shadow-rose-500/20 font-bold flex items-center gap-2">
          <Package size={18} />
          <span>Gestión de Catálogo</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Registro de Código */}
        <Card className="border-none shadow-sm rounded-3xl bg-white h-fit">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Plus size={20} className="text-rose-500" />
              Nuevo Código
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateProduct} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-slate-400">Código SKU</Label>
                <Input 
                  placeholder="Ej. OIL-10W40" 
                  value={form.sku}
                  onChange={e => setForm({...form, sku: e.target.value.toUpperCase()})}
                  className="bg-slate-50 border-slate-200"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-slate-400">Nombre Descriptivo</Label>
                <Input 
                  placeholder="Nombre del producto" 
                  value={form.name}
                  onChange={e => setForm({...form, name: e.target.value})}
                  className="bg-slate-50 border-slate-200"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-slate-400">Precio de Venta Sugerido ($)</Label>
                <Input 
                  type="number"
                  step="0.01"
                  value={form.price}
                  onChange={e => setForm({...form, price: parseFloat(e.target.value) || 0})}
                  className="bg-slate-50 border-slate-200"
                />
              </div>
              <Button disabled={loading} className="w-full bg-slate-900 h-12 rounded-xl font-bold">
                {loading ? 'Procesando...' : 'Autorizar Código'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Listado de Productos Autorizados */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <Input 
              placeholder="Buscar por SKU o Nombre..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-12 h-12 bg-white border-none shadow-sm rounded-2xl"
            />
          </div>

          <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="text-[10px] font-bold uppercase">SKU</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase">Producto</TableHead>
                  <TableHead className="text-center text-[10px] font-bold uppercase">Existencia</TableHead>
                  <TableHead className="text-right text-[10px] font-bold uppercase">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingInv ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-10">Cargando catálogo...</TableCell></TableRow>
                ) : filteredItems?.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono font-bold text-slate-600">{item.sku}</TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-center font-bold">
                      <span className={item.quantity <= 0 ? 'text-rose-500' : 'text-emerald-600'}>
                        {item.quantity} un.
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {item.quantity <= 0 ? (
                        <div className="inline-flex items-center gap-1 text-[10px] font-bold uppercase bg-rose-50 text-rose-600 px-2 py-1 rounded-full border border-rose-100">
                          <AlertCircle size={10} />
                          Sin Existencia
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1 text-[10px] font-bold uppercase bg-emerald-50 text-emerald-600 px-2 py-1 rounded-full border border-emerald-100">
                          En Stock
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      </div>
    </div>
  );
}
