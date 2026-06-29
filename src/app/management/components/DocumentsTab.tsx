'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  FileSpreadsheet, 
  Plus, 
  Trash2, 
  ArrowLeft, 
  Save, 
  Loader2, 
  Search, 
  Edit3, 
  Bold, 
  Italic, 
  Underline, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  ChevronLeft,
  Grid,
  FileCode,
  Sparkles,
  Heading1,
  Heading2,
  Trash
} from 'lucide-react';
import { supabase } from '@/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ModeToggle } from '@/components/mode-toggle';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useUser } from '@/supabase/use-user';
import { useRouter } from 'next/navigation';

interface DocumentItem {
  id: string;
  nombre_modulo: string;
  tipo: string; // 'documento' | 'hoja_calculo'
  datos: any; // { content: string } for documents, { grid: Record<string, string>, rows: number, cols: number } for spreadsheets
  created_at: string;
  empresa_id: string | null;
  creado_por: string | null;
}

export default function DocumentsTab() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useUser();

  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Editor view states
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [currentDoc, setCurrentDoc] = useState<Partial<DocumentItem> | null>(null);
  
  // Rich Document states
  const [docContent, setDocContent] = useState('');
  const [docName, setDocName] = useState('');
  const editorRef = useRef<HTMLDivElement>(null);

  // Spreadsheet states
  const [sheetName, setSheetName] = useState('');
  const [sheetData, setSheetData] = useState<Record<string, string>>({});
  const [activeCell, setActiveCell] = useState<string | null>(null);
  const [formulaValue, setFormulaValue] = useState('');
  
  const COLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  const ROWS = Array.from({ length: 20 }, (_, i) => i + 1);

  // Get tenant/empresa_id
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
        // Enforce strict multi-tenant isolate filter
        query = query.eq('empresa_id', empresaId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      // Filter local items to only map custom docs (or type field)
      const mapped: DocumentItem[] = (data || []).map((item: any) => ({
        id: item.id,
        nombre_modulo: item.nombre_modulo,
        tipo: item.tipo || (item.nombre_modulo?.includes('sheet') ? 'hoja_calculo' : 'documento'),
        datos: item.datos || {},
        created_at: item.created_at,
        empresa_id: item.empresa_id,
        creado_por: item.creado_por
      }));

      setDocuments(mapped);
    } catch (err: any) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'Error al cargar Centro Documental',
        description: err.message || 'No se pudieron recuperar los archivos libres.'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [user]);

  // Create new Document
  const handleCreateNew = (tipo: 'documento' | 'hoja_calculo') => {
    if (tipo === 'documento') {
      setCurrentDoc({
        nombre_modulo: 'centro_documental',
        tipo: 'documento',
        datos: { content: '' }
      });
      setDocName('Nuevo Documento sin Título');
      setDocContent('');
    } else {
      setCurrentDoc({
        nombre_modulo: 'centro_documental',
        tipo: 'hoja_calculo',
        datos: { grid: {} }
      });
      setSheetName('Nueva Hoja sin Título');
      setSheetData({});
      setFormulaValue('');
      setActiveCell(null);
    }
    setIsEditorOpen(true);
  };

  // Open existing Document/Spreadsheet
  const handleOpenDoc = (doc: DocumentItem) => {
    setCurrentDoc(doc);
    if (doc.tipo === 'documento') {
      setDocName(doc.datos.name || 'Documento sin Título');
      setDocContent(doc.datos.content || '');
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.innerHTML = doc.datos.content || '';
        }
      }, 100);
    } else {
      setSheetName(doc.datos.name || 'Hoja sin Título');
      setSheetData(doc.datos.grid || {});
      setFormulaValue('');
      setActiveCell(null);
    }
    setIsEditorOpen(true);
  };

  // Delete Document
  const handleDeleteDoc = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('¿Está seguro de que desea eliminar este archivo de forma permanente?')) return;
    
    try {
      const { error } = await supabase
        .from('modulos_personalizados')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Archivo Eliminado',
        description: 'El documento fue removido del servidor.'
      });
      fetchDocuments();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error al eliminar',
        description: err.message
      });
    }
  };

  // Upsert Save Function
  const guardarArchivoLibre = async (id: string | undefined, nombre: string, tipo: string, datosJSON: any) => {
    setLoading(true);
    try {
      const empresaId = getEmpresaId();
      const userId = user?.id || null;

      const record: any = {
        nombre_modulo: 'centro_documental',
        tipo: tipo,
        datos: {
          ...datosJSON,
          name: nombre
        },
        producto_id: null,
        empresa_id: empresaId,
        creado_por: userId
      };

      if (id) {
        record.id = id;
      }

      const { data, error } = await supabase
        .from('modulos_personalizados')
        .upsert(record)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: '✓ Archivo Guardado',
        description: `El archivo "${nombre}" ha sido actualizado con éxito.`
      });

      if (data) {
        setCurrentDoc({
          id: data.id,
          nombre_modulo: data.nombre_modulo,
          tipo: data.tipo,
          datos: data.datos,
          created_at: data.created_at,
          empresa_id: data.empresa_id,
          creado_por: data.creado_por
        });
      }

      fetchDocuments();
    } catch (err: any) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'Error al guardar',
        description: err.message || 'No se pudo guardar la configuración del archivo.'
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle Document Editor Saving
  const handleSaveDoc = () => {
    const content = editorRef.current ? editorRef.current.innerHTML : docContent;
    guardarArchivoLibre(currentDoc?.id, docName, 'documento', { content });
  };

  // Handle Spreadsheet Saving
  const handleSaveSheet = () => {
    guardarArchivoLibre(currentDoc?.id, sheetName, 'hoja_calculo', { grid: sheetData });
  };

  // Rich-text formatting commands for document editor
  const formatDoc = (command: string, value: string = '') => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      setDocContent(editorRef.current.innerHTML);
    }
  };

  // Spreadsheet cell change handlers
  const handleCellClick = (cellRef: string) => {
    setActiveCell(cellRef);
    setFormulaValue(sheetData[cellRef] || '');
  };

  const handleCellChange = (cellRef: string, val: string) => {
    setSheetData(prev => ({
      ...prev,
      [cellRef]: val
    }));
  };

  const handleFormulaChange = (val: string) => {
    setFormulaValue(val);
    if (activeCell) {
      handleCellChange(activeCell, val);
    }
  };

  // Calculate grid value fallback (simple evaluator for basic Excel feeling)
  const evalCellValue = (val: string): string => {
    if (!val) return '';
    if (val.startsWith('=')) {
      try {
        const expression = val.slice(1).toUpperCase();
        // Simple formula evaluator for SUM(A1:A5)
        if (expression.startsWith('SUM(') && expression.endsWith(')')) {
          const range = expression.slice(4, -1);
          const [start, end] = range.split(':');
          if (start && end) {
            const startCol = start[0];
            const startRow = parseInt(start.slice(1));
            const endCol = end[0];
            const endRow = parseInt(end.slice(1));
            
            let sum = 0;
            for (let r = startRow; r <= endRow; r++) {
              const cellKey = `${startCol}${r}`;
              const cellVal = parseFloat(sheetData[cellKey] || '0') || 0;
              sum += cellVal;
            }
            return sum.toString();
          }
        }
        // Simple evaluation support like A1+B1
        let replacedExpr = expression;
        const cellRefs = expression.match(/[A-J][0-9]+/g) || [];
        cellRefs.forEach(ref => {
          const val = parseFloat(sheetData[ref] || '0') || 0;
          replacedExpr = replacedExpr.replace(new RegExp(ref, 'g'), val.toString());
        });
        // Evaluate mathematical expression safely
        const evalResult = new Function(`return ${replacedExpr}`)();
        return evalResult !== undefined ? evalResult.toString() : '';
      } catch (e) {
        return '#ERROR!';
      }
    }
    return val;
  };

  // Filtered documents for UI list
  const filteredDocs = documents.filter(d => 
    (d.datos.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-transparent p-4 md:p-6 transition-colors duration-300 relative overflow-hidden text-white font-body">
      
      {/* BACKGROUND DECORATIONS */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-[150px] pointer-events-none" />

      {/* TOP HEADER */}
      {!isEditorOpen && (
        <div className="max-w-7xl mx-auto flex items-center justify-between mb-6 bg-white/5 dark:bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 md:p-5 relative z-10">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10" 
              onClick={() => router.push('/')}
            >
              <ArrowLeft className="text-slate-300" size={18} />
            </Button>
            <div>
              <h1 className="text-lg md:text-xl font-bold font-headline leading-tight flex items-center gap-2">
                Centro Documental 
                <Sparkles size={16} className="text-[#a5a8ff] drop-shadow-[0_0_6px_rgba(165,168,255,0.8)]" />
              </h1>
              <p className="text-white/40 text-[11px] md:text-xs">Espacios de trabajo libres para hojas de cálculo y documentos de texto</p>
            </div>
          </div>
          <ModeToggle />
        </div>
      )}

      {/* EXPLORER SCREEN */}
      {!isEditorOpen && (
        <div className="max-w-7xl mx-auto relative z-10 space-y-6">
          {/* Action buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Button
              onClick={() => handleCreateNew('documento')}
              className="h-24 bg-gradient-to-r from-blue-600/30 to-indigo-600/30 hover:from-blue-600/40 hover:to-indigo-600/40 border border-blue-500/35 rounded-2xl text-left flex items-center justify-between px-6 transition-all active:scale-95 group shadow-lg shadow-blue-500/5"
            >
              <div>
                <span className="text-base font-black tracking-wide block text-blue-200">Nuevo Documento</span>
                <span className="text-[10px] text-blue-400 font-medium">Editor de Texto Libre (Formato Word)</span>
              </div>
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                <FileText size={24} />
              </div>
            </Button>

            <Button
              onClick={() => handleCreateNew('hoja_calculo')}
              className="h-24 bg-gradient-to-r from-emerald-600/30 to-teal-600/30 hover:from-emerald-600/40 hover:to-teal-600/40 border border-emerald-500/35 rounded-2xl text-left flex items-center justify-between px-6 transition-all active:scale-95 group shadow-lg shadow-emerald-500/5"
            >
              <div>
                <span className="text-base font-black tracking-wide block text-emerald-200">Nueva Hoja de Cálculo</span>
                <span className="text-[10px] text-emerald-400 font-medium">Cuadrícula Interactiva (Formato Excel)</span>
              </div>
              <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                <FileSpreadsheet size={24} />
              </div>
            </Button>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={16} />
            <Input
              placeholder="Buscar documentos libres..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-12 h-12 bg-white/5 border-white/10 rounded-2xl text-sm placeholder:text-white/20 focus-visible:ring-indigo-500"
            />
          </div>

          {/* Documents Grid */}
          <Card className="bg-white/5 border-white/10 rounded-2xl overflow-hidden backdrop-blur-md">
            <CardHeader className="border-b border-white/10 py-4 px-6 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                  <Grid size={15} className="text-indigo-400" />
                  Explorador de Archivos Libres
                </CardTitle>
                <CardDescription className="text-xs text-white/40">Listado de documentación aislada para tu organización</CardDescription>
              </div>
              <span className="text-[10px] text-indigo-400/80 font-mono font-bold tracking-wider uppercase bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                Multi-Tenant Activado
              </span>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[450px]">
                {loading ? (
                  <div className="py-24 text-center text-white/40 flex flex-col items-center gap-3">
                    <Loader2 className="animate-spin text-indigo-400" size={32} />
                    <span>Buscando archivos en el tenant...</span>
                  </div>
                ) : filteredDocs.length === 0 ? (
                  <div className="py-24 text-center text-white/30 italic text-xs">
                    No se encontraron documentos registrados. Comienza creando uno nuevo.
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {filteredDocs.map((doc) => (
                      <div
                        key={doc.id}
                        onClick={() => handleOpenDoc(doc)}
                        className="p-4 hover:bg-white/5 cursor-pointer transition-colors flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            doc.tipo === 'hoja_calculo' 
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}>
                            {doc.tipo === 'hoja_calculo' ? <FileSpreadsheet size={20} /> : <FileText size={20} />}
                          </div>
                          <div className="min-w-0">
                            <span className="text-sm font-bold text-white group-hover:text-[#a5a8ff] transition-colors block truncate">
                              {doc.datos.name || (doc.tipo === 'hoja_calculo' ? 'Hoja sin Título' : 'Documento sin Título')}
                            </span>
                            <div className="flex items-center gap-2 text-[10px] text-white/40 mt-1 font-mono">
                              <span className="uppercase font-bold tracking-wider">{doc.tipo}</span>
                              <span>•</span>
                              <span>Creado: {new Date(doc.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => handleDeleteDoc(doc.id, e)}
                            className="h-8 w-8 text-white/20 hover:text-red-400 hover:bg-red-500/10 rounded-lg"
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
      )}

      {/* EDITOR SCREEN CONTAINER */}
      {isEditorOpen && currentDoc && (
        <div className="max-w-7xl mx-auto relative z-10 space-y-4 animate-in fade-in zoom-in-95 duration-200">
          
          {/* EDITOR MENU TOP BAR */}
          <div className="flex items-center justify-between bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4">
            <div className="flex items-center gap-4 flex-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsEditorOpen(false)}
                className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10"
              >
                <ChevronLeft className="text-slate-300" size={18} />
              </Button>
              <div className="flex-1 max-w-md">
                <Input
                  value={currentDoc.tipo === 'documento' ? docName : sheetName}
                  onChange={(e) => currentDoc.tipo === 'documento' ? setDocName(e.target.value) : setSheetName(e.target.value)}
                  className="h-9 font-bold bg-transparent border-none text-white text-base focus-visible:ring-indigo-500/40 p-1"
                  placeholder="Título del Archivo..."
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={currentDoc.tipo === 'documento' ? handleSaveDoc : handleSaveSheet}
                disabled={loading}
                className={`h-9 font-bold px-4 rounded-xl flex items-center gap-1.5 transition-all text-xs ${
                  currentDoc.tipo === 'hoja_calculo' 
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Guardar Cambios
              </Button>
              <Button
                variant="ghost"
                onClick={() => setIsEditorOpen(false)}
                className="h-9 text-xs border border-white/10 rounded-xl"
              >
                Cerrar Editor
              </Button>
            </div>
          </div>

          {/* RENDER WORD-LIKE DOCUMENT EDITOR */}
          {currentDoc.tipo === 'documento' && (
            <div className="space-y-4">
              {/* Document Editor Toolbar */}
              <div className="flex flex-wrap items-center gap-1.5 bg-white/5 border border-white/10 rounded-2xl p-2.5 backdrop-blur-md shadow-[0_0_15px_rgba(255,255,255,0.02)]">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 hover:bg-white/10 text-slate-300 hover:text-white transition-all active:scale-95" 
                  onClick={() => formatDoc('bold')} 
                  title="Negrita"
                >
                  <Bold size={14} />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 hover:bg-white/10 text-slate-300 hover:text-white transition-all active:scale-95" 
                  onClick={() => formatDoc('italic')} 
                  title="Cursiva"
                >
                  <Italic size={14} />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 hover:bg-white/10 text-slate-300 hover:text-white transition-all active:scale-95" 
                  onClick={() => formatDoc('underline')} 
                  title="Subrayado"
                >
                  <Underline size={14} />
                </Button>
                <div className="w-[1px] h-4 bg-white/10 mx-1" />
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 hover:bg-white/10 text-slate-300 hover:text-white transition-all active:scale-95" 
                  onClick={() => formatDoc('formatBlock', '<h1>')} 
                  title="Título 1"
                >
                  <Heading1 size={14} />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 hover:bg-white/10 text-slate-300 hover:text-white transition-all active:scale-95" 
                  onClick={() => formatDoc('formatBlock', '<h2>')} 
                  title="Título 2"
                >
                  <Heading2 size={14} />
                </Button>
                <div className="w-[1px] h-4 bg-white/10 mx-1" />
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 hover:bg-white/10 text-slate-300 hover:text-white transition-all active:scale-95" 
                  onClick={() => formatDoc('justifyLeft')} 
                  title="Alinear Izquierda"
                >
                  <AlignLeft size={14} />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 hover:bg-white/10 text-slate-300 hover:text-white transition-all active:scale-95" 
                  onClick={() => formatDoc('justifyCenter')} 
                  title="Centrar"
                >
                  <AlignCenter size={14} />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 hover:bg-white/10 text-slate-300 hover:text-white transition-all active:scale-95" 
                  onClick={() => formatDoc('justifyRight')} 
                  title="Alinear Derecha"
                >
                  <AlignRight size={14} />
                </Button>
                <div className="w-[1px] h-4 bg-white/10 mx-1" />
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-rose-455 hover:bg-rose-500/10 hover:text-rose-400 transition-all active:scale-95" 
                  onClick={() => formatDoc('removeFormat')} 
                  title="Limpiar Formato"
                >
                  <Trash size={14} />
                </Button>
              </div>

              {/* Document Paper Container with elegant neon glow border */}
              <div className="bg-[#141416] border border-blue-500/20 rounded-2xl p-8 min-h-[600px] shadow-[0_0_30px_rgba(59,130,246,0.06)] relative transition-all duration-300 focus-within:border-blue-500/45 focus-within:shadow-[0_0_40px_rgba(59,130,246,0.12)]">
                <div
                  ref={editorRef}
                  contentEditable
                  onInput={(e) => setDocContent(e.currentTarget.innerHTML)}
                  className="w-full min-h-[550px] outline-none text-sm text-slate-200 leading-relaxed font-body focus:text-white transition-colors"
                  style={{ minHeight: '550px' }}
                />
                {docContent === '' && (
                  <div className="absolute top-8 left-8 text-white/20 pointer-events-none text-sm font-medium">
                    Comienza a escribir tu documento libre aquí...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* RENDER EXCEL-LIKE SPREADSHEET EDITOR */}
          {currentDoc.tipo === 'hoja_calculo' && (
            <div className="space-y-4">
              {/* Formula Bar */}
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl p-2">
                <div className="bg-black/30 border border-white/5 rounded px-2.5 py-1 text-[10px] font-bold font-mono text-emerald-400">
                  {activeCell || 'FX'}
                </div>
                <Input
                  value={formulaValue}
                  onChange={(e) => handleFormulaChange(e.target.value)}
                  placeholder="Introduce valores o fórmulas (ej: =SUM(A1:A5) o =A1+B1)"
                  className="h-8 text-xs font-mono bg-black/20 border-white/10 text-slate-200"
                />
              </div>

              {/* Spreadsheet Grid Table */}
              <Card className="bg-[#18181c] border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                <div className="overflow-auto max-h-[60vh] max-w-full">
                  <table className="border-collapse text-xs w-full text-slate-300">
                    <thead className="bg-black/40 text-center select-none sticky top-0 z-20">
                      <tr>
                        <th className="border border-white/10 w-10 h-7 bg-black/50 text-[10px] font-bold text-white/40"></th>
                        {COLS.map(col => (
                          <th key={col} className="border border-white/10 w-24 h-7 text-[10px] font-mono font-bold text-white/40">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ROWS.map(row => (
                        <tr key={row}>
                          <td className="border border-white/10 w-10 h-8 bg-black/40 text-center font-mono font-bold text-white/30 select-none">
                            {row}
                          </td>
                          {COLS.map(col => {
                            const cellRef = `${col}${row}`;
                            const isActive = activeCell === cellRef;
                            const displayVal = evalCellValue(sheetData[cellRef] || '');
                            
                            return (
                              <td 
                                key={col} 
                                onClick={() => handleCellClick(cellRef)}
                                className={`border border-white/10 p-0 w-24 h-8 transition-colors select-none ${
                                  isActive 
                                    ? 'bg-indigo-500/10 border-indigo-400 z-10' 
                                    : 'hover:bg-white/5'
                                }`}
                              >
                                <input
                                  value={isActive ? formulaValue : displayVal}
                                  onChange={(e) => handleCellChange(cellRef, e.target.value)}
                                  onFocus={() => handleCellClick(cellRef)}
                                  className="w-full h-full bg-transparent border-none outline-none px-2 font-mono text-[11px] text-slate-200 focus:ring-0 focus:text-indigo-300"
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Simple instructions for user */}
              <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3 flex gap-2">
                <FileCode className="text-emerald-400 shrink-0 mt-0.5" size={14} />
                <div className="text-[10px] text-slate-400 leading-normal">
                  <span className="font-bold text-emerald-300 uppercase block tracking-wider mb-1">Truco de Hoja de Cálculo:</span>
                  Puedes ingresar fórmulas simples que empiecen con <code className="font-mono text-emerald-400">=</code>. 
                  Soporta funciones de suma como <code className="font-mono text-emerald-300">=SUM(A1:A5)</code> y operaciones básicas como <code className="font-mono text-emerald-300">=A1+B1</code>.
                </div>
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
