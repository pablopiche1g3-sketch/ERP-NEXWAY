'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { FolderOpen, FileJson, Trash2, CheckCircle2, AlertTriangle, Save, Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface FacturaDTE {
  numControl: string;
  codGeneracion: string;
  fecEmi: string;
  horEmi: string;
  tipoDte: string;
  moneda: string;
  ambiente: string;
  tipoOperacion: string;
  nitEmisor: string;
  nrcEmisor: string;
  nombreEmisor: string;
  codActividadEmi: string;
  descActividadEmi: string;
  telEmisor: string;
  correoEmisor: string;
  tipoEstablecimiento: string;
  codEstableMH: string;
  codPuntoVentaMH: string;
  direccionEmisor: string;
  tipoDocReceptor: string;
  numDocReceptor: string;
  nombreReceptor: string;
  telReceptor: string;
  correoReceptor: string;
  cantidadItems: number;
  descripcionItems: string;
  totalGravada: number;
  totalExenta: number;
  totalNoSuj: number;
  subTotalVentas: number;
  totalDescu: number;
  subTotal: number;
  totalIva: number;
  ivaRete1: number;
  reteRenta: number;
  totalPagar: number;
  montoTotalOperacion: number;
  condicionOperacion: string | number;
  observaciones: string;
  selected: boolean;
  rawItems: any[]; // Important: to match inventory later
}

