
'use client';

import React, { useState } from 'react';
import { 
  Truck, 
  Plus, 
  ArrowLeft, 
  Search, 
  Save,
  PackagePlus,
  History
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFirestore, useCollection } from '@/firebase';
import { collection, addDoc, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

interface ProductForm {
  sku: string;
  name: string;
  quantity: number;
  price: number; // Precio de Venta
  cost: number;  // Precio de Compra
  category: string;
}

export default function PurchasesPage() {
  const db = useFirestore();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<ProductForm>({
    sku: '',
    name: '',
    quantity: 0,
    price: 0,
    cost: 0,
    category: 'Repuestos'
  });

  const handleRegisterPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.sku || !form.name || form.quantity <= 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Por favor complete los campos obligatorios.",
      });
      return;
    }

    setLoading(true);
    try {
      const invRef = collection(db, 'inventory');
      const q = query(invRef, where("sku", "==", form.sku));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        // Actualizar stock existente
        const productDoc = querySnapshot.docs[0];
        const existingData = productDoc.data();
        await updateDoc(doc(db, 'inventory', productDoc.id), {
          quantity: existingData.quantity + form.quantity,
          price: form.price || existingData.price,
          name: form.name || existingData.name
        });
        toast({ title: "Stock Actualizado", description: `Se añadieron ${form.quantity} unidades a ${form.name}.` });
      } else {
        // Crear nuevo producto
        await addDoc(invRef, {
          ...form,
          createdAt: new Date().toISOString()
        });
        toast({ title: "Producto Registrado", description: `${form.name} ha sido ingresado al sistema.` });
      }

      setForm({ sku: '', name: '', quantity: 0, price: 0, cost: 0, category: 'Repuestos' });
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo registrar la compra." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" className="rounded-full bg-white shadow-sm hover:bg-slate-100">
              <ArrowLeft className="text-slate-600" size={20} />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Registro de Compra</h1>
            <p className="text-slate-500 text-sm">Ingreso de mercadería al inventario</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-500/20 font-bold">
          <Truck size={18} />
          <span>Nueva Entrada</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Formulario de Registro */}
        <div className="lg:col-span-2">
          <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-900 text-white p-6">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <PackagePlus size={20} />
                Detalles del Producto
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <form onSubmit={handleRegisterPurchase} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-slate-400">Código (SKU)</Label>
                    <Input 
                      placeholder="Ej. OIL-1040" 
                      value={form.sku}
                      onChange={e => setForm({...form, sku: e.target.value})}
                      className="bg-slate-50 border-slate-200 h-12 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-slate-400">Nombre del Producto</Label>
                    <Input 
                      placeholder="Nombre descriptivo" 
                      value={form.name}
                      onChange={e => setForm({...form, name: e.target.value})}
                      className="bg-slate-50 border-slate-200 h-12 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-slate-400">Cantidad Recibida</Label>
                    <Input 
                      type="number"
                      value={form.quantity}
                      onChange={e => setForm({...form, quantity: parseInt(e.target.value) || 0})}
                      className="bg-slate-50 border-slate-200 h-12 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-slate-400">Categoría</Label>
                    <Input 
                      placeholder="Ej. Lubricantes" 
                      value={form.category}
                      onChange={e => setForm({...form, category: e.target.value})}
                      className="bg-slate-50 border-slate-200 h-12 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-slate-400 text-emerald-600">Costo Unitario ($)</Label>
                    <Input 
                      type="number"
                      step="0.01"
                      value={form.cost}
                      onChange={e => setForm({...form, cost: parseFloat(e.target.value) || 0})}
                      className="bg-emerald-50 border-emerald-100 h-12 rounded-xl focus:ring-emerald-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-slate-400 text-blue-600">Precio de Venta ($)</Label>
                    <Input 
                      type="number"
                      step="0.01"
                      value={form.price}
                      onChange={e => setForm({...form, price: parseFloat(e.target.value) || 0})}
                      className="bg-blue-50 border-blue-100 h-12 rounded-xl focus:ring-blue-500"
                    />
                  </div>
                </div>

                <Button 
                  type="submit"
                  disabled={loading}
                  className="w-full h-14 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold text-lg shadow-lg"
                >
                  <Save className="mr-2" size={20} />
                  {loading ? 'Procesando...' : 'Registrar Entrada de Mercadería'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Resumen / Información adicional */}
        <div className="space-y-6">
          <Card className="border-none shadow-sm rounded-3xl bg-white p-6">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <History size={18} className="text-slate-400" />
              Impacto en Inventario
            </h3>
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-2xl">
                <p className="text-xs text-slate-500 uppercase font-bold">Monto Total Invertido</p>
                <p className="text-2xl font-black text-slate-900">${(form.quantity * form.cost).toFixed(2)}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl">
                <p className="text-xs text-slate-500 uppercase font-bold">Ganancia Proyectada</p>
                <p className="text-2xl font-black text-emerald-600">
                  ${(form.quantity * (form.price - form.cost)).toFixed(2)}
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
