'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ArrowLeft,
  Cloud,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileCode2,
  FileImage,
  FileJson,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  HardDrive,
  Link2,
  Loader2,
  Printer,
  Search,
  Server,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload
} from 'lucide-react';
import { supabase } from '@/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ModeToggle } from '@/components/mode-toggle';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useUser } from '@/supabase/use-user';
import { useRouter } from 'next/navigation';
import {
  CLOUD_PROVIDER_META,
  CloudStorageConfig,
  DEFAULT_CLOUD_STORAGE_CONFIG,
  loadCloudStorageConfig,
  parseDteJsonDocument,
  ParsedDteSummary
} from '@/lib/cloud-storage-config';

type VaultCategory =
  | 'dte_json'
  | 'contratos'
  | 'fichas_tecnicas'
  | 'permisos'
  | 'compras'
  | 'otros';

interface VaultDocument {
  id: string;
  name: string;
  category: VaultCategory;
  fileType: 'dte_json' | 'json' | 'pdf' | 'image' | 'cloud_link' | 'office' | 'other';
  mimeType: string;
  sizeBytes: number;
  content?: string; // JSON string or data URL for PDF/image
  externalUrl?: string;
  cloudProvider?: string;
  notes?: string;
  dteMeta?: {
    tipoDte?: string;
    numeroControl?: string;
    codigoGeneracion?: string;
    fecEmi?: string;
    emisor?: string;
    receptor?: string;
    totalPagar?: number;
  };
  created_at: string;
}

const VAULT_CATEGORIES: Array<{ id: 'todos' | VaultCategory; label: string }> = [
  { id: 'todos', label: 'Todos' },
  { id: 'dte_json', label: 'DTE / Hacienda (JSON)' },
  { id: 'contratos', label: 'Contratos y Crédito' },
  { id: 'fichas_tecnicas', label: 'Fichas Técnicas / MSDS' },
  { id: 'permisos', label: 'Permisos, NIT y Licencias' },
  { id: 'compras', label: 'Respaldos de Compras' },
  { id: 'otros', label: 'Otros' }
];

const MAX_INLINE_FILE_BYTES = 4 * 1024 * 1024; // 4 MB

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return 'Enlace nube';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getCategoryLabel(cat: VaultCategory): string {
  return VAULT_CATEGORIES.find((c) => c.id === cat)?.label || 'Otros';
}

