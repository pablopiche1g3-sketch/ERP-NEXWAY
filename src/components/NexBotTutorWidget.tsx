'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePathname } from 'next/navigation';
import { useBms, logNexbotEvent } from '@/contexts/BmsContext';
import { useToast } from '@/hooks/use-toast';
import { 
  Sparkles, 
  BrainCircuit, 
  HelpCircle, 
  CheckCircle2, 
  XCircle, 
  BookOpen, 
  ChevronRight, 
  ChevronDown, 
  ChevronUp, 
  ShieldCheck, 
  Lightbulb, 
  ArrowRight,
  MessageSquareText
} from 'lucide-react';

export interface AiProposal {
  id: string;
  module: string;
  title: string;
  description: string;
  impact: string;
  actionPayload?: any;
  status: 'pending' | 'approved' | 'rejected';
}

const MODULE_GUIDES: Record<string, { title: string; steps: string[]; taxTip: string }> = {
  '/billing': {
    title: 'Tutoría de Facturación & Emisión de DTE (POS)',
    steps: [
      '1. Selecciona o verifica la Caja y Bodega activa en la barra superior.',
      '2. Agrega los productos al carrito con búsqueda o código de barra.',
      '3. Elige Consumidor Final (CF) o Crédito Fiscal (CCF).',
      '4. Para CCF se requiere Razón Social, NIT y NRC obligatorios.',
      '5. Selecciona el método de pago (Efectivo rápido o Tarjeta/Transferencia) y emite el DTE.'
    ],
    taxTip: '💡 Tip Fiscal El Salvador: Si el cliente es Grande Contribuyente, aplica el 1% de Retención de IVA en compras mayores a $100.00.'
  },
  '/compras': {
    title: 'Tutoría de Gestión de Compras y Proveedores',
    steps: [
      '1. Registra las órdenes de compra solicitadas a proveedores.',
      '2. Al recibir la mercadería, confirma el ingreso para actualizar el Kardex.',
      '3. Registra el documento del proveedor (Factura o CCF).',
      '4. Verifica las retenciones de IVA (1% o 13%) según la clasificación del proveedor.'
    ],
    taxTip: '💡 Tip Fiscal: El Crédito Fiscal debe incluir el NRC y NIT del proveedor para deducir el IVA en el Informe F07.'
  },
  '/finanzas': {
    title: 'Tutoría de Finanzas, Bancos y Tesorería',
    steps: [
      '1. Revisa la proyección de Flujo de Caja a 30, 60 y 90 días.',
      '2. Registra los saldos de Cuentas Bancarias y concilia los estados en CSV.',
      '3. Consulta la evaluación de Credit Scoring antes de aprobar créditos a clientes.',
      '4. Genera archivos TXT masivos para pago a proveedores vía banca en línea empresarial.'
    ],
    taxTip: '💡 Tip Financiero: Mantén un margen de liquidez de al menos 1.5 en el indicador Razón Corriente.'
  },
  '/management': {
    title: 'Tutoría de Gerencia, Nómina y Configuración',
    steps: [
      '1. En Nómina y RH, ingresa los salarios base de tus colaboradores.',
      '2. El sistema calcula automáticamente ISSS (3% max $30), AFP (7.25%) e ISR Renta (Tabla 4 tramos).',
      '3. Gestiona préstamos y anticipos de empleados descontados de planilla.',
      '4. Diseña las plantillas de impresión (Ticket 80mm o Carta) en el Diseñador Modular.'
    ],
    taxTip: '💡 Tip Legal El Salvador: Las retenciones de renta e ISSS/AFP deben declararse antes del día 10 de cada mes.'
  },
  '/logistica': {
    title: 'Tutoría de Logística, Inventarios y Traslados',
    steps: [
      '1. Revisa el existencias físicas por bodega.',
      '2. Realiza traslados entre bodegas con confirmación de recepción.',
      '3. Consulta el historial de movimientos de Kardex por SKU.',
      '4. Monitorea los avisos de stock mínimo para evitar roturas de inventario.'
    ],
    taxTip: '💡 Tip Logístico: Realiza conteos cíclicos semanales en los productos de clasificación A (mayor valor).'
  }
};

