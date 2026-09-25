export interface PrintBlock {
  id: string;
  type: 'header' | 'customer' | 'items_table' | 'totals' | 'qr_hacienda' | 'footer' | 'custom_text' | 'divider';
  
  // Opciones de Texto / Título
  title?: string;
  subtitle?: string;
  headerType?: string; // "FACTURA DE CONSUMIDOR FINAL", "COMPROBANTE DE CRÉDITO FISCAL", etc.
  addressText?: string;
  phoneText?: string;
  emailText?: string;
  nitText?: string;
  nrcText?: string;
  giroText?: string;
  
  // Visibilidad Header
  showLogo?: boolean;
  logoSize?: 'small' | 'medium' | 'large';
  logoBase64?: string;
  showAddress?: boolean;
  showPhone?: boolean;
  showEmail?: boolean;
  showNitNrc?: boolean;
  showGiro?: boolean;
  showDocType?: boolean;
  showDateTime?: boolean;
  
  // Opciones Customer
  customerSectionTitle?: string;
  showCustomerName?: boolean;
  showNit?: boolean;
  showNrc?: boolean;
  showCustomerGiro?: boolean;
  showCustomerAddress?: boolean;
  showCustomerPhone?: boolean;
  showSeller?: boolean;
  showCodGen?: boolean;
  showControlNum?: boolean;
  customerBoxStyle?: 'simple' | 'bordered' | 'shaded';

  // Opciones Items Table
  showQty?: boolean;
  showUnit?: boolean;
  showSku?: boolean;
  showPriceUni?: boolean;
  showDiscount?: boolean;
  showItemTotal?: boolean;
  tableHeaderStyle?: 'dark' | 'gray' | 'simple' | 'underlined';
  tableRowDivider?: 'none' | 'dotted' | 'solid';
  tableFontSize?: 'xs' | 'small' | 'normal';

  // Opciones Totales
  showSubtotal?: boolean;
  showExempt?: boolean;
  showDiscounts?: boolean;
  showIva?: boolean;
  showRetencion?: boolean;
  showPercepcion?: boolean;
  showTotalInLetters?: boolean;
  showPaymentMethod?: boolean;
  showCashChange?: boolean;
  totalBoxHighlight?: boolean;

  // Opciones QR
  qrSize?: 'small' | 'medium' | 'large';
  showSello?: boolean;
  showPublicUrl?: boolean;
  qrInstructionText?: string;

  // Opciones Footer
  customMessage?: string;
  policiesText?: string;
  socialMediaText?: string;
  showSignatures?: boolean;
  signatureLeftLabel?: string;
  signatureRightLabel?: string;
  showResolutionText?: boolean;
  resolutionText?: string;

  // Opciones Custom Text
  content?: string;
  text?: string;
  isBold?: boolean;
  isItalic?: boolean;
  isBoxed?: boolean;

  // Opciones Divider
  dividerStyle?: 'dotted' | 'solid' | 'double' | 'dashed' | 'blank';
  dividerSpacing?: 'compact' | 'normal' | 'wide';

  // Estilos generales del bloque
  fontSize?: 'small' | 'normal' | 'large' | 'xlarge';
  align?: 'left' | 'center' | 'right';
  paddingTop?: number;
  paddingBottom?: number;
  marginTop?: number;
  marginBottom?: number;
}

export interface PrintTemplateScheme {
  id?: string;
  nombre?: string;
  paper_size: '80mm' | '58mm' | 'A4';
  font_family?: 'sans' | 'mono' | 'serif' | 'thermal';
  density?: 'compact' | 'normal' | 'spacious';
  blocks: PrintBlock[];
}

export const PYTHON_PDF_SERVICE_URL = process.env.NEXT_PUBLIC_PDF_SERVICE_URL || 'http://localhost:8000';

