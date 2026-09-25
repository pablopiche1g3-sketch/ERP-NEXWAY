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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Minus,
  Type,
  EyeOff,
  Palette,
  Maximize2
} from 'lucide-react';
import { 
  renderTemplateToPrint, 
  PrintTemplateScheme, 
  PrintBlock, 
  checkPythonPdfServiceHealth, 
  compileTemplateWithPython 
} from '@/services/printService';

const AVAILABLE_BLOCK_TYPES = [
  { type: 'header', label: 'Encabezado Corporativo', icon: Building2, desc: 'Logo, razón social, dirección, NIT/NRC y fecha' },
  { type: 'customer', label: 'Datos del Cliente / DTE', icon: User, desc: 'Nombre, NIT, NRC, giro, dirección y código DTE' },
  { type: 'items_table', label: 'Tabla de Productos', icon: ShoppingCart, desc: 'Columnas de cantidad, SKU, descripción, P.U. y totales' },
  { type: 'totals', label: 'Totales & Desglose IVA', icon: Calculator, desc: 'Subtotal, IVA 13%, retenciones, letras y pagos' },
  { type: 'qr_hacienda', label: 'QR Hacienda & Sello MH', icon: QrCode, desc: 'Código QR de validación en memoria y Sello oficial' },
  { type: 'footer', label: 'Pie de Página & Firmas', icon: FileText, desc: 'Agradecimientos, políticas, redes sociales y firmas' },
  { type: 'custom_text', label: 'Texto Libre / Cláusulas', icon: FileCode2, desc: 'Políticas de garantía, advertencias o notas especiales' },
  { type: 'divider', label: 'Línea Divisoria', icon: Minus, desc: 'Separador continuo, punteado, doble o espacio' },
];

const PRESETS: Record<string, { nombre: string; paper_size: '80mm' | '58mm' | 'A4'; font_family?: any; density?: any; modulo_origen: string; blocks: PrintBlock[] }> = {
  pos_80mm: {
    nombre: 'Ticket Térmico POS 80mm',
    paper_size: '80mm',
    font_family: 'sans',
    density: 'normal',
    modulo_origen: 'POS',
    blocks: [
      { id: 'b1', type: 'header', title: 'NEXWAY ERP S.A. DE C.V.', showLogo: true, logoSize: 'medium', showAddress: true, addressText: 'San Salvador, El Salvador C.A.', showPhone: true, phoneText: '+503 2200-0000', showNitNrc: true, nitText: '0614-150890-102-1', nrcText: '283940-1', showDocType: true, headerType: 'FACTURA DE CONSUMIDOR FINAL (DTE-01)', showDateTime: true, align: 'center', fontSize: 'normal' },
      { id: 'b2', type: 'customer', customerSectionTitle: 'DATOS DEL RECEPTOR', showCustomerName: true, showNit: true, showNrc: true, showCustomerAddress: true, showCodGen: true, showControlNum: false, customerBoxStyle: 'simple', fontSize: 'normal' },
      { id: 'b3', type: 'items_table', showQty: true, showUnit: false, showSku: true, showPriceUni: true, showItemTotal: true, tableHeaderStyle: 'simple', tableRowDivider: 'dotted', tableFontSize: 'small' },
      { id: 'b4', type: 'totals', showSubtotal: true, showIva: true, showRetencion: false, showTotalInLetters: true, showPaymentMethod: true, showCashChange: true, totalBoxHighlight: true, fontSize: 'normal' },
      { id: 'b5', type: 'qr_hacienda', qrSize: 'medium', showSello: true, showPublicUrl: true, qrInstructionText: 'Consulta pública en factura.mh.gob.sv' },
      { id: 'b6', type: 'footer', customMessage: '¡Gracias por su compra en NexWay ERP!', policiesText: 'Cambios con ticket dentro de los 30 días.', showSignatures: false }
    ]
  },
  pos_58mm: {
    nombre: 'Ticket Compacto 58mm (Miniprinter)',
    paper_size: '58mm',
    font_family: 'mono',
    density: 'compact',
    modulo_origen: 'POS',
    blocks: [
      { id: 'b1', type: 'header', title: 'NEXWAY ERP', showLogo: false, showAddress: false, showPhone: true, phoneText: 'Tel: 2200-0000', showNitNrc: true, nitText: '0614-150890-102-1', showDocType: true, headerType: 'FACTURA DTE-01', showDateTime: true, align: 'center', fontSize: 'small' },
      { id: 'b2', type: 'customer', customerSectionTitle: 'CLIENTE', showCustomerName: true, showNit: true, showNrc: false, showCustomerAddress: false, showCodGen: true, customerBoxStyle: 'simple', fontSize: 'small' },
      { id: 'b3', type: 'items_table', showQty: true, showUnit: false, showSku: false, showPriceUni: false, showItemTotal: true, tableHeaderStyle: 'simple', tableRowDivider: 'none', tableFontSize: 'xs' },
      { id: 'b4', type: 'totals', showSubtotal: true, showIva: true, showRetencion: false, showTotalInLetters: false, showPaymentMethod: false, totalBoxHighlight: false, fontSize: 'small' },
      { id: 'b5', type: 'qr_hacienda', qrSize: 'small', showSello: true, showPublicUrl: false },
      { id: 'b6', type: 'footer', customMessage: 'Gracias por su compra.', showSignatures: false }
    ]
  },
  ccf_a4: {
    nombre: 'Comprobante de Crédito Fiscal A4 (DTE-03)',
    paper_size: 'A4',
    font_family: 'sans',
    density: 'normal',
    modulo_origen: 'FACTURACION',
    blocks: [
      { id: 'b1', type: 'header', title: 'NEXWAY ERP S.A. DE C.V.', subtitle: 'Soluciones Integrales de Construcción y Ferretería', showLogo: true, logoSize: 'large', showGiro: true, giroText: 'Venta al por mayor de materiales de ferretería', showAddress: true, addressText: 'San Salvador, El Salvador C.A.', showPhone: true, phoneText: '(503) 2200-0000', showEmail: true, emailText: 'facturacion@nexway.sv', showNitNrc: true, nitText: '0614-150890-102-1', nrcText: '283940-1', showDocType: true, headerType: 'COMPROBANTE DE CRÉDITO FISCAL (DTE-03)', showDateTime: true, align: 'left', fontSize: 'large' },
      { id: 'b2', type: 'customer', customerSectionTitle: 'DATOS DEL RECEPTOR / CONTRIBUYENTE', showCustomerName: true, showNit: true, showNrc: true, showCustomerGiro: true, showCustomerAddress: true, showCodGen: true, showControlNum: true, customerBoxStyle: 'bordered', fontSize: 'normal' },
      { id: 'b3', type: 'items_table', showQty: true, showUnit: true, showSku: true, showPriceUni: true, showItemTotal: true, tableHeaderStyle: 'gray', tableRowDivider: 'solid', tableFontSize: 'normal' },
      { id: 'b4', type: 'totals', showSubtotal: true, showIva: true, showRetencion: true, showTotalInLetters: true, showPaymentMethod: true, totalBoxHighlight: true, fontSize: 'large' },
      { id: 'b5', type: 'qr_hacienda', qrSize: 'medium', showSello: true, showPublicUrl: true, qrInstructionText: 'Documento Tributario Electrónico emitido bajo la normativa del Ministerio de Hacienda.' },
      { id: 'b6', type: 'footer', customMessage: '¡Gracias por su preferencia comercial en NexWay ERP!', showSignatures: true, signatureLeftLabel: 'Entregado Por (Firma / Sello)', signatureRightLabel: 'Recibido Conforme (Nombre / Firma)', showResolutionText: true, resolutionText: 'Resolución MH No. 15000-RES-2026' }
    ]
  },
  fe_a4: {
    nombre: 'Factura de Consumidor Final A4 (DTE-01)',
    paper_size: 'A4',
    font_family: 'sans',
    density: 'normal',
    modulo_origen: 'FACTURACION',
    blocks: [
      { id: 'b1', type: 'header', title: 'NEXWAY ERP S.A. DE C.V.', showLogo: true, logoSize: 'medium', showAddress: true, addressText: 'San Salvador, El Salvador C.A.', showPhone: true, phoneText: '(503) 2200-0000', showNitNrc: true, nitText: '0614-150890-102-1', nrcText: '283940-1', showDocType: true, headerType: 'FACTURA DE CONSUMIDOR FINAL (DTE-01)', showDateTime: true, align: 'center', fontSize: 'normal' },
      { id: 'b2', type: 'customer', customerSectionTitle: 'DATOS DEL CLIENTE', showCustomerName: true, showNit: true, showNrc: false, showCustomerAddress: true, showCodGen: true, showControlNum: true, customerBoxStyle: 'shaded', fontSize: 'normal' },
      { id: 'b3', type: 'items_table', showQty: true, showUnit: false, showSku: true, showPriceUni: true, showItemTotal: true, tableHeaderStyle: 'simple', tableRowDivider: 'solid', tableFontSize: 'normal' },
      { id: 'b4', type: 'totals', showSubtotal: true, showIva: true, showTotalInLetters: true, totalBoxHighlight: true, fontSize: 'normal' },
      { id: 'b5', type: 'qr_hacienda', qrSize: 'medium', showSello: true, showPublicUrl: true },
      { id: 'b6', type: 'footer', customMessage: '¡Gracias por su compra en NexWay ERP!', showSignatures: false }
    ]
  }
};

