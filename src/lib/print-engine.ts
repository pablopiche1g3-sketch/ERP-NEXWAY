import { supabase } from '@/supabase/client';

export type PaperSize = 'letter' | 'a4' | '80mm' | '58mm';

export interface PrintBranding {
  companyName: string;
  razonSocial: string;
  slogan: string;
  nit: string;
  nrc: string;
  codActividad: string;
  actividadEconomica: string;
  address: string;
  phone: string;
  email: string;
  logoUrl: string;
  showLogo: boolean;
  accentColor: string;
  termsConditions: string;
  showSignatureFields: boolean;
}

const DEFAULT_BRANDING: PrintBranding = {
  companyName: 'TECNICOLOR / ERP NEXWAY',
  razonSocial: 'ERP NEXWAY S.A. DE C.V.',
  slogan: 'Soluciones en Pinturas, Ferretería y Acabados',
  nit: '',
  nrc: '',
  codActividad: '',
  actividadEconomica: '',
  address: 'San Salvador, El Salvador',
  phone: '',
  email: '',
  logoUrl: '',
  showLogo: false,
  accentColor: '#3730a3',
  termsConditions:
    '1. Los precios indicados están expresados en Dólares de los Estados Unidos (USD).\n2. Este documento representa un respaldo formal emitido desde ERP NEXWAY.',
  showSignatureFields: true
};

function esc(val: any): string {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function loadPrintBranding(area: 'quotations' | 'billing' | 'purchases' | 'quedan' = 'quotations'): Promise<PrintBranding> {
  try {
    const [compRes, printRes] = await Promise.all([
      supabase.from('system_config').select('value').eq('key', 'company_profile').maybeSingle(),
      supabase.from('system_config').select('value').eq('key', 'print_config').maybeSingle()
    ]);

    const comp = (compRes.data?.value && typeof compRes.data.value === 'object' ? compRes.data.value : {}) as any;
    const pAll = (printRes.data?.value && typeof printRes.data.value === 'object' ? printRes.data.value : {}) as any;
    const pArea = pAll[area] || pAll.quotations || {};

    const locationParts = [comp.address, comp.municipality, comp.department].filter(Boolean);

    return {
      companyName: comp.nombreComercial || pArea.companyName || comp.razonSocial || DEFAULT_BRANDING.companyName,
      razonSocial: comp.razonSocial || pArea.companyName || DEFAULT_BRANDING.razonSocial,
      slogan: pArea.slogan || DEFAULT_BRANDING.slogan,
      nit: comp.nit || pArea.nit || '',
      nrc: comp.nrc || pArea.nrc || '',
      codActividad: comp.codActividad || '',
      actividadEconomica: comp.actividadEconomica || '',
      address: locationParts.length > 0 ? locationParts.join(', ') : pArea.address || DEFAULT_BRANDING.address,
      phone: pArea.phone || '',
      email: pArea.email || '',
      logoUrl: pArea.logoUrl || '',
      showLogo: Boolean(pArea.showLogo && pArea.logoUrl),
      accentColor: pArea.accentColor || DEFAULT_BRANDING.accentColor,
      termsConditions: pArea.termsConditions || DEFAULT_BRANDING.termsConditions,
      showSignatureFields: pArea.showSignatureFields !== false
    };
  } catch {
    return DEFAULT_BRANDING;
  }
}

/**
 * Imprime un documento HTML puro usando un iframe oculto para evitar
 * bloqueadores de popups, modo oscuro accidental y elementos de la web.
 */
export function printHtmlDocument(html: string, title = 'Documento ERP NEXWAY'): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const existing = document.getElementById('nexway-print-iframe');
  if (existing) existing.remove();

  const iframe = document.createElement('iframe');
  iframe.id = 'nexway-print-iframe';
  iframe.title = title;
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';

  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc || !iframe.contentWindow) {
    iframe.remove();
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  const triggerPrint = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      setTimeout(() => {
        iframe.remove();
      }, 1500);
    }
  };

  if (iframe.contentWindow.document.readyState === 'complete') {
    setTimeout(triggerPrint, 250);
  } else {
    iframe.onload = () => setTimeout(triggerPrint, 250);
  }
}

