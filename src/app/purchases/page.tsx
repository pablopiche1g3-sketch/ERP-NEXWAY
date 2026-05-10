
'use client';

import React, { useState } from 'react';
import { 
  Truck, 
  ArrowLeft, 
  Search, 
  Save,
  AlertTriangle,
  PackageCheck
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

export default function PurchasesPage() {
  const db = useFirestore();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [skuSearch, setSkuSearch] = useState('');
  const [foundProduct, setFoundProduct] = useState<any>(null);
  const [quantityToAdd, setQuantityToAdd] = useState(0);

  const handleSearchProduct = async () => {
    if (!skuSearch) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'inventory'), where("sku", "==", skuSearch.toUpperCase()));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setFoundProduct({ id: snap.docs[0].id, ...snap.docs[0].data() });
      } else {
        setFoundProduct(null);
        toast({ variant: "destructive", title: "Código no autorizado", description: "Este código no existe en el Inventario. Créelo primero." });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!foundProduct || quantityToAdd <= 0) return;

    setLoading(true);
    try {
      const productRef = doc(db, 'inventory', foundProduct.id);
      await updateDoc(productRef, {
        quantity: foundProduct.quantity + quantityToAdd
      });
      toast({ title: "Entrada Exitosa", description: `Se agregaron ${quantityToAdd} unidades al stock.` });
      setFoundProduct(null);
      setSkuSearch('');
      setQuantityToAdd(0);
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar el stock." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" className="rounded-full bg-white shadow-sm hover:bg-slate-100">
              <ArrowLeft className="text-slate-600" size={20} />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Registro de Compra</h1>
            <p className="text-slate-500 text-sm">Alimentación de stock para códigos autorizados</p>
          </div>
        </div>
        <div className="px-4 py-2 bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-500/20 font-bold flex items-center gap-2">
          <Truck size={18} />
          <span>Ingreso de Mercadería</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="border-none shadow-sm rounded-3xl bg-white p-8">
          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <div className="flex-1 space-y-2">
              <Label className="text-xs font-bold uppercase text-slate-400">Escanee o escriba el código SKU</Label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <Input 
                  placeholder="Ej. OIL-10W40" 
                  value={skuSearch}
                  onChange={e => setSkuSearch(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && handleSearchProduct()}
                  className="pl-12 h-14 bg-slate-50 border-slate-200 text-xl font-bold rounded-2xl"
                />
              </div>
            </div>
            <Button 
              onClick={handleSearchProduct}
              className="h-14 px-8 bg-slate-900 rounded-2xl font-bold self-end"
              disabled={loading}
            >
              Verificar Código
            </Button>
          </div>

          {foundProduct ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-top-4">
              <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-3xl flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-emerald-900">{foundProduct.name}</h3>
                  <p className="text-emerald-600 font-mono font-bold">{foundProduct.sku}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase text-emerald-500">Existencia Actual</p>
                  <p className="text-3xl font-black text-emerald-700">{foundProduct.quantity} un.</p>
                </div>
              </div>

              <form onSubmit={handleApplyPurchase} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-slate-400">Cantidad a Ingresar</Label>
                  <Input 
                    type="number"
                    value={quantityToAdd}
                    onChange={e => setQuantityToAdd(parseInt(e.target.value) || 0)}
                    className="h-14 text-2xl font-black bg-white border-slate-200 rounded-2xl"
                  />
                </div>
                <Button 
                  type="submit" 
                  className="h-14 bg-emerald-600 hover:bg-emerald-700 text-white text-xl font-bold rounded-2xl self-end"
                >
                  <Save className="mr-2" />
                  Cargar Stock
                </Button>
              </form>
            </div>
          ) : skuSearch && !loading && (
            <div className="py-20 text-center space-y-4 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
              <AlertTriangle className="mx-auto text-amber-500" size={48} />
              <div>
                <p className="text-slate-900 font-bold text-lg">Producto no encontrado</p>
                <p className="text-slate-500 text-sm max-w-xs mx-auto">
                  El código ingresado no ha sido autorizado. Por favor regístrelo en el módulo de Inventario primero.
                </p>
              </div>
              <Link href="/inventory">
                <Button variant="outline" className="rounded-xl border-slate-300 font-bold">
                  Ir a Maestro de Productos
                </Button>
              </Link>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
