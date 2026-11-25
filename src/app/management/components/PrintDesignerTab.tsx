'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Image as ImageIcon,
  Type,
  Table2,
  QrCode,
  Minus,
  Calculator,
  Calendar,
  PenTool,
  Undo2,
  Redo2,
  Eye,
  EyeOff,
  Save,
  Printer,
  Copy,
  Trash2,
  Move,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Lock,
  Unlock,
  RotateCcw,
  Loader2,
  Lightbulb,
  Upload,
  ArrowUp,
  ArrowDown,
  Bold,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { printHtmlDocument, loadPrintBranding, type PrintBranding } from '@/lib/print-engine';
import {
  type VisualDocArea,
  type VisualPaperSize,
  type VisualBlock,
  type VisualBlockType,
  type VisualTemplateConfig,
  type VisibilityRule,
  PAPER_DIMENSIONS_MM,
  AREA_LABELS,
  getDefaultVisualTemplate,
  getSampleRenderData,
  renderVisualTemplateHtml,
} from '@/lib/print-visual-templates';

const BLOCK_PALETTE: Array<{ type: VisualBlockType; label: string; icon: React.ComponentType<any> }> = [
  { type: 'logo', label: 'Logo / Imagen', icon: ImageIcon },
  { type: 'text', label: 'Texto', icon: Type },
  { type: 'items_table', label: 'Tabla', icon: Table2 },
  { type: 'qr', label: 'Código QR', icon: QrCode },
  { type: 'divider', label: 'Línea divisoria', icon: Minus },
  { type: 'totals', label: 'Totalizador', icon: Calculator },
  { type: 'doc_meta', label: 'Fecha / Cliente', icon: Calendar },
  { type: 'signature', label: 'Firma', icon: PenTool },
];

const QUICK_VARS = [
  '{{empresa}}',
  '{{fecha}}',
  '{{numero}}',
  '{{cliente}}',
  '{{forma_pago}}',
  '{{observaciones}}',
];

const SCALE_PX_PER_MM = 2.65; // ~572px wide for Letter (215.9mm), crisp fit in center column