function baseLetterStyles(accentColor: string, paperSize: 'letter' | 'a4' = 'letter'): string {
  return `
    @page { size: ${paperSize} portrait; margin: 12mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    html, body { background: #ffffff !important; color: #0f172a !important; margin: 0; padding: 0; font-family: 'Segoe UI', Arial, Helvetica, sans-serif; font-size: 11.5px; line-height: 1.45; }
    .doc { width: 100%; max-width: 780px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; padding-bottom: 12px; border-bottom: 2.5px solid ${accentColor}; margin-bottom: 14px; }
    .brand { display: flex; align-items: flex-start; gap: 12px; }
    .brand img { max-height: 54px; max-width: 140px; object-fit: contain; }
    .company-name { font-size: 17px; font-weight: 800; color: #0f172a; letter-spacing: -0.2px; }
    .company-sub { font-size: 10.5px; color: #475569; margin-top: 2px; }
    .doc-box { text-align: right; min-width: 210px; }
    .doc-badge { display: inline-block; background: ${accentColor}; color: #ffffff; font-weight: 800; font-size: 10.5px; letter-spacing: 0.6px; text-transform: uppercase; padding: 4px 10px; border-radius: 6px; }
    .doc-number { font-family: 'Consolas', monospace; font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 5px; }
    .doc-meta { font-size: 10.5px; color: #475569; margin-top: 2px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
    .info-card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 9px 11px; background: #f8fafc; }
    .info-card h4 { margin: 0 0 5px 0; font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.6px; color: ${accentColor}; }
    .info-row { font-size: 11px; margin: 2px 0; color: #1e293b; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
    th { background: #f1f5f9; color: #334155; font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.4px; border: 1px solid #cbd5e1; padding: 7px 8px; text-align: left; }
    td { border: 1px solid #e2e8f0; padding: 6.5px 8px; font-size: 11px; color: #0f172a; vertical-align: top; }
    .num { text-align: right; font-family: 'Consolas', monospace; }
    .ctr { text-align: center; }
    .mono { font-family: 'Consolas', monospace; }
    .summary-wrap { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; page-break-inside: avoid; }
    .notes-box { flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; padding: 9px 11px; font-size: 10px; color: #475569; white-space: pre-line; }
    .totals-box { width: 270px; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; background: #f8fafc; }
    .t-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 11px; }
    .t-grand { border-top: 2px solid ${accentColor}; margin-top: 6px; padding-top: 6px; font-size: 14px; font-weight: 900; color: #0f172a; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 44px; margin-top: 42px; text-align: center; page-break-inside: avoid; }
    .sig-line { border-top: 1px solid #334155; padding-top: 6px; font-size: 10.5px; color: #334155; }
    .footer { margin-top: 18px; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 9.5px; color: #64748b; text-align: center; }
  `;
}

function renderLetterHeader(branding: PrintBranding, docBadge: string, docNumber: string, dateStr: string, extraMeta = ''): string {
  const fiscalLine = [
    branding.nit ? `NIT: ${esc(branding.nit)}` : '',
    branding.nrc ? `NRC: ${esc(branding.nrc)}` : ''
  ]
    .filter(Boolean)
    .join('  •  ');

  const giroLine = branding.actividadEconomica
    ? `Giro: ${branding.codActividad ? `[${esc(branding.codActividad)}] ` : ''}${esc(branding.actividadEconomica)}`
    : '';

  return `
    <div class="header">
      <div class="brand">
        ${branding.showLogo && branding.logoUrl ? `<img src="${esc(branding.logoUrl)}" alt="Logo" />` : ''}
        <div>
          <div class="company-name">${esc(branding.companyName)}</div>
          ${branding.razonSocial && branding.razonSocial !== branding.companyName ? `<div class="company-sub"><strong>${esc(branding.razonSocial)}</strong></div>` : ''}
          ${fiscalLine ? `<div class="company-sub mono">${fiscalLine}</div>` : ''}
          ${giroLine ? `<div class="company-sub">${giroLine}</div>` : ''}
          ${branding.address ? `<div class="company-sub">${esc(branding.address)}</div>` : ''}
          ${branding.phone || branding.email ? `<div class="company-sub">${[branding.phone, branding.email].filter(Boolean).map(esc).join('  |  ')}</div>` : ''}
        </div>
      </div>
      <div class="doc-box">
        <div class="doc-badge">${esc(docBadge)}</div>
        <div class="doc-number">${esc(docNumber)}</div>
        <div class="doc-meta">Fecha: ${esc(dateStr)}</div>
        ${extraMeta}
      </div>
    </div>
  `;
}

