'use client';

import React, { useState } from 'react';
import { Mail, Search, Paperclip, Clock, ArrowRight, User } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface Email {
  id: string;
  sender: string;
  subject: string;
  date: string;
  hasAttachment: boolean;
  isRead: boolean;
  snippet: string;
}

const mockEmails: Email[] = [
  {
    id: '1',
    sender: 'ventas@ferreteria-industrial.com',
    subject: 'Cotización Materiales - Proyecto A',
    date: '10:30 AM',
    hasAttachment: true,
    isRead: false,
    snippet: 'Adjunto la cotización solicitada para los materiales del proyecto...'
  },
  {
    id: '2',
    sender: 'facturacion@distribuidora-global.com',
    subject: 'Factura Electrónica FCF-2023-0891',
    date: 'Ayer',
    hasAttachment: true,
    isRead: true,
    snippet: 'Buen día, adjuntamos la factura electrónica correspondiente a su última compra...'
  },
  {
    id: '3',
    sender: 'soporte@proveedor-logistico.com',
    subject: 'Actualización de Envío #90123',
    date: 'Mar 24',
    hasAttachment: false,
    isRead: true,
    snippet: 'Su pedido ha sido despachado y está en ruta hacia sus instalaciones.'
  }
];

export default function GmailSuppliersTab() {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredEmails = mockEmails.filter(email => 
    email.subject.toLowerCase().includes(searchTerm.toLowerCase()) || 
    email.sender.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Header and Search - Mobile Optimized */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-[#0a0a14] p-4 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-red-500/10 text-red-600 dark:text-red-400 p-2.5 rounded-lg">
            <Mail size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Bandeja de Proveedores</h3>
            <p className="text-xs text-slate-500 dark:text-white/50">Conexión Gmail (Cotizaciones y Facturas)</p>
          </div>
        </div>
        
        <div className="w-full sm:w-auto relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <Input 
            placeholder="Buscar por asunto, remitente..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 rounded-xl w-full sm:w-[280px]"
          />
        </div>
      </div>

      {/* Email List */}
      <div className="space-y-3">
        {filteredEmails.map((email) => (
          <Card key={email.id} className={`overflow-hidden transition-all hover:shadow-md cursor-pointer border-l-4 ${!email.isRead ? 'border-l-indigo-500 bg-white dark:bg-[#0a0a14]' : 'border-l-transparent bg-slate-50/50 dark:bg-white/[0.02]'}`}>
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
                
                <div className="flex items-start gap-4 flex-1">
                  <div className={`hidden sm:flex h-10 w-10 rounded-full items-center justify-center shrink-0 ${!email.isRead ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400' : 'bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-white/40'}`}>
                    <User size={18} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1 sm:mb-0">
                      <p className={`text-sm sm:text-base truncate ${!email.isRead ? 'font-bold text-slate-800 dark:text-white' : 'font-medium text-slate-600 dark:text-white/70'}`}>
                        {email.sender}
                      </p>
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 shrink-0 sm:hidden">
                        <Clock size={12} /> {email.date}
                      </div>
                    </div>
                    
                    <p className={`text-sm truncate mb-1 ${!email.isRead ? 'font-semibold text-slate-700 dark:text-white/90' : 'text-slate-500 dark:text-white/60'}`}>
                      {email.subject}
                    </p>
                    
                    <p className="text-xs text-slate-400 dark:text-white/40 truncate">
                      {email.snippet}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 mt-2 sm:mt-0 pt-3 sm:pt-0 border-t sm:border-0 border-slate-100 dark:border-white/5">
                  <div className="flex items-center gap-3">
                    {email.hasAttachment && (
                      <div className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-400 px-2 py-1 rounded-md">
                        <Paperclip size={12} /> Adjuntos
                      </div>
                    )}
                    <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 whitespace-nowrap">
                      <Clock size={12} /> {email.date}
                    </div>
                  </div>
                  
                  <Button variant="ghost" size="sm" className="h-8 text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-500/10">
                    Vincular Compra <ArrowRight size={14} className="ml-1.5" />
                  </Button>
                </div>

              </div>
            </CardContent>
          </Card>
        ))}
        
        {filteredEmails.length === 0 && (
          <div className="text-center py-12 bg-white dark:bg-[#0a0a14] rounded-xl border border-slate-200 dark:border-white/10">
            <Mail className="mx-auto h-12 w-12 text-slate-300 dark:text-white/20 mb-3" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white">Sin correos</h3>
            <p className="text-sm text-slate-500 dark:text-white/50">No se encontraron correos que coincidan con la búsqueda.</p>
          </div>
        )}
      </div>
    </div>
  );
}