export function NexBotTutorWidget() {
  const pathname = usePathname();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'guide' | 'proposals'>('guide');

  // Propuestas de Sugerencias Proactivas con Aprobación BMS
  const [proposals, setProposals] = useState<AiProposal[]>([
    {
      id: 'prop_1',
      module: 'finanzas',
      title: 'Sugerencia de Reconciliación Bancaria',
      description: 'Se detectó 1 depósito abonado coincidente con la factura pendiente del cliente.',
      impact: 'Conciliación Automática de Factura Pendiente',
      status: 'pending'
    },
    {
      id: 'prop_2',
      module: 'billing',
      title: 'Sugerencia de Reabastecimiento POS',
      description: 'El SKU CEMENTO-01 tiene 4 unidades en bodega principal y se proyectan 15 ventas hoy.',
      impact: 'Generación de Orden de Compra Sugerida',
      status: 'pending'
    }
  ]);

  const currentGuide = MODULE_GUIDES[pathname] || {
    title: 'Tutoría General NexWay ERP',
    steps: [
      '1. Explora el menú superior para navegar entre módulos.',
      '2. NexBot te asesora en cada pantalla según los procesos legales y comerciales.',
      '3. Ninguna acción destructiva se ejecuta sin tu confirmación manual.'
    ],
    taxTip: '💡 Tip ERP: Revisa el monitor de rendimiento y personaliza el tema visual en Gerencia.'
  };

  const handleApproveProposal = (proposal: AiProposal) => {
    setProposals(prev => prev.map(p => p.id === proposal.id ? { ...p, status: 'approved' } : p));
    
    logNexbotEvent(
      'management',
      'APROBACION_PROPUESTA_IA',
      { proposalId: proposal.id, title: proposal.title },
      `El usuario aprobó la sugerencia de IA: "${proposal.title}". Acción ejecutada en el BMS.`
    );

    toast({
      title: 'Propuesta Aprobada y Aplicada',
      description: `Se ejecutó la acción: ${proposal.impact}`
    });
  };

  const handleRejectProposal = (proposal: AiProposal) => {
    setProposals(prev => prev.map(p => p.id === proposal.id ? { ...p, status: 'rejected' } : p));
    toast({
      title: 'Propuesta Descartada',
      description: `La sugerencia de la IA fue archivada.`
    });
  };

  const pendingCount = proposals.filter(p => p.status === 'pending').length;

  return (
    <div className="fixed bottom-5 right-5 z-50 animate-in fade-in duration-300">
      {!isOpen ? (
        <Button
          onClick={() => setIsOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs h-12 px-4 rounded-full shadow-2xl flex items-center gap-2 border border-indigo-400/30 transition-all transform hover:scale-105"
        >
          <BrainCircuit size={18} className="animate-pulse text-amber-300" />
          <span>Tutoría & Asesoría IA</span>
          {pendingCount > 0 && (
            <Badge className="bg-amber-500 text-slate-900 border-0 text-[10px] font-black px-1.5 py-0.5 rounded-full ml-1">
              {pendingCount}
            </Badge>
          )}
        </Button>
      ) : (
        <Card className="w-80 sm:w-96 border shadow-2xl rounded-3xl bg-card overflow-hidden transition-all animate-in slide-in-from-bottom-5">
          {/* Header */}
          <div className="bg-slate-900 dark:bg-slate-950 p-4 text-white flex justify-between items-center border-b border-white/10">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-600/30 rounded-xl text-indigo-400">
                <BrainCircuit size={18} />
              </div>
              <div>
                <h4 className="text-xs font-black tracking-wide flex items-center gap-1.5">
                  NexBot AI Tutor
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-[8px] font-bold">Aprobación BMS Guard</Badge>
                </h4>
                <p className="text-[10px] text-slate-400">Asistente Co-Piloto & Tutor en Tiempo Real</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="h-7 w-7 text-slate-400 hover:text-white rounded-full">
              <ChevronDown size={18} />
            </Button>
          </div>

          {/* Subtabs */}
          <div className="flex border-b bg-muted/40 p-1">
            <button
              onClick={() => setActiveSubTab('guide')}
              className={`flex-1 py-1.5 text-[11px] font-bold rounded-xl transition-all ${
                activeSubTab === 'guide' ? 'bg-background text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              📖 Guía del Módulo
            </button>
            <button
              onClick={() => setActiveSubTab('proposals')}
              className={`flex-1 py-1.5 text-[11px] font-bold rounded-xl transition-all flex items-center justify-center gap-1 ${
                activeSubTab === 'proposals' ? 'bg-background text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              💡 Propuestas ({pendingCount})
            </button>
          </div>

          {/* Content */}
          <CardContent className="p-4 space-y-4 max-h-96 overflow-y-auto">
            {activeSubTab === 'guide' ? (
              <div className="space-y-3">
                <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl">
                  <h5 className="text-xs font-black text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 mb-1">
                    <BookOpen size={14} /> {currentGuide.title}
                  </h5>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                    Pasos recomendados para completar procesos en esta pantalla:
                  </p>
                </div>

                <div className="space-y-1.5 pl-1">
                  {currentGuide.steps.map((step, idx) => (
                    <div key={idx} className="text-[11px] text-slate-700 dark:text-slate-300 flex items-start gap-2 bg-muted/30 p-2 rounded-xl border border-border/50">
                      <ChevronRight size={13} className="text-indigo-500 shrink-0 mt-0.5" />
                      <span>{step}</span>
                    </div>
                  ))}
                </div>

                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-[11px] font-medium text-amber-700 dark:text-amber-300 flex items-start gap-2">
                  <Lightbulb size={16} className="text-amber-500 shrink-0 mt-0.5" />
                  <span>{currentGuide.taxTip}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-2.5 bg-slate-900 text-white rounded-2xl text-[10px] flex items-center justify-between">
                  <span className="flex items-center gap-1"><ShieldCheck size={14} className="text-emerald-400" /> Control de Aprobación Activo</span>
                  <span className="text-slate-400">Sin auto-ejecución</span>
                </div>

                {proposals.map(prop => (
                  <Card key={prop.id} className="border shadow-sm p-3 rounded-2xl bg-card space-y-2">
                    <div className="flex justify-between items-start">
                      <Badge className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-0 text-[8px] font-black uppercase">
                        Sugerencia Proactiva
                      </Badge>
                      <Badge className={`border-0 text-[8px] font-black uppercase ${
                        prop.status === 'approved' ? 'bg-emerald-500/20 text-emerald-500' :
                        prop.status === 'rejected' ? 'bg-rose-500/20 text-rose-500' : 'bg-amber-500/20 text-amber-500'
                      }`}>
                        {prop.status === 'approved' ? 'Aprobada' : prop.status === 'rejected' ? 'Descartada' : 'Aprobación Requerida'}
                      </Badge>
                    </div>

                    <h6 className="text-xs font-black text-slate-800 dark:text-white">{prop.title}</h6>
                    <p className="text-[10px] text-slate-500">{prop.description}</p>
                    <p className="text-[10px] font-bold text-indigo-500">Impacto: {prop.impact}</p>

                    {prop.status === 'pending' && (
                      <div className="flex gap-2 pt-1 border-t">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRejectProposal(prop)}
                          className="h-7 text-[10px] font-bold flex-1 text-slate-400 hover:text-slate-600"
                        >
                          <XCircle size={12} className="mr-1" /> Descartar
                        </Button>

                        <Button
                          size="sm"
                          onClick={() => handleApproveProposal(prop)}
                          className="h-7 text-[10px] font-bold flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                        >
                          <CheckCircle2 size={12} className="mr-1" /> Aprobar y Aplicar
                        </Button>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
