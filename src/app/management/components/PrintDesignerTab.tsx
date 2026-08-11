'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Printer, 
  Plus, 
  Save, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  Sparkles, 
  Loader2, 
  Sliders, 
  Layout, 
  FileText, 
  Building2, 
  User, 
  ShoppingCart, 
  Calculator, 
  QrCode, 
  Check, 
  Eye
} from 'lucide-react';
import { renderTemplateToPrint, PrintTemplateScheme, PrintBlock } from '@/services/printService';

const AVAILABLE_BLOCK_TYPES = [
  { type: 'header', label: 'Encabezado Corporativo', icon: Building2, desc: 'Nombre empresa, logo, teléfono y fecha' },
  { type: 'customer', label: 'Datos del Cliente / DTE', icon: User, desc: 'Nombre, NIT, NRC y Código DTE' },
  { type: 'items_table', label: 'Tabla de Productos', icon: ShoppingCart, desc: 'Lista de ítems, cantidades y precios' },
  { type: 'totals', label: 'Totales DTE & IVA', icon: Calculator, desc: 'Subtotal, IVA 13% y Total Final' },
  { type: 'qr_hacienda', label: 'QR Hacienda & Sello MH', icon: QrCode, desc: 'Código QR de validación y Sello MH' },
  { type: 'footer', label: 'Pie de Página & Firma', icon: FileText, desc: 'Mensaje de agradecimiento y firmas' },
];

const DEFAULT_BLOCKS: PrintBlock[] = [
  { id: 'b1', type: 'header', title: 'NEXWAY ERP S.A. DE C.V.', showLogo: true, showAddress: true, showPhone: true },
  { id: 'b2', type: 'customer', showNit: true, showNrc: true, fontSize: 'normal' },
  { id: 'b3', type: 'items_table', fontSize: 'small', showSku: true },
  { id: 'b4', type: 'totals', showIva: true, fontSize: 'normal' },
  { id: 'b5', type: 'qr_hacienda', showSello: true },
  { id: 'b6', type: 'footer', customMessage: '¡Gracias por su compra en NexWay!', showSignatures: false }
];