export async function checkPythonPdfServiceHealth(): Promise<{ online: boolean; message: string; version?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${PYTHON_PDF_SERVICE_URL}/api/v1/health`, {
      method: 'GET',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      return { online: true, message: 'Microservicio Python Conectado', version: data.version };
    }
    return { online: false, message: 'Microservicio no responde' };
  } catch (err: any) {
    return { online: false, message: 'Modo Local / Microservicio Offline' };
  }
}

export async function compileTemplateWithPython(scheme: PrintTemplateScheme, sampleData?: any): Promise<Blob> {
  const payload = {
    template_name: scheme.nombre || 'Ticket Térmico POS',
    paper_size: scheme.paper_size || '80mm',
    font_family: scheme.font_family || 'sans',
    density: scheme.density || 'normal',
    blocks: scheme.blocks || [],
    emisor: sampleData?.emisor || {
      nombre: 'NEXWAY ERP S.A. DE C.V.',
      nit: '0614-150890-102-1',
      nrc: '283940-1',
      giro: 'Venta de Materiales de Construcción y Ferretería',
      direccion: 'San Salvador, El Salvador C.A.',
      telefono: '+503 2200-0000',
      email: 'facturacion@nexway.sv'
    },
    receptor: sampleData?.receptor || sampleData?.cliente || {
      nombre: sampleData?.cliente?.razon_social || 'COMERCIALIZADORA EL SALVADOR S.A. DE C.V.',
      numDocumento: sampleData?.cliente?.nit || '0614-010190-001-0',
      nrc: sampleData?.cliente?.nrc || '29814-0',
      giro: 'Comercialización y Distribución',
      direccion: sampleData?.cliente?.direccion || 'San Salvador, El Salvador'
    },
    identificacion: sampleData?.identificacion || {
      fecEmi: new Date().toISOString().slice(0, 10),
      horEmi: new Date().toLocaleTimeString('es-SV'),
      tipoDteNombre: scheme.paper_size === 'A4' ? 'COMPROBANTE DE CRÉDITO FISCAL (DTE-03)' : 'FACTURA DE CONSUMIDOR FINAL (DTE-01)',
      codigoGeneracion: sampleData?.dte?.codigo_generacion || 'DTE-01-C001-0000001892',
      numeroControl: sampleData?.dte?.numero_control || 'DTE-01-00000000-000000000001892',
      ambiente: '00'
    },
    items: sampleData?.items || [
      { cantidad: 2, descripcion: 'Cemento Portland 42.5kg Max', precioUni: 10.50, ventaGravada: 21.00, sku: 'CEM-01', unidad: 'Saco' },
      { cantidad: 1, descripcion: 'Pintura Acrílica Blanco 1 Gal', precioUni: 18.00, ventaGravada: 18.00, sku: 'PIN-02', unidad: 'Galón' },
      { cantidad: 5, descripcion: 'Varilla Corrugada 1/2" 6M', precioUni: 7.20, ventaGravada: 36.00, sku: 'VAR-12', unidad: 'Unidad' }
    ],
    resumen: sampleData?.resumen || {
      totalGravada: 66.37,
      subTotal: 66.37,
      totalDescu: 0.00,
      totalIva: 8.63,
      ivaRete1: 0.00,
      totalPagar: 75.00,
      totalLetras: 'SETENTA Y CINCO 00/100 USD',
      formaPago: 'Efectivo / Contado',
      montoRecibido: 100.00,
      cambio: 25.00
    },
    selloRecepcion: sampleData?.dte?.sello_recepcion || '2026-SELLO-MH-904128914-OFFICIAL'
  };

  const response = await fetch(`${PYTHON_PDF_SERVICE_URL}/api/v1/reports/custom-template-pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error en microservicio Python (${response.status}): ${errorText}`);
  }

  return await response.blob();
}

export function renderTemplateToPrint(scheme: PrintTemplateScheme, data?: any): string {
  const isA4 = scheme.paper_size === 'A4';
  const paperWidth = scheme.paper_size === '58mm' ? '200px' : scheme.paper_size === '80mm' ? '290px' : '750px';
  const fontFamily = scheme.font_family === 'mono' ? 'monospace' : scheme.font_family === 'serif' ? 'Georgia, serif' : "'DM Sans', Arial, sans-serif";

  const dte = data?.dte || {
    codigo_generacion: 'DTE-01-C001-0000001892',
    numero_control: 'DTE-01-00000000-000000000001892',
    sello_recepcion: '2026-SELLO-MH-904128914-OFFICIAL',
    modelo_facturacion: 'Previo (Transmisión Normal)',
    tipo_doc_nombre: isA4 ? 'COMPROBANTE DE CRÉDITO FISCAL (DTE-03)' : 'FACTURA DE CONSUMIDOR FINAL (DTE-01)'
  };

  const cliente = data?.cliente || {
    razon_social: 'COMERCIALIZADORA EL SALVADOR S.A. DE C.V.',
    nit: '0614-150890-102-1',
    nrc: '29814-0',
    giro: 'Venta de Materiales de Construcción y Ferretería',
    direccion: 'San Salvador, El Salvador C.A.',
    telefono: '+503 2200-1122'
  };

  const items = data?.items || [
    { sku: 'CEM-01', cantidad: 2, unidad: 'Saco', descripcion: 'CEMENTO PORTLAND 42.5KG MAX', precio: 10.50, total: 21.00 },
    { sku: 'PIN-02', cantidad: 1, unidad: 'Gal', descripcion: 'PINTURA ACRÍLICA BLANCO 1 GAL', precio: 18.00, total: 18.00 },
    { sku: 'VAR-12', cantidad: 5, unidad: 'Uds', descripcion: 'VARILLA DE HIERRO 1/2" x 6M G60', precio: 7.20, total: 36.00 }
  ];

  const subtotal = data?.subtotal ?? (items.reduce((acc: number, item: any) => acc + (parseFloat(item.total) || 0), 0) / 1.13);
  const iva_13 = data?.iva_13 ?? (subtotal * 0.13);
  const total = data?.total ?? (subtotal + iva_13);
  const fecha = data?.fecha || new Date().toLocaleDateString('es-SV');
  const hora = data?.hora || new Date().toLocaleTimeString('es-SV');

  let blocksHtml = '';

  (scheme.blocks || []).forEach(block => {
    switch (block.type) {
      case 'header':
        const docTitle = block.headerType || dte.tipo_doc_nombre;
        const align = block.align || (isA4 ? 'left' : 'center');
        const titleFontSize = block.fontSize === 'xlarge' ? '18px' : block.fontSize === 'large' ? '15px' : block.fontSize === 'small' ? '11px' : '13px';

        blocksHtml += `
          <div style="text-align: ${align}; border-bottom: ${isA4 ? '2px solid #000' : '1px dashed #444'}; padding-bottom: 8px; margin-bottom: 8px;">
            ${block.showLogo ? `<div style="font-weight:900; font-size:18px; color:#1e293b; letter-spacing:-0.5px; margin-bottom:2px;">NEXWAY ERP</div>` : ''}
            <h2 style="margin: 0; font-size: ${titleFontSize}; font-weight: 800; text-transform: uppercase;">${block.title || 'NEXWAY ERP S.A. DE C.V.'}</h2>
            ${block.subtitle ? `<p style="margin: 2px 0; font-size: 10px; color:#475569;">${block.subtitle}</p>` : ''}
            ${block.showGiro !== false ? `<p style="margin: 1px 0; font-size: 9.5px; color:#475569;">${block.giroText || 'Giro: Comercialización y Distribución al por Mayor'}</p>` : ''}
            ${block.showAddress !== false ? `<p style="margin: 1px 0; font-size: 9.5px; color:#475569;">${block.addressText || 'San Salvador, El Salvador C.A.'}</p>` : ''}
            ${block.showPhone !== false ? `<p style="margin: 1px 0; font-size: 9.5px; color:#475569;">Tel: ${block.phoneText || '(503) 2200-0000'} ${block.showEmail ? `| Email: ${block.emailText || 'info@nexway.sv'}` : ''}</p>` : ''}
            ${block.showNitNrc !== false ? `<p style="margin: 1px 0; font-size: 9.5px; font-weight:bold;">NIT: ${block.nitText || '0614-150890-102-1'} | NRC: ${block.nrcText || '283940-1'}</p>` : ''}
            ${block.showDocType !== false ? `<p style="margin: 4px 0 2px 0; font-size: 11px; font-weight: 900; text-transform: uppercase; background:#f1f5f9; padding:2px 4px; display:inline-block; border-radius:3px;">${docTitle}</p>` : ''}
            ${block.showDateTime !== false ? `<p style="margin: 2px 0; font-size: 9px; color:#64748b;">Fecha: ${fecha} ${hora}</p>` : ''}
          </div>
        `;
        break;

      case 'customer':
        const custTitle = block.customerSectionTitle || 'DATOS DEL RECEPTOR / CLIENTE';
        const isShaded = block.customerBoxStyle === 'shaded' || isA4;
        const isBordered = block.customerBoxStyle === 'bordered' || isShaded;

        blocksHtml += `
          <div style="font-size: ${block.fontSize === 'small' ? '9px' : '10px'}; ${isBordered ? 'border: 1px solid #cbd5e1; border-radius: 4px; padding: 6px;' : 'border-bottom: 1px dashed #444; padding-bottom: 6px;'} ${isShaded ? 'background: #f8fafc;' : ''} margin-bottom: 6px;">
            <div style="font-weight: bold; font-size: 9px; text-transform: uppercase; color: #475569; margin-bottom: 3px;">${custTitle}</div>
            <p style="margin: 1.5px 0;"><strong>Cliente:</strong> ${cliente.razon_social}</p>
            ${block.showNit !== false ? `<p style="margin: 1.5px 0;"><strong>NIT/DUI:</strong> ${cliente.nit}</p>` : ''}
            ${block.showNrc !== false ? `<p style="margin: 1.5px 0;"><strong>NRC:</strong> ${cliente.nrc}</p>` : ''}
            ${block.showCustomerGiro ? `<p style="margin: 1.5px 0;"><strong>Giro:</strong> ${cliente.giro}</p>` : ''}
            ${block.showCustomerAddress !== false ? `<p style="margin: 1.5px 0;"><strong>Dirección:</strong> ${cliente.direccion}</p>` : ''}
            ${block.showCodGen !== false ? `<p style="margin: 2px 0; font-family: monospace; font-size: 8.5px; color:#2563eb;"><strong>Cod. Gen:</strong> ${dte.codigo_generacion}</p>` : ''}
            ${block.showControlNum ? `<p style="margin: 1px 0; font-family: monospace; font-size: 8.5px;"><strong>No. Control:</strong> ${dte.numero_control}</p>` : ''}
          </div>
        `;
        break;

      case 'items_table':
        let rows = '';
        items.forEach((it: any) => {
          rows += `
            <tr style="${block.tableRowDivider === 'dotted' ? 'border-bottom: 1px dashed #cbd5e1;' : block.tableRowDivider === 'solid' ? 'border-bottom: 1px solid #e2e8f0;' : ''}">
              ${block.showQty !== false ? `<td style="text-align: left; padding: 3px 0; font-weight:600;">${it.cantidad}x ${block.showUnit ? `<span style="font-size:8px; color:#64748b;">${it.unidad}</span>` : ''}</td>` : ''}
              <td style="text-align: left; padding: 3px 0;">
                <div>${it.descripcion}</div>
                ${block.showSku ? `<div style="font-size:7.5px; color:#64748b;">SKU: ${it.sku}</div>` : ''}
              </td>
              ${block.showPriceUni !== false ? `<td style="text-align: right; padding: 3px 0;">$${parseFloat(it.precio).toFixed(2)}</td>` : ''}
              ${block.showItemTotal !== false ? `<td style="text-align: right; padding: 3px 0; font-weight: bold;">$${parseFloat(it.total).toFixed(2)}</td>` : ''}
            </tr>
          `;
        });

        const thBg = block.tableHeaderStyle === 'dark' ? 'background:#0f172a; color:#fff;' : block.tableHeaderStyle === 'gray' ? 'background:#f1f5f9; color:#0f172a;' : 'border-bottom: 1.5px solid #000;';

        blocksHtml += `
          <table style="width: 100%; border-collapse: collapse; font-size: ${block.tableFontSize === 'xs' ? '8.5px' : block.tableFontSize === 'small' ? '9px' : '10px'}; margin: 6px 0;">
            <thead>
              <tr style="${thBg} text-transform: uppercase; font-size: 8.5px;">
                ${block.showQty !== false ? `<th style="text-align: left; padding: 3px 2px; width: 16%;">Cant</th>` : ''}
                <th style="text-align: left; padding: 3px 2px; width: 50%;">Descripción</th>
                ${block.showPriceUni !== false ? `<th style="text-align: right; padding: 3px 2px; width: 16%;">P.U.</th>` : ''}
                ${block.showItemTotal !== false ? `<th style="text-align: right; padding: 3px 2px; width: 18%;">Total</th>` : ''}
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        `;
        break;

      case 'totals':
        blocksHtml += `
          <div style="border-top: 1px dashed #333; padding-top: 5px; margin-top: 6px; font-size: ${block.fontSize === 'small' ? '9px' : '10px'};">
            ${block.showSubtotal !== false ? `<div style="display:flex; justify-content:space-between; margin:1.5px 0;"><span>Subtotal Gravado:</span><span style="font-weight:600;">$${subtotal.toFixed(2)}</span></div>` : ''}
            ${block.showDiscounts ? `<div style="display:flex; justify-content:space-between; margin:1.5px 0; color:#16a34a;"><span>(-) Descuento:</span><span>$0.00</span></div>` : ''}
            ${block.showIva !== false ? `<div style="display:flex; justify-content:space-between; margin:1.5px 0;"><span>IVA (13%):</span><span>$${iva_13.toFixed(2)}</span></div>` : ''}
            ${block.showRetencion ? `<div style="display:flex; justify-content:space-between; margin:1.5px 0; color:#dc2626;"><span>(-) Retención 1%:</span><span>$0.00</span></div>` : ''}
            
            <div style="display:flex; justify-content:space-between; font-size: 13px; font-weight: 900; border-top: 1.5px solid #000; border-bottom: 1.5px solid #000; padding: 4px 0; margin-top: 3px; background: ${block.totalBoxHighlight !== false ? '#f8fafc' : 'transparent'};">
              <span>TOTAL A PAGAR:</span>
              <span>$${total.toFixed(2)}</span>
            </div>

            ${block.showTotalInLetters !== false ? `
              <div style="font-size: 8px; color: #475569; text-align: center; margin-top: 3px; font-style: italic;">
                Son: SETENTA Y CINCO 00/100 USD
              </div>
            ` : ''}

            ${block.showPaymentMethod ? `
              <div style="display:flex; justify-content:space-between; font-size: 8.5px; color:#475569; margin-top:3px; padding-top:2px; border-top:1px dotted #ccc;">
                <span>Forma de Pago: Efectivo</span>
                <span>Recibido: $100.00 | Cambio: $25.00</span>
              </div>
            ` : ''}
          </div>
        `;
        break;

      case 'qr_hacienda':
        const qrWidth = block.qrSize === 'small' ? '20mm' : block.qrSize === 'large' ? '36mm' : '28mm';
        blocksHtml += `
          <div style="text-align: center; margin: 8px 0; border-top: 1px dashed #444; padding-top: 6px;">
            <div style="display:inline-block; width:${qrWidth}; height:${qrWidth}; border:1px solid #cbd5e1; background:#fff; padding:3px; font-size:8px; font-weight:bold; line-height:28mm; text-align:center;">
              [QR HACIENDA]
            </div>
            ${block.showSello !== false ? `<div style="font-size: 7.5px; font-family: monospace; color:#334155; margin-top:2px; word-break:break-all;"><strong>Sello MH:</strong> ${dte.sello_recepcion}</div>` : ''}
            ${block.showPublicUrl !== false ? `<div style="font-size: 7px; color:#64748b;">${block.qrInstructionText || 'Consulta pública en factura.mh.gob.sv'}</div>` : ''}
          </div>
        `;
        break;

      case 'footer':
        blocksHtml += `
          <div style="margin-top: 10px; border-top: 1px dashed #444; padding-top: 6px; font-size: 8.5px; text-align: center; color: #334155;">
            <p style="font-weight: bold;">${block.customMessage || '¡Gracias por su compra en NexWay ERP!'}</p>
            ${block.policiesText ? `<p style="font-size: 7.5px; color:#64748b; margin-top: 2px;">${block.policiesText}</p>` : ''}
            ${block.socialMediaText ? `<p style="font-size: 7.5px; color:#2563eb; margin-top: 1px;">${block.socialMediaText}</p>` : ''}
            ${block.showResolutionText ? `<p style="font-size: 7px; color:#94a3b8; margin-top: 3px;">${block.resolutionText || 'Resolución MH No. 15000-RES-2026'}</p>` : ''}
            
            ${block.showSignatures ? `
              <div style="display:flex; justify-content:space-around; margin-top:25px; font-size:8px;">
                <div style="width:40%; border-top:1px solid #000; padding-top:2px;">${block.signatureLeftLabel || 'Entregado Por'}</div>
                <div style="width:40%; border-top:1px solid #000; padding-top:2px;">${block.signatureRightLabel || 'Recibido Conforme'}</div>
              </div>
            ` : ''}
          </div>
        `;
        break;

      case 'custom_text':
        blocksHtml += `
          <div style="margin: 4px 0; font-size: ${block.fontSize === 'small' ? '8.5px' : '10px'}; text-align: ${block.align || 'left'}; font-weight: ${block.isBold ? 'bold' : 'normal'}; font-style: ${block.isItalic ? 'italic' : 'normal'}; ${block.isBoxed ? 'border:1px solid #cbd5e1; padding:4px; background:#f8fafc; border-radius:3px;' : ''}">
            <p>${block.content || block.text || ''}</p>
          </div>
        `;
        break;

      case 'divider':
        const borderType = block.dividerStyle === 'dotted' ? '1px dotted #000' : block.dividerStyle === 'double' ? '3px double #000' : block.dividerStyle === 'dashed' ? '1px dashed #000' : block.dividerStyle === 'blank' ? 'none' : '1.5px solid #000';
        const marginVal = block.dividerSpacing === 'compact' ? '3px 0' : block.dividerSpacing === 'wide' ? '10px 0' : '6px 0';
        blocksHtml += `<div style="border-top: ${borderType}; margin: ${marginVal}; height: ${block.dividerStyle === 'blank' ? '8px' : '0'};"></div>`;
        break;
    }
  });

  return `
    <html>
      <head>
        <title>Representación Gráfica DTE - NexWay ERP</title>
        <style>
          @page {
            size: ${isA4 ? 'letter' : scheme.paper_size === '58mm' ? '58mm auto' : '80mm auto'};
            margin: ${isA4 ? '10mm' : '2mm'};
          }
          body {
            margin: 0;
            padding: 0;
            background: #e2e8f0;
          }
        </style>
      </head>
      <body>
        <div style="width: ${paperWidth}; font-family: ${fontFamily}; color: #000; padding: ${isA4 ? '24px' : '10px'}; background: #fff; margin: auto; border: ${isA4 ? '1px solid #cbd5e1' : 'none'}; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); min-height: ${isA4 ? '950px' : 'auto'}; box-sizing: border-box;">
          ${blocksHtml}
        </div>
      </body>
    </html>
  `;
}