function printDteSummaryHtml(dte: ParsedDteSummary, fileName: string) {
  const rowsHtml = dte.items
    .map(
      (it) => `
      <tr>
        <td style="text-align:center;">${it.numItem}</td>
        <td style="font-family:monospace;">${it.codigo || '-'}</td>
        <td>${it.descripcion}</td>
        <td style="text-align:right;">${it.cantidad}</td>
        <td style="text-align:right;">$${it.precioUni.toFixed(2)}</td>
        <td style="text-align:right;font-weight:bold;">$${(it.ventaGravada || it.ventaExenta || it.ventaNoSuj).toFixed(2)}</td>
      </tr>`
    )
    .join('');

  const html = `<!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>${dte.numeroControl || fileName}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #0f172a; margin: 24px; font-size: 12px; }
      .header { display: flex; justify-content: space-between; border-bottom: 2px solid #1e293b; padding-bottom: 12px; margin-bottom: 16px; }
      .badge { display: inline-block; background: #e0e7ff; color: #3730a3; padding: 3px 8px; border-radius: 6px; font-weight: bold; font-size: 11px; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
      .box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; }
      .box h4 { margin: 0 0 6px 0; font-size: 11px; text-transform: uppercase; color: #475569; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
      th, td { border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 11px; }
      th { background: #f1f5f9; text-align: left; }
      .totals { width: 280px; margin-left: auto; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; }
      .totals-row { display: flex; justify-content: space-between; padding: 3px 0; }
      .totals-grand { border-top: 2px solid #0f172a; margin-top: 6px; padding-top: 6px; font-size: 14px; font-weight: bold; }
      @media print { body { margin: 12px; } }
    </style>
  </head>
  <body>
    <div class="header">
      <div>
        <div class="badge">${dte.tipoDteLabel}</div>
        <h2 style="margin:6px 0 2px 0;">${dte.emisor.nombre || 'Emisor DTE'}</h2>
        <div>NIT: ${dte.emisor.nit || '-'} | NRC: ${dte.emisor.nrc || '-'}</div>
        <div>Giro: ${dte.emisor.codActividad ? `[${dte.emisor.codActividad}] ` : ''}${dte.emisor.descActividad || '-'}</div>
      </div>
      <div style="text-align:right;font-family:monospace;font-size:11px;">
        <div><strong>No. Control:</strong> ${dte.numeroControl || '-'}</div>
        <div><strong>Cód. Generación:</strong> ${dte.codigoGeneracion || '-'}</div>
        <div><strong>Fecha:</strong> ${dte.fecEmi} ${dte.horEmi}</div>
        ${dte.selloRecepcion ? `<div><strong>Sello MH:</strong> ${dte.selloRecepcion}</div>` : ''}
      </div>
    </div>
    <div class="grid">
      <div class="box">
        <h4>Emisor</h4>
        <div><strong>${dte.emisor.nombre}</strong></div>
        <div>${dte.emisor.direccion || ''}</div>
        <div>Tel: ${dte.emisor.telefono || '-'} | ${dte.emisor.correo || '-'}</div>
      </div>
      <div class="box">
        <h4>Receptor</h4>
        <div><strong>${dte.receptor.nombre}</strong></div>
        <div>Doc/NIT: ${dte.receptor.numDocumento || dte.receptor.nit || '-'} | NRC: ${dte.receptor.nrc || '-'}</div>
        <div>Giro: ${dte.receptor.codActividad ? `[${dte.receptor.codActividad}] ` : ''}${dte.receptor.descActividad || '-'}</div>
        <div>${dte.receptor.direccion || ''}</div>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width:36px;text-align:center;">#</th>
          <th style="width:90px;">Código</th>
          <th>Descripción</th>
          <th style="width:65px;text-align:right;">Cant.</th>
          <th style="width:85px;text-align:right;">Precio Unit.</th>
          <th style="width:90px;text-align:right;">Subtotal</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <div class="totals">
      <div class="totals-row"><span>Ventas Gravadas:</span><span>$${dte.resumen.totalGravada.toFixed(2)}</span></div>
      ${dte.resumen.totalExenta > 0 ? `<div class="totals-row"><span>Ventas Exentas:</span><span>$${dte.resumen.totalExenta.toFixed(2)}</span></div>` : ''}
      <div class="totals-row"><span>IVA (13%):</span><span>$${dte.resumen.totalIva.toFixed(2)}</span></div>
      ${dte.resumen.ivaRete1 > 0 ? `<div class="totals-row"><span>Retención 1% IVA:</span><span>-$${dte.resumen.ivaRete1.toFixed(2)}</span></div>` : ''}
      <div class="totals-row totals-grand"><span>TOTAL A PAGAR:</span><span>$${dte.resumen.totalPagar.toFixed(2)}</span></div>
    </div>
    ${dte.resumen.totalLetras ? `<p style="margin-top:12px;"><strong>Total en letras:</strong> ${dte.resumen.totalLetras}</p>` : ''}
    <script>window.onload = function(){ window.print(); };</script>
  </body>
  </html>`;

  const w = window.open('', '_blank', 'width=960,height=780');
  if (w) {
    w.document.open();
    w.document.write(html);
    w.document.close();
  }
}

