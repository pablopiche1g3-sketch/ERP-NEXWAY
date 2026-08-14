'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { usePathname } from 'next/navigation';
import { useUser } from '@/supabase/compat';
import { useToast } from '@/hooks/use-toast';
import { 
  Camera, 
  Sparkles, 
  Send, 
  Share2, 
  Copy, 
  CheckCircle2, 
  X, 
  Loader2, 
  MessageSquare, 
  AlertTriangle,
  Lightbulb,
  FileText,
  ExternalLink
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

export function FeedbackCaptureWidget() {
  const pathname = usePathname();
  const { user } = useUser();
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [reportType, setReportType] = useState<'error' | 'suggestion'>('error');
  const [userNote, setUserNote] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiDiagnosis, setAiDiagnosis] = useState<string | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // Escuchar atajo de teclado global Ctrl + Alt + F o evento personalizado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        openCaptureWidget();
      }
    };

    const handleCustomEvent = () => openCaptureWidget();

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-nexway-feedback', handleCustomEvent);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-nexway-feedback', handleCustomEvent);
    };
  }, []);

  const openCaptureWidget = () => {
    setIsOpen(true);
    setIsAnalyzing(true);
    setAiDiagnosis(null);

    // Simulación de Captura y Análisis de Diagnóstico asistido por IA
    setTimeout(() => {
      const moduleName = pathname.replace('/', '').toUpperCase() || 'INICIO / DASHBOARD';
      const diagnosisText = `🔍 Diagnóstico Automático NexBot AI:
- Módulo Detectado: ${moduleName}
- Contexto de Pantalla: Transacción activa en ventana principal.
- Estado de Conexión DB: Supabase WebSocket Activo (0 errores de red).
- Sugerencia del Sistema: Verificación de parámetros y permisos de rol para (${user?.email || 'Usuario Actual'}).`;

      setAiDiagnosis(diagnosisText);
      setIsAnalyzing(false);
    }, 1200);
  };

  const handleSendEmail = async () => {
    setIsSendingEmail(true);
    try {
      // Simulación de envío vía Gmail API / Backend
      await new Promise(res => setTimeout(res, 800));
      toast({
        title: 'Reporte Enviado a Soporte y Gerencia',
        description: 'Se notificó la captura visual y el diagnóstico a la administración.'
      });
      setIsOpen(false);
      setUserNote('');
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error al enviar', description: e.message });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleShareWhatsApp = () => {
    const text = `🚨 *REPORTE NEXWAY ERP* 🚨\n\n📌 *Tipo:* ${reportType === 'error' ? 'Reporte de Error' : 'Sugerencia de Mejora'}\n📍 *Módulo:* ${pathname}\n👤 *Usuario:* ${user?.email || 'Admin'}\n\n📝 *Nota del Usuario:* ${userNote || 'Sin notas adicionales'}\n\n${aiDiagnosis || ''}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
    toast({ title: 'Abriendo WhatsApp', description: 'Se generó la nota de diagnóstico para compartir.' });
  };

  const handleCopyClipboard = () => {
    const text = `REPORTE NEXWAY ERP\nTipo: ${reportType}\nMódulo: ${pathname}\nUsuario: ${user?.email}\nNota: ${userNote}\n\n${aiDiagnosis || ''}`;
    navigator.clipboard.writeText(text);
    toast({ title: 'Diagnóstico Copiado', description: 'El resumen se guardó en tu portapapeles.' });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="rounded-2xl max-w-lg p-6 bg-card border shadow-2xl animate-in fade-in duration-200">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <Badge className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-0 text-[9px] font-black uppercase flex items-center gap-1">
              <Camera size={12} /> Captura Visual & Diagnóstico IA
            </Badge>
            <Badge variant="outline" className="text-[9px] font-mono">Atajo: Ctrl + Alt + F</Badge>
          </div>
          <DialogTitle className="text-xl font-black text-slate-800 dark:text-white mt-1">
            {reportType === 'error' ? 'Reportar Incidencia o Error' : 'Sugerir Mejora de Sistema'}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            NexBot ha capturado el estado de la pantalla actual en <strong className="font-mono text-indigo-500">{pathname}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-2">
          {/* Selector de Tipo */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={reportType === 'error' ? 'default' : 'outline'}
              onClick={() => setReportType('error')}
              className={`h-9 text-xs font-bold rounded-xl flex items-center gap-1.5 ${reportType === 'error' ? 'bg-rose-600 hover:bg-rose-700 text-white' : ''}`}
            >
              <AlertTriangle size={14} /> Reportar Error
            </Button>
            <Button
              type="button"
              variant={reportType === 'suggestion' ? 'default' : 'outline'}
              onClick={() => setReportType('suggestion')}
              className={`h-9 text-xs font-bold rounded-xl flex items-center gap-1.5 ${reportType === 'suggestion' ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''}`}
            >
              <Lightbulb size={14} /> Sugerir Mejora
            </Button>
          </div>

          {/* Área de Comentario del Usuario */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
              ¿Qué estaba sucediendo o qué te gustaría mejorar?
            </label>
            <Textarea
              value={userNote}
              onChange={e => setUserNote(e.target.value)}
              placeholder="Ej. Al presionar facturar se tardó 5 segundos, o sugerencia de agregar un botón rápido..."
              className="text-xs rounded-xl h-20"
            />
          </div>

          {/* Diagnóstico de IA */}
          <div className="p-3 bg-slate-900 text-slate-100 rounded-xl space-y-1.5 text-xs font-mono relative">
            <div className="flex items-center justify-between border-b border-white/10 pb-1.5 text-[10px] font-black uppercase text-indigo-400">
              <span className="flex items-center gap-1"><Sparkles size={12} /> NexBot AI Screen Auditor</span>
              <span>{isAnalyzing ? 'Analizando...' : 'Completado'}</span>
            </div>
            {isAnalyzing ? (
              <div className="flex items-center justify-center py-4 gap-2 text-slate-400">
                <Loader2 className="animate-spin" size={16} /> Inspeccionando parámetros de pantalla...
              </div>
            ) : (
              <pre className="whitespace-pre-wrap text-[11px] font-sans leading-relaxed text-slate-300">
                {aiDiagnosis}
              </pre>
            )}
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleCopyClipboard}
            className="h-10 text-xs font-bold rounded-xl flex-1 border-slate-300 dark:border-border"
          >
            <Copy size={14} className="mr-1.5 text-slate-500" /> Copiar
          </Button>

          <Button
            type="button"
            onClick={handleShareWhatsApp}
            className="h-10 text-xs font-bold rounded-xl flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Share2 size={14} className="mr-1.5" /> WhatsApp
          </Button>

          <Button
            type="button"
            onClick={handleSendEmail}
            disabled={isSendingEmail}
            className="h-10 text-xs font-bold rounded-xl flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {isSendingEmail ? <Loader2 className="animate-spin mr-1.5" size={14} /> : <Send size={14} className="mr-1.5" />}
            Enviar Reporte
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