export default function PrintDesignerTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  const [nombre, setNombre] = useState('Ticket Térmico POS 80mm');
  const [moduloOrigen, setModuloOrigen] = useState('POS');
  const [paperSize, setPaperSize] = useState<'80mm' | '58mm' | 'A4'>('80mm');
  const [blocks, setBlocks] = useState<PrintBlock[]>(DEFAULT_BLOCKS);
  const [selectedBlockId, setSelectedBlockId] = useState<string>('b1');

  const [isSaving, setIsSaving] = useState(false);
  const [activeTabMode, setActiveTabMode] = useState<'designer' | 'preview'>('designer');

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('plantillas_impresion')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);

      if (data && data.length > 0) {
        const first = data[0];
        setSelectedTemplateId(first.id);
        setNombre(first.nombre);
        setModuloOrigen(first.modulo_origen);

        if (first.json_scheme) {
          setPaperSize(first.json_scheme.paper_size || '80mm');
          setBlocks(first.json_scheme.blocks || DEFAULT_BLOCKS);
          if (first.json_scheme.blocks?.length > 0) {
            setSelectedBlockId(first.json_scheme.blocks[0].id);
          }
        }
      }
    } catch (e: any) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar las plantillas de impresión.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleSelectTemplate = (id: string) => {
    if (id === 'new_ticket') {
      setSelectedTemplateId('');
      setNombre('Nuevo Ticket 80mm');
      setModuloOrigen('POS');
      setPaperSize('80mm');
      setBlocks(DEFAULT_BLOCKS);
      setSelectedBlockId('b1');
      return;
    }
    if (id === 'new_a4') {
      setSelectedTemplateId('');
      setNombre('Nuevo Crédito Fiscal A4');
      setModuloOrigen('POS');
      setPaperSize('A4');
      setBlocks([
        { id: 'b1', type: 'header', title: 'NEXWAY CORPORATIVO', showLogo: true, showAddress: true, showPhone: true },
        { id: 'b2', type: 'customer', showNit: true, showNrc: true, fontSize: 'normal' },
        { id: 'b3', type: 'items_table', fontSize: 'normal' },
        { id: 'b4', type: 'totals', showIva: true, fontSize: 'large' },
        { id: 'b5', type: 'qr_hacienda', showSello: true },
        { id: 'b6', type: 'footer', customMessage: 'Documento Fiscal Válido por Hacienda', showSignatures: true }
      ]);
      setSelectedBlockId('b1');
      return;
    }

    const found = templates.find(t => t.id === id);
    if (found) {
      setSelectedTemplateId(found.id);
      setNombre(found.nombre);
      setModuloOrigen(found.modulo_origen);
      if (found.json_scheme) {
        setPaperSize(found.json_scheme.paper_size || '80mm');
        setBlocks(found.json_scheme.blocks || DEFAULT_BLOCKS);
        if (found.json_scheme.blocks?.length > 0) {
          setSelectedBlockId(found.json_scheme.blocks[0].id);
        }
      }
    }
  };

  const handleAddBlock = (type: any) => {
    const newBlock: PrintBlock = {
      id: 'b_' + Date.now(),
      type: type,
      title: type === 'header' ? 'NEXWAY ERP' : undefined,
      fontSize: 'normal',
      showLogo: true,
      showAddress: true,
      showPhone: true,
      showNit: true,
      showNrc: true,
      showIva: true,
      showSello: true,
      customMessage: '¡Gracias por su compra!',
      showSignatures: false
    };
    setBlocks(prev => [...prev, newBlock]);
    setSelectedBlockId(newBlock.id);
    toast({ title: 'Bloque Agregado', description: `Se insertó el bloque al lienzo.` });
  };

  const handleMoveBlock = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === blocks.length - 1) return;

    const newBlocks = [...blocks];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const temp = newBlocks[index];
    newBlocks[index] = newBlocks[targetIndex];
    newBlocks[targetIndex] = temp;
    setBlocks(newBlocks);
  };

  const handleDeleteBlock = (id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id));
    if (selectedBlockId === id && blocks.length > 1) {
      setSelectedBlockId(blocks[0].id);
    }
  };

  const handleUpdateSelectedBlock = (field: string, val: any) => {
    setBlocks(prev => prev.map(b => b.id === selectedBlockId ? { ...b, [field]: val } : b));
  };

  const selectedBlock = blocks.find(b => b.id === selectedBlockId);

  const handleSaveTemplate = async () => {
    if (!nombre.trim()) {
      toast({ variant: 'destructive', title: 'Nombre requerido' });
      return;
    }

    const scheme: PrintTemplateScheme = {
      nombre,
      paper_size: paperSize,
      blocks
    };

    const compiledHtml = renderTemplateToPrint(scheme);

    setIsSaving(true);
    try {
      if (selectedTemplateId) {
        const { error } = await supabase
          .from('plantillas_impresion')
          .update({
            nombre,
            modulo_origen: moduloOrigen,
            html_template: compiledHtml,
            json_scheme: scheme
          })
          .eq('id', selectedTemplateId);
        if (error) throw error;
        toast({ title: 'Plantilla Guardada', description: `Plantilla "${nombre}" actualizada.` });
      } else {
        const { data, error } = await supabase
          .from('plantillas_impresion')
          .insert({
            nombre,
            modulo_origen: moduloOrigen,
            html_template: compiledHtml,
            json_scheme: scheme
          })
          .select()
          .single();

        if (error) throw error;
        toast({ title: 'Plantilla Creada', description: `Se creó la plantilla "${nombre}".` });
        setSelectedTemplateId(data.id);
      }
      await loadTemplates();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error al Guardar', description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDirectPrint = () => {
    const scheme: PrintTemplateScheme = { paper_size: paperSize, blocks };
    const htmlToPrint = renderTemplateToPrint(scheme);

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head><title>Impresión NexWay</title></head>
        <body style="margin:0; padding:0;">
          ${htmlToPrint}
          <script>
            window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 500); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const compiledPreviewHtml = renderTemplateToPrint({ paper_size: paperSize, blocks });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Bar */}
      <Card className="border shadow-md rounded-2xl bg-card overflow-hidden">
        <CardHeader className="bg-slate-900 text-white p-6 dark:bg-slate-950 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-black uppercase tracking-tight">
              <Printer className="text-emerald-400" size={20} />
              Diseñador de Impresión Interactivo por Bloques (Canva-Style)
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs">
              Crea y modifica tiras de papel térmico (80mm/58mm) o formatos A4 arrastrando bloques sin programar código.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <Select value={selectedTemplateId || 'preset'} onValueChange={handleSelectTemplate}>
              <SelectTrigger className="w-56 h-10 text-xs bg-slate-800 border-0 text-white rounded-xl">
                <SelectValue placeholder="Cargar plantilla..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new_ticket" className="text-xs font-bold text-emerald-500">+ Preset Ticket 80mm</SelectItem>
                <SelectItem value="new_a4" className="text-xs font-bold text-blue-500">+ Preset Crédito Fiscal A4</SelectItem>
                {templates.map(t => (
                  <SelectItem key={t.id} value={t.id} className="text-xs">{t.nombre} ({t.modulo_origen})</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button onClick={handleSaveTemplate} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700 font-bold text-xs h-10 rounded-xl">
              {isSaving ? <Loader2 className="animate-spin mr-1.5" size={16} /> : <Save size={15} className="mr-1.5" />}
              GUARDAR
            </Button>

            <Button onClick={handleDirectPrint} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold h-10 rounded-xl">
              <Printer size={15} className="mr-1.5" /> IMPRIMIR
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Configuración Básica Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 dark:bg-white/5 p-4 rounded-xl border border-slate-200 dark:border-white/10">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase">Nombre de la Plantilla</Label>
              <Input
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                className="h-9 text-xs font-bold"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase">Módulo de Origen</Label>
              <Select value={moduloOrigen} onValueChange={setModuloOrigen}>
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="POS">Facturación y POS (Ventas)</SelectItem>
                  <SelectItem value="Cotización">Cotizaciones y Presupuestos</SelectItem>
                  <SelectItem value="Proyecto">Módulo Institucional / Proyectos</SelectItem>
                  <SelectItem value="Quedan">Gestión de Quedan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase">Tamaño de Papel</Label>
              <Select value={paperSize} onValueChange={(val: any) => setPaperSize(val)}>
                <SelectTrigger className="h-9 text-xs rounded-xl font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="80mm">Ticket Térmico (80mm - Estándar POS)</SelectItem>
                  <SelectItem value="58mm">Ticket Térmico (58mm - Impresora Móvil)</SelectItem>
                  <SelectItem value="A4">Hoja Carta / A4 (DTE Fiscal)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* INTERFAZ CANVA EN 3 COLUMNAS */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* COLUMNA 1: GALERÍA DE BLOQUES (3 cols) */}
            <div className="lg:col-span-3 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-white/10">
                <Layout size={16} className="text-emerald-500" />
                <h3 className="text-xs font-black uppercase text-slate-800 dark:text-white">1. Bloques Disponibles</h3>
              </div>

              <div className="space-y-2">
                {AVAILABLE_BLOCK_TYPES.map(blk => {
                  const Icon = blk.icon;
                  return (
                    <button
                      key={blk.type}
                      onClick={() => handleAddBlock(blk.type)}
                      className="w-full text-left p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-card hover:bg-slate-50 dark:hover:bg-white/5 transition-all shadow-sm flex items-start gap-3 group"
                    >
                      <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg group-hover:scale-110 transition-transform">
                        <Icon size={16} />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-slate-800 dark:text-white flex items-center justify-between">
                          {blk.label}
                          <Plus size={14} className="text-slate-400 group-hover:text-emerald-500" />
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-white/50">{blk.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* COLUMNA 2: LIENZO INTERACTIVO / CANVAS DE IMPRESIÓN (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-white/10">
                <h3 className="text-xs font-black uppercase text-slate-800 dark:text-white flex items-center gap-2">
                  <Printer size={16} className="text-blue-500" />
                  2. Lienzo Interactivo ({paperSize})
                </h3>
                <Badge variant="outline" className="text-[10px] font-mono">{blocks.length} Bloques</Badge>
              </div>

              {/* Contenedor Físico Simulador */}
              <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 min-h-[500px] flex justify-center overflow-auto shadow-inner">
                <div className="bg-white text-black p-4 shadow-2xl rounded-sm w-full space-y-3" style={{ maxWidth: paperSize === '58mm' ? '220px' : paperSize === '80mm' ? '300px' : '100%' }}>
                  {blocks.map((blk, idx) => {
                    const isSelected = blk.id === selectedBlockId;
                    return (
                      <div
                        key={blk.id}
                        onClick={() => setSelectedBlockId(blk.id)}
                        className={`relative p-3 rounded-lg border-2 transition-all cursor-pointer group ${
                          isSelected ? 'border-emerald-500 bg-emerald-50/50 shadow-md' : 'border-dashed border-slate-300 hover:border-slate-400'
                        }`}
                      >
                        {/* Indicador de Selección */}
                        <div className="flex justify-between items-center mb-1 pb-1 border-b border-slate-200 text-[10px] font-bold text-slate-500">
                          <span className="uppercase text-[9px] text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">{blk.type}</span>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={(e) => { e.stopPropagation(); handleMoveBlock(idx, 'up'); }} className="p-0.5 hover:text-black" title="Mover arriba">
                              <ArrowUp size={12} />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleMoveBlock(idx, 'down'); }} className="p-0.5 hover:text-black" title="Mover abajo">
                              <ArrowDown size={12} />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteBlock(blk.id); }} className="p-0.5 text-rose-600 hover:text-rose-800" title="Eliminar">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>

                        {/* Vista del contenido simplificada en el Canvas */}
                        {blk.type === 'header' && (
                          <div className="text-center font-mono text-[11px]">
                            {blk.showLogo && <div className="font-black text-[12px]">NEXWAY ERP</div>}
                            <div className="font-bold">{blk.title || 'EMPRESA'}</div>
                            {blk.showAddress && <div className="text-[9px]">San Salvador, El Salvador</div>}
                          </div>
                        )}

                        {blk.type === 'customer' && (
                          <div className="font-mono text-[10px] space-y-0.5">
                            <div><strong>Cliente:</strong> Comercializadora S.A.</div>
                            {blk.showNit && <div><strong>NIT:</strong> 0614-150890-102-1</div>}
                            <div><strong>DTE:</strong> DTE-01-C001-0000001892</div>
                          </div>
                        )}

                        {blk.type === 'items_table' && (
                          <div className="font-mono text-[10px]">
                            <div className="flex justify-between border-b border-black font-bold">
                              <span>Cant. / Prod</span>
                              <span>Total</span>
                            </div>
                            <div className="flex justify-between">
                              <span>2x Cement Portland</span>
                              <span>$21.00</span>
                            </div>
                          </div>
                        )}

                        {blk.type === 'totals' && (
                          <div className="font-mono text-[11px] text-right font-bold space-y-0.5">
                            {blk.showIva && <div className="text-[10px] font-normal">IVA (13%): $4.81</div>}
                            <div className="text-[13px]">TOTAL: $41.81</div>
                          </div>
                        )}

                        {blk.type === 'qr_hacienda' && (
                          <div className="text-center font-mono text-[9px] p-2 bg-slate-100 rounded">
                            {blk.showSello && <div>Sello MH: 2026-SELLO-MH-9041</div>}
                            <div className="font-bold mt-1 text-slate-700">[QR HACIENDA]</div>
                          </div>
                        )}

                        {blk.type === 'footer' && (
                          <div className="text-center font-mono text-[10px] text-slate-600">
                            <div>{blk.customMessage || '¡Gracias por su compra!'}</div>
                            {blk.showSignatures && <div className="mt-2 text-[8px] flex justify-around"><span>Firma Emisor</span><span>Firma Recibido</span></div>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* COLUMNA 3: PANEL DE INTERRUPTORES & CONFIGURACIÓN DE BLOQUE (4 cols) */}
            <div className="lg:col-span-4 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-white/10">
                <Sliders size={16} className="text-amber-500" />
                <h3 className="text-xs font-black uppercase text-slate-800 dark:text-white">3. Panel de Opciones</h3>
              </div>

              {selectedBlock ? (
                <Card className="border shadow-md rounded-2xl bg-card p-5 space-y-5">
                  <div className="flex justify-between items-center border-b pb-3">
                    <Badge className="bg-emerald-500 text-white uppercase text-[10px] font-bold">
                      Bloque: {selectedBlock.type}
                    </Badge>
                    <span className="text-[10px] font-mono text-slate-400">ID: {selectedBlock.id}</span>
                  </div>

                  {/* OPCIONES ESPECÍFICAS SEGÚN TIPO */}
                  {selectedBlock.type === 'header' && (
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Título del Encabezado</Label>
                        <Input
                          value={selectedBlock.title || ''}
                          onChange={e => handleUpdateSelectedBlock('title', e.target.value)}
                          className="h-9 text-xs"
                        />
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-white/5 border">
                        <Label className="text-xs cursor-pointer">Mostrar Logotipo NexWay</Label>
                        <Switch
                          checked={selectedBlock.showLogo !== false}
                          onCheckedChange={val => handleUpdateSelectedBlock('showLogo', val)}
                        />
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-white/5 border">
                        <Label className="text-xs cursor-pointer">Mostrar Dirección Física</Label>
                        <Switch
                          checked={selectedBlock.showAddress !== false}
                          onCheckedChange={val => handleUpdateSelectedBlock('showAddress', val)}
                        />
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-white/5 border">
                        <Label className="text-xs cursor-pointer">Mostrar Teléfono</Label>
                        <Switch
                          checked={selectedBlock.showPhone !== false}
                          onCheckedChange={val => handleUpdateSelectedBlock('showPhone', val)}
                        />
                      </div>
                    </div>
                  )}

                  {selectedBlock.type === 'customer' && (
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Tamaño de Fuente</Label>
                        <Select value={selectedBlock.fontSize || 'normal'} onValueChange={val => handleUpdateSelectedBlock('fontSize', val)}>
                          <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="small">Pequeño (10px)</SelectItem>
                            <SelectItem value="normal">Normal (11px)</SelectItem>
                            <SelectItem value="large">Grande (13px)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-white/5 border">
                        <Label className="text-xs cursor-pointer">Mostrar NIT / DUI Cliente</Label>
                        <Switch
                          checked={selectedBlock.showNit !== false}
                          onCheckedChange={val => handleUpdateSelectedBlock('showNit', val)}
                        />
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-white/5 border">
                        <Label className="text-xs cursor-pointer">Mostrar NRC Cliente</Label>
                        <Switch
                          checked={selectedBlock.showNrc !== false}
                          onCheckedChange={val => handleUpdateSelectedBlock('showNrc', val)}
                        />
                      </div>
                    </div>
                  )}

                  {selectedBlock.type === 'items_table' && (
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Tamaño de Fuente Tabla</Label>
                        <Select value={selectedBlock.fontSize || 'small'} onValueChange={val => handleUpdateSelectedBlock('fontSize', val)}>
                          <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="small">Compacto (10px)</SelectItem>
                            <SelectItem value="normal">Normal (11px)</SelectItem>
                            <SelectItem value="large">Largo (13px)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {selectedBlock.type === 'totals' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-white/5 border">
                        <Label className="text-xs cursor-pointer">Desglosar IVA (13%)</Label>
                        <Switch
                          checked={selectedBlock.showIva !== false}
                          onCheckedChange={val => handleUpdateSelectedBlock('showIva', val)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Destacar Total</Label>
                        <Select value={selectedBlock.fontSize || 'normal'} onValueChange={val => handleUpdateSelectedBlock('fontSize', val)}>
                          <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="normal">Normal (12px)</SelectItem>
                            <SelectItem value="large">Enfatizado (14px)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {selectedBlock.type === 'qr_hacienda' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-white/5 border">
                        <Label className="text-xs cursor-pointer">Mostrar Sello de Recepción MH</Label>
                        <Switch
                          checked={selectedBlock.showSello !== false}
                          onCheckedChange={val => handleUpdateSelectedBlock('showSello', val)}
                        />
                      </div>
                    </div>
                  )}

                  {selectedBlock.type === 'footer' && (
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Mensaje Personalizado</Label>
                        <Input
                          value={selectedBlock.customMessage || ''}
                          onChange={e => handleUpdateSelectedBlock('customMessage', e.target.value)}
                          placeholder="Ej. Gracias por su compra"
                          className="h-9 text-xs"
                        />
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-white/5 border">
                        <Label className="text-xs cursor-pointer">Mostrar Sección de Firmas</Label>
                        <Switch
                          checked={selectedBlock.showSignatures !== false}
                          onCheckedChange={val => handleUpdateSelectedBlock('showSignatures', val)}
                        />
                      </div>
                    </div>
                  )}
                </Card>
              ) : (
                <div className="p-8 text-center text-slate-500 border border-dashed rounded-2xl text-xs">
                  Haz clic en un bloque del lienzo central para editar sus interruptores y opciones.
                </div>
              )}
            </div>

          </div>
        </CardContent>
      </Card>
    </div>
  );
}