export default function DocumentsTab() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useUser();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [documents, setDocuments] = useState<VaultDocument[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<'todos' | VaultCategory>('todos');
  const [uploadCategory, setUploadCategory] = useState<VaultCategory>('dte_json');
  const [cloudConfig, setCloudConfig] = useState<CloudStorageConfig>(DEFAULT_CLOUD_STORAGE_CONFIG);

  // Modal de vista previa / visor DTE JSON
  const [previewDoc, setPreviewDoc] = useState<VaultDocument | null>(null);
  const [generatingPythonPdf, setGeneratingPythonPdf] = useState(false);

  // Modal para vincular archivo de nube externa (Drive / OneDrive / Dropbox)
  const [isCloudLinkOpen, setIsCloudLinkOpen] = useState(false);
  const [cloudLinkForm, setCloudLinkForm] = useState({
    name: '',
    url: '',
    category: 'contratos' as VaultCategory,
    notes: ''
  });

  const getEmpresaId = (): string | null => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem('empresa_id') || window.localStorage.getItem('nexway_tenant');
    }
    return null;
  };

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const empresaId = getEmpresaId();
      let query = supabase
        .from('modulos_personalizados')
        .select('*')
        .is('producto_id', null);

      if (empresaId) {
        query = query.eq('empresa_id', empresaId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) {
        if (error.message?.includes('JWT expired')) {
          setDocuments([]);
          return;
        }
        throw error;
      }

      const mapped: VaultDocument[] = (data || [])
        .filter((row: any) => row.nombre_modulo === 'boveda_documental' || row.datos?.fileType)
        .map((row: any) => {
          const d = row.datos || {};
          return {
            id: row.id,
            name: d.name || 'Documento sin título',
            category: (d.category as VaultCategory) || 'otros',
            fileType: d.fileType || 'other',
            mimeType: d.mimeType || 'application/octet-stream',
            sizeBytes: Number(d.sizeBytes || 0),
            content: d.content,
            externalUrl: d.externalUrl,
            cloudProvider: d.cloudProvider,
            notes: d.notes,
            dteMeta: d.dteMeta,
            created_at: row.created_at
          };
        });

      setDocuments(mapped);
    } catch (err: any) {
      console.error('Error cargando Bóveda Documental:', err);
      toast({
        variant: 'destructive',
        title: 'Error al cargar Bóveda Documental',
        description: err?.message || 'No se pudieron recuperar los documentos.'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
    loadCloudStorageConfig().then(setCloudConfig).catch(() => {});
  }, [user]);

  const handleUploadFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    const empresaId = getEmpresaId();
    const userId = user?.id || null;

    let okCount = 0;
    let skippedHeavy = 0;

    try {
      const files = Array.from(fileList);
      for (const file of files) {
        if (file.size > MAX_INLINE_FILE_BYTES) {
          skippedHeavy++;
          continue;
        }

        const lower = file.name.toLowerCase();
        const isJson = lower.endsWith('.json') || file.type === 'application/json';
        const isPdf = lower.endsWith('.pdf') || file.type === 'application/pdf';
        const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/.test(lower);
        const isOffice = /\.(xlsx?|docx?|csv|pptx?)$/.test(lower);

        let content = '';
        let fileType: VaultDocument['fileType'] = 'other';
        let category: VaultCategory = uploadCategory;
        let dteMeta: VaultDocument['dteMeta'] | undefined;

        if (isJson) {
          content = await file.text();
          try {
            const parsedRaw = JSON.parse(content);
            const dte = parseDteJsonDocument(parsedRaw);
            if (dte) {
              fileType = 'dte_json';
              category = 'dte_json';
              dteMeta = {
                tipoDte: dte.tipoDte,
                numeroControl: dte.numeroControl,
                codigoGeneracion: dte.codigoGeneracion,
                fecEmi: dte.fecEmi,
                emisor: dte.emisor.nombre,
                receptor: dte.receptor.nombre,
                totalPagar: dte.resumen.totalPagar
              };
            } else {
              fileType = 'json';
            }
          } catch {
            fileType = 'json';
          }
        } else {
          content = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          if (isPdf) fileType = 'pdf';
          else if (isImage) fileType = 'image';
          else if (isOffice) fileType = 'office';
        }

        const record = {
          nombre_modulo: 'boveda_documental',
          tipo: fileType,
          datos: {
            name: file.name,
            category,
            fileType,
            mimeType: file.type || (isJson ? 'application/json' : 'application/octet-stream'),
            sizeBytes: file.size,
            content,
            dteMeta
          },
          producto_id: null,
          empresa_id: empresaId,
          creado_por: userId
        };

        const { error } = await supabase.from('modulos_personalizados').insert(record);
        if (error) throw error;
        okCount++;
      }

      if (okCount > 0) {
        toast({
          title: `${okCount} archivo(s) guardado(s) en Bóveda`,
          description: 'Ya puedes visualizarlos, buscarlos o imprimir DTEs desde aquí.'
        });
        await fetchDocuments();
      }
      if (skippedHeavy > 0) {
        toast({
          variant: 'destructive',
          title: `${skippedHeavy} archivo(s) superan 4 MB`,
          description: 'Para archivos pesados, súbelos a tu nube (Drive/OneDrive) y usa "Vincular Enlace Nube".'
        });
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error al subir archivo',
        description: err?.message || 'No se pudo almacenar el documento.'
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveCloudLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cloudLinkForm.name.trim() || !cloudLinkForm.url.trim()) {
      toast({ variant: 'destructive', title: 'Campos requeridos', description: 'Ingresa nombre y enlace del archivo.' });
      return;
    }

    try {
      const record = {
        nombre_modulo: 'boveda_documental',
        tipo: 'cloud_link',
        datos: {
          name: cloudLinkForm.name.trim(),
          category: cloudLinkForm.category,
          fileType: 'cloud_link',
          mimeType: 'text/uri-list',
          sizeBytes: 0,
          externalUrl: cloudLinkForm.url.trim(),
          cloudProvider: CLOUD_PROVIDER_META[cloudConfig.provider].shortLabel,
          notes: cloudLinkForm.notes.trim() || undefined
        },
        producto_id: null,
        empresa_id: getEmpresaId(),
        creado_por: user?.id || null
      };

      const { error } = await supabase.from('modulos_personalizados').insert(record);
      if (error) throw error;

      toast({ title: 'Enlace de Nube Registrado', description: `"${cloudLinkForm.name}" quedó indexado en la bóveda.` });
      setCloudLinkForm({ name: '', url: '', category: 'contratos', notes: '' });
      setIsCloudLinkOpen(false);
      await fetchDocuments();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error al guardar enlace', description: err?.message });
    }
  };

  const handleDeleteDoc = async (doc: VaultDocument, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`¿Eliminar "${doc.name}" de la Bóveda Documental?`)) return;
    try {
      const { error } = await supabase.from('modulos_personalizados').delete().eq('id', doc.id);
      if (error) throw error;
      toast({ title: 'Documento Eliminado', description: `"${doc.name}" fue removido.` });
      if (previewDoc?.id === doc.id) setPreviewDoc(null);
      await fetchDocuments();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error al eliminar', description: err?.message });
    }
  };

  const handleDownloadDoc = (doc: VaultDocument) => {
    if (doc.externalUrl) {
      window.open(doc.externalUrl, '_blank', 'noreferrer');
      return;
    }
    if (!doc.content) return;
    const a = document.createElement('a');
    if (doc.content.startsWith('data:')) {
      a.href = doc.content;
    } else {
      const blob = new Blob([doc.content], { type: doc.mimeType || 'application/json' });
      a.href = URL.createObjectURL(blob);
    }
    a.download = doc.name;
    a.click();
  };

  const handleGeneratePythonPdf = async (dte: ParsedDteSummary) => {
    const baseUrl = (cloudConfig.pythonDteServiceUrl || 'http://localhost:8000').replace(/\/+$/, '');
    setGeneratingPythonPdf(true);
    try {
      const payload = {
        identificacion: {
          ambiente: dte.ambiente || '00',
          tipoDte: dte.tipoDte || '01',
          codigoGeneracion: dte.codigoGeneracion || 'SIN-CODIGO',
          numeroControl: dte.numeroControl || 'SIN-CONTROL',
          fecEmi: dte.fecEmi || '',
          horEmi: dte.horEmi || ''
        },
        emisor: {
          nit: dte.emisor.nit || '-',
          nrc: dte.emisor.nrc || '-',
          nombre: dte.emisor.nombre || 'Emisor',
          codActividad: dte.emisor.codActividad || '00000',
          descActividad: dte.emisor.descActividad || '-',
          direccion: dte.emisor.direccion || 'El Salvador',
          telefono: dte.emisor.telefono || ''
        },
        receptor: {
          tipoDocumento: dte.receptor.tipoDocumento || '36',
          numDocumento: dte.receptor.numDocumento || dte.receptor.nit || '',
          nombre: dte.receptor.nombre || 'Consumidor Final',
          nrc: dte.receptor.nrc || '',
          direccion: dte.receptor.direccion || ''
        },
        cuerpoDocumento: dte.items.map((it) => ({
          numItem: it.numItem,
          cantidad: it.cantidad,
          descripcion: it.descripcion,
          precioUni: it.precioUni,
          ventaGravada: it.ventaGravada,
          montoDescu: it.montoDescu,
          sku: it.codigo
        })),
        resumen: {
          totalGravada: dte.resumen.totalGravada,
          subTotal: dte.resumen.subTotal,
          totalIva: dte.resumen.totalIva,
          ivaRete1: dte.resumen.ivaRete1,
          totalDescu: dte.resumen.totalDescu,
          totalPagar: dte.resumen.totalPagar,
          totalLetras: dte.resumen.totalLetras || `$${dte.resumen.totalPagar.toFixed(2)} USD`
        },
        selloRecepcion: dte.selloRecepcion || undefined
      };

      const res = await fetch(`${baseUrl}/api/v1/reports/dte-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch {
      toast({
        variant: 'destructive',
        title: 'Servicio Python PDF no disponible',
        description: `No se pudo conectar a ${baseUrl}. Usa el botón "Imprimir / Guardar PDF" que funciona directamente sin Python.`
      });
    } finally {
      setGeneratingPythonPdf(false);
    }
  };

  const parsedPreviewDte = useMemo(() => {
    if (!previewDoc || !previewDoc.content || (previewDoc.fileType !== 'dte_json' && previewDoc.fileType !== 'json')) {
      return null;
    }
    try {
      return parseDteJsonDocument(JSON.parse(previewDoc.content));
    } catch {
      return null;
    }
  }, [previewDoc]);

  const filteredDocs = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return documents.filter((doc) => {
      if (activeCategory !== 'todos' && doc.category !== activeCategory) return false;
      if (!q) return true;
      return (
        doc.name.toLowerCase().includes(q) ||
        (doc.dteMeta?.numeroControl || '').toLowerCase().includes(q) ||
        (doc.dteMeta?.codigoGeneracion || '').toLowerCase().includes(q) ||
        (doc.dteMeta?.emisor || '').toLowerCase().includes(q) ||
        (doc.dteMeta?.receptor || '').toLowerCase().includes(q) ||
        (doc.notes || '').toLowerCase().includes(q)
      );
    });
  }, [documents, activeCategory, searchTerm]);

  const providerMeta = CLOUD_PROVIDER_META[cloudConfig.provider];

  const renderDocIcon = (doc: VaultDocument) => {
    switch (doc.fileType) {
      case 'dte_json':
      case 'json':
        return <FileJson size={20} className="text-indigo-500" />;
      case 'pdf':
        return <FileText size={20} className="text-rose-500" />;
      case 'image':
        return <FileImage size={20} className="text-emerald-500" />;
      case 'office':
        return <FileSpreadsheet size={20} className="text-teal-500" />;
      case 'cloud_link':
        return <Cloud size={20} className="text-sky-500" />;
      default:
        return <FileCode2 size={20} className="text-muted-foreground" />;
    }
  };

  return (
    <div className="min-h-screen bg-transparent p-4 md:p-6 transition-colors duration-300 text-foreground font-body">
      <div className="w-full max-w-[1600px] mx-auto space-y-5">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-border rounded-2xl p-4 md:p-5 shadow-sm">
          <div className="flex items-center gap-3.5">
            <Button
              variant="ghost"
              size="icon"
              className="w-10 h-10 rounded-xl bg-accent border border-border hover:bg-accent/80"
              onClick={() => router.push('/')}
            >
              <ArrowLeft className="text-foreground" size={18} />
            </Button>
            <div>
              <h1 className="text-lg md:text-xl font-bold font-headline flex items-center gap-2 text-foreground">
                Bóveda Documental & Visor DTE JSON
                <Sparkles size={16} className="text-indigo-500" />
              </h1>
              <p className="text-muted-foreground text-xs">
                Centraliza DTEs en JSON de Hacienda, contratos, fichas técnicas y archivos vinculados a tu nube.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="h-8 px-3 gap-1.5 text-xs bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30"
            >
              {cloudConfig.provider === 'supabase_internal' ? <HardDrive size={13} /> : <Cloud size={13} />}
              {providerMeta.shortLabel}
            </Badge>

            {cloudConfig.provider !== 'supabase_internal' && cloudConfig.folderUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(cloudConfig.folderUrl, '_blank', 'noreferrer')}
                className="h-8 text-xs gap-1.5"
              >
                <ExternalLink size={13} /> Abrir Carpeta Nube
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/management')}
              title="Cambiar proveedor de nube (Google Drive, OneDrive, Dropbox) o URL Python DTE"
              className="h-8 text-xs gap-1.5"
            >
              <Settings size={13} /> Ajustes Nube
            </Button>

            <ModeToggle />
          </div>
        </div>

        {/* BARRA DE ACCIONES PRINCIPALES */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <Card className="lg:col-span-8 border-border bg-card rounded-2xl shadow-sm">
            <CardContent className="p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".json,.pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.docx,.doc,.csv,.txt"
                className="hidden"
                onChange={(e) => handleUploadFiles(e.target.files)}
              />

              <div className="flex-1 space-y-1">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">
                  Carpeta de destino al subir
                </Label>
                <Select value={uploadCategory} onValueChange={(v) => setUploadCategory(v as VaultCategory)}>
                  <SelectTrigger className="h-9 text-xs bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VAULT_CATEGORIES.filter((c) => c.id !== 'todos').map((cat) => (
                      <SelectItem key={cat.id} value={cat.id} className="text-xs">
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end gap-2">
                <Button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1.5 rounded-xl px-4"
                >
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  Subir Archivos / JSON DTE
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCloudLinkOpen(true)}
                  className="h-9 text-xs font-semibold gap-1.5 rounded-xl"
                >
                  <Link2 size={14} /> Vincular Enlace Nube
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-4 border-border bg-card rounded-2xl shadow-sm">
            <CardContent className="p-4 flex items-center justify-between gap-3 h-full">
              <div>
                <div className="text-[10px] font-bold uppercase text-muted-foreground">Total en Bóveda</div>
                <div className="text-2xl font-black text-foreground">{documents.length}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400">DTEs JSON</div>
                <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                  {documents.filter((d) => d.fileType === 'dte_json').length}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* FILTROS Y BUSCADOR */}
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-card border border-border rounded-2xl p-3 shadow-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
            <Input
              placeholder="Buscar por nombre, No. Control DTE, Código de Generación, emisor o receptor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-xs bg-background"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {VAULT_CATEGORIES.map((cat) => (
              <Button
                key={cat.id}
                size="sm"
                variant={activeCategory === cat.id ? 'default' : 'outline'}
                onClick={() => setActiveCategory(cat.id)}
                className="h-8 text-[11px] px-2.5 rounded-lg"
              >
                {cat.label}
              </Button>
            ))}
          </div>
        </div>

        {/* LISTADO DE DOCUMENTOS */}
        <Card className="border-border bg-card rounded-2xl overflow-hidden shadow-sm">
          <CardHeader className="border-b border-border py-3.5 px-5 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <FolderOpen size={15} className="text-indigo-500" />
                Archivos de la Organización ({filteredDocs.length})
              </CardTitle>
              <CardDescription className="text-xs">
                Haz clic en cualquier archivo para previsualizarlo. Los archivos DTE .json se renderizan automáticamente con formato fiscal.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <ScrollArea className="h-[480px]">
              {loading ? (
                <div className="py-24 text-center text-muted-foreground flex flex-col items-center gap-2 text-xs">
                  <Loader2 className="animate-spin text-indigo-500 h-6 w-6" />
                  <span>Cargando Bóveda Documental...</span>
                </div>
              ) : filteredDocs.length === 0 ? (
                <div className="py-20 text-center space-y-3 px-4">
                  <FolderOpen size={36} className="mx-auto text-muted-foreground/40" />
                  <div className="text-sm font-semibold text-foreground">No hay archivos en esta carpeta</div>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    Sube archivos DTE `.json` de Hacienda para visualizarlos e imprimirlos al instante, o guarda PDFs, contratos y fichas técnicas de tu empresa.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredDocs.map((doc) => (
                    <div
                      key={doc.id}
                      onClick={() => setPreviewDoc(doc)}
                      className="p-4 hover:bg-muted/40 cursor-pointer transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-muted/60 border border-border flex items-center justify-center shrink-0">
                          {renderDocIcon(doc)}
                        </div>
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-foreground truncate">{doc.name}</span>
                            <Badge variant="outline" className="text-[10px] h-5">
                              {getCategoryLabel(doc.category)}
                            </Badge>
                            {doc.fileType === 'dte_json' && (
                              <Badge className="bg-indigo-600 text-white text-[9px] h-4 px-1.5">
                                DTE-{doc.dteMeta?.tipoDte || '01'}
                              </Badge>
                            )}
                            {doc.fileType === 'cloud_link' && (
                              <Badge variant="outline" className="bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30 text-[9px] h-4 px-1.5">
                                ☁ {doc.cloudProvider || 'Nube'}
                              </Badge>
                            )}
                          </div>

                          {doc.dteMeta ? (
                            <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 font-mono">
                              {doc.dteMeta.numeroControl && <span>{doc.dteMeta.numeroControl}</span>}
                              {doc.dteMeta.emisor && <span className="font-sans">Emisor: {doc.dteMeta.emisor}</span>}
                              {doc.dteMeta.receptor && <span className="font-sans">Receptor: {doc.dteMeta.receptor}</span>}
                              {typeof doc.dteMeta.totalPagar === 'number' && (
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                  ${doc.dteMeta.totalPagar.toFixed(2)}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                              <span>{formatBytes(doc.sizeBytes)}</span>
                              <span>•</span>
                              <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                              {doc.notes && (
                                <>
                                  <span>•</span>
                                  <span className="truncate max-w-[260px]">{doc.notes}</span>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewDoc(doc);
                          }}
                          className="h-8 text-xs gap-1"
                        >
                          <Eye size={13} /> Ver
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Descargar / Abrir"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadDoc(doc);
                          }}
                          className="h-8 w-8"
                        >
                          {doc.externalUrl ? <ExternalLink size={14} /> : <Download size={14} />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Eliminar"
                          onClick={(e) => handleDeleteDoc(doc, e)}
                          className="h-8 w-8 text-rose-500 hover:bg-rose-500/10"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* MODAL: VINCULAR ENLACE DE NUBE (DRIVE / ONEDRIVE / DROPBOX) */}
      <Dialog open={isCloudLinkOpen} onOpenChange={setIsCloudLinkOpen}>
        <DialogContent className="max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Cloud size={17} className="text-sky-500" />
              Vincular Archivo desde {providerMeta.shortLabel}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Ideal para archivos pesados (catálogos PDF, carpetas de respaldos o expedientes en Google Drive / OneDrive / Dropbox).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveCloudLink} className="space-y-3.5 py-2">
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Nombre del Documento *</Label>
              <Input
                required
                value={cloudLinkForm.name}
                onChange={(e) => setCloudLinkForm({ ...cloudLinkForm, name: e.target.value })}
                placeholder="Ej. Catálogo Pinturas Automotrices 2026.pdf"
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Enlace en la Nube (URL) *</Label>
              <Input
                required
                type="url"
                value={cloudLinkForm.url}
                onChange={(e) => setCloudLinkForm({ ...cloudLinkForm, url: e.target.value })}
                placeholder="https://drive.google.com/file/d/..."
                className="h-9 text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Carpeta / Categoría</Label>
              <Select
                value={cloudLinkForm.category}
                onValueChange={(v) => setCloudLinkForm({ ...cloudLinkForm, category: v as VaultCategory })}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VAULT_CATEGORIES.filter((c) => c.id !== 'todos').map((cat) => (
                    <SelectItem key={cat.id} value={cat.id} className="text-xs">
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase text-muted-foreground">Notas (Opcional)</Label>
              <Input
                value={cloudLinkForm.notes}
                onChange={(e) => setCloudLinkForm({ ...cloudLinkForm, notes: e.target.value })}
                placeholder="Ej. Vigente hasta diciembre 2026..."
                className="h-9 text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsCloudLinkOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
                Guardar Enlace
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: VISOR INTEGRADO DE DOCUMENTOS Y DTE JSON */}
      <Dialog open={!!previewDoc} onOpenChange={(open) => !open && setPreviewDoc(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card border-border">
          {previewDoc && (
            <>
              <DialogHeader className="border-b border-border pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
                  <div className="flex items-center gap-2 min-w-0">
                    {renderDocIcon(previewDoc)}
                    <DialogTitle className="text-base font-bold truncate">{previewDoc.name}</DialogTitle>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {parsedPreviewDte && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => printDteSummaryHtml(parsedPreviewDte, previewDoc.name)}
                          className="h-8 text-xs gap-1.5"
                        >
                          <Printer size={13} /> Imprimir / Guardar PDF
                        </Button>
                        <Button
                          size="sm"
                          disabled={generatingPythonPdf}
                          onClick={() => handleGeneratePythonPdf(parsedPreviewDte)}
                          className="h-8 text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                          {generatingPythonPdf ? <Loader2 size={13} className="animate-spin" /> : <Server size={13} />}
                          PDF Oficial (Python)
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="outline" onClick={() => handleDownloadDoc(previewDoc)} className="h-8 text-xs gap-1">
                      {previewDoc.externalUrl ? <ExternalLink size={13} /> : <Download size={13} />}
                      {previewDoc.externalUrl ? 'Abrir' : 'Descargar'}
                    </Button>
                  </div>
                </div>
                <DialogDescription className="text-xs">
                  {getCategoryLabel(previewDoc.category)} • {formatBytes(previewDoc.sizeBytes)}
                </DialogDescription>
              </DialogHeader>

              {/* 1. VISOR DTE JSON */}
              {parsedPreviewDte ? (
                <Tabs defaultValue="visual" className="space-y-3">
                  <TabsList className="grid w-full max-w-xs grid-cols-2 h-8">
                    <TabsTrigger value="visual" className="text-xs">Vista Fiscal DTE</TabsTrigger>
                    <TabsTrigger value="raw" className="text-xs">JSON Crudo</TabsTrigger>
                  </TabsList>

                  <TabsContent value="visual" className="space-y-4 text-xs">
                    {/* Encabezado DTE */}
                    <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex flex-col sm:flex-row justify-between gap-3">
                      <div className="space-y-1">
                        <Badge className="bg-indigo-600 text-white text-[10px]">
                          <ShieldCheck size={11} className="mr-1" /> {parsedPreviewDte.tipoDteLabel}
                        </Badge>
                        <div className="font-mono text-[11px]">
                          <strong>No. Control:</strong> {parsedPreviewDte.numeroControl || '—'}
                        </div>
                        <div className="font-mono text-[11px] break-all">
                          <strong>Cód. Generación:</strong> {parsedPreviewDte.codigoGeneracion || '—'}
                        </div>
                      </div>
                      <div className="sm:text-right font-mono text-[11px] space-y-1">
                        <div><strong>Emisión:</strong> {parsedPreviewDte.fecEmi} {parsedPreviewDte.horEmi}</div>
                        <div><strong>Ambiente:</strong> {parsedPreviewDte.ambiente === '01' ? 'Producción (01)' : 'Pruebas (00)'}</div>
                        {parsedPreviewDte.selloRecepcion && (
                          <div className="text-emerald-700 dark:text-emerald-400 break-all">
                            <strong>Sello MH:</strong> {parsedPreviewDte.selloRecepcion}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Emisor y Receptor */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl bg-muted/30 border border-border space-y-1">
                        <div className="text-[10px] font-bold uppercase text-muted-foreground">Emisor</div>
                        <div className="font-bold text-sm text-foreground">{parsedPreviewDte.emisor.nombre}</div>
                        <div className="font-mono text-[11px]">
                          NIT: {parsedPreviewDte.emisor.nit || '—'} • NRC: {parsedPreviewDte.emisor.nrc || '—'}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Giro: {parsedPreviewDte.emisor.codActividad ? `[${parsedPreviewDte.emisor.codActividad}] ` : ''}
                          {parsedPreviewDte.emisor.descActividad || '—'}
                        </div>
                        {parsedPreviewDte.emisor.direccion && (
                          <div className="text-[11px] text-muted-foreground">{parsedPreviewDte.emisor.direccion}</div>
                        )}
                      </div>

                      <div className="p-3 rounded-xl bg-muted/30 border border-border space-y-1">
                        <div className="text-[10px] font-bold uppercase text-muted-foreground">Receptor</div>
                        <div className="font-bold text-sm text-foreground">{parsedPreviewDte.receptor.nombre}</div>
                        <div className="font-mono text-[11px]">
                          Doc/NIT: {parsedPreviewDte.receptor.numDocumento || parsedPreviewDte.receptor.nit || '—'} • NRC: {parsedPreviewDte.receptor.nrc || '—'}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Giro: {parsedPreviewDte.receptor.codActividad ? `[${parsedPreviewDte.receptor.codActividad}] ` : ''}
                          {parsedPreviewDte.receptor.descActividad || '—'}
                        </div>
                        {parsedPreviewDte.receptor.direccion && (
                          <div className="text-[11px] text-muted-foreground">{parsedPreviewDte.receptor.direccion}</div>
                        )}
                      </div>
                    </div>

                    {/* Tabla de ítems */}
                    <div className="border border-border rounded-xl overflow-hidden">
                      <Table>
                        <TableHeader className="bg-muted/50 text-[10px]">
                          <TableRow>
                            <TableHead className="w-10 text-center">#</TableHead>
                            <TableHead>Código</TableHead>
                            <TableHead>Descripción</TableHead>
                            <TableHead className="text-right">Cant.</TableHead>
                            <TableHead className="text-right">Precio Unit.</TableHead>
                            <TableHead className="text-right">Subtotal</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {parsedPreviewDte.items.map((it) => (
                            <TableRow key={it.numItem} className="text-[11px]">
                              <TableCell className="text-center font-mono">{it.numItem}</TableCell>
                              <TableCell className="font-mono text-muted-foreground">{it.codigo || '—'}</TableCell>
                              <TableCell className="font-medium">{it.descripcion}</TableCell>
                              <TableCell className="text-right font-mono">{it.cantidad}</TableCell>
                              <TableCell className="text-right font-mono">${it.precioUni.toFixed(2)}</TableCell>
                              <TableCell className="text-right font-mono font-bold">
                                ${(it.ventaGravada || it.ventaExenta || it.ventaNoSuj).toFixed(2)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Resumen Tributario */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3">
                      <div className="text-[11px] text-muted-foreground">
                        {parsedPreviewDte.resumen.totalLetras && (
                          <div>
                            <strong className="text-foreground">Total en letras:</strong> {parsedPreviewDte.resumen.totalLetras}
                          </div>
                        )}
                      </div>
                      <div className="w-full sm:w-64 p-3 rounded-xl bg-muted/40 border border-border space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Gravado:</span>
                          <span className="font-mono">${parsedPreviewDte.resumen.totalGravada.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">IVA (13%):</span>
                          <span className="font-mono">${parsedPreviewDte.resumen.totalIva.toFixed(2)}</span>
                        </div>
                        {parsedPreviewDte.resumen.ivaRete1 > 0 && (
                          <div className="flex justify-between text-amber-600 dark:text-amber-400 font-semibold">
                            <span>Retención 1% IVA:</span>
                            <span className="font-mono">-${parsedPreviewDte.resumen.ivaRete1.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between pt-1.5 border-t border-border font-bold text-sm text-indigo-600 dark:text-indigo-400">
                          <span>Total a Pagar:</span>
                          <span className="font-mono">${parsedPreviewDte.resumen.totalPagar.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="raw" className="space-y-2">
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        onClick={() => {
                          if (previewDoc.content) {
                            navigator.clipboard.writeText(previewDoc.content);
                            toast({ title: 'JSON copiado al portapapeles' });
                          }
                        }}
                      >
                        <Copy size={12} /> Copiar JSON
                      </Button>
                    </div>
                    <pre className="p-3 rounded-xl bg-muted/60 border border-border text-[11px] font-mono overflow-auto max-h-[55vh] text-foreground">
                      {(() => {
                        try {
                          return JSON.stringify(JSON.parse(previewDoc.content || '{}'), null, 2);
                        } catch {
                          return previewDoc.content;
                        }
                      })()}
                    </pre>
                  </TabsContent>
                </Tabs>
              ) : previewDoc.fileType === 'pdf' && previewDoc.content ? (
                <iframe
                  src={previewDoc.content}
                  title={previewDoc.name}
                  className="w-full h-[65vh] rounded-xl border border-border bg-white"
                />
              ) : previewDoc.fileType === 'image' && previewDoc.content ? (
                <div className="flex justify-center p-2 bg-muted/30 rounded-xl border border-border">
                  <img
                    src={previewDoc.content}
                    alt={previewDoc.name}
                    className="max-h-[65vh] rounded-lg object-contain"
                  />
                </div>
              ) : previewDoc.fileType === 'json' && previewDoc.content ? (
                <pre className="p-3 rounded-xl bg-muted/60 border border-border text-[11px] font-mono overflow-auto max-h-[60vh] text-foreground">
                  {previewDoc.content}
                </pre>
              ) : previewDoc.externalUrl ? (
                <div className="p-6 rounded-xl bg-muted/30 border border-border text-center space-y-3">
                  <Cloud size={36} className="mx-auto text-sky-500" />
                  <div className="text-sm font-bold text-foreground">Archivo alojado en {previewDoc.cloudProvider || 'la nube'}</div>
                  <p className="text-xs text-muted-foreground font-mono break-all">{previewDoc.externalUrl}</p>
                  {previewDoc.notes && <p className="text-xs text-muted-foreground">{previewDoc.notes}</p>}
                  <Button
                    onClick={() => window.open(previewDoc.externalUrl, '_blank', 'noreferrer')}
                    className="bg-sky-600 hover:bg-sky-700 text-white gap-1.5 text-xs"
                  >
                    <ExternalLink size={14} /> Abrir archivo en la nube
                  </Button>
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  Este formato no tiene vista previa directa. Usa el botón <strong>Descargar</strong> para abrirlo en tu equipo.
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