/* ============================================================================
 * 1. COTIZACIÓN / PRE-FACTURA (HOJA CARTA)
 * ============================================================================ */
export function buildQuotationDocumentHtml(params: {
  branding: PrintBranding;
  quoteNumber: string;
  customerName: string;
  customerNit?: string;
  customerNrc?: string;
  sellerName?: string;
  paymentMethod?: string;
  creditDays?: number | string;
  taxMode: 'con-iva' | 'sin-iva';
  subtotal: number;
  iva: number;
  total: number;
  items: Array<{ sku?: string; name: string; quantity: number; price: number }>;
}): string {
  const { branding } = params;
  const dateStr = new Date().toLocaleDateString('es-SV', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const rows = params.items
    .map(
      (it, i) => `
      <tr>
        <td class="ctr mono">${i + 1}</td>
        <td class="mono">${esc(it.sku || '—')}</td>
        <td><strong>${esc(it.name)}</strong></td>
        <td class="num">${it.quantity}</td>
        <td class="num">$${Number(it.price || 0).toFixed(2)}</td>
        <td class="num"><strong>$${(Number(it.price || 0) * Number(it.quantity || 0)).toFixed(2)}</strong></td>
      </tr>`
    )
    .join('');

  const ivaLabel = params.taxMode === 'con-iva' ? 'incluyen IVA (13%)' : 'no incluyen IVA';
  const terms = (branding.termsConditions || '').replace('{iva_detail}', ivaLabel);

  return `<!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>Cotización ${esc(params.quoteNumber)}</title>
    <style>${baseLetterStyles(branding.accentColor, 'letter')}</style>
  </head>
  <body>
    <div class="doc">
      ${renderLetterHeader(branding, 'COTIZACIÓN / PRE-FACTURA', params.quoteNumber, dateStr, '<div class="doc-meta">Validez: 15 días calendario</div>')}

      <div class="grid-2">
        <div class="info-card">
          <h4>Cliente Receptor</h4>
          <div class="info-row"><strong>${esc(params.customerName || 'Cliente de Mostrador')}</strong></div>
          <div class="info-row mono">NIT/DUI: ${esc(params.customerNit || '—')} &nbsp;|&nbsp; NRC: ${esc(params.customerNrc || '—')}</div>
        </div>
        <div class="info-card">
          <h4>Atención Comercial</h4>
          <div class="info-row"><strong>Asesor / Vendedor:</strong> ${esc(params.sellerName || 'Mostrador')}</div>
          <div class="info-row"><strong>Forma de Pago:</strong> ${
            (params.paymentMethod || '').toLowerCase().includes('cred')
              ? `<strong style="color:#b45309;">CRÉDITO${params.creditDays ? ` (${esc(String(params.creditDays))} días)` : ''}</strong>`
              : esc(params.paymentMethod || 'Contado / Efectivo')
          }</div>
          <div class="info-row"><strong>Régimen de Precios:</strong> ${params.taxMode === 'con-iva' ? 'Precios con IVA (13%)' : 'Precios Netos (Sin IVA)'}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th class="ctr" style="width:36px;">#</th>
            <th style="width:95px;">SKU</th>
            <th>Descripción del Producto / Servicio</th>
            <th class="num" style="width:65px;">Cant.</th>
            <th class="num" style="width:90px;">Precio Unit.</th>
            <th class="num" style="width:95px;">Subtotal</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="summary-wrap">
        <div class="notes-box">
          <strong>Términos y Condiciones:</strong>\n${esc(terms)}
        </div>
        <div class="totals-box">
          <div class="t-row"><span>Subtotal Gravado:</span><span class="mono">$${params.subtotal.toFixed(2)}</span></div>
          <div class="t-row"><span>IVA (13%):</span><span class="mono">$${params.iva.toFixed(2)}</span></div>
          <div class="t-row t-grand"><span>TOTAL:</span><span class="mono">$${params.total.toFixed(2)}</span></div>
        </div>
      </div>

      ${
        branding.showSignatureFields
          ? `<div class="signatures">
              <div class="sig-line"><strong>Elaborado por</strong><br/>${esc(params.sellerName || branding.companyName)}</div>
              <div class="sig-line"><strong>Aprobado por Cliente</strong><br/>Nombre, Firma y Sello</div>
            </div>`
          : ''
      }

      <div class="footer">${esc(branding.companyName)} — Documento informativo sin afectación de inventario hasta facturación en caja.</div>
    </div>
  </body>
  </html>`;
}

/* ============================================================================
 * 2. FACTURA CF / CRÉDITO FISCAL CCF (CARTA O TICKET TÉRMICO 80mm / 58mm)
 * ============================================================================ */
export function buildInvoiceDocumentHtml(params: {
  branding: PrintBranding;
  paperSize: PaperSize;
  correlative: string;
  docType: string;
  dateStr?: string;
  customerName: string;
  customerNit?: string;
  customerNrc?: string;
  customerGiro?: string;
  customerAddress?: string;
  sellerName?: string;
  paymentMethod?: string;
  creditDays?: number | string;
  creditAmount?: number;
  items: Array<{ sku?: string; name: string; quantity: number; price: number }>;
  total: number;
  ivaRetention1?: number;
  cashReceived?: number;
  change?: number;
}): string {
  const { branding, paperSize } = params;
  const dateStr = params.dateStr || new Date().toLocaleString('es-SV');
  const isCcf = params.docType === 'CCF';
  const docTitle = isCcf ? 'COMPROBANTE DE CRÉDITO FISCAL (DTE-03)' : 'FACTURA CONSUMIDOR FINAL (DTE-01)';
  const subtotalGravado = params.total / 1.13;
  const ivaAmount = params.total - subtotalGravado;
  const retention = Number(params.ivaRetention1 || 0);
  const netPayable = Math.max(0, params.total - retention);
  const pmLower = (params.paymentMethod || '').toLowerCase();
  const isCreditSale = pmLower.includes('cred') || (Number(params.creditAmount || 0) > 0);
  const creditAmountVal = isCreditSale ? (Number(params.creditAmount || 0) > 0 ? Number(params.creditAmount) : netPayable) : 0;
  const creditDaysLabel = params.creditDays ? `${params.creditDays} días` : '30 días';

  // FORMATO TICKET TÉRMICO (80mm / 58mm)
  if (paperSize === '80mm' || paperSize === '58mm') {
    const widthMm = paperSize === '58mm' ? '54mm' : '74mm';
    const itemRows = params.items
      .map(
        (it) => `
        <tr>
          <td colspan="3" style="padding-top:4px;font-weight:700;">${esc(it.name)}</td>
        </tr>
        <tr>
          <td style="padding-bottom:4px;">${it.quantity} x $${Number(it.price || 0).toFixed(2)}</td>
          <td style="padding-bottom:4px;text-align:right;font-family:monospace;">${esc(it.sku || '')}</td>
          <td style="padding-bottom:4px;text-align:right;font-weight:700;">$${(Number(it.price || 0) * Number(it.quantity || 0)).toFixed(2)}</td>
        </tr>`
      )
      .join('');

    return `<!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8" />
      <title>Ticket ${esc(params.correlative)}</title>
      <style>
        @page { size: ${paperSize} auto; margin: 2mm; }
        * { box-sizing: border-box; }
        html, body { background: #fff !important; color: #000 !important; margin: 0; padding: 0; font-family: 'Consolas', 'Courier New', monospace; font-size: ${paperSize === '58mm' ? '10px' : '11px'}; line-height: 1.3; }
        .ticket { width: ${widthMm}; margin: 0 auto; }
        .ctr { text-align: center; }
        .hr { border-top: 1px dashed #000; margin: 6px 0; }
        table { width: 100%; border-collapse: collapse; }
        .tot { display: flex; justify-content: space-between; margin: 2px 0; }
        .grand { font-size: 13px; font-weight: 900; border-top: 1px solid #000; padding-top: 4px; margin-top: 4px; }
      </style>
    </head>
    <body>
      <div class="ticket">
        <div class="ctr">
          <div style="font-size:13px;font-weight:900;">${esc(branding.companyName)}</div>
          ${branding.nit ? `<div>NIT: ${esc(branding.nit)}</div>` : ''}
          ${branding.nrc ? `<div>NRC: ${esc(branding.nrc)}</div>` : ''}
          ${branding.address ? `<div>${esc(branding.address)}</div>` : ''}
        </div>
        <div class="hr"></div>
        <div class="ctr" style="font-weight:900;">${isCcf ? 'CRÉDITO FISCAL (CCF)' : 'FACTURA CONSUMIDOR FINAL'}</div>
        <div><strong>No.:</strong> ${esc(params.correlative)}</div>
        <div><strong>Fecha:</strong> ${esc(dateStr)}</div>
        <div><strong>Cliente:</strong> ${esc(params.customerName || 'Consumidor Final')}</div>
        ${params.customerNit ? `<div><strong>NIT:</strong> ${esc(params.customerNit)}</div>` : ''}
        ${params.customerNrc ? `<div><strong>NRC:</strong> ${esc(params.customerNrc)}</div>` : ''}
        ${params.sellerName ? `<div><strong>Vendedor:</strong> ${esc(params.sellerName)}</div>` : ''}
        <div class="hr"></div>
        <table><tbody>${itemRows}</tbody></table>
        <div class="hr"></div>
        ${
          isCcf
            ? `<div class="tot"><span>Gravado:</span><span>$${subtotalGravado.toFixed(2)}</span></div>
               <div class="tot"><span>IVA (13%):</span><span>$${ivaAmount.toFixed(2)}</span></div>`
            : `<div class="tot"><span>Subtotal:</span><span>$${params.total.toFixed(2)}</span></div>`
        }
        ${retention > 0 ? `<div class="tot"><span>Retención 1% IVA:</span><span>-$${retention.toFixed(2)}</span></div>` : ''}
        <div class="tot grand"><span>TOTAL A PAGAR:</span><span>$${netPayable.toFixed(2)}</span></div>
        ${params.paymentMethod ? `<div class="tot"><span>Condición / Pago:</span><span><strong>${esc(params.paymentMethod)}</strong></span></div>` : ''}
        ${
          isCreditSale
            ? `<div style="border:2px solid #000;padding:5px;margin:6px 0;text-align:center;">
                 <div style="font-weight:900;font-size:12px;">*** VENTA AL CRÉDITO ***</div>
                 <div style="font-size:10px;font-weight:700;">CUENTA POR COBRAR: $${creditAmountVal.toFixed(2)}</div>
                 <div style="font-size:10px;">Plazo autorizado: ${esc(creditDaysLabel)}</div>
                 <div style="font-size:9.5px;margin-top:2px;">CAJERO: CONSERVAR COPIA FIRMADA</div>
               </div>
               <div style="margin-top:10px;font-size:9.5px;line-height:1.35;">
                 <div><strong>CONSTANCIA DE CRÉDITO:</strong> Recibí de conformidad la mercadería detallada y me obligo a cancelar el saldo en el plazo estipulado.</div>
                 <div style="border-bottom:1px solid #000;height:26px;margin-top:12px;"></div>
                 <div class="ctr" style="font-weight:700;margin-top:2px;">FIRMA Y SELLO DEL CLIENTE</div>
                 <div style="margin-top:6px;">Nombre: ________________________</div>
                 <div style="margin-top:4px;">DUI/NIT: _______________________</div>
               </div>`
            : `${typeof params.cashReceived === 'number' && params.cashReceived > 0 ? `<div class="tot"><span>Recibido:</span><span>$${params.cashReceived.toFixed(2)}</span></div>` : ''}
               ${typeof params.change === 'number' && params.change > 0 ? `<div class="tot"><span>Cambio:</span><span>$${params.change.toFixed(2)}</span></div>` : ''}`
        }
        <div class="hr"></div>
        <div class="ctr" style="font-size:9.5px;">¡Gracias por su preferencia!<br/>Representación impresa POS</div>
      </div>
    </body>
    </html>`;
  }

  // FORMATO HOJA CARTA / A4
  const rows = params.items
    .map(
      (it, i) => `
      <tr>
        <td class="ctr mono">${i + 1}</td>
        <td class="mono">${esc(it.sku || '—')}</td>
        <td><strong>${esc(it.name)}</strong></td>
        <td class="num">${it.quantity}</td>
        <td class="num">$${(isCcf ? Number(it.price || 0) / 1.13 : Number(it.price || 0)).toFixed(2)}</td>
        <td class="num"><strong>$${((isCcf ? Number(it.price || 0) / 1.13 : Number(it.price || 0)) * Number(it.quantity || 0)).toFixed(2)}</strong></td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>${esc(params.correlative)}</title>
    <style>${baseLetterStyles(branding.accentColor, paperSize === 'a4' ? 'a4' : 'letter')}</style>
  </head>
  <body>
    <div class="doc">
      ${renderLetterHeader(branding, docTitle, params.correlative, dateStr, params.paymentMethod ? `<div class="doc-meta">Pago: ${esc(params.paymentMethod)}</div>` : '')}

      <div class="grid-2">
        <div class="info-card">
          <h4>Datos del Receptor</h4>
          <div class="info-row"><strong>${esc(params.customerName || 'Consumidor Final')}</strong></div>
          ${params.customerNit || params.customerNrc ? `<div class="info-row mono">NIT: ${esc(params.customerNit || '—')} &nbsp;|&nbsp; NRC: ${esc(params.customerNrc || '—')}</div>` : ''}
          ${params.customerGiro ? `<div class="info-row">Giro: ${esc(params.customerGiro)}</div>` : ''}
          ${params.customerAddress ? `<div class="info-row">${esc(params.customerAddress)}</div>` : ''}
        </div>
        <div class="info-card">
          <h4>Información Operativa</h4>
          <div class="info-row"><strong>Vendedor / Asesor:</strong> ${esc(params.sellerName || 'Caja Principal')}</div>
          <div class="info-row"><strong>Condición / Pago:</strong> ${
            isCreditSale
              ? `<strong style="color:#b45309;">CRÉDITO (${esc(creditDaysLabel)}) — Saldo CXC: $${creditAmountVal.toFixed(2)}</strong>`
              : esc(params.paymentMethod || 'Efectivo')
          }</div>
          <div class="info-row"><strong>Moneda:</strong> USD ($)</div>
        </div>
      </div>

      ${
        isCreditSale
          ? `<div style="border:2px solid #b45309;background:#fffbeb;color:#78350f;padding:10px 14px;border-radius:8px;margin-bottom:14px;font-size:11px;">
               <strong>VENTA AL CRÉDITO (CUENTA POR COBRAR):</strong> Documento emitido al crédito por <strong>$${creditAmountVal.toFixed(2)}</strong> a plazo de <strong>${esc(creditDaysLabel)}</strong>. <strong>AVISO CAJA:</strong> Solicitar firma y sello de recepción del cliente y archivar copia en Cuentas por Cobrar.
             </div>`
          : ''
      }

      <table>
        <thead>
          <tr>
            <th class="ctr" style="width:36px;">#</th>
            <th style="width:95px;">SKU</th>
            <th>Descripción</th>
            <th class="num" style="width:65px;">Cant.</th>
            <th class="num" style="width:90px;">Precio Unit.</th>
            <th class="num" style="width:95px;">Venta Gravada</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="summary-wrap">
        <div class="notes-box">
          <strong>Nota Legal:</strong>\nRepresentación impresa del comprobante emitido desde ERP NEXWAY. Conserve este documento para garantías o cambios.
        </div>
        <div class="totals-box">
          <div class="t-row"><span>Ventas Gravadas:</span><span class="mono">$${subtotalGravado.toFixed(2)}</span></div>
          <div class="t-row"><span>IVA (13%):</span><span class="mono">$${ivaAmount.toFixed(2)}</span></div>
          ${retention > 0 ? `<div class="t-row" style="color:#b45309;font-weight:700;"><span>Retención 1% IVA:</span><span class="mono">-$${retention.toFixed(2)}</span></div>` : ''}
          <div class="t-row t-grand"><span>TOTAL A PAGAR:</span><span class="mono">$${netPayable.toFixed(2)}</span></div>
        </div>
      </div>

      ${
        isCreditSale
          ? `<div class="signatures" style="margin-top:34px;">
               <div class="sig-line"><strong>Entregado por Caja / Despacho</strong><br/>${esc(params.sellerName || branding.companyName)}</div>
               <div class="sig-line"><strong>Recibido Conforme al Crédito</strong><br/>Nombre, DUI/NIT, Firma y Sello del Cliente</div>
             </div>`
          : ''
      }

      <div class="footer">${esc(branding.companyName)} — Gracias por su compra.</div>
    </div>
  </body>
  </html>`;
}

/* ============================================================================
 * 3. ORDEN DE COMPRA (HOJA CARTA)
 * ============================================================================ */
export function buildPurchaseOrderDocumentHtml(params: {
  branding: PrintBranding;
  orderNumber: string;
  supplierName: string;
  supplierNit?: string;
  warehouseName?: string;
  expectedDate?: string;
  notes?: string;
  items: Array<{ sku?: string; name: string; quantity: number; unitCost: number }>;
  total: number;
}): string {
  const { branding } = params;
  const dateStr = new Date().toLocaleDateString('es-SV');
  const rows = params.items
    .map(
      (it, i) => `
      <tr>
        <td class="ctr mono">${i + 1}</td>
        <td class="mono">${esc(it.sku || '—')}</td>
        <td><strong>${esc(it.name)}</strong></td>
        <td class="num">${it.quantity}</td>
        <td class="num">$${Number(it.unitCost || 0).toFixed(2)}</td>
        <td class="num"><strong>$${(Number(it.unitCost || 0) * Number(it.quantity || 0)).toFixed(2)}</strong></td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>Orden de Compra ${esc(params.orderNumber)}</title>
    <style>${baseLetterStyles(branding.accentColor, 'letter')}</style>
  </head>
  <body>
    <div class="doc">
      ${renderLetterHeader(branding, 'ORDEN DE COMPRA', params.orderNumber, dateStr, params.expectedDate ? `<div class="doc-meta">Entrega estimada: ${esc(params.expectedDate)}</div>` : '')}

      <div class="grid-2">
        <div class="info-card">
          <h4>Proveedor</h4>
          <div class="info-row"><strong>${esc(params.supplierName)}</strong></div>
          ${params.supplierNit ? `<div class="info-row mono">NIT: ${esc(params.supplierNit)}</div>` : ''}
        </div>
        <div class="info-card">
          <h4>Destino de Entrega</h4>
          <div class="info-row"><strong>Bodega:</strong> ${esc(params.warehouseName || 'Bodega Principal')}</div>
          <div class="info-row">${esc(branding.address)}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th class="ctr" style="width:36px;">#</th>
            <th style="width:95px;">SKU</th>
            <th>Producto Solicitado</th>
            <th class="num" style="width:65px;">Cant.</th>
            <th class="num" style="width:90px;">Costo Unit.</th>
            <th class="num" style="width:95px;">Subtotal</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="summary-wrap">
        <div class="notes-box">
          <strong>Observaciones de Compra:</strong>\n${esc(params.notes || 'Favor enviar DTE (PDF + JSON) al correo de compras y adjuntar número de orden en la factura.')}
        </div>
        <div class="totals-box">
          <div class="t-row t-grand"><span>TOTAL ORDEN:</span><span class="mono">$${params.total.toFixed(2)}</span></div>
        </div>
      </div>

      <div class="signatures">
        <div class="sig-line"><strong>Autorizado por Compras / Gerencia</strong><br/>Firma y Sello</div>
        <div class="sig-line"><strong>Confirmación de Proveedor</strong><br/>Fecha y Firma</div>
      </div>

      <div class="footer">${esc(branding.companyName)} — Orden de Compra generada desde ERP NEXWAY.</div>
    </div>
  </body>
  </html>`;
}

/* ============================================================================
 * 4. CORTE / ARQUEO DE CAJA (HOJA CARTA)
 * ============================================================================ */
export function buildCashClosingDocumentHtml(params: {
  branding: PrintBranding;
  stationName: string;
  dateStr: string;
  outgoingCashier: string;
  incomingCashier?: string;
  salesCash: number;
  salesCard: number;
  salesTransfer: number;
  salesCredit: number;
  salesCheck: number;
  totalSales: number;
  baseFloat: number;
  physicalCash: number;
  expensesTotal: number;
  difference: number;
  notes?: string;
}): string {
  const { branding } = params;
  return `<!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>Cierre de Caja - ${esc(params.stationName)}</title>
    <style>${baseLetterStyles(branding.accentColor, 'letter')}</style>
  </head>
  <body>
    <div class="doc">
      ${renderLetterHeader(branding, 'CORTE Y ARQUEO DE CAJA', params.stationName, params.dateStr)}

      <div class="grid-2">
        <div class="info-card">
          <h4>Responsables de Turno</h4>
          <div class="info-row"><strong>Cajero Saliente:</strong> ${esc(params.outgoingCashier)}</div>
          <div class="info-row"><strong>Cajero Entrante / Relevo:</strong> ${esc(params.incomingCashier || 'Cierre Definitivo del Día')}</div>
        </div>
        <div class="info-card">
          <h4>Resumen de Cuadre</h4>
          <div class="info-row"><strong>Fondo Base de Caja:</strong> <span class="mono">$${params.baseFloat.toFixed(2)}</span></div>
          <div class="info-row"><strong>Efectivo Físico Contado:</strong> <span class="mono">$${params.physicalCash.toFixed(2)}</span></div>
          <div class="info-row"><strong>Diferencia:</strong> <strong class="mono" style="color:${Math.abs(params.difference) < 0.01 ? '#15803d' : '#b91c1c'};">${params.difference >= 0 ? '+' : ''}$${params.difference.toFixed(2)}</strong></div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Concepto / Medio de Pago</th>
            <th class="num" style="width:140px;">Monto Sistema</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Ventas en Efectivo</td><td class="num">$${params.salesCash.toFixed(2)}</td></tr>
          <tr><td>Ventas con Tarjeta (POS)</td><td class="num">$${params.salesCard.toFixed(2)}</td></tr>
          <tr><td>Transferencias Bancarias</td><td class="num">$${params.salesTransfer.toFixed(2)}</td></tr>
          <tr><td>Ventas al Crédito</td><td class="num">$${params.salesCredit.toFixed(2)}</td></tr>
          <tr><td>Cheques</td><td class="num">$${params.salesCheck.toFixed(2)}</td></tr>
          <tr><td>Egresos / Gastos de Caja Menor</td><td class="num">-$${params.expensesTotal.toFixed(2)}</td></tr>
          <tr><td><strong>TOTAL VENTAS DEL TURNO</strong></td><td class="num"><strong>$${params.totalSales.toFixed(2)}</strong></td></tr>
        </tbody>
      </table>

      ${params.notes ? `<div class="notes-box" style="margin-bottom:14px;"><strong>Observaciones / Justificación:</strong>\n${esc(params.notes)}</div>` : ''}

      <div class="signatures">
        <div class="sig-line"><strong>Entrega: Cajero Saliente</strong><br/>${esc(params.outgoingCashier)}</div>
        <div class="sig-line"><strong>Recibe: Gerencia / Relevo</strong><br/>${esc(params.incomingCashier || 'Firma de Auditoría')}</div>
      </div>

      <div class="footer">${esc(branding.companyName)} — Comprobante oficial de Arqueo y Cierre de Caja.</div>
    </div>
  </body>
  </html>`;
}
