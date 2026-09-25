'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
  Eye,
  Layers,
  Copy,
  Download,
  CheckCircle2,
  RefreshCw,
  Cpu,
  FileCode2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Minus
} from 'lucide-react';
import { 
  renderTemplateToPrint, 
  PrintTemplateScheme, 
  PrintBlock, 
  checkPythonPdfServiceHealth, 
  compileTemplateWithPython 
} from '@/services/printService';

const AVAILABLE_BLOCK_TYPES = [
  { type: 'header', label: 'Encabezado Corporativo', icon: Building2, desc: 'Nombre empresa, logo, teléfono y fecha' },
  { type: 'customer', label: 'Datos del Cliente / DTE', icon: User, desc: 'Nombre, NIT, NRC y Código DTE' },
  { type: 'items_table', label: 'Tabla de Productos', icon: ShoppingCart, desc: 'Lista de ítems, cantidades y precios' },
  { type: 'totals', label: 'Totales DTE & IVA', icon: Calculator, desc: 'Subtotal, IVA 13% y Total Final' },
  { type: 'qr_hacienda', label: 'QR Hacienda & Sello MH', icon: QrCode, desc: 'Código QR de validación y Sello MH' },
  { type: 'footer', label: 'Pie de Página & Firma', icon: FileText, desc: 'Mensaje de agradecimiento y firmas' },
  { type: 'custom_text', label: 'Texto / Políticas', icon: FileCode2, desc: 'Cláusulas, advertencias o garantías' },
  { type: 'divider', label: 'Línea Divisoria', icon: Minus, desc: 'Separador visual en la impresión' },
];

const PRESETS: Record<string, { nombre: string; paper_size: '80mm' | '58mm' | 'A4'; modulo_origen: string; blocks: PrintBlock[] }> = {
  pos_80mm: {
    nombre: 'Ticket Térmico POS 80mm',
    paper_size: '80mm',
    modulo_origen: 'POS',
    blocks: [
      { id: 'b1', type: 'header', title: 'NEXWAY ERP S.A. DE C.V.', showLogo: true, showAddress: true, showPhone: true },
      { id: 'b2', type: 'customer', showNit: true, showNrc: true, fontSize: 'normal' },
      { id: 'b3', type: 'items_table', fontSize: 'normal', showSku: true },
      { id: 'b4', type: 'totals', showIva: true, fontSize: 'normal' },
      { id: 'b5', type: 'qr_hacienda', showSello: true },
      { id: 'b6', type: 'footer', customMessage: '¡Gracias por su compra en NexWay!', showSignatures: false }
    ]
  },
  pos_58mm: {
    nombre: 'Ticket Compacto 58mm (Miniprinter)',
    paper_size: '58mm',
    modulo_origen: 'POS',
    blocks: [
      { id: 'b1', type: 'header', title: 'NEXWAY ERP', showLogo: false, showAddress: false, showPhone: true },
      { id: 'b2', type: 'customer', showNit: true, showNrc: false, fontSize: 'small' },
      { id: 'b3', type: 'items_table', fontSize: 'small', showSku: false },
      { id: 'b4', type: 'totals', showIva: true, fontSize: 'small' },
      { id: 'b5', type: 'qr_hacienda', showSello: false },
      { id: 'b6', type: 'footer', customMessage: 'Gracias por su compra.', showSignatures: false }
    ]
  },
  ccf_a4: {
    nombre: 'Comprobante de Crédito Fiscal A4 (DTE-03)',
    paper_size: 'A4',
    modulo_origen: 'FACTURACION',
    blocks: [
      { id: 'b1', type: 'header', title: 'NEXWAY ERP S.A. DE C.V.', showLogo: true, showAddress: true, showPhone: true },
      { id: 'b2', type: 'customer', showNit: true, showNrc: true, fontSize: 'normal' },
      { id: 'b3', type: 'items_table', fontSize: 'normal', showSku: true },
      { id: 'b4', type: 'totals', showIva: true, showRetencion: true, fontSize: 'large' },
      { id: 'b5', type: 'qr_hacienda', showSello: true },
      { id: 'b6', type: 'footer', customMessage: 'Documento Tributario Electrónico emitido bajo la normativa del Ministerio de Hacienda.', showSignatures: true }
    ]
  },
  fe_a4: {
    nombre: 'Factura de Consumidor Final A4 (DTE-01)',
    paper_size: 'A4',
    modulo_origen: 'FACTURACION',
    blocks: [
      { id: 'b1', type: 'header', title: 'NEXWAY ERP S.A. DE C.V.', showLogo: true, showAddress: true, showPhone: true },
      { id: 'b2', type: 'customer', showNit: true, showNrc: false, fontSize: 'normal' },
      { id: 'b3', type: 'items_table', fontSize: 'normal', showSku: false },
      { id: 'b4', type: 'totals', showIva: true, fontSize: 'normal' },
      { id: 'b5', type: 'qr_hacienda', showSello: true },
      { id: 'b6', type: 'footer', customMessage: '¡Gracias por su preferencia!', showSignatures: false }
    ]
  }
};

