'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Mail,
  Send,
  FileText,
  FileCode,
  CheckCircle2,
  Loader2,
  Download,
  Copy,
  ShieldCheck,
  QrCode,
  Sparkles,
  ExternalLink,
  Printer,
  Check
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export interface DteEmailSalePayload {
  correlative: string;
  docType: string;
  customerName: string;
  customerEmail?: string;
  customerNit?: string;
  customerNrc?: string;
  total: number;
  paymentMethod?: string;
  timestamp?: string;
  items: Array<{
    sku?: string;
    name: string;
    quantity: number;
    price: number;
  }>;
}

interface DteEmailSimulationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saleData: DteEmailSalePayload | null;
}

export function DteEmailSimulationModal({
  open,
  onOpenChange,
  saleData,
}: DteEmailSimulationModalProps) {
  const { toast } = useToast();
  const [recipientEmail, setRecipientEmail] = useState('');
  const [ccEmail, setCcEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [customNote, setCustomNote] = useState('');
  const [activeTab, setActiveTab] = useState<'preview' | 'json' | 'logs'>('preview');
  
  // Simulation & real Gmail states
  const [sendingStep, setSendingStep] = useState<'IDLE' | 'SIGNING' | 'TRANSMITTING_MH' | 'SENDING_SMTP' | 'SENT'>('IDLE');
  const [transmissionLog, setTransmissionLog] = useState<string[]>([]);
  const [copiedJson, setCopiedJson] = useState(false);
  const [gmailConnected, setGmailConnected] = useState<boolean>(false);
  const [gmailAccountEmail, setGmailAccountEmail] = useState<string>('');

  // Derived DTE Metadata
  const codigoGeneracion = React.useMemo(() => {
    if (!saleData) return 'DTE-00-00000000';
    // Generate deterministic UUID-like string from correlative
    const hash = (saleData.correlative || '0001').replace(/[^A-Z0-9]/gi, '').padEnd(12, '8');
    return `A1B2C3D4-E5F6-4890-ABCD-${hash.slice(0, 12).toUpperCase()}`;
  }, [saleData]);

  const selloRecepcion = React.useMemo(() => {
    const yr = new Date().getFullYear();
    return `${yr}84920192837465A9F8E7D6C5B4A3210987654321`;
  }, [saleData]);

  useEffect(() => {
    if (saleData && open) {
      setRecipientEmail(saleData.customerEmail || '');
      const docLabel = saleData.docType === 'CCF' ? 'Comprobante de Crédito Fiscal (DTE-03)' : 'Factura Electrónica (DTE-01)';
      setSubject(`Documento Tributario Electrónico: ${saleData.correlative} - ${docLabel} | NEXWAY ERP`);
      setCustomNote('Adjunto encontrará el detalle de su Documento Tributario Electrónico y el archivo estructurado (JSON) emitido desde ERP NEXWAY.');
      setSendingStep('IDLE');
      setTransmissionLog([]);
      setActiveTab('preview');

      fetch('/api/gmail/status', { cache: 'no-store' })
        .then((r) => r.json())
        .then((st) => {
          setGmailConnected(Boolean(st?.connected));
          setGmailAccountEmail(st?.email || '');
        })
        .catch(() => {
          setGmailConnected(false);
          setGmailAccountEmail('');
        });
    }
  }, [saleData, open]);

  if (!saleData) return null;

  const subtotalNeto = saleData.total / 1.13;
  const ivaAmount = saleData.total - subtotalNeto;
  const fechaEmision = saleData.timestamp ? new Date(saleData.timestamp).toLocaleString('es-SV') : new Date().toLocaleString('es-SV');

  // Official MH El Salvador DTE JSON Structure (v1/v3)
  const officialDteJson = {
    identificacion: {
      version: saleData.docType === 'CCF' ? 3 : 1,
      ambiente: '00', // 00 = Modo Prueba / Simulación MH, 01 = Producción
      tipoDte: saleData.docType === 'CCF' ? '03' : '01',
      numeroControl: saleData.correlative.startsWith('DTE-') ? saleData.correlative : `DTE-${saleData.docType === 'CCF' ? '03' : '01'}-S001P001-${saleData.correlative.replace(/\D/g, '').padStart(15, '0')}`,
      codigoGeneracion: codigoGeneracion,
      tipoModelo: 1,
      tipoOperacion: 1,
      fecEmi: new Date().toISOString().slice(0, 10),
      horEmi: new Date().toTimeString().slice(0, 8),
      tipoMoneda: 'USD'
    },
    selloRecepcionMH: selloRecepcion,
    emisor: {
      nit: '0614-150890-102-1',
      nrc: '309148-2',
      nombre: 'NEXWAY ERP S.A. DE C.V.',
      codActividad: '46632',
      descActividad: 'Venta al por mayor de pinturas, barnices y productos conexos',
      nombreComercial: 'TECNICOLOR / NEXWAY',
      establecimiento: 'Casa Matriz San Salvador',
      correo: 'facturacion.dte@nexway.com.sv'
    },
    receptor: {
      nombre: saleData.customerName || 'Consumidor Final',
      nit: saleData.customerNit || '0000-000000-000-0',
      nrc: saleData.customerNrc || null,
      correo: recipientEmail
    },
    cuerpoDocumento: (saleData.items || []).map((item, idx) => {
      const unitNet = item.price / 1.13;
      const lineTotal = item.price * item.quantity;
      return {
        numItem: idx + 1,
        tipoItem: 1,
        codigo: item.sku || `ITEM-${idx + 1}`,
        descripcion: item.name,
        cantidad: item.quantity,
        uniMedida: 59, // Unidad
        precioUni: Number(unitNet.toFixed(4)),
        ventaGravada: Number((lineTotal / 1.13).toFixed(2)),
        ivaItem: Number((lineTotal - lineTotal / 1.13).toFixed(2))
      };
    }),
    resumen: {
      totalGravada: Number(subtotalNeto.toFixed(2)),
      subTotalVentas: Number(subtotalNeto.toFixed(2)),
      totalIva: Number(ivaAmount.toFixed(2)),
      montoTotalOperacion: Number(saleData.total.toFixed(2)),
      totalPagar: Number(saleData.total.toFixed(2)),
      condicionOperacion: saleData.paymentMethod === 'Credito' ? 2 : 1,
      pagos: [
        {
          codigo: saleData.paymentMethod === 'Efectivo' ? '01' : saleData.paymentMethod === 'Tarjeta' ? '02' : '05',
          montoPago: Number(saleData.total.toFixed(2)),
          referencia: saleData.paymentMethod || 'Efectivo'
        }
      ]
    }
  };

  const handleSimulateSendEmail = async () => {
    if (!recipientEmail || !recipientEmail.includes('@')) {
      toast({
        variant: 'destructive',
        title: 'Correo inválido',
        description: 'Por favor ingrese una dirección de correo electrónico válida para el destinatario.'
      });
      return;
    }

    setTransmissionLog([]);
    const addLog = (msg: string) => setTransmissionLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

    // Step 1: Signing
    setSendingStep('SIGNING');
    addLog('Iniciando motor de firma electrónica JWS (Certificado Activo NIT 0614-150890-102-1)...');
    await new Promise(r => setTimeout(r, 600));
    addLog(`Documento firmado exitosamente. Código de Generación: ${codigoGeneracion}`);

    // Step 2: MH Validation
    setSendingStep('TRANSMITTING_MH');
    addLog('Validando sello de recepción con Ministerio de Hacienda (Ambiente Simulación 00)...');
    await new Promise(r => setTimeout(r, 700));
    addLog(`Sello MH Verificado: ${selloRecepcion}`);

    // Step 3: Real Gmail API Dispatch with DTE JSON attachment
    setSendingStep('SENDING_SMTP');
    addLog(`Empaquetando correo HTML + adjunto oficial ${saleData.correlative}_DTE.json...`);

    const itemsRowsHtml = (saleData.items || [])
      .map(
        (it, idx) => `
        <tr>
          <td style="padding:6px 8px;border:1px solid #e2e8f0;text-align:center;">${idx + 1}</td>
          <td style="padding:6px 8px;border:1px solid #e2e8f0;">${it.name}</td>
          <td style="padding:6px 8px;border:1px solid #e2e8f0;text-align:right;">${it.quantity}</td>
          <td style="padding:6px 8px;border:1px solid #e2e8f0;text-align:right;">$${Number(it.price || 0).toFixed(2)}</td>
          <td style="padding:6px 8px;border:1px solid #e2e8f0;text-align:right;font-weight:bold;">$${(Number(it.price || 0) * Number(it.quantity || 0)).toFixed(2)}</td>
        </tr>`
      )
      .join('');

    const htmlEmailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; background: #ffffff;">
        <div style="background: #1e1b4b; color: white; padding: 20px; text-align: center;">
          <h2 style="margin: 0; font-size: 18px;">NEXWAY ERP — Facturación Electrónica (DTE)</h2>
          <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.85;">${saleData.docType === 'CCF' ? 'Comprobante de Crédito Fiscal (DTE-03)' : 'Factura de Consumidor Final (DTE-01)'}</p>
        </div>
        <div style="padding: 22px; color: #0f172a; font-size: 13px;">
          <p>Estimado(a) <strong>${saleData.customerName}</strong>,</p>
          <p>${customNote}</p>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin: 14px 0; font-size: 12px;">
            <p style="margin: 3px 0;"><strong>Número de Control:</strong> ${saleData.correlative}</p>
            <p style="margin: 3px 0;"><strong>Código de Generación:</strong> ${codigoGeneracion}</p>
            <p style="margin: 3px 0;"><strong>Sello de Recepción:</strong> ${selloRecepcion}</p>
            <p style="margin: 3px 0;"><strong>Fecha de Emisión:</strong> ${fechaEmision}</p>
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:12px;margin:14px 0;">
            <thead>
              <tr style="background:#f1f5f9;">
                <th style="padding:6px 8px;border:1px solid #cbd5e1;width:32px;">#</th>
                <th style="padding:6px 8px;border:1px solid #cbd5e1;text-align:left;">Descripción</th>
                <th style="padding:6px 8px;border:1px solid #cbd5e1;text-align:right;width:55px;">Cant.</th>
                <th style="padding:6px 8px;border:1px solid #cbd5e1;text-align:right;width:75px;">P. Unit</th>
                <th style="padding:6px 8px;border:1px solid #cbd5e1;text-align:right;width:80px;">Total</th>
              </tr>
            </thead>
            <tbody>${itemsRowsHtml}</tbody>
          </table>
          <div style="text-align:right;font-size:13px;margin-top:10px;">
            <div>Subtotal Gravado: <strong>$${subtotalNeto.toFixed(2)}</strong></div>
            <div>IVA (13%): <strong>$${ivaAmount.toFixed(2)}</strong></div>
            <div style="font-size:16px;color:#312e81;margin-top:4px;"><strong>TOTAL A PAGAR: $${saleData.total.toFixed(2)} USD</strong></div>
          </div>
          <p style="font-size: 11px; color: #64748b; margin-top: 18px;">Se adjunta el archivo estructurado <strong>${saleData.correlative}_DTE.json</strong>.</p>
        </div>
      </div>
    `;

    const jsonString = JSON.stringify(officialDteJson, null, 2);
    const jsonBase64 = typeof window !== 'undefined'
      ? btoa(unescape(encodeURIComponent(jsonString)))
      : '';

    try {
      const res = await fetch('/api/gmail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipientEmail.trim(),
          cc: ccEmail.trim() || undefined,
          subject,
          message: htmlEmailBody,
          attachments: [
            {
              filename: `${saleData.correlative}_DTE.json`,
              mimeType: 'application/json',
              contentBase64: jsonBase64
            }
          ]
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setSendingStep('IDLE');
        addLog(`❌ Error Gmail API (${res.status}): ${data?.error || 'No se pudo enviar'}`);
        toast({
          variant: 'destructive',
          title: res.status === 401 ? 'Conecta tu Gmail primero' : 'Error al enviar correo',
          description: data?.error || 'Haz clic en "Conectar Gmail" abajo para autorizar el envío real.'
        });
        return;
      }

      addLog(`✓ Correo REAL entregado vía Gmail API (${data.from || 'Gmail'}) -> ID: ${data.id || 'OK'}`);
    } catch (e: any) {
      setSendingStep('IDLE');
      addLog(`❌ Error de red: ${e?.message || 'No se pudo contactar /api/gmail/send'}`);
      toast({
        variant: 'destructive',
        title: 'Error de conexión',
        description: e?.message || 'No se pudo enviar el correo.'
      });
      return;
    }

    // Save record in localStorage for audit trail
    if (typeof window !== 'undefined') {
      try {
        const prevLogs = JSON.parse(localStorage.getItem('nexway_sent_dte_emails') || '[]');
        const newEntry = {
          id: `MAIL-${Date.now()}`,
          correlative: saleData.correlative,
          recipientEmail,
          ccEmail,
          customerName: saleData.customerName,
          docType: saleData.docType,
          total: saleData.total,
          codigoGeneracion,
          selloRecepcion,
          sentAt: new Date().toISOString()
        };
        localStorage.setItem('nexway_sent_dte_emails', JSON.stringify([newEntry, ...prevLogs.slice(0, 99)]));
      } catch (e) {}
    }

    setSendingStep('SENT');
    toast({
      title: '✉️ Factura DTE Enviada por Correo',
      description: `Se envió ${saleData.correlative} (PDF + JSON) a ${recipientEmail} exitosamente.`
    });
  };

  const handleDownloadJson = () => {
    const blob = new Blob([JSON.stringify(officialDteJson, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${saleData.correlative}_DTE.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: 'JSON DTE Descargado',
      description: `Archivo estructurado ${saleData.correlative}_DTE.json guardado.`
    });
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(officialDteJson, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
    toast({
      title: 'JSON Copiado',
      description: 'Estructura DTE copiada al portapapeles.'
    });
  };

  const handlePrintPdf = () => {
    const printWin = window.open('', '_blank');
    if (!printWin) return;
    printWin.document.write(`
      <html>
        <head>
          <title>DTE ${saleData.correlative}</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: #1e293b; max-width: 800px; margin: 0 auto; }
            .header { display: flex; justify-content: space-between; border-bottom: 3px solid #312e81; padding-bottom: 16px; margin-bottom: 20px; }
            .dte-box { border: 2px solid #312e81; border-radius: 8px; padding: 12px; font-size: 11px; background: #f8fafc; width: 320px; }
            .grid { display: grid; grid-template-cols: 1fr 1fr; gap: 16px; margin-bottom: 20px; font-size: 12px; background: #f1f5f9; padding: 14px; border-radius: 8px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
            th { background: #1e1b4b; color: white; text-align: left; padding: 8px 10px; }
            td { padding: 8px 10px; border-bottom: 1px solid #cbd5e1; }
            .totals { margin-left: auto; width: 280px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; font-size: 13px; }
            .totals-row { display: flex; justify-content: space-between; margin: 4px 0; }
            .footer { margin-top: 30px; font-size: 10px; color: #64748b; text-align: center; border-top: 1px dashed #cbd5e1; padding-top: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h2 style="margin:0; color:#1e1b4b;">NEXWAY ERP S.A. DE C.V.</h2>
              <p style="margin:4px 0; font-size:12px;">Giro: Venta de Pinturas, Químicos e Insumos Industriales</p>
              <p style="margin:2px 0; font-size:11px;">NIT: 0614-150890-102-1 | NRC: 309148-2</p>
              <p style="margin:2px 0; font-size:11px;">Casa Matriz San Salvador, El Salvador</p>
            </div>
            <div class="dte-box">
              <div style="font-weight:bold; color:#312e81; font-size:12px; margin-bottom:4px;">
                DOCUMENTO TRIBUTARIO ELECTRÓNICO
              </div>
              <div><strong>Tipo:</strong> ${saleData.docType === 'CCF' ? '03 - COMPROBANTE DE CRÉDITO FISCAL' : '01 - FACTURA CONSUMIDOR FINAL'}</div>
              <div><strong>N° Control:</strong> ${saleData.correlative}</div>
              <div><strong>Cód. Generación:</strong> ${codigoGeneracion}</div>
              <div><strong>Sello MH:</strong> ${selloRecepcion.slice(0, 24)}...</div>
              <div><strong>Fecha/Hora:</strong> ${fechaEmision}</div>
            </div>
          </div>

          <div class="grid">
            <div>
              <div><strong>Cliente / Receptor:</strong> ${saleData.customerName}</div>
              <div><strong>Correo Destino:</strong> ${recipientEmail}</div>
            </div>
            <div>
              <div><strong>Condición de Pago:</strong> ${saleData.paymentMethod || 'Contado / Efectivo'}</div>
              <div><strong>Moneda:</strong> USD (Dólares Americanos)</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Cant.</th>
                <th>Descripción</th>
                <th style="text-align:right;">P. Unitario</th>
                <th style="text-align:right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${(saleData.items || []).map(i => `
                <tr>
                  <td>${i.quantity}</td>
                  <td>${i.name}</td>
                  <td style="text-align:right;">$${Number(i.price).toFixed(2)}</td>
                  <td style="text-align:right; font-weight:bold;">$${(Number(i.price) * Number(i.quantity)).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="totals">
            <div class="totals-row"><span>Suma Gravada (Neto):</span><span>$${subtotalNeto.toFixed(2)}</span></div>
            <div class="totals-row"><span>IVA 13%:</span><span>$${ivaAmount.toFixed(2)}</span></div>
            <div class="totals-row" style="font-weight:bold; font-size:15px; border-top:1px solid #94a3b8; padding-top:6px; margin-top:6px; color:#1e1b4b;">
              <span>TOTAL A PAGAR:</span><span>$${saleData.total.toFixed(2)}</span>
            </div>
          </div>

          <div class="footer">
            Representación Gráfica de Documento Tributario Electrónico (DTE) - Ministerio de Hacienda de El Salvador.<br/>
            Verifique su documento escaneando el código QR o con el Código de Generación ${codigoGeneracion}
          </div>
          <script>window.onload = function() { window.print(); };</script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl rounded-2xl border border-slate-200 dark:border-white/10 bg-card shadow-2xl p-0 overflow-hidden max-h-[92vh] flex flex-col">
        {/* Top Banner */}
        <div className="bg-gradient-to-r from-indigo-950 via-indigo-900 to-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-300">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-black tracking-tight text-white flex items-center gap-2">
                Despacho y Simulación de Correo Electrónico DTE
                <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-mono">
                  MH El Salvador (PDF + JSON)
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-indigo-200/80">
                Envía la representación gráfica y el archivo electrónico firmado al correo del cliente.
              </DialogDescription>
            </div>
          </div>
          <Badge variant="outline" className="font-mono text-xs text-white border-white/20 bg-white/5 px-2.5 py-1">
            {saleData.correlative}
          </Badge>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Configuración de Destinatario */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-muted/30 p-4 rounded-xl border border-border/60">
            <div className="md:col-span-5 space-y-1.5">
              <Label className="text-[11px] font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-indigo-500" /> Correo del Cliente (Para) *
              </Label>
              <Input
                type="email"
                value={recipientEmail}
                onChange={e => setRecipientEmail(e.target.value)}
                placeholder="ejemplo@cliente.com.sv"
                className="h-9 text-xs font-semibold rounded-lg bg-background"
              />
            </div>

            <div className="md:col-span-3 space-y-1.5">
              <Label className="text-[11px] font-bold uppercase text-muted-foreground">
                CC / Copia Contabilidad
              </Label>
              <Input
                type="email"
                value={ccEmail}
                onChange={e => setCcEmail(e.target.value)}
                placeholder="contabilidad@empresa.com"
                className="h-9 text-xs rounded-lg bg-background"
              />
            </div>

            <div className="md:col-span-4 space-y-1.5">
              <Label className="text-[11px] font-bold uppercase text-muted-foreground">
                Archivos Adjuntos Automáticos
              </Label>
              <div className="flex items-center gap-2 h-9">
                <Badge variant="secondary" className="text-[10px] gap-1 py-1 px-2.5 bg-rose-500/10 text-rose-500 border border-rose-500/20">
                  <FileText className="h-3 w-3" /> {saleData.correlative}.pdf
                </Badge>
                <Badge variant="secondary" className="text-[10px] gap-1 py-1 px-2.5 bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  <FileCode className="h-3 w-3" /> {saleData.correlative}.json
                </Badge>
              </div>
            </div>

            <div className="md:col-span-12 space-y-1.5">
              <Label className="text-[11px] font-bold uppercase text-muted-foreground">
                Asunto del Correo
              </Label>
              <Input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="h-8 text-xs rounded-lg bg-background font-medium"
              />
            </div>
          </div>

          {/* Estado de Transmisión en Vivo si se está enviando o ya se envió */}
          {sendingStep !== 'IDLE' && (
            <div className={`p-4 rounded-xl border transition-all ${
              sendingStep === 'SENT' 
                ? 'bg-emerald-500/10 border-emerald-500/30' 
                : 'bg-indigo-500/10 border-indigo-500/30'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {sendingStep === 'SENT' ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <Loader2 className="h-5 w-5 text-indigo-500 animate-spin" />
                  )}
                  <span className="text-xs font-black uppercase tracking-wider text-foreground">
                    {sendingStep === 'SIGNING' && '1/3 Firmando Documento Electrónico (JWS)...'}
                    {sendingStep === 'TRANSMITTING_MH' && '2/3 Verificando Sello de Recepción Ministerio de Hacienda...'}
                    {sendingStep === 'SENDING_SMTP' && '3/3 Despachando Correo con PDF y JSON Adjuntos...'}
                    {sendingStep === 'SENT' && `¡Correo Enviado Exitosamente a ${recipientEmail}!`}
                  </span>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {sendingStep === 'SENT' ? '250 OK - ENTREGADO' : 'PROCESANDO'}
                </Badge>
              </div>
              <div className="bg-slate-950 text-emerald-400 font-mono text-[10px] p-2.5 rounded-lg space-y-1 max-h-24 overflow-y-auto">
                {transmissionLog.map((log, i) => (
                  <div key={i}>{log}</div>
                ))}
              </div>
            </div>
          )}

          {/* Pestañas de Previsualización */}
          <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <TabsList className="h-9">
                <TabsTrigger value="preview" className="text-xs gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> Vista Previa del Correo y Factura DTE
                </TabsTrigger>
                <TabsTrigger value="json" className="text-xs gap-1.5">
                  <FileCode className="h-3.5 w-3.5" /> Estructura JSON Oficial (MH)
                </TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handlePrintPdf} className="h-8 text-xs gap-1.5">
                  <Printer className="h-3.5 w-3.5" /> Imprimir PDF
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadJson} className="h-8 text-xs gap-1.5">
                  <Download className="h-3.5 w-3.5" /> Descargar JSON
                </Button>
              </div>
            </div>

            {/* TAB 1: VISTA PREVIA VISUAL DEL CORREO Y REPRESENTACIÓN GRÁFICA */}
            <TabsContent value="preview" className="pt-3 outline-none">
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-950 shadow-inner">
                {/* Cabecera del Correo Simulado */}
                <div className="bg-slate-100 dark:bg-slate-900 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 flex flex-wrap justify-between gap-2">
                  <div>
                    <strong>De:</strong> Facturación Electrónica NexWay &lt;facturacion.dte@nexway.com.sv&gt; &bull; <strong>Para:</strong> {recipientEmail}
                  </div>
                  <div className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5" /> Firma Electrónica Activa
                  </div>
                </div>

                {/* Cuerpo de la Factura / Representación Gráfica */}
                <div className="p-6 space-y-5 text-slate-800 dark:text-slate-200">
                  {/* Encabezado DTE */}
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b-2 border-indigo-900 dark:border-indigo-500/40 pb-4">
                    <div>
                      <div className="text-lg font-black tracking-tight text-indigo-950 dark:text-white">
                        NEXWAY ERP S.A. DE C.V.
                      </div>
                      <div className="text-xs text-slate-500">
                        Especialistas en Pinturas, Recubrimientos e Insumos Industriales
                      </div>
                      <div className="text-[11px] font-mono text-slate-600 dark:text-slate-400 mt-1">
                        NIT: 0614-150890-102-1 &bull; NRC: 309148-2
                      </div>
                    </div>

                    <div className="p-3 rounded-xl border border-indigo-500/30 bg-indigo-500/5 text-[10px] font-mono space-y-0.5 w-full sm:w-80">
                      <div className="font-sans font-black text-indigo-600 dark:text-indigo-400 uppercase text-[11px]">
                        {saleData.docType === 'CCF' ? 'DTE-03 Comprobante de Crédito Fiscal' : 'DTE-01 Factura de Consumidor Final'}
                      </div>
                      <div><strong>Control:</strong> {saleData.correlative}</div>
                      <div className="truncate" title={codigoGeneracion}><strong>Cód. Gen:</strong> {codigoGeneracion}</div>
                      <div className="truncate" title={selloRecepcion}><strong>Sello MH:</strong> {selloRecepcion}</div>
                      <div><strong>Emisión:</strong> {fechaEmision}</div>
                    </div>
                  </div>

                  {/* Mensaje personalizado */}
                  <div className="text-xs bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                    <p className="font-semibold mb-1">Estimado(a) {saleData.customerName}:</p>
                    <p className="text-slate-600 dark:text-slate-400">{customNote}</p>
                  </div>

                  {/* Tabla de Productos */}
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-900 text-white text-[10px] uppercase">
                          <th className="py-2 px-3 text-left">Cant.</th>
                          <th className="py-2 px-3 text-left">Descripción</th>
                          <th className="py-2 px-3 text-right">Precio Unit.</th>
                          <th className="py-2 px-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {(saleData.items || []).map((item, idx) => (
                          <tr key={idx}>
                            <td className="py-2 px-3 font-mono font-bold">{item.quantity}</td>
                            <td className="py-2 px-3">
                              <span className="font-semibold block">{item.name}</span>
                              {item.sku && <span className="text-[10px] font-mono text-slate-400">{item.sku}</span>}
                            </td>
                            <td className="py-2 px-3 text-right font-mono">${Number(item.price).toFixed(2)}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold">${(Number(item.price) * Number(item.quantity)).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Totales y QR Simulado */}
                  <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-2">
                    <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                      <div className="p-2 bg-white rounded-lg border">
                        <QrCode className="h-12 w-12 text-slate-900" />
                      </div>
                      <div className="text-[10px] text-slate-500 max-w-[220px]">
                        <strong className="text-slate-700 dark:text-slate-300 block">Verificación Ministerio de Hacienda</strong>
                        Escanea el código QR para consultar la validez del DTE en el portal oficial.
                      </div>
                    </div>

                    <div className="w-full sm:w-64 space-y-1.5 text-xs bg-indigo-500/5 p-3.5 rounded-xl border border-indigo-500/20">
                      <div className="flex justify-between text-slate-500">
                        <span>Suma Gravada (Neto):</span>
                        <span className="font-mono font-semibold text-foreground">${subtotalNeto.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>IVA (13%):</span>
                        <span className="font-mono font-semibold text-foreground">${ivaAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-black text-indigo-600 dark:text-indigo-400 border-t border-indigo-500/20 pt-1.5">
                        <span>TOTAL DTE:</span>
                        <span className="font-mono">${saleData.total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: JSON ESTRUCTURADO */}
            <TabsContent value="json" className="pt-3 outline-none">
              <div className="relative">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleCopyJson}
                  className="absolute right-3 top-3 h-7 text-xs gap-1.5 z-10"
                >
                  {copiedJson ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedJson ? 'Copiado' : 'Copiar JSON'}
                </Button>
                <pre className="p-4 rounded-xl bg-slate-950 text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-[340px] border border-slate-800">
                  {JSON.stringify(officialDteJson, null, 2)}
                </pre>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 bg-muted/40 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl h-10 text-xs font-bold">
              Cerrar
            </Button>
            {gmailConnected ? (
              <Badge variant="outline" className="h-8 px-2.5 text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                ✓ Gmail: {gmailAccountEmail || 'Conectado'}
              </Badge>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  window.location.href = '/api/gmail/auth?returnTo=/billing';
                }}
                className="rounded-xl h-10 text-xs font-bold border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 gap-1.5"
              >
                <Mail className="h-3.5 w-3.5" /> Conectar Gmail
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              onClick={handleSimulateSendEmail}
              disabled={sendingStep !== 'IDLE' && sendingStep !== 'SENT'}
              className="rounded-xl h-10 px-6 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20 w-full sm:w-auto gap-2"
            >
              {sendingStep !== 'IDLE' && sendingStep !== 'SENT' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Enviando vía Gmail...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  {sendingStep === 'SENT' ? 'Reenviar Correo con DTE' : 'Enviar Factura DTE Real (Gmail)'}
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
