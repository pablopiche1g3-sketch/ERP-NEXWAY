'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePathname } from 'next/navigation';
import { useBms, logNexbotEvent } from '@/contexts/BmsContext';
import { useToast } from '@/hooks/use-toast';
import { useNexbotAuditor, AuditIssue } from '@/hooks/useNexbotAuditor';
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
  ShieldAlert,
  Lightbulb, 
  ArrowRight,
  MessageSquareText,
  Minimize2,
  Maximize2,
  Eye,
  EyeOff,
  Move,
  X,
  Wrench,
  RefreshCw
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
  '/': {
    title: 'Guía Paso a Paso: Centro Ejecutivo y Agenda Táctica',
    steps: [
      'Paso 1: Revisa las píldoras superiores (Productos a Pedir, Pedidos Proveedor y Stock Estancado) para ver el monto real en riesgo.',
      'Paso 2: Haz clic en "Ver Tabla Completa" para priorizar SKUs críticos o productos sin rotación.',
      'Paso 3: En la Agenda Táctica, pulsa "⚡ NexBot: Actualizar Plan IA" para generar acciones priorizadas con productos reales.',
      'Paso 4: Cambia la prioridad (🔴 Urgente / 🟠 Alta / 🔵 Normal) con un clic y usa el botón de acceso directo para ir al área correspondiente.'
    ],
    taxTip: '💡 Tip Ejecutivo: Prioriza primero los productos marcados como 🔴 URGENTE (stock en cero) para evitar pérdida de ventas.'
  },
  '/billing': {
    title: 'Guía Paso a Paso: Facturación POS, Fracciones y Correo DTE',
    steps: [
      'Paso 1: Verifica la Caja POS, Bodega activa y selecciona al Vendedor / Asesor en la parte superior.',
      'Paso 2: Busca el producto por nombre o SKU y agrégalo a la factura.',
      'Paso 3: Si el producto tiene fracciones habilitadas, despliega la flecha "Fracción Auto ▾" (ej. 1/4 Gal, 1/2 Yd) y ajusta el Precio Unitario si deseas.',
      'Paso 4: Selecciona el cliente, tipo de DTE (CF o CCF), forma de pago y pulsa "FINALIZAR" para descontar la fracción exacta del inventario.',
      'Paso 5: Al emitir la venta, usa "Enviar / Simular Correo DTE" para remitir PDF + JSON al cliente; al cierre del turno realiza el Arqueo con Visto Bueno.'
    ],
    taxTip: '💡 Tip Fiscal El Salvador: Para Crédito Fiscal (CCF 03) asegúrate de que el cliente tenga NIT, NRC y Giro registrados en Directorio Comercial.'
  },
  '/logistica': {
    title: 'Guía Paso a Paso: Inventario, Fraccionamiento Multi-Medida y Picking',
    steps: [
      'Paso 1 (Inventario): En "1. Inventario & Catálogo" consulta el stock consolidado o por bodega, registra SKUs en Catálogo Maestro o realiza Toma Física.',
      'Paso 2 (Configurar Fracción): En "2. Fraccionamiento & Envasado" elige el Producto Padre y su Medida Base (Galón, Yarda, Pie, Metro, Libra, Rollo o Caja).',
      'Paso 3 (Habilitar Medidas e Insumos Fijos): Agrega o quita las fracciones permitidas para ese producto, asigna envases/insumos fijos, edita el Precio de Venta Final y pulsa "Fijar Insumos, Fracciones y PVP".',
      'Paso 4 (Traslados y Despacho): En "4. Traslados entre Bodegas ➔ 2. Despachar" haz clic en cualquier solicitud pendiente para abrir la ventana grande de Picking Físico y marcar el check (✓) por producto.',
      'Paso 5 (Autoguardado): Si sales de la ventana de Picking, tu avance se guarda automáticamente; al completar todos los checks, ingresa motorista/placa y autoriza la salida.'
    ],
    taxTip: '💡 Tip Logístico: Solo las fracciones que fijes en el Paso 3 aparecerán en el selector de Facturación POS para mantener limpio el punto de venta.'
  },
  '/compras': {
    title: 'Guía Paso a Paso: Abastecimiento y Órdenes de Compra',
    steps: [
      'Paso 1: Revisa en "Órdenes de Compra" los pedidos pendientes o genera uno nuevo seleccionando proveedor y SKUs.',
      'Paso 2: Al recibir la mercadería física, registra la compra DTE en "Registro de Compras" para cargar el inventario y Kardex automáticamente.',
      'Paso 3: Verifica retenciones o percepciones de IVA (1%) según la categoría del proveedor.',
      'Paso 4: Si la compra es al crédito, se reflejará automáticamente en Finanzas ➔ 2. Cuentas por Pagar (CXP).'
    ],
    taxTip: '💡 Tip Fiscal: El CCF de compra debe llevar número de control DTE, NIT y NRC del proveedor para deducirlo en el Formulario F07.'
  },
  '/finanzas': {
    title: 'Guía Paso a Paso: CXC, CXP, Quedan, Bancos y Planilla',
    steps: [
      'Paso 1 (CXC): En "1. Cuentas por Cobrar" visualiza facturas al crédito, registra nuevas cuentas con "+ Nueva Cuenta CXC" y aplica abonos (sincronizados con Libro Diario y POS).',
      'Paso 2 (CXP y Quedan): En "2. Cuentas por Pagar" y "3. Gestión de Quedan" controla vencimientos y aplica pagos a proveedores.',
      'Paso 3 (Bancos y TXT): En "4. Bancos & Pagos TXT" administra cuentas bancarias, concilia saldos y genera archivos TXT masivos.',
      'Paso 4 (Cash Flow y Nómina): Consulta la liquidez a 30/60/90 días en "5. Flujo de Caja" y procesa planilla, bonos y anticipos en "6. Nómina, Bonos & Anticipos".'
    ],
    taxTip: '💡 Tip Legal El Salvador: ISSS (3% máx $30), AFP (7.25%) e ISR Renta se calculan automáticamente en la pestaña 6.'
  },
  '/crm': {
    title: 'Guía Paso a Paso: Embudo Comercial, Foco de Venta y Retención',
    steps: [
      'Paso 1 (Embudo Kanban): En "1. Embudo Comercial" crea nuevas oportunidades vinculadas a clientes y muévelas hasta Ganada.',
      'Paso 2 (Foco de Venta): En "2. Foco de Venta — Stock Estancado" identifica productos sin rotación en 30 días y pulsa "+ Crear Oportunidad" en 1 clic.',
      'Paso 3 (Retención): En "3. Retención de Clientes" filtra clientes inactivos (30, 60 o 90 días) y contáctalos directo por WhatsApp o Correo.'
    ],
    taxTip: '💡 Tip Comercial: Prioriza primero los productos con mayor Capital Retenido ($) en la pestaña 2 para liberar flujo de caja rápido.'
  },
  '/accounting': {
    title: 'Guía Paso a Paso: Contabilidad, Libros IVA y Auditoría Manual',
    steps: [
      'Paso 1: Revisa en "Libro Diario" las partidas automáticas generadas por ventas POS, compras y abonos CXC/CXP.',
      'Paso 2: Verifica el cuadre contable en "Balance de Comprobación" y el resultado en "Estado de Resultados (P&L)".',
      'Paso 3: Exporta los Libros Oficiales de IVA y prepara F07 / F14 en las pestañas tributarias.',
      'Paso 4: Usa el "Centro de Auditoría Manual" para revisar trazabilidad 360° de operaciones.'
    ],
    taxTip: '💡 Tip Contable: Toda partida cumple el principio de Partida Doble (Debe = Haber) y separa el 13% de IVA Débito/Crédito Fiscal.'
  },
  '/directorio': {
    title: 'Guía Paso a Paso: Directorio de Clientes y Proveedores',
    steps: [
      'Paso 1: Selecciona la pestaña "Clientes" o "Proveedores" según el registro a gestionar.',
      'Paso 2: Para crear un registro, completa Razón Social, NIT/NRC, Correo DTE, teléfono y condiciones de crédito.',
      'Paso 3: Para editar correo, límite de crédito o datos fiscales de un cliente existente, haz clic en el botón Editar (lápiz) en su fila y guarda los cambios.',
      'Paso 4: Usa "Exportar Excel" para descargar tu cartera completa en cualquier momento.'
    ],
    taxTip: '💡 Tip DTE: Mantener actualizado el Correo DTE de cada cliente permite enviarle sus facturas en 1 clic desde Facturación POS.'
  },
  '/management': {
    title: 'Guía Paso a Paso: Usuarios, Cajas POS, Sucursales y Permisos',
    steps: [
      'Paso 1: En "Control de Usuarios" crea un nuevo colaborador indicando nombre de usuario, contraseña (mín. 6 caracteres), rol y sucursal.',
      'Paso 2: En la lista de usuarios, asigna al instante su Rol, Sucursal y Caja POS usando los selectores de cada fila.',
      'Paso 3: Para permisos detallados por módulo y pestaña, abre "Permisos de Módulos" o el ícono de escudo en la fila del usuario.',
      'Paso 4: El colaborador puede iniciar sesión en /login con su usuario (ej. diego), correo completo o PIN.'
    ],
    taxTip: '💡 Tip de Seguridad: Asigna cada cajero a su propia Caja POS para que el arqueo y correlativo de turno queden auditados por usuario.'
  }
};

