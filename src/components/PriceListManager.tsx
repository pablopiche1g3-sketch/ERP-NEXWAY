'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, 
  Trash2, 
  Search, 
  Upload, 
  Download, 
  Calendar, 
  FileSpreadsheet, 
  Loader2, 
  Settings, 
  ClipboardList 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/supabase/client';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

export function PriceListManager() {
  const { toast } = useToast();
  
  // Price lists states
  const [priceLists, setPriceLists] = useState<any[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [newListName, setNewListName] = useState('');
  const [priceListItems, setPriceListItems] = useState<any[]>([]);
  const [loadingListItems, setLoadingListItems] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [itemsSearchTerm, setItemsSearchTerm] = useState('');
  
  // Report monthly states
  const [reportMonth, setReportMonth] = useState('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadPriceLists = async () => {
    try {
      const { data, error } = await supabase
        .from('price_lists')
        .select('*')
        .order('name');
      if (error) throw error;
      setPriceLists(data || []);
    } catch (err) {
      console.error('Error al cargar listas de precios:', err);
    }
  };

  const loadPriceListItems = async (listId: string) => {
    if (!listId) {
      setPriceListItems([]);
      return;
    }
    try {
      setLoadingListItems(true);
      const { data, error } = await supabase
        .from('price_list_items')
        .select('*')
        .eq('price_list_id', listId)
        .order('sku');
      if (error) throw error;
      setPriceListItems(data || []);
    } catch (err: any) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los productos de la lista.' });
    } finally {
      setLoadingListItems(false);
    }
  };

  useEffect(() => {
    loadPriceLists();
  }, []);

  useEffect(() => {
    if (selectedListId) {
      loadPriceListItems(selectedListId);
    } else {
      setPriceListItems([]);
    }
  }, [selectedListId]);

  const handleCreatePriceList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;
    try {
      const { data, error } = await supabase
        .from('price_lists')
        .insert({ name: newListName.trim() })
        .select()
        .single();
      if (error) throw error;
      toast({ title: 'Lista creada', description: `Se creó la lista "${newListName}"` });
      setNewListName('');
      await loadPriceLists();
      if (data) setSelectedListId(data.id);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message || 'No se pudo crear la lista.' });
    }
  };

  const handleDeletePriceList = async () => {
    if (!selectedListId) return;
    if (!confirm('¿Está seguro de eliminar esta lista de precios por completo?')) return;
    try {
      const { error } = await supabase
        .from('price_lists')
        .delete()
        .eq('id', selectedListId);
      if (error) throw error;
      toast({ title: 'Lista eliminada', description: 'La lista de precios fue removida.' });
      setSelectedListId('');
      await loadPriceLists();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedListId) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        const itemsToInsert = data.map((row: any) => {
          const sku = (row.CODIGO || row.Codigo || row.codigo || row.SKU || row.sku || '').toString().trim().toUpperCase();
          const description = (row.DESCRIPCION || row.Descripcion || row.descripcion || row.NAME || row.name || '');
          const price = parseFloat(row.PRECIO || row.Precio || row.precio || row.PRICE || row.price || '0');

          return {
            price_list_id: selectedListId,
            sku,
            description,
            price
          };
        }).filter(item => item.sku && !isNaN(item.price));

        if (itemsToInsert.length === 0) {
          throw new Error('No se encontraron filas con columnas CODIGO y PRECIO válidas.');
        }

        const { error } = await supabase
          .from('price_list_items')
          .upsert(itemsToInsert, { onConflict: 'price_list_id,sku' });

        if (error) throw error;

        toast({ title: 'Carga Exitosa', description: `Se importaron ${itemsToInsert.length} productos a la lista.` });
        loadPriceListItems(selectedListId);
      } catch (err: any) {
        console.error(err);
        toast({ variant: 'destructive', title: 'Error al cargar Excel', description: err.message || 'Verifique el formato.' });
      } finally {
        setIsUploading(false);
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleDownloadMonthlyReport = async () => {
    if (!selectedListId || !reportMonth) {
      toast({ variant: 'destructive', title: 'Datos Faltantes', description: 'Selecciona una lista y el mes para el reporte.' });
      return;
    }

    setIsGeneratingReport(true);
    try {
      const year = parseInt(reportMonth.split('-')[0]);
      const month = parseInt(reportMonth.split('-')[1]);
      
      const startDate = new Date(year, month - 1, 1).toISOString();
      const endDate = new Date(year, month, 1).toISOString();

      const { data: salesItems, error } = await supabase
        .from('sales_items')
        .select(`
          sku,
          quantity,
          price,
          subtotal,
          price_list_id,
          sales!inner (
            correlative,
            created_at,
            customer_name
          )
        `)
        .eq('price_list_id', selectedListId)
        .gte('sales.created_at', startDate)
        .lt('sales.created_at', endDate);

      if (error) throw error;

      if (!salesItems || salesItems.length === 0) {
        toast({ title: 'Sin Ventas', description: 'No se registraron ventas para esta lista en el mes seleccionado.' });
        return;
      }

      const reportRows = salesItems.map((item: any) => ({
        'FECHA': new Date(item.sales.created_at).toLocaleDateString('es-SV'),
        'FACTURA': item.sales.correlative,
        'CLIENTE': item.sales.customer_name,
        'CODIGO': item.sku,
        'CANTIDAD': parseFloat(item.quantity) || 0,
        'PRECIO ESPECIAL': parseFloat(item.price) || 0,
        'SUBTOTAL': parseFloat(item.subtotal) || 0
      }));

      const ws = XLSX.utils.json_to_sheet(reportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Reporte Especial');
      
      const listName = priceLists.find(pl => pl.id === selectedListId)?.name || 'Lista';
      XLSX.writeFile(wb, `Reporte_Precios_Especiales_${listName}_${reportMonth}.xlsx`);
      
      toast({ title: 'Reporte Generado', description: 'El reporte se ha descargado correctamente.' });
    } catch (err: any) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: err.message || 'No se pudo generar el reporte.' });
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const filteredItems = useMemo(() => {
    if (!priceListItems) return [];
    return priceListItems.filter(item =>
      item.sku.toLowerCase().includes(itemsSearchTerm.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(itemsSearchTerm.toLowerCase()))
    );
  }, [itemsSearchTerm, priceListItems]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      {/* Gestión lateral de Listas */}
      <div className="lg:col-span-4 space-y-4">
        <Card className="bg-[#11111e] border-white/10 shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="border-b border-white/10 p-5 bg-white/5">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-white">
              <Settings size={16} className="text-indigo-500" />
              Listas de Precios
            </CardTitle>
            <CardDescription className="text-xs">Crea listas de tarifas personalizadas</CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <form onSubmit={handleCreatePriceList} className="flex gap-2">
              <Input 
                placeholder="Nombre, ej. Distribuidor"
                value={newListName}
                onChange={e => setNewListName(e.target.value)}
                className="h-10 bg-[#0c0c14] border border-white/10 rounded-xl text-xs font-bold"
              />
              <Button type="submit" size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl">
                Crear
              </Button>
            </form>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Seleccionar Lista Activa</Label>
              <Select value={selectedListId} onValueChange={setSelectedListId}>
                <SelectTrigger className="h-10 bg-[#0c0c14] border border-white/10 rounded-xl text-xs font-bold text-white">
                  <SelectValue placeholder="Seleccione una lista de precios..." />
                </SelectTrigger>
                <SelectContent className="dark:bg-[#09090b] dark:border-white/10 rounded-xl">
                  {priceLists.map(pl => (
                    <SelectItem key={pl.id} value={pl.id} className="text-xs">{pl.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedListId && (
              <Button 
                variant="destructive" 
                onClick={handleDeletePriceList} 
                className="w-full text-xs font-bold py-2 rounded-xl"
              >
                <Trash2 size={13} className="mr-2" />
                Eliminar Lista Completa
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Generación de reporte mensual */}
        {selectedListId && (
          <Card className="bg-[#11111e] border-white/10 shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-white/10 p-5 bg-white/5">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-white">
                <Download size={16} className="text-emerald-500" />
                Reporte de Ventas
              </CardTitle>
              <CardDescription className="text-xs">Exporta productos facturados con esta lista</CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-400">Seleccionar Mes</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <Input 
                    type="month" 
                    value={reportMonth} 
                    onChange={e => setReportMonth(e.target.value)} 
                    className="h-10 pl-9 bg-[#0c0c14] border border-white/10 rounded-xl text-xs"
                  />
                </div>
              </div>
              <Button 
                disabled={isGeneratingReport || !reportMonth} 
                onClick={handleDownloadMonthlyReport} 
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs h-10"
              >
                {isGeneratingReport ? <Loader2 size={14} className="animate-spin mr-2" /> : <FileSpreadsheet size={14} className="mr-2" />}
                Descargar Reporte Excel
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Listado y carga Excel */}
      <div className="lg:col-span-8 space-y-4">
        {selectedListId ? (
          <>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <Input 
                  placeholder="Buscar en esta lista por SKU o descripción..." 
                  value={itemsSearchTerm}
                  onChange={e => setItemsSearchTerm(e.target.value)}
                  className="pl-11 h-11 bg-[#0c0c14] border border-white/10 rounded-xl text-xs"
                />
              </div>
              
              <div className="flex items-center gap-3 shrink-0">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleExcelUpload} 
                  accept=".xlsx, .xls, .csv" 
                  className="hidden" 
                />
                <Button 
                  disabled={isUploading} 
                  onClick={() => fileInputRef.current?.click()} 
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs h-11"
                >
                  {isUploading ? <Loader2 size={14} className="animate-spin mr-2" /> : <Upload size={14} className="mr-2" />}
                  Cargar Excel
                </Button>
              </div>
            </div>

            <Card className="bg-[#11111e] border-white/10 shadow-sm rounded-2xl overflow-hidden">
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader className="bg-white/5 border-b border-white/10">
                    <TableRow>
                      <TableHead className="text-[10px] font-black uppercase text-white px-6">SKU / CÓDIGO</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-white">Descripción / Nombre</TableHead>
                      <TableHead className="text-[10px] font-black uppercase text-right text-white px-6">Precio Especial</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingListItems ? (
                      <TableRow><TableCell colSpan={3} className="text-center py-20"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
                    ) : filteredItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-20 text-slate-400">
                          No se encontraron productos en esta lista de precios. Sube un archivo Excel con columnas `CODIGO`, `DESCRIPCION`, `PRECIO` para comenzar.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredItems.map((item) => (
                        <TableRow key={item.id} className="hover:bg-white/5 border-b border-white/5">
                          <TableCell className="font-mono text-xs font-bold px-6 py-4">{item.sku}</TableCell>
                          <TableCell className="text-xs text-slate-500">{item.description || 'S/D'}</TableCell>
                          <TableCell className="text-right font-black text-indigo-400 text-xs px-6">${Number(item.price).toFixed(2)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </Card>
          </>
        ) : (
          <Card className="bg-[#11111e] border-white/10 rounded-2xl p-12 text-center text-slate-400">
            <ClipboardList size={48} className="mx-auto mb-4 text-slate-700" />
            <h3 className="font-bold text-slate-350">Ninguna lista seleccionada</h3>
            <p className="text-xs mt-1">Crea o selecciona una lista de precios en el panel lateral para administrar sus productos.</p>
          </Card>
        )}
      </div>

    </div>
  );
}
