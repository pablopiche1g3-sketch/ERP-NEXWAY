'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileSpreadsheet, Database, CheckCircle2, AlertCircle, FileCode, ArrowRight } from 'lucide-react';
import * as XLSX from 'xlsx';

interface RealDataImporterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function RealDataImporterModal({ isOpen, onClose, onSuccess }: RealDataImporterModalProps) {
  const { toast } = useToast();
  const [importType, setImportType] = useState<'excel' | 'json'>('excel');
  const [jsonText, setJsonText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Cargar archivo Excel/CSV con datos reales
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });

        let loadedCount = 0;

        // Iterar por hojas (Inventario, Clientes, Proveedores, Usuarios)
        wb.SheetNames.forEach((sheetName) => {
          const ws = wb.Sheets[sheetName];
          const data: any[] = XLSX.utils.sheet_to_json(ws);

          if (!data || data.length === 0) return;

          const lowerSheet = sheetName.toLowerCase();

          if (lowerSheet.includes('inventario') || lowerSheet.includes('producto')) {
            const mapped = data.map((row) => ({
              id: String(row.sku || row.codigo || row.SKU || `SKU-${Math.random().toString(36).substr(2, 5)}`),
              sku: String(row.sku || row.codigo || row.SKU || ''),
              name: String(row.nombre || row.descripcion || row.producto || row.Name || ''),
              category: String(row.categoria || row.Category || 'General'),
              price: parseFloat(row.precio || row.price || row.Price || '0') || 0,
              quantity: parseFloat(row.existencia || row.stock || row.quantity || '0') || 0,
              bodegas: row.bodega ? { [row.bodega]: parseFloat(row.existencia || row.stock || '0') || 0 } : {},
              createdAt: new Date().toISOString()
            }));

            localStorage.setItem('nexway_inventory', JSON.stringify(mapped));
            loadedCount += mapped.length;
          } else if (lowerSheet.includes('cliente')) {
            localStorage.setItem('nexway_customers', JSON.stringify(data));
            loadedCount += data.length;
          } else if (lowerSheet.includes('proveedor')) {
            localStorage.setItem('nexway_suppliers', JSON.stringify(data));
            loadedCount += data.length;
          } else if (lowerSheet.includes('usuario')) {
            localStorage.setItem('nexway_app_users', JSON.stringify(data));
            loadedCount += data.length;
          }
        });

        toast({
          title: '¡Datos Reales Cargados con Éxito! 🎉',
          description: `Se importaron ${loadedCount} registros reales desde tu archivo Excel.`
        });

        if (onSuccess) onSuccess();
        onClose();
      } catch (err: any) {
        toast({
          variant: 'destructive',
          title: 'Error al procesar archivo',
          description: err.message || 'Verifica el formato del archivo Excel.'
        });
      } finally {
        setIsProcessing(false);
      }
    };

    reader.readAsBinaryString(file);
  };

  // Cargar desde JSON/Copia de Respaldo directa
  const handleImportJson = () => {
    if (!jsonText.trim()) return;

    try {
      setIsProcessing(true);
      const parsed = JSON.parse(jsonText);

      if (parsed.inventory) localStorage.setItem('nexway_inventory', JSON.stringify(parsed.inventory));
      if (parsed.customers) localStorage.setItem('nexway_customers', JSON.stringify(parsed.customers));
      if (parsed.suppliers) localStorage.setItem('nexway_suppliers', JSON.stringify(parsed.suppliers));
      if (parsed.app_users) localStorage.setItem('nexway_app_users', JSON.stringify(parsed.app_users));

      toast({
        title: 'Copia de Seguridad Restaurada',
        description: 'Se cargaron los datos reales de tu empresa correctamente.'
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'JSON Inválido',
        description: 'Comprueba el formato JSON pegado.'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="rounded-2xl max-w-lg p-6 bg-card border shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2.5 bg-indigo-500/10 text-indigo-500 rounded-xl">
              <Database size={22} />
            </div>
            <div>
              <DialogTitle className="text-base font-black text-slate-800 dark:text-white">
                Cargador Directo de Datos Reales de tu Empresa
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Importa la información real de tu negocio desde archivos Excel, CSV o copias de seguridad sin requerir conexión a Supabase.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 my-2">
          {/* Selector de Modo */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-xl">
            <button
              onClick={() => setImportType('excel')}
              className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                importType === 'excel' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
              }`}
            >
              <FileSpreadsheet size={15} className="text-emerald-500" />
              Subir Excel / CSV
            </button>

            <button
              onClick={() => setImportType('json')}
              className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                importType === 'json' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
              }`}
            >
              <FileCode size={15} className="text-indigo-500" />
              Pegar JSON / Respaldo
            </button>
          </div>

          {importType === 'excel' ? (
            <div className="border-2 border-dashed border-indigo-200 dark:border-indigo-900 rounded-2xl p-6 text-center space-y-3 bg-indigo-50/30 dark:bg-indigo-950/10">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center">
                <Upload size={24} />
              </div>
              <div>
                <h6 className="text-xs font-black text-slate-800 dark:text-white">
                  Selecciona tu archivo de productos o clientes (.xlsx, .xls, .csv)
                </h6>
                <p className="text-[10px] text-slate-400 mt-1">
                  El sistema mapeará automáticamente las columnas: SKU, Nombre, Precio, Existencia, Categoría.
                </p>
              </div>

              <label className="inline-flex items-center gap-2 cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md transition-all">
                <FileSpreadsheet size={15} />
                <span>{isProcessing ? 'Procesando Archivo...' : 'Examinar Archivo Excel Real'}</span>
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileUpload}
                  disabled={isProcessing}
                  className="hidden"
                />
              </label>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Pega el texto JSON de la base de datos o archivo de respaldo:
              </label>
              <textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                placeholder='{"inventory": [{"sku": "PROD1", "name": "Producto Real", "price": 10.00}]}'
                rows={6}
                className="w-full text-xs font-mono p-3 rounded-xl border bg-background text-foreground"
              />
              <Button
                onClick={handleImportJson}
                disabled={isProcessing || !jsonText.trim()}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-9 rounded-xl"
              >
                Cargar e Importar Datos Reales
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onClose} variant="ghost" className="text-xs font-bold">
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