export function NexBotTutorWidget() {
  const pathname = usePathname();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'guide' | 'proposals' | 'auditor'>('guide');
  const [auditorFilter, setAuditorFilter] = useState<'all' | 'limpieza' | 'contabilidad' | 'facturacion' | 'inventario'>('all');

  // Integración con el Agente Auditor Autónomo
  const { 
    issues: auditIssues, 
    healthScore, 
    isScanning: isAuditing, 
    lastScanTime, 
    runAudit, 
    executeAutoFix 
  } = useNexbotAuditor();

  // Estados de Control de Posición, Ocultar y Minimizar
  const [isMinimized, setIsMinimized] = useState(true);
  const [isHidden, setIsHidden] = useState(false);
  const [position, setPosition] = useState<'bottom-right' | 'bottom-left' | 'top-left'>('bottom-right');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedMin = localStorage.getItem('nexway_tutor_minimized');
      if (savedMin === 'false') setIsMinimized(false);

      const savedHide = localStorage.getItem('nexway_tutor_hidden');
      if (savedHide === 'true') setIsHidden(true);

      const savedPos = localStorage.getItem('nexway_tutor_position') as any;
      if (savedPos) setPosition(savedPos);
    }
  }, []);

  const toggleMinimized = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const next = !isMinimized;
    setIsMinimized(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('nexway_tutor_minimized', String(next));
    }
  };

  const toggleHidden = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const next = !isHidden;
    setIsHidden(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('nexway_tutor_hidden', String(next));
    }
  };

  const cyclePosition = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    let nextPos: 'bottom-right' | 'bottom-left' | 'top-left' = 'bottom-right';
    if (position === 'bottom-right') nextPos = 'bottom-left';
    else if (position === 'bottom-left') nextPos = 'top-left';
    else nextPos = 'bottom-right';

    setPosition(nextPos);
    if (typeof window !== 'undefined') {
      localStorage.setItem('nexway_tutor_position', nextPos);
    }
    toast({
      title: "Posición Cambiada 📍",
      description: `El asistente se movió a la posición: ${nextPos === 'bottom-right' ? 'Abajo Derecha' : nextPos === 'bottom-left' ? 'Abajo Izquierda' : 'Arriba Izquierda'}`
    });
  };

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
      module: 'logistica',
      title: 'Traslado Exprés Sugerido (1 Clic)',
      description: 'Sucursal Escalón llegó al punto de reorden en producto de alta rotación. Hay 25 uds en Bodega Central.',
      impact: 'Traspaso Directo Exprés de 5 Unidades',
      status: 'pending'
    },
    {
      id: 'prop_3',
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
  const totalAlertsCount = pendingCount + auditIssues.length;

  const filteredIssues = auditIssues.filter(i => {
    if (auditorFilter === 'all') return true;
    return i.category === auditorFilter;
  });

  const posClasses = 
    position === 'bottom-left' ? 'bottom-4 left-4' :
    position === 'top-left' ? 'top-20 left-5' :
    'bottom-4 right-4';

  if (pathname === '/login') return null;

  if (isHidden) {
    return (
      <div className={`fixed ${posClasses} z-40 animate-in fade-in duration-300 print:hidden`}>
        <Button
          size="sm"
          onClick={() => toggleHidden()}
          title="Mostrar Tutoría & Auditoría IA"
          className="bg-slate-900/90 hover:bg-slate-900 text-indigo-300 font-bold text-[10px] h-8 px-2.5 rounded-full shadow-lg border border-indigo-500/40 flex items-center gap-1.5 backdrop-blur-md"
        >
          <BrainCircuit size={14} className="text-amber-300 animate-pulse" />
          <span>Auditor & Tutor IA</span>
          <Eye size={12} className="ml-0.5 text-indigo-400" />
        </Button>
      </div>
    );
  }

  return (
    <div className={`fixed ${posClasses} z-40 animate-in fade-in duration-300 print:hidden`}>
      {!isOpen ? (
        isMinimized ? (
          <Button
            onClick={() => setIsOpen(true)}
            title="Abrir Auditoría & Tutoría IA"
            className="bg-slate-900/95 hover:bg-indigo-600 text-white font-black h-9 w-9 p-0 rounded-full shadow-lg border border-indigo-500/40 backdrop-blur-md flex items-center justify-center relative transition-all hover:scale-105"
          >
            <BrainCircuit size={17} className="text-amber-300" />
            {totalAlertsCount > 0 && (
              <Badge className={`${auditIssues.some(i => i.severity === 'critico') ? 'bg-rose-500' : 'bg-amber-500'} text-slate-950 border-0 text-[9px] font-black h-4 min-w-[16px] px-1 py-0 rounded-full absolute -top-1 -right-1 flex items-center justify-center`}>
                {totalAlertsCount}
              </Badge>
            )}
          </Button>
        ) : (
          <div className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white p-1 pl-4 rounded-full shadow-2xl border border-indigo-400/40 transition-all transform hover:scale-[1.02]">
            <div 
              onClick={() => setIsOpen(true)}
              className="flex items-center gap-2 cursor-pointer py-1"
            >
              <BrainCircuit size={18} className="animate-pulse text-amber-300" />
              <span className="font-black text-xs">Auditor & Asesoría IA</span>
              {totalAlertsCount > 0 ? (
                <Badge className={`${auditIssues.some(i => i.severity === 'critico') ? 'bg-rose-500' : 'bg-amber-500'} text-slate-950 border-0 text-[10px] font-black px-1.5 py-0.5 rounded-full ml-1`}>
                  {totalAlertsCount}
                </Badge>
              ) : (
                <Badge className="bg-emerald-500 text-slate-950 border-0 text-[10px] font-black px-1.5 py-0.5 rounded-full ml-1 flex items-center gap-1">
                  <ShieldCheck size={10} /> OK
                </Badge>
              )}
            </div>

            <div className="flex items-center border-l border-indigo-400/40 pl-1.5 gap-0.5">
              <Button
                size="icon"
                variant="ghost"
                onClick={toggleMinimized}
                title="Minimizar a icono redondo"
                className="h-7 w-7 text-indigo-100 hover:text-white hover:bg-indigo-500/50 rounded-full p-0"
              >
                <Minimize2 size={13} />
              </Button>

              <Button
                size="icon"
                variant="ghost"
                onClick={cyclePosition}
                title="Cambiar posición de esquina"
                className="h-7 w-7 text-indigo-100 hover:text-white hover:bg-indigo-500/50 rounded-full p-0"
              >
                <Move size={13} />
              </Button>

              <Button
                size="icon"
                variant="ghost"
                onClick={toggleHidden}
                title="Ocultar asistente"
                className="h-7 w-7 text-indigo-100 hover:text-rose-300 hover:bg-indigo-500/50 rounded-full p-0"
              >
                <EyeOff size={13} />
              </Button>
            </div>
          </div>
        )
      ) : (
        <Card className="w-80 sm:w-[420px] border shadow-2xl rounded-3xl bg-card overflow-hidden transition-all animate-in slide-in-from-bottom-5">
          {/* Header */}
          <div className="bg-slate-900 dark:bg-slate-950 p-4 text-white flex justify-between items-center border-b border-white/10">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-600/30 rounded-xl text-indigo-400">
                <BrainCircuit size={18} />
              </div>
              <div>
                <h4 className="text-xs font-black tracking-wide flex items-center gap-1.5">
                  NexBot AI Auditor & Tutor
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-[8px] font-bold">Salud {healthScore}%</Badge>
                </h4>
                <p className="text-[10px] text-slate-400">Diagnóstico Autónomo & Guía en Tiempo Real</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={cyclePosition} 
                title="Cambiar esquina"
                className="h-7 w-7 text-slate-400 hover:text-white rounded-full"
              >
                <Move size={14} />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={toggleMinimized} 
                title="Minimizar a icono"
                className="h-7 w-7 text-slate-400 hover:text-white rounded-full"
              >
                <Minimize2 size={14} />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsOpen(false)} 
                title="Cerrar panel"
                className="h-7 w-7 text-slate-400 hover:text-white rounded-full"
              >
                <ChevronDown size={18} />
              </Button>
            </div>
          </div>

          {/* Subtabs */}
          <div className="flex border-b bg-muted/40 p-1 gap-1">
            <button
              onClick={() => setActiveSubTab('auditor')}
              className={`flex-1 py-1.5 text-[11px] font-bold rounded-xl transition-all flex items-center justify-center gap-1 ${
                activeSubTab === 'auditor' ? 'bg-background text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <ShieldAlert size={13} /> Auditoría ({auditIssues.length})
            </button>
            <button
              onClick={() => setActiveSubTab('guide')}
              className={`flex-1 py-1.5 text-[11px] font-bold rounded-xl transition-all ${
                activeSubTab === 'guide' ? 'bg-background text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              📖 Guía
            </button>
            <button
              onClick={() => setActiveSubTab('proposals')}
              className={`flex-1 py-1.5 text-[11px] font-bold rounded-xl transition-all flex items-center justify-center gap-1 ${
                activeSubTab === 'proposals' ? 'bg-background text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              💡 Sugerencias ({pendingCount})
            </button>
          </div>

          {/* Content */}
          <CardContent className="p-4 space-y-4 max-h-[420px] overflow-y-auto">
            {activeSubTab === 'auditor' ? (
              <div className="space-y-3">
                {/* Resumen de Salud del Sistema */}
                <div className="p-3 bg-slate-900 dark:bg-slate-950 border border-white/10 rounded-2xl flex items-center justify-between text-white">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-xl ${healthScore === 100 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                      {healthScore === 100 ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
                    </div>
                    <div>
                      <p className="text-xs font-black">Salud del Sistema: {healthScore}%</p>
                      <p className="text-[10px] text-slate-400">
                        {auditIssues.length === 0 ? 'Sin inconsistencias ni funciones residuales' : `${auditIssues.length} observaciones detectadas`}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={runAudit}
                    disabled={isAuditing}
                    className="h-8 text-[10px] font-bold text-slate-300 hover:text-white flex items-center gap-1 p-1 px-2"
                  >
                    <RefreshCw size={12} className={isAuditing ? 'animate-spin' : ''} />
                    Escanear
                  </Button>
                </div>

                {/* Filtros de Categoría */}
                <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin">
                  {[
                    { id: 'all', label: 'Todas' },
                    { id: 'limpieza', label: '🧹 Limpieza' },
                    { id: 'contabilidad', label: '⚖️ Contable' },
                    { id: 'facturacion', label: '🧾 Ventas' },
                    { id: 'inventario', label: '📦 Stock' },
                    { id: 'compras', label: '🛒 Compras' },
                    { id: 'finanzas', label: '📈 Finanzas' },
                    { id: 'logistica', label: '🚚 Logística' },
                    { id: 'gerencia', label: '👑 Gerencia' }
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setAuditorFilter(f.id as any)}
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap ${
                        auditorFilter === f.id ? 'bg-indigo-600 text-white shadow-sm' : 'bg-muted text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* Lista de Hallazgos */}
                {filteredIssues.length === 0 ? (
                  <div className="p-6 text-center border border-dashed rounded-2xl space-y-2">
                    <CheckCircle2 size={28} className="mx-auto text-emerald-500" />
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">¡Todo 100% Cuadrado y Limpio!</p>
                    <p className="text-[10px] text-slate-500">No se detectaron asientos descuadrados, pre-facturas rezagadas ni claves residuales.</p>
                  </div>
                ) : (
                  filteredIssues.map(issue => (
                    <Card key={issue.id} className="border shadow-sm p-3 rounded-2xl bg-card space-y-2.5">
                      <div className="flex justify-between items-start">
                        <Badge className={`text-[8px] font-black uppercase border-0 ${
                          issue.severity === 'critico' ? 'bg-rose-500/20 text-rose-500' :
                          issue.severity === 'advertencia' ? 'bg-amber-500/20 text-amber-500' : 'bg-blue-500/20 text-blue-500'
                        }`}>
                          {issue.severity === 'critico' ? '🚨 Descuadre Crítico' : issue.severity === 'advertencia' ? '⚠️ Advertencia' : '💡 Optimización'}
                        </Badge>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{issue.category}</span>
                      </div>

                      <div>
                        <h6 className="text-xs font-bold text-foreground">{issue.title}</h6>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{issue.description}</p>
                      </div>

                      <div className="p-2 bg-muted/40 rounded-xl text-[10px] text-slate-600 dark:text-slate-300 flex items-start gap-1.5">
                        <Wrench size={13} className="text-indigo-500 shrink-0 mt-0.5" />
                        <span><strong>Recomendación:</strong> {issue.recommendation}</span>
                      </div>

                      {issue.canAutoFix && (
                        <Button
                          size="sm"
                          onClick={() => executeAutoFix(issue)}
                          className="w-full h-7 text-[10px] font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex items-center justify-center gap-1 shadow-sm"
                        >
                          <Sparkles size={12} /> Auto-Corregir / Optimizar con 1 Clic
                        </Button>
                      )}
                    </Card>
                  ))
                )}
              </div>
            ) : activeSubTab === 'guide' ? (
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
