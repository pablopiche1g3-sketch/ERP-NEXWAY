'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Printer, 
  Code, 
  Eye, 
  Plus, 
  Save, 
  Trash2, 
  Sparkles, 
  Copy, 
  Loader2, 
  FileText, 
  Check, 
  RefreshCw,
  Monitor
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const DYNAMIC_VARIABLES = [
  { group: 'Datos Fiscales DTE', vars: ['{{dte.codigo_generacion}}', '{{dte.sello_recepcion}}', '{{dte.qr_code}}'] },
  { group: 'Datos del Cliente', vars: ['{{cliente.razon_social}}', '{{cliente.nit}}', '{{cliente.nrc}}'] },
  { group: 'Detalles de Venta / Productos', vars: ['{{tabla_productos}}', '{{subtotal}}', '{{iva_13}}', '{{total}}'] },
  { group: 'Empresa y Fecha', vars: ['{{empresa.nombre}}', '{{empresa.nrc}}', '{{fecha}}'] },
];

const DEFAULT_TICKET_80MM = `<div style="width: 280px; font-family: 'Courier New', monospace; font-size: 12px; color: #000; padding: 10px; background: #fff;">
  <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 8px; margin-bottom: 8px;">
    <h2 style="margin: 0; font-size: 16px; font-weight: bold;">{{empresa.nombre}}</h2>
    <p style="margin: 2px 0;">NRC: {{empresa.nrc}}</p>
    <p style="margin: 2px 0; font-size: 10px; font-weight: bold;">TICKET DE VENTA DIRECTA</p>
    <p style="margin: 2px 0; font-size: 10px;">Fecha: {{fecha}}</p>
  </div>

  <div style="margin-bottom: 8px; font-size: 11px;">
    <p style="margin: 2px 0;"><strong>Cliente:</strong> {{cliente.razon_social}}</p>
    <p style="margin: 2px 0;"><strong>NIT/DUI:</strong> {{cliente.nit}}</p>
    <p style="margin: 2px 0;"><strong>DTE:</strong> {{dte.codigo_generacion}}</p>
  </div>

  <div style="margin-bottom: 8px;">
    {{tabla_productos}}
  </div>

  <div style="border-top: 1px solid #000; padding-top: 6px; text-align: right; font-size: 12px;">
    <p style="margin: 2px 0;">Subtotal: <strong>{{subtotal}}</strong></p>
    <p style="margin: 2px 0;">IVA (13%): <strong>{{iva_13}}</strong></p>
    <p style="margin: 4px 0; font-size: 14px; font-weight: bold;">TOTAL: {{total}}</p>
  </div>

  <div style="text-align: center; margin-top: 12px; border-top: 1px dashed #000; padding-top: 8px; font-size: 9px;">
    <p style="margin: 2px 0;">Sello MH: {{dte.sello_recepcion}}</p>
    <p style="margin: 4px 0; font-weight: bold;">¡Gracias por su compra en NexWay!</p>
  </div>
</div>`;

const DEFAULT_CREDITO_FISCAL_A4 = `<div style="width: 700px; font-family: Arial, sans-serif; font-size: 13px; color: #333; padding: 20px; background: #fff; border: 1px solid #ddd; margin: auto;">
  <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #2563eb; padding-bottom: 12px;">
    <div>
      <h1 style="margin: 0; color: #1e40af; font-size: 20px;">{{empresa.nombre}}</h1>
      <p style="margin: 4px 0; color: #666; font-size: 11px;">Comprobante de Crédito Fiscal Electrónico (DTE)</p>
      <p style="margin: 2px 0; font-size: 11px;">NRC: {{empresa.nrc}}</p>
    </div>
    <div style="text-align: right; font-size: 11px;">
      <p style="margin: 2px 0;"><strong>Fecha Emisión:</strong> {{fecha}}</p>
      <p style="margin: 2px 0; color: #2563eb; font-weight: bold;">{{dte.codigo_generacion}}</p>
    </div>
  </div>

  <div style="margin: 16px 0; background: #f8fafc; padding: 12px; border-radius: 6px; font-size: 12px;">
    <h4 style="margin: 0 0 8px 0; color: #1e293b; text-transform: uppercase;">Datos del Receptor / Cliente</h4>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
      <p style="margin: 0;"><strong>Razón Social:</strong> {{cliente.razon_social}}</p>
      <p style="margin: 0;"><strong>NIT:</strong> {{cliente.nit}}</p>
      <p style="margin: 0;"><strong>NRC:</strong> {{cliente.nrc}}</p>
      <p style="margin: 0;"><strong>Sello Recepción MH:</strong> {{dte.sello_recepcion}}</p>
    </div>
  </div>

  <div style="margin-bottom: 16px;">
    {{tabla_productos}}
  </div>

  <div style="display: flex; justify-content: flex-end;">
    <div style="width: 250px; background: #f1f5f9; padding: 12px; border-radius: 6px; text-align: right;">
      <p style="margin: 4px 0;">Subtotal Gravado: <strong>{{subtotal}}</strong></p>
      <p style="margin: 4px 0;">IVA (13%): <strong>{{iva_13}}</strong></p>
      <hr style="border: 0; border-top: 1px solid #cbd5e1; margin: 8px 0;">
      <p style="margin: 4px 0; font-size: 16px; color: #0f172a; font-weight: bold;">TOTAL A PAGAR: {{total}}</p>
    </div>
  </div>
</div>`;