export function DteReader() {
  const [facturas, setFacturas] = useState<FacturaDTE[]>([]);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [errorsMsg, setErrorsMsg] = useState('');
  
  // Database context
  const [enteredBy, setEnteredBy] = useState('');
  const [warehouse, setWarehouse] = useState('');
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const folderInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      const { data: wh } = await supabase.from('warehouses').select('*');
      if (wh) setWarehouses(wh);
      const { data: inv } = await supabase.from('inventory_master').select('*');
      if (inv) setInventory(inv);
      const { data: sup } = await supabase.from('suppliers').select('*');
      if (sup) setSuppliers(sup);
    };
    fetchData();
  }, []);

  const procesarArchivos = (fileList: FileList | null) => {
    if (!fileList) return;
    const archivos = Array.from(fileList).filter(f => f.name.toLowerCase().endsWith('.json'));
    
    if (archivos.length === 0) {
      setErrorsMsg('No se encontraron archivos JSON.');
      return;
    }

    setLoadingMsg(`Procesando ${archivos.length} archivos...`);
    setErrorsMsg('');
    
    let leidos = 0;
    const errores: string[] = [];
    const nuevasFacturas: FacturaDTE[] = [];

    archivos.forEach((archivo) => {
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const json = JSON.parse(e.target?.result as string);

          const id = json.identificacion || {};
          const emi = json.emisor || {};
          const rec = json.receptor || {};
          const res = json.resumen || {};
          const items = json.cuerpoDocumento || [];

          const descItems = items.map((it: any) =>
            `${it.descripcion || 'S/N'} (x${it.cantidad || 0} × $${Number(it.precioUni || 0).toFixed(2)})`
          ).join(' | ');

          const factura: FacturaDTE = {
            numControl: id.numeroControl || '',
            codGeneracion: id.codigoGeneracion || '',
            fecEmi: id.fecEmi || '',
            horEmi: id.horEmi || '',
            tipoDte: id.tipoDte || '',
            moneda: id.tipoMoneda || '',
            ambiente: id.ambiente || '',
            tipoOperacion: id.tipoOperacion || '',

            nitEmisor: emi.nit || '',
            nrcEmisor: emi.nrc || '',
            nombreEmisor: emi.nombre || '',
            codActividadEmi: emi.codActividad || '',
            descActividadEmi: emi.descActividad || '',
            telEmisor: emi.telefono || '',
            correoEmisor: emi.correo || '',
            tipoEstablecimiento: emi.tipoEstablecimiento || '',
            codEstableMH: emi.codEstableMH || '',
            codPuntoVentaMH: emi.codPuntoVentaMH || '',
            direccionEmisor: emi.direccion
              ? `${emi.direccion.departamento || ''}-${emi.direccion.municipio || ''} ${emi.direccion.complemento || ''}`
              : '',

            tipoDocReceptor: rec.tipoDocumento || '',
            numDocReceptor: rec.numDocumento || '',
            nombreReceptor: rec.nombre || '',
            telReceptor: rec.telefono || '',
            correoReceptor: rec.correo || '',

            cantidadItems: items.length,
            descripcionItems: descItems,

            totalGravada: res.totalGravada || 0,
            totalExenta: res.totalExenta || 0,
            totalNoSuj: res.totalNoSuj || 0,
            subTotalVentas: res.subTotalVentas || 0,
            totalDescu: res.totalDescu || 0,
            subTotal: res.subTotal || 0,
            totalIva: res.totalIva || 0,
            ivaRete1: res.ivaRete1 || 0,
            reteRenta: res.reteRenta || 0,
            totalPagar: res.totalPagar || 0,
            montoTotalOperacion: res.montoTotalOperacion || 0,
            condicionOperacion: res.condicionOperacion || '',

            observaciones: (json.extension || {}).observaciones || '',
            selected: true,
            rawItems: items
          };

          nuevasFacturas.push(factura);
        } catch (err) {
          errores.push(archivo.name);
          console.error('Error al leer', archivo.name, err);
        }
        
        leidos++;
        if (leidos === archivos.length) {
          setFacturas(prev => [...prev, ...nuevasFacturas]);
          setLoadingMsg(`Se agregaron ${nuevasFacturas.length} facturas.`);
          if (errores.length > 0) {
            setErrorsMsg(`Hubo ${errores.length} archivos con error (Revisar consola).`);
          }
          
          if (folderInputRef.current) folderInputRef.current.value = '';
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      reader.readAsText(archivo);
    });
  };

  const registrarComprasMasivas = async () => {
    const seleccionadas = facturas.filter(f => f.selected);
    if (seleccionadas.length === 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Selecciona al menos una factura para registrar.' });
      return;
    }
    if (!warehouse) {
      toast({ variant: 'destructive', title: 'Bodega Requerida', description: 'Selecciona la bodega de destino.' });
      return;
    }
    if (!enteredBy) {
      toast({ variant: 'destructive', title: 'Encargado Requerido', description: 'Escribe tu nombre en "Encargado".' });
      return;
    }

    setIsSaving(true);
    let successCount = 0;
    let errorCount = 0;
    const selectedWh = warehouses.find(w => w.name === warehouse);

    for (const f of seleccionadas) {
      try {
        // 1. Buscar proveedor (por NIT o Nombre)
        const proveedor = suppliers.find(s => 
          (s.nit && s.nit === f.nitEmisor) || 
          (s.name && s.name.toLowerCase() === f.nombreEmisor.toLowerCase())
        );
        const supplier_id = proveedor ? proveedor.id : null;

        // 2. Crear registro de compra
        const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const randPart = Math.floor(1000 + Math.random() * 9000);
        const pedidoId = `DTE-${datePart}-${randPart}`;

        const { data: insertedPurch, error: purchErr } = await supabase
          .from('purchases')
          .insert({
            order_id: pedidoId,
            supplier_id: supplier_id,
            entered_by: enteredBy,
            warehouse_id: selectedWh?.id,
            total: f.totalPagar,
            status: 'CERRADA' // Se asume ingreso directo a stock
          })
          .select()
          .single();

        if (purchErr) throw purchErr;

        // 3. Procesar items y cruzar con inventario maestro
        const itemsToInsert: any[] = [];
        let skippedItems = 0;

        for (const item of f.rawItems) {
          const product = inventory.find(p => 
            p.sku === (item.codigo || '').toUpperCase() || 
            p.name.toLowerCase() === (item.descripcion || '').toLowerCase()
          );

          if (product) {
            const qty = item.cantidad || 0;
            const cost = item.precioUnitario || 0;
            
            itemsToInsert.push({
              purchase_id: insertedPurch.id,
              sku: product.sku,
              quantity: qty,
              cost: cost,
              subtotal: qty * cost
            });

            // Ingresar stock a la bodega
            const currentWhStock = product.bodegas?.[warehouse] || 0;
            await supabase
              .from('inventory_stock')
              .upsert({
                sku: product.sku,
                warehouse_id: selectedWh?.id,
                quantity: currentWhStock + qty
              }, { onConflict: 'sku,warehouse_id' });
          } else {
            skippedItems++;
          }
        }

        // Si hubieron productos compatibles, los insertamos
        if (itemsToInsert.length > 0) {
          await supabase.from('purchase_items').insert(itemsToInsert);
        }

        if (skippedItems > 0) {
          console.warn(`Factura ${f.codGeneracion}: Se omitieron ${skippedItems} items por no existir en inventario maestro.`);
        }

        successCount++;
      } catch (err) {
        console.error('Error insertando factura DTE:', err);
        errorCount++;
      }
    }

    setIsSaving(false);
    toast({ 
      title: "Carga Masiva Completada", 
      description: `Se ingresaron ${successCount} compras exitosamente. ${errorCount > 0 ? `Fallaron ${errorCount}.` : ''}` 
    });
    
    // Remover las procesadas exitosamente
    if (errorCount === 0) {
      setFacturas(prev => prev.filter(f => !f.selected));
    }
  };

  const formatearNumero = (val: number) => {
    return Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const toggleSelectAll = () => {
    const allSelected = facturas.every(f => f.selected);
    setFacturas(facturas.map(f => ({ ...f, selected: !allSelected })));
  };

  const toggleSelect = (index: number) => {
    const newFacturas = [...facturas];
    newFacturas[index].selected = !newFacturas[index].selected;
    setFacturas(newFacturas);
  };

  const limpiarTodo = () => {
    setFacturas([]);
    setLoadingMsg('');
    setErrorsMsg('');
  };

  return (
    <div className="w-full h-full flex flex-col gap-6">
      
      {/* Controles de Bodega y Encargado */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-800/60">
        <div className="space-y-2">
          <Label className="text-[11px] font-black uppercase text-slate-500 tracking-widest">Bodega de Destino *</Label>
          <Select value={warehouse} onValueChange={setWarehouse}>
            <SelectTrigger className="h-10 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-bold text-xs rounded-xl">
              <SelectValue placeholder="Seleccione la bodega para el stock" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800 shadow-xl">
              {warehouses.map((w: any) => (
                <SelectItem key={w.id} value={w.name} className="font-bold text-xs">
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-[11px] font-black uppercase text-slate-500 tracking-widest">Encargado *</Label>
          <Input 
            value={enteredBy}
            onChange={(e) => setEnteredBy(e.target.value)}
            placeholder="Ej. Juan Pérez"
            className="h-10 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 font-bold text-xs rounded-xl"
          />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-3">
          <Input 
            type="file" 
            ref={folderInputRef}
            onChange={(e) => procesarArchivos(e.target.files)}
            className="hidden" 
            // @ts-ignore
            webkitdirectory="true"
            directory=""
          />
          <Button 
            onClick={() => folderInputRef.current?.click()} 
            variant="outline"
            className="border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 rounded-xl"
          >
            <FolderOpen size={16} className="mr-2" />
            Cargar Carpeta
          </Button>

          <Input 
            type="file" 
            ref={fileInputRef}
            onChange={(e) => procesarArchivos(e.target.files)}
            className="hidden" 
            multiple 
            accept=".json" 
          />
          <Button 
            variant="outline"
            onClick={() => fileInputRef.current?.click()} 
            className="border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 rounded-xl"
          >
            <FileJson size={16} className="mr-2" />
            Cargar Archivos JSON
          </Button>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button 
            onClick={registrarComprasMasivas}
            disabled={facturas.length === 0 || isSaving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20 shadow-lg rounded-xl disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Save size={16} className="mr-2" />}
            {isSaving ? 'Registrando...' : 'Registrar Compras en ERP'}
          </Button>
          
          <Button 
            variant="ghost"
            onClick={limpiarTodo}
            className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl"
          >
            <Trash2 size={16} className="mr-2" />
            Limpiar
          </Button>
        </div>
      </div>

      {/* Info de Carga */}
      {(loadingMsg || errorsMsg) && (
        <div className="flex gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/60">
          {loadingMsg && (
            <div className="flex items-center text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={16} className="mr-2" />
              {loadingMsg}
            </div>
          )}
          {errorsMsg && (
            <div className="flex items-center text-sm font-semibold text-rose-600 dark:text-rose-400">
              <AlertTriangle size={16} className="mr-2" />
              {errorsMsg}
            </div>
          )}
        </div>
      )}

      {/* Tabla */}
      <div className="border border-slate-200 dark:border-slate-800/40 rounded-2xl overflow-hidden bg-white dark:bg-slate-900/20 shadow-sm flex-1">
        <ScrollArea className="h-[500px] w-full">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-900/60 sticky top-0 z-10 shadow-sm">
              <TableRow>
                <TableHead className="w-[50px] text-center">
                  <Checkbox 
                    checked={facturas.length > 0 && facturas.every(f => f.selected)}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead className="w-[50px] text-center">#</TableHead>
                <TableHead className="min-w-[140px]">N° Control</TableHead>
                <TableHead className="min-w-[280px]">Cód. Generación</TableHead>
                <TableHead className="min-w-[100px] text-center">Fecha</TableHead>
                <TableHead className="min-w-[120px]">NIT Emisor</TableHead>
                <TableHead className="min-w-[250px]">Nombre Emisor</TableHead>
                <TableHead className="min-w-[300px]">Ítems Detectados</TableHead>
                <TableHead className="min-w-[120px] text-right font-bold text-emerald-600 dark:text-emerald-400">Total a Pagar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {facturas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-64 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileJson size={32} className="text-slate-300 dark:text-slate-700" />
                      <p>No hay facturas cargadas.</p>
                      <span className="text-xs">Sube tus archivos JSON para registrarlos.</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                facturas.map((f, idx) => (
                  <TableRow key={idx} className={idx % 2 === 0 ? 'bg-slate-50/50 dark:bg-slate-900/10' : ''}>
                    <TableCell className="text-center">
                      <Checkbox 
                        checked={f.selected}
                        onCheckedChange={() => toggleSelect(idx)}
                      />
                    </TableCell>
                    <TableCell className="text-center text-slate-500">{idx + 1}</TableCell>
                    <TableCell className="font-mono text-xs">{f.numControl}</TableCell>
                    <TableCell className="font-mono text-[10px] text-slate-500">{f.codGeneracion}</TableCell>
                    <TableCell className="text-center">{f.fecEmi}</TableCell>
                    <TableCell className="font-mono text-xs">{f.nitEmisor}</TableCell>
                    <TableCell className="text-xs max-w-[250px] truncate" title={f.nombreEmisor}>{f.nombreEmisor}</TableCell>
                    <TableCell className="text-[10px] max-w-[300px] truncate text-slate-500" title={f.descripcionItems}>{f.descripcionItems}</TableCell>
                    <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400">${formatearNumero(f.totalPagar)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

    </div>
  );
}