export default function PrintDesignerTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  // Parámetros Generales de la Plantilla
  const [nombre, setNombre] = useState('Ticket Térmico POS 80mm');
  const [moduloOrigen, setModuloOrigen] = useState('POS');
  const [paperSize, setPaperSize] = useState<'80mm' | '58mm' | 'A4'>('80mm');
  const [fontFamily, setFontFamily] = useState<'sans' | 'mono' | 'serif' | 'thermal'>('sans');
  const [density, setDensity] = useState<'compact' | 'normal' | 'spacious'>('normal');

  const [blocks, setBlocks] = useState<PrintBlock[]>(PRESETS.pos_80mm.blocks);
  const [selectedBlockId, setSelectedBlockId] = useState<string>('b1');
  const [activePropertyTab, setActivePropertyTab] = useState<'content' | 'visibility' | 'style'>('content');

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
          setFontFamily(first.json_scheme.font_family || 'sans');
          setDensity(first.json_scheme.density || 'normal');
          setBlocks(first.json_scheme.blocks || PRESETS.pos_80mm.blocks);
          if (first.json_scheme.blocks?.length > 0) {
            setSelectedBlockId(first.json_scheme.blocks[0].id);
          }
        }
      }
    } catch (e: any) {
      console.warn('Error cargando plantillas de Supabase:', e);
      const local = typeof window !== 'undefined' ? localStorage.getItem('nexway_print_templates') : null;
      if (local) {
        try {
          const parsed = JSON.parse(local);
          setTemplates(parsed);
          if (parsed.length > 0) {
            setNombre(parsed[0].nombre);
            setModuloOrigen(parsed[0].modulo_origen);
            setPaperSize(parsed[0].json_scheme?.paper_size || '80mm');
            setFontFamily(parsed[0].json_scheme?.font_family || 'sans');
            setDensity(parsed[0].json_scheme?.density || 'normal');
            setBlocks(parsed[0].json_scheme?.blocks || PRESETS.pos_80mm.blocks);
          }
        } catch (err) {}
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApplyPreset = (presetKey: string) => {
    const preset = PRESETS[presetKey];
    if (!preset) return;
    setNombre(preset.nombre);
    setPaperSize(preset.paper_size);
    setFontFamily(preset.font_family || 'sans');
    setDensity(preset.density || 'normal');
    setModuloOrigen(preset.modulo_origen);
    setBlocks(JSON.parse(JSON.stringify(preset.blocks)));
    setSelectedBlockId(preset.blocks[0]?.id || '');
    toast({
      title: 'Preset Aplicado',
      description: `Se cargó la plantilla oficial "${preset.nombre}".`
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
      fontSize: 'normal',
      align: 'center'
    };

    if (type === 'header') {
      newBlock.title = 'NEXWAY ERP S.A. DE C.V.';
      newBlock.showLogo = true;
      newBlock.logoSize = 'medium';
      newBlock.showAddress = true;
      newBlock.addressText = 'San Salvador, El Salvador';
      newBlock.showPhone = true;
      newBlock.phoneText = '+503 2200-0000';
      newBlock.showNitNrc = true;
      newBlock.nitText = '0614-150890-102-1';
      newBlock.nrcText = '283940-1';
      newBlock.showDocType = true;
      newBlock.showDateTime = true;
    } else if (type === 'customer') {
      newBlock.customerSectionTitle = 'DATOS DEL CLIENTE';
      newBlock.showCustomerName = true;
      newBlock.showNit = true;
      newBlock.showNrc = true;
      newBlock.showCustomerAddress = true;
      newBlock.showCodGen = true;
      newBlock.customerBoxStyle = 'simple';
    } else if (type === 'items_table') {
      newBlock.showQty = true;
      newBlock.showSku = true;
      newBlock.showPriceUni = true;
      newBlock.showItemTotal = true;
      newBlock.tableHeaderStyle = 'simple';
      newBlock.tableRowDivider = 'dotted';
      newBlock.tableFontSize = 'small';
    } else if (type === 'totals') {
      newBlock.showSubtotal = true;
      newBlock.showIva = true;
      newBlock.showTotalInLetters = true;
      newBlock.totalBoxHighlight = true;
    } else if (type === 'qr_hacienda') {
      newBlock.qrSize = 'medium';
      newBlock.showSello = true;
      newBlock.showPublicUrl = true;
      newBlock.qrInstructionText = 'Consulta pública en factura.mh.gob.sv';
    } else if (type === 'footer') {
      newBlock.customMessage = '¡Gracias por su compra en NexWay ERP!';
      newBlock.policiesText = 'Garantía de 30 días con este comprobante.';
      newBlock.showSignatures = false;
    } else if (type === 'custom_text') {
      newBlock.content = 'Términos & Condiciones: No se aceptan devoluciones sin su ticket.';
      newBlock.align = 'center';
    } else if (type === 'divider') {
      newBlock.dividerStyle = 'dotted';
      newBlock.dividerSpacing = 'normal';
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
      font_family: fontFamily,
      density: density,
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
        description: `Se guardaron todos los cambios de "${nombre}" con éxito.`
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

  const handleCompilePythonPdf = async () => {
    setIsCompilingPdf(true);
    try {
      const scheme: PrintTemplateScheme = {
        nombre,
        paper_size: paperSize,
        font_family: fontFamily,
        density: density,
        blocks
      };

      const pdfBlob = await compileTemplateWithPython(scheme);
      const url = URL.createObjectURL(pdfBlob);
      setPdfBlobUrl(url);
      setIsPdfModalOpen(true);
      toast({
        title: 'PDF Compilado con Éxito',
        description: 'Renderizado vectorial generado por el microservicio en Python (WeasyPrint).'
      });
    } catch (err: any) {
      console.error('Error compilando con Python:', err);
      toast({
        variant: 'destructive',
        title: 'Microservicio Python no disponible',
        description: 'Asegúrate de que el microservicio FastAPI esté corriendo o prueba la vista de impresión local.'
      });
    } finally {
      setIsCompilingPdf(false);
    }
  };

  const handleNativeBrowserPrint = () => {
    const scheme: PrintTemplateScheme = {
      nombre,
      paper_size: paperSize,
      font_family: fontFamily,
      density: density,
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
                Diseñador de Impresión & Plantillas
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Personaliza tiras térmicas (80mm/58mm) o formatos Carta A4 oficiales con renderizado de alta fidelidad.
              </p>
            </div>
          </div>
        </div>

        {/* Acciones Rápidas & Estado del Microservicio */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div 
            onClick={checkHealth}
            className={`cursor-pointer text-xs px-2.5 py-1 rounded-md border flex items-center gap-1.5 transition-colors ${
              pythonStatus.online 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                : 'bg-muted text-muted-foreground border-border/60 hover:bg-muted/80'
            }`}
            title="Clic para verificar conexión con el microservicio Python"
          >
            <Cpu className="h-3.5 w-3.5" />
            <span>{pythonStatus.online ? `Python Service v${pythonStatus.version || '1.2'}` : 'Python Offline (Modo Local)'}</span>
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
            Compilar PDF (Python)
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

      {/* Barra de Ajustes Globales & Presets */}
      <Card className="border-border/60 bg-muted/20">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="space-y-1 lg:col-span-2">
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
                  <SelectItem value="80mm" className="text-xs">Ticket Térmico (80mm POS)</SelectItem>
                  <SelectItem value="58mm" className="text-xs">Ticket Compacto (58mm)</SelectItem>
                  <SelectItem value="A4" className="text-xs">Hoja Carta / A4 Oficial</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground">Tipografía General</Label>
              <Select value={fontFamily} onValueChange={(v: any) => setFontFamily(v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sans" className="text-xs">Sans-Serif (Moderna)</SelectItem>
                  <SelectItem value="mono" className="text-xs">Monospace (Térmica POS)</SelectItem>
                  <SelectItem value="serif" className="text-xs">Serif (Formal)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Presets Rápidos */}
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

      {/* Área de Trabajo en 3 Columnas */}
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

        {/* COLUMNA 2: LIENZO INTERACTIVO (SIMULACIÓN REALISTA) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Layout className="h-3.5 w-3.5 text-indigo-400" /> 2. Lienzo ({paperSize})
            </h3>
            <span className="text-[11px] text-muted-foreground font-mono">{blocks.length} Bloques</span>
          </div>

          <div className="p-3 rounded-xl border border-border/60 bg-slate-950/40 flex justify-center overflow-x-auto min-h-[580px]">
            <div 
              style={{
                width: paperSize === '58mm' ? '230px' : paperSize === '80mm' ? '300px' : '100%',
                maxWidth: paperSize === 'A4' ? '440px' : undefined,
                fontFamily: fontFamily === 'mono' ? 'monospace' : fontFamily === 'serif' ? 'serif' : 'sans-serif'
              }}
              className="bg-white text-slate-900 rounded-md shadow-2xl p-3.5 transition-all space-y-2 border border-slate-300"
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
                        : 'border-dashed border-slate-300 hover:border-slate-400 bg-slate-50/40'
                    }`}
                  >
                    {/* Controles de Mover / Eliminar */}
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

                    {/* Previsualización en Tiempo Real */}
                    {block.type === 'header' && (
                      <div className={`text-${block.align || 'center'} text-[10px] space-y-0.5`}>
                        {block.showLogo && <div className="font-bold text-[10px] text-slate-500">[LOGOTIPO]</div>}
                        <div className="font-bold text-xs">{block.title || 'NEXWAY ERP S.A. DE C.V.'}</div>
                        {block.subtitle && <div className="text-[9px] text-slate-600 font-medium">{block.subtitle}</div>}
                        {block.showGiro && <div className="text-[8.5px] text-slate-500">{block.giroText || 'Giro: Comercial'}</div>}
                        {block.showAddress && <div className="text-[8.5px] text-slate-500">{block.addressText || 'San Salvador, El Salvador'}</div>}
                        {block.showPhone && <div className="text-[8.5px] text-slate-500">Tel: {block.phoneText || '2200-0000'}</div>}
                        {block.showNitNrc && <div className="text-[8.5px] font-bold">NIT: {block.nitText || '0614-150890-102-1'}</div>}
                        {block.showDocType && <div className="text-[9px] font-black uppercase text-indigo-900 bg-indigo-50 p-0.5 rounded mt-1">{block.headerType || 'FACTURA DTE'}</div>}
                      </div>
                    )}

                    {block.type === 'customer' && (
                      <div className={`text-[9.5px] space-y-0.5 ${block.customerBoxStyle === 'bordered' ? 'border border-slate-300 p-1.5 rounded' : block.customerBoxStyle === 'shaded' ? 'bg-slate-100 p-1.5 rounded' : 'border-t border-b border-dashed border-slate-300 py-1'}`}>
                        {block.customerSectionTitle && <div className="text-[8px] font-bold text-slate-500 uppercase">{block.customerSectionTitle}</div>}
                        {block.showCustomerName && <div><strong>Cliente:</strong> Comercializadora S.A.</div>}
                        {block.showNit && <div><strong>NIT:</strong> 0614-150890-102-1</div>}
                        {block.showNrc && <div><strong>NRC:</strong> 29814-0</div>}
                        {block.showCustomerAddress && <div><strong>Dir:</strong> San Salvador</div>}
                        {block.showCodGen && <div className="font-mono text-[8px] text-indigo-600 truncate"><strong>Cod:</strong> DTE-01-C001-0000001892</div>}
                      </div>
                    )}

                    {block.type === 'items_table' && (
                      <div className="text-[9px] space-y-1">
                        <div className={`flex justify-between font-bold pb-0.5 uppercase ${block.tableHeaderStyle === 'dark' ? 'bg-slate-900 text-white p-1' : block.tableHeaderStyle === 'gray' ? 'bg-slate-200 text-slate-900 p-1' : 'border-b border-slate-900'}`}>
                          <span>{block.showQty ? 'Cant / Prod' : 'Producto'}</span>
                          <span>Total</span>
                        </div>
                        <div className="flex justify-between py-0.5 border-b border-dotted border-slate-200">
                          <span>2x Cemento Portland</span>
                          <span className="font-semibold">$21.00</span>
                        </div>
                        <div className="flex justify-between py-0.5">
                          <span>1x Pintura Blanco 1 Gal</span>
                          <span className="font-semibold">$18.00</span>
                        </div>
                      </div>
                    )}

                    {block.type === 'totals' && (
                      <div className="text-[9.5px] text-right space-y-0.5 pt-1 border-t border-dashed border-slate-400">
                        {block.showSubtotal && <div>Subtotal: $34.51</div>}
                        {block.showIva && <div>IVA (13%): $4.49</div>}
                        {block.showRetencion && <div className="text-rose-600">(-) Retención 1%: $0.00</div>}
                        <div className={`font-black text-xs text-slate-900 pt-0.5 ${block.totalBoxHighlight ? 'bg-slate-100 p-1 rounded' : ''}`}>
                          TOTAL: $39.00
                        </div>
                        {block.showTotalInLetters && (
                          <div className="text-[7.5px] text-slate-500 italic text-center">Son: TREINTA Y NUEVE 00/100 USD</div>
                        )}
                      </div>
                    )}

                    {block.type === 'qr_hacienda' && (
                      <div className="text-center py-1 space-y-1">
                        <div className="inline-block p-1 bg-slate-100 border border-slate-300 rounded text-[8px] font-mono">
                          [QR HACIENDA MH]
                        </div>
                        {block.showSello && (
                          <div className="text-[7.5px] font-mono text-slate-600 truncate">Sello MH: 2026-SELLO-MH-9041</div>
                        )}
                        {block.showPublicUrl && (
                          <div className="text-[7px] text-slate-500">{block.qrInstructionText || 'Consulta pública en factura.mh.gob.sv'}</div>
                        )}
                      </div>
                    )}

                    {block.type === 'footer' && (
                      <div className="text-center text-[9px] font-medium text-slate-700 space-y-1">
                        <div>{block.customMessage || '¡Gracias por su compra!'}</div>
                        {block.policiesText && <div className="text-[7.5px] text-slate-500">{block.policiesText}</div>}
                        {block.socialMediaText && <div className="text-[7.5px] text-blue-600">{block.socialMediaText}</div>}
                        {block.showSignatures && (
                          <div className="flex justify-around pt-3 text-[7.5px]">
                            <span className="border-t border-slate-800 px-2">{block.signatureLeftLabel || 'Entregado'}</span>
                            <span className="border-t border-slate-800 px-2">{block.signatureRightLabel || 'Recibido'}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {block.type === 'custom_text' && (
                      <div className={`text-[9px] text-${block.align || 'left'} ${block.isBold ? 'font-bold' : ''} ${block.isItalic ? 'italic' : ''} ${block.isBoxed ? 'border border-slate-300 p-1.5 rounded bg-slate-50' : ''}`}>
                        {block.content || 'Texto personalizado...'}
                      </div>
                    )}

                    {block.type === 'divider' && (
                      <div className={`${block.dividerStyle === 'dotted' ? 'border-t border-dotted border-slate-600' : block.dividerStyle === 'double' ? 'border-t-4 border-double border-slate-900' : 'border-t-2 border-slate-800'} my-1`}></div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* COLUMNA 3: PANEL DE OPCIONES COMPLETO & ESTRUCTURADO */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sliders className="h-3.5 w-3.5 text-primary" /> 3. Panel de Opciones
            </h3>
            {selectedBlock && (
              <Badge variant="outline" className="text-[10px] font-mono uppercase bg-primary/10 text-primary border-primary/30">
                Bloque Activo: {selectedBlock.type}
              </Badge>
            )}
          </div>

          <Card className="border-border/60 shadow-sm">
            <CardContent className="p-4">
              {!selectedBlock ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  Selecciona un bloque en el lienzo para desplegar todas sus opciones de modificación.
                </div>
              ) : (
                <Tabs value={activePropertyTab} onValueChange={(v: any) => setActivePropertyTab(v)} className="w-full">
                  <TabsList className="grid grid-cols-3 w-full mb-4">
                    <TabsTrigger value="content" className="text-xs gap-1">
                      <Type className="h-3.5 w-3.5" /> Contenido
                    </TabsTrigger>
                    <TabsTrigger value="visibility" className="text-xs gap-1">
                      <Eye className="h-3.5 w-3.5" /> Visibilidad
                    </TabsTrigger>
                    <TabsTrigger value="style" className="text-xs gap-1">
                      <Palette className="h-3.5 w-3.5" /> Estilos & Bordes
                    </TabsTrigger>
                  </TabsList>

                  {/* 1. PESTAÑA: CONTENIDO Y TEXTOS */}
                  <TabsContent value="content" className="space-y-3.5 pt-1">
                    {selectedBlock.type === 'header' && (
                      <>
                        <div className="space-y-1">
                          <Label className="text-xs">Razón Social / Nombre Comercial</Label>
                          <Input 
                            value={selectedBlock.title || ''} 
                            onChange={e => updateBlockProperty('title', e.target.value)} 
                            className="h-8 text-xs font-semibold" 
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Eslogan o Subtítulo</Label>
                          <Input 
                            value={selectedBlock.subtitle || ''} 
                            onChange={e => updateBlockProperty('subtitle', e.target.value)} 
                            placeholder="Ej: Materiales y Ferretería" 
                            className="h-8 text-xs" 
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Tipo de Documento Tributario Destacado</Label>
                          <Input 
                            value={selectedBlock.headerType || ''} 
                            onChange={e => updateBlockProperty('headerType', e.target.value)} 
                            placeholder="Ej: FACTURA DE CONSUMIDOR FINAL" 
                            className="h-8 text-xs" 
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2.5">
                          <div className="space-y-1">
                            <Label className="text-xs">Teléfono</Label>
                            <Input 
                              value={selectedBlock.phoneText || ''} 
                              onChange={e => updateBlockProperty('phoneText', e.target.value)} 
                              placeholder="+503 2200-0000" 
                              className="h-8 text-xs" 
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Correo de Contacto</Label>
                            <Input 
                              value={selectedBlock.emailText || ''} 
                              onChange={e => updateBlockProperty('emailText', e.target.value)} 
                              placeholder="facturacion@empresa.com" 
                              className="h-8 text-xs" 
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2.5">
                          <div className="space-y-1">
                            <Label className="text-xs">NIT Emisor</Label>
                            <Input 
                              value={selectedBlock.nitText || ''} 
                              onChange={e => updateBlockProperty('nitText', e.target.value)} 
                              placeholder="0614-150890-102-1" 
                              className="h-8 text-xs" 
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">NRC Emisor</Label>
                            <Input 
                              value={selectedBlock.nrcText || ''} 
                              onChange={e => updateBlockProperty('nrcText', e.target.value)} 
                              placeholder="283940-1" 
                              className="h-8 text-xs" 
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Dirección Física</Label>
                          <Input 
                            value={selectedBlock.addressText || ''} 
                            onChange={e => updateBlockProperty('addressText', e.target.value)} 
                            placeholder="San Salvador, El Salvador C.A." 
                            className="h-8 text-xs" 
                          />
                        </div>
                      </>
                    )}

                    {selectedBlock.type === 'customer' && (
                      <>
                        <div className="space-y-1">
                          <Label className="text-xs">Título de la Sección del Cliente</Label>
                          <Input 
                            value={selectedBlock.customerSectionTitle || ''} 
                            onChange={e => updateBlockProperty('customerSectionTitle', e.target.value)} 
                            placeholder="Ej: DATOS DEL RECEPTOR" 
                            className="h-8 text-xs" 
                          />
                        </div>
                      </>
                    )}

                    {selectedBlock.type === 'qr_hacienda' && (
                      <>
                        <div className="space-y-1">
                          <Label className="text-xs">Texto Instructivo del QR</Label>
                          <Input 
                            value={selectedBlock.qrInstructionText || ''} 
                            onChange={e => updateBlockProperty('qrInstructionText', e.target.value)} 
                            placeholder="Consulta pública en factura.mh.gob.sv" 
                            className="h-8 text-xs" 
                          />
                        </div>
                      </>
                    )}

                    {selectedBlock.type === 'footer' && (
                      <>
                        <div className="space-y-1">
                          <Label className="text-xs">Mensaje Principal de Agradecimiento</Label>
                          <Textarea 
                            value={selectedBlock.customMessage || ''} 
                            onChange={e => updateBlockProperty('customMessage', e.target.value)} 
                            className="text-xs resize-none h-16" 
                            placeholder="¡Gracias por su compra en NexWay ERP!" 
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Políticas de Devolución / Garantía</Label>
                          <Input 
                            value={selectedBlock.policiesText || ''} 
                            onChange={e => updateBlockProperty('policiesText', e.target.value)} 
                            placeholder="Ej: Cambios con ticket dentro de los 30 días." 
                            className="h-8 text-xs" 
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Redes Sociales / WhatsApp</Label>
                          <Input 
                            value={selectedBlock.socialMediaText || ''} 
                            onChange={e => updateBlockProperty('socialMediaText', e.target.value)} 
                            placeholder="WhatsApp: +503 7000-0000 | Web: nexway.sv" 
                            className="h-8 text-xs" 
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2.5">
                          <div className="space-y-1">
                            <Label className="text-xs">Firma Izquierda</Label>
                            <Input 
                              value={selectedBlock.signatureLeftLabel || ''} 
                              onChange={e => updateBlockProperty('signatureLeftLabel', e.target.value)} 
                              placeholder="Entregado Por" 
                              className="h-8 text-xs" 
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Firma Derecha</Label>
                            <Input 
                              value={selectedBlock.signatureRightLabel || ''} 
                              onChange={e => updateBlockProperty('signatureRightLabel', e.target.value)} 
                              placeholder="Recibido Conforme" 
                              className="h-8 text-xs" 
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {selectedBlock.type === 'custom_text' && (
                      <>
                        <div className="space-y-1">
                          <Label className="text-xs">Contenido de Texto</Label>
                          <Textarea 
                            value={selectedBlock.content || ''} 
                            onChange={e => updateBlockProperty('content', e.target.value)} 
                            className="text-xs resize-none h-24" 
                            placeholder="Escribe el texto libre, advertencia legal o notas..." 
                          />
                        </div>
                      </>
                    )}
                  </TabsContent>

                  {/* 2. PESTAÑA: VISIBILIDAD DE CAMPOS */}
                  <TabsContent value="visibility" className="space-y-3 pt-1">
                    {selectedBlock.type === 'header' && (
                      <>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs cursor-pointer" htmlFor="sw-logo">Mostrar Logotipo</Label>
                          <Switch id="sw-logo" checked={selectedBlock.showLogo !== false} onCheckedChange={v => updateBlockProperty('showLogo', v)} />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs cursor-pointer" htmlFor="sw-addr">Mostrar Dirección Física</Label>
                          <Switch id="sw-addr" checked={selectedBlock.showAddress !== false} onCheckedChange={v => updateBlockProperty('showAddress', v)} />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs cursor-pointer" htmlFor="sw-phone">Mostrar Teléfono</Label>
                          <Switch id="sw-phone" checked={selectedBlock.showPhone !== false} onCheckedChange={v => updateBlockProperty('showPhone', v)} />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs cursor-pointer" htmlFor="sw-email">Mostrar Correo Electrónico</Label>
                          <Switch id="sw-email" checked={!!selectedBlock.showEmail} onCheckedChange={v => updateBlockProperty('showEmail', v)} />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs cursor-pointer" htmlFor="sw-nitnrc">Mostrar NIT y NRC Emisor</Label>
                          <Switch id="sw-nitnrc" checked={selectedBlock.showNitNrc !== false} onCheckedChange={v => updateBlockProperty('showNitNrc', v)} />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs cursor-pointer" htmlFor="sw-doctype">Mostrar Tipo de DTE</Label>
                          <Switch id="sw-doctype" checked={selectedBlock.showDocType !== false} onCheckedChange={v => updateBlockProperty('showDocType', v)} />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs cursor-pointer" htmlFor="sw-datetime">Mostrar Fecha y Hora</Label>
                          <Switch id="sw-datetime" checked={selectedBlock.showDateTime !== false} onCheckedChange={v => updateBlockProperty('showDateTime', v)} />
                        </div>
                      </>
                    )}

                    {selectedBlock.type === 'customer' && (
                      <>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs cursor-pointer" htmlFor="sw-cname">Mostrar Nombre del Cliente</Label>
                          <Switch id="sw-cname" checked={selectedBlock.showCustomerName !== false} onCheckedChange={v => updateBlockProperty('showCustomerName', v)} />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs cursor-pointer" htmlFor="sw-cnit">Mostrar NIT / DUI</Label>
                          <Switch id="sw-cnit" checked={selectedBlock.showNit !== false} onCheckedChange={v => updateBlockProperty('showNit', v)} />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs cursor-pointer" htmlFor="sw-cnrc">Mostrar NRC del Cliente</Label>
                          <Switch id="sw-cnrc" checked={selectedBlock.showNrc !== false} onCheckedChange={v => updateBlockProperty('showNrc', v)} />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs cursor-pointer" htmlFor="sw-cgiro">Mostrar Giro / Actividad</Label>
                          <Switch id="sw-cgiro" checked={!!selectedBlock.showCustomerGiro} onCheckedChange={v => updateBlockProperty('showCustomerGiro', v)} />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs cursor-pointer" htmlFor="sw-caddr">Mostrar Dirección</Label>
                          <Switch id="sw-caddr" checked={selectedBlock.showCustomerAddress !== false} onCheckedChange={v => updateBlockProperty('showCustomerAddress', v)} />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs cursor-pointer" htmlFor="sw-ccodgen">Mostrar Código Generación DTE</Label>
                          <Switch id="sw-ccodgen" checked={selectedBlock.showCodGen !== false} onCheckedChange={v => updateBlockProperty('showCodGen', v)} />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs cursor-pointer" htmlFor="sw-cctrl">Mostrar Número de Control MH</Label>
                          <Switch id="sw-cctrl" checked={!!selectedBlock.showControlNum} onCheckedChange={v => updateBlockProperty('showControlNum', v)} />
                        </div>
                      </>
                    )}

                    {selectedBlock.type === 'items_table' && (
                      <>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs cursor-pointer" htmlFor="sw-tqty">Columna Cantidad</Label>
                          <Switch id="sw-tqty" checked={selectedBlock.showQty !== false} onCheckedChange={v => updateBlockProperty('showQty', v)} />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs cursor-pointer" htmlFor="sw-tunit">Unidad de Medida</Label>
                          <Switch id="sw-tunit" checked={!!selectedBlock.showUnit} onCheckedChange={v => updateBlockProperty('showUnit', v)} />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs cursor-pointer" htmlFor="sw-tsku">Código / SKU del Producto</Label>
                          <Switch id="sw-tsku" checked={selectedBlock.showSku !== false} onCheckedChange={v => updateBlockProperty('showSku', v)} />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs cursor-pointer" htmlFor="sw-tprice">Precio Unitario (P.U.)</Label>
                          <Switch id="sw-tprice" checked={selectedBlock.showPriceUni !== false} onCheckedChange={v => updateBlockProperty('showPriceUni', v)} />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs cursor-pointer" htmlFor="sw-ttot">Total por Línea</Label>
                          <Switch id="sw-ttot" checked={selectedBlock.showItemTotal !== false} onCheckedChange={v => updateBlockProperty('showItemTotal', v)} />
                        </div>
                      </>
                    )}

                    {selectedBlock.type === 'totals' && (
                      <>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs cursor-pointer" htmlFor="sw-tsub">Mostrar Subtotal Gravado</Label>
                          <Switch id="sw-tsub" checked={selectedBlock.showSubtotal !== false} onCheckedChange={v => updateBlockProperty('showSubtotal', v)} />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs cursor-pointer" htmlFor="sw-tiva">Desglosar IVA (13%)</Label>
                          <Switch id="sw-tiva" checked={selectedBlock.showIva !== false} onCheckedChange={v => updateBlockProperty('showIva', v)} />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs cursor-pointer" htmlFor="sw-trete">Mostrar Retención 1% IVA</Label>
                          <Switch id="sw-trete" checked={!!selectedBlock.showRetencion} onCheckedChange={v => updateBlockProperty('showRetencion', v)} />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs cursor-pointer" htmlFor="sw-tletras">Monto en Letras (Son: ...)</Label>
                          <Switch id="sw-tletras" checked={selectedBlock.showTotalInLetters !== false} onCheckedChange={v => updateBlockProperty('showTotalInLetters', v)} />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs cursor-pointer" htmlFor="sw-tpay">Forma de Pago & Cambio</Label>
                          <Switch id="sw-tpay" checked={!!selectedBlock.showPaymentMethod} onCheckedChange={v => updateBlockProperty('showPaymentMethod', v)} />
                        </div>
                      </>
                    )}

                    {selectedBlock.type === 'qr_hacienda' && (
                      <>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs cursor-pointer" htmlFor="sw-qsello">Mostrar Sello de Recepción MH</Label>
                          <Switch id="sw-qsello" checked={selectedBlock.showSello !== false} onCheckedChange={v => updateBlockProperty('showSello', v)} />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs cursor-pointer" htmlFor="sw-qurl">Mostrar URL de Validación Pública</Label>
                          <Switch id="sw-qurl" checked={selectedBlock.showPublicUrl !== false} onCheckedChange={v => updateBlockProperty('showPublicUrl', v)} />
                        </div>
                      </>
                    )}

                    {selectedBlock.type === 'footer' && (
                      <>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs cursor-pointer" htmlFor="sw-fsig">Mostrar Líneas de Firmas</Label>
                          <Switch id="sw-fsig" checked={!!selectedBlock.showSignatures} onCheckedChange={v => updateBlockProperty('showSignatures', v)} />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs cursor-pointer" htmlFor="sw-fres">Mostrar Resolución MH</Label>
                          <Switch id="sw-fres" checked={!!selectedBlock.showResolutionText} onCheckedChange={v => updateBlockProperty('showResolutionText', v)} />
                        </div>
                      </>
                    )}
                  </TabsContent>

                  {/* 3. PESTAÑA: ESTILOS, TAMAÑOS & BORDES */}
                  <TabsContent value="style" className="space-y-3 pt-1">
                    {/* Alineación de Texto */}
                    <div className="space-y-1">
                      <Label className="text-xs">Alineación del Texto</Label>
                      <div className="grid grid-cols-3 gap-2">
                        <Button 
                          type="button" 
                          variant={selectedBlock.align === 'left' ? 'default' : 'outline'} 
                          size="sm" 
                          onClick={() => updateBlockProperty('align', 'left')}
                          className="h-7 text-xs gap-1"
                        >
                          <AlignLeft className="h-3 w-3" /> Izq
                        </Button>
                        <Button 
                          type="button" 
                          variant={selectedBlock.align === 'center' || !selectedBlock.align ? 'default' : 'outline'} 
                          size="sm" 
                          onClick={() => updateBlockProperty('align', 'center')}
                          className="h-7 text-xs gap-1"
                        >
                          <AlignCenter className="h-3 w-3" /> Centro
                        </Button>
                        <Button 
                          type="button" 
                          variant={selectedBlock.align === 'right' ? 'default' : 'outline'} 
                          size="sm" 
                          onClick={() => updateBlockProperty('align', 'right')}
                          className="h-7 text-xs gap-1"
                        >
                          <AlignRight className="h-3 w-3" /> Der
                        </Button>
                      </div>
                    </div>

                    {/* Tamaño de Fuente */}
                    <div className="space-y-1">
                      <Label className="text-xs">Tamaño de Fuente del Bloque</Label>
                      <Select value={selectedBlock.fontSize || 'normal'} onValueChange={v => updateBlockProperty('fontSize', v)}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="small" className="text-xs">Compacto / Pequeño</SelectItem>
                          <SelectItem value="normal" className="text-xs">Estándar / Normal</SelectItem>
                          <SelectItem value="large" className="text-xs">Destacado / Grande</SelectItem>
                          <SelectItem value="xlarge" className="text-xs">Extra Grande</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Opciones específicas según el bloque */}
                    {selectedBlock.type === 'header' && (
                      <div className="space-y-1">
                        <Label className="text-xs">Tamaño del Logotipo</Label>
                        <Select value={selectedBlock.logoSize || 'medium'} onValueChange={v => updateBlockProperty('logoSize', v)}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="small" className="text-xs">Pequeño (30mm)</SelectItem>
                            <SelectItem value="medium" className="text-xs">Mediano (45mm)</SelectItem>
                            <SelectItem value="large" className="text-xs">Grande (60mm)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {selectedBlock.type === 'customer' && (
                      <div className="space-y-1">
                        <Label className="text-xs">Estilo de Caja del Cliente</Label>
                        <Select value={selectedBlock.customerBoxStyle || 'simple'} onValueChange={v => updateBlockProperty('customerBoxStyle', v)}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="simple" className="text-xs">Simple (Líneas punteadas)</SelectItem>
                            <SelectItem value="bordered" className="text-xs">Con Borde Sólido</SelectItem>
                            <SelectItem value="shaded" className="text-xs">Fondo Sombreado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {selectedBlock.type === 'items_table' && (
                      <>
                        <div className="space-y-1">
                          <Label className="text-xs">Encabezado de Tabla</Label>
                          <Select value={selectedBlock.tableHeaderStyle || 'simple'} onValueChange={v => updateBlockProperty('tableHeaderStyle', v)}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="simple" className="text-xs">Simple con Línea</SelectItem>
                              <SelectItem value="gray" className="text-xs">Fondo Gris</SelectItem>
                              <SelectItem value="dark" className="text-xs">Fondo Oscuro</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Divisores de Filas</Label>
                          <Select value={selectedBlock.tableRowDivider || 'dotted'} onValueChange={v => updateBlockProperty('tableRowDivider', v)}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none" className="text-xs">Sin Líneas</SelectItem>
                              <SelectItem value="dotted" className="text-xs">Línea Punteada</SelectItem>
                              <SelectItem value="solid" className="text-xs">Línea Sólida</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}

                    {selectedBlock.type === 'qr_hacienda' && (
                      <div className="space-y-1">
                        <Label className="text-xs">Tamaño del Código QR</Label>
                        <Select value={selectedBlock.qrSize || 'medium'} onValueChange={v => updateBlockProperty('qrSize', v)}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="small" className="text-xs">Pequeño (20mm)</SelectItem>
                            <SelectItem value="medium" className="text-xs">Mediano (28mm)</SelectItem>
                            <SelectItem value="large" className="text-xs">Grande (36mm)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {selectedBlock.type === 'divider' && (
                      <>
                        <div className="space-y-1">
                          <Label className="text-xs">Estilo de Línea</Label>
                          <Select value={selectedBlock.dividerStyle || 'dotted'} onValueChange={v => updateBlockProperty('dividerStyle', v)}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="dotted" className="text-xs">Punteada ( - - - )</SelectItem>
                              <SelectItem value="dashed" className="text-xs">Guiones ( --- )</SelectItem>
                              <SelectItem value="solid" className="text-xs">Sólida Continua ( ── )</SelectItem>
                              <SelectItem value="double" className="text-xs">Doble Línea ( ══ )</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Espaciado / Margen</Label>
                          <Select value={selectedBlock.dividerSpacing || 'normal'} onValueChange={v => updateBlockProperty('dividerSpacing', v)}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="compact" className="text-xs">Compacto</SelectItem>
                              <SelectItem value="normal" className="text-xs">Estándar</SelectItem>
                              <SelectItem value="wide" className="text-xs">Amplio</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}

                    {selectedBlock.type === 'custom_text' && (
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs cursor-pointer" htmlFor="sw-bold">Texto en Negrita (Bold)</Label>
                          <Switch id="sw-bold" checked={!!selectedBlock.isBold} onCheckedChange={v => updateBlockProperty('isBold', v)} />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs cursor-pointer" htmlFor="sw-italic">Texto en Cursiva (Italic)</Label>
                          <Switch id="sw-italic" checked={!!selectedBlock.isItalic} onCheckedChange={v => updateBlockProperty('isItalic', v)} />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs cursor-pointer" htmlFor="sw-boxed">Enmarcar en Caja con Borde</Label>
                          <Switch id="sw-boxed" checked={!!selectedBlock.isBoxed} onCheckedChange={v => updateBlockProperty('isBoxed', v)} />
                        </div>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
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