export default function PrintDesignerTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  // Form states
  const [nombre, setNombre] = useState('Nuevo Ticket 80mm');
  const [moduloOrigen, setModuloOrigen] = useState('POS');
  const [htmlTemplate, setHtmlTemplate] = useState(DEFAULT_TICKET_80MM);
  
  const [isSaving, setIsSaving] = useState(false);
  const [activeView, setActiveView] = useState<'editor' | 'preview'>('editor');
  const [renderedPreviewHtml, setRenderedPreviewHtml] = useState<string>('');
  const [renderingPreview, setRenderingPreview] = useState(false);
  const [copiedVar, setCopiedVar] = useState<string | null>(null);

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
        setHtmlTemplate(first.html_template);
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
      setNombre('Ticket Térmico POS 80mm');
      setModuloOrigen('POS');
      setHtmlTemplate(DEFAULT_TICKET_80MM);
      return;
    }
    if (id === 'new_cf') {
      setSelectedTemplateId('');
      setNombre('Crédito Fiscal Electrónico A4');
      setModuloOrigen('POS');
      setHtmlTemplate(DEFAULT_CREDITO_FISCAL_A4);
      return;
    }

    const found = templates.find(t => t.id === id);
    if (found) {
      setSelectedTemplateId(found.id);
      setNombre(found.nombre);
      setModuloOrigen(found.modulo_origen);
      setHtmlTemplate(found.html_template);
    }
  };

  const handleSaveTemplate = async () => {
    if (!nombre.trim() || !htmlTemplate.trim()) {
      toast({ variant: 'destructive', title: 'Campos requeridos', description: 'El nombre y el HTML no pueden estar vacíos.' });
      return;
    }

    setIsSaving(true);
    try {
      if (selectedTemplateId) {
        // Actualizar existente
        const { error } = await supabase
          .from('plantillas_impresion')
          .update({
            nombre,
            modulo_origen: moduloOrigen,
            html_template: htmlTemplate
          })
          .eq('id', selectedTemplateId);

        if (error) throw error;
        toast({ title: 'Plantilla Actualizada', description: `Se guardaron los cambios en ${nombre}.` });
      } else {
        // Crear nueva
        const { data, error } = await supabase
          .from('plantillas_impresion')
          .insert({
            nombre,
            modulo_origen: moduloOrigen,
            html_template: htmlTemplate
          })
          .select()
          .single();

        if (error) throw error;
        toast({ title: 'Plantilla Creada', description: `Se registró la plantilla ${nombre}.` });
        setSelectedTemplateId(data.id);
      }
      await loadTemplates();
    } catch (e: any) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error al Guardar', description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!selectedTemplateId) return;
    if (!confirm('¿Seguro que deseas eliminar esta plantilla de impresión?')) return;

    try {
      const { error } = await supabase.from('plantillas_impresion').delete().eq('id', selectedTemplateId);
      if (error) throw error;
      toast({ title: 'Plantilla Eliminada' });
      setSelectedTemplateId('');
      setNombre('Ticket 80mm POS');
      setHtmlTemplate(DEFAULT_TICKET_80MM);
      await loadTemplates();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  };

  const handleRenderPreview = async () => {
    setRenderingPreview(true);
    try {
      const res = await fetch('/api/print-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          htmlContent: htmlTemplate
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setRenderedPreviewHtml(data.renderedHtml);
      setActiveView('preview');
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error en Render', description: e.message });
    } finally {
      setRenderingPreview(false);
    }
  };

  const handleInsertVariable = (variable: string) => {
    setHtmlTemplate(prev => prev + ' ' + variable);
    navigator.clipboard.writeText(variable);
    setCopiedVar(variable);
    setTimeout(() => setCopiedVar(null), 2000);
    toast({ title: 'Variable Copiada e Insertada', description: variable });
  };

  const handleDirectPrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Impresión NexWay</title>
          <style>
            @media print {
              body { margin: 0; padding: 0; }
            }
          </style>
        </head>
        <body>
          ${renderedPreviewHtml || htmlTemplate}
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Card className="border shadow-md rounded-2xl bg-card overflow-hidden">
        <CardHeader className="bg-slate-900 text-white p-6 dark:bg-slate-950 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-black uppercase tracking-tight">
              <Printer className="text-blue-400" size={20} />
              Diseñador de Impresión Modular (HTML/CSS to PDF)
            </CardTitle>
            <CardDescription className="text-slate-400 text-xs">
              Diseña y personaliza tickets de caja (80mm/58mm), Crédito Fiscal A4 y Cotizaciones inyectando variables dinámicas.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <Select value={selectedTemplateId || 'preset'} onValueChange={handleSelectTemplate}>
              <SelectTrigger className="w-56 h-10 text-xs bg-slate-800 border-0 text-white rounded-xl">
                <SelectValue placeholder="Cargar plantilla..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new_ticket" className="text-xs font-bold text-emerald-500">+ Preset Ticket 80mm</SelectItem>
                <SelectItem value="new_cf" className="text-xs font-bold text-blue-500">+ Preset Crédito Fiscal A4</SelectItem>
                {templates.map(t => (
                  <SelectItem key={t.id} value={t.id} className="text-xs">{t.nombre} ({t.modulo_origen})</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button onClick={handleSaveTemplate} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 font-bold text-xs h-10 rounded-xl">
              {isSaving ? <Loader2 className="animate-spin mr-1.5" size={16} /> : <Save size={15} className="mr-1.5" />}
              GUARDAR
            </Button>

            {selectedTemplateId && (
              <Button variant="ghost" onClick={handleDeleteTemplate} className="h-10 w-10 text-rose-400 hover:bg-rose-500/10 rounded-xl" title="Eliminar Plantilla">
                <Trash2 size={16} />
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Form Config Bar */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 dark:bg-white/5 p-4 rounded-xl border border-slate-200 dark:border-white/10">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase">Nombre de la Plantilla</Label>
              <Input
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Ej. Ticket 80mm POS Estándar"
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
          </div>

          {/* Variables Inyectables (Paleta Interactiva) */}
          <div className="space-y-2">
            <Label className="text-xs font-black uppercase text-slate-500 flex items-center gap-1.5">
              <Sparkles size={14} className="text-amber-400" />
              Paleta de Variables Dinámicas (Haz clic para copiar e insertar):
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {DYNAMIC_VARIABLES.map((grp, idx) => (
                <div key={idx} className="p-3 bg-slate-100 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-500 block">{grp.group}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {grp.vars.map(v => (
                      <button
                        key={v}
                        onClick={() => handleInsertVariable(v)}
                        className="text-[11px] font-mono bg-white dark:bg-black/30 border border-slate-300 dark:border-white/20 hover:border-indigo-400 hover:text-indigo-400 px-2 py-1 rounded-md transition-all shadow-sm flex items-center gap-1"
                        title="Haz clic para copiar e inyectar al HTML"
                      >
                        {copiedVar === v ? <Check size={12} className="text-emerald-500" /> : <Copy size={11} />}
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Switcher de Vista: Código vs Live Preview */}
          <div className="flex justify-between items-center border-b border-slate-200 dark:border-white/10 pb-3">
            <div className="flex gap-2">
              <Button
                variant={activeView === 'editor' ? 'default' : 'outline'}
                onClick={() => setActiveView('editor')}
                className={`h-9 text-xs font-bold rounded-xl ${activeView === 'editor' ? 'bg-indigo-600 text-white' : ''}`}
              >
                <Code size={14} className="mr-1.5" /> Editor HTML/CSS
              </Button>
              <Button
                variant={activeView === 'preview' ? 'default' : 'outline'}
                onClick={handleRenderPreview}
                disabled={renderingPreview}
                className={`h-9 text-xs font-bold rounded-xl ${activeView === 'preview' ? 'bg-emerald-600 text-white' : ''}`}
              >
                {renderingPreview ? <Loader2 className="animate-spin mr-1.5" size={14} /> : <Eye size={14} className="mr-1.5" />}
                Vista Previa en Vivo (Live Render)
              </Button>
            </div>

            {activeView === 'preview' && (
              <Button onClick={handleDirectPrint} className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold h-9 rounded-xl">
                <Printer size={14} className="mr-1.5" /> Probar Impresión Directa / PDF
              </Button>
            )}
          </div>

          {/* ÁREA DE EDITOR CÓDIGO HTML/CSS */}
          {activeView === 'editor' ? (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-mono text-slate-400">
                <span>Plantilla Código Fuente (HTML5 + CSS Inline)</span>
                <span>Soporta tickets 80mm/58mm y hojas A4</span>
              </div>
              <textarea
                value={htmlTemplate}
                onChange={e => setHtmlTemplate(e.target.value)}
                rows={18}
                className="w-full font-mono text-xs p-4 bg-slate-950 text-emerald-400 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
                placeholder="Escribe aquí el código HTML/CSS de tu plantilla..."
              />
            </div>
          ) : (
            /* ÁREA DE VISTA PREVIA SIMULADA */
            <div className="p-8 bg-slate-950 border border-slate-800 rounded-2xl flex justify-center min-h-[500px] overflow-auto">
              <div className="bg-white text-black p-4 shadow-2xl rounded-lg max-w-full">
                <div dangerouslySetInnerHTML={{ __html: renderedPreviewHtml || htmlTemplate }} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