export default function PrintDesignerTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  const [nombre, setNombre] = useState('Ticket Térmico POS 80mm');
  const [moduloOrigen, setModuloOrigen] = useState('POS');
  const [paperSize, setPaperSize] = useState<'80mm' | '58mm' | 'A4'>('80mm');
  const [blocks, setBlocks] = useState<PrintBlock[]>(PRESETS.pos_80mm.blocks);
  const [selectedBlockId, setSelectedBlockId] = useState<string>('b1');

  const [isSaving, setIsSaving] = useState(false);
  const [pythonStatus, setPythonStatus] = useState<{ online: boolean; message: string; version?: string }>({
    online: false,
    message: 'Verificando...'
  });

  // Modal de Previsualización en Vivo con Python
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [isCompilingPdf, setIsCompilingPdf] = useState(false);

  useEffect(() => {
    loadTemplates();
    checkHealth();
  }, []);

  const checkHealth = async () => {
    const status = await checkPythonPdfServiceHealth();
    setPythonStatus(status);
  };

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
          setBlocks(first.json_scheme.blocks || PRESETS.pos_80mm.blocks);
          if (first.json_scheme.blocks?.length > 0) {
            setSelectedBlockId(first.json_scheme.blocks[0].id);
          }
        }
      }
    } catch (e: any) {
      console.warn('Error cargando plantillas de Supabase:', e);
      // Fallback a localStorage
      const local = typeof window !== 'undefined' ? localStorage.getItem('nexway_print_templates') : null;
      if (local) {
        try {
          const parsed = JSON.parse(local);
          setTemplates(parsed);
          if (parsed.length > 0) {
            setNombre(parsed[0].nombre);
            setModuloOrigen(parsed[0].modulo_origen);
            setPaperSize(parsed[0].json_scheme?.paper_size || '80mm');
            setBlocks(parsed[0].json_scheme?.blocks || PRESETS.pos_80mm.blocks);
          }
        } catch (err) {}
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTemplate = (id: string) => {
    setSelectedTemplateId(id);
    const tmpl = templates.find(t => t.id === id);
    if (tmpl) {
      setNombre(tmpl.nombre);
      setModuloOrigen(tmpl.modulo_origen);
      if (tmpl.json_scheme) {
        setPaperSize(tmpl.json_scheme.paper_size || '80mm');
        setBlocks(tmpl.json_scheme.blocks || PRESETS.pos_80mm.blocks);
        if (tmpl.json_scheme.blocks?.length > 0) {
          setSelectedBlockId(tmpl.json_scheme.blocks[0].id);
        }
      }
    }
  };

  const handleApplyPreset = (presetKey: string) => {
    const preset = PRESETS[presetKey];
    if (!preset) return;
    setNombre(preset.nombre);
    setPaperSize(preset.paper_size);
    setModuloOrigen(preset.modulo_origen);
    setBlocks(JSON.parse(JSON.stringify(preset.blocks)));
    setSelectedBlockId(preset.blocks[0]?.id || '');
    toast({
      title: 'Preset Cargado',
      description: `Se aplicó la plantilla "${preset.nombre}".`
    });
  };

  const selectedBlock = useMemo(() => {
    return blocks.find(b => b.id === selectedBlockId) || blocks[0];
  }, [blocks, selectedBlockId]);

  const updateBlockProperty = (prop: string, value: any) => {
    if (!selectedBlock) return;
    setBlocks(prev => prev.map(b => b.id === selectedBlock.id ? { ...b, [prop]: value } : b));
  };

  const handleAddBlock = (type: any) => {
    const newId = `b_${Date.now()}`;
    let newBlock: PrintBlock = {
      id: newId,
      type: type,
      fontSize: 'normal'
    };

    if (type === 'header') {
      newBlock.title = 'NEXWAY ERP S.A. DE C.V.';
      newBlock.showLogo = true;
      newBlock.showAddress = true;
      newBlock.showPhone = true;
    } else if (type === 'customer') {
      newBlock.showNit = true;
      newBlock.showNrc = true;
    } else if (type === 'items_table') {
      newBlock.showSku = true;
    } else if (type === 'totals') {
      newBlock.showIva = true;
    } else if (type === 'qr_hacienda') {
      newBlock.showSello = true;
    } else if (type === 'footer') {
      newBlock.customMessage = '¡Gracias por su preferencia comercial en NexWay!';
      newBlock.showSignatures = false;
    } else if (type === 'custom_text') {
      newBlock.content = 'Términos: No se aceptan devoluciones después de 30 días.';
      newBlock.align = 'center';
    }

    setBlocks(prev => [...prev, newBlock]);
    setSelectedBlockId(newId);
  };

  const handleMoveBlock = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === blocks.length - 1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const newBlocks = [...blocks];
    const temp = newBlocks[index];
    newBlocks[index] = newBlocks[targetIndex];
    newBlocks[targetIndex] = temp;
    setBlocks(newBlocks);
  };

  const handleDeleteBlock = (id: string) => {
    if (blocks.length <= 1) {
      toast({ variant: 'destructive', title: 'Atención', description: 'La plantilla debe contener al menos un bloque.' });
      return;
    }
    const newBlocks = blocks.filter(b => b.id !== id);
    setBlocks(newBlocks);
    setSelectedBlockId(newBlocks[0].id);
  };

  const handleSaveTemplate = async () => {
    if (!nombre.trim()) {
      toast({ variant: 'destructive', title: 'Nombre requerido', description: 'Ingresa un nombre para la plantilla.' });
      return;
    }

    setIsSaving(true);
    const jsonScheme: PrintTemplateScheme = {
      nombre,
      paper_size: paperSize,
      blocks
    };

    try {
      const templateData = {
        nombre,
        modulo_origen: moduloOrigen,
        tipo_dte: paperSize === 'A4' ? '03' : '01',
        json_scheme: jsonScheme,
        is_default: true,
        updated_at: new Date().toISOString()
      };

      if (selectedTemplateId) {
        await supabase
          .from('plantillas_impresion')
          .update(templateData)
          .eq('id', selectedTemplateId);
      } else {
        const { data: inserted } = await supabase
          .from('plantillas_impresion')
          .insert(templateData)
          .select()
          .single();
        if (inserted) setSelectedTemplateId(inserted.id);
      }

      // Guardar también en localStorage para contingencia
      const currentTemplates = [...templates];
      const idx = currentTemplates.findIndex(t => t.id === selectedTemplateId);
      if (idx >= 0) {
        currentTemplates[idx] = { ...currentTemplates[idx], ...templateData };
      } else {
        currentTemplates.unshift({ id: selectedTemplateId || `tmpl_${Date.now()}`, ...templateData });
      }
      setTemplates(currentTemplates);
      if (typeof window !== 'undefined') {
        localStorage.setItem('nexway_print_templates', JSON.stringify(currentTemplates));
      }

      toast({
        title: 'Plantilla Guardada',
        description: `Se guardaron los cambios de "${nombre}" con éxito.`
      });
    } catch (e: any) {
      console.error(e);
      toast({
        variant: 'destructive',
        title: 'Error al Guardar',
        description: e.message || 'No se pudo guardar la plantilla.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Compilar con Microservicio Python y abrir Modal
  const handleCompilePythonPdf = async () => {
    setIsCompilingPdf(true);
    try {
      const scheme: PrintTemplateScheme = {
        nombre,
        paper_size: paperSize,
        blocks
      };

      const pdfBlob = await compileTemplateWithPython(scheme);
      const url = URL.createObjectURL(pdfBlob);
      setPdfBlobUrl(url);
      setIsPdfModalOpen(true);
      toast({
        title: 'PDF Compilado con Éxito',
        description: 'Renderizado oficial generado mediante el microservicio en Python.'
      });
    } catch (err: any) {
      console.error('Error compilando con Python:', err);
      toast({
        variant: 'destructive',
        title: 'Microservicio Python no disponible',
        description: 'Asegúrate de que el microservicio FastAPI esté corriendo en el puerto 8000 o usa la vista local.'
      });
    } finally {
      setIsCompilingPdf(false);
    }
  };

  const handleNativeBrowserPrint = () => {
    const scheme: PrintTemplateScheme = {
      nombre,
      paper_size: paperSize,
      blocks
    };
    const html = renderTemplateToPrint(scheme);
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 350);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Encabezado Principal */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Printer className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Diseñador de Impresión Interactivo por Bloques
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Crea tiras térmicas (80mm/58mm) o formatos Carta A4 oficiales con renderizado vectorial en Python.
              </p>
            </div>
          </div>
        </div>

        {/* Acciones Rápidas & Estado del Microservicio */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Badge de Estado de Python */}
          <div 
            onClick={checkHealth}
            className={`cursor-pointer text-xs px-2.5 py-1 rounded-md border flex items-center gap-1.5 transition-colors ${
              pythonStatus.online 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                : 'bg-muted text-muted-foreground border-border/60 hover:bg-muted/80'
            }`}
            title="Clic para verificar conexión con el backend Python"
          >
            <Cpu className="h-3.5 w-3.5" />
            <span>{pythonStatus.online ? `Python Microservice v${pythonStatus.version || '1.2'}` : 'Python Offline (Modo Local)'}</span>
            <RefreshCw className="h-2.5 w-2.5 opacity-60 ml-0.5" />
          </div>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleCompilePythonPdf}
            disabled={isCompilingPdf}
            className="h-8 text-xs bg-indigo-500/10 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20 gap-1.5 font-medium"
          >
            {isCompilingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5 text-indigo-400" />}
            Compilar PDF con Python
          </Button>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleNativeBrowserPrint}
            className="h-8 text-xs gap-1.5"
          >
            <Printer className="h-3.5 w-3.5" />
            Imprimir
          </Button>

          <Button 
            size="sm" 
            onClick={handleSaveTemplate}
            disabled={isSaving}
            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 font-semibold shadow-sm"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Guardar Plantilla
          </Button>
        </div>
      </div>

      {/* Selector de Plantilla y Presets Rápidos */}
      <Card className="border-border/60 bg-muted/20">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground">Nombre de la Plantilla</Label>
              <Input 
                value={nombre} 
                onChange={e => setNombre(e.target.value)} 
                className="h-8 text-xs font-semibold" 
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground">Módulo de Origen</Label>
              <Select value={moduloOrigen} onValueChange={setModuloOrigen}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="POS" className="text-xs">Facturación y POS (Ventas)</SelectItem>
                  <SelectItem value="FACTURACION" className="text-xs">DTE Oficial (Hacienda)</SelectItem>
                  <SelectItem value="COTIZACIONES" className="text-xs">Cotizaciones Comerciales</SelectItem>
                  <SelectItem value="LOGISTICA" className="text-xs">Logística & Despachos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground">Tamaño de Papel</Label>
              <Select value={paperSize} onValueChange={(v: any) => setPaperSize(v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="80mm" className="text-xs">Ticket Térmico (80mm - Estándar POS)</SelectItem>
                  <SelectItem value="58mm" className="text-xs">Ticket Compacto (58mm - Miniprinter)</SelectItem>
                  <SelectItem value="A4" className="text-xs">Hoja Carta / A4 (Oficial DTE)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Presets de 1 Clic */}
          <div className="pt-2 border-t border-border/40 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-amber-400" /> Presets Oficiales:
            </span>
            <button 
              onClick={() => handleApplyPreset('pos_80mm')}
              className="text-[11px] px-2.5 py-0.5 rounded-full bg-background border border-border/60 hover:border-indigo-500 hover:text-indigo-400 text-foreground transition-all"
            >
              Ticket Térmico 80mm
            </button>
            <button 
              onClick={() => handleApplyPreset('pos_58mm')}
              className="text-[11px] px-2.5 py-0.5 rounded-full bg-background border border-border/60 hover:border-indigo-500 hover:text-indigo-400 text-foreground transition-all"
            >
              Ticket Miniprinter 58mm
            </button>
            <button 
              onClick={() => handleApplyPreset('ccf_a4')}
              className="text-[11px] px-2.5 py-0.5 rounded-full bg-background border border-border/60 hover:border-indigo-500 hover:text-indigo-400 text-foreground transition-all"
            >
              Crédito Fiscal A4 (03)
            </button>
            <button 
              onClick={() => handleApplyPreset('fe_a4')}
              className="text-[11px] px-2.5 py-0.5 rounded-full bg-background border border-border/60 hover:border-indigo-500 hover:text-indigo-400 text-foreground transition-all"
            >
              Factura Consumidor Final A4 (01)
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Área de Diseño en 3 Columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* COLUMNA 1: BLOQUES DISPONIBLES */}
        <div className="lg:col-span-3 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-primary" /> 1. Bloques Disponibles
            </h3>
          </div>

          <div className="space-y-2">
            {AVAILABLE_BLOCK_TYPES.map(b => {
              const Icon = b.icon;
              return (
                <div 
                  key={b.type}
                  onClick={() => handleAddBlock(b.type)}
                  className="p-2.5 rounded-lg border border-border/60 bg-card hover:bg-muted/60 hover:border-primary/50 cursor-pointer transition-all flex items-center justify-between group shadow-sm"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-md bg-muted text-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-medium text-foreground">{b.label}</div>
                      <div className="text-[10px] text-muted-foreground line-clamp-1">{b.desc}</div>
                    </div>
                  </div>
                  <Plus className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary group-hover:scale-110 transition-transform" />
                </div>
              );
            })}
          </div>
        </div>

        {/* COLUMNA 2: LIENZO INTERACTIVO (SIMULACIÓN REALISTA DE PAPEL) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Layout className="h-3.5 w-3.5 text-indigo-400" /> 2. Lienzo Interactivo ({paperSize})
            </h3>
            <span className="text-[11px] text-muted-foreground font-mono">{blocks.length} Bloques</span>
          </div>

          {/* Lienzo Contenedor */}
          <div className="p-4 rounded-xl border border-border/60 bg-slate-950/40 flex justify-center overflow-x-auto min-h-[580px]">
            <div 
              style={{
                width: paperSize === '58mm' ? '240px' : paperSize === '80mm' ? '320px' : '100%',
                maxWidth: paperSize === 'A4' ? '460px' : undefined
              }}
              className="bg-white text-slate-900 rounded-md shadow-2xl p-4 transition-all space-y-2 border border-slate-300"
            >
              {blocks.map((block, idx) => {
                const isSelected = selectedBlock?.id === block.id;

                return (
                  <div 
                    key={block.id}
                    onClick={() => setSelectedBlockId(block.id)}
                    className={`relative p-2 rounded-md transition-all cursor-pointer border ${
                      isSelected 
                        ? 'border-indigo-600 bg-indigo-50/50 shadow-sm ring-1 ring-indigo-500' 
                        : 'border-dashed border-slate-300 hover:border-slate-400 bg-slate-50/50'
                    }`}
                  >
                    {/* Badge y Botones de Control del Bloque */}
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                        {block.type}
                      </span>

                      <div className="flex items-center gap-1">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleMoveBlock(idx, 'up'); }}
                          disabled={idx === 0}
                          className="p-0.5 text-slate-500 hover:text-slate-900 disabled:opacity-30"
                          title="Mover arriba"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleMoveBlock(idx, 'down'); }}
                          disabled={idx === blocks.length - 1}
                          className="p-0.5 text-slate-500 hover:text-slate-900 disabled:opacity-30"
                          title="Mover abajo"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeleteBlock(block.id); }}
                          className="p-0.5 text-rose-500 hover:text-rose-700"
                          title="Eliminar bloque"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    {/* Previsualización simplificada del contenido */}
                    {block.type === 'header' && (
                      <div className="text-center text-[10px] space-y-0.5">
                        <div className="font-bold text-xs">{block.title || 'NEXWAY ERP S.A. DE C.V.'}</div>
                        {block.showAddress && <div className="text-[9px] text-slate-600">San Salvador, El Salvador</div>}
                        {block.showPhone && <div className="text-[9px] text-slate-600">Tel: (503) 2200-0000</div>}
                      </div>
                    )}

                    {block.type === 'customer' && (
                      <div className="text-[9.5px] space-y-0.5 border-t border-b border-dashed border-slate-300 py-1">
                        <div><strong>Cliente:</strong> Comercializadora S.A.</div>
                        {block.showNit && <div><strong>NIT:</strong> 0614-150890-102-1</div>}
                        <div className="font-mono text-[8.5px]"><strong>DTE:</strong> DTE-01-C001-0000001892</div>
                      </div>
                    )}

                    {block.type === 'items_table' && (
                      <div className="text-[9px] space-y-1">
                        <div className="flex justify-between font-bold border-b border-slate-900 pb-0.5 uppercase">
                          <span>Cant / Prod</span>
                          <span>Total</span>
                        </div>
                        <div className="flex justify-between">
                          <span>2x Cemento Portland</span>
                          <span className="font-semibold">$21.00</span>
                        </div>
                      </div>
                    )}

                    {block.type === 'totals' && (
                      <div className="text-[9.5px] text-right space-y-0.5 pt-1 border-t border-dashed border-slate-400">
                        {block.showIva && <div>IVA (13%): $4.81</div>}
                        <div className="font-black text-xs text-slate-900">TOTAL: $41.81</div>
                      </div>
                    )}

                    {block.type === 'qr_hacienda' && (
                      <div className="text-center py-1 space-y-1">
                        <div className="inline-block p-1 bg-slate-100 border border-slate-300 rounded text-[8px] font-mono">
                          [QR HACIENDA MH]
                        </div>
                        {block.showSello && (
                          <div className="text-[7.5px] font-mono text-slate-600">Sello MH: 2026-SELLO-MH-9041</div>
                        )}
                      </div>
                    )}

                    {block.type === 'footer' && (
                      <div className="text-center text-[9px] font-medium text-slate-700 italic">
                        {block.customMessage || '¡Gracias por su compra!'}
                      </div>
                    )}

                    {block.type === 'custom_text' && (
                      <div className="text-[9px] text-slate-700">
                        {block.content || 'Texto personalizado...'}
                      </div>
                    )}

                    {block.type === 'divider' && (
                      <div className="border-t-2 border-slate-800 my-1"></div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* COLUMNA 3: PANEL DE OPCIONES DEL BLOQUE SELECCIONADO */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sliders className="h-3.5 w-3.5 text-primary" /> 3. Panel de Opciones
            </h3>
            {selectedBlock && (
              <Badge variant="outline" className="text-[10px] font-mono uppercase bg-primary/10 text-primary border-primary/30">
                Bloque: {selectedBlock.type}
              </Badge>
            )}
          </div>

          <Card className="border-border/60 shadow-sm">
            <CardContent className="p-4 space-y-4">
              {!selectedBlock ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  Selecciona un bloque en el lienzo para ajustar sus propiedades.
                </div>
              ) : (
                <>
                  {/* OPCIONES: HEADER */}
                  {selectedBlock.type === 'header' && (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Título del Encabezado</Label>
                        <Input 
                          value={selectedBlock.title || ''} 
                          onChange={e => updateBlockProperty('title', e.target.value)} 
                          className="h-8 text-xs" 
                        />
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <Label className="text-xs cursor-pointer" htmlFor="sw-logo">Mostrar Logotipo</Label>
                        <Switch 
                          id="sw-logo" 
                          checked={selectedBlock.showLogo !== false} 
                          onCheckedChange={v => updateBlockProperty('showLogo', v)} 
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label className="text-xs cursor-pointer" htmlFor="sw-address">Mostrar Dirección Física</Label>
                        <Switch 
                          id="sw-address" 
                          checked={selectedBlock.showAddress !== false} 
                          onCheckedChange={v => updateBlockProperty('showAddress', v)} 
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label className="text-xs cursor-pointer" htmlFor="sw-phone">Mostrar Teléfono</Label>
                        <Switch 
                          id="sw-phone" 
                          checked={selectedBlock.showPhone !== false} 
                          onCheckedChange={v => updateBlockProperty('showPhone', v)} 
                        />
                      </div>
                    </div>
                  )}

                  {/* OPCIONES: CUSTOMER */}
                  {selectedBlock.type === 'customer' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs cursor-pointer" htmlFor="sw-nit">Mostrar NIT / Documento</Label>
                        <Switch 
                          id="sw-nit" 
                          checked={selectedBlock.showNit !== false} 
                          onCheckedChange={v => updateBlockProperty('showNit', v)} 
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label className="text-xs cursor-pointer" htmlFor="sw-nrc">Mostrar NRC del Cliente</Label>
                        <Switch 
                          id="sw-nrc" 
                          checked={selectedBlock.showNrc !== false} 
                          onCheckedChange={v => updateBlockProperty('showNrc', v)} 
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Tamaño de Fuente</Label>
                        <Select value={selectedBlock.fontSize || 'normal'} onValueChange={v => updateBlockProperty('fontSize', v)}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="small" className="text-xs">Compacto (Pequeño)</SelectItem>
                            <SelectItem value="normal" className="text-xs">Estándar (Normal)</SelectItem>
                            <SelectItem value="large" className="text-xs">Destacado (Grande)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {/* OPCIONES: ITEMS TABLE */}
                  {selectedBlock.type === 'items_table' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs cursor-pointer" htmlFor="sw-sku">Mostrar Código / SKU</Label>
                        <Switch 
                          id="sw-sku" 
                          checked={selectedBlock.showSku !== false} 
                          onCheckedChange={v => updateBlockProperty('showSku', v)} 
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Densidad / Tamaño de Fuente</Label>
                        <Select value={selectedBlock.fontSize || 'normal'} onValueChange={v => updateBlockProperty('fontSize', v)}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="small" className="text-xs">Compacto (Más ítems)</SelectItem>
                            <SelectItem value="normal" className="text-xs">Estándar</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {/* OPCIONES: TOTALS */}
                  {selectedBlock.type === 'totals' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs cursor-pointer" htmlFor="sw-iva">Desglosar IVA (13%)</Label>
                        <Switch 
                          id="sw-iva" 
                          checked={selectedBlock.showIva !== false} 
                          onCheckedChange={v => updateBlockProperty('showIva', v)} 
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label className="text-xs cursor-pointer" htmlFor="sw-rete">Mostrar Retención 1%</Label>
                        <Switch 
                          id="sw-rete" 
                          checked={!!selectedBlock.showRetencion} 
                          onCheckedChange={v => updateBlockProperty('showRetencion', v)} 
                        />
                      </div>
                    </div>
                  )}

                  {/* OPCIONES: QR HACIENDA */}
                  {selectedBlock.type === 'qr_hacienda' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs cursor-pointer" htmlFor="sw-sello">Mostrar Sello de Recepción MH</Label>
                        <Switch 
                          id="sw-sello" 
                          checked={selectedBlock.showSello !== false} 
                          onCheckedChange={v => updateBlockProperty('showSello', v)} 
                        />
                      </div>
                    </div>
                  )}

                  {/* OPCIONES: FOOTER */}
                  {selectedBlock.type === 'footer' && (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Mensaje Personalizado</Label>
                        <Textarea 
                          value={selectedBlock.customMessage || ''} 
                          onChange={e => updateBlockProperty('customMessage', e.target.value)} 
                          className="text-xs resize-none h-16" 
                          placeholder="¡Gracias por su compra!"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label className="text-xs cursor-pointer" htmlFor="sw-sig">Mostrar Líneas de Firmas</Label>
                        <Switch 
                          id="sw-sig" 
                          checked={!!selectedBlock.showSignatures} 
                          onCheckedChange={v => updateBlockProperty('showSignatures', v)} 
                        />
                      </div>
                    </div>
                  )}

                  {/* OPCIONES: CUSTOM TEXT */}
                  {selectedBlock.type === 'custom_text' && (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Contenido de Texto</Label>
                        <Textarea 
                          value={selectedBlock.content || ''} 
                          onChange={e => updateBlockProperty('content', e.target.value)} 
                          className="text-xs resize-none h-20" 
                          placeholder="Escribe las cláusulas, notas o advertencias..."
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

      </div>

      {/* MODAL DE PREVISUALIZACIÓN PDF COMPILADO POR PYTHON */}
      <Dialog open={isPdfModalOpen} onOpenChange={setIsPdfModalOpen}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 overflow-hidden bg-slate-900 border-slate-800">
          <DialogHeader className="p-4 border-b border-slate-800 bg-slate-950 flex flex-row items-center justify-between">
            <div>
              <DialogTitle className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <FileText className="h-4 w-4 text-indigo-400" />
                Previsualización Oficial PDF (Motor WeasyPrint Python)
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Formato {paperSize} compilado vectorialmente en alta resolución.
              </DialogDescription>
            </div>
            {pdfBlobUrl && (
              <a 
                href={pdfBlobUrl} 
                download={`${nombre.replace(/\s+/g, '_')}.pdf`}
                className="text-xs px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Download className="h-3.5 w-3.5" /> Descargar PDF
              </a>
            )}
          </DialogHeader>

          <div className="flex-1 bg-slate-950 p-2 overflow-hidden flex items-center justify-center">
            {pdfBlobUrl ? (
              <iframe 
                src={pdfBlobUrl} 
                className="w-full h-full rounded border border-slate-800"
                title="PDF Preview"
              />
            ) : (
              <div className="text-xs text-slate-400 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando visor...
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