export default function PrintDesignerTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [activeArea, setActiveArea] = useState<VisualDocArea>('billing');
  const [branding, setBranding] = useState<PrintBranding | null>(null);
  const [rawPrintConfig, setRawPrintConfig] = useState<Record<string, any>>({});
  const [templatesByArea, setTemplatesByArea] = useState<Record<VisualDocArea, VisualTemplateConfig>>({
    billing: getDefaultVisualTemplate('billing'),
    quotations: getDefaultVisualTemplate('quotations'),
    purchases: getDefaultVisualTemplate('purchases'),
    quedan: getDefaultVisualTemplate('quedan'),
  });

  const [selectedBlockId, setSelectedBlockId] = useState<string>('blk_logo');
  const [rightTab, setRightTab] = useState<'properties' | 'layers'>('properties');
  const [previewOpen, setPreviewOpen] = useState(false);

  // Historial Undo / Redo por área
  const [historyPast, setHistoryPast] = useState<VisualTemplateConfig[]>([]);
  const [historyFuture, setHistoryFuture] = useState<VisualTemplateConfig[]>([]);

  // Estado de arrastre / redimensionamiento
  const dragStateRef = useRef<{
    mode: 'move' | 'resize';
    blockId: string;
    startClientX: number;
    startClientY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const currentTemplate = templatesByArea[activeArea];
  const paperDims = PAPER_DIMENSIONS_MM[currentTemplate.paperSize] || PAPER_DIMENSIONS_MM.letter;
  const isThermal = currentTemplate.paperSize === '80mm' || currentTemplate.paperSize === '58mm';
  const pxPerMm = isThermal ? 3.8 : SCALE_PX_PER_MM;

  const selectedBlock = useMemo(
    () => currentTemplate.blocks.find(b => b.id === selectedBlockId) || currentTemplate.blocks[0] || null,
    [currentTemplate.blocks, selectedBlockId]
  );

  // Cargar branding real de empresa + plantillas guardadas en system_config.print_config
  useEffect(() => {
    let mounted = true;
    const loadAll = async () => {
      setLoading(true);
      try {
        const [loadedBranding, cfgRes] = await Promise.all([
          loadPrintBranding('billing'),
          supabase.from('system_config').select('value').eq('key', 'print_config').maybeSingle(),
        ]);

        if (!mounted) return;
        setBranding(loadedBranding);

        const cfgVal =
          cfgRes.data?.value && typeof cfgRes.data.value === 'object'
            ? (cfgRes.data.value as Record<string, any>)
            : {};
        setRawPrintConfig(cfgVal);

        const savedVisuals = cfgVal.visualTemplates || {};
        const nextTemplates: Record<VisualDocArea, VisualTemplateConfig> = {
          billing: savedVisuals.billing || getDefaultVisualTemplate('billing', loadedBranding),
          quotations: savedVisuals.quotations || getDefaultVisualTemplate('quotations', loadedBranding),
          purchases: savedVisuals.purchases || getDefaultVisualTemplate('purchases', loadedBranding),
          quedan: savedVisuals.quedan || getDefaultVisualTemplate('quedan', loadedBranding),
        };
        setTemplatesByArea(nextTemplates);
        setSelectedBlockId(nextTemplates.billing.blocks[0]?.id || '');
      } catch (err) {
        console.warn('Error cargando configurador visual de impresión:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadAll();
    return () => {
      mounted = false;
    };
  }, []);

  const commitTemplateChange = (updater: (prev: VisualTemplateConfig) => VisualTemplateConfig, recordHistory = true) => {
    setTemplatesByArea(prevMap => {
      const prevTpl = prevMap[activeArea];
      const nextTpl = updater(prevTpl);
      if (recordHistory) {
        setHistoryPast(past => [...past.slice(-24), prevTpl]);
        setHistoryFuture([]);
      }
      return { ...prevMap, [activeArea]: nextTpl };
    });
  };

  const handleAreaChange = (nextArea: VisualDocArea) => {
    setActiveArea(nextArea);
    setHistoryPast([]);
    setHistoryFuture([]);
    setSelectedBlockId(templatesByArea[nextArea]?.blocks[0]?.id || '');
  };

  const handleUndo = () => {
    if (historyPast.length === 0) return;
    const previous = historyPast[historyPast.length - 1];
    setHistoryPast(past => past.slice(0, -1));
    setHistoryFuture(fut => [currentTemplate, ...fut.slice(0, 24)]);
    setTemplatesByArea(prev => ({ ...prev, [activeArea]: previous }));
  };

  const handleRedo = () => {
    if (historyFuture.length === 0) return;
    const next = historyFuture[0];
    setHistoryFuture(fut => fut.slice(1));
    setHistoryPast(past => [...past.slice(-24), currentTemplate]);
    setTemplatesByArea(prev => ({ ...prev, [activeArea]: next }));
  };

  const updateSelectedBlock = (patch: Partial<VisualBlock>, recordHistory = true) => {
    if (!selectedBlock) return;
    commitTemplateChange(
      tpl => ({
        ...tpl,
        blocks: tpl.blocks.map(b => (b.id === selectedBlock.id ? { ...b, ...patch } : b)),
      }),
      recordHistory
    );
  };

  const handleAddBlock = (type: VisualBlockType) => {
    const id = `blk_${Date.now()}`;
    const accent = currentTemplate.accentColor || '#172554';
    const base: VisualBlock = {
      id,
      type,
      label: BLOCK_PALETTE.find(p => p.type === type)?.label || 'Bloque',
      x: 16,
      y: 90,
      w: Math.min(80, paperDims.width - 24),
      h: 22,
      visible: true,
      visibilityRule: 'always',
      align: 'left',
      color: '#0f172a',
      fontSize: 11,
      fontFamily: 'Inter',
    };

    if (type === 'logo') {
      base.content = '{{empresa}}';
      base.subContent = '{{slogan}}';
      base.imageUrl = branding?.logoUrl || '';
      base.w = Math.min(92, paperDims.width - 20);
      base.h = 28;
      base.fontSize = 16;
      base.bold = true;
      base.color = accent;
    } else if (type === 'text') {
      base.content = 'Texto personalizado';
      base.h = 14;
    } else if (type === 'items_table') {
      base.w = Math.min(188, paperDims.width - 20);
      base.h = 70;
      base.bgColor = accent;
    } else if (type === 'qr') {
      base.w = 34;
      base.h = 34;
      base.content = '{{sello_mh}}';
    } else if (type === 'divider') {
      base.w = Math.min(188, paperDims.width - 20);
      base.h = 6;
      base.color = '#cbd5e1';
    } else if (type === 'totals') {
      base.w = Math.min(82, paperDims.width - 20);
      base.h = 30;
      base.bgColor = accent;
      base.bold = true;
    } else if (type === 'doc_meta') {
      base.content = 'Fecha: {{fecha}}\nCliente: {{cliente}}\nPago: {{forma_pago}}';
      base.bgColor = '#f8fafc';
      base.h = 24;
    } else if (type === 'signature') {
      base.content = 'Firma Autorizada';
      base.align = 'center';
      base.w = Math.min(72, paperDims.width - 20);
      base.h = 18;
    }

    commitTemplateChange(tpl => ({ ...tpl, blocks: [...tpl.blocks, base] }));
    setSelectedBlockId(id);
  };

  const handleDuplicateBlock = (block: VisualBlock) => {
    const copy: VisualBlock = {
      ...block,
      id: `blk_${Date.now()}`,
      label: `${block.label} (copia)`,
      x: Math.min(paperDims.width - block.w, block.x + 6),
      y: Math.min(paperDims.height - block.h, block.y + 6),
    };
    commitTemplateChange(tpl => ({ ...tpl, blocks: [...tpl.blocks, copy] }));
    setSelectedBlockId(copy.id);
  };

  const handleDeleteBlock = (blockId: string) => {
    commitTemplateChange(tpl => ({
      ...tpl,
      blocks: tpl.blocks.filter(b => b.id !== blockId),
    }));
    if (selectedBlockId === blockId) {
      const remaining = currentTemplate.blocks.filter(b => b.id !== blockId);
      setSelectedBlockId(remaining[0]?.id || '');
    }
  };

  const handleMoveLayer = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= currentTemplate.blocks.length) return;
    commitTemplateChange(tpl => {
      const next = [...tpl.blocks];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return { ...tpl, blocks: next };
    });
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1_500_000) {
      toast({
        variant: 'destructive',
        title: 'Imagen muy pesada',
        description: 'Usa una imagen PNG/JPG menor a 1.5 MB para que imprima rápido.',
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      updateSelectedBlock({ imageUrl: dataUrl });
      toast({ title: 'Imagen cargada', description: 'Recuerda pulsar "Guardar plantilla" para aplicarla.' });
    };
    reader.readAsDataURL(file);
  };

  // Manejo global de mousemove / mouseup para arrastrar y redimensionar
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const st = dragStateRef.current;
      if (!st) return;
      const dxMm = (e.clientX - st.startClientX) / pxPerMm;
      const dyMm = (e.clientY - st.startClientY) / pxPerMm;

      setTemplatesByArea(prevMap => {
        const tpl = prevMap[activeArea];
        const dims = PAPER_DIMENSIONS_MM[tpl.paperSize] || PAPER_DIMENSIONS_MM.letter;
        const nextBlocks = tpl.blocks.map(b => {
          if (b.id !== st.blockId) return b;
          if (st.mode === 'move') {
            const nx = Math.max(0, Math.min(dims.width - b.w, Math.round(st.origX + dxMm)));
            const ny = Math.max(0, Math.min(dims.height - b.h, Math.round(st.origY + dyMm)));
            return { ...b, x: nx, y: ny };
          } else {
            const nw = Math.max(16, Math.min(dims.width - b.x, Math.round(st.origW + dxMm)));
            const nh = Math.max(6, Math.min(dims.height - b.y, Math.round(st.origH + dyMm)));
            return { ...b, w: nw, h: nh };
          }
        });
        return { ...prevMap, [activeArea]: { ...tpl, blocks: nextBlocks } };
      });
    };

    const onMouseUp = () => {
      dragStateRef.current = null;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [activeArea, pxPerMm]);

  const startDrag = (e: React.MouseEvent, block: VisualBlock, mode: 'move' | 'resize') => {
    if (block.locked || isThermal) return;
    e.stopPropagation();
    e.preventDefault();
    setSelectedBlockId(block.id);
    setHistoryPast(past => [...past.slice(-24), currentTemplate]);
    setHistoryFuture([]);
    dragStateRef.current = {
      mode,
      blockId: block.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origX: block.x,
      origY: block.y,
      origW: block.w,
      origH: block.h,
    };
  };

  const handleSaveTemplate = async () => {
    setSaving(true);
    try {
      const enabledTemplate: VisualTemplateConfig = {
        ...currentTemplate,
        enabled: true,
      };
      const updatedMap = {
        ...templatesByArea,
        [activeArea]: enabledTemplate,
      };
      setTemplatesByArea(updatedMap);

      // También sincronizar logo/color en la sección clásica del área para mantener compatibilidad total
      const logoBlock = enabledTemplate.blocks.find(b => b.type === 'logo' && b.imageUrl);
      const nextPrintConfig = {
        ...rawPrintConfig,
        [activeArea]: {
          ...(rawPrintConfig[activeArea] || {}),
          accentColor: enabledTemplate.accentColor,
          ...(logoBlock?.imageUrl ? { logoUrl: logoBlock.imageUrl, showLogo: true } : {}),
        },
        visualTemplates: {
          ...(rawPrintConfig.visualTemplates || {}),
          ...updatedMap,
        },
      };

      const { error } = await supabase.from('system_config').upsert({
        key: 'print_config',
        value: nextPrintConfig,
      });

      if (error) throw error;
      setRawPrintConfig(nextPrintConfig);

      toast({
        title: 'Plantilla guardada ✓',
        description: `El diseño de ${AREA_LABELS[activeArea]} quedó activo para todas las impresiones del sistema.`,
      });
    } catch (err: any) {
      console.error('Error guardando plantilla visual:', err);
      toast({
        variant: 'destructive',
        title: 'Error al guardar plantilla',
        description: err?.message || 'No se pudo guardar en system_config.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleResetTemplate = () => {
    const fresh = getDefaultVisualTemplate(activeArea, branding || undefined);
    commitTemplateChange(() => fresh);
    setSelectedBlockId(fresh.blocks[0]?.id || '');
    toast({
      title: 'Plantilla restablecida',
      description: `Se restauró el diseño base de ${AREA_LABELS[activeArea]}.`,
    });
  };

  const sampleData = useMemo(() => getSampleRenderData(activeArea), [activeArea]);

  const previewHtml = useMemo(() => {
    const bInput = {
      companyName: branding?.companyName || 'TECNICOLOR / ERP NEXWAY',
      razonSocial: branding?.razonSocial,
      slogan: branding?.slogan || 'Soluciones a tu medida',
      nit: branding?.nit || '0614-000000-000-0',
      nrc: branding?.nrc || '000000-0',
      address: branding?.address || 'San Salvador, El Salvador',
      phone: branding?.phone || '(503) 2222-2222',
      email: branding?.email || 'ventas@empresa.com',
      logoUrl: branding?.logoUrl || '',
      accentColor: currentTemplate.accentColor,
      termsConditions: branding?.termsConditions || '',
    };
    return renderVisualTemplateHtml(currentTemplate, sampleData, bInput);
  }, [currentTemplate, sampleData, branding]);

  const handleTestPrint = () => {
    printHtmlDocument(previewHtml, `Prueba ${AREA_LABELS[activeArea]}`);
  };

  // Marcas de regla en mm cada 50mm
  const xRulerMarks = useMemo(() => {
    const marks: number[] = [];
    const step = isThermal ? 20 : 50;
    for (let m = 0; m <= paperDims.width; m += step) marks.push(m);
    return marks;
  }, [paperDims.width, isThermal]);

  const yRulerMarks = useMemo(() => {
    const marks: number[] = [];
    for (let m = 0; m <= paperDims.height; m += 50) marks.push(m);
    return marks;
  }, [paperDims.height]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground gap-2 text-sm">
        <Loader2 className="animate-spin text-blue-600" size={18} />
        Cargando Editor de Documentos...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* BARRA SUPERIOR ESTILO EDITOR DE DOCUMENTOS */}
      <div className="bg-card border border-border rounded-2xl p-3.5 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="pr-3 border-r border-border">
            <h2 className="text-sm font-black text-foreground leading-tight">Editor de Documentos</h2>
            <p className="text-[10px] text-muted-foreground">Diseño en milímetros · Impresión directa</p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground hidden sm:inline">Plantilla actual:</span>
            <Select value={activeArea} onValueChange={v => handleAreaChange(v as VisualDocArea)}>
              <SelectTrigger className="h-9 w-44 rounded-xl text-xs font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="billing" className="text-xs">Factura / DTE</SelectItem>
                <SelectItem value="quotations" className="text-xs">Cotización</SelectItem>
                <SelectItem value="purchases" className="text-xs">Orden de Compra</SelectItem>
                <SelectItem value="quedan" className="text-xs">Quedan / Recibo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Select
            value={currentTemplate.paperSize}
            onValueChange={v => commitTemplateChange(tpl => ({ ...tpl, paperSize: v as VisualPaperSize }))}
          >
            <SelectTrigger className="h-9 w-40 rounded-xl text-xs font-semibold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="letter" className="text-xs">Carta (216 × 279 mm)</SelectItem>
              <SelectItem value="a4" className="text-xs">A4 (210 × 297 mm)</SelectItem>
              <SelectItem value="80mm" className="text-xs">Ticket 80 mm</SelectItem>
              <SelectItem value="58mm" className="text-xs">Ticket 58 mm</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1 border-l border-border pl-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={historyPast.length === 0}
              onClick={handleUndo}
              className="h-8 w-8 rounded-lg"
              title="Deshacer"
            >
              <Undo2 size={15} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={historyFuture.length === 0}
              onClick={handleRedo}
              className="h-8 w-8 rounded-lg"
              title="Rehacer"
            >
              <Redo2 size={15} />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleResetTemplate} className="h-9 rounded-xl text-xs gap-1.5">
            <RotateCcw size={13} /> Restablecer
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setPreviewOpen(true)} className="h-9 rounded-xl text-xs font-semibold gap-1.5">
            <Eye size={14} /> Vista previa
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleTestPrint} className="h-9 rounded-xl text-xs font-semibold gap-1.5">
            <Printer size={14} /> Imprimir prueba
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={saving}
            onClick={handleSaveTemplate}
            className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold gap-1.5 shadow-sm"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Guardar plantilla
          </Button>
        </div>
      </div>

      {/* CUERPO PRINCIPAL DE 3 COLUMNAS */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* COLUMNA IZQUIERDA: BLOQUES DISPONIBLES */}
        <div className="xl:col-span-2 bg-card border border-border rounded-2xl p-3.5 shadow-sm space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground">Bloques disponibles</h3>
          <div className="grid grid-cols-2 xl:grid-cols-1 gap-2">
            {BLOCK_PALETTE.map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => handleAddBlock(item.type)}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-border bg-background hover:bg-blue-50 hover:border-blue-300 dark:hover:bg-blue-950/30 dark:hover:border-blue-800 text-left transition-all text-xs font-semibold text-foreground"
                >
                  <Icon size={15} className="text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-900/60 p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700 dark:text-blue-300">
              <Lightbulb size={14} /> Consejo
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
              {isThermal
                ? 'En ticket térmico los bloques fluyen verticalmente. Reordénalos desde la pestaña Capas.'
                : 'Arrastra los bloques donde quieras en la hoja y ajusta su tamaño desde la esquina inferior derecha.'}
            </p>
          </div>
        </div>

        {/* COLUMNA CENTRAL: HOJA CON REGLAS EN MM */}
        <div className="xl:col-span-7 bg-slate-100/80 dark:bg-slate-900/60 border border-border rounded-2xl p-4 overflow-auto flex flex-col items-center min-h-[680px]">
          <div className="relative" style={{ paddingLeft: 26, paddingTop: 22 }}>
            {/* Regla horizontal (mm) */}
            <div
              className="absolute top-0 left-[26px] h-[20px] border-b border-slate-300 dark:border-slate-700 flex items-end text-[9px] font-mono text-slate-500 select-none"
              style={{ width: paperDims.width * pxPerMm }}
            >
              {xRulerMarks.map(m => (
                <div
                  key={m}
                  className="absolute bottom-0 flex flex-col items-center"
                  style={{ left: m * pxPerMm }}
                >
                  <span className="leading-none mb-0.5">{m}</span>
                  <div className="w-px h-1.5 bg-slate-400" />
                </div>
              ))}
              <span className="absolute right-0 bottom-0.5 text-[8px] font-bold">mm</span>
            </div>

            {/* Regla vertical (mm) */}
            <div
              className="absolute top-[22px] left-0 w-[24px] border-r border-slate-300 dark:border-slate-700 text-[9px] font-mono text-slate-500 select-none"
              style={{ height: paperDims.height * pxPerMm }}
            >
              {yRulerMarks.map(m => (
                <div
                  key={m}
                  className="absolute right-0 flex items-center"
                  style={{ top: m * pxPerMm }}
                >
                  <span className="leading-none mr-0.5">{m}</span>
                  <div className="h-px w-1.5 bg-slate-400" />
                </div>
              ))}
            </div>

            {/* HOJA DE PAPEL */}
            <div
              onClick={() => setSelectedBlockId('')}
              className="relative bg-white text-slate-900 shadow-lg border border-slate-200 overflow-hidden select-none"
              style={{
                width: paperDims.width * pxPerMm,
                height: paperDims.height * pxPerMm,
                backgroundImage:
                  'linear-gradient(to right, rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.08) 1px, transparent 1px)',
                backgroundSize: `${10 * pxPerMm}px ${10 * pxPerMm}px`,
              }}
            >
              {currentTemplate.blocks.map(block => {
                if (block.visible === false) return null;
                const isSelected = block.id === selectedBlock?.id;
                const stylePos: React.CSSProperties = isThermal
                  ? {
                      position: 'relative',
                      width: '92%',
                      margin: '6px auto',
                      minHeight: Math.max(24, block.h * 1.4),
                    }
                  : {
                      position: 'absolute',
                      left: block.x * pxPerMm,
                      top: block.y * pxPerMm,
                      width: block.w * pxPerMm,
                      height: block.h * pxPerMm,
                    };

                return (
                  <div
                    key={block.id}
                    onMouseDown={e => {
                      e.stopPropagation();
                      if (!isThermal) startDrag(e, block, 'move');
                      else setSelectedBlockId(block.id);
                    }}
                    onClick={e => {
                      e.stopPropagation();
                      setSelectedBlockId(block.id);
                    }}
                    style={stylePos}
                    className={`group rounded transition-shadow ${
                      block.locked ? 'cursor-not-allowed' : isThermal ? 'cursor-pointer' : 'cursor-move'
                    } ${
                      isSelected
                        ? 'ring-2 ring-blue-500 ring-offset-1 z-20'
                        : 'hover:ring-1 hover:ring-blue-400/70 border border-dashed border-slate-300/80 z-10'
                    }`}
                  >
                    {/* Barra flotante del bloque seleccionado */}
                    {isSelected && (
                      <div
                        onMouseDown={e => e.stopPropagation()}
                        className="absolute -top-7 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white border border-slate-200 shadow-md rounded-lg px-1.5 py-0.5 z-30"
                      >
                        <span className="p-1 text-slate-500" title="Arrastrar">
                          <Move size={11} />
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDuplicateBlock(block)}
                          className="p-1 hover:bg-slate-100 rounded text-slate-700"
                          title="Duplicar"
                        >
                          <Copy size={11} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBlock(block.id)}
                          className="p-1 hover:bg-rose-50 rounded text-rose-600"
                          title="Eliminar"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    )}

                    {/* Render visual fiel dentro del lienzo */}
                    <CanvasBlockPreview
                      block={block}
                      accent={currentTemplate.accentColor}
                      branding={branding}
                      sampleData={sampleData}
                    />

                    {/* Manejador de redimensionamiento en esquina inferior derecha */}
                    {isSelected && !block.locked && !isThermal && (
                      <div
                        onMouseDown={e => startDrag(e, block, 'resize')}
                        className="absolute -right-1.5 -bottom-1.5 w-3.5 h-3.5 rounded-full bg-blue-600 border-2 border-white shadow cursor-nwse-resize z-30"
                        title="Cambiar tamaño"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: PROPIEDADES Y CAPAS */}
        <div className="xl:col-span-3 bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          <div className="grid grid-cols-2 border-b border-border bg-slate-50/70 dark:bg-slate-900/40">
            <button
              type="button"
              onClick={() => setRightTab('properties')}
              className={`py-2.5 text-xs font-bold border-b-2 transition-colors ${
                rightTab === 'properties'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Propiedades
            </button>
            <button
              type="button"
              onClick={() => setRightTab('layers')}
              className={`py-2.5 text-xs font-bold border-b-2 transition-colors ${
                rightTab === 'layers'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Capas ({currentTemplate.blocks.length})
            </button>
          </div>

          {rightTab === 'properties' ? (
            <div className="p-4 space-y-4 max-h-[680px] overflow-y-auto">
              {!selectedBlock ? (
                <p className="text-xs text-muted-foreground text-center py-8">
                  Haz clic en un bloque de la hoja para editar sus propiedades.
                </p>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="secondary" className="text-[10px] font-bold">
                      {selectedBlock.label}
                    </Badge>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => updateSelectedBlock({ locked: !selectedBlock.locked })}
                      title={selectedBlock.locked ? 'Desbloquear posición' : 'Bloquear posición'}
                    >
                      {selectedBlock.locked ? <Lock size={13} className="text-amber-600" /> : <Unlock size={13} />}
                    </Button>
                  </div>

                  {/* Subir / cambiar imagen si es Logo */}
                  {selectedBlock.type === 'logo' && (
                    <div className="rounded-xl border border-border p-3 bg-background/60 space-y-2">
                      <div className="flex items-center justify-center h-14 bg-slate-50 dark:bg-slate-900 rounded-lg overflow-hidden">
                        {selectedBlock.imageUrl || branding?.logoUrl ? (
                          <img
                            src={selectedBlock.imageUrl || branding?.logoUrl}
                            alt="Logo"
                            className="max-h-12 object-contain"
                          />
                        ) : (
                          <span className="text-[11px] text-muted-foreground">Sin logo cargado</span>
                        )}
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        className="hidden"
                        onChange={handleLogoFileChange}
                      />
                      <div className="flex gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex-1 h-8 text-xs gap-1"
                        >
                          <Upload size={12} /> Cambiar imagen
                        </Button>
                        {selectedBlock.imageUrl && (
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            onClick={() => updateSelectedBlock({ imageUrl: '' })}
                            className="h-8 w-8 text-rose-600"
                          >
                            <Trash2 size={12} />
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Posición y tamaño en mm */}
                  {!isThermal && (
                    <div className="space-y-2">
                      <Label className="text-[11px] font-bold text-foreground">Posición y tamaño (mm)</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[10px] text-muted-foreground">X (mm)</span>
                          <Input
                            type="number"
                            value={selectedBlock.x}
                            disabled={selectedBlock.locked}
                            onChange={e => updateSelectedBlock({ x: Math.max(0, Number(e.target.value) || 0) })}
                            className="h-8 text-xs font-mono"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground">Y (mm)</span>
                          <Input
                            type="number"
                            value={selectedBlock.y}
                            disabled={selectedBlock.locked}
                            onChange={e => updateSelectedBlock({ y: Math.max(0, Number(e.target.value) || 0) })}
                            className="h-8 text-xs font-mono"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground">Ancho (mm)</span>
                          <Input
                            type="number"
                            value={selectedBlock.w}
                            disabled={selectedBlock.locked}
                            onChange={e => updateSelectedBlock({ w: Math.max(12, Number(e.target.value) || 20) })}
                            className="h-8 text-xs font-mono"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground">Alto (mm)</span>
                          <Input
                            type="number"
                            value={selectedBlock.h}
                            disabled={selectedBlock.locked}
                            onChange={e => updateSelectedBlock({ h: Math.max(6, Number(e.target.value) || 10) })}
                            className="h-8 text-xs font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Alineación */}
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-bold text-foreground">Alineación</Label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {(['left', 'center', 'right'] as const).map(al => (
                        <Button
                          key={al}
                          type="button"
                          size="sm"
                          variant={selectedBlock.align === al ? 'default' : 'outline'}
                          onClick={() => updateSelectedBlock({ align: al })}
                          className="h-8 px-0"
                        >
                          {al === 'left' ? <AlignLeft size={13} /> : al === 'center' ? <AlignCenter size={13} /> : <AlignRight size={13} />}
                        </Button>
                      ))}
                      <Button
                        type="button"
                        size="sm"
                        variant={selectedBlock.bold ? 'default' : 'outline'}
                        onClick={() => updateSelectedBlock({ bold: !selectedBlock.bold })}
                        className="h-8 px-0"
                        title="Negrita"
                      >
                        <Bold size={13} />
                      </Button>
                    </div>
                  </div>

                  {/* Estilo */}
                  <div className="space-y-2.5">
                    <Label className="text-[11px] font-bold text-foreground">Estilo</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] text-muted-foreground">Color texto</span>
                        <input
                          type="color"
                          value={selectedBlock.color || '#0f172a'}
                          onChange={e => updateSelectedBlock({ color: e.target.value })}
                          className="w-full h-8 rounded-lg border border-border cursor-pointer bg-transparent p-0.5"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground">Color acento</span>
                        <input
                          type="color"
                          value={selectedBlock.bgColor || currentTemplate.accentColor || '#172554'}
                          onChange={e => {
                            const nextColor = e.target.value;
                            updateSelectedBlock({ bgColor: nextColor });
                            if (selectedBlock.type === 'title_banner' || selectedBlock.type === 'items_table') {
                              commitTemplateChange(tpl => ({ ...tpl, accentColor: nextColor }), false);
                            }
                          }}
                          className="w-full h-8 rounded-lg border border-border cursor-pointer bg-transparent p-0.5"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] text-muted-foreground">Tamaño (px)</span>
                        <Input
                          type="number"
                          min={7}
                          max={36}
                          value={selectedBlock.fontSize || 11}
                          onChange={e => updateSelectedBlock({ fontSize: Number(e.target.value) || 11 })}
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground">Tipo de letra</span>
                        <Select
                          value={selectedBlock.fontFamily || 'Inter'}
                          onValueChange={v => updateSelectedBlock({ fontFamily: v as any })}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Montserrat" className="text-xs">Montserrat</SelectItem>
                            <SelectItem value="Inter" className="text-xs">Inter</SelectItem>
                            <SelectItem value="Roboto" className="text-xs">Roboto</SelectItem>
                            <SelectItem value="Courier New" className="text-xs">Courier Mono</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Contenido / Variables */}
                  {!['items_table', 'totals', 'divider'].includes(selectedBlock.type) && (
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold text-foreground">Contenido</Label>
                      <Textarea
                        rows={3}
                        value={selectedBlock.content || ''}
                        onChange={e => updateSelectedBlock({ content: e.target.value })}
                        className="text-xs font-mono"
                      />
                      {(selectedBlock.type === 'logo' || selectedBlock.type === 'title_banner') && (
                        <Input
                          value={selectedBlock.subContent || ''}
                          onChange={e => updateSelectedBlock({ subContent: e.target.value })}
                          placeholder="Subtítulo (ej. No. {{numero}})"
                          className="h-8 text-xs"
                        />
                      )}
                      <div className="flex flex-wrap gap-1 pt-1">
                        {QUICK_VARS.map(v => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => updateSelectedBlock({ content: `${selectedBlock.content || ''}${selectedBlock.content ? ' ' : ''}${v}` })}
                            className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 hover:bg-blue-100 dark:bg-slate-800 dark:hover:bg-blue-950 text-slate-700 dark:text-slate-300"
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Avanzado */}
                  <div className="space-y-2.5 pt-2 border-t border-border">
                    <Label className="text-[11px] font-bold text-foreground">Avanzado</Label>
                    <div>
                      <span className="text-[10px] text-muted-foreground">Condición de visibilidad</span>
                      <Select
                        value={selectedBlock.visibilityRule || 'always'}
                        onValueChange={v => updateSelectedBlock({ visibilityRule: v as VisibilityRule })}
                      >
                        <SelectTrigger className="h-8 text-xs mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="always" className="text-xs">Siempre visible</SelectItem>
                          <SelectItem value="credit_only" className="text-xs">Solo ventas al crédito</SelectItem>
                          <SelectItem value="ccf_only" className="text-xs">Solo Crédito Fiscal (CCF)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {!isThermal && (
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <span className="text-[11px] text-muted-foreground">
                          Anclar totales debajo de la tabla
                        </span>
                        <Switch
                          checked={currentTemplate.anchorTotalsBelowTable !== false}
                          onCheckedChange={checked =>
                            commitTemplateChange(tpl => ({ ...tpl, anchorTotalsBelowTable: checked }))
                          }
                        />
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            /* PESTAÑA CAPAS */
            <div className="p-3 space-y-1.5 max-h-[680px] overflow-y-auto">
              {currentTemplate.blocks.map((block, idx) => {
                const isSel = block.id === selectedBlock?.id;
                return (
                  <div
                    key={block.id}
                    onClick={() => setSelectedBlockId(block.id)}
                    className={`flex items-center justify-between gap-1.5 px-2.5 py-2 rounded-xl border text-xs cursor-pointer transition-colors ${
                      isSel
                        ? 'bg-blue-50/80 border-blue-300 dark:bg-blue-950/40 dark:border-blue-800 font-bold'
                        : 'bg-background border-border/60 hover:bg-slate-50 dark:hover:bg-slate-900/40'
                    }`}
                  >
                    <span className={`truncate ${block.visible === false ? 'line-through opacity-50' : ''}`}>
                      {block.label}
                    </span>
                    <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleMoveLayer(idx, -1)}
                        className="p-1 hover:bg-slate-200/70 dark:hover:bg-slate-800 rounded"
                        title="Subir"
                      >
                        <ArrowUp size={11} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveLayer(idx, 1)}
                        className="p-1 hover:bg-slate-200/70 dark:hover:bg-slate-800 rounded"
                        title="Bajar"
                      >
                        <ArrowDown size={11} />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          commitTemplateChange(tpl => ({
                            ...tpl,
                            blocks: tpl.blocks.map(b =>
                              b.id === block.id ? { ...b, visible: b.visible === false ? true : false } : b
                            ),
                          }))
                        }
                        className="p-1 hover:bg-slate-200/70 dark:hover:bg-slate-800 rounded"
                        title="Mostrar / Ocultar"
                      >
                        {block.visible === false ? <EyeOff size={11} /> : <Eye size={11} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteBlock(block.id)}
                        className="p-1 hover:bg-rose-100 dark:hover:bg-rose-950/60 text-rose-600 rounded"
                        title="Eliminar"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* MODAL VISTA PREVIA */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden rounded-2xl">
          <DialogHeader className="px-5 py-3.5 border-b border-border flex flex-row items-center justify-between">
            <div>
              <DialogTitle className="text-sm font-black">Vista previa · {AREA_LABELS[activeArea]}</DialogTitle>
              <DialogDescription className="text-xs">
                Formato {paperDims.label} listo para impresión o guardar como PDF.
              </DialogDescription>
            </div>
            <Button type="button" size="sm" onClick={handleTestPrint} className="rounded-xl h-8 text-xs font-bold gap-1.5 mr-6">
              <Printer size={13} /> Imprimir ahora
            </Button>
          </DialogHeader>
          <div className="bg-slate-200 dark:bg-slate-900 p-4 flex justify-center max-h-[75vh] overflow-auto">
            <iframe
              title="Vista previa documento"
              srcDoc={previewHtml}
              className="bg-white shadow-xl border border-slate-300 rounded"
              style={{
                width: isThermal ? 340 : 790,
                height: isThermal ? 560 : 980,
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* Subcomponente ligero para renderizar cada bloque dentro del lienzo interactivo */
function CanvasBlockPreview({
  block,
  accent,
  branding,
  sampleData,
}: {
  block: VisualBlock;
  accent: string;
  branding: PrintBranding | null;
  sampleData: ReturnType<typeof getSampleRenderData>;
}) {
  const resolveText = (txt?: string) => {
    if (!txt) return '';
    return txt
      .replace(/\{\{empresa\}\}/g, branding?.companyName || 'Tu Empresa')
      .replace(/\{\{slogan\}\}/g, branding?.slogan || 'Soluciones a tu medida')
      .replace(/\{\{direccion\}\}/g, branding?.address || 'San Salvador, El Salvador')
      .replace(/\{\{telefono\}\}/g, branding?.phone || '(503) 2222-2222')
      .replace(/\{\{correo\}\}/g, branding?.email || 'ventas@empresa.com')
      .replace(/\{\{nit\}\}/g, branding?.nit || '0614-000000-000-0')
      .replace(/\{\{numero\}\}/g, sampleData.docNumber)
      .replace(/\{\{fecha\}\}/g, sampleData.dateStr)
      .replace(/\{\{cliente\}\}/g, sampleData.customerName)
      .replace(/\{\{forma_pago\}\}/g, sampleData.paymentMethod || 'Contado')
      .replace(/\{\{observaciones\}\}/g, sampleData.observations || '');
  };

  const scaleFont = Math.max(7, Math.round((block.fontSize || 11) * 0.72));
  const alignClass = block.align === 'center' ? 'text-center' : block.align === 'right' ? 'text-right' : 'text-left';

  if (block.type === 'logo') {
    const src = block.imageUrl || branding?.logoUrl;
    return (
      <div className="w-full h-full flex items-center gap-2 px-1 overflow-hidden">
        {src ? (
          <img src={src} alt="Logo" className="max-h-full max-w-[38%] object-contain" />
        ) : (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-xs shrink-0"
            style={{ background: block.color || accent }}
          >
            LOGO
          </div>
        )}
        <div className={`min-w-0 flex-1 ${alignClass}`}>
          <div
            className="font-extrabold truncate leading-tight"
            style={{ color: block.color || accent, fontSize: scaleFont + 2 }}
          >
            {resolveText(block.content || '{{empresa}}')}
          </div>
          <div className="text-[8px] text-slate-500 truncate">{resolveText(block.subContent || '{{slogan}}')}</div>
        </div>
      </div>
    );
  }

  if (block.type === 'title_banner') {
    return (
      <div
        className={`w-full h-full rounded-md px-2.5 py-1.5 flex flex-col justify-center ${alignClass}`}
        style={{ background: block.bgColor || accent, color: block.color || '#fff' }}
      >
        <div className="font-black tracking-wide leading-tight" style={{ fontSize: scaleFont + 2 }}>
          {resolveText(block.content)}
        </div>
        {block.subContent && (
          <div className="opacity-90 font-semibold" style={{ fontSize: Math.max(7, scaleFont - 3) }}>
            {resolveText(block.subContent)}
          </div>
        )}
      </div>
    );
  }

  if (block.type === 'items_table') {
    return (
      <div className="w-full h-full overflow-hidden rounded border border-slate-200 bg-white">
        <div
          className="grid grid-cols-12 text-white font-bold px-1.5 py-1"
          style={{ background: block.bgColor || accent, fontSize: Math.max(7, scaleFont) }}
        >
          <span className="col-span-2 text-center">Cant.</span>
          <span className="col-span-5">Descripción</span>
          <span className="col-span-2 text-right">P. Unit.</span>
          <span className="col-span-3 text-right">Total</span>
        </div>
        {sampleData.items.map((it, idx) => (
          <div
            key={idx}
            className="grid grid-cols-12 px-1.5 py-1 border-b border-slate-100 text-slate-700"
            style={{ fontSize: Math.max(6.5, scaleFont - 0.5) }}
          >
            <span className="col-span-2 text-center">{it.qty}</span>
            <span className="col-span-5 truncate">{it.description}</span>
            <span className="col-span-2 text-right font-mono">${it.unitPrice.toFixed(2)}</span>
            <span className="col-span-3 text-right font-mono font-bold">${it.total.toFixed(2)}</span>
          </div>
        ))}
      </div>
    );
  }

  if (block.type === 'totals') {
    return (
      <div className="w-full h-full rounded border border-slate-200 overflow-hidden flex flex-col justify-between bg-white text-[8px]">
        <div className="px-2 py-0.5 flex justify-between border-b border-slate-100">
          <span>Subtotal:</span>
          <span className="font-mono font-bold">${sampleData.subtotal.toFixed(2)}</span>
        </div>
        <div className="px-2 py-0.5 flex justify-between border-b border-slate-100">
          <span>IVA (13%):</span>
          <span className="font-mono font-bold">${sampleData.iva.toFixed(2)}</span>
        </div>
        <div
          className="px-2 py-1 flex justify-between text-white font-black text-[9px]"
          style={{ background: block.bgColor || accent }}
        >
          <span>TOTAL:</span>
          <span className="font-mono">${sampleData.total.toFixed(2)}</span>
        </div>
      </div>
    );
  }

  if (block.type === 'qr') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center border border-slate-200 rounded bg-slate-50 p-1">
        <QrCode size={36} className="text-slate-800" />
        <span className="text-[6px] text-slate-500 mt-0.5">QR DTE MH</span>
      </div>
    );
  }

  if (block.type === 'signature') {
    return (
      <div className={`w-full h-full flex flex-col justify-end px-1 ${alignClass}`}>
        <div className="border-t border-slate-700 pt-0.5 font-semibold" style={{ fontSize: scaleFont, color: block.color }}>
          {resolveText(block.content || 'Firma Autorizada')}
        </div>
      </div>
    );
  }

  if (block.type === 'divider') {
    return (
      <div className="w-full h-full flex items-center">
        <div className="w-full border-t-2" style={{ borderColor: block.color || '#cbd5e1' }} />
      </div>
    );
  }

  return (
    <div
      className={`w-full h-full px-1.5 py-1 whitespace-pre-wrap overflow-hidden leading-snug rounded ${alignClass}`}
      style={{
        color: block.color || '#0f172a',
        background: block.bgColor || 'transparent',
        fontSize: scaleFont,
        fontWeight: block.bold ? 700 : 400,
      }}
    >
      {resolveText(block.content)}
    </div>
  );
}
