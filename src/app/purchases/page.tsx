
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
  XCircle,
  QrCode,
  FileCode
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, updateDoc, doc, addDoc } from 'firebase/firestore';
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

  // Estados para información DTE de la compra
  const [dteNumber, setDteNumber] = useState('');
  const [generationCode, setGenerationCode] = useState('');

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
      
      // Actualizar existencia
      await updateDoc(productRef, {
        quantity: foundProduct.quantity + quantityToAdd
      });

      // Registrar la transacción de compra para historial
      await addDoc(collection(db, 'purchase_history'), {
        sku: foundProduct.sku,
        name: foundProduct.name,
        quantity: quantityToAdd,
        dteNumber: dteNumber,
        generationCode: generationCode,
        timestamp: new Date().toISOString()
      });

      toast({ title: "Entrada Exitosa", description: `Se agregaron ${quantityToAdd} unidades al stock.` });
      
      // Limpiar formulario
      setFoundProduct(null);
      setSkuSearch('');
      setQuantityToAdd(0);
      setDteNumber('');
      setGenerationCode('');
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

          // Registrar en historial masivo
          await addDoc(collection(db, 'purchase_history'), {
            sku: sku,
            name: productDoc.data().name,
            quantity: qty,
            dteNumber: dteNumber || 'CARGA_MASIVA',
            generationCode: generationCode || 'CARGA_MASIVA',
            timestamp: new Date().toISOString()
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
      <div className="max-w-6xl mx-auto mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" className="rounded-full bg-white shadow-sm hover:bg-slate-100">
              <ArrowLeft className="text-slate-600" size={20} />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Registro de Compra</h1>
            <p className="text-slate-500 text-sm">Alimentación de stock y control de DTE proveedor</p>
          </div>
        </div>
        <div className="px-4 py-2 bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-500/20 font-bold flex items-center gap-2">
          <Truck size={18} />
          <span>Ingreso de Mercadería</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto space-y-6">
        {/* Card de Información del Documento (Global) */}
        <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-100 px-6 py-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Información del Comprobante (Proveedor)</span>
          </div>
          <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
                <QrCode size={12} className="text-emerald-500" /> No. de DTE de Compra
              </Label>
              <Input 
                placeholder="Ej. DTE-2023-..." 
                value={dteNumber}
                onChange={e => setDteNumber(e.target.value)}
                className="h-11 bg-slate-50 border-slate-200 rounded-xl focus:ring-emerald-500/20 font-medium"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
                <FileCode size={12} className="text-emerald-500" /> Código de Generación
              </Label>
              <Input 
                placeholder="Ej. GEN-48A2..." 
                value={generationCode}
                onChange={e => setGenerationCode(e.target.value)}
                className="h-11 bg-slate-50 border-slate-200 rounded-xl focus:ring-emerald-500/20 font-medium"
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Lado Izquierdo: Ingreso Manual */}
          <div className="lg:col-span-7 space-y-6">
            <Card className="border-none shadow-sm rounded-3xl bg-white p-6 h-full">
              <CardHeader className="px-0 pt-0">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Search size={18} className="text-slate-400" />
                  Búsqueda por SKU
                </CardTitle>
              </CardHeader>
              
              <div className="flex flex-col md:flex-row gap-3 mb-8">
                <div className="flex-1 space-y-1.5">
                  <Label className="text-[10px] font-bold uppercase text-slate-400">Escanee o escriba SKU</Label>
                  <Input 
                    placeholder="OIL-10W40" 
                    value={skuSearch}
                    onChange={e => setSkuSearch(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === 'Enter' && handleSearchProduct()}
                    className="h-14 bg-slate-50 border-slate-200 text-2xl font-black rounded-2xl"
                  />
                </div>
                <Button 
                  onClick={handleSearchProduct}
                  className="h-14 px-8 bg-slate-900 rounded-2xl font-bold self-end shadow-lg"
                  disabled={loading}
                >
                  {loading ? <Loader2 className="animate-spin" /> : 'Verificar SKU'}
                </Button>
              </div>

              {foundProduct ? (
                <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-3xl flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-emerald-900">{foundProduct.name}</h3>
                      <div className="flex gap-2 mt-1">
                        <span className="text-emerald-600 font-mono font-bold text-xs bg-white px-2 py-0.5 rounded border border-emerald-100">{foundProduct.sku}</span>
                        <span className="text-slate-400 font-bold text-[10px] uppercase">Estado: Autorizado</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase text-emerald-500">Existencia Actual</p>
                      <p className="text-4xl font-black text-emerald-700">{foundProduct.quantity}</p>
                    </div>
                  </div>

                  <form onSubmit={handleApplyPurchase} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase text-slate-400">Unidades Recibidas</Label>
                      <Input 
                        type="number"
                        value={quantityToAdd}
                        onChange={e => setQuantityToAdd(parseInt(e.target.value) || 0)}
                        className="h-14 text-3xl font-black bg-white border-slate-200 rounded-2xl text-center focus:ring-emerald-500/20"
                      />
                    </div>
                    <Button 
                      type="submit" 
                      className="h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl self-end shadow-xl shadow-emerald-500/20"
                      disabled={quantityToAdd <= 0 || loading}
                    >
                      <Save className="mr-2" size={20} />
                      Aplicar al Inventario
                    </Button>
                  </form>
                </div>
              ) : skuSearch && !loading && (
                <div className="py-16 text-center space-y-6 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                  <div className="w-16 h-16 bg-amber-100 text-amber-500 rounded-full flex items-center justify-center mx-auto">
                    <AlertTriangle size={32} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-slate-900">Código no encontrado</h3>
                    <p className="text-slate-500 text-sm max-w-xs mx-auto">
                      El SKU <span className="font-bold text-slate-900">"{skuSearch}"</span> no está en el maestro de productos autorizados.
                    </p>
                  </div>
                  <Link href="/inventory">
                    <Button variant="outline" className="rounded-xl border-slate-300 font-bold px-8">
                      Ir a Registrar Código
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
                  Carga Masiva (Archivo JSON)
                </CardTitle>
              </CardHeader>
              
              <div 
                className={`relative border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center transition-all cursor-pointer group ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-slate-50 hover:border-blue-300'}`}
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
                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-sm">
                  <Upload size={28} />
                </div>
                <p className="text-sm font-bold text-slate-900">Arrastre su factura digital aquí</p>
                <p className="text-[10px] text-slate-400 mt-2 uppercase font-black tracking-widest">O haga clic para seleccionar archivo</p>
                
                <div className="mt-8 w-full p-4 bg-white rounded-2xl border border-slate-100 shadow-sm text-[10px] font-mono text-slate-400 relative">
                  <span className="absolute -top-2 left-4 bg-white px-2 text-[8px] font-black text-blue-500 uppercase">Estructura esperada</span>
                  [{"{ \"sku\": \"PROD-1\", \"quantity\": 50 }"}, ...]
                </div>
              </div>

              {loading && uploadProgress > 0 && (
                <div className="mt-8 space-y-3">
                  <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-slate-400 uppercase tracking-widest">Sincronizando con Inventario...</span>
                    <span className="text-blue-600">{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2 rounded-full bg-blue-50" />
                </div>
              )}

              {bulkStatus && (
                <div className="mt-8 p-6 bg-slate-900 rounded-3xl text-white space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Resultado de Carga</p>
                    <Badge variant="outline" className="text-[9px] border-slate-700 text-slate-400">Ref: {dteNumber || 'N/A'}</Badge>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400">
                      <CheckCircle2 size={20} />
                    </div>
                    <div>
                      <p className="text-lg font-bold">{bulkStatus.success}</p>
                      <p className="text-[10px] text-emerald-500 font-bold uppercase">Productos Actualizados</p>
                    </div>
                  </div>
                  {bulkStatus.failed.length > 0 && (
                    <div className="space-y-3 bg-black/40 p-4 rounded-2xl">
                      <div className="flex items-center gap-3 text-rose-400">
                        <XCircle size={18} />
                        <span className="text-xs font-bold">{bulkStatus.failed.length} SKUs no autorizados</span>
                      </div>
                      <ScrollArea className="h-24">
                        <div className="grid grid-cols-2 gap-2">
                          {bulkStatus.failed.map((sku, idx) => (
                            <div key={idx} className="text-[10px] font-mono text-rose-300 bg-rose-500/10 px-2 py-1 rounded">
                              • {sku}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setBulkStatus(null)}
                    className="w-full text-slate-500 hover:text-white text-[10px] font-bold h-10 hover:bg-slate-800 rounded-xl"
                  >
                    Cerrar Reporte
                  </Button>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
