'use client';

import React, { useState } from 'react';
import { 
  Search, Paperclip, Clock, Star, Inbox, Send, File, 
  Tag, MoreVertical, Plus, ChevronRight, ChevronLeft, Settings, 
  HelpCircle, Grid, Image as ImageIcon, FileText,
  AlertCircle, SlidersHorizontal, RotateCcw, Database
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Attachment {
  name: string;
  type: 'pdf' | 'image' | 'xml';
}

interface Email {
  id: string;
  sender: string;
  subject: string;
  date: string;
  isRead: boolean;
  isStarred: boolean;
  snippet: string;
  attachments?: Attachment[];
}

const mockEmails: Email[] = [
  {
    id: '1',
    sender: 'Proveedor de Materiales',
    subject: 'Cotización solicitada para proyecto norte',
    date: '10:30',
    isRead: false,
    isStarred: true,
    snippet: 'Adjunto la cotización para los insumos solicitados el día de ayer. Quedo atento a comentarios...',
    attachments: [
      { name: 'Cotizacion_01.pdf', type: 'pdf' }
    ]
  },
  {
    id: '2',
    sender: 'Facturación Electrónica',
    subject: 'Nueva Factura DTE-001923',
    date: 'Ayer',
    isRead: false,
    isStarred: false,
    snippet: 'Se ha emitido un nuevo Comprobante de Crédito Fiscal a su nombre. Puede revisar los documentos adjuntos...',
    attachments: [
      { name: 'DTE-001923.pdf', type: 'pdf' },
      { name: 'DTE-001923.xml', type: 'xml' }
    ]
  },
  {
    id: '3',
    sender: 'Soporte TI',
    subject: 'Actualización de licencias de software',
    date: 'Ayer',
    isRead: true,
    isStarred: true,
    snippet: 'Le informamos que las licencias han sido renovadas exitosamente para el siguiente periodo...',
  },
  {
    id: '4',
    sender: 'Distribuidora Global',
    subject: 'Estado de su pedido #4891',
    date: '28 jun',
    isRead: true,
    isStarred: false,
    snippet: 'Su pedido se encuentra en tránsito y será entregado en un máximo de 24 horas hábiles...',
  },
  {
    id: '5',
    sender: 'Servicios Logísticos S.A.',
    subject: 'Comprobante de entrega firmado',
    date: '27 jun',
    isRead: true,
    isStarred: false,
    snippet: 'Adjuntamos la constancia de entrega firmada en bodega principal con fecha de ayer...',
    attachments: [
      { name: 'firma_recibido.png', type: 'image' },
      { name: 'manifiesto.pdf', type: 'pdf' }
    ]
  }
];

export default function GmailSuppliersTab() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFolder, setActiveFolder] = useState('recibidos');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { toast } = useToast();

  const filteredEmails = mockEmails.filter(email => 
    email.subject.toLowerCase().includes(searchTerm.toLowerCase()) || 
    email.sender.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleStoreInCatalog = async (email: Email, event: React.MouseEvent) => {
    event.stopPropagation();
    setProcessingId(email.id);
    
    try {
      // Simulamos la extracción de un payload JSON desde el XML adjunto
      const mockPayload = {
        identificacion: { numeroControl: `DTE-${Math.floor(Math.random() * 10000)}` },
        emisor: { nombre: email.sender, nit: '0614-010101-101-1' },
        cuerpoDocumento: [
          { codigo: 'PROD-01', descripcion: 'Producto Simulado 1', cantidad: 10, precioUni: 25.50 },
          { codigo: 'PROD-02', descripcion: 'Producto Simulado 2', cantidad: 5, precioUni: 12.00 }
        ],
        resumen: { totalPagar: 315.00 }
      };

      const { error } = await supabase.from('facturas_proveedores_json').insert({
        proveedor_nit: mockPayload.emisor.nit,
        proveedor_nombre: mockPayload.emisor.nombre,
        documento_numero: mockPayload.identificacion.numeroControl,
        payload_json: mockPayload,
        estado: 'PENDIENTE_PROCESAR'
      });

      if (error) throw error;

      toast({
        title: "DTE Almacenado",
        description: `El documento ${mockPayload.identificacion.numeroControl} se ha enviado al Catálogo de Compras.`
      });
    } catch (err: any) {
      console.error(err);
      toast({
        variant: "destructive",
        title: "Error al almacenar",
        description: err.message || "No se pudo guardar el DTE en el catálogo."
      });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] w-full flex bg-[#f6f8fc] dark:bg-[#1a1a24] overflow-hidden rounded-xl border border-slate-200 dark:border-white/10 font-sans shadow-inner">
      
      {/* LEFT SIDEBAR (GMAIL STYLE) */}
      <div className="w-[250px] min-w-[250px] hidden md:flex flex-col bg-[#f6f8fc] dark:bg-[#1a1a24] h-full p-3 overflow-y-auto custom-scrollbar">
        <Button className="w-[140px] h-12 bg-[#c2e7ff] hover:bg-[#b0d8f3] dark:bg-[#c2e7ff]/20 dark:hover:bg-[#c2e7ff]/30 text-[#001d35] dark:text-[#c2e7ff] rounded-2xl shadow-sm mb-4 justify-start px-4 font-medium">
          <Plus size={20} className="mr-3" /> Redactar
        </Button>

        <div className="space-y-0.5 mb-6 text-sm">
          <div className="flex items-center justify-between px-4 py-2 bg-[#d3e3fd] dark:bg-[#004a77]/40 text-[#041e49] dark:text-[#c2e7ff] rounded-r-full cursor-pointer font-bold">
            <div className="flex items-center"><Inbox size={18} className="mr-4" /> Recibidos</div>
            <span className="text-xs">17</span>
          </div>
          <div className="flex items-center px-4 py-2 hover:bg-slate-200/50 dark:hover:bg-white/5 text-slate-700 dark:text-white/70 rounded-r-full cursor-pointer">
            <Star size={18} className="mr-4" /> Destacados
          </div>
          <div className="flex items-center px-4 py-2 hover:bg-slate-200/50 dark:hover:bg-white/5 text-slate-700 dark:text-white/70 rounded-r-full cursor-pointer">
            <Clock size={18} className="mr-4" /> Pospuestos
          </div>
          <div className="flex items-center px-4 py-2 hover:bg-slate-200/50 dark:hover:bg-white/5 text-slate-700 dark:text-white/70 rounded-r-full cursor-pointer">
            <Send size={18} className="mr-4" /> Enviados
          </div>
          <div className="flex items-center justify-between px-4 py-2 hover:bg-slate-200/50 dark:hover:bg-white/5 text-slate-700 dark:text-white/70 rounded-r-full cursor-pointer">
            <div className="flex items-center"><File size={18} className="mr-4" /> Borradores</div>
            <span className="text-xs">1</span>
          </div>
          <div className="flex items-center justify-between px-4 py-2 hover:bg-slate-200/50 dark:hover:bg-white/5 text-slate-700 dark:text-white/70 rounded-r-full cursor-pointer">
            <div className="flex items-center"><Tag size={18} className="mr-4" /> Compras</div>
            <span className="text-xs">5</span>
          </div>
        </div>

        <div className="flex items-center justify-between px-4 mb-2 text-sm font-semibold text-slate-600 dark:text-white/60">
          Etiquetas <Plus size={16} className="cursor-pointer hover:bg-slate-200 dark:hover:bg-white/10 rounded" />
        </div>
        <div className="space-y-0.5 text-sm">
          {['Materiales', 'Equipos TI', 'Servicios Generales', 'Logística', 'Papelería'].map(tag => (
            <div key={tag} className="flex items-center px-4 py-1.5 hover:bg-slate-200/50 dark:hover:bg-white/5 text-slate-600 dark:text-white/60 rounded-r-full cursor-pointer truncate">
              <Tag size={16} className="mr-4 shrink-0 text-slate-400 dark:text-white/40" /> <span className="truncate">{tag}</span>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT MAIN AREA */}
      <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#0a0a14] rounded-xl sm:rounded-none sm:rounded-l-3xl shadow-sm border-l border-slate-200 dark:border-white/10 overflow-hidden m-2 sm:m-0 sm:mt-2">
        
        {/* Top Header Search */}
        <div className="h-16 flex items-center px-4 sm:px-6 gap-4 border-b border-slate-100 dark:border-white/5 bg-white dark:bg-[#0a0a14]">
          <div className="flex-1 max-w-2xl relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <Input 
              placeholder="Buscar correo" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-12 bg-[#eaf1fb] dark:bg-white/5 border-transparent focus-visible:bg-white dark:focus-visible:bg-white/10 focus-visible:shadow-md focus-visible:ring-0 rounded-full w-full"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              <SlidersHorizontal className="h-5 w-5 text-slate-500 cursor-pointer hover:bg-slate-200 dark:hover:bg-white/10 p-1 rounded-full box-content" />
            </div>
          </div>
          
          <div className="hidden sm:flex items-center gap-2 ml-auto text-slate-500 dark:text-white/60">
            <HelpCircle size={22} className="cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 p-1 rounded-full box-content" />
            <Settings size={22} className="cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 p-1 rounded-full box-content" />
            <Grid size={22} className="cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 p-1 rounded-full box-content ml-2" />
          </div>
        </div>

        {/* Toolbar & Pagination */}
        <div className="h-12 flex items-center px-4 border-b border-slate-100 dark:border-white/5 justify-between">
          <div className="flex items-center gap-4 text-slate-500 dark:text-white/60">
            <div className="w-4 h-4 border border-slate-400 rounded-sm cursor-pointer ml-1"></div>
            <RotateCcw size={18} className="cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 p-1 rounded-full box-content" />
            <MoreVertical size={18} className="cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 p-1 rounded-full box-content" />
          </div>
          <div className="text-xs text-slate-500 dark:text-white/60 flex items-center gap-3">
            <span>1-50 de 6,155</span>
            <div className="flex items-center gap-1">
              <ChevronLeft size={18} className="cursor-pointer text-slate-300 dark:text-white/20" />
              <ChevronRight size={18} className="cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5 p-1 rounded-full box-content" />
            </div>
          </div>
        </div>

        {/* Categorization Tabs */}
        <div className="flex border-b border-slate-100 dark:border-white/5">
          <div className="flex items-center gap-4 px-6 py-3 border-b-2 border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 cursor-pointer w-64 hover:bg-slate-50 dark:hover:bg-white/[0.02]">
            <Inbox size={18} />
            <span className="font-semibold text-sm">Principal</span>
          </div>
          <div className="flex items-center gap-4 px-6 py-3 text-slate-600 dark:text-white/60 cursor-pointer w-64 hover:bg-slate-50 dark:hover:bg-white/[0.02]">
            <Tag size={18} />
            <div className="flex flex-col">
              <span className="font-semibold text-sm">Promociones <span className="ml-2 bg-green-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">7 nuevos</span></span>
            </div>
          </div>
          <div className="hidden lg:flex items-center gap-4 px-6 py-3 text-slate-600 dark:text-white/60 cursor-pointer w-64 hover:bg-slate-50 dark:hover:bg-white/[0.02]">
            <AlertCircle size={18} />
            <span className="font-semibold text-sm">Notificaciones</span>
          </div>
        </div>

        {/* Email List Dense */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {filteredEmails.map((email) => (
            <div 
              key={email.id} 
              className={`flex flex-col border-b border-slate-100 dark:border-white/5 cursor-pointer hover:shadow-[inset_1px_0_0_#dadce0,inset_-1px_0_0_#dadce0,0_1px_2px_0_rgba(60,64,67,.3),0_1px_3px_1px_rgba(60,64,67,.15)] dark:hover:shadow-[inset_1px_0_0_#3c4043,inset_-1px_0_0_#3c4043,0_1px_2px_0_rgba(0,0,0,.3),0_1px_3px_1px_rgba(0,0,0,.15)] z-0 hover:z-10 relative transition-none
                ${!email.isRead ? 'bg-white dark:bg-[#1a1a24]' : 'bg-[#f2f6fc] dark:bg-[#0a0a14]/60'}
              `}
            >
              <div className="flex items-center px-4 py-2 gap-3 h-10">
                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 text-slate-300 dark:text-white/30">
                  <div className="w-4 h-4 border border-slate-400 dark:border-white/30 rounded-sm"></div>
                  <Star size={18} className={email.isStarred ? 'text-yellow-400 fill-yellow-400' : 'hover:text-slate-500'} />
                </div>
                
                {/* Sender */}
                <div className={`w-[180px] shrink-0 truncate text-sm ${!email.isRead ? 'font-bold text-slate-800 dark:text-white' : 'text-slate-700 dark:text-white/80'}`}>
                  {email.sender}
                </div>

                {/* Subject & Snippet */}
                <div className="flex-1 truncate text-sm min-w-0 flex items-center">
                  <span className={`${!email.isRead ? 'font-bold text-slate-800 dark:text-white' : 'text-slate-700 dark:text-white/80'} mr-2 truncate shrink-0 max-w-[40%]`}>
                    {email.subject}
                  </span>
                  <span className="text-slate-500 dark:text-white/50 truncate">- {email.snippet}</span>
                </div>

                {/* Date */}
                <div className={`w-[60px] text-right shrink-0 text-xs ${!email.isRead ? 'font-bold text-slate-800 dark:text-white' : 'text-slate-600 dark:text-white/60'}`}>
                  {email.date}
                </div>
              </div>

              {/* Attachments Row */}
              {email.attachments && email.attachments.length > 0 && (
                <div className="flex items-center px-[228px] pb-2 gap-2 overflow-x-auto custom-scrollbar">
                  {email.attachments.map((att, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-slate-200 dark:border-white/10 text-xs font-medium bg-white dark:bg-[#1a1a24] text-slate-600 dark:text-white/70 hover:bg-slate-50 dark:hover:bg-white/5 shrink-0 max-w-[150px]">
                      {att.type === 'image' && <ImageIcon size={14} className="text-red-500 shrink-0" />}
                      {att.type === 'pdf' && <FileText size={14} className="text-red-600 shrink-0" />}
                      {att.type === 'xml' && <File size={14} className="text-blue-500 shrink-0" />}
                      <span className="truncate">{att.name}</span>
                    </div>
                  ))}
                  
                  {/* Botón de Acción Rápida para DTEs */}
                  {email.attachments.some(a => a.type === 'xml' || a.type === 'pdf') && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={(e) => handleStoreInCatalog(email, e)}
                      disabled={processingId === email.id}
                      className="ml-2 h-7 px-3 text-[11px] font-semibold text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100 dark:text-blue-400 dark:border-blue-900/50 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 rounded-full shrink-0"
                    >
                      {processingId === email.id ? (
                        <RotateCcw className="animate-spin mr-1.5 h-3 w-3" />
                      ) : (
                        <Database className="mr-1.5 h-3 w-3" />
                      )}
                      Almacenar DTE
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
