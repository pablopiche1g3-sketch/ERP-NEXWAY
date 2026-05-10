
'use client';

import React, { useState, useRef } from 'react';
import { 
  Truck, 
  ArrowLeft, 
  Search, 
  Save,
  AlertTriangle,
  Upload,
  FileJson,
  Loader2,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import Link from 'next/link';

export default function PurchasesPage() {
  const db = useFirestore();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [skuSearch, setSkuSearch] = useState('');
  const [foundProduct, setFoundProduct] = useState<any>(null);
  const [quantityToAdd, setQuantityToAdd] = useState(0);

  // Estados para carga masiva
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [bulkStatus, setBulkStatus] = useState<{ success: number; failed: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const processBulkJson = async (jsonData: any[]) => {
    setLoading(true);
    setUploadProgress(0);
    let successCount = 0;
    const failedSkus: string[] = [];

    const total = jsonData.length;
    
    for (let i = 0; i < total; i++) {
      const item = jsonData[i];
      const sku = item.sku?.toUpperCase();
      const qty = parseInt(item.quantity);

      if (!sku || isNaN(qty)) {
        failedSkus.push(sku || "Sin SKU");
        continue;
      }

      try {
        const q = query(collection(db, 'inventory'), where("sku", "==", sku));
        const snap = await getDocs(q);
        
        if (!snap.empty) {
          const productDoc = snap.docs[0];
          const currentQty = productDoc.data().quantity || 0;
          await updateDoc(doc(db, 'inventory', productDoc.id), {
            quantity: currentQty + qty
          });
          successCount++;
        } else {
          failedSkus.push(sku);
        }
      } catch (err) {
        failedSkus.push(sku);
      }
      
      setUploadProgress(Math.round(((i + 1) / total) * 100));
    }

    setBulkStatus({ success: successCount, failed: failedSkus });
    setLoading(false);
    
    if (failedSkus.length === 0) {
      toast({ title: "Carga Masiva Completada", description: `Se procesaron ${successCount} productos con éxito.` });
    } else {
      toast({ 
        variant: "destructive", 
        title: "Carga Finalizada con Advertencias", 
        description: `Éxito: ${successCount}, Fallidos: ${failedSkus.length}. Revise los códigos no autorizados.` 
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readFile(file);
  };

  const readFile = (file: File) => {
    if (file.type !== "application/json" && !file.name.endsWith('.json')) {
      toast({ variant: "destructive", title: "Formato no válido", description: "Por favor suba un archivo .json" });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (!Array.isArray(json)) {
          throw new Error("El JSON debe ser un arreglo de objetos [{sku, quantity}, ...]");
        }
        processBulkJson(json);
      } catch (err) {
        toast({ variant: "destructive", title: "Error de lectura", description: "El archivo JSON no tiene un formato válido." });
      }
    };
    reader.readAsText(file);
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
            <p className="text-slate-500 text-sm">Alimentación de stock para códigos autorizados</p>
          </div>
        </div>
        <div className="px-4 py-2 bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-500/20 font-bold flex items-center gap-2">
          <Truck size={18} />
          <span>Ingreso de Mercadería</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Lado Izquierdo: Ingreso Manual */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="border-none shadow-sm rounded-3xl bg-white p-6">
            <CardHeader className="px-0 pt-0">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Search size={18} className="text-slate-400" />
                Ingreso Manual por SKU
              </CardTitle>
            </CardHeader>
            <div className="flex flex-col md:flex-row gap-3 mb-6">
              <div className="flex-1 space-y-1.5">
                <Label className="text-[10px] font-bold uppercase text-slate-400">Código SKU</Label>
                <Input 
                  placeholder="Ej. OIL-10W40" 
                  value={skuSearch}
                  onChange={e => setSkuSearch(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && handleSearchProduct()}
                  className="h-12 bg-slate-50 border-slate-200 text-lg font-bold rounded-xl"
                />
              </div>
              <Button 
                onClick={handleSearchProduct}
                className="h-12 px-6 bg-slate-900 rounded-xl font-bold self-end"
                disabled={loading}
              >
                {loading ? <Loader2 className="animate-spin" /> : 'Verificar'}
              </Button>
            </div>

            {foundProduct ? (
              <div className="space-y-6 animate-in fade-in slide-in-from-top-4">
                <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-emerald-900">{foundProduct.name}</h3>
                    <p className="text-emerald-600 font-mono font-bold text-xs">{foundProduct.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase text-emerald-500">Stock Actual</p>
                    <p className="text-2xl font-black text-emerald-700">{foundProduct.quantity} un.</p>
                  </div>
                </div>

                <form onSubmit={handleApplyPurchase} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase text-slate-400">Cantidad a Sumar</Label>
                    <Input 
                      type="number"
                      value={quantityToAdd}
                      onChange={e => setQuantityToAdd(parseInt(e.target.value) || 0)}
                      className="h-12 text-xl font-black bg-white border-slate-200 rounded-xl"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl self-end"
                  >
                    <Save className="mr-2" size={18} />
                    Aplicar Ingreso
                  </Button>
                </form>
              </div>
            ) : skuSearch && !loading && (
              <div className="py-12 text-center space-y-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <AlertTriangle className="mx-auto text-amber-500" size={32} />
                <div className="space-y-1">
                  <p className="text-slate-900 font-bold text-sm">SKU no autorizado</p>
                  <p className="text-slate-500 text-[10px] max-w-[200px] mx-auto">
                    Debe registrarlo primero en el módulo de Inventario.
                  </p>
                </div>
                <Link href="/inventory">
                  <Button variant="outline" size="sm" className="rounded-lg border-slate-300 font-bold text-xs">
                    Ir a Maestro
                  </Button>
                </Link>
              </div>
            )}
          </Card>
        </div>

        {/* Lado Derecho: Carga Masiva JSON */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="border-none shadow-sm rounded-3xl bg-white p-6">
            <CardHeader className="px-0 pt-0">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <FileJson size={18} className="text-blue-500" />
                Carga Masiva (JSON)
              </CardTitle>
            </CardHeader>
            
            <div 
              className={`relative border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center transition-all cursor-pointer group ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-slate-50 hover:border-blue-300'}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); const file = e.dataTransfer.files[0]; if (file) readFile(file); }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
                className="hidden" 
                accept=".json"
              />
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Upload size={24} />
              </div>
              <p className="text-sm font-bold text-slate-900">Arrastre su archivo JSON aquí</p>
              <p className="text-[10px] text-slate-400 mt-1">O haga clic para seleccionar</p>
              <div className="mt-4 p-2 bg-white rounded-lg border border-slate-100 text-[9px] font-mono text-slate-400">
                Formato: [{"{sku: \"SKU1\", quantity: 10}"}, ...]
              </div>
            </div>

            {loading && uploadProgress > 0 && (
              <div className="mt-6 space-y-2">
                <div className="flex justify-between text-[10px] font-bold">
                  <span className="text-slate-400 uppercase">Procesando archivo...</span>
                  <span className="text-blue-600">{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2 rounded-full" />
              </div>
            )}

            {bulkStatus && (
              <div className="mt-6 p-4 bg-slate-900 rounded-2xl text-white space-y-3 animate-in fade-in slide-in-from-bottom-2">
                <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest border-b border-slate-800 pb-2">Resultado de Operación</p>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="text-emerald-400" size={16} />
                  <span className="text-sm font-bold">{bulkStatus.success} Procesados</span>
                </div>
                {bulkStatus.failed.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <XCircle className="text-rose-400" size={16} />
                      <span className="text-sm font-bold">{bulkStatus.failed.length} Fallidos (No Autorizados)</span>
                    </div>
                    <div className="max-h-24 overflow-y-auto bg-black/30 rounded-lg p-2">
                      {bulkStatus.failed.map((sku, idx) => (
                        <div key={idx} className="text-[9px] font-mono text-rose-300 flex items-center gap-1">
                          • {sku}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setBulkStatus(null)}
                  className="w-full text-slate-400 hover:text-white text-[10px] font-bold h-8"
                >
                  Limpiar historial
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
